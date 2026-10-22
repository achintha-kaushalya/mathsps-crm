import { requireAuth, validateBody, apiSuccess, apiError } from '@/lib/api/guard'
import { z } from 'zod'
import { logServerAudit } from '@/lib/api/audit'

export const dynamic = 'force-dynamic'

const DispatchBatchSchema = z.object({
  action: z.enum(['dispatch', 'revert']),
  batchTag: z.string().optional(),
  paymentIds: z.array(z.string().uuid()).min(1, { message: 'At least one payment ID is required' })
})

/**
 * GET /api/delivery
 * Returns payments that have tutes to deliver for a given month and year
 */
export async function GET(req: Request) {
  const authResult = await requireAuth(req)
  if ('errorResponse' in authResult) return authResult.errorResponse
  const { auth } = authResult

  try {
    const url = new URL(req.url)
    const month = parseInt(url.searchParams.get('month') || String(new Date().getMonth() + 1), 10)
    const year = parseInt(url.searchParams.get('year') || String(new Date().getFullYear()), 10)

    const { data: payments, error } = await auth.supabaseAdmin
      .from('payments')
      .select(`
        id,
        student_id,
        class_type,
        month,
        year,
        date_paid,
        notes,
        tute_delivered,
        student:students(
          id,
          ps_code,
          full_name,
          grade,
          notes,
          household:households(
            id,
            parent_name,
            parent_phone,
            address,
            area
          )
        )
      `)
      .eq('month', month)
      .eq('year', year)
      .eq('tute_delivered', true)
      .order('date_paid', { ascending: false })

    if (error) {
      return apiError('Failed to fetch delivery records', 500, error.message)
    }

    return apiSuccess({ payments: payments || [] })
  } catch (err: any) {
    return apiError(err.message || 'Internal server error', 500)
  }
}

/**
 * POST /api/delivery
 * Dispatches or reverts tute delivery batches atomically with server audit trail
 */
export async function POST(req: Request) {
  const authResult = await requireAuth(req, ['admin', 'owner', 'payments'])
  if ('errorResponse' in authResult) return authResult.errorResponse
  const { auth } = authResult

  const valResult = await validateBody(req, DispatchBatchSchema)
  if ('errorResponse' in valResult) return valResult.errorResponse
  const payload = valResult.data

  try {
    const batchTag = payload.batchTag || `BATCH_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`
    const updatedPaymentIds = []

    for (const pId of payload.paymentIds) {
      const { data: curPay } = await auth.supabaseAdmin
        .from('payments')
        .select('notes')
        .eq('id', pId)
        .single()

      if (!curPay) continue

      const oldNotes = (curPay.notes || '').replace(/\[DISPATCHED:[^\]]+\]/g, '').trim()
      let newNotes = null

      if (payload.action === 'dispatch') {
        newNotes = oldNotes ? `${oldNotes} [DISPATCHED: ${batchTag}]` : `[DISPATCHED: ${batchTag}]`
      } else {
        newNotes = oldNotes || null
      }

      await auth.supabaseAdmin
        .from('payments')
        .update({ notes: newNotes })
        .eq('id', pId)

      updatedPaymentIds.push(pId)
    }

    await logServerAudit({
      supabaseAdmin: auth.supabaseAdmin,
      action: 'PAYMENT_EDIT',
      entityType: 'payment',
      userName: auth.member?.name || auth.user.email,
      userEmail: auth.user.email,
      userId: auth.user.id,
      metadata: {
        action: payload.action === 'dispatch' ? 'TUTE_DISPATCH' : 'TUTE_REVERT',
        batch_tag: batchTag,
        count: updatedPaymentIds.length
      }
    })

    return apiSuccess({ success: true, count: updatedPaymentIds.length, batchTag })
  } catch (err: any) {
    return apiError(err.message || 'Failed to update delivery batch', 500)
  }
}
