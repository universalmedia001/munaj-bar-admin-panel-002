import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Palette,
  RotateCcw,
  Save,
  CheckCircle2,
  AlertCircle,
  Eye,
  Store,
  ShoppingCart,
  Clock,
  ShieldCheck,
  Smartphone,
  Laptop,
} from 'lucide-react';
import { useWorkerBranding } from '../../context/BrandingContext';
import {
  validateHexColor,
  validateSiteName,
  normalizeHexColor,
} from '../../services/brandingService';
import {
  DEFAULT_WORKER_SITE_NAME,
  DEFAULT_WORKER_PRIMARY_COLOR,
} from '../../types';

const COLOR_PRESETS = [
  { name: 'Electric Lime', hex: '#B7FF00', desc: 'Default Bar Accent' },
  { name: 'Neon Mint', hex: '#00FF88', desc: 'Vibrant Green' },
  { name: 'Emerald', hex: '#22C55E', desc: 'Classic Emerald' },
  { name: 'Cyber Cyan', hex: '#00F0FF', desc: 'Futuristic Blue' },
  { name: 'Amber Gold', hex: '#FFB800', desc: 'Warm Luxury' },
  { name: 'Flame Orange', hex: '#FF5500', desc: 'High Energy' },
  { name: 'Neon Magenta', hex: '#FF007A', desc: 'Nightclub Pink' },
  { name: 'Electric Purple', hex: '#A855F7', desc: 'Ultra Violet' },
  { name: 'Pure White', hex: '#FFFFFF', desc: 'Monochrome Clean' },
];

