import React, { useState, useEffect } from 'react';
import { 
  Receipt, 
  Search, 
  Filter, 
  Calendar, 
  Download, 
  ChevronLeft, 
  ChevronRight, 
  Printer, 
  Eye, 
  RefreshCw,
  Wallet,
  CreditCard,
  ArrowLeftRight
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { Profile, SaleWithItems } from '../../types';
import { formatCurrency, formatReceiptDate, formatTime, getSaleSeller } from '../../utils/formatters';

interface AdminSalesViewProps {
  onSelectSaleForView: (sale: SaleWithItems) => void;
}

export const AdminSalesView: React.FC<AdminSalesViewProps> = ({
  onSelectSaleForView,
}) => {
  const [sales, setSales] = useState<SaleWithItems[]>([]);
  const [workers, setWorkers] = useState<Profile[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom' | 'all'>('today');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('all');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);

  // Load Workers list for dropdown filter
  useEffect(() => {
    adminService.getAllWorkers().then(setWorkers).catch(console.error);
  }, []);

  const loadSales = async () => {
    try {
      setIsLoading(true);
      const res = await adminService.getAdminSales({
        page: currentPage,
        pageSize,
        dateFilter,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        endDate: endDate ? new Date(endDate + 'T23:59:59').toISOString() : undefined,
        workerId: selectedWorkerId,
        paymentMethod: selectedPaymentMethod,
        status: selectedStatus,
        searchQuery,
      });

      setSales(res.sales);
      setTotalCount(res.totalCount);
    } catch (err) {
      console.error('Error fetching sales:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSales();
  }, [currentPage, pageSize, dateFilter, selectedWorkerId, selectedPaymentMethod, selectedStatus]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadSales();
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const currentTotalAmount = sales.reduce((acc, s) => acc + Number(s.total || 0), 0);

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Controls: Search and Filters */}
      <div className="bg-[#111111] border border-[#222222] p-4 lg:p-6 rounded-2xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Search Input */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#A1A1AA] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search receipt number (e.g. MB-000001)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#181818] border border-[#2A2A2A] rounded-xl text-xs text-white placeholder-[#71717A] focus:outline-hidden focus:border-green-500 transition-colors"
            />
          </form>

          {/* Refresh and Filter Count */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#A1A1AA]">
              Found <b className="text-white">{totalCount}</b> records
            </span>
            <button
              onClick={loadSales}
              disabled={isLoading}
              className="p-2.5 rounded-xl bg-[#1A1A1A] hover:bg-[#222222] border border-[#2A2A2A] text-[#A1A1AA] hover:text-white transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-green-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-3 border-t border-[#1F1F1F]">
          
          {/* Date Presets */}
          <div>
            <label className="block text-[11px] font-medium text-[#A1A1AA] mb-1">Timeframe</label>
            <select
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-[#181818] border border-[#2A2A2A] rounded-xl text-xs text-white focus:outline-hidden focus:border-green-500"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="week">Past 7 Days</option>
              <option value="month">This Month</option>
              <option value="all">All Time</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {/* Worker Filter */}
          <div>
            <label className="block text-[11px] font-medium text-[#A1A1AA] mb-1">Worker / Cashier</label>
            <select
              value={selectedWorkerId}
              onChange={(e) => {
                setSelectedWorkerId(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-[#181818] border border-[#2A2A2A] rounded-xl text-xs text-white focus:outline-hidden focus:border-green-500"
            >
              <option value="all">All Cashiers</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.full_name} ({w.role})
                </option>
              ))}
            </select>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-[11px] font-medium text-[#A1A1AA] mb-1">Payment Method</label>
            <select
              value={selectedPaymentMethod}
              onChange={(e) => {
                setSelectedPaymentMethod(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-[#181818] border border-[#2A2A2A] rounded-xl text-xs text-white focus:outline-hidden focus:border-green-500"
            >
              <option value="all">All Methods</option>
              <option value="cash">Cash Only</option>
              <option value="pos">POS Only</option>
              <option value="transfer">Bank Transfer</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[11px] font-medium text-[#A1A1AA] mb-1">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-[#181818] border border-[#2A2A2A] rounded-xl text-xs text-white focus:outline-hidden focus:border-green-500"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Rows Per Page */}
          <div>
            <label className="block text-[11px] font-medium text-[#A1A1AA] mb-1">Rows per page</label>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-[#181818] border border-[#2A2A2A] rounded-xl text-xs text-white focus:outline-hidden focus:border-green-500"
            >
              <option value={10}>10 rows</option>
              <option value={15}>15 rows</option>
              <option value={25}>25 rows</option>
              <option value={50}>50 rows</option>
            </select>
          </div>
        </div>

        {/* Custom Date Pickers */}
        {dateFilter === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-[#1F1F1F]">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#A1A1AA]">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-1.5 bg-[#181818] border border-[#2A2A2A] rounded-lg text-xs text-white focus:outline-hidden"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#A1A1AA]">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1.5 bg-[#181818] border border-[#2A2A2A] rounded-lg text-xs text-white focus:outline-hidden"
              />
            </div>
            <button
              onClick={() => {
                setCurrentPage(1);
                loadSales();
              }}
              className="px-3 py-1.5 rounded-lg bg-green-500 text-black font-semibold text-xs hover:bg-green-400 transition-colors"
            >
              Apply Dates
            </button>
          </div>
        )}
      </div>

      {/* Sales Table Container */}
      <div className="bg-[#111111] border border-[#222222] rounded-2xl overflow-hidden flex flex-col">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#222222] bg-[#141414] text-[11px] font-semibold text-[#A1A1AA] uppercase tracking-wider">
                <th className="py-3.5 px-4">Receipt #</th>
                <th className="py-3.5 px-4">Date & Time</th>
                <th className="py-3.5 px-4">Sold By</th>
                <th className="py-3.5 px-4">Payment Method</th>
                <th className="py-3.5 px-4 text-center">Items</th>
                <th className="py-3.5 px-4 text-right">Subtotal</th>
                <th className="py-3.5 px-4 text-right">Discount</th>
                <th className="py-3.5 px-4 text-right">Total (₦)</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#1A1A1A] text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-[#71717A]">
                    <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading sales records...
                  </td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-[#71717A]">
                    <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No sales matched the specified filters.
                  </td>
                </tr>
              ) : (
                sales.map((sale) => {
                  const seller = getSaleSeller(sale);
                  return (
                  <tr
                    key={sale.id}
                    onClick={() => onSelectSaleForView(sale)}
                    className="hover:bg-[#161616] cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-white">
                      {sale.receipt_number}
                    </td>
                    <td className="py-3 px-4 text-[#A1A1AA]">
                      <div>{formatReceiptDate(sale.created_at)}</div>
                      <div className="text-[10px] text-[#71717A]">{formatTime(sale.created_at)}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">
                        {seller.name}
                      </div>
                      <div className="text-[10px] text-[#71717A]">
                        {seller.role}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        sale.payment_method === 'cash'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : sale.payment_method === 'pos'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                      }`}>
                        {sale.payment_method === 'cash' && <Wallet className="w-3 h-3" />}
                        {sale.payment_method === 'pos' && <CreditCard className="w-3 h-3" />}
                        {sale.payment_method === 'transfer' && <ArrowLeftRight className="w-3 h-3" />}
                        {sale.payment_method}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-medium text-[#E4E4E7]">
                      {sale.items?.length || 1}
                    </td>
                    <td className="py-3 px-4 text-right text-[#A1A1AA]">
                      {formatCurrency(sale.subtotal)}
                    </td>
                    <td className="py-3 px-4 text-right text-amber-400">
                      {sale.discount > 0 ? `-${formatCurrency(sale.discount)}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-white text-sm">
                      {formatCurrency(sale.total)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        sale.status === 'completed'
                          ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {sale.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onSelectSaleForView(sale)}
                        className="p-1.5 rounded-lg bg-[#1F1F1F] text-[#A1A1AA] hover:text-white hover:bg-green-500 hover:text-black transition-colors"
                        title="View Thermal Receipt"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-[#222222] bg-[#141414] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-[#A1A1AA]">
            Showing <b className="text-white">{sales.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</b> to{' '}
            <b className="text-white">{Math.min(currentPage * pageSize, totalCount)}</b> of{' '}
            <b className="text-white">{totalCount}</b> total sales
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1 || isLoading}
              className="p-2 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] text-white disabled:opacity-30 hover:bg-[#222222] transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-3 py-1 font-semibold text-white">
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || isLoading}
              className="p-2 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] text-white disabled:opacity-30 hover:bg-[#222222] transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
