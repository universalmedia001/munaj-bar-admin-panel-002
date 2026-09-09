-- ============================================================================
-- MUNAJ BAR — WORKER POS SYSTEM DATABASE SCHEMA & FUNCTIONS
-- ============================================================================
-- Safe, repeatable, idempotent PostgreSQL script for Supabase.
-- Creates all tables, constraints, indexes, triggers, Row Level Security policies,
-- transactional RPC functions (complete_sale, open_worker_shift, close_worker_shift, etc.),
-- and default sample category/product seed data for MUNAJ BAR.
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. SEQUENCES
CREATE SEQUENCE IF NOT EXISTS receipt_number_seq START WITH 1 INCREMENT BY 1;

-- 3. ENUMS & DOMAINS (Safely defined)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'worker_role') THEN
    CREATE TYPE worker_role AS ENUM ('cashier', 'bar_worker', 'sales_worker', 'admin', 'manager');
  END IF;
END $$;

-- 4. TABLES

-- Profiles Table (Linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'cashier' CHECK (role IN ('cashier', 'bar_worker', 'sales_worker', 'admin', 'manager')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Categories Table
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Products Table
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  selling_price NUMERIC(12, 2) NOT NULL CHECK (selling_price >= 0),
  cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  stock_quantity INT NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  minimum_stock_level INT NOT NULL DEFAULT 5 CHECK (minimum_stock_level >= 0),
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Shifts Table
CREATE TABLE IF NOT EXISTS public.shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  opening_cash NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (opening_cash >= 0),
  ending_cash NUMERIC(12, 2),
  expected_cash NUMERIC(12, 2),
  cash_difference NUMERIC(12, 2),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sales Table
CREATE TABLE IF NOT EXISTS public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number TEXT NOT NULL UNIQUE,
  worker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE RESTRICT,
  subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
  discount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  total NUMERIC(12, 2) NOT NULL CHECK (total >= 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'pos', 'transfer')),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sale Items Table
CREATE TABLE IF NOT EXISTS public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  total NUMERIC(12, 2) NOT NULL CHECK (total >= 0)
);

-- Receipt Print Log Table
CREATE TABLE IF NOT EXISTS public.receipt_prints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  printed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. INDEXES (Safe creation)
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(is_active);
CREATE INDEX IF NOT EXISTS idx_sales_worker_id ON public.sales(worker_id);
CREATE INDEX IF NOT EXISTS idx_sales_shift_id ON public.sales(shift_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON public.sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_shifts_worker_id ON public.shifts(worker_id);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON public.shifts(status);
CREATE INDEX IF NOT EXISTS idx_receipt_prints_sale_id ON public.receipt_prints(sale_id);

-- Enforce ONE active shift per worker at the DB level
CREATE UNIQUE INDEX IF NOT EXISTS idx_shifts_worker_active_unique 
  ON public.shifts(worker_id) 
  WHERE status = 'active';

-- 6. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_prints ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Users can read own profile and co-workers" ON public.profiles;
CREATE POLICY "Users can read own profile and co-workers" 
  ON public.profiles FOR SELECT 
  TO authenticated 
  USING (true);

DROP POLICY IF EXISTS "Users can update their own non-role profile" ON public.profiles;
CREATE POLICY "Users can update their own non-role profile" 
  ON public.profiles FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = id);

-- Categories Policies (Workers can only read active categories)
DROP POLICY IF EXISTS "Workers can read active categories" ON public.categories;
CREATE POLICY "Workers can read active categories" 
  ON public.categories FOR SELECT 
  TO authenticated 
  USING (is_active = true);

-- Products Policies (Workers can only read active products)
DROP POLICY IF EXISTS "Workers can read active products" ON public.products;
CREATE POLICY "Workers can read active products" 
  ON public.products FOR SELECT 
  TO authenticated 
  USING (is_active = true);

