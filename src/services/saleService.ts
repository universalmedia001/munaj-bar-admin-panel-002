import { getSupabase } from '../lib/supabase';
import { productService } from './productService';
import { isAuthorizedWorkerRole } from './authService';
import { adminService } from './adminService';
import { BestSellingProductItem, CartItem, CompletedSaleResult, PaymentMethod, Sale, SaleItem, SaleWithItems } from '../types';

/**
 * Computes authoritative timestamp boundaries for reports, sales history, and stock tracking in Africa/Lagos (UTC+1)
 */
export function getDateFilterRange(
  filter: 'today' | 'yesterday' | 'week' | 'last7' | 'month' | 'last30' | 'year' | 'all' | 'custom' = 'today',
  customRange?: { startDate: string; endDate: string }
): { startTimestamp: string | null; endTimestamp: string | null; isYesterday: boolean } {
  const lagosFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  // Format returns "YYYY-MM-DD" in Lagos
  const todayLagosStr = lagosFormatter.format(new Date());
  const [yearStr, monthStr, dayStr] = todayLagosStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10); // 1-12
  const day = parseInt(dayStr, 10); // 1-31

  let startTimestamp: string | null = null;
  let endTimestamp: string | null = null;
  const isYesterday = filter === 'yesterday';

  const pad = (n: number) => String(n).padStart(2, '0');

  if (filter === 'today') {
    startTimestamp = new Date(`${todayLagosStr}T00:00:00+01:00`).toISOString();
  } else if (filter === 'yesterday') {
    const yesterdayDate = new Date(Date.UTC(year, month - 1, day - 1));
    const yYear = yesterdayDate.getUTCFullYear();
    const yMonth = yesterdayDate.getUTCMonth() + 1;
    const yDay = yesterdayDate.getUTCDate();
    const yDateStr = `${yYear}-${pad(yMonth)}-${pad(yDay)}`;

    startTimestamp = new Date(`${yDateStr}T00:00:00+01:00`).toISOString();
    endTimestamp = new Date(`${todayLagosStr}T00:00:00+01:00`).toISOString();
  } else if (filter === 'week') {
    const curDate = new Date(Date.UTC(year, month - 1, day));
    const dayOfWeek = curDate.getUTCDay(); // 0 = Sun, 1 = Mon ...
    const diff = curDate.getUTCDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const startOfWeek = new Date(Date.UTC(year, month - 1, diff));
    const wDateStr = `${startOfWeek.getUTCFullYear()}-${pad(startOfWeek.getUTCMonth() + 1)}-${pad(startOfWeek.getUTCDate())}`;
    startTimestamp = new Date(`${wDateStr}T00:00:00+01:00`).toISOString();
  } else if (filter === 'last7') {
    const startOfLast7 = new Date(Date.UTC(year, month - 1, day - 7));
    const l7DateStr = `${startOfLast7.getUTCFullYear()}-${pad(startOfLast7.getUTCMonth() + 1)}-${pad(startOfLast7.getUTCDate())}`;
    startTimestamp = new Date(`${l7DateStr}T00:00:00+01:00`).toISOString();
  } else if (filter === 'month') {
    const mDateStr = `${year}-${pad(month)}-01`;
    startTimestamp = new Date(`${mDateStr}T00:00:00+01:00`).toISOString();
  } else if (filter === 'last30') {
    const startOfLast30 = new Date(Date.UTC(year, month - 1, day - 30));
    const l30DateStr = `${startOfLast30.getUTCFullYear()}-${pad(startOfLast30.getUTCMonth() + 1)}-${pad(startOfLast30.getUTCDate())}`;
    startTimestamp = new Date(`${l30DateStr}T00:00:00+01:00`).toISOString();
  } else if (filter === 'year') {
    const yDateStr = `${year}-01-01`;
    startTimestamp = new Date(`${yDateStr}T00:00:00+01:00`).toISOString();
  } else if (filter === 'custom' && customRange?.startDate) {
    startTimestamp = customRange.startDate.includes('T')
      ? customRange.startDate
      : new Date(`${customRange.startDate}T00:00:00+01:00`).toISOString();
    if (customRange.endDate) {
      endTimestamp = customRange.endDate.includes('T')
        ? customRange.endDate
        : new Date(`${customRange.endDate}T23:59:59.999+01:00`).toISOString();
    }
  }

  return { startTimestamp, endTimestamp, isYesterday };
}

