import React, { useState, useMemo } from 'react';
import {
  X,
  FileSpreadsheet,
  User,
  Calendar,
  CreditCard,
  Banknote,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import type {
  Profile,
  SaleWithDetails,
  BusinessSettings,
  StaffSubmittedReport,
  StaffReportPeriod,
} from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { getPeriodDateRange } from '../../utils/staffReportCalculator';
import { submitStaffReportFromPOS } from '../../services/staffReportService';

interface CreateStaffReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  workers: Profile[];
  sales: SaleWithDetails[];
  settings: BusinessSettings | null;
  onReportCreated: (newReport: StaffSubmittedReport) => void;
}

export const CreateStaffReportModal: React.FC<CreateStaffReportModalProps> = ({
  isOpen,
  onClose,
  workers,
  sales,
  settings,
  onReportCreated,
}) => {
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>(
    workers.length > 0 ? workers[0].id : ''
  );
  const [period, setPeriod] = useState<StaffReportPeriod>('today');
  const [customStartDate, setCustomStartDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [customEndDate, setCustomEndDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  const currency = settings?.currency || 'NGN';

  // Selected worker object
  const selectedWorker = useMemo(() => {
    return workers.find((w) => w.id === selectedWorkerId) || workers[0];
  }, [workers, selectedWorkerId]);

  // Compute date range & sales metrics
  const dateRange = useMemo(() => {
    return getPeriodDateRange(period, customStartDate, customEndDate);
  }, [period, customStartDate, customEndDate]);

  const metrics = useMemo(() => {
    if (!selectedWorker) {
      return {
        salesTotal: 0,
        transactionsCount: 0,
        itemsCount: 0,
        cashSales: 0,
        posSales: 0,
        transferSales: 0,
        averageSale: 0,
      };
    }

    const matchingSales = sales.filter((s) => {
      if (s.worker_id !== selectedWorker.id) return false;
      const d = new Date(s.created_at);
      return d >= dateRange.startDate && d <= dateRange.endDate;
    });

    const salesTotal = matchingSales.reduce((sum, s) => sum + Number(s.total || 0), 0);
    const transactionsCount = matchingSales.length;
    const itemsCount = matchingSales.reduce((sum, s) => {
      return sum + (s.items?.reduce((iSum, item) => iSum + Number(item.quantity || 0), 0) || 1);
    }, 0);

    const cashSales = matchingSales
      .filter((s) => s.payment_method === 'cash')
      .reduce((sum, s) => sum + Number(s.total || 0), 0);
    const posSales = matchingSales
      .filter((s) => s.payment_method === 'pos')
      .reduce((sum, s) => sum + Number(s.total || 0), 0);
    const transferSales = matchingSales
      .filter((s) => s.payment_method === 'transfer')
      .reduce((sum, s) => sum + Number(s.total || 0), 0);

    const averageSale = transactionsCount > 0 ? salesTotal / transactionsCount : 0;

    return {
      salesTotal,
      transactionsCount,
      itemsCount,
      cashSales,
      posSales,
      transferSales,
      averageSale,
    };
  }, [selectedWorker, sales, dateRange]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorker) {
      setError('Please select a staff member.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const newReport = await submitStaffReportFromPOS({
        worker_id: selectedWorker.id,
        worker_name: selectedWorker.full_name || 'Staff Member',
        worker_role: selectedWorker.role || 'Staff',
        period,
        period_label: dateRange.periodLabel,
        start_date: dateRange.startDate.toISOString(),
        end_date: dateRange.endDate.toISOString(),
        sales_total: metrics.salesTotal,
        transactions_count: metrics.transactionsCount,
        items_count: metrics.itemsCount,
        cash_sales: metrics.cashSales,
        pos_sales: metrics.posSales,
        transfer_sales: metrics.transferSales,
        average_sale: metrics.averageSale,
        notes: notes.trim() || `Submitted ${dateRange.periodLabel} performance report.`,
      });

      setSuccess(true);
      onReportCreated(newReport);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Error creating report:', err);
      setError(err?.message || 'Failed to create report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="bg-[#0c0c0c] border border-zinc-800 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 bg-[#111111] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-[#22C55E]">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white tracking-tight">
                Create Staff Report
              </h2>
              <p className="text-xs text-zinc-400">
                Generate and submit an official sales performance statement to Supabase
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Staff report created and submitted successfully!</span>
            </div>
          )}

          {/* Worker Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#22C55E]" />
              <span>Select Attendant / Cashier</span>
            </label>
            <select
              value={selectedWorkerId}
              onChange={(e) => setSelectedWorkerId(e.target.value)}
              className="w-full bg-[#161616] border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#22C55E] transition-colors cursor-pointer"
            >
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.full_name} ({w.role?.toUpperCase() || 'STAFF'})
                </option>
              ))}
            </select>
          </div>

          {/* Period Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#22C55E]" />
              <span>Report Period</span>
            </label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as StaffReportPeriod)}
              className="w-full bg-[#161616] border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#22C55E] transition-colors cursor-pointer"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this_week">This Week</option>
              <option value="last_7_days">Last 7 Days</option>
              <option value="this_month">This Month</option>
              <option value="last_30_days">Last 30 Days</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {/* Custom Date Range Inputs */}
          {period === 'custom' && (
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-zinc-900/50 border border-zinc-800/80">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-zinc-400">Start Date</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full bg-[#141414] border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#22C55E]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-zinc-400">End Date</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full bg-[#141414] border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#22C55E]"
                />
              </div>
            </div>
          )}

          {/* Metrics Preview */}
          <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-300">Period Summary Preview</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {dateRange.periodLabel}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="p-2.5 rounded-xl bg-black/40 border border-zinc-800/60">
                <span className="text-[10px] text-zinc-400 block">Total Sales</span>
                <span className="text-sm font-extrabold text-[#22C55E] block mt-0.5">
                  {formatCurrency(metrics.salesTotal, currency)}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-black/40 border border-zinc-800/60">
                <span className="text-[10px] text-zinc-400 block">Transactions</span>
                <span className="text-sm font-extrabold text-white block mt-0.5">
                  {metrics.transactionsCount}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-black/40 border border-zinc-800/60">
                <span className="text-[10px] text-zinc-400 block">Items Sold</span>
                <span className="text-sm font-extrabold text-white block mt-0.5">
                  {metrics.itemsCount}
                </span>
              </div>
            </div>

            {/* Payment Method Breakdown */}
            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-zinc-800/60 text-[11px]">
              <div className="flex items-center gap-1.5 text-zinc-400">
                <Banknote className="w-3.5 h-3.5 text-amber-400" />
                <span>Cash: <strong>{formatCurrency(metrics.cashSales, currency)}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 text-zinc-400">
                <CreditCard className="w-3.5 h-3.5 text-blue-400" />
                <span>POS: <strong>{formatCurrency(metrics.posSales, currency)}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 text-zinc-400">
                <Smartphone className="w-3.5 h-3.5 text-purple-400" />
                <span>Transfer: <strong>{formatCurrency(metrics.transferSales, currency)}</strong></span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-300">
              Report Notes / Remarks (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. End-of-shift cashier report submitted for management review..."
              rows={2}
              className="w-full bg-[#161616] border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#22C55E] resize-none"
            />
          </div>

          {/* Submit Action */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-[#22C55E] hover:bg-emerald-400 active:scale-95 text-black font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-950/40 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Create & Submit Report</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
