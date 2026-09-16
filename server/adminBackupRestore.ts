import "dotenv/config";
import type { IncomingMessage, ServerResponse } from 'http';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://audhnjptgfwpqophgfvy.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_KRHyF978z1EYJYqrycxeJA_37p71DHR';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

type BackupType = 'MANUAL' | 'BEFORE_RESET' | 'PRE_RESTORE';

// Tables to back up, in dependency order (parents first)
const BACKUP_TABLES = [
  'categories',
  'products',
  'shifts',
  'sales',
  'sale_items',
  'receipt_prints',
  'stock_movements',
  'expenses',
] as const;

/**
 * Handles all backup and restore API endpoints.
 * Routes:
 *   POST /api/admin/backup            — create a backup
 *   GET  /api/admin/backups           — list backups
 *   POST /api/admin/restore            — restore from a backup
 */
export async function handleAdminBackupRestore(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = req.url || '';
  const pathname = url.split('?')[0];

  const isBackup = pathname === '/api/admin/backup' || pathname === '/api/admin/backup/';
  const isList = pathname === '/api/admin/backups' || pathname === '/api/admin/backups/';
  const isRestore = pathname === '/api/admin/restore' || pathname === '/api/admin/restore/';

  if (!isBackup && !isList && !isRestore) {
    return false;
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return true;
  }

  // --- Parse body for POST endpoints ---
  let body: any = null;
  if (req.method === 'POST') {
    const chunks: Uint8Array[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const bodyText = Buffer.concat(chunks).toString('utf-8');
    try {
      body = JSON.parse(bodyText);
    } catch {
      res.statusCode = 400;
      res.end(JSON.stringify({ success: false, error: 'Invalid JSON payload' }));
      return true;
    }
  }

  // --- Route: GET /api/admin/backups (list) ---
  if (isList && req.method === 'GET') {
    return await handleListBackups(req, res);
  }

  // --- Route: POST /api/admin/backup (create backup) ---
  if (isBackup && req.method === 'POST') {
    return await handleCreateBackup(req, res, body);
  }

  // --- Route: POST /api/admin/restore (restore from backup) ---
  if (isRestore && req.method === 'POST') {
    return await handleRestore(req, res, body);
  }

  res.statusCode = 405;
  res.end(JSON.stringify({ success: false, error: 'Method not allowed' }));
  return true;
}

// ============================================================================
// AUTHORIZATION HELPER
// ============================================================================
async function authorize(req: IncomingMessage): Promise<{
  authorized: boolean;
  statusCode?: number;
  error?: string;
  adminId?: string;
  adminName?: string;
  userClient?: SupabaseClient;
  dbClient?: SupabaseClient;
}> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authorized: false, statusCode: 401, error: 'Unauthorized: Missing authorization token' };
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  if (userError || !userData?.user) {
    return { authorized: false, statusCode: 401, error: 'Unauthorized: Invalid or expired session' };
  }

  const { data: adminProfile } = await userClient
    .from('profiles')
    .select('id, full_name, email, role, is_active')
    .eq('id', userData.user.id)
    .maybeSingle();

  const allowedRoles = ['admin', 'manager', 'super_admin'];
  if (!adminProfile || !allowedRoles.includes(adminProfile.role) || !adminProfile.is_active) {
    return { authorized: false, statusCode: 403, error: 'Forbidden: Admin or manager privilege required.' };
  }

  const dbClient = SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : userClient;

  return {
    authorized: true,
    adminId: adminProfile.id,
    adminName: adminProfile.full_name || adminProfile.email,
    userClient,
    dbClient,
  };
}

// ============================================================================
// GATHER BUSINESS DATA FOR BACKUP
// ============================================================================
async function gatherBusinessData(db: SupabaseClient): Promise<{ data: Record<string, any[]>; counts: Record<string, number> }> {
  const data: Record<string, any[]> = {};
  const counts: Record<string, number> = {};

  for (const table of BACKUP_TABLES) {
    const { data: rows, error } = await db.from(table).select('*');
    if (error) {
      console.warn(`[Backup] Could not read table ${table}:`, error.message);
      data[table] = [];
      counts[table] = 0;
    } else {
      data[table] = rows || [];
      counts[table] = (rows || []).length;
    }
  }

  return { data, counts };
}

