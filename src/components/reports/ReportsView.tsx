import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  BarChart3,
  TrendingUp,
  CreditCard,
  Banknote,
  Smartphone,
  Users,
  User,
  Package,
  Calendar,
  Download,
  Boxes,
  Award,
  FileSpreadsheet,
  Printer,
  Sparkles,
  RefreshCw,
  Clock,
  Receipt,
  FileText,
  Eye,
  ShieldCheck,
  Percent,
  TrendingDown,
  Layers,
  ArrowUpRight,
  Filter,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import type {
  SaleWithDetails,
  ShiftWithWorker,
  Product,
  Profile,
  BusinessSettings,
  StaffReportFilter,
  GeneratedStaffReport,
  StaffSubmittedReport,
} from '../../types';
import { formatCurrency, formatDate, formatTime } from '../../utils/formatters';
import { StaffReportControls } from './StaffReportControls';
import { StaffReportPreviewModal } from './StaffReportPreviewModal';
import { StaffSubmittedReportsSection } from './StaffSubmittedReportsSection';
import { StaffSubmittedReportModal } from './StaffSubmittedReportModal';
import { ShiftReportModal } from '../shifts/ShiftReportModal';
import { generateStaffPerformanceReport } from '../../utils/staffReportCalculator';
import { generateAndDownloadStaffReportPDF } from '../../utils/staffReportPdfGenerator';
import { generateSingleShiftReport } from '../../utils/shiftReportCalculator';
import { generateAndDownloadShiftReportPDF } from '../../utils/shiftReportPdfGenerator';
import { fetchSubmittedReports, markReportAsViewed } from '../../services/staffReportService';

export type ReportsTab =
  | 'executive_overview'
  | 'sales_analytics'
  | 'product_analytics'
  | 'staff_performance'
  | 'shift_reports'
  | 'staff_submitted';

