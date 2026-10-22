import { requireAuth, validateBody, apiSuccess, apiError } from '@/lib/api/guard'
import { StudentUpdateSchema, HouseholdUpdateSchema } from '@/lib/validation/schemas'
import { logServerAudit } from '@/lib/api/audit'
import { formatNotesWithLms, extractLmsNumber } from '@/lib/types'

export const dynamic = 'force-dynamic'

/**
 * GET /api/students/[ps_code]
 * Fetches full student profile, household, enrollments, balances, and payment history
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ ps_code: string }> }
) {
  const authResult = await requireAuth(req)
  if ('errorResponse' in authResult) return authResult.errorResponse
  const { auth } = authResult

  try {
    const { ps_code } = await params
    const code = decodeURIComponent(ps_code).trim().toUpperCase()

    const { data: student, error } = await auth.supabaseAdmin
      .from('students')
      .select(`
        id,
        ps_code,
        full_name,
        grade,
        school,
        notes,
        fcode_ref,
        created_by,
        created_at,
        updated_at,
        household_id,
        household:households(id, parent_name, parent_phone, address, area, notes),
        enrollments(id, class_type, tier, fee_amount, active, enrolled_at),
        payments(id, class_type, month, year, amount_due, amount_paid, balance_before, balance_after, payment_type, bank_name, date_paid, added_to_group, tute_delivered, recorded_by, notes, created_at)
      `)
      .eq('ps_code', code)
      .single()

    if (error || !student) {
      return apiError(`Student ${code} not found`, 404)
    }

    return apiSuccess(student)
  } catch (err: any) {
    return apiError(err.message || 'Failed to fetch student details', 500)
  }
}

/**
 * PATCH /api/students/[ps_code]
 * Securely updates student details or attached household information
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ ps_code: string }> }
) {
  const authResult = await requireAuth(req)
  if ('errorResponse' in authResult) return authResult.errorResponse
  const { auth } = authResult

  try {
    const { ps_code } = await params
    const code = decodeURIComponent(ps_code).trim().toUpperCase()

    // 1. Fetch current student record
    const { data: existingStudent, error: findErr } = await auth.supabaseAdmin
      .from('students')
      .select('id, full_name, grade, school, notes, fcode_ref, household_id')
      .eq('ps_code', code)
      .single()

    if (findErr || !existingStudent) {
      return apiError(`Student ${code} not found`, 404)
    }

    const body = await req.json()

    // Branch A: Household Update
    if (body.type === 'household') {
      const valResult = HouseholdUpdateSchema.safeParse(body.data)
      if (!valResult.success) {
        return apiError('Invalid household data', 422, valResult.error.flatten())
      }
      const hhData = valResult.data

      let householdId = existingStudent.household_id
      if (householdId) {
        // Update existing household
        const { error: hhErr } = await auth.supabaseAdmin
          .from('households')
          .update({
            parent_name: hhData.parent_name?.trim() || null,
            parent_phone: hhData.parent_phone?.trim() || null,
            address: hhData.address?.trim() || null,
            area: hhData.area?.trim() || null
          })
          .eq('id', householdId)

        if (hhErr) return apiError(hhErr.message, 500)
      } else {
        // Create household & link to student
        const { data: newHh, error: newHhErr } = await auth.supabaseAdmin
          .from('households')
          .insert({
            parent_name: hhData.parent_name?.trim() || null,
            parent_phone: hhData.parent_phone?.trim() || null,
            address: hhData.address?.trim() || null,
            area: hhData.area?.trim() || null
          })
          .select()
          .single()

        if (newHhErr) return apiError(newHhErr.message, 500)
        householdId = newHh.id

        await auth.supabaseAdmin
          .from('students')
          .update({ household_id: newHh.id })
          .eq('id', existingStudent.id)
      }

      await logServerAudit({
        supabaseAdmin: auth.supabaseAdmin,
        action: 'STUDENT_EDIT',
        entityType: 'household',
        entityId: householdId,
        newData: hhData,
        userName: auth.member?.name || auth.user.email,
        userEmail: auth.user.email,
        userId: auth.user.id
      })

      return apiSuccess({ success: true, household_id: householdId })
    }

    // Branch B: Student Info Update
    const valResult = StudentUpdateSchema.safeParse(body.data || body)
    if (!valResult.success) {
      return apiError('Invalid student data', 422, valResult.error.flatten())
    }
    const studentData = valResult.data

    const currentLms = extractLmsNumber(existingStudent.notes || '')
    const lmsToSave = studentData.lms_number !== undefined ? studentData.lms_number : currentLms
    const finalNotes = formatNotesWithLms(studentData.notes ?? existingStudent.notes, lmsToSave)

    const updatePayload: Record<string, any> = {
      notes: finalNotes
    }
    if (studentData.full_name !== undefined) updatePayload.full_name = studentData.full_name?.trim() || null
    if (studentData.grade !== undefined) updatePayload.grade = studentData.grade
    if (studentData.fcode_ref !== undefined) updatePayload.fcode_ref = studentData.fcode_ref?.trim() || null

    const { data: updatedStudent, error: updErr } = await auth.supabaseAdmin
      .from('students')
      .update(updatePayload)
      .eq('id', existingStudent.id)
      .select()
      .single()

    if (updErr) {
      return apiError(updErr.message, 500)
    }

    await logServerAudit({
      supabaseAdmin: auth.supabaseAdmin,
      action: 'STUDENT_EDIT',
      entityType: 'student',
      entityId: existingStudent.id,
      oldData: existingStudent,
      newData: updatedStudent,
      userName: auth.member?.name || auth.user.email,
      userEmail: auth.user.email,
      userId: auth.user.id
    })

    return apiSuccess(updatedStudent)
  } catch (err: any) {
    return apiError(err.message || 'Failed to update student', 500)
  }
}

/**
 * DELETE /api/students/[ps_code]
 * Admin-only deletion of a student and cascade relations with audit trail
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ ps_code: string }> }
) {
  // Only admins can delete students
  const authResult = await requireAuth(req, ['admin', 'owner'])
  if ('errorResponse' in authResult) return authResult.errorResponse
  const { auth } = authResult

  try {
    const { ps_code } = await params
    const code = decodeURIComponent(ps_code).trim().toUpperCase()

    const { data: student } = await auth.supabaseAdmin
      .from('students')
      .select('id, ps_code, full_name')
      .eq('ps_code', code)
      .single()

    if (!student) {
      return apiError(`Student ${code} not found`, 404)
    }

    // Cascade deletions in order
    await auth.supabaseAdmin.from('payments').delete().eq('student_id', student.id)
    await auth.supabaseAdmin.from('enrollments').delete().eq('student_id', student.id)
    await auth.supabaseAdmin.from('student_balances').delete().eq('student_id', student.id)
    const { error: delErr } = await auth.supabaseAdmin.from('students').delete().eq('id', student.id)

    if (delErr) {
      return apiError(`Failed to delete student: ${delErr.message}`, 500)
    }

    await logServerAudit({
      supabaseAdmin: auth.supabaseAdmin,
      action: 'STUDENT_DELETE',
      entityType: 'student',
      entityId: student.id,
      oldData: student,
      userName: auth.member?.name || auth.user.email,
      userEmail: auth.user.email,
      userId: auth.user.id
    })

    return apiSuccess({ deleted: true, ps_code: code })
  } catch (err: any) {
    return apiError(err.message || 'Failed to delete student', 500)
  }
}