-- Shifts Policies (Workers can only read, insert, update their own shifts)
DROP POLICY IF EXISTS "Workers can view own shifts" ON public.shifts;
CREATE POLICY "Workers can view own shifts" 
  ON public.shifts FOR SELECT 
  TO authenticated 
  USING (auth.uid() = worker_id);

DROP POLICY IF EXISTS "Workers can insert own shifts" ON public.shifts;
CREATE POLICY "Workers can insert own shifts" 
  ON public.shifts FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = worker_id);

DROP POLICY IF EXISTS "Workers can update own shifts" ON public.shifts;
CREATE POLICY "Workers can update own shifts" 
  ON public.shifts FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = worker_id);

-- Sales Policies: Authorized workers (cashier, bar_worker, sales_worker, admin, manager) can view sales, workers create own sales
DROP POLICY IF EXISTS "Workers can view own sales" ON public.sales;
DROP POLICY IF EXISTS "Authorized workers can view sales" ON public.sales;
CREATE POLICY "Authorized workers can view sales" 
  ON public.sales FOR SELECT 
  TO authenticated 
  USING (
    auth.uid() = worker_id 
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
        AND profiles.role::text IN ('cashier', 'bar_worker', 'bar_staff', 'sales_worker', 'admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Workers can insert own sales" ON public.sales;
CREATE POLICY "Workers can insert own sales" 
  ON public.sales FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = worker_id);

-- Sale Items Policies: Authorized workers can view sale items for worker sales
DROP POLICY IF EXISTS "Workers can view sale items for own sales" ON public.sale_items;
DROP POLICY IF EXISTS "Authorized workers can view sale items" ON public.sale_items;
CREATE POLICY "Authorized workers can view sale items" 
  ON public.sale_items FOR SELECT 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.sales 
      WHERE sales.id = sale_items.sale_id 
        AND (
          sales.worker_id = auth.uid() 
          OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
              AND profiles.role::text IN ('cashier', 'bar_worker', 'bar_staff', 'sales_worker', 'admin', 'manager')
          )
        )
    )
  );

DROP POLICY IF EXISTS "Workers can insert sale items for own sales" ON public.sale_items;
CREATE POLICY "Workers can insert sale items for own sales" 
  ON public.sale_items FOR INSERT 
  TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sales 
      WHERE sales.id = sale_items.sale_id 
        AND sales.worker_id = auth.uid()
    )
  );

