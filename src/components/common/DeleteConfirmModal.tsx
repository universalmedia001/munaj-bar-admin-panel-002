import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Trash2,
  X,
  AlertCircle,
  ShieldAlert,
  Loader2,
  FileText,
  Lock,
} from 'lucide-react';

export interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => Promise<void> | void;
  title: string;
  subtitle?: string;
  description: React.ReactNode;
  itemName?: string;
  itemType?: string;
  itemDetails?: { label: string; value: React.ReactNode }[];
  warningNotice?: string;
  confirmLabel?: string;
  confirmVariant?: 'danger' | 'warning' | 'primary';
  requiresConfirmationText?: boolean;
  confirmationKeyword?: string;
  reasonPrompt?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  reasonRequired?: boolean;
  loading?: boolean;
  error?: string | null;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  subtitle,
  description,
  itemName,
  itemType,
  itemDetails,
  warningNotice,
  confirmLabel = 'Delete',
  confirmVariant = 'danger',
  requiresConfirmationText = false,
  confirmationKeyword = 'DELETE',
  reasonPrompt = false,
  reasonLabel = 'Reason for this action',
  reasonPlaceholder = 'Please state why this action is being taken...',
  reasonRequired = false,
  loading = false,
  error = null,
}) => {
  const [typedKeyword, setTypedKeyword] = useState('');
  const [reason, setReason] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTypedKeyword('');
      setReason('');
      setLocalError(null);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const isKeywordValid = !requiresConfirmationText || typedKeyword.trim().toUpperCase() === confirmationKeyword.toUpperCase();
  const isReasonValid = !reasonPrompt || !reasonRequired || reason.trim().length > 0;
  const canSubmit = isKeywordValid && isReasonValid && !loading;

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    try {
      setLocalError(null);
      await onConfirm(reason.trim());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred during deletion.';
      setLocalError(msg);
    }
  };

  const getVariantStyles = () => {
    switch (confirmVariant) {
      case 'warning':
        return {
          btnBg: 'bg-amber-500 hover:bg-amber-600 text-black',
          iconBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
          badgeBg: 'border-amber-500/30 text-amber-400',
        };
      case 'primary':
        return {
          btnBg: 'bg-[#22C55E] hover:bg-[#1ea750] text-black',
          iconBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          badgeBg: 'border-emerald-500/30 text-emerald-400',
        };
      case 'danger':
      default:
        return {
          btnBg: 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-950/50',
          iconBg: 'bg-red-500/10 text-red-400 border-red-500/20',
          badgeBg: 'border-red-500/30 text-red-400',
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={!loading ? onClose : undefined} aria-hidden="true" />
      <div className="relative w-full max-w-lg bg-[#111111] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden z-10 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-[#141414]">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${styles.iconBg}`}>
              {confirmVariant === 'danger' ? (
                <Trash2 className="w-5 h-5" />
              ) : confirmVariant === 'warning' ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <ShieldAlert className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
              {subtitle && <p className="text-xs text-zinc-400 mt-0.5">{subtitle}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* Main Description */}
          <div className="text-xs text-zinc-300 leading-relaxed">{description}</div>

          {/* Item details summary if provided */}
          {itemName && (
            <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                  {itemType || 'Target Record'}
                </span>
                <span className="text-xs font-bold text-white">{itemName}</span>
              </div>
              {itemDetails && itemDetails.length > 0 && (
                <div className="pt-2 mt-2 border-t border-zinc-800/80 grid grid-cols-2 gap-2 text-xs">
                  {itemDetails.map((detail, idx) => (
                    <div key={idx}>
                      <span className="text-zinc-500 block text-[10px] uppercase">{detail.label}</span>
                      <span className="text-zinc-300 font-medium">{detail.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Warning Notice Banner */}
          {warningNotice && (
            <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-200 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed font-medium">{warningNotice}</div>
            </div>
          )}

          {/* Error Message */}
          {(error || localError) && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-800/80 text-red-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed font-medium">{error || localError}</div>
            </div>
          )}

          {/* Reason input prompt */}
          {reasonPrompt && (
            <div className="space-y-1.5 pt-1">
              <label className="block text-xs font-semibold text-zinc-300">
                {reasonLabel} {reasonRequired && <span className="text-red-400">*</span>}
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={reasonPlaceholder}
                rows={2}
                disabled={loading}
                className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-red-500 text-white text-xs outline-none placeholder:text-zinc-500 resize-none"
              />
            </div>
          )}

          {/* Confirmation Keyword input */}
          {requiresConfirmationText && (
            <div className="space-y-2 pt-2 border-t border-zinc-800/80">
              <label className="block text-xs font-semibold text-zinc-300">
                Type <span className="font-mono text-red-400 font-bold bg-red-950/60 px-1.5 py-0.5 rounded border border-red-800/50">{confirmationKeyword}</span> to confirm this action:
              </label>
              <input
                type="text"
                value={typedKeyword}
                onChange={(e) => setTypedKeyword(e.target.value)}
                placeholder={`Type "${confirmationKeyword}"`}
                disabled={loading}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-red-500 text-white text-xs outline-none font-mono tracking-wider uppercase placeholder:normal-case placeholder:font-sans"
              />
            </div>
          )}
        </div>

        {/* Modal Actions Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-zinc-800/80 bg-[#141414]">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-800/80 hover:bg-zinc-800 rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canSubmit}
            className={`px-5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${styles.btnBg}`}
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{loading ? 'Processing...' : confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
