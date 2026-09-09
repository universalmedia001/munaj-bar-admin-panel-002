import React, { useState, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Search,
  Power,
  Clock,
  TrendingUp,
  Mail,
  CheckCircle2,
  AlertCircle,
  Edit,
  Eye,
  Key,
  Send,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import type { Profile, UserRole, BusinessSettings, SaleWithDetails, ShiftWithWorker } from '../../types';
import { isWorkerDeleted } from '../../types';
import { formatCurrency, formatDate, formatDateTime, formatRelativeTime } from '../../utils/formatters';
import { Badge } from '../common/Badge';
import { EmptyState } from '../common/EmptyState';
import { Modal } from '../common/Modal';
import { DeleteConfirmModal } from '../common/DeleteConfirmModal';
import { bulkDeleteUsers, deleteOrArchiveUser } from '../../services/deleteManagementService';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useWorkerBranding } from '../../context/BrandingContext';
import { adminService } from '../../services/adminService';

export function isWorkerActiveState(w: Profile | null | undefined): boolean {
  if (!w) return false;
  if (w.is_active !== undefined && w.is_active !== null) {
    return Boolean(w.is_active);
  }
  return true;
}

interface WorkersViewProps {
  workers: Profile[];
  sales: SaleWithDetails[];
  shifts: ShiftWithWorker[];
  settings: BusinessSettings | null;
  onRefresh: () => void;
  onOpenBroadcast?: () => void;
  loading: boolean;
}

