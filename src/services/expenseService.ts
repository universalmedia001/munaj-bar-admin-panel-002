import { supabase } from '../lib/supabase';
import type { Expense, ExpenseCategory, ExpenseFilter, ProfitLossSummary, SaleWithDetails } from '../types';

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Stock/Goods',
  'Transportation',
  'Electricity',
  'Staff',
  'Rent',
  'Maintenance',
  'Other',
];

const LOCAL_STORAGE_KEY = 'munaj_business_expenses_v1';

/**
 * Reads local cached expenses (used as fallback when offline or before table migration)
 */
function getLocalExpenses(): Expense[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Persists local cached expenses
 */
function saveLocalExpenses(expenses: Expense[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(expenses));
  } catch (err) {
    console.warn('Unable to persist expenses to local storage:', err);
  }
}

/**
 * Fetches all expenses from Supabase with resilient local cache fallback.
 */
export async function fetchExpenses(): Promise<{ data: Expense[]; error?: string }> {
  try {
    // Attempt query with creator profile join
    let query = supabase
      .from('expenses' as any)
      .select(`
        *,
        creator:profiles(id, full_name, email, role)
      `)
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false });

    let { data, error } = await query;

    if (error) {
      // If foreign key join fails, try flat select
      const flatRes = await supabase
        .from('expenses' as any)
        .select('*')
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (!flatRes.error && flatRes.data) {
        data = flatRes.data;
        error = null;
      }
    }

    if (error) {
      console.warn('[ExpenseService] Supabase expenses query notice, using local cache:', error.message);
      const local = getLocalExpenses();
      return { data: local };
    }

    const fetched: Expense[] = (data || []).map((row: any) => ({
      id: row.id,
      description: row.description,
      category: row.category,
      amount: Number(row.amount) || 0,
      expense_date: row.expense_date,
      notes: row.notes || null,
      created_by: row.created_by || null,
      created_at: row.created_at || new Date().toISOString(),
      creator: row.creator || null,
    }));

    // Cache locally for offline/resilient access
    saveLocalExpenses(fetched);

    return { data: fetched };
  } catch (err) {
    console.warn('[ExpenseService] Unexpected error reading expenses:', err);
    return { data: getLocalExpenses() };
  }
}

/**
 * Creates a new business expense record.
 */
export async function createExpense(expenseInput: {
  description: string;
  category: string;
  amount: number;
  expense_date: string;
  notes?: string | null;
  created_by?: string | null;
}): Promise<{ success: boolean; data?: Expense; error?: string }> {
  const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `exp_${Date.now()}`;
  const nowIso = new Date().toISOString();

  const payload = {
    id: newId,
    description: expenseInput.description.trim(),
    category: expenseInput.category,
    amount: Number(expenseInput.amount) || 0,
    expense_date: expenseInput.expense_date,
    notes: expenseInput.notes ? expenseInput.notes.trim() : null,
    created_by: expenseInput.created_by || null,
    created_at: nowIso,
  };

  try {
    const { data, error } = await supabase
      .from('expenses' as any)
      .insert(payload)
      .select()
      .maybeSingle();

    if (error) {
      console.warn('[ExpenseService] Supabase insert failed, caching locally:', error.message);
      // Save locally so the user is never blocked
      const local = getLocalExpenses();
      const fallbackExpense: Expense = { ...payload };
      saveLocalExpenses([fallbackExpense, ...local]);
      return { success: true, data: fallbackExpense };
    }

    const created: Expense = {
      id: data?.id || newId,
      description: data?.description || payload.description,
      category: data?.category || payload.category,
      amount: Number(data?.amount) || payload.amount,
      expense_date: data?.expense_date || payload.expense_date,
      notes: data?.notes || payload.notes,
      created_by: data?.created_by || payload.created_by,
      created_at: data?.created_at || payload.created_at,
    };

    // Update local cache
    const local = getLocalExpenses().filter((e) => e.id !== created.id);
    saveLocalExpenses([created, ...local]);

    return { success: true, data: created };
  } catch (err: any) {
    console.warn('[ExpenseService] Fallback to local storage for expense:', err);
    const local = getLocalExpenses();
    const fallbackExpense: Expense = { ...payload };
    saveLocalExpenses([fallbackExpense, ...local]);
    return { success: true, data: fallbackExpense };
  }
}

/**
 * Deletes an individual expense by ID.
 */
export async function deleteExpense(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('expenses' as any)
      .delete()
      .eq('id', id);

    if (error) {
      console.warn('[ExpenseService] Supabase delete notice:', error.message);
    }

    // Always clear from local cache
    const current = getLocalExpenses();
    saveLocalExpenses(current.filter((e) => e.id !== id));

    return { success: true };
  } catch (err: any) {
    const current = getLocalExpenses();
    saveLocalExpenses(current.filter((e) => e.id !== id));
    return { success: true };
  }
}

