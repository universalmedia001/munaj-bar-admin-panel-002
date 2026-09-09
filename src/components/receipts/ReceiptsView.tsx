import React, { useState, useMemo } from 'react';
import {
  Receipt as ReceiptIcon,
  Search,
  Printer,
  Eye,
  History,
  Calendar,
  User,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  FileText,
  Download,
  DollarSign,
  CreditCard,
  ArrowUpRight,
  RefreshCw,
  Clock,
  Layers,
  ChevronLeft,
  ChevronRight,
  Check,
  Trash2,
} from 'lucide-react';
import type { SaleWithDetails, ReceiptPrint, BusinessSettings, Profile } from '../../types';
import { formatWorkerDisplayName } from '../../types';
import { formatCurrency, formatDateTime, formatDate, formatTime } from '../../utils/formatters';
import { generateAndDownloadReceiptPDF } from '../../utils/pdfReceiptGenerator';
import { Badge } from '../common/Badge';
import { EmptyState } from '../common/EmptyState';
import { DeleteConfirmModal } from '../common/DeleteConfirmModal';
import { bulkDeleteReceiptPrintRecords, deleteOrArchiveReceipt, deleteReceiptPrintRecord } from '../../services/deleteManagementService';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface ReceiptsViewProps {
  sales: SaleWithDetails[];
  receiptPrints: ReceiptPrint[];
  settings: BusinessSettings | null;
  workers?: Profile[];
  onOpenReceipt: (sale: SaleWithDetails) => void;
  onRefresh?: () => void;
  loading: boolean;
}

