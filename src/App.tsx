import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BrandingProvider, useWorkerBranding } from './context/BrandingContext';
import { supabase, checkSupabaseConnection } from './lib/supabase';
import type {
  SaleWithDetails,
  ShiftWithWorker,
  Product,
  Category,
  Profile,
  AppNotification,
  ActivityLog,
  StockMovementWithDetails,
  BusinessSettings,
  ReceiptPrint,
} from './types';
import { isWorkerDeleted, isShiftArchived } from './types';
import { Sidebar, type TabType } from './components/common/Sidebar';
import { Header } from './components/common/Header';
import { ReceiptModal } from './components/common/ReceiptModal';
import { BroadcastModal } from './components/common/BroadcastModal';
import { DashboardView } from './components/dashboard/DashboardView';
import { SalesView } from './components/sales/SalesView';
import { ProductsView } from './components/products/ProductsView';
import { InventoryView } from './components/inventory/InventoryView';
import { WorkersView } from './components/workers/WorkersView';
import { ShiftsView } from './components/shifts/ShiftsView';
import { ReceiptsView } from './components/receipts/ReceiptsView';
import { NotificationsView } from './components/notifications/NotificationsView';
import { ActivityView } from './components/activity/ActivityView';
import { ReportsView } from './components/reports/ReportsView';
import { SettingsView } from './components/settings/SettingsView';
import { DatabaseView } from './components/database/DatabaseView';
import { LoginView } from './components/auth/LoginView';
import { EmailVerifiedView } from './components/auth/EmailVerifiedView';
import { seedSampleBarData } from './utils/seedData';
import { Sparkles, RefreshCw, AlertTriangle } from 'lucide-react';

