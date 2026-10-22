import { requireAuth, validateBody, apiSuccess, apiError } from '@/lib/api/guard'
import { LeadCreateSchema, LeadUpdateSchema } from '@/lib/validation/schemas'
import { logServerAudit } from '@/lib/api/audit'

export const dynamic = 'force-dynamic'

function normalizePhone(raw: string): string {
  if (!raw) return ''
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length >= 9) {
    const last9 = digits.slice(-9)
    return `0${last9}`
  }
  return digits
}

/**
 * GET /api/leads
 * Retrieves leads with strict role scoping:
 * - Admin/Owner or staff with canViewAll: see all leads (or filtered by member)
 * - Call Center / Member staff: see ONLY their assigned leads + allowed_members
 */
export async function GET(req: Request) {
  const authResult = await requireAuth(req)
  if ('errorResponse' in authResult) return authResult.errorResponse
  const { auth } = authResult

  try {
    const url = new URL(req.url)
    const page = Math.max(0, parseInt(url.searchParams.get('page') || '0', 10))
    const pageSize = Math.min(100, Math.max(10, parseInt(url.searchParams.get('pageSize') || '50', 10)))
    const search = url.searchParams.get('search')?.trim() || ''
    const status = url.searchParams.get('status')?.trim() || ''
    const memberFilter = url.searchParams.get('member')?.trim() || ''

    let dbQuery = auth.supabaseAdmin
      .from('leads')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    // 1. Enforce Role Visibility Scoping
    if (!auth.canViewAll) {
      const allowed = Array.from(new Set([
        auth.member?.name?.trim().toLowerCase() || '',
        ...auth.allowedMembers.map(m => m.trim().toLowerCase())
      ])).filter(Boolean)

      if (allowed.length > 0) {
        dbQuery = dbQuery.in('assigned_member', allowed)
      } else {
        // Fallback: only assign to self
        dbQuery = dbQuery.eq('assigned_member', auth.member?.name || 'none')
      }
    } else if (memberFilter) {
      dbQuery = dbQuery.eq('assigned_member', memberFilter)
    }

    // 2. Filter by status
    if (status) {
      dbQuery = dbQuery.eq('status', status)
    }

    // 3. Search query
    if (search) {
      dbQuery = dbQuery.or(
        `fcode.ilike.%${search}%,raw_phone.ilike.%${search}%,normalized_phone.ilike.%${search}%,comments.ilike.%${search}%,ps_code_ref.ilike.%${search}%`
      )
    }

    // 4. Pagination
    const from = page * pageSize
    const to = from + pageSize - 1
    dbQuery = dbQuery.range(from, to)

    const { data: leads, count, error } = await dbQuery

    if (error) {
      return apiError('Failed to fetch leads', 500, error.message)
    }

    return apiSuccess({
      leads: leads || [],
      total: count || 0,
      page,
      pageSize
    })
  } catch (err: any) {
    return apiError(err.message || 'Internal server error', 500)
  }
}

/**
 * POST /api/leads
 * Registers a new lead with duplicate phone detection and automatic F-Code sequencing
 */
