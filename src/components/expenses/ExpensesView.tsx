import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Scale,
  Calendar,
  Filter,
  DollarSign,
  Receipt,
  Trash2,
  AlertCircle,
  X,
  Search,
  CheckCircle2,
  Tag,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import type { Expense, ExpenseFilter, Profile, SaleWithDetails, BusinessSettings } from '../../types';
import {
  EXPENSE_CATEGORIES,
  fetchExpenses,
  createExpense,
  deleteExpense,
  calculateProfitLoss,
} from '../../services/expenseService';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface ExpensesViewProps {
  sales?: SaleWithDetails[];
  settings?: BusinessSettings | null;
  currentUser?: Profile | null;
  refreshTrigger?: number;
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  sales = [],
  settings,
  currentUser,
  refreshTrigger,
}) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filter state
  const todayStr = new Date().toISOString().slice(0, 10);
  const currentMonthStr = new Date().toISOString().slice(0, 7);

  const [period, setPeriod] = useState<'daily' | 'monthly' | 'custom'>('daily');
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [customStartDate, setCustomStartDate] = useState<string>(todayStr);
  const [customEndDate, setCustomEndDate] = useState<string>(todayStr);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [newAmount, setNewAmount] = useState('');
  const [newDate, setNewDate] = useState(todayStr);
  const [newNotes, setNewNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Deletion modal state
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load expenses
  const loadExpenses = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetchExpenses();
      setExpenses(res.data);
      if (res.error) setErrorMsg(res.error);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load expenses');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, [refreshTrigger]);

  // Build filter object
  const currentFilter: ExpenseFilter = useMemo(
    () => ({
      period,
      date: selectedDate,
      month: selectedMonth,
      startDate: customStartDate,
      endDate: customEndDate,
      category: selectedCategory,
      searchQuery,
    }),
    [period, selectedDate, selectedMonth, customStartDate, customEndDate, selectedCategory, searchQuery]
  );

  // Calculate profit and loss
  const { summary, filteredExpenses, filteredSales, expensesByCategory } = useMemo(() => {
    return calculateProfitLoss(sales, expenses, currentFilter);
  }, [sales, expenses, currentFilter]);

  // Handle create expense
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDescription.trim()) {
      setErrorMsg('Expense description is required.');
      return;
    }
    const numAmount = parseFloat(newAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMsg('Please enter a valid positive expense amount.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await createExpense({
        description: newDescription,
        category: newCategory,
        amount: numAmount,
        expense_date: newDate,
        notes: newNotes || null,
        created_by: currentUser?.id || null,
      });

      if (res.success && res.data) {
        setExpenses((prev) => [res.data!, ...prev.filter((item) => item.id !== res.data!.id)]);
        setIsAddModalOpen(false);
        // Reset form
        setNewDescription('');
        setNewCategory(EXPENSE_CATEGORIES[0]);
        setNewAmount('');
        setNewDate(todayStr);
        setNewNotes('');
        setSuccessMsg('✓ Expense recorded successfully.');
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setErrorMsg(res.error || 'Failed to record expense.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save expense.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete expense
  const handleConfirmDelete = async () => {
    if (!expenseToDelete) return;
    setIsDeleting(true);

    try {
      const res = await deleteExpense(expenseToDelete.id);
      if (res.success) {
        setExpenses((prev) => prev.filter((e) => e.id !== expenseToDelete.id));
        setSuccessMsg('Expense record removed.');
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to delete expense.');
    } finally {
      setIsDeleting(false);
      setExpenseToDelete(null);
    }
  };

  const currency = settings?.currency_symbol || 'NGN';

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Top Banner & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-950 p-6 rounded-2xl border border-zinc-800/80 shadow-lg">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-wide">
                Expenses &amp; Profit / Loss
              </h1>
              <p className="text-xs text-zinc-400">
                Log venue operating expenses and track net profitability against live sales.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadExpenses}
            disabled={isRefreshing}
            className="px-3 py-2 text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-700 hover:border-zinc-500 rounded-xl transition-all flex items-center gap-1.5"
            title="Refresh expenses"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 text-xs font-bold text-black bg-[#B7FF00] hover:bg-[#a6e600] rounded-xl shadow-md transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Record Expense</span>
          </button>
        </div>
      </div>

      {/* Alert Banners */}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800 text-red-300 text-xs flex items-center gap-2 animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="ml-auto text-red-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filter & Period Toolbar */}
      <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800/80 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Period Tabs */}
          <div className="flex items-center bg-zinc-900 p-1 rounded-xl border border-zinc-800">
            <button
              onClick={() => setPeriod('daily')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                period === 'daily'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Daily
            </button>
            <button
              onClick={() => setPeriod('monthly')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                period === 'monthly'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setPeriod('custom')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                period === 'custom'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Custom Range
            </button>
          </div>

          {/* Date Range Selectors */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {period === 'daily' && (
              <div className="flex items-center gap-2 bg-zinc-900 px-3 py-1.5 rounded-xl border border-zinc-800">
                <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                <span className="text-zinc-400">Date:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent text-white outline-none cursor-pointer text-xs"
                />
              </div>
            )}

            {period === 'monthly' && (
              <div className="flex items-center gap-2 bg-zinc-900 px-3 py-1.5 rounded-xl border border-zinc-800">
                <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                <span className="text-zinc-400">Month:</span>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-transparent text-white outline-none cursor-pointer text-xs"
                />
              </div>
            )}

            {period === 'custom' && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-zinc-900 px-3 py-1.5 rounded-xl border border-zinc-800">
                  <span className="text-zinc-500">From:</span>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="bg-transparent text-white outline-none cursor-pointer text-xs"
                  />
                </div>
                <span className="text-zinc-600">to</span>
                <div className="flex items-center gap-1.5 bg-zinc-900 px-3 py-1.5 rounded-xl border border-zinc-800">
                  <span className="text-zinc-500">To:</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="bg-transparent text-white outline-none cursor-pointer text-xs"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Secondary Category & Search Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-zinc-800/60">
          <div className="flex items-center gap-2 text-xs">
            <Filter className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-zinc-400">Category:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-zinc-900 text-zinc-200 border border-zinc-700/80 rounded-lg px-2.5 py-1 text-xs outline-none focus:border-zinc-500"
            >
              <option value="all">All Categories</option>
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[200px] flex items-center bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs">
            <Search className="w-3.5 h-3.5 text-zinc-400 mr-2 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search expenses by description, category, notes..."
              className="bg-transparent text-white outline-none w-full placeholder-zinc-500 text-xs"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-zinc-400 hover:text-white">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Profit / Loss Financial Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sales */}
        <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Sales</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-emerald-400">
              {formatCurrency(summary.totalSales, currency)}
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">
              {summary.salesCount} completed {summary.salesCount === 1 ? 'sale' : 'sales'} in {summary.periodLabel}
            </p>
          </div>
        </div>

        {/* Total Expenses */}
        <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Expenses</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-amber-400">
              {formatCurrency(summary.totalExpenses, currency)}
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">
              {summary.expenseCount} recorded {summary.expenseCount === 1 ? 'item' : 'items'} in {summary.periodLabel}
            </p>
          </div>
        </div>

        {/* Net Profit / Loss */}
        <div
          className={`p-5 rounded-2xl border flex flex-col justify-between ${
            summary.status === 'PROFIT'
              ? 'bg-emerald-950/20 border-emerald-800/50'
              : summary.status === 'LOSS'
              ? 'bg-red-950/20 border-red-800/50'
              : 'bg-zinc-950 border-zinc-800/80'
          }`}
        >
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Net Profit / Loss</span>
            {summary.status === 'PROFIT' && <TrendingUp className="w-5 h-5 text-emerald-400" />}
            {summary.status === 'LOSS' && <TrendingDown className="w-5 h-5 text-red-400" />}
            {summary.status === 'BREAK-EVEN' && <Scale className="w-5 h-5 text-zinc-400" />}
          </div>
          <div>
            <div
              className={`text-2xl font-bold font-mono ${
                summary.status === 'PROFIT'
                  ? 'text-emerald-400'
                  : summary.status === 'LOSS'
                  ? 'text-red-400'
                  : 'text-zinc-200'
              }`}
            >
              {formatCurrency(Math.abs(summary.netProfitLoss), currency)}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black tracking-wider uppercase ${
                  summary.status === 'PROFIT'
                    ? 'bg-emerald-500 text-black shadow-sm'
                    : summary.status === 'LOSS'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'bg-zinc-700 text-zinc-200'
                }`}
              >
                {summary.status}
              </span>
              <span className="text-[11px] text-zinc-400">
                {summary.status === 'PROFIT'
                  ? 'Sales exceed expenses'
                  : summary.status === 'LOSS'
                  ? 'Expenses exceed sales'
                  : 'Even balance'}
              </span>
            </div>
          </div>
        </div>

        {/* Operating Margin Ratio */}
        <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Profit Margin</span>
            <DollarSign className="w-4 h-4 text-zinc-400" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-white">
              {summary.totalSales > 0
                ? `${Math.round((summary.netProfitLoss / summary.totalSales) * 100)}%`
                : '—'}
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">
              Net margin based on active period sales
            </p>
          </div>
        </div>
      </div>

      {/* Category Expense Distribution (if any) */}
      {expensesByCategory.length > 0 && (
        <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800/80 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
            <Tag className="w-3.5 h-3.5 text-zinc-500" />
            <span>Expenses by Category ({summary.periodLabel})</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
            {expensesByCategory.map((catItem) => (
              <div
                key={catItem.category}
                className="bg-zinc-900/90 border border-zinc-800 p-3 rounded-xl flex flex-col justify-between"
              >
                <span className="text-zinc-400 text-xs truncate font-medium">{catItem.category}</span>
                <div className="mt-1">
                  <span className="text-sm font-bold font-mono text-white block">
                    {formatCurrency(catItem.amount, currency)}
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    {catItem.count} {catItem.count === 1 ? 'entry' : 'entries'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detailed Expenses Table */}
      <div className="bg-zinc-950 rounded-2xl border border-zinc-800/80 overflow-hidden shadow-lg">
        <div className="px-6 py-4 border-b border-zinc-800/80 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">
              Expense Records ({filteredExpenses.length})
            </h3>
            <p className="text-xs text-zinc-400">
              Showing operating expenses recorded for {summary.periodLabel}
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-lg">
            Period Total: {formatCurrency(summary.totalExpenses, currency)}
          </span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-zinc-500 text-xs flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Loading expenses...</span>
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 text-xs space-y-2">
            <Receipt className="w-8 h-8 mx-auto text-zinc-600 opacity-60" />
            <p className="text-zinc-400 font-medium">No expenses found for this period.</p>
            <p className="text-zinc-600">
              Click &ldquo;Record Expense&rdquo; above to log fuel, inventory, repairs, or staff costs.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-zinc-900/90 text-zinc-400 border-b border-zinc-800 uppercase tracking-wider font-semibold text-[11px]">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Notes</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-zinc-900/50 transition-colors">
                    <td className="py-3 px-4 font-mono text-zinc-400 whitespace-nowrap">
                      {formatDate(exp.expense_date)}
                    </td>
                    <td className="py-3 px-4 font-medium text-white max-w-[220px] truncate">
                      {exp.description}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-zinc-800 border border-zinc-700 text-zinc-200">
                        {exp.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-zinc-400 max-w-[200px] truncate">
                      {exp.notes || <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-amber-400 text-right whitespace-nowrap">
                      {formatCurrency(exp.amount, currency)}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <button
                        onClick={() => setExpenseToDelete(exp)}
                        className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Delete expense"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Expense Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden text-zinc-100 flex flex-col">
            <div className="px-6 py-5 bg-zinc-900/80 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#B7FF00]/10 border border-[#B7FF00]/30 flex items-center justify-center text-[#B7FF00]">
                  <Plus className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white tracking-wide">
                  Record Business Expense
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="p-6 space-y-4">
              {/* Description */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-300">
                  Description / Purpose <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="e.g. Generator diesel replenishment"
                  className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-700 rounded-xl text-xs text-white placeholder-zinc-500 outline-none focus:border-[#B7FF00] transition-colors"
                />
              </div>

              {/* Category */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-300">
                  Category <span className="text-red-400">*</span>
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-700 rounded-xl text-xs text-white outline-none focus:border-[#B7FF00] transition-colors"
                >
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount & Date in 2 columns */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-zinc-300">
                    Amount (₦) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    placeholder="e.g. 15000"
                    className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-700 rounded-xl text-xs text-white font-mono placeholder-zinc-500 outline-none focus:border-[#B7FF00] transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-zinc-300">
                    Expense Date <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-700 rounded-xl text-xs text-white outline-none focus:border-[#B7FF00] transition-colors"
                  />
                </div>
              </div>

              {/* Optional Notes */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-300">
                  Notes / Receipt Reference (Optional)
                </label>
                <textarea
                  rows={2}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Receipt #, vendor contact, or approval details..."
                  className="w-full px-3.5 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-xs text-white placeholder-zinc-500 outline-none focus:border-[#B7FF00] transition-colors resize-none"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-[#B7FF00] hover:bg-[#a6e600] text-black text-xs font-bold rounded-xl shadow-md transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {expenseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm bg-zinc-950 border border-red-900/60 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <AlertCircle className="w-5 h-5" />
              <h4 className="text-sm font-bold text-white">Delete Expense Record?</h4>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Are you sure you want to delete <strong className="text-white">{expenseToDelete.description}</strong> ({formatCurrency(expenseToDelete.amount, currency)})? This will remove it from P&amp;L calculations.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setExpenseToDelete(null)}
                disabled={isDeleting}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-colors"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
