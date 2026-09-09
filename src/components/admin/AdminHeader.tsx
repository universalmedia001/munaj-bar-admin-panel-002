import React from 'react';
import { 
  Menu, 
  Bell, 
  Store, 
  Radio, 
  Users, 
  Shield, 
  Settings
} from 'lucide-react';
import { AdminNavTab, Profile } from '../../types';

interface AdminHeaderProps {
  activeTab: AdminNavTab;
  onTabChange: (tab: AdminNavTab) => void;
  profile: Profile | null;
  activeShiftsCount: number;
  unreadNotificationsCount: number;
  onOpenMobileMenu: () => void;
  onSwitchToPos: () => void;
  onOpenConfig: () => void;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  activeTab,
  onTabChange,
  profile,
  activeShiftsCount,
  unreadNotificationsCount,
  onOpenMobileMenu,
  onSwitchToPos,
  onOpenConfig,
}) => {
  const getTabTitle = (tab: AdminNavTab): { title: string; subtitle: string } => {
    switch (tab) {
      case 'dashboard':
        return { title: 'Executive Dashboard', subtitle: 'Real-time sales, inventory, and operations overview' };
      case 'sales':
        return { title: 'Sales Transactions', subtitle: 'Audit, filter, and inspect all completed sales and receipts' };
      case 'products':
        return { title: 'Product & Menu Catalog', subtitle: 'Manage prices, categories, and availability for POS terminals' };
      case 'inventory':
        return { title: 'Inventory & Stock Control', subtitle: 'Monitor stock levels, execute adjustments, and track restocks' };
      case 'workers':
        return { title: 'Worker & Staff Roles', subtitle: 'Manage cashiers, bar staff, managers, and access permissions' };
      case 'shifts':
        return { title: 'Shifts & Cash Reconciliation', subtitle: 'Track active worker registers, expected cash, and shortages/overages' };
      case 'receipts':
        return { title: 'Thermal Receipts & Print Logs', subtitle: 'Lookup receipt numbers and execute thermal reprints' };
      case 'notifications':
        return { title: 'Worker Broadcasts & Alerts', subtitle: 'Send real-time notices to POS terminals and view alert logs' };
      case 'activity':
        return { title: 'Audit Trail & Activity Log', subtitle: 'Immutable chronological record of all bar operations' };
      case 'reports':
        return { title: 'Analytics & Financial Reports', subtitle: 'Revenue breakdowns, product volume, and worker performance' };
      case 'settings':
        return { title: 'Business & Receipt Settings', subtitle: 'Configure bar identity, currency, and receipt headers' };
      case 'profile':
        return { title: 'Admin Account & Security', subtitle: 'View profile credentials and authentication status' };
      default:
        return { title: 'Admin Panel', subtitle: 'MUNAJ BAR Management' };
    }
  };

  const { title, subtitle } = getTabTitle(activeTab);

  return (
    <header className="sticky top-0 z-30 bg-[#0A0A0A]/95 backdrop-blur-md border-b border-[#222222] px-4 lg:px-8 py-3.5 flex items-center justify-between">
      {/* Left: Mobile Toggle & Page Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 text-[#A1A1AA] hover:text-white rounded-lg bg-[#141414] border border-[#222222]"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h1 className="text-base lg:text-lg font-bold text-white tracking-tight flex items-center gap-2">
            {title}
          </h1>
          <p className="hidden sm:block text-xs text-[#A1A1AA] mt-0.5">
            {subtitle}
          </p>
        </div>
      </div>

      {/* Right: Quick Indicators & Controls */}
      <div className="flex items-center gap-2.5">
        {/* Live Supabase Connection Badge */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="font-medium text-[11px]">Realtime Synced</span>
        </div>

        {/* Active Cashiers Badge */}
        <button
          onClick={() => onTabChange('shifts')}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#141414] hover:bg-[#1E1E1E] border border-[#262626] text-xs transition-colors"
          title="Active shifts open on POS terminals"
        >
          <Users className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-[#A1A1AA] hidden sm:inline">Active Shifts:</span>
          <span className="font-bold text-white">{activeShiftsCount}</span>
        </button>

        {/* Notifications Icon Button */}
        <button
          onClick={() => onTabChange('notifications')}
          className="relative p-2 rounded-lg bg-[#141414] hover:bg-[#1E1E1E] border border-[#262626] text-[#A1A1AA] hover:text-white transition-colors"
          title="Broadcasts & System Alerts"
        >
          <Bell className="w-4 h-4" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center animate-bounce">
              {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
            </span>
          )}
        </button>

        {/* Settings / Diagnostics Button */}
        <button
          onClick={onOpenConfig}
          className="p-2 rounded-lg bg-[#141414] hover:bg-[#1E1E1E] border border-[#262626] text-[#A1A1AA] hover:text-white transition-colors"
          title="Supabase Config & Diagnostics"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Switch to POS Button */}
        <button
          onClick={onSwitchToPos}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500 hover:bg-green-400 text-black font-semibold text-xs transition-all shadow-sm active:scale-95"
        >
          <Store className="w-4 h-4" />
          <span className="hidden sm:inline">Worker POS</span>
        </button>
      </div>
    </header>
  );
};