export const WorkersView: React.FC<WorkersViewProps> = ({
  workers,
  sales,
  shifts,
  settings,
  onRefresh,
  onOpenBroadcast,
  loading,
}) => {
  const { user: currentAuthUser, profile: currentAuthProfile } = useAuth();
  const { workerPosName } = useWorkerBranding();
  const currency = settings?.currency || 'NGN';

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  const [hiddenWorkerIds, setHiddenWorkerIds] = useState<Set<string>>(new Set());

  // Create / Edit Worker Modal
  const [isWorkerModalOpen, setIsWorkerModalOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Profile | null>(null);
  const [workerForm, setWorkerForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    role: 'cashier' as UserRole,
    isActive: true,
  });

  // Delete Worker State
  const [workerToDelete, setWorkerToDelete] = useState<Profile | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);

  // Success Toast Banner
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 5000);
  };

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const openCreateWorker = () => {
    setEditingWorker(null);
    setWorkerForm({
      fullName: '',
      email: '',
      phone: '',
      password: '',
      role: 'cashier',
      isActive: true,
    });
    setErrorMsg(null);
    setIsWorkerModalOpen(true);
  };

  const openEditWorker = (w: Profile) => {
    setEditingWorker(w);
    setWorkerForm({
      fullName: w.full_name,
      email: w.email,
      phone: w.phone || '',
      password: '',
      role: w.role,
      isActive: isWorkerActiveState(w),
    });
    setErrorMsg(null);
    setIsWorkerModalOpen(true);
  };

  const promptDeleteWorker = (w: Profile) => {
    if (w.id === currentAuthUser?.id) {
      showToast('You cannot delete your own active administrator account.', 'error');
      return;
    }
    setWorkerToDelete(w);
    setDeleteError(null);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDeleteWorker = async () => {
    if (!workerToDelete) return;
    try {
      setIsDeleting(true);
      setDeleteError(null);
      const res = await deleteOrArchiveUser(
        workerToDelete.id,
        workerToDelete.full_name,
        currentAuthProfile?.id || currentAuthUser?.id,
        currentAuthProfile
          ? {
              id: currentAuthProfile.id,
              full_name: currentAuthProfile.full_name,
              role: currentAuthProfile.role,
            }
          : null
      );

      if (!res.success) {
        setDeleteError(res.message || res.error || 'Failed to delete user.');
        return;
      }

      showToast(res.message || 'Staff account permanently deleted.', 'success');
      setIsDeleteModalOpen(false);
      setWorkerToDelete(null);
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete worker.';
      setDeleteError(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmBulkDeleteWorkers = async () => {
    const selectedWorkers = workers.filter((worker) => selectedWorkerIds.includes(worker.id));
    if (selectedWorkers.length === 0) return;
    try {
      setIsBulkDeleting(true);
      setBulkDeleteError(null);
      const result = await bulkDeleteUsers(
        selectedWorkers.map((worker) => ({ id: worker.id, fullName: worker.full_name })),
        currentAuthProfile
          ? { id: currentAuthProfile.id, full_name: currentAuthProfile.full_name, role: currentAuthProfile.role }
          : null
      );
      if (!result.success) {
        setBulkDeleteError('Failed to delete selected items. Please try again.');
        return;
      }
      setSelectedWorkerIds([]);
      setHiddenWorkerIds((prev) => new Set([...prev, ...selectedWorkers.map((worker) => worker.id)]));
      setIsBulkDeleteModalOpen(false);
      showToast(result.message, 'success');
      onRefresh();
    } catch {
      setBulkDeleteError('Failed to delete selected items. Please try again.');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleSaveWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return; // Prevent double submission

    if (!workerForm.fullName.trim()) {
      setErrorMsg('Full Name is required.');
      return;
    }
    if (!workerForm.email.trim()) {
      setErrorMsg('Valid Email address is required.');
      return;
    }

    const cleanEmail = workerForm.email.trim().toLowerCase();
    const cleanPhone = workerForm.phone.trim() || null;

    try {
      setSaving(true);
      setErrorMsg(null);

      if (editingWorker) {
        // Update existing worker profile
        const updatePayload: Record<string, any> = {
          full_name: workerForm.fullName.trim(),
          phone: cleanPhone,
          role: workerForm.role,
          is_active: workerForm.isActive,
          updated_at: new Date().toISOString(),
        };

        let { error } = await supabase
          .from('profiles')
          .update(updatePayload)
          .eq('id', editingWorker.id);

        // Fallback if profiles table doesn't have a phone column
        if (error && error.message?.toLowerCase().includes('phone')) {
          delete updatePayload.phone;
          const retry = await supabase
            .from('profiles')
            .update(updatePayload)
            .eq('id', editingWorker.id);
          error = retry.error;
        }

        if (error) throw error;

        await supabase.from('activity_logs').insert({
          action: 'worker_updated',
          description: `Updated worker profile for ${workerForm.fullName} (Role: ${workerForm.role})`,
          metadata: { worker_id: editingWorker.id, role: workerForm.role, is_active: workerForm.isActive },
        });
      } else {
        // Create new worker via server-side Edge Function / isolated Auth client
        if (!workerForm.password || workerForm.password.length < 6) {
          setErrorMsg('Password must be at least 6 characters.');
          setSaving(false);
          return;
        }

        console.log(`[MUNAJ Workers] Requesting secure worker creation for: ${cleanEmail}`);

        const result = await adminService.createWorkerAccount({
          email: cleanEmail,
          password: workerForm.password,
          fullName: workerForm.fullName.trim(),
          phone: workerForm.phone.trim() || undefined,
          role: workerForm.role,
          isActive: workerForm.isActive,
        });

        if (!result.success) {
          setErrorMsg(result.error || 'Failed to create worker account.');
          setSaving(false);
          return;
        }

        console.log('[MUNAJ Workers] Worker account successfully provisioned:', result.worker?.id);
      }

      setIsWorkerModalOpen(false);
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to save worker profile.';
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  };

  const toggleWorkerActive = async (w: Profile) => {
    try {
      const isCurrentlyActive = isWorkerActiveState(w);
      const nextIsActive = !isCurrentlyActive;

      // Primary update: update is_active in profiles table (canonical schema column)
      const updatePayload = {
        is_active: nextIsActive,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', w.id);

      if (error) {
        console.error('Error toggling worker status:', error);
        showToast(error.message || 'Failed to toggle worker status.', 'error');
        return;
      }

      showToast(
        `Staff account for "${w.full_name}" is now ${nextIsActive ? 'Active' : 'Deactivated'}.`,
        'success'
      );

      try {
        await supabase.from('activity_logs').insert({
          action: nextIsActive ? 'worker_activated' : 'worker_deactivated',
          description: `${nextIsActive ? 'Activated' : 'Deactivated'} account for ${w.full_name}`,
          metadata: { worker_id: w.id, is_active: nextIsActive },
        });
      } catch (logErr) {
        console.warn('[WorkersView] Activity log notice:', logErr);
      }

      onRefresh();
    } catch (err: unknown) {
      console.error('Error toggling worker status:', err);
      const msg = err instanceof Error ? err.message : 'Error toggling worker status';
      showToast(msg, 'error');
    }
  };

  // Compute worker stats (Today sales, active shift)
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const filteredWorkers = useMemo(() => {
    return workers.filter((w) => {
      if (hiddenWorkerIds.has(w.id)) return false;
      // Exclude permanently deleted staff from list
      if (isWorkerDeleted(w)) return false;

      const isWorkerActive = isWorkerActiveState(w);
      if (roleFilter !== 'all' && w.role !== roleFilter) return false;
      if (statusFilter === 'active' && !isWorkerActive) return false;
      if (statusFilter === 'inactive' && isWorkerActive) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        return w.full_name.toLowerCase().includes(q) || w.email.toLowerCase().includes(q);
      }
      return true;
    });
  }, [workers, roleFilter, statusFilter, search, hiddenWorkerIds]);

  const selectableWorkers = filteredWorkers.filter((worker) => worker.id !== currentAuthUser?.id);

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all ${
            toastMessage.type === 'error'
              ? 'bg-red-950/80 border-red-800 text-red-200'
              : toastMessage.type === 'info'
              ? 'bg-blue-950/80 border-blue-800 text-blue-200'
              : 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {toastMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            ) : toastMessage.type === 'info' ? (
              <AlertTriangle className="w-4 h-4 text-blue-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span className="font-medium">{toastMessage.text}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-zinc-400 hover:text-white text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header & Create Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#111111] p-5 rounded-2xl border border-zinc-800/80">
        <div>
          <h2 className="text-lg font-extrabold text-white tracking-tight">
            Staff & Worker Management
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Provision worker credentials, assign bar POS permissions, and monitor active shifts.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {onOpenBroadcast && (
            <button
              onClick={onOpenBroadcast}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-zinc-200 hover:text-white bg-zinc-900 border border-zinc-800 hover:border-emerald-700/60 rounded-xl transition-all shadow-sm"
              title="Send realtime broadcast announcement to worker POS terminals"
            >
              <Send className="w-3.5 h-3.5 text-[#22C55E]" />
              <span>Broadcast Announcement</span>
            </button>
          )}

          <button
            onClick={openCreateWorker}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-black bg-[#22C55E] hover:bg-[#1ea750] rounded-xl transition-all shadow-md shadow-emerald-950/40"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Provision Worker</span>
          </button>
        </div>
      </div>

      {selectedWorkerIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-zinc-900 border border-emerald-500/40 text-xs">
          <span className="font-bold text-white">{selectedWorkerIds.length} user(s) selected</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setSelectedWorkerIds([])} className="px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-800 rounded-xl">Deselect All</button>
            <button onClick={() => { setBulkDeleteError(null); setIsBulkDeleteModalOpen(true); }} className="px-3.5 py-1.5 text-xs font-bold text-red-200 bg-red-950/80 border border-red-800/80 rounded-xl flex items-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Selected ({selectedWorkerIds.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-[#111111] p-4 rounded-2xl border border-zinc-800/80 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by worker name or email..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-[#22C55E] text-white text-xs placeholder:text-zinc-500 outline-none"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white outline-none focus:border-[#22C55E]"
        >
          <option value="all">All Roles</option>
          <option value="cashier">Cashier</option>
          <option value="bar_worker">Bar Worker</option>
          <option value="sales_worker">Sales Worker</option>
          <option value="manager">Manager</option>
          <option value="admin">Administrator</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white outline-none focus:border-[#22C55E]"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active Staff Only</option>
          <option value="inactive">Deactivated Staff</option>
        </select>

        <label className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-zinc-300 bg-zinc-900 rounded-xl border border-zinc-800 cursor-pointer whitespace-nowrap">
          <input
            type="checkbox"
            checked={selectableWorkers.length > 0 && selectableWorkers.every((worker) => selectedWorkerIds.includes(worker.id))}
            onChange={(e) => {
              if (e.target.checked) {
                setSelectedWorkerIds((prev) => Array.from(new Set([...prev, ...selectableWorkers.map((worker) => worker.id)])));
              } else {
                const ids = new Set(selectableWorkers.map((worker) => worker.id));
                setSelectedWorkerIds((prev) => prev.filter((id) => !ids.has(id)));
              }
            }}
            className="rounded border-zinc-700 text-[#22C55E] focus:ring-[#22C55E] bg-zinc-900 cursor-pointer"
          />
          <span>Select All</span>
        </label>
      </div>

      {/* Workers Grid / Table */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredWorkers.length === 0 ? (
          <div className="col-span-full bg-[#111111] p-8 rounded-2xl border border-zinc-800/80">
            <EmptyState
              icon={Users}
              title="No staff members match filters"
              description="Click Provision Worker to create cashiers, bar workers, or managers."
              actionLabel="Provision Worker"
              onAction={openCreateWorker}
            />
          </div>
        ) : (
          filteredWorkers.map((w) => {
            const workerShifts = shifts.filter((s) => s.worker_id === w.id);
            const activeShift = workerShifts.find((s) => s.status === 'active');
            const todayWorkerSales = sales.filter((s) => {
              const t = new Date(s.created_at).getTime();
              return s.worker_id === w.id && t >= startOfToday && s.status === 'completed';
            });
            const todayWorkerTotal = todayWorkerSales.reduce((acc, s) => acc + (Number(s.total) || 0), 0);

            return (
              <div
                key={w.id}
                className="bg-[#111111] rounded-2xl border border-zinc-800/80 p-5 flex flex-col justify-between hover:border-zinc-700 transition-colors"
              >
                <div>
                  {/* Top Bar */}
                  <div className="flex items-start justify-between gap-2 pb-3 border-b border-zinc-800/80">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedWorkerIds.includes(w.id)}
                        disabled={w.id === currentAuthUser?.id}
                        onChange={() => setSelectedWorkerIds((prev) => prev.includes(w.id) ? prev.filter((id) => id !== w.id) : [...prev, w.id])}
                        className="rounded border-zinc-700 text-[#22C55E] focus:ring-[#22C55E] bg-zinc-900 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label={`Select ${w.full_name}`}
                      />
                      <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center text-sm font-bold text-white">
                        {w.full_name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                          {w.full_name}
                          {activeShift && (
                            <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" title="Currently on Shift" />
                          )}
                        </h4>
                        <p className="text-[11px] text-zinc-400 truncate">{w.email}</p>
                        {w.phone && (
                          <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{w.phone}</p>
                        )}
                      </div>
                    </div>

                    <Badge
                      variant={
                        w.role === 'admin'
                          ? 'purple'
                          : w.role === 'manager'
                          ? 'blue'
                          : 'zinc'
                      }
                      size="sm"
                    >
                      {w.role.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>

                  {/* Operational Metrics */}
                  <div className="grid grid-cols-2 gap-2 my-3 p-2.5 rounded-xl bg-[#181818] border border-zinc-800/60 text-xs">
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase font-bold">Shift Status</span>
                      <p className="font-semibold mt-0.5">
                        {activeShift ? (
                          <span className="text-emerald-400">On Duty</span>
                        ) : (
                          <span className="text-zinc-500">Off Shift</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase font-bold">Today's Sales</span>
                      <p className="font-mono font-bold text-white mt-0.5">
                        {formatCurrency(todayWorkerTotal, currency)}
                      </p>
                    </div>
                  </div>

                  <p className="text-[10px] text-zinc-500">
                    Member since {formatDate(w.created_at)}
                  </p>
                </div>

                {/* Foot Actions */}
                {(() => {
                  const isWorkerActive = isWorkerActiveState(w);
                  return (
                    <div className="flex items-center justify-between pt-3 mt-2 border-t border-zinc-800/80">
                      <Badge variant={isWorkerActive ? 'green' : 'zinc'} size="sm">
                        {isWorkerActive ? 'Active' : 'Deactivated'}
                      </Badge>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => toggleWorkerActive(w)}
                          title={isWorkerActive ? 'Deactivate Worker' : 'Activate Worker'}
                          className={`p-1.5 rounded-lg transition-colors ${
                            isWorkerActive
                              ? 'text-emerald-400 hover:bg-emerald-950/40'
                              : 'text-zinc-500 hover:text-white hover:bg-zinc-800'
                          }`}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditWorker(w)}
                          title="Edit Role / Info"
                          className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => promptDeleteWorker(w)}
                          title="Delete User"
                          className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg hover:bg-red-950/40 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })
        )}
      </div>

      {/* Provision / Edit Worker Modal */}
      <Modal
        isOpen={isWorkerModalOpen}
        onClose={() => setIsWorkerModalOpen(false)}
        title={editingWorker ? `Edit Staff — ${editingWorker.full_name}` : 'Provision Staff Account'}
        subtitle={`Worker accounts connect to the ${workerPosName} Worker POS terminal`}
        maxWidth="md"
      >
        <form onSubmit={handleSaveWorker} className="space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-800/80 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Full Name *
            </label>
            <input
              type="text"
              value={workerForm.fullName}
              onChange={(e) => setWorkerForm({ ...workerForm, fullName: e.target.value })}
              placeholder="e.g. John Okon"
              required
              className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-[#22C55E] text-white text-xs outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Email Address *
            </label>
            <input
              type="email"
              value={workerForm.email}
              disabled={!!editingWorker}
              onChange={(e) => setWorkerForm({ ...workerForm, email: e.target.value })}
              placeholder="staff@munajbar.com"
              required
              className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-[#22C55E] text-white text-xs outline-none disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Phone Number
            </label>
            <input
              type="tel"
              value={workerForm.phone}
              onChange={(e) => setWorkerForm({ ...workerForm, phone: e.target.value })}
              placeholder="e.g. +234 801 234 5678"
              className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-[#22C55E] text-white text-xs outline-none"
            />
          </div>

          {!editingWorker && (
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Initial Password *
              </label>
              <input
                type="password"
                value={workerForm.password}
                onChange={(e) => setWorkerForm({ ...workerForm, password: e.target.value })}
                placeholder="Min 6 characters"
                required={!editingWorker}
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-[#22C55E] text-white text-xs outline-none font-mono"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Assigned Role *
            </label>
            <select
              value={workerForm.role}
              onChange={(e) => setWorkerForm({ ...workerForm, role: e.target.value as UserRole })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-[#22C55E] text-white text-xs outline-none"
            >
              <option value="cashier">Cashier (POS Selling & Shifts)</option>
              <option value="bar_worker">Bar Worker (Drink Dispense & POS)</option>
              <option value="sales_worker">Sales Worker (POS Terminal)</option>
              <option value="manager">Manager (Admin Panel Operational Access)</option>
            </select>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="worker_active_check"
              checked={workerForm.isActive}
              onChange={(e) => setWorkerForm({ ...workerForm, isActive: e.target.checked })}
              className="rounded border-zinc-700 text-[#22C55E] focus:ring-[#22C55E] bg-zinc-900"
            />
            <label htmlFor="worker_active_check" className="text-xs font-medium text-zinc-300 cursor-pointer">
              Account is Active (Allowed to authenticate and open shifts)
            </label>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
            {editingWorker ? (
              <button
                type="button"
                onClick={() => {
                  const toDel = editingWorker;
                  setIsWorkerModalOpen(false);
                  promptDeleteWorker(toDel);
                }}
                className="px-3.5 py-2 text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-950/50 rounded-xl transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete User</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsWorkerModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 text-xs font-bold text-black bg-[#22C55E] hover:bg-[#1ea750] rounded-xl transition-all shadow-md shadow-emerald-950/40 disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingWorker ? 'Save Changes' : 'Provision Account'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Delete User Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          if (isDeleting) return;
          setIsDeleteModalOpen(false);
          setWorkerToDelete(null);
          setDeleteError(null);
        }}
        onConfirm={handleConfirmDeleteWorker}
        title="Delete Staff User?"
        subtitle="Permanent removal of worker account from Supabase"
        description={
          <div>
            <p className="text-zinc-300">
              Are you sure you want to delete user account <strong className="text-white">"{workerToDelete?.full_name}"</strong> ({workerToDelete?.email})?
            </p>
            <p className="text-zinc-400 mt-2 text-xs">
              This action will permanently delete this worker account and their credentials from Supabase. All historical sales and shift financial audit records will remain preserved.
            </p>
          </div>
        }
        itemName={workerToDelete?.full_name}
        itemType="Staff Account"
        itemDetails={
          workerToDelete
            ? [
                { label: 'Role', value: workerToDelete.role.toUpperCase() },
                { label: 'Email', value: workerToDelete.email },
                { label: 'User ID', value: workerToDelete.id },
                {
                  label: 'Past Sales',
                  value: `${sales.filter((s) => s.worker_id === workerToDelete.id).length} transactions (preserved)`,
                },
                {
                  label: 'Shifts Logged',
                  value: `${shifts.filter((s) => s.worker_id === workerToDelete.id).length} shifts (preserved)`,
                },
              ]
            : []
        }
        warningNotice="Deleting this user will immediately revoke their access to worker POS terminals and admin panels."
        confirmLabel="Delete User"
        confirmVariant="danger"
        requiresConfirmationText={false}
        loading={isDeleting}
        error={deleteError}
      />

      <DeleteConfirmModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => {
          if (isBulkDeleting) return;
          setIsBulkDeleteModalOpen(false);
          setBulkDeleteError(null);
        }}
        onConfirm={handleConfirmBulkDeleteWorkers}
        title="Delete selected items?"
        description="Are you sure you want to delete the selected user accounts?"
        itemName={`${selectedWorkerIds.length} user accounts`}
        itemType="Selected Users"
        warningNotice="This action will permanently remove the selected items and cannot be undone."
        confirmLabel="DELETE"
        confirmVariant="danger"
        loading={isBulkDeleting}
        error={bulkDeleteError}
      />
    </div>
  );
};
