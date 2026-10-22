import { requireAuth, validateBody, apiSuccess, apiError } from '@/lib/api/guard'
import { PaymentCreateSchema } from '@/lib/validation/schemas'
import { logServerAudit } from '@/lib/api/audit'

export const dynamic = 'force-dynamic'

/**
 * GET /api/payments
 * Securely fetches payments with optional filtering (by student_id, month, year, or limit)
 */
export async function GET(req: Request) {
  const authResult = await requireAuth(req)
  if ('errorResponse' in authResult) return authResult.errorResponse
  const { auth } = authResult

  try {
    const url = new URL(req.url)
    const studentId = url.searchParams.get('student_id')
    const month = url.searchParams.get('month')
    const year = url.searchParams.get('year')
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200)

    let query = auth.supabaseAdmin
      .from('payments')
      .select(`
        id,
        student_id,
        class_type,
        month,
        year,
        amount_due,
        amount_paid,
        balance_before,
        balance_after,
        payment_type,
        bank_name,
        date_paid,
        added_to_group,
        tute_delivered,
        recorded_by,
        notes,
        created_at,
        student:students(id, ps_code, full_name, grade)
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (studentId) query = query.eq('student_id', studentId)
    if (month) query = query.eq('month', parseInt(month, 10))
    if (year) query = query.eq('year', parseInt(year, 10))

    const { data: payments, error } = await query

    if (error) {
      console.error('[API /api/payments GET Error]:', error)
      return apiError('Failed to retrieve payments', 500, error.message)
    }

    return apiSuccess(payments)
  } catch (err: any) {
    console.error('[API /api/payments GET Exception]:', err)
    return apiError(err.message || 'Internal server error', 500)
  }
}

/**
 * POST /api/payments
 * Records new payment(s) securely using elevated service_role authority,
 * updates enrollments and student balances, and records enterprise audit log.
 */
export async function POST(req: Request) {
  // 1. Require staff / payments / admin authentication
  const authResult = await requireAuth(req)
  if ('errorResponse' in authResult) return authResult.errorResponse
  const { auth } = authResult

  // 2. Validate incoming payload with Zod
  const valResult = await validateBody(req, PaymentCreateSchema)
  if ('errorResponse' in valResult) return valResult.errorResponse
  const payload = valResult.data

  try {
    const recordedBy = auth.member?.name || auth.user.email.split('@')[0]
    const createdPayments = []

    // 3. Process each class item
    for (const item of payload.items) {
      // Fetch or compute balance_before from student_balances
      const { data: balanceRecord } = await auth.supabaseAdmin
        .from('student_balances')
        .select('current_balance')
        .eq('student_id', payload.student_id)
        .eq('class_type', item.class_type)
        .maybeSingle()

      const balBefore = balanceRecord?.current_balance || 0
      const balAfter = balBefore + item.amount_paid - item.amount_due

      // Insert into payments
      const { data: payment, error: pErr } = await auth.supabaseAdmin
        .from('payments')
        .insert({
          student_id: payload.student_id,
          class_type: item.class_type,
          month: payload.month,
          year: payload.year,
          amount_due: item.amount_due,
          amount_paid: item.amount_paid,
          balance_before: balBefore,
          payment_type: payload.payment_type,
          bank_name: payload.payment_type === 'BANK' ? payload.bank_name : null,
          date_paid: payload.date_paid,
          added_to_group: payload.added_to_group,
          tute_delivered: item.deliver_tute ?? false,
          recorded_by: recordedBy,
          notes: payload.notes || null
        })
        .select()
        .single()

      if (pErr) {
        console.error('[API /api/payments POST DB Error]:', pErr)
        return apiError(`Failed to record payment for ${item.class_type}: ${pErr.message}`, 500)
      }

      createdPayments.push(payment)

      // Update student balance ledger
      await auth.supabaseAdmin.from('student_balances').upsert(
        {
          student_id: payload.student_id,
          class_type: item.class_type,
          current_balance: balAfter,
          last_payment_date: payload.date_paid,
          last_payment_amount: item.amount_paid
        },
        { onConflict: 'student_id,class_type' }
      )

      // Ensure enrollment exists or fee is synchronized
      if (item.fee !== undefined) {
        if (!item.enrollment_id) {
          await auth.supabaseAdmin.from('enrollments').upsert(
            {
              student_id: payload.student_id,
              class_type: item.class_type,
              fee_amount: item.fee,
              active: true
            },
            { onConflict: 'student_id,class_type' }
          )
        } else {
          await auth.supabaseAdmin
            .from('enrollments')
            .update({ fee_amount: item.fee })
            .eq('id', item.enrollment_id)
        }
      }

      // 4. Audit Log
      await logServerAudit({
        supabaseAdmin: auth.supabaseAdmin,
        action: 'PAYMENT_ADD',
        entityType: 'payment',
        entityId: payment.id,
        newData: payment,
        userName: auth.member?.name || auth.user.email,
        userEmail: auth.user.email,
        userId: auth.user.id,
        metadata: {
          class_type: item.class_type,
          amount_paid: item.amount_paid,
          month: payload.month,
          year: payload.year,
          payment_type: payload.payment_type
        }
      })
    }

    return apiSuccess({ payments: createdPayments }, 201)
  } catch (err: any) {
    console.error('[API /api/payments POST Exception]:', err)
    return apiError(err.message || 'Payment processing failed', 500)
  }
}
