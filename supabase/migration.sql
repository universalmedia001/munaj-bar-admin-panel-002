-- ============================================================================
-- MUNAJ BAR — MASTER SUPABASE SQL MIGRATION
-- PRODUCTION-READY / SINGLE SOURCE OF TRUTH FOR ADMIN PANEL & WORKER POS
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 2. TABLES & ENUMS
-- ============================================================================

-- PROFILES (Users and Roles)
-- Roles: admin, manager, cashier, bar_worker, sales_worker
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
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('new_sale', 'sale', 'shift_started', 'shift_opened', 'shift_closed', 'low_stock', 'out_of_stock', 'admin_message', 'broadcast', 'system')),
    reference_type TEXT,
    reference_id TEXT,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ACTIVITY LOGS
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
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
    receipt_footer TEXT NOT NULL DEFAULT 'Thank you for patronizing MUNAJ BAR.',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    worker_pos_name TEXT DEFAULT 'MUNAJ BAR',
    worker_pos_color TEXT DEFAULT '#B7FF00',
    default_opening_cash NUMERIC(12, 2) NOT NULL DEFAULT 50000.00 CHECK (default_opening_cash >= 0)
);

-- Ensure default_opening_cash exists on existing installations
ALTER TABLE public.business_settings ADD COLUMN IF NOT EXISTS worker_pos_name TEXT DEFAULT 'MUNAJ BAR';
ALTER TABLE public.business_settings ADD COLUMN IF NOT EXISTS worker_pos_color TEXT DEFAULT '#B7FF00';
ALTER TABLE public.business_settings ADD COLUMN IF NOT EXISTS default_opening_cash NUMERIC(12, 2) NOT NULL DEFAULT 50000.00 CHECK (default_opening_cash >= 0);
ALTER TABLE public.business_settings ADD COLUMN IF NOT EXISTS receipt_printer_name TEXT;

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

-- ============================================================================
-- 4. SEQUENCE & HELPER FUNCTIONS
-- ============================================================================

-- Receipt Number Generator: MB-000001
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

-- Activity Logging Helper
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

-- Helper to check user role
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
-- 5. BUSINESS LOGIC RPCS (ATOMIC TRANSACTIONS)
-- ============================================================================

-- 5.1 OPEN SHIFT
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

    -- Verify profile
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id AND is_active = true;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active user profile not found.';
    END IF;

    -- Check if worker already has an active shift
    SELECT id INTO v_active_shift_id FROM public.shifts WHERE worker_id = v_user_id AND status = 'active' LIMIT 1;
    IF v_active_shift_id IS NOT NULL THEN
        RAISE EXCEPTION 'Worker already has an active shift (ID: %). Close it before opening a new one.', v_active_shift_id;
    END IF;

    -- Retrieve Admin-configured default opening cash float from business_settings
    -- Shift start ignores untrusted client arguments to enforce Admin authorization
    SELECT COALESCE(default_opening_cash, 50000.00) INTO v_admin_float
    FROM public.business_settings
    ORDER BY updated_at DESC
    LIMIT 1;

    v_effective_opening_cash := COALESCE(v_admin_float, 50000.00);

    -- Create shift with authorized admin-configured opening float
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

    -- Log activity
    PERFORM public.log_activity_event(
        'shift_opened',
        'shifts',
        v_new_shift_id::TEXT,
        v_profile.full_name || ' opened shift with opening float ₦' || v_effective_opening_cash::TEXT,
        jsonb_build_object('worker_id', v_user_id, 'opening_cash', v_effective_opening_cash)
    );

    -- Notify admins/managers
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

-- 5.2 CLOSE SHIFT
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

    -- Calculate total cash sales in this shift
    SELECT COALESCE(SUM(total), 0) INTO v_cash_sales
    FROM public.sales
    WHERE shift_id = p_shift_id AND payment_method = 'cash' AND status = 'completed';

    -- Expected cash = opening cash + cash sales
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

    -- Log activity
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

    -- Notify admins
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

