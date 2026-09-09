import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Play, 
  Square, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  CheckCircle2, 
  AlertCircle,
  RefreshCw,
  Banknote,
  CreditCard,
  ArrowRightLeft,
  ReceiptText
} from 'lucide-react';
import { useShift } from '../context/ShiftContext';
import { shiftService } from '../services/shiftService';
import { Shift } from '../types';
import { formatNaira, formatDateTime, formatTime, formatDate } from '../utils/formatters';

export const ShiftHistoryView: React.FC = () => {
  const { 
    activeShift, 
    isShiftActive, 
    shiftSummary, 
    openShiftModal, 
    openCloseShiftModal,
    refreshShift,
    isLoading: isShiftContextLoading 
  } = useShift();

  const [shiftsHistory, setShiftsHistory] = useState<Shift[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(true);

  const loadHistory = async () => {
    try {
      setIsLoadingHistory(true);
      const list = await shiftService.getWorkerShiftHistory();
      setShiftsHistory(list);
    } catch (err) {
      console.error('Error loading shifts history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
    refreshShift();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-6">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#111111] border border-[#222222] rounded-2xl p-4 sm:p-6 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-green-500/15 text-green-400 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-wide">
              MY SHIFT DASHBOARD
            </h2>
            <p className="text-xs text-[#A1A1AA]">
              Monitor current shift float, breakdown of cash vs terminal sales, and past shifts
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            refreshShift();
            loadHistory();
          }}
          title="Refresh Shifts"
          className="self-start sm:self-auto p-2.5 rounded-xl bg-[#181818] hover:bg-[#222222] border border-[#262626] text-[#A1A1AA] hover:text-white transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${isShiftContextLoading || isLoadingHistory ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* ========================================================= */}
      {/* ACTIVE SHIFT SUMMARY CARD                                */}
      {/* ========================================================= */}
      <div className="bg-[#111111] border border-[#262626] rounded-2xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 via-emerald-400 to-green-500" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#222222] gap-3">
          <div className="flex items-center space-x-3">
            <span className={`w-3 h-3 rounded-full ${isShiftActive ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
            <div>
              <h3 className="text-base font-extrabold text-white">
                {isShiftActive ? 'CURRENT ACTIVE SHIFT' : 'NO ACTIVE SHIFT'}
              </h3>
              {isShiftActive && activeShift && (
                <p className="text-xs text-[#A1A1AA]">
                  Started {formatDateTime(activeShift.started_at)}
                </p>
              )}
            </div>
          </div>

          <div>
            {isShiftActive ? (
              <button
                id="view-end-shift-btn"
                onClick={openCloseShiftModal}
                className="w-full sm:w-auto bg-red-500 hover:bg-red-400 text-white font-extrabold px-4 py-2 rounded-xl text-xs flex items-center justify-center space-x-2 shadow-lg shadow-red-900/30 cursor-pointer"
              >
                <Square className="w-3.5 h-3.5 fill-white" />
                <span>END SHIFT & CLOSE REGISTER</span>
              </button>
            ) : (
              <button
                id="view-start-shift-btn"
                onClick={openShiftModal}
                className="w-full sm:w-auto bg-green-500 hover:bg-green-400 text-black font-extrabold px-4 py-2 rounded-xl text-xs flex items-center justify-center space-x-2 shadow-lg shadow-green-900/30 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-black" />
                <span>START NEW SHIFT</span>
              </button>
            )}
          </div>
        </div>

        {isShiftActive && activeShift ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-5">
            
            {/* Opening Cash */}
            <div className="bg-[#181818] border border-[#262626] rounded-xl p-3.5">
              <span className="text-[10px] text-[#A1A1AA] uppercase tracking-wider block font-semibold mb-1">
                Opening Float
              </span>
              <span className="text-base sm:text-lg font-black text-white">
                {formatNaira(activeShift.opening_cash)}
              </span>
            </div>

            {/* Cash Sales */}
            <div className="bg-[#181818] border border-[#262626] rounded-xl p-3.5">
              <div className="flex items-center space-x-1 text-[10px] text-green-400 uppercase tracking-wider font-semibold mb-1">
                <Banknote className="w-3 h-3" />
                <span>Cash Sales</span>
              </div>
              <span className="text-base sm:text-lg font-black text-green-400">
                {formatNaira(shiftSummary?.cash_sales || 0)}
              </span>
            </div>

            {/* POS Sales */}
            <div className="bg-[#181818] border border-[#262626] rounded-xl p-3.5">
              <div className="flex items-center space-x-1 text-[10px] text-cyan-400 uppercase tracking-wider font-semibold mb-1">
                <CreditCard className="w-3 h-3" />
                <span>POS Sales</span>
              </div>
              <span className="text-base sm:text-lg font-black text-cyan-400">
                {formatNaira(shiftSummary?.pos_sales || 0)}
              </span>
            </div>

            {/* Transfer Sales */}
            <div className="bg-[#181818] border border-[#262626] rounded-xl p-3.5">
              <div className="flex items-center space-x-1 text-[10px] text-amber-400 uppercase tracking-wider font-semibold mb-1">
                <ArrowRightLeft className="w-3 h-3" />
                <span>Transfers</span>
              </div>
              <span className="text-base sm:text-lg font-black text-amber-400">
                {formatNaira(shiftSummary?.transfer_sales || 0)}
              </span>
            </div>

            {/* Transactions Count */}
            <div className="bg-[#181818] border border-[#262626] rounded-xl p-3.5">
              <div className="flex items-center space-x-1 text-[10px] text-[#A1A1AA] uppercase tracking-wider font-semibold mb-1">
                <ReceiptText className="w-3 h-3" />
                <span>Sales Count</span>
              </div>
              <span className="text-base sm:text-lg font-black text-white">
                {shiftSummary?.transaction_count || 0}
              </span>
            </div>

            {/* Total Shift Sales */}
            <div className="bg-[#181818] border border-green-500/40 rounded-xl p-3.5 shadow-md shadow-green-950/20">
              <span className="text-[10px] text-[#A1A1AA] uppercase tracking-wider block font-semibold mb-1">
                Total Sales
              </span>
              <span className="text-base sm:text-lg font-black text-green-400">
                {formatNaira(shiftSummary?.total_sales || 0)}
              </span>
            </div>

          </div>
        ) : (
          <div className="py-8 text-center">
            <p className="text-sm text-[#A1A1AA] max-w-md mx-auto mb-4">
              You must start your shift to log your opening drawer float and process customer sales at MUNAJ BAR.
            </p>
            <button
              onClick={openShiftModal}
              className="bg-green-500 hover:bg-green-400 text-black font-extrabold px-6 py-3 rounded-xl text-xs sm:text-sm inline-flex items-center space-x-2 shadow-lg shadow-green-900/40 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-black" />
              <span>START YOUR SHIFT</span>
            </button>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* PREVIOUS SHIFTS HISTORY TABLE                            */}
      {/* ========================================================= */}
      <div className="bg-[#111111] border border-[#222222] rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 sm:p-5 border-b border-[#222222] flex items-center justify-between">
          <h3 className="text-base font-bold text-white tracking-wide">
            PREVIOUS SHIFTS HISTORY
          </h3>
          <span className="text-xs text-[#71717A]">
            {shiftsHistory.length} total shifts recorded
          </span>
        </div>

        {isLoadingHistory ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-white font-semibold">Loading shift history...</p>
          </div>
        ) : shiftsHistory.length === 0 ? (
          <div className="p-12 text-center">
            <Clock className="w-12 h-12 text-[#333333] mx-auto mb-3" />
            <h4 className="text-base font-bold text-white mb-1">No previous shifts</h4>
            <p className="text-xs text-[#A1A1AA]">
              Your closed shifts and cash reconciliations will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-[#181818] border-b border-[#222222] text-[#A1A1AA] uppercase text-[11px] font-semibold tracking-wider">
                <tr>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Started</th>
                  <th className="py-3 px-4">Ended</th>
                  <th className="py-3 px-4 text-right">Opening Float</th>
                  <th className="py-3 px-4 text-right">Expected Cash</th>
                  <th className="py-3 px-4 text-right">Actual Count</th>
                  <th className="py-3 px-4 text-right">Difference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1c1c1c]">
                {shiftsHistory.map((s) => {
                  const diff = s.cash_difference;
                  return (
                    <tr key={s.id} className="hover:bg-[#161616] transition-colors">
                      <td className="py-3.5 px-4">
                        {s.status === 'open' ? (
                          <span className="inline-flex items-center space-x-1 bg-green-500/15 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            <span>Open</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 bg-[#222222] text-[#A1A1AA] px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase">
                            <span>Closed</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-white">
                        {formatDateTime(s.started_at)}
                      </td>

                      <td className="py-3.5 px-4 text-[#A1A1AA]">
                        {s.ended_at ? formatDateTime(s.ended_at) : 'In Progress'}
                      </td>

                      <td className="py-3.5 px-4 text-right text-white font-medium">
                        {formatNaira(s.opening_cash)}
                      </td>

                      <td className="py-3.5 px-4 text-right text-white font-medium">
                        {s.expected_cash !== null ? formatNaira(s.expected_cash) : '---'}
                      </td>

                      <td className="py-3.5 px-4 text-right font-bold text-white">
                        {s.ending_cash !== null ? formatNaira(s.ending_cash) : '---'}
                      </td>

                      <td className="py-3.5 px-4 text-right font-extrabold">
                        {diff === null ? (
                          <span className="text-[#71717A]">---</span>
                        ) : diff === 0 ? (
                          <span className="text-green-400">₦0 (Exact)</span>
                        ) : diff > 0 ? (
                          <span className="text-blue-400">+{formatNaira(diff)}</span>
                        ) : (
                          <span className="text-red-400">{formatNaira(diff)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
