-- ============================================================================
-- SURGICAL CASHIER PROFILE PROVISIONING AND REALTIME REGISTRATION
-- ============================================================================
-- Targets ONLY the confirmed Cashier account: samuel@gmail.com
-- Idempotent, safe, and modifies 0 other records or policies.
-- ============================================================================

DO $$
DECLARE
  v_user_count INT;
  v_cashier_uid UUID;
  v_cashier_email TEXT;
  v_cashier_name TEXT;
BEGIN
  -- 1. FINAL SAFETY CHECK: Count matching auth.users for 'samuel@gmail.com'
  SELECT COUNT(*) INTO v_user_count
  FROM auth.users
  WHERE email = 'samuel@gmail.com';

  IF v_user_count = 0 THEN
    RAISE EXCEPTION 'SAFETY ABORT: No auth.users record found with email samuel@gmail.com.';
  END IF;

  IF v_user_count > 1 THEN
    RAISE EXCEPTION 'SAFETY ABORT: Multiple auth.users records found with email samuel@gmail.com (count: %).', v_user_count;
  END IF;

  -- Retrieve exact UID and metadata
  SELECT id, email, COALESCE(raw_user_meta_data->>'full_name', 'Samuel')
  INTO v_cashier_uid, v_cashier_email, v_cashier_name
  FROM auth.users
  WHERE email = 'samuel@gmail.com';

  RAISE NOTICE 'Targeting Cashier: UID %, Email %, Name %', v_cashier_uid, v_cashier_email, v_cashier_name;

  -- 2. CREATE / UPSERT ONLY THIS EXACT CASHIER PROFILE ROW
  INSERT INTO public.profiles (id, email, full_name, role, updated_at)
  VALUES (v_cashier_uid, v_cashier_email, v_cashier_name, 'cashier', now())
  ON CONFLICT (id) DO UPDATE
  SET 
    role = 'cashier',
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    updated_at = now();

  RAISE NOTICE 'Successfully created/updated profile for UID % with role cashier.', v_cashier_uid;

  -- 3. REALTIME PUBLICATION REGISTRATION (Idempotent)
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'sales'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
    RAISE NOTICE 'Added public.sales to supabase_realtime publication.';
  ELSE
    RAISE NOTICE 'public.sales is already in supabase_realtime.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'sale_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sale_items;
    RAISE NOTICE 'Added public.sale_items to supabase_realtime publication.';
  ELSE
    RAISE NOTICE 'public.sale_items is already in supabase_realtime.';
  END IF;

END $$;
