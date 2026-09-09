-- ========================================================
-- MUNAJ BAR POS: WORKER SALES VISIBILITY UPDATE
-- ========================================================
-- Description:
-- 1. Creates a SECURITY DEFINER helper function (is_authorized_worker)
--    matching the existing is_admin_or_manager pattern to avoid RLS recursion
--    and enable query caching.
-- 2. Updates Row Level Security (RLS) policies on public.sales,
--    public.sale_items, and public.receipt_prints so that all
--    authorized worker roles (cashier, bar_worker, bar_staff, sales_worker,
--    admin, manager) can view store transactions in Sales History and
--    Receipt History, while:
--      a. Maintaining strict insert security (worker_id = auth.uid())
--      b. Preserving true worker attribution on every sale
--      c. Keeping tables protected from anonymous/unauthenticated access
-- ========================================================

-- 0. HELPER FUNCTION: is_authorized_worker()
CREATE OR REPLACE FUNCTION public.is_authorized_worker()
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role::text INTO v_role FROM public.profiles WHERE id = auth.uid();
  RETURN v_role IN ('cashier', 'bar_worker', 'bar_staff', 'sales_worker', 'admin', 'manager');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 1. SALES TABLE SELECT POLICY
DROP POLICY IF EXISTS "Workers can view own sales" ON public.sales;
DROP POLICY IF EXISTS "Authorized workers can view sales" ON public.sales;
DROP POLICY IF EXISTS "Admins can view all sales" ON public.sales;

CREATE POLICY "Authorized workers can view sales" 
  ON public.sales FOR SELECT 
  TO authenticated 
  USING (
    auth.uid() = worker_id 
    OR public.is_authorized_worker()
  );

-- 2. SALE ITEMS TABLE SELECT POLICY
DROP POLICY IF EXISTS "Workers can view sale items for own sales" ON public.sale_items;
DROP POLICY IF EXISTS "Authorized workers can view sale items" ON public.sale_items;
DROP POLICY IF EXISTS "Admins can view all sale items" ON public.sale_items;

CREATE POLICY "Authorized workers can view sale items" 
  ON public.sale_items FOR SELECT 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.sales 
      WHERE sales.id = sale_items.sale_id 
        AND (sales.worker_id = auth.uid() OR public.is_authorized_worker())
    )
  );

-- 3. RECEIPT PRINTS TABLE SELECT POLICY
DROP POLICY IF EXISTS "Workers can view own receipt print logs" ON public.receipt_prints;
DROP POLICY IF EXISTS "Authorized workers can view receipt print logs" ON public.receipt_prints;
DROP POLICY IF EXISTS "Admins can view all receipt prints" ON public.receipt_prints;

CREATE POLICY "Authorized workers can view receipt print logs" 
  ON public.receipt_prints FOR SELECT 
  TO authenticated 
  USING (
    auth.uid() = worker_id 
    OR public.is_authorized_worker()
  );

