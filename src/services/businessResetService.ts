import { supabase } from '../lib/supabase';

export interface ResetBusinessDataOptions {
  confirmPhrase: string;
  resetSales?: boolean;
  resetShifts?: boolean;
  resetProductStocks?: boolean;
  resetExpenses?: boolean;
}

export interface ResetResult {
  success: boolean;
  message: string;
  error?: string;
  details?: any;
}

/**
 * Executes an administrative reset of business data to ₦0 and 0 order counts for a fresh business period.
 * Strictly preserves workers, accounts, authentication, categories, and business settings.
 * Does NOT create or delete catalog products (only optionally resets stock counts to 0 if selected).
 */
export async function executeBusinessDataReset(options: ResetBusinessDataOptions): Promise<ResetResult> {
  const phrase = options.confirmPhrase?.trim().toUpperCase();
  if (phrase !== 'RESET' && phrase !== 'CONFIRM RESET') {
    return {
      success: false,
      message: 'Confirmation phrase must be "RESET".',
      error: 'Invalid confirmation phrase',
    };
  }

  // 1. Get current admin session
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  if (!token) {
    return {
      success: false,
      message: 'You must be signed in as an administrator to perform this action.',
      error: 'Unauthenticated',
    };
  }

  const payload = {
    confirm_phrase: 'RESET',
    reset_sales: options.resetSales !== false,
    reset_shifts: options.resetShifts !== false,
    reset_product_stocks: Boolean(options.resetProductStocks),
    reset_expenses: Boolean(options.resetExpenses),
  };

  // 2. Primary execution: call secure server-side endpoint
  try {
    const response = await fetch('/api/admin/reset-business-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const data = await response.json();
      // Clear client-side local caches if applicable
      clearLocalCaches(options);
      return {
        success: true,
        message: data.message || 'Business data has been reset for a fresh operating period.',
        details: data.details,
      };
    }

    const errData = await response.json().catch(() => null);
    console.warn('[ResetService] Server endpoint notice, evaluating client fallback:', errData);
    
    // If the server responded with 401 or 403 (unauthorized/forbidden), do not bypass with fallback
    if (response.status === 401 || response.status === 403) {
      return {
        success: false,
        message: errData?.error || 'Unauthorized: Only administrators and managers can reset business data.',
        error: errData?.error || 'Forbidden',
      };
    }
  } catch (netErr) {
    console.warn('[ResetService] Server endpoint unreachable, attempting authorized client fallback:', netErr);
  }

  // 3. Resilient Fallback: Execute via authorized Supabase client under Admin RLS
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', sessionData.session.user.id)
      .maybeSingle();

    if (!profile || !['admin', 'manager', 'super_admin'].includes(profile.role)) {
      return {
        success: false,
        message: 'Admin or manager authorization required.',
        error: 'Forbidden',
      };
    }

    // Step A: Delete receipt prints
    if (payload.reset_sales) {
      await supabase
        .from('receipt_prints')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      // Step B: Delete sale items
      await supabase
        .from('sale_items')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      // Step C: Delete sales
      const { error: salesErr } = await supabase
        .from('sales')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (salesErr) {
        throw salesErr;
      }

      // Step D: Delete stock movements
      await supabase
        .from('stock_movements')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
    }

    // Step E: Delete shifts
    if (payload.reset_shifts) {
      await supabase
        .from('shifts')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
    }

    // Step F: Reset product stock counts to 0 if requested (DOES NOT create or delete products)
    if (payload.reset_product_stocks) {
      await supabase
        .from('products')
        .update({ stock_quantity: 0, updated_at: new Date().toISOString() })
        .neq('id', '00000000-0000-0000-0000-000000000000');
    }

    // Step G: Clear expenses if requested
    if (payload.reset_expenses) {
      try {
        await supabase
          .from('expenses' as any)
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');
      } catch {
        // Table might not exist yet
      }
    }

    // Step H: Activity log
    try {
      await supabase.from('activity_logs').insert({
        actor_id: sessionData.session.user.id,
        action: 'business_data_reset',
        entity_type: 'system',
        description: `Admin ${profile.full_name || 'Admin'} reset business figures for a fresh period.`,
        metadata: payload,
      });
    } catch {
      // Non-blocking
    }

    clearLocalCaches(options);

    return {
      success: true,
      message: 'Business data has been reset to ₦0 for a fresh operating period.',
      details: payload,
    };
  } catch (err: any) {
    console.error('[ResetService] Failed to execute business data reset:', err);
    return {
      success: false,
      message: err.message || 'Failed to reset business data.',
      error: err.message,
    };
  }
}

function clearLocalCaches(options: ResetBusinessDataOptions) {
  if (options.resetExpenses) {
    try {
      localStorage.removeItem('munaj_business_expenses_v1');
    } catch {
      // Ignore
    }
  }
}
