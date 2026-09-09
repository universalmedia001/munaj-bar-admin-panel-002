import React, { useState, useEffect } from 'react';
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  Table,
  Server,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import { supabase, checkSupabaseConnection } from '../../lib/supabase';
import { seedSampleBarData } from '../../utils/seedData';

interface DatabaseViewProps {
  onRefreshAll: () => void;
}

export const DatabaseView: React.FC<DatabaseViewProps> = ({ onRefreshAll }) => {
  const [checking, setChecking] = useState(false);
  const [tablesStatus, setTablesStatus] = useState<{ table: string; count: number; status: 'ok' | 'error' }[]>([]);
  const [seeding, setSeeding] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [connectionHealth, setConnectionHealth] = useState<'connected' | 'disconnected' | 'checking'>('checking');

  const checkAllTables = async () => {
    setChecking(true);
    const tables = [
      'business_settings',
      'categories',
      'products',
      'profiles',
      'shifts',
      'sales',
      'sale_items',
      'stock_movements',
      'notifications',
      'activity_logs',
      'receipt_prints',
    ];

    const results: { table: string; count: number; status: 'ok' | 'error' }[] = [];

    for (const tbl of tables) {
      try {
        const { count, error } = await supabase.from(tbl).select('*', { count: 'exact', head: true });
        if (error) {
          results.push({ table: tbl, count: 0, status: 'error' });
        } else {
          results.push({ table: tbl, count: count ?? 0, status: 'ok' });
        }
      } catch {
        results.push({ table: tbl, count: 0, status: 'error' });
      }
    }

    setTablesStatus(results);
    const isConn = await checkSupabaseConnection();
    setConnectionHealth(isConn ? 'connected' : 'disconnected');
    setChecking(false);
  };

  useEffect(() => {
    checkAllTables();
  }, []);

  const handleSeed = async () => {
    setSeeding(true);
    await seedSampleBarData();
    await checkAllTables();
    onRefreshAll();
    setSeeding(false);
  };

  const schemaSql = `-- MUNAJ BAR Production Database Schema
-- Execute in Supabase SQL Editor if any tables are missing:

CREATE TABLE IF NOT EXISTS public.business_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL DEFAULT 'MUNAJ BAR',
  tagline TEXT DEFAULT 'Premium Lounge & Luxury Nightlife',
  address TEXT,
  phone TEXT,
  email TEXT,
  currency TEXT DEFAULT 'NGN',
  low_stock_threshold_default INTEGER DEFAULT 5,
  receipt_header TEXT DEFAULT 'VIP LOUNGE • MAIN BAR',
  receipt_footer TEXT DEFAULT 'Thank you for partying with MUNAJ BAR! Please drink responsibly.',
  show_qr_on_receipt BOOLEAN DEFAULT false,
  show_worker_on_receipt BOOLEAN DEFAULT true,
  default_opening_cash NUMERIC(12, 2) DEFAULT 50000.00 CHECK (default_opening_cash >= 0),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  selling_price NUMERIC NOT NULL,
  cost_price NUMERIC NOT NULL,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  minimum_stock_level INTEGER NOT NULL DEFAULT 5,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'cashier', 'bar_worker', 'sales_worker')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES public.profiles(id),
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  opening_cash NUMERIC NOT NULL DEFAULT 0,
  ending_cash NUMERIC,
  expected_cash NUMERIC,
  cash_difference NUMERIC,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number TEXT NOT NULL UNIQUE,
  shift_id UUID REFERENCES public.shifts(id),
  worker_id UUID NOT NULL REFERENCES public.profiles(id),
  subtotal NUMERIC NOT NULL,
  tax NUMERIC NOT NULL DEFAULT 0,
  discount NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'pos_terminal', 'transfer', 'split')),
  cash_tendered NUMERIC,
  change_due NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity INTEGER NOT NULL,
  unit_price NUMERIC NOT NULL,
  subtotal NUMERIC NOT NULL,
  product_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id),
  type TEXT NOT NULL CHECK (type IN ('initial', 'sale', 'restock', 'damage', 'correction', 'adjustment')),
  quantity_change INTEGER NOT NULL,
  quantity_before INTEGER NOT NULL,
  quantity_after INTEGER NOT NULL,
  reason TEXT,
  performed_by UUID REFERENCES public.profiles(id),
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('new_sale', 'sale', 'shift_started', 'shift_opened', 'shift_closed', 'low_stock', 'out_of_stock', 'admin_message', 'broadcast', 'system')),
  reference_type TEXT,
  reference_id TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  description TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.receipt_prints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  printed_by UUID REFERENCES public.profiles(id),
  is_reprint BOOLEAN DEFAULT false,
  reason TEXT,
  printed_at TIMESTAMPTZ DEFAULT now()
);

-- RLS & Broadcast Helper Functions:
CREATE OR REPLACE FUNCTION public.send_broadcast_notification(
  p_title TEXT,
  p_message TEXT,
  p_recipient_ids UUID[] DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inserted_count INTEGER := 0;
BEGIN
  IF p_recipient_ids IS NULL OR cardinality(p_recipient_ids) = 0 THEN
    INSERT INTO public.notifications (recipient_id, title, message, type, is_read)
    VALUES (NULL, p_title, p_message, 'admin_message', false);
    GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  ELSE
    INSERT INTO public.notifications (recipient_id, title, message, type, is_read)
    SELECT p.id, p_title, p_message, 'admin_message', false
    FROM unnest(p_recipient_ids) AS rid
    JOIN public.profiles p ON p.id = rid;
    GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  END IF;
  RETURN v_inserted_count;
END;
$$;

-- Enable Realtime
DO $$
BEGIN
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.sales, public.products, public.shifts, public.notifications, public.stock_movements, public.activity_logs';
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

-- Storage Buckets & Policies for Product Images and Business Assets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('product-images', 'product-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg']),
  ('business-assets', 'business-assets', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg'])
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

-- Public Read for Storage
DROP POLICY IF EXISTS "Public can view product images" ON storage.objects;
CREATE POLICY "Public can view product images"
ON storage.objects FOR SELECT
USING (bucket_id IN ('product-images', 'business-assets'));

-- Authenticated Users Upload/Update/Delete Storage
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
CREATE POLICY "Authenticated users can upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id IN ('product-images', 'business-assets'));

DROP POLICY IF EXISTS "Authenticated users can update product images" ON storage.objects;
CREATE POLICY "Authenticated users can update product images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id IN ('product-images', 'business-assets'));

DROP POLICY IF EXISTS "Authenticated users can delete product images" ON storage.objects;
CREATE POLICY "Authenticated users can delete product images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id IN ('product-images', 'business-assets'));`;

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(schemaSql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-[#111111] border border-zinc-800 rounded-2xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-950/80 border border-emerald-800/60 flex items-center justify-center text-[#22C55E]">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-base font-extrabold text-white">Supabase Cloud Database Status</h2>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                    connectionHealth === 'connected'
                      ? 'bg-emerald-950/80 text-[#22C55E] border-emerald-800/50'
                      : 'bg-red-950/80 text-red-400 border-red-800/50'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      connectionHealth === 'connected' ? 'bg-[#22C55E] animate-pulse' : 'bg-red-400'
                    }`}
                  />
                  {connectionHealth === 'connected' ? 'Active & Healthy' : 'Disconnected'}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                PostgreSQL schema validation, live table metrics, and schema migration definitions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={checkAllTables}
              disabled={checking}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
              Verify Tables
            </button>
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-[#22C55E] hover:bg-[#1ea750] text-black transition-all shadow-md"
            >
              <Sparkles className={`w-3.5 h-3.5 ${seeding ? 'animate-spin' : ''}`} />
              {seeding ? 'Seeding Catalog...' : 'Seed Sample Catalog'}
            </button>
          </div>
        </div>
      </div>

      {/* Tables Grid */}
      <div>
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <Table className="w-4 h-4 text-[#22C55E]" />
          Database Tables & Record Metrics
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {tablesStatus.map((t) => (
            <div
              key={t.table}
              className="p-4 rounded-xl bg-[#111111] border border-zinc-800 flex items-center justify-between"
            >
              <div>
                <p className="text-xs font-mono font-bold text-zinc-200">{t.table}</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  {t.count} {t.count === 1 ? 'record' : 'records'}
                </p>
              </div>
              <div>
                {t.status === 'ok' ? (
                  <CheckCircle2 className="w-4 h-4 text-[#22C55E]" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edge Function Architecture Card */}
      <div className="bg-[#111111] border border-zinc-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-950/80 border border-blue-800/60 flex items-center justify-center text-blue-400">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Privileged Worker Operations (Supabase Edge Functions)</h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Secure staff account provisioning and deletion via Supabase Auth Admin API (zero service-role key exposure to browser).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3.5 rounded-xl bg-black border border-zinc-800">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-zinc-400">Creation Function</p>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/50">create-worker</span>
            </div>
            <p className="text-xs font-mono font-bold text-zinc-200 mt-1">supabase/functions/create-worker</p>
            <p className="text-[11px] font-mono text-blue-400 mt-1">supabase functions deploy create-worker</p>
          </div>
          <div className="p-3.5 rounded-xl bg-black border border-zinc-800">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-zinc-400">Deletion Function</p>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800/50">delete-worker</span>
            </div>
            <p className="text-xs font-mono font-bold text-zinc-200 mt-1">supabase/functions/delete-worker</p>
            <p className="text-[11px] font-mono text-blue-400 mt-1">supabase functions deploy delete-worker</p>
          </div>
        </div>
      </div>

      {/* SQL Migration Reference */}
      <div className="bg-[#111111] border border-zinc-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-[#22C55E]" />
            <h3 className="text-sm font-bold text-white">Supabase Schema Definition (SQL)</h3>
          </div>
          <button
            onClick={copySqlToClipboard}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-colors"
          >
            {copiedSql ? <Check className="w-3.5 h-3.5 text-[#22C55E]" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedSql ? 'Copied to Clipboard!' : 'Copy SQL Schema'}
          </button>
        </div>
        <pre className="p-4 rounded-xl bg-black border border-zinc-900 text-emerald-400/90 font-mono text-[11px] overflow-x-auto max-h-72 custom-scrollbar">
          {schemaSql}
        </pre>
      </div>
    </div>
  );
};
