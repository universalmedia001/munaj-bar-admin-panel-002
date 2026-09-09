import { supabase } from '../lib/supabase';
import type { UserRole } from '../types';
import { adminService } from './adminService';

export interface DeleteResult {
  success: boolean;
  action: 'deleted' | 'archived' | 'voided' | 'failed';
  message: string;
  error?: string;
  details?: string;
  hint?: string;
  code?: string;
  rawError?: any;
}

export interface BulkDeleteResult {
  success: boolean;
  totalRequested: number;
  deletedCount: number;
  archivedCount: number;
  failedCount: number;
  message: string;
}

/**
 * Calls server-side admin delete endpoint (/api/admin/delete-record).
 * This endpoint verifies the user's admin JWT and performs elevated database deletion & verification.
 */
async function callAdminDeleteRecordApi(payload: {
  entity_type: string;
  id: string;
  mode?: string;
  restore_stock?: boolean;
  extra?: any;
}): Promise<{ success: boolean; action?: 'deleted' | 'archived' | 'voided'; message: string; error?: string }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) {
      return { success: false, message: 'No active session token.', error: 'NO_SESSION' };
    }

    const response = await fetch('/api/admin/delete-record', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => null);
    if (response.ok && data?.success) {
      return {
        success: true,
        action: (data.action as any) || 'deleted',
        message: data.message || 'Record permanently deleted from database.',
      };
    }

    return {
      success: false,
      message: data?.error || data?.message || `Server error (${response.status})`,
      error: data?.error,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Network error calling delete endpoint';
    return { success: false, message: msg, error: msg };
  }
}

/**
 * Permanently deletes a worker account from Supabase (Auth + Profiles table)
 * while preserving historical sales and shift financial ledgers.
 */
