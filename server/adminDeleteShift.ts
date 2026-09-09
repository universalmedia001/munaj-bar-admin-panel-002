import "dotenv/config";
import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://audhnjptgfwpqophgfvy.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_KRHyF978z1EYJYqrycxeJA_37p71DHR';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Handles server-side individual shift deletion requests.
 * 1. Verifies requesting admin's JWT session.
 * 2. Verifies requesting admin has admin/manager privileges.
 * 3. Validates the target shift exists and is not currently active.
 * 4. Safely handles dependent financial sales (disassociates shift_id to preserve sales records).
 * 5. Performs actual physical DELETE on public.shifts.
 * 6. Verifies the row no longer exists in Supabase.
 * 7. Records an audit log entry in activity_logs.
 */
export async function handleAdminDeleteShift(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = req.url || '';
  const pathname = url.split('?')[0];

  if (pathname !== '/api/admin/delete-shift' && pathname !== '/api/admin/delete-shift/') {
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
    // 1. Read JSON request body
    const chunks: Uint8Array[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const bodyText = Buffer.concat(chunks).toString('utf-8');
    let body: { shift_id?: string } = {};
    if (bodyText) {
      try {
        body = JSON.parse(bodyText);
      } catch {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON payload' }));
        return true;
      }
    }

    const targetShiftId = body.shift_id;
    if (!targetShiftId) {
      res.statusCode = 400;
      res.end(JSON.stringify({ success: false, error: 'Target shift_id is required' }));
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

    // 3. Verify requesting user has admin/manager role
    const { data: requesterProfile } = await userClient
      .from('profiles')
      .select('id, role, is_active, full_name')
      .eq('id', requestingUser.id)
      .maybeSingle();

    const allowedRoles = ['admin', 'manager', 'super_admin'];
    const effectiveRole = requesterProfile?.role || (requestingUser.user_metadata?.role as string);

    if (!effectiveRole || !allowedRoles.includes(effectiveRole.toLowerCase())) {
      res.statusCode = 403;
      res.end(JSON.stringify({ success: false, error: 'Forbidden: Only administrators can delete shift records' }));
      return true;
    }

    // Select database client (prefer service role client for elevated DDL/disassociation if available, else userClient)
    let activeDb = userClient;
    if (SUPABASE_SERVICE_ROLE_KEY) {
      try {
        activeDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
      } catch (err) {
        console.warn('[AdminDeleteShift] Service role client init warning:', err);
      }
    }

    // 4. Retrieve target shift
    const { data: targetShift, error: shiftFetchErr } = await activeDb
      .from('shifts')
      .select('*, worker:profiles(full_name)')
      .eq('id', targetShiftId)
      .maybeSingle();

    if (shiftFetchErr) {
      res.statusCode = 500;
      res.end(JSON.stringify({ success: false, error: `Failed to query shift: ${shiftFetchErr.message}` }));
      return true;
    }

    if (!targetShift) {
      // Shift does not exist or was already deleted
      res.statusCode = 200;
      res.end(JSON.stringify({ success: true, message: 'Shift record does not exist or has already been deleted.' }));
      return true;
    }

    // 5. Check if shift is active
    if (targetShift.status === 'active' || !targetShift.ended_at) {
      res.statusCode = 400;
      res.end(JSON.stringify({
        success: false,
        error: 'This shift is currently active and cannot be deleted. End or close the shift first.',
      }));
      return true;
    }

    // 6. Handle dependent sales safely:
    // Disassociate shift_id so historical transactions and revenue remain 100% intact
    const { count: salesCount } = await activeDb
      .from('sales')
      .select('id', { count: 'exact', head: true })
      .eq('shift_id', targetShiftId);

    if (salesCount && salesCount > 0) {
      const { error: disassociateErr } = await activeDb
        .from('sales')
        .update({ shift_id: null })
        .eq('shift_id', targetShiftId);

      if (disassociateErr) {
        console.warn('[AdminDeleteShift] Sales disassociation note:', disassociateErr.message);
        // If foreign key constraint is strict NOT NULL, check if deletion can proceed or explain restriction
        res.statusCode = 400;
        res.end(JSON.stringify({
          success: false,
          error: `Cannot delete shift: It has ${salesCount} associated sales that cannot be safely disassociated without schema adjustment.`,
        }));
        return true;
      }
    }

    // 7. Perform physical DELETE on public.shifts
    const { error: deleteError } = await activeDb
      .from('shifts')
      .delete()
      .eq('id', targetShiftId);

    if (deleteError) {
      console.error('[AdminDeleteShift] Delete error:', deleteError.message);
      res.statusCode = 500;
      res.end(JSON.stringify({ success: false, error: `Database shift deletion failed: ${deleteError.message}` }));
      return true;
    }

    // 8. Verify the shift is actually gone from the database
    const { data: verifyRow } = await activeDb
      .from('shifts')
      .select('id')
      .eq('id', targetShiftId)
      .maybeSingle();

    if (verifyRow) {
      console.error('[AdminDeleteShift] Verification failed: shift row still exists in database:', targetShiftId);
      res.statusCode = 500;
      res.end(JSON.stringify({
        success: false,
        error: 'Database deletion verification failed: The shift record still exists in Supabase. Check RLS delete policies.',
      }));
      return true;
    }

    // 9. Record Activity Audit Log
    const performerName = requesterProfile?.full_name || requestingUser.email || 'Admin';
    const workerName = (targetShift.worker as any)?.full_name || 'Staff';
    try {
      await activeDb.from('activity_logs').insert({
        action: 'shift_deleted',
        entity_type: 'shifts',
        entity_id: targetShiftId,
        description: `Permanently deleted shift for "${workerName}" (${targetShift.started_at}) by ${performerName}`,
        actor_id: requestingUser.id,
        metadata: {
          shift_id: targetShiftId,
          worker_name: workerName,
          started_at: targetShift.started_at,
          ended_at: targetShift.ended_at,
          deleted_by: performerName,
          database_deleted: true,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (e) {
      console.warn('[AdminDeleteShift] Activity log notice:', e);
    }

    res.statusCode = 200;
    res.end(JSON.stringify({
      success: true,
      message: `Shift for "${workerName}" has been permanently deleted from the database.`,
      shift_id: targetShiftId,
    }));
    return true;
  } catch (err: unknown) {
    console.error('[AdminDeleteShift] Unexpected error:', err);
    const msg = err instanceof Error ? err.message : 'Internal server error';
    res.statusCode = 500;
    res.end(JSON.stringify({ success: false, error: msg }));
    return true;
  }
}
