import { requireAuth, apiSuccess, apiError } from '@/lib/api/guard'
import { logServerAudit } from '@/lib/api/audit'

export async function POST(request: Request) {
  try {
    const authResult = await requireAuth(request, ['admin', 'owner'])
    if ('errorResponse' in authResult) return authResult.errorResponse
    const { auth } = authResult

    const { id } = await request.json()
    if (!id) return apiError('Lead ID required', 400)

    const { data: existingLead } = await auth.supabaseAdmin
      .from('leads')
      .select('*')
      .eq('id', id)
      .single()

    const { error } = await auth.supabaseAdmin.from('leads').delete().eq('id', id)
    if (error) {
      console.error('Delete DB error:', error)
      return apiError(error.message, 400)
    }

    if (existingLead) {
      await logServerAudit({
        supabaseAdmin: auth.supabaseAdmin,
        action: 'LEAD_DELETE',
        entityType: 'lead',
        entityId: id,
        oldData: existingLead,
        userName: auth.member?.name || auth.user.email,
        userEmail: auth.user.email,
        userId: auth.user.id
      })
    }

    return apiSuccess({ deleted: true, id })
  } catch (err: any) {
    return apiError(err.message || 'Delete operation failed', 500)
  }
}

