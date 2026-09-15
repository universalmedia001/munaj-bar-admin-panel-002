import React, { useState } from 'react';
import {
  AlertTriangle,
  X,
  ShieldCheck,
  CheckSquare,
  Square,
  RefreshCw,
  Info,
} from 'lucide-react';
import { executeBusinessDataReset } from '../../services/businessResetService';

interface ClearBusinessDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ClearBusinessDataModal: React.FC<ClearBusinessDataModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [confirmText, setConfirmText] = useState('');
  const [resetProductStocks, setResetProductStocks] = useState(false);
  const [resetExpenses, setResetExpenses] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const isConfirmed = confirmText.trim().toUpperCase() === 'RESET';

  const handleExecuteReset = async () => {
    if (!isConfirmed || isProcessing) return;

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const result = await executeBusinessDataReset({
        confirmPhrase: 'RESET',
        resetSales: true,
        resetShifts: true,
        resetProductStocks,
        resetExpenses,
      });

      if (result.success) {
        onSuccess();
        onClose();
      } else {
        setErrorMsg(result.message || 'Failed to reset business data.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'An unexpected error occurred during reset.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg bg-zinc-950 border border-red-900/60 rounded-2xl shadow-2xl overflow-hidden text-zinc-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 bg-red-950/40 border-b border-red-900/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">
                Clear / Reset Business Data
              </h3>
              <p className="text-xs text-red-300/80">
                Fresh Operating Period Initialization
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Main Warning Box */}
          <div className="p-4 rounded-xl bg-red-950/30 border border-red-900/50 text-xs space-y-2">
            <p className="font-semibold text-red-200 text-sm">
              Are you sure you want to clear this data?
            </p>
            <p className="text-red-300/90 leading-relaxed">
              Selected sales, product-related figures and history will be reset. This action cannot be undone.
            </p>
          </div>

          {/* Reset Scope Overview */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Figures Returning to ₦0 / Empty:
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
                <span className="text-zinc-400 block">Total Revenue</span>
                <span className="text-emerald-400 font-bold font-mono">→ ₦0.00</span>
              </div>
              <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
                <span className="text-zinc-400 block">Order Count</span>
                <span className="text-emerald-400 font-bold font-mono">→ 0</span>
              </div>
              <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
                <span className="text-zinc-400 block">Sales & Item Logs</span>
                <span className="text-amber-400 font-bold">Cleared</span>
              </div>
              <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
                <span className="text-zinc-400 block">Receipt Print Logs</span>
                <span className="text-amber-400 font-bold">Cleared</span>
              </div>
            </div>
          </div>

          {/* Safety & Integrity Guarantee */}
          <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-800/40 text-xs space-y-1.5">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold">
              <ShieldCheck className="w-4 h-4" />
              <span>Protected Business Architecture:</span>
            </div>
            <ul className="text-emerald-300/80 list-disc list-inside space-y-1 pl-1">
              <li>Workers, staff accounts, and credentials are <strong className="text-emerald-200">NOT deleted</strong>.</li>
              <li>Product catalog & categories remain intact (<strong className="text-emerald-200">no products created or deleted</strong>).</li>
              <li>Business profile and POS branding settings remain intact.</li>
            </ul>
          </div>

          {/* Optional Additional Scope */}
          <div className="space-y-2 pt-1 border-t border-zinc-800/60">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Optional Scope Controls:
            </h4>
            
            <label className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-zinc-900/60 cursor-pointer transition-colors">
              <button
                type="button"
                onClick={() => setResetProductStocks(!resetProductStocks)}
                className="mt-0.5 text-zinc-400 hover:text-white"
              >
                {resetProductStocks ? (
                  <CheckSquare className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Square className="w-4 h-4 text-zinc-500" />
                )}
              </button>
              <div className="text-xs">
                <span className="font-medium text-zinc-200">Reset product stock counts to 0</span>
                <p className="text-zinc-400 text-[11px]">
                  Zeroes out current stock quantities for existing products (does not alter or recreate catalog items).
                </p>
              </div>
            </label>

            <label className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-zinc-900/60 cursor-pointer transition-colors">
              <button
                type="button"
                onClick={() => setResetExpenses(!resetExpenses)}
                className="mt-0.5 text-zinc-400 hover:text-white"
              >
                {resetExpenses ? (
                  <CheckSquare className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Square className="w-4 h-4 text-zinc-500" />
                )}
              </button>
              <div className="text-xs">
                <span className="font-medium text-zinc-200">Clear recorded operating expenses</span>
                <p className="text-zinc-400 text-[11px]">
                  Resets expense logs and P&amp;L history alongside sales figures for the fresh period.
                </p>
              </div>
            </label>
          </div>

          {/* Explicit Confirmation Input */}
          <div className="space-y-2 pt-1 border-t border-zinc-800/60">
            <label className="block text-xs font-semibold text-zinc-300">
              Type <span className="font-mono text-red-400 bg-red-950/60 px-1.5 py-0.5 rounded border border-red-900/60">RESET</span> to confirm:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type RESET here"
              disabled={isProcessing}
              className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-700 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-xl text-sm font-mono tracking-wider placeholder-zinc-500 outline-none transition-all"
            />
          </div>

          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-950/50 border border-red-800 text-red-300 text-xs flex items-center gap-2">
              <Info className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-zinc-900/60 border-t border-zinc-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExecuteReset}
            disabled={!isConfirmed || isProcessing}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all flex items-center gap-2 ${
              isConfirmed && !isProcessing
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/30'
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
            }`}
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Resetting Figures...</span>
              </>
            ) : (
              <span>Confirm &amp; Reset Business Data</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