function AdminApp() {
  const { user, profile, loading: authLoading, profileLoading, profileError, signOut } = useAuth();
  const { workerPosName } = useWorkerBranding();

  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('munaj_admin_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [realtimeConnected, setRealtimeConnected] = useState(true);
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname;
    }
    return '/';
  });

  // Track browser navigation, popstate, and hashchange events
  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  // Toggle sidebar collapse state and persist to localStorage
  const handleToggleSidebarCollapse = useCallback(() => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('munaj_admin_sidebar_collapsed', String(next));
      } catch (e) {
        console.warn('Unable to persist sidebar state to localStorage:', e);
      }
      return next;
    });
  }, []);

  // Keyboard shortcut Ctrl+B or Cmd+B to toggle sidebar collapse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
          return;
        }
        e.preventDefault();
        handleToggleSidebarCollapse();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleToggleSidebarCollapse]);

  // Global Data State
  const [sales, setSales] = useState<SaleWithDetails[]>([]);
  const [shifts, setShifts] = useState<ShiftWithWorker[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [workers, setWorkers] = useState<Profile[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [movements, setMovements] = useState<StockMovementWithDetails[]>([]);
  const [receiptPrints, setReceiptPrints] = useState<ReceiptPrint[]>([]);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);

  const [dataLoading, setDataLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const initialDataLoadUserIdRef = useRef<string | null>(null);

  // Modals
  const [selectedReceiptSale, setSelectedReceiptSale] = useState<SaleWithDetails | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);

  // Live Toast for New Sales
  const [liveSaleToast, setLiveSaleToast] = useState<{ id: string; amount: number; receipt: string } | null>(null);

  // Fetch all database records
  const fetchAllData = useCallback(async () => {
    try {
      setDataLoading(true);

      // 1. Settings
      const { data: settingsData } = await supabase.from('business_settings').select('*').limit(1);
      if (settingsData && settingsData.length > 0) {
        setSettings(settingsData[0] as BusinessSettings);
      }

      // 2. Categories
      const { data: catData } = await supabase.from('categories').select('*').order('name', { ascending: true });
      if (catData) setCategories(catData as Category[]);

      // 3. Products
      const { data: prodData } = await supabase.from('products').select('*').order('name', { ascending: true });
      if (prodData) setProducts(prodData as Product[]);

      // 4. Profiles (Workers)
      const { data: profData } = await supabase.from('profiles').select('*').order('full_name', { ascending: true });
      if (profData) setWorkers((profData as Profile[]).filter((p) => !isWorkerDeleted(p)));

      // 5. Shifts with Worker Profile
      const { data: shiftData } = await supabase
        .from('shifts')
        .select(`
          *,
          worker:profiles!shifts_worker_id_fkey(*)
        `)
        .order('started_at', { ascending: false });
      if (shiftData) {
        setShifts((shiftData as ShiftWithWorker[]).filter((s) => !isShiftArchived(s)));
      }

      // 6. Sales with Worker & Items
      const { data: salesData } = await supabase
        .from('sales')
        .select(`
          *,
          worker:profiles!sales_worker_id_fkey(*),
          items:sale_items(*)
        `)
        .order('created_at', { ascending: false });
      if (salesData) setSales(salesData as SaleWithDetails[]);

      // 7. Notifications
      const { data: notifData } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });
      if (notifData) setNotifications(notifData as AppNotification[]);

      // 8. Activity Logs
      const { data: actData } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (actData) setActivityLogs(actData as ActivityLog[]);

      // 9. Stock / Inventory Movements
      let movDataResult: StockMovementWithDetails[] | null = null;
      try {
        const { data: invData, error: invErr } = await supabase
          .from('inventory_movements' as any)
          .select(`
            *,
            product:products(*)
          `)
          .order('created_at', { ascending: false })
          .limit(100);

        if (!invErr && invData) {
          movDataResult = invData as unknown as StockMovementWithDetails[];
        } else {
          const { data: smData } = await supabase
            .from('stock_movements')
            .select(`
              *,
              product:products(*)
            `)
            .order('created_at', { ascending: false })
            .limit(100);
          if (smData) movDataResult = smData as StockMovementWithDetails[];
        }
      } catch (movErr) {
        console.warn('Notice loading inventory movements:', movErr);
      }
      if (movDataResult) setMovements(movDataResult);

      // 10. Receipt Prints
      const { data: printsData } = await supabase
        .from('receipt_prints')
        .select('*')
        .order('printed_at', { ascending: false })
        .limit(100);
      if (printsData) setReceiptPrints(printsData as ReceiptPrint[]);

      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Failed to load live bar data:', err);
    } finally {
      setDataLoading(false);
    }
  }, []);

  const isAuthorizedAdmin = Boolean(
    user && profile && (profile.role === 'admin' || profile.role === 'manager')
  );

  // Initialize dashboard data only after authentication and profile authorization are ready.
  useEffect(() => {
    if (authLoading || profileLoading || !isAuthorizedAdmin || !profile) {
      initialDataLoadUserIdRef.current = null;
      return;
    }

    if (initialDataLoadUserIdRef.current === profile.id) return;
    initialDataLoadUserIdRef.current = profile.id;
    fetchAllData();
  }, [authLoading, profileLoading, isAuthorizedAdmin, profile, fetchAllData]);

  // Supabase Realtime Channel Subscriptions
  useEffect(() => {
    if (authLoading || profileLoading || !isAuthorizedAdmin) return;

    const channel = supabase
      .channel('munaj_admin_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sales' },
        (payload) => {
          console.log('Realtime new sale received:', payload);
          fetchAllData();
          if (payload.new && (payload.new as any).total) {
            setLiveSaleToast({
              id: (payload.new as any).id,
              amount: Number((payload.new as any).total),
              receipt: (payload.new as any).receipt_number || 'MB-SALE',
            });
            setTimeout(() => setLiveSaleToast(null), 5000);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shifts' },
        (payload) => {
          if (payload.eventType === 'DELETE' && payload.old && (payload.old as any).id) {
            const deletedId = (payload.old as any).id;
            setShifts((prev) => prev.filter((s) => s.id !== deletedId));
          } else {
            fetchAllData();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        () => fetchAllData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        () => fetchAllData()
      )
      .on(
        'broadcast',
        { event: 'announcement' },
        (payload) => {
          console.log('Realtime broadcast announcement received:', payload);
          const data = (payload as any)?.payload;
          if (data && data.title) {
            const notifItem: AppNotification = {
              id: data.id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              user_id: data.recipientType === 'all' ? null : (data.recipientIds?.[0] || null),
              title: data.title,
              message: data.message || '',
              type: data.type || 'admin_message',
              reference_type: 'broadcast',
              reference_id: null,
              is_read: false,
              created_at: data.timestamp || new Date().toISOString(),
            };
            setNotifications((prev) => [notifItem, ...prev.filter((n) => n.id !== notifItem.id)]);
          }
          fetchAllData();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_logs' },
        () => fetchAllData()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'stock_movements' },
        () => fetchAllData()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'inventory_movements' },
        () => fetchAllData()
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeConnected(true);
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setRealtimeConnected(false);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authLoading, profileLoading, isAuthorizedAdmin, fetchAllData]);

  const handleOpenReceipt = (sale: SaleWithDetails) => {
    setSelectedReceiptSale(sale);
    setIsReceiptModalOpen(true);
  };

  const handleDeleteShift = useCallback((deletedShiftId: string) => {
    setShifts((prev) => prev.filter((shift) => shift.id !== deletedShiftId));
  }, []);

  const handleQuickSeed = async () => {
    setDataLoading(true);
    await seedSampleBarData(user?.id);
    await fetchAllData();
  };

  // Unread notifications count
  const unreadNotificationsCount = useMemo(() => {
    return notifications.filter((n) => !n.is_read).length;
  }, [notifications]);

  // Low stock products count
  const lowStockProductsCount = useMemo(() => {
    return products.filter((p) => p.stock_quantity <= (p.minimum_stock_level || 5)).length;
  }, [products]);

  // Active shifts count
  const activeShiftsCount = useMemo(() => {
    return shifts.filter((s) => s.status === 'active').length;
  }, [shifts]);

  // 0. Email Verification Success Landing Page (/email-verified)
  const isEmailVerifiedRoute = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const cleanPath = currentPath.toLowerCase().replace(/\/+$/, '');
    const winPath = window.location.pathname.toLowerCase().replace(/\/+$/, '');
    const hash = window.location.hash.toLowerCase();
    return (
      cleanPath === '/email-verified' ||
      cleanPath.startsWith('/email-verified') ||
      winPath === '/email-verified' ||
      winPath.startsWith('/email-verified') ||
      hash.includes('email-verified')
    );
  }, [currentPath]);

  if (isEmailVerifiedRoute) {
    return (
      <EmailVerifiedView
        onNavigateToLogin={() => {
          if (typeof window !== 'undefined') {
            window.history.pushState({}, '', '/');
          }
          setCurrentPath('/');
        }}
      />
    );
  }

  // 1. Initial Loading State (prevents flash of login screen while Supabase restores session or loads profile)
  if (authLoading || profileLoading || (user && !profile)) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#050505] text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-2xl">
            <span
              className="w-4 h-4 rounded-full animate-ping"
              style={{ backgroundColor: 'var(--worker-primary, #B7FF00)' }}
            />
          </div>
          <div className="text-center">
            <h2 className="text-sm font-bold text-white tracking-wide">
              {workerPosName.toUpperCase()} ADMIN
            </h2>
            <p className="text-xs text-zinc-500 mt-1">Verifying management session...</p>
          </div>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated State
  if (!user) {
    return <LoginView />;
  }

  // 3. User authenticated but profile explicitly marked deleted or deactivated
  if (profile && (isWorkerDeleted(profile) || profile.is_active === false)) {
    const isDeactivated = profile.is_active === false && !isWorkerDeleted(profile);
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#050505] text-white px-4 selection:bg-[#22C55E]/30">
        <div className="max-w-md w-full bg-[#111111] border border-red-900/60 rounded-3xl p-8 text-center space-y-5 shadow-2xl backdrop-blur-xl">
          <div className="w-14 h-14 rounded-2xl bg-red-950/60 border border-red-800/80 flex items-center justify-center mx-auto text-red-400">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white">
              {isDeactivated ? 'Account Deactivated' : 'Account Inactive or Deleted'}
            </h2>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
              {isDeactivated
                ? 'Your administrator account has been deactivated. Please contact an administrator if you believe this was a mistake.'
                : 'Your staff account is no longer active in MUNAJ Bar. If you believe this was in error, please contact an administrator.'}
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-2.5">
            <button
              onClick={() => signOut()}
              className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs transition-colors"
            >
              Sign Out & Switch Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Authenticated with Worker Role (Restricted Access without destroying Supabase session)
  if (profile.role !== 'admin' && profile.role !== 'manager') {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#050505] text-white px-4 selection:bg-[#22C55E]/30">
        <div className="max-w-md w-full bg-[#111111] border border-amber-900/60 rounded-3xl p-8 text-center space-y-5 shadow-2xl backdrop-blur-xl">
          <div className="w-14 h-14 rounded-2xl bg-amber-950/60 border border-amber-800/80 flex items-center justify-center mx-auto text-amber-400">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white">Administrative Access Restricted</h2>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
              Your authenticated staff account (<span className="text-zinc-200 font-semibold">{user.email}</span>) has the role of{' '}
              <span className="text-amber-400 font-bold uppercase">{profile.role}</span>. Only accounts with{' '}
              <span className="text-[#22C55E] font-bold">Admin</span> or <span className="text-blue-400 font-bold">Manager</span> permissions can access this portal.
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-2.5">
            <button
              onClick={() => signOut()}
              className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs transition-colors"
            >
              Sign Out & Switch Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#050505] text-[#FFFFFF] font-sans overflow-hidden selection:bg-[#22C55E]/30">
      {/* Realtime New Sale Toast Notification */}
      {liveSaleToast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-3 bg-[#111111] border border-emerald-500/80 text-white px-4 py-3 rounded-2xl shadow-2xl shadow-emerald-950/60 animate-bounce">
          <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E] animate-ping" />
          <div className="text-xs">
            <p className="font-bold text-[#22C55E]">New Sale Processed!</p>
            <p className="text-zinc-300 font-mono">
              Receipt {liveSaleToast.receipt} • ₦{liveSaleToast.amount.toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={sidebarOpen}
        onCloseMobile={() => setSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebarCollapse}
        unreadCount={unreadNotificationsCount}
        lowStockCount={lowStockProductsCount}
        logoUrl={settings?.logo_url || null}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#050505]">
        {/* Header */}
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          notifications={notifications}
          unreadCount={unreadNotificationsCount}
          onOpenNotifications={() => setActiveTab('notifications')}
          onOpenBroadcast={() => setIsBroadcastModalOpen(true)}
          settings={settings}
          realtimeConnected={realtimeConnected}
          onRefresh={fetchAllData}
        />

        {/* Scrollable Viewport */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 custom-scrollbar">
          {/* Quick empty database banner */}
          {products.length === 0 && !dataLoading && (
            <div className="mb-6 p-4 rounded-2xl bg-zinc-900 border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-[#22C55E]" />
                <div className="text-xs">
                  <p className="font-bold text-white">Fresh Database Initialized</p>
                  <p className="text-zinc-400">
                    Click seed to populate premium bar products (Heineken, Jameson, Hennessy), drink categories, and venue settings.
                  </p>
                </div>
              </div>
              <button
                onClick={handleQuickSeed}
                className="px-4 py-2 text-xs font-bold text-black bg-[#22C55E] hover:bg-[#1ea750] rounded-xl transition-all shadow-md shrink-0"
              >
                Seed Bar Catalog
              </button>
            </div>
          )}

          {/* Active Tab View Rendering */}
          {activeTab === 'dashboard' && (
            <DashboardView
              sales={sales}
              shifts={shifts}
              products={products}
              settings={settings}
              onNavigate={(tab) => setActiveTab(tab as TabType)}
              onOpenReceipt={handleOpenReceipt}
              onOpenBroadcast={() => setIsBroadcastModalOpen(true)}
            />
          )}

          {activeTab === 'sales' && (
            <SalesView
              sales={sales}
              workers={workers}
              settings={settings}
              onOpenReceipt={handleOpenReceipt}
              onRefresh={fetchAllData}
              loading={dataLoading}
            />
          )}

          {activeTab === 'inventory' && (
            <InventoryView
              products={products}
              movements={movements}
              settings={settings}
              onRefresh={fetchAllData}
              loading={dataLoading}
            />
          )}

          {activeTab === 'products' && (
            <ProductsView
              products={products}
              categories={categories}
              settings={settings}
              onRefresh={fetchAllData}
              loading={dataLoading}
            />
          )}

          {activeTab === 'workers' && (
            <WorkersView
              workers={workers}
              sales={sales}
              shifts={shifts}
              settings={settings}
              onRefresh={fetchAllData}
              onOpenBroadcast={() => setIsBroadcastModalOpen(true)}
              loading={dataLoading}
            />
          )}

          {activeTab === 'shifts' && (
            <ShiftsView
              shifts={shifts}
              sales={sales}
              workers={workers}
              settings={settings}
              onRefresh={fetchAllData}
              onDeleteShift={handleDeleteShift}
              onOpenReceipt={handleOpenReceipt}
              loading={dataLoading}
            />
          )}

          {activeTab === 'receipts' && (
            <ReceiptsView
              sales={sales}
              receiptPrints={receiptPrints}
              settings={settings}
              workers={workers}
              onOpenReceipt={handleOpenReceipt}
              onRefresh={fetchAllData}
              loading={dataLoading}
            />
          )}

          {activeTab === 'notifications' && (
            <NotificationsView
              notifications={notifications}
              onOpenBroadcastModal={() => setIsBroadcastModalOpen(true)}
              onRefresh={fetchAllData}
              loading={dataLoading}
            />
          )}

          {activeTab === 'activity' && (
            <ActivityView activityLogs={activityLogs} onRefresh={fetchAllData} loading={dataLoading} />
          )}

          {activeTab === 'reports' && (
            <ReportsView
              sales={sales}
              shifts={shifts}
              products={products}
              workers={workers}
              settings={settings}
              onOpenReceipt={handleOpenReceipt}
              onRefresh={fetchAllData}
              loading={dataLoading}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              settings={settings}
              onRefresh={fetchAllData}
              loading={dataLoading}
            />
          )}

          {activeTab === 'database' && (
            <DatabaseView onRefreshAll={fetchAllData} />
          )}
        </main>
      </div>

      {/* 80mm Thermal Receipt Print Modal */}
      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        sale={selectedReceiptSale}
        settings={settings}
        onPrintLogged={fetchAllData}
      />

      {/* Broadcast Message to POS Modal */}
      <BroadcastModal
        isOpen={isBroadcastModalOpen}
        onClose={() => setIsBroadcastModalOpen(false)}
        onBroadcastSent={fetchAllData}
        onSuccess={fetchAllData}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrandingProvider>
        <AdminApp />
      </BrandingProvider>
    </AuthProvider>
  );
}
