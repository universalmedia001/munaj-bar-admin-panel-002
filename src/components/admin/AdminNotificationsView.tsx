import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Send, 
  Users, 
  AlertTriangle, 
  Info, 
  CheckCircle2, 
  RefreshCw, 
  MessageSquare,
  Clock
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { Notification, Profile } from '../../types';
import { formatReceiptDate, formatTime } from '../../utils/formatters';

export const AdminNotificationsView: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [workers, setWorkers] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Broadcast Form
  const [title, setTitle] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [type, setType] = useState<'info' | 'warning' | 'stock' | 'system'>('info');
  const [recipientId, setRecipientId] = useState<string>(''); // empty = All Workers
  const [isSending, setIsSending] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [notifs, workersList] = await Promise.all([
        adminService.getNotifications(50),
        adminService.getAllWorkers(),
      ]);

      setNotifications(notifs);
      setWorkers(workersList);
    } catch (err) {
      console.error('Error loading notifications:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    if (!title.trim() || !message.trim()) {
      setErrorMsg('Please enter both title and message.');
      return;
    }

    try {
      setIsSending(true);
      const result = await adminService.sendBroadcastNotification({
        title: title.trim(),
        message: message.trim(),
        type,
        recipientId: recipientId || null,
      });

      if (result.target === 'all') {
        setSuccessMsg(`Broadcast sent successfully to ${result.count} active worker${result.count === 1 ? '' : 's'}.`);
      } else {
        const worker = workers.find((w) => w.id === recipientId);
        setSuccessMsg(`Broadcast sent successfully to ${worker ? worker.full_name : 'worker'}.`);
      }

      setTitle('');
      setMessage('');
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to dispatch broadcast.');
    } finally {
      setIsSending(false);
    }
  };

  const getTypeStyle = (t: string) => {
    switch (t) {
      case 'warning':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'stock':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'system':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      default:
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    }
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#111111] border border-[#222222] p-4 lg:p-6 rounded-2xl">
        <div>
          <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-400" />
            <span>Worker Broadcasts & System Alerts</span>
          </h2>
          <p className="text-xs text-[#A1A1AA] mt-0.5">
            Send real-time instant popups and notices to all active cashiers and bar terminals
          </p>
        </div>

        <button
          onClick={loadData}
          className="p-2.5 rounded-xl bg-[#1A1A1A] hover:bg-[#222222] border border-[#2A2A2A] text-[#A1A1AA] hover:text-white transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Broadcast Form */}
        <div className="bg-[#111111] border border-[#222222] rounded-2xl p-5 space-y-4 h-fit">
          <div className="flex items-center gap-2 pb-3 border-b border-[#222222]">
            <Send className="w-4 h-4 text-green-400" />
            <h3 className="text-sm font-bold text-white">Create New Broadcast</h3>
          </div>

          <form onSubmit={handleSendBroadcast} className="space-y-4">
            {successMsg && (
              <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-xs text-green-400 font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Recipient Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-[#E4E4E7] mb-1">
                Target Recipient
              </label>
              <select
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
                className="w-full px-3 py-2 bg-[#181818] border border-[#2A2A2A] rounded-xl text-xs text-white focus:outline-hidden focus:border-green-500"
              >
                <option value="">📢 ALL WORKERS (Global Broadcast)</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    👤 {w.full_name} ({w.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Alert Priority / Type */}
            <div>
              <label className="block text-xs font-semibold text-[#E4E4E7] mb-1">
                Alert Type / Priority
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full px-3 py-2 bg-[#181818] border border-[#2A2A2A] rounded-xl text-xs text-white focus:outline-hidden focus:border-green-500"
              >
                <option value="info">Info / General Announcement</option>
                <option value="warning">Warning / Urgent Shift Note</option>
                <option value="stock">Stock / Kitchen & Bar Update</option>
                <option value="system">System / Operations</option>
              </select>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-[#E4E4E7] mb-1">
                Headline / Subject <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. VIP Table 4 Reserved for 9 PM"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 bg-[#181818] border border-[#2A2A2A] rounded-xl text-xs text-white focus:outline-hidden focus:border-green-500"
              />
            </div>

            {/* Message Body */}
            <div>
              <label className="block text-xs font-semibold text-[#E4E4E7] mb-1">
                Notice Message Body <span className="text-red-400">*</span>
              </label>
              <textarea
                rows={4}
                required
                placeholder="Type detailed message for cashiers..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full px-3 py-2 bg-[#181818] border border-[#2A2A2A] rounded-xl text-xs text-white focus:outline-hidden focus:border-green-500"
              />
            </div>

            <button
              type="submit"
              disabled={isSending}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-500 hover:bg-green-400 text-black text-xs font-bold transition-all disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{isSending ? 'Sending...' : 'Dispatch Broadcast'}</span>
            </button>
          </form>
        </div>

        {/* Right 2 Cols: Broadcasts Feed */}
        <div className="lg:col-span-2 bg-[#111111] border border-[#222222] rounded-2xl overflow-hidden flex flex-col">
          <div className="p-4 lg:p-5 border-b border-[#222222] flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-400" />
              <span>Recent Dispatched Notices & Alerts</span>
            </h3>
            <span className="text-xs text-[#A1A1AA]">
              {notifications.length} alerts logged
            </span>
          </div>

          <div className="flex-1 divide-y divide-[#1A1A1A] overflow-y-auto max-h-[600px] custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="p-12 text-center text-[#71717A]">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">No broadcast notices on record.</p>
                <p className="text-xs mt-1">Dispatched notices will appear here and persist across sessions.</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className="p-4 hover:bg-[#161616] transition-colors space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getTypeStyle(n.type)}`}>
                        {n.type}
                      </span>
                      <h4 className="text-xs font-bold text-white">{n.title}</h4>
                    </div>
                    <span className="text-[10px] text-[#71717A] flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatReceiptDate(n.created_at)} at {formatTime(n.created_at)}
                    </span>
                  </div>

                  <p className="text-xs text-[#A1A1AA] leading-relaxed">
                    {n.message}
                  </p>

                  <div className="text-[10px] text-[#71717A] pt-1">
                    Audience: {n.recipient_id ? 'Specific Staff' : 'All Cashiers (Global)'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
