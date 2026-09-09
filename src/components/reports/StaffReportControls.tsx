import React from 'react';
import {
  Users,
  User,
  Calendar,
  Sparkles,
  FileSpreadsheet,
  ChevronDown,
  Filter,
} from 'lucide-react';
import type { Profile, StaffReportFilter, StaffReportPeriod, StaffReportType } from '../../types';

interface StaffReportControlsProps {
  filter: StaffReportFilter;
  workers: Profile[];
  onChangeFilter: (newFilter: StaffReportFilter) => void;
  onGenerateReport: () => void;
  loading?: boolean;
}

export const StaffReportControls: React.FC<StaffReportControlsProps> = ({
  filter,
  workers,
  onChangeFilter,
  onGenerateReport,
  loading = false,
}) => {
  const periods: { id: StaffReportPeriod; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'this_week', label: 'This Week' },
    { id: 'last_7_days', label: 'Last 7 Days' },
    { id: 'this_month', label: 'This Month' },
    { id: 'last_30_days', label: 'Last 30 Days' },
    { id: 'this_year', label: 'This Year' },
    { id: 'all_time', label: 'All Time' },
    { id: 'custom', label: 'Custom Range' },
  ];

  const handleTypeChange = (type: StaffReportType) => {
    onChangeFilter({
      ...filter,
      reportType: type,
      workerId: type === 'individual' && !filter.workerId && workers.length > 0 ? workers[0].id : filter.workerId,
    });
  };

  const handlePeriodChange = (period: StaffReportPeriod) => {
    onChangeFilter({
      ...filter,
      period,
    });
  };

  const handleWorkerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChangeFilter({
      ...filter,
      workerId: e.target.value,
    });
  };

  return (
    <div className="bg-[#111111] rounded-2xl border border-zinc-800/80 p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-800/70">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-[#22C55E]">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              Staff Performance & Management Reports
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/20">
                Live Supabase Verified
              </span>
            </h3>
            <p className="text-xs text-zinc-400">
              Generate audited performance statements, shift reconciliations, and printable PDF reports.
            </p>
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={onGenerateReport}
          disabled={loading || (filter.reportType === 'individual' && !filter.workerId)}
          className="px-5 py-2.5 rounded-xl bg-[#22C55E] hover:bg-emerald-400 active:scale-[0.98] text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <Sparkles className="w-4 h-4 fill-black text-black" />
          <span>Generate Performance Report</span>
        </button>
      </div>

      {/* Row 1: Report Type & Worker Selection */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
        {/* Scope Pill Toggle */}
        <div className="md:col-span-5">
          <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
            Report Scope
          </label>
          <div className="grid grid-cols-2 bg-zinc-900/90 border border-zinc-800 p-1 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => handleTypeChange('individual')}
              className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                filter.reportType === 'individual'
                  ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700/60'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <User className="w-3.5 h-3.5 text-[#22C55E]" />
              <span>Individual Worker</span>
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('all_workers')}
              className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                filter.reportType === 'all_workers'
                  ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700/60'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-[#22C55E]" />
              <span>All Staff Members</span>
            </button>
          </div>
        </div>

        {/* Worker Dropdown (Only when Individual) */}
        {filter.reportType === 'individual' ? (
          <div className="md:col-span-7">
            <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
              Select Attendant / Cashier
            </label>
            <div className="relative">
              <select
                value={filter.workerId}
                onChange={handleWorkerChange}
                className="w-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700 focus:border-[#22C55E] text-white rounded-xl px-3.5 py-2.5 text-xs font-semibold appearance-none outline-none transition-colors"
              >
                {workers.map((w) => (
                  <option key={w.id} value={w.id} className="bg-zinc-900 text-white">
                    {w.full_name} • {(w.role || 'Staff').toUpperCase()} {w.is_active ? '(Active)' : '(Inactive)'}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        ) : (
          <div className="md:col-span-7 bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-2.5 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-300 font-bold text-xs">
              {workers.length}
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-200">Consolidated Staff Audit</p>
              <p className="text-[11px] text-zinc-400">
                Evaluating all {workers.length} registered bar attendants, cashiers, and managers.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Row 2: Period Selector Buttons */}
      <div>
        <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
          Reporting Period
        </label>
        <div className="flex flex-wrap gap-1.5 bg-zinc-900/60 border border-zinc-800/80 p-1.5 rounded-xl">
          {periods.map((p) => {
            const isSelected = filter.period === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handlePeriodChange(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#22C55E] text-black font-extrabold shadow-sm'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Row 3: Custom Date Range Pickers (If Custom selected) */}
      {filter.period === 'custom' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-zinc-800/60">
          <div>
            <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={filter.startDate}
              onChange={(e) => onChangeFilter({ ...filter, startDate: e.target.value })}
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-[#22C55E] text-white rounded-xl px-3 py-2 text-xs font-mono outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
              End Date
            </label>
            <input
              type="date"
              value={filter.endDate}
              onChange={(e) => onChangeFilter({ ...filter, endDate: e.target.value })}
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-[#22C55E] text-white rounded-xl px-3 py-2 text-xs font-mono outline-none"
            />
          </div>
        </div>
      )}
    </div>
  );
};