-- Receipt Prints Policies: Authorized workers can view receipt print logs
DROP POLICY IF EXISTS "Workers can view own receipt print logs" ON public.receipt_prints;
DROP POLICY IF EXISTS "Authorized workers can view receipt print logs" ON public.receipt_prints;
CREATE POLICY "Authorized workers can view receipt print logs" 
  ON public.receipt_prints FOR SELECT 
  TO authenticated 
  USING (
    auth.uid() = worker_id 
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
        AND profiles.role::text IN ('cashier', 'bar_worker', 'bar_staff', 'sales_worker', 'admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Workers can insert own receipt print logs" ON public.receipt_prints;
CREATE POLICY "Workers can insert own receipt print logs" 
  ON public.receipt_prints FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = worker_id);


-- 7. AUTH TRIGGER: Auto-create Profile on Auth Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'cashier'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 8. TRANSACTIONAL POSTGRESQL FUNCTIONS / RPCs

-- A. Open Worker Shift
CREATE OR REPLACE FUNCTION public.open_worker_shift(p_opening_cash NUMERIC)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
  v_active_shift_id UUID;
  v_shift_record public.shifts%ROWTYPE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  -- Validate Role
  SELECT role INTO v_role FROM public.profiles WHERE id = v_user_id;
  IF v_role IS NULL OR v_role NOT IN ('cashier', 'bar_worker', 'sales_worker', 'admin', 'manager') THEN
    RAISE EXCEPTION 'You don''t have permission to use the MUNAJ BAR Worker POS.';
  END IF;

  -- Validate no active shift already exists
  SELECT id INTO v_active_shift_id 
  FROM public.shifts 
  WHERE worker_id = v_user_id AND status = 'active'
  LIMIT 1;

  IF v_active_shift_id IS NOT NULL THEN
    RAISE EXCEPTION 'You already have an active shift open.';
  END IF;

  IF p_opening_cash < 0 THEN
    RAISE EXCEPTION 'Opening cash cannot be negative.';
  END IF;

  -- Insert shift
  INSERT INTO public.shifts (worker_id, opening_cash, status, started_at)
  VALUES (v_user_id, COALESCE(p_opening_cash, 0), 'active', now())
  RETURNING * INTO v_shift_record;

  RETURN to_jsonb(v_shift_record);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- B. Get Active Shift Summary
CREATE OR REPLACE FUNCTION public.get_shift_summary(p_shift_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_shift public.shifts%ROWTYPE;
  v_cash_sales NUMERIC(12, 2) := 0;
  v_pos_sales NUMERIC(12, 2) := 0;
  v_transfer_sales NUMERIC(12, 2) := 0;
  v_total_sales NUMERIC(12, 2) := 0;
  v_transaction_count INT := 0;
  v_expected_cash NUMERIC(12, 2) := 0;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  SELECT * INTO v_shift FROM public.shifts WHERE id = p_shift_id AND worker_id = v_user_id;
  IF v_shift.id IS NULL THEN
    RAISE EXCEPTION 'Shift not found or access denied.';
  END IF;

  -- Sum sales by payment method
  SELECT 
    COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN payment_method = 'pos' THEN total ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN payment_method = 'transfer' THEN total ELSE 0 END), 0),
    COALESCE(SUM(total), 0),
    COUNT(id)
  INTO 
    v_cash_sales,
    v_pos_sales,
    v_transfer_sales,
    v_total_sales,
    v_transaction_count
  FROM public.sales
  WHERE shift_id = p_shift_id AND status = 'completed';

  v_expected_cash := v_shift.opening_cash + v_cash_sales;

  RETURN jsonb_build_object(
    'shift_id', v_shift.id,
    'worker_id', v_shift.worker_id,
    'status', v_shift.status,
    'started_at', v_shift.started_at,
    'ended_at', v_shift.ended_at,
    'opening_cash', v_shift.opening_cash,
    'cash_sales', v_cash_sales,
    'pos_sales', v_pos_sales,
    'transfer_sales', v_transfer_sales,
    'total_sales', v_total_sales,
    'transaction_count', v_transaction_count,
    'expected_cash', v_expected_cash,
    'ending_cash', v_shift.ending_cash,
    'cash_difference', v_shift.cash_difference
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- C. Close Worker Shift
CREATE OR REPLACE FUNCTION public.close_worker_shift(p_shift_id UUID, p_ending_cash NUMERIC)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_shift public.shifts%ROWTYPE;
  v_cash_sales NUMERIC(12, 2) := 0;
  v_pos_sales NUMERIC(12, 2) := 0;
  v_transfer_sales NUMERIC(12, 2) := 0;
  v_total_sales NUMERIC(12, 2) := 0;
  v_expected_cash NUMERIC(12, 2) := 0;
  v_cash_difference NUMERIC(12, 2) := 0;
  v_updated_shift public.shifts%ROWTYPE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  SELECT * INTO v_shift FROM public.shifts 
  WHERE id = p_shift_id AND worker_id = v_user_id FOR UPDATE;

  IF v_shift.id IS NULL THEN
    RAISE EXCEPTION 'Shift not found or access denied.';
  END IF;

  IF v_shift.status = 'closed' THEN
    RAISE EXCEPTION 'This shift is already closed and cannot be modified.';
  END IF;

  IF p_ending_cash < 0 THEN
    RAISE EXCEPTION 'Ending cash cannot be negative.';
  END IF;

  -- Calculate totals
  SELECT 
    COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN payment_method = 'pos' THEN total ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN payment_method = 'transfer' THEN total ELSE 0 END), 0),
    COALESCE(SUM(total), 0)
  INTO 
    v_cash_sales,
    v_pos_sales,
    v_transfer_sales,
    v_total_sales
  FROM public.sales
  WHERE shift_id = p_shift_id AND status = 'completed';

  v_expected_cash := v_shift.opening_cash + v_cash_sales;
  v_cash_difference := p_ending_cash - v_expected_cash;

  -- Close shift
  UPDATE public.shifts
  SET 
    ending_cash = p_ending_cash,
    expected_cash = v_expected_cash,
    cash_difference = v_cash_difference,
    ended_at = now(),
    status = 'closed',
    updated_at = now()
  WHERE id = p_shift_id
  RETURNING * INTO v_updated_shift;

  RETURN jsonb_build_object(
    'shift', to_jsonb(v_updated_shift),
    'summary', jsonb_build_object(
      'opening_cash', v_updated_shift.opening_cash,
      'cash_sales', v_cash_sales,
      'pos_sales', v_pos_sales,
      'transfer_sales', v_transfer_sales,
      'total_sales', v_total_sales,
      'expected_cash', v_expected_cash,
      'ending_cash', p_ending_cash,
      'cash_difference', v_cash_difference
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- D. Atomic Complete Sale Transaction
CREATE OR REPLACE FUNCTION public.complete_sale(
  p_payment_method TEXT,
  p_items JSONB,
  p_discount NUMERIC DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_worker_name TEXT;
  v_role TEXT;
  v_active_shift_id UUID;
  v_receipt_number TEXT;
  v_item JSONB;
  v_product_id UUID;
  v_quantity INT;
  v_product_record public.products%ROWTYPE;
  v_calculated_subtotal NUMERIC(12, 2) := 0;
  v_calculated_total NUMERIC(12, 2) := 0;
  v_item_total NUMERIC(12, 2) := 0;
  v_sale_id UUID;
  v_created_sale public.sales%ROWTYPE;
  v_items_result JSONB := '[]'::JSONB;
  v_seq_val BIGINT;
BEGIN
  -- 1. Verify Authenticated Worker
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated. Please sign in to make a sale.';
  END IF;

  -- 2. Verify Worker Role
  SELECT full_name, role INTO v_worker_name, v_role 
  FROM public.profiles WHERE id = v_user_id;

  IF v_role IS NULL OR v_role NOT IN ('cashier', 'bar_worker', 'sales_worker', 'admin', 'manager') THEN
    RAISE EXCEPTION 'You don''t have permission to use the MUNAJ BAR Worker POS.';
  END IF;

  -- 3. Verify Active Shift Exists
  SELECT id INTO v_active_shift_id 
  FROM public.shifts 
  WHERE worker_id = v_user_id AND status = 'active'
  LIMIT 1;

  IF v_active_shift_id IS NULL THEN
    RAISE EXCEPTION 'Your shift must be opened before you can make a sale.';
  END IF;

  -- 4. Validate Payment Method
  IF p_payment_method NOT IN ('cash', 'pos', 'transfer') THEN
    RAISE EXCEPTION 'Invalid payment method. Must be cash, pos, or transfer.';
  END IF;

  -- 5. Validate Items JSON Array
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty. Please add at least one product.';
  END IF;

  -- 6. Lock and Validate Products & Stocks, Calculate Subtotal
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := (v_item->>'quantity')::INT;

    IF v_quantity IS NULL OR v_quantity <= 0 THEN
      RAISE EXCEPTION 'Invalid quantity requested.';
    END IF;

    -- Lock row for concurrency safety
    SELECT * INTO v_product_record 
    FROM public.products 
    WHERE id = v_product_id 
    FOR UPDATE;

    IF v_product_record.id IS NULL THEN
      RAISE EXCEPTION 'One or more products in your cart could not be found.';
    END IF;

    IF NOT v_product_record.is_active THEN
      RAISE EXCEPTION 'Product % is no longer available for sale.', v_product_record.name;
    END IF;

    IF v_product_record.stock_quantity <= 0 THEN
      RAISE EXCEPTION 'This product is currently out of stock: %', v_product_record.name;
    END IF;

    IF v_product_record.stock_quantity < v_quantity THEN
      RAISE EXCEPTION 'Only % % units are available (requested %).', v_product_record.stock_quantity, v_product_record.name, v_quantity;
    END IF;

    v_item_total := v_product_record.selling_price * v_quantity;
    v_calculated_subtotal := v_calculated_subtotal + v_item_total;
  END LOOP;

  -- 7. Calculate Discount and Total
  p_discount := COALESCE(p_discount, 0);
  IF p_discount < 0 THEN
    p_discount := 0;
  END IF;
  IF p_discount > v_calculated_subtotal THEN
    p_discount := v_calculated_subtotal;
  END IF;

  v_calculated_total := v_calculated_subtotal - p_discount;

  -- 8. Generate Unique Sequential Receipt Number (e.g. MB-000001)
  SELECT nextval('receipt_number_seq') INTO v_seq_val;
  v_receipt_number := 'MB-' || LPAD(v_seq_val::TEXT, 6, '0');

  -- 9. Insert Sale
  INSERT INTO public.sales (
    receipt_number,
    worker_id,
    shift_id,
    subtotal,
    discount,
    total,
    payment_method,
    status,
    created_at
  ) VALUES (
    v_receipt_number,
    v_user_id,
    v_active_shift_id,
    v_calculated_subtotal,
    p_discount,
    v_calculated_total,
    p_payment_method,
    'completed',
    now()
  ) RETURNING * INTO v_created_sale;

  v_sale_id := v_created_sale.id;

  -- 10. Insert Sale Items and Deduct Inventory
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := (v_item->>'quantity')::INT;

    SELECT * INTO v_product_record FROM public.products WHERE id = v_product_id;

    v_item_total := v_product_record.selling_price * v_quantity;

    -- Insert sale item
    INSERT INTO public.sale_items (
      sale_id,
      product_id,
      product_name,
      quantity,
      unit_price,
      total
    ) VALUES (
      v_sale_id,
      v_product_id,
      v_product_record.name,
      v_quantity,
      v_product_record.selling_price,
      v_item_total
    );

    -- Deduct stock
    UPDATE public.products
    SET 
      stock_quantity = stock_quantity - v_quantity,
      updated_at = now()
    WHERE id = v_product_id;

    -- Append to items result for instant return
    v_items_result := v_items_result || jsonb_build_object(
      'product_id', v_product_id,
      'product_name', v_product_record.name,
      'quantity', v_quantity,
      'unit_price', v_product_record.selling_price,
      'total', v_item_total
    );
  END LOOP;

  -- Return complete receipt data
  RETURN jsonb_build_object(
    'id', v_created_sale.id,
    'receipt_number', v_created_sale.receipt_number,
    'worker_id', v_created_sale.worker_id,
    'worker_name', COALESCE(v_worker_name, 'Cashier'),
    'shift_id', v_created_sale.shift_id,
    'subtotal', v_created_sale.subtotal,
    'discount', v_created_sale.discount,
    'total', v_created_sale.total,
    'payment_method', v_created_sale.payment_method,
    'status', v_created_sale.status,
    'created_at', v_created_sale.created_at,
    'items', v_items_result
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- E. Log Receipt Print
CREATE OR REPLACE FUNCTION public.log_receipt_print(p_sale_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_print_record public.receipt_prints%ROWTYPE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  INSERT INTO public.receipt_prints (sale_id, worker_id, printed_at)
  VALUES (p_sale_id, v_user_id, now())
  RETURNING * INTO v_print_record;

  RETURN to_jsonb(v_print_record);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 9. SEED DATA (MUNAJ BAR Categories & Products)
-- Safe upsert of standard MUNAJ BAR inventory in Nigerian Naira
INSERT INTO public.categories (name, is_active)
VALUES 
  ('Beer', true),
  ('Spirits', true),
  ('Wines', true),
  ('Cocktails', true),
  ('Soft Drinks', true),
  ('Energy Drinks', true),
  ('Water', true),
  ('Food', true),
  ('Snacks', true),
  ('Other', true)
ON CONFLICT (name) DO UPDATE SET is_active = true;

-- Sample Product Catalog for MUNAJ BAR with realistic NGN prices & stock
DO $$
DECLARE
  v_cat_beer UUID;
  v_cat_spirits UUID;
  v_cat_wines UUID;
  v_cat_cocktails UUID;
  v_cat_soft UUID;
  v_cat_energy UUID;
  v_cat_water UUID;
  v_cat_food UUID;
  v_cat_snacks UUID;
BEGIN
  SELECT id INTO v_cat_beer FROM public.categories WHERE name = 'Beer';
  SELECT id INTO v_cat_spirits FROM public.categories WHERE name = 'Spirits';
  SELECT id INTO v_cat_wines FROM public.categories WHERE name = 'Wines';
  SELECT id INTO v_cat_cocktails FROM public.categories WHERE name = 'Cocktails';
  SELECT id INTO v_cat_soft FROM public.categories WHERE name = 'Soft Drinks';
  SELECT id INTO v_cat_energy FROM public.categories WHERE name = 'Energy Drinks';
  SELECT id INTO v_cat_water FROM public.categories WHERE name = 'Water';
  SELECT id INTO v_cat_food FROM public.categories WHERE name = 'Food';
  SELECT id INTO v_cat_snacks FROM public.categories WHERE name = 'Snacks';

  -- Only insert if products table is empty
  IF NOT EXISTS (SELECT 1 FROM public.products LIMIT 1) THEN
    INSERT INTO public.products (name, category_id, selling_price, cost_price, stock_quantity, minimum_stock_level, image_url)
    VALUES
      -- Beers
      ('Heineken (Bottle)', v_cat_beer, 2500, 1800, 48, 10, 'https://images.unsplash.com/photo-1618886614638-80e3c103d31a?w=400&auto=format&fit=crop&q=80'),
      ('Guinness Extra Stout', v_cat_beer, 2200, 1600, 36, 10, 'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=400&auto=format&fit=crop&q=80'),
      ('Budweiser (Can)', v_cat_beer, 2000, 1400, 60, 12, 'https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=400&auto=format&fit=crop&q=80'),
      ('Star Radler (Citrus)', v_cat_beer, 1800, 1200, 40, 10, 'https://images.unsplash.com/photo-1584225064785-c62a8b43d148?w=400&auto=format&fit=crop&q=80'),
      ('Desperados Tequila Beer', v_cat_beer, 2800, 2000, 24, 6, 'https://images.unsplash.com/photo-1567696911980-2eed69a46042?w=400&auto=format&fit=crop&q=80'),
      ('Trophy Lager', v_cat_beer, 1800, 1300, 50, 10, 'https://images.unsplash.com/photo-1571613316887-6f8d5cbf7ef7?w=400&auto=format&fit=crop&q=80'),

      -- Spirits & Whiskey
      ('Hennessy VS (Bottle)', v_cat_spirits, 65000, 50000, 8, 2, 'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=400&auto=format&fit=crop&q=80'),
      ('Hennessy VS (Shot)', v_cat_spirits, 4500, 2800, 50, 10, 'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=400&auto=format&fit=crop&q=80'),
      ('Jameson Black Barrel (Bottle)', v_cat_spirits, 42000, 32000, 10, 3, 'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=400&auto=format&fit=crop&q=80'),
      ('Jameson Irish Whiskey (Shot)', v_cat_spirits, 3000, 1800, 60, 15, 'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=400&auto=format&fit=crop&q=80'),
      ('Jack Daniel''s Old No.7 (Bottle)', v_cat_spirits, 38000, 28000, 12, 3, 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&auto=format&fit=crop&q=80'),
      ('Captain Morgan Spiced Rum', v_cat_spirits, 24000, 18000, 10, 2, 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&auto=format&fit=crop&q=80'),

      -- Wines
      ('Casillero del Diablo Cabernet', v_cat_wines, 22000, 16000, 15, 4, 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=400&auto=format&fit=crop&q=80'),
      ('Four Cousins Sweet Red', v_cat_wines, 16000, 11000, 20, 5, 'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=400&auto=format&fit=crop&q=80'),
      ('Veuve Clicquot Brut Champagne', v_cat_wines, 110000, 85000, 6, 2, 'https://images.unsplash.com/photo-1568213816046-0ee1c42bd559?w=400&auto=format&fit=crop&q=80'),
      ('J.P. Chenet Medium Sweet', v_cat_wines, 18000, 13000, 14, 3, 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=400&auto=format&fit=crop&q=80'),

      -- Cocktails
      ('Munaj Signature Chapman', v_cat_cocktails, 4000, 1500, 40, 10, 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=400&auto=format&fit=crop&q=80'),
      ('Classic Mojito (Mint & Rum)', v_cat_cocktails, 5000, 2000, 30, 8, 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=400&auto=format&fit=crop&q=80'),
      ('Long Island Iced Tea', v_cat_cocktails, 6500, 2800, 25, 5, 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&auto=format&fit=crop&q=80'),
      ('Blue Lagoon Sparkler', v_cat_cocktails, 4800, 1900, 20, 5, 'https://images.unsplash.com/photo-1536935338788-846bb9981813?w=400&auto=format&fit=crop&q=80'),

      -- Soft Drinks & Energy
      ('Coca-Cola (Glass Bottle)', v_cat_soft, 800, 450, 72, 15, 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&auto=format&fit=crop&q=80'),
      ('Schweppes Bitter Lemon', v_cat_soft, 900, 500, 48, 12, 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&auto=format&fit=crop&q=80'),
      ('Fanta Orange', v_cat_soft, 800, 450, 48, 12, 'https://images.unsplash.com/photo-1624517452488-04869289c4ca?w=400&auto=format&fit=crop&q=80'),
      ('Monster Energy (Can)', v_cat_energy, 2500, 1600, 36, 8, 'https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=400&auto=format&fit=crop&q=80'),
      ('Red Bull Energy Drink', v_cat_energy, 2800, 1800, 40, 10, 'https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=400&auto=format&fit=crop&q=80'),
      ('Eva Premium Bottled Water 75cl', v_cat_water, 600, 250, 100, 20, 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=400&auto=format&fit=crop&q=80'),

      -- Bar Food & Snacks
      ('Munaj Grilled Peppered Fish', v_cat_food, 9500, 5500, 20, 5, 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=400&auto=format&fit=crop&q=80'),
      ('Spicy Asun (Goat Meat Bowl)', v_cat_food, 6000, 3500, 25, 5, 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400&auto=format&fit=crop&q=80'),
      ('Crispy Peppered Chicken Wings (6 pcs)', v_cat_food, 5500, 3000, 30, 8, 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=400&auto=format&fit=crop&q=80'),
      ('Pringles Original Large Can', v_cat_snacks, 3500, 2400, 30, 6, 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=400&auto=format&fit=crop&q=80'),
      ('Roasted Salted Cashew Nuts', v_cat_snacks, 2500, 1500, 40, 10, 'https://images.unsplash.com/photo-1536591375315-1b8368903277?w=400&auto=format&fit=crop&q=80');
  END IF;
END $$;
