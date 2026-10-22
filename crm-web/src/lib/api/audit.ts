import { SupabaseClient } from '@supabase/supabase-js'

export type AuditAction = 
  | 'PAYMENT_ADD'
  | 'PAYMENT_EDIT'
  | 'PAYMENT_DELETE'
  | 'PAYMENT_VERIFIED'
  | 'PAYMENT_REJECTED'
  | 'STUDENT_CREATE'
  | 'STUDENT_EDIT'
  | 'STUDENT_DELETE'
  | 'CLASS_ENROLL'
  | 'CLASS_UNENROLL'
  | 'LEAD_DELETE'
  | 'LEAD_EDIT'
  | 'MEMBER_ROLE_CHANGE'

export interface ServerAuditParams {
  supabaseAdmin: SupabaseClient
  action: AuditAction
  entityType: 'payment' | 'student' | 'enrollment' | 'lead' | 'member'
  entityId?: string
  oldData?: any
  newData?: any
  metadata?: Record<string, any>
  userName: string
  userEmail: string
  userId?: string
}

/**
 * Server-side audit logging function with guaranteed persistence via Supabase admin client.
 * Non-blocking: logs error if table insert fails but does not abort parent operation.
 */
export async function logServerAudit(params: ServerAuditParams): Promise<void> {
  try {
    const { error } = await params.supabaseAdmin.from('audit_logs').insert({
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId || null,
      user_id: params.userId || null,
      user_email: params.userEmail,
      user_name: params.userName,
      old_data: params.oldData ? JSON.parse(JSON.stringify(params.oldData)) : null,
      new_data: params.newData ? JSON.parse(JSON.stringify(params.newData)) : null,
      metadata: params.metadata || null
    })

    if (error) {
      console.error('[Server Audit Error] Failed to write audit log:', error.message)
    }
  } catch (err) {
    console.error('[Server Audit Exception] Unexpected error logging audit:', err)
  }
}
