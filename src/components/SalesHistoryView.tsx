import React, { useState, useEffect } from 'react';
import { 
  ReceiptText, 
  Search, 
  Calendar, 
  Printer, 
  CreditCard, 
  Banknote, 
  ArrowRightLeft, 
  X, 
  RefreshCw,
  Clock
} from 'lucide-react';
import { saleService } from '../services/saleService';
import { SaleWithItems } from '../types';
import { formatNaira, formatDateTime, formatTime, formatDate, getSaleSeller } from '../utils/formatters';

interface SalesHistoryViewProps {
  onSelectSaleForReprint: (sale: SaleWithItems) => void;
}

export const SalesHistoryView: React.FC<SalesHistoryViewProps> = ({ onSelectSaleForReprint }) => {
  const [sales, setSales] = useState<SaleWithItems[]>([]);
  const [filter, setFilter] = useState<'today' | 'yesterday' | 'week' | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const loadSales = async () => {
    try {
      setIsLoading(true);
      const data = await saleService.getWorkerSales(filter);
      setSales(data);
    } catch (err) {
      console.error('Error loading sales:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSales();
  }, [filter]);

  useEffect(() => {
    const unsubscribe = saleService.subscribeToAllCompletedSales(() => {
      loadSales();
    });
    return () => {
      unsubscribe();
    };
  }, [filter]);

  const filteredSales = sales.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const seller = getSaleSeller(s);
    return (
      (s.receipt_number && s.receipt_number.toLowerCase().includes(q)) ||
      (s.payment_method && s.payment_method.toLowerCase().includes(q)) ||
      seller.name.toLowerCase().includes(q) ||
      seller.role.toLowerCase().includes(q) ||
      s.items?.some((i) => i.product_name && i.product_name.toLowerCase().includes(q))
    );
  });

  const totalFilteredAmount = filteredSales.reduce((sum, s) => sum + Number(s.total || 0), 0);

  const getPaymentBadge = (method: string) => {
    switch (method.toLowerCase()) {
      case 'cash':
        return (
          <span className="inline-flex items-center space-x-1 bg-green-500/15 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-md text-[11px] font-bold uppercase">
            <Banknote className="w-3 h-3" />
            <span>Cash</span>
          </span>
        );
      case 'pos':
        return (
          <span className="inline-flex items-center space-x-1 bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded-md text-[11px] font-bold uppercase">
            <CreditCard className="w-3 h-3" />
            <span>POS Card</span>
          </span>
        );
      case 'transfer':
        return (
          <span className="inline-flex items-center space-x-1 bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-md text-[11px] font-bold uppercase">
            <ArrowRightLeft className="w-3 h-3" />
            <span>Transfer</span>
          </span>
        );
      default:
        return <span className="text-xs text-white uppercase font-bold">{method}</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-5">
      
      {/* Header with Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#111111] border border-[#222222] rounded-2xl p-4 sm:p-6 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-green-500/15 text-green-400 flex items-center justify-center font-bold">
            <ReceiptText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-wide">
              MY SALES HISTORY
            </h2>
            <p className="text-xs text-[#A1A1AA]">
              View and reprint thermal receipts for sales completed during your shifts
            </p>
          </div>
        </div>

        <div className="bg-[#181818] border border-[#262626] rounded-xl px-4 py-2 flex items-center justify-between sm:justify-start space-x-4">
          <div className="text-left">
            <span className="text-[10px] text-[#A1A1AA] uppercase tracking-wider block">
              Filtered Total ({filteredSales.length} sales)
            </span>
            <span className="text-lg font-black text-green-400">
              {formatNaira(totalFilteredAmount)}
            </span>
          </div>
          <button
            onClick={loadSales}
            title="Refresh Sales"
            className="p-2 rounded-lg bg-[#222222] hover:bg-[#2c2c2c] text-[#A1A1AA] hover:text-white transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        
        {/* Date Filter Tabs */}
        <div className="flex items-center space-x-1.5 bg-[#111111] p-1.5 rounded-xl border border-[#222222] w-full sm:w-auto overflow-x-auto no-scrollbar">
          {(['today', 'yesterday', 'week', 'all'] as const).map((f) => (
            <button
              key={f}
              id={`filter-${f}-btn`}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                filter === f
                  ? 'bg-green-500 text-black shadow-md shadow-green-900/30'
                  : 'text-[#A1A1AA] hover:text-white hover:bg-[#181818]'
              }`}
            >
              {f === 'today'
                ? 'Today'
                : f === 'yesterday'
                ? 'Yesterday'
                : f === 'week'
                ? 'This Week'
                : 'All History'}
            </button>
          ))}
        </div>

        {/* Search Field */}
        <div className="relative w-full sm:w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#71717A]">
            <Search className="w-3.5 h-3.5" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search receipt # (e.g. MB-000001)..."
            className="w-full bg-[#111111] border border-[#262626] focus:border-green-500 focus:ring-1 focus:ring-green-500 text-white rounded-xl pl-9 pr-8 py-2 text-xs outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[#71717A] hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Sales List */}
      {isLoading ? (
        <div className="bg-[#111111] border border-[#222222] rounded-2xl p-12 text-center">
          <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-white">Loading sales...</p>
        </div>
      ) : filteredSales.length === 0 ? (
        <div className="bg-[#111111] border border-[#222222] rounded-2xl p-12 text-center">
          <ReceiptText className="w-12 h-12 text-[#333333] mx-auto mb-3" />
          <h3 className="text-base font-bold text-white mb-1">No sales yet</h3>
          <p className="text-xs text-[#A1A1AA]">
            {searchQuery
              ? `No transactions match "${searchQuery}".`
              : 'You have not recorded any sales for this time period.'}
          </p>
        </div>
      ) : (
        <div className="bg-[#111111] border border-[#222222] rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-[#181818] border-b border-[#222222] text-[#A1A1AA] uppercase text-[11px] font-semibold tracking-wider">
                <tr>
                  <th className="py-3 px-4">Receipt #</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Sold By</th>
                  <th className="py-3 px-4">Items Sold</th>
                  <th className="py-3 px-4">Payment Method</th>
                  <th className="py-3 px-4 text-right">Total Amount</th>
                  <th className="py-3 px-4 text-center">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1c1c1c]">
                {filteredSales.map((sale) => {
                  const seller = getSaleSeller(sale);

                  return (
                    <tr
                      key={sale.id}
                      className="hover:bg-[#161616] transition-colors"
                    >
                      {/* Receipt Number */}
                      <td className="py-3.5 px-4 font-mono font-bold text-white whitespace-nowrap">
                        {sale.receipt_number}
                      </td>

                      {/* Date & Time */}
                      <td className="py-3.5 px-4 text-white font-medium whitespace-nowrap">
                        {formatDateTime(sale.created_at)}
                      </td>

                      {/* Sold By */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 rounded-full bg-[#222222] border border-[#333333] flex items-center justify-center text-[10px] font-bold text-green-400">
                            {seller.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-white font-medium text-xs leading-tight">
                              {seller.name}
                            </div>
                            <div className="text-[10px] text-[#A1A1AA] leading-tight font-medium">
                              {seller.role}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Items Sold */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          {sale.items && sale.items.length > 0 ? (
                            sale.items.map((item, idx) => (
                              <div 
                                key={item.id || idx} 
                                className="text-white font-medium text-xs sm:text-sm whitespace-nowrap"
                              >
                                <span className="font-bold">{item.quantity}x</span>{' '}
                                <span>{item.product_name}</span>
                              </div>
                            ))
                          ) : (
                            <span className="text-[#71717A] text-xs">No items recorded</span>
                          )}
                        </div>
                      </td>

                      {/* Payment Method */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getPaymentBadge(sale.payment_method)}
                      </td>

                      {/* Total Amount */}
                      <td className="py-3.5 px-4 text-right font-black text-green-400 text-sm sm:text-base whitespace-nowrap">
                        {formatNaira(sale.total)}
                      </td>

                      {/* Receipt Action Button */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => onSelectSaleForReprint(sale)}
                          title="Download PDF or view receipt slip"
                          className="px-3 py-1.5 rounded-xl bg-[#181818] hover:bg-green-500 hover:text-black border border-[#2a2a2a] hover:border-green-500 text-[#D4D4D8] transition-all inline-flex items-center space-x-1.5 cursor-pointer font-bold text-xs"
                        >
                          <ReceiptText className="w-3.5 h-3.5" />
                          <span>RECEIPT</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
