import React, { useState, useMemo } from 'react';
import {
  Bell,
  Send,
  CheckCheck,
  Check,
  Filter,
  TrendingUp,
  Clock,
  AlertTriangle,
  PackageX,
  MessageSquare,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { AppNotification, NotificationType } from '../../types';
import { formatDateTime, formatRelativeTime } from '../../utils/formatters';
import { Badge } from '../common/Badge';
import { EmptyState } from '../common/EmptyState';
import { DeleteConfirmModal } from '../common/DeleteConfirmModal';
import { bulkDeleteNotifications, deleteNotification, clearAllReadNotifications } from '../../services/deleteManagementService';
import { supabase } from '../../lib/supabase';

interface NotificationsViewProps {
  notifications: AppNotification[];
  onOpenBroadcastModal: () => void;
  onRefresh: () => void;
  loading: boolean;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  notifications,
  onOpenBroadcastModal,
  onRefresh,
  loading,
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [hiddenNotificationIds, setHiddenNotificationIds] = useState<Set<string>>(new Set());
  const [selectedNotificationIds, setSelectedNotificationIds] = useState<string[]>([]);

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (hiddenNotificationIds.has(n.id)) return false;
      if (unreadOnly && n.is_read) return false;
      if (filterType !== 'all' && n.type !== filterType) return false;
      return true;
    });
  }, [notifications, filterType, hiddenNotificationIds, unreadOnly]);

  const visibleNotifications = notifications.filter((n) => !hiddenNotificationIds.has(n.id));
  const unreadCount = visibleNotifications.filter((n) => !n.is_read).length;

  // Deletion States
  const [notificationToDelete, setNotificationToDelete] = useState<AppNotification | null>(null);
  const [isDeleteSingleModalOpen, setIsDeleteSingleModalOpen] = useState(false);
  const [isDeletingSingle, setIsDeletingSingle] = useState(false);
  const [deleteSingleError, setDeleteSingleError] = useState<string | null>(null);

  const [isClearReadModalOpen, setIsClearReadModalOpen] = useState(false);
  const [isClearingRead, setIsClearingRead] = useState(false);
  const [clearReadError, setClearReadError] = useState<string | null>(null);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);

  const promptDeleteNotification = (notif: AppNotification) => {
    setNotificationToDelete(notif);
    setDeleteSingleError(null);
    setIsDeleteSingleModalOpen(true);
  };

  const handleConfirmDeleteSingle = async () => {
    if (!notificationToDelete) return;
    try {
      setIsDeletingSingle(true);
      setDeleteSingleError(null);

      const result = await deleteNotification(notificationToDelete.id);
      if (!result.success) {
        setDeleteSingleError(result.message);
        return;
      }

      setIsDeleteSingleModalOpen(false);
      setHiddenNotificationIds((prev) => new Set(prev).add(notificationToDelete.id));
      setNotificationToDelete(null);
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete notification.';
      setDeleteSingleError(msg);
    } finally {
      setIsDeletingSingle(false);
    }
  };

  const handleConfirmClearRead = async () => {
    try {
      setIsClearingRead(true);
      setClearReadError(null);

      const result = await clearAllReadNotifications();
      if (!result.success) {
        setClearReadError(result.message);
        return;
      }

      setIsClearReadModalOpen(false);
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to clear read notifications.';
      setClearReadError(msg);
    } finally {
      setIsClearingRead(false);
    }
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedNotificationIds.length === 0) return;
    try {
      setIsBulkDeleting(true);
      setBulkDeleteError(null);
      const result = await bulkDeleteNotifications(selectedNotificationIds);
      if (!result.success || result.failedCount > 0) {
        setBulkDeleteError('Failed to delete selected items. Please try again.');
        return;
      }
      setHiddenNotificationIds((prev) => new Set([...prev, ...selectedNotificationIds]));
      setSelectedNotificationIds([]);
      setIsBulkDeleteModalOpen(false);
      onRefresh();
    } catch {
      setBulkDeleteError('Failed to delete selected items. Please try again.');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const markSingleRead = async (id: string) => {
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      onRefresh();
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const markAllRead = async () => {
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
      onRefresh();
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  const getTypeIcon = (type: NotificationType) => {
    switch (type) {
      case 'new_sale':
        return <TrendingUp className="w-4 h-4 text-emerald-400" />;
      case 'shift_started':
      case 'shift_closed':
        return <Clock className="w-4 h-4 text-blue-400" />;
      case 'low_stock':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'out_of_stock':
        return <PackageX className="w-4 h-4 text-red-400" />;
      case 'admin_message':
        return <MessageSquare className="w-4 h-4 text-purple-400" />;
      default:
        return <Bell className="w-4 h-4 text-zinc-400" />;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#111111] p-5 rounded-2xl border border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-extrabold text-white tracking-tight">
              Notifications & Staff Dispatch
            </h2>
            {unreadCount > 0 && (
              <Badge variant="green" size="sm">
                {unreadCount} Unread
              </Badge>
            )}
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Realtime alerts on orders, shift activities, stock alarms, and broadcast announcements to bar terminals.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Mark All as Read</span>
            </button>
          )}

          <button
            onClick={onOpenBroadcastModal}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-black bg-[#22C55E] hover:bg-[#1ea750] rounded-xl transition-all shadow-md shadow-emerald-950/40"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Broadcast Message</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-[#111111] p-4 rounded-2xl border border-zinc-800/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filterType === 'all'
                ? 'bg-[#22C55E] text-black font-bold'
                : 'bg-zinc-900 text-zinc-400 hover:text-white'
            }`}
          >
            All Alerts ({visibleNotifications.length})
          </button>
          <button
            onClick={() => setFilterType('new_sale')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filterType === 'new_sale'
                ? 'bg-[#22C55E] text-black font-bold'
                : 'bg-zinc-900 text-zinc-400 hover:text-white'
            }`}
          >
            Sales
          </button>
          <button
            onClick={() => setFilterType('shift_started')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filterType === 'shift_started'
                ? 'bg-[#22C55E] text-black font-bold'
                : 'bg-zinc-900 text-zinc-400 hover:text-white'
            }`}
          >
            Shifts
          </button>
          <button
            onClick={() => setFilterType('low_stock')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filterType === 'low_stock'
                ? 'bg-[#22C55E] text-black font-bold'
                : 'bg-zinc-900 text-zinc-400 hover:text-white'
            }`}
          >
            Low Stock
          </button>
          <button
            onClick={() => setFilterType('admin_message')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filterType === 'admin_message'
                ? 'bg-[#22C55E] text-black font-bold'
                : 'bg-zinc-900 text-zinc-400 hover:text-white'
            }`}
          >
            Broadcasts
          </button>
        </div>

        <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
            className="rounded border-zinc-700 text-[#22C55E] focus:ring-[#22C55E] bg-zinc-900"
          />
          <span>Unread notifications only</span>
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-xs font-semibold text-zinc-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={filteredNotifications.length > 0 && filteredNotifications.every((notification) => selectedNotificationIds.includes(notification.id))}
            onChange={(e) => {
              if (e.target.checked) {
                setSelectedNotificationIds((prev) => Array.from(new Set([...prev, ...filteredNotifications.map((notification) => notification.id)])));
              } else {
                const ids = new Set(filteredNotifications.map((notification) => notification.id));
                setSelectedNotificationIds((prev) => prev.filter((id) => !ids.has(id)));
              }
            }}
            className="rounded border-zinc-700 text-[#22C55E] focus:ring-[#22C55E] bg-zinc-900 cursor-pointer"
          />
          <span>Select All</span>
        </label>

        {selectedNotificationIds.length > 0 && (
          <div className="flex items-center gap-2">
            <button onClick={() => setSelectedNotificationIds([])} className="px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-800 rounded-xl">Deselect All</button>
            <button onClick={() => { setBulkDeleteError(null); setIsBulkDeleteModalOpen(true); }} className="px-3.5 py-1.5 text-xs font-bold text-red-200 bg-red-950/80 border border-red-800/80 rounded-xl flex items-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Selected ({selectedNotificationIds.length})</span>
            </button>
          </div>
        )}
      </div>

      {/* Notifications Feed */}
      <div className="bg-[#111111] rounded-2xl border border-zinc-800/80 divide-y divide-zinc-800/60 overflow-hidden">
        {filteredNotifications.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={Bell}
              title="No notifications match filters"
              description="Realtime sales, shifts, stock warnings, and staff messages will appear here."
            />
          </div>
        ) : (
          filteredNotifications.map((notif) => (
            <div
              key={notif.id}
              className={`p-4 transition-colors flex items-start justify-between gap-4 ${
                !notif.is_read ? 'bg-emerald-950/20 hover:bg-emerald-950/30' : 'hover:bg-zinc-900/50'
              }`}
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <input
                  type="checkbox"
                  checked={selectedNotificationIds.includes(notif.id)}
                  onChange={() => setSelectedNotificationIds((prev) => prev.includes(notif.id) ? prev.filter((id) => id !== notif.id) : [...prev, notif.id])}
                  className="mt-3 rounded border-zinc-700 text-[#22C55E] focus:ring-[#22C55E] bg-zinc-900 cursor-pointer"
                  aria-label={`Select notification ${notif.title}`}
                />
                <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
                  {getTypeIcon(notif.type)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-xs font-bold text-white">{notif.title}</h4>
                    <span className="text-[10px] text-zinc-500">• {formatRelativeTime(notif.created_at)}</span>
                    {!notif.is_read && (
                      <span className="w-2 h-2 rounded-full bg-[#22C55E]" title="Unread" />
                    )}
                  </div>
                  <p className="text-xs text-zinc-300 mt-1 leading-relaxed">{notif.message}</p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {!notif.is_read && (
                  <button
                    onClick={() => markSingleRead(notif.id)}
                    title="Mark as read"
                    className="p-1.5 text-zinc-400 hover:text-[#22C55E] rounded-lg hover:bg-zinc-800 transition-colors shrink-0"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => promptDeleteNotification(notif)}
                  title="Delete notification"
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-950/40 border border-transparent hover:border-red-900/40 transition-colors shrink-0 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Delete Notification Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isDeleteSingleModalOpen}
        onClose={() => {
          setIsDeleteSingleModalOpen(false);
          setNotificationToDelete(null);
          setDeleteSingleError(null);
        }}
        onConfirm={handleConfirmDeleteSingle}
        title="Delete Notification?"
        description="Are you sure you want to permanently delete this notification?"
        itemName={notificationToDelete ? notificationToDelete.title : 'Notification'}
        itemType="Notification"
        itemDetails={
          notificationToDelete
            ? [
                { label: 'Title', value: notificationToDelete.title },
                { label: 'Message', value: notificationToDelete.message },
                { label: 'Type', value: notificationToDelete.type.replace('_', ' ').toUpperCase() },
                { label: 'Time', value: formatRelativeTime(notificationToDelete.created_at) },
              ]
            : []
        }
        warningNotice="This notification will be permanently removed from the database. This action cannot be undone."
        confirmLabel="DELETE"
        confirmVariant="danger"
        requiresConfirmationText={false}
        loading={isDeletingSingle}
        error={deleteSingleError}
      />

      <DeleteConfirmModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => {
          if (isBulkDeleting) return;
          setIsBulkDeleteModalOpen(false);
          setBulkDeleteError(null);
        }}
        onConfirm={handleConfirmBulkDelete}
        title="Delete selected items?"
        description="Are you sure you want to delete the selected notifications?"
        itemName={`${selectedNotificationIds.length} notifications`}
        itemType="Selected Notifications"
        warningNotice="This action will permanently remove the selected items and cannot be undone."
        confirmLabel="DELETE"
        confirmVariant="danger"
        loading={isBulkDeleting}
        error={bulkDeleteError}
      />
    </div>
  );
};
