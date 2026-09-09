import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Wallet, 
  CreditCard, 
  ArrowLeftRight, 
  Users, 
  Package, 
  Download, 
  RefreshCw,
  Award,
  Calendar
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { SaleWithItems, Product, Profile } from '../../types';
import { formatCurrency } from '../../utils/formatters';

export const AdminReportsView: React.FC = () => {
  const [timeframe, setTimeframe] = useState<'today' | 'week' | 'month' | 'all'>('week');
  const [sales, setSales] = useState<SaleWithItems[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [workers, setWorkers] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadReportData = async () => {
    try {
      setIsLoading(true);
      const [salesData, prods, workersList] = await Promise.all([
        adminService.getAdminSales({
          page: 1,
          pageSize: 200,
          dateFilter: timeframe,
        }),
        adminService.getAdminProducts({ status: 'all' }),
        adminService.getAllWorkers(),
      ]);

      setSales(salesData.sales);
      setProducts(prods);
      setWorkers(workersList);
    } catch (err) {
      console.error('Error loading report analytics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, [timeframe]);

  // Aggregations
  const totalRevenue = sales.reduce((acc, s) => acc + Number(s.total || 0), 0);
  const totalDiscount = sales.reduce((acc, s) => acc + Number(s.discount || 0), 0);
  const totalTransactions = sales.length;
  const avgOrderValue = totalTransactions > 0 ? Math.round(totalRevenue / totalTransactions) : 0;

  // Payment Breakdown
  const cashTotal = sales.filter((s) => s.payment_method === 'cash').reduce((acc, s) => acc + Number(s.total), 0);
  const posTotal = sales.filter((s) => s.payment_method === 'pos').reduce((acc, s) => acc + Number(s.total), 0);
  const transferTotal = sales.filter((s) => s.payment_method === 'transfer').reduce((acc, s) => acc + Number(s.total), 0);

  const cashPct = totalRevenue > 0 ? Math.round((cashTotal / totalRevenue) * 100) : 0;
  const posPct = totalRevenue > 0 ? Math.round((posTotal / totalRevenue) * 100) : 0;
  const transferPct = totalRevenue > 0 ? Math.round((transferTotal / totalRevenue) * 100) : 0;

  // Product sales map
  const productStatsMap: Record<string, { name: string; quantity: number; revenue: number }> = {};
  sales.forEach((s) => {
    s.items?.forEach((item) => {
      const pName = item.product_name;
      if (!productStatsMap[pName]) {
        productStatsMap[pName] = { name: pName, quantity: 0, revenue: 0 };
      }
      productStatsMap[pName].quantity += item.quantity;
      productStatsMap[pName].revenue += item.total_price;
    });
  });

  const topProducts = Object.values(productStatsMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  // Worker sales map
  const workerStatsMap: Record<string, { name: string; email: string; role: string; count: number; total: number }> = {};
  sales.forEach((s) => {
    const wId = s.worker_id;
    const wName = s.worker?.full_name || 'Cashier';
    const wEmail = s.worker?.email || '';
    const wRole = s.worker?.role || 'cashier';

    if (!workerStatsMap[wId]) {
      workerStatsMap[wId] = { name: wName, email: wEmail, role: wRole, count: 0, total: 0 };
    }
    workerStatsMap[wId].count += 1;
    workerStatsMap[wId].total += Number(s.total || 0);
  });

  const topWorkers = Object.values(workerStatsMap)
    .sort((a, b) => b.total - a.total);

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#111111] border border-[#222222] p-4 lg:p-6 rounded-2xl">
        <div>
          <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-400" />
            <span>Financial Reports & Sales Analytics</span>
          </h2>
          <p className="text-xs text-[#A1A1AA] mt-0.5">
            Revenue trends, payment method mix, and staff performance breakdown
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex bg-[#181818] p-1 rounded-xl border border-[#262626]">
            <button
              onClick={() => setTimeframe('today')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                timeframe === 'today' ? 'bg-purple-500 text-white' : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setTimeframe('week')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                timeframe === 'week' ? 'bg-purple-500 text-white' : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setTimeframe('month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                timeframe === 'month' ? 'bg-purple-500 text-white' : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => setTimeframe('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                timeframe === 'all' ? 'bg-purple-500 text-white' : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              All Time
            </button>
          </div>

          <button
            onClick={loadReportData}
            className="p-2.5 rounded-xl bg-[#1A1A1A] hover:bg-[#222222] border border-[#2A2A2A] text-[#A1A1AA] hover:text-white transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-purple-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <div className="bg-[#111111] border border-[#222222] p-4 lg:p-5 rounded-2xl">
          <span className="text-xs font-medium text-[#A1A1AA]">Period Gross Revenue</span>
          <p className="text-xl lg:text-2xl font-bold text-white mt-2">
            {formatCurrency(totalRevenue)}
          </p>
          <p className="text-[11px] text-green-400 mt-1 font-medium">
            {totalTransactions} sales transactions
          </p>
        </div>

        <div className="bg-[#111111] border border-[#222222] p-4 lg:p-5 rounded-2xl">
          <span className="text-xs font-medium text-[#A1A1AA]">Average Ticket Size</span>
          <p className="text-xl lg:text-2xl font-bold text-white mt-2">
            {formatCurrency(avgOrderValue)}
          </p>
          <p className="text-[11px] text-[#71717A] mt-1">Per completed order</p>
        </div>

        <div className="bg-[#111111] border border-[#222222] p-4 lg:p-5 rounded-2xl">
          <span className="text-xs font-medium text-[#A1A1AA]">Total Discounts Given</span>
          <p className="text-xl lg:text-2xl font-bold text-amber-400 mt-2">
            {formatCurrency(totalDiscount)}
          </p>
          <p className="text-[11px] text-[#71717A] mt-1">Customer bill reductions</p>
        </div>

        <div className="bg-[#111111] border border-[#222222] p-4 lg:p-5 rounded-2xl">
          <span className="text-xs font-medium text-[#A1A1AA]">Active Staff Count</span>
          <p className="text-xl lg:text-2xl font-bold text-blue-400 mt-2">
            {workers.length} Staff
          </p>
          <p className="text-[11px] text-[#71717A] mt-1">Registered bar personnel</p>
        </div>
      </div>

      {/* Payment Method Distribution */}
      <div className="bg-[#111111] border border-[#222222] rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Wallet className="w-4 h-4 text-emerald-400" />
          <span>Payment Tender Breakdown</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          
          {/* Cash */}
          <div className="p-4 rounded-xl bg-[#161616] border border-[#222222] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#A1A1AA] flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                Physical Cash
              </span>
              <span className="text-xs font-bold text-emerald-400">{cashPct}%</span>
            </div>
            <p className="text-lg font-bold text-white">{formatCurrency(cashTotal)}</p>
            <div className="w-full h-1.5 bg-[#222222] rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${cashPct}%` }} />
            </div>
          </div>

          {/* POS */}
          <div className="p-4 rounded-xl bg-[#161616] border border-[#222222] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#A1A1AA] flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-blue-400" />
                Card POS
              </span>
              <span className="text-xs font-bold text-blue-400">{posPct}%</span>
            </div>
            <p className="text-lg font-bold text-white">{formatCurrency(posTotal)}</p>
            <div className="w-full h-1.5 bg-[#222222] rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${posPct}%` }} />
            </div>
          </div>

          {/* Transfer */}
          <div className="p-4 rounded-xl bg-[#161616] border border-[#222222] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#A1A1AA] flex items-center gap-1.5">
                <ArrowLeftRight className="w-3.5 h-3.5 text-purple-400" />
                Bank Transfer
              </span>
              <span className="text-xs font-bold text-purple-400">{transferPct}%</span>
            </div>
            <p className="text-lg font-bold text-white">{formatCurrency(transferTotal)}</p>
            <div className="w-full h-1.5 bg-[#222222] rounded-full overflow-hidden">
              <div className="h-full bg-purple-500 rounded-full" style={{ width: `${transferPct}%` }} />
            </div>
          </div>

        </div>
      </div>

      {/* Two Column Split: Best Selling Products & Worker Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Best Selling Products */}
        <div className="bg-[#111111] border border-[#222222] rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-[#222222] flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Package className="w-4 h-4 text-green-400" />
              <span>Top Selling Products by Revenue</span>
            </h3>
            <span className="text-xs text-[#A1A1AA]">Top 8</span>
          </div>

          <div className="divide-y divide-[#1A1A1A]">
            {topProducts.length === 0 ? (
              <p className="text-xs text-[#71717A] text-center py-8">
                No product sales data in selected timeframe.
              </p>
            ) : (
              topProducts.map((p, idx) => (
                <div key={p.name} className="p-3.5 flex items-center justify-between hover:bg-[#161616]">
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-center text-xs font-bold text-[#71717A]">
                      #{idx + 1}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-white">{p.name}</p>
                      <p className="text-[10px] text-[#A1A1AA]">{p.quantity} units sold</p>
                    </div>
                  </div>

                  <p className="text-xs font-bold text-white">
                    {formatCurrency(p.revenue)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Worker Performance Leaderboard */}
        <div className="bg-[#111111] border border-[#222222] rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-[#222222] flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              <span>Cashier Sales Leaderboard</span>
            </h3>
            <span className="text-xs text-[#A1A1AA]">By Revenue</span>
          </div>

          <div className="divide-y divide-[#1A1A1A]">
            {topWorkers.length === 0 ? (
              <p className="text-xs text-[#71717A] text-center py-8">
                No worker sales logged in selected timeframe.
              </p>
            ) : (
              topWorkers.map((w, idx) => (
                <div key={w.email} className="p-3.5 flex items-center justify-between hover:bg-[#161616]">
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-center text-xs font-bold text-amber-400">
                      #{idx + 1}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-white">{w.name}</p>
                      <p className="text-[10px] text-[#A1A1AA]">{w.count} transactions completed</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-xs font-bold text-green-400">{formatCurrency(w.total)}</p>
                    <p className="text-[10px] text-[#71717A] uppercase">{w.role}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
