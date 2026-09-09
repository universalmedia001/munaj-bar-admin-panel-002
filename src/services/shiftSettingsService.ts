import { supabase } from '../lib/supabase';
import type { BusinessSettings, Profile } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';

export interface ShiftSettingsUpdateResult {
  success: boolean;
  message: string;
  previousAmount?: number;
  newAmount?: number;
}

export interface ShiftSettingsValidationResult {
  isValid: boolean;
  amount: number;
  errorMessage?: string;
}

function getSupabaseErrorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const details = error as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown };
    const parts = [details.message, details.code, details.details, details.hint]
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
      .map((part) => part.trim());

    if (parts.length > 0) return parts.join(' | ');
  }

  return error instanceof Error ? error.message : 'Unable to update shift settings.';
}

/**
 * Validates the opening cash float input
 * - Must be a valid non-empty number string or number
 * - Must not be negative
 * - Supports 0, decimals, commas
 */
export function validateOpeningCashFloat(input: string | number): ShiftSettingsValidationResult {
  if (typeof input === 'number') {
    if (isNaN(input) || !isFinite(input) || input < 0) {
      return {
        isValid: false,
        amount: 0,
        errorMessage: 'Please enter a valid opening cash float.',
      };
    }
    return {
      isValid: true,
      amount: Math.round(input * 100) / 100,
    };
  }

  const raw = String(input || '').trim().replace(/,/g, '').replace(/^[₦$£€\s]+/, '');

  if (raw === '') {
    return {
      isValid: false,
      amount: 0,
      errorMessage: 'Please enter a valid opening cash float.',
    };
  }

  // Check valid numerical format (including optional decimal)
  const numRegex = /^\d+(\.\d{1,2})?$/;
  if (!numRegex.test(raw)) {
    return {
      isValid: false,
      amount: 0,
      errorMessage: 'Please enter a valid opening cash float.',
    };
  }

  const parsed = parseFloat(raw);
  if (isNaN(parsed) || !isFinite(parsed) || parsed < 0) {
    return {
      isValid: false,
      amount: 0,
      errorMessage: 'Please enter a valid opening cash float.',
    };
  }

  return {
    isValid: true,
    amount: Math.round(parsed * 100) / 100,
  };
}

/**
 * Checks if current user role has permission to configure shift settings
 * Super Admin & Admin: Always
 * Manager: Allowed
 * Cashier / Bar Staff: Forbidden
 */
export function canManageShiftSettings(role?: string | null): boolean {
  if (!role) return false;
  const normalized = role.toLowerCase().trim();
  return normalized === 'admin' || normalized === 'super_admin' || normalized === 'manager';
}

/**
 * Updates the Default Opening Cash Float in business_settings and records an audit log
 */
export async function updateDefaultOpeningCashFloat(
  newAmount: number,
  adminUser?: { id?: string; full_name?: string; role?: string } | null,
  existingSettings?: BusinessSettings | null
): Promise<ShiftSettingsUpdateResult> {
  // 1. Role verification
  if (!adminUser?.role || !canManageShiftSettings(adminUser.role)) {
    return {
      success: false,
      message: 'Unauthorized: Only administrators can change the default opening cash float.',
    };
  }

  // 2. Validate amount
  const validation = validateOpeningCashFloat(newAmount);
  if (!validation.isValid) {
    return {
      success: false,
      message: validation.errorMessage || 'Please enter a valid opening cash float.',
    };
  }

  const validatedFloat = validation.amount;
  const previousFloat = existingSettings?.default_opening_cash ?? 50000;
  const currency = existingSettings?.currency || 'NGN';

  try {
    const payload = {
      default_opening_cash: validatedFloat,
      updated_at: new Date().toISOString(),
      updated_by: adminUser?.id || null,
    };

    let targetId = existingSettings?.id;

    if (!targetId) {
      const { data: rows, error: fetchErr } = await supabase
        .from('business_settings')
        .select('id')
        .limit(1);

      if (fetchErr) throw fetchErr;

      if (rows && rows.length > 0) {
        targetId = rows[0].id;
      }
    }

    if (targetId) {
      const { error: updateErr } = await supabase
        .from('business_settings')
        .update(payload)
        .eq('id', targetId);

      if (updateErr) throw updateErr;
    } else {
      const { error: insertErr } = await supabase
        .from('business_settings')
        .insert({
          business_name: 'MUNAJ BAR',
          currency: 'NGN',
          receipt_footer: 'Thank you for patronizing MUNAJ BAR.',
          ...payload,
        });

      if (insertErr) throw insertErr;
    }

    // 3. Record in System Audit Trail / Activity Logs
    try {
      const adminName = adminUser?.full_name || 'Admin';
      const formattedDate = formatDate(new Date().toISOString());
      const prevFormatted = formatCurrency(previousFloat, currency);
      const newFormatted = formatCurrency(validatedFloat, currency);

      const description = `SHIFT SETTING UPDATED\nAdmin changed Default Opening Cash Float\nPrevious: ${prevFormatted}\nNew: ${newFormatted}\nChanged by: ${adminName}\nDate: ${formattedDate}`;

      await supabase.from('activity_logs').insert({
        action: 'shift_setting_updated',
        entity_type: 'business_settings',
        entity_id: targetId || null,
        description: description,
        actor_id: adminUser?.id || null,
        metadata: {
          event: 'SHIFT SETTING UPDATED',
          setting: 'default_opening_cash',
          previous_amount: previousFloat,
          new_amount: validatedFloat,
          changed_by: adminName,
          date: formattedDate,
        },
      });
    } catch (logErr) {
      console.warn('[shiftSettingsService] Audit log creation notice:', logErr);
    }

    return {
      success: true,
      message: 'Opening cash float updated successfully.',
      previousAmount: previousFloat,
      newAmount: validatedFloat,
    };
  } catch (err: unknown) {
    console.error('[shiftSettingsService] Error updating opening cash float:', err);
    const msg = getSupabaseErrorMessage(err);
    return {
      success: false,
      message: `Failed to update opening cash float: ${msg}`,
    };
  }
}
