-- ============================================================================
-- MUNAJ BAR — Business Backup & Restore Storage
-- ============================================================================
-- Creates a dedicated table to persist business-data backups in Supabase.
-- This table is SEPARATE from all business tables and is NEVER touched by the
-- existing "Clear / Reset Business Data" operation, so backups survive resets.
--
-- Each row stores:
--   - backup ID, creation timestamp, backup type, status, schema version
--   - record counts (JSONB)
--   - the full backed-up business data payload (JSONB)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.business_backups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    backup_type TEXT NOT NULL CHECK (backup_type IN ('MANUAL', 'BEFORE_RESET', 'PRE_RESTORE')),
    status TEXT NOT NULL DEFAULT 'CREATING' CHECK (status IN ('CREATING', 'SUCCESS', 'FAILED')),
    schema_version TEXT NOT NULL DEFAULT '1.0',
    record_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
    backup_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient history listing
CREATE INDEX IF NOT EXISTS idx_business_backups_created_at ON public.business_backups(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_business_backups_status ON public.business_backups(status);
CREATE INDEX IF NOT EXISTS idx_business_backups_type ON public.business_backups(backup_type);

-- Enable Row Level Security
ALTER TABLE public.business_backups ENABLE ROW LEVEL SECURITY;

-- Only admins and managers can read, create, or manage backups
DROP POLICY IF EXISTS "business_backups_select" ON public.business_backups;
CREATE POLICY "business_backups_select" ON public.business_backups
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role::text IN ('admin', 'manager', 'super_admin')
              AND profiles.is_active = true
        )
    );

DROP POLICY IF EXISTS "business_backups_insert" ON public.business_backups;
CREATE POLICY "business_backups_insert" ON public.business_backups
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role::text IN ('admin', 'manager', 'super_admin')
              AND profiles.is_active = true
        )
    );

DROP POLICY IF EXISTS "business_backups_update" ON public.business_backups;
CREATE POLICY "business_backups_update" ON public.business_backups
    FOR UPDATE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role::text IN ('admin', 'manager', 'super_admin')
              AND profiles.is_active = true
        )
    );

DROP POLICY IF EXISTS "business_backups_delete" ON public.business_backups;
CREATE POLICY "business_backups_delete" ON public.business_backups
    FOR DELETE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role::text IN ('admin', 'manager', 'super_admin')
              AND profiles.is_active = true
        )
    );

-- Grant access to authenticated users (RLS still applies)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_backups TO authenticated;