export const saleService = {
  async completeSale(
    shiftId: string,
    paymentMethod: PaymentMethod,
    cartItems: CartItem[],
    discount: number = 0
  ): Promise<CompletedSaleResult> {
    const supabase = getSupabase();

    // Verify authorized worker role if authenticated
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (currentUser) {
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (userProfile?.role && !isAuthorizedWorkerRole(userProfile.role)) {
        throw new Error(
          'Unauthorized: You do not have permission to create or complete sales on the POS.'
        );
      }
    }

    if (!shiftId) {
      throw new Error('An open shift is required to complete a sale.');
    }

    if (!cartItems.length) {
      throw new Error('Cart is empty. Please add at least one product.');
    }

    const payloadItems = cartItems.map((item) => ({
      product_id: item.product.id,
      quantity: item.quantity,
    }));

    // Call atomic transactional RPC on Supabase with exact parameter names:
    // p_shift_id, p_items, p_payment_method, p_discount
    const { data, error } = await supabase.rpc('complete_sale', {
      p_shift_id: shiftId,
      p_items: payloadItems,
      p_payment_method: paymentMethod,
      p_discount: Number(discount) || 0,
    });

    if (!error && data) {
      // Get authenticated user info for worker name resolution
      const { data: { user } } = await supabase.auth.getUser();
      let workerFullName = 'Cashier';
      if (user) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .maybeSingle();
        if (prof?.full_name) {
          workerFullName = prof.full_name;
        }
      }

      const saleId = typeof data === 'object' && data !== null ? (data.id || data.sale_id) : (typeof data === 'string' ? data : null);
      if (saleId) {
        const fullSale = await saleService.getSaleById(saleId);
        if (fullSale) {
          return {
            ...fullSale,
            worker_name: (fullSale as any).worker?.full_name || workerFullName,
            items: fullSale.items && fullSale.items.length > 0 ? fullSale.items : cartItems.map(item => ({
              product_id: item.product.id,
              product_name: item.product.name,
              quantity: item.quantity,
              unit_price: Number(item.product.selling_price) || 0,
              total: (Number(item.product.selling_price) || 0) * item.quantity,
            })),
          } as CompletedSaleResult;
        }
      }

      return {
        ...(typeof data === 'object' ? data : {}),
        worker_name: (data as any)?.worker_name || workerFullName,
        items: (data as any)?.items || cartItems.map(item => ({
          product_id: item.product.id,
          product_name: item.product.name,
          quantity: item.quantity,
          unit_price: Number(item.product.selling_price) || 0,
          total: (Number(item.product.selling_price) || 0) * item.quantity,
        })),
      } as CompletedSaleResult;
    }

    console.warn('complete_sale RPC notice/error, attempting fallback:', error);

    // Fallback: If RPC returned error (such as status check mismatch or missing function),
    // perform atomic client transactions to complete the sale directly.
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw error || new Error('Authentication required to complete sale.');
    }

    // Retrieve worker's profile name
    const { data: workerProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle();

    const workerName = workerProfile?.full_name || user.email?.split('@')[0] || 'Cashier';

    // Calculate totals
    const subtotal = cartItems.reduce(
      (acc, item) => acc + (Number(item.product.selling_price) || 0) * item.quantity,
      0
    );
    const disc = Math.max(0, Number(discount) || 0);
    const total = Math.max(0, subtotal - disc);

    // Generate unique receipt number
    const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    const receiptNumber = `MB-${dateStr}-${randSuffix}`;

    // 1. Insert into sales table
    const { data: saleData, error: saleError } = await supabase
      .from('sales')
      .insert({
        receipt_number: receiptNumber,
        shift_id: shiftId,
        worker_id: user.id,
        subtotal,
        discount: disc,
        total,
        payment_method: paymentMethod,
        status: 'completed',
      })
      .select('*')
      .single();

    if (saleError) {
      console.error('Error inserting sale directly:', saleError);
      throw error || saleError;
    }

    // 2. Insert into sale_items table
    const saleItemsPayload = cartItems.map((item) => ({
      sale_id: saleData.id,
      product_id: item.product.id,
      product_name: item.product.name,
      quantity: item.quantity,
      unit_price: Number(item.product.selling_price) || 0,
      total: (Number(item.product.selling_price) || 0) * item.quantity,
    }));

    const { error: itemsError } = await supabase.from('sale_items').insert(saleItemsPayload);
    if (itemsError) {
      console.error('Error inserting sale items:', itemsError);
    }

    // 3. Deduct product inventory stock & record stock movements
    for (const item of cartItems) {
      try {
        const currentStock = Number(item.product.stock_quantity) || 0;
        const newStock = Math.max(0, currentStock - item.quantity);

        await supabase
          .from('products')
          .update({
            stock_quantity: newStock,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.product.id);

        await supabase.from('stock_movements').insert({
          product_id: item.product.id,
          quantity_change: -item.quantity,
          quantity_before: currentStock,
          quantity_after: newStock,
          movement_type: 'sale',
          reason: 'POS Sale',
          reference_id: saleData.id,
          created_by: user.id,
        });
      } catch (stockErr) {
        console.warn(`Stock update notice for ${item.product.name}:`, stockErr);
      }
    }

    // 4. Create admin notification
    try {
      await supabase.from('notifications').insert({
        title: 'New Sale Completed',
        message: `${workerName} completed a sale of ₦${total.toLocaleString()} via ${paymentMethod.toUpperCase()}`,
        type: 'sale',
        metadata: { sale_id: saleData.id, shift_id: shiftId, receipt_number: receiptNumber },
        is_read: false,
      });
    } catch (notifErr) {
      console.warn('Notification insert notice:', notifErr);
    }

    // 5. Construct completed sale response
    const completedResult: CompletedSaleResult = {
      id: saleData.id,
      receipt_number: saleData.receipt_number,
      worker_id: user.id,
      worker_name: workerName,
      shift_id: shiftId,
      subtotal,
      discount: disc,
      total,
      payment_method: paymentMethod,
      status: 'completed',
      created_at: saleData.created_at || new Date().toISOString(),
      items: cartItems.map((item) => ({
        product_id: item.product.id,
        product_name: item.product.name,
        quantity: item.quantity,
        unit_price: Number(item.product.selling_price) || 0,
        total: (Number(item.product.selling_price) || 0) * item.quantity,
      })),
    };

    return completedResult;
  },

  async getWorkerSales(
    filter: 'today' | 'yesterday' | 'week' | 'last7' | 'month' | 'last30' | 'year' | 'all' | 'custom' = 'today',
    customRange?: { startDate: string; endDate: string }
  ): Promise<SaleWithItems[]> {
    const supabase = getSupabase();

    // Query completed sales directly from database (matching Admin queries)
    let query = supabase
      .from('sales')
      .select(`
        *,
        worker:profiles(*),
        items:sale_items(*)
      `)
      .in('status', ['completed', 'COMPLETED', 'paid', 'PAID'])
      .order('created_at', { ascending: false });

    // Date Filter matching Admin Panel & POS daily stock tracking logic
    const { startTimestamp, endTimestamp, isYesterday } = getDateFilterRange(filter, customRange);

    if (startTimestamp) {
      query = query.gte('created_at', startTimestamp);
    }
    if (endTimestamp) {
      query = isYesterday ? query.lt('created_at', endTimestamp) : query.lte('created_at', endTimestamp);
    }

    let data: any[] = [];
    try {
      const res = await query;
      if (res.error) {
        console.warn('Notice fetching sales for Cashier:', res.error.message || res.error);
      } else {
        data = res.data || [];
      }
    } catch (queryErr) {
      console.warn('Notice querying sales for Cashier (network/fetch):', queryErr);
    }

    // Fetch active products catalog to resolve product names from products relationship
    let productsData: any[] = [];
    try {
      productsData = await productService.getActiveProducts();
    } catch (prodErr) {
      console.warn('Notice resolving products catalog for sales:', prodErr);
    }

    const productsMap = new Map<string, string>();
    if (productsData && Array.isArray(productsData)) {
      productsData.forEach((p) => {
        if (p.id && p.name) {
          productsMap.set(p.id, p.name.trim());
        }
      });
    }

    const isUUID = (str?: string | null) => 
      Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim()));

    // Fetch all authorized worker profiles to resolve authoritative seller identity via sales.worker_id
    let workersMap = new Map<string, any>();
    try {
      const workers = await adminService.getAllWorkers();
      if (Array.isArray(workers)) {
        workers.forEach((w) => {
          if (w.id) {
            workersMap.set(w.id, w);
          }
        });
      }
    } catch (workerErr) {
      console.warn('Notice loading workers catalog for sales resolution:', workerErr);
    }

    const resolvedSales = (data || []).map((sale: any) => {
      // Authoritative worker resolution from sales.worker_id
      const resolvedWorker = (sale.worker_id && workersMap.get(sale.worker_id)) || sale.worker;

      const items = (sale.items || []).map((item: any) => {
        let name = (item.product_name || '').trim();
        const pId = item.product_id;

        // If product_id exists and mapped in products, use real product name
        if (pId && productsMap.has(pId)) {
          name = productsMap.get(pId)!;
        } else if (!name || name.toLowerCase() === 'item' || name.toLowerCase() === 'unknown product' || isUUID(name)) {
          if (pId && productsMap.has(pId)) {
            name = productsMap.get(pId)!;
          }
        }

        return {
          ...item,
          product_name: name || 'Product',
        };
      });

      return {
        ...sale,
        worker: resolvedWorker,
        items,
      };
    });

    return resolvedSales as SaleWithItems[];
  },

  /**
   * Submits a cashier's generated sales report to the Admin Panel as an official notification/activity
   */
  async submitReportToAdmin(params: {
    workerName: string;
    periodLabel: string;
    totalSales: number;
    totalTransactions: number;
    totalItems: number;
    paymentBreakdown: {
      cash: number;
      pos: number;
      transfer: number;
    };
  }): Promise<void> {
    const supabase = getSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    const title = `Staff Sales Report: ${params.workerName}`;
    const message = `${params.workerName} submitted a sales report.\n\nPeriod: ${params.periodLabel}\nTotal Sales: ₦${params.totalSales.toLocaleString()}\nTransactions: ${params.totalTransactions}\nItems Sold: ${params.totalItems}\n\nPayment Breakdown:\n• Cash: ₦${params.paymentBreakdown.cash.toLocaleString()}\n• POS: ₦${params.paymentBreakdown.pos.toLocaleString()}\n• Transfer: ₦${params.paymentBreakdown.transfer.toLocaleString()}`;

    // 1. Get all admin profile IDs to notify
    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .in('role', ['admin', 'manager']);

    if (admins && admins.length > 0) {
      const rows = admins.map((adm) => ({
        title,
        message,
        type: 'info' as const,
        recipient_id: adm.id,
        sender_id: user?.id || null,
        reference_type: 'staff_report',
        is_read: false,
      }));

      await supabase.from('notifications').insert(rows);
    } else {
      // Generic notification if no admins found
      await supabase.from('notifications').insert({
        title,
        message,
        type: 'info',
        recipient_id: null,
        sender_id: user?.id || null,
        reference_type: 'staff_report',
        is_read: false,
      });
    }

    // 2. Also log in activity_logs
    try {
      await supabase.from('activity_logs').insert({
        action: 'submit_sales_report',
        entity_type: 'sales_report',
        user_id: user?.id || null,
        details: `Cashier ${params.workerName} submitted ${params.periodLabel} report totaling ₦${params.totalSales.toLocaleString()} (${params.totalTransactions} transactions)`,
      });
    } catch (logErr) {
      console.warn('Activity log notice:', logErr);
    }
  },

  /**
   * Real-time subscription to newly completed sales across the bar terminal
   */
  subscribeToWorkerSales(workerId: string, onNewSale: (sale: Sale) => void) {
    const supabase = getSupabase();
    const uniqueId = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const channelName = `sales-stream-${workerId}-${uniqueId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sales',
        },
        (payload) => {
          if (payload.new) {
            onNewSale(payload.new as Sale);
          } else {
            onNewSale({} as Sale);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  async getSaleById(saleId: string): Promise<SaleWithItems | null> {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          worker:profiles(*),
          items:sale_items(*)
        `)
        .eq('id', saleId)
        .maybeSingle();

      if (error) {
        console.warn('Notice fetching sale:', error.message || error);
        return null;
      }
      if (!data) return null;

      // Resolve product names from products catalog if needed
      if (data.items && Array.isArray(data.items)) {
        let productsData: any[] = [];
        try {
          productsData = await productService.getActiveProducts();
        } catch {}

        const productsMap = new Map<string, string>();
        if (productsData && Array.isArray(productsData)) {
          productsData.forEach((p) => {
            if (p.id && p.name) productsMap.set(p.id, p.name.trim());
          });
        }

        const isUUID = (str?: string | null) => 
          Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim()));

        data.items = data.items.map((item: any) => {
          let name = (item.product_name || '').trim();
          const pId = item.product_id;
          if (pId && productsMap.has(pId)) {
            name = productsMap.get(pId)!;
          } else if (!name || name.toLowerCase() === 'item' || name.toLowerCase() === 'unknown product' || isUUID(name)) {
            if (pId && productsMap.has(pId)) {
              name = productsMap.get(pId)!;
            }
          }
          return {
            ...item,
            product_name: name || item.product_name || 'Product',
          };
        });
      }

      // Resolve worker profile from existing worker profiles if worker is null
      if (!data.worker && data.worker_id) {
        try {
          const workers = await adminService.getAllWorkers();
          const match = workers.find((w) => w.id === data.worker_id);
          if (match) {
            data.worker = match;
          }
        } catch (workerErr) {
          console.warn('Notice loading worker profile for sale by id:', workerErr);
        }
      }

      return data as SaleWithItems;
    } catch (err) {
      console.warn('Notice loading sale by id:', err);
      return null;
    }
  },

  /**
   * Calculates product ranking for Best-Selling Bar Items and complete goods analysis from Supabase.
   * Ranks by: 1. Gross Revenue (DESC), 2. Units Sold (DESC)
   * Also ensures all catalog goods (including products with 0 sales) are returned with full inventory metrics.
   */
  async getBestSellingProducts(
    filter: 'today' | 'yesterday' | 'week' | 'last7' | 'month' | 'last30' | 'year' | 'all' | 'custom' = 'all',
    customRange?: { startDate: string; endDate: string }
  ): Promise<BestSellingProductItem[]> {
    const supabase = getSupabase();

    // 1. Fetch categories for category name mapping
    let categoriesData: any[] = [];
    try {
      categoriesData = await productService.getCategories();
    } catch (catErr) {
      console.warn('Notice fetching categories for product analysis:', catErr);
    }

    const categoriesMap = new Map<string, string>();
    if (categoriesData && Array.isArray(categoriesData)) {
      categoriesData.forEach((c) => {
        if (c.id && c.name) categoriesMap.set(c.id, c.name);
      });
    }

    // 2. Fetch all active bar products to seed the complete goods list
    let productsData: any[] = [];
    try {
      productsData = await productService.getActiveProducts();
    } catch (prodErr) {
      console.warn('Notice fetching products for product analysis:', prodErr);
    }

    const aggregation = new Map<string, {
      productId: string | null;
      productName: string;
      categoryName: string;
      startingStock: number;
      unitsSold: number;
      estUnitCost: number;
      sellingPrice: number;
      currentStock: number;
      unitsRemaining: number;
      minimumStockLevel: number;
      stockAdded: number;
      stockRemoved: number;
      grossRevenue: number;
      imageUrl: string | null;
      status: string;
      lastSale: string | null;
    }>();

    const productsMap = new Map<string, { id: string; name: string; cost_price: number; selling_price: number; stock: number; min_stock: number; image_url: string | null; catName: string }>();
    const productsByNameMap = new Map<string, { id: string; name: string; cost_price: number; selling_price: number; stock: number; min_stock: number; image_url: string | null; catName: string }>();

    if (productsData && Array.isArray(productsData)) {
      productsData.forEach((p) => {
        const catName = (p.category_id && categoriesMap.get(p.category_id)) || 'Bar Beverage';
        const costPrice = Number(p.cost_price || 0);
        const sellingPrice = Number(p.selling_price || 0);
        const stockQty = Number(p.stock_quantity || 0);
        const minStock = Number(p.minimum_stock_level || 5);

        let stockStatus = 'In Stock';
        if (stockQty <= 0) {
          stockStatus = 'Out of Stock';
        } else if (stockQty <= minStock) {
          stockStatus = 'Low Stock';
        }

        const info = {
          id: p.id,
          name: p.name,
          cost_price: costPrice,
          selling_price: sellingPrice,
          stock: stockQty,
          min_stock: minStock,
          image_url: p.image_url || null,
          catName,
        };

        productsMap.set(p.id, info);
        productsByNameMap.set(p.name.trim().toLowerCase(), info);

        // Pre-populate all catalog products with initial starting stock = current stock
        aggregation.set(p.id, {
          productId: p.id,
          productName: p.name,
          categoryName: catName,
          startingStock: stockQty,
          unitsSold: 0,
          estUnitCost: costPrice,
          sellingPrice: sellingPrice,
          currentStock: stockQty,
          unitsRemaining: stockQty,
          minimumStockLevel: minStock,
          stockAdded: 0,
          stockRemoved: 0,
          grossRevenue: 0,
          imageUrl: p.image_url || null,
          status: stockStatus,
          lastSale: null,
        });
      });
    }

    // 3. Determine period boundaries
    const { startTimestamp, endTimestamp, isYesterday } = getDateFilterRange(filter, customRange);

    // 4. Fetch completed sales with line items
    let salesQuery = supabase
      .from('sales')
      .select(`
        id,
        status,
        created_at,
        items:sale_items(
          id,
          product_id,
          product_name,
          quantity,
          unit_price,
          total
        )
      `)
      .in('status', ['completed', 'COMPLETED', 'paid', 'PAID']);

    if (startTimestamp) {
      salesQuery = salesQuery.gte('created_at', startTimestamp);
    }
    if (endTimestamp) {
      salesQuery = isYesterday ? salesQuery.lt('created_at', endTimestamp) : salesQuery.lte('created_at', endTimestamp);
    }

    let salesData: any[] = [];
    try {
      const { data: resData, error: salesError } = await salesQuery;
      if (salesError) {
        console.warn('Notice fetching sales for product analysis:', salesError.message || salesError);
      } else {
        salesData = resData || [];
      }
    } catch (salesFetchError) {
      console.warn('Notice querying sales data for product analysis (network/fetch):', salesFetchError);
    }

    // 5. Fetch non-sale stock movements (restocks, adjustments, losses) during the period to calculate accurate starting stock
    let stockMovementsData: any[] = [];
    if (startTimestamp) {
      try {
        let movementsQuery = supabase
          .from('stock_movements')
          .select('product_id, quantity_change, movement_type, created_at')
          .gte('created_at', startTimestamp);
        if (endTimestamp) {
          movementsQuery = isYesterday ? movementsQuery.lt('created_at', endTimestamp) : movementsQuery.lte('created_at', endTimestamp);
        }
        const { data: movsRes, error: movsError } = await movementsQuery;
        if (!movsError && movsRes) {
          stockMovementsData = movsRes;
        }
      } catch (movErr) {
        console.warn('Notice querying stock movements for starting stock calculation:', movErr);
      }
    }

    // Process non-sale stock movements per product
    stockMovementsData.forEach((m) => {
      if (!m.product_id) return;
      const target = aggregation.get(m.product_id);
      if (target) {
        const change = Number(m.quantity_change) || 0;
        if (change > 0) {
          // Stock added (restock / positive adjustment)
          target.stockAdded += change;
        } else if (change < 0 && m.movement_type !== 'sale') {
          // Stock removed (loss / damage / negative adjustment)
          target.stockRemoved += Math.abs(change);
        }
      }
    });

    // 6. Aggregate sales data into product map
    (salesData || []).forEach((sale: any) => {
      const items = (sale.items || []) as SaleItem[];
      items.forEach((item) => {
        const pId = item.product_id || '';
        const rawName = (item.product_name || 'Unknown Product').trim();

        // Match product by ID or Name
        const matched = (pId && productsMap.get(pId)) || productsByNameMap.get(rawName.toLowerCase());
        const targetKey = matched?.id || pId || rawName.toLowerCase();

        const costPrice = matched?.cost_price !== undefined ? Number(matched.cost_price) : 0;
        const sellingPrice = matched?.selling_price !== undefined ? Number(matched.selling_price) : Number(item.unit_price || 0);
        const resolvedName = matched?.name || rawName;
        const imageUrl = matched?.image_url || null;
        const categoryName = matched?.catName || 'Bar Beverage';
        const currentStock = matched?.stock !== undefined ? matched.stock : 0;
        const minStock = matched?.min_stock !== undefined ? matched.min_stock : 5;

        const qty = Number(item.quantity) || 0;
        const itemRevenue = Number(item.total) !== undefined && Number(item.total) > 0 
          ? Number(item.total) 
          : (Number(item.unit_price || 0) * qty);

        if (!aggregation.has(targetKey)) {
          aggregation.set(targetKey, {
            productId: pId || matched?.id || null,
            productName: resolvedName,
            categoryName,
            startingStock: currentStock,
            unitsSold: 0,
            estUnitCost: costPrice,
            sellingPrice,
            currentStock,
            unitsRemaining: currentStock,
            minimumStockLevel: minStock,
            stockAdded: 0,
            stockRemoved: 0,
            grossRevenue: 0,
            imageUrl,
            status: currentStock <= 0 ? 'Out of Stock' : (currentStock <= minStock ? 'Low Stock' : 'In Stock'),
            lastSale: sale.created_at || null,
          });
        }

        const current = aggregation.get(targetKey)!;
        current.unitsSold += qty;
        current.grossRevenue += itemRevenue;
        if (costPrice > 0) current.estUnitCost = costPrice;
        if (sellingPrice > 0) current.sellingPrice = sellingPrice;
        if (imageUrl && !current.imageUrl) current.imageUrl = imageUrl;
        if (!current.lastSale || (sale.created_at && new Date(sale.created_at) > new Date(current.lastSale))) {
          current.lastSale = sale.created_at;
        }
      });
    });

    // 7. Calculate authoritative Starting Stock for each product
    // Formula: Starting Stock = Remaining Stock + Units Sold − Stock Added + Stock Removed
    aggregation.forEach((item) => {
      const remaining = item.currentStock;
      const sold = item.unitsSold;
      const added = item.stockAdded;
      const removed = item.stockRemoved;

      // Calculate starting stock for the period
      const computedStarting = remaining + sold - added + removed;
      item.startingStock = Math.max(0, computedStarting);
      item.unitsRemaining = remaining;

      // Update status based on remaining stock
      if (remaining <= 0) {
        item.status = 'Out of Stock';
      } else if (remaining <= item.minimumStockLevel) {
        item.status = 'Low Stock';
      } else {
        item.status = 'In Stock';
      }
    });

    // 8. Sort products:
    // Ranked items with sales (Gross Revenue DESC, then Units Sold DESC)
    // Followed by unsold goods (Current Stock DESC, then Product Name ASC)
    const allItems = Array.from(aggregation.values());

    const soldItems = allItems
      .filter((item) => item.grossRevenue > 0 || item.unitsSold > 0)
      .sort((a, b) => {
        if (b.grossRevenue !== a.grossRevenue) {
          return b.grossRevenue - a.grossRevenue;
        }
        if (b.unitsSold !== a.unitsSold) {
          return b.unitsSold - a.unitsSold;
        }
        return a.productName.localeCompare(b.productName);
      });

    const unsoldItems = allItems
      .filter((item) => item.grossRevenue === 0 && item.unitsSold === 0)
      .sort((a, b) => {
        if (b.currentStock !== a.currentStock) {
          return b.currentStock - a.currentStock;
        }
        return a.productName.localeCompare(b.productName);
      });

    // 9. Return combined list with rank numbers
    const combined = [...soldItems, ...unsoldItems];

    return combined.map((item, index) => ({
      rank: index + 1,
      ...item,
    }));
  },

  /**
   * Realtime subscription for sales, sale items, products, and stock movements to live-update Cashier Daily Stock Tracking
   */
  subscribeToAllCompletedSales(onUpdate: () => void) {
    const supabase = getSupabase();
    const uniqueId = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const channelId = `all-sales-analysis-${uniqueId}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sales' },
        () => {
          onUpdate();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sale_items' },
        () => {
          onUpdate();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        () => {
          onUpdate();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stock_movements' },
        () => {
          onUpdate();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  /**
   * Returns a keyed map of today's starting stock, units sold today, and current remaining stock for every product
   */
  async getDailyStockMap(): Promise<Map<string, { startingStock: number; soldToday: number; remainingStock: number }>> {
    const analysis = await this.getBestSellingProducts('today');
    const map = new Map<string, { startingStock: number; soldToday: number; remainingStock: number }>();
    
    analysis.forEach((item) => {
      const val = {
        startingStock: item.startingStock !== undefined ? item.startingStock : (item.currentStock ?? 0),
        soldToday: item.unitsSold || 0,
        remainingStock: item.currentStock ?? item.unitsRemaining ?? 0,
      };
      if (item.productId) {
        map.set(item.productId, val);
      }
      if (item.productName) {
        map.set(item.productName.trim().toLowerCase(), val);
      }
    });

    return map;
  },
};
