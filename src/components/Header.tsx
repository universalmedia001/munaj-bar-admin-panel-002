import React from 'react';
import { 
  ShoppingBag, 
  ReceiptText, 
  Clock, 
  User, 
  LogOut, 
  Wifi, 
  Play, 
  Square,
  Sparkles,
  Bell,
  BarChart3,
  TrendingUp
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useShift } from '../context/ShiftContext';
import { useNotifications } from '../context/NotificationContext';
import { useWorkerBranding } from '../context/WorkerBrandingContext';
import { ActiveNavTab } from '../types';
import { formatNaira, formatTime } from '../utils/formatters';
import { LogoutConfirmationModal } from './LogoutConfirmationModal';

interface HeaderProps {
  activeTab: ActiveNavTab;
  onTabChange: (tab: ActiveNavTab) => void;
  onSwitchToAdmin?: () => void;
  onSignOutClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  activeTab, 
  onTabChange, 
  onSwitchToAdmin,
  onSignOutClick,
}) => {
  const { profile, signOut } = useAuth();
  const { activeShift, isShiftActive, shiftSummary, openShiftModal, openCloseShiftModal } = useShift();
  const { unreadCount, openModal } = useNotifications();
  const { workerSiteName, workerPrimaryColor, textColor, businessLogo } = useWorkerBranding();
  const [logoImgError, setLogoImgError] = React.useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = React.useState(false);

  // Reset logo image error if businessLogo changes
  React.useEffect(() => {
    setLogoImgError(false);
  }, [businessLogo]);

  const handleLogout = () => {
    if (onSignOutClick) {
      onSignOutClick();
    } else if (isShiftActive) {
      openCloseShiftModal();
    } else {
      setIsLogoutModalOpen(true);
    }
  };

  const roleLabelMap: Record<string, string> = {
    cashier: 'Cashier',
    bar_worker: 'Bar Staff',
    sales_worker: 'Sales Staff',
    admin: 'Administrator',
    manager: 'Manager',
  };

  const roleLabel = profile?.role ? roleLabelMap[profile.role] || profile.role : 'Staff';
  const isAdminOrManager = profile?.role === 'admin' || profile?.role === 'manager';
  const isOnlyCashier = profile?.role === 'cashier';
  const isBarStaff = profile?.role === 'bar_worker' || (profile?.role as string) === 'bar_staff' || (profile?.role as string)?.toLowerCase()?.includes('bar');
  const isAuthorizedStaff = ['cashier', 'bar_worker', 'bar_staff', 'sales_worker', 'admin', 'manager'].includes(profile?.role || '');

  const terminalBadge = isBarStaff ? 'BAR TERMINAL' : 'CASHIER TERMINAL';
  const terminalSubtitle = isBarStaff 
    ? 'Fast & Secure Bar Terminal • NGN (₦)' 
    : 'Fast & Secure Cashier Terminal • NGN (₦)';

  const isTabActive = (tab: ActiveNavTab) => {
    if (tab === 'sales') return activeTab === 'sales' || (activeTab as string) === 'my_sales';
    if (tab === 'analysis') return activeTab === 'analysis' || (activeTab as string) === 'sales_report';
    return activeTab === tab;
  };

  const getActiveTabStyle = (tab: ActiveNavTab) => {
    if (isTabActive(tab)) {
      return {
        backgroundColor: workerPrimaryColor,
        color: textColor,
        boxShadow: `0 4px 14px 0 rgba(var(--worker-primary-rgb, 183, 255, 0), 0.3)`,
      };
    }
    return {};
  };

  return (
    <header id="app-header" className="bg-[#111111] border-b border-[#222222] sticky top-0 z-40 select-none">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <div className="flex items-center justify-between h-16 sm:h-18">
          
          {/* Brand & Badge */}
          <div className="flex items-center space-x-3">
            <div 
              className="flex items-center space-x-2.5 cursor-pointer" 
              onClick={() => onTabChange(isOnlyCashier ? 'sales' : 'pos')}
            >
              {businessLogo && !logoImgError ? (
                <div 
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden bg-[#181818] border border-[#2A2A2A] flex items-center justify-center p-1 shadow-md shrink-0"
                  style={{
                    boxShadow: `0 4px 14px 0 rgba(var(--worker-primary-rgb, 183, 255, 0), 0.25)`,
                  }}
                >
                  <img
                    id="header-business-logo"
                    src={businessLogo}
                    alt={workerSiteName}
                    className="w-full h-full object-contain rounded-lg"
                    referrerPolicy="no-referrer"
                    onError={() => setLogoImgError(true)}
                  />
                </div>
              ) : (
                <div 
                  id="header-business-logo-fallback"
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-black text-lg tracking-wider transition-colors shrink-0"
                  style={{
                    backgroundColor: workerPrimaryColor,
                    color: textColor,
                    boxShadow: `0 4px 14px 0 rgba(var(--worker-primary-rgb, 183, 255, 0), 0.3)`,
                  }}
                >
                  {workerSiteName.charAt(0).toUpperCase() || 'M'}
                </div>
              )}
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="font-extrabold text-lg sm:text-xl text-white tracking-wide">
                    {workerSiteName}
                  </h1>
                  <span 
                    id="worker-terminal-role-badge"
                    className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider border"
                    style={{
                      backgroundColor: 'rgba(var(--worker-primary-rgb, 183, 255, 0), 0.15)',
                      borderColor: 'rgba(var(--worker-primary-rgb, 183, 255, 0), 0.35)',
                      color: workerPrimaryColor,
                    }}
                  >
                    {terminalBadge}
                  </span>
                </div>
                <p id="worker-terminal-role-subtitle" className="text-[11px] text-[#A1A1AA] hidden sm:block">
                  {terminalSubtitle}
                </p>
              </div>
            </div>
          </div>

          {/* Shift Status Widget in Header (Desktop / Tablet - Hidden for Cashier) */}
          {!isOnlyCashier && (
            <div className="hidden md:flex items-center space-x-3 bg-[#181818] border border-[#262626] rounded-xl px-3 py-1.5">
              {isShiftActive && activeShift ? (
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <span 
                      className="w-2.5 h-2.5 rounded-full animate-pulse" 
                      style={{ backgroundColor: workerPrimaryColor }}
                    />
                    <div>
                      <div className="text-[11px] text-[#A1A1AA]">Shift Started {formatTime(activeShift.started_at)}</div>
                      <div className="text-xs font-bold text-white">
                        Sales: <span style={{ color: workerPrimaryColor }}>{formatNaira(shiftSummary?.total_sales || 0)}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    id="header-end-shift-btn"
                    onClick={openCloseShiftModal}
                    className="bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 hover:text-red-300 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5 fill-red-400" />
                    <span>End Shift</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span className="text-xs text-amber-300 font-medium">No Active Shift</span>
                  </div>
                  <button
                    id="header-open-shift-btn"
                    onClick={openShiftModal}
                    style={{
                      backgroundColor: workerPrimaryColor,
                      color: textColor,
                    }}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all shadow-md cursor-pointer active:scale-95"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Start Shift</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Worker Info & Actions */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Worker Tag */}
            <div 
              onClick={() => onTabChange('profile')}
              className="flex items-center space-x-2 bg-[#181818] hover:bg-[#202020] border border-[#262626] rounded-xl px-2.5 py-1.5 cursor-pointer transition-colors"
            >
              <div 
                className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs border"
                style={{
                  backgroundColor: 'rgba(var(--worker-primary-rgb, 183, 255, 0), 0.2)',
                  color: workerPrimaryColor,
                  borderColor: 'rgba(var(--worker-primary-rgb, 183, 255, 0), 0.3)',
                }}
              >
                {profile?.full_name?.charAt(0).toUpperCase() || 'W'}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-bold text-white leading-tight">
                  {profile?.full_name || 'Worker'}
                </div>
                <div className="text-[10px] text-[#A1A1AA] leading-tight">
                  {roleLabel}
                </div>
              </div>
            </div>

            {/* Notification Bell with Badge */}
            <button
              id="header-worker-notifications-btn"
              onClick={openModal}
              title="Notices & Broadcasts"
              className="relative p-2 rounded-xl bg-[#181818] hover:bg-[#222222] border border-[#262626] text-[#A1A1AA] hover:text-white transition-colors cursor-pointer"
            >
              <Bell className={`w-4 h-4 ${unreadCount > 0 ? 'text-blue-400' : ''}`} />
              {unreadCount > 0 && (
                <span 
                  id="worker-header-unread-badge"
                  className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-[#111111] animate-pulse"
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Admin Portal Launcher (Admin/Manager only) */}
            {isAdminOrManager && onSwitchToAdmin && (
              <button
                id="header-switch-admin-btn"
                onClick={onSwitchToAdmin}
                className="bg-purple-500 hover:bg-purple-400 text-black text-xs font-bold px-3 py-1.5 rounded-xl flex items-center space-x-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
                title="Launch Admin Portal"
              >
                <Sparkles className="w-3.5 h-3.5 fill-black" />
                <span className="hidden sm:inline">Admin Portal</span>
              </button>
            )}

            {/* Logout Button */}
            <button
              id="header-logout-btn"
              onClick={handleLogout}
              title="Log Out"
              className="p-2 rounded-xl bg-[#181818] hover:bg-red-950/40 border border-[#262626] hover:border-red-800/40 text-[#A1A1AA] hover:text-red-400 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>

        {/* Navigation Tabs Bar */}
        <nav className="flex items-center space-x-1 sm:space-x-2 py-2 overflow-x-auto no-scrollbar border-t border-[#1c1c1c]">
          {/* POS Tab (For Bar Staff, Sales Staff & Admins - Hidden for Cashier) */}
          {!isOnlyCashier && (
            <button
              id="nav-pos-tab"
              onClick={() => onTabChange('pos')}
              style={getActiveTabStyle('pos')}
              className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center space-x-2 transition-all whitespace-nowrap cursor-pointer ${
                !isTabActive('pos') ? 'text-[#A1A1AA] hover:text-white hover:bg-[#181818]' : ''
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>POS Register</span>
            </button>
          )}

          {/* Sales, Receipts & Analysis Tabs (Cashier, Bar Staff, and Admins) */}
          {isAuthorizedStaff && (
            <>
              <button
                id="nav-analysis-tab"
                onClick={() => onTabChange('analysis')}
                style={getActiveTabStyle('analysis')}
                className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center space-x-2 transition-all whitespace-nowrap cursor-pointer ${
                  !isTabActive('analysis') ? 'text-[#A1A1AA] hover:text-white hover:bg-[#181818]' : ''
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Product Analysis</span>
              </button>

              <button
                id="nav-sales-tab"
                onClick={() => onTabChange('sales')}
                style={getActiveTabStyle('sales')}
                className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center space-x-2 transition-all whitespace-nowrap cursor-pointer ${
                  !isTabActive('sales') ? 'text-[#A1A1AA] hover:text-white hover:bg-[#181818]' : ''
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                <span>Sales</span>
              </button>

              <button
                id="nav-receipts-tab"
                onClick={() => onTabChange('receipts')}
                style={getActiveTabStyle('receipts')}
                className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center space-x-2 transition-all whitespace-nowrap cursor-pointer ${
                  !isTabActive('receipts') ? 'text-[#A1A1AA] hover:text-white hover:bg-[#181818]' : ''
                }`}
              >
                <ReceiptText className="w-4 h-4" />
                <span>Receipts</span>
              </button>
            </>
          )}

          {/* Shift Tab (Both Cashier & Bar Staff) */}
          <button
            id="nav-shift-tab"
            onClick={() => onTabChange('my_shift')}
            style={getActiveTabStyle('my_shift')}
            className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center space-x-2 transition-all whitespace-nowrap cursor-pointer ${
              !isTabActive('my_shift') ? 'text-[#A1A1AA] hover:text-white hover:bg-[#181818]' : ''
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Shift</span>
          </button>

          {/* Profile Tab (Both Cashier & Bar Staff) */}
          <button
            id="nav-profile-tab"
            onClick={() => onTabChange('profile')}
            style={getActiveTabStyle('profile')}
            className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center space-x-2 transition-all whitespace-nowrap cursor-pointer ${
              !isTabActive('profile') ? 'text-[#A1A1AA] hover:text-white hover:bg-[#181818]' : ''
            }`}
          >
            <User className="w-4 h-4" />
            <span>Profile</span>
          </button>
        </nav>

      </div>

      {/* Fallback Logout Confirmation Modal if used standalone */}
      <LogoutConfirmationModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={() => {
          setIsLogoutModalOpen(false);
          signOut();
        }}
      />
    </header>
  );
};