// ============================================================================
// CREATE BACKUP
// ============================================================================
async function handleCreateBackup(
  req: IncomingMessage,
  res: ServerResponse,
  body: any
): Promise<boolean> {
  try {
    const auth = await authorize(req);
    if (!auth.authorized) {
      res.statusCode = auth.statusCode!;
      res.end(JSON.stringify({ success: false, error: auth.error }));
      return true;
    }

    const db = auth.dbClient!;
    const backupType: BackupType = body?.backup_type || 'MANUAL';

    if (!['MANUAL', 'BEFORE_RESET', 'PRE_RESTORE'].includes(backupType)) {
      res.statusCode = 400;
      res.end(JSON.stringify({ success: false, error: 'Invalid backup_type. Must be MANUAL, BEFORE_RESET, or PRE_RESTORE.' }));
      return true;
    }

    // 1. Insert a CREATING placeholder row
    const { data: placeholder, error: insertErr } = await db
      .from('business_backups')
      .insert({
        created_by: auth.adminId,
        backup_type: backupType,
        status: 'CREATING',
        schema_version: '1.0',
        record_counts: {},
        backup_data: {},
      })
      .select()
      .single();

    if (insertErr || !placeholder) {
      res.statusCode = 500;
      res.end(JSON.stringify({ success: false, error: 'Failed to create backup record: ' + (insertErr?.message || 'Unknown') }));
      return true;
    }

    const backupId = placeholder.id;

    // 2. Gather all business data
    const { data: backupData, counts } = await gatherBusinessData(db);

    // 3. Update the backup row with full data and SUCCESS status
    const { error: updateErr } = await db
      .from('business_backups')
      .update({
        status: 'SUCCESS',
        record_counts: counts,
        backup_data: backupData,
      })
      .eq('id', backupId);

    if (updateErr) {
      // Mark as FAILED
      await db.from('business_backups').update({ status: 'FAILED' }).eq('id', backupId);
      res.statusCode = 500;
      res.end(JSON.stringify({ success: false, error: 'Failed to finalize backup: ' + updateErr.message }));
      return true;
    }

    // 4. Verify the backup was written
    const { data: verify } = await db
      .from('business_backups')
      .select('id, status, record_counts')
      .eq('id', backupId)
      .maybeSingle();

    if (!verify || verify.status !== 'SUCCESS') {
      await db.from('business_backups').update({ status: 'FAILED' }).eq('id', backupId);
      res.statusCode = 500;
      res.end(JSON.stringify({ success: false, error: 'Backup verification failed.' }));
      return true;
    }

    // 5. Audit log
    try {
      await db.from('activity_logs').insert({
        actor_id: auth.adminId,
        action: 'business_backup_created',
        entity_type: 'business_backups',
        entity_id: backupId,
        description: `${auth.adminName} created a ${backupType} backup.`,
        metadata: { backup_id: backupId, backup_type: backupType, record_counts: counts },
      });
    } catch {}

    res.statusCode = 200;
    res.end(JSON.stringify({
      success: true,
      backup_id: backupId,
      backup_type: backupType,
      record_counts: counts,
      created_at: verify.created_at || new Date().toISOString(),
      message: 'Backup completed successfully.',
    }));
    return true;
  } catch (err: any) {
    console.error('[Backup] Unhandled error:', err);
    res.statusCode = 500;
    res.end(JSON.stringify({ success: false, error: err?.message || 'Internal server error during backup.' }));
    return true;
  }
}

// ============================================================================
// LIST BACKUPS
// ============================================================================
async function handleListBackups(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  try {
    const auth = await authorize(req);
    if (!auth.authorized) {
      res.statusCode = auth.statusCode!;
      res.end(JSON.stringify({ success: false, error: auth.error }));
      return true;
    }

    const db = auth.dbClient!;

    const { data: backups, error } = await db
      .from('business_backups')
      .select('id, created_at, backup_type, status, schema_version, record_counts, notes, created_by')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ success: false, error: 'Failed to list backups: ' + error.message }));
      return true;
    }

    res.statusCode = 200;
    res.end(JSON.stringify({
      success: true,
      backups: (backups || []).filter((b: any) => b.status === 'SUCCESS'),
    }));
    return true;
  } catch (err: any) {
    res.statusCode = 500;
    res.end(JSON.stringify({ success: false, error: err?.message || 'Internal server error.' }));
    return true;
  }
}

