import { supabase } from '../lib/supabase';
import type { BusinessPeriod, BusinessPeriodType, Profile, SaleWithDetails, Expense } from '../types';

const PERIODS_STORAGE_KEY = 'munaj_business_periods_v1';

/**
 * Reads local cached business periods
 */
function getLocalPeriods(): BusinessPeriod[] {
  try {
    const raw = localStorage.getItem(PERIODS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Persists business periods locally
 */
function saveLocalPeriods(periods: BusinessPeriod[]): void {
  try {
    localStorage.setItem(PERIODS_STORAGE_KEY, JSON.stringify(periods));
  } catch (err) {
    console.warn('Unable to persist business periods locally:', err);
  }
}

/**
 * Fetches all business periods (both closed and open).
 */
export async function fetchBusinessPeriods(): Promise<{ data: BusinessPeriod[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('business_periods' as any)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      // Table may not yet be migrated in remote Supabase; fallback to local
      const local = getLocalPeriods();
      return { data: local };
    }

    const periods: BusinessPeriod[] = (data || []).map((row: any) => ({
      id: row.id,
      period_type: row.period_type,
      period_key: row.period_key || '',
      label: row.label || '',
      period_start: row.period_start,
      period_end: row.period_end,
      status: row.status || 'closed',
      closed_at: row.closed_at,
      closed_by: row.closed_by,
      closer_name: row.closer_name,
      total_sales: Number(row.total_sales) || 0,
      total_expenses: Number(row.total_expenses) || 0,
      net_profit_loss: Number(row.net_profit_loss) || 0,
      sales_count: Number(row.sales_count) || 0,
      expenses_count: Number(row.expenses_count) || 0,
      notes: row.notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    saveLocalPeriods(periods);
    return { data: periods };
  } catch (err: any) {
    const local = getLocalPeriods();
    return { data: local, error: err?.message };
  }
}

/**
 * Gets the most recent period boundary for 'day' or 'month'
 * This tells us when the current active operational period started.
 * If a period was closed, any sales/expenses strictly AFTER that period's closure belong to the new period.
 */
export function getActivePeriodStart(
  periods: BusinessPeriod[],
  type: BusinessPeriodType
): { periodStartIso: string; lastClosedPeriod: BusinessPeriod | null } {
  // Find closed periods of this type sorted by closed_at descending
  const closed = periods
    .filter((p) => p.period_type === type && p.status === 'closed' && p.closed_at)
    .sort((a, b) => new Date(b.closed_at!).getTime() - new Date(a.closed_at!).getTime());

  if (closed.length > 0) {
    const last = closed[0];
    return {
      periodStartIso: last.closed_at!,
      lastClosedPeriod: last,
    };
  }

  // If no closed periods exist yet, default to start of current calendar day or month
  const now = new Date();
  if (type === 'day') {
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    return { periodStartIso: startOfDay.toISOString(), lastClosedPeriod: null };
  } else {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    return { periodStartIso: startOfMonth.toISOString(), lastClosedPeriod: null };
  }
}

/**
 * Closes a business period (day or month) and starts a new one cleanly without deleting any records.
 */
export async function closeBusinessPeriod(params: {
  period_type: BusinessPeriodType;
  period_key: string;
  label: string;
  period_start: string;
  period_end: string;
  total_sales: number;
  total_expenses: number;
  net_profit_loss: number;
  sales_count: number;
  expenses_count: number;
  notes?: string;
  adminUser?: Profile | null;
}): Promise<{ success: boolean; data?: BusinessPeriod; error?: string }> {
  try {
    const nowIso = new Date().toISOString();
    const periodId = crypto.randomUUID();

    const newPeriod: BusinessPeriod = {
      id: periodId,
      period_type: params.period_type,
      period_key: params.period_key,
      label: params.label,
      period_start: params.period_start,
      period_end: params.period_end,
      status: 'closed',
      closed_at: nowIso,
      closed_by: params.adminUser?.id || null,
      closer_name: params.adminUser?.full_name || 'Admin',
      total_sales: params.total_sales,
      total_expenses: params.total_expenses,
      net_profit_loss: params.net_profit_loss,
      sales_count: params.sales_count,
      expenses_count: params.expenses_count,
      notes: params.notes || null,
      created_at: nowIso,
      updated_at: nowIso,
    };

    // 1. Try to persist to Supabase
    const { error: insertError } = await supabase.from('business_periods' as any).insert({
      id: newPeriod.id,
      period_type: newPeriod.period_type,
      period_key: newPeriod.period_key,
      label: newPeriod.label,
      period_start: newPeriod.period_start,
      period_end: newPeriod.period_end,
      status: 'closed',
      closed_at: newPeriod.closed_at,
      closed_by: newPeriod.closed_by,
      closer_name: newPeriod.closer_name,
      total_sales: newPeriod.total_sales,
      total_expenses: newPeriod.total_expenses,
      net_profit_loss: newPeriod.net_profit_loss,
      sales_count: newPeriod.sales_count,
      expenses_count: newPeriod.expenses_count,
      notes: newPeriod.notes,
      created_at: newPeriod.created_at,
      updated_at: newPeriod.updated_at,
    });

    if (insertError) {
      console.warn('Supabase business_periods insert note (saving locally):', insertError.message);
    }

    // 2. Always persist locally
    const existing = getLocalPeriods();
    // Prevent duplicate entries for the exact same period_key & type
    const filtered = existing.filter(
      (p) => !(p.period_type === newPeriod.period_type && p.period_key === newPeriod.period_key)
    );
    const updated = [newPeriod, ...filtered];
    saveLocalPeriods(updated);

    // 3. Log an activity log entry if possible
    try {
      await supabase.from('activity_logs' as any).insert({
        action: `close_${params.period_type}`,
        entity_type: 'business_period',
        entity_id: newPeriod.id,
        user_id: params.adminUser?.id || null,
        description: `Closed business ${params.period_type} (${newPeriod.label}): Sales ₦${params.total_sales.toLocaleString()}, Expenses ₦${params.total_expenses.toLocaleString()}, Net Profit ₦${params.net_profit_loss.toLocaleString()}`,
        metadata: {
          period_type: params.period_type,
          period_key: params.period_key,
          total_sales: params.total_sales,
          total_expenses: params.total_expenses,
          net_profit_loss: params.net_profit_loss,
          sales_count: params.sales_count,
          expenses_count: params.expenses_count,
        },
      });
    } catch (logErr) {
      console.warn('Could not log period close activity:', logErr);
    }

    return { success: true, data: newPeriod };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to close business period' };
  }
}
