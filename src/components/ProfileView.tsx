import React from 'react';
import { Mail, LogOut, Play } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useShift } from '../context/ShiftContext';
import { formatDateTime, formatNaira } from '../utils/formatters';
import { LogoutConfirmationModal } from './LogoutConfirmationModal';

interface ProfileViewProps {
  onSignOutClick?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ onSignOutClick }) => {
  const { profile, signOut } = useAuth();
  const { isShiftActive, activeShift, shiftSummary, openShiftModal, openCloseShiftModal } = useShift();
  const [isLogoutModalOpen, setIsLogoutModalOpen] = React.useState(false);

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
    cashier: 'Cashier Staff',
    bar_worker: 'Bar Staff',
    sales_worker: 'Sales Staff',
    admin: 'Branch Manager',
    manager: 'Branch Manager',
  };

  const roleTitle = profile?.role ? roleLabelMap[profile.role] || profile.role : 'Worker';

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-6 py-6 space-y-5">
      
      {/* Profile Card */}
      <div className="bg-[#111111] border border-[#262626] rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 to-emerald-400" />

        <div className="flex items-center space-x-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-700 text-black font-black text-2xl flex items-center justify-center shadow-lg shadow-green-950 border border-green-400/40">
            {profile?.full_name?.charAt(0).toUpperCase() || 'W'}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-bold text-white">
                {profile?.full_name || 'Worker'}
              </h2>
              <span className="bg-green-500/15 border border-green-500/30 text-green-400 text-xs font-bold px-2 py-0.5 rounded-full uppercase">
                {roleTitle}
              </span>
            </div>
            <p className="text-xs text-[#A1A1AA] mt-0.5 flex items-center space-x-1.5">
              <Mail className="w-3.5 h-3.5" />
              <span>{profile?.email}</span>
            </p>
          </div>
        </div>

        {/* Active Shift Widget */}
        {isShiftActive && activeShift ? (
          <div className="bg-[#181818] border border-green-500/30 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-white">Current Shift Live</span>
              <span className="text-[11px] text-green-400 font-semibold">Started {formatDateTime(activeShift.started_at)}</span>
            </div>
            <div className="flex justify-between text-xs text-[#A1A1AA]">
              <span>Opening Float: <strong className="text-white">{formatNaira(activeShift.opening_cash)}</strong></span>
              <span>Total Sales: <strong className="text-green-400">{formatNaira(shiftSummary?.total_sales || 0)}</strong></span>
            </div>
          </div>
        ) : (
          <div className="bg-[#181818] border border-[#262626] rounded-xl p-4 mb-6 flex items-center justify-between">
            <div className="text-xs text-[#A1A1AA]">
              Shift is currently closed.
            </div>
            <button
              onClick={openShiftModal}
              className="bg-green-500 hover:bg-green-400 text-black font-bold px-3 py-1.5 rounded-lg text-xs flex items-center space-x-1 cursor-pointer"
            >
              <Play className="w-3 h-3 fill-black" />
              <span>Start Shift</span>
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2 pt-2 border-t border-[#222222]">
          <button
            id="profile-logout-btn"
            onClick={handleLogout}
            className="w-full bg-red-950/40 hover:bg-red-900/60 border border-red-500/40 text-red-300 hover:text-white font-bold py-3 px-4 rounded-xl text-xs sm:text-sm transition-all flex items-center justify-center space-x-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>LOG OUT OF WORKER TERMINAL</span>
          </button>
        </div>

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
    </div>
  );
};
