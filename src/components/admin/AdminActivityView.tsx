import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Search, 
  Filter, 
  RefreshCw, 
  Clock, 
  ShieldCheck, 
  User,
  Tag,
  Package,
  Receipt
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { ActivityLog } from '../../types';
import { formatReceiptDate, formatTime } from '../../utils/formatters';

export const AdminActivityView: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedEntityFilter, setSelectedEntityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const loadLogs = async () => {
    try {
      setIsLoading(true);
      const data = await adminService.getActivityLogs(100, selectedEntityFilter);
      setLogs(data);
    } catch (err) {
      console.error('Error loading activity logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [selectedEntityFilter]);

  const filteredLogs = logs.filter((log) => {
    return (
      log.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.actor_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const getActionBadgeColor = (action: string) => {
    if (action.includes('create') || action.includes('open')) {
      return 'bg-green-500/10 text-green-400 border-green-500/20';
    }
    if (action.includes('delete') || action.includes('damage') || action.includes('cancel')) {
      return 'bg-red-500/10 text-red-400 border-red-500/20';
    }
    if (action.includes('update') || action.includes('adjust')) {
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    }
    return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#111111] border border-[#222222] p-4 lg:p-6 rounded-2xl">
        <div>
          <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
            <Activity className="w-5 h-5 text-green-400" />
            <span>Audit Trail & Activity Log</span>
          </h2>
          <p className="text-xs text-[#A1A1AA] mt-0.5">
            Immutable chronological record of administrative actions, stock changes, sales, and role modifications
          </p>
        </div>

        <button
          onClick={loadLogs}
          className="p-2.5 rounded-xl bg-[#1A1A1A] hover:bg-[#222222] border border-[#2A2A2A] text-[#A1A1AA] hover:text-white transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-green-400' : ''}`} />
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-[#111111] border border-[#222222] p-4 rounded-2xl grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-[#A1A1AA] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search audit descriptions or user..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#181818] border border-[#2A2A2A] rounded-xl text-xs text-white placeholder-[#71717A] focus:outline-hidden focus:border-green-500"
          />
        </div>

        <select
          value={selectedEntityFilter}
          onChange={(e) => setSelectedEntityFilter(e.target.value)}
          className="px-3 py-2 bg-[#181818] border border-[#2A2A2A] rounded-xl text-xs text-white focus:outline-hidden focus:border-green-500"
        >
          <option value="all">All Event Categories</option>
          <option value="product">Product & Menu Events</option>
          <option value="category">Category Events</option>
          <option value="worker">Worker & Role Events</option>
          <option value="shift">Shift & Cash Drawer Events</option>
          <option value="sale">Sales Events</option>
          <option value="notification">Broadcast Notifications</option>
          <option value="settings">Business Settings</option>
        </select>
      </div>

      {/* Activity Logs Table */}
      <div className="bg-[#111111] border border-[#222222] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#222222] bg-[#141414] text-[11px] font-semibold text-[#A1A1AA] uppercase tracking-wider">
                <th className="py-3.5 px-4">Date & Time</th>
                <th className="py-3.5 px-4">Actor</th>
                <th className="py-3.5 px-4 text-center">Action Type</th>
                <th className="py-3.5 px-4">Audit Description</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#1A1A1A] text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-[#71717A]">
                    <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading system audit trail...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-[#71717A]">
                    <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No audit records matching your filters.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#161616] transition-colors">
                    <td className="py-3 px-4 text-[#A1A1AA] whitespace-nowrap">
                      <div>{formatReceiptDate(log.created_at)}</div>
                      <div className="text-[10px] text-[#71717A]">{formatTime(log.created_at)}</div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 font-bold text-[10px] flex items-center justify-center">
                          {log.actor_name?.charAt(0).toUpperCase() || 'A'}
                        </div>
                        <span className="font-semibold text-white">{log.actor_name || 'System Admin'}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getActionBadgeColor(log.action)}`}>
                        {log.action.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-[#E4E4E7] font-medium">
                      {log.description}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
