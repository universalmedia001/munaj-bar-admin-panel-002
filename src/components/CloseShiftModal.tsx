import React, { useState, useEffect } from 'react';
import { Square, X, AlertTriangle, AlertCircle, CheckCircle2, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { useShift } from '../context/ShiftContext';
import { formatNaira, formatDateTime, formatTime } from '../utils/formatters';

interface CloseShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CloseShiftModal: React.FC<CloseShiftModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { activeShift, shiftSummary, endShift, isLoading, error, refreshShift } = useShift();
  const [actualCash, setActualCash] = useState<string>('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [confirmStep, setConfirmStep] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      refreshShift();
      setActualCash('');
      setConfirmStep(false);
      setLocalError(null);
      setIsSuccess(false);
    }
  }, [isOpen, refreshShift]);

  if (!isOpen || !activeShift) return null;

  const openingCash = shiftSummary?.opening_cash ?? Number(activeShift.opening_cash ?? 0);
  const cashSales = shiftSummary?.cash_sales ?? 0;
  const posSales = shiftSummary?.pos_sales ?? 0;
  const transferSales = shiftSummary?.transfer_sales ?? 0;
  const totalSales = shiftSummary?.total_sales ?? 0;
  const expectedCash = openingCash + cashSales;

  const actualCashNum = parseFloat(actualCash.replace(/[^0-9.]/g, '')) || 0;
  const cashDifference = actualCashNum - expectedCash;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!confirmStep) {
      setConfirmStep(true);
      return;
    }

    try {
      await endShift(actualCashNum);
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        if (onSuccess) {
          onSuccess();
        } else {
          onClose();
        }
      }, 1200);
    } catch (err: any) {
      setLocalError('Unable to end your shift. Please try again.');
      setConfirmStep(false);
    }
  };

  const displayError = localError || error;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#111111] border border-[#262626] rounded-2xl max-w-lg w-full p-6 shadow-2xl relative overflow-hidden max-h-[90vh] overflow-y-auto">
        
        {/* Top Accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-orange-500 to-red-500" />

        {isSuccess ? (
          <div className="py-10 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-green-500/20 border border-green-500/40 text-green-400 flex items-center justify-center mx-auto animate-bounce">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-base font-extrabold text-green-400 tracking-wide uppercase">
              SHIFT CLOSED SUCCESSFULLY
            </h3>
            <p className="text-xs text-[#A1A1AA]">
              Physical cash reconciled. Finalizing shift records...
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center">
                  <Square className="w-4 h-4 fill-red-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white tracking-wide">
                    SHIFT SUMMARY & CLOSING
                  </h2>
                  <p className="text-xs text-[#A1A1AA]">
                    Started at {formatTime(activeShift.started_at)}
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

            {/* Shift Breakdown Grid */}
            <div className="bg-[#181818] border border-[#262626] rounded-xl p-4 mb-5 space-y-2.5">
              <div className="flex justify-between items-center text-xs pb-2 border-b border-[#222222]">
                <span className="text-[#A1A1AA]">Opening Cash Float</span>
                <span className="text-white font-bold">{formatNaira(openingCash)}</span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-[#A1A1AA]">Cash Sales</span>
                <span className="text-green-400 font-bold">{formatNaira(cashSales)}</span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-[#A1A1AA]">POS (Terminal) Sales</span>
                <span className="text-cyan-400 font-bold">{formatNaira(posSales)}</span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-[#A1A1AA]">Bank Transfer Sales</span>
                <span className="text-amber-400 font-bold">{formatNaira(transferSales)}</span>
              </div>

              <div className="flex justify-between items-center text-sm pt-2 border-t border-[#222222]">
                <span className="text-[#A1A1AA] font-semibold">Total Shift Sales</span>
                <span className="text-white font-extrabold">{formatNaira(totalSales)}</span>
              </div>

              {/* Expected Cash Box */}
              <div className="mt-3 p-3 bg-[#111111] border border-green-500/30 rounded-lg flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-[#A1A1AA] uppercase tracking-wider font-semibold">
                    Expected Physical Cash
                  </div>
                  <div className="text-[10px] text-[#71717A]">
                    (Opening Cash + Cash Sales)
                  </div>
                </div>
                <div className="text-base sm:text-lg font-black text-green-400">
                  {formatNaira(expectedCash)}
                </div>
              </div>
            </div>

            {/* Form to enter actual cash */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-white uppercase tracking-wider mb-2">
                  ENTER ACTUAL CASH COUNT (₦)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-green-400 font-extrabold text-base">
                    ₦
                  </span>
                  <input
                    id="actual-cash-input"
                    type="number"
                    min="0"
                    step="100"
                    required
                    value={actualCash}
                    onChange={(e) => setActualCash(e.target.value)}
                    placeholder={expectedCash.toString()}
                    className="w-full bg-[#181818] border border-[#2e2e2e] focus:border-green-500 focus:ring-1 focus:ring-green-500 text-white rounded-xl pl-10 pr-4 py-3 text-lg font-bold outline-none"
                  />
                </div>
              </div>

              {/* Cash Difference Indicator */}
              {actualCash !== '' && (
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs sm:text-sm font-bold ${
                    cashDifference === 0
                      ? 'bg-green-950/30 border-green-500/40 text-green-400'
                      : cashDifference > 0
                      ? 'bg-blue-950/30 border-blue-500/40 text-blue-400'
                      : 'bg-red-950/30 border-red-500/40 text-red-400'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    {cashDifference === 0 ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : cashDifference > 0 ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                    <span>
                      {cashDifference === 0
                        ? 'Exact Match (No Difference)'
                        : cashDifference > 0
                        ? 'Cash Surplus (+)'
                        : 'Cash Shortage (-)'}
                    </span>
                  </div>
                  <span className="text-base font-black">
                    {cashDifference > 0 ? `+${formatNaira(cashDifference)}` : formatNaira(cashDifference)}
                  </span>
                </div>
              )}

              {/* Confirmation Warning Step */}
              {confirmStep && (
                <div className="p-3.5 bg-red-950/50 border border-red-500/50 rounded-xl text-xs text-red-300 flex items-start space-x-2.5 animate-pulse">
                  <AlertTriangle className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
                  <div>
                    <strong className="block font-bold text-red-200 mb-0.5">
                      Are you sure you want to close this shift?
                    </strong>
                    Once closed, this shift cannot be reopened and all sales totals will be finalized.
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (confirmStep) setConfirmStep(false);
                    else onClose();
                  }}
                  className="flex-1 bg-[#181818] hover:bg-[#222222] border border-[#2a2a2a] text-[#A1A1AA] font-bold py-3 px-4 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  {confirmStep ? 'BACK' : 'CANCEL'}
                </button>

                <button
                  id="confirm-close-shift-btn"
                  type="submit"
                  disabled={isLoading || actualCash === ''}
                  className="flex-1 bg-red-500 hover:bg-red-400 disabled:bg-red-900 disabled:text-red-300 text-white font-extrabold py-3 px-4 rounded-xl text-xs transition-all shadow-lg shadow-red-900/30 flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  {isLoading ? (
                    <span>CLOSING SHIFT...</span>
                  ) : confirmStep ? (
                    <span>YES, CLOSE SHIFT NOW</span>
                  ) : (
                    <>
                      <Square className="w-3.5 h-3.5 fill-white" />
                      <span>REVIEW & CLOSE SHIFT</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </>
        )}

      </div>
    </div>
  );
};
