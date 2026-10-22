import { requireAuth, validateBody, apiSuccess, apiError } from '@/lib/api/guard'
import { LeadUpdateSchema } from '@/lib/validation/schemas'
import { logServerAudit } from '@/lib/api/audit'

export const dynamic = 'force-dynamic'

/**
 * GET /api/leads/[fcode]
 * Retrieves single lead by F-Code with role-scoping protection
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ fcode: string }> }
) {
  const authResult = await requireAuth(req)
  if ('errorResponse' in authResult) return authResult.errorResponse
  const { auth } = authResult

  try {
    const { fcode } = await params
    const code = decodeURIComponent(fcode).trim().toUpperCase()

    const { data: lead, error } = await auth.supabaseAdmin
      .from('leads')
      .select('*')
      .eq('fcode', code)
      .single()

    if (error || !lead) {
      return apiError(`Lead ${code} not found`, 404)
    }

    // Role visibility check: non-admins cannot view leads assigned to someone else
    if (!auth.canViewAll) {
      const allowed = [
        auth.member?.name?.trim().toLowerCase() || '',
        ...auth.allowedMembers.map(m => m.trim().toLowerCase())
      ]
      const owner = (lead.assigned_member || '').trim().toLowerCase()
      if (!allowed.includes(owner)) {
        return apiError('Forbidden: You do not have access to this lead profile', 403)
      }
    }

    return apiSuccess(lead)
  } catch (err: any) {
    return apiError(err.message || 'Failed to fetch lead profile', 500)
  }
}

/**
 * PATCH /api/leads/[fcode]
 * Updates lead details by F-code with role authorization check
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ fcode: string }> }
) {
  const authResult = await requireAuth(req)
  if ('errorResponse' in authResult) return authResult.errorResponse
  const { auth } = authResult

  try {
    const { fcode } = await params
    const code = decodeURIComponent(fcode).trim().toUpperCase()

    const { data: lead, error: findErr } = await auth.supabaseAdmin
      .from('leads')
      .select('*')
      .eq('fcode', code)
      .single()

    if (findErr || !lead) {
      return apiError(`Lead ${code} not found`, 404)
    }

    // Role ownership check
    if (!auth.canViewAll) {
      const allowed = [
        auth.member?.name?.trim().toLowerCase() || '',
        ...auth.allowedMembers.map(m => m.trim().toLowerCase())
      ]
      const owner = (lead.assigned_member || '').trim().toLowerCase()
      if (!allowed.includes(owner)) {
        return apiError('Forbidden: You do not have permission to modify this lead', 403)
      }
    }

    const valResult = await validateBody(req, LeadUpdateSchema)
    if ('errorResponse' in valResult) return valResult.errorResponse
    const payload = valResult.data

    const updateObj: Record<string, any> = {}
    if (payload.status !== undefined) updateObj.status = payload.status
    if (payload.assigned_member !== undefined) updateObj.assigned_member = payload.assigned_member
    if (payload.grade !== undefined) updateObj.grade = payload.grade
    if (payload.comments !== undefined) updateObj.comments = payload.comments
    if (payload.campaign !== undefined) updateObj.campaign = payload.campaign
    if (payload.second_call_done !== undefined) updateObj.second_call_done = payload.second_call_done
    if (payload.second_call_notes !== undefined) updateObj.second_call_notes = payload.second_call_notes
    if (payload.paid !== undefined) updateObj.paid = payload.paid
    if (payload.ps_code_ref !== undefined) updateObj.ps_code_ref = payload.ps_code_ref

    const { data: updated, error: updErr } = await auth.supabaseAdmin
      .from('leads')
      .update(updateObj)
      .eq('id', lead.id)
      .select()
      .single()

    if (updErr) {
      return apiError(updErr.message, 500)
    }

    await logServerAudit({
      supabaseAdmin: auth.supabaseAdmin,
      action: 'LEAD_EDIT',
      entityType: 'lead',
      entityId: lead.id,
      oldData: lead,
      newData: updated,
      userName: auth.member?.name || auth.user.email,
      userEmail: auth.user.email,
      userId: auth.user.id
    })

    return apiSuccess(updated)
  } catch (err: any) {
    return apiError(err.message || 'Failed to update lead', 500)
  }
}
