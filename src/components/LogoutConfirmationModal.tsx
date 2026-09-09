import React from 'react';
import { LogOut, X } from 'lucide-react';

interface LogoutConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoggingOut?: boolean;
}

export const LogoutConfirmationModal: React.FC<LogoutConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isLoggingOut = false,
}) => {
  if (!isOpen) return null;

  return (
    <div 
      id="logout-confirmation-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in"
    >
      <div 
        id="logout-confirmation-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-dialog-title"
        className="bg-[#111111] border border-[#262626] rounded-2xl max-w-sm w-full p-6 shadow-2xl relative overflow-hidden text-white"
      >
        {/* Subtle accent line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-rose-500 to-red-600" />

        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center shrink-0">
              <LogOut className="w-5 h-5" />
            </div>
            <div>
              <h2 id="logout-dialog-title" className="text-base font-bold text-white tracking-wide">
                Log Out
              </h2>
              <p className="text-xs text-[#A1A1AA]">
                Session confirmation
              </p>
            </div>
          </div>
          <button
            id="modal-close-logout-x-btn"
            type="button"
            onClick={onClose}
            disabled={isLoggingOut}
            className="text-[#71717A] hover:text-white p-1 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-6">
          <p className="text-sm text-[#E4E4E7] leading-relaxed">
            Are you sure you want to log out?
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center space-x-3">
          <button
            id="modal-cancel-logout-btn"
            type="button"
            onClick={onClose}
            disabled={isLoggingOut}
            className="flex-1 bg-[#222222] hover:bg-[#2a2a2a] text-[#D4D4D8] hover:text-white text-xs font-bold py-3 px-4 rounded-xl transition-colors cursor-pointer border border-[#333333] disabled:opacity-50 text-center"
          >
            No / Cancel
          </button>

          <button
            id="modal-confirm-logout-btn"
            type="button"
            onClick={onConfirm}
            disabled={isLoggingOut}
            className="flex-1 bg-red-600 hover:bg-red-500 text-white text-xs font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-red-950/30 cursor-pointer flex items-center justify-center space-x-1.5 disabled:opacity-50 text-center"
          >
            {isLoggingOut ? (
              <span>Logging out...</span>
            ) : (
              <span>Yes / Log Out</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
