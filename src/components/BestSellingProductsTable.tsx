import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  Search, 
  RefreshCw, 
  Award, 
  Wine, 
  Filter, 
  Layers,
  PackageCheck,
  AlertTriangle,
  PackageX,
  Sparkles
} from 'lucide-react';
import { saleService } from '../services/saleService';
import { BestSellingProductItem } from '../types';
import { useWorkerBranding } from '../context/WorkerBrandingContext';
import { formatNaira } from '../utils/formatters';

export type ProductAnalysisPeriod = 
  | 'today' 
  | 'yesterday' 
  | 'week' 
  | 'last7' 
  | 'month' 
  | 'last30' 
  | 'year' 
  | 'all';

export type ProductFilterType = 'all' | 'sold' | 'unsold' | 'low_stock';

interface BestSellingProductsTableProps {
  initialPeriod?: ProductAnalysisPeriod;
  className?: string;
}

export const BestSellingProductsTable: React.FC<BestSellingProductsTableProps> = ({
  initialPeriod = 'today',
  className = '',
}) => {
  const { workerPrimaryColor, textColor } = useWorkerBranding();

  const [period, setPeriod] = useState<ProductAnalysisPeriod>(initialPeriod);
  const [items, setItems] = useState<BestSellingProductItem[]>([]);
  const [activeTab, setActiveTab] = useState<ProductFilterType>('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  // Synchronize period when initialPeriod changes
  useEffect(() => {
    if (initialPeriod) {
      setPeriod(initialPeriod);
    }
  }, [initialPeriod]);

  // Load product analysis & daily stock tracking from Supabase
  const loadProductAnalysis = async () => {
    try {
      setIsLoading(true);
      const data = await saleService.getBestSellingProducts(period);
      setItems(data);
      setLastRefreshedAt(new Date());
    } catch (err) {
      console.error('Error loading best-selling products & daily stock:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProductAnalysis();
  }, [period]);

  // Real-time automatic updates when completed sales, products, or stock movements occur in Supabase
  useEffect(() => {
    const unsubscribe = saleService.subscribeToAllCompletedSales(() => {
      loadProductAnalysis();
    });
    return () => {
      unsubscribe();
    };
  }, [period]);

  // Quick stats counts
  const soldItemsCount = useMemo(() => items.filter((i) => i.unitsSold > 0).length, [items]);
  const unsoldItemsCount = useMemo(() => items.filter((i) => i.unitsSold === 0).length, [items]);
  const lowStockCount = useMemo(() => items.filter((i) => (i.currentStock ?? 0) <= (i.minimumStockLevel ?? 5)).length, [items]);
  const outOfStockCount = useMemo(() => items.filter((i) => (i.currentStock ?? 0) <= 0).length, [items]);

  // Total Stock Metrics
  const totalStartingStock = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.startingStock ?? item.currentStock ?? 0), 0);
  }, [items]);

  const totalUnitsSold = useMemo(() => {
    return items.reduce((sum, item) => sum + item.unitsSold, 0);
  }, [items]);

  const totalRemainingStock = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.currentStock ?? 0), 0);
  }, [items]);

  const totalGrossRevenue = useMemo(() => {
    return items.reduce((sum, item) => sum + item.grossRevenue, 0);
  }, [items]);

  const topProduct = useMemo(() => {
    const sold = items.filter((i) => i.unitsSold > 0 || i.grossRevenue > 0);
    return sold.length > 0 ? sold[0] : null;
  }, [items]);

  // Filter items based on active filter tab & search query
  const filteredItems = useMemo(() => {
    let result = items;

    if (activeTab === 'sold') {
      result = result.filter((i) => i.unitsSold > 0 || i.grossRevenue > 0);
    } else if (activeTab === 'unsold') {
      result = result.filter((i) => i.unitsSold === 0 && i.grossRevenue === 0);
    } else if (activeTab === 'low_stock') {
      result = result.filter((i) => (i.currentStock ?? 0) <= (i.minimumStockLevel ?? 5));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((item) => 
        item.productName.toLowerCase().includes(q) || 
        (item.categoryName && item.categoryName.toLowerCase().includes(q))
      );
    }

    return result;
  }, [items, activeTab, searchQuery]);

  const periodOptions: { id: ProductAnalysisPeriod; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'week', label: 'This Week' },
    { id: 'last7', label: 'Last 7 Days' },
    { id: 'month', label: 'This Month' },
    { id: 'last30', label: 'Last 30 Days' },
    { id: 'year', label: 'This Year' },
    { id: 'all', label: 'All Time' },
  ];

  const getRankBadgeClass = (rank: number, unitsSold: number) => {
    if (unitsSold === 0) {
      return 'bg-[#1a1a1a] text-[#71717A] border-[#2A2A2A] font-semibold';
    }
    if (rank === 1) {
      return 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-black shadow-amber-500/10 shadow-sm';
    }
    if (rank === 2) {
      return 'bg-slate-300/20 text-slate-200 border-slate-300/40 font-black';
    }
    if (rank === 3) {
      return 'bg-amber-700/20 text-amber-400 border-amber-700/40 font-black';
    }
    return 'bg-[#222222] text-[#A1A1AA] border-[#333333] font-bold';
  };

  const isTodayPeriod = period === 'today';
  const soldLabel = isTodayPeriod ? 'Sold Today' : 'Quantity Sold';

  return (
    <section id="cashier-daily-stock-section" className={`space-y-4 ${className}`}>
      
      {/* SECTION HEADER & SUMMARY */}
      <div className="bg-[#111111] border border-[#222222] rounded-2xl p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Title & Subtitle */}
          <div className="flex items-start sm:items-center space-x-3.5">
            <div 
              className="w-11 h-11 rounded-xl border flex items-center justify-center font-black text-lg shadow-md shrink-0 mt-0.5 sm:mt-0"
              style={{
                backgroundColor: 'rgba(var(--worker-primary-rgb, 183, 255, 0), 0.15)',
                borderColor: 'rgba(var(--worker-primary-rgb, 183, 255, 0), 0.35)',
                color: workerPrimaryColor,
              }}
            >
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 id="daily-stock-title" className="text-xl sm:text-2xl font-black text-white tracking-wide">
                  Cashier Daily Stock Tracking
                </h2>
                <span 
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider hidden sm:inline-block"
                  style={{
                    backgroundColor: 'rgba(var(--worker-primary-rgb, 183, 255, 0), 0.15)',
                    borderColor: 'rgba(var(--worker-primary-rgb, 183, 255, 0), 0.3)',
                    color: workerPrimaryColor,
                  }}
                >
                  Live Supabase Sync
                </span>
              </div>
              <p id="daily-stock-subtitle" className="text-xs sm:text-sm font-medium text-[#A1A1AA] mt-0.5">
                Real-time Starting Stock, Quantity Sold & Remaining Stock per product
              </p>
            </div>
          </div>

          {/* Controls: Search, View Mode, Period filter, Refresh */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Search Input */}
            <div className="relative min-w-[160px] sm:min-w-[200px] flex-1 sm:flex-initial">
              <Search className="w-3.5 h-3.5 text-[#71717A] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="daily-stock-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search product or category..."
                className="w-full bg-[#181818] border border-[#2A2A2A] focus:border-[#444444] rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-[#71717A] focus:outline-none transition-colors"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')} 
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#71717A] hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>

            {/* View Mode Toggle (Table / Cards) */}
            <div className="flex items-center bg-[#181818] border border-[#2A2A2A] rounded-xl p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-[#2A2A2A] text-white shadow-sm'
                    : 'text-[#71717A] hover:text-white'
                }`}
                title="Table View"
              >
                Table
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'cards'
                    ? 'bg-[#2A2A2A] text-white shadow-sm'
                    : 'text-[#71717A] hover:text-white'
                }`}
                title="Cards View"
              >
                Cards
              </button>
            </div>

            {/* Period Selector */}
            <select
              id="daily-stock-period-select"
              value={period}
              onChange={(e) => setPeriod(e.target.value as ProductAnalysisPeriod)}
              className="bg-[#181818] border border-[#2A2A2A] text-white text-xs font-semibold px-3 py-2 rounded-xl focus:outline-none cursor-pointer"
            >
              {periodOptions.map((opt) => (
                <option key={opt.id} value={opt.id} className="bg-[#181818] text-white">
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Refresh Button */}
            <button
              id="daily-stock-refresh-btn"
              onClick={loadProductAnalysis}
              disabled={isLoading}
              title="Refresh Daily Stock Tracking"
              className="p-2 rounded-xl bg-[#181818] hover:bg-[#222222] border border-[#2A2A2A] text-[#A1A1AA] hover:text-white transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

          </div>

        </div>

        {/* 3 Core Daily Stock Metric Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-[#1F1F1F]">
          
          {/* 1. Total Starting Stock */}
          <div className="bg-[#161616] border border-[#242424] rounded-xl p-3">
            <span className="text-[10px] text-[#A1A1AA] font-bold uppercase tracking-wider block mb-1">
              Starting Stock
            </span>
            <div className="text-sm font-extrabold text-white">
              {totalStartingStock.toLocaleString()} units
            </div>
            <div className="text-[11px] text-[#71717A] mt-0.5">
              Available at start of period
            </div>
          </div>

          {/* 2. Total Sold Today / Period */}
          <div className="bg-[#161616] border border-[#242424] rounded-xl p-3">
            <span className="text-[10px] text-[#A1A1AA] font-bold uppercase tracking-wider block mb-1">
              {soldLabel}
            </span>
            <div className="text-sm font-extrabold text-green-400">
              {totalUnitsSold.toLocaleString()} units
            </div>
            <div className="text-[11px] text-[#71717A] mt-0.5">
              Across {soldItemsCount} sold product lines
            </div>
          </div>

          {/* 3. Total Remaining Stock */}
          <div className="bg-[#161616] border border-[#242424] rounded-xl p-3">
            <span className="text-[10px] text-[#A1A1AA] font-bold uppercase tracking-wider block mb-1">
              Remaining Stock
            </span>
            <div className="text-sm font-extrabold text-emerald-400">
              {totalRemainingStock.toLocaleString()} units
            </div>
            <div className="text-[11px] text-[#71717A] mt-0.5">
              Authoritative Supabase stock
            </div>
          </div>

          {/* 4. Total Revenue */}
          <div className="bg-[#161616] border border-[#242424] rounded-xl p-3">
            <span className="text-[10px] text-[#A1A1AA] font-bold uppercase tracking-wider block mb-1">
              Gross Bar Revenue
            </span>
            <div className="text-sm font-extrabold text-white">
              {formatNaira(totalGrossRevenue)}
            </div>
            <div className="text-[11px] text-[#71717A] mt-0.5">
              Completed sales
            </div>
          </div>

        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-[#1C1C1C]">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'all'
                ? 'bg-white text-black'
                : 'bg-[#181818] text-[#A1A1AA] hover:text-white border border-[#262626]'
            }`}
          >
            All Products ({items.length})
          </button>
          
          <button
            onClick={() => setActiveTab('sold')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'sold'
                ? 'bg-green-500 text-black'
                : 'bg-[#181818] text-[#A1A1AA] hover:text-white border border-[#262626]'
            }`}
          >
            Sold Products ({soldItemsCount})
          </button>

          <button
            onClick={() => setActiveTab('unsold')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'unsold'
                ? 'bg-amber-500 text-black'
                : 'bg-[#181818] text-[#A1A1AA] hover:text-white border border-[#262626]'
            }`}
          >
            Unsold ({unsoldItemsCount})
          </button>

          {lowStockCount > 0 && (
            <button
              onClick={() => setActiveTab('low_stock')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'low_stock'
                  ? 'bg-red-500 text-white'
                  : 'bg-[#181818] text-red-400 hover:text-white border border-red-500/30'
              }`}
            >
              Low / Out of Stock ({lowStockCount})
            </button>
          )}
        </div>

      </div>

      {/* DAILY STOCK TRACKING: CARDS VIEW */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {isLoading && items.length === 0 ? (
            <div className="col-span-full py-16 text-center space-y-3 bg-[#111111] border border-[#222222] rounded-2xl">
              <RefreshCw className="w-8 h-8 text-green-400 animate-spin mx-auto" />
              <p className="text-xs font-semibold text-[#A1A1AA]">
                Loading daily stock tracking from Supabase...
              </p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="col-span-full py-16 text-center space-y-3 bg-[#111111] border border-[#222222] rounded-2xl">
              <div className="w-12 h-12 rounded-2xl bg-[#181818] border border-[#2A2A2A] text-[#71717A] flex items-center justify-center mx-auto">
                <Wine className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-white">No products found for this filter</p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const currentStock = item.currentStock ?? 0;
              const startingStock = item.startingStock ?? currentStock;
              const unitsSold = item.unitsSold;
              const minStock = item.minimumStockLevel ?? 5;
              const isOutOfStock = currentStock <= 0;
              const isLowStock = currentStock > 0 && currentStock <= minStock;

              return (
                <div 
                  key={item.productId || item.productName}
                  className="bg-[#111111] border border-[#222222] hover:border-[#333333] rounded-2xl p-4 space-y-3 transition-all shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-3 min-w-0">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.productName}
                          className="w-10 h-10 rounded-xl object-cover bg-[#1C1C1C] border border-[#2A2A2A] shrink-0"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-[#1C1C1C] border border-[#2A2A2A] flex items-center justify-center text-[#71717A] shrink-0">
                          <Wine className="w-5 h-5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-white truncate" title={item.productName}>
                          {item.productName}
                        </h4>
                        <span className="text-[10px] text-[#A1A1AA] bg-[#181818] px-1.5 py-0.5 rounded border border-[#282828] inline-block mt-0.5">
                          {item.categoryName || 'Bar Item'}
                        </span>
                      </div>
                    </div>

                    {/* Stock Status Badge */}
                    {isOutOfStock ? (
                      <span className="shrink-0 inline-flex items-center space-x-1 text-[10px] font-black uppercase text-red-400 bg-red-500/10 border border-red-500/30 px-2 py-0.5 rounded-lg">
                        <PackageX className="w-3 h-3" />
                        <span>OUT OF STOCK</span>
                      </span>
                    ) : isLowStock ? (
                      <span className="shrink-0 inline-flex items-center space-x-1 text-[10px] font-black uppercase text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-lg">
                        <AlertTriangle className="w-3 h-3" />
                        <span>LOW STOCK</span>
                      </span>
                    ) : (
                      <span className="shrink-0 inline-flex items-center space-x-1 text-[10px] font-black uppercase text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-lg">
                        <PackageCheck className="w-3 h-3" />
                        <span>IN STOCK</span>
                      </span>
                    )}
                  </div>

                  {/* 3 Clean Stock Numbers (Starting, Sold, Remaining) */}
                  <div className="grid grid-cols-3 gap-2 bg-[#161616] border border-[#222222] rounded-xl p-2.5 text-center">
                    <div>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-[#71717A] block">
                        Starting
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-200">
                        {startingStock}
                      </span>
                    </div>

                    <div className="border-x border-[#242424]">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-[#71717A] block">
                        Sold
                      </span>
                      <span className={`text-xs font-mono font-bold ${unitsSold > 0 ? 'text-green-400' : 'text-[#71717A]'}`}>
                        {unitsSold}
                      </span>
                    </div>

                    <div>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-[#71717A] block">
                        Remaining
                      </span>
                      <span className={`text-xs font-mono font-black ${
                        isOutOfStock ? 'text-red-400' : isLowStock ? 'text-amber-400' : 'text-emerald-400'
                      }`}>
                        {currentStock}
                      </span>
                    </div>
                  </div>

                  {/* Pricing / Revenue Footer */}
                  <div className="flex items-center justify-between text-[11px] text-[#71717A] pt-1">
                    <span>Price: <strong className="text-white">{formatNaira(item.sellingPrice || 0)}</strong></span>
                    {unitsSold > 0 && (
                      <span>Rev: <strong className="text-green-400">{formatNaira(item.grossRevenue)}</strong></span>
                    )}
                  </div>

                </div>
              );
            })
          )}
        </div>
      )}

      {/* DAILY STOCK TRACKING: TABLE VIEW */}
      {viewMode === 'table' && (
        <div className="bg-[#111111] border border-[#222222] rounded-2xl overflow-hidden shadow-xl">
          
          {isLoading && items.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-green-400 animate-spin mx-auto" />
              <p className="text-xs font-semibold text-[#A1A1AA]">
                Loading product inventory and daily stock from Supabase...
              </p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#181818] border border-[#2A2A2A] text-[#71717A] flex items-center justify-center mx-auto">
                <Wine className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">No products found for this filter</p>
                <p className="text-xs text-[#71717A] mt-1">
                  {searchQuery ? `No products match "${searchQuery}".` : 'No items match the selected tab filter.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table id="daily-stock-products-table" className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#161616] border-b border-[#222222] text-[#A1A1AA] font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-3.5 px-4 w-14 text-center">Rank</th>
                    <th className="py-3.5 px-4">Product Name & Category</th>
                    <th className="py-3.5 px-4 text-center font-bold text-white">Starting Stock</th>
                    <th className="py-3.5 px-4 text-center font-bold text-green-400">{soldLabel}</th>
                    <th className="py-3.5 px-4 text-center font-bold text-emerald-400">Remaining Stock</th>
                    <th className="py-3.5 px-4 text-right">Selling Price</th>
                    <th className="py-3.5 px-4 text-right">Gross Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1C1C1C]">
                  {filteredItems.map((item) => {
                    const isSold = item.unitsSold > 0 || item.grossRevenue > 0;
                    const currentStock = item.currentStock ?? 0;
                    const startingStock = item.startingStock ?? currentStock;
                    const unitsSold = item.unitsSold;
                    const minStock = item.minimumStockLevel ?? 5;
                    const isOutOfStock = currentStock <= 0;
                    const isLowStock = currentStock > 0 && currentStock <= minStock;

                    return (
                      <tr 
                        key={item.productId || item.productName}
                        className="hover:bg-[#181818] transition-colors group"
                      >
                        {/* # Rank Badge */}
                        <td className="py-3.5 px-4 text-center">
                          {isSold ? (
                            <span className={`inline-flex items-center justify-center min-w-[32px] px-1.5 py-0.5 rounded-lg text-xs border ${getRankBadgeClass(item.rank, item.unitsSold)}`}>
                              #{item.rank}
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[10px] bg-[#1a1a1a] text-[#71717A] border border-[#282828] font-medium">
                              -
                            </span>
                          )}
                        </td>

                        {/* Product Name, Category & Image */}
                        <td className="py-3.5 px-4 font-semibold text-white">
                          <div className="flex items-center space-x-3">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.productName}
                                className="w-8 h-8 rounded-lg object-cover bg-[#1C1C1C] border border-[#2A2A2A] shrink-0"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-[#1C1C1C] border border-[#2A2A2A] flex items-center justify-center text-[#71717A] shrink-0 group-hover:text-white transition-colors">
                                <Wine className="w-4 h-4" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-white truncate max-w-xs sm:max-w-md">
                                {item.productName}
                              </div>
                              <div className="flex items-center space-x-2 mt-0.5">
                                {item.categoryName && (
                                  <span className="text-[10px] text-[#A1A1AA] bg-[#181818] px-1.5 py-0.5 rounded border border-[#282828]">
                                    {item.categoryName}
                                  </span>
                                )}
                                {item.rank === 1 && isSold && (
                                  <span className="inline-flex items-center space-x-1 text-[10px] text-amber-400 font-semibold">
                                    <Award className="w-3 h-3" />
                                    <span>Top Contributor</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Starting Stock */}
                        <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-200 text-sm">
                          <span className="bg-[#181818] border border-[#262626] px-2.5 py-1 rounded-lg">
                            {startingStock}
                          </span>
                        </td>

                        {/* Quantity Sold */}
                        <td className="py-3.5 px-4 text-center font-mono font-bold text-sm">
                          {unitsSold > 0 ? (
                            <span className="bg-green-500/10 border border-green-500/30 text-green-400 px-2.5 py-1 rounded-lg">
                              {unitsSold}
                            </span>
                          ) : (
                            <span className="text-[#555555]">0</span>
                          )}
                        </td>

                        {/* Remaining Stock with Status Badge */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex items-center space-x-1.5">
                            {isOutOfStock ? (
                              <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-red-400 bg-red-500/10 border border-red-500/30 px-2 py-0.5 rounded">
                                <PackageX className="w-3 h-3" />
                                <span>0 (Out of stock)</span>
                              </span>
                            ) : isLowStock ? (
                              <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded">
                                <AlertTriangle className="w-3 h-3" />
                                <span>{currentStock} left (Low)</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded">
                                <PackageCheck className="w-3 h-3" />
                                <span>{currentStock} remaining</span>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Selling Price */}
                        <td className="py-3.5 px-4 text-right font-mono text-white text-xs">
                          {formatNaira(item.sellingPrice || 0)}
                        </td>

                        {/* Gross Revenue */}
                        <td className="py-3.5 px-4 text-right font-mono font-black text-sm">
                          {item.grossRevenue > 0 ? (
                            <span className="text-green-400">{formatNaira(item.grossRevenue)}</span>
                          ) : (
                            <span className="text-[#555555]">₦0.00</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Table Footer with Summary Count */}
          <div className="bg-[#141414] border-t border-[#222222] px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#71717A]">
            <div>
              Showing <span className="font-bold text-white">{filteredItems.length}</span> of <span className="font-bold text-white">{items.length}</span> bar products
            </div>
            <div className="flex items-center space-x-3 text-[11px]">
              <span>Starting Total: <strong className="text-white">{totalStartingStock}</strong></span>
              <span>•</span>
              <span><strong className="text-green-400">{totalUnitsSold}</strong> Sold</span>
              <span>•</span>
              <span>Remaining Total: <strong className="text-emerald-400">{totalRemainingStock}</strong></span>
              <span>•</span>
              <span>Auto-synced with Supabase</span>
            </div>
          </div>

        </div>
      )}

    </section>
  );
};

