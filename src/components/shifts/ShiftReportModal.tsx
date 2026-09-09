import React, { useState, useMemo } from 'react';
import {
  Download,
  Printer,
  X,
  Clock,
  Banknote,
  TrendingUp,
  CreditCard,
  Send,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  ShoppingBag,
  Receipt,
  FileText,
  User,
  ShieldCheck,
  Calendar,
  ExternalLink,
} from 'lucide-react';
import type { ShiftWithWorker, SaleWithDetails, BusinessSettings } from '../../types';
import { generateSingleShiftReport } from '../../utils/shiftReportCalculator';
import { generateAndDownloadShiftReportPDF } from '../../utils/shiftReportPdfGenerator';
import { formatCurrency, formatDate, formatTime } from '../../utils/formatters';
import { Badge } from '../common/Badge';

interface ShiftReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: ShiftWithWorker | null;
  sales: SaleWithDetails[];
  settings: BusinessSettings | null;
  onOpenReceipt?: (sale: SaleWithDetails) => void;
}

export const ShiftReportModal: React.FC<ShiftReportModalProps> = ({
  isOpen,
  onClose,
  shift,
  sales,
  settings,
  onOpenReceipt,
}) => {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const currency = settings?.currency || 'NGN';
  const businessName = settings?.worker_pos_name || settings?.business_name || 'MUNAJ BAR';

  const report = useMemo(() => {
    if (!shift) return null;
    return generateSingleShiftReport({ shift, sales });
  }, [shift, sales]);

  if (!isOpen || !shift || !report) return null;

  const handleDownloadPDF = async () => {
    try {
      setIsGeneratingPdf(true);
      setPdfError(null);
      await generateAndDownloadShiftReportPDF({ report, settings });
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 4000);
    } catch (err: unknown) {
      console.error('Failed to generate PDF:', err);
      setPdfError(err instanceof Error ? err.message : 'Failed to generate PDF');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const isShortage = report.reconciliationStatus === 'SHORTAGE';
  const isExcess = report.reconciliationStatus === 'EXCESS';
  const isBalanced = report.reconciliationStatus === 'BALANCED';
  const isActive = report.isActive;

  return (
    <>
      {/* On-Screen Interactive Preview Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto print:hidden">
        <div
          id="shift-report-modal-content"
          className="relative w-full max-w-4xl bg-[#0c0c0e] border border-zinc-800/90 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]"
        >
          {/* Header Action Bar */}
          <div className="p-4 sm:p-6 border-b border-zinc-800 bg-[#121216] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-extrabold shadow-inner">
                <FileText className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-extrabold tracking-wider uppercase text-emerald-400">
                    {businessName}
                  </span>
                  <span className="text-zinc-600">•</span>
                  <span className="text-[11px] font-semibold text-zinc-400">Shift Audit & Statement</span>
                </div>
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
                  {report.workerName}&apos;s Shift Report
                  <Badge variant={isActive ? 'amber' : 'green'} size="sm">
                    {report.shift.status.toUpperCase()}
                  </Badge>
                </h2>
              </div>
            </div>

            {/* Top Right Action Buttons */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                id="btn-shift-report-print"
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors"
                title="Print Shift Report (A4 / Letter)"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Print</span>
              </button>

              <button
                id="btn-shift-report-pdf-download"
                onClick={handleDownloadPDF}
                disabled={isGeneratingPdf}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-black bg-[#22C55E] hover:bg-[#1ea750] rounded-xl transition-all shadow-md shadow-emerald-950/40 disabled:opacity-50"
                title="Download Shift Report PDF"
              >
                {isGeneratingPdf ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Creating PDF...</span>
                  </>
                ) : downloadSuccess ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Downloaded!</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF</span>
                  </>
                )}
              </button>

              <button
                onClick={onClose}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800/80 rounded-xl transition-colors ml-1"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Scrollable Body */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-6 text-xs">
            {pdfError && (
              <div className="p-3.5 rounded-2xl bg-red-950/60 border border-red-800/80 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{pdfError}</span>
              </div>
            )}

            {/* Shift Status & Info Banner */}
            <div
              className={`p-4 sm:p-5 rounded-2xl border ${
                isActive
                  ? 'bg-amber-950/20 border-amber-800/50 text-amber-200'
                  : isShortage
                  ? 'bg-red-950/20 border-red-800/50 text-red-200'
                  : isExcess
                  ? 'bg-blue-950/20 border-blue-800/50 text-blue-200'
                  : 'bg-emerald-950/20 border-emerald-800/50 text-emerald-200'
              } flex flex-col md:flex-row md:items-center justify-between gap-4`}
            >
              <div className="flex items-start gap-3">
                {isActive ? (
                  <div className="w-3 h-3 rounded-full bg-amber-400 animate-pulse mt-0.5" />
                ) : isShortage ? (
                  <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                ) : (
                  <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                    {isActive
                      ? 'CURRENT ACTIVE SHIFT IN PROGRESS'
                      : isShortage
                      ? 'SHIFT RECONCILED WITH CASH SHORTAGE'
                      : isExcess
                      ? 'SHIFT RECONCILED WITH CASH EXCESS'
                      : 'SHIFT RECONCILED & BALANCED'}
                  </h3>
                  <p className="text-zinc-400 text-xs mt-0.5">
                    {isActive
                      ? 'This shift is currently open on the POS floor. Live sales and expected drawer amounts update in real time.'
                      : isShortage
                      ? `Physical drawer cash was ${formatCurrency(Math.abs(report.discrepancy || 0), currency)} less than calculated expected cash.`
                      : isExcess
                      ? `Physical drawer cash was ${formatCurrency(report.discrepancy || 0), currency} higher than calculated expected cash.`
                      : 'Physical cash counted at closure matched expected drawer figures perfectly.'}
                  </p>
                </div>
              </div>

              {/* Status Pill */}
              <div className="self-start md:self-auto">
                {isActive ? (
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    PENDING SHIFT CLOSURE
                  </span>
                ) : isShortage ? (
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-extrabold bg-red-500/20 text-red-300 border border-red-500/40">
                    🔴 SHORTAGE: {formatCurrency(report.discrepancy, currency)}
                  </span>
                ) : isExcess ? (
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-extrabold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                    🟡 OVERAGE: +{formatCurrency(report.discrepancy, currency)}
                  </span>
                ) : (
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    🟢 BALANCED (₦0.00)
                  </span>
                )}
              </div>
            </div>

            {/* Data consistency notice if payment mismatch */}
            {report.paymentMismatch && (
              <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-700/60 text-amber-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>
                  <strong>Data Integrity Warning:</strong> Cash + POS + Transfer sales sum differs from Gross Total
                  Sales. Please audit the individual receipt entries below.
                </span>
              </div>
            )}

            {/* Worker & Shift Metadata Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-[#141418] border border-zinc-800">
              <div>
                <span className="text-[10px] text-zinc-500 uppercase font-bold">Staff Member</span>
                <p className="font-bold text-white text-xs mt-0.5 truncate">{report.workerName}</p>
                <p className="text-[10px] text-zinc-400">{report.workerRole}</p>
              </div>
              <div>
                <span className="text-[10px] text-zinc-500 uppercase font-bold">Shift Date</span>
                <p className="font-bold text-white text-xs mt-0.5">{report.dateLabel}</p>
                <p className="text-[10px] text-zinc-400">{report.durationLabel}</p>
              </div>
              <div>
                <span className="text-[10px] text-zinc-500 uppercase font-bold">Started At</span>
                <p className="font-bold text-zinc-300 text-xs mt-0.5">{formatTime(report.startDate.toISOString())}</p>
              </div>
              <div>
                <span className="text-[10px] text-zinc-500 uppercase font-bold">Closed At</span>
                <p className="font-bold text-zinc-300 text-xs mt-0.5">
                  {report.endDate ? formatTime(report.endDate.toISOString()) : 'Present (Active)'}
                </p>
              </div>
            </div>

            {/* Executive 4-KPI Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-[#131316] border border-zinc-800/80">
                <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Opening Cash Float</span>
                <p className="text-base sm:text-lg font-mono font-black text-zinc-200 mt-1">
                  {formatCurrency(report.openingCash, currency)}
                </p>
                <span className="text-[10px] text-zinc-500">Initial drawer change</span>
              </div>

              <div className="p-4 rounded-2xl bg-[#131316] border border-emerald-900/40">
                <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider">Total Shift Sales</span>
                <p className="text-base sm:text-lg font-mono font-black text-emerald-400 mt-1">
                  {formatCurrency(report.totalSales, currency)}
                </p>
                <span className="text-[10px] text-zinc-500">{report.totalTransactions} completed transactions</span>
              </div>

              <div className="p-4 rounded-2xl bg-[#131316] border border-zinc-800/80">
                <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Expected Cash Drawer</span>
                <p className="text-base sm:text-lg font-mono font-black text-zinc-100 mt-1">
                  {formatCurrency(report.expectedCash, currency)}
                </p>
                <span className="text-[10px] text-zinc-500">Float + Cash Sales</span>
              </div>

              <div
                className={`p-4 rounded-2xl border ${
                  isActive
                    ? 'bg-[#131316] border-zinc-800/80'
                    : isShortage
                    ? 'bg-red-950/20 border-red-800/50'
                    : isExcess
                    ? 'bg-blue-950/20 border-blue-800/50'
                    : 'bg-emerald-950/20 border-emerald-800/50'
                }`}
              >
                <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Actual Ending Cash</span>
                <p className="text-base sm:text-lg font-mono font-black text-white mt-1">
                  {isActive
                    ? 'Not Reconciled'
                    : report.actualEndingCash !== null
                    ? formatCurrency(report.actualEndingCash, currency)
                    : '—'}
                </p>
                <span
                  className={`text-[10px] font-bold ${
                    isActive
                      ? 'text-zinc-500'
                      : isShortage
                      ? 'text-red-400'
                      : isExcess
                      ? 'text-blue-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {isActive
                    ? 'Pending shift closure'
                    : isShortage
                    ? `${formatCurrency(report.discrepancy, currency)} Short`
                    : isExcess
                    ? `+${formatCurrency(report.discrepancy, currency)} Over`
                    : 'Balanced (Exact match)'}
                </span>
              </div>
            </div>

            {/* Two Column Section: Cash Reconciliation Audit & Payment Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Cash Reconciliation Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#121216] border border-zinc-800/90 space-y-3">
                <div className="flex items-center gap-2 pb-2.5 border-b border-zinc-800">
                  <Banknote className="w-4 h-4 text-emerald-400" />
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider">
                    Cash Reconciliation Audit
                  </h4>
                </div>

                <div className="space-y-2.5">
                  <div className="flex justify-between items-center text-zinc-400">
                    <span>Opening Float Amount:</span>
                    <span className="font-mono font-bold text-white">
                      {formatCurrency(report.openingCash, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-400">
                    <span>Cash Sales Collected (+):</span>
                    <span className="font-mono font-bold text-emerald-400">
                      + {formatCurrency(report.cashSales, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center font-bold text-white pt-2 border-t border-zinc-800/80">
                    <span>Calculated Expected Cash:</span>
                    <span className="font-mono text-white text-sm">
                      {formatCurrency(report.expectedCash, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-400">
                    <span>Actual Ending Counted Cash:</span>
                    <span className="font-mono font-bold text-white">
                      {isActive ? 'Pending Closure' : formatCurrency(report.actualEndingCash, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center font-extrabold pt-2.5 border-t border-zinc-800">
                    <span className="text-white">Drawer Discrepancy:</span>
                    <span
                      className={`font-mono text-sm ${
                        isActive
                          ? 'text-zinc-500'
                          : isShortage
                          ? 'text-red-400'
                          : isExcess
                          ? 'text-blue-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {isActive
                        ? 'Pending'
                        : report.discrepancy !== null
                        ? `${report.discrepancy >= 0 ? '+' : ''}${formatCurrency(report.discrepancy, currency)}`
                        : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment Method Breakdown Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#121216] border border-zinc-800/90 space-y-3">
                <div className="flex items-center gap-2 pb-2.5 border-b border-zinc-800">
                  <CreditCard className="w-4 h-4 text-blue-400" />
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider">
                    Shift Payment Channels
                  </h4>
                </div>

                <div className="space-y-2.5">
                  <div className="flex justify-between items-center text-zinc-400">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      Cash Sales
                    </span>
                    <span className="font-mono font-bold text-white">
                      {formatCurrency(report.cashSales, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-400">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-400" />
                      POS Terminal (Card)
                    </span>
                    <span className="font-mono font-bold text-white">
                      {formatCurrency(report.posSales, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-400">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      Bank Direct Transfer
                    </span>
                    <span className="font-mono font-bold text-white">
                      {formatCurrency(report.transferSales, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center font-bold text-white pt-2.5 border-t border-zinc-800">
                    <span className="text-emerald-400 font-extrabold">Total Shift Revenue:</span>
                    <span className="font-mono text-emerald-400 text-sm font-black">
                      {formatCurrency(report.totalSales, currency)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sales During This Shift Table */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#121216] border border-zinc-800/90 space-y-3">
              <div className="flex items-center justify-between pb-2.5 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-emerald-400" />
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider">
                    Sales Completed In This Shift ({report.totalTransactions})
                  </h4>
                </div>
                <span className="text-[11px] text-zinc-400">
                  Total: <strong className="text-white font-mono">{formatCurrency(report.totalSales, currency)}</strong>
                </span>
              </div>

              {report.transactions.length === 0 ? (
                <div className="py-8 text-center text-zinc-500 bg-[#16161a] rounded-xl border border-zinc-800/60">
                  <ShoppingBag className="w-8 h-8 mx-auto text-zinc-600 mb-2 opacity-60" />
                  <p className="font-semibold text-zinc-400">NO SALES RECORDED</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">This shift has no completed sales transactions.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#18181e] text-zinc-400 font-bold uppercase text-[10px] tracking-wider border-b border-zinc-800">
                      <tr>
                        <th className="py-2.5 px-3">Receipt #</th>
                        <th className="py-2.5 px-3">Time</th>
                        <th className="py-2.5 px-3">Payment</th>
                        <th className="py-2.5 px-3 text-right">Items</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                        {onOpenReceipt && <th className="py-2.5 px-3 text-center">Action</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 font-mono">
                      {report.transactions.map((sale) => (
                        <tr key={sale.id} className="hover:bg-zinc-800/40 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-emerald-400">{sale.receipt_number}</td>
                          <td className="py-2.5 px-3 text-zinc-400">{formatTime(sale.created_at)}</td>
                          <td className="py-2.5 px-3 font-sans">
                            <Badge
                              variant={
                                sale.payment_method === 'cash'
                                  ? 'green'
                                  : sale.payment_method === 'pos'
                                  ? 'blue'
                                  : 'amber'
                              }
                              size="sm"
                            >
                              {(sale.payment_method || 'CASH').toUpperCase()}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-right text-zinc-300">{sale.items?.length || 1}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-white">
                            {formatCurrency(sale.total, currency)}
                          </td>
                          {onOpenReceipt && (
                            <td className="py-2.5 px-3 text-center font-sans">
                              <button
                                onClick={() => onOpenReceipt(sale)}
                                className="px-2 py-1 text-[10px] font-bold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors inline-flex items-center gap-1"
                              >
                                <span>Receipt</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Sale Items Breakdown Table */}
            {report.itemsSold.length > 0 && (
              <div className="p-4 sm:p-5 rounded-2xl bg-[#121216] border border-zinc-800/90 space-y-3">
                <div className="flex items-center justify-between pb-2.5 border-b border-zinc-800">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-emerald-400" />
                    <h4 className="font-bold text-white text-xs uppercase tracking-wider">
                      Itemized Product Breakdown ({report.totalItemsCount} Total Units)
                    </h4>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#18181e] text-zinc-400 font-bold uppercase text-[10px] tracking-wider border-b border-zinc-800">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Product Name</th>
                        <th className="py-2.5 px-3 text-right">Quantity Sold</th>
                        <th className="py-2.5 px-3 text-right">Unit Price</th>
                        <th className="py-2.5 px-3 text-right">Total Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {report.itemsSold.map((item, idx) => (
                        <tr key={idx} className="hover:bg-zinc-800/40 transition-colors">
                          <td className="py-2.5 px-3 font-mono text-zinc-500 text-[11px]">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-bold text-white">{item.productName}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-zinc-300">{item.quantity} units</td>
                          <td className="py-2.5 px-3 text-right font-mono text-zinc-400">
                            {formatCurrency(item.unitPrice, currency)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                            {formatCurrency(item.total, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Shift Totals Summary Banner */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#14141a] to-[#121218] border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">
                  Official Shift Audit Summary
                </span>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Transactions: <strong className="text-white">{report.totalTransactions}</strong> • Items Dispatched:{' '}
                  <strong className="text-white">{report.totalItemsCount} units</strong>
                </p>
              </div>

              <div className="text-right flex items-baseline gap-2">
                <span className="text-xs font-bold text-zinc-400">Total Shift Sales:</span>
                <span className="text-lg sm:text-xl font-mono font-black text-emerald-400">
                  {formatCurrency(report.totalSales, currency)}
                </span>
              </div>
            </div>

            {/* Report Footer */}
            <div className="pt-2 text-center text-[11px] text-zinc-500 space-y-1">
              <p>
                {businessName} • Premium Lounge & Bar Service • Official Shift Audit Statement
              </p>
              <p>
                Generated by: <strong>Admin</strong> on {formatDate(report.generatedAt.toISOString())} at{' '}
                {formatTime(report.generatedAt.toISOString())}
              </p>
            </div>
          </div>

          {/* Modal Footer Controls */}
          <div className="p-4 sm:p-5 border-t border-zinc-800 bg-[#121216] flex items-center justify-between gap-3 shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors"
            >
              Close
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>

              <button
                onClick={handleDownloadPDF}
                disabled={isGeneratingPdf}
                className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-black bg-[#22C55E] hover:bg-[#1ea750] rounded-xl transition-all shadow-md shadow-emerald-950/40 disabled:opacity-50"
              >
                {isGeneratingPdf ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Preparing PDF...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden Pure-CSS Isolated Printable Shift Report (Active during window.print()) */}
      <div id="printable-shift-report" className="hidden print:block text-black bg-white">
        {/* Print Header */}
        <div className="border-b-2 border-slate-900 pb-3 mb-4">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-900">{businessName.toUpperCase()}</h1>
              <p className="text-xs text-slate-600">Premium Lounge & Bar Service — Cash & Shift Audit Statement</p>
              <h2 className="text-sm font-bold text-emerald-700 mt-1">
                {isActive ? 'ACTIVE / OPEN SHIFT AUDIT REPORT' : 'OFFICIAL SHIFT AUDIT & CASH RECONCILIATION'}
              </h2>
            </div>
            <div className="text-right text-xs text-slate-600 font-mono">
              <p>Generated: {formatDate(report.generatedAt.toISOString())}</p>
              <p>Time: {formatTime(report.generatedAt.toISOString())}</p>
              <p className="font-bold text-slate-900">STATUS: {report.shift.status.toUpperCase()}</p>
            </div>
          </div>
        </div>

        {/* Worker & Schedule Information Box */}
        <div className="grid grid-cols-3 gap-3 p-3 bg-slate-100 rounded-lg border border-slate-300 text-xs mb-4">
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase">Staff Member</span>
            <p className="font-bold text-slate-900 text-sm">{report.workerName}</p>
            <p className="text-slate-600">{report.workerRole}</p>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase">Shift Schedule</span>
            <p className="font-bold text-slate-900">{report.dateLabel}</p>
            <p className="text-slate-600">{report.timeLabel}</p>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase">Reconciliation Status</span>
            <p className="font-bold text-slate-900">
              {isActive
                ? 'PENDING SHIFT CLOSURE'
                : isShortage
                ? `SHORTAGE (${formatCurrency(report.discrepancy, currency)})`
                : isExcess
                ? `EXCESS (+${formatCurrency(report.discrepancy, currency)})`
                : 'BALANCED (Exact match)'}
            </p>
          </div>
        </div>

        {/* Executive Numbers Grid */}
        <div className="grid grid-cols-4 gap-2 mb-4 text-xs">
          <div className="p-2.5 bg-slate-50 border border-slate-300 rounded">
            <span className="text-[10px] text-slate-500 font-bold uppercase">Opening Float</span>
            <p className="font-mono font-bold text-slate-900 text-sm mt-0.5">
              {formatCurrency(report.openingCash, currency)}
            </p>
          </div>
          <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded">
            <span className="text-[10px] text-emerald-800 font-bold uppercase">Total Shift Sales</span>
            <p className="font-mono font-bold text-emerald-800 text-sm mt-0.5">
              {formatCurrency(report.totalSales, currency)}
            </p>
          </div>
          <div className="p-2.5 bg-slate-50 border border-slate-300 rounded">
            <span className="text-[10px] text-slate-500 font-bold uppercase">Expected Cash</span>
            <p className="font-mono font-bold text-slate-900 text-sm mt-0.5">
              {formatCurrency(report.expectedCash, currency)}
            </p>
          </div>
          <div className="p-2.5 bg-slate-50 border border-slate-300 rounded">
            <span className="text-[10px] text-slate-500 font-bold uppercase">Actual Ending Cash</span>
            <p className="font-mono font-bold text-slate-900 text-sm mt-0.5">
              {isActive ? 'Pending' : formatCurrency(report.actualEndingCash, currency)}
            </p>
          </div>
        </div>

        {/* Reconciliation & Payment 2-Columns */}
        <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
          <div className="border border-slate-300 rounded p-3">
            <h3 className="font-bold text-slate-900 pb-1 border-b border-slate-200 uppercase text-[11px]">
              Cash Drawer Reconciliation
            </h3>
            <div className="mt-2 space-y-1.5">
              <div className="flex justify-between">
                <span>Opening Cash Float:</span>
                <span className="font-mono font-bold">{formatCurrency(report.openingCash, currency)}</span>
              </div>
              <div className="flex justify-between text-emerald-700">
                <span>Cash Sales (+):</span>
                <span className="font-mono font-bold">+{formatCurrency(report.cashSales, currency)}</span>
              </div>
              <div className="flex justify-between font-bold border-t border-slate-200 pt-1">
                <span>Expected Cash Total:</span>
                <span className="font-mono">{formatCurrency(report.expectedCash, currency)}</span>
              </div>
              <div className="flex justify-between">
                <span>Actual Counted Cash:</span>
                <span className="font-mono font-bold">
                  {isActive ? 'Pending' : formatCurrency(report.actualEndingCash, currency)}
                </span>
              </div>
              <div className="flex justify-between font-bold border-t border-slate-300 pt-1 text-slate-900">
                <span>Cash Discrepancy:</span>
                <span className="font-mono">
                  {isActive
                    ? 'Pending'
                    : `${report.discrepancy && report.discrepancy >= 0 ? '+' : ''}${formatCurrency(
                        report.discrepancy,
                        currency
                      )} (${report.reconciliationStatus})`}
                </span>
              </div>
            </div>
          </div>

          <div className="border border-slate-300 rounded p-3">
            <h3 className="font-bold text-slate-900 pb-1 border-b border-slate-200 uppercase text-[11px]">
              Payment Channels Breakdown
            </h3>
            <div className="mt-2 space-y-1.5">
              <div className="flex justify-between">
                <span>Cash Sales:</span>
                <span className="font-mono font-bold">{formatCurrency(report.cashSales, currency)}</span>
              </div>
              <div className="flex justify-between">
                <span>POS (Card) Sales:</span>
                <span className="font-mono font-bold">{formatCurrency(report.posSales, currency)}</span>
              </div>
              <div className="flex justify-between">
                <span>Bank Transfers:</span>
                <span className="font-mono font-bold">{formatCurrency(report.transferSales, currency)}</span>
              </div>
              <div className="flex justify-between font-bold text-emerald-800 border-t border-slate-300 pt-1 text-sm">
                <span>Total Shift Revenue:</span>
                <span className="font-mono">{formatCurrency(report.totalSales, currency)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sales Table */}
        <div className="mb-4">
          <h3 className="font-bold text-slate-900 text-xs mb-1 uppercase">
            Sales During Shift ({report.totalTransactions} Transactions)
          </h3>
          <table className="w-full text-left text-xs border border-slate-300">
            <thead className="bg-slate-100 font-bold border-b border-slate-300">
              <tr>
                <th className="p-1.5">Receipt #</th>
                <th className="p-1.5">Time</th>
                <th className="p-1.5">Payment</th>
                <th className="p-1.5 text-right">Items</th>
                <th className="p-1.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono">
              {report.transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-3 text-center text-slate-500 italic">
                    NO SALES RECORDED — This shift has no completed sales transactions.
                  </td>
                </tr>
              ) : (
                report.transactions.map((sale) => (
                  <tr key={sale.id}>
                    <td className="p-1.5 font-bold text-slate-900">{sale.receipt_number}</td>
                    <td className="p-1.5 text-slate-600">{formatTime(sale.created_at)}</td>
                    <td className="p-1.5 font-sans font-semibold">{(sale.payment_method || 'CASH').toUpperCase()}</td>
                    <td className="p-1.5 text-right">{sale.items?.length || 1}</td>
                    <td className="p-1.5 text-right font-bold">{formatCurrency(sale.total, currency)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Items Table */}
        {report.itemsSold.length > 0 && (
          <div className="mb-4">
            <h3 className="font-bold text-slate-900 text-xs mb-1 uppercase">
              Item Details ({report.totalItemsCount} Total Units Dispatched)
            </h3>
            <table className="w-full text-left text-xs border border-slate-300">
              <thead className="bg-slate-100 font-bold border-b border-slate-300">
                <tr>
                  <th className="p-1.5">#</th>
                  <th className="p-1.5">Product Name</th>
                  <th className="p-1.5 text-right">Qty</th>
                  <th className="p-1.5 text-right">Unit Price</th>
                  <th className="p-1.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {report.itemsSold.map((item, idx) => (
                  <tr key={idx}>
                    <td className="p-1.5 font-mono text-slate-500">{idx + 1}</td>
                    <td className="p-1.5 font-bold text-slate-900">{item.productName}</td>
                    <td className="p-1.5 text-right font-mono">{item.quantity}</td>
                    <td className="p-1.5 text-right font-mono">{formatCurrency(item.unitPrice, currency)}</td>
                    <td className="p-1.5 text-right font-mono font-bold text-slate-900">
                      {formatCurrency(item.total, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Print Footer */}
        <div className="border-t border-slate-300 pt-3 text-center text-[10px] text-slate-500">
          <p>
            {businessName} • Official Shift Audit Statement • Generated by Admin on{' '}
            {formatDate(report.generatedAt.toISOString())} at {formatTime(report.generatedAt.toISOString())}
          </p>
        </div>
      </div>
    </>
  );
};
