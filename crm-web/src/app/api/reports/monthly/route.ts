import { requireAuth, apiSuccess, apiError } from '@/lib/api/guard'

export const dynamic = 'force-dynamic'

/**
 * GET /api/reports/monthly
 * Server-side aggregated monthly reconciliation and multi-month trend analytics.
 */
export async function GET(req: Request) {
  const authResult = await requireAuth(req)
  if ('errorResponse' in authResult) return authResult.errorResponse
  const { auth } = authResult

  try {
    const url = new URL(req.url)
    const month = parseInt(url.searchParams.get('month') || String(new Date().getMonth() + 1), 10)
    const year = parseInt(url.searchParams.get('year') || String(new Date().getFullYear()), 10)

    // Calculate previous month
    const prevMonthNum = month === 1 ? 12 : month - 1
    const prevYearNum = month === 1 ? year - 1 : year

    // 1. Fetch current month payments
    const paymentsQuery = auth.supabaseAdmin
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
        students(id, ps_code, full_name, grade, notes, created_at, created_by, household:households(parent_name, parent_phone, address), enrollments(class_type))
      `)
      .eq('month', month)
      .eq('year', year)
      .limit(10000)

    // 2. Fetch previous month payment IDs for continuity/retention calculation
    const prevPaymentsQuery = auth.supabaseAdmin
      .from('payments')
      .select('student_id')
      .eq('month', prevMonthNum)
      .eq('year', prevYearNum)
      .limit(10000)

    const [payRes, prevRes] = await Promise.all([paymentsQuery, prevPaymentsQuery])

    if (payRes.error) return apiError('Failed to load monthly payments', 500, payRes.error.message)
    if (prevRes.error) return apiError('Failed to load previous month continuity', 500, prevRes.error.message)

    const payments = payRes.data || []
    const prevStudentIds = new Set((prevRes.data || []).map((p: any) => p.student_id))

    // 3. Compute Aggregations
    let totalRevenue = 0
    const gradeBreakdown: Record<number, { count: number; total: number; uniqueStudents: Set<string> }> = {}
    const bankBreakdown: Record<string, { count: number; total: number }> = {}
    const uniqueStudents = new Set<string>()
    let retainedCount = 0
    let newOrReactivatedCount = 0

    for (const p of payments) {
      const amt = Number(p.amount_paid) || 0
      totalRevenue += amt
      uniqueStudents.add(p.student_id)

      // Grade breakdown
      const grade = (p.students as any)?.grade || 0
      if (!gradeBreakdown[grade]) gradeBreakdown[grade] = { count: 0, total: 0, uniqueStudents: new Set() }
      gradeBreakdown[grade].count += 1
      gradeBreakdown[grade].total += amt
      gradeBreakdown[grade].uniqueStudents.add(p.student_id)

      // Bank breakdown
      const bank = p.bank_name || p.payment_type || 'OTHER'
      if (!bankBreakdown[bank]) bankBreakdown[bank] = { count: 0, total: 0 }
      bankBreakdown[bank].count += 1
      bankBreakdown[bank].total += amt
    }

    // Retention metric
    for (const sId of Array.from(uniqueStudents)) {
      if (prevStudentIds.has(sId)) {
        retainedCount++
      } else {
        newOrReactivatedCount++
      }
    }

    // Format grade summary without Set objects for JSON response
    const gradeSummary: Record<string, { transactions: number; revenue: number; students: number }> = {}
    for (const [gr, val] of Object.entries(gradeBreakdown)) {
      gradeSummary[gr] = {
        transactions: val.count,
        revenue: val.total,
        students: val.uniqueStudents.size
      }
    }

    return apiSuccess({
      month,
      year,
      summary: {
        totalRevenue,
        totalTransactions: payments.length,
        totalUniqueStudents: uniqueStudents.size,
        retainedCount,
        newOrReactivatedCount,
        retentionRate: uniqueStudents.size > 0 ? ((retainedCount / uniqueStudents.size) * 100).toFixed(1) + '%' : '0%',
        bankBreakdown,
        gradeSummary
      },
      payments
    })
  } catch (err: any) {
    return apiError(err.message || 'Server error computing monthly report', 500)
  }
}
