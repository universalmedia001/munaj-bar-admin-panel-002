import "dotenv/config";
import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://audhnjptgfwpqophgfvy.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_KRHyF978z1EYJYqrycxeJA_37p71DHR';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export interface ResetBusinessDataPayload {
  confirm_phrase: string;
  reset_sales?: boolean;
  reset_shifts?: boolean;
  reset_product_stocks?: boolean;
  reset_expenses?: boolean;
}

/**
 * Handles server-side administrative reset of business data for fresh operating periods.
 * Enforces admin authorization, strictly preserves workers/auth/categories/products catalog,
 * and resets sales, shifts, order counts, and figures to 0.
 */
export async function handleAdminResetBusinessData(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = req.url || '';
  const pathname = url.split('?')[0];

  if (pathname !== '/api/admin/reset-business-data' && pathname !== '/api/admin/reset-business-data/') {
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
    res.end(JSON.stringify({ success: false, error: 'Method not allowed. Use POST.' }));
    return true;
  }

  try {
    // 1. Read body
    const chunks: Uint8Array[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const bodyText = Buffer.concat(chunks).toString('utf-8');
    let payload: ResetBusinessDataPayload;
    try {
      payload = JSON.parse(bodyText);
    } catch {
      res.statusCode = 400;
      res.end(JSON.stringify({ success: false, error: 'Invalid JSON payload' }));
      return true;
    }

    if (!payload.confirm_phrase || (payload.confirm_phrase.trim().toUpperCase() !== 'RESET' && payload.confirm_phrase.trim().toUpperCase() !== 'CONFIRM RESET')) {
      res.statusCode = 400;
      res.end(JSON.stringify({ success: false, error: 'Invalid confirmation phrase. Must be "RESET".' }));
      return true;
    }

    // 2. Authorize admin
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.statusCode = 401;
      res.end(JSON.stringify({ success: false, error: 'Unauthorized: Missing authorization token' }));
      return true;
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData?.user) {
      res.statusCode = 401;
      res.end(JSON.stringify({ success: false, error: 'Unauthorized: Invalid or expired session' }));
      return true;
    }

    const adminUser = userData.user;

    // Verify role in profiles
    const { data: adminProfile } = await userClient
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('id', adminUser.id)
      .maybeSingle();

    const allowedRoles = ['admin', 'manager', 'super_admin'];
    if (!adminProfile || !allowedRoles.includes(adminProfile.role)) {
      res.statusCode = 403;
      res.end(JSON.stringify({ success: false, error: 'Forbidden: Admin or manager privilege required.' }));
      return true;
    }

    // 3. Choose database client (prefer service role key if available, else userClient under admin RLS)
    const dbClient = SUPABASE_SERVICE_ROLE_KEY
      ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
      : userClient;

    const resetSales = payload.reset_sales !== false;
    const resetShifts = payload.reset_shifts !== false;
    const resetProductStocks = Boolean(payload.reset_product_stocks);
    const resetExpenses = Boolean(payload.reset_expenses);

    console.info(`[ResetBusinessData] Initiated by ${adminProfile.email} (${adminProfile.role}). Scope:`, {
      resetSales,
      resetShifts,
      resetProductStocks,
      resetExpenses,
    });

    // 4. Safe execution in foreign-key dependency order
    const errors: string[] = [];

    if (resetSales) {
      // a. Delete receipt prints
      const { error: errPrints } = await dbClient
        .from('receipt_prints')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (errPrints) console.warn('[Reset] Receipt prints clear notice:', errPrints.message);

      // b. Delete sale items
      const { error: errItems } = await dbClient
        .from('sale_items')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (errItems) console.warn('[Reset] Sale items clear notice:', errItems.message);

      // c. Delete sales
      const { error: errSales } = await dbClient
        .from('sales')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (errSales) {
        console.error('[Reset] Sales clear error:', errSales);
        errors.push(`Failed to clear sales: ${errSales.message}`);
      }

      // d. Clear stock movements associated with sales
      const { error: errMovements } = await dbClient
        .from('stock_movements')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (errMovements) console.warn('[Reset] Stock movements clear notice:', errMovements.message);
    }

    if (resetShifts) {
      // Delete shifts (all sales referencing shifts are already deleted above)
      const { error: errShifts } = await dbClient
        .from('shifts')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (errShifts) console.warn('[Reset] Shifts clear notice:', errShifts.message);
    }

    if (resetProductStocks) {
      // Reset stock_quantity to 0 for existing products.
      // DOES NOT create any products. If zero products exist, nothing is created.
      const { error: errStocks } = await dbClient
        .from('products')
        .update({ stock_quantity: 0, updated_at: new Date().toISOString() })
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (errStocks) console.warn('[Reset] Product stock reset notice:', errStocks.message);
    }

    if (resetExpenses) {
      try {
        await dbClient
          .from('expenses')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');
      } catch (err: any) {
        console.warn('[Reset] Expenses delete notice:', err?.message);
      }
    }

    // 5. Audit log
    try {
      await dbClient.from('activity_logs').insert({
        actor_id: adminProfile.id,
        action: 'business_data_reset',
        entity_type: 'system',
        description: `Admin ${adminProfile.full_name || adminProfile.email} reset business figures for a fresh period.`,
        metadata: {
          reset_sales: resetSales,
          reset_shifts: resetShifts,
          reset_product_stocks: resetProductStocks,
          reset_expenses: resetExpenses,
          timestamp: new Date().toISOString(),
        },
      });
    } catch {
      // Non-blocking
    }

    if (errors.length > 0) {
      res.statusCode = 500;
      res.end(JSON.stringify({ success: false, error: errors.join(', ') }));
      return true;
    }

    res.statusCode = 200;
    res.end(
      JSON.stringify({
        success: true,
        message: 'Business data has been reset to ₦0 for a fresh operating period.',
        details: {
          sales_reset: resetSales,
          shifts_reset: resetShifts,
          product_stocks_reset: resetProductStocks,
          expenses_reset: resetExpenses,
        },
      })
    );
    return true;
  } catch (err: any) {
    console.error('[ResetBusinessData] Unhandled error:', err);
    res.statusCode = 500;
    res.end(JSON.stringify({ success: false, error: err?.message || 'Internal server error during reset.' }));
    return true;
  }
}
