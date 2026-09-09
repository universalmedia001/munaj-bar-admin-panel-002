import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  CreditCard,
  Banknote,
  Smartphone,
  Clock,
  AlertTriangle,
  PackageX,
  ArrowUpRight,
  Radio,
  Receipt as ReceiptIcon,
  Plus,
  RefreshCw,
  ShoppingBag,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import type { SaleWithDetails, ShiftWithWorker, Product, BusinessSettings } from '../../types';
import { formatCurrency, formatTime, formatRelativeTime } from '../../utils/formatters';
import { Badge } from '../common/Badge';
import { EmptyState } from '../common/EmptyState';
import { useWorkerBranding } from '../../context/BrandingContext';

interface DashboardViewProps {
  sales: SaleWithDetails[];
  shifts: ShiftWithWorker[];
  products: Product[];
  settings: BusinessSettings | null;
  onSelectSale: (sale: SaleWithDetails) => void;
  onNavigate: (tab: any) => void;
  onRefresh: () => void;
  loading: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  sales,
  shifts,
  products,
  settings,
  onSelectSale,
  onNavigate,
  onRefresh,
  loading,
}) => {
  const { workerPosName } = useWorkerBranding();
  const currency = settings?.currency || 'NGN';

  // Calculate Today's metrics (using local midnight as boundary)
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const todaySales = sales.filter((s) => {
    const saleTime = new Date(s.created_at).getTime();
    return saleTime >= startOfToday && s.status === 'completed';
  });

  const todayRevenue = todaySales.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
  const todayTransactionsCount = todaySales.length;

  const todayCashSales = todaySales
    .filter((s) => s.payment_method === 'cash')
    .reduce((acc, s) => acc + (Number(s.total) || 0), 0);

  const todayPosSales = todaySales
    .filter((s) => s.payment_method === 'pos')
    .reduce((acc, s) => acc + (Number(s.total) || 0), 0);

  const todayTransferSales = todaySales
    .filter((s) => s.payment_method === 'transfer')
    .reduce((acc, s) => acc + (Number(s.total) || 0), 0);

  const activeShifts = shifts.filter((sh) => sh.status === 'active');
  const lowStockProducts = products.filter(
    (p) => p.is_active && p.stock_quantity > 0 && p.stock_quantity <= p.minimum_stock_level
  );
  const outOfStockProducts = products.filter((p) => p.is_active && p.stock_quantity <= 0);

  // Hourly chart data for today
  const hourlyDataMap: { [hour: string]: number } = {};
  for (let i = 8; i <= 23; i++) {
    const label = `${i % 12 === 0 ? 12 : i % 12} ${i >= 12 ? 'PM' : 'AM'}`;
    hourlyDataMap[label] = 0;
  }

  todaySales.forEach((s) => {
    const d = new Date(s.created_at);
    const hour = d.getHours();
    const label = `${hour % 12 === 0 ? 12 : hour % 12} ${hour >= 12 ? 'PM' : 'AM'}`;
    if (hourlyDataMap[label] !== undefined) {
      hourlyDataMap[label] += Number(s.total) || 0;
    }
  });

  const chartData = Object.entries(hourlyDataMap).map(([time, amount]) => ({
    time,
    amount,
  }));

  const paymentData = [
    { name: 'Cash', value: todayCashSales, color: '#22C55E' },
    { name: 'POS', value: todayPosSales, color: '#3B82F6' },
    { name: 'Transfer', value: todayTransferSales, color: '#F59E0B' },
  ].filter((p) => p.value > 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Banner / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#111111] p-5 rounded-2xl border border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E] animate-ping" />
            <h2 className="text-lg font-extrabold text-white tracking-tight">
              {workerPosName} Operations
            </h2>
            <Badge variant="green" size="sm">
              Live Connected
            </Badge>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Realtime sync with Worker POS. All sales, shifts, and stock transactions update automatically.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#22C55E]' : ''}`} />
            <span>Refresh Feed</span>
          </button>
          <button
            onClick={() => onNavigate('products')}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-black bg-[#22C55E] hover:bg-[#1ea750] rounded-xl transition-all shadow-md shadow-emerald-950/40"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Drink / Item</span>
          </button>
        </div>
      </div>

      {/* 8 Metric KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* 1. TODAY'S SALES */}
        <div className="bg-[#111111] p-4.5 rounded-2xl border border-zinc-800/80 relative overflow-hidden group hover:border-emerald-800/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Today's Sales
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-950/80 border border-emerald-800/50 flex items-center justify-center text-[#22C55E]">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight font-mono">
              {formatCurrency(todayRevenue, currency)}
            </h3>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-zinc-400">
              <span className="font-semibold text-emerald-400">
                {todayTransactionsCount} orders
              </span>
              <span>today</span>
            </div>
          </div>
        </div>

        {/* 2. TRANSACTIONS */}
        <div className="bg-[#111111] p-4.5 rounded-2xl border border-zinc-800/80 group hover:border-zinc-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Transactions
            </span>
            <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight font-mono">
              {todayTransactionsCount}
            </h3>
            <p className="mt-1 text-[11px] text-zinc-400">
              Avg ticket:{' '}
              <span className="font-semibold text-zinc-200">
                {formatCurrency(
                  todayTransactionsCount > 0 ? todayRevenue / todayTransactionsCount : 0,
                  currency
                )}
              </span>
            </p>
          </div>
        </div>

        {/* 3. CASH SALES */}
        <div className="bg-[#111111] p-4.5 rounded-2xl border border-zinc-800/80 group hover:border-emerald-800/30 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Cash Sales
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-950/50 border border-emerald-800/40 flex items-center justify-center text-emerald-400">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-lg sm:text-xl font-bold text-emerald-400 tracking-tight font-mono">
              {formatCurrency(todayCashSales, currency)}
            </h3>
            <p className="mt-1 text-[11px] text-zinc-500">Physical drawer cash</p>
          </div>
        </div>

        {/* 4. POS SALES */}
        <div className="bg-[#111111] p-4.5 rounded-2xl border border-zinc-800/80 group hover:border-blue-800/30 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              POS Card Sales
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-950/50 border border-blue-800/40 flex items-center justify-center text-blue-400">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-lg sm:text-xl font-bold text-blue-400 tracking-tight font-mono">
              {formatCurrency(todayPosSales, currency)}
            </h3>
            <p className="mt-1 text-[11px] text-zinc-500">Terminal card payments</p>
          </div>
        </div>

        {/* 5. TRANSFER SALES */}
        <div className="bg-[#111111] p-4.5 rounded-2xl border border-zinc-800/80 group hover:border-amber-800/30 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Bank Transfers
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-950/50 border border-amber-800/40 flex items-center justify-center text-amber-400">
              <Smartphone className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-lg sm:text-xl font-bold text-amber-400 tracking-tight font-mono">
              {formatCurrency(todayTransferSales, currency)}
            </h3>
            <p className="mt-1 text-[11px] text-zinc-500">Direct account transfer</p>
          </div>
        </div>

        {/* 6. ACTIVE SHIFTS */}
        <div
          onClick={() => onNavigate('shifts')}
          className="bg-[#111111] p-4.5 rounded-2xl border border-zinc-800/80 cursor-pointer hover:border-zinc-700 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Active Shifts
            </span>
            <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight font-mono">
                {activeShifts.length}
              </h3>
              <span className="text-[11px] text-[#22C55E] font-semibold">on duty</span>
            </div>
            <p className="mt-1 text-[11px] text-zinc-500 flex items-center gap-1">
              Click to view shift cash <ArrowUpRight className="w-3 h-3" />
            </p>
          </div>
        </div>

        {/* 7. LOW STOCK */}
        <div
          onClick={() => onNavigate('inventory')}
          className="bg-[#111111] p-4.5 rounded-2xl border border-zinc-800/80 cursor-pointer hover:border-amber-800/40 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Low Stock Alert
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-950/60 border border-amber-800/50 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3
              className={`text-xl sm:text-2xl font-black tracking-tight font-mono ${
                lowStockProducts.length > 0 ? 'text-amber-400' : 'text-zinc-400'
              }`}
            >
              {lowStockProducts.length}
            </h3>
            <p className="mt-1 text-[11px] text-zinc-500">
              {lowStockProducts.length > 0
                ? 'Items require restocking'
                : 'All stocks healthy'}
            </p>
          </div>
        </div>

        {/* 8. OUT OF STOCK */}
        <div
          onClick={() => onNavigate('inventory')}
          className="bg-[#111111] p-4.5 rounded-2xl border border-zinc-800/80 cursor-pointer hover:border-red-800/40 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Out of Stock
            </span>
            <div className="w-8 h-8 rounded-xl bg-red-950/60 border border-red-800/50 flex items-center justify-center text-red-400">
              <PackageX className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3
              className={`text-xl sm:text-2xl font-black tracking-tight font-mono ${
                outOfStockProducts.length > 0 ? 'text-red-400' : 'text-zinc-400'
              }`}
            >
              {outOfStockProducts.length}
            </h3>
            <p className="mt-1 text-[11px] text-zinc-500">
              {outOfStockProducts.length > 0
                ? 'Items currently unavailable'
                : 'Zero stockouts'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Grid: Realtime Sales Stream + Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Live Sales Stream & Table */}
        <div className="lg:col-span-2 space-y-6">
          {/* Live Sales Ticker Card */}
          <div className="bg-[#111111] rounded-2xl border border-zinc-800/80 p-5">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-950/80 border border-emerald-800/60 flex items-center justify-center text-[#22C55E]">
                  <Radio className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    Live POS Sales Stream
                    <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Realtime sales pushed live from worker bar terminals
                  </p>
                </div>
              </div>

              <button
                onClick={() => onNavigate('sales')}
                className="text-xs font-semibold text-[#22C55E] hover:underline flex items-center gap-1"
              >
                View all sales &rarr;
              </button>
            </div>

            <div className="mt-4 divide-y divide-zinc-800/60">
              {sales.length === 0 ? (
                <EmptyState
                  icon={ReceiptIcon}
                  title="No sales recorded yet"
                  description="When workers complete sales on the POS, transactions will stream here in real time."
                />
              ) : (
                sales.slice(0, 7).map((sale) => (
                  <div
                    key={sale.id}
                    onClick={() => onSelectSale(sale)}
                    className="py-3.5 px-2 hover:bg-zinc-900/60 rounded-xl transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 font-mono text-xs shrink-0 group-hover:border-[#22C55E] group-hover:text-[#22C55E] transition-colors">
                        <ReceiptIcon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 truncate">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-xs font-mono">
                            {sale.receipt_number}
                          </span>
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
                        <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                          Worker: <span className="text-zinc-200">{sale.worker?.full_name || 'Staff'}</span>
                          {sale.items && sale.items.length > 0 && (
                            <span className="text-zinc-500">
                              {' '}• {sale.items.map((it) => `${it.product_name} (x${it.quantity})`).join(', ')}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0 pl-3">
                      <p className="text-xs sm:text-sm font-extrabold text-white font-mono">
                        {formatCurrency(sale.total, currency)}
                      </p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">
                        {formatRelativeTime(sale.created_at)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Today's Sales Velocity Area Chart */}
          <div className="bg-[#111111] rounded-2xl border border-zinc-800/80 p-5">
            <div className="flex items-center justify-between pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Sales Timeline Today</h3>
                <p className="text-[11px] text-zinc-400">Revenue trend throughout active hours</p>
              </div>
            </div>

            <div className="h-56 w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22C55E" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#22C55E" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" stroke="#52525b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#52525b" fontSize={10} tickLine={false} tickFormatter={(val) => `₦${val >= 1000 ? `${val / 1000}k` : val}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#181818', borderColor: '#27272a', borderRadius: '12px', fontSize: '11px' }}
                    formatter={(value: any) => [formatCurrency(Number(value), currency), 'Revenue']}
                  />
                  <Area type="monotone" dataKey="amount" stroke="#22C55E" strokeWidth={2} fillOpacity={1} fill="url(#salesGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right Col: Payment Breakdown & Active Staff */}
        <div className="space-y-6">
          {/* Payment Method Distribution */}
          <div className="bg-[#111111] rounded-2xl border border-zinc-800/80 p-5">
            <h3 className="text-sm font-bold text-white">Payment Method Share</h3>
            <p className="text-[11px] text-zinc-400 mt-0.5">Today's breakdown by payment type</p>

            {paymentData.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-500">
                No payment data for today yet
              </div>
            ) : (
              <>
                <div className="h-44 w-full mt-2 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {paymentData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} stroke="#111111" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#181818', borderColor: '#27272a', borderRadius: '12px', fontSize: '11px' }}
                        formatter={(val: any) => formatCurrency(Number(val), currency)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-2 mt-2 pt-2 border-t border-zinc-800">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-zinc-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E]" />
                      Cash
                    </span>
                    <span className="font-mono font-bold text-white">
                      {formatCurrency(todayCashSales, currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-zinc-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#3B82F6]" />
                      POS
                    </span>
                    <span className="font-mono font-bold text-white">
                      {formatCurrency(todayPosSales, currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-zinc-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
                      Transfer
                    </span>
                    <span className="font-mono font-bold text-white">
                      {formatCurrency(todayTransferSales, currency)}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Active Workers On Shift Card */}
          <div className="bg-[#111111] rounded-2xl border border-zinc-800/80 p-5">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div>
                <h3 className="text-sm font-bold text-white">Active Shifts ({activeShifts.length})</h3>
                <p className="text-[11px] text-zinc-400">Bar staff currently clocked in</p>
              </div>
              <button
                onClick={() => onNavigate('shifts')}
                className="text-xs font-semibold text-[#22C55E] hover:underline"
              >
                Manage &rarr;
              </button>
            </div>

            <div className="mt-3 space-y-2.5">
              {activeShifts.length === 0 ? (
                <p className="text-xs text-zinc-500 py-4 text-center">
                  No active shifts at this moment.
                </p>
              ) : (
                activeShifts.map((shift) => (
                  <div
                    key={shift.id}
                    className="p-3 rounded-xl bg-[#181818] border border-zinc-800 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
                        <span className="text-xs font-bold text-white">
                          {shift.worker?.full_name || 'Worker'}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        Started: {formatTime(shift.started_at)} • Float: {formatCurrency(shift.opening_cash, currency)}
                      </p>
                    </div>

                    <Badge variant="green" size="sm">
                      On Duty
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
