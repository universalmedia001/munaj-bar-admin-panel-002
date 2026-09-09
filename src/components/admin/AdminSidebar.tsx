import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  ReceiptText, 
  Package, 
  Boxes, 
  Users, 
  Clock, 
  Printer, 
  Bell, 
  Activity, 
  BarChart3, 
  Settings, 
  UserCheck, 
  Store, 
  LogOut, 
  ShieldCheck,
  X
} from 'lucide-react';
import { AdminNavTab, Profile } from '../../types';
import { useWorkerBranding } from '../../context/WorkerBrandingContext';

interface AdminSidebarProps {
  activeTab: AdminNavTab;
  onTabChange: (tab: AdminNavTab) => void;
  profile: Profile | null;
  unreadNotificationsCount: number;
  onSwitchToPos: () => void;
  onSignOut: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeTab,
  onTabChange,
  profile,
  unreadNotificationsCount,
  onSwitchToPos,
  onSignOut,
  isOpenMobile,
  onCloseMobile,
}) => {
  const { businessLogo, workerSiteName } = useWorkerBranding();
  const [logoErr, setLogoErr] = useState(false);

  useEffect(() => {
    setLogoErr(false);
  }, [businessLogo]);
  const navItems: { id: AdminNavTab; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'sales', label: 'Sales Management', icon: ReceiptText },
    { id: 'products', label: 'Products & Menu', icon: Package },
    { id: 'inventory', label: 'Inventory & Stock', icon: Boxes },
    { id: 'workers', label: 'Workers & Roles', icon: Users },
    { id: 'shifts', label: 'Shifts & Cash Recon', icon: Clock },
    { id: 'receipts', label: 'Receipts & Prints', icon: Printer },
    { 
      id: 'notifications', 
      label: 'Broadcasts & Alerts', 
      icon: Bell, 
      badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined 
    },
    { id: 'activity', label: 'Audit Activity Log', icon: Activity },
    { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Business Settings', icon: Settings },
    { id: 'profile', label: 'My Profile', icon: UserCheck },
  ];

  const handleNavClick = (tab: AdminNavTab) => {
    onTabChange(tab);
    onCloseMobile();
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#0D0D0D] border-r border-[#222222] text-[#E4E4E7]">
      {/* Brand Header */}
      <div className="p-5 border-b border-[#222222] flex items-center justify-between">
        <div className="flex items-center gap-3">
          {businessLogo && !logoErr ? (
            <div className="w-9 h-9 rounded-lg bg-[#181818] border border-[#2A2A2A] flex items-center justify-center p-1 overflow-hidden shrink-0 shadow-sm">
              <img
                src={businessLogo}
                alt={workerSiteName}
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
                onError={() => setLogoErr(true)}
              />
            </div>
          ) : (
            <div className="w-9 h-9 rounded-lg bg-green-500/10 border border-green-500/30 flex items-center justify-center text-green-400 font-bold tracking-wider shrink-0">
              {workerSiteName.substring(0, 2).toUpperCase() || 'MB'}
            </div>
          )}
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-white tracking-wider text-sm">{workerSiteName || 'MUNAJ BAR'}</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30 uppercase">
                ADMIN
              </span>
            </div>
            <p className="text-[11px] text-[#A1A1AA]">Management Portal</p>
          </div>
        </div>

        {/* Mobile Close Button */}
        <button
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 text-[#A1A1AA] hover:text-white rounded-lg hover:bg-[#181818]"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Admin User Profile Card */}
      <div className="p-4 mx-3 my-3 rounded-xl bg-[#141414] border border-[#222222] flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-green-600 to-emerald-400 flex items-center justify-center font-bold text-xs text-black shadow-inner">
          {profile?.full_name?.charAt(0).toUpperCase() || 'A'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white truncate">
            {profile?.full_name || 'Administrator'}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <ShieldCheck className="w-3 h-3 text-green-400" />
            <span className="text-[10px] font-medium text-green-400 uppercase tracking-wide">
              {profile?.role || 'admin'}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 custom-scrollbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-green-500 text-black font-semibold shadow-sm'
                  : 'text-[#A1A1AA] hover:text-white hover:bg-[#181818]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-black' : 'text-[#A1A1AA]'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isActive
                      ? 'bg-black text-green-400'
                      : 'bg-green-500/20 text-green-400 border border-green-500/40'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Actions: Switch to POS & Logout */}
      <div className="p-3 border-t border-[#222222] space-y-2">
        <button
          onClick={onSwitchToPos}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-[#E4E4E7] bg-[#181818] hover:bg-[#222222] hover:text-white border border-[#2A2A2A] transition-colors"
        >
          <Store className="w-4 h-4 text-green-400" />
          <span>Launch Worker POS</span>
        </button>

        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-[#EF4444] hover:bg-red-500/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:block w-64 h-screen shrink-0 sticky top-0">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-xs" 
            onClick={onCloseMobile} 
          />
          <div className="relative w-72 max-w-[85vw] h-full z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
