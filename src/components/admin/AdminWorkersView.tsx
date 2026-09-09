import React, { useState, useEffect } from 'react';
import { 
  Users, 
  ShieldCheck, 
  Edit, 
  Search, 
  Filter, 
  UserPlus, 
  CheckCircle2, 
  Clock, 
  RefreshCw,
  X,
  Shield,
  Briefcase
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { Profile, WorkerRole } from '../../types';
import { formatReceiptDate } from '../../utils/formatters';

export const AdminWorkersView: React.FC = () => {
  const [workers, setWorkers] = useState<Profile[]>([]);
  const [activeShiftWorkerIds, setActiveShiftWorkerIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all');

  // Edit Role Modal State
  const [editingWorker, setEditingWorker] = useState<Profile | null>(null);
  const [selectedNewRole, setSelectedNewRole] = useState<WorkerRole>('cashier');
  const [isUpdatingRole, setIsUpdatingRole] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadWorkers = async () => {
    try {
      setIsLoading(true);
      const [workersList, activeShifts] = await Promise.all([
        adminService.getAllWorkers(),
        adminService.getActiveShifts(),
      ]);

      setWorkers(workersList);
      setActiveShiftWorkerIds(new Set(activeShifts.map((s) => s.worker_id)));
    } catch (err) {
      console.error('Error fetching workers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWorkers();
  }, []);

  const handleOpenEditRole = (w: Profile) => {
    setEditingWorker(w);
    setSelectedNewRole(w.role);
    setErrorMsg(null);
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWorker) return;

    try {
      setIsUpdatingRole(true);
      setErrorMsg(null);
      await adminService.updateWorkerRole(editingWorker.id, selectedNewRole);
      setEditingWorker(null);
      loadWorkers();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update worker role.');
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const filteredWorkers = workers.filter((w) => {
    const matchesSearch =
      w.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = selectedRoleFilter === 'all' || w.role === selectedRoleFilter;
    return matchesSearch && matchesRole;
  });

  const getRoleBadgeStyle = (role: WorkerRole) => {
    switch (role) {
      case 'admin':
        return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'manager':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'cashier':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'bar_worker':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'sales_worker':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      default:
        return 'bg-zinc-800 text-zinc-400 border-zinc-700';
    }
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#111111] border border-[#222222] p-4 lg:p-6 rounded-2xl">
        <div>
          <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            <span>Worker & Staff Roles Management</span>
          </h2>
          <p className="text-xs text-[#A1A1AA] mt-0.5">
            Total {workers.length} registered profiles in MUNAJ BAR database
          </p>
        </div>

        <button
          onClick={loadWorkers}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#1A1A1A] hover:bg-[#222222] border border-[#2A2A2A] text-xs font-semibold text-white transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-green-400' : ''}`} />
          <span>Refresh Staff</span>
        </button>
      </div>

      {/* Role Hierarchy Guide Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-[#141414] border border-[#222222] p-4 rounded-xl">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-green-400" />
            <span className="text-xs font-bold text-white">Admin & Manager</span>
          </div>
          <p className="text-[11px] text-[#A1A1AA] mt-1">
            Full access to Admin Panel, financial dashboards, price adjustments, stock reconciliation, and staff roles.
          </p>
        </div>

        <div className="bg-[#141414] border border-[#222222] p-4 rounded-xl">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-bold text-white">Cashier & Bar Worker</span>
          </div>
          <p className="text-[11px] text-[#A1A1AA] mt-1">
            Worker POS terminal access: open/close shifts, ring up sales, process cash/POS/transfer payments, and print receipts.
          </p>
        </div>

        <div className="bg-[#141414] border border-[#222222] p-4 rounded-xl">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-bold text-white">Shift Tracking</span>
          </div>
          <p className="text-[11px] text-[#A1A1AA] mt-1">
            Each worker operates under dedicated active shifts to ensure 100% accountable cash drawer reconciliation.
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-[#111111] border border-[#222222] p-4 rounded-2xl grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-[#A1A1AA] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search worker by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#181818] border border-[#2A2A2A] rounded-xl text-xs text-white placeholder-[#71717A] focus:outline-hidden focus:border-blue-500"
          />
        </div>

        <select
          value={selectedRoleFilter}
          onChange={(e) => setSelectedRoleFilter(e.target.value)}
          className="px-3 py-2 bg-[#181818] border border-[#2A2A2A] rounded-xl text-xs text-white focus:outline-hidden focus:border-blue-500"
        >
          <option value="all">All Roles ({workers.length})</option>
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
          <option value="cashier">Cashier</option>
          <option value="bar_worker">Bar Worker</option>
          <option value="sales_worker">Sales Worker</option>
        </select>
      </div>

      {/* Workers Table */}
      <div className="bg-[#111111] border border-[#222222] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#222222] bg-[#141414] text-[11px] font-semibold text-[#A1A1AA] uppercase tracking-wider">
                <th className="py-3.5 px-4">Staff Member</th>
                <th className="py-3.5 px-4">Email Address</th>
                <th className="py-3.5 px-4 text-center">System Role</th>
                <th className="py-3.5 px-4 text-center">Shift Status</th>
                <th className="py-3.5 px-4 text-center">Joined Date</th>
                <th className="py-3.5 px-4 text-right">Role Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#1A1A1A] text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#71717A]">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading staff profiles...
                  </td>
                </tr>
              ) : filteredWorkers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#71717A]">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No workers match your search criteria.
                  </td>
                </tr>
              ) : (
                filteredWorkers.map((w) => {
                  const isOnDuty = activeShiftWorkerIds.has(w.id);
                  return (
                    <tr key={w.id} className="hover:bg-[#161616] transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-xs text-white shadow-inner">
                            {w.full_name?.charAt(0).toUpperCase() || 'W'}
                          </div>
                          <div>
                            <p className="font-bold text-white">
                              {w.full_name || 'Worker'}
                            </p>
                            <p className="text-[10px] text-[#71717A] font-mono">
                              ID: {w.id.substring(0, 8)}...
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-[#A1A1AA] font-mono text-[11px]">
                        {w.email}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getRoleBadgeStyle(w.role)}`}>
                          {w.role.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        {isOnDuty ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 text-[10px] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            On Duty (Shift Open)
                          </span>
                        ) : (
                          <span className="text-[11px] text-[#71717A]">
                            Off Duty
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center text-[#71717A] text-[11px]">
                        {formatReceiptDate(w.created_at)}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleOpenEditRole(w)}
                          className="px-3 py-1.5 rounded-lg bg-[#1A1A1A] hover:bg-blue-500 hover:text-black text-blue-400 border border-[#2A2A2A] text-xs font-semibold transition-all"
                        >
                          Change Role
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Role Modal */}
      {editingWorker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#111111] border border-[#262626] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-4 lg:p-5 border-b border-[#222222] flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-400" />
                <span>Modify Worker Role & Permissions</span>
              </h3>
              <button
                onClick={() => setEditingWorker(null)}
                className="p-1 text-[#A1A1AA] hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRole} className="p-5 space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 font-medium">
                  {errorMsg}
                </div>
              )}

              <div className="p-3 rounded-xl bg-[#181818] border border-[#262626] space-y-1">
                <p className="text-xs font-bold text-white">{editingWorker.full_name}</p>
                <p className="text-[11px] text-[#A1A1AA] font-mono">{editingWorker.email}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#E4E4E7] mb-1.5">
                  Select New System Role
                </label>
                <select
                  value={selectedNewRole}
                  onChange={(e) => setSelectedNewRole(e.target.value as WorkerRole)}
                  className="w-full px-3 py-2.5 bg-[#181818] border border-[#2A2A2A] rounded-xl text-xs text-white font-semibold focus:outline-hidden focus:border-blue-500"
                >
                  <option value="cashier">Cashier (Worker POS access)</option>
                  <option value="bar_worker">Bar Worker (Worker POS access)</option>
                  <option value="sales_worker">Sales Worker (Worker POS access)</option>
                  <option value="manager">Manager (Admin Panel & Worker POS)</option>
                  <option value="admin">Admin (Full System Permissions)</option>
                </select>
              </div>

              <div className="text-[11px] text-[#71717A] bg-[#141414] p-3 rounded-xl border border-[#222222]">
                <b>Note:</b> Changes take effect immediately upon next login or token refresh.
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#222222]">
                <button
                  type="button"
                  onClick={() => setEditingWorker(null)}
                  className="px-4 py-2 rounded-xl bg-[#1A1A1A] hover:bg-[#222222] text-xs font-semibold text-[#E4E4E7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingRole}
                  className="px-5 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-black text-xs font-bold transition-all disabled:opacity-50"
                >
                  {isUpdatingRole ? 'Updating...' : 'Save Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
