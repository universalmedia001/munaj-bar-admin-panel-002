-- ============================================================================
-- MUNAJ BAR WORKER POS — DATABASE DIAGNOSTIC VALIDATION SCRIPT
-- ============================================================================
-- Run this script in the Supabase SQL Editor to verify all required tables,
-- columns, indexes, RLS policies, and RPC functions.
-- ============================================================================

DO $$
DECLARE
  v_table_count INT;
  v_func_count INT;
  v_policy_count INT;
  v_category_count INT;
  v_product_count INT;
  v_missing_tables TEXT := '';
  v_missing_funcs TEXT := '';
BEGIN
  RAISE NOTICE '--------------------------------------------------------------';
  RAISE NOTICE 'MUNAJ BAR WORKER POS — DATABASE DIAGNOSTIC CHECK';
  RAISE NOTICE '--------------------------------------------------------------';

  -- 1. Table Verification
  SELECT COUNT(*) INTO v_table_count 
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
    AND table_name IN ('profiles', 'categories', 'products', 'shifts', 'sales', 'sale_items', 'receipt_prints');

  RAISE NOTICE 'Required Core Tables Found: % / 7', v_table_count;

  IF v_table_count < 7 THEN
    RAISE WARNING 'CRITICAL: Some tables are missing! Found % of 7 required tables.', v_table_count;
  ELSE
    RAISE NOTICE 'SUCCESS: All 7 required core tables exist.';
  END IF;

  -- 2. Columns Verification for Shifts Table
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'shifts' AND column_name = 'ending_cash'
  ) THEN
    RAISE NOTICE 'SUCCESS: shifts.ending_cash column verified.';
  ELSE
    RAISE WARNING 'MISSING: shifts.ending_cash column does not exist!';
  END IF;

  -- 3. Functions / RPC Verification
  SELECT COUNT(*) INTO v_func_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND proname IN ('complete_sale', 'open_worker_shift', 'get_shift_summary', 'close_worker_shift', 'log_receipt_print');

  RAISE NOTICE 'Transactional RPC Functions Found: % / 5', v_func_count;

  IF v_func_count = 5 THEN
    RAISE NOTICE 'SUCCESS: All 5 transactional RPC functions are installed and ready.';
  ELSE
    RAISE WARNING 'WARNING: Missing some RPC functions! Found % of 5.', v_func_count;
  END IF;

  -- 4. RLS Policy Count
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public';

  RAISE NOTICE 'Active Row Level Security Policies: %', v_policy_count;

  -- 5. Data Counts
  SELECT COUNT(*) INTO v_category_count FROM public.categories;
  SELECT COUNT(*) INTO v_product_count FROM public.products;
  RAISE NOTICE 'Inventory Status: % Categories, % Products in database.', v_category_count, v_product_count;

  RAISE NOTICE '--------------------------------------------------------------';
  RAISE NOTICE 'DIAGNOSTIC COMPLETED.';
  RAISE NOTICE '--------------------------------------------------------------';
END $$;
