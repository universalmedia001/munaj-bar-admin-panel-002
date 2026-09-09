import { supabase } from '../lib/supabase';
import type { WorkerBranding } from '../types';
import { DEFAULT_WORKER_SITE_NAME, DEFAULT_WORKER_PRIMARY_COLOR } from '../types';

const STORAGE_CACHE_KEY = 'munaj_worker_branding_cache_v1';
const REALTIME_CHANNEL_NAME = 'worker_branding_sync_channel';

/**
 * Validates whether a given string is a valid Hexadecimal colour code (e.g. #B7FF00, #FFF, #00FF88)
 */
export function validateHexColor(hex: string): boolean {
  if (!hex || typeof hex !== 'string') return false;
  const trimmed = hex.trim();
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(trimmed);
}

/**
 * Normalizes a hex color string to uppercase #RRGGBB format
 */
export function normalizeHexColor(hex: string): string {
  const trimmed = hex.trim().toUpperCase();
  if (trimmed.startsWith('#')) {
    if (trimmed.length === 4) {
      // Expand #RGB to #RRGGBB
      return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
    }
    return trimmed;
  }
  return `#${trimmed}`;
}

/**
 * Validates Worker POS Site Name
 */
export function validateSiteName(name: string): { valid: boolean; error?: string } {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Site name cannot be empty.' };
  }
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    return { valid: false, error: 'Site name must be at least 2 characters long.' };
  }
  if (trimmed.length > 50) {
    return { valid: false, error: 'Site name cannot exceed 50 characters.' };
  }
  return { valid: true };
}

/**
 * Converts a hex colour to RGB components
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let clean = hex.replace(/^#/, '');
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  const num = parseInt(clean, 16);
  if (isNaN(num)) return { r: 183, g: 255, b: 0 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

/**
 * Adjusts color brightness for hover / active states
 */
