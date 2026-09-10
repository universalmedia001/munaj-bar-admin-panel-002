import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Search,
  Filter,
  Download,
  Printer,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Clock,
  User,
  Calendar,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  Trash2,
  Plus,
} from 'lucide-react';
import type {
  StaffSubmittedReport,
  SaleWithDetails,
  Profile,
  BusinessSettings,
  StaffReportPeriod,
} from '../../types';
import { formatCurrency, formatDate, formatTime } from '../../utils/formatters';
import { verifySubmittedReportAgainstDatabase, markReportAsViewed } from '../../services/staffReportService';
import { generateAndDownloadSubmittedReportPDF } from '../../utils/submittedReportPdfGenerator';
import { deleteSubmittedReport } from '../../services/staffReportService';
import { DeleteConfirmModal } from '../common/DeleteConfirmModal';
import { CreateStaffReportModal } from './CreateStaffReportModal';

interface StaffSubmittedReportsSectionProps {
  reports: StaffSubmittedReport[];
  sales: SaleWithDetails[];
  workers: Profile[];
  settings: BusinessSettings | null;
  onViewReport: (report: StaffSubmittedReport) => void;
  onReportDeleted: (reportId: string) => void;
  onRefresh?: () => void;
}

export const StaffSubmittedReportsSection: React.FC<StaffSubmittedReportsSectionProps> = ({
  reports,
  sales,
  workers,
  settings,
  onViewReport,
  onReportDeleted,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [reportToDelete, setReportToDelete] = useState<StaffSubmittedReport | null>(null);
  const [isDeletingReport, setIsDeletingReport] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const currency = settings?.currency || 'NGN';

  // Filtered reports
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = r.worker_name.toLowerCase().includes(q);
        const matchesPeriod = r.period_label.toLowerCase().includes(q);
        const matchesId = r.id.toLowerCase().includes(q);
        if (!matchesName && !matchesPeriod && !matchesId) return false;
      }

      // Worker filter
      if (selectedWorkerId !== 'all' && r.worker_id !== selectedWorkerId) {
        return false;
      }

      // Period filter
      if (selectedPeriod !== 'all' && r.period !== selectedPeriod) {
        return false;
      }

      // Status filter
      if (selectedStatus !== 'all') {
        if (selectedStatus === 'SUBMITTED' && r.status !== 'SUBMITTED') return false;
        if (selectedStatus === 'VIEWED' && r.status !== 'VIEWED') return false;
      }

      return true;
    });
  }, [reports, searchQuery, selectedWorkerId, selectedPeriod, selectedStatus]);

  // Overall totals from filtered reports
  const totalReportedSales = useMemo(() => {
    return filteredReports.reduce((sum, r) => sum + Number(r.sales_total || 0), 0);
  }, [filteredReports]);

  const totalReportedOrders = useMemo(() => {
    return filteredReports.reduce((sum, r) => sum + Number(r.transactions_count || 0), 0);
  }, [filteredReports]);

  const unviewedCount = useMemo(() => {
    return reports.filter((r) => r.status === 'SUBMITTED').length;
  }, [reports]);

  const handleDownloadPdf = async (e: React.MouseEvent, report: StaffSubmittedReport) => {
    e.stopPropagation();
    try {
      setDownloadingId(report.id);
      const verification = verifySubmittedReportAgainstDatabase(report, sales);
      await generateAndDownloadSubmittedReportPDF({
        report,
        verification,
        settings,
      });
    } catch (err) {
      console.error('Failed to download PDF:', err);
    } finally {
      setDownloadingId(null);
    }
  };

  const handlePrint = (e: React.MouseEvent, report: StaffSubmittedReport) => {
    e.stopPropagation();
    onViewReport(report);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  const handleConfirmDelete = async () => {
    if (!reportToDelete) return;
    try {
      setIsDeletingReport(true);
      setDeleteError(null);
      const result = await deleteSubmittedReport(reportToDelete.id);
      if (!result.success) {
        setDeleteError(result.message || 'Failed to delete report. Please try again.');
        return;
      }
      onReportDeleted(reportToDelete.id);
      setSelectedReportIds((prev) => prev.filter((id) => id !== reportToDelete.id));
      setReportToDelete(null);
    } catch (err: any) {
      setDeleteError(err?.message || 'Failed to delete report. Please try again.');
    } finally {
      setIsDeletingReport(false);
    }
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedReportIds.length === 0) return;
    try {
      setIsBulkDeleting(true);
      setBulkDeleteError(null);
      const failedIds: string[] = [];
      let lastErrorMessage = '';

      for (const reportId of selectedReportIds) {
        const result = await deleteSubmittedReport(reportId);
        if (!result.success) {
          failedIds.push(reportId);
          lastErrorMessage = result.message;
        } else {
          onReportDeleted(reportId);
        }
      }

      if (failedIds.length > 0) {
        setSelectedReportIds(failedIds);
        setBulkDeleteError(lastErrorMessage || `Failed to delete ${failedIds.length} report(s). Please try again.`);
        return;
      }

      setSelectedReportIds([]);
      setIsBulkDeleteModalOpen(false);
    } catch (err: any) {
      setBulkDeleteError(err?.message || 'Failed to delete selected items. Please try again.');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#111111] p-5 rounded-2xl border border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-[#22C55E]">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
              Staff Submitted Reports
              {unviewedCount > 0 && (
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {unviewedCount} New
                </span>
              )}
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Sales performance statements submitted by cashiers and floor attendants for management review.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          <button
            id="create-staff-report-btn"
            onClick={() => setIsCreateModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-[#22C55E] hover:bg-emerald-400 text-black font-extrabold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-emerald-950/30 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Report</span>
          </button>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#22C55E]" />
              <span>Refresh Submissions</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-xs font-semibold text-zinc-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={filteredReports.length > 0 && filteredReports.every((report) => selectedReportIds.includes(report.id))}
            onChange={(e) => {
              if (e.target.checked) {
                setSelectedReportIds((prev) => Array.from(new Set([...prev, ...filteredReports.map((report) => report.id)])));
              } else {
                const ids = new Set(filteredReports.map((report) => report.id));
                setSelectedReportIds((prev) => prev.filter((id) => !ids.has(id)));
              }
            }}
            className="rounded border-zinc-700 text-[#22C55E] focus:ring-[#22C55E] bg-zinc-900 cursor-pointer"
          />
          <span>Select All</span>
        </label>

        {selectedReportIds.length > 0 && (
          <div className="flex items-center gap-2">
            <button onClick={() => setSelectedReportIds([])} className="px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-800 rounded-xl">Deselect All</button>
            <button onClick={() => { setBulkDeleteError(null); setIsBulkDeleteModalOpen(true); }} className="px-3.5 py-1.5 text-xs font-bold text-red-200 bg-red-950/80 border border-red-800/80 rounded-xl flex items-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Selected ({selectedReportIds.length})</span>
            </button>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-[#111111] p-4.5 rounded-2xl border border-zinc-800/80">
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
            Total Submissions
          </span>
          <h4 className="text-xl sm:text-2xl font-black text-white font-mono mt-1.5">
            {reports.length}
          </h4>
          <p className="text-[11px] text-zinc-400 mt-1">Generated by staff</p>
        </div>

        <div className="bg-[#111111] p-4.5 rounded-2xl border border-zinc-800/80">
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
            Reported Revenue
          </span>
          <h4 className="text-xl sm:text-2xl font-black text-[#22C55E] font-mono mt-1.5">
            {formatCurrency(totalReportedSales, currency)}
          </h4>
          <p className="text-[11px] text-emerald-400 font-semibold mt-1">
            {totalReportedOrders} total orders
          </p>
        </div>

        <div className="bg-[#111111] p-4.5 rounded-2xl border border-zinc-800/80">
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
            Unreviewed
          </span>
          <h4
            className={`text-xl sm:text-2xl font-black font-mono mt-1.5 ${
              unviewedCount > 0 ? 'text-amber-400' : 'text-zinc-400'
            }`}
          >
            {unviewedCount}
          </h4>
          <p className="text-[11px] text-zinc-400 mt-1">Awaiting admin review</p>
        </div>

        <div className="bg-[#111111] p-4.5 rounded-2xl border border-zinc-800/80">
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
            Audit Engine
          </span>
          <h4 className="text-xl sm:text-2xl font-black text-emerald-400 font-mono mt-1.5 flex items-center gap-1.5">
            <ShieldCheck className="w-5 h-5 text-[#22C55E]" />
            Active
          </h4>
          <p className="text-[11px] text-zinc-400 mt-1">Cross-checked with sales</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-[#111111] p-4 rounded-2xl border border-zinc-800/80 flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search attendant or report ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 focus:border-[#22C55E] text-white text-xs rounded-xl pl-9 pr-3.5 py-2.5 outline-none transition-colors placeholder:text-zinc-500"
          />
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Worker Dropdown */}
          <select
            value={selectedWorkerId}
            onChange={(e) => setSelectedWorkerId(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 text-white text-xs rounded-xl px-3 py-2.5 outline-none focus:border-[#22C55E]"
          >
            <option value="all">All Attendants</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.full_name}
              </option>
            ))}
          </select>

          {/* Period Dropdown */}
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 text-white text-xs rounded-xl px-3 py-2.5 outline-none focus:border-[#22C55E]"
          >
            <option value="all">All Periods</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="this_week">This Week</option>
            <option value="last_7_days">Last 7 Days</option>
            <option value="this_month">This Month</option>
            <option value="last_30_days">Last 30 Days</option>
            <option value="this_year">This Year</option>
            <option value="all_time">All Time</option>
          </select>

          {/* Status Dropdown */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 text-white text-xs rounded-xl px-3 py-2.5 outline-none focus:border-[#22C55E]"
          >
            <option value="all">All Statuses</option>
            <option value="SUBMITTED">SUBMITTED (New)</option>
            <option value="VIEWED">VIEWED (Reviewed)</option>
          </select>
        </div>
      </div>

      {/* Submitted Reports Table */}
      <div className="bg-[#111111] rounded-2xl border border-zinc-800/80 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-[#141414] text-zinc-400 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Attendant</th>
                <th className="py-3.5 px-4">Report Period</th>
                <th className="py-3.5 px-4 text-right">Sales Total</th>
                <th className="py-3.5 px-4 text-right">Orders</th>
                <th className="py-3.5 px-4 text-right">Items Sold</th>
                <th className="py-3.5 px-4">Generated</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-500">
                    <FileSpreadsheet className="w-8 h-8 mx-auto text-zinc-600 mb-2 opacity-50" />
                    <p className="font-semibold text-zinc-400">No submitted staff reports found</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      Reports generated by cashiers in Worker POS will automatically appear here.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredReports.map((report) => {
                  const verification = verifySubmittedReportAgainstDatabase(report, sales);

                  return (
                    <tr
                      key={report.id}
                      onClick={() => onViewReport(report)}
                      className="hover:bg-zinc-900/60 transition-colors cursor-pointer group"
                    >
                      {/* Attendant Column */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={selectedReportIds.includes(report.id)}
                            onChange={() => setSelectedReportIds((prev) => prev.includes(report.id) ? prev.filter((id) => id !== report.id) : [...prev, report.id])}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded border-zinc-700 text-[#22C55E] focus:ring-[#22C55E] bg-zinc-900 cursor-pointer"
                            aria-label={`Select report ${report.id}`}
                          />
                          <div className="w-8 h-8 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 font-bold text-xs shrink-0">
                            {report.worker_name ? report.worker_name[0].toUpperCase() : 'W'}
                          </div>
                          <div>
                            <p className="font-bold text-white group-hover:text-[#22C55E] transition-colors">
                              {report.worker_name}
                            </p>
                            <p className="text-[10px] text-zinc-400 uppercase font-semibold">
                              {report.worker_role || 'Staff'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Period Column */}
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 font-bold text-[11px]">
                          {report.period_label}
                        </span>
                      </td>

                      {/* Sales Total Column */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400 text-sm">
                        {formatCurrency(report.sales_total, currency)}
                      </td>

                      {/* Orders Count */}
                      <td className="py-3.5 px-4 text-right font-mono text-zinc-300">
                        {report.transactions_count}
                      </td>

                      {/* Items Sold */}
                      <td className="py-3.5 px-4 text-right font-mono text-zinc-300">
                        {report.items_count}
                      </td>

                      {/* Generated Time */}
                      <td className="py-3.5 px-4 text-zinc-400">
                        <div className="text-zinc-300 font-medium text-[11px]">
                          {formatDate(report.submitted_at)}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono">
                          {formatTime(report.submitted_at)}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              report.status === 'SUBMITTED'
                                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                            }`}
                          >
                            {report.status}
                          </span>
                          {verification.isVerified ? (
                            <span className="text-[9px] text-emerald-400 font-semibold flex items-center gap-0.5">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              DB Match
                            </span>
                          ) : (
                            <span className="text-[9px] text-amber-400 font-semibold flex items-center gap-0.5">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              Review
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onViewReport(report)}
                            className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-[11px] flex items-center gap-1 border border-zinc-700 transition-colors cursor-pointer"
                            title="View Full Report"
                          >
                            <Eye className="w-3 h-3 text-[#22C55E]" />
                            <span>Preview</span>
                          </button>

                          <button
                            onClick={(e) => handleDownloadPdf(e, report)}
                            disabled={downloadingId === report.id}
                            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 transition-colors cursor-pointer disabled:opacity-50"
                            title="Download PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={(e) => handlePrint(e, report)}
                            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 transition-colors cursor-pointer"
                            title="Print Report"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setReportToDelete(report);
                              setDeleteError(null);
                            }}
                            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-red-950/40 text-red-400 hover:text-red-300 border border-zinc-700 hover:border-red-900/40 transition-colors cursor-pointer"
                            title="Delete report"
                            aria-label="Delete report"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <DeleteConfirmModal
        isOpen={Boolean(reportToDelete)}
        onClose={() => {
          setReportToDelete(null);
          setDeleteError(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete this report?"
        description="Are you sure you want to delete this report?"
        itemName={reportToDelete?.id || 'Report'}
        itemType="Submitted Report"
        warningNotice="This action will permanently remove this report and cannot be undone."
        confirmLabel="DELETE"
        confirmVariant="danger"
        loading={isDeletingReport}
        error={deleteError}
      />

      <DeleteConfirmModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => {
          if (isBulkDeleting) return;
          setIsBulkDeleteModalOpen(false);
          setBulkDeleteError(null);
        }}
        onConfirm={handleConfirmBulkDelete}
        title="Delete selected items?"
        description="Are you sure you want to delete the selected reports?"
        itemName={`${selectedReportIds.length} reports`}
        itemType="Selected Reports"
        warningNotice="This action will permanently remove the selected items and cannot be undone."
        confirmLabel="DELETE"
        confirmVariant="danger"
        loading={isBulkDeleting}
        error={bulkDeleteError}
      />

      <CreateStaffReportModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        workers={workers}
        sales={sales}
        settings={settings}
        onReportCreated={() => {
          if (onRefresh) {
            onRefresh();
          }
        }}
      />
    </div>
  );
};
