import { createClient } from '@/lib/supabase/client'

export type AuditAction = 
  | 'PAYMENT_ADD'
  | 'PAYMENT_EDIT'
  | 'PAYMENT_DELETE'
  | 'STUDENT_CREATE'
  | 'STUDENT_EDIT'
  | 'STUDENT_DELETE'
  | 'CLASS_UNENROLL'
  | 'LEAD_DELETE'
  | 'LEAD_EDIT'
  | 'MEMBER_ROLE_CHANGE'

interface LogAuditParams {
  action: AuditAction
  entityType: 'payment' | 'student' | 'enrollment' | 'lead' | 'member'
  entityId?: string
  oldData?: any
  newData?: any
  metadata?: Record<string, any>
  userName?: string
  userEmail?: string
}

/**
 * Logs an enterprise audit event asynchronously.
 * Designed to never throw or block UI execution if logging encounters an issue.
 */
export async function logAuditEvent(params: LogAuditParams): Promise<void> {
  try {
    const supabase = createClient()
    
    let userEmail = params.userEmail
    let userName = params.userName
    let userId: string | undefined = undefined

    if (!userEmail) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        userId = user.id
        userEmail = user.email || ''
        userName = userName || user.user_metadata?.full_name || user.email?.split('@')[0] || ''
      }
    }

    await supabase.from('audit_logs').insert({
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId || null,
      user_id: userId || null,
      user_email: userEmail || 'system',
      user_name: userName || 'System User',
      old_data: params.oldData ? JSON.parse(JSON.stringify(params.oldData)) : null,
      new_data: params.newData ? JSON.parse(JSON.stringify(params.newData)) : null,
      metadata: params.metadata || null
    })
  } catch (err) {
    console.warn('[Audit Log Warning] Failed to persist audit record:', err)
  }
}