-- 5.3 ADJUST STOCK (ATOMIC WITH AUDIT TRAIL)
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

    -- Lock product row for update
    SELECT * INTO v_product FROM public.products WHERE id = p_product_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not found (ID: %).', p_product_id;
    END IF;

    v_new_stock := v_product.stock_quantity + p_quantity_change;
    IF v_new_stock < 0 THEN
        RAISE EXCEPTION 'Invalid adjustment: resulting stock cannot be negative (current: %, change: %).', v_product.stock_quantity, p_quantity_change;
    END IF;

    -- Update product stock
    UPDATE public.products
    SET stock_quantity = v_new_stock,
        updated_at = now()
    WHERE id = p_product_id;

    -- Insert stock movement record
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

    -- Log activity
    PERFORM public.log_activity_event(
        'stock_adjusted',
        'products',
        p_product_id::TEXT,
        'Stock adjusted for ' || v_product.name || ' (' || v_product.stock_quantity || ' → ' || v_new_stock || ') [' || p_type || ': ' || p_reason || ']',
        jsonb_build_object(
            'product_id', p_product_id,
            'quantity_before', v_product.stock_quantity,
            'quantity_change', p_quantity_change,
            'quantity_after', v_new_stock,
            'type', p_type,
            'reason', p_reason
        )
    );

    -- Low/out of stock notification if triggered
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

-- 5.4 COMPLETE SALE (STRICT ATOMIC TRANSACTION WITH CONCURRENCY LOCKS)
CREATE OR REPLACE FUNCTION public.complete_sale(
    p_shift_id UUID,
    p_items JSONB,              -- Array of objects: [{"product_id": "uuid", "quantity": 1}]
    p_payment_method TEXT,      -- 'cash', 'pos', 'transfer'
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

    -- 1. Verify worker profile
    SELECT * INTO v_worker FROM public.profiles WHERE id = v_user_id AND is_active = true;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Worker account is not active or does not exist.';
    END IF;

    -- 2. Verify shift
    SELECT * INTO v_shift FROM public.shifts WHERE id = p_shift_id AND status = 'active';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active shift not found. Please start a shift first.';
    END IF;

    IF v_shift.worker_id <> v_user_id THEN
        RAISE EXCEPTION 'Shift does not belong to the current authenticated worker.';
    END IF;

    -- 3. Validate payment method
    IF p_payment_method NOT IN ('cash', 'pos', 'transfer') THEN
        RAISE EXCEPTION 'Invalid payment method: %. Must be cash, pos, or transfer.', p_payment_method;
    END IF;

    -- 4. Validate items array
    IF jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Cannot complete an empty sale.';
    END IF;

    -- 5. Lock and validate all products & calculate true database prices
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_qty := (v_item->>'quantity')::INTEGER;

        IF v_qty <= 0 THEN
            RAISE EXCEPTION 'Item quantity must be greater than zero.';
        END IF;

        -- Concurrency lock: FOR UPDATE
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

    -- Compute grand total
    v_total := GREATEST(0, v_subtotal - COALESCE(p_discount, 0));

    -- 6. Generate receipt number server-side
    v_receipt_number := public.generate_receipt_number();

    -- 7. Insert Sale record
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

    -- 8. Insert Sale Items, deduct inventory, record stock movements
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_qty := (v_item->>'quantity')::INTEGER;

        SELECT * INTO v_product FROM public.products WHERE id = v_product_id;
        v_item_total := v_product.selling_price * v_qty;
        v_new_stock := v_product.stock_quantity - v_qty;

        -- Insert sale item snapshot
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

        -- Update product inventory
        UPDATE public.products
        SET stock_quantity = v_new_stock,
            updated_at = now()
        WHERE id = v_product_id;

        -- Record stock movement
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

        -- Check low/out of stock trigger
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

    -- 9. Log activity
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

    -- 10. Notify admins
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

-- 5.5 BROADCAST NOTIFICATION HELPER
CREATE OR REPLACE FUNCTION public.send_broadcast_notification(
    p_title TEXT,
    p_message TEXT,
    p_recipient_ids UUID[] DEFAULT NULL -- NULL means all active workers & terminals
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
    
    -- Role check if authenticated
    IF v_sender_id IS NOT NULL THEN
        SELECT role INTO v_actor_role FROM public.profiles WHERE id = v_sender_id AND is_active = true;
        IF v_actor_role IS NOT NULL AND v_actor_role NOT IN ('admin', 'manager') THEN
            RAISE EXCEPTION 'Permission denied. Only admins or managers can broadcast announcements.';
        END IF;
    END IF;

    IF p_recipient_ids IS NULL OR cardinality(p_recipient_ids) = 0 THEN
        -- 1. Insert global notification (recipient_id = NULL) so all active POS terminals receive it
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

        -- 2. Also insert individual notification rows for all active workers
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
        -- Send to specific selected workers
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

    -- Log activity (safe exception-trapped insert)
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
        -- Do not fail broadcast if activity log table encounters an issue
    END;

    RETURN v_inserted_count;
END;
$$;

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
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

-- 6.1 PROFILES POLICIES
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
    FOR SELECT USING (
        auth.uid() = id OR public.is_admin_or_manager()
    );

DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;
CREATE POLICY "profiles_admin_all" ON public.profiles
    FOR ALL USING (
        public.is_admin_or_manager()
    );

-- 6.2 CATEGORIES POLICIES
DROP POLICY IF EXISTS "categories_read_all" ON public.categories;
DROP POLICY IF EXISTS "categories_admin_modify" ON public.categories;
DROP POLICY IF EXISTS "categories_select" ON public.categories;
DROP POLICY IF EXISTS "categories_insert" ON public.categories;
DROP POLICY IF EXISTS "categories_update" ON public.categories;
DROP POLICY IF EXISTS "categories_delete" ON public.categories;

CREATE POLICY "categories_select" ON public.categories
    FOR SELECT USING (
        is_active = true 
        OR auth.uid() IS NOT NULL
    );

CREATE POLICY "categories_insert" ON public.categories
    FOR INSERT WITH CHECK (
        public.is_admin_or_manager()
        OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'manager')
        OR (auth.jwt() ->> 'role') = 'service_role'
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'manager') AND is_active = true
        )
    );

