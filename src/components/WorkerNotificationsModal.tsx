import React from 'react';
import { 
  Bell, 
  X, 
  CheckCheck, 
  Clock, 
  AlertTriangle, 
  Info, 
  Sparkles, 
  Package, 
  Check, 
  RefreshCw 
} from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { Notification } from '../types';
import { formatReceiptDate, formatTime } from '../utils/formatters';

export const WorkerNotificationsModal: React.FC = () => {
  const { 
    notifications, 
    unreadCount, 
    isModalOpen, 
    closeModal, 
    markAsRead, 
    markAllAsRead, 
    refreshNotifications,
    isLoading 
  } = useNotifications();

  if (!isModalOpen) return null;

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'warning':
        return {
          icon: <AlertTriangle className="w-3 h-3" />,
          label: 'URGENT NOTE',
          classes: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
        };
      case 'stock':
        return {
          icon: <Package className="w-3 h-3" />,
          label: 'INVENTORY ALERT',
          classes: 'bg-red-500/15 text-red-400 border-red-500/30',
        };
      case 'shift':
        return {
          icon: <Clock className="w-3 h-3" />,
          label: 'SHIFT UPDATE',
          classes: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
        };
      case 'sale':
        return {
          icon: <Sparkles className="w-3 h-3" />,
          label: 'SALE RECORD',
          classes: 'bg-green-500/15 text-green-400 border-green-500/30',
        };
      default:
        return {
          icon: <Bell className="w-3 h-3" />,
          label: 'ADMIN ANNOUNCEMENT',
          classes: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
        };
    }
  };

  return (
    <div 
      id="worker-notifications-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={closeModal}
    >
      <div 
        id="worker-notifications-modal"
        className="bg-[#111111] border border-[#262626] rounded-2xl w-full max-w-xl max-h-[85vh] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#222222] flex items-center justify-between bg-[#141414]">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center relative">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-[#111111]">
                  {unreadCount}
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-extrabold text-white tracking-wide">
                  NOTICES & BROADCASTS
                </h2>
                {unreadCount > 0 && (
                  <span className="bg-red-500/20 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-500/30 uppercase">
                    {unreadCount} Unread
                  </span>
                )}
              </div>
              <p className="text-xs text-[#A1A1AA]">
                Admin broadcast announcements and shift notices
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => refreshNotifications()}
              title="Refresh notifications"
              className="p-2 rounded-xl bg-[#1c1c1c] hover:bg-[#252525] border border-[#2a2a2a] text-[#A1A1AA] hover:text-white transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
            </button>
            <button
              id="worker-notifications-close-btn"
              onClick={closeModal}
              className="p-2 rounded-xl bg-[#1c1c1c] hover:bg-[#252525] border border-[#2a2a2a] text-[#A1A1AA] hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action Toolbar */}
        {notifications.length > 0 && unreadCount > 0 && (
          <div className="px-4 sm:px-5 py-2.5 bg-[#181818] border-b border-[#222222] flex items-center justify-between">
            <span className="text-xs text-[#71717A]">
              Showing {notifications.length} {notifications.length === 1 ? 'notice' : 'notices'}
            </span>
            <button
              id="worker-mark-all-read-btn"
              onClick={() => markAllAsRead()}
              className="text-xs font-bold text-green-400 hover:text-green-300 flex items-center space-x-1.5 cursor-pointer px-2 py-1 rounded-lg hover:bg-green-500/10 transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark all as read</span>
            </button>
          </div>
        )}

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#1c1c1c] p-2 sm:p-4 space-y-2">
          {notifications.length === 0 ? (
            <div className="p-12 text-center text-[#71717A]">
              <div className="w-12 h-12 rounded-2xl bg-[#181818] border border-[#262626] flex items-center justify-center mx-auto mb-3 text-[#555555]">
                <Bell className="w-6 h-6 stroke-[1.5]" />
              </div>
              <h4 className="text-sm font-bold text-white mb-1">No Broadcasts Yet</h4>
              <p className="text-xs text-[#888888] max-w-xs mx-auto">
                Admin broadcasts, management announcements, and shift alerts will appear here in real-time.
              </p>
            </div>
          ) : (
            notifications.map((notif: Notification) => {
              const badge = getTypeBadge(notif.type);
              const isUnread = !notif.is_read;

              return (
                <div
                  key={notif.id}
                  id={`notification-item-${notif.id}`}
                  className={`p-3.5 sm:p-4 rounded-xl border transition-all ${
                    isUnread
                      ? 'bg-[#181818] border-blue-500/30 shadow-md shadow-blue-950/20'
                      : 'bg-[#141414] border-[#222222] opacity-80 hover:opacity-100'
                  }`}
                >
                  {/* Top Bar */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border flex items-center space-x-1 ${badge.classes}`}>
                        {badge.icon}
                        <span>{badge.label}</span>
                      </span>
                      {isUnread ? (
                        <span className="flex items-center space-x-1 text-[10px] font-bold text-blue-400 bg-blue-500/15 px-1.5 py-0.5 rounded">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                          <span>● UNREAD</span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#71717A] flex items-center space-x-1">
                          <Check className="w-3 h-3 text-[#71717A]" />
                          <span>Read</span>
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-[#71717A] flex items-center space-x-1 shrink-0">
                      <Clock className="w-3 h-3" />
                      <span>{formatReceiptDate(notif.created_at)} • {formatTime(notif.created_at)}</span>
                    </div>
                  </div>

                  {/* Subject Title */}
                  <h3 className="text-sm font-bold text-white mb-1.5">
                    {notif.title}
                  </h3>

                  {/* Message Body */}
                  <p className="text-xs text-[#D4D4D8] leading-relaxed whitespace-pre-wrap">
                    {notif.message}
                  </p>

                  {/* Bottom Action for Unread */}
                  {isUnread && (
                    <div className="mt-3 pt-2.5 border-t border-[#242424] flex justify-end">
                      <button
                        onClick={() => markAsRead(notif.id)}
                        className="text-[11px] font-bold text-green-400 hover:text-green-300 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 px-3 py-1 rounded-lg flex items-center space-x-1 cursor-pointer transition-colors"
                      >
                        <Check className="w-3 h-3" />
                        <span>Mark as read</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#141414] border-t border-[#222222] text-center">
          <p className="text-[11px] text-[#71717A]">
            MUNAJ BAR Cashier Notification Network • Real-time Sync Active
          </p>
        </div>
      </div>
    </div>
  );
};
