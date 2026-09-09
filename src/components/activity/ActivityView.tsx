import React, { useState, useMemo } from 'react';
import {
  Activity as ActivityIcon,
  Search,
  Filter,
  User,
  Clock,
  TrendingUp,
  Boxes,
  Bell,
  Settings,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Trash2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import type { ActivityLog } from '../../types';
import { formatDateTime, formatRelativeTime } from '../../utils/formatters';
import { Badge } from '../common/Badge';
import { EmptyState } from '../common/EmptyState';
import { DeleteConfirmModal } from '../common/DeleteConfirmModal';
import { deleteActivityLog } from '../../services/deleteManagementService';
import { useAuth } from '../../context/AuthContext';

interface ActivityViewProps {
  activityLogs: ActivityLog[];
  onRefresh?: () => void;
  loading: boolean;
}

export const ActivityView: React.FC<ActivityViewProps> = ({
  activityLogs,
  onRefresh,
  loading,
}) => {
  const { user, profile } = useAuth();
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Local state for deleted records
  const [hiddenLogIds, setHiddenLogIds] = useState<Set<string>>(new Set());
  const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);

  // Delete Audit Log Modal State
  const [logToDelete, setLogToDelete] = useState<ActivityLog | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeletingLog, setIsDeletingLog] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 5000);
  };

  const isAdminOrManager = profile?.role === 'admin' || profile?.role === 'manager';

  const promptDeleteLog = (log: ActivityLog) => {
    if (!isAdminOrManager) {
      showToast('Access denied: Only admins and managers can remove audit records.', 'error');
      return;
    }
    setLogToDelete(log);
    setDeleteError(null);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDeleteLog = async () => {
    if (!logToDelete || !user || !profile) return;
    try {
      setIsDeletingLog(true);
      setDeleteError(null);

      const result = await deleteActivityLog(
        logToDelete.id,
        {
          action: logToDelete.action,
          description: logToDelete.description,
          created_at: logToDelete.created_at,
          metadata: logToDelete.metadata,
        },
        {
          id: user.id,
          fullName: profile.full_name,
          role: profile.role,
        }
      );

      if (!result.success) {
        setDeleteError(result.message);
        showToast(result.message, 'error');
        return;
      }

      setHiddenLogIds((prev) => new Set(prev).add(logToDelete.id));
      setIsDeleteModalOpen(false);
      setLogToDelete(null);
      showToast('Audit record deleted successfully.', 'success');
      if (onRefresh) onRefresh();
    } catch (err: unknown) {
      const msg = 'Failed to delete activity log. Please try again.';
      setDeleteError(msg);
      showToast(msg, 'error');
    } finally {
      setIsDeletingLog(false);
    }
  };

  const handleConfirmBulkDeleteLogs = async () => {
    if (!profile || selectedLogIds.length === 0) return;
    const selectedLogs = paginatedLogs.filter((log) => selectedLogIds.includes(log.id));
    try {
      setIsBulkDeleting(true);
      setBulkDeleteError(null);
      for (const log of selectedLogs) {
        const result = await deleteActivityLog(
          log.id,
          {
            action: log.action,
            description: log.description,
            created_at: log.created_at,
            metadata: log.metadata,
          },
          { id: profile.id, fullName: profile.full_name, role: profile.role }
        );
        if (!result.success) {
          setBulkDeleteError('Failed to delete selected activity logs. Please try again.');
          return;
        }
      }
      setHiddenLogIds((prev) => new Set([...prev, ...selectedLogIds]));
      setSelectedLogIds([]);
      setIsBulkDeleteModalOpen(false);
      if (onRefresh) onRefresh();
    } catch {
      setBulkDeleteError('Failed to delete selected activity logs. Please try again.');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const filteredLogs = useMemo(() => {
    return activityLogs.filter((log) => {
      if (hiddenLogIds.has(log.id)) return false;
      if (entityFilter !== 'all' && log.entity_type !== entityFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          log.action.toLowerCase().includes(q) ||
          log.description.toLowerCase().includes(q) ||
          log.entity_type.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [activityLogs, entityFilter, search, hiddenLogIds]);

  const totalPages = Math.ceil(filteredLogs.length / pageSize) || 1;
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const getActionBadge = (action: string) => {
    if (action.includes('sale')) return <Badge variant="green">{action.replace('_', ' ').toUpperCase()}</Badge>;
    if (action.includes('shift')) return <Badge variant="blue">{action.replace('_', ' ').toUpperCase()}</Badge>;
    if (action.includes('stock')) return <Badge variant="orange">{action.replace('_', ' ').toUpperCase()}</Badge>;
    if (action.includes('notification')) return <Badge variant="purple">{action.replace('_', ' ').toUpperCase()}</Badge>;
    if (action.includes('deleted')) return <Badge variant="red">{action.replace('_', ' ').toUpperCase()}</Badge>;
    return <Badge variant="zinc">{action.replace('_', ' ').toUpperCase()}</Badge>;
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="bg-[#111111] p-5 rounded-2xl border border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-white tracking-tight">
            System Audit Trail & Activity Logs
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Complete immutable ledger of operational events, sales completions, shift open/closures, and inventory adjustments.
          </p>
        </div>

        <Badge variant="zinc" size="md">
          {filteredLogs.length} Total Audit Records
        </Badge>
      </div>

      {/* Filter Controls */}
      <div className="bg-[#111111] p-4 rounded-2xl border border-zinc-800/80 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search activity description, staff action, or entity..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-[#22C55E] text-white text-xs placeholder:text-zinc-500 outline-none"
          />
        </div>

        <select
          value={entityFilter}
          onChange={(e) => {
            setEntityFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white outline-none focus:border-[#22C55E]"
        >
          <option value="all">All Entities</option>
          <option value="sales">Sales Events</option>
          <option value="shifts">Shift Events</option>
          <option value="products">Product & Stock Events</option>
          <option value="notifications">Staff Notifications</option>
          <option value="profiles">Worker Accounts</option>
          <option value="audit_log">Audit Trail Changes</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-xs font-semibold text-zinc-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={paginatedLogs.length > 0 && paginatedLogs.every((log) => selectedLogIds.includes(log.id))}
            onChange={(e) => {
              if (e.target.checked) {
                setSelectedLogIds((prev) => Array.from(new Set([...prev, ...paginatedLogs.map((log) => log.id)])));
              } else {
                const ids = new Set(paginatedLogs.map((log) => log.id));
                setSelectedLogIds((prev) => prev.filter((id) => !ids.has(id)));
              }
            }}
            className="accent-[#22C55E] cursor-pointer"
          />
          <span>Select All</span>
        </label>

        {selectedLogIds.length > 0 && (
          <div className="flex items-center gap-2">
            <button onClick={() => setSelectedLogIds([])} className="px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-800 rounded-xl">Deselect All</button>
            <button onClick={() => { setBulkDeleteError(null); setIsBulkDeleteModalOpen(true); }} className="px-3.5 py-1.5 text-xs font-bold text-red-200 bg-red-950/80 border border-red-800/80 rounded-xl flex items-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Selected ({selectedLogIds.length})</span>
            </button>
          </div>
        )}
      </div>

      {/* Timeline List */}
      <div className="bg-[#111111] rounded-2xl border border-zinc-800/80 divide-y divide-zinc-800/60 overflow-hidden">
        {paginatedLogs.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={ActivityIcon}
              title="No activity recorded"
              description="System operations and audit logs will automatically be tracked here."
            />
          </div>
        ) : (
          paginatedLogs.map((log) => (
            <div key={log.id} className="p-4.5 hover:bg-zinc-900/40 transition-colors flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5 min-w-0 flex-1">
                <input
                  type="checkbox"
                  checked={selectedLogIds.includes(log.id)}
                  onChange={() => setSelectedLogIds((prev) => prev.includes(log.id) ? prev.filter((id) => id !== log.id) : [...prev, log.id])}
                  className="mt-2 accent-[#22C55E] cursor-pointer"
                  aria-label={`Select activity log ${log.id}`}
                />
                <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 mt-0.5 text-zinc-400">
                  <ActivityIcon className="w-4 h-4 text-[#22C55E]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getActionBadge(log.action)}
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {formatDateTime(log.created_at)} ({formatRelativeTime(log.created_at)})
                    </span>
                  </div>
                  <p className="text-xs font-medium text-zinc-200 mt-1.5 leading-relaxed">
                    {log.description}
                  </p>
                  {log.metadata && Object.keys(log.metadata as object).length > 0 && (
                    <div className="mt-2 p-2 rounded-lg bg-[#181818] border border-zinc-800/60 font-mono text-[10px] text-zinc-400 overflow-x-auto">
                      {JSON.stringify(log.metadata)}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Button: Delete Audit Entry (Admin / Manager Only) */}
              {isAdminOrManager && (
                <button
                  onClick={() => promptDeleteLog(log)}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-950/40 border border-transparent hover:border-red-900/40 transition-colors shrink-0 cursor-pointer"
                  title="Delete Audit Trail Entry"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-zinc-800 bg-[#141414] text-xs">
            <span className="text-zinc-400">
              Page <strong className="text-white">{currentPage}</strong> of{' '}
              <strong className="text-white">{totalPages}</strong>
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {toastMsg && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl border text-xs font-semibold flex items-center gap-2 ${
            toastMsg.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-800'
              : 'bg-red-950/90 text-red-200 border-red-800'
          }`}
        >
          {toastMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Delete Audit Record Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setLogToDelete(null);
          setDeleteError(null);
        }}
        onConfirm={handleConfirmDeleteLog}
        title="Delete this activity log?"
        subtitle="Activity Log Maintenance"
        description="Are you sure you want to delete this activity log?"
        itemName={logToDelete ? `${logToDelete.action.toUpperCase()}` : 'Audit Record'}
        itemType="Audit Log Record"
        itemDetails={
          logToDelete
            ? [
                { label: 'Event', value: logToDelete.action.toUpperCase() },
                { label: 'Description', value: logToDelete.description },
                { label: 'Timestamp', value: formatDateTime(logToDelete.created_at) },
                { label: 'Entity Type', value: logToDelete.entity_type },
              ]
            : []
        }
        warningNotice="This action will permanently remove this audit record and cannot be undone."
        confirmLabel="DELETE"
        confirmVariant="danger"
        requiresConfirmationText={false}
        loading={isDeletingLog}
        error={deleteError}
      />

      <DeleteConfirmModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => {
          if (isBulkDeleting) return;
          setIsBulkDeleteModalOpen(false);
          setBulkDeleteError(null);
        }}
        onConfirm={handleConfirmBulkDeleteLogs}
        title="Delete selected activity logs?"
        description="Are you sure you want to delete the selected activity logs?"
        itemName={`${selectedLogIds.length} activity logs`}
        itemType="Selected Activity Logs"
        warningNotice="This action will permanently remove the selected activity logs and cannot be undone."
        confirmLabel="DELETE"
        confirmVariant="danger"
        loading={isBulkDeleting}
        error={bulkDeleteError}
      />
    </div>
  );
};
