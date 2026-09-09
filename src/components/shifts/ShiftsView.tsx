import React, { useState, useMemo } from 'react';
import {
  Clock,
  Banknote,
  TrendingUp,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Search,
  Calendar,
  Lock,
  ChevronDown,
  ExternalLink,
  FileText,
  Download,
  Eye,
  Trash2,
} from 'lucide-react';
import type { ShiftWithWorker, SaleWithDetails, Profile, BusinessSettings } from '../../types';
import { isShiftArchived } from '../../types';
import { formatCurrency, formatDateTime, formatTime, formatDate } from '../../utils/formatters';
import { Badge } from '../common/Badge';
import { EmptyState } from '../common/EmptyState';
import { Modal } from '../common/Modal';
import { DeleteConfirmModal } from '../common/DeleteConfirmModal';
import { deleteOrArchiveShift } from '../../services/deleteManagementService';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { ShiftReportModal } from './ShiftReportModal';
import { generateSingleShiftReport } from '../../utils/shiftReportCalculator';
import { generateAndDownloadShiftReportPDF } from '../../utils/shiftReportPdfGenerator';

interface ShiftsViewProps {
  shifts: ShiftWithWorker[];
  sales: SaleWithDetails[];
  workers: Profile[];
  settings: BusinessSettings | null;
  onRefresh: () => Promise<void> | void;
  onDeleteShift?: (shiftId: string) => void;
  loading: boolean;
  onOpenReceipt?: (sale: SaleWithDetails) => void;
}

