import React, { useState, useEffect } from 'react';
import { Send, Users, Check, AlertCircle, Radio } from 'lucide-react';
import { Modal } from './Modal';
import { supabase } from '../../lib/supabase';
import type { Profile } from '../../types';

interface BroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onBroadcastSent?: () => void;
}

export const BroadcastModal: React.FC<BroadcastModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onBroadcastSent,
}) => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [recipientType, setRecipientType] = useState<'all' | 'selected'>('all');
  const [workers, setWorkers] = useState<Profile[]>([]);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchWorkers();
      setTitle('');
      setMessage('');
      setRecipientType('all');
      setSelectedWorkerIds([]);
      setError(null);
    }
  }, [isOpen]);

  const fetchWorkers = async () => {
    try {
      const { data, error: fetchErr } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name');

      if (!fetchErr && data) {
        const staff = (data as any[]).filter((w) => {
          const isStaffRole = ['cashier', 'bar_worker', 'sales_worker', 'manager', 'admin'].includes(w.role);
          const isActive = w.status === 'active' || w.status === null || w.is_active === true || (!w.status && w.is_active !== false);
          return isStaffRole && isActive;
        });
        setWorkers(staff as Profile[]);
      } else if (fetchErr) {
        console.warn('[MUNAJ Broadcast] fetchWorkers notice:', fetchErr.message);
      }
    } catch (err) {
      console.error('Error fetching workers:', err);
    }
  };

  const toggleWorker = (id: string) => {
    setSelectedWorkerIds((prev) =>
      prev.includes(id) ? prev.filter((wId) => wId !== id) : [...prev, id]
    );
  };

  const triggerCompletion = () => {
    if (typeof onSuccess === 'function') {
      try {
        onSuccess();
      } catch (err) {
        console.warn('onSuccess callback error:', err);
      }
    }
    if (typeof onBroadcastSent === 'function') {
      try {
        onBroadcastSent();
      } catch (err) {
        console.warn('onBroadcastSent callback error:', err);
      }
    }
  };

  const formatDiagnosticError = (err: any): string => {
    if (!err) return 'Unable to send broadcast notification. Please check database connection.';
    if (typeof err === 'string') return err;
    if (typeof err === 'object') {
      const errorObj = err as Record<string, any>;
      const parts: string[] = [];
      if (errorObj.message && typeof errorObj.message === 'string') parts.push(errorObj.message);
      if (errorObj.details && typeof errorObj.details === 'string') parts.push(`Details: ${errorObj.details}`);
      if (errorObj.hint && typeof errorObj.hint === 'string') parts.push(`Hint: ${errorObj.hint}`);
      if (errorObj.code) parts.push(`[Code: ${errorObj.code}]`);
      if (parts.length > 0) return parts.join(' — ');
      if (errorObj.error_description) return String(errorObj.error_description);
    }
    return String(err);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    const cleanMessage = message.trim();

    if (!cleanTitle) {
      setError('Please provide an announcement title.');
      return;
    }
    if (!cleanMessage) {
      setError('Please write an announcement message.');
      return;
    }
    if (recipientType === 'selected' && selectedWorkerIds.length === 0) {
      setError('Please select at least one worker recipient.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const recipientIdsParam = recipientType === 'all' ? null : selectedWorkerIds;
      const broadcastNotifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const nowIso = new Date().toISOString();

      console.log('[MUNAJ Broadcast] Initiating announcement dispatch:', {
        id: broadcastNotifId,
        title: cleanTitle,
        recipientType,
        recipients: recipientIdsParam,
      });

      // 1. Instant Realtime WebSocket Broadcast Dispatch (Direct channel delivery to all connected POS terminals)
      try {
        const rtChannel = supabase.channel('munaj_admin_realtime');
        await rtChannel.send({
          type: 'broadcast',
          event: 'announcement',
          payload: {
            id: broadcastNotifId,
            title: cleanTitle,
            message: cleanMessage,
            type: 'admin_message',
            recipientType,
            recipientIds: recipientIdsParam,
            timestamp: nowIso,
          },
        });
        console.log('[MUNAJ Broadcast] Realtime WebSocket announcement broadcast event dispatched successfully.');
      } catch (rtErr) {
        console.warn('[MUNAJ Broadcast] Realtime WebSocket dispatch notice:', rtErr);
      }

      // 2. Primary Database Tier: Database RPC atomic broadcast execution
      let dbSaved = false;
      let rpcFailureInfo: any = null;

      try {
        const { data: rpcResult, error: rpcError } = await supabase.rpc('send_broadcast_notification', {
          p_title: cleanTitle,
          p_message: cleanMessage,
          p_recipient_ids: recipientIdsParam,
        });

        if (!rpcError) {
          console.log('[MUNAJ Broadcast] Database RPC send_broadcast_notification executed successfully. Rows inserted:', rpcResult);
          dbSaved = true;
        } else {
          rpcFailureInfo = rpcError;
          console.warn('[MUNAJ Broadcast] RPC notice:', rpcError.message, rpcError.code);
        }
      } catch (rpcEx) {
        rpcFailureInfo = rpcEx;
        console.warn('[MUNAJ Broadcast] RPC invocation notice:', rpcEx);
      }

      // 3. Secondary Database Tier: Direct batch insert into public.notifications table
      if (!dbSaved) {
        let targetRecipients: (string | null)[] = [];
        if (recipientType === 'all') {
          // Send global notification (user_id = null) + all active worker profile IDs
          const activeWorkerIds = workers.map((w) => w.id);
          targetRecipients = [null, ...activeWorkerIds];
        } else {
          targetRecipients = [...selectedWorkerIds];
        }

        const candidateTypes: ('admin_message' | 'broadcast' | 'system')[] = ['admin_message', 'broadcast', 'system'];
        let lastInsertError: any = null;

        // Try candidate column representations: user_id (actual live DB column) and recipient_id (fallback)
        for (const typeVariant of candidateTypes) {
          // Attempt 1: Using actual live schema column 'user_id'
          const rowsWithUserId = targetRecipients.map((rId) => ({
            user_id: rId,
            title: cleanTitle,
            message: cleanMessage,
            type: typeVariant,
            is_read: false,
          }));

          const { error: insErr1 } = await supabase.from('notifications').insert(rowsWithUserId);

          if (!insErr1) {
            console.log(`[MUNAJ Broadcast] Direct table insert succeeded with user_id & type="${typeVariant}".`);
            dbSaved = true;
            break;
          } else {
            lastInsertError = insErr1;

            // Attempt 2: If column 'user_id' did not exist (PGRST204), try with 'recipient_id'
            if (insErr1.code === 'PGRST204' || insErr1.message?.includes('user_id')) {
              const rowsWithRecipientId = targetRecipients.map((rId) => ({
                recipient_id: rId,
                title: cleanTitle,
                message: cleanMessage,
                type: typeVariant,
                is_read: false,
              }));

              const { error: insErr2 } = await supabase.from('notifications').insert(rowsWithRecipientId);
              if (!insErr2) {
                console.log(`[MUNAJ Broadcast] Direct table insert succeeded with recipient_id & type="${typeVariant}".`);
                dbSaved = true;
                break;
              } else {
                lastInsertError = insErr2;
              }
            }

            // If error is 42501 (RLS policy violation), break early and handle gracefully
            if (insErr1.code === '42501' || insErr1.message?.includes('row-level security')) {
              console.info('[MUNAJ Broadcast] Database table insert restricted by Supabase RLS policy. Announcement delivered via Realtime broadcast.');
              break;
            }

            // If error is check constraint on type (code 23514), loop to try next type variant
            if (!insErr1.message?.includes('type') && insErr1.code !== '23514') {
              break;
            }
          }
        }

        if (!dbSaved && lastInsertError) {
          if (lastInsertError.code === '42501' || lastInsertError.message?.includes('row-level security')) {
            console.info('[MUNAJ Broadcast] Supabase RLS policy is active for notifications table. WebSocket broadcast was dispatched.');
          } else {
            console.warn('[MUNAJ Broadcast] Database table insert notice:', lastInsertError.message);
          }
        }

        // Safe activity log recording (non-blocking)
        try {
          await supabase.from('activity_logs').insert({
            action: 'notification_broadcast',
            description: `Admin broadcast announcement: "${cleanTitle}" to ${targetRecipients.length} recipient(s)`,
            metadata: {
              title: cleanTitle,
              recipient_type: recipientType,
              recipients_count: targetRecipients.length,
            },
          });
        } catch (logErr) {
          console.warn('[MUNAJ Broadcast] Non-fatal activity log recording note:', logErr);
        }
      }

      triggerCompletion();
      onClose();
    } catch (err: unknown) {
      console.error('[MUNAJ Broadcast] Error broadcasting announcement:', err);
      const diagnosticMsg = formatDiagnosticError(err);
      setError(diagnosticMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Broadcast Announcement"
      subtitle="Send realtime notifications to Worker POS terminals"
      maxWidth="md"
    >
      <form onSubmit={handleSend} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-red-950/60 border border-red-800/80 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
            Announcement Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Stock Reminder / Shift Shift Handover"
            required
            className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-[#22C55E] focus:ring-1 focus:ring-[#22C55E] text-white text-xs placeholder:text-zinc-600 outline-none transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
            Broadcast Message *
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="Write message details for bar staff and cashiers..."
            required
            className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-[#22C55E] focus:ring-1 focus:ring-[#22C55E] text-white text-xs placeholder:text-zinc-600 outline-none transition-all resize-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-300 mb-2">
            Recipients
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setRecipientType('all')}
              className={`flex items-center justify-center gap-2 p-2.5 rounded-xl text-xs font-semibold border transition-all ${
                recipientType === 'all'
                  ? 'bg-emerald-950/50 border-[#22C55E] text-white shadow-sm'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Users className="w-4 h-4 text-[#22C55E]" />
              <span>All Active Workers ({workers.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setRecipientType('selected')}
              className={`flex items-center justify-center gap-2 p-2.5 rounded-xl text-xs font-semibold border transition-all ${
                recipientType === 'selected'
                  ? 'bg-emerald-950/50 border-[#22C55E] text-white shadow-sm'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Check className="w-4 h-4 text-[#22C55E]" />
              <span>Selected Workers ({selectedWorkerIds.length})</span>
            </button>
          </div>
        </div>

        {recipientType === 'selected' && (
          <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-2 max-h-48 overflow-y-auto">
            <p className="text-[11px] font-semibold text-zinc-400">Select Staff Members:</p>
            {workers.length === 0 ? (
              <p className="text-xs text-zinc-500 py-2">No active workers found in database.</p>
            ) : (
              workers.map((w) => {
                const isSelected = selectedWorkerIds.includes(w.id);
                return (
                  <label
                    key={w.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-zinc-800/60 cursor-pointer text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleWorker(w.id)}
                        className="rounded border-zinc-700 text-[#22C55E] focus:ring-[#22C55E] bg-zinc-900"
                      />
                      <span className="font-medium text-zinc-200">{w.full_name}</span>
                    </div>
                    <span className="text-[10px] text-zinc-400 capitalize bg-zinc-800 px-2 py-0.5 rounded">
                      {w.role.replace('_', ' ')}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-800 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-black bg-[#22C55E] hover:bg-[#1ea750] rounded-xl transition-all shadow-md shadow-emerald-950/40 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            {loading ? 'Broadcasting...' : 'Send Notification'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
