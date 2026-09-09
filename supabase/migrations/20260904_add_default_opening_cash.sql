ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS default_opening_cash NUMERIC(12, 2) NOT NULL DEFAULT 50000.00
  CHECK (default_opening_cash >= 0);
