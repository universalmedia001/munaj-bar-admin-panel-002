import React from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  Package,
  Boxes,
  Users,
  Clock,
  Receipt,
  Bell,
  Activity,
  BarChart3,
  Settings,
  Database as DatabaseIcon,
  LogOut,
  ShieldCheck,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useWorkerBranding } from '../../context/BrandingContext';

export type TabType =
  | 'dashboard'
  | 'sales'
  | 'products'
  | 'inventory'
  | 'workers'
  | 'shifts'
  | 'receipts'
  | 'notifications'
  | 'activity'
  | 'reports'
  | 'settings'
  | 'database';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  isOpen: boolean; // Mobile drawer open state
  onCloseMobile: () => void;
  isCollapsed: boolean; // Desktop collapsed state
  onToggleCollapse: () => void; // Toggle desktop collapsed state
  unreadCount: number;
  lowStockCount: number;
  logoUrl?: string | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isOpen,
  onCloseMobile,
  isCollapsed,
  onToggleCollapse,
  unreadCount,
  lowStockCount,
  logoUrl,
}) => {
  const { profile, signOut } = useAuth();
  const { workerPosName } = useWorkerBranding();

  const brandInitial = (workerPosName?.trim() || 'M').charAt(0).toUpperCase();

  const navItems: {
    id: TabType;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number | string;
    badgeColor?: 'emerald' | 'amber' | 'red' | 'zinc';
  }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'sales', label: 'Sales & Live', icon: TrendingUp },
    { id: 'products', label: 'Products', icon: Package },
    {
      id: 'inventory',
      label: 'Inventory',
      icon: Boxes,
      badge: lowStockCount > 0 ? lowStockCount : undefined,
      badgeColor: 'amber',
    },
    { id: 'workers', label: 'Workers', icon: Users },
    { id: 'shifts', label: 'Shifts', icon: Clock },
    { id: 'receipts', label: 'Receipts', icon: Receipt },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: Bell,
      badge: unreadCount > 0 ? unreadCount : undefined,
      badgeColor: 'emerald',
    },
    { id: 'activity', label: 'Activity Logs', icon: Activity },
    { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Business Settings', icon: Settings },
    { id: 'database', label: 'Database & Sync', icon: DatabaseIcon },
  ];

  const mainOperations = navItems.slice(0, 7);
  const managementAndSystem = navItems.slice(7);

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden animate-fade-in"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed lg:static top-0 left-0 bottom-0 z-40 bg-[#0a0a0a] border-r border-zinc-800/80 flex flex-col shrink-0 transition-all duration-300 ease-in-out select-none ${
          // Desktop Width: 72px when collapsed, 256px (w-64) when expanded
          isCollapsed ? 'lg:w-[72px]' : 'lg:w-64'
        } ${
          // Mobile Width & Drawer behavior
          isOpen ? 'w-64 translate-x-0' : '-translate-x-full lg:translate-x-0 w-64'
        }`}
      >
        {/* Brand & Toggle Header */}
        <div
          className={`h-16 border-b border-zinc-800/80 bg-[#0d0d0d] flex items-center transition-all duration-300 ${
            isCollapsed
              ? 'px-3 justify-between lg:justify-center'
              : 'px-4 sm:px-5 justify-between'
          }`}
        >
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => isCollapsed && onToggleCollapse()}
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#22C55E] to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-950/40 text-black font-extrabold text-lg tracking-wider shrink-0 cursor-pointer hover:scale-105 transition-transform overflow-hidden relative"
              title={isCollapsed ? `${workerPosName} — Click to Expand` : workerPosName}
            >
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={workerPosName}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                    const fb = e.currentTarget.parentElement?.querySelector('.sidebar-brand-initial');
                    if (fb) (fb as HTMLElement).classList.remove('hidden');
                  }}
                />
              ) : null}
              <span className={`sidebar-brand-initial ${logoUrl ? 'hidden' : ''}`}>
                {brandInitial}
              </span>
            </button>
            {/* Title text hidden when collapsed on desktop */}
            <div
              className={`flex flex-col overflow-hidden whitespace-nowrap transition-all duration-300 ${
                isCollapsed ? 'lg:hidden' : 'block'
              }`}
            >
              <span className="font-extrabold text-sm tracking-wider text-white flex items-center gap-1.5 truncate max-w-[150px]" title={workerPosName}>
                {workerPosName}
                <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse shrink-0"></span>
              </span>
              <span className="text-[10px] text-zinc-400 font-medium tracking-wide">
                ADMIN CONTROL CENTER
              </span>
            </div>
          </div>

          {/* Desktop Toggle Button (Collapses Sidebar when expanded) */}
          {!isCollapsed && (
            <button
              type="button"
              onClick={onToggleCollapse}
              title="Collapse sidebar (Ctrl+B)"
              aria-label="Collapse sidebar"
              className="hidden lg:flex items-center justify-center p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800/80 border border-transparent hover:border-zinc-700/60 transition-colors cursor-pointer"
            >
              <PanelLeftClose className="w-4 h-4 text-zinc-400 hover:text-white" />
            </button>
          )}

          {/* Mobile Close 'X' Button */}
          <button
            type="button"
            onClick={onCloseMobile}
            title="Close navigation"
            aria-label="Close navigation"
            className="lg:hidden p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Collapsed Top Expand Button on Desktop */}
        {isCollapsed && (
          <div className="hidden lg:flex justify-center pt-2.5 pb-1 px-2">
            <button
              type="button"
              onClick={onToggleCollapse}
              title="Expand sidebar (Ctrl+B)"
              aria-label="Expand sidebar"
              className="w-10 h-8 flex items-center justify-center rounded-xl text-zinc-400 hover:text-white bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800/80 hover:border-zinc-700 transition-all cursor-pointer shadow-sm group"
            >
              <PanelLeftOpen className="w-4 h-4 text-[#22C55E] group-hover:scale-110 transition-transform" />
            </button>
          </div>
        )}

        {/* Navigation List */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-2.5 space-y-1 custom-scrollbar">
          {/* Main Operations Section Header or Divider */}
          {isCollapsed ? (
            <div className="hidden lg:block my-2 border-t border-zinc-800/60 mx-1" />
          ) : (
            <div className="px-2.5 pb-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider select-none">
              Main Operations
            </div>
          )}

          {/* Main Operations Items */}
          {mainOperations.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const tooltipText = `${item.label}${item.badge ? ` (${item.badge})` : ''}`;

            return (
              <div key={item.id} className="relative group">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    onCloseMobile();
                  }}
                  title={isCollapsed ? tooltipText : undefined}
                  className={`w-full flex items-center rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
                    isCollapsed
                      ? 'justify-center p-2.5 lg:h-11 lg:w-11 lg:mx-auto'
                      : 'justify-between px-3 py-2.5'
                  } ${
                    isActive
                      ? 'bg-[#181818] text-[#22C55E] border border-zinc-700/60 shadow-inner'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/60 border border-transparent'
                  }`}
                  aria-label={item.label}
                >
                  {/* Left: Icon and Label */}
                  <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 min-w-0'}`}>
                    <div className="relative flex items-center justify-center">
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive ? 'text-[#22C55E]' : 'text-zinc-400 group-hover:text-zinc-200'
                        }`}
                      />
                      {/* Notification Badge on Collapsed Icon */}
                      {isCollapsed && item.badge !== undefined && (
                        <span
                          className={`hidden lg:flex absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 items-center justify-center text-[9px] font-extrabold rounded-full shadow-md ${
                            item.badgeColor === 'amber'
                              ? 'bg-amber-500 text-black'
                              : 'bg-[#22C55E] text-black'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>

                    {/* Text Label (Hidden when collapsed on desktop) */}
                    <span
                      className={`truncate transition-all duration-300 ${
                        isCollapsed ? 'lg:hidden' : 'block'
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>

                  {/* Expanded Badge (Right-aligned) */}
                  {item.badge !== undefined && (
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full transition-all duration-300 ${
                        isCollapsed ? 'lg:hidden' : 'inline-block'
                      } ${
                        item.badgeColor === 'amber'
                          ? 'bg-amber-950 text-amber-400 border border-amber-800/50'
                          : 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>

                {/* Desktop Floating Tooltip on Hover (When Collapsed) */}
                {isCollapsed && (
                  <div className="hidden lg:group-hover:flex absolute left-full ml-3.5 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-[#181818] border border-zinc-700/90 rounded-xl shadow-2xl z-50 text-xs font-semibold text-white whitespace-nowrap items-center gap-2 pointer-events-none animate-in fade-in duration-150">
                    <span>{item.label}</span>
                    {item.badge !== undefined && (
                      <span
                        className={`px-1.5 py-0.2 text-[10px] font-bold rounded-full ${
                          item.badgeColor === 'amber'
                            ? 'bg-amber-950 text-amber-400 border border-amber-800'
                            : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                    <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-[#181818] border-l border-b border-zinc-700/90 rotate-45" />
                  </div>
                )}
              </div>
            );
          })}

          {/* Management & System Section Header or Divider */}
          {isCollapsed ? (
            <div className="hidden lg:block my-2.5 border-t border-zinc-800/60 mx-1" />
          ) : (
            <div className="pt-3.5 px-2.5 pb-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider select-none">
              Management & System
            </div>
          )}

          {/* Management & System Items */}
          {managementAndSystem.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const tooltipText = `${item.label}${item.badge ? ` (${item.badge})` : ''}`;

            return (
              <div key={item.id} className="relative group">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    onCloseMobile();
                  }}
                  title={isCollapsed ? tooltipText : undefined}
                  className={`w-full flex items-center rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
                    isCollapsed
                      ? 'justify-center p-2.5 lg:h-11 lg:w-11 lg:mx-auto'
                      : 'justify-between px-3 py-2.5'
                  } ${
                    isActive
                      ? 'bg-[#181818] text-[#22C55E] border border-zinc-700/60 shadow-inner'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/60 border border-transparent'
                  }`}
                  aria-label={item.label}
                >
                  {/* Left: Icon and Label */}
                  <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 min-w-0'}`}>
                    <div className="relative flex items-center justify-center">
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive ? 'text-[#22C55E]' : 'text-zinc-400 group-hover:text-zinc-200'
                        }`}
                      />
                      {/* Notification Badge on Collapsed Icon */}
                      {isCollapsed && item.badge !== undefined && (
                        <span
                          className={`hidden lg:flex absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 items-center justify-center text-[9px] font-extrabold rounded-full shadow-md ${
                            item.badgeColor === 'amber'
                              ? 'bg-amber-500 text-black'
                              : 'bg-[#22C55E] text-black'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>

                    {/* Text Label (Hidden when collapsed on desktop) */}
                    <span
                      className={`truncate transition-all duration-300 ${
                        isCollapsed ? 'lg:hidden' : 'block'
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>

                  {/* Expanded Badge (Right-aligned) */}
                  {item.badge !== undefined && (
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full transition-all duration-300 ${
                        isCollapsed ? 'lg:hidden' : 'inline-block'
                      } ${
                        item.badgeColor === 'emerald'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                          : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>

                {/* Desktop Floating Tooltip on Hover (When Collapsed) */}
                {isCollapsed && (
                  <div className="hidden lg:group-hover:flex absolute left-full ml-3.5 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-[#181818] border border-zinc-700/90 rounded-xl shadow-2xl z-50 text-xs font-semibold text-white whitespace-nowrap items-center gap-2 pointer-events-none animate-in fade-in duration-150">
                    <span>{item.label}</span>
                    {item.badge !== undefined && (
                      <span
                        className={`px-1.5 py-0.2 text-[10px] font-bold rounded-full ${
                          item.badgeColor === 'emerald'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                    <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-[#181818] border-l border-b border-zinc-700/90 rotate-45" />
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footbar: Worker POS Connected & User Profile */}
        <div className="p-2.5 border-t border-zinc-800/80 bg-[#0d0d0d] space-y-2">
          {/* POS Status Badge */}
          {isCollapsed ? (
            <div className="relative group hidden lg:flex justify-center py-1">
              <div
                className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center cursor-pointer"
                title="POS Backend Active • Sync ON"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E] animate-pulse" />
              </div>
              <div className="hidden lg:group-hover:flex absolute left-full ml-3.5 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-[#181818] border border-zinc-700/90 rounded-xl shadow-2xl z-50 text-xs font-semibold text-white whitespace-nowrap items-center gap-2 pointer-events-none animate-in fade-in duration-150">
                <span className="w-2 h-2 rounded-full bg-[#22C55E]" />
                <span>POS Backend Active • Sync ON</span>
                <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-[#181818] border-l border-b border-zinc-700/90 rotate-45" />
              </div>
            </div>
          ) : (
            <div className="p-2 rounded-xl bg-zinc-900/90 border border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#22C55E] animate-ping" />
                <span className="text-[11px] font-medium text-zinc-300">POS Backend Active</span>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider">Sync ON</span>
            </div>
          )}

          {/* User Profile Bar */}
          <div
            className={`flex items-center transition-all duration-300 ${
              isCollapsed ? 'justify-center lg:flex-col lg:gap-2' : 'justify-between pt-0.5'
            }`}
          >
            {/* User Avatar & Name */}
            <div className="relative group flex items-center gap-2 min-w-0">
              <div
                className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-white shrink-0 cursor-pointer"
                title={isCollapsed ? `${profile?.full_name || 'Administrator'} (${profile?.role || 'Admin'})` : undefined}
              >
                {profile?.full_name?.charAt(0) || 'A'}
              </div>

              {/* Collapsed Tooltip for Profile */}
              {isCollapsed && (
                <div className="hidden lg:group-hover:flex absolute left-full ml-3.5 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-[#181818] border border-zinc-700/90 rounded-xl shadow-2xl z-50 text-xs font-semibold text-white whitespace-nowrap items-center gap-2 pointer-events-none animate-in fade-in duration-150">
                  <span>{profile?.full_name || 'Administrator'}</span>
                  <span className="text-[10px] text-[#22C55E] uppercase tracking-wider">({profile?.role || 'Admin'})</span>
                  <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-[#181818] border-l border-b border-zinc-700/90 rotate-45" />
                </div>
              )}

              {/* Expanded User Details */}
              <div
                className={`truncate transition-all duration-300 ${
                  isCollapsed ? 'lg:hidden' : 'block'
                }`}
              >
                <p className="text-xs font-bold text-white truncate">{profile?.full_name || 'Administrator'}</p>
                <div className="flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-[#22C55E]" />
                  <span className="text-[10px] text-zinc-400 capitalize">{profile?.role || 'Admin'}</span>
                </div>
              </div>
            </div>

            {/* Sign Out Button */}
            <div className="relative group">
              <button
                type="button"
                onClick={() => signOut()}
                title="Sign Out"
                aria-label="Sign Out"
                className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>

              {/* Collapsed Tooltip for Sign Out */}
              {isCollapsed && (
                <div className="hidden lg:group-hover:flex absolute left-full ml-3.5 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-[#181818] border border-zinc-700/90 rounded-xl shadow-2xl z-50 text-xs font-semibold text-red-300 whitespace-nowrap items-center gap-1.5 pointer-events-none animate-in fade-in duration-150">
                  <LogOut className="w-3.5 h-3.5 text-red-400" />
                  <span>Sign Out</span>
                  <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-[#181818] border-l border-b border-zinc-700/90 rotate-45" />
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
