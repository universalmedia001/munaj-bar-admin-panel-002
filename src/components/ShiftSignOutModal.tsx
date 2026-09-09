import React from 'react';
import { Clock, Square, X, Wallet, ShieldAlert, ArrowRight } from 'lucide-react';
import { useShift } from '../context/ShiftContext';
import { formatNaira, formatTime } from '../utils/formatters';

interface ShiftSignOutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoToShift: () => void;
  onProceedToCloseShift?: () => void;
}

export const ShiftSignOutModal: React.FC<ShiftSignOutModalProps> = ({
  isOpen,
  onClose,
  onGoToShift,
  onProceedToCloseShift,
}) => {
  const { activeShift, shiftSummary } = useShift();

  if (!isOpen) return null;

  const openingCash = shiftSummary?.opening_cash ?? Number(activeShift?.opening_cash ?? 0);
  const totalSales = shiftSummary?.total_sales ?? 0;
  const startedAt = activeShift?.started_at ? formatTime(activeShift.started_at) : 'Active';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#111111] border border-amber-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden text-white">
        
        {/* Amber Accent Top Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400" />

        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white tracking-wide">
                Shift Still Active
              </h2>
              <p className="text-xs text-amber-400 font-medium">
                Active shift in progress
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#71717A] hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-1 mb-4">
          <p className="text-sm font-semibold text-white">
            Shift Still Active
          </p>
          <p className="text-xs text-[#D4D4D8] leading-relaxed font-medium">
            You must end your current shift before you can sign out.
          </p>
        </div>

        {/* Shift Snapshot Card */}
        <div className="bg-[#181818] border border-[#262626] rounded-xl p-3.5 mb-5 space-y-2 text-xs">
          <div className="flex justify-between items-center text-[#A1A1AA]">
            <span className="flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Shift Started</span>
            </span>
            <span className="text-white font-bold">{startedAt}</span>
          </div>

          <div className="flex justify-between items-center text-[#A1A1AA]">
            <span className="flex items-center space-x-1.5">
              <Wallet className="w-3.5 h-3.5 text-green-400" />
              <span>Opening Float</span>
            </span>
            <span className="text-white font-bold">{formatNaira(openingCash)}</span>
          </div>

          <div className="flex justify-between items-center text-[#A1A1AA] pt-1.5 border-t border-[#222222]">
            <span>Current Total Sales</span>
            <span className="text-emerald-400 font-extrabold">{formatNaira(totalSales)}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3">
          <button
            id="modal-cancel-logout-btn"
            type="button"
            onClick={onClose}
            className="px-4 bg-[#222222] hover:bg-[#2a2a2a] text-[#A1A1AA] hover:text-white text-xs font-bold py-3 rounded-xl transition-colors cursor-pointer"
          >
            CANCEL
          </button>

          <button
            id="modal-go-to-shift-btn"
            type="button"
            onClick={onGoToShift}
            className="flex-1 bg-[#B7FF00] hover:bg-[#a6e600] text-black text-xs font-black py-3 px-4 rounded-xl flex items-center justify-center space-x-1.5 transition-all shadow-lg shadow-lime-950/30 cursor-pointer"
          >
            <span>GO TO SHIFT</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          {onProceedToCloseShift && (
            <button
              id="modal-end-shift-and-logout-btn"
              type="button"
              onClick={onProceedToCloseShift}
              className="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 text-xs font-bold py-3 px-3 rounded-xl flex items-center justify-center space-x-1 transition-all cursor-pointer"
              title="Close Shift Now"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span className="hidden sm:inline">END NOW</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