// ============================================================================
// RESTORE FROM BACKUP
// ============================================================================
async function handleRestore(
  req: IncomingMessage,
  res: ServerResponse,
  body: any
): Promise<boolean> {
  try {
    const auth = await authorize(req);
    if (!auth.authorized) {
      res.statusCode = auth.statusCode!;
      res.end(JSON.stringify({ success: false, error: auth.error }));
      return true;
    }

    const db = auth.dbClient!;
    const backupId = body?.backup_id;

    if (!backupId) {
      res.statusCode = 400;
      res.end(JSON.stringify({ success: false, error: 'Missing backup_id.' }));
      return true;
    }

    // 1. Read the selected backup
    const { data: backup, error: readErr } = await db
      .from('business_backups')
      .select('*')
      .eq('id', backupId)
      .maybeSingle();

    if (readErr || !backup) {
      res.statusCode = 404;
      res.end(JSON.stringify({ success: false, error: 'Backup not found.' }));
      return true;
    }

    if (backup.status !== 'SUCCESS') {
      res.statusCode = 400;
      res.end(JSON.stringify({ success: false, error: `Backup status is ${backup.status}. Only SUCCESS backups can be restored.` }));
      return true;
    }

    const backupData = backup.backup_data as Record<string, any[]>;

    // 2. Create a PRE_RESTORE safety backup of the CURRENT state
    const { data: preRestorePlaceholder, error: preInsertErr } = await db
      .from('business_backups')
      .insert({
        created_by: auth.adminId,
        backup_type: 'PRE_RESTORE',
        status: 'CREATING',
        schema_version: '1.0',
        record_counts: {},
        backup_data: {},
      })
      .select()
      .single();

    if (preInsertErr || !preRestorePlaceholder) {
      res.statusCode = 500;
      res.end(JSON.stringify({ success: false, error: 'Failed to create PRE_RESTORE safety backup: ' + (preInsertErr?.message || 'Unknown') }));
      return true;
    }

    const preRestoreId = preRestorePlaceholder.id;
    const { data: currentData, counts: currentCounts } = await gatherBusinessData(db);

    const { error: preUpdateErr } = await db
      .from('business_backups')
      .update({
        status: 'SUCCESS',
        record_counts: currentCounts,
        backup_data: currentData,
      })
      .eq('id', preRestoreId);

    if (preUpdateErr) {
      await db.from('business_backups').update({ status: 'FAILED' }).eq('id', preRestoreId);
      // STOP — do not modify current business records
      res.statusCode = 500;
      res.end(JSON.stringify({ success: false, error: 'PRE_RESTORE safety backup failed. Restore aborted to protect current data.' }));
      return true;
    }

    // Verify the pre-restore backup
    const { data: preVerify } = await db
      .from('business_backups')
      .select('id, status')
      .eq('id', preRestoreId)
      .maybeSingle();

    if (!preVerify || preVerify.status !== 'SUCCESS') {
      await db.from('business_backups').update({ status: 'FAILED' }).eq('id', preRestoreId);
      res.statusCode = 500;
      res.end(JSON.stringify({ success: false, error: 'PRE_RESTORE safety backup verification failed. Restore aborted.' }));
      return true;
    }

    // 3. Restore: delete existing business records, then insert from backup
    //    Delete in child→parent order to respect FK constraints
    const deleteOrder = [
      'receipt_prints',
      'sale_items',
      'sales',
      'stock_movements',
      'expenses',
      'shifts',
      // products and categories are upserted (not deleted) to avoid breaking
      // references from profiles/business_settings that are NOT part of the backup
    ];

    const errors: string[] = [];

    // 3a. Delete existing transactional records
    for (const table of deleteOrder) {
      const { error: delErr } = await db.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (delErr) {
        console.warn(`[Restore] Delete ${table} notice:`, delErr.message);
        errors.push(`Failed to clear ${table}: ${delErr.message}`);
      }
    }

    // 3b. Upsert categories (parent table — insert or update by id)
    if (backupData.categories && backupData.categories.length > 0) {
      const { error: upsertErr } = await db.from('categories').upsert(backupData.categories, { onConflict: 'id' });
      if (upsertErr) {
        console.warn('[Restore] Categories upsert notice:', upsertErr.message);
        errors.push(`Failed to restore categories: ${upsertErr.message}`);
      }
    }

    // 3c. Upsert products (child of categories — insert or update by id)
    if (backupData.products && backupData.products.length > 0) {
      const { error: upsertErr } = await db.from('products').upsert(backupData.products, { onConflict: 'id' });
      if (upsertErr) {
        console.warn('[Restore] Products upsert notice:', upsertErr.message);
        errors.push(`Failed to restore products: ${upsertErr.message}`);
      }
    }

    // 3d. Insert shifts (parent of sales)
    if (backupData.shifts && backupData.shifts.length > 0) {
      const { error: insertErr } = await db.from('shifts').insert(backupData.shifts);
      if (insertErr) {
        console.warn('[Restore] Shifts insert notice:', insertErr.message);
        errors.push(`Failed to restore shifts: ${insertErr.message}`);
      }
    }

    // 3e. Insert sales (child of shifts)
    if (backupData.sales && backupData.sales.length > 0) {
      const { error: insertErr } = await db.from('sales').insert(backupData.sales);
      if (insertErr) {
        console.warn('[Restore] Sales insert notice:', insertErr.message);
        errors.push(`Failed to restore sales: ${insertErr.message}`);
      }
    }

    // 3f. Insert sale_items (child of sales)
    if (backupData.sale_items && backupData.sale_items.length > 0) {
      const { error: insertErr } = await db.from('sale_items').insert(backupData.sale_items);
      if (insertErr) {
        console.warn('[Restore] Sale items insert notice:', insertErr.message);
        errors.push(`Failed to restore sale_items: ${insertErr.message}`);
      }
    }

    // 3g. Insert receipt_prints (child of sales)
    if (backupData.receipt_prints && backupData.receipt_prints.length > 0) {
      const { error: insertErr } = await db.from('receipt_prints').insert(backupData.receipt_prints);
      if (insertErr) {
        console.warn('[Restore] Receipt prints insert notice:', insertErr.message);
        errors.push(`Failed to restore receipt_prints: ${insertErr.message}`);
      }
    }

    // 3h. Insert stock_movements (child of products)
    if (backupData.stock_movements && backupData.stock_movements.length > 0) {
      const { error: insertErr } = await db.from('stock_movements').insert(backupData.stock_movements);
      if (insertErr) {
        console.warn('[Restore] Stock movements insert notice:', insertErr.message);
        errors.push(`Failed to restore stock_movements: ${insertErr.message}`);
      }
    }

    // 3i. Insert expenses
    if (backupData.expenses && backupData.expenses.length > 0) {
      const { error: insertErr } = await db.from('expenses').insert(backupData.expenses);
      if (insertErr) {
        console.warn('[Restore] Expenses insert notice:', insertErr.message);
        errors.push(`Failed to restore expenses: ${insertErr.message}`);
      }
    }

    // 4. Audit log
    try {
      await db.from('activity_logs').insert({
        actor_id: auth.adminId,
        action: 'business_data_restored',
        entity_type: 'business_backups',
        entity_id: backupId,
        description: `${auth.adminName} restored backup from ${new Date(backup.created_at).toLocaleString()}. PRE_RESTORE safety backup: ${preRestoreId}.`,
        metadata: {
          backup_id: backupId,
          pre_restore_backup_id: preRestoreId,
          record_counts: backup.record_counts,
        },
      });
    } catch {}

    if (errors.length > 0) {
      res.statusCode = 207;
      res.end(JSON.stringify({
        success: true,
        partial: true,
        pre_restore_backup_id: preRestoreId,
        warnings: errors,
        message: 'Restore completed with some warnings. A PRE_RESTORE backup was created for safety.',
      }));
      return true;
    }

    res.statusCode = 200;
    res.end(JSON.stringify({
      success: true,
      pre_restore_backup_id: preRestoreId,
      record_counts: backup.record_counts,
      message: 'Business data restored successfully. A PRE_RESTORE backup of the previous state was created.',
    }));
    return true;
  } catch (err: any) {
    console.error('[Restore] Unhandled error:', err);
    res.statusCode = 500;
    res.end(JSON.stringify({ success: false, error: err?.message || 'Internal server error during restore.' }));
    return true;
  }
}
