/*
# MUNAJ BAR — Full Database Schema Initialization

## Overview
This migration initializes the complete MUNAJ BAR database schema on the hosted Supabase project.
The database is currently empty (zero tables). This creates ALL tables, indexes, RLS policies,
RPC functions, triggers, storage buckets, and seed data required by the current application.

## Tables Created
1. **profiles** — User accounts linked to auth.users, with roles (admin, manager, cashier, bar_worker, sales_worker) and is_active flag
2. **categories** — Product categories (Beers, Spirits, Wines, etc.)
3. **products** — Bar inventory items with prices, stock levels, and image URLs
4. **stock_movements** — Inventory adjustment audit trail (restock, sale, damage, correction)
5. **shifts** — Worker shift records with opening/ending cash and status
6. **sales** — Transaction records with receipt numbers, totals, payment methods
7. **sale_items** — Line items for each sale (product snapshot, quantity, price)
8. **receipt_prints** — Thermal receipt print log
9. **notifications** — Worker/admin alerts and broadcast messages
10. **activity_logs** — Immutable audit trail for all business operations
11. **business_settings** — Single-row config: business name, currency, branding, receipt settings
12. **expenses** — Business expense records for P&L tracking (description, category, amount, date, notes)

## RPC Functions
- generate_receipt_number() — Sequential receipt number generator (MB-000001)
- log_activity_event() — Activity log helper
- get_current_user_role() — Returns authenticated user's role
- is_admin_or_manager() — Boolean role check used in RLS policies
- open_shift() — Opens a worker shift with admin-configured opening cash
- close_shift() — Closes a shift, calculates expected cash and difference
- adjust_stock() — Atomic stock adjustment with audit trail and low-stock alerts
- complete_sale() — Atomic sale transaction with inventory deduction and stock movements
- send_broadcast_notification() — Broadcasts messages to workers
- delete_worker_account() — Admin RPC for worker deletion (preserves historical data)
- delete_shift() — Admin RPC for shift deletion (preserves sales history)
- handle_new_user() — Auto-creates profile on auth signup

## RLS Policies
- All tables have RLS enabled
- Admins/managers have full access to all tables via is_admin_or_manager()
- Workers can view their own sales, shifts, and notifications
- Business settings are publicly readable (for receipts/branding)
- Expenses restricted to admin/manager only

## Storage
- product-images bucket (public read, authenticated write)
- business-assets bucket (public read, authenticated write)

## Realtime
- sales, products, shifts, notifications, stock_movements, activity_logs added to realtime publication

## Seed Data
- Default business settings row (MUNAJ BAR, NGN currency)
- Default categories (Beers & Ciders, Whiskey & Spirits, Wines & Champagnes, Cocktails & Mocktails, Soft Drinks & Water, Bar Snacks & Grill)

## Important Notes
1. This is an INITIAL schema for an empty database — no existing data is modified or deleted
2. All statements use IF NOT EXISTS for idempotency
3. Worker deletion RPC (delete_worker_account) is included as-is from the existing migration.sql
4. The expenses table uses RLS policies from the existing 20260915_create_expenses_table.sql migration
5. Foreign keys on sales/shifts/receipt_prints use ON DELETE SET NULL to preserve historical data when workers are deleted
*/

-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 2. TABLES
-- ============================================================================

-- PROFILES (Users and Roles)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'cashier', 'bar_worker', 'sales_worker')),
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CATEGORIES
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PRODUCTS
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    selling_price NUMERIC(12, 2) NOT NULL CHECK (selling_price >= 0),
    cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
    stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    minimum_stock_level INTEGER NOT NULL DEFAULT 5 CHECK (minimum_stock_level >= 0),
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- STOCK MOVEMENTS
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('sale', 'restock', 'adjustment', 'damage', 'correction')),
    quantity INTEGER NOT NULL,
    quantity_before INTEGER NOT NULL,
    quantity_after INTEGER NOT NULL,
    reason TEXT NOT NULL,
    reference_id TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SHIFTS
CREATE TABLE IF NOT EXISTS public.shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    opening_cash NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (opening_cash >= 0),
    ending_cash NUMERIC(12, 2) CHECK (ending_cash >= 0),
    expected_cash NUMERIC(12, 2),
    cash_difference NUMERIC(12, 2),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SALES
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

-- SALE ITEMS
CREATE TABLE IF NOT EXISTS public.sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    total NUMERIC(12, 2) NOT NULL CHECK (total >= 0)
);

-- RECEIPT PRINTS
CREATE TABLE IF NOT EXISTS public.receipt_prints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    printed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('info', 'warning', 'sale', 'shift', 'stock', 'system', 'new_sale', 'shift_started', 'shift_opened', 'shift_closed', 'low_stock', 'out_of_stock', 'admin_message', 'broadcast')),
    is_read BOOLEAN NOT NULL DEFAULT false,
    reference_type TEXT,
    reference_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ACTIVITY LOGS
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    actor_name TEXT NOT NULL DEFAULT 'System',
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- BUSINESS SETTINGS
CREATE TABLE IF NOT EXISTS public.business_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_name TEXT NOT NULL DEFAULT 'MUNAJ BAR',
    logo_url TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    currency TEXT NOT NULL DEFAULT 'NGN',
    currency_code TEXT NOT NULL DEFAULT 'NGN',
    currency_symbol TEXT NOT NULL DEFAULT '₦',
    receipt_header TEXT NOT NULL DEFAULT 'MUNAJ BAR & LOUNGE',
    receipt_footer TEXT NOT NULL DEFAULT 'Thank you for patronizing MUNAJ BAR.',
    worker_pos_name TEXT DEFAULT 'MUNAJ BAR',
    worker_pos_color TEXT DEFAULT '#B7FF00',
    worker_pos_branding JSONB NOT NULL DEFAULT '{"site_name": "MUNAJ BAR", "primary_color": "#B7FF00"}'::jsonb,
    admin_branding JSONB NOT NULL DEFAULT '{"primary_color": "#22C55E"}'::jsonb,
    default_opening_cash NUMERIC(12, 2) NOT NULL DEFAULT 50000.00 CHECK (default_opening_cash >= 0),
    receipt_printer_name TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- EXPENSES
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 3. INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_name ON public.products(name);

