import "dotenv/config";
import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://audhnjptgfwpqophgfvy.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_KRHyF978z1EYJYqrycxeJA_37p71DHR';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Handles server-side worker account deletion requests.
 * 1. Verifies requesting admin's JWT session.
 * 2. Verifies requesting admin has admin/manager privileges.
 * 3. Prevents self-deletion.
 * 4. Permanently deletes the user from auth.users via Supabase Auth Admin API.
 * 5. Disassociates foreign keys (sales, receipts, shifts) to preserve historical financial records.
 * 6. Permanently deletes the user profile from public.profiles.
 * 7. Records an immutable audit log entry in activity_logs.
 * 8. Never performs soft-deletion or returns false success.
 */
export async function handleAdminDeleteWorker(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = req.url || '';
  const pathname = url.split('?')[0];

  if (pathname !== '/api/admin/delete-worker' && pathname !== '/api/admin/delete-worker/') {
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
    let body: { user_id?: string } = {};
    if (bodyText) {
      try {
        body = JSON.parse(bodyText);
      } catch {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON payload' }));
        return true;
      }
    }

    const targetUserId = body.user_id;
    if (!targetUserId) {
      res.statusCode = 400;
      res.end(JSON.stringify({ success: false, error: 'Target user_id is required' }));
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
      res.end(JSON.stringify({ success: false, error: 'Forbidden: Worker/POS sessions are not allowed to delete accounts' }));
      return true;
    }

    // 4. Prevent self-deletion
    if (requestingUser.id === targetUserId) {
      res.statusCode = 400;
      res.end(JSON.stringify({ success: false, error: 'You cannot delete your own active administrator account' }));
      return true;
    }

    if (!SUPABASE_SERVICE_ROLE_KEY) {
      res.statusCode = 500;
      res.end(
        JSON.stringify({
          success: false,
          error: 'Server configuration error: Supabase server secret key is not configured on the server.',
        })
      );
      return true;
    }

    // 5. Check target user profile
    const { data: targetProfile } = await userClient
      .from('profiles')
      .select('id, role, full_name, email')
      .eq('id', targetUserId)
      .maybeSingle();

    let adminClient: ReturnType<typeof createClient>;
    try {
      adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    } catch (adminEx) {
      console.error('[AdminDeleteWorker] Auth Admin client init error:', adminEx);
      res.statusCode = 500;
      res.end(JSON.stringify({ success: false, error: 'Server configuration error: Unable to initialize the Auth Admin client.' }));
      return true;
    }

    const activeDb = adminClient;
    const targetName = targetProfile?.full_name || targetUserId;
    const cleanName = targetName.replace(/^\[DELETED\]\s*/i, '').replace(/^\[Deleted Staff\]\s*/i, '').trim();
    const performerName = requesterProfile?.full_name || requestingUser.email || 'Admin';

    // Delete and verify the Auth account before removing its profile.
    const { error: authDelErr } = await adminClient.auth.admin.deleteUser(targetUserId);
    if (authDelErr && !authDelErr.message.toLowerCase().includes('not found')) {
      console.error('[AdminDeleteWorker] Auth Admin deleteUser error:', authDelErr.message);
      res.statusCode = 500;
      res.end(JSON.stringify({ success: false, error: `Auth account deletion failed: ${authDelErr.message}` }));
      return true;
    }

    const { data: remainingAuthUser, error: authVerifyErr } = await adminClient.auth.admin.getUserById(targetUserId);
    if (authVerifyErr && !authVerifyErr.message.toLowerCase().includes('not found')) {
      console.error('[AdminDeleteWorker] Auth deletion verification error:', authVerifyErr.message);
      res.statusCode = 500;
      res.end(JSON.stringify({ success: false, error: `Auth account deletion could not be verified: ${authVerifyErr.message}` }));
      return true;
    }

    if (remainingAuthUser?.user) {
      res.statusCode = 500;
      res.end(JSON.stringify({ success: false, error: 'Auth account deletion could not be verified: the worker Auth user still exists.' }));
      return true;
    }

    // 6. Safe shifts, sales, receipts cleanup:
    // Disassociate foreign keys so historical business records remain 100% intact in the database
    // while permitting hard deletion of the profile row without FK constraint violations (code 23503)
    try {
      // Close active shifts
      await activeDb
        .from('shifts')
        .update({ status: 'closed', ended_at: new Date().toISOString() })
        .eq('worker_id', targetUserId)
        .eq('status', 'active');
    } catch (e) {
      console.warn('[AdminDeleteWorker] Shift close notice:', e);
    }

    try {
      // Disassociate worker_id in sales to preserve historical revenue, items, and receipts
      await activeDb
        .from('sales')
        .update({ worker_id: null })
        .eq('worker_id', targetUserId);
    } catch (e) {
      console.warn('[AdminDeleteWorker] Sales foreign key disassociation notice:', e);
    }

    try {
      // Disassociate worker_id in receipt_prints
      await activeDb
        .from('receipt_prints')
        .update({ worker_id: null })
        .eq('worker_id', targetUserId);
    } catch (e) {
      console.warn('[AdminDeleteWorker] Receipt print disassociation notice:', e);
    }

    try {
      // Disassociate worker_id in shifts
      await activeDb
        .from('shifts')
        .update({ worker_id: null })
        .eq('worker_id', targetUserId);
    } catch (e) {
      console.warn('[AdminDeleteWorker] Shift disassociation notice:', e);
    }

    try {
      // Disassociate actor_id in activity_logs
      await activeDb
        .from('activity_logs')
        .update({ actor_id: null })
        .eq('actor_id', targetUserId);
    } catch (e) {
      console.warn('[AdminDeleteWorker] Activity log actor disassociation notice:', e);
    }

    try {
      // Disassociate updated_by in business_settings
      await activeDb
        .from('business_settings')
        .update({ updated_by: null })
        .eq('updated_by', targetUserId);
    } catch (e) {
      console.warn('[AdminDeleteWorker] Business settings disassociation notice:', e);
    }

    try {
      // Remove private user notifications
      await activeDb.from('notifications').delete().eq('recipient_id', targetUserId);
    } catch (e) {
      console.warn('[AdminDeleteWorker] Notification delete notice:', e);
    }

    // 7. Delete from public.profiles
    const { error: profileDeleteError } = await activeDb
      .from('profiles')
      .delete()
      .eq('id', targetUserId);

    if (profileDeleteError) {
      console.error('[AdminDeleteWorker] Profile delete error:', profileDeleteError.message);
      res.statusCode = 500;
      res.end(
        JSON.stringify({
          success: false,
          error: `Database profile deletion failed: ${profileDeleteError.message}`,
        })
      );
      return true;
    }

    // Verify profile is no longer in public.profiles
    const { data: checkProf } = await activeDb
      .from('profiles')
      .select('id')
      .eq('id', targetUserId)
      .maybeSingle();

    if (checkProf) {
      res.statusCode = 500;
      res.end(
        JSON.stringify({
          success: false,
          error: 'Failed to delete worker profile from the database.',
        })
      );
      return true;
    }

    // 9. Record Activity Audit Log
    try {
      await activeDb.from('activity_logs').insert({
        action: 'user_deleted',
        entity_type: 'profiles',
        entity_id: targetUserId,
        description: `Permanently deleted worker account "${cleanName}" by ${performerName}`,
        actor_id: requestingUser.id,
        metadata: {
          target_user_id: targetUserId,
          target_user_name: cleanName,
          deleted_by: performerName,
          auth_user_deleted: true,
          profile_deleted: true,
          historical_records_preserved: true,
          timestamp: new Date().toISOString(),
        },
      });
    } catch {
      // non-blocking
    }

    res.statusCode = 200;
    res.end(
      JSON.stringify({
        success: true,
        message: 'Staff account permanently deleted.',
        deleted_user_id: targetUserId,
      })
    );
    return true;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal Server Error';
    console.error('[AdminDeleteWorker] Exception:', errorMsg);
    res.statusCode = 500;
    res.end(JSON.stringify({ success: false, error: errorMsg }));
    return true;
  }
}
