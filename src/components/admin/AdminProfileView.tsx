import React from 'react';
import { 
  UserCheck, 
  ShieldCheck, 
  Mail, 
  Calendar, 
  Key, 
  LogOut, 
  Store,
  Database
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { formatReceiptDate } from '../../utils/formatters';

interface AdminProfileViewProps {
  onSwitchToPos: () => void;
  onOpenConfig: () => void;
  onSignOut?: () => void;
}

export const AdminProfileView: React.FC<AdminProfileViewProps> = ({
  onSwitchToPos,
  onOpenConfig,
  onSignOut,
}) => {
  const { profile, signOut } = useAuth();

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-2xl mx-auto">
      {/* Profile Card */}
      <div className="bg-[#111111] border border-[#222222] rounded-3xl p-6 lg:p-8 space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-green-500 to-emerald-400 flex items-center justify-center font-bold text-2xl text-black shadow-lg">
            {profile?.full_name?.charAt(0).toUpperCase() || 'A'}
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">{profile?.full_name || 'Administrator'}</h2>
            <p className="text-xs text-[#A1A1AA] font-mono mt-0.5">{profile?.email}</p>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 text-[10px] font-bold uppercase mt-2">
              <ShieldCheck className="w-3 h-3" />
              <span>{profile?.role || 'admin'}</span>
            </div>
          </div>
        </div>

        <div className="space-y-3 border-t border-[#222222] pt-5 text-xs">
          <div className="flex justify-between p-3 rounded-xl bg-[#161616]">
            <span className="text-[#71717A] flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#A1A1AA]" />
              Account Email:
            </span>
            <span className="font-semibold text-white font-mono">{profile?.email}</span>
          </div>

          <div className="flex justify-between p-3 rounded-xl bg-[#161616]">
            <span className="text-[#71717A] flex items-center gap-2">
              <Key className="w-4 h-4 text-[#A1A1AA]" />
              Unique Profile UUID:
            </span>
            <span className="font-mono text-[#A1A1AA] text-[11px]">{profile?.id}</span>
          </div>

          <div className="flex justify-between p-3 rounded-xl bg-[#161616]">
            <span className="text-[#71717A] flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#A1A1AA]" />
              Profile Created:
            </span>
            <span className="text-white font-medium">{profile?.created_at ? formatReceiptDate(profile.created_at) : 'N/A'}</span>
          </div>
        </div>

        <div className="space-y-3 pt-3 border-t border-[#222222]">
          <button
            onClick={onSwitchToPos}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-green-500 hover:bg-green-400 text-black text-xs font-bold transition-all shadow-sm active:scale-95"
          >
            <Store className="w-4 h-4" />
            <span>Launch Worker POS Terminal</span>
          </button>

          <button
            onClick={onOpenConfig}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#1A1A1A] hover:bg-[#222222] text-white text-xs font-semibold border border-[#262626] transition-colors"
          >
            <Database className="w-4 h-4 text-blue-400" />
            <span>Supabase Connection & Diagnostics</span>
          </button>

          <button
            onClick={() => {
              if (onSignOut) {
                onSignOut();
              } else {
                signOut();
              }
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold border border-red-500/20 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out of Account</span>
          </button>
        </div>
      </div>
    </div>
  );
};