/**
 * Calculates Profit/Loss by deriving expenses alongside existing sales records.
 * Important: Does NOT modify existing sales data.
 */
export function calculateProfitLoss(
  sales: SaleWithDetails[],
  expenses: Expense[],
  filter: ExpenseFilter
): {
  summary: ProfitLossSummary;
  filteredSales: SaleWithDetails[];
  filteredExpenses: Expense[];
  expensesByCategory: { category: string; amount: number; count: number }[];
} {
  const todayStr = new Date().toISOString().slice(0, 10);
  const currentMonthStr = new Date().toISOString().slice(0, 7);

  let periodLabel = '';
  let dateFilterFn: (saleDateStr: string, expenseDateStr: string) => boolean;

  if (filter.period === 'daily') {
    const targetDate = filter.date || todayStr;
    periodLabel = targetDate === todayStr ? `Today (${targetDate})` : `Date: ${targetDate}`;
    dateFilterFn = (sDate, eDate) => sDate === targetDate && eDate === targetDate;
  } else if (filter.period === 'monthly') {
    const targetMonth = filter.month || currentMonthStr;
    const [year, month] = targetMonth.split('-');
    const monthName = new Date(Number(year), Number(month) - 1, 1).toLocaleString('default', {
      month: 'long',
      year: 'numeric',
    });
    periodLabel = monthName;
    dateFilterFn = (sDate, eDate) => sDate.startsWith(targetMonth) && eDate.startsWith(targetMonth);
  } else {
    // Custom range
    const start = filter.startDate || todayStr;
    const end = filter.endDate || todayStr;
    periodLabel = `${start} to ${end}`;
    dateFilterFn = (sDate, eDate) => sDate >= start && sDate <= end && eDate >= start && eDate <= end;
  }

  // Filter Sales (completed only)
  const filteredSales = sales.filter((s) => {
    if (s.status !== 'completed') return false;
    const saleDate = s.created_at.slice(0, 10);
    if (filter.period === 'daily') {
      const targetDate = filter.date || todayStr;
      return saleDate === targetDate;
    }
    if (filter.period === 'monthly') {
      const targetMonth = filter.month || currentMonthStr;
      return saleDate.startsWith(targetMonth);
    }
    const start = filter.startDate || todayStr;
    const end = filter.endDate || todayStr;
    return saleDate >= start && saleDate <= end;
  });

  // Filter Expenses
  let filteredExpenses = expenses.filter((e) => {
    const expDate = e.expense_date;
    if (filter.period === 'daily') {
      const targetDate = filter.date || todayStr;
      return expDate === targetDate;
    }
    if (filter.period === 'monthly') {
      const targetMonth = filter.month || currentMonthStr;
      return expDate.startsWith(targetMonth);
    }
    const start = filter.startDate || todayStr;
    const end = filter.endDate || todayStr;
    return expDate >= start && expDate <= end;
  });

  // Apply optional category filter to expenses view
  if (filter.category && filter.category !== 'all') {
    filteredExpenses = filteredExpenses.filter((e) => e.category === filter.category);
  }

  // Apply optional search query
  if (filter.searchQuery && filter.searchQuery.trim()) {
    const q = filter.searchQuery.toLowerCase().trim();
    filteredExpenses = filteredExpenses.filter(
      (e) =>
        e.description.toLowerCase().includes(q) ||
        (e.notes && e.notes.toLowerCase().includes(q)) ||
        e.category.toLowerCase().includes(q)
    );
  }

  // Sums
  const totalSales = filteredSales.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
  const totalExpenses = filteredExpenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
  const netProfitLoss = totalSales - totalExpenses;

  // Status computation
  let status: 'PROFIT' | 'LOSS' | 'BREAK-EVEN' = 'BREAK-EVEN';
  if (totalSales > totalExpenses) {
    status = 'PROFIT';
  } else if (totalSales < totalExpenses) {
    status = 'LOSS';
  } else {
    status = 'BREAK-EVEN';
  }

  // Breakdown by category
  const categoryMap: { [cat: string]: { amount: number; count: number } } = {};
  for (const exp of filteredExpenses) {
    const cat = exp.category || 'Other';
    if (!categoryMap[cat]) {
      categoryMap[cat] = { amount: 0, count: 0 };
    }
    categoryMap[cat].amount += Number(exp.amount) || 0;
    categoryMap[cat].count += 1;
  }

  const expensesByCategory = Object.entries(categoryMap).map(([category, info]) => ({
    category,
    amount: info.amount,
    count: info.count,
  })).sort((a, b) => b.amount - a.amount);

  return {
    summary: {
      periodLabel,
      totalSales,
      totalExpenses,
      netProfitLoss,
      status,
      salesCount: filteredSales.length,
      expenseCount: filteredExpenses.length,
    },
    filteredSales,
    filteredExpenses,
    expensesByCategory,
  };
}
