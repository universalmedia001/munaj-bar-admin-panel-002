import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, 
  Calendar, 
  Download, 
  Printer, 
  Send, 
  RefreshCw, 
  Banknote, 
  CreditCard, 
  ArrowRightLeft, 
  ReceiptText, 
  TrendingUp, 
  ShoppingBag, 
  Layers, 
  Check, 
  AlertCircle,
  Eye,
  Clock,
  Filter,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWorkerBranding } from '../context/WorkerBrandingContext';
import { saleService } from '../services/saleService';
import { SaleWithItems } from '../types';
import { formatNaira, formatDate, formatTime, formatDateTime, formatReceiptDate, getSaleSeller } from '../utils/formatters';
import { downloadCashierReportPDF, downloadReceiptPDF, CashierReportPeriodBreakdown } from '../utils/pdfGenerator';
import { receiptService } from '../services/receiptService';
import { BestSellingProductsTable } from './BestSellingProductsTable';

export type ReportPeriodFilter = 
  | 'today' 
  | 'yesterday' 
  | 'week' 
  | 'last7' 
  | 'month' 
  | 'last30' 
  | 'year' 
  | 'all' 
  | 'custom';

interface CashierSalesReportViewProps {
  onSelectSaleForReprint: (sale: SaleWithItems) => void;
}

