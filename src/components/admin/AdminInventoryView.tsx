import React, { useState, useEffect } from 'react';
import { 
  Boxes, 
  Search, 
  Filter, 
  AlertTriangle, 
  PackageX, 
  TrendingUp, 
  DollarSign, 
  History, 
  RefreshCw, 
  ArrowUpRight, 
  ArrowDownRight, 
  Plus
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { Category, Product, StockMovementWithProduct } from '../../types';
import { formatCurrency, formatReceiptDate, formatTime } from '../../utils/formatters';

interface AdminInventoryViewProps {
  onOpenStockAdjustModal: (product?: Product) => void;
}

export const AdminInventoryView: React.FC<AdminInventoryViewProps> = ({
  onOpenStockAdjustModal,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'inventory' | 'history'>('inventory');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [movements, setMovements] = useState<StockMovementWithProduct[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'low' | 'out'>('all');

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [prods, cats, movs] = await Promise.all([
        adminService.getAdminProducts({
          categoryId: selectedCategory,
          status: 'all',
          searchQuery,
          stockFilter: stockStatusFilter,
        }),
        adminService.getAllCategories(),
        adminService.getStockMovements(),
      ]);

      setProducts(prods);
      setCategories(cats);
      setMovements(movs);
    } catch (err) {
      console.error('Error loading inventory:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCategory, stockStatusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  // Calculations
  const totalUnits = products.reduce((acc, p) => acc + (p.stock_quantity || 0), 0);
  const totalCostValuation = products.reduce((acc, p) => acc + ((p.cost_price || 0) * (p.stock_quantity || 0)), 0);
  const totalRetailPotential = products.reduce((acc, p) => acc + (p.selling_price * (p.stock_quantity || 0)), 0);
  const lowStockCount = products.filter((p) => p.stock_quantity > 0 && p.stock_quantity <= p.minimum_stock_level).length;
  const outOfStockCount = products.filter((p) => p.stock_quantity <= 0).length;

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header & Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#111111] border border-[#222222] p-4 lg:p-6 rounded-2xl">
        <div>
          <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
            <Boxes className="w-5 h-5 text-amber-400" />
            <span>Bar Inventory & Stock Control</span>
          </h2>
          <p className="text-xs text-[#A1A1AA] mt-0.5">
            Audit physical stock levels, execute adjustments, and track restocks
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex bg-[#181818] p-1 rounded-xl border border-[#262626]">
            <button
              onClick={() => setActiveSubTab('inventory')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeSubTab === 'inventory'
                  ? 'bg-amber-500 text-black'
                  : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              Current Stock
            </button>
            <button
              onClick={() => setActiveSubTab('history')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeSubTab === 'history'
                  ? 'bg-amber-500 text-black'
                  : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              Movement History
            </button>
          </div>

          <button
            onClick={() => onOpenStockAdjustModal()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all shadow-sm active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Stock Adjustment</span>
          </button>
        </div>
      </div>

      {/* Inventory Valuation Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <div className="bg-[#111111] border border-[#222222] p-4 rounded-2xl">
          <span className="text-xs font-medium text-[#A1A1AA]">Total Physical Units</span>
          <p className="text-xl lg:text-2xl font-bold text-white mt-1">
            {totalUnits.toLocaleString()} units
          </p>
          <p className="text-[11px] text-[#71717A] mt-1">Across all product lines</p>
        </div>

        <div className="bg-[#111111] border border-[#222222] p-4 rounded-2xl">
          <span className="text-xs font-medium text-[#A1A1AA]">Total Cost Valuation</span>
          <p className="text-xl lg:text-2xl font-bold text-white mt-1">
            {formatCurrency(totalCostValuation)}
          </p>
          <p className="text-[11px] text-[#71717A] mt-1">Acquisition value</p>
        </div>

        <div className="bg-[#111111] border border-[#222222] p-4 rounded-2xl">
          <span className="text-xs font-medium text-[#A1A1AA]">Total Retail Potential</span>
          <p className="text-xl lg:text-2xl font-bold text-green-400 mt-1">
            {formatCurrency(totalRetailPotential)}
          </p>
          <p className="text-[11px] text-[#71717A] mt-1">Potential gross sales</p>
        </div>

        <div className="bg-[#111111] border border-[#222222] p-4 rounded-2xl">
          <span className="text-xs font-medium text-[#A1A1AA]">Low / Out of Stock</span>
          <p className="text-xl lg:text-2xl font-bold text-amber-400 mt-1">
            {lowStockCount} / {outOfStockCount}
          </p>
          <p className="text-[11px] text-[#71717A] mt-1">Items needing reorder</p>
        </div>
      </div>

      {activeSubTab === 'inventory' ? (
        <>
          {/* Filters */}
          <div className="bg-[#111111] border border-[#222222] p-4 rounded-2xl space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <form onSubmit={handleSearch} className="relative">
                <Search className="w-4 h-4 text-[#A1A1AA] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search inventory items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-[#181818] border border-[#2A2A2A] rounded-xl text-xs text-white placeholder-[#71717A] focus:outline-hidden focus:border-amber-500"
                />
              </form>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 bg-[#181818] border border-[#2A2A2A] rounded-xl text-xs text-white focus:outline-hidden focus:border-amber-500"
              >
                <option value="all">All Categories ({categories.length})</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                value={stockStatusFilter}
                onChange={(e) => setStockStatusFilter(e.target.value as any)}
                className="px-3 py-2 bg-[#181818] border border-[#2A2A2A] rounded-xl text-xs text-white focus:outline-hidden focus:border-amber-500"
              >
                <option value="all">All Stock Statuses</option>
                <option value="low">Low Stock Only</option>
                <option value="out">Out of Stock Only</option>
              </select>
            </div>
          </div>

          {/* Current Inventory Table */}
          <div className="bg-[#111111] border border-[#222222] rounded-2xl overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#222222] bg-[#141414] text-[11px] font-semibold text-[#A1A1AA] uppercase tracking-wider">
                    <th className="py-3.5 px-4">Product Name</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4 text-center">Current Stock</th>
                    <th className="py-3.5 px-4 text-center">Min Threshold</th>
                    <th className="py-3.5 px-4 text-center">Stock Status</th>
                    <th className="py-3.5 px-4 text-right">Selling Price</th>
                    <th className="py-3.5 px-4 text-right">Inventory Valuation</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#1A1A1A] text-xs">
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-[#71717A]">
                        <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        Loading stock records...
                      </td>
                    </tr>
                  ) : products.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-[#71717A]">
                        <Boxes className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        No inventory items match the current filters.
                      </td>
                    </tr>
                  ) : (
                    products.map((p) => {
                      const cat = categories.find((c) => c.id === p.category_id);
                      const isLow = p.stock_quantity > 0 && p.stock_quantity <= p.minimum_stock_level;
                      const isOut = p.stock_quantity <= 0;
                      const valuation = p.selling_price * p.stock_quantity;

                      return (
                        <tr key={p.id} className="hover:bg-[#161616] transition-colors">
                          <td className="py-3 px-4 font-bold text-white">
                            {p.name}
                          </td>
                          <td className="py-3 px-4 text-[#A1A1AA]">
                            {cat?.name || 'Uncategorized'}
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-white text-sm">
                            {p.stock_quantity}
                          </td>
                          <td className="py-3 px-4 text-center text-[#71717A]">
                            {p.minimum_stock_level}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              isOut
                                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                : isLow
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-green-500/10 text-green-400 border border-green-500/20'
                            }`}>
                              {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-[#E4E4E7]">
                            {formatCurrency(p.selling_price)}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-white">
                            {formatCurrency(valuation)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => onOpenStockAdjustModal(p)}
                              className="px-3 py-1.5 rounded-lg bg-[#1A1A1A] hover:bg-amber-500 hover:text-black text-amber-400 border border-[#2A2A2A] text-xs font-semibold transition-all"
                            >
                              Adjust Stock
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Stock Movements Audit Tab */
        <div className="bg-[#111111] border border-[#222222] rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-[#222222] flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-amber-400" />
              <span>Stock Movement Audit Logs</span>
            </h3>
            <button
              onClick={loadData}
              className="p-1.5 rounded-lg bg-[#181818] text-[#A1A1AA] hover:text-white"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#222222] bg-[#141414] text-[11px] font-semibold text-[#A1A1AA] uppercase tracking-wider">
                  <th className="py-3.5 px-4">Date & Time</th>
                  <th className="py-3.5 px-4">Product</th>
                  <th className="py-3.5 px-4 text-center">Movement Type</th>
                  <th className="py-3.5 px-4 text-center">Quantity Change</th>
                  <th className="py-3.5 px-4 text-center">Before → After</th>
                  <th className="py-3.5 px-4">Reason / Notes</th>
                  <th className="py-3.5 px-4">Audited By</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#1A1A1A] text-xs">
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[#71717A]">
                      No stock movement audit records logged yet.
                    </td>
                  </tr>
                ) : (
                  movements.map((m) => (
                    <tr key={m.id} className="hover:bg-[#161616] transition-colors">
                      <td className="py-3 px-4 text-[#A1A1AA]">
                        <div>{formatReceiptDate(m.created_at)}</div>
                        <div className="text-[10px] text-[#71717A]">{formatTime(m.created_at)}</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-white">
                        {m.product?.name || 'Product'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          m.movement_type === 'restock'
                            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                            : m.movement_type === 'damage'
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}>
                          {m.movement_type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-bold">
                        <span className={m.quantity_change > 0 ? 'text-green-400' : 'text-red-400'}>
                          {m.quantity_change > 0 ? `+${m.quantity_change}` : m.quantity_change}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-[#A1A1AA] font-mono">
                        {m.quantity_before} → <b className="text-white">{m.quantity_after}</b>
                      </td>
                      <td className="py-3 px-4 text-[#E4E4E7]">
                        {m.reason || '—'}
                      </td>
                      <td className="py-3 px-4 text-[#71717A]">
                        {m.user?.full_name || 'Admin'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
