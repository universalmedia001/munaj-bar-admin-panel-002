import React, { useState, useEffect } from 'react';
import { 
  Printer, 
  Search, 
  RefreshCw, 
  Receipt, 
  Calendar, 
  User, 
  FileText,
  Eye,
  CheckCircle2,
  Trash2
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { SaleWithItems } from '../../types';
import { formatCurrency, formatReceiptDate, formatTime, getSaleSeller } from '../../utils/formatters';

interface AdminReceiptsViewProps {
  onSelectSaleForReprint: (sale: SaleWithItems) => void;
}

export const AdminReceiptsView: React.FC<AdminReceiptsViewProps> = ({
  onSelectSaleForReprint,
}) => {
  const [sales, setSales] = useState<SaleWithItems[]>([]);
  const [printLogs, setPrintLogs] = useState<any[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'receipts' | 'logs'>('receipts');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [logToDelete, setLogToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [salesData, logs] = await Promise.all([
        adminService.getAdminSales({
          page: 1,
          pageSize: 30,
          searchQuery,
          dateFilter: 'all',
        }),
        adminService.getReceiptPrints(40),
      ]);

      setSales(salesData.sales);
      setPrintLogs(logs);
    } catch (err) {
      console.error('Error loading receipts view data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleConfirmDeleteLog = async () => {
    if (!logToDelete) return;
    try {
      setIsDeleting(true);
      await adminService.deleteReceiptPrint(logToDelete.id);
      setLogToDelete(null);
      loadData();
    } catch (err: any) {
      alert('Error removing print log: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#111111] border border-[#222222] p-4 lg:p-6 rounded-2xl">
        <div>
          <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
            <Printer className="w-5 h-5 text-green-400" />
            <span>Thermal Receipts & Print Audit Log</span>
          </h2>
          <p className="text-xs text-[#A1A1AA] mt-0.5">
            Lookup any receipt in history and generate authenticated reprints with print tracking
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex bg-[#181818] p-1 rounded-xl border border-[#262626]">
            <button
              onClick={() => setActiveSubTab('receipts')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeSubTab === 'receipts'
                  ? 'bg-green-500 text-black'
                  : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              All Receipts
            </button>
            <button
              onClick={() => setActiveSubTab('logs')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeSubTab === 'logs'
                  ? 'bg-green-500 text-black'
                  : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              Print Audit Logs
            </button>
          </div>

          <button
            onClick={loadData}
            className="p-2.5 rounded-xl bg-[#1A1A1A] hover:bg-[#222222] border border-[#2A2A2A] text-[#A1A1AA] hover:text-white transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-green-400' : ''}`} />
          </button>
        </div>
      </div>

      {activeSubTab === 'receipts' ? (
        <>
          {/* Search Box */}
          <div className="bg-[#111111] border border-[#222222] p-4 rounded-2xl">
            <form onSubmit={handleSearch} className="relative max-w-md">
              <Search className="w-4 h-4 text-[#A1A1AA] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by receipt number (e.g. MB-000001)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[#181818] border border-[#2A2A2A] rounded-xl text-xs text-white placeholder-[#71717A] focus:outline-hidden focus:border-green-500"
              />
            </form>
          </div>

          {/* Receipts Table */}
          <div className="bg-[#111111] border border-[#222222] rounded-2xl overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#222222] bg-[#141414] text-[11px] font-semibold text-[#A1A1AA] uppercase tracking-wider">
                    <th className="py-3.5 px-4">Receipt #</th>
                    <th className="py-3.5 px-4">Date & Time</th>
                    <th className="py-3.5 px-4">Sold By</th>
                    <th className="py-3.5 px-4">Payment</th>
                    <th className="py-3.5 px-4 text-center">Items</th>
                    <th className="py-3.5 px-4 text-right">Amount (₦)</th>
                    <th className="py-3.5 px-4 text-right">Thermal Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#1A1A1A] text-xs">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-[#71717A]">
                        <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        Loading receipts...
                      </td>
                    </tr>
                  ) : sales.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-[#71717A]">
                        <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        No receipts found matching your search.
                      </td>
                    </tr>
                  ) : (
                    sales.map((s) => {
                      const seller = getSaleSeller(s);
                      return (
                      <tr key={s.id} className="hover:bg-[#161616] transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-white">
                          {s.receipt_number}
                        </td>
                        <td className="py-3 px-4 text-[#A1A1AA]">
                          <div>{formatReceiptDate(s.created_at)}</div>
                          <div className="text-[10px] text-[#71717A]">{formatTime(s.created_at)}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-white">{seller.name}</div>
                          <div className="text-[10px] text-[#71717A]">{seller.role}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-green-500/10 text-green-400 border border-green-500/20">
                            {s.payment_method}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center text-[#E4E4E7]">
                          {s.items?.length || 1}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-white text-sm">
                          {formatCurrency(s.total)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => onSelectSaleForReprint(s)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500 hover:bg-green-400 text-black text-xs font-bold transition-all shadow-sm active:scale-95"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Reprint Thermal</span>
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
        </>
      ) : (
        /* Print History Audit Logs */
        <div className="bg-[#111111] border border-[#222222] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#222222] bg-[#141414] text-[11px] font-semibold text-[#A1A1AA] uppercase tracking-wider">
                  <th className="py-3.5 px-4">Printed Timestamp</th>
                  <th className="py-3.5 px-4">Receipt Number</th>
                  <th className="py-3.5 px-4">Printed By User</th>
                  <th className="py-3.5 px-4 text-center">Print Type</th>
                  <th className="py-3.5 px-4">Reason / Notes</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#1A1A1A] text-xs">
                {printLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-[#71717A]">
                      No thermal print operations recorded yet.
                    </td>
                  </tr>
                ) : (
                  printLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#161616] transition-colors">
                      <td className="py-3 px-4 text-[#A1A1AA]">
                        <div>{formatReceiptDate(log.printed_at)}</div>
                        <div className="text-[10px] text-[#71717A]">{formatTime(log.printed_at)}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-white">
                        {log.sale?.receipt_number || 'N/A'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-white">{log.worker?.full_name || 'Admin'}</span>
                        <span className="text-[10px] text-[#71717A] ml-1.5">({log.worker?.role || 'admin'})</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          log.is_reprint
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-green-500/10 text-green-400 border border-green-500/20'
                        }`}>
                          {log.is_reprint ? 'REPRINT' : 'ORIGINAL'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#E4E4E7]">
                        {log.reason || 'Standard receipt print'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setLogToDelete(log)}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Remove Print Record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Log Safety Modal */}
      {logToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#111111] border border-red-500/30 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Delete Print Log Record?</h3>
                <p className="text-xs text-zinc-400">This removes the print audit entry from records.</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#222222]">
              <button
                onClick={() => setLogToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-[#1A1A1A] hover:bg-[#222222] text-xs font-semibold text-zinc-300"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteLog}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-white text-xs font-bold transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
