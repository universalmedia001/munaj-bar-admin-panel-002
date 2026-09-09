import React, { useState } from 'react';
import {
  Menu,
  Bell,
  Radio,
  Send,
  CheckCheck,
  ExternalLink,
  Shield,
  Clock,
  Sparkles,
} from 'lucide-react';
import type { TabType } from './Sidebar';
import type { AppNotification, BusinessSettings } from '../../types';
import { formatRelativeTime } from '../../utils/formatters';
import { supabase } from '../../lib/supabase';
import { useWorkerBranding } from '../../context/BrandingContext';

interface HeaderProps {
  activeTab?: TabType | string;
  setActiveTab?: (tab: TabType) => void;
  onOpenMobileSidebar?: () => void;
  onToggleSidebar?: () => void;
  notifications?: AppNotification[];
  unreadCount?: number;
  onOpenNotifications?: () => void;
  onOpenBroadcast?: () => void;
  onOpenBroadcastModal?: () => void;
  settings?: BusinessSettings | null;
  refreshNotifications?: () => void;
  onRefresh?: () => void;
  realtimeConnected?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab = 'dashboard',
  setActiveTab,
  onOpenMobileSidebar,
  onToggleSidebar,
  notifications = [],
  unreadCount = 0,
  onOpenNotifications,
  onOpenBroadcast,
  onOpenBroadcastModal,
  settings,
  refreshNotifications,
  onRefresh,
  realtimeConnected = true,
}) => {
  const [showNotifMenu, setShowNotifMenu] = useState(false);

  const { workerPosName } = useWorkerBranding();

  const handleOpenBroadcast = () => {
    if (onOpenBroadcastModal) onOpenBroadcastModal();
    else if (onOpenBroadcast) onOpenBroadcast();
  };

  const handleToggleSidebar = () => {
    if (onToggleSidebar) onToggleSidebar();
    else if (onOpenMobileSidebar) onOpenMobileSidebar();
  };

  const handleRefresh = () => {
    if (onRefresh) onRefresh();
    if (refreshNotifications) refreshNotifications();
  };

  const titles: Record<string, { title: string; desc: string }> = {
    dashboard: { title: 'Executive Dashboard', desc: 'Realtime sales performance and live operational metrics' },
    sales: { title: 'Sales & Live Transactions', desc: 'Monitor orders, payment methods, and live POS checkout feeds' },
    products: { title: 'Product Catalog', desc: 'Manage bar drinks, categories, selling prices and costs' },
    inventory: { title: 'Inventory & Stock Movements', desc: 'Track stock counts, audit movements, and low stock thresholds' },
    workers: { title: 'Worker Management', desc: 'Staff roles, shift activity, account statuses and permissions' },
    shifts: { title: 'Shift Control & Cash Audit', desc: 'Opening cash, ending cash audits and discrepancy tracking' },
    receipts: { title: 'Receipts & Print Logs', desc: 'Lookup receipts, thermal print previews and reprint history' },
    notifications: { title: 'Notifications & Broadcasts', desc: 'Staff announcements, stock warnings and operational alerts' },
    activity: { title: 'Audit Trail & Activity Log', desc: 'Immutable timeline of every business operation and transaction' },
    reports: { title: 'Reports & Analytics', desc: 'Revenue breakdowns, worker productivity and product trends' },
    settings: { title: 'Business Settings', desc: 'Bar profile, receipt header/footer, address and currency' },
    database: { title: 'Database & Sync Status', desc: 'Supabase schema verification, tables status, and migration SQL' },
  };

  const currentTab = (activeTab && titles[activeTab]) ? titles[activeTab] : {
    title: `${workerPosName} Admin`,
    desc: 'Realtime bar operations and management control center',
  };

  const markAllRead = async () => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('is_read', false);
      handleRefresh();
    } catch (err) {
      console.error('Error marking notifications as read:', err);
    }
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-[#050505]/95 backdrop-blur-md border-b border-zinc-800/80 px-4 lg:px-8 flex items-center justify-between">
      {/* Left section */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleToggleSidebar}
          className="lg:hidden p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          aria-label="Open Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-sm lg:text-base font-extrabold text-white tracking-tight flex items-center gap-2">
            {currentTab.title}
          </h1>
          <p className="hidden sm:block text-[11px] text-zinc-400 truncate max-w-md">
            {currentTab.desc}
          </p>
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2.5">
        {/* Realtime Live Indicator */}
        <div
          className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${
            realtimeConnected
              ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-400'
              : 'bg-amber-950/60 border-amber-800/60 text-amber-400'
          }`}
        >
          <span className="relative flex h-2 w-2">
            {realtimeConnected && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            )}
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                realtimeConnected ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            ></span>
          </span>
          <span className="text-[11px]">
            {realtimeConnected ? 'Realtime Active' : 'Sync Reconnecting'}
          </span>
        </div>

        {/* Broadcast to Workers Button */}
        <button
          onClick={handleOpenBroadcast}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-black bg-[#22C55E] hover:bg-[#1ea750] rounded-xl transition-all shadow-md shadow-emerald-950/30 hover:scale-[1.02] active:scale-[0.98]"
        >
          <Send className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Broadcast to Workers</span>
          <span className="md:hidden">Broadcast</span>
        </button>

        {/* Notifications Popover */}
        <div className="relative">
          <button
            onClick={() => {
              if (onOpenNotifications) {
                onOpenNotifications();
              } else {
                setShowNotifMenu(!showNotifMenu);
              }
            }}
            className="relative p-2 text-zinc-400 hover:text-white rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#22C55E] text-black font-extrabold text-[10px] flex items-center justify-center animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowNotifMenu(false)}
              />
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-[#111111] border border-zinc-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <div className="p-3.5 border-b border-zinc-800 bg-[#141414] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-[#22C55E]" />
                    <span className="text-xs font-bold text-white">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/50">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-[11px] text-zinc-400 hover:text-[#22C55E] font-medium flex items-center gap-1 transition-colors"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-zinc-800/60">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center text-xs text-zinc-500">
                      No notifications yet
                    </div>
                  ) : (
                    notifications.slice(0, 6).map((n) => (
                      <div
                        key={n.id}
                        className={`p-3 text-xs hover:bg-zinc-900/60 transition-colors ${
                          !n.is_read ? 'bg-emerald-950/20' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-zinc-200 text-[12px]">{n.title || 'Notification'}</p>
                          <span className="text-[10px] text-zinc-500 shrink-0">
                            {formatRelativeTime(n.created_at)}
                          </span>
                        </div>
                        <p className="text-zinc-400 text-[11px] mt-0.5">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-2.5 border-t border-zinc-800 bg-[#0d0d0d] text-center">
                  <button
                    onClick={() => {
                      setShowNotifMenu(false);
                      if (setActiveTab) setActiveTab('notifications');
                      else if (onOpenNotifications) onOpenNotifications();
                    }}
                    className="text-xs font-semibold text-[#22C55E] hover:underline"
                  >
                    View all notifications &rarr;
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
