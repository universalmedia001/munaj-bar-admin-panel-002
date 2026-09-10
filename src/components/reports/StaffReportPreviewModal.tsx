import React, { useState } from 'react';
import {
  Download,
  Printer,
  X,
  User,
  Users,
  Calendar,
  CreditCard,
  Banknote,
  Smartphone,
  TrendingUp,
  Award,
  Layers,
  Clock,
  Receipt,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  ArrowUpRight,
  ExternalLink,
} from 'lucide-react';
import type { GeneratedStaffReport, BusinessSettings, SaleWithDetails } from '../../types';
import { formatCurrency, formatDate, formatTime } from '../../utils/formatters';
import { generateAndDownloadStaffReportPDF } from '../../utils/staffReportPdfGenerator';

interface StaffReportPreviewModalProps {
  report: GeneratedStaffReport | null;
  settings: BusinessSettings | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenReceipt?: (sale: SaleWithDetails) => void;
}

export const StaffReportPreviewModal: React.FC<StaffReportPreviewModalProps> = ({
  report,
  settings,
  isOpen,
  onClose,
  onOpenReceipt,
}) => {
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [printMessage, setPrintMessage] = useState<string | null>(null);

  if (!isOpen || !report) return null;

  const currency = settings?.currency || 'NGN';
  const businessName = settings?.worker_pos_name || settings?.business_name || 'MUNAJ BAR';
  const isIndividual = report.reportType === 'individual';
  const workerName = report.targetWorker?.full_name || 'All Workers';

  const handleDownloadPdf = async () => {
    try {
      setDownloading(true);
      setDownloadSuccess(null);
      const res = await generateAndDownloadStaffReportPDF({ report, settings });
      if (res.success) {
        setDownloadSuccess(`Downloaded ${res.filename}`);
        setTimeout(() => setDownloadSuccess(null), 4000);
      }
    } catch (err) {
      console.error('Failed to download PDF:', err);
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    try {
      setPrintMessage('Report sent to the print dialog.');
      window.print();
      setTimeout(() => setPrintMessage(null), 4000);
    } catch {
      setPrintMessage('Unable to print report. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="bg-[#0c0c0c] border border-zinc-800 rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4.5 border-b border-zinc-800 bg-[#111111] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-[#22C55E]">
              {isIndividual ? <User className="w-5 h-5" /> : <Users className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-extrabold text-white tracking-tight">
                  {isIndividual ? 'Staff Performance Statement' : 'All Staff Performance Audit'}
                </h2>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {report.periodLabel}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                {isIndividual ? (
                  <>
                    Auditing Attendant: <strong className="text-white">{workerName}</strong> (
                    {(report.targetWorker?.role || 'Staff').toUpperCase()})
                  </>
                ) : (
                  <>Consolidated performance across {report.workerBreakdown.length} active bar attendants</>
                )}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="px-4 py-2 rounded-xl bg-[#22C55E] hover:bg-emerald-400 active:scale-95 text-black font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-950/40 transition-all cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{downloading ? 'Generating PDF...' : 'Download PDF'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs flex items-center gap-1.5 border border-zinc-700 transition-all cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-zinc-300" />
              <span>Print</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {downloadSuccess && (
          <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-6 py-2 text-xs font-semibold text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{downloadSuccess}</span>
          </div>
        )}

        {printMessage && (
          <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-6 py-2 text-xs font-semibold text-emerald-400">
            {printMessage}
          </div>
        )}

        {/* Scrollable Report Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-zinc-300">
          {/* Executive Summary 4-KPI Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-[#141414] p-4.5 rounded-2xl border border-zinc-800">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Total Revenue</span>
              <h3 className="text-xl sm:text-2xl font-black text-[#22C55E] font-mono mt-1.5">
                {formatCurrency(report.totalRevenue, currency)}
              </h3>
              <p className="text-[11px] text-zinc-400 mt-1">Gross sales completed in period</p>
            </div>

            <div className="bg-[#141414] p-4.5 rounded-2xl border border-zinc-800">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Completed Orders</span>
              <h3 className="text-xl sm:text-2xl font-black text-white font-mono mt-1.5">
                {report.totalTransactions}
              </h3>
              <p className="text-[11px] text-emerald-400 font-semibold mt-1">100% audited</p>
            </div>

            <div className="bg-[#141414] p-4.5 rounded-2xl border border-zinc-800">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Items Sold</span>
              <h3 className="text-xl sm:text-2xl font-black text-white font-mono mt-1.5">
                {report.totalItemsSold}
              </h3>
              <p className="text-[11px] text-zinc-400 mt-1">Bottles & drinks dispatched</p>
            </div>

            <div className="bg-[#141414] p-4.5 rounded-2xl border border-zinc-800">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Average Ticket</span>
              <h3 className="text-xl sm:text-2xl font-black text-white font-mono mt-1.5">
                {formatCurrency(report.averageTicket, currency)}
              </h3>
              <p className="text-[11px] text-zinc-400 mt-1">Per transaction average</p>
            </div>
          </div>

          {/* Payment Breakdown & Sales Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Payment Method Breakdown */}
            <div className="bg-[#141414] p-5 rounded-2xl border border-zinc-800">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-3">
                <CreditCard className="w-4 h-4 text-[#22C55E]" />
                Payment Channels Breakdown
              </h4>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/60">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-[#22C55E] flex items-center justify-center font-bold text-xs">
                      <Banknote className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold text-white">Cash Tendered</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-white">
                    {formatCurrency(report.paymentBreakdown.cash, currency)}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/60">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-xs">
                      <CreditCard className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold text-white">POS Card Terminal</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-white">
                    {formatCurrency(report.paymentBreakdown.pos, currency)}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/60">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold text-xs">
                      <Smartphone className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold text-white">Direct Bank Transfer</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-white">
                    {formatCurrency(report.paymentBreakdown.transfer, currency)}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-[#22C55E]/10 border border-[#22C55E]/20 mt-3">
                  <span className="text-xs font-extrabold text-[#22C55E]">Total Revenue</span>
                  <span className="text-sm font-mono font-black text-[#22C55E]">
                    {formatCurrency(report.paymentBreakdown.total, currency)}
                  </span>
                </div>
              </div>
            </div>

            {/* Sales Performance Metrics */}
            <div className="bg-[#141414] p-5 rounded-2xl border border-zinc-800">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-[#22C55E]" />
                Sales Performance Metrics
              </h4>
              <div className="divide-y divide-zinc-800/60">
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Completed Orders</span>
                  <span className="text-xs font-mono font-bold text-white">{report.totalTransactions} tickets</span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Total Items Sold</span>
                  <span className="text-xs font-mono font-bold text-white">{report.totalItemsSold} units</span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Gross Subtotal</span>
                  <span className="text-xs font-mono font-bold text-white">
                    {formatCurrency(report.totalGrossRevenue, currency)}
                  </span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Discounts Deducted</span>
                  <span className="text-xs font-mono font-bold text-rose-400">
                    -{formatCurrency(report.totalDiscounts, currency)}
                  </span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Net Settled Revenue</span>
                  <span className="text-xs font-mono font-extrabold text-[#22C55E]">
                    {formatCurrency(report.totalRevenue, currency)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ALL WORKERS BREAKDOWN (Only in All Workers mode) */}
          {!isIndividual && report.workerBreakdown.length > 0 && (
            <div className="bg-[#141414] p-5 rounded-2xl border border-zinc-800">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-[#22C55E]" />
                Staff Performance Leaderboard & Breakdown
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-400 font-bold">
                      <th className="pb-2.5 pr-2">#</th>
                      <th className="pb-2.5">Staff Name</th>
                      <th className="pb-2.5">Role</th>
                      <th className="pb-2.5 text-right">Orders</th>
                      <th className="pb-2.5 text-right">Items Sold</th>
                      <th className="pb-2.5 text-right">% of Total</th>
                      <th className="pb-2.5 text-right">Net Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {report.workerBreakdown.map((wb) => (
                      <tr key={wb.worker.id} className="hover:bg-zinc-900/40">
                        <td className="py-3 pr-2 font-mono font-bold text-zinc-500">{wb.rank}</td>
                        <td className="py-3 font-bold text-white">{wb.worker.full_name}</td>
                        <td className="py-3">
                          <span className="px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-[10px] uppercase text-zinc-400 font-semibold">
                            {wb.worker.role}
                          </span>
                        </td>
                        <td className="py-3 text-right font-mono text-zinc-300">{wb.ordersCount}</td>
                        <td className="py-3 text-right font-mono text-zinc-300">{wb.itemsSoldCount}</td>
                        <td className="py-3 text-right font-mono text-zinc-400">
                          {wb.percentageOfTotalRevenue.toFixed(1)}%
                        </td>
                        <td className="py-3 text-right font-mono font-bold text-emerald-400">
                          {formatCurrency(wb.netRevenue, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-zinc-700 bg-zinc-900/40 font-bold">
                      <td colSpan={3} className="py-3 text-white">
                        Grand Total
                      </td>
                      <td className="py-3 text-right font-mono text-white">{report.totalTransactions}</td>
                      <td className="py-3 text-right font-mono text-white">{report.totalItemsSold}</td>
                      <td className="py-3 text-right font-mono text-zinc-300">100.0%</td>
                      <td className="py-3 text-right font-mono text-[#22C55E]">
                        {formatCurrency(report.totalRevenue, currency)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* TOP PRODUCTS SOLD */}
          {report.topProducts.length > 0 && (
            <div className="bg-[#141414] p-5 rounded-2xl border border-zinc-800">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-3">
                <Award className="w-4 h-4 text-[#22C55E]" />
                {isIndividual
                  ? `Top Products Sold by ${workerName}`
                  : 'Top Products Sold Across All Staff'}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {report.topProducts.slice(0, 9).map((tp) => (
                  <div
                    key={tp.productName}
                    className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800/80 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-lg bg-zinc-800 text-zinc-300 font-mono font-bold text-xs flex items-center justify-center">
                        {tp.rank}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-white truncate max-w-[150px]">{tp.productName}</p>
                        <p className="text-[11px] text-zinc-400">{tp.quantity} units sold</p>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      {formatCurrency(tp.revenue, currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DAILY BREAKDOWN (If more than 1 day or available) */}
          {report.dailyBreakdown.length > 0 && (
            <div className="bg-[#141414] p-5 rounded-2xl border border-zinc-800">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-[#22C55E]" />
                Daily Breakdown in Selected Period
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-400 font-bold">
                      <th className="pb-2.5">Date</th>
                      <th className="pb-2.5 text-right">Orders Completed</th>
                      <th className="pb-2.5 text-right">Items Dispatched</th>
                      <th className="pb-2.5 text-right">Daily Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {report.dailyBreakdown.map((db) => (
                      <tr key={db.dateKey} className="hover:bg-zinc-900/40">
                        <td className="py-2.5 font-bold text-white">{db.dateLabel}</td>
                        <td className="py-2.5 text-right font-mono text-zinc-300">{db.ordersCount}</td>
                        <td className="py-2.5 text-right font-mono text-zinc-300">{db.itemsSoldCount}</td>
                        <td className="py-2.5 text-right font-mono font-bold text-emerald-400">
                          {formatCurrency(db.revenue, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-zinc-700 bg-zinc-900/40 font-bold">
                      <td className="py-2.5 text-white">Period Aggregate</td>
                      <td className="py-2.5 text-right font-mono text-white">{report.totalTransactions}</td>
                      <td className="py-2.5 text-right font-mono text-white">{report.totalItemsSold}</td>
                      <td className="py-2.5 text-right font-mono text-[#22C55E]">
                        {formatCurrency(report.totalRevenue, currency)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* SHIFT RECONCILIATION & CASH BALANCING */}
          <div className="bg-[#141414] p-5 rounded-2xl border border-zinc-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#22C55E]" />
                Shift Reconciliation & Cash Balancing
              </h4>
              <span
                className={`text-[11px] font-bold px-3 py-1 rounded-full border ${
                  report.shiftReconciliation.status === 'BALANCED'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : report.shiftReconciliation.status === 'SHORTAGE'
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                }`}
              >
                STATUS: {report.shiftReconciliation.status}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="bg-zinc-900/70 p-3 rounded-xl border border-zinc-800">
                <span className="text-[10px] font-bold text-zinc-400 uppercase">Total Shifts</span>
                <p className="text-sm font-mono font-bold text-white mt-1">
                  {report.shiftReconciliation.totalShifts}
                </p>
              </div>

              <div className="bg-zinc-900/70 p-3 rounded-xl border border-zinc-800">
                <span className="text-[10px] font-bold text-zinc-400 uppercase">Opening Floats</span>
                <p className="text-sm font-mono font-bold text-zinc-300 mt-1">
                  {formatCurrency(report.shiftReconciliation.totalOpeningFloats, currency)}
                </p>
              </div>

              <div className="bg-zinc-900/70 p-3 rounded-xl border border-zinc-800">
                <span className="text-[10px] font-bold text-zinc-400 uppercase">Expected Cash</span>
                <p className="text-sm font-mono font-bold text-zinc-300 mt-1">
                  {formatCurrency(report.shiftReconciliation.totalExpectedCash, currency)}
                </p>
              </div>

              <div className="bg-zinc-900/70 p-3 rounded-xl border border-zinc-800">
                <span className="text-[10px] font-bold text-zinc-400 uppercase">Actual Ending Cash</span>
                <p className="text-sm font-mono font-bold text-zinc-300 mt-1">
                  {formatCurrency(report.shiftReconciliation.totalActualCash, currency)}
                </p>
              </div>

              <div className="bg-zinc-900/70 p-3 rounded-xl border border-zinc-800">
                <span className="text-[10px] font-bold text-zinc-400 uppercase">Cash Discrepancy</span>
                <p
                  className={`text-sm font-mono font-bold mt-1 ${
                    report.shiftReconciliation.totalDifference < 0
                      ? 'text-rose-400'
                      : report.shiftReconciliation.totalDifference > 0
                      ? 'text-blue-400'
                      : 'text-[#22C55E]'
                  }`}
                >
                  {report.shiftReconciliation.totalDifference >= 0 ? '+' : ''}
                  {formatCurrency(report.shiftReconciliation.totalDifference, currency)}
                </p>
              </div>
            </div>

            {/* Shift History Table */}
            {report.shiftHistory.length > 0 && (
              <div className="overflow-x-auto pt-2">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-400 font-bold">
                      <th className="pb-2">Shift Date / Time</th>
                      <th className="pb-2">Worker</th>
                      <th className="pb-2 text-right">Opening Float</th>
                      <th className="pb-2 text-right">Expected</th>
                      <th className="pb-2 text-right">Actual Ending</th>
                      <th className="pb-2 text-right">Difference</th>
                      <th className="pb-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/40">
                    {report.shiftHistory.map((sh) => (
                      <tr key={sh.id} className="hover:bg-zinc-900/40">
                        <td className="py-2.5 text-zinc-300 font-mono">{sh.dateLabel}</td>
                        <td className="py-2.5 font-bold text-white">{sh.workerName}</td>
                        <td className="py-2.5 text-right font-mono text-zinc-300">
                          {formatCurrency(sh.openingCash, currency)}
                        </td>
                        <td className="py-2.5 text-right font-mono text-zinc-300">
                          {formatCurrency(sh.expectedCash, currency)}
                        </td>
                        <td className="py-2.5 text-right font-mono text-zinc-300">
                          {formatCurrency(sh.actualEndingCash, currency)}
                        </td>
                        <td
                          className={`py-2.5 text-right font-mono font-bold ${
                            sh.difference < 0
                              ? 'text-rose-400'
                              : sh.difference > 0
                              ? 'text-blue-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {sh.difference >= 0 ? '+' : ''}
                          {formatCurrency(sh.difference, currency)}
                        </td>
                        <td className="py-2.5 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              sh.status === 'BALANCED'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : sh.status === 'SHORTAGE'
                                ? 'bg-rose-500/10 text-rose-400'
                                : 'bg-blue-500/10 text-blue-400'
                            }`}
                          >
                            {sh.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* COMPLETED TRANSACTION DETAILS TABLE */}
          {report.transactions.length > 0 && (
            <div className="bg-[#141414] p-5 rounded-2xl border border-zinc-800">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-[#22C55E]" />
                  Audited Sales Receipts ({report.transactions.length})
                </h4>
                <p className="text-[11px] text-zinc-400">Click any receipt to open thermal voucher</p>
              </div>

              <div className="overflow-x-auto max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-[#141414] border-b border-zinc-800 text-zinc-400 font-bold">
                    <tr>
                      <th className="pb-2.5">Receipt No</th>
                      <th className="pb-2.5">Date & Time</th>
                      <th className="pb-2.5">Worker</th>
                      <th className="pb-2.5">Payment</th>
                      <th className="pb-2.5 text-right">Items</th>
                      <th className="pb-2.5 text-right">Total</th>
                      <th className="pb-2.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/40">
                    {report.transactions.map((sale) => (
                      <tr
                        key={sale.id}
                        onClick={() => onOpenReceipt?.(sale)}
                        className="hover:bg-zinc-900/60 cursor-pointer transition-colors"
                      >
                        <td className="py-2.5 font-mono font-bold text-[#22C55E]">
                          {sale.receipt_number}
                        </td>
                        <td className="py-2.5 text-zinc-300">
                          {formatDate(sale.created_at)} at {formatTime(sale.created_at)}
                        </td>
                        <td className="py-2.5 text-white font-medium">
                          {sale.worker?.full_name || 'Cashier'}
                        </td>
                        <td className="py-2.5">
                          <span className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 font-mono text-[10px] uppercase border border-zinc-800">
                            {sale.payment_method}
                          </span>
                        </td>
                        <td className="py-2.5 text-right font-mono text-zinc-300">
                          {sale.items?.length || 1}
                        </td>
                        <td className="py-2.5 text-right font-mono font-bold text-white">
                          {formatCurrency(sale.total, currency)}
                        </td>
                        <td className="py-2.5 text-center">
                          <span className="text-[11px] text-zinc-400 hover:text-white flex items-center justify-center gap-1">
                            <ExternalLink className="w-3 h-3" />
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-zinc-800 bg-[#111111] flex items-center justify-between text-xs text-zinc-400">
          <span>{businessName} Management Accounting System</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold transition-all cursor-pointer"
          >
            Close Statement
          </button>
        </div>
      </div>

      {/* HIDDEN PRINT-ONLY CONTAINER */}
      <div id="printable-staff-report" className="hidden print:block">
        <div style={{ fontFamily: 'Helvetica, Arial, sans-serif', color: '#000', width: '100%' }}>
          {/* Header */}
          <div style={{ borderBottom: '2px solid #000', paddingBottom: '8px', marginBottom: '14px' }}>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>
              {businessName.toUpperCase()}
            </h1>
            <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#555' }}>
              Premium Lounge & Bar Service — Staff Performance & Management Audit
            </p>
            <h2 style={{ margin: '8px 0 0 0', fontSize: '14px', fontWeight: 'bold' }}>
              {isIndividual ? 'STAFF PERFORMANCE STATEMENT' : 'ALL STAFF PERFORMANCE REPORT'}
            </h2>
            <p style={{ margin: '3px 0 0 0', fontSize: '11px' }}>
              <strong>Scope:</strong> {isIndividual ? `${workerName} (${report.targetWorker?.role || 'Staff'})` : `All Staff Members (${report.workerBreakdown.length})`}
              &nbsp;&nbsp;|&nbsp;&nbsp;
              <strong>Period:</strong> {report.periodLabel}
              &nbsp;&nbsp;|&nbsp;&nbsp;
              <strong>Generated:</strong> {formatDate(report.generatedAt.toISOString())} {formatTime(report.generatedAt.toISOString())}
            </p>
          </div>

          {/* KPI Summary */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f0f0f0' }}>
                <th style={{ border: '1px solid #ccc', padding: '6px', textAlign: 'left' }}>TOTAL REVENUE</th>
                <th style={{ border: '1px solid #ccc', padding: '6px', textAlign: 'left' }}>COMPLETED ORDERS</th>
                <th style={{ border: '1px solid #ccc', padding: '6px', textAlign: 'left' }}>ITEMS SOLD</th>
                <th style={{ border: '1px solid #ccc', padding: '6px', textAlign: 'left' }}>AVERAGE TICKET</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ border: '1px solid #ccc', padding: '8px', fontSize: '14px', fontWeight: 'bold' }}>
                  {formatCurrency(report.totalRevenue, currency)}
                </td>
                <td style={{ border: '1px solid #ccc', padding: '8px', fontSize: '14px', fontWeight: 'bold' }}>
                  {report.totalTransactions}
                </td>
                <td style={{ border: '1px solid #ccc', padding: '8px', fontSize: '14px', fontWeight: 'bold' }}>
                  {report.totalItemsSold}
                </td>
                <td style={{ border: '1px solid #ccc', padding: '8px', fontSize: '14px', fontWeight: 'bold' }}>
                  {formatCurrency(report.averageTicket, currency)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Payment & Sales breakdown */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f0f0f0' }}>
                <th style={{ border: '1px solid #ccc', padding: '6px', textAlign: 'left' }}>Payment Method</th>
                <th style={{ border: '1px solid #ccc', padding: '6px', textAlign: 'right' }}>Amount</th>
                <th style={{ border: '1px solid #ccc', padding: '6px', textAlign: 'left' }}>Performance Metric</th>
                <th style={{ border: '1px solid #ccc', padding: '6px', textAlign: 'right' }}>Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ border: '1px solid #ccc', padding: '5px' }}>Cash Sales</td>
                <td style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'right' }}>{formatCurrency(report.paymentBreakdown.cash, currency)}</td>
                <td style={{ border: '1px solid #ccc', padding: '5px' }}>Gross Revenue</td>
                <td style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'right' }}>{formatCurrency(report.totalGrossRevenue, currency)}</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #ccc', padding: '5px' }}>POS Terminal Sales</td>
                <td style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'right' }}>{formatCurrency(report.paymentBreakdown.pos, currency)}</td>
                <td style={{ border: '1px solid #ccc', padding: '5px' }}>Discounts Deducted</td>
                <td style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'right' }}>-{formatCurrency(report.totalDiscounts, currency)}</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #ccc', padding: '5px' }}>Bank Transfer Sales</td>
                <td style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'right' }}>{formatCurrency(report.paymentBreakdown.transfer, currency)}</td>
                <td style={{ border: '1px solid #ccc', padding: '5px', fontWeight: 'bold' }}>Net Revenue</td>
                <td style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(report.totalRevenue, currency)}</td>
              </tr>
            </tbody>
          </table>

          {/* All staff breakdown table */}
          {!isIndividual && report.workerBreakdown.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '12px', fontWeight: 'bold', margin: '0 0 6px 0' }}>STAFF PERFORMANCE RANKING</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f0f0f0' }}>
                    <th style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'left' }}>#</th>
                    <th style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'left' }}>Staff Name</th>
                    <th style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'left' }}>Role</th>
                    <th style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'right' }}>Orders</th>
                    <th style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'right' }}>Items</th>
                    <th style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'right' }}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {report.workerBreakdown.map((wb) => (
                    <tr key={wb.worker.id}>
                      <td style={{ border: '1px solid #ccc', padding: '5px' }}>{wb.rank}</td>
                      <td style={{ border: '1px solid #ccc', padding: '5px', fontWeight: 'bold' }}>{wb.worker.full_name}</td>
                      <td style={{ border: '1px solid #ccc', padding: '5px' }}>{wb.worker.role}</td>
                      <td style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'right' }}>{wb.ordersCount}</td>
                      <td style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'right' }}>{wb.itemsSoldCount}</td>
                      <td style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(wb.netRevenue, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Shift Reconciliation */}
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '12px', fontWeight: 'bold', margin: '0 0 6px 0' }}>SHIFT RECONCILIATION</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f0f0f0' }}>
                  <th style={{ border: '1px solid #ccc', padding: '5px' }}>Total Shifts</th>
                  <th style={{ border: '1px solid #ccc', padding: '5px' }}>Opening Floats</th>
                  <th style={{ border: '1px solid #ccc', padding: '5px' }}>Expected Cash</th>
                  <th style={{ border: '1px solid #ccc', padding: '5px' }}>Actual Ending Cash</th>
                  <th style={{ border: '1px solid #ccc', padding: '5px' }}>Difference</th>
                  <th style={{ border: '1px solid #ccc', padding: '5px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'center' }}>{report.shiftReconciliation.totalShifts}</td>
                  <td style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'center' }}>{formatCurrency(report.shiftReconciliation.totalOpeningFloats, currency)}</td>
                  <td style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'center' }}>{formatCurrency(report.shiftReconciliation.totalExpectedCash, currency)}</td>
                  <td style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'center' }}>{formatCurrency(report.shiftReconciliation.totalActualCash, currency)}</td>
                  <td style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'center', fontWeight: 'bold' }}>
                    {report.shiftReconciliation.totalDifference >= 0 ? '+' : ''}{formatCurrency(report.shiftReconciliation.totalDifference, currency)}
                  </td>
                  <td style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'center', fontWeight: 'bold' }}>
                    {report.shiftReconciliation.status}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '20px', borderTop: '1px solid #888', paddingTop: '6px', fontSize: '9px', color: '#666', textAlign: 'center' }}>
            Official Audit Document • Generated automatically by {businessName} Management System
          </div>
        </div>
      </div>
    </div>
  );
};