CREATE POLICY "categories_update" ON public.categories
    FOR UPDATE USING (
        public.is_admin_or_manager()
        OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'manager')
        OR (auth.jwt() ->> 'role') = 'service_role'
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'manager') AND is_active = true
        )
    ) WITH CHECK (
        public.is_admin_or_manager()
        OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'manager')
        OR (auth.jwt() ->> 'role') = 'service_role'
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'manager') AND is_active = true
        )
    );

CREATE POLICY "categories_delete" ON public.categories
    FOR DELETE USING (
        public.is_admin_or_manager()
        OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'manager')
        OR (auth.jwt() ->> 'role') = 'service_role'
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'manager') AND is_active = true
        )
    );

-- 6.3 PRODUCTS POLICIES
DROP POLICY IF EXISTS "products_read" ON public.products;
CREATE POLICY "products_read" ON public.products
    FOR SELECT USING (
        is_active = true OR public.is_admin_or_manager()
    );

DROP POLICY IF EXISTS "products_admin_modify" ON public.products;
CREATE POLICY "products_admin_modify" ON public.products
    FOR ALL USING (
        public.is_admin_or_manager()
    );

-- 6.4 STOCK MOVEMENTS POLICIES
DROP POLICY IF EXISTS "stock_movements_read" ON public.stock_movements;
CREATE POLICY "stock_movements_read" ON public.stock_movements
    FOR SELECT USING (
        public.is_admin_or_manager()
    );

