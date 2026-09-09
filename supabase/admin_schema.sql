-- ============================================================================
-- MUNAJ BAR — ADMIN PANEL & EXTENDED SYSTEM MIGRATIONS
-- ============================================================================
-- Safe, repeatable, idempotent migration script for MUNAJ BAR Admin Panel.
-- Adds notifications, activity_logs, stock_movements, business_settings tables,
-- and comprehensive Admin/Manager Row Level Security (RLS) policies.
-- Does NOT modify or replace any existing Worker POS functions or sequences!
-- ============================================================================

-- 1. EXTENDED TABLES

-- A. Notifications Table (Worker/Admin Broadcasts & Alerts)
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- NULL = All Workers
  sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'sale', 'shift', 'stock', 'system')),
  is_read BOOLEAN NOT NULL DEFAULT false,
  reference_type TEXT,
  reference_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- B. Activity Logs Table (Immutable Audit Trail)
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL DEFAULT 'System',
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- C. Stock Movements Table (Inventory Adjustments & Restocks)
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity_change INT NOT NULL,
  quantity_before INT NOT NULL,
  quantity_after INT NOT NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('restock', 'adjustment', 'damage', 'correction', 'sale')),
  reason TEXT,
  reference_id TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- D. Business Settings Table (Includes Independent Worker POS & Admin Branding)
CREATE TABLE IF NOT EXISTS public.business_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL DEFAULT 'MUNAJ BAR',
  currency_code TEXT NOT NULL DEFAULT 'NGN',
  currency_symbol TEXT NOT NULL DEFAULT '₦',
  phone TEXT NOT NULL DEFAULT '+234 800 000 0000',
  email TEXT NOT NULL DEFAULT 'admin@munajbar.ng',
  address TEXT NOT NULL DEFAULT 'Lagos, Nigeria',
  receipt_header TEXT NOT NULL DEFAULT 'MUNAJ BAR & LOUNGE',
  receipt_footer TEXT NOT NULL DEFAULT 'Thank you for your patronage! Please visit again.',
  worker_pos_branding JSONB NOT NULL DEFAULT '{"site_name": "MUNAJ BAR", "primary_color": "#B7FF00"}'::JSONB,
  admin_branding JSONB NOT NULL DEFAULT '{"primary_color": "#22C55E"}'::JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure columns exist in case table was previously created
ALTER TABLE public.business_settings ADD COLUMN IF NOT EXISTS worker_pos_branding JSONB NOT NULL DEFAULT '{"site_name": "MUNAJ BAR", "primary_color": "#B7FF00"}'::JSONB;
ALTER TABLE public.business_settings ADD COLUMN IF NOT EXISTS admin_branding JSONB NOT NULL DEFAULT '{"primary_color": "#22C55E"}'::JSONB;

-- Insert Default Business Settings row if not present
INSERT INTO public.business_settings (
  business_name, 
  currency_code, 
  currency_symbol, 
  phone, 
  email, 
  address, 
  receipt_header, 
  receipt_footer,
  worker_pos_branding,
  admin_branding
)
SELECT 
  'MUNAJ BAR', 
  'NGN', 
  '₦', 
  '+234 800 000 0000', 
  'admin@munajbar.ng', 
  'Lagos, Nigeria', 
  'MUNAJ BAR & LOUNGE', 
  'Thank you for your patronage! Please visit again.',
  '{"site_name": "MUNAJ BAR", "primary_color": "#B7FF00"}'::JSONB,
  '{"primary_color": "#22C55E"}'::JSONB
WHERE NOT EXISTS (SELECT 1 FROM public.business_settings LIMIT 1);


-- 2. INDEXES
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON public.notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor_id ON public.activity_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON public.stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON public.stock_movements(created_at DESC);


-- 3. ROW LEVEL SECURITY (RLS) FOR ADMIN / MANAGER

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;

-- Helper check function for admin/manager role
CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  RETURN v_role IN ('admin', 'manager');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles: Admins can view and update all profiles
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_manager());

-- Categories: Admins can manage all categories
DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;
CREATE POLICY "Admins can manage categories"
  ON public.categories FOR ALL
  TO authenticated
  USING (public.is_admin_or_manager());

-- Products: Admins can manage all products
DROP POLICY IF EXISTS "Admins can manage products" ON public.products;
CREATE POLICY "Admins can manage products"
  ON public.products FOR ALL
  TO authenticated
  USING (public.is_admin_or_manager());

-- Shifts: Admins can view all shifts
DROP POLICY IF EXISTS "Admins can view all shifts" ON public.shifts;
CREATE POLICY "Admins can view all shifts"
  ON public.shifts FOR SELECT
  TO authenticated
  USING (public.is_admin_or_manager());

-- Sales: Admins can view all sales
DROP POLICY IF EXISTS "Admins can view all sales" ON public.sales;
CREATE POLICY "Admins can view all sales"
  ON public.sales FOR SELECT
  TO authenticated
  USING (public.is_admin_or_manager());

-- Sale Items: Admins can view all sale items
DROP POLICY IF EXISTS "Admins can view all sale items" ON public.sale_items;
CREATE POLICY "Admins can view all sale items"
  ON public.sale_items FOR SELECT
  TO authenticated
  USING (public.is_admin_or_manager());

-- Receipt Prints: Admins can view all prints
DROP POLICY IF EXISTS "Admins can view all receipt prints" ON public.receipt_prints;
CREATE POLICY "Admins can view all receipt prints"
  ON public.receipt_prints FOR SELECT
  TO authenticated
  USING (public.is_admin_or_manager());

-- Notifications Policies
DROP POLICY IF EXISTS "Users can read own notifications and broadcasts" ON public.notifications;
CREATE POLICY "Users can read own notifications and broadcasts"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (recipient_id = auth.uid() OR recipient_id IS NULL OR public.is_admin_or_manager());

DROP POLICY IF EXISTS "Admins can insert notifications" ON public.notifications;
CREATE POLICY "Admins can insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_manager() OR auth.uid() = sender_id);

DROP POLICY IF EXISTS "Users can mark notifications as read" ON public.notifications;
CREATE POLICY "Users can mark notifications as read"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (recipient_id = auth.uid() OR recipient_id IS NULL OR public.is_admin_or_manager());

-- Activity Logs Policies (Append-only audit trail)
DROP POLICY IF EXISTS "Authenticated users can view activity logs" ON public.activity_logs;
CREATE POLICY "Authenticated users can view activity logs"
  ON public.activity_logs FOR SELECT
  TO authenticated
  USING (public.is_admin_or_manager());

DROP POLICY IF EXISTS "Authenticated users can insert activity logs" ON public.activity_logs;
CREATE POLICY "Authenticated users can insert activity logs"
  ON public.activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Stock Movements Policies
DROP POLICY IF EXISTS "Admins can view stock movements" ON public.stock_movements;
CREATE POLICY "Admins can view stock movements"
  ON public.stock_movements FOR SELECT
  TO authenticated
  USING (public.is_admin_or_manager());

DROP POLICY IF EXISTS "Admins can insert stock movements" ON public.stock_movements;
CREATE POLICY "Admins can insert stock movements"
  ON public.stock_movements FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_manager());

-- Business Settings Policies
DROP POLICY IF EXISTS "Authenticated users can view business settings" ON public.business_settings;
CREATE POLICY "Authenticated users can view business settings"
  ON public.business_settings FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can update business settings" ON public.business_settings;
CREATE POLICY "Admins can update business settings"
  ON public.business_settings FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_manager());