export const CashierSalesReportView: React.FC<CashierSalesReportViewProps> = ({ onSelectSaleForReprint }) => {
  const { profile } = useAuth();
  const { workerSiteName, workerPrimaryColor, textColor, businessLogo } = useWorkerBranding();
  const workerName = profile?.full_name || 'Cashier';

  // Payment Breakdown is explicitly visible ONLY to financial-authorized roles:
  // Cashier, Admin, and Manager.
  // All Bar worker roles (bar_worker, bar_staff, bar, bartender) remain completely hidden.
  const canViewPaymentBreakdown = Boolean(
    profile?.role === 'cashier' ||
    profile?.role === 'admin' ||
    profile?.role === 'manager'
  );

  const [period, setPeriod] = useState<ReportPeriodFilter>('today');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1); // 1st of this month
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [sales, setSales] = useState<SaleWithItems[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmittingToAdmin, setIsSubmittingToAdmin] = useState<boolean>(false);
  const [adminSubmissionSuccess, setAdminSubmissionSuccess] = useState<boolean>(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);
  const [downloadingReceiptId, setDownloadingReceiptId] = useState<string | null>(null);
  const [downloadSuccessReceiptId, setDownloadSuccessReceiptId] = useState<string | null>(null);

  // 1. Fetch sales for the selected period
  const loadReportData = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      setAdminSubmissionSuccess(false);

      const customRange = period === 'custom' ? { startDate: customStartDate, endDate: customEndDate } : undefined;
      const data = await saleService.getWorkerSales(period, customRange);
      setSales(data);
    } catch (err: any) {
      console.error('Failed to load cashier sales report:', err);
      setErrorMessage(err?.message || 'Unable to load completed sales from database.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, [period]);

  // Real-time subscription to auto-update report whenever a sale is completed or modified
  useEffect(() => {
    const unsubscribe = saleService.subscribeToAllCompletedSales(() => {
      loadReportData();
    });
    return () => {
      unsubscribe();
    };
  }, [period, customStartDate, customEndDate]);

  // 2. Computed Metrics
  const totalSales = useMemo(() => {
    return sales.reduce((sum, s) => sum + Number(s.total || 0), 0);
  }, [sales]);

  const totalTransactions = sales.length;

  const totalItemsSold = useMemo(() => {
    return sales.reduce((sum, s) => {
      const itemsCount = s.items?.reduce((itemSum, item) => itemSum + (Number(item.quantity) || 1), 0) || 0;
      return sum + itemsCount;
    }, 0);
  }, [sales]);

  const averageSale = totalTransactions > 0 ? totalSales / totalTransactions : 0;

  // 3. Payment Method Breakdown
  const paymentBreakdown = useMemo(() => {
    const cashSales = sales.filter((s) => s.payment_method?.toLowerCase() === 'cash');
    const posSales = sales.filter((s) => s.payment_method?.toLowerCase() === 'pos');
    const transferSales = sales.filter((s) => s.payment_method?.toLowerCase() === 'transfer');

    const cashTotal = cashSales.reduce((sum, s) => sum + Number(s.total || 0), 0);
    const posTotal = posSales.reduce((sum, s) => sum + Number(s.total || 0), 0);
    const transferTotal = transferSales.reduce((sum, s) => sum + Number(s.total || 0), 0);

    return {
      cash: { count: cashSales.length, total: cashTotal },
      pos: { count: posSales.length, total: posTotal },
      transfer: { count: transferSales.length, total: transferTotal },
      total: totalSales,
    };
  }, [sales, totalSales]);

  // 4. Period Label Calculation
  const periodLabel = useMemo(() => {
    const now = new Date();
    switch (period) {
      case 'today':
        return formatDate(now.toISOString());
      case 'yesterday': {
        const y = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        return formatDate(y.toISOString());
      }
      case 'week': {
        const d = new Date(now);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const startOfWeek = new Date(d.getFullYear(), d.getMonth(), diff);
        return `This Week (${formatDate(startOfWeek.toISOString())} — ${formatDate(now.toISOString())})`;
      }
      case 'last7':
        return 'Last 7 Days';
      case 'month':
        return now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
      case 'last30':
        return 'Last 30 Days';
      case 'year':
        return `${now.getFullYear()} Annual Report`;
      case 'custom':
        return `${customStartDate} — ${customEndDate}`;
      case 'all':
      default:
        return 'All-Time';
    }
  }, [period, customStartDate, customEndDate]);

  // 5. Chronological Period Breakdown for Weekly / Monthly / Yearly views
  const periodBreakdown = useMemo<CashierReportPeriodBreakdown[]>(() => {
    if (sales.length === 0) return [];

    if (period === 'week' || period === 'last7') {
      // Group by Day of week / date
      const map: Record<string, { label: string; count: number; total: number; timestamp: number }> = {};
      sales.forEach((s) => {
        const dateObj = new Date(s.created_at);
        const dayKey = dateObj.toISOString().split('T')[0];
        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' });
        
        if (!map[dayKey]) {
          map[dayKey] = { label: dayName, count: 0, total: 0, timestamp: dateObj.getTime() };
        }
        map[dayKey].count += 1;
        map[dayKey].total += Number(s.total || 0);
      });

      return Object.values(map).sort((a, b) => a.timestamp - b.timestamp);
    }

    if (period === 'month' || period === 'last30') {
      // Group by day of month (e.g. 01 Aug, 02 Aug...)
      const map: Record<string, { label: string; count: number; total: number; timestamp: number }> = {};
      sales.forEach((s) => {
        const dateObj = new Date(s.created_at);
        const dayKey = dateObj.toISOString().split('T')[0];
        const dayFormatted = dateObj.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
        
        if (!map[dayKey]) {
          map[dayKey] = { label: dayFormatted, count: 0, total: 0, timestamp: dateObj.getTime() };
        }
        map[dayKey].count += 1;
        map[dayKey].total += Number(s.total || 0);
      });

      return Object.values(map).sort((a, b) => a.timestamp - b.timestamp);
    }

    if (period === 'year') {
      // Group by Month (January, February...)
      const map: Record<string, { label: string; count: number; total: number; monthIndex: number }> = {};
      sales.forEach((s) => {
        const dateObj = new Date(s.created_at);
        const monthIndex = dateObj.getMonth();
        const monthName = dateObj.toLocaleDateString('en-US', { month: 'long' });
        
        if (!map[monthName]) {
          map[monthName] = { label: monthName, count: 0, total: 0, monthIndex };
        }
        map[monthName].count += 1;
        map[monthName].total += Number(s.total || 0);
      });

      return Object.values(map).sort((a, b) => a.monthIndex - b.monthIndex);
    }

    if (period === 'custom' || period === 'all') {
      // Group by date if spans multiple days
      const map: Record<string, { label: string; count: number; total: number; timestamp: number }> = {};
      sales.forEach((s) => {
        const dateObj = new Date(s.created_at);
        const dayKey = dateObj.toISOString().split('T')[0];
        const formatted = dateObj.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
        
        if (!map[dayKey]) {
          map[dayKey] = { label: formatted, count: 0, total: 0, timestamp: dateObj.getTime() };
        }
        map[dayKey].count += 1;
        map[dayKey].total += Number(s.total || 0);
      });

      return Object.values(map).sort((a, b) => a.timestamp - b.timestamp);
    }

    return [];
  }, [sales, period]);

  // 6. Handler: Download PDF Report
  const handleDownloadReportPDF = async () => {
    try {
      setIsDownloadingPdf(true);
      await downloadCashierReportPDF({
        cashierName: workerName,
        periodLabel,
        periodType: period,
        startDateStr: customStartDate,
        endDateStr: customEndDate,
        totalSales,
        totalTransactions,
        totalItems: totalItemsSold,
        averageSale,
        paymentBreakdown,
        breakdown: periodBreakdown,
        transactions: sales,
        brandName: workerSiteName,
        primaryColor: workerPrimaryColor,
      });
    } catch (err) {
      console.error('PDF download error:', err);
      alert('Could not generate PDF report. Please try again.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // 7. Handler: Print Report
  const handlePrintReport = () => {
    window.print();
  };

  // 8. Handler: Send Report to Admin
  const handleSendReportToAdmin = async () => {
    if (isSubmittingToAdmin) return;
    try {
      setIsSubmittingToAdmin(true);
      await saleService.submitReportToAdmin({
        workerId: profile?.id,
        workerRole: profile?.role || 'Cashier',
        period,
        workerName,
        periodLabel,
        totalSales,
        totalTransactions,
        totalItems: totalItemsSold,
        paymentBreakdown: {
          cash: paymentBreakdown.cash.total,
          pos: paymentBreakdown.pos.total,
          transfer: paymentBreakdown.transfer.total,
        },
      });
      setAdminSubmissionSuccess(true);
      setTimeout(() => {
        setAdminSubmissionSuccess(false);
      }, 6000);
    } catch (err: any) {
      console.error('Failed to submit report to Admin:', err);
      alert('Could not submit report to admin. Please verify internet connection.');
    } finally {
      setIsSubmittingToAdmin(false);
    }
  };

  // 9. Handler: Direct Receipt PDF Download from History Table
  const handleDownloadSingleReceipt = async (sale: SaleWithItems) => {
    try {
      setDownloadingReceiptId(sale.id);
      await receiptService.logReceiptPrint(sale.id).catch(() => {});
      const seller = getSaleSeller(sale);
      await downloadReceiptPDF(sale, {
        isReprint: true,
        workerNameFallback: seller.name,
        printedBy: profile?.full_name?.trim(),
        brandName: workerSiteName,
        primaryColor: workerPrimaryColor,
        logoUrl: businessLogo,
      });
      setDownloadSuccessReceiptId(sale.id);
      setTimeout(() => {
        setDownloadSuccessReceiptId((prev) => (prev === sale.id ? null : prev));
      }, 3000);
    } catch (err) {
      console.error('Receipt download error:', err);
    } finally {
      setDownloadingReceiptId(null);
    }
  };

  const periodOptions: { id: ReportPeriodFilter; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'week', label: 'This Week' },
    { id: 'last7', label: 'Last 7 Days' },
    { id: 'month', label: 'This Month' },
    { id: 'last30', label: 'Last 30 Days' },
    { id: 'year', label: 'This Year' },
    { id: 'all', label: 'All Time' },
    { id: 'custom', label: 'Custom Range' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-6">
      
      {/* Print-specific style override */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-cashier-sales-report, #printable-cashier-sales-report * {
            visibility: visible !important;
          }
          #printable-cashier-sales-report {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: white !important;
            color: black !important;
            padding: 20px !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* TOP HEADER SECTION */}
      <div className="bg-[#111111] border border-[#222222] rounded-2xl p-4 sm:p-6 shadow-xl no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Title & Worker Info */}
          <div className="flex items-center space-x-3.5">
            <div 
              className="w-12 h-12 rounded-2xl border flex items-center justify-center font-black text-xl shadow-lg shrink-0"
              style={{
                backgroundColor: 'rgba(var(--worker-primary-rgb, 183, 255, 0), 0.15)',
                borderColor: 'rgba(var(--worker-primary-rgb, 183, 255, 0), 0.3)',
                color: workerPrimaryColor,
              }}
            >
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-wide">
                  SALES REPORT
                </h1>
                <span 
                  className="text-[10px] sm:text-xs font-bold px-2.5 py-0.5 rounded-full border uppercase"
                  style={{
                    backgroundColor: 'rgba(var(--worker-primary-rgb, 183, 255, 0), 0.15)',
                    borderColor: 'rgba(var(--worker-primary-rgb, 183, 255, 0), 0.3)',
                    color: workerPrimaryColor,
                  }}
                >
                  Cashier Performance
                </span>
              </div>
              <p className="text-xs text-[#A1A1AA] mt-0.5">
                Cashier: <span className="font-bold text-white">{workerName}</span> • Real-time {workerSiteName} Revenue & Receipts
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              id="report-download-pdf-btn"
              onClick={handleDownloadReportPDF}
              disabled={isDownloadingPdf}
              className="bg-[#1c1c1c] hover:bg-[#252525] border border-[#2e2e2e] text-white text-xs font-bold px-3.5 py-2.5 rounded-xl flex items-center space-x-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
            >
              <Download 
                className={`w-4 h-4 ${isDownloadingPdf ? 'animate-bounce' : ''}`}
                style={{ color: workerPrimaryColor }}
              />
              <span>{isDownloadingPdf ? 'Generating...' : 'DOWNLOAD PDF'}</span>
            </button>

            <button
              id="report-print-btn"
              onClick={handlePrintReport}
              className="bg-[#1c1c1c] hover:bg-[#252525] border border-[#2e2e2e] text-white text-xs font-bold px-3.5 py-2.5 rounded-xl flex items-center space-x-2 transition-all cursor-pointer shadow-md"
            >
              <Printer className="w-4 h-4 text-blue-400" />
              <span>PRINT</span>
            </button>

            <button
              id="report-send-admin-btn"
              onClick={handleSendReportToAdmin}
              disabled={isSubmittingToAdmin}
              style={adminSubmissionSuccess ? {} : {
                backgroundColor: workerPrimaryColor,
                color: textColor,
                boxShadow: `0 8px 20px -4px rgba(var(--worker-primary-rgb, 183, 255, 0), 0.35)`,
              }}
              className={`text-xs font-bold px-4 py-2.5 rounded-xl flex items-center space-x-2 transition-all cursor-pointer shadow-lg disabled:opacity-50 ${
                adminSubmissionSuccess
                  ? 'bg-green-600 text-white border border-green-400 shadow-green-900/40'
                  : 'font-extrabold active:scale-95'
              }`}
            >
              {adminSubmissionSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>✓ REPORT SENT TO ADMIN</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 fill-current" />
                  <span>{isSubmittingToAdmin ? 'Sending...' : 'SEND REPORT TO ADMIN'}</span>
                </>
              )}
            </button>

            <button
              onClick={loadReportData}
              title="Refresh Report"
              className="p-2.5 rounded-xl bg-[#1c1c1c] hover:bg-[#252525] border border-[#2e2e2e] text-[#A1A1AA] hover:text-white transition-colors cursor-pointer"
            >
              <RefreshCw 
                className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
                style={isLoading ? { color: workerPrimaryColor } : {}}
              />
            </button>
          </div>

        </div>

        {/* PERIOD SELECTOR TABS */}
        <div className="mt-5 pt-4 border-t border-[#1f1f1f] flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar pb-1">
            {periodOptions.map((opt) => {
              const isSelected = period === opt.id;
              return (
                <button
                  key={opt.id}
                  id={`report-period-${opt.id}-btn`}
                  onClick={() => setPeriod(opt.id)}
                  style={isSelected ? {
                    backgroundColor: workerPrimaryColor,
                    color: textColor,
                    boxShadow: `0 4px 14px 0 rgba(var(--worker-primary-rgb, 183, 255, 0), 0.3)`,
                  } : {}}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    isSelected
                      ? ''
                      : 'bg-[#181818] text-[#A1A1AA] hover:text-white hover:bg-[#222222] border border-[#262626]'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div 
            className="text-xs font-bold px-3 py-1.5 rounded-xl border shrink-0 self-start md:self-auto"
            style={{
              backgroundColor: 'rgba(var(--worker-primary-rgb, 183, 255, 0), 0.1)',
              borderColor: 'rgba(var(--worker-primary-rgb, 183, 255, 0), 0.2)',
              color: workerPrimaryColor,
            }}
          >
            Period: {periodLabel}
          </div>
        </div>

        {/* CUSTOM DATE RANGE FILTER (When Custom is active) */}
        {period === 'custom' && (
          <div className="mt-4 p-4 rounded-xl bg-[#161616] border border-[#2a2a2a] flex flex-col sm:flex-row items-end gap-3 animate-in fade-in-50 duration-150">
            <div className="flex-1 w-full">
              <label className="block text-[11px] font-bold uppercase text-[#A1A1AA] mb-1.5">
                Start Date
              </label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full bg-[#1e1e1e] border border-[#333333] rounded-xl px-3.5 py-2 text-white text-xs font-medium focus:outline-none focus:border-green-500"
              />
            </div>

            <div className="flex-1 w-full">
              <label className="block text-[11px] font-bold uppercase text-[#A1A1AA] mb-1.5">
                End Date
              </label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full bg-[#1e1e1e] border border-[#333333] rounded-xl px-3.5 py-2 text-white text-xs font-medium focus:outline-none focus:border-green-500"
              />
            </div>

            <button
              onClick={loadReportData}
              style={{
                backgroundColor: workerPrimaryColor,
                color: textColor,
                boxShadow: `0 4px 14px 0 rgba(var(--worker-primary-rgb, 183, 255, 0), 0.3)`,
              }}
              className="w-full sm:w-auto font-extrabold text-xs px-5 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap active:scale-95"
            >
              GENERATE REPORT
            </button>
          </div>
        )}

      </div>

      {/* PRINTABLE CONTAINER (This portion will be rendered and printed) */}
      <div id="printable-cashier-sales-report" className="space-y-6">
        
        {/* Printable Header (Visible only when printed) */}
        <div className="hidden print:block pb-4 mb-4 border-b border-black text-black">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-black">{workerSiteName}</h1>
              <p className="text-xs text-gray-700">Premium Lounge & Bar Service • Cashier Personal Sales Report</p>
            </div>
            <div className="text-right text-xs">
              <p><strong>Cashier:</strong> {workerName}</p>
              <p><strong>Period:</strong> {periodLabel}</p>
              <p><strong>Date:</strong> {new Date().toLocaleDateString('en-GB')}</p>
            </div>
          </div>
        </div>

        {/* 0. CASHIER DAILY STOCK TRACKING & PRODUCT ANALYSIS */}
        <BestSellingProductsTable initialPeriod={period === 'custom' ? 'today' : (period as any)} />

        {/* 1. PERSONAL SALES SUMMARY CARDS (Financial cards visible ONLY to Cashier, Admin, Manager) */}
        <div className={`grid grid-cols-2 ${canViewPaymentBreakdown ? 'lg:grid-cols-4' : 'lg:grid-cols-2'} gap-3 sm:gap-4`}>
          
          {/* Card 1: Total Sales (Financial - Visible only to Cashiers, Admins, and Managers) */}
          {canViewPaymentBreakdown && (
            <div className="bg-[#111111] border border-[#222222] rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#A1A1AA]">
                  TOTAL SALES
                </span>
                <div 
                  className="w-8 h-8 rounded-xl flex items-center justify-center font-bold"
                  style={{
                    backgroundColor: 'rgba(var(--worker-primary-rgb, 183, 255, 0), 0.15)',
                    color: workerPrimaryColor,
                  }}
                >
                  ₦
                </div>
              </div>
              <div 
                className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight"
                style={{ color: workerPrimaryColor }}
              >
                {formatNaira(totalSales)}
              </div>
              <p className="text-[10px] text-[#71717A] mt-1 font-medium">
                Completed authorized sales
              </p>
            </div>
          )}

          {/* Card 2: Total Transactions */}
          <div className="bg-[#111111] border border-[#222222] rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#A1A1AA]">
                TOTAL TRANSACTIONS
              </span>
              <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center font-bold">
                <ReceiptText className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">
              {totalTransactions}
            </div>
            <p className="text-[10px] text-[#71717A] mt-1 font-medium">
              Receipt orders generated
            </p>
          </div>

          {/* Card 3: Items Sold */}
          <div className="bg-[#111111] border border-[#222222] rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#A1A1AA]">
                ITEMS SOLD
              </span>
              <div className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center font-bold">
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">
              {totalItemsSold}
            </div>
            <p className="text-[10px] text-[#71717A] mt-1 font-medium">
              Beverages & products served
            </p>
          </div>

          {/* Card 4: Average Sale (Financial - Visible only to Cashiers, Admins, and Managers) */}
          {canViewPaymentBreakdown && (
            <div className="bg-[#111111] border border-[#222222] rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#A1A1AA]">
                  AVERAGE SALE
                </span>
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center font-bold">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl lg:text-3xl font-black text-amber-400 tracking-tight">
                {formatNaira(averageSale)}
              </div>
              <p className="text-[10px] text-[#71717A] mt-1 font-medium">
                Average revenue per customer
              </p>
            </div>
          )}

        </div>

        {/* 2. PAYMENT METHOD BREAKDOWN (Restricted to Cashiers, Admins, and Managers; hidden for Bar workers) */}
        {canViewPaymentBreakdown && (
          <div className="bg-[#111111] border border-[#222222] rounded-2xl p-4 sm:p-6 shadow-xl">
            <div className="flex items-center space-x-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl bg-green-500/15 text-green-400 flex items-center justify-center font-bold">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white">
                  PAYMENT BREAKDOWN
                </h2>
                <p className="text-xs text-[#A1A1AA]">
                  Distribution of revenue collected across Cash, POS terminal, and Bank Transfers
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              
              {/* CASH */}
              <div className="bg-[#161616] border border-[#262626] rounded-xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <span className="inline-flex items-center space-x-1.5 text-xs font-extrabold uppercase text-green-400 bg-green-500/15 px-2.5 py-1 rounded-md border border-green-500/30">
                    <Banknote className="w-3.5 h-3.5" />
                    <span>CASH</span>
                  </span>
                  <span className="text-xs text-[#71717A] font-bold">
                    {paymentBreakdown.cash.count} sales
                  </span>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-black text-white">
                    {formatNaira(paymentBreakdown.cash.total)}
                  </div>
                  <div className="mt-1 text-[11px] text-[#A1A1AA]">
                    {totalSales > 0 ? ((paymentBreakdown.cash.total / totalSales) * 100).toFixed(1) : 0}% of period revenue
                  </div>
                </div>
              </div>

              {/* POS */}
              <div className="bg-[#161616] border border-[#262626] rounded-xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <span className="inline-flex items-center space-x-1.5 text-xs font-extrabold uppercase text-cyan-400 bg-cyan-500/15 px-2.5 py-1 rounded-md border border-cyan-500/30">
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>POS CARD</span>
                  </span>
                  <span className="text-xs text-[#71717A] font-bold">
                    {paymentBreakdown.pos.count} sales
                  </span>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-black text-white">
                    {formatNaira(paymentBreakdown.pos.total)}
                  </div>
                  <div className="mt-1 text-[11px] text-[#A1A1AA]">
                    {totalSales > 0 ? ((paymentBreakdown.pos.total / totalSales) * 100).toFixed(1) : 0}% of period revenue
                  </div>
                </div>
              </div>

              {/* TRANSFER */}
              <div className="bg-[#161616] border border-[#262626] rounded-xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <span className="inline-flex items-center space-x-1.5 text-xs font-extrabold uppercase text-amber-400 bg-amber-500/15 px-2.5 py-1 rounded-md border border-amber-500/30">
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>TRANSFER</span>
                  </span>
                  <span className="text-xs text-[#71717A] font-bold">
                    {paymentBreakdown.transfer.count} sales
                  </span>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-black text-white">
                    {formatNaira(paymentBreakdown.transfer.total)}
                  </div>
                  <div className="mt-1 text-[11px] text-[#A1A1AA]">
                    {totalSales > 0 ? ((paymentBreakdown.transfer.total / totalSales) * 100).toFixed(1) : 0}% of period revenue
                  </div>
                </div>
              </div>

            </div>

            {/* Summary Total Row */}
            <div className="mt-4 pt-3 border-t border-[#222222] flex items-center justify-between text-sm sm:text-base">
              <span className="font-extrabold text-white">
                TOTAL REVENUE COLLECTED:
              </span>
              <span className="text-lg sm:text-xl font-black text-green-400">
                {formatNaira(totalSales)}
              </span>
            </div>
          </div>
        )}

        {/* 3. PERIOD BREAKDOWN (Daily / Monthly list when multiple days apply - Financial) */}
        {canViewPaymentBreakdown && periodBreakdown.length > 0 && (
          <div className="bg-[#111111] border border-[#222222] rounded-2xl p-4 sm:p-6 shadow-xl">
            <div className="flex items-center space-x-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center font-bold">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white">
                  {period === 'year' ? 'MONTHLY BREAKDOWN' : 'DAILY BREAKDOWN'}
                </h2>
                <p className="text-xs text-[#A1A1AA]">
                  Chronological breakdown of sales activity across {periodLabel}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#262626] text-[#A1A1AA] uppercase tracking-wider font-bold">
                    <th className="py-2.5 px-3">Period / Date</th>
                    <th className="py-2.5 px-3 text-center">Orders</th>
                    <th className="py-2.5 px-3 text-right">Total Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e1e1e]">
                  {periodBreakdown.map((row, idx) => (
                    <tr key={idx} className="hover:bg-[#161616] transition-colors">
                      <td className="py-2.5 px-3 font-bold text-white">
                        {row.label}
                      </td>
                      <td className="py-2.5 px-3 text-center text-[#D4D4D8]">
                        {row.count} {row.count === 1 ? 'sale' : 'sales'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-green-400">
                        {formatNaira(row.total)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-[#2c2c2c] bg-[#161616] font-black">
                    <td className="py-3 px-3 text-white uppercase">
                      {period === 'year' ? 'YEAR TOTAL' : 'PERIOD TOTAL'}
                    </td>
                    <td className="py-3 px-3 text-center text-white">
                      {totalTransactions} sales ({totalItemsSold} items)
                    </td>
                    <td className="py-3 px-3 text-right text-green-400 text-sm">
                      {formatNaira(totalSales)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. SALES TRANSACTION HISTORY */}
        <div className="bg-[#111111] border border-[#222222] rounded-2xl p-4 sm:p-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-green-500/15 text-green-400 flex items-center justify-center font-bold">
                <ReceiptText className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white">
                  SALES HISTORY
                </h2>
                <p className="text-xs text-[#A1A1AA]">
                  Completed transactions for {periodLabel} ({sales.length} records)
                </p>
              </div>
            </div>

            <div className="text-xs text-[#A1A1AA]">
              Click any transaction to view or download its thermal receipt
            </div>
          </div>

          {isLoading && sales.length === 0 ? (
            <div className="p-12 text-center text-[#71717A] bg-[#141414] rounded-xl border border-[#222222] space-y-3">
              <RefreshCw className="w-8 h-8 text-green-400 animate-spin mx-auto" />
              <p className="text-xs font-semibold text-[#A1A1AA]">
                Loading completed transactions from database...
              </p>
            </div>
          ) : errorMessage ? (
            <div className="p-8 text-center text-[#71717A] bg-[#141414] rounded-xl border border-red-500/30 space-y-2">
              <p className="text-xs font-bold text-red-400">{errorMessage}</p>
              <button
                onClick={loadReportData}
                className="px-3 py-1.5 rounded-lg bg-[#222222] hover:bg-[#2c2c2c] text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Retry Loading Sales
              </button>
            </div>
          ) : sales.length === 0 ? (
            <div className="p-12 text-center text-[#71717A] bg-[#141414] rounded-xl border border-[#222222]">
              <div className="w-12 h-12 rounded-2xl bg-[#181818] border border-[#262626] flex items-center justify-center mx-auto mb-3 text-[#555555]">
                <ReceiptText className="w-6 h-6 stroke-[1.5]" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">NO SALES RECORDED</h3>
              <p className="text-xs text-[#888888] max-w-sm mx-auto">
                No completed sales were found in the database for the selected period ({periodLabel}).
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#262626] text-[#A1A1AA] uppercase tracking-wider font-bold bg-[#161616]">
                    <th className="py-3 px-3">Receipt</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Time</th>
                    <th className="py-3 px-3">Sold By</th>
                    <th className="py-3 px-3">Payment</th>
                    <th className="py-3 px-3 text-center">Items</th>
                    <th className="py-3 px-3 text-right">Total</th>
                    <th className="py-3 px-3 text-right no-print">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e1e1e]">
                  {sales.map((sale) => {
                    const itemsCount = sale.items?.reduce((s, it) => s + (Number(it.quantity) || 1), 0) || 0;
                    const method = (sale.payment_method || 'cash').toLowerCase();
                    const seller = getSaleSeller(sale);

                    return (
                      <tr 
                        key={sale.id}
                        className="hover:bg-[#181818] transition-colors group"
                      >
                        {/* Receipt Number */}
                        <td className="py-3 px-3 font-mono font-bold text-white">
                          <button
                            onClick={() => onSelectSaleForReprint(sale)}
                            className="hover:text-green-400 underline decoration-dotted underline-offset-4 cursor-pointer text-left"
                            title="Click to view receipt"
                          >
                            {sale.receipt_number || 'MB-000000'}
                          </button>
                        </td>

                        {/* Date */}
                        <td className="py-3 px-3 text-[#D4D4D8]">
                          {formatReceiptDate(sale.created_at)}
                        </td>

                        {/* Time */}
                        <td className="py-3 px-3 text-[#A1A1AA]">
                          {formatTime(sale.created_at)}
                        </td>

                        {/* Sold By */}
                        <td className="py-3 px-3 text-[#D4D4D8]">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-semibold text-white">{seller.name}</span>
                            <span className="text-[10px] bg-[#222222] text-[#888888] px-1.5 py-0.2 rounded border border-[#333333] font-medium">{seller.role}</span>
                          </div>
                        </td>

                        {/* Payment Method Badge */}
                        <td className="py-3 px-3">
                          {method === 'cash' && (
                            <span className="inline-flex items-center space-x-1 bg-green-500/15 text-green-400 border border-green-500/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                              <Banknote className="w-3 h-3" />
                              <span>Cash</span>
                            </span>
                          )}
                          {method === 'pos' && (
                            <span className="inline-flex items-center space-x-1 bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                              <CreditCard className="w-3 h-3" />
                              <span>POS</span>
                            </span>
                          )}
                          {method === 'transfer' && (
                            <span className="inline-flex items-center space-x-1 bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                              <ArrowRightLeft className="w-3 h-3" />
                              <span>Transfer</span>
                            </span>
                          )}
                        </td>

                        {/* Items Count */}
                        <td className="py-3 px-3 text-center text-[#D4D4D8]">
                          {itemsCount}
                        </td>

                        {/* Total */}
                        <td className="py-3 px-3 text-right font-black text-green-400 text-sm">
                          {formatNaira(sale.total)}
                        </td>

                        {/* Actions (No print) */}
                        <td className="py-3 px-3 text-right no-print">
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              onClick={() => onSelectSaleForReprint(sale)}
                              title="View & Reprint Receipt"
                              className="p-1.5 rounded-lg bg-[#222222] hover:bg-[#2c2c2c] text-[#A1A1AA] hover:text-white transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleDownloadSingleReceipt(sale)}
                              title="Download PDF Receipt"
                              disabled={downloadingReceiptId === sale.id}
                              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                downloadSuccessReceiptId === sale.id
                                  ? 'bg-green-500/20 text-green-400 border-green-500/40'
                                  : 'bg-[#222222] hover:bg-[#2c2c2c] text-[#A1A1AA] hover:text-white border-[#333333]'
                              }`}
                            >
                              {downloadSuccessReceiptId === sale.id ? (
                                <Check className="w-3.5 h-3.5 text-green-400" />
                              ) : (
                                <Download className={`w-3.5 h-3.5 ${downloadingReceiptId === sale.id ? 'animate-bounce text-green-400' : ''}`} />
                              )}
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

      </div>

    </div>
  );
};