export const ShiftsView: React.FC<ShiftsViewProps> = ({
  shifts,
  sales,
  workers,
  settings,
  onRefresh,
  onDeleteShift,
  loading,
  onOpenReceipt,
}) => {
  const { user } = useAuth();
  const currency = settings?.currency || 'NGN';

  const [search, setSearch] = useState('');
  const [workerFilter, setWorkerFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>('all');
  const [locallyDeletedShiftIds, setLocallyDeletedShiftIds] = useState<Set<string>>(new Set());
  const [selectedShiftIds, setSelectedShiftIds] = useState<string[]>([]);

  // Shift Report Modal State
  const [selectedShiftForReport, setSelectedShiftForReport] = useState<ShiftWithWorker | null>(null);
  const [downloadingPdfShiftId, setDownloadingPdfShiftId] = useState<string | null>(null);

  // Close shift modal (Admin intervention)
  const [selectedShiftForClose, setSelectedShiftForClose] = useState<ShiftWithWorker | null>(null);
  const [endingCashInput, setEndingCashInput] = useState<string>('');
  const [closingShift, setClosingShift] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);

  // Delete Shift Modal State
  const [shiftToDelete, setShiftToDelete] = useState<any | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeletingShift, setIsDeletingShift] = useState(false);
  const [shiftDeleteError, setShiftDeleteError] = useState<string | null>(null);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 5000);
  };

  const promptDeleteShift = (shift: any) => {
    setShiftToDelete(shift);
    setShiftDeleteError(null);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDeleteShift = async () => {
    if (!shiftToDelete) return;
    const targetShiftId = shiftToDelete.id;

    try {
      setIsDeletingShift(true);
      setShiftDeleteError(null);

      const result = await deleteOrArchiveShift(
        targetShiftId,
        {
          workerName: shiftToDelete.worker?.full_name || 'Staff',
          startedAt: shiftToDelete.started_at,
          endedAt: shiftToDelete.ended_at,
          status: shiftToDelete.status,
          totalSales: shiftToDelete.total_sales_amount,
        },
        user ? { id: user.id, fullName: user.full_name, role: user.role } : undefined
      );

      if (!result.success) {
        setShiftDeleteError(result.message);
        showToast(result.message, 'error');
        return;
      }

      // 1. Immediately remove from local view state
      setLocallyDeletedShiftIds((prev) => new Set(prev).add(targetShiftId));

      // 2. Immediately call parent state updater using shift primary key
      if (onDeleteShift) {
        onDeleteShift(targetShiftId);
      }

      // 3. Close modal and show success toast
      setIsDeleteModalOpen(false);
      setShiftToDelete(null);
      showToast(result.message, 'success');

      // 4. Background refetch of fresh data from server
      try {
        await onRefresh();
      } catch (refreshErr) {
        console.warn('Background refresh error after shift deletion:', refreshErr);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete shift.';
      setShiftDeleteError(msg);
      showToast(msg, 'error');
    } finally {
      setIsDeletingShift(false);
    }
  };

  const handleConfirmBulkDeleteShifts = async () => {
    const selectedShifts = filteredShifts.filter((shift) => selectedShiftIds.includes(shift.id));
    if (selectedShifts.length === 0) return;
    try {
      setIsBulkDeleting(true);
      setBulkDeleteError(null);
      let failed = 0;
      for (const shift of selectedShifts) {
        const result = await deleteOrArchiveShift(
          shift.id,
          {
            workerName: shift.worker?.full_name || 'Staff',
            startedAt: shift.started_at,
            endedAt: shift.ended_at,
            status: shift.status,
            totalSales: shift.total_sales_amount,
          },
          user ? { id: user.id, fullName: user.user_metadata?.full_name || 'Admin', role: user.user_metadata?.role } : undefined
        );
        if (!result.success) failed++;
        else setLocallyDeletedShiftIds((prev) => new Set(prev).add(shift.id));
      }
      if (failed > 0) {
        setBulkDeleteError('Failed to delete selected items. Please try again.');
        return;
      }
      setSelectedShiftIds([]);
      setIsBulkDeleteModalOpen(false);
      await onRefresh();
    } catch {
      setBulkDeleteError('Failed to delete selected items. Please try again.');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Direct PDF Download Handler
  const handleDirectPdfDownload = async (shift: ShiftWithWorker) => {
    try {
      setDownloadingPdfShiftId(shift.id);
      const report = generateSingleShiftReport({ shift, sales });
      await generateAndDownloadShiftReportPDF({ report, settings });
    } catch (err) {
      console.error('Direct PDF download error:', err);
    } finally {
      setDownloadingPdfShiftId(null);
    }
  };

  // Filter out locally deleted and archived shifts
  const visibleShifts = useMemo(() => {
    return shifts.filter(
      (shift) => !locallyDeletedShiftIds.has(shift.id) && !isShiftArchived(shift)
    );
  }, [shifts, locallyDeletedShiftIds]);

  // Compute live aggregates for shifts
  const shiftMetrics = useMemo(() => {
    return visibleShifts.map((shift) => {
      const shiftSales = sales.filter((s) => s.shift_id === shift.id && s.status === 'completed');
      const salesCount = shiftSales.length;
      const totalSalesAmount = shiftSales.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
      const cashSalesAmount = shiftSales
        .filter((s) => s.payment_method === 'cash')
        .reduce((acc, s) => acc + (Number(s.total) || 0), 0);
      const posSalesAmount = shiftSales
        .filter((s) => s.payment_method === 'pos')
        .reduce((acc, s) => acc + (Number(s.total) || 0), 0);
      const transferSalesAmount = shiftSales
        .filter((s) => s.payment_method === 'transfer')
        .reduce((acc, s) => acc + (Number(s.total) || 0), 0);

      const calculatedExpectedCash = Number(shift.opening_cash || 0) + cashSalesAmount;
      const effectiveEndingCash = shift.ending_cash !== null ? Number(shift.ending_cash) : null;
      const calculatedDifference =
        effectiveEndingCash !== null ? effectiveEndingCash - calculatedExpectedCash : null;

      return {
        ...shift,
        sales_count: salesCount,
        total_sales_amount: totalSalesAmount,
        cash_sales_amount: cashSalesAmount,
        pos_sales_amount: posSalesAmount,
        transfer_sales_amount: transferSalesAmount,
        calculatedExpectedCash,
        calculatedDifference,
      };
    });
  }, [visibleShifts, sales]);

  const activeShifts = shiftMetrics.filter((s) => s.status === 'active');
  const closedShifts = shiftMetrics.filter((s) => s.status === 'closed');

  const filteredShifts = useMemo(() => {
    return shiftMetrics.filter((s) => {
      if (locallyDeletedShiftIds.has(s.id) || isShiftArchived(s)) return false;
      if (workerFilter !== 'all' && s.worker_id !== workerFilter) return false;
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesWorker = s.worker?.full_name?.toLowerCase().includes(q);
        const matchesId = s.id.toLowerCase().includes(q);
        if (!matchesWorker && !matchesId) return false;
      }
      return true;
    });
  }, [shiftMetrics, locallyDeletedShiftIds, workerFilter, statusFilter, search]);

  const handleCloseShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShiftForClose) return;

    const actualCash = parseFloat(endingCashInput);
    if (isNaN(actualCash) || actualCash < 0) {
      setCloseError('Please enter a valid ending cash count.');
      return;
    }

    try {
      setClosingShift(true);
      setCloseError(null);

      // Call close_shift RPC
      const { data, error } = await supabase.rpc('close_shift', {
        p_shift_id: selectedShiftForClose.id,
        p_ending_cash: actualCash,
      });

      if (error) {
        console.warn('close_shift RPC error, applying direct update:', error.message);
        const expected = Number(selectedShiftForClose.opening_cash || 0) + Number(selectedShiftForClose.cash_sales_amount || 0);
        const diff = actualCash - expected;

        await supabase
          .from('shifts')
          .update({
            ending_cash: actualCash,
            expected_cash: expected,
            cash_difference: diff,
            ended_at: new Date().toISOString(),
            status: 'closed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedShiftForClose.id);

        await supabase.from('activity_logs').insert({
          action: 'shift_closed_by_admin',
          description: `Admin closed shift for ${selectedShiftForClose.worker?.full_name || 'Worker'} (Ending: ₦${actualCash})`,
          metadata: { shift_id: selectedShiftForClose.id, ending_cash: actualCash },
        });
      }

      setSelectedShiftForClose(null);
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to close shift.';
      setCloseError(msg);
    } finally {
      setClosingShift(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="bg-[#111111] p-5 rounded-2xl border border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-white tracking-tight">
            Shift Management & Cash Reconciliation
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Audit individual shifts, reconcile physical cash drawers, view full shift statements, and download branded PDF reports.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={activeShifts.length > 0 ? 'green' : 'zinc'} size="md">
            {activeShifts.length} Active Shift{activeShifts.length === 1 ? '' : 's'}
          </Badge>
        </div>
      </div>

      {/* Active Shifts Cards Section */}
      {activeShifts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E] animate-pulse" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Currently Active Shifts On Floor
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeShifts.map((shift) => (
              <div
                key={shift.id}
                className="bg-[#111111] rounded-2xl border border-emerald-800/40 p-5 shadow-lg shadow-emerald-950/20 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center font-bold text-white text-xs">
                        {shift.worker?.full_name?.charAt(0) || 'W'}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">{shift.worker?.full_name || 'Staff'}</h4>
                        <p className="text-[11px] text-zinc-400">Started {formatTime(shift.started_at)}</p>
                      </div>
                    </div>
                    <Badge variant="green">ACTIVE</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 my-3.5 text-xs">
                    <div className="p-2.5 rounded-xl bg-[#181818] border border-zinc-800">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase">Opening Float</span>
                      <p className="font-mono font-bold text-white mt-0.5">
                        {formatCurrency(shift.opening_cash, currency)}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#181818] border border-zinc-800">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase">Cash Sales</span>
                      <p className="font-mono font-bold text-emerald-400 mt-0.5">
                        {formatCurrency(shift.cash_sales_amount, currency)}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#181818] border border-zinc-800">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase">POS / Card</span>
                      <p className="font-mono font-bold text-blue-400 mt-0.5">
                        {formatCurrency(shift.pos_sales_amount, currency)}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#181818] border border-zinc-800">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase">Transfers</span>
                      <p className="font-mono font-bold text-amber-400 mt-0.5">
                        {formatCurrency(shift.transfer_sales_amount, currency)}
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs flex justify-between items-center">
                    <span className="text-zinc-400">Current Expected Cash:</span>
                    <span className="font-mono font-extrabold text-white text-sm">
                      {formatCurrency(shift.calculatedExpectedCash, currency)}
                    </span>
                  </div>
                </div>

                <div className="pt-4 mt-2 border-t border-zinc-800 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between text-[11px] text-zinc-400">
                    <span>
                      <strong className="text-white">{shift.sales_count}</strong> sales registered
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      onClick={() => setSelectedShiftForReport(shift)}
                      className="flex-1 px-2.5 py-1.5 text-xs font-bold text-emerald-400 hover:text-white bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-800/50 rounded-xl transition-all flex items-center justify-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Report</span>
                    </button>

                    <button
                      onClick={() => handleDirectPdfDownload(shift)}
                      disabled={downloadingPdfShiftId === shift.id}
                      className="px-2.5 py-1.5 text-xs font-bold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                      title="Download Shift Report PDF"
                    >
                      {downloadingPdfShiftId === shift.id ? (
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      <span>PDF</span>
                    </button>

                    <button
                      onClick={() => {
                        setSelectedShiftForClose(shift);
                        setEndingCashInput(shift.calculatedExpectedCash.toString());
                        setCloseError(null);
                      }}
                      className="px-3 py-1.5 text-xs font-bold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors"
                    >
                      Close Shift
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-[#111111] p-4 rounded-2xl border border-zinc-800/80 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search shift by staff name or ID..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-[#22C55E] text-white text-xs placeholder:text-zinc-500 outline-none"
          />
        </div>

        <select
          value={workerFilter}
          onChange={(e) => setWorkerFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white outline-none focus:border-[#22C55E]"
        >
          <option value="all">All Workers</option>
          {workers.map((w) => (
            <option key={w.id} value={w.id}>
              {w.full_name}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white outline-none focus:border-[#22C55E]"
        >
          <option value="all">All Shift Statuses</option>
          <option value="active">Active Only</option>
          <option value="closed">Closed / Reconciled</option>
        </select>

        <label className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-zinc-300 bg-zinc-900 rounded-xl border border-zinc-800 cursor-pointer whitespace-nowrap">
          <input
            type="checkbox"
            checked={filteredShifts.length > 0 && filteredShifts.every((shift) => selectedShiftIds.includes(shift.id))}
            onChange={(e) => {
              if (e.target.checked) {
                setSelectedShiftIds((prev) => Array.from(new Set([...prev, ...filteredShifts.map((shift) => shift.id)])));
              } else {
                const ids = new Set(filteredShifts.map((shift) => shift.id));
                setSelectedShiftIds((prev) => prev.filter((id) => !ids.has(id)));
              }
            }}
            className="rounded border-zinc-700 text-[#22C55E] focus:ring-[#22C55E] bg-zinc-900 cursor-pointer"
          />
          <span>Select All</span>
        </label>
      </div>

      {selectedShiftIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-zinc-900 border border-emerald-500/40 text-xs">
          <span className="font-bold text-white">{selectedShiftIds.length} shift(s) selected</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setSelectedShiftIds([])} className="px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-800 rounded-xl">Deselect All</button>
            <button onClick={() => { setBulkDeleteError(null); setIsBulkDeleteModalOpen(true); }} className="px-3.5 py-1.5 text-xs font-bold text-red-200 bg-red-950/80 border border-red-800/80 rounded-xl flex items-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Selected ({selectedShiftIds.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Shifts History Table */}
      <div className="bg-[#111111] rounded-2xl border border-zinc-800/80 overflow-hidden">
        {filteredShifts.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={Clock}
              title="No shift records found"
              description="When workers open and close shifts on the POS, audit records appear here."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#141414] border-b border-zinc-800 text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-4">Staff / Attendant</th>
                  <th className="py-3.5 px-4">Shift Time</th>
                  <th className="py-3.5 px-4 text-right">Opening Float</th>
                  <th className="py-3.5 px-4 text-right">Cash Sales</th>
                  <th className="py-3.5 px-4 text-right">Total Shift Sales</th>
                  <th className="py-3.5 px-4 text-right">Expected Cash</th>
                  <th className="py-3.5 px-4 text-right">Actual Ending</th>
                  <th className="py-3.5 px-4 text-right">Discrepancy</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filteredShifts.map((shift) => {
                  const diff = shift.calculatedDifference;
                  const isShortage = diff !== null && diff < 0;
                  const isExcess = diff !== null && diff > 0;
                  const isBalanced = diff !== null && diff === 0;
                  const isDownloadingThis = downloadingPdfShiftId === shift.id;

                  return (
                    <tr key={shift.id} className="hover:bg-zinc-900/60 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-white">
                        <input
                          type="checkbox"
                          checked={selectedShiftIds.includes(shift.id)}
                          onChange={() => setSelectedShiftIds((prev) => prev.includes(shift.id) ? prev.filter((id) => id !== shift.id) : [...prev, shift.id])}
                          className="mr-2 rounded border-zinc-700 text-[#22C55E] focus:ring-[#22C55E] bg-zinc-900 cursor-pointer"
                          aria-label={`Select shift ${shift.id}`}
                        />
                        {shift.worker?.full_name || 'Staff'}
                      </td>
                      <td className="py-3.5 px-4 text-zinc-400 whitespace-nowrap">
                        <div>{formatDate(shift.started_at)}</div>
                        <div className="text-[10px] text-zinc-500">
                          {formatTime(shift.started_at)} → {shift.ended_at ? formatTime(shift.ended_at) : 'Present'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-zinc-300">
                        {formatCurrency(shift.opening_cash, currency)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-emerald-400 font-semibold">
                        {formatCurrency(shift.cash_sales_amount, currency)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-white">
                        {formatCurrency(shift.total_sales_amount, currency)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-zinc-300">
                        {formatCurrency(shift.calculatedExpectedCash, currency)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-white font-semibold">
                        {shift.ending_cash !== null ? formatCurrency(shift.ending_cash, currency) : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold">
                        {diff === null ? (
                          <span className="text-zinc-500">—</span>
                        ) : isShortage ? (
                          <span className="text-red-400">{formatCurrency(diff, currency)} (Shortage)</span>
                        ) : isExcess ? (
                          <span className="text-emerald-400">+{formatCurrency(diff, currency)} (Over)</span>
                        ) : (
                          <span className="text-zinc-400">Balanced (₦0.00)</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <Badge variant={shift.status === 'active' ? 'green' : 'zinc'} size="sm">
                          {shift.status.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setSelectedShiftForReport(shift)}
                            className="px-2.5 py-1.5 text-xs font-bold text-emerald-400 hover:text-white bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-800/50 rounded-xl transition-all inline-flex items-center gap-1"
                            title="Preview and Print Shift Report"
                          >
                            <Eye className="w-3 h-3" />
                            <span className="hidden sm:inline">VIEW REPORT</span>
                            <span className="sm:hidden">VIEW</span>
                          </button>

                          <button
                            onClick={() => handleDirectPdfDownload(shift)}
                            disabled={isDownloadingThis}
                            className="px-2.5 py-1.5 text-xs font-bold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                            title="Download Shift Report as PDF"
                          >
                            {isDownloadingThis ? (
                              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Download className="w-3 h-3" />
                            )}
                            <span>PDF</span>
                          </button>

                          <button
                            onClick={() => promptDeleteShift(shift)}
                            className="px-2 py-1.5 text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-950/40 border border-red-900/40 rounded-xl transition-colors inline-flex items-center gap-1 cursor-pointer"
                            title="Delete or Archive Shift"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>DELETE</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {toastMsg && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl border text-xs font-semibold flex items-center gap-2 ${
            toastMsg.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-800'
              : 'bg-red-950/90 text-red-200 border-red-800'
          }`}
        >
          {toastMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Individual Shift Report Modal */}
      {selectedShiftForReport && (
        <ShiftReportModal
          isOpen={!!selectedShiftForReport}
          onClose={() => setSelectedShiftForReport(null)}
          shift={selectedShiftForReport}
          sales={sales}
          settings={settings}
          onOpenReceipt={onOpenReceipt}
        />
      )}

      {/* Delete Shift Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setShiftToDelete(null);
          setShiftDeleteError(null);
        }}
        onConfirm={handleConfirmDeleteShift}
        title="Delete Shift?"
        subtitle="Permanent Shift Record Deletion"
        description="Are you sure you want to permanently delete this shift record from the database?"
        itemName={shiftToDelete?.worker?.full_name ? `Shift for ${shiftToDelete.worker.full_name}` : 'Shift'}
        itemType="Shift Record"
        itemDetails={
          shiftToDelete
            ? [
                { label: 'Attendant', value: shiftToDelete.worker?.full_name || 'Staff' },
                { label: 'Started', value: formatDateTime(shiftToDelete.started_at) },
                { label: 'Ended', value: shiftToDelete.ended_at ? formatDateTime(shiftToDelete.ended_at) : 'Active (Open)' },
                { label: 'Status', value: shiftToDelete.status?.toUpperCase() },
                { label: 'Sales in Shift', value: `${shiftToDelete.sales_count || 0} sales (${formatCurrency(shiftToDelete.total_sales_amount || 0, currency)})` },
              ]
            : []
        }
        warningNotice={
          shiftToDelete?.status === 'active' || !shiftToDelete?.ended_at
            ? 'ATTENTION: This shift is currently ACTIVE. Active shifts cannot be deleted. You must reconcile and close the shift first.'
            : 'This shift will be permanently deleted from the database. Historical sales transactions and ledger records remain intact.'
        }
        confirmLabel={shiftToDelete?.status === 'active' ? 'BLOCKED' : 'DELETE'}
        confirmVariant="danger"
        requiresConfirmationText={false}
        loading={isDeletingShift}
        error={shiftDeleteError}
      />

      <DeleteConfirmModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => {
          if (isBulkDeleting) return;
          setIsBulkDeleteModalOpen(false);
          setBulkDeleteError(null);
        }}
        onConfirm={handleConfirmBulkDeleteShifts}
        title="Delete selected items?"
        description="Are you sure you want to delete the selected shift records?"
        itemName={`${selectedShiftIds.length} shift records`}
        itemType="Selected Shifts"
        warningNotice="This action will permanently remove the selected items and cannot be undone."
        confirmLabel="DELETE"
        confirmVariant="danger"
        loading={isBulkDeleting}
        error={bulkDeleteError}
      />

      {/* Close Shift Modal */}
      {selectedShiftForClose && (
        <Modal
          isOpen={!!selectedShiftForClose}
          onClose={() => setSelectedShiftForClose(null)}
          title="Reconcile & Close Shift"
          subtitle={`Attendant: ${selectedShiftForClose.worker?.full_name || 'Staff'}`}
          maxWidth="md"
        >
          <form onSubmit={handleCloseShiftSubmit} className="space-y-4">
            {closeError && (
              <div className="p-3 rounded-xl bg-red-950/60 border border-red-800/80 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{closeError}</span>
              </div>
            )}

            <div className="p-4 rounded-xl bg-[#181818] border border-zinc-800 space-y-2 text-xs">
              <div className="flex justify-between text-zinc-400">
                <span>Opening Cash Float:</span>
                <span className="font-mono text-white">
                  {formatCurrency(selectedShiftForClose.opening_cash, currency)}
                </span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Cash Sales in Shift:</span>
                <span className="font-mono text-emerald-400">
                  {formatCurrency(selectedShiftForClose.cash_sales_amount, currency)}
                </span>
              </div>
              <div className="flex justify-between font-bold text-white pt-2 border-t border-zinc-800">
                <span>Expected Cash Total:</span>
                <span className="font-mono text-[#22C55E] text-sm">
                  {formatCurrency(selectedShiftForClose.calculatedExpectedCash, currency)}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Physical Cash Counted (Actual Ending Cash) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={endingCashInput}
                onChange={(e) => setEndingCashInput(e.target.value)}
                placeholder="Counted physical cash in drawer"
                required
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-[#22C55E] text-white text-xs outline-none font-mono"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setSelectedShiftForClose(null)}
                className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={closingShift}
                className="px-5 py-2 text-xs font-bold text-black bg-[#22C55E] hover:bg-[#1ea750] rounded-xl transition-all shadow-md shadow-emerald-950/40 disabled:opacity-50"
              >
                {closingShift ? 'Reconciling...' : 'Confirm & Close Shift'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
