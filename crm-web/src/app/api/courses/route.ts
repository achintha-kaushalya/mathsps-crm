import { requireAuth, validateBody, apiSuccess, apiError } from '@/lib/api/guard'
import { z } from 'zod'
import { logServerAudit } from '@/lib/api/audit'

export const dynamic = 'force-dynamic'

const CourseConfigSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  defaultFee: z.number().min(0),
  billingType: z.enum(['MONTHLY', 'ONE_TIME', 'TERM']),
  description: z.string().optional(),
  flyerUrl: z.string().optional()
})

const SaveCoursesSchema = z.object({
  grade_courses: z.record(z.string(), z.array(CourseConfigSchema)),
  standalone_courses: z.array(CourseConfigSchema),
  payment_methods: z.array(z.string()).optional(),
  banks: z.array(z.string()).optional()
})

/**
 * GET /api/courses
 * Retrieves active course configuration and payment methods
 */
export async function GET(req: Request) {
  const authResult = await requireAuth(req)
  if ('errorResponse' in authResult) return authResult.errorResponse
  const { auth } = authResult

  try {
    let { data: adminRecord } = await auth.supabaseAdmin
      .from('members')
      .select('notes')
      .eq('name', 'Admin User')
      .maybeSingle()

    if (!adminRecord) {
      const res = await auth.supabaseAdmin
        .from('members')
        .select('notes')
        .in('role', ['admin', 'owner'])
        .limit(1)
        .maybeSingle()
      adminRecord = res.data
    }

    let config = null
    if (adminRecord?.notes) {
      try {
        config = JSON.parse(adminRecord.notes)
      } catch {}
    }

    return apiSuccess(
      { config },
      200,
      undefined,
      {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=300'
      }
    )
  } catch (err: any) {
    return apiError(err.message || 'Failed to load courses configuration', 500)
  }
}

/**
 * POST /api/courses
 * Strictly Admin-Only endpoint to persist course structures, fees, and bank options
 */
export async function POST(req: Request) {
  const authResult = await requireAuth(req, ['admin', 'owner'])
  if ('errorResponse' in authResult) return authResult.errorResponse
  const { auth } = authResult

  const valResult = await validateBody(req, SaveCoursesSchema)
  if ('errorResponse' in valResult) return valResult.errorResponse
  const payload = valResult.data

  try {
    // Locate admin member row to store configuration
    let { data: adminMember } = await auth.supabaseAdmin
      .from('members')
      .select('id, notes')
      .eq('name', 'Admin User')
      .maybeSingle()

    if (!adminMember) {
      const res = await auth.supabaseAdmin
        .from('members')
        .select('id, notes')
        .in('role', ['admin', 'owner'])
        .limit(1)
        .maybeSingle()
      adminMember = res.data
    }

    if (!adminMember) {
      return apiError('Admin member record not found to persist system configuration', 404)
    }

    let existingNotes: Record<string, any> = {}
    if (adminMember.notes) {
      try {
        existingNotes = JSON.parse(adminMember.notes)
      } catch {}
    }

    const updatedNotes = {
      ...existingNotes,
      grade_courses: payload.grade_courses,
      standalone_courses: payload.standalone_courses,
      payment_methods: payload.payment_methods || existingNotes.payment_methods,
      banks: payload.banks || existingNotes.banks
    }

    const { error: updErr } = await auth.supabaseAdmin
      .from('members')
      .update({ notes: JSON.stringify(updatedNotes) })
      .eq('id', adminMember.id)

    if (updErr) {
      return apiError(`Failed to save course configuration: ${updErr.message}`, 500)
    }

    await logServerAudit({
      supabaseAdmin: auth.supabaseAdmin,
      action: 'MEMBER_ROLE_CHANGE',
      entityType: 'member',
      entityId: adminMember.id,
      oldData: existingNotes,
      newData: updatedNotes,
      userName: auth.member?.name || auth.user.email,
      userEmail: auth.user.email,
      userId: auth.user.id,
      metadata: { action: 'UPDATE_COURSES_CONFIG' }
    })

    return apiSuccess({ saved: true, config: updatedNotes })
  } catch (err: any) {
    return apiError(err.message || 'Course saving failed', 500)
  }
}
