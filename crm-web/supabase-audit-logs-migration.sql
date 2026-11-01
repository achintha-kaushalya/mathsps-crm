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

-- Block direct client/browser inserts: Audit logs MUST be written strictly by the server service_role
DROP POLICY IF EXISTS "Allow authenticated insert audit_logs" ON public.audit_logs;

-- Restrict reading audit logs strictly to active Admin and Owner staff
DROP POLICY IF EXISTS "Allow authenticated select audit_logs" ON public.audit_logs;
CREATE POLICY "Allow admin select audit_logs" ON public.audit_logs
    FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.members m
        WHERE m.email = (auth.jwt() ->> 'email')
          AND m.active = true
          AND m.role IN ('admin', 'owner')
      )
    );
