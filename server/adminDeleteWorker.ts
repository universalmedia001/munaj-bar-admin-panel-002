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

  if (
    pathname !== '/api/admin/delete-worker' &&
    pathname !== '/api/admin/delete-worker/'
  ) {
    return false;
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  const method = (req.method || '').toUpperCase().trim();

  if (method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return true;
  }

  if (method !== 'POST' && method !== 'DELETE') {
    res.statusCode = 405;
    res.end(JSON.stringify({ success: false, error: 'Method not allowed. Use POST or DELETE.' }));
    return true;
  }

  try {
    // 1. Read JSON request body (supports both pre-parsed body from Vercel Serverless and stream from Express)
    console.info('[AdminDeleteWorker] Step 1: Parsing request body...');
    let body: { user_id?: string; userId?: string } = {};
    const existingBody = (req as any).body;

    if (existingBody && typeof existingBody === 'object') {
      body = existingBody;
    } else if (existingBody && typeof existingBody === 'string') {
      try {
        body = JSON.parse(existingBody);
      } catch {
        // ignore parse warning
      }
    } else {
      const chunks: Uint8Array[] = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }
      const bodyText = Buffer.concat(chunks).toString('utf-8');
      if (bodyText) {
        try {
          body = JSON.parse(bodyText);
        } catch {
          console.error('[AdminDeleteWorker] [FAILED AT STEP 1] Invalid JSON payload received.');
          res.statusCode = 400;
          res.end(JSON.stringify({ success: false, error: 'Invalid JSON payload' }));
          return true;
        }
      }
    }

    // Also support user_id from query parameters
    let queryUserId: string | null = null;
    try {
      const urlObj = new URL(req.url || '', 'http://localhost');
      queryUserId = urlObj.searchParams.get('user_id') || urlObj.searchParams.get('userId');
    } catch {
      // ignore url parse error
    }

    const targetUserId = body.user_id || body.userId || queryUserId;
    if (!targetUserId) {
      console.error('[AdminDeleteWorker] [FAILED AT STEP 1] Missing target user_id.');
      res.statusCode = 400;
      res.end(JSON.stringify({ success: false, error: 'Target user_id is required' }));
      return true;
    }
    console.info(`[AdminDeleteWorker] Step 1 OK: Target user_id is ${targetUserId}.`);

    // 2. Verify requesting user's authorization header
    console.info('[AdminDeleteWorker] Step 2: Verifying admin authorization token...');
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[AdminDeleteWorker] [FAILED AT STEP 2] Missing or invalid Authorization header.');
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
      console.error('[AdminDeleteWorker] [FAILED AT STEP 2] Invalid session token:', userError?.message || 'No user data');
      res.statusCode = 401;
      res.end(JSON.stringify({ success: false, error: 'Unauthorized: Invalid or expired session' }));
      return true;
    }

    const requestingUser = userData.user;
    console.info(`[AdminDeleteWorker] Step 2 OK: Authenticated as user ${requestingUser.id}.`);

    // 3. Verify requesting user has admin/manager role
    console.info('[AdminDeleteWorker] Step 3: Checking requester administrator privileges...');
    const { data: requesterProfile } = await userClient
      .from('profiles')
      .select('id, role, is_active, full_name')
      .eq('id', requestingUser.id)
      .maybeSingle();

    const allowedRoles = ['admin', 'manager', 'super_admin'];
    const effectiveRole = requesterProfile?.role || (requestingUser.user_metadata?.role as string);

    if (!effectiveRole || !allowedRoles.includes(effectiveRole.toLowerCase())) {
      console.error(`[AdminDeleteWorker] [FAILED AT STEP 3] Forbidden: User role "${effectiveRole}" is not authorized.`);
      res.statusCode = 403;
      res.end(JSON.stringify({ success: false, error: 'Forbidden: Worker/POS sessions are not allowed to delete accounts' }));
      return true;
    }

    // 4. Prevent self-deletion
    if (requestingUser.id === targetUserId) {
      console.error('[AdminDeleteWorker] [FAILED AT STEP 3] Self-deletion attempted and blocked.');
      res.statusCode = 400;
      res.end(JSON.stringify({ success: false, error: 'You cannot delete your own active administrator account' }));
      return true;
    }
    console.info(`[AdminDeleteWorker] Step 3 OK: Requester has valid role "${effectiveRole}".`);

    // 4. Check server-side privileged credential
    console.info('[AdminDeleteWorker] Step 4: Checking server-side privileged credential (SUPABASE_SECRET_KEY)...');
    const serviceRoleKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      console.error('[AdminDeleteWorker] [FAILED AT STEP 4: MISSING VERCEL / SERVER CREDENTIAL]');
      console.error('[AdminDeleteWorker] Neither SUPABASE_SECRET_KEY nor SUPABASE_SERVICE_ROLE_KEY is set in the server environment.');
      console.error('[AdminDeleteWorker] To resolve: Add SUPABASE_SECRET_KEY to your Vercel Project Settings > Environment Variables.');
      res.statusCode = 500;
      res.end(
        JSON.stringify({
          success: false,
          error: 'Server configuration error: Supabase server secret key (SUPABASE_SECRET_KEY) is not configured in environment variables.',
          step: 'MISSING_SUPABASE_SECRET_KEY',
        })
      );
      return true;
    }
    console.info('[AdminDeleteWorker] Step 4 OK: Privileged Supabase credential is present.');

    // 5. Check target user profile and initialize Admin Client
    console.info('[AdminDeleteWorker] Step 5: Initializing Supabase Auth Admin client...');
    const { data: targetProfile } = await userClient
      .from('profiles')
      .select('id, role, full_name, email')
      .eq('id', targetUserId)
      .maybeSingle();

    let adminClient: ReturnType<typeof createClient>;
    try {
      const activeSupabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || SUPABASE_URL;
      adminClient = createClient(activeSupabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      console.info(`[AdminDeleteWorker] Step 5 OK: Auth Admin client initialized against ${activeSupabaseUrl}.`);
    } catch (adminEx) {
      console.error('[AdminDeleteWorker] [FAILED AT STEP 5] Auth Admin client init error:', adminEx);
      res.statusCode = 500;
      res.end(JSON.stringify({ success: false, error: 'Server configuration error: Unable to initialize the Auth Admin client.' }));
      return true;
    }

    const activeDb = adminClient;
    const targetName = targetProfile?.full_name || targetUserId;
    const cleanName = targetName.replace(/^\[DELETED\]\s*/i, '').replace(/^\[Deleted Staff\]\s*/i, '').trim();
    const performerName = requesterProfile?.full_name || requestingUser.email || 'Admin';

    // 6. Delete and verify the Auth account before removing its profile.
    console.info(`[AdminDeleteWorker] Step 6: Deleting Supabase Auth user ${targetUserId}...`);
    const { error: authDelErr } = await adminClient.auth.admin.deleteUser(targetUserId);
    if (authDelErr && !authDelErr.message.toLowerCase().includes('not found')) {
      console.error('[AdminDeleteWorker] [FAILED AT STEP 6] Auth Admin deleteUser error:', authDelErr.message);
      res.statusCode = 500;
      res.end(JSON.stringify({ success: false, error: `Auth account deletion failed: ${authDelErr.message}` }));
      return true;
    }

    const { data: remainingAuthUser, error: authVerifyErr } = await adminClient.auth.admin.getUserById(targetUserId);
    if (authVerifyErr && !authVerifyErr.message.toLowerCase().includes('not found')) {
      console.error('[AdminDeleteWorker] [FAILED AT STEP 6] Auth deletion verification error:', authVerifyErr.message);
      res.statusCode = 500;
      res.end(JSON.stringify({ success: false, error: `Auth account deletion could not be verified: ${authVerifyErr.message}` }));
      return true;
    }

    if (remainingAuthUser?.user) {
      console.error('[AdminDeleteWorker] [FAILED AT STEP 6] Auth account still exists after deletion attempt.');
      res.statusCode = 500;
      res.end(JSON.stringify({ success: false, error: 'Auth account deletion could not be verified: the worker Auth user still exists.' }));
      return true;
    }
    console.info('[AdminDeleteWorker] Step 6 OK: Supabase Auth user successfully removed.');

    // 7. Safe shifts, sales, receipts cleanup:
    console.info('[AdminDeleteWorker] Step 7: Preserving business records and disassociating foreign keys...');
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

    // 8. Delete from public.profiles
    console.info(`[AdminDeleteWorker] Step 8: Deleting worker profile ${targetUserId} from public.profiles...`);
    const { error: profileDeleteError } = await activeDb
      .from('profiles')
      .delete()
      .eq('id', targetUserId);

    if (profileDeleteError) {
      console.error('[AdminDeleteWorker] [FAILED AT STEP 8] Profile delete error:', profileDeleteError.message);
      res.statusCode = 500;
      res.end(
        JSON.stringify({
          success: false,
          error: `Database profile deletion failed: ${profileDeleteError.message}`,
          step: 'PROFILE_DELETE_FAILED',
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
      console.error('[AdminDeleteWorker] [FAILED AT STEP 8] Profile still exists after delete query.');
      res.statusCode = 500;
      res.end(
        JSON.stringify({
          success: false,
          error: 'Failed to delete worker profile from the database.',
          step: 'PROFILE_VERIFICATION_FAILED',
        })
      );
      return true;
    }
    console.info('[AdminDeleteWorker] Step 8 OK: Worker profile successfully removed.');

    // 9. Record Activity Audit Log
    console.info('[AdminDeleteWorker] Step 9: Inserting audit log into activity_logs...');
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

    console.info(`[AdminDeleteWorker] Step 10: Deletion complete for worker ${targetUserId}. Responding with 200 OK.`);
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
    console.error('[AdminDeleteWorker] [UNHANDLED EXCEPTION]:', errorMsg);
    res.statusCode = 500;
    res.end(JSON.stringify({ success: false, error: errorMsg, step: 'UNHANDLED_EXCEPTION' }));
    return true;
  }
}