CREATE INDEX IF NOT EXISTS idx_sales_worker ON public.sales(worker_id);
CREATE INDEX IF NOT EXISTS idx_sales_shift ON public.sales(shift_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_payment_method ON public.sales(payment_method);
CREATE INDEX IF NOT EXISTS idx_sales_receipt_number ON public.sales(receipt_number);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON public.sale_items(product_id);

CREATE INDEX IF NOT EXISTS idx_shifts_worker ON public.shifts(worker_id);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON public.shifts(status);
CREATE INDEX IF NOT EXISTS idx_shifts_started_at ON public.shifts(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_actor ON public.activity_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_activity_created_at ON public.activity_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON public.stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON public.stock_movements(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_receipt_prints_sale_id ON public.receipt_prints(sale_id);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON public.expenses(created_by);

-- Enforce ONE active shift per worker at the DB level
CREATE UNIQUE INDEX IF NOT EXISTS idx_shifts_worker_active_unique
  ON public.shifts(worker_id)
  WHERE status = 'active';

-- ============================================================================
-- 4. SEQUENCE & HELPER FUNCTIONS
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS public.receipt_number_seq START WITH 1 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION public.generate_receipt_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    next_val BIGINT;
    formatted_num TEXT;
BEGIN
    next_val := nextval('public.receipt_number_seq');
    formatted_num := 'MB-' || LPAD(next_val::TEXT, 6, '0');
    RETURN formatted_num;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_activity_event(
    p_action TEXT,
    p_entity_type TEXT,
    p_entity_id TEXT,
    p_description TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_log_id UUID;
    v_actor_id UUID;
BEGIN
    v_actor_id := auth.uid();
    INSERT INTO public.activity_logs (
        actor_id,
        action,
        entity_type,
        entity_id,
        description,
        metadata
    ) VALUES (
        v_actor_id,
        p_action,
        p_entity_type,
        p_entity_id,
        p_description,
        p_metadata
    ) RETURNING id INTO v_log_id;
    RETURN v_log_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('admin', 'manager') AND is_active = true
    );
$$;

-- ============================================================================
-- 5. AUTH TRIGGER: Auto-create Profile on Auth Signup
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 6. BUSINESS LOGIC RPCS (ATOMIC TRANSACTIONS)
-- ============================================================================

-- 6.1 OPEN SHIFT
CREATE OR REPLACE FUNCTION public.open_shift(
    p_opening_cash NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_profile public.profiles%ROWTYPE;
    v_active_shift_id UUID;
    v_new_shift_id UUID;
    v_admin_float NUMERIC(12, 2);
    v_effective_opening_cash NUMERIC(12, 2);
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id AND is_active = true;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active user profile not found.';
    END IF;

    SELECT id INTO v_active_shift_id FROM public.shifts WHERE worker_id = v_user_id AND status = 'active' LIMIT 1;
    IF v_active_shift_id IS NOT NULL THEN
        RAISE EXCEPTION 'Worker already has an active shift (ID: %). Close it before opening a new one.', v_active_shift_id;
    END IF;

    SELECT COALESCE(default_opening_cash, 50000.00) INTO v_admin_float
    FROM public.business_settings
    ORDER BY updated_at DESC
    LIMIT 1;

    v_effective_opening_cash := COALESCE(v_admin_float, 50000.00);

    INSERT INTO public.shifts (
        worker_id,
        opening_cash,
        status,
        started_at
    ) VALUES (
        v_user_id,
        v_effective_opening_cash,
        'active',
        now()
    ) RETURNING id INTO v_new_shift_id;

    PERFORM public.log_activity_event(
        'shift_opened',
        'shifts',
        v_new_shift_id::TEXT,
        v_profile.full_name || ' opened shift with opening float ₦' || v_effective_opening_cash::TEXT,
        jsonb_build_object('worker_id', v_user_id, 'opening_cash', v_effective_opening_cash)
    );

    INSERT INTO public.notifications (
        recipient_id,
        title,
        message,
        type,
        reference_type,
        reference_id
    )
    SELECT
        id,
        'Shift Started',
        v_profile.full_name || ' started a new shift with float ₦' || v_effective_opening_cash::TEXT || '.',
        'shift_started',
        'shifts',
        v_new_shift_id::TEXT
    FROM public.profiles
    WHERE role IN ('admin', 'manager') AND is_active = true;

    RETURN jsonb_build_object(
        'success', true,
        'shift_id', v_new_shift_id,
        'worker_id', v_user_id,
        'opening_cash', v_effective_opening_cash,
        'status', 'active'
    );
END;
$$;

-- 6.2 CLOSE SHIFT
CREATE OR REPLACE FUNCTION public.close_shift(
    p_shift_id UUID,
    p_ending_cash NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_shift public.shifts%ROWTYPE;
    v_user_id UUID;
    v_is_admin BOOLEAN;
    v_cash_sales NUMERIC(12, 2) := 0;
    v_expected_cash NUMERIC(12, 2) := 0;
    v_cash_difference NUMERIC(12, 2) := 0;
    v_worker public.profiles%ROWTYPE;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT * INTO v_shift FROM public.shifts WHERE id = p_shift_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Shift not found.';
    END IF;

    IF v_shift.status = 'closed' THEN
        RAISE EXCEPTION 'Shift is already closed.';
    END IF;

    v_is_admin := public.is_admin_or_manager();
    IF v_shift.worker_id <> v_user_id AND NOT v_is_admin THEN
        RAISE EXCEPTION 'You are not authorized to close another worker''s shift.';
    END IF;

    SELECT * INTO v_worker FROM public.profiles WHERE id = v_shift.worker_id;

    SELECT COALESCE(SUM(total), 0) INTO v_cash_sales
    FROM public.sales
    WHERE shift_id = p_shift_id AND payment_method = 'cash' AND status = 'completed';

    v_expected_cash := COALESCE(v_shift.opening_cash, 0) + v_cash_sales;
    v_cash_difference := COALESCE(p_ending_cash, 0) - v_expected_cash;

    UPDATE public.shifts
    SET ending_cash = COALESCE(p_ending_cash, 0),
        expected_cash = v_expected_cash,
        cash_difference = v_cash_difference,
        ended_at = now(),
        status = 'closed',
        updated_at = now()
    WHERE id = p_shift_id;

    PERFORM public.log_activity_event(
        'shift_closed',
        'shifts',
        p_shift_id::TEXT,
        COALESCE(v_worker.full_name, 'Worker') || ' closed shift. Expected: ₦' || v_expected_cash::TEXT || ', Ending: ₦' || p_ending_cash::TEXT || ' (Diff: ₦' || v_cash_difference::TEXT || ')',
        jsonb_build_object(
            'shift_id', p_shift_id,
            'opening_cash', v_shift.opening_cash,
            'cash_sales', v_cash_sales,
            'ending_cash', p_ending_cash,
            'expected_cash', v_expected_cash,
            'cash_difference', v_cash_difference
        )
    );

    INSERT INTO public.notifications (
        recipient_id,
        title,
        message,
        type,
        reference_type,
        reference_id
    )
    SELECT
        id,
        'Shift Closed',
        COALESCE(v_worker.full_name, 'Worker') || ' closed their shift. Cash difference: ₦' || v_cash_difference::TEXT,
        'shift_closed',
        'shifts',
        p_shift_id::TEXT
    FROM public.profiles
    WHERE role IN ('admin', 'manager') AND is_active = true;

    RETURN jsonb_build_object(
        'success', true,
        'shift_id', p_shift_id,
        'opening_cash', v_shift.opening_cash,
        'cash_sales', v_cash_sales,
        'expected_cash', v_expected_cash,
        'ending_cash', p_ending_cash,
        'cash_difference', v_cash_difference,
        'status', 'closed'
    );
END;
$$;

-- 6.3 ADJUST STOCK
CREATE OR REPLACE FUNCTION public.adjust_stock(
    p_product_id UUID,
    p_quantity_change INTEGER,
    p_type TEXT,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_product public.products%ROWTYPE;
    v_new_stock INTEGER;
    v_movement_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    IF NOT public.is_admin_or_manager() THEN
        RAISE EXCEPTION 'Permission denied. Only admins or managers can manually adjust stock.';
    END IF;

    IF p_type NOT IN ('restock', 'adjustment', 'damage', 'correction') THEN
        RAISE EXCEPTION 'Invalid adjustment type: %', p_type;
    END IF;

    SELECT * INTO v_product FROM public.products WHERE id = p_product_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not found (ID: %).', p_product_id;
    END IF;

    v_new_stock := v_product.stock_quantity + p_quantity_change;
    IF v_new_stock < 0 THEN
        RAISE EXCEPTION 'Invalid adjustment: resulting stock cannot be negative (current: %, change: %).', v_product.stock_quantity, p_quantity_change;
    END IF;

    UPDATE public.products
    SET stock_quantity = v_new_stock,
        updated_at = now()
    WHERE id = p_product_id;

    INSERT INTO public.stock_movements (
        product_id,
        type,
        quantity,
        quantity_before,
        quantity_after,
        reason,
        created_by
    ) VALUES (
        p_product_id,
        p_type,
        p_quantity_change,
        v_product.stock_quantity,
        v_new_stock,
        p_reason,
        v_user_id
    ) RETURNING id INTO v_movement_id;

    PERFORM public.log_activity_event(
        'stock_adjusted',
        'products',
        p_product_id::TEXT,
        'Stock adjusted for ' || v_product.name || ' (' || v_product.stock_quantity || ' -> ' || v_new_stock || ') [' || p_type || ': ' || p_reason || ']',
        jsonb_build_object(
            'product_id', p_product_id,
            'quantity_before', v_product.stock_quantity,
            'quantity_change', p_quantity_change,
            'quantity_after', v_new_stock,
            'type', p_type,
            'reason', p_reason
        )
    );

    IF v_new_stock = 0 THEN
        INSERT INTO public.notifications (
            recipient_id,
            title,
            message,
            type,
            reference_type,
            reference_id
        )
        SELECT id, 'Out of Stock Alert', v_product.name || ' is now OUT OF STOCK.', 'out_of_stock', 'products', p_product_id::TEXT
        FROM public.profiles WHERE role IN ('admin', 'manager') AND is_active = true;
    ELSIF v_new_stock <= v_product.minimum_stock_level THEN
        INSERT INTO public.notifications (
            recipient_id,
            title,
            message,
            type,
            reference_type,
            reference_id
        )
        SELECT id, 'Low Stock Alert', v_product.name || ' is low in stock (' || v_new_stock || ' remaining).', 'low_stock', 'products', p_product_id::TEXT
        FROM public.profiles WHERE role IN ('admin', 'manager') AND is_active = true;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'product_id', p_product_id,
        'quantity_before', v_product.stock_quantity,
        'quantity_change', p_quantity_change,
        'quantity_after', v_new_stock,
        'movement_id', v_movement_id
    );
END;
$$;

-- 6.4 COMPLETE SALE
CREATE OR REPLACE FUNCTION public.complete_sale(
    p_shift_id UUID,
    p_items JSONB,
    p_payment_method TEXT,
    p_discount NUMERIC DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_worker public.profiles%ROWTYPE;
    v_shift public.shifts%ROWTYPE;
    v_item JSONB;
    v_product_id UUID;
    v_qty INTEGER;
    v_product public.products%ROWTYPE;
    v_subtotal NUMERIC(12, 2) := 0;
    v_item_total NUMERIC(12, 2) := 0;
    v_total NUMERIC(12, 2) := 0;
    v_receipt_number TEXT;
    v_sale_id UUID;
    v_new_stock INTEGER;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT * INTO v_worker FROM public.profiles WHERE id = v_user_id AND is_active = true;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Worker account is not active or does not exist.';
    END IF;

    SELECT * INTO v_shift FROM public.shifts WHERE id = p_shift_id AND status = 'active';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active shift not found. Please start a shift first.';
    END IF;

    IF v_shift.worker_id <> v_user_id THEN
        RAISE EXCEPTION 'Shift does not belong to the current authenticated worker.';
    END IF;

    IF p_payment_method NOT IN ('cash', 'pos', 'transfer') THEN
        RAISE EXCEPTION 'Invalid payment method: %. Must be cash, pos, or transfer.', p_payment_method;
    END IF;

    IF jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Cannot complete an empty sale.';
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_qty := (v_item->>'quantity')::INTEGER;

        IF v_qty <= 0 THEN
            RAISE EXCEPTION 'Item quantity must be greater than zero.';
        END IF;

        SELECT * INTO v_product FROM public.products WHERE id = v_product_id FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Product % does not exist.', v_product_id;
        END IF;

        IF NOT v_product.is_active THEN
            RAISE EXCEPTION 'Product "%" is currently deactivated.', v_product.name;
        END IF;

        IF v_product.stock_quantity < v_qty THEN
            RAISE EXCEPTION 'Insufficient stock for "%". Available: %, Requested: %.', v_product.name, v_product.stock_quantity, v_qty;
        END IF;

        v_item_total := v_product.selling_price * v_qty;
        v_subtotal := v_subtotal + v_item_total;
    END LOOP;

    v_total := GREATEST(0, v_subtotal - COALESCE(p_discount, 0));

    v_receipt_number := public.generate_receipt_number();

    INSERT INTO public.sales (
        receipt_number,
        worker_id,
        shift_id,
        subtotal,
        discount,
        total,
        payment_method,
        status
    ) VALUES (
        v_receipt_number,
        v_user_id,
        p_shift_id,
        v_subtotal,
        COALESCE(p_discount, 0),
        v_total,
        p_payment_method,
        'completed'
    ) RETURNING id INTO v_sale_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_qty := (v_item->>'quantity')::INTEGER;

        SELECT * INTO v_product FROM public.products WHERE id = v_product_id;
        v_item_total := v_product.selling_price * v_qty;
        v_new_stock := v_product.stock_quantity - v_qty;

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
            v_product.name,
            v_qty,
            v_product.selling_price,
            v_item_total
        );

        UPDATE public.products
        SET stock_quantity = v_new_stock,
            updated_at = now()
        WHERE id = p_product_id;

        INSERT INTO public.stock_movements (
            product_id,
            type,
            quantity,
            quantity_before,
            quantity_after,
            reason,
            reference_id,
            created_by
        ) VALUES (
            v_product_id,
            'sale',
            -v_qty,
            v_product.stock_quantity,
            v_new_stock,
            'Sale ' || v_receipt_number,
            v_sale_id::TEXT,
            v_user_id
        );

        IF v_new_stock = 0 THEN
            INSERT INTO public.notifications (
                recipient_id,
                title,
                message,
                type,
                reference_type,
                reference_id
            )
            SELECT id, 'Out of Stock', v_product.name || ' is now out of stock!', 'out_of_stock', 'products', v_product_id::TEXT
            FROM public.profiles WHERE role IN ('admin', 'manager') AND is_active = true;
        ELSIF v_new_stock <= v_product.minimum_stock_level THEN
            INSERT INTO public.notifications (
                recipient_id,
                title,
                message,
                type,
                reference_type,
                reference_id
            )
            SELECT id, 'Low Stock Alert', v_product.name || ' is low in stock (' || v_new_stock || ' left).', 'low_stock', 'products', v_product_id::TEXT
            FROM public.profiles WHERE role IN ('admin', 'manager') AND is_active = true;
        END IF;
    END LOOP;

    PERFORM public.log_activity_event(
        'sale_completed',
        'sales',
        v_sale_id::TEXT,
        v_worker.full_name || ' completed sale ' || v_receipt_number || ' for ₦' || v_total::TEXT || ' (' || UPPER(p_payment_method) || ')',
        jsonb_build_object(
            'sale_id', v_sale_id,
            'receipt_number', v_receipt_number,
            'total', v_total,
            'payment_method', p_payment_method,
            'worker_id', v_user_id
        )
    );

    INSERT INTO public.notifications (
        recipient_id,
        title,
        message,
        type,
        reference_type,
        reference_id
    )
    SELECT
        id,
        'New Sale — ₦' || v_total::TEXT,
        v_worker.full_name || ' sold ' || v_receipt_number || ' via ' || UPPER(p_payment_method),
        'new_sale',
        'sales',
        v_sale_id::TEXT
    FROM public.profiles
    WHERE role IN ('admin', 'manager') AND is_active = true;

    RETURN jsonb_build_object(
        'success', true,
        'sale_id', v_sale_id,
        'receipt_number', v_receipt_number,
        'subtotal', v_subtotal,
        'discount', p_discount,
        'total', v_total,
        'payment_method', p_payment_method,
        'created_at', now()
    );
END;
$$;

-- 6.5 BROADCAST NOTIFICATION
CREATE OR REPLACE FUNCTION public.send_broadcast_notification(
    p_title TEXT,
    p_message TEXT,
    p_recipient_ids UUID[] DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sender_id UUID;
    v_inserted_count INTEGER := 0;
    v_actor_role TEXT;
BEGIN
    v_sender_id := auth.uid();

    IF v_sender_id IS NOT NULL THEN
        SELECT role INTO v_actor_role FROM public.profiles WHERE id = v_sender_id AND is_active = true;
        IF v_actor_role IS NOT NULL AND v_actor_role NOT IN ('admin', 'manager') THEN
            RAISE EXCEPTION 'Permission denied. Only admins or managers can broadcast announcements.';
        END IF;
    END IF;

    IF p_recipient_ids IS NULL OR cardinality(p_recipient_ids) = 0 THEN
        INSERT INTO public.notifications (
            recipient_id,
            title,
            message,
            type,
            is_read
        ) VALUES (
            NULL,
            p_title,
            p_message,
            'admin_message',
            false
        );
        v_inserted_count := 1;

        INSERT INTO public.notifications (
            recipient_id,
            title,
            message,
            type,
            is_read
        )
        SELECT
            id,
            p_title,
            p_message,
            'admin_message',
            false
        FROM public.profiles
        WHERE role IN ('cashier', 'bar_worker', 'sales_worker', 'manager') AND is_active = true;

        GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
        IF v_inserted_count = 0 THEN
            v_inserted_count := 1;
        END IF;
    ELSE
        INSERT INTO public.notifications (
            recipient_id,
            title,
            message,
            type,
            is_read
        )
        SELECT
            p.id,
            p_title,
            p_message,
            'admin_message',
            false
        FROM unnest(p_recipient_ids) AS rid
        JOIN public.profiles p ON p.id = rid
        WHERE p.is_active = true;

        GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
    END IF;

    BEGIN
        INSERT INTO public.activity_logs (
            actor_id,
            action,
            entity_type,
            description,
            metadata
        ) VALUES (
            v_sender_id,
            'notification_broadcast',
            'notifications',
            'Admin broadcast announcement: "' || p_title || '" to ' || v_inserted_count || ' recipient(s)',
            jsonb_build_object('title', p_title, 'recipients_count', v_inserted_count)
        );
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    RETURN v_inserted_count;
END;
$$;

-- 6.6 LOG RECEIPT PRINT
CREATE OR REPLACE FUNCTION public.log_receipt_print(p_sale_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

-- ============================================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_prints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- 7.1 PROFILES POLICIES
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
    FOR SELECT TO authenticated USING (
        auth.uid() = id OR public.is_admin_or_manager()
    );

DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;
CREATE POLICY "profiles_admin_all" ON public.profiles
    FOR ALL TO authenticated USING (
        public.is_admin_or_manager()
    );

DROP POLICY IF EXISTS "profiles_admin_delete" ON public.profiles;
CREATE POLICY "profiles_admin_delete" ON public.profiles
    FOR DELETE TO authenticated USING (
        public.is_admin_or_manager() AND id <> auth.uid()
    );

-- 7.2 CATEGORIES POLICIES
DROP POLICY IF EXISTS "categories_select" ON public.categories;
CREATE POLICY "categories_select" ON public.categories
    FOR SELECT TO authenticated USING (
        is_active = true OR public.is_admin_or_manager()
    );

DROP POLICY IF EXISTS "categories_insert" ON public.categories;
CREATE POLICY "categories_insert" ON public.categories
    FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_manager());

DROP POLICY IF EXISTS "categories_update" ON public.categories;
CREATE POLICY "categories_update" ON public.categories
    FOR UPDATE TO authenticated USING (public.is_admin_or_manager()) WITH CHECK (public.is_admin_or_manager());

DROP POLICY IF EXISTS "categories_delete" ON public.categories;
CREATE POLICY "categories_delete" ON public.categories
    FOR DELETE TO authenticated USING (public.is_admin_or_manager());

-- 7.3 PRODUCTS POLICIES
DROP POLICY IF EXISTS "products_read" ON public.products;
CREATE POLICY "products_read" ON public.products
    FOR SELECT TO authenticated USING (
        is_active = true OR public.is_admin_or_manager()
    );

DROP POLICY IF EXISTS "products_admin_modify" ON public.products;
CREATE POLICY "products_admin_modify" ON public.products
    FOR ALL TO authenticated USING (public.is_admin_or_manager());

-- 7.4 STOCK MOVEMENTS POLICIES
DROP POLICY IF EXISTS "stock_movements_read" ON public.stock_movements;
CREATE POLICY "stock_movements_read" ON public.stock_movements
    FOR SELECT TO authenticated USING (public.is_admin_or_manager());

DROP POLICY IF EXISTS "stock_movements_insert_rpc" ON public.stock_movements;
CREATE POLICY "stock_movements_insert_rpc" ON public.stock_movements
    FOR INSERT TO authenticated WITH CHECK (
        public.is_admin_or_manager() OR auth.uid() IS NOT NULL
    );

DROP POLICY IF EXISTS "stock_movements_delete" ON public.stock_movements;
CREATE POLICY "stock_movements_delete" ON public.stock_movements
    FOR DELETE TO authenticated USING (public.is_admin_or_manager());

-- 7.5 SHIFTS POLICIES
DROP POLICY IF EXISTS "shifts_select" ON public.shifts;
CREATE POLICY "shifts_select" ON public.shifts
    FOR SELECT TO authenticated USING (
        worker_id = auth.uid() OR public.is_admin_or_manager()
    );

DROP POLICY IF EXISTS "shifts_worker_insert" ON public.shifts;
CREATE POLICY "shifts_worker_insert" ON public.shifts
    FOR INSERT TO authenticated WITH CHECK (
        worker_id = auth.uid() OR public.is_admin_or_manager()
    );

DROP POLICY IF EXISTS "shifts_update" ON public.shifts;
CREATE POLICY "shifts_update" ON public.shifts
    FOR UPDATE TO authenticated USING (
        (worker_id = auth.uid() AND status = 'active') OR public.is_admin_or_manager()
    );

DROP POLICY IF EXISTS "shifts_delete" ON public.shifts;
CREATE POLICY "shifts_delete" ON public.shifts
    FOR DELETE TO authenticated USING (public.is_admin_or_manager());

-- 7.6 SALES POLICIES
DROP POLICY IF EXISTS "sales_select" ON public.sales;
CREATE POLICY "sales_select" ON public.sales
    FOR SELECT TO authenticated USING (
        worker_id = auth.uid() OR public.is_admin_or_manager()
    );

DROP POLICY IF EXISTS "sales_insert" ON public.sales;
CREATE POLICY "sales_insert" ON public.sales
    FOR INSERT TO authenticated WITH CHECK (
        worker_id = auth.uid() OR public.is_admin_or_manager()
    );

DROP POLICY IF EXISTS "sales_delete" ON public.sales;
CREATE POLICY "sales_delete" ON public.sales
    FOR DELETE TO authenticated USING (public.is_admin_or_manager());

-- 7.7 SALE ITEMS POLICIES
DROP POLICY IF EXISTS "sale_items_select" ON public.sale_items;
CREATE POLICY "sale_items_select" ON public.sale_items
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.sales s
            WHERE s.id = sale_items.sale_id
            AND (s.worker_id = auth.uid() OR public.is_admin_or_manager())
        )
    );

DROP POLICY IF EXISTS "sale_items_insert" ON public.sale_items;
CREATE POLICY "sale_items_insert" ON public.sale_items
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.sales s
            WHERE s.id = sale_items.sale_id
            AND (s.worker_id = auth.uid() OR public.is_admin_or_manager())
        )
    );

DROP POLICY IF EXISTS "sale_items_delete" ON public.sale_items;
CREATE POLICY "sale_items_delete" ON public.sale_items
    FOR DELETE TO authenticated USING (public.is_admin_or_manager());

-- 7.8 RECEIPT PRINTS POLICIES
DROP POLICY IF EXISTS "receipt_prints_select" ON public.receipt_prints;
CREATE POLICY "receipt_prints_select" ON public.receipt_prints
    FOR SELECT TO authenticated USING (
        worker_id = auth.uid() OR public.is_admin_or_manager()
    );

DROP POLICY IF EXISTS "receipt_prints_insert" ON public.receipt_prints;
CREATE POLICY "receipt_prints_insert" ON public.receipt_prints
    FOR INSERT TO authenticated WITH CHECK (
        worker_id = auth.uid() OR public.is_admin_or_manager()
    );

DROP POLICY IF EXISTS "receipt_prints_delete" ON public.receipt_prints;
CREATE POLICY "receipt_prints_delete" ON public.receipt_prints
    FOR DELETE TO authenticated USING (public.is_admin_or_manager());

-- 7.9 NOTIFICATIONS POLICIES
DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
CREATE POLICY "notifications_select" ON public.notifications
    FOR SELECT TO authenticated USING (
        recipient_id = auth.uid() OR recipient_id IS NULL OR public.is_admin_or_manager()
    );

DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
CREATE POLICY "notifications_update" ON public.notifications
    FOR UPDATE TO authenticated USING (
        recipient_id = auth.uid() OR public.is_admin_or_manager()
    );

DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
CREATE POLICY "notifications_insert" ON public.notifications
    FOR INSERT TO authenticated WITH CHECK (
        public.is_admin_or_manager() OR auth.uid() IS NOT NULL
    );

DROP POLICY IF EXISTS "notifications_delete" ON public.notifications;
CREATE POLICY "notifications_delete" ON public.notifications
    FOR DELETE TO authenticated USING (
        recipient_id = auth.uid() OR recipient_id IS NULL OR public.is_admin_or_manager()
    );

-- 7.10 ACTIVITY LOGS POLICIES
DROP POLICY IF EXISTS "activity_logs_select" ON public.activity_logs;
CREATE POLICY "activity_logs_select" ON public.activity_logs
    FOR SELECT TO authenticated USING (public.is_admin_or_manager());

DROP POLICY IF EXISTS "activity_logs_insert" ON public.activity_logs;
CREATE POLICY "activity_logs_insert" ON public.activity_logs
    FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "activity_logs_delete" ON public.activity_logs;
CREATE POLICY "activity_logs_delete" ON public.activity_logs
    FOR DELETE TO authenticated USING (public.is_admin_or_manager());

-- 7.11 BUSINESS SETTINGS POLICIES
DROP POLICY IF EXISTS "business_settings_select" ON public.business_settings;
CREATE POLICY "business_settings_select" ON public.business_settings
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "business_settings_admin_modify" ON public.business_settings;
CREATE POLICY "business_settings_admin_modify" ON public.business_settings
    FOR ALL TO authenticated USING (public.is_admin_or_manager());

-- 7.12 EXPENSES POLICIES (Admin/Manager only)
DROP POLICY IF EXISTS "expenses_select" ON public.expenses;
CREATE POLICY "expenses_select" ON public.expenses
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role::text IN ('admin', 'manager', 'super_admin')
        )
    );