DROP POLICY IF EXISTS "stock_movements_insert_rpc" ON public.stock_movements;
CREATE POLICY "stock_movements_insert_rpc" ON public.stock_movements
    FOR INSERT WITH CHECK (
        public.is_admin_or_manager() OR auth.uid() IS NOT NULL
    );

DROP POLICY IF EXISTS "stock_movements_delete" ON public.stock_movements;
CREATE POLICY "stock_movements_delete" ON public.stock_movements
    FOR DELETE USING (
        public.is_admin_or_manager()
    );

-- 6.5 SHIFTS POLICIES
DROP POLICY IF EXISTS "shifts_select" ON public.shifts;
CREATE POLICY "shifts_select" ON public.shifts
    FOR SELECT USING (
        worker_id = auth.uid() OR public.is_admin_or_manager()
    );

DROP POLICY IF EXISTS "shifts_worker_insert" ON public.shifts;
CREATE POLICY "shifts_worker_insert" ON public.shifts
    FOR INSERT WITH CHECK (
        worker_id = auth.uid() OR public.is_admin_or_manager()
    );

DROP POLICY IF EXISTS "shifts_update" ON public.shifts;
CREATE POLICY "shifts_update" ON public.shifts
    FOR UPDATE USING (
        (worker_id = auth.uid() AND status = 'active') OR public.is_admin_or_manager()
    );

DROP POLICY IF EXISTS "shifts_delete" ON public.shifts;
CREATE POLICY "shifts_delete" ON public.shifts
    FOR DELETE USING (
        public.is_admin_or_manager()
    );

-- 6.6 SALES POLICIES
DROP POLICY IF EXISTS "sales_select" ON public.sales;
CREATE POLICY "sales_select" ON public.sales
    FOR SELECT USING (
        worker_id = auth.uid() OR public.is_admin_or_manager()
    );

DROP POLICY IF EXISTS "sales_insert" ON public.sales;
CREATE POLICY "sales_insert" ON public.sales
    FOR INSERT WITH CHECK (
        worker_id = auth.uid() OR public.is_admin_or_manager()
    );

DROP POLICY IF EXISTS "sales_delete" ON public.sales;
CREATE POLICY "sales_delete" ON public.sales
    FOR DELETE USING (
        public.is_admin_or_manager()
    );

-- 6.7 SALE ITEMS POLICIES
DROP POLICY IF EXISTS "sale_items_select" ON public.sale_items;
CREATE POLICY "sale_items_select" ON public.sale_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.sales s
            WHERE s.id = sale_items.sale_id
            AND (s.worker_id = auth.uid() OR public.is_admin_or_manager())
        )
    );

DROP POLICY IF EXISTS "sale_items_insert" ON public.sale_items;
CREATE POLICY "sale_items_insert" ON public.sale_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.sales s
            WHERE s.id = sale_items.sale_id
            AND (s.worker_id = auth.uid() OR public.is_admin_or_manager())
        )
    );

DROP POLICY IF EXISTS "sale_items_delete" ON public.sale_items;
CREATE POLICY "sale_items_delete" ON public.sale_items
    FOR DELETE USING (
        public.is_admin_or_manager()
    );

-- 6.8 RECEIPT PRINTS POLICIES
DROP POLICY IF EXISTS "receipt_prints_select" ON public.receipt_prints;
CREATE POLICY "receipt_prints_select" ON public.receipt_prints
    FOR SELECT USING (
        worker_id = auth.uid() OR public.is_admin_or_manager()
    );

DROP POLICY IF EXISTS "receipt_prints_insert" ON public.receipt_prints;
CREATE POLICY "receipt_prints_insert" ON public.receipt_prints
    FOR INSERT WITH CHECK (
        worker_id = auth.uid() OR public.is_admin_or_manager()
    );

DROP POLICY IF EXISTS "receipt_prints_delete" ON public.receipt_prints;
CREATE POLICY "receipt_prints_delete" ON public.receipt_prints
    FOR DELETE USING (
        public.is_admin_or_manager()
    );

