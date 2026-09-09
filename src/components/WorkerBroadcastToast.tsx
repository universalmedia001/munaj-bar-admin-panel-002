import React, { useEffect } from 'react';
import { Bell, X, ArrowRight, AlertTriangle, Sparkles } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';

export const WorkerBroadcastToast: React.FC = () => {
  const { latestBroadcastToast, dismissToast, openModal } = useNotifications();

  useEffect(() => {
    if (latestBroadcastToast) {
      const timer = setTimeout(() => {
        dismissToast();
      }, 10000); // auto-hide after 10s
      return () => clearTimeout(timer);
    }
  }, [latestBroadcastToast, dismissToast]);

  if (!latestBroadcastToast) return null;

  return (
    <div 
      id="worker-broadcast-live-toast"
      className="fixed bottom-6 right-4 sm:right-6 z-50 max-w-md w-full bg-[#141414] border-2 border-blue-500/50 rounded-2xl p-4 shadow-2xl shadow-blue-950/40 text-white animate-in slide-in-from-bottom-5 duration-300 select-none"
    >
      <div className="flex items-start space-x-3">
        <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0 mt-0.5 animate-bounce">
          <Bell className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-blue-400 tracking-wider">
              NEW ADMIN BROADCAST
            </span>
            <button
              onClick={dismissToast}
              className="text-[#71717A] hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <h4 className="text-xs sm:text-sm font-extrabold text-white mt-0.5 truncate">
            {latestBroadcastToast.title}
          </h4>

          <p className="text-xs text-[#D4D4D8] mt-1 line-clamp-2 leading-snug">
            {latestBroadcastToast.message}
          </p>

          <div className="mt-2.5 flex items-center justify-end space-x-2">
            <button
              onClick={() => {
                openModal();
              }}
              className="bg-blue-500 hover:bg-blue-400 text-black text-[11px] font-extrabold px-3 py-1.5 rounded-lg flex items-center space-x-1 transition-all cursor-pointer shadow-md shadow-blue-950/40"
            >
              <span>View Notice</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
