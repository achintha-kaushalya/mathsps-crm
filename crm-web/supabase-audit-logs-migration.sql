-- ==============================================================================
-- ENTERPRISE AUDIT LOGS & ACTION TRACKING TABLE
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action VARCHAR(50) NOT NULL,            -- e.g. 'PAYMENT_ADD', 'PAYMENT_EDIT', 'PAYMENT_DELETE', 'STUDENT_EDIT', 'STUDENT_DELETE', 'CLASS_UNENROLL'
    entity_type VARCHAR(50) NOT NULL,       -- e.g. 'payment', 'student', 'enrollment', 'lead'
    entity_id VARCHAR(100),                 -- ID or PS_Code / F_Code of the target entity
    user_id UUID,                           -- User ID who performed the action
    user_email VARCHAR(255),                -- Email of the actor
    user_name VARCHAR(255),                 -- Full name of the actor
    old_data JSONB,                         -- State before modification
    new_data JSONB,                         -- State after modification
    metadata JSONB,                         -- Extra context (e.g. IP address, browser, notes)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing for fast search and filtering by date, entity, and actor
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_email);

-- Enable Row Level Security (RLS)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert audit logs
CREATE POLICY "Allow authenticated insert audit_logs" ON public.audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- Allow authenticated users to view audit logs
CREATE POLICY "Allow authenticated select audit_logs" ON public.audit_logs
    FOR SELECT TO authenticated
    USING (true);