-- 6.9 NOTIFICATIONS POLICIES
DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
CREATE POLICY "notifications_select" ON public.notifications
    FOR SELECT USING (
        recipient_id = auth.uid() OR recipient_id IS NULL OR public.is_admin_or_manager()
    );

DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
CREATE POLICY "notifications_update" ON public.notifications
    FOR UPDATE USING (
        recipient_id = auth.uid() OR public.is_admin_or_manager()
    );

DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
CREATE POLICY "notifications_insert" ON public.notifications
    FOR INSERT WITH CHECK (
        public.is_admin_or_manager() OR auth.uid() IS NOT NULL
    );

DROP POLICY IF EXISTS "notifications_delete" ON public.notifications;
CREATE POLICY "notifications_delete" ON public.notifications
    FOR DELETE USING (
        recipient_id = auth.uid() OR recipient_id IS NULL OR public.is_admin_or_manager()
    );

-- 6.10 ACTIVITY LOGS POLICIES
DROP POLICY IF EXISTS "activity_logs_select" ON public.activity_logs;
CREATE POLICY "activity_logs_select" ON public.activity_logs
    FOR SELECT USING (
        public.is_admin_or_manager()
    );

DROP POLICY IF EXISTS "activity_logs_insert" ON public.activity_logs;
CREATE POLICY "activity_logs_insert" ON public.activity_logs
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL
    );

DROP POLICY IF EXISTS "activity_logs_delete" ON public.activity_logs;
CREATE POLICY "activity_logs_delete" ON public.activity_logs
    FOR DELETE USING (
        public.is_admin_or_manager()
    );

-- 6.11 BUSINESS SETTINGS POLICIES
DROP POLICY IF EXISTS "business_settings_select" ON public.business_settings;
CREATE POLICY "business_settings_select" ON public.business_settings
    FOR SELECT USING (true); -- Publicly readable for receipts and branding

DROP POLICY IF EXISTS "business_settings_admin_modify" ON public.business_settings;
CREATE POLICY "business_settings_admin_modify" ON public.business_settings
    FOR ALL USING (
        public.is_admin_or_manager()
    );

-- ============================================================================
-- 7. REALTIME SETUP
-- ============================================================================
DO $$
BEGIN
    -- Add tables to realtime publication if not already present
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.sales, public.products, public.shifts, public.notifications, public.stock_movements, public.activity_logs';
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN others THEN NULL;
END;
$$;

-- ============================================================================
-- 8. INITIAL SEED / DEFAULT DATA
-- ============================================================================

-- Business Settings default
INSERT INTO public.business_settings (
    business_name,
    currency,
    receipt_footer
) VALUES (
    'MUNAJ BAR',
    'NGN',
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

-- ============================================================================
-- 9. SUPABASE STORAGE BUCKETS & POLICIES
-- ============================================================================

-- Create 'product-images' and 'business-assets' storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('product-images', 'product-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg']),
    ('business-assets', 'business-assets', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg'])
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

-- Storage Policies for storage.objects
-- 1. Public read for product images and business assets
DROP POLICY IF EXISTS "Public can view product images" ON storage.objects;
CREATE POLICY "Public can view product images"
ON storage.objects FOR SELECT
USING (bucket_id IN ('product-images', 'business-assets'));

-- 2. Authenticated users can upload
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
CREATE POLICY "Authenticated users can upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id IN ('product-images', 'business-assets')
);

-- 3. Authenticated users can update
DROP POLICY IF EXISTS "Authenticated users can update product images" ON storage.objects;
CREATE POLICY "Authenticated users can update product images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id IN ('product-images', 'business-assets')
);

-- 4. Authenticated users can delete
DROP POLICY IF EXISTS "Authenticated users can delete product images" ON storage.objects;
CREATE POLICY "Authenticated users can delete product images"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id IN ('product-images', 'business-assets')
);

-- ============================================================================
-- WORKER ACCOUNT DELETION & REFERENTIAL INTEGRITY PRESERVATION
-- ============================================================================