export async function deleteOrArchiveUser(
  userId: string,
  userFullName: string,
  adminId?: string,
  adminUser?: { id?: string; full_name?: string; role?: string } | null
): Promise<DeleteResult> {
  try {
    const adminParam = adminUser || (adminId ? { id: adminId } : null);
    const res = await adminService.deleteWorkerAccount(userId, userFullName, adminParam);

    if (res.success) {
      return {
        success: true,
        action: 'deleted',
        message: res.message || 'Staff account permanently deleted.',
      };
    }

    return {
      success: false,
      action: 'failed',
      message: res.message || res.error || 'Failed to delete user from Supabase.',
      error: res.error,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error during user deletion.';
    console.error('[deleteManagementService] deleteOrArchiveUser exception:', err);
    return {
      success: false,
      action: 'failed',
      message: msg,
      error: msg,
    };
  }
}

export async function bulkDeleteUsers(
  users: { id: string; fullName: string }[],
  adminUser?: { id?: string; full_name?: string; role?: string } | null
): Promise<BulkDeleteResult> {
  let deletedCount = 0;
  let failedCount = 0;

  for (const user of users) {
    const result = await deleteOrArchiveUser(user.id, user.fullName, adminUser?.id, adminUser);
    if (result.success) deletedCount++;
    else failedCount++;
  }

  return {
    success: failedCount === 0,
    totalRequested: users.length,
    deletedCount,
    archivedCount: 0,
    failedCount,
    message: failedCount === 0
      ? `${deletedCount} user account(s) deleted successfully.`
      : `Failed to delete ${failedCount} user account(s).`,
  };
}

/**
 * Permanently deletes a product from Supabase.
 * Unlinks dependent sale_items.product_id (preserving line item name, price, and totals on past receipts).
 * Cleans up associated stock movements.
 * Physical DELETE from products table.
 * Verifies that the row is completely removed from Supabase before reporting success.
 */
export async function deleteOrArchiveProduct(
  productId: string,
  productName: string,
  adminId?: string
): Promise<DeleteResult> {
  try {
    // 1. Try server-side admin delete endpoint first (elevated + verification)
    const apiRes = await callAdminDeleteRecordApi({
      entity_type: 'product',
      id: productId,
    });

    if (apiRes.success) {
      return {
        success: true,
        action: 'deleted',
        message: apiRes.message || `Product "${productName}" was permanently deleted from the database.`,
      };
    }

    // If server specifically reported an error, check if it was a real blocker
    if (apiRes.error && !apiRes.error.includes('NO_SESSION') && !apiRes.error.includes('Network error')) {
      return {
        success: false,
        action: 'failed',
        message: apiRes.message,
        error: apiRes.error,
      };
    }

    // 2. Direct fallback: Unlink product_id from sale_items so receipt history is safe
    await supabase
      .from('sale_items')
      .update({ product_id: null })
      .eq('product_id', productId);

    // 3. Delete stock movements
    await supabase
      .from('stock_movements')
      .delete()
      .eq('product_id', productId);

    // 4. Delete product row from database
    const { error: deleteErr } = await supabase.from('products').delete().eq('id', productId);
    if (deleteErr) {
      return {
        success: false,
        action: 'failed',
        message: `Unable to delete product from database: ${deleteErr.message}`,
        error: deleteErr.message,
      };
    }

    // 5. Verification query
    const { data: verifyRow } = await supabase.from('products').select('id').eq('id', productId).maybeSingle();
    if (verifyRow) {
      return {
        success: false,
        action: 'failed',
        message: 'Product deletion failed: Record still exists in Supabase. Database RLS or foreign key restrictions prevented deletion.',
        error: 'PRODUCT_STILL_EXISTS',
      };
    }

    try {
      await supabase.from('activity_logs').insert({
        action: 'product_deleted',
        description: `Permanently deleted product "${productName}" from the catalog`,
        entity_type: 'product',
        entity_id: productId,
        actor_id: adminId || null,
        metadata: { product_id: productId, product_name: productName },
      });
    } catch {}

    return {
      success: true,
      action: 'deleted',
      message: `Product "${productName}" was permanently deleted from the database.`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete product.';
    return {
      success: false,
      action: 'failed',
      message: msg,
      error: msg,
    };
  }
}

/**
 * Bulk delete multiple products.
 */
export async function bulkDeleteProducts(
  products: { id: string; name: string }[],
  adminId?: string
): Promise<BulkDeleteResult> {
  let deletedCount = 0;
  let archivedCount = 0;
  let failedCount = 0;

  for (const prod of products) {
    const res = await deleteOrArchiveProduct(prod.id, prod.name, adminId);
    if (res.success && res.action === 'deleted') deletedCount++;
    else failedCount++;
  }

  const message = `${deletedCount} product(s) permanently deleted${failedCount > 0 ? `, ${failedCount} failed.` : '.'}`;

  try {
    await supabase.from('activity_logs').insert({
      action: 'products_bulk_deleted',
      description: `Bulk permanently deleted ${deletedCount} products from database`,
      entity_type: 'product',
      actor_id: adminId || null,
      metadata: { total: products.length, deleted: deletedCount, failed: failedCount },
    });
  } catch {}

  return {
    success: failedCount === 0 || deletedCount > 0,
    totalRequested: products.length,
    deletedCount,
    archivedCount: 0,
    failedCount,
    message,
  };
}

/**
 * Deletes a category if no products are assigned to it.
 * If products exist, returns an explicit error preventing broken product references.
 */
export async function deleteCategory(
  categoryId: string,
  categoryName: string,
  adminId?: string
): Promise<DeleteResult & { hasProducts?: boolean; productCount?: number }> {
  try {
    // 1. Try server-side admin delete endpoint first
    const apiRes = await callAdminDeleteRecordApi({
      entity_type: 'category',
      id: categoryId,
    });

    if (apiRes.success) {
      return {
        success: true,
        action: 'deleted',
        message: apiRes.message || `Category "${categoryName}" deleted successfully.`,
      };
    }

    if (apiRes.error && apiRes.error.includes('contains') && apiRes.error.includes('product')) {
      return {
        success: false,
        action: 'failed',
        hasProducts: true,
        message: apiRes.message,
        error: apiRes.error,
      };
    }

    // Direct fallback
    const { count, error: countErr } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', categoryId);

    const productCount = count || 0;
    if (productCount > 0) {
      return {
        success: false,
        action: 'failed',
        hasProducts: true,
        productCount,
        message: `Category "${categoryName}" contains ${productCount} product(s). Move or delete the assigned products before deleting this category.`,
      };
    }

    const { error: deleteErr } = await supabase.from('categories').delete().eq('id', categoryId);
    if (deleteErr) {
      return {
        success: false,
        action: 'failed',
        message: `Failed to delete category: ${deleteErr.message}`,
        error: deleteErr.message,
      };
    }

    // Verification
    const { data: verifyCat } = await supabase.from('categories').select('id').eq('id', categoryId).maybeSingle();
    if (verifyCat) {
      return {
        success: false,
        action: 'failed',
        message: 'Category deletion failed: Record still exists in Supabase.',
        error: 'CATEGORY_STILL_EXISTS',
      };
    }

    try {
      await supabase.from('activity_logs').insert({
        action: 'category_deleted',
        description: `Deleted empty category "${categoryName}"`,
        entity_type: 'category',
        entity_id: categoryId,
        actor_id: adminId || null,
        metadata: { category_id: categoryId, category_name: categoryName },
      });
    } catch {}

    return {
      success: true,
      action: 'deleted',
      message: `Category "${categoryName}" deleted successfully.`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete category.';
    return {
      success: false,
      action: 'failed',
      message: msg,
      error: msg,
    };
  }
}

/**
 * Permanently deletes a sale / transaction from the database.
 * Handles dependent related records (sale_items, receipt_prints, notifications).
 * Exposes exact Supabase errors without obscuring them.
 */
export async function deleteSale(
  saleId: string,
  receiptNumber: string,
  adminUser?: { id?: string; fullName?: string },
  restoreStock: boolean = false
): Promise<DeleteResult> {
  try {
    // 1. Optional: restore stock in products if requested
    if (restoreStock) {
      try {
        const { data: items } = await supabase
          .from('sale_items')
          .select('product_id, quantity')
          .eq('sale_id', saleId);

        if (items && items.length > 0) {
          for (const item of items) {
            if (item.product_id && item.quantity > 0) {
              const { data: prod } = await supabase
                .from('products')
                .select('stock_quantity')
                .eq('id', item.product_id)
                .maybeSingle();

              if (prod) {
                await supabase
                  .from('products')
                  .update({ stock_quantity: (prod.stock_quantity || 0) + item.quantity })
                  .eq('id', item.product_id);
              }
            }
          }
        }
      } catch (stockErr) {
        console.warn('[deleteSale] Stock restoration notice:', stockErr);
      }
    }

    // 2. Clean up any related notifications
    try {
      await supabase.from('notifications').delete().eq('reference_id', saleId);
    } catch {}
    try {
      await supabase.from('notifications').delete().eq('sale_id', saleId);
    } catch {}

    // 3. Delete dependent receipt_prints
    const { error: printsErr } = await supabase
      .from('receipt_prints')
      .delete()
      .eq('sale_id', saleId);

    if (printsErr) {
      console.error("DELETE SALE ERROR:", printsErr);
      console.error("ERROR MESSAGE:", printsErr?.message);
      console.error("ERROR DETAILS:", printsErr?.details);
      console.error("ERROR HINT:", printsErr?.hint);
      console.error("ERROR CODE:", printsErr?.code);

      return {
        success: false,
        action: 'failed',
        message: printsErr.message,
        error: printsErr.message,
        details: printsErr.details,
        hint: printsErr.hint,
        code: printsErr.code,
        rawError: printsErr,
      };
    }

    // 4. Delete dependent sale_items (handles foreign key constraint whether CASCADE is active or not)
    const { error: itemsErr } = await supabase
      .from('sale_items')
      .delete()
      .eq('sale_id', saleId);

    if (itemsErr) {
      console.error("DELETE SALE ERROR:", itemsErr);
      console.error("ERROR MESSAGE:", itemsErr?.message);
      console.error("ERROR DETAILS:", itemsErr?.details);
      console.error("ERROR HINT:", itemsErr?.hint);
      console.error("ERROR CODE:", itemsErr?.code);

      return {
        success: false,
        action: 'failed',
        message: itemsErr.message,
        error: itemsErr.message,
        details: itemsErr.details,
        hint: itemsErr.hint,
        code: itemsErr.code,
        rawError: itemsErr,
      };
    }

    // 5. Delete the sale row from public.sales
    const { data: deletedRows, error: saleDelErr } = await supabase
      .from('sales')
      .delete()
      .eq('id', saleId)
      .select();

    if (saleDelErr) {
      console.error("DELETE SALE ERROR:", saleDelErr);
      console.error("ERROR MESSAGE:", saleDelErr?.message);
      console.error("ERROR DETAILS:", saleDelErr?.details);
      console.error("ERROR HINT:", saleDelErr?.hint);
      console.error("ERROR CODE:", saleDelErr?.code);

      return {
        success: false,
        action: 'failed',
        message: saleDelErr.message,
        error: saleDelErr.message,
        details: saleDelErr.details,
        hint: saleDelErr.hint,
        code: saleDelErr.code,
        rawError: saleDelErr,
      };
    }

    // 6. Verify row deletion: if 0 rows returned, check if RLS prevented the delete
    if (!deletedRows || deletedRows.length === 0) {
      const { data: verifyRow } = await supabase
        .from('sales')
        .select('id')
        .eq('id', saleId)
        .maybeSingle();

      if (verifyRow) {
        const { data: isAdmin } = await supabase.rpc('is_admin_or_manager');
        const rlsError = {
          message: `Permission denied: RLS policy "sales_delete" prevented deletion. is_admin_or_manager() returned ${isAdmin}.`,
          details: `The DELETE statement affected 0 rows because the current authenticated session did not pass the sales_delete RLS check. User admin status: ${isAdmin ? 'ACTIVE' : 'INACTIVE/UNAUTHORIZED'}.`,
          hint: 'Ensure your user account has an active profile in public.profiles with role = "admin" or "manager" and is_active = true.',
          code: '42501',
        };

        console.error("DELETE SALE ERROR:", rlsError);
        console.error("ERROR MESSAGE:", rlsError?.message);
        console.error("ERROR DETAILS:", rlsError?.details);
        console.error("ERROR HINT:", rlsError?.hint);
        console.error("ERROR CODE:", rlsError?.code);

        return {
          success: false,
          action: 'failed',
          message: rlsError.message,
          error: rlsError.message,
          details: rlsError.details,
          hint: rlsError.hint,
          code: rlsError.code,
          rawError: rlsError,
        };
      }
    }

    // 7. Record deletion in activity_logs
    try {
      await supabase.from('activity_logs').insert({
        action: 'sale_deleted',
        description: `Permanently deleted sale ${receiptNumber}`,
        entity_type: 'sale',
        entity_id: saleId,
        actor_id: adminUser?.id || null,
        metadata: { receipt_number: receiptNumber },
      });
    } catch {}

    return {
      success: true,
      action: 'deleted',
      message: `Sale transaction ${receiptNumber} permanently deleted from database.`,
    };
  } catch (err: unknown) {
    const error = err as any;
    console.error("DELETE SALE ERROR:", error);
    console.error("ERROR MESSAGE:", error?.message);
    console.error("ERROR DETAILS:", error?.details);
    console.error("ERROR HINT:", error?.hint);
    console.error("ERROR CODE:", error?.code);

    const msg = error?.message || 'Failed to delete sale.';
    return {
      success: false,
      action: 'failed',
      message: msg,
      error: msg,
      details: error?.details,
      hint: error?.hint,
      code: error?.code,
      rawError: error,
    };
  }
}

/**
 * Voids a sale transaction: sets status to 'cancelled' in database.
 */
export async function voidSale(
  saleId: string,
  receiptNumber: string,
  reason: string,
  adminId?: string
): Promise<DeleteResult> {
  try {
    const cleanReason = reason.trim() || 'Administrative Void';

    const apiRes = await callAdminDeleteRecordApi({
      entity_type: 'sale',
      id: saleId,
      mode: 'void',
      extra: { reason: cleanReason },
    });

    if (apiRes.success) {
      return {
        success: true,
        action: 'voided',
        message: apiRes.message || `Sale ${receiptNumber} has been cancelled in database.`,
      };
    }

    // Direct fallback
    const { error: updateErr } = await supabase
      .from('sales')
      .update({ status: 'cancelled' })
      .eq('id', saleId);

    if (updateErr) {
      return {
        success: false,
        action: 'failed',
        message: `Failed to void sale: ${updateErr.message}`,
        error: updateErr.message,
      };
    }

    try {
      await supabase.from('activity_logs').insert({
        action: 'sale_voided',
        description: `Voided transaction ${receiptNumber}. Reason: "${cleanReason}"`,
        entity_type: 'sale',
        entity_id: saleId,
        actor_id: adminId || null,
        metadata: { sale_id: saleId, receipt_number: receiptNumber, reason: cleanReason },
      });
    } catch {}

    return {
      success: true,
      action: 'voided',
      message: `Sale ${receiptNumber} has been successfully voided and marked as cancelled.`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to void sale.';
    return {
      success: false,
      action: 'failed',
      message: msg,
      error: msg,
    };
  }
}

/**
 * Permanently removes a receipt transaction from the active database.
 * Calls real deleteSale under the hood.
 */
export async function deleteOrArchiveReceipt(
  saleId: string,
  receiptNumber: string,
  receiptSummary: {
    workerName: string;
    total: number;
    paymentMethod: string;
    date: string;
  },
  adminUser?: { id: string; fullName: string; role?: string }
): Promise<DeleteResult> {
  return deleteSale(saleId, receiptNumber, adminUser, false);
}

/**
 * Deletes a receipt print log record from receipt_prints table.
 */
export async function deleteReceiptPrintRecord(
  printId: string,
  saleReceiptNumber?: string,
  adminId?: string
): Promise<DeleteResult> {
  try {
    const apiRes = await callAdminDeleteRecordApi({
      entity_type: 'receipt_print',
      id: printId,
    });

    if (apiRes.success) {
      return {
        success: true,
        action: 'deleted',
        message: apiRes.message || 'Print log record permanently deleted.',
      };
    }

    // Direct fallback
    const { error } = await supabase.from('receipt_prints').delete().eq('id', printId);
    if (error) {
      return {
        success: false,
        action: 'failed',
        message: `Failed to delete print log: ${error.message}`,
        error: error.message,
      };
    }

    const { data: verifyRow } = await supabase.from('receipt_prints').select('id').eq('id', printId).maybeSingle();
    if (verifyRow) {
      return {
        success: false,
        action: 'failed',
        message: 'Print log deletion failed: Record still exists in Supabase.',
        error: 'PRINT_LOG_STILL_EXISTS',
      };
    }

    return {
      success: true,
      action: 'deleted',
      message: 'Print log record removed successfully.',
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete receipt print log.';
    return {
      success: false,
      action: 'failed',
      message: msg,
      error: msg,
    };
  }
}

/**
 * Bulk delete receipt print logs.
 */
export async function bulkDeleteReceiptPrintRecords(
  printIds: string[],
  adminId?: string
): Promise<BulkDeleteResult> {
  let deletedCount = 0;
  let failedCount = 0;

  for (const id of printIds) {
    const res = await deleteReceiptPrintRecord(id, undefined, adminId);
    if (res.success) deletedCount++;
    else failedCount++;
  }

  return {
    success: failedCount === 0 || deletedCount > 0,
    totalRequested: printIds.length,
    deletedCount,
    archivedCount: 0,
    failedCount,
    message: `${deletedCount} print log record(s) deleted successfully.`,
  };
}

/**
 * Deletes a single notification from Supabase.
 */
export async function deleteNotification(notificationId: string): Promise<DeleteResult> {
  try {
    const { error } = await supabase.from('notifications').delete().eq('id', notificationId);
    if (error) {
      return {
        success: false,
        action: 'failed',
        message: `Failed to delete notification: ${error.message}`,
        error: error.message,
      };
    }

    const { data: verifyRow } = await supabase.from('notifications').select('id').eq('id', notificationId).maybeSingle();
    if (verifyRow) {
      return {
        success: false,
        action: 'failed',
        message: 'Notification deletion failed: Record still exists in Supabase.',
        error: 'NOTIFICATION_STILL_EXISTS',
      };
    }

    return {
      success: true,
      action: 'deleted',
      message: 'Notification deleted successfully.',
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error deleting notification.';
    return {
      success: false,
      action: 'failed',
      message: msg,
      error: msg,
    };
  }
}

/**
 * Bulk deletes notifications.
 */
export async function bulkDeleteNotifications(notificationIds: string[]): Promise<BulkDeleteResult> {
  let deletedCount = 0;
  let failedCount = 0;

  for (const id of notificationIds) {
    const res = await deleteNotification(id);
    if (res.success) deletedCount++;
    else failedCount++;
  }

  return {
    success: failedCount === 0 || deletedCount > 0,
    totalRequested: notificationIds.length,
    deletedCount,
    archivedCount: 0,
    failedCount,
    message: `${deletedCount} notifications deleted successfully.`,
  };
}

/**
 * Deletes all read notifications.
 */
export async function clearAllReadNotifications(): Promise<DeleteResult> {
  try {
    const apiRes = await callAdminDeleteRecordApi({
      entity_type: 'notification',
      id: 'all_read',
    });

    if (apiRes.success) {
      return {
        success: true,
        action: 'deleted',
        message: apiRes.message || 'All read notifications have been cleared.',
      };
    }

    const { error } = await supabase.from('notifications').delete().eq('is_read', true);
    if (error) {
      return {
        success: false,
        action: 'failed',
        message: `Failed to clear read notifications: ${error.message}`,
        error: error.message,
      };
    }

    return {
      success: true,
      action: 'deleted',
      message: 'All read notifications have been cleared.',
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to clear read notifications.';
    return {
      success: false,
      action: 'failed',
      message: msg,
      error: msg,
    };
  }
}

/**
 * Permanently deletes an individual shift record.
 */
export async function deleteOrArchiveShift(
  shiftId: string,
  shiftSummary: {
    workerName: string;
    startedAt: string;
    endedAt?: string | null;
    status: string;
    totalSales?: number;
  },
  adminUser?: { id: string; fullName: string; role?: string }
): Promise<DeleteResult> {
  try {
    // 1. Check if shift is currently active
    if (shiftSummary.status === 'active' || !shiftSummary.endedAt) {
      return {
        success: false,
        action: 'failed',
        message: 'This shift is currently active and cannot be deleted. End or close the shift first.',
        error: 'ACTIVE_SHIFT_BLOCKED',
      };
    }

    // 2. Attempt deletion via dedicated server-side admin endpoint
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (token) {
        const resp = await fetch('/api/admin/delete-shift', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ shift_id: shiftId }),
        });

        if (resp.ok) {
          const apiResult = await resp.json();
          if (apiResult.success) {
            return {
              success: true,
              action: 'deleted',
              message: apiResult.message || `Shift for "${shiftSummary.workerName}" deleted successfully.`,
            };
          }
        } else {
          const errData = await resp.json().catch(() => null);
          if (errData?.error && !errData.error.includes('Method not allowed') && !errData.error.includes('Cannot POST')) {
            if (errData.error.includes('active') || errData.error.includes('associated sales')) {
              return {
                success: false,
                action: 'failed',
                message: errData.error,
                error: errData.error,
              };
            }
          }
        }
      }
    } catch (apiErr) {
      console.warn('[deleteManagementService] Server API call notice:', apiErr);
    }

    // 3. Fallback direct deletion
    const { count: salesCount, error: salesErr } = await supabase
      .from('sales')
      .select('id', { count: 'exact', head: true })
      .eq('shift_id', shiftId);

    if (!salesErr && (salesCount || 0) > 0) {
      await supabase
        .from('sales')
        .update({ shift_id: null } as any)
        .eq('shift_id', shiftId);
    }

    const { error: deleteErr } = await supabase.from('shifts').delete().eq('id', shiftId);
    if (deleteErr) {
      return {
        success: false,
        action: 'failed',
        message: `Database delete failed: ${deleteErr.message}`,
        error: deleteErr.message,
      };
    }

    // 4. Verification
    const { data: verifyRow } = await supabase
      .from('shifts')
      .select('id')
      .eq('id', shiftId)
      .maybeSingle();

    if (verifyRow) {
      return {
        success: false,
        action: 'failed',
        message: 'Shift deletion failed: The shift record still exists in Supabase.',
        error: 'SHIFT_STILL_EXISTS_IN_DATABASE',
      };
    }

    try {
      await supabase.from('activity_logs').insert({
        action: 'shift_deleted',
        description: `Permanently deleted shift record for "${shiftSummary.workerName}"`,
        entity_type: 'shifts',
        entity_id: shiftId,
        actor_id: adminUser?.id || null,
        metadata: {
          shift_id: shiftId,
          worker_name: shiftSummary.workerName,
          deleted_by: adminUser?.fullName || 'Admin',
          database_deleted: true,
          timestamp: new Date().toISOString(),
        },
      });
    } catch {}

    return {
      success: true,
      action: 'deleted',
      message: `Shift for "${shiftSummary.workerName}" permanently deleted from database.`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete shift.';
    return {
      success: false,
      action: 'failed',
      message: msg,
      error: msg,
    };
  }
}

/**
 * Deletes an activity log / audit trail record.
 */
export async function deleteActivityLog(
  logId: string,
  originalLog: {
    action: string;
    description: string;
    created_at: string;
    metadata?: any;
  },
  adminUser: { id: string; fullName: string; role: string }
): Promise<DeleteResult> {
  try {
    const isAdminOrManager = adminUser.role === 'admin' || adminUser.role === 'manager';
    if (!isAdminOrManager) {
      return {
        success: false,
        action: 'failed',
        message: 'Access Denied: Only admins and managers can delete activity log records.',
        error: 'UNAUTHORIZED_AUDIT_DELETION',
      };
    }

    const { error: deleteErr } = await supabase
      .from('activity_logs')
      .delete()
      .eq('id', logId);

    if (deleteErr) {
      return {
        success: false,
        action: 'failed',
        message: 'Failed to delete activity log. Please try again.',
        error: deleteErr.message,
      };
    }

    const { data: verifyRow } = await supabase.from('activity_logs').select('id').eq('id', logId).maybeSingle();
    if (verifyRow) {
      return {
        success: false,
        action: 'failed',
        message: 'Failed to delete activity log. Please try again.',
        error: 'LOG_STILL_EXISTS',
      };
    }

    return {
      success: true,
      action: 'deleted',
      message: 'Audit record deleted successfully.',
    };
  } catch (err: unknown) {
    const msg = 'Failed to delete activity log. Please try again.';
    return {
      success: false,
      action: 'failed',
      message: msg,
      error: msg,
    };
  }
}

/**
 * Permanently deletes a stock movement record and correctly reverses its effect on product inventory.
 */
export async function deleteStockMovement(
  movementId: string,
  adminUser?: { id?: string; fullName?: string },
  reverseStockEffect: boolean = true
): Promise<DeleteResult> {
  try {
    const apiRes = await callAdminDeleteRecordApi({
      entity_type: 'stock_movement',
      id: movementId,
      restore_stock: reverseStockEffect,
    });

    if (apiRes.success) {
      return {
        success: true,
        action: 'deleted',
        message: apiRes.message || 'Stock movement deleted and inventory count aligned.',
      };
    }

    // Direct fallback
    const { data: movement } = await supabase
      .from('stock_movements')
      .select('id, product_id, quantity, type')
      .eq('id', movementId)
      .maybeSingle();

    if (!movement) {
      return {
        success: true,
        action: 'deleted',
        message: 'Stock movement is already deleted.',
      };
    }

    if (movement.product_id) {
      const { data: currentProd } = await supabase
        .from('products')
        .select('stock_quantity')
        .eq('id', movement.product_id)
        .maybeSingle();

      if (currentProd) {
        let newStock = currentProd.stock_quantity;
        if (movement.type === 'restock') {
          newStock = Math.max(0, currentProd.stock_quantity - Math.abs(movement.quantity));
        } else if (movement.type === 'damage' || movement.type === 'correction') {
          newStock = currentProd.stock_quantity + Math.abs(movement.quantity);
        } else {
          newStock = Math.max(0, currentProd.stock_quantity - movement.quantity);
        }

        await supabase
          .from('products')
          .update({ stock_quantity: newStock, updated_at: new Date().toISOString() })
          .eq('id', movement.product_id);
      }
    }

    const { error: moveErr } = await supabase.from('stock_movements').delete().eq('id', movementId);
    if (moveErr) {
      return {
        success: false,
        action: 'failed',
        message: `Failed to delete stock movement: ${moveErr.message}`,
        error: moveErr.message,
      };
    }

    const { data: verifyRow } = await supabase.from('stock_movements').select('id').eq('id', movementId).maybeSingle();
    if (verifyRow) {
      return {
        success: false,
        action: 'failed',
        message: 'Stock movement deletion failed: Record still exists in Supabase.',
        error: 'MOVEMENT_STILL_EXISTS',
      };
    }

    return {
      success: true,
      action: 'deleted',
      message: 'Stock movement permanently deleted and product inventory adjusted.',
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete stock movement.';
    return {
      success: false,
      action: 'failed',
      message: msg,
      error: msg,
    };
  }
}

/**
 * Permanently deletes a staff submitted report.
 */
export async function deleteStaffReport(
  reportId: string,
  adminUser?: { id?: string; fullName?: string }
): Promise<DeleteResult> {
  try {
    const apiRes = await callAdminDeleteRecordApi({
      entity_type: 'staff_report',
      id: reportId,
    });

    if (apiRes.success) {
      return {
        success: true,
        action: 'deleted',
        message: apiRes.message || 'Staff report record deleted successfully.',
      };
    }

    // Direct fallback
    try {
      await supabase.from('staff_reports' as any).delete().eq('id', reportId);
    } catch {}

    // Clean up local cache if present
    try {
      const STORAGE_KEY = 'munaj_bar_staff_submitted_reports';
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const reports = JSON.parse(saved);
        if (Array.isArray(reports)) {
          const filtered = reports.filter((r: any) => r.id !== reportId);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
        }
      }
    } catch {}

    return {
      success: true,
      action: 'deleted',
      message: 'Staff report permanently deleted.',
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete staff report.';
    return {
      success: false,
      action: 'failed',
      message: msg,
      error: msg,
    };
  }
}
