import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, 
  X, 
  Plus, 
  Minus, 
  Trash2, 
  CreditCard, 
  Banknote, 
  ArrowRightLeft, 
  CheckCircle2, 
  AlertCircle, 
  ShoppingBag, 
  Sparkles, 
  Play, 
  RefreshCw,
  Wine,
  Beer,
  CupSoda,
  Flame,
  Utensils,
  Layers,
  Square
} from 'lucide-react';
import { productService } from '../services/productService';
import { saleService } from '../services/saleService';
import { Category, CompletedSaleResult, PaymentMethod, Product } from '../types';
import { useCart } from '../context/CartContext';
import { useShift } from '../context/ShiftContext';
import { useAuth } from '../context/AuthContext';
import { useWorkerBranding } from '../context/WorkerBrandingContext';
import { formatNaira, formatTime, sanitizeErrorMessage } from '../utils/formatters';

interface PosViewProps {
  onSaleCompleted: (sale: CompletedSaleResult) => void;
}

export const PosView: React.FC<PosViewProps> = ({ onSaleCompleted }) => {
  const { profile } = useAuth();
  const { workerSiteName, workerPrimaryColor, textColor } = useWorkerBranding();

  const { 
    items, 
    subtotal, 
    discount, 
    total, 
    totalQuantity, 
    paymentMethod, 
    addItem, 
    updateQuantity, 
    removeItem, 
    clearCart, 
    setPaymentMethod,
    setDiscount,
    getItemQuantity
  } = useCart();

  const { activeShift, currentShift, isShiftActive, openShiftModal, openCloseShiftModal, shiftSummary, refreshShift } = useShift();

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [dailyStockMap, setDailyStockMap] = useState<Map<string, { startingStock: number; soldToday: number; remainingStock: number }>>(new Map());
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isProcessingSale, setIsProcessingSale] = useState<boolean>(false);
  const [alertMessage, setAlertMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [mobileCartOpen, setMobileCartOpen] = useState<boolean>(false);
  const [isShiftRequiredModalOpen, setIsShiftRequiredModalOpen] = useState<boolean>(false);

  // Load Categories, Products & Daily Stock Tracking
  const loadData = async () => {
    try {
      setIsLoading(true);
      const [cats, prods, stockMap] = await Promise.all([
        productService.getCategories(),
        productService.getActiveProducts(),
        saleService.getDailyStockMap().catch((err) => {
          console.warn('Notice loading daily stock map:', err);
          return new Map();
        }),
      ]);
      setCategories(cats);
      setProducts(prods);
      setDailyStockMap(stockMap);
    } catch (err: any) {
      console.error('Error loading inventory:', err);
      setAlertMessage({ type: 'error', text: 'Unable to load products. Please check connection.' });
    } finally {
      setIsLoading(false);
    }
  };

  const refreshDailyStock = async () => {
    try {
      const stockMap = await saleService.getDailyStockMap();
      setDailyStockMap(stockMap);
    } catch (err) {
      console.warn('Notice refreshing daily stock:', err);
    }
  };

  useEffect(() => {
    loadData();

    // Supabase Realtime stock listener for products catalog
    const unsubscribeProducts = productService.subscribeToProducts((updated) => {
      setProducts((prev) =>
        prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
      );
      refreshDailyStock();
    });

    // Supabase Realtime listener for completed sales & line items
    const unsubscribeSales = saleService.subscribeToAllCompletedSales(() => {
      refreshDailyStock();
    });

    return () => {
      unsubscribeProducts();
      unsubscribeSales();
    };
  }, []);

  // Compute aggregate daily stock metrics across all products
  const dailyStockTotals = useMemo(() => {
    let starting = 0;
    let sold = 0;
    let remaining = 0;

    products.forEach((p) => {
      const info = dailyStockMap.get(p.id) || dailyStockMap.get(p.name.trim().toLowerCase());
      const sSold = info?.soldToday ?? 0;
      const sRemaining = p.stock_quantity !== undefined ? p.stock_quantity : (info?.remainingStock ?? 0);
      const sStarting = info?.startingStock !== undefined ? info.startingStock : (sRemaining + sSold);

      starting += sStarting;
      sold += sSold;
      remaining += sRemaining;
    });

    return { starting, sold, remaining };
  }, [products, dailyStockMap]);

  // Category matching helper
  const isProductInCategory = (product: Product, categoryId: string, categoryName?: string): boolean => {
    if (categoryId === 'all') return true;
    if (product.category_id === categoryId) return true;
    
    // Name/Type-based smart category matching fallback
    if (categoryName) {
      const cName = categoryName.toLowerCase();
      const pName = product.name.toLowerCase();
      if ((cName.includes('whiskey') || cName.includes('spirit')) && (pName.includes('whisky') || pName.includes('whiskey') || pName.includes('vodka') || pName.includes('gin') || pName.includes('rum') || pName.includes('brandy') || pName.includes('tequila'))) {
        return true;
      }
      if ((cName.includes('beer') || cName.includes('cider')) && (pName.includes('beer') || pName.includes('heineken') || pName.includes('guinness') || pName.includes('budweiser') || pName.includes('cider') || pName.includes('star') || pName.includes('trophy') || pName.includes('goldberg') || pName.includes('stout'))) {
        return true;
      }
      if ((cName.includes('wine') || cName.includes('champagne')) && (pName.includes('wine') || pName.includes('champagne') || pName.includes('prosecco') || pName.includes('merlot') || pName.includes('cabernet'))) {
        return true;
      }
      if ((cName.includes('cocktail') || cName.includes('mocktail')) && (pName.includes('cocktail') || pName.includes('mocktail') || pName.includes('mojito') || pName.includes('chapman'))) {
        return true;
      }
      if ((cName.includes('soft') || cName.includes('water')) && (pName.includes('coke') || pName.includes('pepsi') || pName.includes('water') || pName.includes('fanta') || pName.includes('sprite') || pName.includes('malt') || pName.includes('soda') || pName.includes('juice') || pName.includes('energy') || pName.includes('red bull'))) {
        return true;
      }
      // If product has no category assigned in DB, make it visible under Bar Snacks & Grill / General
      if (!product.category_id && (cName.includes('snack') || cName.includes('grill') || cName.includes('general'))) {
        return true;
      }
    }
    return false;
  };

  // Filter products by category and debounced search
  const filteredProducts = useMemo(() => {
    const selectedCat = categories.find((c) => c.id === selectedCategoryId);
    return products.filter((product) => {
      const matchesCategory = isProductInCategory(product, selectedCategoryId, selectedCat?.name);
      const matchesSearch =
        !searchQuery.trim() ||
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.description && product.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [products, categories, selectedCategoryId, searchQuery]);

  // Handle Add to Cart
  const handleAddToCart = (product: Product) => {
    const res = addItem(product, 1);
    if (!res.success && res.message) {
      setAlertMessage({ type: 'error', text: res.message });
      setTimeout(() => setAlertMessage(null), 4000);
    } else {
      setAlertMessage(null);
    }
  };

  // Handle Checkout / Complete Sale
  const handleCompleteSale = async () => {
    if (profile?.role === 'cashier') {
      setAlertMessage({ type: 'error', text: 'Cashiers are not authorized to create or complete sales.' });
      return;
    }

    const shift = currentShift || activeShift;
    if (!isShiftActive || !shift?.id) {
      setIsShiftRequiredModalOpen(true);
      return;
    }

    if (!items.length) {
      setAlertMessage({ type: 'error', text: 'Cart is empty. Please select products.' });
      return;
    }

    if (!paymentMethod) {
      setAlertMessage({ type: 'error', text: 'Please select a payment method.' });
      return;
    }

    try {
      setIsProcessingSale(true);
      setAlertMessage(null);

      const completedSale = await saleService.completeSale(
        shift.id,
        paymentMethod,
        items,
        discount
      );

      // Successfully finished sale
      clearCart();
      setMobileCartOpen(false);
      await Promise.all([
        refreshShift(),
        refreshDailyStock(),
      ]);
      onSaleCompleted(completedSale);
    } catch (err: any) {
      console.error('complete_sale error in PosView:', err);
      const msg = sanitizeErrorMessage(err);
      setAlertMessage({ type: 'error', text: msg });
    } finally {
      setIsProcessingSale(false);
    }
  };

  // Helper for Category icons
  const getCategoryIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('beer')) return <Beer className="w-3.5 h-3.5" />;
    if (n.includes('wine') || n.includes('spirit') || n.includes('cocktail')) return <Wine className="w-3.5 h-3.5" />;
    if (n.includes('soft') || n.includes('energy') || n.includes('water')) return <CupSoda className="w-3.5 h-3.5" />;
    if (n.includes('food') || n.includes('snack')) return <Utensils className="w-3.5 h-3.5" />;
    return <Layers className="w-3.5 h-3.5" />;
  };

  // Cashier role is NOT a selling/POS operator; they manage funds and monitor transactions
  if (profile?.role === 'cashier') {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4">
      
      {/* Alert Banner */}
      {alertMessage && (
        <div
          className={`mb-4 p-3.5 rounded-xl border flex items-center justify-between text-xs sm:text-sm font-medium animate-fade-in ${
            alertMessage.type === 'error'
              ? 'bg-red-950/40 border-red-500/40 text-red-300'
              : 'bg-green-950/40 border-green-500/40 text-green-300'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            {alertMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
            )}
            <span>{alertMessage.text}</span>
          </div>
          <button
            onClick={() => setAlertMessage(null)}
            className="text-[#71717A] hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* ========================================================= */}
        {/* LEFT COLUMN: CATEGORIES, SEARCH, PRODUCT GRID (8 cols)    */}
        {/* ========================================================= */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* Search Bar & Refresh */}
          <div className="flex items-center space-x-2.5">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#71717A]">
                <Search className="w-4 h-4" />
              </div>
              <input
                id="product-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search drinks, beer, spirits, food..."
                className="w-full bg-[#111111] border border-[#262626] focus:border-green-500 focus:ring-1 focus:ring-green-500 text-white rounded-xl pl-10 pr-9 py-2.5 text-xs sm:text-sm outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#71717A] hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              onClick={loadData}
              title="Refresh Catalog & Stock"
              className="p-2.5 bg-[#111111] hover:bg-[#181818] border border-[#262626] text-[#A1A1AA] hover:text-white rounded-xl transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Daily Stock / Shift Summary Bar (Role-Specific: Bar Staff vs Cashier) */}
          {profile?.role === 'bar_worker' ? (
            /* Bar Staff Daily Stock Summary Bar (Uche) */
            <div 
              id="cashier-daily-stock-summary-bar"
              className="grid grid-cols-3 gap-2 sm:gap-3 bg-[#111111] border border-[#222222] rounded-2xl p-2 sm:p-2.5 shadow-md"
            >
              <div className="bg-[#171717] border border-[#262626] rounded-xl p-2 text-center">
                <span className="text-[9px] sm:text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider block">
                  Total Starting Stock
                </span>
                <span className="text-sm sm:text-base font-black font-mono text-zinc-100">
                  {dailyStockTotals.starting}
                </span>
              </div>
              <div className="bg-[#171717] border border-[#262626] rounded-xl p-2 text-center">
                <span className="text-[9px] sm:text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider block">
                  Total Sold Today
                </span>
                <span className="text-sm sm:text-base font-black font-mono text-green-400">
                  {dailyStockTotals.sold}
                </span>
              </div>
              <div className="bg-[#171717] border border-[#262626] rounded-xl p-2 text-center">
                <span className="text-[9px] sm:text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider block">
                  Total Remaining
                </span>
                <span className="text-sm sm:text-base font-black font-mono text-emerald-400">
                  {dailyStockTotals.remaining}
                </span>
              </div>
            </div>
          ) : (
            /* Cashier Shift & Register Summary Bar (Sam) */
            isShiftActive && activeShift ? (
              <div 
                id="cashier-shift-summary-bar"
                className="bg-[#111111] border border-[#222222] rounded-2xl p-2 sm:p-2.5 shadow-md space-y-2"
              >
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center space-x-2">
                    <span 
                      className="w-2.5 h-2.5 rounded-full animate-pulse" 
                      style={{ backgroundColor: workerPrimaryColor }}
                    />
                    <div>
                      <span className="text-xs font-bold text-white">
                        Active Shift
                      </span>
                      <span className="text-[10px] text-[#A1A1AA] ml-1.5 hidden sm:inline">
                        Started {formatTime(activeShift.started_at)}
                      </span>
                    </div>
                  </div>
                  <button
                    id="pos-end-shift-btn"
                    onClick={openCloseShiftModal}
                    className="bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 hover:text-red-300 text-xs font-semibold px-2.5 py-1 rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5 fill-red-400" />
                    <span>End Shift</span>
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <div className="bg-[#171717] border border-[#262626] rounded-xl p-2 text-center">
                    <span className="text-[9px] sm:text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider block">
                      Opening Float
                    </span>
                    <span className="text-xs sm:text-sm font-black font-mono text-zinc-100">
                      {formatNaira(activeShift.opening_cash)}
                    </span>
                  </div>
                  <div className="bg-[#171717] border border-[#262626] rounded-xl p-2 text-center">
                    <span className="text-[9px] sm:text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider block">
                      Total Sales
                    </span>
                    <span className="text-xs sm:text-sm font-black font-mono text-green-400">
                      {formatNaira(shiftSummary?.total_sales || 0)}
                    </span>
                  </div>
                  <div className="bg-[#171717] border border-[#262626] rounded-xl p-2 text-center">
                    <span className="text-[9px] sm:text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider block">
                      Sales Count
                    </span>
                    <span className="text-xs sm:text-sm font-black font-mono text-cyan-400">
                      {shiftSummary?.transaction_count || 0}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div 
                id="cashier-shift-summary-bar"
                className="flex items-center justify-between bg-[#111111] border border-amber-500/30 rounded-2xl p-2.5 sm:p-3 shadow-md"
              >
                <div className="flex items-center space-x-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <div>
                    <span className="text-xs sm:text-sm font-bold text-white block">No Active Shift</span>
                    <span className="text-[10px] text-[#A1A1AA]">Start a shift to open register and record sales</span>
                  </div>
                </div>
                <button
                  id="pos-start-shift-btn"
                  onClick={openShiftModal}
                  style={{
                    backgroundColor: workerPrimaryColor,
                    color: textColor,
                  }}
                  className="text-xs font-bold px-3 py-1.5 rounded-xl flex items-center space-x-1.5 transition-all shadow-md cursor-pointer hover:opacity-90 active:scale-95"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Start Shift</span>
                </button>
              </div>
            )
          )}

          {/* Categories Horizontal Scroll Bar */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 no-scrollbar">
            <button
              id="cat-all-btn"
              onClick={() => setSelectedCategoryId('all')}
              style={selectedCategoryId === 'all' ? {
                backgroundColor: workerPrimaryColor,
                color: textColor,
                boxShadow: `0 4px 14px 0 rgba(var(--worker-primary-rgb, 183, 255, 0), 0.3)`,
              } : {}}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 whitespace-nowrap cursor-pointer ${
                selectedCategoryId === 'all'
                  ? ''
                  : 'bg-[#111111] hover:bg-[#181818] text-[#A1A1AA] hover:text-white border border-[#222222]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>All Products ({products.length})</span>
            </button>

            {categories.map((cat) => {
              const count = products.filter((p) => isProductInCategory(p, cat.id, cat.name)).length;
              const isSelected = selectedCategoryId === cat.id;
              return (
                <button
                  key={cat.id}
                  id={`cat-${cat.name.toLowerCase().replace(/\s+/g, '-')}-btn`}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  style={isSelected ? {
                    backgroundColor: workerPrimaryColor,
                    color: textColor,
                    boxShadow: `0 4px 14px 0 rgba(var(--worker-primary-rgb, 183, 255, 0), 0.3)`,
                  } : {}}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 whitespace-nowrap cursor-pointer ${
                    isSelected
                      ? ''
                      : 'bg-[#111111] hover:bg-[#181818] text-[#A1A1AA] hover:text-white border border-[#222222]'
                  }`}
                >
                  {getCategoryIcon(cat.name)}
                  <span>{cat.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected ? 'bg-black/20 text-current' : 'bg-[#222222] text-[#A1A1AA]'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Product Grid */}
          {isLoading ? (
            <div className="bg-[#111111] border border-[#222222] rounded-2xl p-12 text-center">
              <div 
                className="w-8 h-8 border-2 rounded-full animate-spin mx-auto mb-3"
                style={{
                  borderTopColor: 'transparent',
                  borderRightColor: workerPrimaryColor,
                  borderBottomColor: workerPrimaryColor,
                  borderLeftColor: workerPrimaryColor,
                }}
              />
              <p className="text-sm font-semibold text-white">Loading products...</p>
              <p className="text-xs text-[#71717A] mt-1">Connecting to {workerSiteName} database</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="bg-[#111111] border border-[#222222] rounded-2xl p-12 text-center">
              <ShoppingBag className="w-12 h-12 text-[#333333] mx-auto mb-3" />
              <h3 className="text-base font-bold text-white mb-1">No products found</h3>
              <p className="text-xs text-[#A1A1AA]">
                {searchQuery
                  ? `No products match "${searchQuery}". Try a different keyword.`
                  : 'No active products in this category.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-3.5">
              {filteredProducts.map((product) => {
                const inCartQty = getItemQuantity(product.id);
                const stockInfo = dailyStockMap.get(product.id) || dailyStockMap.get(product.name.trim().toLowerCase());
                const soldToday = stockInfo?.soldToday ?? 0;
                const currentRemaining = product.stock_quantity !== undefined ? Number(product.stock_quantity) : (stockInfo?.remainingStock ?? 0);
                const startingStock = stockInfo?.startingStock !== undefined 
                  ? Number(stockInfo.startingStock) 
                  : (currentRemaining + soldToday);
                const isOutOfStock = currentRemaining <= 0;
                const isLowStock = currentRemaining > 0 && currentRemaining <= (product.minimum_stock_level || 5);

                return (
                  <div
                    key={product.id}
                    id={`product-card-${product.id}`}
                    onClick={() => !isOutOfStock && handleAddToCart(product)}
                    style={inCartQty > 0 ? {
                      borderColor: `rgba(var(--worker-primary-rgb, 183, 255, 0), 0.5)`,
                    } : {}}
                    className={`group bg-[#111111] hover:bg-[#161616] border rounded-2xl p-3 flex flex-col justify-between transition-all relative overflow-hidden select-none ${
                      isOutOfStock
                        ? 'opacity-60 border-[#222222] cursor-not-allowed'
                        : inCartQty > 0
                        ? 'shadow-md cursor-pointer'
                        : 'border-[#222222] hover:border-[#333333] cursor-pointer'
                    }`}
                  >
                    {/* In Cart Indicator Badge */}
                    {inCartQty > 0 && (
                      <div 
                        className="absolute top-2.5 right-2.5 z-10 text-[11px] font-black w-6 h-6 rounded-full flex items-center justify-center shadow-md"
                        style={{
                          backgroundColor: workerPrimaryColor,
                          color: textColor,
                        }}
                      >
                        {inCartQty}
                      </div>
                    )}

                    {/* Product Image Thumbnail */}
                    <div className="w-full aspect-square rounded-xl bg-[#181818] overflow-hidden mb-2 relative border border-[#222222]">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#444444]">
                          <Wine className="w-8 h-8" />
                        </div>
                      )}

                      {/* Stock Badge Overlay */}
                      <div className="absolute bottom-1.5 left-1.5 right-1.5">
                        {isOutOfStock ? (
                          <span className="block bg-red-950/90 border border-red-500/50 text-red-300 text-[9.5px] font-bold px-1.5 py-0.5 rounded-md text-center backdrop-blur-xs">
                            OUT OF STOCK
                          </span>
                        ) : isLowStock ? (
                          <span className="block bg-amber-950/90 border border-amber-500/50 text-amber-300 text-[9.5px] font-bold px-1.5 py-0.5 rounded-md text-center backdrop-blur-xs">
                            Low: {currentRemaining} left
                          </span>
                        ) : (
                          <span 
                            className="block bg-black/75 border border-[#333333] text-[9.5px] font-semibold px-1.5 py-0.5 rounded-md text-center backdrop-blur-xs"
                            style={{ color: workerPrimaryColor }}
                          >
                            {currentRemaining} in stock
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Product Details */}
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-white line-clamp-2 leading-snug">
                        {product.name}
                      </h4>
                      {product.description && (
                        <p className="text-[10px] text-[#71717A] line-clamp-1 mt-0.5">
                          {product.description}
                        </p>
                      )}
                    </div>

                    {/* Daily Stock Metrics for Cashier */}
                    <div 
                      id={`daily-stock-metrics-${product.id}`}
                      className="my-2 p-1.5 rounded-xl bg-[#161616] border border-[#262626] grid grid-cols-3 gap-0.5 text-center shadow-inner"
                    >
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-[8px] sm:text-[8.5px] font-semibold text-[#8E8E93] uppercase tracking-wider block">
                          Start
                        </span>
                        <span className="text-xs sm:text-sm font-bold font-mono text-zinc-100 mt-0.5">
                          {startingStock}
                        </span>
                      </div>
                      <div className="flex flex-col items-center justify-center border-x border-[#282828] px-0.5">
                        <span className="text-[8px] sm:text-[8.5px] font-semibold text-[#8E8E93] uppercase tracking-wider block">
                          Sold
                        </span>
                        <span className={`text-xs sm:text-sm font-bold font-mono mt-0.5 ${
                          soldToday > 0 ? 'text-green-400 font-extrabold' : 'text-zinc-400'
                        }`}>
                          {soldToday}
                        </span>
                      </div>
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-[8px] sm:text-[8.5px] font-semibold text-[#8E8E93] uppercase tracking-wider block">
                          Left
                        </span>
                        <span className={`text-xs sm:text-sm font-black font-mono mt-0.5 ${
                          isOutOfStock 
                            ? 'text-red-400' 
                            : isLowStock 
                            ? 'text-amber-400' 
                            : 'text-emerald-400'
                        }`}>
                          {currentRemaining}
                        </span>
                      </div>
                    </div>

                    {/* Price & Add Action */}
                    <div className="flex items-center justify-between pt-2 border-t border-[#1c1c1c]">
                      <div 
                        className="text-xs sm:text-sm font-black"
                        style={{ color: workerPrimaryColor }}
                      >
                        {formatNaira(product.selling_price)}
                      </div>
                      <button
                        type="button"
                        disabled={isOutOfStock}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isOutOfStock) handleAddToCart(product);
                        }}
                        style={!isOutOfStock ? {
                          backgroundColor: 'rgba(var(--worker-primary-rgb, 183, 255, 0), 0.15)',
                          borderColor: 'rgba(var(--worker-primary-rgb, 183, 255, 0), 0.3)',
                          color: workerPrimaryColor,
                        } : {}}
                        className={`p-1.5 rounded-lg transition-colors border ${
                          isOutOfStock
                            ? 'bg-[#181818] border-[#222222] text-[#555555]'
                            : 'hover:opacity-80'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: CART & CHECKOUT PANEL (4 cols)              */}
        {/* ========================================================= */}
        <div className="lg:col-span-4">
          <div className="bg-[#111111] border border-[#222222] rounded-2xl p-4 sm:p-5 sticky top-24 shadow-2xl flex flex-col h-auto max-h-[calc(100vh-7rem)]">
            
            {/* Cart Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#222222]">
              <div className="flex items-center space-x-2">
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center font-bold"
                  style={{
                    backgroundColor: 'rgba(var(--worker-primary-rgb, 183, 255, 0), 0.15)',
                    color: workerPrimaryColor,
                  }}
                >
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">CURRENT ORDER</h3>
                  <p className="text-[11px] text-[#A1A1AA]">
                    {totalQuantity} {totalQuantity === 1 ? 'item' : 'items'} in cart
                  </p>
                </div>
              </div>
              {items.length > 0 && (
                <button
                  id="clear-cart-btn"
                  onClick={clearCart}
                  className="text-xs text-[#71717A] hover:text-red-400 flex items-center space-x-1 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              )}
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto py-3 space-y-2.5 min-h-[160px] max-h-[300px] sm:max-h-[350px] no-scrollbar">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#555555]">
                  <ShoppingBag className="w-10 h-10 mb-2 stroke-[1.5]" />
                  <p className="text-xs font-semibold text-[#888888]">Cart is empty</p>
                  <p className="text-[11px] text-[#555555] mt-0.5">
                    Click products from the catalog to add to order
                  </p>
                </div>
              ) : (
                items.map(({ product, quantity }) => (
                  <div
                    key={product.id}
                    className="bg-[#181818] border border-[#262626] rounded-xl p-2.5 flex items-center justify-between"
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <h5 className="text-xs font-bold text-white truncate">
                        {product.name}
                      </h5>
                      <div className="text-[11px] text-[#A1A1AA]">
                        {formatNaira(product.selling_price)} × {quantity} ={' '}
                        <span className="font-semibold" style={{ color: workerPrimaryColor }}>
                          {formatNaira(product.selling_price * quantity)}
                        </span>
                      </div>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center space-x-1.5 shrink-0">
                      <button
                        onClick={() => updateQuantity(product.id, quantity - 1)}
                        className="w-7 h-7 rounded-lg bg-[#222222] hover:bg-[#2a2a2a] text-white flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-6 text-center text-xs font-black text-white">
                        {quantity}
                      </span>
                      <button
                        onClick={() => {
                          const res = updateQuantity(product.id, quantity + 1);
                          if (!res.success && res.message) {
                            setAlertMessage({ type: 'error', text: res.message });
                            setTimeout(() => setAlertMessage(null), 3000);
                          }
                        }}
                        style={{
                          backgroundColor: 'rgba(var(--worker-primary-rgb, 183, 255, 0), 0.2)',
                          color: workerPrimaryColor,
                        }}
                        className="w-7 h-7 rounded-lg hover:opacity-80 flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => removeItem(product.id)}
                        className="w-7 h-7 rounded-lg bg-[#222222] hover:bg-red-950 text-[#71717A] hover:text-red-400 flex items-center justify-center transition-colors ml-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Payment Method Selector */}
            <div className="pt-3 border-t border-[#222222]">
              <label className="block text-[11px] font-bold text-[#A1A1AA] uppercase tracking-wider mb-2">
                Select Payment Method
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  id="pay-cash-btn"
                  onClick={() => setPaymentMethod('cash')}
                  style={paymentMethod === 'cash' ? {
                    backgroundColor: workerPrimaryColor,
                    color: textColor,
                    boxShadow: `0 4px 14px 0 rgba(var(--worker-primary-rgb, 183, 255, 0), 0.3)`,
                  } : {}}
                  className={`p-2 rounded-xl text-xs font-bold flex flex-col items-center space-y-1 transition-all cursor-pointer ${
                    paymentMethod === 'cash'
                      ? ''
                      : 'bg-[#181818] text-[#A1A1AA] hover:text-white border border-[#262626]'
                  }`}
                >
                  <Banknote className="w-4 h-4" />
                  <span>CASH</span>
                </button>

                <button
                  type="button"
                  id="pay-pos-btn"
                  onClick={() => setPaymentMethod('pos')}
                  style={paymentMethod === 'pos' ? {
                    backgroundColor: workerPrimaryColor,
                    color: textColor,
                    boxShadow: `0 4px 14px 0 rgba(var(--worker-primary-rgb, 183, 255, 0), 0.3)`,
                  } : {}}
                  className={`p-2 rounded-xl text-xs font-bold flex flex-col items-center space-y-1 transition-all cursor-pointer ${
                    paymentMethod === 'pos'
                      ? ''
                      : 'bg-[#181818] text-[#A1A1AA] hover:text-white border border-[#262626]'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>POS CARD</span>
                </button>

                <button
                  type="button"
                  id="pay-transfer-btn"
                  onClick={() => setPaymentMethod('transfer')}
                  style={paymentMethod === 'transfer' ? {
                    backgroundColor: workerPrimaryColor,
                    color: textColor,
                    boxShadow: `0 4px 14px 0 rgba(var(--worker-primary-rgb, 183, 255, 0), 0.3)`,
                  } : {}}
                  className={`p-2 rounded-xl text-xs font-bold flex flex-col items-center space-y-1 transition-all cursor-pointer ${
                    paymentMethod === 'transfer'
                      ? ''
                      : 'bg-[#181818] text-[#A1A1AA] hover:text-white border border-[#262626]'
                  }`}
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  <span>TRANSFER</span>
                </button>
              </div>
            </div>

            {/* Totals Summary */}
            <div className="pt-3.5 mt-3 border-t border-[#222222] space-y-1.5 text-xs">
              <div className="flex justify-between text-[#A1A1AA]">
                <span>Subtotal</span>
                <span className="text-white font-bold">{formatNaira(subtotal)}</span>
              </div>

              {discount > 0 && (
                <div className="flex justify-between text-red-400">
                  <span>Discount</span>
                  <span>-{formatNaira(discount)}</span>
                </div>
              )}

              <div className="flex justify-between items-baseline pt-2 border-t border-[#262626]">
                <span className="text-sm font-bold text-white uppercase tracking-wider">
                  TOTAL (NGN)
                </span>
                <span 
                  className="text-xl sm:text-2xl font-black"
                  style={{ color: workerPrimaryColor }}
                >
                  {formatNaira(total)}
                </span>
              </div>
            </div>

            {/* Complete Sale Action Button */}
            <div className="mt-4">
              <button
                id="complete-sale-btn"
                type="button"
                disabled={isProcessingSale || items.length === 0}
                onClick={handleCompleteSale}
                style={!isProcessingSale && items.length > 0 ? {
                  backgroundColor: workerPrimaryColor,
                  color: textColor,
                  boxShadow: `0 8px 20px -4px rgba(var(--worker-primary-rgb, 183, 255, 0), 0.35)`,
                } : {}}
                className="w-full disabled:bg-[#222222] disabled:text-[#555555] font-black py-3.5 px-4 rounded-xl text-sm transition-all flex items-center justify-center space-x-2 cursor-pointer active:scale-95"
              >
                {isProcessingSale ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    <span>PROCESSING SALE...</span>
                  </div>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>COMPLETE SALE ({formatNaira(total)})</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>

      </div>

      {/* Shift Required Safety Modal */}
      {isShiftRequiredModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#111111] border border-amber-500/40 rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
              <Play className="w-6 h-6 fill-amber-400 ml-0.5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white tracking-wide">SHIFT REQUIRED</h3>
              <p className="text-xs text-[#A1A1AA] mt-1.5 leading-relaxed">
                You must start your shift before you can complete this sale.
              </p>
            </div>
            <div className="space-y-2 pt-2 border-t border-[#222222]">
              <button
                id="modal-start-shift-btn"
                onClick={() => {
                  setIsShiftRequiredModalOpen(false);
                  openShiftModal();
                }}
                style={{
                  backgroundColor: workerPrimaryColor,
                  color: textColor,
                  boxShadow: `0 8px 20px -4px rgba(var(--worker-primary-rgb, 183, 255, 0), 0.35)`,
                }}
                className="w-full font-black py-3 px-4 rounded-xl text-xs sm:text-sm transition-all flex items-center justify-center space-x-2 cursor-pointer active:scale-95 shadow-lg"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>START SHIFT</span>
              </button>
              <button
                onClick={() => setIsShiftRequiredModalOpen(false)}
                className="w-full bg-[#181818] hover:bg-[#222222] text-[#A1A1AA] hover:text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition-colors cursor-pointer"
              >
                Back to Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Sticky Cart Trigger Floating Bar */}
      {items.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 lg:hidden z-30">
          <button
            onClick={() => {
              window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            }}
            style={{
              backgroundColor: workerPrimaryColor,
              color: textColor,
              boxShadow: `0 10px 25px -5px rgba(var(--worker-primary-rgb, 183, 255, 0), 0.4)`,
            }}
            className="w-full font-black py-3 px-4 rounded-2xl flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center space-x-2">
              <ShoppingBag className="w-5 h-5" />
              <span>{totalQuantity} Items</span>
            </div>
            <div className="text-base font-black">
              View Cart • {formatNaira(total)}
            </div>
          </button>
        </div>
      )}

    </div>
  );
};
