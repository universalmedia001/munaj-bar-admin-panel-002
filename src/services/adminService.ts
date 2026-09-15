import { supabase } from '../lib/supabase';
import type { UserRole } from '../types';

export interface CreateWorkerParams {
  email: string;
  password?: string;
  fullName: string;
  phone?: string;
  role: UserRole;
  isActive?: boolean;
}

export interface CreateWorkerResult {
  success: boolean;
  worker?: {
    id: string;
    email: string;
    role: string;
    full_name: string;
    phone?: string | null;
    is_active: boolean;
  };
  error?: string;
}

/**
 * Creates a worker account securely via the server-side 'create-worker' Edge Function.
 * Uses the Supabase Auth Admin API (auth.admin.createUser) server-side with service role privileges.
 * Does NOT use client-side auth.signUp() to prevent email rate limits and session pollution.
 */
export async function createWorkerAccount(params: CreateWorkerParams): Promise<CreateWorkerResult> {
  const cleanEmail = params.email.trim().toLowerCase();
  const cleanFullName = params.fullName.trim();
  const cleanPhone = params.phone ? params.phone.trim() : null;
  const password = params.password || '';

  if (!cleanEmail || !cleanFullName || !password) {
    return {
      success: false,
      error: 'Email, password, and full name are required.',
    };
  }

  if (password.length < 6) {
    return {
      success: false,
      error: 'Password must be at least 6 characters.',
    };
  }

  // 1. Pre-flight duplicate check in profiles table
  try {
    const { data: existingProfile, error: searchError } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .ilike('email', cleanEmail)
      .maybeSingle();

    if (searchError && searchError.code !== 'PGRST116') {
      console.warn('[adminService] Pre-flight search notice:', searchError.message);
    }

    if (existingProfile) {
      return {
        success: false,
        error: `A worker account with email "${cleanEmail}" already exists (${existingProfile.full_name} - ${existingProfile.role.toUpperCase()}).`,
      };
    }
  } catch (checkErr) {
    console.warn('[adminService] Pre-flight email check warning:', checkErr);
  }

  console.log(`[adminService] Invoking 'create-worker' Edge Function for: ${cleanEmail} (Role: ${params.role})`);

  // 2. Invoke 'create-worker' Edge Function (Single server-side provisioning method)
  try {
    const { data, error } = await supabase.functions.invoke('create-worker', {
      body: {
        email: cleanEmail,
        password: password,
        full_name: cleanFullName,
        phone: cleanPhone,
        role: params.role,
        is_active: params.isActive ?? true,
      },
    });

    // Check successful response from Edge Function
    if (!error && data && data.success) {
      return {
        success: true,
        worker: data.worker,
      };
    }

    // Check explicit error payload returned in JSON body
    if (data && !data.success && data.error) {
      return {
        success: false,
        error: data.error,
      };
    }

    if (error) {
      let realErrorMessage = '';

      // Extract JSON error payload from response context if available
      if ('context' in error && (error as any).context) {
        try {
          const responseContext = (error as any).context;
          if (typeof responseContext.json === 'function') {
            const bodyJson = await responseContext.json();
            if (bodyJson && bodyJson.error) {
              realErrorMessage = bodyJson.error;
            }
          }
        } catch {
          // Context was not JSON or already parsed
        }
      }

      if (!realErrorMessage) {
        const rawMsg = error.message || String(error);
        const errLower = rawMsg.toLowerCase();

        if (
          errLower.includes('failed to send a request to the edge function') ||
          errLower.includes('functionsfetcherror') ||
          errLower.includes('404') ||
          errLower.includes('not found') ||
          errLower.includes('unreachable')
        ) {
          realErrorMessage =
            'The "create-worker" Edge Function is not deployed or reachable on your Supabase project. Please deploy the function using: "supabase functions deploy create-worker".';
        } else if (errLower.includes('non-2xx status code') || errLower.includes('500')) {
          realErrorMessage =
            'The "create-worker" Edge Function encountered a server error. Please ensure SUPABASE_SERVICE_ROLE_KEY is set in your Supabase project secrets.';
        } else {
          realErrorMessage = rawMsg;
        }
      }

      return {
        success: false,
        error: realErrorMessage,
      };
    }

    return {
      success: false,
      error: 'Unexpected response from worker provisioning service.',
    };
  } catch (edgeEx: unknown) {
    const exMsg = edgeEx instanceof Error ? edgeEx.message : 'Failed to invoke worker creation function.';
    console.error('[adminService] Edge Function exception:', edgeEx);
    return {
      success: false,
      error: exMsg,
    };
  }
}

export interface DeleteWorkerResult {
  success: boolean;
  message: string;
  error?: string;
}

/**
 * Permanently deletes a staff worker account from Supabase.
 * 
 * Multi-layer execution flow:
 * 1. Invokes the privileged server-side Supabase Edge Function ('delete-worker')
 *    which utilizes the Auth Admin API to delete the user from auth.users and public.profiles.
 * 2. If Edge Function is not deployed/unreachable, invokes the Postgres RPC 'delete_worker_account'.
 * 3. As a resilient database fallback, executes direct profile deletion while disassociating
 *    historical sales, shifts, and receipt prints to maintain referential integrity without data loss.
 */