export const WorkerPOSBrandingSection: React.FC = () => {
  const { branding, updateBranding, resetBranding, isSaving } = useWorkerBranding();

  // Local editing state
  const [siteName, setSiteName] = useState(branding.site_name || DEFAULT_WORKER_SITE_NAME);
  const [primaryColor, setPrimaryColor] = useState(branding.primary_color || DEFAULT_WORKER_PRIMARY_COLOR);
  const [colorInput, setColorInput] = useState(branding.primary_color || DEFAULT_WORKER_PRIMARY_COLOR);

  const [validationError, setValidationError] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [activePreviewTab, setActivePreviewTab] = useState<'sales' | 'login' | 'shift'>('sales');

  // Sync with global branding updates (e.g. initial fetch or realtime changes from another session)
  useEffect(() => {
    setSiteName(branding.site_name || DEFAULT_WORKER_SITE_NAME);
    setPrimaryColor(branding.primary_color || DEFAULT_WORKER_PRIMARY_COLOR);
    setColorInput(branding.primary_color || DEFAULT_WORKER_PRIMARY_COLOR);
  }, [branding]);

  // Handle color input typing
  const handleColorInputChange = (value: string) => {
    let formatted = value.trim();
    if (formatted && !formatted.startsWith('#')) {
      formatted = `#${formatted}`;
    }
    setColorInput(formatted);

    if (validateHexColor(formatted)) {
      setPrimaryColor(normalizeHexColor(formatted));
      setValidationError(null);
    } else {
      if (formatted.length >= 4) {
        setValidationError('Invalid hex colour. Must be format like #B7FF00 or #FFF');
      }
    }
  };

  // Handle native color picker selection
  const handleNativeColorPicker = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hex = e.target.value.toUpperCase();
    setColorInput(hex);
    setPrimaryColor(hex);
    setValidationError(null);
  };

  // Handle preset selection
  const handleSelectPreset = (hex: string) => {
    setColorInput(hex);
    setPrimaryColor(hex);
    setValidationError(null);
  };

  // Handle Save
  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccessMsg(null);
    setSaveErrorMsg(null);

    const nameCheck = validateSiteName(siteName);
    if (!nameCheck.valid) {
      setSaveErrorMsg(nameCheck.error || 'Please enter a valid site name.');
      return;
    }

    if (!validateHexColor(primaryColor)) {
      setSaveErrorMsg('Please provide a valid hexadecimal colour code (e.g. #B7FF00).');
      return;
    }

    const result = await updateBranding({
      site_name: siteName.trim(),
      primary_color: normalizeHexColor(primaryColor),
    });

    if (result.success) {
      setSaveSuccessMsg('✓ Worker POS branding updated successfully');
      setTimeout(() => setSaveSuccessMsg(null), 4500);
    } else {
      setSaveErrorMsg(result.error || 'Failed to update branding in database.');
    }
  };

  // Handle Reset to Default
  const handleConfirmReset = async () => {
    setSaveSuccessMsg(null);
    setSaveErrorMsg(null);
    setIsResetConfirmOpen(false);

    const result = await resetBranding();
    if (result.success) {
      setSiteName(DEFAULT_WORKER_SITE_NAME);
      setPrimaryColor(DEFAULT_WORKER_PRIMARY_COLOR);
      setColorInput(DEFAULT_WORKER_PRIMARY_COLOR);
      setSaveSuccessMsg('✓ Worker POS branding reset to default (MUNAJ BAR, #B7FF00)');
      setTimeout(() => setSaveSuccessMsg(null), 4500);
    } else {
      setSaveErrorMsg(result.error || 'Failed to reset branding.');
    }
  };

  const previewColor = validateHexColor(primaryColor) ? normalizeHexColor(primaryColor) : DEFAULT_WORKER_PRIMARY_COLOR;
  const isModified =
    siteName.trim() !== (branding.site_name || DEFAULT_WORKER_SITE_NAME) ||
    normalizeHexColor(primaryColor) !== normalizeHexColor(branding.primary_color || DEFAULT_WORKER_PRIMARY_COLOR);

  return (
    <div className="bg-[#111111] rounded-2xl border border-zinc-800/80 p-6 space-y-6 shadow-xl">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-black font-bold shadow-lg transition-colors"
            style={{ backgroundColor: previewColor }}
          >
            <Store className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                WORKER POS BRANDING
              </h3>
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-extrabold text-black uppercase tracking-wider"
                style={{ backgroundColor: previewColor }}
              >
                Centralized
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Customize how the Worker POS appears to staff across screens, terminals, receipts, and reports.
            </p>
          </div>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-2 text-xs">
          <div
            className="w-2.5 h-2.5 rounded-full animate-pulse"
            style={{ backgroundColor: previewColor }}
          />
          <span className="text-zinc-300 font-mono text-[11px]">
            Active Accent: <strong className="text-white font-bold">{previewColor}</strong>
          </span>
        </div>
      </div>

      {/* Notifications */}
      {saveSuccessMsg && (
        <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs flex items-center gap-2.5 shadow-md">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
          <span className="font-semibold">{saveSuccessMsg}</span>
        </div>
      )}

      {saveErrorMsg && (
        <div className="p-4 rounded-xl bg-red-950/60 border border-red-800/80 text-red-300 text-xs flex items-center gap-2.5 shadow-md">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
          <span className="font-semibold">{saveErrorMsg}</span>
        </div>
      )}

      {/* Main Grid: Controls + Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form Controls (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Field 1: Worker POS Site Name */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                <span>Worker POS Site Name</span>
                <span className="text-red-400">*</span>
              </label>
              <span className="text-[11px] text-zinc-400 font-mono">
                {siteName.length}/50 chars
              </span>
            </div>
            <div className="relative">
              <input
                type="text"
                value={siteName}
                maxLength={50}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="MUNAJ BAR"
                className="w-full px-4 py-3 rounded-xl bg-zinc-900/90 border border-zinc-700/80 focus:border-white text-white text-sm outline-none font-bold tracking-wide transition-all shadow-inner placeholder-zinc-500"
              />
            </div>
            <p className="text-[11px] text-zinc-400">
              The business name displayed to attendants on login screens, sales dashboard, terminal headers, receipts, and shift statements.
            </p>
          </div>

          {/* Field 2: Primary Brand Colour */}
          <div className="space-y-2 pt-2">
            <label className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5" style={{ color: previewColor }} />
              <span>Primary Brand Colour</span>
              <span className="text-red-400">*</span>
            </label>

            <div className="flex items-center gap-3">
              {/* Color Picker Box */}
              <div className="relative shrink-0">
                <div
                  className="w-12 h-11 rounded-xl border-2 border-zinc-700 flex items-center justify-center shadow-lg transition-transform hover:scale-105 cursor-pointer overflow-hidden"
                  style={{ backgroundColor: previewColor }}
                >
                  <input
                    type="color"
                    value={previewColor}
                    onChange={handleNativeColorPicker}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    title="Click to choose a custom colour"
                  />
                </div>
              </div>

              {/* Hex Code Input */}
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={colorInput}
                  maxLength={7}
                  onChange={(e) => handleColorInputChange(e.target.value)}
                  placeholder="#B7FF00"
                  className={`w-full px-4 py-2.5 rounded-xl bg-zinc-900 border text-sm font-mono tracking-wider outline-none uppercase transition-all ${
                    validationError
                      ? 'border-red-500 text-red-300 focus:ring-1 focus:ring-red-500'
                      : 'border-zinc-700 text-white focus:border-white'
                  }`}
                />
              </div>

              {/* Reset to #B7FF00 quick badge */}
              <button
                type="button"
                onClick={() => handleSelectPreset(DEFAULT_WORKER_PRIMARY_COLOR)}
                className="px-3 py-2.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 text-xs text-zinc-300 font-semibold transition-all shrink-0"
                title="Use default #B7FF00"
              >
                Default Lime
              </button>
            </div>

            {validationError && (
              <p className="text-[11px] text-red-400 font-medium flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {validationError}
              </p>
            )}

            {/* Quick Swatches */}
            <div className="pt-2">
              <p className="text-[11px] font-semibold text-zinc-400 mb-2">
                Quick Preset Palettes:
              </p>
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map((preset) => {
                  const isSelected = normalizeHexColor(primaryColor) === preset.hex;
                  return (
                    <button
                      key={preset.hex}
                      type="button"
                      onClick={() => handleSelectPreset(preset.hex)}
                      className={`group flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-all ${
                        isSelected
                          ? 'border-white bg-zinc-800 text-white font-bold ring-1 ring-white/50'
                          : 'border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-full shrink-0 border border-black/30"
                        style={{ backgroundColor: preset.hex }}
                      />
                      <span>{preset.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setIsResetConfirmOpen(true)}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700/90 text-zinc-300 text-xs font-semibold border border-zinc-700 transition-all disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>RESET TO DEFAULT</span>
            </button>

            <button
              type="button"
              onClick={handleSaveBranding}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-black font-extrabold text-xs shadow-lg transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
              style={{
                backgroundColor: previewColor,
                boxShadow: `0 4px 14px -2px ${previewColor}55`,
              }}
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : 'SAVE BRANDING'}</span>
            </button>
          </div>
        </div>

        {/* Right Column: Live Realtime Preview (5 cols) */}
        <div className="lg:col-span-5 flex flex-col">
          <div className="flex items-center justify-between pb-2 mb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-300">
              <Eye className="w-3.5 h-3.5" style={{ color: previewColor }} />
              <span>LIVE BRANDING PREVIEW</span>
            </div>
            {/* Screen selector */}
            <div className="flex items-center bg-zinc-900 p-0.5 rounded-lg border border-zinc-800 text-[10px]">
              <button
                type="button"
                onClick={() => setActivePreviewTab('sales')}
                className={`px-2 py-1 rounded font-medium transition-all ${
                  activePreviewTab === 'sales' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                POS View
              </button>
              <button
                type="button"
                onClick={() => setActivePreviewTab('login')}
                className={`px-2 py-1 rounded font-medium transition-all ${
                  activePreviewTab === 'login' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Login
              </button>
            </div>
          </div>

          {/* Interactive Preview Canvas */}
          <div className="flex-1 bg-[#050505] rounded-2xl border border-zinc-800 p-4 flex flex-col justify-between relative overflow-hidden shadow-2xl min-h-[300px]">
            {/* Top Bar Preview */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
              <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: previewColor }}
                />
                <span className="font-extrabold text-xs text-white tracking-wider truncate max-w-[140px]">
                  {siteName.trim() || DEFAULT_WORKER_SITE_NAME}
                </span>
              </div>
              <span
                className="px-2 py-0.5 rounded-full text-[9px] font-extrabold text-black uppercase tracking-wider"
                style={{ backgroundColor: previewColor }}
              >
                Worker POS
              </span>
            </div>

            {/* Middle simulated content */}
            {activePreviewTab === 'sales' ? (
              <div className="py-4 space-y-3">
                {/* Active Category tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  <span
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-black shrink-0"
                    style={{ backgroundColor: previewColor }}
                  >
                    Beers & Ciders
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-zinc-900 text-zinc-400 text-[10px] font-medium border border-zinc-800 shrink-0">
                    Whiskey
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-zinc-900 text-zinc-400 text-[10px] font-medium border border-zinc-800 shrink-0">
                    Cocktails
                  </span>
                </div>

                {/* Sample items grid */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-1">
                    <p className="text-[11px] font-bold text-white truncate">Heineken 330ml</p>
                    <p className="text-[10px] font-bold font-mono" style={{ color: previewColor }}>
                      ₦2,500
                    </p>
                    <div
                      className="w-full py-1 rounded-lg text-[10px] font-bold text-black text-center mt-1"
                      style={{ backgroundColor: previewColor }}
                    >
                      + ADD TO CART
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-1">
                    <p className="text-[11px] font-bold text-white truncate">Jameson Black</p>
                    <p className="text-[10px] font-bold font-mono" style={{ color: previewColor }}>
                      ₦38,000
                    </p>
                    <div className="w-full py-1 rounded-lg bg-zinc-800 text-zinc-300 text-[10px] font-bold text-center mt-1 border border-zinc-700">
                      + ADD TO CART
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center space-y-3">
                <div
                  className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center text-black font-extrabold text-lg shadow-lg"
                  style={{ backgroundColor: previewColor }}
                >
                  <Store className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-white tracking-wide">
                    {siteName.trim() || DEFAULT_WORKER_SITE_NAME}
                  </h4>
                  <p className="text-[10px] text-zinc-400">STAFF & CASHIER TERMINAL</p>
                </div>
                <div
                  className="w-full py-2 rounded-xl text-black font-extrabold text-xs shadow-md mx-auto max-w-[200px]"
                  style={{ backgroundColor: previewColor }}
                >
                  [ SIGN IN TO TERMINAL ]
                </div>
              </div>
            )}

            {/* Bottom action button */}
            <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-400">
              <span className="font-mono">CSS: --worker-primary</span>
              <span className="font-mono font-bold text-white">{previewColor}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111111] rounded-2xl border border-zinc-800 p-6 max-w-sm w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Reset Worker POS branding?</h4>
                <p className="text-xs text-zinc-400">This will revert branding to system defaults.</p>
              </div>
            </div>

            <div className="bg-zinc-900/80 p-3.5 rounded-xl border border-zinc-800 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-400">Site name:</span>
                <span className="text-white font-bold">{DEFAULT_WORKER_SITE_NAME}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Primary colour:</span>
                <span className="flex items-center gap-1.5 text-white font-mono font-bold">
                  <span
                    className="w-3 h-3 rounded-full inline-block"
                    style={{ backgroundColor: DEFAULT_WORKER_PRIMARY_COLOR }}
                  />
                  {DEFAULT_WORKER_PRIMARY_COLOR}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold shadow-md"
              >
                RESET
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
