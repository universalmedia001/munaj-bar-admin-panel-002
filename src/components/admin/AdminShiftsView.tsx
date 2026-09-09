import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Users, 
  Wallet, 
  CreditCard, 
  ArrowLeftRight, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight,
  Eye,
  X
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { Profile, ShiftWithWorker } from '../../types';
import { formatCurrency, formatReceiptDate, formatTime } from '../../utils/formatters';

export const AdminShiftsView: React.FC = () => {
  const [activeShifts, setActiveShifts] = useState<ShiftWithWorker[]>([]);
  const [shiftHistory, setShiftHistory] = useState<ShiftWithWorker[]>([]);
  const [workers, setWorkers] = useState<Profile[]>([]);
  const [selectedWorkerFilter, setSelectedWorkerFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Selected Shift Detail Modal
  const [selectedShift, setSelectedShift] = useState<ShiftWithWorker | null>(null);

  const loadShiftsData = async () => {
    try {
      setIsLoading(true);
      const [active, history, workersList] = await Promise.all([
        adminService.getActiveShifts(),
        adminService.getShiftsHistory({ workerId: selectedWorkerFilter, limit: 50 }),
        adminService.getAllWorkers(),
      ]);

      setActiveShifts(active);
      setShiftHistory(history);
      setWorkers(workersList);
    } catch (err) {
      console.error('Error loading shifts data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadShiftsData();
  }, [selectedWorkerFilter]);

  const getDiffBadge = (diff: number | null | undefined) => {
    if (diff === null || diff === undefined) {
      return <span className="text-[#71717A] text-xs">—</span>;
    }
    if (diff === 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20">
          <CheckCircle2 className="w-3 h-3" />
          Balanced (₦0)
        </span>
      );
    }
    if (diff < 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
          <ArrowDownRight className="w-3 h-3" />
          Shortage ({formatCurrency(Math.abs(diff))})
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
        <ArrowUpRight className="w-3 h-3" />
        Overage (+{formatCurrency(diff)})
      </span>
    );
  };

  return (
    <div className="p-4 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#111111] border border-[#222222] p-4 lg:p-6 rounded-2xl">
        <div>
          <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
            <Clock className="w-5 h-5 text-purple-400" />
            <span>Cashier Shifts & Drawer Cash Reconciliation</span>
          </h2>
          <p className="text-xs text-[#A1A1AA] mt-0.5">
            Monitor real-time drawer floats, expected cash, and ending shift variances
          </p>
        </div>

        <button
          onClick={loadShiftsData}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#1A1A1A] hover:bg-[#222222] border border-[#2A2A2A] text-xs font-semibold text-white transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-green-400' : ''}`} />
          <span>Refresh Shifts</span>
        </button>
      </div>

      {/* SECTION 1: Active Shifts Live Overview */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span>Currently Active Cashier Shifts ({activeShifts.length})</span>
          </h3>
          <span className="text-xs text-[#A1A1AA]">Live terminals</span>
        </div>

        {activeShifts.length === 0 ? (
          <div className="p-8 bg-[#111111] border border-[#222222] rounded-2xl text-center text-[#71717A]">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">No cashier registers are currently open.</p>
            <p className="text-xs mt-1">When cashiers open a shift on their POS, their live drawer data appears here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeShifts.map((shift) => {
              const summary = shift.summary;
              return (
                <div
                  key={shift.id}
                  className="bg-[#111111] border border-[#262626] rounded-2xl p-5 space-y-4 hover:border-purple-500/50 transition-colors"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-[#222222]">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-purple-500/20 text-purple-400 font-bold text-xs flex items-center justify-center">
                        {shift.worker?.full_name?.charAt(0).toUpperCase() || 'C'}
                      </div>
                      <div>
                        <p className="font-bold text-white text-xs">{shift.worker?.full_name || 'Cashier'}</p>
                        <p className="text-[10px] text-[#A1A1AA]">{shift.worker?.role || 'cashier'}</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 text-[10px] font-bold uppercase">
                      ACTIVE
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-[#A1A1AA]">
                      <span>Shift Started:</span>
                      <span className="text-white font-medium">{formatTime(shift.started_at)} ({formatReceiptDate(shift.started_at)})</span>
                    </div>
                    <div className="flex justify-between text-[#A1A1AA]">
                      <span>Opening Float:</span>
                      <span className="text-white font-semibold">{formatCurrency(shift.opening_cash)}</span>
                    </div>
                    <div className="flex justify-between text-[#A1A1AA]">
                      <span>Cash Sales:</span>
                      <span className="text-emerald-400 font-semibold">{formatCurrency(summary?.cash_sales || 0)}</span>
                    </div>
                    <div className="flex justify-between text-[#A1A1AA]">
                      <span>POS + Transfer:</span>
                      <span className="text-blue-400 font-semibold">{formatCurrency((summary?.pos_sales || 0) + (summary?.transfer_sales || 0))}</span>
                    </div>
                    <div className="flex justify-between text-[#A1A1AA]">
                      <span>Total Revenue:</span>
                      <span className="text-white font-bold">{formatCurrency(summary?.total_sales || 0)} ({summary?.transaction_count || 0} sales)</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#222222] bg-[#161616] -mx-5 -mb-5 p-4 rounded-b-2xl flex justify-between items-center">
                    <div>
                      <span className="text-[10px] text-[#A1A1AA] uppercase font-semibold">Expected Cash in Drawer</span>
                      <p className="text-base font-bold text-green-400">
                        {formatCurrency(summary?.expected_cash || Number(shift.opening_cash))}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedShift(shift)}
                      className="p-2 rounded-lg bg-[#222222] hover:bg-[#2A2A2A] text-white transition-colors"
                      title="Inspect Shift"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: Shift History & Cash Reconciliation Table */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#A1A1AA]" />
            <span>Shift History & Closing Cash Reconciliation</span>
          </h3>

          <div className="flex items-center gap-2">
            <span className="text-xs text-[#A1A1AA]">Filter Worker:</span>
            <select
              value={selectedWorkerFilter}
              onChange={(e) => setSelectedWorkerFilter(e.target.value)}
              className="px-3 py-1.5 bg-[#181818] border border-[#2A2A2A] rounded-xl text-xs text-white focus:outline-hidden focus:border-purple-500"
            >
              <option value="all">All Workers ({workers.length})</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.full_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-[#111111] border border-[#222222] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#222222] bg-[#141414] text-[11px] font-semibold text-[#A1A1AA] uppercase tracking-wider">
                  <th className="py-3.5 px-4">Shift Date</th>
                  <th className="py-3.5 px-4">Worker</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Opening Cash</th>
                  <th className="py-3.5 px-4 text-right">Cash Sales</th>
                  <th className="py-3.5 px-4 text-right">Total Sales</th>
                  <th className="py-3.5 px-4 text-right">Expected Cash</th>
                  <th className="py-3.5 px-4 text-right">Actual Ending Cash</th>
                  <th className="py-3.5 px-4 text-center">Cash Reconciliation</th>
                  <th className="py-3.5 px-4 text-right">Inspect</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#1A1A1A] text-xs">
                {isLoading ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-[#71717A]">
                      <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      Loading shift logs...
                    </td>
                  </tr>
                ) : shiftHistory.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-[#71717A]">
                      No historical shifts found.
                    </td>
                  </tr>
                ) : (
                  shiftHistory.map((s) => {
                    const isClosed = s.status === 'closed';
                    const cashSales = s.cash_sales || 0;
                    const expectedCash = Number(s.opening_cash) + cashSales;

                    return (
                      <tr key={s.id} className="hover:bg-[#161616] transition-colors">
                        <td className="py-3 px-4 text-[#A1A1AA]">
                          <div>{formatReceiptDate(s.started_at)}</div>
                          <div className="text-[10px] text-[#71717A]">
                            {formatTime(s.started_at)} {s.ended_at ? `→ ${formatTime(s.ended_at)}` : ''}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <p className="font-bold text-white">{s.worker?.full_name || 'Cashier'}</p>
                          <p className="text-[10px] text-[#71717A]">{s.worker?.email}</p>
                        </td>

                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            isClosed
                              ? 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                              : 'bg-green-500/10 text-green-400 border border-green-500/20'
                          }`}>
                            {s.status}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right text-[#A1A1AA]">
                          {formatCurrency(s.opening_cash)}
                        </td>

                        <td className="py-3 px-4 text-right text-emerald-400 font-semibold">
                          {formatCurrency(cashSales)}
                        </td>

                        <td className="py-3 px-4 text-right text-white font-bold">
                          {formatCurrency(s.total_sales || 0)}
                        </td>

                        <td className="py-3 px-4 text-right text-[#E4E4E7] font-semibold">
                          {formatCurrency(expectedCash)}
                        </td>

                        <td className="py-3 px-4 text-right font-bold text-white">
                          {s.ending_cash !== null && s.ending_cash !== undefined ? formatCurrency(s.ending_cash) : '—'}
                        </td>

                        <td className="py-3 px-4 text-center">
                          {isClosed ? getDiffBadge(s.cash_difference) : (
                            <span className="text-[11px] text-green-400 font-medium">In Progress</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setSelectedShift(s)}
                            className="p-1.5 rounded-lg bg-[#1A1A1A] hover:bg-[#2A2A2A] text-[#A1A1AA] hover:text-white"
                          >
                            <Eye className="w-4 h-4" />
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
      </div>

      {/* Shift Details Modal */}
      {selectedShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#111111] border border-[#262626] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-4 lg:p-5 border-b border-[#222222] flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-400" />
                <span>Shift Detail & Audit Breakdown</span>
              </h3>
              <button
                onClick={() => setSelectedShift(null)}
                className="p-1 text-[#A1A1AA] hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-4 rounded-xl bg-[#161616] border border-[#222222] space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#A1A1AA]">Cashier:</span>
                  <span className="font-bold text-white">{selectedShift.worker?.full_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#A1A1AA]">Shift Started:</span>
                  <span className="text-white">{formatReceiptDate(selectedShift.started_at)} at {formatTime(selectedShift.started_at)}</span>
                </div>
                {selectedShift.ended_at && (
                  <div className="flex justify-between">
                    <span className="text-[#A1A1AA]">Shift Ended:</span>
                    <span className="text-white">{formatReceiptDate(selectedShift.ended_at)} at {formatTime(selectedShift.ended_at)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-[#A1A1AA]">Status:</span>
                  <span className="font-bold uppercase text-green-400">{selectedShift.status}</span>
                </div>
              </div>

              {/* Financial Reconcile Grid */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between p-2.5 rounded-lg bg-[#181818]">
                  <span className="text-[#A1A1AA]">Opening Cash Float:</span>
                  <span className="font-bold text-white">{formatCurrency(selectedShift.opening_cash)}</span>
                </div>
                <div className="flex justify-between p-2.5 rounded-lg bg-[#181818]">
                  <span className="text-[#A1A1AA]">Cash Sales Revenue:</span>
                  <span className="font-bold text-emerald-400">{formatCurrency(selectedShift.cash_sales || selectedShift.summary?.cash_sales || 0)}</span>
                </div>
                <div className="flex justify-between p-2.5 rounded-lg bg-[#181818]">
                  <span className="text-[#A1A1AA]">POS / Card Sales:</span>
                  <span className="font-bold text-blue-400">{formatCurrency(selectedShift.pos_sales || selectedShift.summary?.pos_sales || 0)}</span>
                </div>
                <div className="flex justify-between p-2.5 rounded-lg bg-[#181818]">
                  <span className="text-[#A1A1AA]">Bank Transfer Sales:</span>
                  <span className="font-bold text-purple-400">{formatCurrency(selectedShift.transfer_sales || selectedShift.summary?.transfer_sales || 0)}</span>
                </div>
                <div className="flex justify-between p-2.5 rounded-lg bg-[#181818]">
                  <span className="text-[#A1A1AA]">Total Shift Sales:</span>
                  <span className="font-bold text-white">{formatCurrency(selectedShift.total_sales || selectedShift.summary?.total_sales || 0)}</span>
                </div>

                <div className="pt-2 border-t border-[#222222] space-y-2">
                  <div className="flex justify-between p-2.5 rounded-lg bg-[#1A1A1A] border border-[#262626]">
                    <span className="font-semibold text-white">Expected Cash in Drawer:</span>
                    <span className="font-bold text-green-400">
                      {formatCurrency(Number(selectedShift.opening_cash) + Number(selectedShift.cash_sales || selectedShift.summary?.cash_sales || 0))}
                    </span>
                  </div>

                  {selectedShift.status === 'closed' && (
                    <>
                      <div className="flex justify-between p-2.5 rounded-lg bg-[#1A1A1A] border border-[#262626]">
                        <span className="font-semibold text-white">Actual Ending Cash Counted:</span>
                        <span className="font-bold text-white">{formatCurrency(selectedShift.ending_cash || 0)}</span>
                      </div>

                      <div className="flex justify-between items-center p-3 rounded-xl bg-[#141414] border border-[#262626]">
                        <span className="font-bold text-white">Cash Variance:</span>
                        {getDiffBadge(selectedShift.cash_difference)}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {selectedShift.notes && (
                <div className="p-3 rounded-xl bg-[#181818] border border-[#262626] text-xs">
                  <p className="font-bold text-[#A1A1AA] mb-1">Shift Notes:</p>
                  <p className="text-white">{selectedShift.notes}</p>
                </div>
              )}

              <button
                onClick={() => setSelectedShift(null)}
                className="w-full py-2.5 rounded-xl bg-[#1A1A1A] hover:bg-[#222222] text-white text-xs font-bold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