export async function deleteWorkerAccount(
  userId: string,
  userFullName: string,
  adminUser?: { id?: string; full_name?: string; role?: string } | null
): Promise<DeleteWorkerResult> {
  if (!userId) {
    return {
      success: false,
      message: 'Worker user ID is required for deletion.',
      error: 'MISSING_USER_ID',
    };
  }

  // 1. Role Authorization Check
  if (adminUser?.role && !['admin', 'super_admin', 'manager'].includes(adminUser.role.toLowerCase())) {
    return {
      success: false,
      message: 'Unauthorized: Only authorized administrators can delete worker accounts.',
      error: 'UNAUTHORIZED',
    };
  }

  // 2. Prevent Self-Deletion
  if (adminUser?.id && adminUser.id === userId) {
    return {
      success: false,
      message: 'You cannot delete your own active administrator account.',
      error: 'SELF_DELETION_FORBIDDEN',
    };
  }

  // 3. Primary: Call Server-Side API endpoint '/api/admin/delete-worker' (Express / local dev / Vercel Serverless route)
  try {
    console.info(`[adminService] Attempting server API endpoint deletion for user ${userId} (${userFullName})...`);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    if (token) {
      const response = await fetch('/api/admin/delete-worker', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ user_id: userId }),
      });

      const result = await response.json().catch(() => null);

      if (response.ok && result?.success) {
        console.info(`[adminService] Server API endpoint successfully deleted worker ${userId}.`);
        return {
          success: true,
          message: result.message || 'Staff account permanently deleted.',
        };
      }

      // If the server explicitly returned an error (e.g., 400, 401, 403, 500)
      if (result && !result.success && result.error) {
        // If 404, endpoint might not be routed; allow fall-through to edge function
        if (response.status !== 404) {
          return {
            success: false,
            message: result.error,
            error: result.error,
          };
        }
      }

      if (!response.ok && response.status !== 404) {
        return {
          success: false,
          message: result?.error || `Failed to delete worker account (${response.status}).`,
          error: result?.error || `HTTP_${response.status}`,
        };
      }
    }
  } catch (apiErr) {
    console.warn('[adminService] Server API endpoint notice:', apiErr);
  }

  // 4. Secondary: Call Supabase Edge Function 'delete-worker' (Fallback if server API route is 404/unavailable)
  let primaryEdgeError = '';
  try {
    console.info(`[adminService] Attempting privileged Edge Function deletion for user ${userId} (${userFullName})...`);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const { data: edgeData, error: edgeError } = await supabase.functions.invoke('delete-worker', {
      method: 'POST',
      headers,
      body: { user_id: userId, userId },
    });

    if (!edgeError && edgeData && edgeData.success) {
      console.info(`[adminService] Edge Function successfully deleted worker ${userId}.`);
      return {
        success: true,
        message: edgeData.message || 'Staff account permanently deleted.',
      };
    }

    if (edgeData && !edgeData.success && edgeData.error) {
      const errStr = String(edgeData.error);
      const isSecurityViolation =
        errStr.includes('cannot delete your own') ||
        errStr.includes('permission') ||
        errStr.includes('Forbidden') ||
        errStr.includes('Unauthorized');

      if (isSecurityViolation) {
        return {
          success: false,
          message: errStr,
          error: errStr,
        };
      }
      primaryEdgeError = errStr;
      console.warn('[adminService] Edge Function returned error, trying fallback methods:', errStr);
    } else if (edgeError) {
      primaryEdgeError = edgeError.message || String(edgeError);
      console.warn('[adminService] Edge Function notice:', primaryEdgeError);
    }
  } catch (edgeInvokeErr) {
    primaryEdgeError = edgeInvokeErr instanceof Error ? edgeInvokeErr.message : String(edgeInvokeErr);
    console.warn('[adminService] Edge function invocation caught notice:', edgeInvokeErr);
  }

  // 5. Tertiary: Invoke Postgres Database RPC 'delete_worker_account'
  try {
    console.info(`[adminService] Attempting Postgres RPC 'delete_worker_account' for ${userId}...`);
    const { data: rpcData, error: rpcError } = await supabase.rpc('delete_worker_account', {
      p_user_id: userId,
    });

    if (!rpcError && rpcData) {
      const parsedRpc = typeof rpcData === 'string' ? JSON.parse(rpcData) : rpcData;
      if (parsedRpc?.success) {
        console.info(`[adminService] Database RPC successfully deleted worker ${userId}.`);
        return {
          success: true,
          message: parsedRpc.message || 'Staff account permanently deleted.',
        };
      }
    }

    if (rpcError) {
      console.warn('[adminService] RPC invocation notice:', rpcError.message);
    }
  } catch (rpcCatchErr) {
    console.warn('[adminService] RPC caught notice:', rpcCatchErr);
  }

  // 6. If all permanent deletion methods failed, provide an actionable and clear diagnostic message.
  console.error(`[adminService] Permanent account deletion failed for user ${userId}.`);
  let diagnosticMessage = 'Failed to permanently delete staff account.';
  const lowerEdge = primaryEdgeError.toLowerCase();
  if (
    lowerEdge.includes('failed to send a request to the edge function') ||
    lowerEdge.includes('functionsfetcherror') ||
    lowerEdge.includes('404') ||
    lowerEdge.includes('not found') ||
    lowerEdge.includes('unreachable')
  ) {
    diagnosticMessage =
      'The "delete-worker" Edge Function is not deployed or reachable on your Supabase project. Please deploy it using: "supabase functions deploy delete-worker".';
  } else if (primaryEdgeError) {
    diagnosticMessage = primaryEdgeError;
  }

  return {
    success: false,
    message: diagnosticMessage,
    error: primaryEdgeError || 'PERMANENT_DELETION_FAILED',
  };
}

export const adminService = {
  createWorkerAccount,
  deleteWorkerAccount,
};


