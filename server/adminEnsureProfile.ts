import "dotenv/config";
import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://audhnjptgfwpqophgfvy.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_KRHyF978z1EYJYqrycxeJA_37p71DHR';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Handles server-side profile verification and provisioning for authenticated users.
 * When an admin registers and verifies their email via Supabase confirmation,
 * this endpoint ensures their record in public.profiles exists with role='admin'
 * and active status, preventing false "account deleted" errors.
 */
export async function handleAdminEnsureProfile(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = req.url || '';
  const pathname = url.split('?')[0];

  if (pathname !== '/api/admin/ensure-profile' && pathname !== '/api/admin/ensure-profile/') {
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

    const user = userData.user;

    // Check if profile already exists in public.profiles
    const { data: existingProfile } = await userClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (existingProfile) {
      res.statusCode = 200;
      res.end(JSON.stringify({ success: true, profile: existingProfile }));
      return true;
    }

    // Profile row doesn't exist yet. Construct payload using auth user data.
    const role = (user.user_metadata?.role as string) || 'admin';
    const fullName = user.user_metadata?.full_name || (user.email ? user.email.split('@')[0] : 'Admin');

    const profilePayload = {
      id: user.id,
      full_name: fullName,
      email: user.email || '',
      role: role,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    if (SUPABASE_SERVICE_ROLE_KEY) {
      const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: created, error: createError } = await adminClient
        .from('profiles')
        .upsert(profilePayload)
        .select('*')
        .maybeSingle();

      if (createError) {
        console.warn('[handleAdminEnsureProfile] Service role upsert notice:', createError.message);
      } else if (created) {
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, profile: created }));
        return true;
      }
    } else {
      const { data: created, error: createError } = await userClient
        .from('profiles')
        .upsert(profilePayload)
        .select('*')
        .maybeSingle();

      if (!createError && created) {
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, profile: created }));
        return true;
      }
    }

    // Return synthesized active profile so admin is never locked out
    res.statusCode = 200;
    res.end(JSON.stringify({ success: true, profile: profilePayload, synthetic: true }));
    return true;
  } catch (err: any) {
    res.statusCode = 500;
    res.end(JSON.stringify({ success: false, error: err?.message || 'Server error' }));
    return true;
  }
}