function adjustBrightness(hex: string, percent: number): string {
  const { r, g, b } = hexToRgb(hex);
  const adjust = (val: number) => {
    const res = Math.round(val * (1 + percent / 100));
    return Math.min(255, Math.max(0, res));
  };
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(adjust(r))}${toHex(adjust(g))}${toHex(adjust(b))}`.toUpperCase();
}

/**
 * Applies brand color dynamically to the document root CSS variables:
 * --worker-primary, --worker-primary-rgb, --worker-primary-hover, --brand-primary
 */
export function applyBrandColorToDOM(color: string): void {
  if (typeof document === 'undefined') return;
  try {
    const validColor = validateHexColor(color) ? normalizeHexColor(color) : DEFAULT_WORKER_PRIMARY_COLOR;
    const { r, g, b } = hexToRgb(validColor);
    const hoverColor = adjustBrightness(validColor, -12);

    document.documentElement.style.setProperty('--worker-primary', validColor);
    document.documentElement.style.setProperty('--worker-primary-rgb', `${r}, ${g}, ${b}`);
    document.documentElement.style.setProperty('--worker-primary-hover', hoverColor);

    // Maintain backwards compatibility with generic brand variables
    document.documentElement.style.setProperty('--brand-primary', validColor);
    document.documentElement.style.setProperty('--brand-primary-rgb', `${r}, ${g}, ${b}`);
    document.documentElement.style.setProperty('--brand-primary-hover', hoverColor);
  } catch (err) {
    console.warn('[brandingService] Failed to set DOM CSS variables:', err);
  }
}

/**
 * Reads cached branding from localStorage for instant flicker-free initial load
 */
export function getCachedWorkerBranding(): WorkerBranding {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {
      site_name: DEFAULT_WORKER_SITE_NAME,
      primary_color: DEFAULT_WORKER_PRIMARY_COLOR,
    };
  }
  try {
    const cached = localStorage.getItem(STORAGE_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && typeof parsed.site_name === 'string' && validateHexColor(parsed.primary_color)) {
        return {
          site_name: parsed.site_name.trim() || DEFAULT_WORKER_SITE_NAME,
          primary_color: normalizeHexColor(parsed.primary_color),
          updated_at: parsed.updated_at,
        };
      }
    }
  } catch (err) {
    console.warn('[brandingService] Cache read error:', err);
  }
  return {
    site_name: DEFAULT_WORKER_SITE_NAME,
    primary_color: DEFAULT_WORKER_PRIMARY_COLOR,
  };
}

/**
 * Updates localStorage cache
 */
function setCachedWorkerBranding(branding: WorkerBranding): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(branding));
  } catch (err) {
    console.warn('[brandingService] Cache write error:', err);
  }
}

/**
 * Fetches Worker POS branding from the existing single business_settings row in Supabase
 * Queries only: id, business_name, worker_pos_name, worker_pos_color, updated_at
 */
export async function getWorkerBranding(): Promise<WorkerBranding> {
  try {
    const { data, error } = await supabase
      .from('business_settings')
      .select('id, business_name, worker_pos_name, worker_pos_color, updated_at')
      .limit(1);

    if (error) {
      console.warn('[brandingService] Notice reading business_settings from Supabase:', error.message);
      const cached = getCachedWorkerBranding();
      applyBrandColorToDOM(cached.primary_color);
      return cached;
    }

    if (data && data.length > 0) {
      const row = data[0];

      // Extract worker_pos_name with robust fallbacks
      let siteName = DEFAULT_WORKER_SITE_NAME;
      if (row.worker_pos_name && typeof row.worker_pos_name === 'string' && row.worker_pos_name.trim()) {
        siteName = row.worker_pos_name.trim();
      } else if (row.business_name && typeof row.business_name === 'string' && row.business_name.trim()) {
        siteName = row.business_name.trim();
      }

      // Extract worker_pos_color with robust fallbacks
      let primaryColor = DEFAULT_WORKER_PRIMARY_COLOR;
      if (row.worker_pos_color && validateHexColor(row.worker_pos_color)) {
        primaryColor = normalizeHexColor(row.worker_pos_color);
      }

      const branding: WorkerBranding = {
        site_name: siteName,
        primary_color: primaryColor,
        updated_at: row.updated_at || new Date().toISOString(),
      };

      setCachedWorkerBranding(branding);
      applyBrandColorToDOM(branding.primary_color);
      return branding;
    }

    // No row found, use cache or defaults
    const fallback = getCachedWorkerBranding();
    applyBrandColorToDOM(fallback.primary_color);
    return fallback;
  } catch (err) {
    console.error('[brandingService] Exception fetching branding:', err);
    const fallback = getCachedWorkerBranding();
    applyBrandColorToDOM(fallback.primary_color);
    return fallback;
  }
}

/**
 * Saves Worker POS branding to the existing business_settings record in Supabase.
 * Updates: worker_pos_name, worker_pos_color, updated_at, updated_by
 * Does NOT send worker_branding or insert extra rows.
 */
export async function saveWorkerBranding(branding: {
  site_name: string;
  primary_color: string;
}): Promise<{ success: boolean; data?: WorkerBranding; error?: string }> {
  // 1. Validation
  const nameValidation = validateSiteName(branding.site_name);
  if (!nameValidation.valid) {
    return { success: false, error: nameValidation.error };
  }

  if (!validateHexColor(branding.primary_color)) {
    return {
      success: false,
      error: 'Invalid hexadecimal color code. Please use a format like #B7FF00 or #00FF88.',
    };
  }

  const cleanSiteName = branding.site_name.trim();
  const cleanColor = normalizeHexColor(branding.primary_color);
  const nowIso = new Date().toISOString();

  try {
    // 2. Fetch existing settings row ID
    const { data: existingRows, error: fetchErr } = await supabase
      .from('business_settings')
      .select('id')
      .limit(1);

    if (fetchErr) {
      console.error('[brandingService] Error verifying business_settings before save:', fetchErr);
      return {
        success: false,
        error: `Database connection error: ${fetchErr.message}`,
      };
    }

    // Get current auth user ID if available
    let currentUserId: string | null = null;
    try {
      const { data: authData } = await supabase.auth.getUser();
      currentUserId = authData?.user?.id || null;
    } catch {
      // Non-blocking
    }

    const payload = {
      worker_pos_name: cleanSiteName,
      worker_pos_color: cleanColor,
      updated_at: nowIso,
      updated_by: currentUserId,
    };

    let saveError: any = null;

    if (existingRows && existingRows.length > 0) {
      const targetId = existingRows[0].id;
      const { error: updateErr } = await supabase
        .from('business_settings')
        .update(payload)
        .eq('id', targetId);

      saveError = updateErr;
    } else {
      // Only if no business_settings row exists at all
      const { error: insertErr } = await supabase.from('business_settings').insert({
        business_name: cleanSiteName,
        ...payload,
      });

      saveError = insertErr;
    }

    if (saveError) {
      console.error('[brandingService] Failed to save branding to Supabase:', saveError);
      return {
        success: false,
        error: `Failed to update branding in database: ${saveError.message}`,
      };
    }

    // 3. Log to activity logs
    try {
      await supabase.from('activity_logs').insert({
        action: 'worker_branding_updated',
        description: `Updated Worker POS branding: Name="${cleanSiteName}", Primary Color="${cleanColor}"`,
        metadata: {
          worker_pos_name: cleanSiteName,
          worker_pos_color: cleanColor,
        },
      });
    } catch (logErr) {
      console.warn('[brandingService] Notice logging activity event:', logErr);
    }

    // 4. Update local cache and DOM
    const resultBranding: WorkerBranding = {
      site_name: cleanSiteName,
      primary_color: cleanColor,
      updated_at: nowIso,
    };
    setCachedWorkerBranding(resultBranding);
    applyBrandColorToDOM(cleanColor);

    // 5. Broadcast to realtime channel so all open tabs / windows update immediately
    try {
      const channel = supabase.channel(REALTIME_CHANNEL_NAME);
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.send({
            type: 'broadcast',
            event: 'branding_updated',
            payload: resultBranding,
          });
        }
      });
    } catch (realtimeErr) {
      console.warn('[brandingService] Notice broadcasting realtime update:', realtimeErr);
    }

    return {
      success: true,
      data: resultBranding,
    };
  } catch (err: any) {
    console.error('[brandingService] Critical exception saving branding:', err);
    return {
      success: false,
      error: err?.message || 'An unexpected error occurred while saving branding.',
    };
  }
}

/**
 * Resets Worker POS branding to system defaults (MUNAJ BAR, #B7FF00)
 */
export async function resetWorkerBranding(): Promise<{
  success: boolean;
  data?: WorkerBranding;
  error?: string;
}> {
  return saveWorkerBranding({
    site_name: DEFAULT_WORKER_SITE_NAME,
    primary_color: DEFAULT_WORKER_PRIMARY_COLOR,
  });
}

/**
 * Subscribes to realtime updates for Worker POS branding
 */
export function subscribeToBrandingUpdates(
  onUpdate: (branding: WorkerBranding) => void
): () => void {
  // 1. Postgres changes subscription on business_settings
  const postgresSubscription = supabase
    .channel('business_settings_branding_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'business_settings',
      },
      (payload) => {
        const newRecord = (payload.new || {}) as any;
        if (newRecord) {
          const siteName =
            newRecord.worker_pos_name ||
            newRecord.business_name ||
            DEFAULT_WORKER_SITE_NAME;

          const primaryColor =
            (validateHexColor(newRecord.worker_pos_color) && normalizeHexColor(newRecord.worker_pos_color)) ||
            DEFAULT_WORKER_PRIMARY_COLOR;

          const branding: WorkerBranding = {
            site_name: siteName,
            primary_color: primaryColor,
            updated_at: newRecord.updated_at || new Date().toISOString(),
          };

          setCachedWorkerBranding(branding);
          applyBrandColorToDOM(branding.primary_color);
          onUpdate(branding);
        }
      }
    )
    .subscribe();

  // 2. Broadcast channel subscription for instant cross-tab sync
  const broadcastChannel = supabase
    .channel(REALTIME_CHANNEL_NAME)
    .on('broadcast', { event: 'branding_updated' }, ({ payload }) => {
      if (payload && payload.site_name && validateHexColor(payload.primary_color)) {
        const branding: WorkerBranding = {
          site_name: payload.site_name,
          primary_color: normalizeHexColor(payload.primary_color),
          updated_at: payload.updated_at,
        };
        setCachedWorkerBranding(branding);
        applyBrandColorToDOM(branding.primary_color);
        onUpdate(branding);
      }
    })
    .subscribe();

  return () => {
    supabase.removeChannel(postgresSubscription);
    supabase.removeChannel(broadcastChannel);
  };
}
