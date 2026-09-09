import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { notificationService } from '../services/notificationService';
import { Notification } from '../types';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  isModalOpen: boolean;
  latestBroadcastToast: Notification | null;
  openModal: () => void;
  closeModal: () => void;
  dismissToast: () => void;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { profile, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [latestBroadcastToast, setLatestBroadcastToast] = useState<Notification | null>(null);

  // Unread count calculated dynamically from state
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const loadNotifications = useCallback(async () => {
    if (!profile?.id) return;
    try {
      setIsLoading(true);
      const data = await notificationService.getWorkerNotifications(profile.id);
      setNotifications(data);
    } catch (err) {
      console.warn('Error loading notifications:', err);
    } finally {
      setIsLoading(false);
    }
  }, [profile?.id]);

  // Initial load when user signs in or profile loads
  useEffect(() => {
    if (isAuthenticated && profile?.id) {
      loadNotifications();
    } else {
      setNotifications([]);
      setLatestBroadcastToast(null);
    }
  }, [isAuthenticated, profile?.id, loadNotifications]);

  // Supabase Realtime Subscription
  useEffect(() => {
    if (!isAuthenticated || !profile?.id) return;

    const workerId = profile.id;
    const unsubscribe = notificationService.subscribeToWorkerNotifications(
      workerId,
      (newNotification) => {
        setNotifications((prev) => {
          // Prevent duplicates by ID or title+message+near timestamp
          const isDuplicate = prev.some(
            (n) =>
              n.id === newNotification.id ||
              (n.title === newNotification.title &&
                n.message === newNotification.message &&
                Math.abs(new Date(n.created_at).getTime() - new Date(newNotification.created_at).getTime()) < 10000)
          );
          if (isDuplicate) {
            return prev;
          }
          return [newNotification, ...prev];
        });

        // Show live toast banner
        setLatestBroadcastToast(newNotification);
      },
      (updatedNotification) => {
        setNotifications((prev) =>
          prev.map((n) => (n.id === updatedNotification.id ? updatedNotification : n))
        );
      }
    );

    return () => {
      unsubscribe();
    };
  }, [isAuthenticated, profile?.id]);

  const markAsRead = async (id: string) => {
    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );

    if (latestBroadcastToast?.id === id) {
      setLatestBroadcastToast(null);
    }

    try {
      await notificationService.markAsRead(id, profile?.id);
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    if (!profile?.id) return;
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setLatestBroadcastToast(null);

    try {
      await notificationService.markAllAsRead(profile.id);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const openModal = () => {
    setIsModalOpen(true);
    setLatestBroadcastToast(null);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const dismissToast = () => {
    setLatestBroadcastToast(null);
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        isModalOpen,
        latestBroadcastToast,
        openModal,
        closeModal,
        dismissToast,
        markAsRead,
        markAllAsRead,
        refreshNotifications: loadNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
