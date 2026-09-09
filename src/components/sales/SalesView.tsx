import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Filter,
  Receipt,
  Calendar,
  User,
  CreditCard,
  CheckCircle2,
  XCircle,
  Eye,
  Printer,
  FileText,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  ArrowUpRight,
  DollarSign,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import type { SaleWithDetails, Profile, BusinessSettings, PaymentMethod, SaleStatus } from '../../types';
import { formatWorkerDisplayName } from '../../types';
import { formatCurrency, formatDateTime, formatDate, formatTime } from '../../utils/formatters';
import { generateAndDownloadReceiptPDF } from '../../utils/pdfReceiptGenerator';
import { Badge } from '../common/Badge';
import { EmptyState } from '../common/EmptyState';
import { Modal } from '../common/Modal';
import { DeleteConfirmModal } from '../common/DeleteConfirmModal';
import { deleteSale } from '../../services/deleteManagementService';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface SalesViewProps {
  sales: SaleWithDetails[];
  workers: Profile[];
  settings: BusinessSettings | null;
  onOpenReceipt: (sale: SaleWithDetails) => void;
  onRefresh?: () => void;
  loading: boolean;
}

export const SalesView: React.FC<SalesViewProps> = ({
  sales,
  workers,
  settings,
  onOpenReceipt,
  onRefresh,
  loading,
}) => {
  const { user, profile, isAdminOrManager } = useAuth();
  const currency = settings?.currency || 'NGN';

  // Filters State
  const [search, setSearch] = useState('');
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month'>('today');
  const [workerFilter, setWorkerFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Selected Sale for Details Modal
  const [selectedSale, setSelectedSale] = useState<SaleWithDetails | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Delete Sale Modal State
  const [saleToDelete, setSaleToDelete] = useState<SaleWithDetails | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeletingSale, setIsDeletingSale] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [restoreStockOnDelete, setRestoreStockOnDelete] = useState(true);
  const [deletedSaleIds, setDeletedSaleIds] = useState<Set<string>>(new Set());
  const [selectedSaleIds, setSelectedSaleIds] = useState<string[]>([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);

  const handleDeleteSale = (saleId: string) => {
    const target = sales.find((s) => s.id === saleId);
    if (!target) return;
    setSaleToDelete(target);
    setDeleteError(null);
    setRestoreStockOnDelete(true);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDeleteSale = async () => {
    if (!saleToDelete) return;
    const targetSaleId = saleToDelete.id;
    const targetReceiptNumber = saleToDelete.receipt_number;

    try {
      setIsDeletingSale(true);
      setDeleteError(null);

      const result = await deleteSale(
        targetSaleId,
        targetReceiptNumber,
        profile
          ? { id: profile.id, fullName: profile.full_name }
          : (user ? { id: user.id, fullName: user.email } : undefined),
        restoreStockOnDelete
      );

      if (!result.success) {
        const error = result.rawError || {
          message: result.error || result.message,
          details: result.details,
          hint: result.hint,
          code: result.code,
        };

        console.error("DELETE SALE ERROR:", error);
        console.error("ERROR MESSAGE:", error?.message);
        console.error("ERROR DETAILS:", error?.details);
        console.error("ERROR HINT:", error?.hint);
        console.error("ERROR CODE:", error?.code);

        const fullErrorMessage = error?.message
          ? `${error.message}${error.details ? ` (${error.details})` : ''}${error.hint ? ` - Hint: ${error.hint}` : ''}${error.code ? ` [Code: ${error.code}]` : ''}`
          : (result.error || result.message || 'Failed to delete sale.');

        setDeleteError(fullErrorMessage);
        return;
      }

      // 1. Remove deleted sale from displayed transactions immediately
      setDeletedSaleIds((prev) => new Set(prev).add(targetSaleId));

      // 2. Show success toast notification
      setToastMsg({ text: 'Sale deleted successfully.', type: 'success' });
      setTimeout(() => setToastMsg(null), 3500);

      // 3. Close confirmation modal
      setIsDeleteModalOpen(false);
      setSaleToDelete(null);
      if (selectedSale?.id === targetSaleId) {
        setSelectedSale(null);
      }

      // 4. Refresh/re-fetch sales data using existing data-fetching logic
      if (onRefresh) {
        onRefresh();
      }
    } catch (err: unknown) {
      const error = err as any;
      console.error("DELETE SALE ERROR:", error);
      console.error("ERROR MESSAGE:", error?.message);
      console.error("ERROR DETAILS:", error?.details);
      console.error("ERROR HINT:", error?.hint);
      console.error("ERROR CODE:", error?.code);

      const fullErrorMessage = error?.message
        ? `${error.message}${error.details ? ` (${error.details})` : ''}${error.hint ? ` - Hint: ${error.hint}` : ''}${error.code ? ` [Code: ${error.code}]` : ''}`
        : (error ? String(error) : 'Failed to delete sale.');

      setDeleteError(fullErrorMessage);
    } finally {
      setIsDeletingSale(false);
    }
  };

  // Active sales excluding locally deleted transactions
  const activeSales = useMemo(() => {
    return sales.filter((s) => !deletedSaleIds.has(s.id));
  }, [sales, deletedSaleIds]);

  // Filter Logic
  const filteredSales = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
    const startOfWeek = startOfToday - now.getDay() * 24 * 60 * 60 * 1000;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    return activeSales.filter((s) => {
      const saleTime = new Date(s.created_at).getTime();

      // Time Range Filter
      if (timeFilter === 'today' && saleTime < startOfToday) return false;
      if (timeFilter === 'yesterday' && (saleTime < startOfYesterday || saleTime >= startOfToday)) return false;
      if (timeFilter === 'week' && saleTime < startOfWeek) return false;
      if (timeFilter === 'month' && saleTime < startOfMonth) return false;

      // Worker Filter
      if (workerFilter !== 'all' && s.worker_id !== workerFilter) return false;

      // Payment Filter
      if (paymentFilter !== 'all' && s.payment_method !== paymentFilter) return false;

      // Status Filter
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;

      // Search (receipt number, worker name, or product item)
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesReceipt = s.receipt_number.toLowerCase().includes(q);
        const matchesWorker = s.worker?.full_name?.toLowerCase().includes(q);
        const matchesItems = s.items?.some((it) => it.product_name.toLowerCase().includes(q));
        if (!matchesReceipt && !matchesWorker && !matchesItems) return false;
      }

      return true;
    });
  }, [activeSales, search, timeFilter, workerFilter, paymentFilter, statusFilter]);

  // Aggregates of filtered set
  const totalAmount = filteredSales.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
  const totalCount = filteredSales.length;

  // Pagination
  const totalPages = Math.ceil(filteredSales.length / pageSize) || 1;
  const paginatedSales = filteredSales.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setSelectedSaleIds([]);
  }, [search, timeFilter, workerFilter, paymentFilter, statusFilter, currentPage]);

  const handleConfirmBulkDeleteSales = async () => {
    const selectedSales = paginatedSales.filter((sale) => selectedSaleIds.includes(sale.id));
    if (selectedSales.length === 0) return;

    try {
      setIsBulkDeleting(true);
      setBulkDeleteError(null);
      const successfulIds: string[] = [];

      for (const sale of selectedSales) {
        const result = await deleteSale(
          sale.id,
          sale.receipt_number,
          profile
            ? { id: profile.id, fullName: profile.full_name }
            : (user ? { id: user.id, fullName: user.email } : undefined),
          true
        );

        if (result.success) {
          successfulIds.push(sale.id);
        } else {
          setBulkDeleteError('Failed to delete selected sales. Please try again.');
        }
      }

      if (successfulIds.length > 0) {
        setDeletedSaleIds((prev) => new Set([...prev, ...successfulIds]));
        setSelectedSaleIds((prev) => prev.filter((id) => !successfulIds.includes(id)));
        onRefresh?.();
      }

      if (successfulIds.length === selectedSales.length) {
        setIsBulkDeleteModalOpen(false);
        setSelectedSaleIds([]);
      }
    } catch {
      setBulkDeleteError('Failed to delete selected sales. Please try again.');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleDownloadPDF = async (sale: SaleWithDetails, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      setDownloadingId(sale.id);
      const res = await generateAndDownloadReceiptPDF({
        sale,
        settings,
        isReprint: false,
      });

      if (user?.id) {
        try {
          await supabase.from('receipt_prints').insert({
            sale_id: sale.id,
            worker_id: user.id,
            printed_at: new Date().toISOString(),
          });
          onRefresh?.();
        } catch (err) {
          console.warn('Notice logging receipt print:', err);
        }
      }

      setToastMsg({ text: `Downloaded ${res.filename}`, type: 'success' });
      setTimeout(() => setToastMsg(null), 3500);
    } catch (err) {
      console.error('PDF error:', err);
      setToastMsg({ text: 'Unable to generate receipt PDF.', type: 'error' });
      setTimeout(() => setToastMsg(null), 4000);
    } finally {
      setDownloadingId(null);
    }
  };

  const exportCSV = () => {
    const headers = ['Receipt No', 'Date', 'Worker', 'Payment Method', 'Subtotal', 'Discount', 'Total', 'Status'];
    const rows = filteredSales.map((s) => [
      s.receipt_number,
      s.created_at,
      s.worker?.full_name || 'Staff',
      s.payment_method,
      s.subtotal,
      s.discount,
      s.total,
      s.status,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `munaj_bar_sales_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
            <AlertCircle className="w-4 h-4 text-red-400" />
          )}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Top Filter Bar */}
      <div className="bg-[#111111] p-5 rounded-2xl border border-zinc-800/80 space-y-4">
        {/* Search & Quick Action */}
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by receipt (e.g. MB-000001), worker, or drink..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-[#22C55E] focus:ring-1 focus:ring-[#22C55E] text-white text-xs placeholder:text-zinc-500 outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={exportCSV}
              disabled={filteredSales.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors disabled:opacity-40 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Filter Dropdowns */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-zinc-800/60">
          {/* Time Range */}
          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
              Time Range
            </label>
            <select
              value={timeFilter}
              onChange={(e) => {
                setTimeFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white outline-none focus:border-[#22C55E] cursor-pointer"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="all">All Time</option>
            </select>
          </div>

          {/* Worker Filter */}
          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
              Worker / Cashier
            </label>
            <select
              value={workerFilter}
              onChange={(e) => {
                setWorkerFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white outline-none focus:border-[#22C55E] cursor-pointer"
            >
              <option value="all">All Workers</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
              Payment Method
            </label>
            <select
              value={paymentFilter}
              onChange={(e) => {
                setPaymentFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white outline-none focus:border-[#22C55E] cursor-pointer"
            >
              <option value="all">All Methods</option>
              <option value="cash">Cash</option>
              <option value="pos">POS Terminal</option>
              <option value="transfer">Bank Transfer</option>
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white outline-none focus:border-[#22C55E] cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Filter Summary Pill */}
        <div className="flex items-center justify-between text-xs text-zinc-400 pt-2">
          <span>
            Found <strong className="text-white">{totalCount}</strong> transactions
          </span>
          <span>
            Total Volume:{' '}
            <strong className="text-[#22C55E] font-mono text-sm">
              {formatCurrency(totalAmount, currency)}
            </strong>
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-800/60">
          <span className="text-xs text-zinc-500">Select transactions from the table below</span>

          {selectedSaleIds.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedSaleIds([])}
                className="px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-800 rounded-xl"
              >
                Deselect All
              </button>
              <button
                onClick={() => {
                  setBulkDeleteError(null);
                  setIsBulkDeleteModalOpen(true);
                }}
                className="px-3.5 py-1.5 text-xs font-bold text-red-200 bg-red-950/80 border border-red-800/80 rounded-xl flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Selected ({selectedSaleIds.length})</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sales Table & Mobile Cards */}
      <div className="bg-[#111111] rounded-2xl border border-zinc-800/80 overflow-hidden">
        {paginatedSales.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={Receipt}
              title="No sales match current filters"
              description="Try adjusting your time range, search query, or payment method filters."
            />
          </div>
        ) : (
          <div>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#141414] border-b border-zinc-800 text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3.5 px-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={paginatedSales.length > 0 && paginatedSales.every((sale) => selectedSaleIds.includes(sale.id))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSaleIds((prev) => Array.from(new Set([...prev, ...paginatedSales.map((sale) => sale.id)])));
                            } else {
                              const ids = new Set(paginatedSales.map((sale) => sale.id));
                              setSelectedSaleIds((prev) => prev.filter((id) => !ids.has(id)));
                            }
                          }}
                          className="rounded border-zinc-700 text-[#22C55E] focus:ring-[#22C55E] bg-zinc-900 cursor-pointer"
                        />
                        <span>Receipt</span>
                      </label>
                    </th>
                    <th className="py-3.5 px-4">Worker</th>
                    <th className="py-3.5 px-4">Items Summary</th>
                    <th className="py-3.5 px-4">Payment</th>
                    <th className="py-3.5 px-4">Date & Time</th>
                    <th className="py-3.5 px-4 text-right">Total Amount</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {paginatedSales.map((sale) => {
                    const isDownloading = downloadingId === sale.id;

                    return (
                      <tr
                        key={sale.id}
                        className="hover:bg-zinc-900/60 transition-colors group cursor-pointer"
                        onClick={() => setSelectedSale(sale)}
                      >
                        <td className="py-3.5 px-4 font-mono font-bold text-white whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedSaleIds.includes(sale.id)}
                              onChange={() => setSelectedSaleIds((prev) => prev.includes(sale.id) ? prev.filter((id) => id !== sale.id) : [...prev, sale.id])}
                              onClick={(e) => e.stopPropagation()}
                              className="rounded border-zinc-700 text-[#22C55E] focus:ring-[#22C55E] bg-zinc-900 cursor-pointer"
                              aria-label={`Select sale ${sale.receipt_number}`}
                            />
                            <span>{sale.receipt_number}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-zinc-200 whitespace-nowrap">
                          {formatWorkerDisplayName(sale.worker)}
                        </td>
                        <td className="py-3.5 px-4 text-zinc-400 max-w-xs truncate">
                          {sale.items && sale.items.length > 0
                            ? sale.items.map((it) => `${it.product_name} (x${it.quantity})`).join(', ')
                            : 'Sale items'}
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
                        <td className="py-3.5 px-4 text-zinc-400 whitespace-nowrap text-[11px]">
                          {formatDateTime(sale.created_at)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-white text-xs">
                          {formatCurrency(sale.total, currency)}
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
                          <div
                            className="flex items-center justify-end gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => setSelectedSale(sale)}
                              title="View Sale Details"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>VIEW</span>
                            </button>
                            <button
                              onClick={(e) => handleDownloadPDF(sale, e)}
                              disabled={isDownloading}
                              title="Download PDF Receipt"
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-black bg-[#22C55E] hover:bg-[#1ea750] rounded-lg transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                            >
                              {isDownloading ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Download className="w-3.5 h-3.5" />
                              )}
                              <span>{isDownloading ? 'SAVING...' : 'PDF'}</span>
                            </button>
                            <button
                              onClick={() => handleDeleteSale(sale.id)}
                              disabled={isDeletingSale && saleToDelete?.id === sale.id}
                              title="Delete Sale"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-red-400 hover:text-white bg-red-950/40 hover:bg-red-900/60 border border-red-900/50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {isDeletingSale && saleToDelete?.id === sale.id ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                              <span>{isDeletingSale && saleToDelete?.id === sale.id ? 'Deleting...' : 'DELETE'}</span>
                            </button>
                            <button
                              onClick={() => onOpenReceipt(sale)}
                              title="Open Thermal Print Dialog"
                              className="p-1.5 text-zinc-400 hover:text-[#22C55E] rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards (Visible on Mobile) */}
            <div className="md:hidden divide-y divide-zinc-800/80">
              {paginatedSales.map((sale) => {
                const isDownloading = downloadingId === sale.id;

                return (
                  <div key={sale.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={selectedSaleIds.includes(sale.id)}
                                onChange={() => setSelectedSaleIds((prev) => prev.includes(sale.id) ? prev.filter((id) => id !== sale.id) : [...prev, sale.id])}
                                className="rounded border-zinc-700 text-[#22C55E] focus:ring-[#22C55E] bg-zinc-900 cursor-pointer"
                                aria-label={`Select sale ${sale.receipt_number}`}
                              />
                              <span className="font-mono font-bold text-sm text-white">
                                {sale.receipt_number}
                              </span>
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

                    <div className="grid grid-cols-2 gap-2 text-xs bg-zinc-900/60 p-3 rounded-xl border border-zinc-800/60">
                      <div>
                        <span className="text-[10px] text-zinc-500 uppercase font-bold">Worker</span>
                        <p className="font-medium text-zinc-200 mt-0.5">
                          {formatWorkerDisplayName(sale.worker)}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-500 uppercase font-bold">Payment</span>
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
                      <div className="col-span-2 pt-1 border-t border-zinc-800/60 flex justify-between items-baseline">
                        <span className="text-[11px] font-bold text-zinc-400">Total:</span>
                        <span className="text-sm font-bold font-mono text-[#22C55E]">
                          {formatCurrency(sale.total, currency)}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <button
                        onClick={() => setSelectedSale(sale)}
                        className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 transition-colors cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                        <span>VIEW</span>
                      </button>
                      <button
                        onClick={(e) => handleDownloadPDF(sale, e)}
                        disabled={isDownloading}
                        className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-extrabold text-black bg-[#22C55E] hover:bg-[#1ea750] transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                      >
                        {isDownloading ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                        <span>{isDownloading ? 'SAVING...' : 'PDF'}</span>
                      </button>
                      <button
                        onClick={() => handleDeleteSale(sale.id)}
                        disabled={isDeletingSale && saleToDelete?.id === sale.id}
                        className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold text-red-400 hover:text-white bg-red-950/40 hover:bg-red-900/60 border border-red-900/50 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {isDeletingSale && saleToDelete?.id === sale.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        <span>{isDeletingSale && saleToDelete?.id === sale.id ? 'Deleting...' : 'DELETE'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pagination Footbar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-zinc-800 bg-[#141414] text-xs">
            <span className="text-zinc-400">
              Page <strong className="text-white">{currentPage}</strong> of{' '}
              <strong className="text-white">{totalPages}</strong> ({filteredSales.length} sales)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sale Details Modal */}
      {selectedSale && (
        <Modal
          isOpen={!!selectedSale}
          onClose={() => setSelectedSale(null)}
          title={`Sale Details — ${selectedSale.receipt_number}`}
          subtitle={`Processed on ${formatDate(selectedSale.created_at)} at ${formatTime(selectedSale.created_at)}`}
          maxWidth="lg"
        >
          <div className="space-y-5">
            {/* Meta Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#181818] p-4 rounded-xl border border-zinc-800 text-xs">
              <div>
                <span className="text-[10px] text-zinc-500 uppercase font-bold">Worker / Cashier</span>
                <p className="font-semibold text-white mt-0.5">{formatWorkerDisplayName(selectedSale.worker)}</p>
              </div>
              <div>
                <span className="text-[10px] text-zinc-500 uppercase font-bold">Payment</span>
                <div className="mt-0.5">
                  <Badge variant={selectedSale.payment_method === 'cash' ? 'green' : 'blue'}>
                    {selectedSale.payment_method.toUpperCase()}
                  </Badge>
                </div>
              </div>
              <div>
                <span className="text-[10px] text-zinc-500 uppercase font-bold">Status</span>
                <div className="mt-0.5">
                  <Badge variant={selectedSale.status === 'completed' ? 'green' : 'red'}>
                    {selectedSale.status.toUpperCase()}
                  </Badge>
                </div>
              </div>
              <div>
                <span className="text-[10px] text-zinc-500 uppercase font-bold">Shift ID</span>
                <p className="font-mono text-zinc-400 mt-0.5 truncate">
                  {selectedSale.shift_id ? `${selectedSale.shift_id.slice(0, 8)}...` : 'N/A'}
                </p>
              </div>
            </div>

            {/* Items Table */}
            <div>
              <h4 className="text-xs font-bold text-zinc-300 mb-2">Purchased Products</h4>
              <div className="rounded-xl border border-zinc-800 overflow-hidden bg-[#141414]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0f0f0f] text-zinc-400 font-bold uppercase text-[10px] border-b border-zinc-800">
                    <tr>
                      <th className="py-2.5 px-3">Product</th>
                      <th className="py-2.5 px-3 text-center">Qty</th>
                      <th className="py-2.5 px-3 text-right">Unit Price</th>
                      <th className="py-2.5 px-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {(selectedSale.items || []).map((item) => (
                      <tr key={item.id}>
                        <td className="py-2.5 px-3 font-medium text-white">{item.product_name}</td>
                        <td className="py-2.5 px-3 text-center font-mono">x{item.quantity}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-zinc-300">
                          {formatCurrency(item.unit_price, currency)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                          {formatCurrency(item.total, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Totals */}
            <div className="bg-[#181818] p-4 rounded-xl border border-zinc-800 space-y-1.5 text-xs">
              <div className="flex justify-between text-zinc-400">
                <span>Subtotal:</span>
                <span className="font-mono text-white">{formatCurrency(selectedSale.subtotal, currency)}</span>
              </div>
              {selectedSale.discount > 0 && (
                <div className="flex justify-between text-red-400">
                  <span>Discount:</span>
                  <span className="font-mono">-{formatCurrency(selectedSale.discount, currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-zinc-800">
                <span>Grand Total:</span>
                <span className="font-mono text-[#22C55E] text-base">
                  {formatCurrency(selectedSale.total, currency)}
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedSale(null)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-800 rounded-xl"
                >
                  Close
                </button>
                {isAdminOrManager && (
                  <button
                    type="button"
                    onClick={() => {
                      const s = selectedSale;
                      setSelectedSale(null);
                      handleDeleteSale(s.id);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-red-400 hover:text-red-300 bg-red-950/30 hover:bg-red-950/60 border border-red-900/40 rounded-xl transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Sale</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const s = selectedSale;
                    setSelectedSale(null);
                    handleDownloadPDF(s);
                  }}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-black bg-[#22C55E] hover:bg-[#1ea750] rounded-xl transition-all shadow-md cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const s = selectedSale;
                    setSelectedSale(null);
                    onOpenReceipt(s);
                  }}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Thermal Print</span>
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Sale Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSaleToDelete(null);
          setDeleteError(null);
        }}
        onConfirm={handleConfirmDeleteSale}
        title="Delete Sale?"
        subtitle="This action cannot be undone."
        description={
          <div>
            <p className="text-zinc-300">
              Are you sure you want to permanently delete receipt <strong className="text-white font-mono">{saleToDelete?.receipt_number}</strong>?
            </p>
            <p className="text-zinc-400 mt-2 text-xs">
              This action cannot be undone.
            </p>
            <label className="flex items-center gap-2 mt-4 text-xs text-zinc-300 bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-800 cursor-pointer">
              <input
                type="checkbox"
                checked={restoreStockOnDelete}
                onChange={(e) => setRestoreStockOnDelete(e.target.checked)}
                className="rounded border-zinc-700 text-[#22C55E] focus:ring-[#22C55E] bg-zinc-950"
              />
              <span>Restore product quantities to inventory upon deletion</span>
            </label>
          </div>
        }
        itemName={saleToDelete?.receipt_number}
        itemType="Sale Transaction"
        itemDetails={
          saleToDelete
            ? [
                { label: 'Receipt #', value: saleToDelete.receipt_number },
                { label: 'Worker', value: formatWorkerDisplayName(saleToDelete.worker) },
                { label: 'Total', value: formatCurrency(saleToDelete.total, currency) },
                { label: 'Payment', value: saleToDelete.payment_method.toUpperCase() },
                { label: 'Date', value: formatDateTime(saleToDelete.created_at) },
              ]
            : []
        }
        warningNotice="This action cannot be undone."
        confirmLabel="Delete Sale"
        confirmVariant="danger"
        requiresConfirmationText={false}
        loading={isDeletingSale}
        error={deleteError}
      />

      <DeleteConfirmModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => {
          if (isBulkDeleting) return;
          setIsBulkDeleteModalOpen(false);
          setBulkDeleteError(null);
        }}
        onConfirm={handleConfirmBulkDeleteSales}
        title="Delete selected sales?"
        description="Are you sure you want to delete the selected sales?"
        itemName={`${selectedSaleIds.length} sales`}
        itemType="Selected Sales"
        warningNotice="This action will permanently remove the selected sales and cannot be undone."
        confirmLabel="DELETE"
        confirmVariant="danger"
        loading={isBulkDeleting}
        error={bulkDeleteError}
      />
    </div>
  );
};
