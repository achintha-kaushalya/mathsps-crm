import { requireAuth, apiSuccess, apiError } from '@/lib/api/guard'

export const dynamic = 'force-dynamic'

/**
 * GET /api/reports/tutor-mobile
 * Ultra-fast executive aggregation endpoint designed for Tutor's iPhone.
 * Returns:
 * 1. Today & Month-to-date Revenue + Target Progress
 * 2. Active Students count & Paid Ratio
 * 3. Live Staff Activity Audit (who is online, calls made today, payments verified today)
 * 4. Predictive Month-end forecast & At-Risk warnings
 */
export async function GET(req: Request) {
  const authResult = await requireAuth(req, ['admin', 'owner'])
  if ('errorResponse' in authResult) return authResult.errorResponse
  const { auth } = authResult

  try {
    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)
    const startOfTodayIso = `${todayStr}T00:00:00.000Z`
    const endOfTodayIso = `${todayStr}T23:59:59.999Z`

    const curMonth = now.getMonth() + 1
    const curYear = now.getFullYear()
    const startOfMonthStr = `${curYear}-${String(curMonth).padStart(2, '0')}-01`

    // Run parallel high-speed queries
    const [
      todayPaymentsRes,
      monthPaymentsRes,
      studentsCountRes,
      todayLeadsRes,
      membersRes
    ] = await Promise.all([
      // 1. Today's payments
      auth.supabaseAdmin
        .from('payments')
        .select('id, amount_paid, payment_type, recorded_by, created_at, date_paid')
        .or(`date_paid.eq.${todayStr},created_at.gte.${startOfTodayIso}`),

      // 2. This month's total payments
      auth.supabaseAdmin
        .from('payments')
        .select('student_id, amount_paid, payment_type')
        .gte('date_paid', startOfMonthStr),

      // 3. Active students total
      auth.supabaseAdmin
        .from('students')
        .select('id', { count: 'exact', head: true })
        .not('created_by', 'ilike', '%Auto-Pre-generated%'),

      // 4. Today's active leads (to audit staff calls)
      auth.supabaseAdmin
        .from('leads')
        .select('id, assigned_member, status, created_at, comments')
        .gte('created_at', startOfTodayIso),

      // 5. Active staff members
      auth.supabaseAdmin
        .from('members')
        .select('id, name, email, role, notes, active')
        .eq('active', true)
    ])

    // --- Compute Financials ---
    const todayPayments = todayPaymentsRes.data || []
    let todayIncome = 0
    const staffPaymentAudit: Record<string, { count: number; total: number }> = {}

    for (const p of todayPayments) {
      if (!['FREE', 'IMS'].includes(p.payment_type || '')) {
        const amt = Number(p.amount_paid) || 0
        todayIncome += amt

        const recorder = p.recorded_by || 'Unknown Staff'
        if (!staffPaymentAudit[recorder]) staffPaymentAudit[recorder] = { count: 0, total: 0 }
        staffPaymentAudit[recorder].count += 1
        staffPaymentAudit[recorder].total += amt
      }
    }

    const monthPayments = monthPaymentsRes.data || []
    let monthIncome = 0
    const paidStudentIds = new Set<string>()

    for (const p of monthPayments) {
      if (!['FREE', 'IMS'].includes(p.payment_type || '')) {
        monthIncome += Number(p.amount_paid) || 0
        if (p.student_id) paidStudentIds.add(p.student_id)
      }
    }

    const totalStudents = studentsCountRes.count || 0
    const paidStudentsCount = paidStudentIds.size
    const paidRatio = totalStudents > 0 ? Math.round((paidStudentsCount / totalStudents) * 100) : 0

    // Monthly Target (Default Rs. 1,500,000 or custom)
    const monthlyTarget = 1500000
    const targetProgress = Math.min(100, Math.round((monthIncome / monthlyTarget) * 100))

    // --- Compute Staff Work & Call Audit ---
    const todayLeads = todayLeadsRes.data || []
    const staffCallAudit: Record<string, { totalCalls: number; hotConverted: number }> = {}

    for (const lead of todayLeads) {
      const staff = lead.assigned_member || 'Unassigned'
      if (!staffCallAudit[staff]) staffCallAudit[staff] = { totalCalls: 0, hotConverted: 0 }
      staffCallAudit[staff].totalCalls += 1

      if (['Converted', 'Interested', 'Contacted'].includes(lead.status)) {
        staffCallAudit[staff].hotConverted += 1
      }
    }

    // Combine into unified staff roster
    const members = (membersRes.data || []).filter(m => m.email !== 'admin@mathsps.com')
    const staffRoster = members.map(m => {
      const mName = m.name || m.email.split('@')[0]
      const callData = staffCallAudit[mName] || { totalCalls: 0, hotConverted: 0 }
      const payData = staffPaymentAudit[mName] || { count: 0, total: 0 }

      let subRole = m.role
      try {
        if (m.notes) {
          const parsed = JSON.parse(m.notes)
          if (parsed.sub_role) subRole = parsed.sub_role
        }
      } catch {}

      return {
        id: m.id,
        name: mName,
        role: subRole || m.role,
        callsToday: callData.totalCalls,
        convertedToday: callData.hotConverted,
        paymentsVerifiedToday: payData.count,
        revenueCollectedToday: payData.total
      }
    }).sort((a, b) => (b.revenueCollectedToday + b.callsToday * 10) - (a.revenueCollectedToday + a.callsToday * 10))

    // --- Predictive Analytics ---
    const dayOfMonth = now.getDate()
    const daysInMonth = new Date(curYear, curMonth, 0).getDate()
    const avgDailyIncome = dayOfMonth > 0 ? monthIncome / dayOfMonth : 0
    const projectedMonthEndRevenue = Math.round(avgDailyIncome * daysInMonth)

    const atRiskUnpaidStudents = Math.max(0, totalStudents - paidStudentsCount)

    return apiSuccess({
      generatedAt: now.toISOString(),
      dateStr: todayStr,
      monthName: now.toLocaleString('en-US', { month: 'long' }),
      year: curYear,
      metrics: {
        todayIncome,
        todayTransactionsCount: todayPayments.length,
        monthIncome,
        monthlyTarget,
        targetProgress,
        totalStudents,
        paidStudentsCount,
        paidRatio,
        projectedMonthEndRevenue,
        atRiskUnpaidStudents
      },
      staffRoster
    })
  } catch (err: any) {
    return apiError(err.message || 'Error fetching tutor mobile summary', 500)
  }
}
