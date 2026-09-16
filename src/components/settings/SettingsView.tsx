import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Building2,
  Receipt,
  Save,
  CheckCircle2,
  AlertCircle,
  Phone,
  Mail,
  MapPin,
  FileText,
  Sliders,
  Image as ImageIcon,
  Trash2,
  AlertTriangle,
  RotateCcw,
  Database,
  Archive,
  History,
} from 'lucide-react';
import type { BusinessSettings } from '../../types';
import { Badge } from '../common/Badge';
import { ImageUploadArea } from '../common/ImageUploadArea';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { WorkerPOSBrandingSection } from './WorkerPOSBrandingSection';
import { ShiftSettingsSection } from './ShiftSettingsSection';
import { ClearBusinessDataModal } from './ClearBusinessDataModal';
import { BackupHistoryModal } from './BackupHistoryModal';
import { createBackup } from '../../services/backupRestoreService';
import {
  uploadBusinessLogo,
  deleteStorageFile,
  formatStorageErrorMessage,
} from '../../services/storageService';

interface SettingsViewProps {
  settings: BusinessSettings | null;
  onRefresh: () => void;
  loading: boolean;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onRefresh,
  loading,
}) => {
  const { user: currentAuthUser } = useAuth();

  const [formData, setFormData] = useState({
    business_name: '',
    address: '',
    phone: '',
    email: '',
    logo_url: '',
    currency: 'NGN',
    receipt_footer: '',
  });

  const [saving, setSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isBackupHistoryOpen, setIsBackupHistoryOpen] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupMsg, setBackupMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (settings) {
      setFormData({
        business_name: settings.business_name || 'MUNAJ BAR',
        address: settings.address || '',
        phone: settings.phone || '',
        email: settings.email || '',
        logo_url: settings.logo_url || '',
        currency: settings.currency || 'NGN',
        receipt_footer: settings.receipt_footer || 'Thank you for your patronage!',
      });
    }
  }, [settings]);

  const handleLogoSelected = async (file: File) => {
    try {
      setIsUploadingLogo(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      const oldLogoUrl = formData.logo_url;
      const result = await uploadBusinessLogo(file);

      if (!result.success || !result.url) {
        throw new Error(result.error || 'Unable to upload business logo.');
      }

      const newLogoUrl = result.url;
      setFormData((prev) => ({ ...prev, logo_url: newLogoUrl }));

      // Save directly to database for immediate system-wide sync
      const payload = {
        logo_url: newLogoUrl,
        updated_at: new Date().toISOString(),
        updated_by: currentAuthUser?.id || null,
      };

      if (settings?.id) {
        const { error } = await supabase
          .from('business_settings')
          .update(payload)
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        const { data: existingRows } = await supabase
          .from('business_settings')
          .select('id')
          .limit(1);

        if (existingRows && existingRows.length > 0) {
          await supabase
            .from('business_settings')
            .update(payload)
            .eq('id', existingRows[0].id);
        }
      }

      // Cleanup old logo from storage if it was a storage file
      if (oldLogoUrl && oldLogoUrl !== newLogoUrl) {
        deleteStorageFile(oldLogoUrl).catch((err) =>
          console.warn('[SettingsView] Old logo cleanup note:', err)
        );
      }

      // Record activity log
      try {
        await supabase.from('activity_logs').insert({
          action: 'settings_updated',
          description: `Uploaded new business logo for "${formData.business_name || 'MUNAJ BAR'}"`,
          metadata: { logo_url: newLogoUrl },
          actor_id: currentAuthUser?.id || null,
        });
      } catch (logErr) {
        console.warn('[SettingsView] Activity log notice:', logErr);
      }

      setSuccessMsg('Business logo uploaded and updated across the system.');
      setTimeout(() => setSuccessMsg(null), 4000);
      onRefresh();
    } catch (err: unknown) {
      console.error('[SettingsView] Logo upload error:', err);
      const msg = formatStorageErrorMessage(err, 'Unable to upload business logo. Please try again.');
      setErrorMsg(msg);
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleLogoRemoved = async () => {
    try {
      setIsUploadingLogo(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      const oldLogoUrl = formData.logo_url;
      setFormData((prev) => ({ ...prev, logo_url: '' }));

      const payload = {
        logo_url: null,
        updated_at: new Date().toISOString(),
        updated_by: currentAuthUser?.id || null,
      };

      if (settings?.id) {
        const { error } = await supabase
          .from('business_settings')
          .update(payload)
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        const { data: existingRows } = await supabase
          .from('business_settings')
          .select('id')
          .limit(1);

        if (existingRows && existingRows.length > 0) {
          await supabase
            .from('business_settings')
            .update(payload)
            .eq('id', existingRows[0].id);
        }
      }

      if (oldLogoUrl) {
        deleteStorageFile(oldLogoUrl).catch((err) =>
          console.warn('[SettingsView] Logo removal cleanup note:', err)
        );
      }

      try {
        await supabase.from('activity_logs').insert({
          action: 'settings_updated',
          description: `Removed business logo from "${formData.business_name || 'MUNAJ BAR'}"`,
          actor_id: currentAuthUser?.id || null,
        });
      } catch (logErr) {
        console.warn('[SettingsView] Activity log notice:', logErr);
      }

      setSuccessMsg('Business logo removed successfully.');
      setTimeout(() => setSuccessMsg(null), 4000);
      onRefresh();
    } catch (err: unknown) {
      console.error('[SettingsView] Remove logo error:', err);
      const msg = formatStorageErrorMessage(err, 'Unable to remove logo. Please try again.');
      setErrorMsg(msg);
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.business_name.trim()) {
      setErrorMsg('Business name is required.');
      return;
    }

    try {
      setSaving(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      const payload = {
        business_name: formData.business_name.trim(),
        address: formData.address.trim() || null,
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        logo_url: formData.logo_url.trim() || null,
        currency: formData.currency,
        receipt_footer: formData.receipt_footer.trim() || null,
        updated_at: new Date().toISOString(),
        updated_by: currentAuthUser?.id || null,
      };

      if (settings?.id) {
        const { error } = await supabase
          .from('business_settings')
          .update(payload)
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        // Query to check if the single existing row is present
        const { data: existingRows, error: checkErr } = await supabase
          .from('business_settings')
          .select('id')
          .limit(1);

        if (checkErr) throw checkErr;

        if (existingRows && existingRows.length > 0) {
          const { error: updateErr } = await supabase
            .from('business_settings')
            .update(payload)
            .eq('id', existingRows[0].id);

          if (updateErr) throw updateErr;
        } else {
          const { error: insertErr } = await supabase
            .from('business_settings')
            .insert(payload);

          if (insertErr) throw insertErr;
        }
      }

      // Record in activity logs
      try {
        await supabase.from('activity_logs').insert({
          action: 'settings_updated',
          description: `Updated business settings for "${formData.business_name}"`,
          metadata: {
            business_name: formData.business_name,
            currency: formData.currency,
          },
          actor_id: currentAuthUser?.id || null,
        });
      } catch (logErr) {
        console.warn('[SettingsView] Activity log notice:', logErr);
      }

      setSuccessMsg('Business settings successfully saved!');
      setTimeout(() => setSuccessMsg(null), 4000);
      onRefresh();
    } catch (err: unknown) {
      console.error('[SettingsView] Save error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to save settings.';
      setErrorMsg(`Failed to save settings: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const handleBackup = async () => {
    setIsBackingUp(true);
    setBackupMsg(null);
    try {
      const result = await createBackup('MANUAL');
      if (result.success && result.record_counts) {
        const labels: Record<string, string> = {
          categories: 'Categories',
          products: 'Products',
          shifts: 'Shifts',
          sales: 'Sales',
          sale_items: 'Sale Items',
          receipt_prints: 'Receipt Prints',
          stock_movements: 'Stock Movements',
          expenses: 'Expenses',
        };
        const countStr = Object.entries(result.record_counts)
          .filter(([, v]) => v > 0)
          .map(([k, v]) => `${labels[k] || k}: ${v.toLocaleString()}`)
          .join('\n');
        setBackupMsg({
          type: 'success',
          text: `Backup completed successfully.\n${countStr}\nCreated: ${result.created_at ? new Date(result.created_at).toLocaleString() : 'now'}`,
        });
      } else {
        setBackupMsg({ type: 'error', text: result.error || 'Failed to create backup.' });
      }
    } catch (err: any) {
      setBackupMsg({ type: 'error', text: err?.message || 'An unexpected error occurred during backup.' });
    } finally {
      setIsBackingUp(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto">
      {/* Top Banner */}
      <div className="bg-[#111111] p-5 rounded-2xl border border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-white tracking-tight">
            System & Bar Configuration
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Configure venue profile, business logo, Worker POS terminal appearance, 80mm thermal receipt footer, and operating currency.
          </p>
        </div>

        <Badge variant="green" size="md">
          CONFIG ACTIVE
        </Badge>
      </div>

      {/* Centralized Worker POS Branding Section */}
      <WorkerPOSBrandingSection />

      {/* Opening Cash Float & Shift Settings Section */}
      <ShiftSettingsSection settings={settings} onRefresh={onRefresh} />

      {/* Dedicated Business Logo Section */}
      <div className="bg-[#111111] rounded-2xl border border-zinc-800/80 p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-[#22C55E]" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Business Logo
            </h3>
          </div>
          {formData.logo_url && (
            <Badge variant="green" size="sm">
              Logo Active
            </Badge>
          )}
        </div>

        <p className="text-xs text-zinc-400">
          Upload your official MUNAJ BAR logo. The logo is displayed across the Admin Panel header, sidebar, Worker POS terminal, and printed on official 80mm customer receipts.
        </p>

        <div className="max-w-xl">
          <ImageUploadArea
            label="Business Logo"
            sublabel="Upload your MUNAJ BAR logo"
            helperText="PNG, JPG, WEBP • Maximum 5MB"
            currentImageUrl={formData.logo_url || null}
            onImageSelected={handleLogoSelected}
            onImageRemoved={handleLogoRemoved}
            isUploading={isUploadingLogo}
            uploadProgressText="Uploading business logo..."
            disabled={saving || isUploadingLogo}
            previewHeight="h-44"
            changeButtonText="CHANGE LOGO"
            removeButtonText="REMOVE LOGO"
          />
        </div>

        {/* Optional Manual URL input toggle */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowUrlInput(!showUrlInput)}
            className="text-[11px] text-zinc-500 hover:text-zinc-300 underline underline-offset-2 transition-colors"
          >
            {showUrlInput ? 'Hide manual URL input' : 'Or specify an external logo URL'}
          </button>
          {showUrlInput && (
            <div className="mt-2 max-w-xl">
              <input
                type="url"
                value={formData.logo_url}
                onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                placeholder="https://example.com/logo.png"
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-[#22C55E] text-white text-xs outline-none"
              />
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-[#22C55E]" />
            <span className="font-semibold">{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 rounded-2xl bg-red-950/60 border border-red-800/80 text-red-300 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
            <span className="font-semibold">{errorMsg}</span>
          </div>
        )}

        {/* Section 1: Venue Profile */}
        <div className="bg-[#111111] rounded-2xl border border-zinc-800/80 p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-zinc-800">
            <Building2 className="w-4 h-4 text-[#22C55E]" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Venue Information & Contact Details
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Bar / Business Name *
              </label>
              <input
                type="text"
                value={formData.business_name}
                onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                placeholder="MUNAJ BAR"
                required
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-[#22C55E] text-white text-xs outline-none font-bold"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Physical Venue Address
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="e.g. 14 Ahmadu Bello Way, Victoria Island, Lagos"
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-[#22C55E] text-white text-xs outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Contact Phone
              </label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+234 801 234 5678"
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-[#22C55E] text-white text-xs outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Contact Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="contact@munajbar.com"
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-[#22C55E] text-white text-xs outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Regional & Currency Configuration */}
        <div className="bg-[#111111] rounded-2xl border border-zinc-800/80 p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-zinc-800">
            <Sliders className="w-4 h-4 text-[#22C55E]" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Operating Currency
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Operating Currency Symbol
              </label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-[#22C55E] text-white text-xs outline-none font-bold"
              >
                <option value="NGN">NGN (₦) Nigerian Naira</option>
                <option value="USD">USD ($) US Dollar</option>
                <option value="GBP">GBP (£) British Pound</option>
                <option value="EUR">EUR (€) Euro</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: Thermal Receipt Customization */}
        <div className="bg-[#111111] rounded-2xl border border-zinc-800/80 p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-zinc-800">
            <Receipt className="w-4 h-4 text-[#22C55E]" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              80mm Thermal Receipt Customization
            </h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Receipt Footer Closing Text
              </label>
              <textarea
                value={formData.receipt_footer}
                onChange={(e) => setFormData({ ...formData, receipt_footer: e.target.value })}
                rows={2}
                placeholder="e.g. Thank you for partying with MUNAJ BAR! Please drink responsibly."
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-[#22C55E] text-white text-xs outline-none resize-none"
              />
            </div>
          </div>
        </div>

        {/* Submit Bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={saving || isUploadingLogo}
            className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-black bg-[#22C55E] hover:bg-[#1ea750] rounded-xl transition-all shadow-md shadow-emerald-950/40 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving Settings...' : 'Save Configuration'}</span>
          </button>
        </div>
      </form>

      {/* Backup / Restore / Reset — Fresh Business Period Initialization */}
      <div className="bg-zinc-950 p-6 rounded-2xl border border-zinc-800 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
            <Archive className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">
              Fresh Business Period Initialization
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Back up, restore, or reset sales figures, transaction history, and order counts. Workers, accounts, and catalog products remain safe and intact.
            </p>
          </div>
        </div>

        {backupMsg && (
          <div className={`p-3 rounded-lg text-xs whitespace-pre-line flex items-start gap-2 ${
            backupMsg.type === 'success'
              ? 'bg-emerald-950/50 border border-emerald-800 text-emerald-300'
              : 'bg-red-950/50 border border-red-800 text-red-300'
          }`}>
            {backupMsg.type === 'success'
              ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />}
            <span>{backupMsg.text}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          {/* Backup Business Data */}
          <button
            type="button"
            onClick={handleBackup}
            disabled={isBackingUp}
            className="flex-1 px-4 py-2.5 bg-blue-600/90 hover:bg-blue-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-950/40 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isBackingUp ? (
              <>
                <RotateCcw className="w-4 h-4 animate-spin" />
                <span>Backing up...</span>
              </>
            ) : (
              <>
                <Database className="w-4 h-4" />
                <span>Backup Business Data</span>
              </>
            )}
          </button>

          {/* Restore Backup */}
          <button
            type="button"
            onClick={() => setIsBackupHistoryOpen(true)}
            className="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold rounded-xl border border-zinc-700 transition-all flex items-center justify-center gap-2"
          >
            <History className="w-4 h-4" />
            <span>Restore Backup</span>
          </button>

          {/* Clear / Reset Business Data */}
          <button
            type="button"
            onClick={() => setIsResetModalOpen(true)}
            className="flex-1 px-4 py-2.5 bg-red-600/90 hover:bg-red-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-red-950/40 transition-all flex items-center justify-center gap-2"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Clear / Reset Business Data...</span>
          </button>
        </div>
      </div>

      <ClearBusinessDataModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onSuccess={() => {
          setSuccessMsg('✓ Business figures and orders have been reset to ₦0 for a fresh operating period.');
          setTimeout(() => setSuccessMsg(null), 5000);
          onRefresh();
        }}
      />

      <BackupHistoryModal
        isOpen={isBackupHistoryOpen}
        onClose={() => setIsBackupHistoryOpen(false)}
        onRestored={() => {
          setSuccessMsg('✓ Business data restored successfully from backup.');
          setTimeout(() => setSuccessMsg(null), 5000);
          onRefresh();
        }}
      />
    </div>
  );
};
