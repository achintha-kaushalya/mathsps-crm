import { requireAuth, apiSuccess, apiError } from '@/lib/api/guard'

export const dynamic = 'force-dynamic'

/**
 * GET /api/reports/day-end
 * Server-side aggregated daily operational & financial summary.
 * Returns payments in range, registered students count, and auditor/staff collection breakdowns.
 */
export async function GET(req: Request) {
  const authResult = await requireAuth(req)
  if ('errorResponse' in authResult) return authResult.errorResponse
  const { auth } = authResult

  try {
    const url = new URL(req.url)
    const rawStart = url.searchParams.get('startDate') || new Date().toISOString().slice(0, 10)
    const rawEnd = url.searchParams.get('endDate') || rawStart
    const dateType = url.searchParams.get('dateType') || 'date_paid' // 'date_paid' or 'created_at'

    // Prevent inverted date range attacks (startDate > endDate)
    const [startDate, endDate] = rawStart > rawEnd ? [rawEnd, rawStart] : [rawStart, rawEnd]

    const startOfRangeIso = `${startDate}T00:00:00.000Z`
    const endOfRangeIso = `${endDate}T23:59:59.999Z`

    // 1. Fetch payments with minimal required payload
    let paymentsQuery = auth.supabaseAdmin
      .from('payments')
      .select(`
        id,
        student_id,
        amount_paid,
        payment_type,
        bank_name,
        recorded_by,
        created_at,
        date_paid,
        class_type,
        notes,
        tute_delivered,
        students(ps_code, full_name, grade, notes, household:households(parent_name, parent_phone))
      `)
      .order('created_at', { ascending: false })
      .limit(5000)

    if (dateType === 'created_at') {
      paymentsQuery = paymentsQuery.gte('created_at', startOfRangeIso).lte('created_at', endOfRangeIso)
    } else {
      paymentsQuery = paymentsQuery.gte('date_paid', startDate).lte('date_paid', endDate)
    }

    // 2. Fetch new student registrations in same period
    const registrationsQuery = auth.supabaseAdmin
      .from('students')
      .select(`
        id,
        ps_code,
        full_name,
        grade,
        notes,
        created_at,
        created_by,
        household:households(parent_name, parent_phone, address),
        enrollments(class_type)
      `)
      .not('created_by', 'ilike', '%Auto-Pre-generated%')
      .gte('created_at', startOfRangeIso)
      .lte('created_at', endOfRangeIso)
      .order('created_at', { ascending: false })
      .limit(1000)

    const [payRes, regRes] = await Promise.all([paymentsQuery, registrationsQuery])

    if (payRes.error) return apiError('Failed to fetch payments data', 500, payRes.error.message)
    if (regRes.error) return apiError('Failed to fetch registrations data', 500, regRes.error.message)

    const payments = payRes.data || []
    const registrations = regRes.data || []

    // 3. Compute Server-side Aggregations
    let totalRevenue = 0
    let totalTransactions = payments.length
    const bankBreakdown: Record<string, { count: number; total: number }> = {}
    const staffBreakdown: Record<string, { count: number; total: number }> = {}
    const paymentTypeBreakdown: Record<string, { count: number; total: number }> = {}

    for (const p of payments) {
      const amt = Number(p.amount_paid) || 0
      totalRevenue += amt

      // By Bank
      const bank = p.bank_name || (p.payment_type === 'CASH' ? 'CASH' : 'OTHER')
      if (!bankBreakdown[bank]) bankBreakdown[bank] = { count: 0, total: 0 }
      bankBreakdown[bank].count += 1
      bankBreakdown[bank].total += amt

      // By Staff (recorded_by)
      const staff = p.recorded_by || 'System User'
      if (!staffBreakdown[staff]) staffBreakdown[staff] = { count: 0, total: 0 }
      staffBreakdown[staff].count += 1
      staffBreakdown[staff].total += amt

      // By Payment Type
      const pType = p.payment_type || 'BANK'
      if (!paymentTypeBreakdown[pType]) paymentTypeBreakdown[pType] = { count: 0, total: 0 }
      paymentTypeBreakdown[pType].count += 1
      paymentTypeBreakdown[pType].total += amt
    }

    return apiSuccess({
      summary: {
        startDate,
        endDate,
        totalRevenue,
        totalTransactions,
        newRegistrationsCount: registrations.length,
        bankBreakdown,
        staffBreakdown,
        paymentTypeBreakdown
      },
      payments,
      registrations
    })
  } catch (err: any) {
    return apiError(err.message || 'Server error computing day-end report', 500)
  }
}
