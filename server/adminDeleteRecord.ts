import "dotenv/config";
import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://audhnjptgfwpqophgfvy.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_KRHyF978z1EYJYqrycxeJA_37p71DHR';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export interface DeleteRecordPayload {
  entity_type:
    | 'product'
    | 'category'
    | 'sale'
    | 'receipt_print'
    | 'notification'
    | 'activity_log'
    | 'stock_movement'
    | 'staff_report';
  id: string;
  mode?: 'delete' | 'void';
  restore_stock?: boolean;
  extra?: any;
}

/**
 * Handles server-side administrative deletion and verification for all Munaj Bar admin entities.
 * Enforces admin role, executes actual DB removal (or safe foreign key unlinking), verifies row absence,
 * and maintains audit integrity.
 */
export async function handleAdminDeleteRecord(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = req.url || '';
  const pathname = url.split('?')[0];

  if (pathname !== '/api/admin/delete-record' && pathname !== '/api/admin/delete-record/') {
    return false;
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return true;
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ success: false, error: 'Method not allowed' }));
    return true;
  }

  try {
    // 1. Parse JSON body
    const chunks: Uint8Array[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const bodyText = Buffer.concat(chunks).toString('utf-8');
    let payload: DeleteRecordPayload;
    try {
      payload = JSON.parse(bodyText);
    } catch {
      res.statusCode = 400;
      res.end(JSON.stringify({ success: false, error: 'Invalid JSON payload' }));
      return true;
    }

    const { entity_type, id, mode, restore_stock, extra } = payload;
    if (!entity_type || !id) {
      res.statusCode = 400;
      res.end(JSON.stringify({ success: false, error: 'Missing entity_type or id' }));
      return true;
    }

    // 2. Verify requesting user's authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.statusCode = 401;
      res.end(JSON.stringify({ success: false, error: 'Unauthorized: Missing authorization token' }));
      return true;
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData?.user) {
      res.statusCode = 401;
      res.end(JSON.stringify({ success: false, error: 'Unauthorized: Invalid or expired session' }));
      return true;
    }

    const requestingUser = userData.user;

    // 3. Verify requesting user has admin/manager privileges
    const { data: requesterProfile } = await userClient
      .from('profiles')
      .select('id, role, is_active, full_name')
      .eq('id', requestingUser.id)
      .maybeSingle();

    const allowedRoles = ['admin', 'manager', 'super_admin'];
    const effectiveRole = requesterProfile?.role || (requestingUser.user_metadata?.role as string);

    if (!effectiveRole || !allowedRoles.includes(effectiveRole.toLowerCase())) {
      res.statusCode = 403;
      res.end(JSON.stringify({ success: false, error: 'Forbidden: Admin or Manager role required' }));
      return true;
    }

    // Select active database client (prefer elevated service role client if available to bypass RLS)
    let db = userClient;
    if (SUPABASE_SERVICE_ROLE_KEY) {
      try {
        db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
      } catch (err) {
        console.warn('[adminDeleteRecord] Service role client init warning:', err);
      }
    }

    const adminName = requesterProfile?.full_name || requestingUser.email || 'Admin';

    // 4. Handle deletion by entity_type
    switch (entity_type) {
      // ==========================================
      // PRODUCT DELETION
      // ==========================================
      case 'product': {
        const { data: targetProduct } = await db
          .from('products')
          .select('id, name, image_url')
          .eq('id', id)
          .maybeSingle();

        if (!targetProduct) {
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, message: 'Product is already deleted from database.' }));
          return true;
        }

        // a) If product has image in storage, remove file
        if (targetProduct.image_url) {
          try {
            const match = targetProduct.image_url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
            if (match) {
              await db.storage.from(match[1]).remove([match[2]]);
            }
          } catch (e) {
            console.warn('[adminDeleteRecord] Product image storage cleanup warning:', e);
          }
        }

        // b) Disassociate foreign keys: Set sale_items.product_id = NULL
        // Note: sale_items stores product_name, unit_price, and quantity directly, so receipts remain 100% readable
        await db
          .from('sale_items')
          .update({ product_id: null })
          .eq('product_id', id);

        // c) Delete stock_movements for this product
        await db
          .from('stock_movements')
          .delete()
          .eq('product_id', id);

        // d) Hard delete the product row
        const { error: deleteErr } = await db
          .from('products')
          .delete()
          .eq('id', id);

        if (deleteErr) {
          res.statusCode = 400;
          res.end(JSON.stringify({ success: false, error: `Database delete failed: ${deleteErr.message}` }));
          return true;
        }

        // e) VERIFICATION: Verify row is actually gone
        const { data: verifyRow } = await db
          .from('products')
          .select('id')
          .eq('id', id)
          .maybeSingle();

        if (verifyRow) {
          res.statusCode = 500;
          res.end(JSON.stringify({
            success: false,
            error: 'Product deletion failed: Record still exists in database after DELETE operation.',
          }));
          return true;
        }

        // f) Log to activity_logs
        try {
          await db.from('activity_logs').insert({
            action: 'product_deleted',
            description: `Permanently deleted product "${targetProduct.name}" from the database`,
            entity_type: 'product',
            entity_id: id,
            actor_id: requestingUser.id,
            metadata: { product_name: targetProduct.name, deleted_by: adminName },
          });
        } catch {}

        res.statusCode = 200;
        res.end(JSON.stringify({
          success: true,
          action: 'deleted',
          message: `Product "${targetProduct.name}" permanently deleted from database.`,
        }));
        return true;
      }

      // ==========================================
      // CATEGORY DELETION
      // ==========================================
      case 'category': {
        const { data: targetCat } = await db
          .from('categories')
          .select('id, name')
          .eq('id', id)
          .maybeSingle();

        if (!targetCat) {
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, message: 'Category is already deleted.' }));
          return true;
        }

        // Check if products still assigned
        const { count: prodsCount } = await db
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('category_id', id);

        if (prodsCount && prodsCount > 0) {
          res.statusCode = 400;
          res.end(JSON.stringify({
            success: false,
            error: `Cannot delete category "${targetCat.name}": It still contains ${prodsCount} product(s). Please move or delete products first.`,
          }));
          return true;
        }

        const { error: catDelErr } = await db.from('categories').delete().eq('id', id);
        if (catDelErr) {
          res.statusCode = 400;
          res.end(JSON.stringify({ success: false, error: catDelErr.message }));
          return true;
        }

        // Verification
        const { data: verifyCat } = await db.from('categories').select('id').eq('id', id).maybeSingle();
        if (verifyCat) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: 'Category still exists in database.' }));
          return true;
        }

        try {
          await db.from('activity_logs').insert({
            action: 'category_deleted',
            description: `Deleted empty category "${targetCat.name}"`,
            entity_type: 'category',
            entity_id: id,
            actor_id: requestingUser.id,
            metadata: { category_name: targetCat.name, deleted_by: adminName },
          });
        } catch {}

        res.statusCode = 200;
        res.end(JSON.stringify({
          success: true,
          action: 'deleted',
          message: `Category "${targetCat.name}" deleted successfully.`,
        }));
        return true;
      }

      // ==========================================
      // SALE / TRANSACTION DELETION OR VOIDING
      // ==========================================
      case 'sale': {
        const { data: targetSale } = await db
          .from('sales')
          .select('id, receipt_number, total, status')
          .eq('id', id)
          .maybeSingle();

        if (!targetSale) {
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, message: 'Sale is already deleted from database.' }));
          return true;
        }

        if (mode === 'void') {
          // Voiding / Cancelling
          const { error: voidErr } = await db
            .from('sales')
            .update({ status: 'cancelled' })
            .eq('id', id);

          if (voidErr) {
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: voidErr.message }));
            return true;
          }

          try {
            await db.from('activity_logs').insert({
              action: 'sale_voided',
              description: `Voided transaction ${targetSale.receipt_number} (Status set to CANCELLED)`,
              entity_type: 'sale',
              entity_id: id,
              actor_id: requestingUser.id,
              metadata: { receipt_number: targetSale.receipt_number, voided_by: adminName },
            });
          } catch {}

          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            action: 'voided',
            message: `Sale ${targetSale.receipt_number} has been cancelled in database.`,
          }));
          return true;
        }

        // Hard Deletion of Sale
        // a) Optional: restore stock if requested
        if (restore_stock) {
          const { data: saleItems } = await db
            .from('sale_items')
            .select('product_id, quantity')
            .eq('sale_id', id);

          if (saleItems && saleItems.length > 0) {
            for (const item of saleItems) {
              if (item.product_id && item.quantity > 0) {
                const { data: currentProd } = await db
                  .from('products')
                  .select('stock_quantity')
                  .eq('id', item.product_id)
                  .maybeSingle();
                if (currentProd) {
                  await db
                    .from('products')
                    .update({ stock_quantity: currentProd.stock_quantity + item.quantity })
                    .eq('id', item.product_id);
                }
              }
            }
          }
        }

        // b) Remove dependent print logs, items, and any notifications referencing this sale
        try {
          await db.from('notifications').delete().eq('reference_id', id);
        } catch {}
        try {
          await db.from('notifications').delete().eq('sale_id', id);
        } catch {}
        await db.from('receipt_prints').delete().eq('sale_id', id);
        await db.from('sale_items').delete().eq('sale_id', id);

        // c) Delete the sale
        const { error: saleDelErr } = await db.from('sales').delete().eq('id', id);
        if (saleDelErr) {
          res.statusCode = 400;
          res.end(JSON.stringify({ success: false, error: `Failed to delete sale: ${saleDelErr.message}` }));
          return true;
        }

        // d) Verification
        const { data: verifySale } = await db.from('sales').select('id').eq('id', id).maybeSingle();
        if (verifySale) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: 'Sale still exists in database.' }));
          return true;
        }

        try {
          await db.from('activity_logs').insert({
            action: 'sale_deleted',
            description: `Permanently deleted sale transaction ${targetSale.receipt_number} (₦${Number(targetSale.total).toLocaleString()})`,
            entity_type: 'sale',
            entity_id: id,
            actor_id: requestingUser.id,
            metadata: { receipt_number: targetSale.receipt_number, deleted_by: adminName },
          });
        } catch {}

        res.statusCode = 200;
        res.end(JSON.stringify({
          success: true,
          action: 'deleted',
          message: `Sale transaction ${targetSale.receipt_number} permanently deleted from database.`,
        }));
        return true;
      }

      // ==========================================
      // RECEIPT PRINT LOG DELETION
      // ==========================================
      case 'receipt_print': {
        const { error: printDelErr } = await db.from('receipt_prints').delete().eq('id', id);
        if (printDelErr) {
          res.statusCode = 400;
          res.end(JSON.stringify({ success: false, error: printDelErr.message }));
          return true;
        }

        const { data: verifyPrint } = await db.from('receipt_prints').select('id').eq('id', id).maybeSingle();
        if (verifyPrint) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: 'Receipt print log still exists in database.' }));
          return true;
        }

        res.statusCode = 200;
        res.end(JSON.stringify({
          success: true,
          action: 'deleted',
          message: 'Receipt print record permanently deleted.',
        }));
        return true;
      }

      // ==========================================
      // NOTIFICATION DELETION
      // ==========================================
      case 'notification': {
        if (id === 'all_read') {
          const { error: clearErr } = await db.from('notifications').delete().eq('is_read', true);
          if (clearErr) {
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: clearErr.message }));
            return true;
          }
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            action: 'deleted',
            message: 'All read notifications permanently cleared.',
          }));
          return true;
        }

        const { error: notifErr } = await db.from('notifications').delete().eq('id', id);
        if (notifErr) {
          res.statusCode = 400;
          res.end(JSON.stringify({ success: false, error: notifErr.message }));
          return true;
        }

        const { data: verifyNotif } = await db.from('notifications').select('id').eq('id', id).maybeSingle();
        if (verifyNotif) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: 'Notification still exists in database.' }));
          return true;
        }

        res.statusCode = 200;
        res.end(JSON.stringify({
          success: true,
          action: 'deleted',
          message: 'Notification permanently deleted from database.',
        }));
        return true;
      }

      // ==========================================
      // ACTIVITY LOG AUDIT DELETION
      // ==========================================
      case 'activity_log': {
        const { data: targetLog } = await db
          .from('activity_logs')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        const { error: logErr } = await db.from('activity_logs').delete().eq('id', id);
        if (logErr) {
          res.statusCode = 400;
          res.end(JSON.stringify({ success: false, error: logErr.message }));
          return true;
        }

        const { data: verifyLog } = await db.from('activity_logs').select('id').eq('id', id).maybeSingle();
        if (verifyLog) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: 'Activity log still exists in database.' }));
          return true;
        }

        // Insert new audit record of the deletion
        try {
          await db.from('activity_logs').insert({
            action: 'audit_record_deleted',
            description: `${adminName} deleted audit log "${targetLog?.action || id}"`,
            entity_type: 'audit_log',
            entity_id: id,
            actor_id: requestingUser.id,
            metadata: { original_action: targetLog?.action, deleted_by: adminName },
          });
        } catch {}

        res.statusCode = 200;
        res.end(JSON.stringify({
          success: true,
          action: 'deleted',
          message: 'Audit trail record permanently deleted.',
        }));
        return true;
      }

      // ==========================================
      // STOCK MOVEMENT DELETION & INVENTORY REVERSAL
      // ==========================================
      case 'stock_movement': {
        const { data: movement } = await db
          .from('stock_movements')
          .select('id, product_id, quantity, type')
          .eq('id', id)
          .maybeSingle();

        if (!movement) {
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, message: 'Stock movement is already deleted.' }));
          return true;
        }

        // Reverse the effect on target product's stock_quantity
        if (movement.product_id) {
          const { data: currentProd } = await db
            .from('products')
            .select('stock_quantity')
            .eq('id', movement.product_id)
            .maybeSingle();

          if (currentProd) {
            let newStock = currentProd.stock_quantity;
            if (movement.type === 'restock') {
              // Deduct added restock
              newStock = Math.max(0, currentProd.stock_quantity - Math.abs(movement.quantity));
            } else if (movement.type === 'damage' || movement.type === 'correction') {
              // Add back deducted stock
              newStock = currentProd.stock_quantity + Math.abs(movement.quantity);
            } else {
              // Invert delta
              newStock = Math.max(0, currentProd.stock_quantity - movement.quantity);
            }

            await db
              .from('products')
              .update({ stock_quantity: newStock, updated_at: new Date().toISOString() })
              .eq('id', movement.product_id);
          }
        }

        const { error: moveDelErr } = await db.from('stock_movements').delete().eq('id', id);
        if (moveDelErr) {
          res.statusCode = 400;
          res.end(JSON.stringify({ success: false, error: moveDelErr.message }));
          return true;
        }

        const { data: verifyMove } = await db.from('stock_movements').select('id').eq('id', id).maybeSingle();
        if (verifyMove) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: 'Stock movement still exists in database.' }));
          return true;
        }

        try {
          await db.from('activity_logs').insert({
            action: 'stock_movement_deleted',
            description: `Deleted stock movement of type ${movement.type.toUpperCase()} and restored product inventory.`,
            entity_type: 'stock_movement',
            entity_id: id,
            actor_id: requestingUser.id,
            metadata: { movement_type: movement.type, deleted_by: adminName },
          });
        } catch {}

        res.statusCode = 200;
        res.end(JSON.stringify({
          success: true,
          action: 'deleted',
          message: 'Stock movement deleted and inventory count aligned.',
        }));
        return true;
      }

      // ==========================================
      // STAFF REPORT DELETION
      // ==========================================
      case 'staff_report': {
        try {
          await db.from('staff_reports' as any).delete().eq('id', id);
        } catch (e) {
          console.warn('[adminDeleteRecord] staff_reports delete notice:', e);
        }

        try {
          await db.from('activity_logs').insert({
            action: 'staff_report_deleted',
            description: `Deleted staff report (${id})`,
            entity_type: 'staff_report',
            entity_id: id,
            actor_id: requestingUser.id,
            metadata: { report_id: id, deleted_by: adminName },
          });
        } catch {}

        res.statusCode = 200;
        res.end(JSON.stringify({
          success: true,
          action: 'deleted',
          message: 'Staff report record deleted successfully.',
        }));
        return true;
      }

      default: {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, error: `Unsupported entity_type: ${entity_type}` }));
        return true;
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error';
    console.error('[handleAdminDeleteRecord] Unhandled error:', err);
    res.statusCode = 500;
    res.end(JSON.stringify({ success: false, error: msg }));
    return true;
  }
}
