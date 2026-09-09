import React, { useState, useEffect } from 'react';
import { Play, DollarSign, X, AlertCircle, ShieldCheck, Lock } from 'lucide-react';
import { useShift } from '../context/ShiftContext';
import { shiftService } from '../services/shiftService';
import { formatNaira } from '../utils/formatters';

interface OpenShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OpenShiftModal: React.FC<OpenShiftModalProps> = ({ isOpen, onClose }) => {
  const { startShift, isLoading, error, clearError } = useShift();
  const [openingCashFloat, setOpeningCashFloat] = useState<number>(50000);
  const [isFetchingFloat, setIsFetchingFloat] = useState<boolean>(true);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      clearError();
      setLocalError(null);
      setIsFetchingFloat(true);
      shiftService.getDefaultOpeningCashFloat()
        .then((val) => {
          setOpeningCashFloat(val);
          setIsFetchingFloat(false);
        })
        .catch(() => {
          setOpeningCashFloat(50000);
          setIsFetchingFloat(false);
        });
    }
  }, [isOpen, clearError]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    try {
      await startShift(openingCashFloat);
      onClose();
    } catch (err: any) {
      setLocalError(err.message || 'Failed to start shift.');
    }
  };

  const displayError = localError || error;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#111111] border border-[#262626] rounded-2xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden">
        
        {/* Accent Top Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 to-emerald-400" />

        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-green-500/15 border border-green-500/30 text-green-400 flex items-center justify-center">
              <Play className="w-4 h-4 fill-green-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide">
                START SHIFT
              </h2>
              <p className="text-xs text-[#A1A1AA]">
                Register opening cash drawer float
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

        {displayError && (
          <div className="mb-4 p-3 bg-red-950/40 border border-red-500/40 rounded-xl flex items-center space-x-2 text-red-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{displayError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* Admin-Controlled Opening Cash Float Display */}
          <div className="bg-[#181818] border border-[#2A2A2A] rounded-xl p-4.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#A1A1AA] uppercase tracking-wider">
                Opening Cash Float
              </span>
              <span className="inline-flex items-center space-x-1 bg-green-500/15 border border-green-500/30 text-green-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                <ShieldCheck className="w-3 h-3" />
                <span>Set by Administrator</span>
              </span>
            </div>

            <div className="text-2xl sm:text-3xl font-black text-white tracking-tight pt-1">
              {isFetchingFloat ? (
                <span className="text-[#71717A] text-lg animate-pulse">Loading float...</span>
              ) : (
                <span className="text-green-400">{formatNaira(openingCashFloat)}</span>
              )}
            </div>

            <p className="text-xs text-[#8E8E93] pt-1 leading-relaxed">
              This amount was set by your administrator.
            </p>
          </div>

          {/* Submit Actions */}
          <div className="flex items-center space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-[#181818] hover:bg-[#222222] border border-[#2a2a2a] text-[#A1A1AA] hover:text-white font-bold py-3 px-4 rounded-xl text-xs transition-colors cursor-pointer"
            >
              CANCEL
            </button>
            <button
              id="start-shift-submit-btn"
              type="submit"
              disabled={isLoading || isFetchingFloat}
              className="flex-1 bg-green-500 hover:bg-green-400 disabled:bg-green-700 text-black font-extrabold py-3 px-4 rounded-xl text-xs transition-all shadow-lg shadow-green-900/30 flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              {isLoading ? (
                <span>STARTING SHIFT...</span>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-black" />
                  <span>START SHIFT</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};

