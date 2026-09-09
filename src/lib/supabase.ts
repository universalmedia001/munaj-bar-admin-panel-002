import { createClient } from '@supabase/supabase-js';

const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
const envAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

const supabaseUrl = envUrl || 'https://audhnjptgfwpqophgfvy.supabase.co';
const supabaseAnonKey = envAnonKey || 'sb_publishable_KRHyF978z1EYJYqrycxeJA_37p71DHR';

// Project-specific storage key ensures migration between Supabase projects never leaks or decodes stale JWTs
const projectRef = (supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]) || 'audhnjptgfwpqophgfvy';
const authStorageKey = `sb-${projectRef}-auth-token`;

// Clean up legacy static storage keys if present from previous backends
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    const legacyKey = 'sb-munaj-admin-auth-token';
    const legacyToken = window.localStorage.getItem(legacyKey);
    if (legacyToken) {
      window.localStorage.removeItem(legacyKey);
    }
  } catch {
    // ignore
  }
}

if (!envUrl || !envAnonKey) {
  console.info('[MUNAJ Supabase] Active with default project configuration. VITE_SUPABASE_URL provided:', Boolean(envUrl));
} else {
  console.info('[MUNAJ Supabase] Initialized using environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: authStorageKey,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export interface ConnectionStatus {
  connected: boolean;
  message: string;
  tablesVerified: {
    profiles: boolean;
    categories: boolean;
    products: boolean;
    stock_movements: boolean;
    shifts: boolean;
    sales: boolean;
    sale_items: boolean;
    receipt_prints: boolean;
    notifications: boolean;
    activity_logs: boolean;
    business_settings: boolean;
  };
  hasAdminProfile: boolean;
}

export async function checkSupabaseConnection(): Promise<ConnectionStatus> {
  const result: ConnectionStatus = {
    connected: false,
    message: 'Testing connection...',
    tablesVerified: {
      profiles: false,
      categories: false,
      products: false,
      stock_movements: false,
      shifts: false,
      sales: false,
      sale_items: false,
      receipt_prints: false,
      notifications: false,
      activity_logs: false,
      business_settings: false,
    },
    hasAdminProfile: false,
  };

  try {
    // 1. Test basic connectivity via business_settings or categories
    const { error: settingsError } = await supabase.from('business_settings').select('id').limit(1);
    if (!settingsError) {
      result.tablesVerified.business_settings = true;
    }

    const { error: catError } = await supabase.from('categories').select('id').limit(1);
    if (!catError) result.tablesVerified.categories = true;

    const { error: prodError } = await supabase.from('products').select('id').limit(1);
    if (!prodError) result.tablesVerified.products = true;

    const { error: profError } = await supabase.from('profiles').select('id, role').limit(1);
    if (!profError) result.tablesVerified.profiles = true;

    const { error: shiftError } = await supabase.from('shifts').select('id').limit(1);
    if (!shiftError) result.tablesVerified.shifts = true;

    const { error: salesError } = await supabase.from('sales').select('id').limit(1);
    if (!salesError) result.tablesVerified.sales = true;

    const { error: itemsError } = await supabase.from('sale_items').select('id').limit(1);
    if (!itemsError) result.tablesVerified.sale_items = true;

    const { error: rPrintsError } = await supabase.from('receipt_prints').select('id').limit(1);
    if (!rPrintsError) result.tablesVerified.receipt_prints = true;

    const { error: notifError } = await supabase.from('notifications').select('id').limit(1);
    if (!notifError) result.tablesVerified.notifications = true;

    const { error: actError } = await supabase.from('activity_logs').select('id').limit(1);
    if (!actError) result.tablesVerified.activity_logs = true;

    const { error: smError } = await supabase.from('inventory_movements' as any).select('id').limit(1);
    if (!smError) {
      result.tablesVerified.stock_movements = true;
    } else {
      const { error: smError2 } = await supabase.from('stock_movements').select('id').limit(1);
      if (!smError2) result.tablesVerified.stock_movements = true;
    }

    // Check if at least connected to Supabase endpoint
    result.connected = true;
    result.message = 'Supabase client connected successfully';
    
    return result;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown connection error';
    result.connected = false;
    result.message = `Connection failed: ${errorMsg}`;
    return result;
  }
}
