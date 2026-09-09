import React, { useState, useEffect } from 'react';
import {
  Banknote,
  ShieldCheck,
  Save,
  CheckCircle2,
  AlertCircle,
  Clock,
  Lock,
  RotateCcw,
  Sparkles,
  Info,
  Printer,
} from 'lucide-react';
import type { BusinessSettings } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  validateOpeningCashFloat,
  updateDefaultOpeningCashFloat,
  canManageShiftSettings,
} from '../../services/shiftSettingsService';
import { Badge } from '../common/Badge';
import { findQzPrinters } from '../../services/qzPrintService';

interface ShiftSettingsSectionProps {
  settings: BusinessSettings | null;
  onRefresh: () => void;
}

export const ShiftSettingsSection: React.FC<ShiftSettingsSectionProps> = ({
  settings,
  onRefresh,
}) => {
  const { profile: currentAuthProfile } = useAuth();
  const isAdminAuthorized = canManageShiftSettings(currentAuthProfile?.role);
  const currency = settings?.currency || 'NGN';

  const defaultStoredFloat = settings?.default_opening_cash ?? 50000;
  const [openingCashInput, setOpeningCashInput] = useState<string>(String(defaultStoredFloat));
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [availablePrinters, setAvailablePrinters] = useState<string[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState(settings?.receipt_printer_name || '');
  const [detectingPrinters, setDetectingPrinters] = useState(false);
  const [savingPrinter, setSavingPrinter] = useState(false);

  // Sync state when settings prop updates
  useEffect(() => {
    if (settings?.default_opening_cash !== undefined && settings?.default_opening_cash !== null) {
      setOpeningCashInput(String(settings.default_opening_cash));
    }
    setSelectedPrinter(settings?.receipt_printer_name || '');
  }, [settings?.default_opening_cash, settings?.receipt_printer_name]);

  const presetAmounts = [0, 10000, 20000, 50000, 100000];

  const handlePresetSelect = (amount: number) => {
    if (!isAdminAuthorized) return;
    setOpeningCashInput(String(amount));
    setErrorMessage(null);
  };

  const handleDetectPrinters = async () => {
    setDetectingPrinters(true);
    setErrorMessage(null);
    try {
      const printers = await findQzPrinters();
      setAvailablePrinters(printers);
      if (!selectedPrinter && printers.length === 1) setSelectedPrinter(printers[0]);
      if (printers.length === 0) setErrorMessage('No receipt printer found. Please install and open QZ Tray.');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Printer service is not connected. Please open QZ Tray and try again.');
    } finally {
      setDetectingPrinters(false);
    }
  };

  const handleSavePrinter = async () => {
    if (!isAdminAuthorized) {
      setErrorMessage('Unauthorized: Only administrators can change this value.');
      return;
    }
    if (!selectedPrinter) {
      setErrorMessage('No receipt printer found. Please select a printer in Settings.');
      return;
    }

    setSavingPrinter(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const payload = {
        receipt_printer_name: selectedPrinter,
        updated_at: new Date().toISOString(),
        updated_by: currentAuthProfile?.id || null,
      };
      const query = settings?.id
        ? supabase.from('business_settings').update(payload).eq('id', settings.id)
        : supabase.from('business_settings').update(payload).limit(1);
      const { error } = await query;
      if (error) throw error;
      setSuccessMessage('Receipt printer saved successfully.');
      onRefresh();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to save receipt printer.');
    } finally {
      setSavingPrinter(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAdminAuthorized) {
      setErrorMessage('Unauthorized: Only administrators can change this value.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    // Validate float input
    const validation = validateOpeningCashFloat(openingCashInput);
    if (!validation.isValid) {
      setErrorMessage('Please enter a valid opening cash float.');
      return;
    }

    try {
      setSaving(true);
      const result = await updateDefaultOpeningCashFloat(
        validation.amount,
        currentAuthProfile ? {
          id: currentAuthProfile.id,
          full_name: currentAuthProfile.full_name,
          role: currentAuthProfile.role,
        } : null,
        settings
      );

      if (!result.success) {
        setErrorMessage(result.message);
        return;
      }

      setSuccessMessage('Opening cash float updated successfully.');
      setTimeout(() => setSuccessMessage(null), 5000);
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to save shift settings.';
      setErrorMessage(`Failed to save: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div id="shift-settings-card" className="bg-[#111111] rounded-2xl border border-zinc-800/80 p-5 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-950/60 border border-emerald-800/50 flex items-center justify-center text-[#22C55E]">
            <Banknote className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Shift Settings
            </h3>
            <p className="text-[11px] text-zinc-400">
              Configure initial drawer cash balance allocated when workers open new shifts
            </p>
          </div>

        </div>

        <div className="flex items-center gap-2">
          {isAdminAuthorized ? (
            <Badge variant="green" size="sm">
              <ShieldCheck className="w-3 h-3 mr-1" />
              ADMIN CONTROLLED
            </Badge>
          ) : (
            <Badge variant="zinc" size="sm">
              <Lock className="w-3 h-3 mr-1" />
              READ ONLY
            </Badge>
          )}
        </div>
      </div>

      <div className="max-w-xl space-y-2">
        <label className="block text-xs font-bold text-zinc-200 uppercase tracking-wide">
          Receipt Printer
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={selectedPrinter}
            onChange={(e) => setSelectedPrinter(e.target.value)}
            disabled={!isAdminAuthorized || savingPrinter}
            className="flex-1 px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-[#22C55E] text-white text-xs outline-none disabled:opacity-50"
          >
            <option value="">Select a detected printer</option>
            {availablePrinters.map((printer) => <option key={printer} value={printer}>{printer}</option>)}
            {selectedPrinter && !availablePrinters.includes(selectedPrinter) && (
              <option value={selectedPrinter}>{selectedPrinter} (saved)</option>
            )}
          </select>
          <button
            type="button"
            onClick={handleDetectPrinters}
            disabled={!isAdminAuthorized || detectingPrinters}
            className="flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-zinc-200 bg-zinc-800 hover:bg-zinc-700 rounded-xl disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            {detectingPrinters ? 'Detecting...' : 'Detect Printers'}
          </button>
          <button
            type="button"
            onClick={handleSavePrinter}
            disabled={!isAdminAuthorized || savingPrinter || !selectedPrinter}
            className="flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs font-bold text-black bg-[#22C55E] hover:bg-[#1ea750] rounded-xl disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            Save Printer
          </button>
        </div>
        <p className="text-[11px] text-zinc-400">QZ Tray must be open on this computer to detect and print receipts.</p>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div id="shift-settings-success" className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs flex items-center gap-2.5 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-[#22C55E]" />
          <span className="font-semibold">{successMessage}</span>
        </div>
      )}

      {/* Error Notification */}
      {errorMessage && (
        <div id="shift-settings-error" className="p-4 rounded-xl bg-red-950/60 border border-red-800/80 text-red-300 text-xs flex items-center gap-2.5 animate-fadeIn">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span className="font-semibold">{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <div className="max-w-xl space-y-3">
          <div>
            <label className="block text-xs font-bold text-zinc-200 uppercase tracking-wide mb-1.5">
              Default Opening Cash Float
            </label>
            <div className="relative rounded-xl shadow-inner bg-zinc-900 border border-zinc-800 focus-within:border-[#22C55E] transition-colors">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold font-mono text-sm">
                ₦
              </span>
              <input
                id="default-opening-cash-input"
                type="text"
                disabled={!isAdminAuthorized || saving}
                value={openingCashInput}
                onChange={(e) => setOpeningCashInput(e.target.value)}
                placeholder="50000"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-transparent text-white text-sm font-mono font-bold outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <p className="text-[11px] text-zinc-400 mt-1.5 flex items-center gap-1.5">
              <Lock className="w-3 h-3 text-emerald-400 shrink-0" />
              <span>Only administrators can change this value.</span>
            </p>
          </div>

          {/* Preset Quick-Select Chips */}
          {isAdminAuthorized && (
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                Quick Presets:
              </span>
              <div className="flex flex-wrap gap-2">
                {presetAmounts.map((amt) => {
                  const isSelected = openingCashInput === String(amt);
                  return (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => handlePresetSelect(amt)}
                      className={`px-3 py-1 text-xs font-mono font-bold rounded-lg border transition-all ${
                        isSelected
                          ? 'bg-[#22C55E]/15 border-[#22C55E] text-[#22C55E]'
                          : 'bg-zinc-900/90 border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-white'
                      }`}
                    >
                      {formatCurrency(amt, currency)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Information & Security Banner */}
          <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800/80 text-[11px] text-zinc-400 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-zinc-300">
              <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>Shift Security & Float Behavior</span>
            </div>
            <ul className="list-disc pl-4 space-y-1 text-zinc-400">
              <li>
                Workers cannot choose or modify the opening cash amount when starting a shift on the Worker POS.
              </li>
              <li>
                New shifts will automatically be assigned this configured amount (<strong>{formatCurrency(validateOpeningCashFloat(openingCashInput).amount || 0, currency)}</strong>).
              </li>
              <li>
                Historical shifts remain unaltered to preserve auditing integrity.
              </li>
            </ul>
          </div>
        </div>

        {/* Action Controls */}
        {isAdminAuthorized && (
          <div className="flex items-center justify-start gap-3 pt-2">
            <button
              id="save-shift-settings-btn"
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-black bg-[#22C55E] hover:bg-[#1ea750] rounded-xl transition-all shadow-md shadow-emerald-950/40 disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'SAVE SETTINGS'}</span>
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