export const ReceiptsView: React.FC<ReceiptsViewProps> = ({
  sales,
  receiptPrints,
  settings,
  workers = [],
  onOpenReceipt,
  onRefresh,
  loading,
}) => {
  const { user, profile } = useAuth();
  const currency = settings?.currency || 'NGN';
  const [activeSubTab, setActiveSubTab] = useState<'receipts' | 'print_logs'>('receipts');
  
  // Search & Filters
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'week' | 'month' | 'all'>('today');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'cash' | 'pos' | 'transfer'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'cancelled' | 'refunded'>('all');
  const [workerFilter, setWorkerFilter] = useState<string>('all');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Track downloaded sales IDs to detect duplicates / reprints
  const [downloadedSales, setDownloadedSales] = useState<Record<string, number>>({});
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Hidden receipts state (for immediate UI removal upon delete/archive without waiting)
  const [hiddenReceiptIds, setHiddenReceiptIds] = useState<Set<string>>(new Set());
  const [hiddenPrintLogIds, setHiddenPrintLogIds] = useState<Set<string>>(new Set());
  const [selectedReceiptIds, setSelectedReceiptIds] = useState<string[]>([]);
  const [selectedPrintLogIds, setSelectedPrintLogIds] = useState<string[]>([]);

  // Delete Receipt Modal State
  const [receiptToDelete, setReceiptToDelete] = useState<SaleWithDetails | null>(null);
  const [isDeleteReceiptModalOpen, setIsDeleteReceiptModalOpen] = useState(false);
  const [isDeletingReceipt, setIsDeletingReceipt] = useState(false);
  const [receiptDeleteError, setReceiptDeleteError] = useState<string | null>(null);

  // Delete Print Log Modal State
  const [printLogToDelete, setPrintLogToDelete] = useState<ReceiptPrint | null>(null);
  const [isDeletePrintLogModalOpen, setIsDeletePrintLogModalOpen] = useState(false);
  const [isDeletingPrintLog, setIsDeletingPrintLog] = useState(false);
  const [printLogDeleteError, setPrintLogDeleteError] = useState<string | null>(null);
  const [isBulkReceiptDeleteModalOpen, setIsBulkReceiptDeleteModalOpen] = useState(false);
  const [isBulkPrintLogDeleteModalOpen, setIsBulkPrintLogDeleteModalOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 5000);
  };

  const promptDeleteReceipt = (sale: SaleWithDetails) => {
    setReceiptToDelete(sale);
    setReceiptDeleteError(null);
    setIsDeleteReceiptModalOpen(true);
  };

  const handleConfirmDeleteReceipt = async () => {
    if (!receiptToDelete) return;
    try {
      setIsDeletingReceipt(true);
      setReceiptDeleteError(null);

      const result = await deleteOrArchiveReceipt(
        receiptToDelete.id,
        receiptToDelete.receipt_number,
        {
          workerName: receiptToDelete.worker?.full_name || 'Staff',
          total: Number(receiptToDelete.total) || 0,
          paymentMethod: receiptToDelete.payment_method.toUpperCase(),
          date: formatDate(receiptToDelete.created_at),
        },
        user ? { id: user.id, fullName: user.full_name, role: user.role } : undefined
      );

      if (!result.success) {
        setReceiptDeleteError(result.message);
        showToast(result.message, 'error');
        return;
      }

      setHiddenReceiptIds((prev) => new Set(prev).add(receiptToDelete.id));
      setIsDeleteReceiptModalOpen(false);
      setReceiptToDelete(null);
      showToast('Receipt deleted successfully.', 'success');
      if (onRefresh) onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to delete receipt.';
      setReceiptDeleteError(msg);
      showToast(msg, 'error');
    } finally {
      setIsDeletingReceipt(false);
    }
  };

  const promptDeletePrintLog = (printLog: ReceiptPrint) => {
    setPrintLogToDelete(printLog);
    setPrintLogDeleteError(null);
    setIsDeletePrintLogModalOpen(true);
  };

  const handleConfirmDeletePrintLog = async () => {
    if (!printLogToDelete) return;
    try {
      setIsDeletingPrintLog(true);
      setPrintLogDeleteError(null);

      const result = await deleteReceiptPrintRecord(
        printLogToDelete.id,
        printLogToDelete.sale_id,
        user?.id
      );

      if (!result.success) {
        setPrintLogDeleteError(result.message);
        showToast(result.message, 'error');
        return;
      }

      setHiddenPrintLogIds((prev) => new Set(prev).add(printLogToDelete.id));
      setIsDeletePrintLogModalOpen(false);
      setPrintLogToDelete(null);
      showToast('Print history record removed successfully.', 'success');
      if (onRefresh) onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to remove print history.';
      setPrintLogDeleteError(msg);
      showToast(msg, 'error');
    } finally {
      setIsDeletingPrintLog(false);
    }
  };

  const handleConfirmBulkDeleteReceipts = async () => {
    const selectedSales = paginatedSales.filter((sale) => selectedReceiptIds.includes(sale.id));
    if (selectedSales.length === 0) return;
    try {
      setIsBulkDeleting(true);
      setBulkDeleteError(null);
      for (const sale of selectedSales) {
        const result = await deleteOrArchiveReceipt(
          sale.id,
          sale.receipt_number,
          {
            workerName: sale.worker?.full_name || 'Staff',
            total: Number(sale.total) || 0,
            paymentMethod: sale.payment_method.toUpperCase(),
            date: formatDate(sale.created_at),
          },
          profile ? { id: profile.id, fullName: profile.full_name, role: profile.role } : undefined
        );
        if (!result.success) {
          setBulkDeleteError('Failed to delete selected items. Please try again.');
          return;
        }
      }
      setHiddenReceiptIds((prev) => new Set([...prev, ...selectedReceiptIds]));
      setSelectedReceiptIds([]);
      setIsBulkReceiptDeleteModalOpen(false);
      onRefresh?.();
    } catch {
      setBulkDeleteError('Failed to delete selected items. Please try again.');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleConfirmBulkDeletePrintLogs = async () => {
    if (selectedPrintLogIds.length === 0) return;
    try {
      setIsBulkDeleting(true);
      setBulkDeleteError(null);
      const result = await bulkDeleteReceiptPrintRecords(selectedPrintLogIds, user?.id);
      if (!result.success || result.failedCount > 0) {
        setBulkDeleteError('Failed to delete selected items. Please try again.');
        return;
      }
      setHiddenPrintLogIds((prev) => new Set([...prev, ...selectedPrintLogIds]));
      setSelectedPrintLogIds([]);
      setIsBulkPrintLogDeleteModalOpen(false);
      onRefresh?.();
    } catch {
      setBulkDeleteError('Failed to delete selected items. Please try again.');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Filtered Sales Logic
  const filteredSales = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
    const startOfWeek = startOfToday - now.getDay() * 24 * 60 * 60 * 1000;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    return sales.filter((s) => {
      if (hiddenReceiptIds.has(s.id)) return false;

      const t = new Date(s.created_at).getTime();

      // Date Range Filter
      if (dateFilter === 'today' && t < startOfToday) return false;
      if (dateFilter === 'yesterday' && (t < startOfYesterday || t >= startOfToday)) return false;
      if (dateFilter === 'week' && t < startOfWeek) return false;
      if (dateFilter === 'month' && t < startOfMonth) return false;

      // Payment Filter
      if (paymentFilter !== 'all' && s.payment_method !== paymentFilter) return false;

      // Status Filter
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;

      // Worker Filter
      if (workerFilter !== 'all' && s.worker_id !== workerFilter) return false;

      // Search Query (Receipt Number, Worker Name, Product Items)
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesNo = s.receipt_number.toLowerCase().includes(q);
        const matchesWorker = s.worker?.full_name?.toLowerCase().includes(q);
        const matchesItems = s.items?.some((it) => it.product_name.toLowerCase().includes(q));
        if (!matchesNo && !matchesWorker && !matchesItems) return false;
      }

      return true;
    });
  }, [sales, dateFilter, paymentFilter, statusFilter, workerFilter, search, hiddenReceiptIds]);

  const visiblePrintLogs = useMemo(() => {
    return receiptPrints.filter((p) => !hiddenPrintLogIds.has(p.id));
  }, [receiptPrints, hiddenPrintLogIds]);

  // Dynamic Receipt Statistics (Computed from current day or filtered dataset)
  const stats = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    // Today's Sales
    const todaySalesList = sales.filter(
      (s) => new Date(s.created_at).getTime() >= startOfToday && s.status === 'completed'
    );
    const todaySalesTotal = todaySalesList.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
    const todaySalesCount = todaySalesList.length;

    // Payment breakdowns for today
    const cashTotal = todaySalesList
      .filter((s) => s.payment_method === 'cash')
      .reduce((acc, s) => acc + (Number(s.total) || 0), 0);
    const posTotal = todaySalesList
      .filter((s) => s.payment_method === 'pos')
      .reduce((acc, s) => acc + (Number(s.total) || 0), 0);
    const transferTotal = todaySalesList
      .filter((s) => s.payment_method === 'transfer')
      .reduce((acc, s) => acc + (Number(s.total) || 0), 0);

    return {
      todaySalesTotal,
      todaySalesCount,
      cashTotal,
      posTotal,
      transferTotal,
    };
  }, [sales]);

  // Pagination Slice
  const totalPages = Math.ceil(filteredSales.length / pageSize) || 1;
  const paginatedSales = filteredSales.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Direct PDF Download Handler
  const handleDirectDownload = async (sale: SaleWithDetails, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      setDownloadingId(sale.id);
      const isAlreadyDownloaded = (downloadedSales[sale.id] || 0) > 0 || receiptPrints.some((p) => p.sale_id === sale.id);

      const result = await generateAndDownloadReceiptPDF({
        sale,
        settings,
        isReprint: isAlreadyDownloaded,
      });

      setDownloadedSales((prev) => ({
        ...prev,
        [sale.id]: (prev[sale.id] || 0) + 1,
      }));

      // Log receipt print event in database
      if (user?.id) {
        try {
          await supabase.from('receipt_prints').insert({
            sale_id: sale.id,
            worker_id: user.id,
            printed_at: new Date().toISOString(),
          });
          onRefresh?.();
        } catch (logErr) {
          console.warn('Notice logging receipt print audit:', logErr);
        }
      }

      setToastMsg({
        text: `Downloaded ${result.filename}${isAlreadyDownloaded ? ' (Reprint)' : ''}`,
        type: 'success',
      });
      setTimeout(() => setToastMsg(null), 3500);
    } catch (err) {
      console.error('Direct PDF download failed:', err);
      setToastMsg({
        text: 'Unable to generate receipt PDF. Please try again.',
        type: 'error',
      });
      setTimeout(() => setToastMsg(null), 4000);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toastMsg && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl border text-xs font-semibold animate-fade-in ${
            toastMsg.type === 'success'
              ? 'bg-zinc-900 border-[#22C55E]/60 text-white'
              : 'bg-red-950 border-red-800 text-red-200'
          }`}
        >
          {toastMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-[#22C55E]" />
          ) : (
            <ReceiptIcon className="w-4 h-4 text-red-400" />
          )}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Top Banner & Sub Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#111111] p-5 rounded-2xl border border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#22C55E]/10 border border-[#22C55E]/20 flex items-center justify-center text-[#22C55E]">
              <ReceiptIcon className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-extrabold text-white tracking-tight">
              Receipts & PDF Download Center
            </h2>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Search completed sales, generate high-fidelity PDF receipts, and audit reprint logs across all workers.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setActiveSubTab('receipts')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'receipts'
                ? 'bg-[#22C55E] text-black font-bold shadow-sm'
                : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
            }`}
          >
            <ReceiptIcon className="w-4 h-4" />
            <span>Receipt Catalog ({sales.length})</span>
          </button>
          <button
            onClick={() => setActiveSubTab('print_logs')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'print_logs'
                ? 'bg-[#22C55E] text-black font-bold shadow-sm'
                : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Print History Logs ({receiptPrints.length})</span>
          </button>
        </div>
      </div>

      {/* 10. REALTIME RECEIPT STATISTICS (Today's Sales, Count, Cash, POS, Transfer) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {/* Today's Sales */}
        <div className="col-span-2 sm:col-span-1 bg-[#111111] p-4 rounded-2xl border border-zinc-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Today's Sales
            </span>
            <div className="w-6 h-6 rounded-md bg-[#22C55E]/10 flex items-center justify-center text-[#22C55E]">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-lg font-extrabold text-white font-mono mt-2">
            {formatCurrency(stats.todaySalesTotal, currency)}
          </p>
          <span className="text-[10px] text-zinc-500 mt-0.5">Live updated</span>
        </div>

        {/* Number of Sales */}
        <div className="bg-[#111111] p-4 rounded-2xl border border-zinc-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Number of Sales
            </span>
            <div className="w-6 h-6 rounded-md bg-blue-500/10 flex items-center justify-center text-blue-400">
              <ReceiptIcon className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-lg font-extrabold text-white font-mono mt-2">
            {stats.todaySalesCount}
          </p>
          <span className="text-[10px] text-zinc-500 mt-0.5">Transactions today</span>
        </div>

        {/* Cash Sales */}
        <div className="bg-[#111111] p-4 rounded-2xl border border-zinc-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Cash Sales
            </span>
            <div className="w-6 h-6 rounded-md bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-base font-extrabold text-white font-mono mt-2 truncate">
            {formatCurrency(stats.cashTotal, currency)}
          </p>
          <span className="text-[10px] text-zinc-500 mt-0.5">Cash register</span>
        </div>

        {/* POS Sales */}
        <div className="bg-[#111111] p-4 rounded-2xl border border-zinc-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              POS Card
            </span>
            <div className="w-6 h-6 rounded-md bg-blue-500/10 flex items-center justify-center text-blue-400">
              <CreditCard className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-base font-extrabold text-white font-mono mt-2 truncate">
            {formatCurrency(stats.posTotal, currency)}
          </p>
          <span className="text-[10px] text-zinc-500 mt-0.5">Terminal charges</span>
        </div>

        {/* Transfer Sales */}
        <div className="bg-[#111111] p-4 rounded-2xl border border-zinc-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Bank Transfer
            </span>
            <div className="w-6 h-6 rounded-md bg-amber-500/10 flex items-center justify-center text-amber-400">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-base font-extrabold text-white font-mono mt-2 truncate">
            {formatCurrency(stats.transferTotal, currency)}
          </p>
          <span className="text-[10px] text-zinc-500 mt-0.5">Direct transfers</span>
        </div>
      </div>

      {activeSubTab === 'receipts' ? (
        <div className="space-y-4">
          {/* Search & Filter Controls */}
          <div className="bg-[#111111] p-4 rounded-2xl border border-zinc-800/80 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search receipts by number (MB-000001), cashier name, or drink..."
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-[#22C55E] text-white text-xs placeholder:text-zinc-500 outline-none transition-all"
                />
              </div>

              {/* Date Filter */}
              <div className="flex items-center gap-2">
                <select
                  value={dateFilter}
                  onChange={(e) => {
                    setDateFilter(e.target.value as any);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white outline-none focus:border-[#22C55E] cursor-pointer"
                >
                  <option value="today">Today's Receipts</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="week">Last 7 Days</option>
                  <option value="month">This Month</option>
                  <option value="all">All Historical Receipts</option>
                </select>

                {/* Payment Method Filter */}
                <select
                  value={paymentFilter}
                  onChange={(e) => {
                    setPaymentFilter(e.target.value as any);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white outline-none focus:border-[#22C55E] cursor-pointer"
                >
                  <option value="all">All Payment Methods</option>
                  <option value="cash">Cash</option>
                  <option value="pos">POS Terminal</option>
                  <option value="transfer">Bank Transfer</option>
                </select>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as any);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white outline-none focus:border-[#22C55E] cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="refunded">Refunded</option>
                </select>
              </div>
            </div>

            {/* Filter Summary */}
            <div className="flex items-center justify-between text-xs text-zinc-400 pt-1">
              <span>
                Displaying <strong className="text-white">{filteredSales.length}</strong> matching receipts
              </span>
              <span>
                Total Value:{' '}
                <strong className="text-[#22C55E] font-mono">
                  {formatCurrency(
                    filteredSales.reduce((acc, s) => acc + (Number(s.total) || 0), 0),
                    currency
                  )}
                </strong>
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-800/60">
              <label className="flex items-center gap-2 text-xs font-semibold text-zinc-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={paginatedSales.length > 0 && paginatedSales.every((sale) => selectedReceiptIds.includes(sale.id))}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedReceiptIds((prev) => Array.from(new Set([...prev, ...paginatedSales.map((sale) => sale.id)])));
                    } else {
                      const ids = new Set(paginatedSales.map((sale) => sale.id));
                      setSelectedReceiptIds((prev) => prev.filter((id) => !ids.has(id)));
                    }
                  }}
                  className="rounded border-zinc-700 text-[#22C55E] focus:ring-[#22C55E] bg-zinc-900 cursor-pointer"
                />
                <span>Select All</span>
              </label>
              {selectedReceiptIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <button onClick={() => setSelectedReceiptIds([])} className="px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-800 rounded-xl">Deselect All</button>
                  <button onClick={() => { setBulkDeleteError(null); setIsBulkReceiptDeleteModalOpen(true); }} className="px-3.5 py-1.5 text-xs font-bold text-red-200 bg-red-950/80 border border-red-800/80 rounded-xl flex items-center gap-1.5">
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Selected ({selectedReceiptIds.length})</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Receipts Content (Responsive Table on Desktop + Responsive Cards on Mobile) */}
          <div className="bg-[#111111] rounded-2xl border border-zinc-800/80 overflow-hidden">
            {filteredSales.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={ReceiptIcon}
                  title="No receipts found"
                  description="When sales are processed by workers, receipts will be listed here with instant PDF download capabilities."
                />
              </div>
            ) : (
              <div>
                {/* Desktop Table (Hidden on Mobile) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#141414] border-b border-zinc-800 text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-3.5 px-4">Receipt</th>
                        <th className="py-3.5 px-4">Date & Time</th>
                        <th className="py-3.5 px-4">Worker / Cashier</th>
                        <th className="py-3.5 px-4">Items</th>
                        <th className="py-3.5 px-4 text-right">Subtotal</th>
                        <th className="py-3.5 px-4 text-right">Total</th>
                        <th className="py-3.5 px-4">Payment</th>
                        <th className="py-3.5 px-4 text-center">Status</th>
                        <th className="py-3.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {paginatedSales.map((sale) => {
                        const isDownloading = downloadingId === sale.id;
                        const isReprint =
                          (downloadedSales[sale.id] || 0) > 0 ||
                          receiptPrints.some((p) => p.sale_id === sale.id);

                        return (
                          <tr key={sale.id} className="hover:bg-zinc-900/60 transition-colors group">
                            <td className="py-3.5 px-4 font-mono font-bold text-white whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="checkbox"
                                  checked={selectedReceiptIds.includes(sale.id)}
                                  onChange={() => setSelectedReceiptIds((prev) => prev.includes(sale.id) ? prev.filter((id) => id !== sale.id) : [...prev, sale.id])}
                                  className="rounded border-zinc-700 text-[#22C55E] focus:ring-[#22C55E] bg-zinc-900 cursor-pointer"
                                  aria-label={`Select receipt ${sale.receipt_number}`}
                                />
                                <span>{sale.receipt_number}</span>
                                {isReprint && (
                                  <span className="text-[9px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-sans">
                                    Reprint
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-zinc-400 whitespace-nowrap text-[11px]">
                              {formatDateTime(sale.created_at)}
                            </td>
                            <td className="py-3.5 px-4 font-medium text-zinc-200 whitespace-nowrap">
                              {formatWorkerDisplayName(sale.worker)}
                            </td>
                            <td className="py-3.5 px-4 text-zinc-400 max-w-[180px] truncate">
                              {sale.items && sale.items.length > 0
                                ? sale.items.map((it) => `${it.product_name} × ${it.quantity}`).join(', ')
                                : '1 item'}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono text-zinc-400">
                              {formatCurrency(sale.subtotal, currency)}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono font-bold text-white text-xs">
                              {formatCurrency(sale.total, currency)}
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <Badge
                                variant={
                                  sale.payment_method === 'cash'
                                    ? 'green'
                                    : sale.payment_method === 'pos'
                                    ? 'blue'
                                    : 'orange'
                                }
                                size="sm"
                              >
                                {sale.payment_method.toUpperCase()}
                              </Badge>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <Badge
                                variant={sale.status === 'completed' ? 'green' : 'red'}
                                size="sm"
                              >
                                {sale.status.toUpperCase()}
                              </Badge>
                            </td>
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => onOpenReceipt(sale)}
                                  className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors cursor-pointer"
                                  title="View Receipt Preview"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>VIEW</span>
                                </button>
                                <button
                                  onClick={() => onOpenReceipt(sale)}
                                  className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors cursor-pointer"
                                  title="Thermal / Print Receipt"
                                >
                                  <Printer className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>PRINT</span>
                                </button>
                                <button
                                  onClick={(e) => handleDirectDownload(sale, e)}
                                  disabled={isDownloading}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-black bg-[#22C55E] hover:bg-[#1ea750] rounded-lg transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                                  title="Download PDF Receipt"
                                >
                                  {isDownloading ? (
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Download className="w-3.5 h-3.5" />
                                  )}
                                  <span>{isDownloading ? 'SAVING...' : 'DOWNLOAD PDF'}</span>
                                </button>
                                <button
                                  onClick={() => promptDeleteReceipt(sale)}
                                  className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-lg border border-red-900/40 transition-colors cursor-pointer"
                                  title="Delete or Archive Receipt"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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

                {/* Mobile Cards (Visible on Mobile / Small screens) */}
                <div className="md:hidden divide-y divide-zinc-800/80">
                  {paginatedSales.map((sale) => {
                    const isDownloading = downloadingId === sale.id;
                    const isReprint =
                      (downloadedSales[sale.id] || 0) > 0 ||
                      receiptPrints.some((p) => p.sale_id === sale.id);

                    return (
                      <div key={sale.id} className="p-4 space-y-3">
                        {/* Top Line: Receipt No & Timestamp */}
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-1.5">
                                  <input
                                    type="checkbox"
                                    checked={selectedReceiptIds.includes(sale.id)}
                                    onChange={() => setSelectedReceiptIds((prev) => prev.includes(sale.id) ? prev.filter((id) => id !== sale.id) : [...prev, sale.id])}
                                    className="rounded border-zinc-700 text-[#22C55E] focus:ring-[#22C55E] bg-zinc-900 cursor-pointer"
                                    aria-label={`Select receipt ${sale.receipt_number}`}
                                  />
                              <span className="font-mono font-bold text-sm text-white">
                                {sale.receipt_number}
                              </span>
                              {isReprint && (
                                <span className="text-[9px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-sans">
                                  Reprint
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-zinc-400 mt-0.5">
                              {formatDateTime(sale.created_at)}
                            </p>
                          </div>
                          <Badge
                            variant={sale.status === 'completed' ? 'green' : 'red'}
                            size="sm"
                          >
                            {sale.status.toUpperCase()}
                          </Badge>
                        </div>

                        {/* Middle Details: Worker & Payment */}
                        <div className="grid grid-cols-2 gap-2 text-xs bg-zinc-900/60 p-3 rounded-xl border border-zinc-800/60">
                          <div>
                            <span className="text-[10px] text-zinc-500 uppercase font-bold">Worker / Cashier</span>
                            <p className="font-medium text-zinc-200 mt-0.5">
                              {formatWorkerDisplayName(sale.worker)}
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] text-zinc-500 uppercase font-bold">Payment Method</span>
                            <div className="mt-0.5">
                              <Badge
                                variant={
                                  sale.payment_method === 'cash'
                                    ? 'green'
                                    : sale.payment_method === 'pos'
                                    ? 'blue'
                                    : 'orange'
                                }
                                size="sm"
                              >
                                {sale.payment_method.toUpperCase()}
                              </Badge>
                            </div>
                          </div>

                          {/* Items Summary */}
                          <div className="col-span-2 pt-1 border-t border-zinc-800/60">
                            <span className="text-[10px] text-zinc-500 uppercase font-bold">Items</span>
                            <p className="text-zinc-300 text-xs mt-0.5">
                              {sale.items && sale.items.length > 0
                                ? sale.items.map((it) => `${it.product_name} × ${it.quantity}`).join(', ')
                                : 'Items summary'}
                            </p>
                          </div>

                          {/* Total */}
                          <div className="col-span-2 pt-1 flex justify-between items-baseline">
                            <span className="text-[11px] font-bold text-zinc-400">Total Amount:</span>
                            <span className="text-sm font-bold font-mono text-[#22C55E]">
                              {formatCurrency(sale.total, currency)}
                            </span>
                          </div>
                        </div>

                        {/* Mobile Actions: [VIEW] [PRINT] [DOWNLOAD PDF] [DELETE] */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                          <button
                            onClick={() => onOpenReceipt(sale)}
                            className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>VIEW</span>
                          </button>
                          <button
                            onClick={() => onOpenReceipt(sale)}
                            className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 transition-colors"
                          >
                            <Printer className="w-3.5 h-3.5 text-emerald-400" />
                            <span>PRINT</span>
                          </button>
                          <button
                            onClick={(e) => handleDirectDownload(sale, e)}
                            disabled={isDownloading}
                            className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-extrabold text-black bg-[#22C55E] hover:bg-[#1ea750] transition-all shadow-sm disabled:opacity-50"
                          >
                            {isDownloading ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Download className="w-3.5 h-3.5" />
                            )}
                            <span>{isDownloading ? 'SAVING...' : 'PDF'}</span>
                          </button>
                          <button
                            onClick={() => promptDeleteReceipt(sale)}
                            className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold text-red-400 hover:text-red-300 bg-red-950/40 hover:bg-red-900/60 border border-red-900/50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>DELETE</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3.5 border-t border-zinc-800 bg-[#141414] text-xs">
                <span className="text-zinc-400">
                  Page <strong className="text-white">{currentPage}</strong> of{' '}
                  <strong className="text-white">{totalPages}</strong> (
                  {filteredSales.length} total receipts)
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Print History Logs Sub-tab */
        <div className="bg-[#111111] rounded-2xl border border-zinc-800/80 overflow-hidden">
          <div className="p-4 border-b border-zinc-800 bg-[#141414]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
              Reprint & Thermal Print Event Audit Trail
            </h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Every PDF download or thermal receipt print action is logged immutably for loss prevention and fraud auditing.
            </p>
            <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
              <label className="flex items-center gap-2 text-xs font-semibold text-zinc-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={visiblePrintLogs.length > 0 && visiblePrintLogs.every((log) => selectedPrintLogIds.includes(log.id))}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedPrintLogIds((prev) => Array.from(new Set([...prev, ...visiblePrintLogs.map((log) => log.id)])));
                    } else {
                      const ids = new Set(visiblePrintLogs.map((log) => log.id));
                      setSelectedPrintLogIds((prev) => prev.filter((id) => !ids.has(id)));
                    }
                  }}
                  className="rounded border-zinc-700 text-[#22C55E] focus:ring-[#22C55E] bg-zinc-900 cursor-pointer"
                />
                <span>Select All</span>
              </label>
              {selectedPrintLogIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <button onClick={() => setSelectedPrintLogIds([])} className="px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-800 rounded-xl">Deselect All</button>
                  <button onClick={() => { setBulkDeleteError(null); setIsBulkPrintLogDeleteModalOpen(true); }} className="px-3.5 py-1.5 text-xs font-bold text-red-200 bg-red-950/80 border border-red-800/80 rounded-xl flex items-center gap-1.5">
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Selected ({selectedPrintLogIds.length})</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {visiblePrintLogs.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={History}
                title="No print events recorded yet"
                description="When receipts are downloaded or sent to the thermal printer, the audit trail will appear here."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#141414] border-b border-zinc-800 text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3.5 px-4">Print Timestamp</th>
                    <th className="py-3.5 px-4">Sale / Receipt ID</th>
                    <th className="py-3.5 px-4">Printed By (User ID)</th>
                    <th className="py-3.5 px-4 text-center">Audit Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {visiblePrintLogs.map((p) => (
                    <tr key={p.id} className="hover:bg-zinc-900/60 transition-colors">
                      <td className="py-3.5 px-4 text-zinc-300 font-mono whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedPrintLogIds.includes(p.id)}
                          onChange={() => setSelectedPrintLogIds((prev) => prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id])}
                          className="mr-2 rounded border-zinc-700 text-[#22C55E] focus:ring-[#22C55E] bg-zinc-900 cursor-pointer"
                          aria-label={`Select print record ${p.id}`}
                        />
                        {formatDateTime(p.printed_at)}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-white">
                        {p.sale_id}
                      </td>
                      <td className="py-3.5 px-4 text-zinc-400 font-mono text-[11px]">
                        {p.worker_id}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <Badge variant="green" size="sm">
                          LOGGED OK
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const sale = sales.find((item) => item.id === p.sale_id);
                              if (sale) onOpenReceipt(sale);
                            }}
                            disabled={!sales.some((item) => item.id === p.sale_id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-lg border border-zinc-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Preview printed receipt"
                          >
                            <Eye className="w-3 h-3" />
                            <span>PREVIEW</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const sale = sales.find((item) => item.id === p.sale_id);
                              if (sale) onOpenReceipt(sale);
                            }}
                            disabled={!sales.some((item) => item.id === p.sale_id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40 rounded-lg border border-emerald-900/40 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Print receipt"
                          >
                            <Printer className="w-3 h-3" />
                            <span>PRINT</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => promptDeletePrintLog(p)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-lg border border-red-900/40 transition-colors cursor-pointer"
                            title="Delete Print Log Record"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>DELETE</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Delete Receipt Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isDeleteReceiptModalOpen}
        onClose={() => {
          setIsDeleteReceiptModalOpen(false);
          setReceiptToDelete(null);
          setReceiptDeleteError(null);
        }}
        onConfirm={handleConfirmDeleteReceipt}
        title="Delete Receipt?"
        subtitle="Receipt Catalog Archive & Removal"
        description="Are you sure you want to remove this receipt?"
        itemName={receiptToDelete?.receipt_number}
        itemType="Receipt"
        itemDetails={
          receiptToDelete
            ? [
                { label: 'Receipt', value: receiptToDelete.receipt_number },
                { label: 'Worker', value: formatWorkerDisplayName(receiptToDelete.worker) },
                { label: 'Total', value: formatCurrency(receiptToDelete.total, currency) },
                { label: 'Payment', value: receiptToDelete.payment_method.toUpperCase() },
                { label: 'Date', value: formatDate(receiptToDelete.created_at) },
              ]
            : []
        }
        warningNotice="This will permanently delete this transaction and receipt record from the database. This action is irreversible."
        confirmLabel="DELETE"
        confirmVariant="danger"
        requiresConfirmationText={false}
        loading={isDeletingReceipt}
        error={receiptDeleteError}
      />

      {/* Delete Print History Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isDeletePrintLogModalOpen}
        onClose={() => {
          setIsDeletePrintLogModalOpen(false);
          setPrintLogToDelete(null);
          setPrintLogDeleteError(null);
        }}
        onConfirm={handleConfirmDeletePrintLog}
        title="Delete Print History Record?"
        subtitle="Remove print log from audit trail"
        description="Are you sure you want to remove this print log entry?"
        itemName={printLogToDelete?.sale_id}
        itemType="Print History Record"
        itemDetails={
          printLogToDelete
            ? [
                { label: 'Print ID', value: printLogToDelete.id },
                { label: 'Sale ID', value: printLogToDelete.sale_id },
                { label: 'Printed At', value: formatDateTime(printLogToDelete.printed_at) },
              ]
            : []
        }
        warningNotice="Deleting this print log only removes the log entry. The sale, receipt, shift, and financial records remain intact."
        confirmLabel="DELETE"
        confirmVariant="danger"
        requiresConfirmationText={false}
        loading={isDeletingPrintLog}
        error={printLogDeleteError}
      />

      <DeleteConfirmModal
        isOpen={isBulkReceiptDeleteModalOpen}
        onClose={() => {
          if (isBulkDeleting) return;
          setIsBulkReceiptDeleteModalOpen(false);
          setBulkDeleteError(null);
        }}
        onConfirm={handleConfirmBulkDeleteReceipts}
        title="Delete selected receipts?"
        description="Are you sure you want to delete the selected receipts?"
        itemName={`${selectedReceiptIds.length} receipts`}
        itemType="Selected Receipts"
        warningNotice="This action will permanently remove the selected receipts and cannot be undone."
        confirmLabel="DELETE"
        confirmVariant="danger"
        loading={isBulkDeleting}
        error={bulkDeleteError}
      />

      <DeleteConfirmModal
        isOpen={isBulkPrintLogDeleteModalOpen}
        onClose={() => {
          if (isBulkDeleting) return;
          setIsBulkPrintLogDeleteModalOpen(false);
          setBulkDeleteError(null);
        }}
        onConfirm={handleConfirmBulkDeletePrintLogs}
        title="Delete selected print history logs?"
        description="Are you sure you want to delete the selected print history logs?"
        itemName={`${selectedPrintLogIds.length} print history logs`}
        itemType="Selected Print History Logs"
        warningNotice="This action will permanently remove the selected print history logs and cannot be undone."
        confirmLabel="DELETE"
        confirmVariant="danger"
        loading={isBulkDeleting}
        error={bulkDeleteError}
      />
    </div>
  );
};
