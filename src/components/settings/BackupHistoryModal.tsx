import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Database,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  History,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import {
  listBackups,
  restoreBackup,
  type BackupRecord,
} from '../../services/backupRestoreService';

interface BackupHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestored: () => void;
}

const BACKUP_TYPE_LABELS: Record<string, string> = {
  MANUAL: 'Manual',
  BEFORE_RESET: 'Before Reset',
  PRE_RESTORE: 'Pre-Restore',
};

const BACKUP_TYPE_COLORS: Record<string, string> = {
  MANUAL: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  BEFORE_RESET: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  PRE_RESTORE: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
};

export const BackupHistoryModal: React.FC<BackupHistoryModalProps> = ({
  isOpen,
  onClose,
  onRestored,
}) => {
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [selectedBackupId, setSelectedBackupId] = useState<string | null>(null);
  const [confirmingRestore, setConfirmingRestore] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchBackups = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    const result = await listBackups();
    if (result.success) {
      setBackups(result.backups);
    } else {
      setErrorMsg(result.error || 'Failed to load backups.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchBackups();
      setSelectedBackupId(null);
      setConfirmingRestore(false);
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen, fetchBackups]);

  if (!isOpen) return null;

  const handleRestore = async () => {
    if (!selectedBackupId || restoring) return;

    setRestoring(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const result = await restoreBackup(selectedBackupId);

    if (result.success) {
      setSuccessMsg(
        result.partial
          ? `${result.message || 'Restore completed with warnings.'} A PRE_RESTORE backup was created for safety.`
          : `${result.message || 'Business data restored successfully.'} A PRE_RESTORE backup was created for safety.`
      );
      setConfirmingRestore(false);
      setSelectedBackupId(null);
      onRestored();
      // Refresh the list to show the new PRE_RESTORE backup
      setTimeout(() => fetchBackups(), 1000);
    } else {
      setErrorMsg(result.error || 'Failed to restore backup.');
    }

    setRestoring(false);
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const formatCounts = (counts: Record<string, number>) => {
    const labels: Record<string, string> = {
      categories: 'Categories',
      products: 'Products',
      shifts: 'Shifts',
      sales: 'Sales',
      sale_items: 'Sale Items',
      receipt_prints: 'Receipt Prints',
      stock_movements: 'Stock Movements',
      expenses: 'Expenses',
    };
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${labels[k] || k}: ${v.toLocaleString()}`)
      .join(' • ');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-2xl bg-zinc-950 border border-zinc-700/60 rounded-2xl shadow-2xl overflow-hidden text-zinc-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 bg-zinc-900/60 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">
                Backup History & Restore
              </h3>
              <p className="text-xs text-zinc-400">
                Select a backup to restore business data
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={restoring}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {successMsg && (
            <div className="p-3 rounded-lg bg-emerald-950/50 border border-emerald-800 text-emerald-300 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-950/50 border border-red-800 text-red-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12 text-zinc-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span className="text-sm">Loading backups...</span>
            </div>
          ) : backups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500 space-y-3">
              <Database className="w-10 h-10 text-zinc-600" />
              <p className="text-sm font-medium">No backups available.</p>
              <p className="text-xs text-zinc-500">
                Create a backup first using the "Backup Business Data" button.
              </p>
            </div>
          ) : (
            <>
              {/* Pre-restore safety notice */}
              <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-800/40 text-xs space-y-1.5">
                <div className="flex items-center gap-2 text-purple-400 font-semibold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Automatic Safety Backup</span>
                </div>
                <p className="text-purple-300/80">
                  A PRE_RESTORE backup of your current data will be created automatically before any restore begins.
                </p>
              </div>

              {/* Backup list */}
              <div className="space-y-2">
                {backups.map((backup) => {
                  const isSelected = selectedBackupId === backup.id;
                  return (
                    <div
                      key={backup.id}
                      onClick={() => {
                        setSelectedBackupId(isSelected ? null : backup.id);
                        setConfirmingRestore(false);
                        setErrorMsg(null);
                      }}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-blue-950/30 border-blue-500/50 ring-1 ring-blue-500/30'
                          : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                              <Clock className="w-3.5 h-3.5" />
                              {formatDate(backup.created_at)}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${BACKUP_TYPE_COLORS[backup.backup_type] || 'text-zinc-400 bg-zinc-800 border-zinc-700'}`}>
                              {BACKUP_TYPE_LABELS[backup.backup_type] || backup.backup_type}
                            </span>
                          </div>
                          {Object.keys(backup.record_counts || {}).length > 0 && (
                            <p className="text-xs text-zinc-300 font-medium">
                              {formatCounts(backup.record_counts)}
                            </p>
                          )}
                        </div>
                        {isSelected && (
                          <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Restore confirmation */}
              {selectedBackupId && (
                <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-800/40 space-y-3">
                  <div className="flex items-start gap-2 text-xs">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-amber-300/90">
                      Restoring will <strong>replace</strong> all current business data (sales, shifts, products, stock, expenses) with the selected backup's data. This cannot be undone — but a PRE_RESTORE backup will be created automatically.
                    </p>
                  </div>
                  {!confirmingRestore ? (
                    <button
                      type="button"
                      onClick={() => setConfirmingRestore(true)}
                      className="w-full px-4 py-2.5 bg-amber-600/90 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Proceed to Restore</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmingRestore(false)}
                        disabled={restoring}
                        className="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-xl transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleRestore}
                        disabled={restoring}
                        className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                      >
                        {restoring ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Restoring...</span>
                          </>
                        ) : (
                          <>
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Confirm Restore</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-zinc-900/60 border-t border-zinc-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={restoring}
            className="px-4 py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