DROP POLICY IF EXISTS "expenses_insert" ON public.expenses;
CREATE POLICY "expenses_insert" ON public.expenses
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role::text IN ('admin', 'manager', 'super_admin')
        )
    );

DROP POLICY IF EXISTS "expenses_update" ON public.expenses;
CREATE POLICY "expenses_update" ON public.expenses
    FOR UPDATE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role::text IN ('admin', 'manager', 'super_admin')
        )
    );

DROP POLICY IF EXISTS "expenses_delete" ON public.expenses;
CREATE POLICY "expenses_delete" ON public.expenses
    FOR DELETE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role::text IN ('admin', 'manager', 'super_admin')
        )
    );

-- ============================================================================
-- 8. REALTIME SETUP
-- ============================================================================
DO $$
BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.sales, public.products, public.shifts, public.notifications, public.stock_movements, public.activity_logs';
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN others THEN NULL;
END;
$$;

-- ============================================================================
-- 9. STORAGE BUCKETS & POLICIES
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    ('product-images', 'product-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg']),
    ('business-assets', 'business-assets', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg'])
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

DROP POLICY IF EXISTS "Public can view product images" ON storage.objects;
CREATE POLICY "Public can view product images"
ON storage.objects FOR SELECT
USING (bucket_id IN ('product-images', 'business-assets'));

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
USING (bucket_id IN ('product-images', 'business-assets'));

-- ============================================================================
-- 10. WORKER DELETION & REFERENTIAL INTEGRITY PRESERVATION
-- ============================================================================

-- Relax foreign keys to SET NULL on delete so business revenue records are never lost
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'sales' AND column_name = 'worker_id'
    ) THEN
        ALTER TABLE public.sales ALTER COLUMN worker_id DROP NOT NULL;
        ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_worker_id_fkey;
        ALTER TABLE public.sales ADD CONSTRAINT sales_worker_id_fkey
            FOREIGN KEY (worker_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'receipt_prints' AND column_name = 'worker_id'
    ) THEN
        ALTER TABLE public.receipt_prints ALTER COLUMN worker_id DROP NOT NULL;
        ALTER TABLE public.receipt_prints DROP CONSTRAINT IF EXISTS receipt_prints_worker_id_fkey;
        ALTER TABLE public.receipt_prints ADD CONSTRAINT receipt_prints_worker_id_fkey
            FOREIGN KEY (worker_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'shifts' AND column_name = 'worker_id'
    ) THEN
        ALTER TABLE public.shifts ALTER COLUMN worker_id DROP NOT NULL;
        ALTER TABLE public.shifts DROP CONSTRAINT IF EXISTS shifts_worker_id_fkey;
        ALTER TABLE public.shifts ADD CONSTRAINT shifts_worker_id_fkey
            FOREIGN KEY (worker_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'sales' AND column_name = 'shift_id'
    ) THEN
        ALTER TABLE public.sales ALTER COLUMN shift_id DROP NOT NULL;
        ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_shift_id_fkey;
        ALTER TABLE public.sales ADD CONSTRAINT sales_shift_id_fkey
            FOREIGN KEY (shift_id) REFERENCES public.shifts(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Ensure profiles has is_active and status columns
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'status'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN status TEXT DEFAULT 'active';
        UPDATE public.profiles SET status = CASE WHEN is_active = false THEN 'deactivated' ELSE 'active' END;
    END IF;
END $$;

-- Atomic Database RPC: delete_worker_account
CREATE OR REPLACE FUNCTION public.delete_worker_account(
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_requester_id UUID;
    v_requester_role TEXT;
    v_performer_name TEXT;
    v_target_profile public.profiles%ROWTYPE;
BEGIN
    v_requester_id := auth.uid();

    IF v_requester_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Unauthorized: You must be logged in to delete a user account.'
        );
    END IF;

    SELECT role, full_name INTO v_requester_role, v_performer_name
    FROM public.profiles
    WHERE id = v_requester_id AND is_active = true;

    IF v_requester_role NOT IN ('admin', 'manager') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Forbidden: Only authorized administrators can delete worker accounts.'
        );
    END IF;

    IF v_requester_id = p_user_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Forbidden: You cannot delete your own active administrator account.'
        );
    END IF;

    SELECT * INTO v_target_profile
    FROM public.profiles
    WHERE id = p_user_id;

    IF v_target_profile.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Target user does not exist or has already been deleted.'
        );
    END IF;

    -- Preserve Historical Financial Data
    UPDATE public.shifts
    SET status = 'closed', ended_at = now()
    WHERE worker_id = p_user_id AND status = 'active';

    UPDATE public.sales SET worker_id = NULL WHERE worker_id = p_user_id;
    UPDATE public.receipt_prints SET worker_id = NULL WHERE worker_id = p_user_id;
    UPDATE public.shifts SET worker_id = NULL WHERE worker_id = p_user_id;
    UPDATE public.activity_logs SET actor_id = NULL WHERE actor_id = p_user_id;
    UPDATE public.business_settings SET updated_by = NULL WHERE updated_by = p_user_id;

    DELETE FROM public.notifications WHERE recipient_id = p_user_id;

    DELETE FROM public.profiles WHERE id = p_user_id;

    BEGIN
        DELETE FROM auth.users WHERE id = p_user_id;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Notice while removing from auth.users: %', SQLERRM;
    END;

    INSERT INTO public.activity_logs (
        action,
        entity_type,
        entity_id,
        description,
        actor_id,
        metadata
    ) VALUES (
        'user_deleted',
        'profiles',
        p_user_id::text,
        'Permanently deleted worker account "' || v_target_profile.full_name || '" (' || v_target_profile.email || ') by ' || COALESCE(v_performer_name, 'Admin'),
        v_requester_id,
        jsonb_build_object(
            'user_id', p_user_id,
            'full_name', v_target_profile.full_name,
            'email', v_target_profile.email,
            'role', v_target_profile.role,
            'deleted_by', COALESCE(v_performer_name, 'Admin'),
            'timestamp', now()
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', 'User deleted successfully.',
        'deleted_user_id', p_user_id
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_worker_account(UUID) TO authenticated;

-- Atomic Database RPC: delete_shift
CREATE OR REPLACE FUNCTION public.delete_shift(
    p_shift_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_requester_id UUID;
    v_requester_role TEXT;
    v_performer_name TEXT;
    v_shift public.shifts%ROWTYPE;
    v_sales_count INT;
BEGIN
    v_requester_id := auth.uid();

    IF v_requester_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Unauthorized: You must be logged in to delete a shift record.'
        );
    END IF;

    SELECT role, full_name INTO v_requester_role, v_performer_name
    FROM public.profiles
    WHERE id = v_requester_id AND is_active = true;

    IF v_requester_role NOT IN ('admin', 'manager') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Forbidden: Only authorized administrators can delete shift records.'
        );
    END IF;

    SELECT * INTO v_shift
    FROM public.shifts
    WHERE id = p_shift_id;

    IF v_shift.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Shift record does not exist or has already been deleted.'
        );
    END IF;

    IF v_shift.status = 'active' OR v_shift.ended_at IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'This shift is currently active and cannot be deleted. End or close the shift first.'
        );
    END IF;

    SELECT COUNT(*) INTO v_sales_count
    FROM public.sales
    WHERE shift_id = p_shift_id;

    IF v_sales_count > 0 THEN
        UPDATE public.sales
        SET shift_id = NULL
        WHERE shift_id = p_shift_id;
    END IF;

    DELETE FROM public.shifts
    WHERE id = p_shift_id;

    INSERT INTO public.activity_logs (
        action,
        entity_type,
        entity_id,
        description,
        actor_id,
        metadata
    ) VALUES (
        'shift_deleted',
        'shifts',
        p_shift_id,
        'Permanently deleted shift (' || v_shift.started_at || ') by ' || COALESCE(v_performer_name, 'Admin'),
        v_requester_id,
        jsonb_build_object(
            'shift_id', p_shift_id,
            'deleted_by', COALESCE(v_performer_name, 'Admin'),
            'database_deleted', true,
            'preserved_sales_count', v_sales_count,
            'timestamp', now()
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Shift deleted permanently from database.',
        'deleted_shift_id', p_shift_id
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_shift(UUID) TO authenticated;

-- ============================================================================
-- 11. SEED DATA
-- ============================================================================

-- Business Settings default
INSERT INTO public.business_settings (
    business_name,
    currency,
    currency_code,
    currency_symbol,
    receipt_footer
) VALUES (
    'MUNAJ BAR',
    'NGN',
    'NGN',
    '₦',
    'Thank you for patronizing MUNAJ BAR.'
) ON CONFLICT DO NOTHING;

-- Default Categories
INSERT INTO public.categories (name, is_active) VALUES
    ('Beers & Ciders', true),
    ('Whiskey & Spirits', true),
    ('Wines & Champagnes', true),
    ('Cocktails & Mocktails', true),
    ('Soft Drinks & Water', true),
    ('Bar Snacks & Grill', true)
ON CONFLICT (name) DO NOTHING;