interface ReportsViewProps {
  sales: SaleWithDetails[];
  shifts: ShiftWithWorker[];
  products: Product[];
  workers: Profile[];
  settings: BusinessSettings | null;
  onOpenReceipt?: (sale: SaleWithDetails) => void;
  onRefresh?: () => void;
  loading?: boolean;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  sales,
  shifts,
  products,
  workers,
  settings,
  onOpenReceipt,
  onRefresh,
  loading = false,
}) => {
  const currency = settings?.currency || 'NGN';
  const [activeTab, setActiveTab] = useState<ReportsTab>('staff_submitted');
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('7d');

  // Submitted reports state
  const [submittedReports, setSubmittedReports] = useState<StaffSubmittedReport[]>([]);
  const [selectedSubmittedReport, setSelectedSubmittedReport] = useState<StaffSubmittedReport | null>(null);
  const [isSubmittedModalOpen, setIsSubmittedModalOpen] = useState(false);

  // Shift report state for Shift Reports tab
  const [selectedShiftForReport, setSelectedShiftForReport] = useState<ShiftWithWorker | null>(null);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [downloadingShiftId, setDownloadingShiftId] = useState<string | null>(null);

  // Load submitted reports
  const loadSubmittedReports = useCallback(async () => {
    const list = await fetchSubmittedReports(workers, sales);
    setSubmittedReports(list);
  }, [workers, sales]);

  useEffect(() => {
    loadSubmittedReports();
  }, [loadSubmittedReports]);

  // Staff Performance Filter State
  const todayStr = new Date().toISOString().slice(0, 10);
  const firstOfMonthStr = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  const [staffFilter, setStaffFilter] = useState<StaffReportFilter>({
    reportType: 'all_workers',
    workerId: workers.length > 0 ? workers[0].id : '',
    period: 'this_month',
    startDate: firstOfMonthStr,
    endDate: todayStr,
  });

  // Generated Report State for Preview Modal
  const [generatedReport, setGeneratedReport] = useState<GeneratedStaffReport | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [quickDownloading, setQuickDownloading] = useState(false);

  // In-line Current Live Report
  const inlineReport = useMemo(() => {
    return generateStaffPerformanceReport({
      filter: staffFilter,
      sales,
      shifts,
      workers,
      products,
    });
  }, [staffFilter, sales, shifts, workers, products]);

  const handleGenerateReportModal = () => {
    const report = generateStaffPerformanceReport({
      filter: staffFilter,
      sales,
      shifts,
      workers,
      products,
    });
    setGeneratedReport(report);
    setIsPreviewModalOpen(true);
  };

  const handleQuickDownload = async (customFilter?: StaffReportFilter) => {
    try {
      setQuickDownloading(true);
      const rep = generateStaffPerformanceReport({
        filter: customFilter || staffFilter,
        sales,
        shifts,
        workers,
        products,
      });
      await generateAndDownloadStaffReportPDF({ report: rep, settings });
    } catch (err) {
      console.error('Quick download failed:', err);
    } finally {
      setQuickDownloading(false);
    }
  };

  const handleViewSubmittedReport = async (report: StaffSubmittedReport) => {
    setSelectedSubmittedReport(report);
    setIsSubmittedModalOpen(true);
    await markReportAsViewed(report.id);
    setSubmittedReports((prev) =>
      prev.map((r) => (r.id === report.id ? { ...r, status: 'VIEWED' } : r))
    );
  };

  const handleSubmittedReportDeleted = (reportId: string) => {
    setSubmittedReports((prev) => prev.filter((report) => report.id !== reportId));
  };

  const handleOpenShiftReport = (shift: ShiftWithWorker) => {
    setSelectedShiftForReport(shift);
    setIsShiftModalOpen(true);
  };

  const handleDownloadShiftPdf = async (e: React.MouseEvent, shift: ShiftWithWorker) => {
    e.stopPropagation();
    try {
      setDownloadingShiftId(shift.id);
      const shiftReport = generateSingleShiftReport({ shift, sales });
      await generateAndDownloadShiftReportPDF({ report: shiftReport, settings });
    } catch (err) {
      console.error('Failed to download shift report PDF:', err);
    } finally {
      setDownloadingShiftId(null);
    }
  };

  // Filtered Sales for Analytics Tabs
  const filteredSales = useMemo(() => {
    const now = new Date();
    const cutoff =
      timeRange === '7d'
        ? now.getTime() - 7 * 24 * 60 * 60 * 1000
        : timeRange === '30d'
        ? now.getTime() - 30 * 24 * 60 * 60 * 1000
        : 0;

    return sales.filter((s) => {
      const t = new Date(s.created_at).getTime();
      return t >= cutoff && s.status === 'completed';
    });
  }, [sales, timeRange]);

  const totalRevenue = filteredSales.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
  const totalTransactions = filteredSales.length;
  const avgTransaction = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

  // Inventory valuation
  const totalStockItems = products.reduce((acc, p) => acc + p.stock_quantity, 0);
  const totalRetailValuation = products.reduce((acc, p) => acc + p.stock_quantity * p.selling_price, 0);
  const totalCostValuation = products.reduce((acc, p) => acc + p.stock_quantity * p.cost_price, 0);

  // Top Selling Products Calculation
  const productSalesMap: { [name: string]: { name: string; quantity: number; revenue: number; cost: number } } = {};
  filteredSales.forEach((sale) => {
    sale.items?.forEach((it) => {
      if (!productSalesMap[it.product_name]) {
        const prod = products.find((p) => p.name === it.product_name);
        productSalesMap[it.product_name] = {
          name: it.product_name,
          quantity: 0,
          revenue: 0,
          cost: prod?.cost_price || 0,
        };
      }
      productSalesMap[it.product_name].quantity += it.quantity;
      productSalesMap[it.product_name].revenue += Number(it.total) || 0;
    });
  });

  const topProducts = Object.values(productSalesMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  // Payment Breakdown
  const cashTotal = filteredSales
    .filter((s) => s.payment_method === 'cash')
    .reduce((sum, s) => sum + Number(s.total || 0), 0);
  const posTotal = filteredSales
    .filter((s) => s.payment_method === 'pos')
    .reduce((sum, s) => sum + Number(s.total || 0), 0);
  const transferTotal = filteredSales
    .filter((s) => s.payment_method === 'transfer')
    .reduce((sum, s) => sum + Number(s.total || 0), 0);

  const paymentPieData = [
    { name: 'Cash', value: cashTotal, color: '#22C55E' },
    { name: 'POS Card', value: posTotal, color: '#3B82F6' },
    { name: 'Transfer', value: transferTotal, color: '#A855F7' },
  ].filter((d) => d.value > 0);

  // Daily revenue chart data
  const dailyDataMap: { [date: string]: number } = {};
  filteredSales.forEach((s) => {
    const d = formatDate(s.created_at);
    dailyDataMap[d] = (dailyDataMap[d] || 0) + (Number(s.total) || 0);
  });

  const dailyChartData = Object.entries(dailyDataMap).map(([date, revenue]) => ({
    date,
    revenue,
  }));

  // Unread submitted reports count
  const unreadSubmittedCount = useMemo(() => {
    return submittedReports.filter((r) => r.status === 'SUBMITTED').length;
  }, [submittedReports]);

  return (
    <div className="space-y-6 pb-16">
      {/* Top Header & Sub-Navigation Tabs */}
      <div className="bg-[#111111] p-5 rounded-2xl border border-zinc-800/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold text-white tracking-tight">
                Reports & Performance Analytics
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20">
                AUDITED
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Live audit statements, cashier submissions, shift reconciliations, and executive intelligence.
            </p>
          </div>

          {onRefresh && (
            <button
              onClick={() => {
                onRefresh();
                loadSubmittedReports();
              }}
              disabled={loading}
              className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer self-start sm:self-auto disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#22C55E] ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Data</span>
            </button>
          )}
        </div>

        {/* 6 Sub-Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-t border-zinc-800/60 pt-3">
          <button
            onClick={() => setActiveTab('executive_overview')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shrink-0 transition-all cursor-pointer ${
              activeTab === 'executive_overview'
                ? 'bg-[#22C55E] text-black font-extrabold shadow-md'
                : 'bg-zinc-900/80 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800/60'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Executive Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('sales_analytics')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shrink-0 transition-all cursor-pointer ${
              activeTab === 'sales_analytics'
                ? 'bg-[#22C55E] text-black font-extrabold shadow-md'
                : 'bg-zinc-900/80 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800/60'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Sales Analytics</span>
          </button>

          <button
            onClick={() => setActiveTab('product_analytics')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shrink-0 transition-all cursor-pointer ${
              activeTab === 'product_analytics'
                ? 'bg-[#22C55E] text-black font-extrabold shadow-md'
                : 'bg-zinc-900/80 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800/60'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Product Analytics</span>
          </button>

          <button
            onClick={() => setActiveTab('staff_performance')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shrink-0 transition-all cursor-pointer ${
              activeTab === 'staff_performance'
                ? 'bg-[#22C55E] text-black font-extrabold shadow-md'
                : 'bg-zinc-900/80 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800/60'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Staff Performance</span>
          </button>

          <button
            onClick={() => setActiveTab('shift_reports')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shrink-0 transition-all cursor-pointer ${
              activeTab === 'shift_reports'
                ? 'bg-[#22C55E] text-black font-extrabold shadow-md'
                : 'bg-zinc-900/80 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800/60'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Shift Reports</span>
          </button>

          <button
            onClick={() => setActiveTab('staff_submitted')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shrink-0 transition-all cursor-pointer ${
              activeTab === 'staff_submitted'
                ? 'bg-[#22C55E] text-black font-extrabold shadow-md'
                : 'bg-zinc-900/80 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800/60'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Staff Submitted Reports</span>
            {unreadSubmittedCount > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  activeTab === 'staff_submitted'
                    ? 'bg-black text-[#22C55E]'
                    : 'bg-[#22C55E] text-black'
                }`}
              >
                {unreadSubmittedCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* SUB-SECTION 1: EXECUTIVE OVERVIEW */}
      {activeTab === 'executive_overview' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Time range selector */}
          <div className="flex items-center justify-between bg-[#111111] p-4 rounded-2xl border border-zinc-800/80">
            <span className="text-xs font-bold text-zinc-300">Reporting Horizon:</span>
            <div className="bg-zinc-900 border border-zinc-800 p-1 rounded-xl flex items-center gap-1">
              <button
                onClick={() => setTimeRange('7d')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  timeRange === '7d' ? 'bg-[#22C55E] text-black font-bold' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Last 7 Days
              </button>
              <button
                onClick={() => setTimeRange('30d')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  timeRange === '30d' ? 'bg-[#22C55E] text-black font-bold' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Last 30 Days
              </button>
              <button
                onClick={() => setTimeRange('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  timeRange === 'all' ? 'bg-[#22C55E] text-black font-bold' : 'text-zinc-400 hover:text-white'
                }`}
              >
                All Time
              </button>
            </div>
          </div>

          {/* 4 Executive KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="min-w-0 bg-[#111111] p-4.5 rounded-2xl border border-zinc-800/80">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Gross Revenue</span>
              <h3 className="min-w-0 max-w-full break-words text-lg sm:text-2xl leading-tight font-black text-white font-mono mt-2">
                {formatCurrency(totalRevenue, currency)}
              </h3>
              <p className="text-[11px] text-emerald-400 mt-1 font-semibold">{totalTransactions} orders completed</p>
            </div>

            <div className="min-w-0 bg-[#111111] p-4.5 rounded-2xl border border-zinc-800/80">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Average Ticket Size</span>
              <h3 className="min-w-0 max-w-full break-words text-lg sm:text-2xl leading-tight font-black text-white font-mono mt-2">
                {formatCurrency(avgTransaction, currency)}
              </h3>
              <p className="text-[11px] text-zinc-400 mt-1">Per transaction average</p>
            </div>

            <div className="min-w-0 bg-[#111111] p-4.5 rounded-2xl border border-zinc-800/80">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Retail Stock Value</span>
              <h3 className="min-w-0 max-w-full break-words text-lg sm:text-2xl leading-tight font-black text-[#22C55E] font-mono mt-2">
                {formatCurrency(totalRetailValuation, currency)}
              </h3>
              <p className="text-[11px] text-zinc-400 mt-1">{totalStockItems} bottles/drinks in bar</p>
            </div>

            <div className="min-w-0 bg-[#111111] p-4.5 rounded-2xl border border-zinc-800/80">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Estimated Stock Cost</span>
              <h3 className="min-w-0 max-w-full break-words text-lg sm:text-2xl leading-tight font-black text-zinc-300 font-mono mt-2">
                {formatCurrency(totalCostValuation, currency)}
              </h3>
              <p className="text-[11px] text-zinc-400 mt-1">Wholesale capital value</p>
            </div>
          </div>

          {/* Revenue Chart & Payment Channel Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-[#111111] p-5 rounded-2xl border border-zinc-800/80">
              <h3 className="text-sm font-bold text-white mb-1">Sales Revenue Trend</h3>
              <p className="text-[11px] text-zinc-400 mb-4">Gross revenue aggregate across selected time horizon</p>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22C55E" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" stroke="#52525b" fontSize={10} tickLine={false} />
                    <YAxis stroke="#52525b" fontSize={10} tickLine={false} tickFormatter={(v) => `₦${v >= 1000 ? `${v / 1000}k` : v}`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#181818', borderColor: '#27272a', borderRadius: '12px', fontSize: '11px' }}
                      formatter={(val: any) => [formatCurrency(Number(val), currency), 'Revenue']}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#22C55E" strokeWidth={2} fillOpacity={1} fill="url(#revenueGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Payment Method Share */}
            <div className="bg-[#111111] p-5 rounded-2xl border border-zinc-800/80 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">Payment Method Mix</h3>
                <p className="text-[11px] text-zinc-400 mb-2">Revenue by settlement channel</p>

                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={65}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {paymentPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#181818', borderColor: '#27272a', borderRadius: '12px', fontSize: '11px' }}
                        formatter={(val: any) => [formatCurrency(Number(val), currency), 'Total']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-zinc-800">
                <div className="flex justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-zinc-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E]" /> Cash:
                  </span>
                  <span className="min-w-0 max-w-[58%] break-words text-right font-mono font-bold text-white">{formatCurrency(cashTotal, currency)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-zinc-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> POS Card:
                  </span>
                  <span className="min-w-0 max-w-[58%] break-words text-right font-mono font-bold text-white">{formatCurrency(posTotal, currency)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-zinc-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Transfer:
                  </span>
                  <span className="min-w-0 max-w-[58%] break-words text-right font-mono font-bold text-white">{formatCurrency(transferTotal, currency)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-SECTION 2: SALES ANALYTICS */}
      {activeTab === 'sales_analytics' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="min-w-0 p-5 rounded-2xl bg-[#111111] border border-zinc-800/80">
              <span className="text-[11px] font-bold text-zinc-400 uppercase">Cash Tendered</span>
              <h4 className="min-w-0 max-w-full break-words text-xl sm:text-2xl leading-tight font-black text-[#22C55E] font-mono mt-1">
                {formatCurrency(cashTotal, currency)}
              </h4>
              <p className="text-[11px] text-zinc-400 mt-1">
                {totalRevenue > 0 ? ((cashTotal / totalRevenue) * 100).toFixed(1) : 0}% of gross volume
              </p>
            </div>

            <div className="min-w-0 p-5 rounded-2xl bg-[#111111] border border-zinc-800/80">
              <span className="text-[11px] font-bold text-zinc-400 uppercase">POS Terminal Cards</span>
              <h4 className="min-w-0 max-w-full break-words text-xl sm:text-2xl leading-tight font-black text-blue-400 font-mono mt-1">
                {formatCurrency(posTotal, currency)}
              </h4>
              <p className="text-[11px] text-zinc-400 mt-1">
                {totalRevenue > 0 ? ((posTotal / totalRevenue) * 100).toFixed(1) : 0}% of gross volume
              </p>
            </div>

            <div className="min-w-0 p-5 rounded-2xl bg-[#111111] border border-zinc-800/80">
              <span className="text-[11px] font-bold text-zinc-400 uppercase">Direct Bank Transfers</span>
              <h4 className="min-w-0 max-w-full break-words text-xl sm:text-2xl leading-tight font-black text-purple-400 font-mono mt-1">
                {formatCurrency(transferTotal, currency)}
              </h4>
              <p className="text-[11px] text-zinc-400 mt-1">
                {totalRevenue > 0 ? ((transferTotal / totalRevenue) * 100).toFixed(1) : 0}% of gross volume
              </p>
            </div>
          </div>

          {/* Daily breakdown bar chart */}
          <div className="bg-[#111111] p-5 rounded-2xl border border-zinc-800/80">
            <h3 className="text-sm font-bold text-white mb-1">Daily Sales Volume</h3>
            <p className="text-[11px] text-zinc-400 mb-4">Volume comparison across days</p>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="date" stroke="#52525b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#52525b" fontSize={10} tickLine={false} tickFormatter={(v) => `₦${v >= 1000 ? `${v / 1000}k` : v}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#181818', borderColor: '#27272a', borderRadius: '12px', fontSize: '11px' }}
                    formatter={(val: any) => [formatCurrency(Number(val), currency), 'Revenue']}
                  />
                  <Bar dataKey="revenue" fill="#22C55E" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* SUB-SECTION 3: PRODUCT ANALYTICS */}
      {activeTab === 'product_analytics' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-[#111111] p-5 rounded-2xl border border-zinc-800/80">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Award className="w-4 h-4 text-[#22C55E]" />
                  Best-Selling Bar Items
                </h3>
                <p className="text-[11px] text-zinc-400">Ranked by revenue contribution & unit volume</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 font-bold uppercase tracking-wider text-[11px]">
                    <th className="pb-3 px-3">#</th>
                    <th className="pb-3 px-3">Product Name</th>
                    <th className="pb-3 px-3 text-right">Units Sold</th>
                    <th className="pb-3 px-3 text-right">Est. Unit Cost</th>
                    <th className="pb-3 px-3 text-right">Gross Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40">
                  {topProducts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-zinc-500">
                        No product sales recorded in this period.
                      </td>
                    </tr>
                  ) : (
                    topProducts.map((p, idx) => (
                      <tr key={p.name} className="hover:bg-zinc-900/40">
                        <td className="py-3 px-3 font-mono font-bold text-zinc-500">#{idx + 1}</td>
                        <td className="py-3 px-3 font-bold text-white">{p.name}</td>
                        <td className="py-3 px-3 text-right font-mono text-zinc-300">{p.quantity}</td>
                        <td className="py-3 px-3 text-right font-mono text-zinc-400">
                          {formatCurrency(p.cost, currency)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                          {formatCurrency(p.revenue, currency)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-SECTION 4: STAFF PERFORMANCE */}
      {activeTab === 'staff_performance' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <StaffReportControls
            filter={staffFilter}
            workers={workers}
            onChangeFilter={setStaffFilter}
            onGenerateReport={handleGenerateReportModal}
            loading={loading}
          />

          {/* Quick Preset Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              onClick={() => {
                const f: StaffReportFilter = {
                  reportType: 'all_workers',
                  workerId: '',
                  period: 'today',
                  startDate: '',
                  endDate: '',
                };
                setStaffFilter(f);
                const rep = generateStaffPerformanceReport({ filter: f, sales, shifts, workers, products });
                setGeneratedReport(rep);
                setIsPreviewModalOpen(true);
              }}
              className="p-3.5 rounded-2xl bg-[#111111] hover:bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700 text-left transition-all group cursor-pointer"
            >
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Daily</span>
              <p className="text-xs font-bold text-white group-hover:text-[#22C55E] transition-colors mt-0.5 flex items-center justify-between">
                Today Staff Audit
                <Clock className="w-3.5 h-3.5 text-[#22C55E]" />
              </p>
            </button>

            <button
              onClick={() => {
                const f: StaffReportFilter = {
                  reportType: 'all_workers',
                  workerId: '',
                  period: 'this_week',
                  startDate: '',
                  endDate: '',
                };
                setStaffFilter(f);
                const rep = generateStaffPerformanceReport({ filter: f, sales, shifts, workers, products });
                setGeneratedReport(rep);
                setIsPreviewModalOpen(true);
              }}
              className="p-3.5 rounded-2xl bg-[#111111] hover:bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700 text-left transition-all group cursor-pointer"
            >
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Weekly</span>
              <p className="text-xs font-bold text-white group-hover:text-[#22C55E] transition-colors mt-0.5 flex items-center justify-between">
                This Week Staff Audit
                <Calendar className="w-3.5 h-3.5 text-[#22C55E]" />
              </p>
            </button>

            <button
              onClick={() => {
                const f: StaffReportFilter = {
                  reportType: 'all_workers',
                  workerId: '',
                  period: 'this_month',
                  startDate: '',
                  endDate: '',
                };
                setStaffFilter(f);
                const rep = generateStaffPerformanceReport({ filter: f, sales, shifts, workers, products });
                setGeneratedReport(rep);
                setIsPreviewModalOpen(true);
              }}
              className="p-3.5 rounded-2xl bg-[#111111] hover:bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700 text-left transition-all group cursor-pointer"
            >
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Monthly</span>
              <p className="text-xs font-bold text-white group-hover:text-[#22C55E] transition-colors mt-0.5 flex items-center justify-between">
                This Month Full Statement
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#22C55E]" />
              </p>
            </button>

            <button
              onClick={() => {
                const f: StaffReportFilter = {
                  reportType: 'all_workers',
                  workerId: '',
                  period: 'this_year',
                  startDate: '',
                  endDate: '',
                };
                setStaffFilter(f);
                const rep = generateStaffPerformanceReport({ filter: f, sales, shifts, workers, products });
                setGeneratedReport(rep);
                setIsPreviewModalOpen(true);
              }}
              className="p-3.5 rounded-2xl bg-[#111111] hover:bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700 text-left transition-all group cursor-pointer"
            >
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Annual</span>
              <p className="text-xs font-bold text-white group-hover:text-[#22C55E] transition-colors mt-0.5 flex items-center justify-between">
                Annual Performance Report
                <Award className="w-3.5 h-3.5 text-[#22C55E]" />
              </p>
            </button>
          </div>

          {/* Live In-Line Statement Preview Card */}
          <div className="bg-[#111111] rounded-2xl border border-zinc-800/80 p-5 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800/70">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-extrabold text-white tracking-tight">
                    {inlineReport.reportType === 'individual'
                      ? `${inlineReport.targetWorker?.full_name || 'Worker'} Performance Statement`
                      : 'All Staff Performance Audit'}
                  </h3>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {inlineReport.periodLabel}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  Live calculated summary for selected scope and period.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleQuickDownload(staffFilter)}
                  disabled={quickDownloading}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs flex items-center gap-1.5 border border-zinc-700 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5 text-[#22C55E]" />
                  <span>{quickDownloading ? 'Saving PDF...' : 'Download PDF Report'}</span>
                </button>
                <button
                  onClick={handleGenerateReportModal}
                  className="px-4 py-2 rounded-xl bg-[#22C55E] hover:bg-emerald-400 active:scale-95 text-black font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-950/40 transition-all cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Open Full Statement & Print</span>
                </button>
              </div>
            </div>

            {/* In-line Summary 4-KPI Tiles */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="bg-zinc-900/60 p-4 rounded-xl border border-zinc-800">
                <span className="text-[10px] font-bold text-zinc-400 uppercase">Period Revenue</span>
                <h4 className="min-w-0 max-w-full break-words text-lg sm:text-xl leading-tight font-black text-[#22C55E] font-mono mt-1">
                  {formatCurrency(inlineReport.totalRevenue, currency)}
                </h4>
                <p className="text-[11px] text-zinc-400 mt-1">{inlineReport.totalTransactions} completed sales</p>
              </div>

              <div className="bg-zinc-900/60 p-4 rounded-xl border border-zinc-800">
                <span className="text-[10px] font-bold text-zinc-400 uppercase">Items Dispatched</span>
                <h4 className="min-w-0 max-w-full break-words text-lg sm:text-xl leading-tight font-black text-white font-mono mt-1">
                  {inlineReport.totalItemsSold}
                </h4>
                <p className="text-[11px] text-zinc-400 mt-1">Units recorded in receipts</p>
              </div>

              <div className="bg-zinc-900/60 p-4 rounded-xl border border-zinc-800">
                <span className="text-[10px] font-bold text-zinc-400 uppercase">Average Ticket</span>
                <h4 className="min-w-0 max-w-full break-words text-lg sm:text-xl leading-tight font-black text-white font-mono mt-1">
                  {formatCurrency(inlineReport.averageTicket, currency)}
                </h4>
                <p className="text-[11px] text-zinc-400 mt-1">Per transaction average</p>
              </div>

              <div className="bg-zinc-900/60 p-4 rounded-xl border border-zinc-800">
                <span className="text-[10px] font-bold text-zinc-400 uppercase">Shift Status</span>
                <h4
                  className={`min-w-0 max-w-full break-words text-lg sm:text-xl leading-tight font-black font-mono mt-1 ${
                    inlineReport.shiftReconciliation.status === 'BALANCED'
                      ? 'text-emerald-400'
                      : inlineReport.shiftReconciliation.status === 'SHORTAGE'
                      ? 'text-rose-400'
                      : 'text-blue-400'
                  }`}
                >
                  {inlineReport.shiftReconciliation.status}
                </h4>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Diff: {inlineReport.shiftReconciliation.totalDifference >= 0 ? '+' : ''}
                  {formatCurrency(inlineReport.shiftReconciliation.totalDifference, currency)}
                </p>
              </div>
            </div>

            {/* In-line Staff Table or Individual Breakdown */}
            {inlineReport.reportType === 'all_workers' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-400 font-bold">
                      <th className="pb-2.5 pr-2">Rank</th>
                      <th className="pb-2.5">Staff Name</th>
                      <th className="pb-2.5">Role</th>
                      <th className="pb-2.5 text-right">Orders</th>
                      <th className="pb-2.5 text-right">Items Sold</th>
                      <th className="pb-2.5 text-right">Revenue</th>
                      <th className="pb-2.5 text-center">Shift Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/40">
                    {inlineReport.workerBreakdown.map((wb) => (
                      <tr key={wb.worker.id} className="hover:bg-zinc-900/40">
                        <td className="py-2.5 pr-2 font-mono font-bold text-zinc-500">#{wb.rank}</td>
                        <td className="py-2.5 font-bold text-white">{wb.worker.full_name}</td>
                        <td className="py-2.5 text-zinc-400 uppercase text-[10px]">{wb.worker.role}</td>
                        <td className="py-2.5 text-right font-mono text-zinc-300">{wb.ordersCount}</td>
                        <td className="py-2.5 text-right font-mono text-zinc-300">{wb.itemsSoldCount}</td>
                        <td className="py-2.5 text-right font-mono font-bold text-emerald-400">
                          {formatCurrency(wb.netRevenue, currency)}
                        </td>
                        <td className="py-2.5 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              wb.reconciliationStatus === 'BALANCED'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : wb.reconciliationStatus === 'SHORTAGE'
                                ? 'bg-rose-500/10 text-rose-400'
                                : 'bg-blue-500/10 text-blue-400'
                            }`}
                          >
                            {wb.reconciliationStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-2">
                  <h5 className="text-xs font-bold text-white uppercase tracking-wider mb-2">
                    Payment Methods Received
                  </h5>
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-400">Cash:</span>
                    <span className="font-mono text-white font-bold">{formatCurrency(inlineReport.paymentBreakdown.cash, currency)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-400">POS Terminal:</span>
                    <span className="font-mono text-white font-bold">{formatCurrency(inlineReport.paymentBreakdown.pos, currency)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-400">Bank Transfer:</span>
                    <span className="font-mono text-white font-bold">{formatCurrency(inlineReport.paymentBreakdown.transfer, currency)}</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-2">
                  <h5 className="text-xs font-bold text-white uppercase tracking-wider mb-2">
                    Top Selling Products
                  </h5>
                  {(inlineReport?.topProducts || []).slice(0, 3).map((tp) => (
                    <div key={tp.productName} className="flex justify-between text-xs">
                      <span className="text-zinc-300 truncate max-w-[160px]">{tp.productName}</span>
                      <span className="font-mono text-emerald-400 font-bold">{tp.quantity} sold ({formatCurrency(tp.revenue, currency)})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-SECTION 5: SHIFT REPORTS */}
      {activeTab === 'shift_reports' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-[#111111] p-5 rounded-2xl border border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#22C55E]" />
                Individual Shift Audit Statements
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Generate, preview, print, and download comprehensive audited reports for any specific shift.
              </p>
            </div>
          </div>

          <div className="bg-[#111111] rounded-2xl border border-zinc-800/80 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 bg-[#141414] text-zinc-400 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-4">Attendant</th>
                    <th className="py-3.5 px-4">Shift Time</th>
                    <th className="py-3.5 px-4 text-right">Opening Float</th>
                    <th className="py-3.5 px-4 text-right">Cash Sales</th>
                    <th className="py-3.5 px-4 text-right">Total Shift Sales</th>
                    <th className="py-3.5 px-4 text-right">Expected Cash</th>
                    <th className="py-3.5 px-4 text-right">Actual Ending</th>
                    <th className="py-3.5 px-4 text-right">Discrepancy</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {shifts.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-zinc-500">
                        No shift records found in database.
                      </td>
                    </tr>
                  ) : (
                    shifts.map((shift) => {
                      const shiftSales = sales.filter((s) => s.shift_id === shift.id);
                      const cashSales = shiftSales
                        .filter((s) => s.payment_method === 'cash')
                        .reduce((sum, s) => sum + Number(s.total || 0), 0);
                      const totalSales = shiftSales.reduce((sum, s) => sum + Number(s.total || 0), 0);
                      const openingFloat = Number(shift.opening_cash || 0);
                      const expectedCash = openingFloat + cashSales;
                      const actualEnding = shift.status === 'closed' ? Number(shift.closing_cash || 0) : null;
                      const discrepancy = actualEnding !== null ? actualEnding - expectedCash : null;

                      return (
                        <tr
                          key={shift.id}
                          onClick={() => handleOpenShiftReport(shift)}
                          className="hover:bg-zinc-900/60 transition-colors cursor-pointer group"
                        >
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 font-bold text-xs">
                                {shift.worker?.full_name ? shift.worker.full_name[0].toUpperCase() : 'W'}
                              </div>
                              <span className="font-bold text-white group-hover:text-[#22C55E] transition-colors">
                                {shift.worker?.full_name || 'Attendant'}
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-zinc-300">
                            <div>{formatDate(shift.started_at)}</div>
                            <div className="text-[10px] text-zinc-500">
                              {formatTime(shift.started_at)} → {shift.ended_at ? formatTime(shift.ended_at) : 'Active'}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono text-zinc-300">
                            {formatCurrency(openingFloat, currency)}
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono text-zinc-300">
                            {formatCurrency(cashSales, currency)}
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400">
                            {formatCurrency(totalSales, currency)}
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono text-zinc-300">
                            {formatCurrency(expectedCash, currency)}
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono text-white font-bold">
                            {actualEnding !== null ? formatCurrency(actualEnding, currency) : 'Pending'}
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono font-bold">
                            {discrepancy !== null ? (
                              <span
                                className={
                                  discrepancy === 0
                                    ? 'text-emerald-400'
                                    : discrepancy > 0
                                    ? 'text-blue-400'
                                    : 'text-rose-400'
                                }
                              >
                                {discrepancy > 0 ? '+' : ''}
                                {formatCurrency(discrepancy, currency)}
                              </span>
                            ) : (
                              <span className="text-zinc-500">-</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                shift.status === 'active'
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-zinc-800 text-zinc-400'
                              }`}
                            >
                              {shift.status.toUpperCase()}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenShiftReport(shift)}
                                className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-[11px] flex items-center gap-1 border border-zinc-700 transition-colors cursor-pointer"
                              >
                                <Eye className="w-3 h-3 text-[#22C55E]" />
                                <span>Report</span>
                              </button>

                              <button
                                onClick={(e) => handleDownloadShiftPdf(e, shift)}
                                disabled={downloadingShiftId === shift.id}
                                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 transition-colors cursor-pointer disabled:opacity-50"
                                title="Download Shift PDF"
                              >
                                <Download className="w-3.5 h-3.5" />
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
        </div>
      )}

      {/* SUB-SECTION 6: STAFF SUBMITTED REPORTS */}
      {activeTab === 'staff_submitted' && (
        <div className="animate-in fade-in duration-200">
          <StaffSubmittedReportsSection
            reports={submittedReports}
            sales={sales}
            workers={workers}
            settings={settings}
            onViewReport={handleViewSubmittedReport}
            onReportDeleted={handleSubmittedReportDeleted}
            onRefresh={loadSubmittedReports}
          />
        </div>
      )}

      {/* MODAL 1: Generated Staff Performance Preview & Print Modal */}
      <StaffReportPreviewModal
        report={generatedReport}
        settings={settings}
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        onOpenReceipt={onOpenReceipt}
      />

      {/* MODAL 2: Staff Submitted Report Modal */}
      <StaffSubmittedReportModal
        report={selectedSubmittedReport}
        sales={sales}
        settings={settings}
        isOpen={isSubmittedModalOpen}
        onClose={() => setIsSubmittedModalOpen(false)}
        onOpenReceipt={onOpenReceipt}
      />

      {/* MODAL 3: Shift Report Modal */}
      <ShiftReportModal
        shift={selectedShiftForReport}
        sales={sales}
        settings={settings}
        isOpen={isShiftModalOpen}
        onClose={() => setIsShiftModalOpen(false)}
        onOpenReceipt={onOpenReceipt}
      />
    </div>
  );
};
