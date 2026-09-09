import React from 'react';
import { ShieldAlert, Store, LogOut } from 'lucide-react';
import { Profile } from '../../types';

interface AdminUnauthorizedViewProps {
  profile: Profile | null;
  onSwitchToPos: () => void;
  onSignOut: () => void;
}

export const AdminUnauthorizedView: React.FC<AdminUnauthorizedViewProps> = ({
  profile,
  onSwitchToPos,
  onSignOut,
}) => {
  return (
    <div className="min-h-screen bg-[#050505] text-[#FAFAFA] flex items-center justify-center p-4">
      <div className="bg-[#111111] border border-[#222222] rounded-3xl p-8 max-w-md w-full text-center space-y-6 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white tracking-tight">
            Access Restricted
          </h2>
          <p className="text-xs text-[#A1A1AA] leading-relaxed">
            You are not authorized to access the Admin Panel.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-[#161616] border border-[#222222] text-left space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-[#71717A]">Logged in as:</span>
            <span className="font-bold text-white">{profile?.full_name || 'Worker'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#71717A]">Email:</span>
            <span className="font-mono text-[#A1A1AA]">{profile?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#71717A]">Current Role:</span>
            <span className="font-bold text-blue-400 uppercase">{profile?.role}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#71717A]">Required Role:</span>
            <span className="font-bold text-green-400 uppercase">ADMIN / MANAGER</span>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <button
            onClick={onSwitchToPos}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-green-500 hover:bg-green-400 text-black text-xs font-bold transition-all shadow-lg active:scale-95"
          >
            <Store className="w-4 h-4" />
            <span>Launch Worker POS Terminal</span>
          </button>

          <button
            onClick={onSignOut}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#1A1A1A] hover:bg-[#222222] text-[#EF4444] text-xs font-semibold border border-[#262626] transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign In with Different Account</span>
          </button>
        </div>
      </div>
    </div>
  );
};
