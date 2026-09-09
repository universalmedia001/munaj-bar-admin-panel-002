import React, { useState, useEffect, useRef } from 'react';
import { 
  Settings, 
  Store, 
  Printer, 
  Database, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  RotateCcw,
  Palette,
  Sparkles,
  ShoppingBag,
  CreditCard,
  Banknote,
  ArrowRightLeft,
  Eye,
  Radio,
  Check,
  ShieldAlert,
  Wallet,
  ShieldCheck,
  Lock,
  Upload,
  Image as ImageIcon,
  Trash2,
  Link as LinkIcon
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { brandingService, isValidHexColor, normalizeHexColor, getContrastTextColor, DEFAULT_WORKER_BRANDING, DEFAULT_ADMIN_BRANDING } from '../../services/brandingService';
import { BusinessSettings, WorkerPosBranding, AdminBranding } from '../../types';
import { formatNaira } from '../../utils/formatters';

interface AdminSettingsViewProps {
  onOpenConfigModal: () => void;
}

type SettingsSection = 'worker_pos' | 'shift_settings' | 'business_profile';

const WORKER_COLOR_PRESETS = [
  { label: 'Neon Lime (Default)', hex: '#B7FF00' },
  { label: 'Electric Emerald', hex: '#00FF88' },
  { label: 'Cyber Cyan', hex: '#00C2FF' },
  { label: 'Vibrant Violet', hex: '#8B5CF6' },
  { label: 'Sunset Blaze', hex: '#FF5500' },
  { label: 'Solar Gold', hex: '#EAB308' },
  { label: 'Hot Flamingo', hex: '#EC4899' },
  { label: 'Pure White', hex: '#FFFFFF' },
];

const FLOAT_PRESETS = [0, 10000, 20000, 30000, 50000, 100000];

export const AdminSettingsView: React.FC<AdminSettingsViewProps> = ({
  onOpenConfigModal,
}) => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('worker_pos');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Business & Receipt Settings State
  const [settings, setSettings] = useState<BusinessSettings>({
    id: 'default',
    business_name: 'MUNAJ BAR',
    currency_code: 'NGN',
    currency_symbol: '₦',
    phone: '+234 800 000 0000',
    email: 'admin@munajbar.ng',
    address: 'Lagos, Nigeria',
    receipt_header: 'MUNAJ BAR & LOUNGE',
    receipt_footer: 'Thank you for your patronage! Please visit again.',
    default_opening_cash_float: 50000,
    worker_pos_branding: {
      site_name: 'MUNAJ BAR',
      primary_color: '#B7FF00',
    },
    admin_branding: {
      primary_color: '#22C55E',
    },
    logo_url: null,
    updated_at: new Date().toISOString(),
  });

  // Dedicated Worker POS Branding State
  const [workerSiteName, setWorkerSiteName] = useState<string>('MUNAJ BAR');
  const [workerPrimaryColor, setWorkerPrimaryColor] = useState<string>('#B7FF00');
  const [workerHexInput, setWorkerHexInput] = useState<string>('#B7FF00');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState<boolean>(false);
  const [urlInputVisible, setUrlInputVisible] = useState<boolean>(false);
  const [customLogoUrlInput, setCustomLogoUrlInput] = useState<string>('');

  // Default Opening Float State
  const [openingFloatInput, setOpeningFloatInput] = useState<string>('50000');

  // Independent Admin Theme State
  const [adminPrimaryColor, setAdminPrimaryColor] = useState<string>('#22C55E');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load existing settings
  useEffect(() => {
    adminService.getBusinessSettings().then((data) => {
      setSettings(data);
      const wBranding = data.worker_pos_branding || DEFAULT_WORKER_BRANDING;
      setWorkerSiteName(wBranding.site_name || data.business_name || 'MUNAJ BAR');
      const normalizedWColor = normalizeHexColor(wBranding.primary_color, '#B7FF00');
      setWorkerPrimaryColor(normalizedWColor);
      setWorkerHexInput(normalizedWColor);

      const currentLogo = data.logo_url || null;
      setLogoUrl(currentLogo);
      if (currentLogo) {
        setCustomLogoUrlInput(currentLogo);
      }

      const floatVal = typeof data.default_opening_cash_float === 'number' ? data.default_opening_cash_float : 50000;
      setOpeningFloatInput(floatVal.toString());

      const aBranding = data.admin_branding || DEFAULT_ADMIN_BRANDING;
      setAdminPrimaryColor(normalizeHexColor(aBranding.primary_color, '#22C55E'));
      setIsLoading(false);
    }).catch((err) => {
      console.error('Error loading settings:', err);
      setIsLoading(false);
    });
  }, []);

  // Sync color picker when hex input changes (if valid)
  const handleHexInputChange = (value: string) => {
    let formatted = value.trim();
    if (!formatted.startsWith('#') && formatted.length > 0) {
      formatted = '#' + formatted;
    }
    setWorkerHexInput(formatted);
    if (isValidHexColor(formatted)) {
      setWorkerPrimaryColor(normalizeHexColor(formatted));
    }
  };

  const handleColorPickerChange = (hex: string) => {
    const norm = normalizeHexColor(hex);
    setWorkerPrimaryColor(norm);
    setWorkerHexInput(norm);
  };

  const isHexValid = isValidHexColor(workerHexInput);
  const previewTextColor = getContrastTextColor(workerPrimaryColor);

  // Handle File Input Logo Selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (PNG, JPG, SVG, WEBP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Image size must be less than 5MB.');
      return;
    }

    try {
      setIsUploadingLogo(true);
      setErrorMsg(null);
      const uploadedUrl = await adminService.uploadBusinessLogo(file);
      setLogoUrl(uploadedUrl);
      setCustomLogoUrlInput(uploadedUrl);
      
      // Immediately save to business settings and sync
      const updated = await adminService.updateBusinessSettings({
        logo_url: uploadedUrl,
      });
      setSettings(updated);
      setSuccessMsg('Business logo uploaded and synced across all Worker terminals in real-time!');
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      console.error('Logo upload error:', err);
      setErrorMsg(err.message || 'Failed to upload logo.');
    } finally {
      setIsUploadingLogo(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle Custom URL Logo Apply
  const handleApplyCustomLogoUrl = async () => {
    const trimmed = customLogoUrlInput.trim();
    if (!trimmed) {
      handleRemoveLogo();
      return;
    }

    try {
      setIsSaving(true);
      setErrorMsg(null);
      const updated = await adminService.updateBusinessSettings({
        logo_url: trimmed,
      });
      setLogoUrl(trimmed);
      setSettings(updated);
      setUrlInputVisible(false);
      setSuccessMsg('Business logo URL saved and synced across Worker POS!');
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update logo URL.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Remove / Reset Logo
  const handleRemoveLogo = async () => {
    try {
      setIsSaving(true);
      setErrorMsg(null);
      const updated = await adminService.updateBusinessSettings({
        logo_url: null,
      });
      setLogoUrl(null);
      setCustomLogoUrlInput('');
      setSettings(updated);
      setSuccessMsg('Custom logo removed. Default MUNAJ BAR branding restored.');
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to remove logo.');
    } finally {
      setIsSaving(false);
    }
  };

  // Save Worker POS Branding
  const handleSaveWorkerBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    if (!isHexValid) {
      setErrorMsg('Please enter a valid hexadecimal color (e.g. #B7FF00, #00FF88).');
      return;
    }

    try {
      setIsSaving(true);
      const updatedWorkerBranding: WorkerPosBranding = {
        site_name: workerSiteName.trim() || 'MUNAJ BAR',
        primary_color: normalizeHexColor(workerPrimaryColor),
      };

      // Save via service & update database
      await brandingService.saveWorkerBranding(updatedWorkerBranding);
      const updatedSettings = await adminService.updateBusinessSettings({
        worker_pos_branding: updatedWorkerBranding,
        logo_url: logoUrl,
      });

      setSettings(updatedSettings);
      setSuccessMsg(`Worker POS branding saved successfully! Primary colour: ${updatedWorkerBranding.primary_color}. Terminals updated in real-time.`);
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save Worker POS branding.');
    } finally {
      setIsSaving(false);
    }
  };

  // Reset Worker POS Branding to default (#B7FF00 & MUNAJ BAR)
  const handleResetWorkerBranding = async () => {
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      setIsSaving(true);
      const reset = await brandingService.resetWorkerBranding();
      setWorkerSiteName(reset.site_name);
      setWorkerPrimaryColor(reset.primary_color);
      setWorkerHexInput(reset.primary_color);

      const updatedSettings = await adminService.updateBusinessSettings({
        worker_pos_branding: reset,
      });
      setSettings(updatedSettings);
      setSuccessMsg('Worker POS branding reset to default (#B7FF00 / MUNAJ BAR).');
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to reset Worker POS branding.');
    } finally {
      setIsSaving(false);
    }
  };

  // Save Shift & Cash Float Settings
  const handleSaveShiftSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    const floatNum = parseFloat(openingFloatInput.replace(/[^0-9.]/g, '')) || 0;
    if (floatNum < 0) {
      setErrorMsg('Opening cash float cannot be negative.');
      return;
    }

    try {
      setIsSaving(true);
      const updated = await adminService.updateBusinessSettings({
        default_opening_cash_float: floatNum,
      });
      setSettings(updated);
      setOpeningFloatInput(floatNum.toString());
      setSuccessMsg(`Default Opening Cash Float saved successfully: ${formatNaira(floatNum)}. All worker shift starts will automatically use this value.`);
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save shift float settings.');
    } finally {
      setIsSaving(false);
    }
  };

  // Save Business Profile & Receipt Template
  const handleSaveBusinessProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      setIsSaving(true);
      const updated = await adminService.updateBusinessSettings({
        ...settings,
        logo_url: logoUrl,
      });
      setSettings(updated);
      setSuccessMsg('Business profile and receipt template saved successfully.');
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-[#111111] border border-[#222222] p-4 lg:p-6 rounded-2xl gap-4">
        <div>
          <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
            <Settings className="w-5 h-5 text-green-400" />
            <span>Settings & Operations Control</span>
          </h2>
          <p className="text-xs text-[#A1A1AA] mt-0.5">
            Configure Worker POS theme, opening cash float, bar identity, and receipts
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenConfigModal}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1A1A1A] hover:bg-[#222222] border border-[#2A2A2A] text-xs font-semibold text-white transition-colors self-start sm:self-auto cursor-pointer"
        >
          <Database className="w-4 h-4 text-blue-400" />
          <span>DB Diagnostics</span>
        </button>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-[#222222] pb-2 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveSection('worker_pos')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeSection === 'worker_pos'
              ? 'bg-[#B7FF00] text-black shadow-lg shadow-[#B7FF00]/20'
              : 'bg-[#141414] hover:bg-[#1C1C1C] text-[#A1A1AA] hover:text-white border border-[#262626]'
          }`}
        >
          <Palette className="w-4 h-4" />
          <span>Worker POS Branding</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-black/20 font-mono">
            {workerPrimaryColor}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('shift_settings')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeSection === 'shift_settings'
              ? 'bg-amber-400 text-black shadow-lg shadow-amber-900/30'
              : 'bg-[#141414] hover:bg-[#1C1C1C] text-[#A1A1AA] hover:text-white border border-[#262626]'
          }`}
        >
          <Wallet className="w-4 h-4" />
          <span>Shift & Opening Cash Float</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-black/20 font-mono">
            {formatNaira(parseFloat(openingFloatInput) || 50000)}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('business_profile')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeSection === 'business_profile'
              ? 'bg-green-500 text-black shadow-lg shadow-green-900/30'
              : 'bg-[#141414] hover:bg-[#1C1C1C] text-[#A1A1AA] hover:text-white border border-[#262626]'
          }`}
        >
          <Store className="w-4 h-4" />
          <span>Bar Profile & Receipts</span>
        </button>
      </div>

      {/* Feedback Messages */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-xs text-green-400 font-medium flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 font-medium flex items-center gap-2 animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* SECTION 1: WORKER POS BRANDING */}
      {activeSection === 'worker_pos' && (
        <div className="space-y-6">
          <div className="p-4 rounded-2xl bg-[#141414] border border-[#262626] flex items-start gap-3">
            <Radio className="w-5 h-5 text-[#B7FF00] shrink-0 mt-0.5 animate-pulse" />
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Dedicated Worker POS Brand Colour System
              </h4>
              <p className="text-xs text-[#A1A1AA] mt-1 leading-relaxed">
                This setting controls <strong className="text-white">ONLY the Worker POS</strong>. Changing this colour will <strong className="text-white">NOT change the Admin Panel theme</strong>, and changing the Admin Panel colour will NOT change the Worker POS colour. Changes propagate instantly in real-time to all connected cashier screens without clearing active carts, shift data, or sales.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Form Controls */}
            <form onSubmit={handleSaveWorkerBranding} className="lg:col-span-6 space-y-5 bg-[#111111] border border-[#222222] rounded-2xl p-5 sm:p-6">
              
              <div className="flex items-center justify-between pb-3 border-b border-[#222222]">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-[#B7FF00]" />
                  <h3 className="text-sm font-bold text-white">Worker POS Configuration</h3>
                </div>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-[#181818] border border-[#282828] text-[#A1A1AA]">
                  Namespace: worker_pos_branding
                </span>
              </div>

              {/* 1. Worker POS Name */}
              <div>
                <label className="block text-xs font-semibold text-[#E4E4E7] mb-1">
                  Worker POS Establishment / Display Name
                </label>
                <input
                  id="worker-site-name-input"
                  type="text"
                  required
                  value={workerSiteName}
                  onChange={(e) => setWorkerSiteName(e.target.value)}
                  placeholder="MUNAJ BAR"
                  className="w-full px-3.5 py-2.5 bg-[#181818] border border-[#2A2A2A] rounded-xl text-xs text-white font-bold focus:outline-hidden focus:border-[#B7FF00] transition-colors"
                />
                <span className="text-[11px] text-[#71717A] mt-1 block">
                  Displayed on Worker login, header, receipts, and cashier sales reports (e.g. MUNAJ BAR, MUNAJ LOUNGE).
                </span>
              </div>

              {/* 2. Business Brand Logo (Synchronized to Worker POS) */}
              <div className="pt-2 border-t border-[#1C1C1C]">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-[#E4E4E7]">
                    Business Brand Logo (Workers Site Sync)
                  </label>
                  <span className="text-[10px] text-green-400 font-mono font-medium">
                    Auto-synced across POS
                  </span>
                </div>

                {/* Hidden File Input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden"
                />

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  {/* Logo Preview box */}
                  <div className="w-14 h-14 rounded-xl bg-[#141414] border border-[#2A2A2A] flex items-center justify-center p-1 relative group shrink-0 overflow-hidden shadow-inner">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt="Brand Logo"
                        className="w-full h-full object-contain rounded-lg"
                        referrerPolicy="no-referrer"
                        onError={() => setLogoUrl(null)}
                      />
                    ) : (
                      <div
                        className="w-full h-full rounded-lg flex items-center justify-center font-black text-base"
                        style={{
                          backgroundColor: workerPrimaryColor,
                          color: previewTextColor,
                        }}
                      >
                        {workerSiteName.charAt(0).toUpperCase() || 'M'}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex-1 space-y-2 w-full">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        id="upload-business-logo-btn"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingLogo || isSaving}
                        className="px-3 py-1.5 rounded-lg bg-[#1E1E1E] hover:bg-[#282828] border border-[#333333] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Upload className="w-3.5 h-3.5 text-[#B7FF00]" />
                        <span>{isUploadingLogo ? 'UPLOADING...' : 'UPLOAD NEW LOGO'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setUrlInputVisible(!urlInputVisible)}
                        className="px-2.5 py-1.5 rounded-lg bg-[#161616] hover:bg-[#202020] border border-[#2A2A2A] text-[#A1A1AA] hover:text-white text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <LinkIcon className="w-3 h-3" />
                        <span>Link URL</span>
                      </button>

                      {logoUrl && (
                        <button
                          type="button"
                          id="remove-business-logo-btn"
                          onClick={handleRemoveLogo}
                          disabled={isSaving}
                          className="px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                          title="Remove custom logo and use text fallback"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>

                    {urlInputVisible && (
                      <div className="flex items-center gap-2 pt-1 animate-fade-in">
                        <input
                          type="url"
                          value={customLogoUrlInput}
                          onChange={(e) => setCustomLogoUrlInput(e.target.value)}
                          placeholder="https://example.com/logo.png"
                          className="flex-1 px-2.5 py-1.5 bg-[#181818] border border-[#2A2A2A] rounded-lg text-xs text-white focus:outline-hidden focus:border-[#B7FF00]"
                        />
                        <button
                          type="button"
                          onClick={handleApplyCustomLogoUrl}
                          disabled={isSaving}
                          className="px-3 py-1.5 bg-green-500 text-black text-xs font-bold rounded-lg hover:bg-green-400 cursor-pointer disabled:opacity-50"
                        >
                          Apply
                        </button>
                      </div>
                    )}
                    
                    <p className="text-[11px] text-[#71717A]">
                      Recommended format: PNG or SVG with transparent background (Max 5MB).
                    </p>
                  </div>
                </div>
              </div>

              {/* 3. Worker POS Primary Colour Picker & Hex */}
              <div>
                <label className="block text-xs font-semibold text-[#E4E4E7] mb-1">
                  Worker POS Primary Brand Colour
                </label>

                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <input
                      id="worker-color-picker-input"
                      type="color"
                      value={isHexValid ? workerPrimaryColor : '#B7FF00'}
                      onChange={(e) => handleColorPickerChange(e.target.value)}
                      className="w-12 h-11 rounded-xl bg-transparent border-2 border-[#2A2A2A] cursor-pointer p-0.5 overflow-hidden"
                      title="Click to select custom color"
                    />
                  </div>

                  <div className="flex-1 relative">
                    <input
                      id="worker-hex-input"
                      type="text"
                      maxLength={7}
                      value={workerHexInput}
                      onChange={(e) => handleHexInputChange(e.target.value)}
                      placeholder="#B7FF00"
                      className={`w-full px-3.5 py-2.5 bg-[#181818] border rounded-xl text-xs font-mono font-bold text-white transition-colors ${
                        isHexValid
                          ? 'border-[#2A2A2A] focus:border-[#B7FF00]'
                          : 'border-red-500 text-red-300'
                      }`}
                    />
                    <div className="absolute right-3 top-2.5 text-[10px] font-bold">
                      {isHexValid ? (
                        <span className="text-green-400 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Valid
                        </span>
                      ) : (
                        <span className="text-red-400">Invalid Hex</span>
                      )}
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-[#71717A] mt-1">
                  Default: <strong className="text-white font-mono">#B7FF00</strong> (Dedicated neon lime). Enter any valid 6-digit hex code.
                </p>
              </div>

              {/* 3. Preset Quick Color Palette */}
              <div>
                <label className="block text-[11px] font-semibold text-[#A1A1AA] uppercase tracking-wider mb-2">
                  Quick Preset Brand Palettes
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {WORKER_COLOR_PRESETS.map((preset) => {
                    const isSelected = workerPrimaryColor.toUpperCase() === preset.hex.toUpperCase();
                    return (
                      <button
                        key={preset.hex}
                        type="button"
                        onClick={() => handleColorPickerChange(preset.hex)}
                        className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2 ${
                          isSelected
                            ? 'bg-[#1E1E1E] border-white text-white ring-1 ring-white'
                            : 'bg-[#141414] hover:bg-[#1A1A1A] border-[#262626] text-[#A1A1AA]'
                        }`}
                      >
                        <span
                          className="w-4 h-4 rounded-full border border-black/40 shrink-0 shadow-xs"
                          style={{ backgroundColor: preset.hex }}
                        />
                        <span className="text-[11px] font-medium truncate">
                          {preset.hex}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-[#222222] flex flex-col sm:flex-row items-center justify-between gap-3">
                <button
                  type="button"
                  id="reset-worker-branding-btn"
                  onClick={handleResetWorkerBranding}
                  disabled={isSaving}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#1A1A1A] hover:bg-[#222222] border border-[#2A2A2A] text-xs font-semibold text-[#A1A1AA] hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>RESET WORKER POS BRANDING</span>
                </button>

                <button
                  type="submit"
                  id="save-worker-branding-btn"
                  disabled={isSaving || !isHexValid}
                  style={{
                    backgroundColor: workerPrimaryColor,
                    color: previewTextColor,
                  }}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-extrabold transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'SAVING...' : 'SAVE WORKER BRANDING'}</span>
                </button>
              </div>

            </form>

            {/* LIVE WORKER POS PREVIEW CARD */}
            <div className="lg:col-span-6 space-y-4">
              <div className="bg-[#111111] border border-[#222222] rounded-2xl p-5 sm:p-6 relative overflow-hidden">
                <div className="flex items-center justify-between pb-3 border-b border-[#222222] mb-4">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-[#B7FF00]" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                      Live Worker POS Terminal Preview
                    </h3>
                  </div>
                  <span className="flex items-center gap-1.5 text-[10px] text-green-400 font-bold bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    LIVE ACCENT
                  </span>
                </div>

                {/* Simulated Worker POS Window */}
                <div className="bg-[#080808] border border-[#222222] rounded-xl p-4 space-y-4 text-xs">
                  
                  {/* Mini Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-[#1A1A1A]">
                    <div className="flex items-center space-x-2">
                      {logoUrl ? (
                        <div className="w-7 h-7 rounded-lg overflow-hidden bg-[#141414] border border-[#242424] flex items-center justify-center p-0.5 shrink-0">
                          <img
                            src={logoUrl}
                            alt="Logo"
                            className="w-full h-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ) : (
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs shrink-0"
                          style={{
                            backgroundColor: workerPrimaryColor,
                            color: previewTextColor,
                          }}
                        >
                          {workerSiteName.charAt(0).toUpperCase() || 'M'}
                        </div>
                      )}
                      <div>
                        <div className="font-extrabold text-white text-xs tracking-wide">
                          {workerSiteName || 'MUNAJ BAR'}
                        </div>
                        <div className="text-[9px] text-[#71717A]">Worker POS Terminal</div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5 bg-[#141414] border border-[#242424] px-2 py-1 rounded-lg">
                      <span
                        className="w-2 h-2 rounded-full animate-pulse"
                        style={{ backgroundColor: workerPrimaryColor }}
                      />
                      <span className="text-[10px] text-white font-bold">Shift Active</span>
                    </div>
                  </div>

                  {/* Navigation Tabs Simulation */}
                  <div className="flex gap-1.5 overflow-x-hidden">
                    <div
                      className="px-2.5 py-1 rounded-md text-[10px] font-bold"
                      style={{
                        backgroundColor: workerPrimaryColor,
                        color: previewTextColor,
                      }}
                    >
                      POS Register
                    </div>
                    <div className="px-2.5 py-1 rounded-md text-[10px] font-medium bg-[#141414] text-[#A1A1AA] border border-[#222222]">
                      Sales Report
                    </div>
                    <div className="px-2.5 py-1 rounded-md text-[10px] font-medium bg-[#141414] text-[#A1A1AA] border border-[#222222]">
                      Receipts
                    </div>
                  </div>

                  {/* Category Pill Selection */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-[#71717A] font-semibold uppercase">Category Filter</span>
                    <div className="flex gap-1.5">
                      <span
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold"
                        style={{
                          backgroundColor: workerPrimaryColor,
                          color: previewTextColor,
                        }}
                      >
                        ALL DRINKS (Active)
                      </span>
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-[#141414] text-[#71717A] border border-[#222222]">
                        BEERS
                      </span>
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-[#141414] text-[#71717A] border border-[#222222]">
                        SPIRITS
                      </span>
                    </div>
                  </div>

                  {/* Payment Method Selector Simulation */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-[#71717A] font-semibold uppercase">Payment Method</span>
                    <div className="grid grid-cols-3 gap-1.5">
                      <div
                        className="p-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center space-x-1"
                        style={{
                          backgroundColor: workerPrimaryColor,
                          color: previewTextColor,
                        }}
                      >
                        <Banknote className="w-3 h-3" />
                        <span>CASH</span>
                      </div>
                      <div className="p-1.5 rounded-lg text-[10px] font-medium bg-[#141414] text-[#A1A1AA] border border-[#222222] flex items-center justify-center space-x-1">
                        <CreditCard className="w-3 h-3" />
                        <span>POS</span>
                      </div>
                      <div className="p-1.5 rounded-lg text-[10px] font-medium bg-[#141414] text-[#A1A1AA] border border-[#222222] flex items-center justify-center space-x-1">
                        <ArrowRightLeft className="w-3 h-3" />
                        <span>TRANSFER</span>
                      </div>
                    </div>
                  </div>

                  {/* Cart Total & Checkout Button */}
                  <div className="pt-2 border-t border-[#1A1A1A] space-y-2">
                    <div className="flex justify-between items-baseline">
                      <span className="text-[11px] font-bold text-white">TOTAL (NGN)</span>
                      <span
                        className="text-base font-black"
                        style={{ color: workerPrimaryColor }}
                      >
                        ₦45,000.00
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled
                      className="w-full py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-lg"
                      style={{
                        backgroundColor: workerPrimaryColor,
                        color: previewTextColor,
                      }}
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>COMPLETE SALE (₦45,000.00)</span>
                    </button>
                  </div>

                </div>

                <div className="mt-4 p-3 bg-[#161616] border border-[#262626] rounded-xl text-[11px] text-[#A1A1AA] space-y-1">
                  <div className="flex items-center justify-between">
                    <span>Active CSS Variable:</span>
                    <span className="text-white font-mono font-bold">--worker-primary: {workerPrimaryColor}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Contrast Text Color:</span>
                    <span className="text-white font-mono">{previewTextColor}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* SECTION 2: SHIFT & OPENING CASH FLOAT SETTINGS */}
      {activeSection === 'shift_settings' && (
        <div className="space-y-6">
          
          {/* Information Card */}
          <div className="p-4 rounded-2xl bg-[#141414] border border-[#262626] flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Admin-Controlled Opening Cash Float
              </h4>
              <p className="text-xs text-[#A1A1AA] mt-1 leading-relaxed">
                Configure the mandatory cash drawer float assigned to workers when they start their shifts. Workers <strong className="text-white">cannot edit, override, or change</strong> this value on their POS terminals. When workers click <strong className="text-white">START SHIFT</strong>, the system automatically uses this amount.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveShiftSettings} className="bg-[#111111] border border-[#222222] rounded-2xl p-5 sm:p-6 space-y-6">
            
            <div className="flex items-center justify-between pb-3 border-b border-[#222222]">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Default Opening Cash Float</h3>
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                <Lock className="w-3 h-3" />
                Admin Only Access
              </span>
            </div>

            {/* Input and Formatted Value */}
            <div className="max-w-md space-y-3">
              <label className="block text-xs font-semibold text-[#E4E4E7]">
                Opening Cash Float (₦)
              </label>

              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-green-400 font-extrabold text-base">
                  ₦
                </span>
                <input
                  id="admin-default-float-input"
                  type="number"
                  min="0"
                  step="500"
                  required
                  value={openingFloatInput}
                  onChange={(e) => setOpeningFloatInput(e.target.value)}
                  placeholder="50000"
                  className="w-full px-3.5 py-3 pl-10 bg-[#181818] border border-[#2A2A2A] rounded-xl text-base font-bold text-white focus:outline-hidden focus:border-amber-400 transition-colors"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-[#71717A] bg-[#161616] p-2.5 rounded-lg border border-[#242424]">
                <span>Formatted Amount:</span>
                <span className="text-green-400 font-extrabold text-sm">
                  {formatNaira(parseFloat(openingFloatInput) || 0)}
                </span>
              </div>
            </div>

            {/* Float Presets */}
            <div>
              <span className="block text-[11px] font-semibold text-[#71717A] mb-2 uppercase">
                Quick Select Presets
              </span>
              <div className="flex flex-wrap gap-2">
                {FLOAT_PRESETS.map((val) => {
                  const isSelected = (parseFloat(openingFloatInput) || 0) === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setOpeningFloatInput(val.toString())}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-amber-400 text-black shadow-md shadow-amber-900/30'
                          : 'bg-[#181818] text-[#A1A1AA] hover:text-white hover:bg-[#222222] border border-[#262626]'
                      }`}
                    >
                      {formatNaira(val)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-4 border-t border-[#222222] flex justify-end">
              <button
                type="submit"
                id="save-shift-float-btn"
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-extrabold transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'SAVING FLOAT...' : 'SAVE OPENING FLOAT'}</span>
              </button>
            </div>

          </form>

        </div>
      )}

      {/* SECTION 3: BUSINESS PROFILE & THERMAL RECEIPTS */}
      {activeSection === 'business_profile' && (
        <form onSubmit={handleSaveBusinessProfile} className="space-y-6">
          
          {/* Profile Card */}
          <div className="bg-[#111111] border border-[#222222] rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#222222]">
              <Store className="w-4 h-4 text-green-400" />
              <h3 className="text-sm font-bold text-white">Bar Establishment Profile</h3>
            </div>

            {/* Business Logo Field */}
            <div className="p-4 bg-[#161616] border border-[#262626] rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-white">
                  Official Business Logo
                </label>
                <span className="text-[11px] text-[#A1A1AA]">
                  Appears on POS terminals, header, & printed receipts
                </span>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-[#101010] border border-[#333333] flex items-center justify-center p-1 shrink-0 overflow-hidden shadow-md">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Brand Logo"
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div
                      className="w-full h-full rounded-lg flex items-center justify-center font-black text-base"
                      style={{
                        backgroundColor: workerPrimaryColor,
                        color: previewTextColor,
                      }}
                    >
                      {settings.business_name.charAt(0).toUpperCase() || 'M'}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingLogo || isSaving}
                    className="px-3.5 py-2 rounded-xl bg-[#222222] hover:bg-[#2A2A2A] border border-[#3A3A3A] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5 text-green-400" />
                    <span>{isUploadingLogo ? 'Uploading...' : 'Upload Logo'}</span>
                  </button>

                  {logoUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      disabled={isSaving}
                      className="px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove Logo</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#E4E4E7] mb-1">
                  Business / Legal Entity Name
                </label>
                <input
                  type="text"
                  required
                  value={settings.business_name}
                  onChange={(e) => setSettings({ ...settings, business_name: e.target.value })}
                  className="w-full px-3 py-2.5 bg-[#181818] border border-[#2A2A2A] rounded-xl text-xs text-white font-bold focus:outline-hidden focus:border-green-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#E4E4E7] mb-1">
                  Currency Symbol & Code
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    value={settings.currency_symbol}
                    onChange={(e) => setSettings({ ...settings, currency_symbol: e.target.value })}
                    className="px-3 py-2.5 bg-[#181818] border border-[#2A2A2A] rounded-xl text-xs text-white font-bold text-center focus:outline-hidden focus:border-green-500"
                  />
                  <input
                    type="text"
                    required
                    value={settings.currency_code}
                    onChange={(e) => setSettings({ ...settings, currency_code: e.target.value })}
                    className="px-3 py-2.5 bg-[#181818] border border-[#2A2A2A] rounded-xl text-xs text-white font-bold text-center focus:outline-hidden focus:border-green-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#E4E4E7] mb-1">
                  Bar Phone Number
                </label>
                <input
                  type="text"
                  value={settings.phone || ''}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                  className="w-full px-3 py-2.5 bg-[#181818] border border-[#2A2A2A] rounded-xl text-xs text-white focus:outline-hidden focus:border-green-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#E4E4E7] mb-1">
                  Bar Email Address
                </label>
                <input
                  type="email"
                  value={settings.email || ''}
                  onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                  className="w-full px-3 py-2.5 bg-[#181818] border border-[#2A2A2A] rounded-xl text-xs text-white focus:outline-hidden focus:border-green-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#E4E4E7] mb-1">
                Physical Location / Address
              </label>
              <input
                type="text"
                value={settings.address || ''}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                className="w-full px-3 py-2.5 bg-[#181818] border border-[#2A2A2A] rounded-xl text-xs text-white focus:outline-hidden focus:border-green-500"
              />
            </div>
          </div>

          {/* Receipt Customization */}
          <div className="bg-[#111111] border border-[#222222] rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#222222]">
              <Printer className="w-4 h-4 text-green-400" />
              <h3 className="text-sm font-bold text-white">80mm Thermal Receipt Template</h3>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#E4E4E7] mb-1">
                Receipt Header Title (Printed at top)
              </label>
              <input
                type="text"
                value={settings.receipt_header || ''}
                onChange={(e) => setSettings({ ...settings, receipt_header: e.target.value })}
                className="w-full px-3 py-2.5 bg-[#181818] border border-[#2A2A2A] rounded-xl text-xs text-white font-mono focus:outline-hidden focus:border-green-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#E4E4E7] mb-1">
                Receipt Footer Note (Printed at bottom)
              </label>
              <textarea
                rows={2}
                value={settings.receipt_footer || ''}
                onChange={(e) => setSettings({ ...settings, receipt_footer: e.target.value })}
                className="w-full px-3 py-2.5 bg-[#181818] border border-[#2A2A2A] rounded-xl text-xs text-white font-mono focus:outline-hidden focus:border-green-500"
              />
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-green-500 hover:bg-green-400 text-black text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving Settings...' : 'Save Configuration'}</span>
            </button>
          </div>

        </form>
      )}

    </div>
  );
};