export async function POST(req: Request) {
  const authResult = await requireAuth(req)
  if ('errorResponse' in authResult) return authResult.errorResponse
  const { auth } = authResult

  const valResult = await validateBody(req, LeadCreateSchema)
  if ('errorResponse' in valResult) return valResult.errorResponse
  const payload = valResult.data

  try {
    const norm = normalizePhone(payload.raw_phone)
    if (!norm || norm.length < 9) {
      return apiError('Invalid Sri Lankan phone number format', 422)
    }

    // 1. Check duplicate lead by normalized phone
    const { data: existingLeads } = await auth.supabaseAdmin
      .from('leads')
      .select('id, fcode, campaign, date_added')
      .eq('normalized_phone', norm)
      .limit(5)

    const isRepeat = Boolean(existingLeads && existingLeads.length > 0)
    const prevFcode = isRepeat ? existingLeads![0].fcode : null

    // 2. Generate Next F-Code
    const { data: recentFcodes } = await auth.supabaseAdmin
      .from('leads')
      .select('fcode')
      .order('created_at', { ascending: false })
      .limit(500)

    let maxNum = 70000
    if (recentFcodes) {
      for (const row of recentFcodes) {
        const match = row.fcode?.match(/^F(\d+)/)
        if (match) {
          const num = parseInt(match[1], 10)
          if (!isNaN(num) && num > maxNum) maxNum = num
        }
      }
    }
    const nextFcode = `F${maxNum + 1}`
    const assignedMember = payload.assigned_member?.trim() || auth.member?.name || 'unassigned'

    // 3. Insert lead
    const { data: newLead, error: insErr } = await auth.supabaseAdmin
      .from('leads')
      .insert({
        fcode: nextFcode,
        raw_phone: payload.raw_phone.trim(),
        normalized_phone: norm,
        assigned_member: assignedMember,
        date_added: new Date().toISOString().slice(0, 10),
        status: 'New',
        grade: payload.grade || null,
        comments: payload.comments?.trim() || null,
        campaign: payload.campaign || 'S26',
        repeat_student: isRepeat,
        prev_fcode: prevFcode,
        second_call_done: false,
        second_call_notes: payload.second_call_notes?.trim() || null,
        paid: false
      })
      .select()
      .single()

    if (insErr) {
      return apiError(`Failed to insert lead: ${insErr.message}`, 500)
    }

    // 4. Audit Log
    await logServerAudit({
      supabaseAdmin: auth.supabaseAdmin,
      action: 'LEAD_EDIT',
      entityType: 'lead',
      entityId: newLead.id,
      newData: newLead,
      userName: auth.member?.name || auth.user.email,
      userEmail: auth.user.email,
      userId: auth.user.id,
      metadata: { action_type: 'LEAD_CREATE', fcode: newLead.fcode, is_repeat: isRepeat }
    })

    return apiSuccess({ lead: newLead, isRepeat, prevFcode }, 201)
  } catch (err: any) {
    return apiError(err.message || 'Lead registration failed', 500)
  }
}

/**
 * PATCH /api/leads
 * Bulk or single in-cell update with role validation
 */
export async function PATCH(req: Request) {
  const authResult = await requireAuth(req)
  if ('errorResponse' in authResult) return authResult.errorResponse
  const { auth } = authResult

  const valResult = await validateBody(req, LeadUpdateSchema)
  if ('errorResponse' in valResult) return valResult.errorResponse
  const payload = valResult.data

  if (!payload.id) {
    return apiError('Lead ID is required for updating', 400)
  }

  try {
    // 1. Fetch current lead
    const { data: existingLead, error: findErr } = await auth.supabaseAdmin
      .from('leads')
      .select('*')
      .eq('id', payload.id)
      .single()

    if (findErr || !existingLead) {
      return apiError('Lead not found', 404)
    }

    // 2. Ensure non-admin user can only edit their own assigned leads or allowed members
    if (!auth.canViewAll) {
      const allowed = [
        auth.member?.name?.trim().toLowerCase() || '',
        ...auth.allowedMembers.map(m => m.trim().toLowerCase())
      ]
      const leadOwner = (existingLead.assigned_member || '').trim().toLowerCase()
      if (!allowed.includes(leadOwner)) {
        return apiError('Forbidden: You do not have permission to modify this lead', 403)
      }
    }

    // 3. Prepare update payload
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

    // If phone is updated, normalize and check repeat
    if (payload.normalized_phone) {
      const norm = normalizePhone(payload.normalized_phone)
      updateObj.normalized_phone = norm
      updateObj.raw_phone = norm
      const { data: matches } = await auth.supabaseAdmin
        .from('leads')
        .select('fcode')
        .eq('normalized_phone', norm)
        .neq('id', payload.id)
        .limit(1)

      if (matches && matches.length > 0) {
        updateObj.repeat_student = true
        updateObj.prev_fcode = matches[0].fcode
      }
    }

    const { data: updatedLead, error: updErr } = await auth.supabaseAdmin
      .from('leads')
      .update(updateObj)
      .eq('id', payload.id)
      .select()
      .single()

    if (updErr) {
      return apiError(updErr.message, 500)
    }

    return apiSuccess(updatedLead)
  } catch (err: any) {
    return apiError(err.message || 'Failed to update lead', 500)
  }
}
