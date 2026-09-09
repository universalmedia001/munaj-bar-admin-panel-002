import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AdminNavTab, Product, SaleWithItems } from '../../types';
import { adminService } from '../../services/adminService';
import { AdminSidebar } from './AdminSidebar';
import { AdminHeader } from './AdminHeader';
import { AdminDashboardView } from './AdminDashboardView';
import { AdminSalesView } from './AdminSalesView';
import { AdminProductsView } from './AdminProductsView';
import { AdminInventoryView } from './AdminInventoryView';
import { AdminWorkersView } from './AdminWorkersView';
import { AdminShiftsView } from './AdminShiftsView';
import { AdminReceiptsView } from './AdminReceiptsView';
import { AdminNotificationsView } from './AdminNotificationsView';
import { AdminActivityView } from './AdminActivityView';
import { AdminReportsView } from './AdminReportsView';
import { AdminSettingsView } from './AdminSettingsView';
import { AdminProfileView } from './AdminProfileView';
import { AdminUnauthorizedView } from './AdminUnauthorizedView';
import { StockAdjustModal } from './StockAdjustModal';
import { ReceiptModal } from '../ReceiptModal';
import { ConfigGuideModal } from '../ConfigGuideModal';
import { LogoutConfirmationModal } from '../LogoutConfirmationModal';

interface AdminPanelAppProps {
  onSwitchToPos: () => void;
}

export const AdminPanelApp: React.FC<AdminPanelAppProps> = ({
  onSwitchToPos,
}) => {
  const { profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminNavTab>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [activeShiftsCount, setActiveShiftsCount] = useState<number>(0);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);

  // Modals
  const [isStockAdjustModalOpen, setIsStockAdjustModalOpen] = useState<boolean>(false);
  const [selectedProductForAdjust, setSelectedProductForAdjust] = useState<Product | null>(null);
  const [activeReceiptSale, setActiveReceiptSale] = useState<SaleWithItems | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);
  const [isReprintMode, setIsReprintMode] = useState<boolean>(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState<boolean>(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState<boolean>(false);

  // Poll notifications & active shifts count
  const refreshHeaderStats = async () => {
    try {
      const [shifts, notifs] = await Promise.all([
        adminService.getActiveShifts(),
        adminService.getNotifications(20),
      ]);
      setActiveShiftsCount(shifts.length);
      setUnreadNotificationsCount(notifs.filter((n) => !n.is_read).length);
    } catch (err) {
      console.error('Error loading header stats:', err);
    }
  };

  useEffect(() => {
    refreshHeaderStats();
    const interval = setInterval(refreshHeaderStats, 25000);
    return () => clearInterval(interval);
  }, []);

  // Access Control: Only admin and manager roles can access the Admin Panel
  const isAuthorized = profile?.role === 'admin' || profile?.role === 'manager';

  if (!isAuthorized) {
    return (
      <>
        <AdminUnauthorizedView
          profile={profile}
          onSwitchToPos={onSwitchToPos}
          onSignOut={() => setIsLogoutModalOpen(true)}
        />
        <LogoutConfirmationModal
          isOpen={isLogoutModalOpen}
          onClose={() => setIsLogoutModalOpen(false)}
          onConfirm={() => {
            setIsLogoutModalOpen(false);
            signOut();
          }}
        />
      </>
    );
  }

  const handleOpenStockAdjust = (product?: Product) => {
    setSelectedProductForAdjust(product || null);
    setIsStockAdjustModalOpen(true);
  };

  const handleSelectSaleForView = (sale: SaleWithItems) => {
    setActiveReceiptSale(sale);
    setIsReprintMode(true);
    setIsReceiptModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#FAFAFA] flex font-sans selection:bg-green-500 selection:text-black">
      {/* Persistent Left Sidebar */}
      <AdminSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        profile={profile}
        unreadNotificationsCount={unreadNotificationsCount}
        onSwitchToPos={onSwitchToPos}
        onSignOut={() => setIsLogoutModalOpen(true)}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main App Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader
          activeTab={activeTab}
          onTabChange={setActiveTab}
          profile={profile}
          activeShiftsCount={activeShiftsCount}
          unreadNotificationsCount={unreadNotificationsCount}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onSwitchToPos={onSwitchToPos}
          onOpenConfig={() => setIsConfigModalOpen(true)}
        />

        <main className="flex-1 pb-16 overflow-y-auto custom-scrollbar">
          {activeTab === 'dashboard' && (
            <AdminDashboardView
              onNavigate={setActiveTab}
              onSelectSaleForView={handleSelectSaleForView}
              onOpenNewProductModal={() => setActiveTab('products')}
              onOpenStockAdjustModal={handleOpenStockAdjust}
              onOpenBroadcastModal={() => setActiveTab('notifications')}
            />
          )}

          {activeTab === 'sales' && (
            <AdminSalesView
              onSelectSaleForView={handleSelectSaleForView}
            />
          )}

          {activeTab === 'products' && (
            <AdminProductsView
              onOpenStockAdjustModal={handleOpenStockAdjust}
            />
          )}

          {activeTab === 'inventory' && (
            <AdminInventoryView
              onOpenStockAdjustModal={handleOpenStockAdjust}
            />
          )}

          {activeTab === 'workers' && (
            <AdminWorkersView />
          )}

          {activeTab === 'shifts' && (
            <AdminShiftsView />
          )}

          {activeTab === 'receipts' && (
            <AdminReceiptsView
              onSelectSaleForReprint={handleSelectSaleForView}
            />
          )}

          {activeTab === 'notifications' && (
            <AdminNotificationsView />
          )}

          {activeTab === 'activity' && (
            <AdminActivityView />
          )}

          {activeTab === 'reports' && (
            <AdminReportsView />
          )}

          {activeTab === 'settings' && (
            <AdminSettingsView
              onOpenConfigModal={() => setIsConfigModalOpen(true)}
            />
          )}

          {activeTab === 'profile' && (
            <AdminProfileView
              onSwitchToPos={onSwitchToPos}
              onOpenConfig={() => setIsConfigModalOpen(true)}
              onSignOut={() => setIsLogoutModalOpen(true)}
            />
          )}
        </main>
      </div>

      {/* Stock Adjustment Modal */}
      <StockAdjustModal
        isOpen={isStockAdjustModalOpen}
        onClose={() => {
          setIsStockAdjustModalOpen(false);
          setSelectedProductForAdjust(null);
        }}
        product={selectedProductForAdjust}
        onSuccess={() => {
          refreshHeaderStats();
        }}
      />

      {/* Thermal Receipt Modal */}
      <ReceiptModal
        sale={activeReceiptSale}
        isOpen={isReceiptModalOpen}
        isReprint={isReprintMode}
        onClose={() => {
          setIsReceiptModalOpen(false);
          setActiveReceiptSale(null);
        }}
      />

      {/* Supabase Config / Diagnostics Guide Modal */}
      <ConfigGuideModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
      />

      {/* Logout Confirmation Modal */}
      <LogoutConfirmationModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={() => {
          setIsLogoutModalOpen(false);
          signOut();
        }}
      />
    </div>
  );
};
