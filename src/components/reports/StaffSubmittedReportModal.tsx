import React, { useState, useMemo } from 'react';
import {
  Download,
  Printer,
  X,
  User,
  Calendar,
  CreditCard,
  Banknote,
  Smartphone,
  TrendingUp,
  Receipt,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  ExternalLink,
  ShieldCheck,
  Clock,
  ChevronRight,
} from 'lucide-react';
import type {
  StaffSubmittedReport,
  SaleWithDetails,
  BusinessSettings,
} from '../../types';
import { formatCurrency, formatDate, formatTime } from '../../utils/formatters';
import { verifySubmittedReportAgainstDatabase } from '../../services/staffReportService';
import { generateAndDownloadSubmittedReportPDF } from '../../utils/submittedReportPdfGenerator';

interface StaffSubmittedReportModalProps {
  report: StaffSubmittedReport | null;
  sales: SaleWithDetails[];
  settings: BusinessSettings | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenReceipt?: (sale: SaleWithDetails) => void;
}

export const StaffSubmittedReportModal: React.FC<StaffSubmittedReportModalProps> = ({
  report,
  sales,
  settings,
  isOpen,
  onClose,
  onOpenReceipt,
}) => {
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [printMessage, setPrintMessage] = useState<string | null>(null);

  const verification = useMemo(() => {
    if (!report) return null;
    return verifySubmittedReportAgainstDatabase(report, sales);
  }, [report, sales]);

  // Matching transactions from actual database
  const matchingSales = useMemo(() => {
    if (!report) return [];
    const start = new Date(report.start_date);
    const end = new Date(report.end_date);
    return sales
      .filter((s) => {
        if (s.worker_id !== report.worker_id) return false;
        const d = new Date(s.created_at);
        return d >= start && d <= end;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [report, sales]);

  // Product sales breakdown
  const productBreakdown = useMemo(() => {
    if (matchingSales.length === 0) return [];
    const map = new Map<string, { name: string; qty: number; revenue: number }>();

    matchingSales.forEach((s) => {
      s.items?.forEach((item) => {
        const pName = (item as any).product_name || (item as any).product?.name || 'Drink / Bottle';
        const existing = map.get(pName) || { name: pName, qty: 0, revenue: 0 };
        existing.qty += Number(item.quantity || 0);
        existing.revenue += Number(item.total_price || item.unit_price * item.quantity || 0);
        map.set(pName, existing);
      });
    });

    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
  }, [matchingSales]);

  if (!isOpen || !report) return null;

  const currency = settings?.currency || 'NGN';

  const handleDownloadPdf = async () => {
    try {
      setDownloading(true);
      setDownloadSuccess(null);
      const res = await generateAndDownloadSubmittedReportPDF({
        report,
        verification,
        settings,
      });
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto print:p-0 print:bg-white print:static">
      <div
        id="printable-submitted-report"
        className="bg-[#0c0c0c] border border-zinc-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150 print:border-none print:shadow-none print:max-w-none print:max-h-none print:w-full print:bg-white print:text-black"
      >
        {/* Modal Header */}
        <div className="px-6 py-4.5 border-b border-zinc-800 bg-[#111111] flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-[#22C55E]">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-extrabold text-white tracking-tight">
                  Staff Sales Report
                </h2>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {report.period_label}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    report.status === 'SUBMITTED'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  }`}
                >
                  {report.status}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Submitted by <strong className="text-white">{report.worker_name}</strong> •{' '}
                {formatDate(report.submitted_at)} at {formatTime(report.submitted_at)}
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
              <span>{downloading ? 'Saving PDF...' : 'Download PDF'}</span>
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
          <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-6 py-2 text-xs font-semibold text-emerald-400 flex items-center gap-2 print:hidden">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{downloadSuccess}</span>
          </div>
        )}

        {printMessage && (
          <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-6 py-2 text-xs font-semibold text-emerald-400 print:hidden">
            {printMessage}
          </div>
        )}

        {/* Scrollable Report Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-zinc-300 print:overflow-visible print:p-4 print:text-black">
          {/* Printable Branded Header */}
          <div className="hidden print:block border-b-2 border-black pb-4 mb-4">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-black tracking-wider uppercase">
                  {settings?.worker_pos_name || settings?.business_name || 'MUNAJ BAR'}
                </h1>
                <p className="text-xs text-gray-600">Premium Lounge & Bar Service — Staff Sales Report</p>
                <p className="text-xs font-bold mt-1">
                  Worker: {report.worker_name} • Period: {report.period_label}
                </p>
              </div>
              <div className="text-right text-xs">
                <p>Submitted: {formatDate(report.submitted_at)} {formatTime(report.submitted_at)}</p>
                <p className="font-bold">STATUS: {report.status}</p>
              </div>
            </div>
          </div>

          {/* Database Verification Banner */}
          {verification && (
            <div
              className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                verification.isVerified
                  ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300 print:bg-gray-100 print:text-black print:border-gray-300'
                  : 'bg-amber-500/10 border-amber-500/25 text-amber-300 print:bg-yellow-50 print:text-black print:border-yellow-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                    verification.isVerified
                      ? 'bg-emerald-500/20 text-[#22C55E]'
                      : 'bg-amber-500/20 text-amber-400'
                  }`}
                >
                  {verification.isVerified ? (
                    <ShieldCheck className="w-5 h-5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-wide flex items-center gap-2">
                    {verification.isVerified
                      ? '✓ Database Verification Passed'
                      : '⚠ Report Data Requires Review'}
                  </h4>
                  <p className="text-xs opacity-90 mt-0.5">{verification.message}</p>
                </div>
              </div>

              {!verification.isVerified && (
                <div className="bg-black/40 px-3 py-1.5 rounded-xl border border-amber-500/20 text-xs font-mono shrink-0">
                  <span>Difference: </span>
                  <strong className="text-amber-400">
                    {verification.salesDifference >= 0 ? '+' : ''}
                    {formatCurrency(verification.salesDifference, currency)}
                  </strong>
                </div>
              )}
            </div>
          )}

          {/* Executive 4-KPI Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-[#141414] p-4.5 rounded-2xl border border-zinc-800 print:bg-gray-50 print:border-gray-300">
              <span className="text-[11px] font-bold text-zinc-400 print:text-gray-600 uppercase tracking-wider">
                Total Sales
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-[#22C55E] font-mono mt-1.5 print:text-black">
                {formatCurrency(report.sales_total, currency)}
              </h3>
              <p className="text-[11px] text-zinc-400 print:text-gray-500 mt-1">Gross sales generated</p>
            </div>

            <div className="bg-[#141414] p-4.5 rounded-2xl border border-zinc-800 print:bg-gray-50 print:border-gray-300">
              <span className="text-[11px] font-bold text-zinc-400 print:text-gray-600 uppercase tracking-wider">
                Completed Orders
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-white font-mono mt-1.5 print:text-black">
                {report.transactions_count}
              </h3>
              <p className="text-[11px] text-emerald-400 print:text-green-700 font-semibold mt-1">
                Receipts recorded
              </p>
            </div>

            <div className="bg-[#141414] p-4.5 rounded-2xl border border-zinc-800 print:bg-gray-50 print:border-gray-300">
              <span className="text-[11px] font-bold text-zinc-400 print:text-gray-600 uppercase tracking-wider">
                Items Sold
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-white font-mono mt-1.5 print:text-black">
                {report.items_count}
              </h3>
              <p className="text-[11px] text-zinc-400 print:text-gray-500 mt-1">Bottles & drinks</p>
            </div>

            <div className="bg-[#141414] p-4.5 rounded-2xl border border-zinc-800 print:bg-gray-50 print:border-gray-300">
              <span className="text-[11px] font-bold text-zinc-400 print:text-gray-600 uppercase tracking-wider">
                Average Sale
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-white font-mono mt-1.5 print:text-black">
                {formatCurrency(report.average_sale, currency)}
              </h3>
              <p className="text-[11px] text-zinc-400 print:text-gray-500 mt-1">Per transaction</p>
            </div>
          </div>

          {/* Payment Breakdown Cards */}
          <div className="bg-[#141414] p-5 rounded-2xl border border-zinc-800 print:bg-white print:border-gray-300">
            <h4 className="text-xs font-bold text-white print:text-black uppercase tracking-wider flex items-center gap-2 mb-3">
              <CreditCard className="w-4 h-4 text-[#22C55E]" />
              Payment Channels Received
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/60 print:bg-gray-50 print:border-gray-200">
                <div className="flex items-center gap-2 text-zinc-400 print:text-gray-600 text-xs">
                  <Banknote className="w-3.5 h-3.5 text-[#22C55E]" />
                  <span>Cash</span>
                </div>
                <p className="text-base font-black font-mono text-white print:text-black mt-1.5">
                  {formatCurrency(report.cash_sales, currency)}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/60 print:bg-gray-50 print:border-gray-200">
                <div className="flex items-center gap-2 text-zinc-400 print:text-gray-600 text-xs">
                  <CreditCard className="w-3.5 h-3.5 text-blue-400" />
                  <span>POS Terminal</span>
                </div>
                <p className="text-base font-black font-mono text-white print:text-black mt-1.5">
                  {formatCurrency(report.pos_sales, currency)}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/60 print:bg-gray-50 print:border-gray-200">
                <div className="flex items-center gap-2 text-zinc-400 print:text-gray-600 text-xs">
                  <Smartphone className="w-3.5 h-3.5 text-purple-400" />
                  <span>Bank Transfer</span>
                </div>
                <p className="text-base font-black font-mono text-white print:text-black mt-1.5">
                  {formatCurrency(report.transfer_sales, currency)}
                </p>
              </div>
            </div>
          </div>

          {/* Top Products Table */}
          {productBreakdown.length > 0 && (
            <div className="bg-[#141414] p-5 rounded-2xl border border-zinc-800 print:bg-white print:border-gray-300">
              <h4 className="text-xs font-bold text-white print:text-black uppercase tracking-wider flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-[#22C55E]" />
                Top Items Sold by Attendant
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 print:border-gray-300 text-zinc-400 print:text-gray-600 font-bold">
                      <th className="pb-2">Product Name</th>
                      <th className="pb-2 text-right">Quantity Sold</th>
                      <th className="pb-2 text-right">Sales Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/40 print:divide-gray-200">
                    {productBreakdown.map((p) => (
                      <tr key={p.name} className="hover:bg-zinc-900/40">
                        <td className="py-2.5 font-bold text-white print:text-black">{p.name}</td>
                        <td className="py-2.5 text-right font-mono text-zinc-300 print:text-black">{p.qty}</td>
                        <td className="py-2.5 text-right font-mono font-bold text-emerald-400 print:text-black">
                          {formatCurrency(p.revenue, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Matching Sales Transactions List */}
          <div className="bg-[#141414] p-5 rounded-2xl border border-zinc-800 print:bg-white print:border-gray-300">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 print:border-gray-300 mb-3">
              <div>
                <h4 className="text-xs font-bold text-white print:text-black uppercase tracking-wider flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-[#22C55E]" />
                  Sales Receipts in Period ({matchingSales.length})
                </h4>
                <p className="text-[11px] text-zinc-400 print:text-gray-500">
                  Individual transactions recorded in database for this attendant.
                </p>
              </div>
            </div>

            {matchingSales.length === 0 ? (
              <p className="text-xs text-zinc-500 py-6 text-center">
                No matching sales found in database for this specific period.
              </p>
            ) : (
              <div className="divide-y divide-zinc-800/40 print:divide-gray-200 max-h-64 overflow-y-auto">
                {matchingSales.slice(0, 15).map((sale) => (
                  <div
                    key={sale.id}
                    className="py-2.5 flex items-center justify-between hover:bg-zinc-900/40 px-2 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-bold text-white print:text-black">
                        {sale.receipt_number || (sale.id ? `MB-${sale.id.slice(0, 6).toUpperCase()}` : 'MB-SALE')}
                      </span>
                      <span className="text-[11px] text-zinc-400 print:text-gray-500">
                        {formatTime(sale.created_at)}
                      </span>
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 print:border-gray-300 print:text-black">
                        {sale.payment_method}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-bold text-[#22C55E] print:text-black">
                        {formatCurrency(Number(sale.total || 0), currency)}
                      </span>
                      {onOpenReceipt && (
                        <button
                          onClick={() => onOpenReceipt(sale)}
                          className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] font-bold text-zinc-300 print:hidden transition-colors cursor-pointer"
                        >
                          View Receipt
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-[#111111] border-t border-zinc-800 flex justify-between items-center print:hidden">
          <span className="text-xs text-zinc-500 font-mono">Report ID: {report.id}</span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
};
