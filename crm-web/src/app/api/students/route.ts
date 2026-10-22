import { requireAuth, validateBody, apiSuccess, apiError } from '@/lib/api/guard'
import { StudentCreateSchema } from '@/lib/validation/schemas'
import { logServerAudit } from '@/lib/api/audit'
import { formatNotesWithLms } from '@/lib/types'

export const dynamic = 'force-dynamic'

/**
 * GET /api/students
 * Searches or lists students with pagination and household details
 */
export async function GET(req: Request) {
  const authResult = await requireAuth(req)
  if ('errorResponse' in authResult) return authResult.errorResponse
  const { auth } = authResult

  try {
    const url = new URL(req.url)
    const query = url.searchParams.get('q') || ''
    const grade = url.searchParams.get('grade')
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100)

    let dbQuery = auth.supabaseAdmin
      .from('students')
      .select(`
        id,
        ps_code,
        full_name,
        grade,
        school,
        notes,
        fcode_ref,
        created_at,
        household:households(id, parent_name, parent_phone, address, area)
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (query) {
      dbQuery = dbQuery.or(`ps_code.ilike.%${query}%,full_name.ilike.%${query}%`)
    }

    if (grade) {
      dbQuery = dbQuery.eq('grade', parseInt(grade, 10))
    }

    const { data: students, error } = await dbQuery

    if (error) {
      return apiError('Failed to fetch students', 500, error.message)
    }

    return apiSuccess(students)
  } catch (err: any) {
    return apiError(err.message || 'Internal server error', 500)
  }
}

/**
 * POST /api/students
 * Creates household, student, enrollments, and optional immediate payments atomically with audit trail.
 */
export async function POST(req: Request) {
  const authResult = await requireAuth(req)
  if ('errorResponse' in authResult) return authResult.errorResponse
  const { auth } = authResult

  const valResult = await validateBody(req, StudentCreateSchema)
  if ('errorResponse' in valResult) return valResult.errorResponse
  const payload = valResult.data

  try {
    const creatorName = auth.member?.name || auth.user.email

    // 1. Verify PS code uniqueness
    const { data: existingPs } = await auth.supabaseAdmin
      .from('students')
      .select('id')
      .eq('ps_code', payload.ps_code.trim().toUpperCase())
      .maybeSingle()

    if (existingPs) {
      return apiError(`PS Code ${payload.ps_code} already exists in the system.`, 409)
    }

    // 2. Create Household Record
    const { data: household, error: hhErr } = await auth.supabaseAdmin
      .from('households')
      .insert({
        parent_name: payload.parent_name.trim(),
        parent_phone: payload.parent_phone.trim(),
        address: payload.address.trim(),
        area: payload.area?.trim() || null
      })
      .select()
      .single()

    if (hhErr) {
      return apiError(`Failed to create household: ${hhErr.message}`, 500)
    }

    // 3. Create Student Record
    const initialNotes = formatNotesWithLms(null, payload.lms_number || '')
    const { data: student, error: stuErr } = await auth.supabaseAdmin
      .from('students')
      .insert({
        ps_code: payload.ps_code.trim().toUpperCase(),
        full_name: payload.full_name.trim(),
        grade: payload.grade,
        school: null,
        notes: initialNotes,
        household_id: household.id,
        fcode_ref: payload.fcode_ref?.trim() || null,
        created_by: creatorName
      })
      .select()
      .single()

    if (stuErr) {
      return apiError(`Failed to create student: ${stuErr.message}`, 500)
    }

    // 4. Create Enrollments
    for (const enrol of payload.enrollments) {
      await auth.supabaseAdmin.from('enrollments').insert({
        student_id: student.id,
        class_type: enrol.courseCode,
        tier: 'STANDARD',
        fee_amount: enrol.fee,
        active: true
      })
    }

    // 5. Process Immediate Payment if specified
    if (payload.immediate_payment && payload.immediate_payment.items.length > 0) {
      const imm = payload.immediate_payment
      for (const item of imm.items) {
        const enrolFee = payload.enrollments.find(e => e.courseCode === item.courseCode)?.fee || 0
        const amountPaid = ['FREE', 'IMS'].includes(imm.payment_type) ? 0 : Math.max(0, item.amount_paid)

        await auth.supabaseAdmin.from('payments').insert({
          student_id: student.id,
          class_type: item.courseCode,
          month: imm.month,
          year: imm.year,
          amount_due: enrolFee,
          amount_paid: amountPaid,
          balance_before: 0,
          payment_type: imm.payment_type,
          bank_name: imm.payment_type === 'BANK' ? imm.bank_name : null,
          date_paid: imm.payment_type !== 'FREE' ? imm.date_paid : null,
          added_to_group: imm.added_to_group ?? false,
          tute_delivered: item.deliver_tute ?? false,
          recorded_by: creatorName,
          notes: imm.notes || null
        })
      }
    }

    // 6. Audit Log
    await logServerAudit({
      supabaseAdmin: auth.supabaseAdmin,
      action: 'STUDENT_CREATE',
      entityType: 'student',
      entityId: student.id,
      newData: { student, household, enrollments: payload.enrollments },
      userName: creatorName,
      userEmail: auth.user.email,
      userId: auth.user.id,
      metadata: { ps_code: student.ps_code, grade: student.grade }
    })

    return apiSuccess({ student, household }, 201)
  } catch (err: any) {
    return apiError(err.message || 'Student registration failed', 500)
  }
}
