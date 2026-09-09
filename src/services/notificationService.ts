import { getSupabase } from '../lib/supabase';
import { Notification } from '../types';

const getLocalReadSet = (workerId: string): Set<string> => {
  try {
    const raw = localStorage.getItem(`worker_read_notifications_${workerId}`);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
};

const saveLocalReadSet = (workerId: string, set: Set<string>) => {
  try {
    localStorage.setItem(`worker_read_notifications_${workerId}`, JSON.stringify(Array.from(set)));
  } catch {}
};

export const notificationService = {
  /**
   * Fetches all notifications targeted to the authenticated worker,
   * including direct recipient rows, global broadcasts (recipient_id is null or 'all'),
   * and broadcast reference types.
   */
  async getWorkerNotifications(workerId?: string): Promise<Notification[]> {
    const supabase = getSupabase();
    try {
      let targetId = workerId;
      if (!targetId) {
        const { data: { user } } = await supabase.auth.getUser();
        targetId = user?.id;
      }

      if (!targetId) return [];

      const localReadSet = getLocalReadSet(targetId);

      // Query for notifications targeted to this worker OR broadcast to all
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .or(`recipient_id.eq.${targetId},recipient_id.is.null,recipient_id.eq.all,reference_type.eq.broadcast`)
        .order('created_at', { ascending: false })
        .limit(60);

      if (error) {
        console.warn('Error querying notifications with OR filter from Supabase:', error);
        // Fallback to simpler query if OR fails
        const { data: fallbackData } = await supabase
          .from('notifications')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(40);

        if (!fallbackData) return [];
        return fallbackData
          .filter((n: any) => !n.recipient_id || n.recipient_id === targetId || n.recipient_id === 'all' || n.reference_type === 'broadcast')
          .map((n: any) => ({
            ...n,
            is_read: n.is_read || localReadSet.has(n.id),
          }));
      }

      // Deduplicate notifications by ID (or same title/message/time if multiple rows were broadcasted)
      const seenIds = new Set<string>();
      const deduped: Notification[] = [];

      for (const item of (data || [])) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          // If marked read in DB or locally by this worker
          const isRead = item.is_read || localReadSet.has(item.id);
          deduped.push({
            ...item,
            is_read: isRead,
          });
        }
      }

      return deduped;
    } catch (err) {
      console.error('Failed to get worker notifications:', err);
      return [];
    }
  },

  /**
   * Marks a single notification as read in Supabase and in local worker memory
   */
  async markAsRead(notificationId: string, workerId?: string): Promise<void> {
    const supabase = getSupabase();
    try {
      let targetId = workerId;
      if (!targetId) {
        const { data: { user } } = await supabase.auth.getUser();
        targetId = user?.id;
      }

      if (targetId) {
        const readSet = getLocalReadSet(targetId);
        readSet.add(notificationId);
        saveLocalReadSet(targetId, readSet);
      }

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) {
        console.warn('Notice: updating is_read in Supabase table:', error.message);
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  },

  /**
   * Marks all unread notifications for a worker as read
   */
  async markAllAsRead(workerId: string): Promise<void> {
    const supabase = getSupabase();
    try {
      // 1. Mark in Supabase for all notifications matching this worker
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('recipient_id', workerId)
        .eq('is_read', false);

      // 2. Also record all existing notifications in local set for this worker
      const currentNotifs = await this.getWorkerNotifications(workerId);
      const readSet = getLocalReadSet(workerId);
      currentNotifs.forEach((n) => readSet.add(n.id));
      saveLocalReadSet(workerId, readSet);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  },

  /**
   * Sets up a real-time subscription for new notifications sent to this worker
   * or broadcast to all terminals.
   */
  subscribeToWorkerNotifications(
    workerId: string,
    onInsert: (notification: Notification) => void,
    onUpdate?: (notification: Notification) => void
  ) {
    const supabase = getSupabase();
    const localReadSet = getLocalReadSet(workerId);

    const uniqueId = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const channelName = `munaj-notifications-${workerId}-${uniqueId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          if (payload.new) {
            const notif = payload.new as Notification;
            // Check if intended for this worker or for all workers
            const isForThisWorker = 
              !notif.recipient_id ||
              notif.recipient_id === workerId ||
              notif.recipient_id === 'all' ||
              notif.reference_type === 'broadcast';

            if (isForThisWorker) {
              const isRead = notif.is_read || localReadSet.has(notif.id);
              onInsert({
                ...notif,
                is_read: isRead,
              });
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          if (payload.new && onUpdate) {
            const notif = payload.new as Notification;
            const isForThisWorker = 
              !notif.recipient_id ||
              notif.recipient_id === workerId ||
              notif.recipient_id === 'all' ||
              notif.reference_type === 'broadcast';

            if (isForThisWorker) {
              const isRead = notif.is_read || localReadSet.has(notif.id);
              onUpdate({
                ...notif,
                is_read: isRead,
              });
            }
          }
        }
      )
      .on('broadcast', { event: 'admin-broadcast' }, (payload) => {
        if (payload?.payload) {
          const notif = payload.payload as Notification;
          const isForThisWorker =
            !notif.recipient_id ||
            notif.recipient_id === workerId ||
            notif.recipient_id === 'all' ||
            notif.reference_type === 'broadcast';

          if (isForThisWorker) {
            const isRead = notif.is_read || localReadSet.has(notif.id);
            onInsert({
              ...notif,
              is_read: isRead,
            });
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};