-- 1. Ensure historical sales, shifts, and receipt prints are preserved when a worker is deleted
DO $$
BEGIN
    -- Relax foreign keys to SET NULL on delete so business revenue records are never lost
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
END $$;

-- 2. Explicit Admin Deletion Policy on public.profiles
DROP POLICY IF EXISTS "profiles_admin_delete" ON public.profiles;
CREATE POLICY "profiles_admin_delete" ON public.profiles
    FOR DELETE
    TO authenticated
    USING (
        public.is_admin_or_manager() AND id <> auth.uid()
    );

-- 3. Atomic Database RPC: delete_worker_account
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

    -- 1. Authentication & Authorization Check
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

    -- 2. Prevent Self-Deletion
    IF v_requester_id = p_user_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Forbidden: You cannot delete your own active administrator account.'
        );
    END IF;

    -- 3. Target Profile Verification
    SELECT * INTO v_target_profile
    FROM public.profiles
    WHERE id = p_user_id;

    IF v_target_profile.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Target user does not exist or has already been deleted.'
        );
    END IF;

    -- 4. Preserve Historical Financial Data
    -- Close any active shift for this worker
    UPDATE public.shifts
    SET status = 'closed', ended_at = now()
    WHERE worker_id = p_user_id AND status = 'active';

    -- Disassociate worker from historical sales and receipts without deleting transaction logs
    UPDATE public.sales SET worker_id = NULL WHERE worker_id = p_user_id;
    UPDATE public.receipt_prints SET worker_id = NULL WHERE worker_id = p_user_id;
    UPDATE public.shifts SET worker_id = NULL WHERE worker_id = p_user_id;
    UPDATE public.activity_logs SET actor_id = NULL WHERE actor_id = p_user_id;
    UPDATE public.business_settings SET updated_by = NULL WHERE updated_by = p_user_id;

    -- Remove private notifications
    DELETE FROM public.notifications WHERE recipient_id = p_user_id;

    -- 5. Delete Profile Record
    DELETE FROM public.profiles WHERE id = p_user_id;

    -- 6. Delete Supabase Auth User (SECURITY DEFINER allows modifying auth schema)
    BEGIN
        DELETE FROM auth.users WHERE id = p_user_id;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Notice while removing from auth.users: %', SQLERRM;
    END;

    -- 7. Insert Activity Audit Log
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

-- Ensure profiles has is_active and compatibility status columns
DO $$
BEGIN
    -- 1. Ensure is_active column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
    END IF;

    -- 2. Optional compatibility column: status ('active' / 'deactivated')
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'status'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN status TEXT DEFAULT 'active';
        UPDATE public.profiles SET status = CASE WHEN is_active = false THEN 'deactivated' ELSE 'active' END;
    END IF;

    -- 3. Relax sales.shift_id so historical sales are preserved when a shift is deleted
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

-- 4. Atomic Database RPC: delete_shift
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

    -- 1. Authorization check
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

    -- 2. Target Shift Verification
    SELECT * INTO v_shift
    FROM public.shifts
    WHERE id = p_shift_id;

    IF v_shift.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Shift record does not exist or has already been deleted.'
        );
    END IF;

    -- 3. Prevent deleting active shifts
    IF v_shift.status = 'active' OR v_shift.ended_at IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'This shift is currently active and cannot be deleted. End or close the shift first.'
        );
    END IF;

    -- 4. Safely handle dependent sales: disassociate shift_id to preserve financial history
    SELECT COUNT(*) INTO v_sales_count
    FROM public.sales
    WHERE shift_id = p_shift_id;

    IF v_sales_count > 0 THEN
        UPDATE public.sales
        SET shift_id = NULL
        WHERE shift_id = p_shift_id;
    END IF;

    -- 5. Physically delete the shift record
    DELETE FROM public.shifts
    WHERE id = p_shift_id;

    -- 6. Insert Activity Audit Log
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


