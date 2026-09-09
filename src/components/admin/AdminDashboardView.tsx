import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Receipt, 
  Wallet, 
  CreditCard, 
  ArrowLeftRight, 
  Users, 
  AlertTriangle, 
  PackageX, 
  Plus, 
  RefreshCw, 
  Boxes, 
  Bell, 
  BarChart3, 
  ChevronRight, 
  Clock, 
  CheckCircle2,
  Eye
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { DashboardStats, Product, SaleWithItems, ShiftWithWorker, AdminNavTab } from '../../types';
import { formatCurrency, formatReceiptDate, formatTime } from '../../utils/formatters';

interface AdminDashboardViewProps {
  onNavigate: (tab: AdminNavTab) => void;
  onSelectSaleForView: (sale: SaleWithItems) => void;
  onOpenNewProductModal: () => void;
  onOpenStockAdjustModal: (product?: Product) => void;
  onOpenBroadcastModal: () => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  onNavigate,
  onSelectSaleForView,
  onOpenNewProductModal,
  onOpenStockAdjustModal,
  onOpenBroadcastModal,
}) => {
  const [stats, setStats] = useState<DashboardStats>({
    todaySales: 0,
    todayTransactions: 0,
    todayCashSales: 0,
    todayPosSales: 0,
    todayTransferSales: 0,
    activeShiftsCount: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
  });
  const [recentSales, setRecentSales] = useState<SaleWithItems[]>([]);
  const [activeShifts, setActiveShifts] = useState<ShiftWithWorker[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const loadDashboardData = async () => {
    try {
      setIsRefreshing(true);
      const [statsData, salesData, shiftsData, productsData] = await Promise.all([
        adminService.getDashboardStats(),
        adminService.getAdminSales({ page: 1, pageSize: 8, dateFilter: 'today' }),
        adminService.getActiveShifts(),
        adminService.getAdminProducts({ status: 'active', stockFilter: 'low' }),
      ]);

      setStats(statsData);
      setRecentSales(salesData.sales);
      setActiveShifts(shiftsData);
      setLowStockProducts(productsData.slice(0, 6));
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();

    // Auto refresh every 20 seconds
    const interval = setInterval(loadDashboardData, 20000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#111111] border border-[#222222] p-4 lg:p-5 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
            <h2 className="text-base font-bold text-white tracking-wide">
              MUNAJ BAR LIVE OPERATIONS
            </h2>
          </div>
          <p className="text-xs text-[#A1A1AA] mt-1">
            Real-time feed synced with active POS terminals and cashier shifts
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadDashboardData}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#1A1A1A] hover:bg-[#222222] border border-[#2A2A2A] text-xs font-semibold text-[#E4E4E7] transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-green-400' : ''}`} />
            <span>{isRefreshing ? 'Syncing...' : 'Refresh Feed'}</span>
          </button>

          <button
            onClick={onOpenBroadcastModal}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-xs font-semibold text-blue-400 transition-colors"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Broadcast Notice</span>
          </button>
        </div>
      </div>

      {/* Primary Key Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {/* Today Sales */}
        <div className="bg-[#111111] border border-[#222222] p-4 lg:p-5 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#A1A1AA]">Today's Revenue</span>
            <div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl lg:text-2xl font-bold text-white mt-2 tracking-tight">
            {formatCurrency(stats.todaySales)}
          </p>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="text-[11px] font-semibold text-green-400">
              {stats.todayTransactions} transactions
            </span>
            <span className="text-[11px] text-[#71717A]">completed</span>
          </div>
        </div>

        {/* Cash Sales */}
        <div className="bg-[#111111] border border-[#222222] p-4 lg:p-5 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#A1A1AA]">Cash Collected</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl lg:text-2xl font-bold text-white mt-2 tracking-tight">
            {formatCurrency(stats.todayCashSales)}
          </p>
          <p className="text-[11px] text-[#71717A] mt-2">
            Physical cash in active registers
          </p>
        </div>

        {/* POS & Transfer Sales */}
        <div className="bg-[#111111] border border-[#222222] p-4 lg:p-5 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#A1A1AA]">POS & Transfer</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl lg:text-2xl font-bold text-white mt-2 tracking-tight">
            {formatCurrency(stats.todayPosSales + stats.todayTransferSales)}
          </p>
          <div className="flex items-center gap-2 mt-2 text-[11px] text-[#A1A1AA]">
            <span>POS: <b className="text-white">{formatCurrency(stats.todayPosSales)}</b></span>
            <span>•</span>
            <span>Trf: <b className="text-white">{formatCurrency(stats.todayTransferSales)}</b></span>
          </div>
        </div>

        {/* Active Cashiers & Registers */}
        <div className="bg-[#111111] border border-[#222222] p-4 lg:p-5 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#A1A1AA]">Active Shifts</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl lg:text-2xl font-bold text-white mt-2 tracking-tight">
            {stats.activeShiftsCount}
          </p>
          <p className="text-[11px] text-purple-400 mt-2 font-medium">
            {stats.activeShiftsCount > 0 ? 'Cashiers on duty now' : 'No active shifts'}
          </p>
        </div>
      </div>

      {/* Secondary Stock Alert Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
        <div className="bg-[#141414] border border-[#222222] p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">
                {stats.lowStockCount} Low Stock Products
              </p>
              <p className="text-xs text-[#A1A1AA]">
                Items at or below minimum reorder threshold
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('inventory')}
            className="px-3 py-1.5 rounded-lg bg-[#1F1F1F] hover:bg-[#2A2A2A] text-xs font-semibold text-white transition-colors"
          >
            Inspect
          </button>
        </div>

        <div className="bg-[#141414] border border-[#222222] p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
              <PackageX className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">
                {stats.outOfStockCount} Out of Stock
              </p>
              <p className="text-xs text-[#A1A1AA]">
                Products with 0 inventory remaining
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('inventory')}
            className="px-3 py-1.5 rounded-lg bg-[#1F1F1F] hover:bg-[#2A2A2A] text-xs font-semibold text-white transition-colors"
          >
            View
          </button>
        </div>
      </div>

      {/* Quick Actions Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={onOpenNewProductModal}
          className="flex items-center justify-center gap-2 p-3.5 rounded-xl bg-[#141414] hover:bg-[#1C1C1C] border border-[#242424] text-xs font-semibold text-white transition-all active:scale-95"
        >
          <Plus className="w-4 h-4 text-green-400" />
          <span>New Product</span>
        </button>

        <button
          onClick={() => onOpenStockAdjustModal()}
          className="flex items-center justify-center gap-2 p-3.5 rounded-xl bg-[#141414] hover:bg-[#1C1C1C] border border-[#242424] text-xs font-semibold text-white transition-all active:scale-95"
        >
          <Boxes className="w-4 h-4 text-amber-400" />
          <span>Adjust Stock</span>
        </button>

        <button
          onClick={() => onNavigate('shifts')}
          className="flex items-center justify-center gap-2 p-3.5 rounded-xl bg-[#141414] hover:bg-[#1C1C1C] border border-[#242424] text-xs font-semibold text-white transition-all active:scale-95"
        >
          <Clock className="w-4 h-4 text-blue-400" />
          <span>Cash Recon</span>
        </button>

        <button
          onClick={() => onNavigate('reports')}
          className="flex items-center justify-center gap-2 p-3.5 rounded-xl bg-[#141414] hover:bg-[#1C1C1C] border border-[#242424] text-xs font-semibold text-white transition-all active:scale-95"
        >
          <BarChart3 className="w-4 h-4 text-purple-400" />
          <span>Analytics Reports</span>
        </button>
      </div>

      {/* Main Two-Column Split: Live Sales Stream & Active Cashiers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Live Sales Stream */}
        <div className="lg:col-span-2 bg-[#111111] border border-[#222222] rounded-2xl overflow-hidden flex flex-col">
          <div className="p-4 lg:p-5 border-b border-[#222222] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Receipt className="w-4 h-4 text-green-400" />
              <h3 className="text-sm font-bold text-white">
                Live Sales Feed (Today)
              </h3>
            </div>
            <button
              onClick={() => onNavigate('sales')}
              className="text-xs font-semibold text-green-400 hover:underline flex items-center gap-1"
            >
              <span>View All Sales</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 divide-y divide-[#1A1A1A]">
            {recentSales.length === 0 ? (
              <div className="p-12 text-center text-[#71717A]">
                <Receipt className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">No sales recorded today yet.</p>
                <p className="text-xs mt-1">When cashiers process sales, they will stream here live.</p>
              </div>
            ) : (
              recentSales.map((sale) => (
                <div
                  key={sale.id}
                  onClick={() => onSelectSaleForView(sale)}
                  className="p-4 flex items-center justify-between hover:bg-[#161616] cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] flex items-center justify-center text-xs font-bold text-green-400">
                      {sale.payment_method === 'cash' ? 'CASH' : sale.payment_method === 'pos' ? 'POS' : 'TRF'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-white">
                          {sale.receipt_number}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20 uppercase font-medium">
                          {sale.payment_method}
                        </span>
                      </div>
                      <p className="text-xs text-[#A1A1AA] mt-0.5">
                        Worker: <span className="text-white font-medium">{sale.worker?.full_name || 'Cashier'}</span> • {formatTime(sale.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="text-right flex items-center gap-3">
                    <div>
                      <p className="text-sm font-bold text-white">
                        {formatCurrency(sale.total)}
                      </p>
                      <p className="text-[10px] text-[#71717A]">
                        {sale.items?.length || 1} items
                      </p>
                    </div>
                    <button className="p-1.5 rounded-lg bg-[#1A1A1A] text-[#A1A1AA] hover:text-white">
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Col: Active Cashiers & Quick Restock */}
        <div className="space-y-6">
          
          {/* Active Cashier Registers */}
          <div className="bg-[#111111] border border-[#222222] rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-[#222222] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-white">Active Cashiers</h3>
              </div>
              <span className="text-xs font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
                {activeShifts.length} Open
              </span>
            </div>

            <div className="p-3 space-y-2">
              {activeShifts.length === 0 ? (
                <p className="text-xs text-[#71717A] text-center py-6">
                  No cashier registers are currently open.
                </p>
              ) : (
                activeShifts.map((shift) => (
                  <div
                    key={shift.id}
                    className="p-3 rounded-xl bg-[#161616] border border-[#222222] space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold flex items-center justify-center">
                          {shift.worker?.full_name?.charAt(0).toUpperCase() || 'W'}
                        </div>
                        <span className="text-xs font-bold text-white">
                          {shift.worker?.full_name || 'Cashier'}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#A1A1AA]">
                        Since {formatTime(shift.started_at)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-[#222222]">
                      <div>
                        <span className="text-[#71717A]">Opening Cash:</span>
                        <p className="font-semibold text-white">{formatCurrency(shift.opening_cash)}</p>
                      </div>
                      <div>
                        <span className="text-[#71717A]">Sales Done:</span>
                        <p className="font-semibold text-green-400">{formatCurrency(shift.summary?.total_sales || 0)}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Restock Needed Widget */}
          <div className="bg-[#111111] border border-[#222222] rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-[#222222] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Low Stock Watch</h3>
              </div>
              <button
                onClick={() => onNavigate('inventory')}
                className="text-xs text-amber-400 hover:underline"
              >
                All
              </button>
            </div>

            <div className="p-3 space-y-2">
              {lowStockProducts.length === 0 ? (
                <div className="text-center py-6 text-[#71717A]">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-green-500/50 mb-1" />
                  <p className="text-xs">All products have healthy inventory.</p>
                </div>
              ) : (
                lowStockProducts.map((p) => (
                  <div
                    key={p.id}
                    className="p-2.5 rounded-xl bg-[#161616] border border-[#222222] flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-bold text-white truncate max-w-[140px]">
                        {p.name}
                      </p>
                      <p className="text-[10px] text-[#A1A1AA]">
                        Remaining: <b className="text-amber-400">{p.stock_quantity}</b> / Min: {p.minimum_stock_level}
                      </p>
                    </div>

                    <button
                      onClick={() => onOpenStockAdjustModal(p)}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[11px] font-bold"
                    >
                      + Restock
                    </button>
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
