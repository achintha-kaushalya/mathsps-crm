import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import nodemailer from 'nodemailer'
import { MONTH_NAMES } from '@/lib/types'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// GET Handler: Invoked automatically by Vercel Cron
// ---------------------------------------------------------------------------
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const reportTypeParam = searchParams.get('type')

    // Verify Vercel Cron Authorization Secret if configured
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized cron invocation.' }, { status: 401 })
    }

    // Supabase Admin/Server Client to retrieve live database settings
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseKey)

    let dbSettings: any = {}
    try {
      const { data: adminRecord } = await supabase
        .from('members')
        .select('notes')
        .eq('name', 'Admin User')
        .single()
      if (adminRecord?.notes) {
        const parsed = JSON.parse(adminRecord.notes)
        if (parsed.email_settings) {
          dbSettings = parsed.email_settings
        }
      }
    } catch (e) {
      console.warn('Could not load email_settings from DB, using fallback env:', e)
    }

    const provider = dbSettings.provider || (process.env.EMAIL_PROVIDER as 'smtp' | 'resend') || 'smtp'
    const recipients = (dbSettings.recipients && dbSettings.recipients.length > 0)
      ? dbSettings.recipients
      : (process.env.REPORT_RECIPIENTS || 'sampathlankasunsoft93@gmail.com').split(',').map((e: string) => e.trim()).filter(Boolean)

    const smtpUser = dbSettings.smtpUser || process.env.SMTP_USER
    const smtpPass = dbSettings.smtpPass || process.env.SMTP_PASS
    const smtpHost = dbSettings.smtpHost || process.env.SMTP_HOST || 'smtp.gmail.com'
    const smtpPort = dbSettings.smtpPort ? Number(dbSettings.smtpPort) : (process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 465)
    const senderApiKey = dbSettings.apiKey || process.env.RESEND_API_KEY
    const fromEmail = dbSettings.fromEmail || process.env.RESEND_FROM_EMAIL
    const includeCsv = dbSettings.includeCsv !== undefined ? dbSettings.includeCsv : true

    // Check if dynamic time checker mode or direct reportType
    let typesToDispatch: ('morning' | 'evening' | 'weekly' | 'monthly' | 'yearly')[] = []

    if (
      reportTypeParam === 'morning' ||
      reportTypeParam === 'evening' ||
      reportTypeParam === 'weekly' ||
      reportTypeParam === 'monthly' ||
      reportTypeParam === 'yearly'
    ) {
      typesToDispatch.push(reportTypeParam)
    } else {
      // Dynamic runner: calculate Sri Lanka local time (UTC+5:30)
      const now = new Date()
      const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000)
      const slTime = new Date(utcMs + (5.5 * 3600000))
      
      const currentHours = String(slTime.getHours()).padStart(2, '0')
      const currentMinutes = String(slTime.getMinutes()).padStart(2, '0')
      const currentTimeStr = `${currentHours}:${currentMinutes}`
      const currentDayOfWeek = slTime.getDay() // 0 = Sunday, 1 = Monday, etc.
      const currentDateNum = slTime.getDate() // 1 - 31
      const currentMonthNum = slTime.getMonth() + 1 // 1 - 12

      const morningTime = dbSettings.morningTime || '07:00'
      const eveningTime = dbSettings.eveningTime || '21:00'
      const weeklyDay = dbSettings.weeklyDay !== undefined ? Number(dbSettings.weeklyDay) : 0 // 0 = Sunday
      const weeklyTime = dbSettings.weeklyTime || '21:30'
      const monthlyDate = dbSettings.monthlyDate !== undefined ? Number(dbSettings.monthlyDate) : 1 // 1st of month
      const monthlyTime = dbSettings.monthlyTime || '08:00'
      const yearlyMonth = dbSettings.yearlyMonth !== undefined ? Number(dbSettings.yearlyMonth) : 12 // Dec
      const yearlyDate = dbSettings.yearlyDate !== undefined ? Number(dbSettings.yearlyDate) : 31 // 31st Dec
      const yearlyTime = dbSettings.yearlyTime || '22:00'

      const morningEnabled = dbSettings.morningSchedule !== undefined ? dbSettings.morningSchedule : true
      const eveningEnabled = dbSettings.eveningSchedule !== undefined ? dbSettings.eveningSchedule : true
      const weeklyEnabled = dbSettings.weeklySchedule !== undefined ? dbSettings.weeklySchedule : true
      const monthlyEnabled = dbSettings.monthlySchedule !== undefined ? dbSettings.monthlySchedule : true
      const yearlyEnabled = dbSettings.yearlySchedule !== undefined ? dbSettings.yearlySchedule : true

      // Match within 12-minute window of scheduled time
      function isWithinWindow(schedTime: string, currTime: string) {
        const [sh, sm] = schedTime.split(':').map(Number)
        const [ch, cm] = currTime.split(':').map(Number)
        const diff = (ch * 60 + cm) - (sh * 60 + sm)
        return diff >= 0 && diff <= 12
      }

      if (morningEnabled && isWithinWindow(morningTime, currentTimeStr)) {
        typesToDispatch.push('morning')
      }
      if (eveningEnabled && isWithinWindow(eveningTime, currentTimeStr)) {
        typesToDispatch.push('evening')
      }
      if (weeklyEnabled && currentDayOfWeek === weeklyDay && isWithinWindow(weeklyTime, currentTimeStr)) {
        typesToDispatch.push('weekly')
      }
      if (monthlyEnabled && currentDateNum === monthlyDate && isWithinWindow(monthlyTime, currentTimeStr)) {
        typesToDispatch.push('monthly')
      }
      if (yearlyEnabled && currentMonthNum === yearlyMonth && currentDateNum === yearlyDate && isWithinWindow(yearlyTime, currentTimeStr)) {
        typesToDispatch.push('yearly')
      }
    }

    if (typesToDispatch.length === 0) {
      return NextResponse.json({
        message: 'No scheduled reports due at this time.',
        serverTimeSL: new Date(new Date().getTime() + (new Date().getTimezoneOffset() * 60000) + (5.5 * 3600000)).toTimeString().slice(0, 8),
        configuredMorning: dbSettings.morningTime || '07:00',
        configuredEvening: dbSettings.eveningTime || '21:00',
        configuredWeekly: `${dbSettings.weeklyDay ?? 0} @ ${dbSettings.weeklyTime || '21:30'}`,
        configuredMonthly: `Day ${dbSettings.monthlyDate ?? 1} @ ${dbSettings.monthlyTime || '08:00'}`
      })
    }

    const results = []
    for (const rType of typesToDispatch) {
      const res = await dispatchReportEmail({
        reportType: rType,
        provider,
        recipients,
        targetDate: new Date().toISOString().slice(0, 10),
        includeCsv,
        smtpUser,
        smtpPass,
        smtpHost,
        smtpPort,
        senderApiKey,
        fromEmail
      })
      results.push({ type: rType, ...res })
    }

    return NextResponse.json({ success: true, results })
  } catch (err: any) {
    console.error('Vercel Cron dispatch error:', err)
    return NextResponse.json({ error: err.message || 'Internal Error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// POST Handler: Invoked by Admin Settings UI (with manual / live test payload)
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const result = await dispatchReportEmail(body)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Email report send error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}

async function dispatchReportEmail(params: {
  reportType?: 'morning' | 'evening' | 'weekly' | 'monthly' | 'yearly'
  provider?: 'smtp' | 'resend'
  recipients: string[]
  targetDate?: string
  includeCsv?: boolean
  senderApiKey?: string
  fromEmail?: string
  smtpUser?: string
  smtpPass?: string
  smtpHost?: string
  smtpPort?: number
}) {
  const {
    reportType = 'evening',
    provider = 'smtp',
    recipients = [],
    targetDate = new Date().toISOString().slice(0, 10),
    includeCsv = true,
    senderApiKey,
    fromEmail,
    smtpUser,
    smtpPass,
    smtpHost = 'smtp.gmail.com',
    smtpPort = 465
  } = params

  if (!recipients || recipients.length === 0) {
    throw new Error('At least one recipient email is required.')
  }

  if (provider === 'smtp') {
    const user = smtpUser || process.env.SMTP_USER
    const pass = smtpPass || process.env.SMTP_PASS
    if (!user || !pass) {
      throw new Error('Gmail SMTP requires both Sender Gmail Address and Google App Password.')
    }
  } else {
    const apiKey = senderApiKey || process.env.RESEND_API_KEY
    if (!apiKey) {
      throw new Error('Resend API Key is missing. Please provide your API Key or set RESEND_API_KEY.')
    }
  }

  // Supabase Admin/Server Client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(supabaseUrl, supabaseKey)

  const targetYear = parseInt(targetDate.split('-')[0], 10)
  const targetMonth = parseInt(targetDate.split('-')[1], 10)

  const prevMonthNum = targetMonth === 1 ? 12 : targetMonth - 1
  const prevYearNum = targetMonth === 1 ? targetYear - 1 : targetYear

  const startOfDay = `${targetDate}T00:00:00.000Z`
  const endOfDay = `${targetDate}T23:59:59.999Z`

  // Date windows for Weekly (7 days), Prior Week, and Full Year
  const targetDateTime = new Date(targetDate).getTime()
  const sevenDaysAgo = new Date(targetDateTime - (6 * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10)
  const fourteenDaysAgo = new Date(targetDateTime - (13 * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10)
  const eightDaysAgo = new Date(targetDateTime - (7 * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10)

  const startOfWeek = `${sevenDaysAgo}T00:00:00.000Z`
  const startOfPriorWeek = `${fourteenDaysAgo}T00:00:00.000Z`
  const endOfPriorWeek = `${eightDaysAgo}T23:59:59.999Z`

  // Advance lookback date for month registrations (e.g. 45 days prior to month start)
  const startOfAdvanceLookback = new Date(targetYear, targetMonth - 2, 1).toISOString()

  // Helper to fetch all rows beyond 1,000 limit with pagination
  async function fetchAllPaginated(buildQuery: (from: number, to: number) => any) {
    let results: any[] = []
    let from = 0
    let hasMore = true
    const CHUNK = 1000
    while (hasMore) {
      const { data, error } = await buildQuery(from, from + CHUNK - 1)
      if (error) throw error
      results = results.concat(data || [])
      if (!data || data.length < CHUNK) {
        hasMore = false
      } else {
        from += CHUNK
      }
    }
    return results
  }

  // Query Datasets
  const [
    dailyPayments,
    currentMonthPayments,
    prevMonthPayments,
    yearPayments,
    weeklyPayments,
    priorWeekPayments,
    { data: dailyRegistrations },
    { data: weeklyRegistrations },
    { data: monthRegistrations },
    { data: debtsData }
  ] = await Promise.all([
    fetchAllPaginated((from, to) =>
      supabase
        .from('payments')
        .select('*, students(ps_code, full_name, grade, created_at, household:households(parent_name, parent_phone, address))')
        .or(`created_at.gte.${startOfDay},date_paid.eq.${targetDate}`)
        .lte('created_at', endOfDay)
        .range(from, to)
    ),
    fetchAllPaginated((from, to) =>
      supabase
        .from('payments')
        .select('*, students(ps_code, full_name, grade, created_at, household:households(parent_name, parent_phone, address))')
        .eq('month', targetMonth)
        .eq('year', targetYear)
        .range(from, to)
    ),
    fetchAllPaginated((from, to) =>
      supabase
        .from('payments')
        .select('*, students(ps_code, full_name, grade, created_at, household:households(parent_name, parent_phone, address))')
        .eq('month', prevMonthNum)
        .eq('year', prevYearNum)
        .range(from, to)
    ),
    fetchAllPaginated((from, to) =>
      supabase
        .from('payments')
        .select('month, year, amount_paid, class_type, payment_type, bank_name, recorded_by, created_at, students(ps_code, full_name, grade, created_at, household:households(parent_name, parent_phone, address))')
        .eq('year', targetYear)
        .range(from, to)
    ),
    fetchAllPaginated((from, to) =>
      supabase
        .from('payments')
        .select('*, students(ps_code, full_name, grade, created_at, household:households(parent_name, parent_phone, address))')
        .gte('created_at', startOfWeek)
        .lte('created_at', endOfDay)
        .range(from, to)
    ),
    fetchAllPaginated((from, to) =>
      supabase
        .from('payments')
        .select('*, students(ps_code, full_name, grade, created_at)')
        .gte('created_at', startOfPriorWeek)
        .lte('created_at', endOfPriorWeek)
        .range(from, to)
    ),
    supabase
      .from('students')
      .select('*, household:households(*), enrollments(*)')
      .not('created_by', 'ilike', '%Auto-Pre-generated%')
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay),
    supabase
      .from('students')
      .select('*, household:households(*), enrollments(*)')
      .not('created_by', 'ilike', '%Auto-Pre-generated%')
      .gte('created_at', startOfWeek)
      .lte('created_at', endOfDay),
    supabase
      .from('students')
      .select('*, household:households(*), enrollments(*)')
      .not('created_by', 'ilike', '%Auto-Pre-generated%')
      .gte('created_at', startOfAdvanceLookback)
      .lte('created_at', endOfDay),
    supabase
      .from('students_outstanding')
      .select('*')
  ])

  function isNewRegistration(psCode: string | null | undefined): boolean {
    if (!psCode) return false
    const clean = psCode.toUpperCase().trim()
    const num = parseInt(clean.replace(/\D/g, ''), 10)
    if (isNaN(num)) return false
    if (clean.startsWith('SM')) return num >= 101
    return num >= 10500
  }

  const paymentsList = dailyPayments || []
  const regList = (dailyRegistrations || []).filter(s => isNewRegistration(s.ps_code))
  const currPayList = currentMonthPayments || []
  const prevPayList = prevMonthPayments || []
  const outstandingList = debtsData || []
  const weekPays = weeklyPayments || []
  const priorWeekPays = priorWeekPayments || []
  const weekRegList = (weeklyRegistrations || []).filter(s => isNewRegistration(s.ps_code))
  const yearPayList = (yearPayments as any[]) || []

  const totalDailyRevenue = paymentsList.reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0)
  const totalMonthRevenue = currPayList.reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0)
  const totalDebtAmount = outstandingList.reduce((sum, d) => sum + Math.abs(d.current_balance || 0), 0)
  const totalWeekRevenue = weekPays.reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0)
  const totalPriorWeekRevenue = priorWeekPays.reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0)
  const totalYearRevenue = yearPayList.reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0)

  const weekRevDeltaPercent = totalPriorWeekRevenue > 0
    ? (((totalWeekRevenue - totalPriorWeekRevenue) / totalPriorWeekRevenue) * 100).toFixed(1)
    : '0.0'

  const targetGrades = [5, 6, 7, 8, 9, 10, 11]

  // =========================================================================
  // RETENTION & CHURN ANALYSIS
  // =========================================================================
  const prevPaidStudentsMap = new Map<string, any>()
  prevPayList.forEach(p => {
    const ps = p.students?.ps_code || p.student_id
    if (ps && !prevPaidStudentsMap.has(ps)) {
      prevPaidStudentsMap.set(ps, p)
    }
  })

  const currPaidStudentsMap = new Map<string, any>()
  currPayList.forEach(p => {
    const ps = p.students?.ps_code || p.student_id
    if (ps && !currPaidStudentsMap.has(ps)) {
      currPaidStudentsMap.set(ps, p)
    }
  })

  const totalPrevPaidStudents = prevPaidStudentsMap.size
  const totalCurrPaidStudents = currPaidStudentsMap.size

  let retainedCount = 0
  let droppedCount = 0
  const droppedStudentsList: any[] = []

  prevPaidStudentsMap.forEach((p, ps) => {
    if (currPaidStudentsMap.has(ps)) {
      retainedCount++
    } else {
      droppedCount++
      droppedStudentsList.push(p)
    }
  })

  const overallRetentionRate = totalPrevPaidStudents > 0
    ? ((retainedCount / totalPrevPaidStudents) * 100).toFixed(1)
    : '100.0'
  const overallChurnRate = (100 - parseFloat(overallRetentionRate)).toFixed(1)
  const potentialLostRevenue = droppedCount * 2200

  // Bank & Auditor Breakdown helpers
  function buildBankAuditorMaps(srcPayments: any[], srcRegs: any[]) {
    const bankMap: Record<string, { count: number; total: number }> = {}
    const auditorMap: Record<string, { count: number; total: number; regCount: number }> = {}

    srcRegs.forEach(s => {
      const who = (s.created_by || 'System User').trim()
      if (!auditorMap[who]) {
        auditorMap[who] = { count: 0, total: 0, regCount: 0 }
      }
      auditorMap[who].regCount++
    })

    srcPayments.forEach(p => {
      const amt = Number(p.amount_paid) || 0
      const bank = (p.bank_name || p.payment_type || 'BANK').trim()
      const who = (p.recorded_by || 'System User').trim()

      if (!bankMap[bank]) {
        bankMap[bank] = { count: 0, total: 0 }
      }
      bankMap[bank].count++
      bankMap[bank].total += amt

      if (!auditorMap[who]) {
        auditorMap[who] = { count: 0, total: 0, regCount: 0 }
      }
      auditorMap[who].count++
      auditorMap[who].total += amt
    })
    return { bankMap, auditorMap }
  }

  const { bankMap: bankDailyRevenueMap, auditorMap: auditorDailyRevenueMap } = buildBankAuditorMaps(paymentsList, regList)
  const { bankMap: bankWeeklyRevenueMap, auditorMap: auditorWeeklyRevenueMap } = buildBankAuditorMaps(weekPays, weekRegList)
  const { bankMap: bankMonthlyRevenueMap, auditorMap: auditorMonthlyRevenueMap } = buildBankAuditorMaps(currPayList, [])
  const { bankMap: bankYearlyRevenueMap } = buildBankAuditorMaps(yearPayList, [])

  // Grade breakdown for retention
  const gradeStatsMap: Record<number, { prev: number; curr: number; retained: number; dropped: number }> = {}
  targetGrades.forEach(g => {
    gradeStatsMap[g] = { prev: 0, curr: 0, retained: 0, dropped: 0 }
  })

  prevPaidStudentsMap.forEach((p, ps) => {
    const g = p.students?.grade || 0
    if (gradeStatsMap[g]) {
      gradeStatsMap[g].prev++
      if (currPaidStudentsMap.has(ps)) {
        gradeStatsMap[g].retained++
      } else {
        gradeStatsMap[g].dropped++
      }
    }
  })

  currPaidStudentsMap.forEach((p) => {
    const g = p.students?.grade || 0
    if (gradeStatsMap[g]) {
      gradeStatsMap[g].curr++
    }
  })

  // Multi-month totals for SVG chart (Jan -> targetMonth or full 12 months)
  const monthlyTrendData: { month: number; monthName: string; revenue: number; students: number }[] = []
  const maxMonthIter = reportType === 'yearly' ? 12 : targetMonth
  for (let m = 1; m <= maxMonthIter; m++) {
    const mPays = yearPayList.filter((p: any) => p.month === m)
    const mRev = mPays.reduce((sum: number, p: any) => sum + (Number(p.amount_paid) || 0), 0)
    const mStuSet = new Set(mPays.map((p: any) => (Array.isArray(p.students) ? p.students[0]?.ps_code : p.students?.ps_code) || p.student_id))
    monthlyTrendData.push({
      month: m,
      monthName: MONTH_NAMES[m - 1].slice(0, 3),
      revenue: mRev,
      students: mStuSet.size
    })
  }

  // Generate SVG Chart
  const maxTrendRevenue = Math.max(...monthlyTrendData.map(d => d.revenue), 10000)
  const svgChartWidth = 540
  const svgChartHeight = 140
  const padL = 50
  const padR = 20
  const padT = 20
  const padB = 30
  const plotW = svgChartWidth - padL - padR
  const plotH = svgChartHeight - padT - padB

  const points = monthlyTrendData.map((d, i) => {
    const x = padL + (monthlyTrendData.length > 1 ? (i / (monthlyTrendData.length - 1)) * plotW : plotW / 2)
    const y = padT + plotH - (d.revenue / maxTrendRevenue) * plotH
    return { ...d, x, y }
  })

  const pathD = points.length > 1
    ? points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
    : `M ${padL} ${padT + plotH} L ${padL + plotW} ${padT + plotH}`

  const svgTrendChartHtml = `
    <svg width="${svgChartWidth}" height="${svgChartHeight}" viewBox="0 0 ${svgChartWidth} ${svgChartHeight}" style="background:#0f172a; border-radius:8px; display:block; margin:14px auto; font-family:sans-serif;">
      <line x1="${padL}" y1="${padT}" x2="${svgChartWidth - padR}" y2="${padT}" stroke="#334155" stroke-dasharray="3,3" />
      <line x1="${padL}" y1="${padT + plotH / 2}" x2="${svgChartWidth - padR}" y2="${padT + plotH / 2}" stroke="#334155" stroke-dasharray="3,3" />
      <line x1="${padL}" y1="${padT + plotH}" x2="${svgChartWidth - padR}" y2="${padT + plotH}" stroke="#475569" stroke-width="1.5" />
      <text x="${padL - 6}" y="${padT + 4}" fill="#94a3b8" font-size="10" text-anchor="end">${(maxTrendRevenue / 1000000).toFixed(1)}M</text>
      <text x="${padL - 6}" y="${padT + plotH / 2 + 4}" fill="#94a3b8" font-size="10" text-anchor="end">${(maxTrendRevenue / 2000000).toFixed(1)}M</text>
      <text x="${padL - 6}" y="${padT + plotH + 3}" fill="#94a3b8" font-size="10" text-anchor="end">0</text>
      <path d="${pathD}" fill="none" stroke="#3b82f6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      ${points.map(p => `
        <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.5" fill="#60a5fa" stroke="#1e3a8a" stroke-width="2" />
        <text x="${p.x.toFixed(1)}" y="${svgChartHeight - 8}" fill="#cbd5e1" font-size="11" font-weight="600" text-anchor="middle">${p.monthName}</text>
      `).join('')}
    </svg>
  `

  // =========================================================================
  // GRADE-WISE CUMULATIVE PROGRESSION MATRICES (Current Month up to Target Date)
  // =========================================================================
  const matrixTargetGrades = [5, 6, 7, 8, 9, 10, 11]
  const daysInTargetMonth = new Date(targetYear, targetMonth, 0).getDate()
  const targetDayNum = Math.min(parseInt(targetDate.split('-')[2], 10), daysInTargetMonth)

  // 1. Matrix 1: New Registrations
  // Collect all new registered students for this month (including advance registrations)
  const monthNewStuMap = new Map<string, any>()
  const monthStartIso = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`
  const monthEndIso = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(daysInTargetMonth).padStart(2, '0')}T23:59:59.999Z`

  ;(monthRegistrations || []).forEach(s => {
    const ps = s.ps_code || s.id
    if (!isNewRegistration(ps)) return
    const sCreatedAt = s.created_at ? new Date(s.created_at).toISOString() : ''
    if (sCreatedAt >= monthStartIso && sCreatedAt <= endOfDay) {
      monthNewStuMap.set(ps, s)
    }
  })

  currPayList.forEach((p: any) => {
    const s = p.students
    if (!s) return
    const ps = s.ps_code || p.student_id
    if (!ps || !isNewRegistration(ps) || prevPaidStudentsMap.has(ps)) return
    const sCreatedAt = s.created_at ? new Date(s.created_at).toISOString() : ''
    if (sCreatedAt && sCreatedAt <= endOfDay) {
      if (!monthNewStuMap.has(ps)) {
        monthNewStuMap.set(ps, {
          id: s.id || p.student_id,
          ps_code: s.ps_code || ps,
          full_name: s.full_name || '—',
          grade: s.grade || 0,
          created_at: s.created_at
        })
      }
    }
  })

  const rawDailyRegCounts: Record<number, Record<number, number>> = {}
  for (let d = 1; d <= daysInTargetMonth; d++) {
    rawDailyRegCounts[d] = { 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0 }
  }

  monthNewStuMap.forEach(s => {
    let d = 1
    if (s.created_at) {
      const sCreatedAt = new Date(s.created_at).toISOString()
      if (sCreatedAt < monthStartIso) {
        d = 1
      } else {
        d = new Date(s.created_at).getDate()
      }
    }
    if (d < 1) d = 1
    if (d > daysInTargetMonth) d = daysInTargetMonth
    const g = s.grade || 0
    if (rawDailyRegCounts[d] && rawDailyRegCounts[d][g] !== undefined) {
      rawDailyRegCounts[d][g] += 1
    }
  })

  // Cumulative calculation for New Registrations
  const runningRegGradeTotals: Record<number, number> = { 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0 }
  const cumulativeRegMatrixRows: {
    day: number
    dateStr: string
    counts: Record<number, number>
    cumulativeTotal: number
    isWeekend: boolean
  }[] = []

  for (let d = 1; d <= targetDayNum; d++) {
    const dayDate = new Date(targetYear, targetMonth - 1, d)
    const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6
    const dateFormatted = `${String(d).padStart(2, '0')}/${String(targetMonth).padStart(2, '0')}/${targetYear}`

    matrixTargetGrades.forEach(g => {
      runningRegGradeTotals[g] += (rawDailyRegCounts[d][g] || 0)
    })

    const cumTotal = Object.values(runningRegGradeTotals).reduce((a, b) => a + b, 0)
    cumulativeRegMatrixRows.push({
      day: d,
      dateStr: dateFormatted,
      counts: { ...runningRegGradeTotals },
      cumulativeTotal: cumTotal,
      isWeekend
    })
  }

  // 2. Matrix 2: Paid Students / Slips
  const rawDailyPayCounts: Record<number, Record<number, number>> = {}
  for (let d = 1; d <= daysInTargetMonth; d++) {
    rawDailyPayCounts[d] = { 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0 }
  }

  const seenStudentDay = new Set<string>()
  currPayList.forEach(p => {
    const psCode = p.students?.ps_code || p.student_id || p.id
    const g = p.students?.grade || 0
    if (!matrixTargetGrades.includes(g)) return

    const paidDateStr = p.date_paid || (p.created_at ? p.created_at.slice(0, 10) : '')
    let targetDay = 1
    if (paidDateStr) {
      if (paidDateStr < monthStartIso) {
        targetDay = 1
      } else {
        const parts = paidDateStr.split('-')
        if (parts.length >= 3 && parseInt(parts[0], 10) === targetYear && parseInt(parts[1], 10) === targetMonth) {
          targetDay = parseInt(parts[2], 10)
        } else {
          targetDay = 1
        }
      }
    }

    if (targetDay < 1) targetDay = 1
    if (targetDay > daysInTargetMonth) targetDay = daysInTargetMonth

    const dedupeKey = `${psCode}_G${g}`
    if (!seenStudentDay.has(dedupeKey)) {
      seenStudentDay.add(dedupeKey)
      if (rawDailyPayCounts[targetDay] && rawDailyPayCounts[targetDay][g] !== undefined) {
        rawDailyPayCounts[targetDay][g] += 1
      }
    }
  })

  // Cumulative calculation for Paid Students
  const runningPayGradeTotals: Record<number, number> = { 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0 }
  const cumulativePayMatrixRows: {
    day: number
    dateStr: string
    counts: Record<number, number>
    cumulativeTotal: number
    isWeekend: boolean
  }[] = []

  for (let d = 1; d <= targetDayNum; d++) {
    const dayDate = new Date(targetYear, targetMonth - 1, d)
    const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6
    const dateFormatted = `${String(d).padStart(2, '0')}/${String(targetMonth).padStart(2, '0')}/${targetYear}`

    matrixTargetGrades.forEach(g => {
      runningPayGradeTotals[g] += (rawDailyPayCounts[d][g] || 0)
    })

    const cumTotal = Object.values(runningPayGradeTotals).reduce((a, b) => a + b, 0)
    cumulativePayMatrixRows.push({
      day: d,
      dateStr: dateFormatted,
      counts: { ...runningPayGradeTotals },
      cumulativeTotal: cumTotal,
      isWeekend
    })
  }

  // Helper to render HTML table for a Cumulative Progression Matrix
  function renderProgressionMatrixHtml(
    title: string,
    subtitle: string,
    monthTotal: number,
    rows: { day: number; dateStr: string; counts: Record<number, number>; cumulativeTotal: number; isWeekend: boolean }[],
    headerGrad: string
  ) {
    const monthName = MONTH_NAMES[targetMonth - 1]
    return `
      <div style="margin-top: 24px; margin-bottom: 24px; border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden; background: #ffffff;">
        <div style="background: ${headerGrad}; color: #ffffff; padding: 14px 18px; display: table; width: 100%; box-sizing: border-box;">
          <div style="display: table-cell; vertical-align: middle;">
            <div style="font-size: 15px; font-weight: 800; letter-spacing: 0.3px;">${title}</div>
            <div style="font-size: 11px; opacity: 0.9; margin-top: 2px;">${subtitle}</div>
          </div>
          <div style="display: table-cell; vertical-align: middle; text-align: right;">
            <span style="background: rgba(255,255,255,0.22); padding: 4px 10px; border-radius: 14px; font-size: 11px; font-weight: 700; white-space: nowrap;">
              ${monthName} Total: ${monthTotal}
            </span>
          </div>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: center;">
          <thead>
            <tr style="background: #15803d; color: #ffffff; font-weight: 800;">
              <th rowspan="2" style="padding: 8px 10px; border: 1px solid #166534; width: 95px;">Date</th>
              <th colspan="7" style="padding: 6px 8px; border: 1px solid #166534; font-size: 12px; letter-spacing: 0.5px;">${monthName} (Grades)</th>
              <th rowspan="2" style="padding: 8px 10px; border: 1px solid #166534; width: 65px; background: #14532d;">Total</th>
            </tr>
            <tr style="background: #16a34a; color: #ffffff; font-weight: 700;">
              ${matrixTargetGrades.map(g => `<th style="padding: 6px 4px; border: 1px solid #166534; min-width: 38px;">${g}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.map((r, idx) => {
              const bg = r.isWeekend ? '#fef2f2' : (idx % 2 === 0 ? '#ffffff' : '#f8fafc')
              return `
                <tr style="background: ${bg}; border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 6px 8px; font-weight: 600; color: #334155; border-right: 1px solid #e2e8f0;">${r.dateStr}</td>
                  ${matrixTargetGrades.map(g => {
                    const count = r.counts[g] || 0
                    return `<td style="padding: 6px 4px; border-right: 1px solid #e2e8f0; color: ${count > 0 ? '#0f172a' : '#94a3b8'}; font-weight: ${count > 0 ? '600' : '400'};">${count}</td>`
                  }).join('')}
                  <td style="padding: 6px 8px; font-weight: 800; color: #047857; background: ${r.isWeekend ? '#fee2e2' : '#f0fdf4'};">${r.cumulativeTotal}</td>
                </tr>
              `
            }).join('')}
          </tbody>
        </table>
      </div>
    `
  }

  // Base CSS styles
  const baseEmailCss = `
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #1e293b; }
    .container { max-width: 660px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.07); border: 1px solid #cbd5e1; }
    .header { color: #ffffff; padding: 28px 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
    .header p { margin: 6px 0 0 0; opacity: 0.9; font-size: 14px; }
    .content { padding: 24px; }
    .kpi-grid { display: table; width: 100%; table-layout: fixed; margin-bottom: 20px; }
    .kpi-cell { display: table-cell; padding: 6px; vertical-align: top; }
    .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; text-align: center; }
    .kpi-label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 800; margin-bottom: 4px; }
    .kpi-value { font-size: 19px; font-weight: 800; color: #0f172a; }
    .section-title { font-size: 14px; font-weight: 800; color: #0f172a; margin: 20px 0 10px 0; border-bottom: 2px solid #3b82f6; padding-bottom: 4px; display: inline-block; text-transform: uppercase; letter-spacing: 0.5px; }
    table.data { width: 100%; border-collapse: collapse; margin-bottom: 18px; font-size: 13px; }
    table.data th { background: #f1f5f9; color: #475569; font-weight: 700; text-align: left; padding: 9px 10px; border-bottom: 2px solid #cbd5e1; }
    table.data td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
    .action-box { background: #eff6ff; border: 1px solid #bfdbfe; border-left: 4px solid #3b82f6; border-radius: 6px; padding: 14px; margin-bottom: 20px; font-size: 13px; }
    .footer { background: #f8fafc; padding: 18px 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
  `

  let emailSubject = ''
  let emailHtml = ''
  let csvFilename = `Report_${targetDate}.csv`
  let csvContent = ''
  const additionalCsvFiles: { filename: string; content: string }[] = []

  if (reportType === 'morning') {
    // =========================================================================
    // ☀️ MORNING STRATEGIC BRIEF TEMPLATE
    // =========================================================================
    emailSubject = `☀️ MathsPS Morning Strategic Brief — ${targetDate} (Retention: ${overallRetentionRate}%)`
    emailHtml = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><style>${baseEmailCss}</style></head>
      <body>
        <div class="container">
          <div class="header" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #3b82f6 100%);">
            <h1>☀️ MathsPS Executive Morning Strategic Brief</h1>
            <p>Performance Momentum, Retention Analytics &amp; Daily Action Items (${targetDate})</p>
          </div>

          <div class="content">
            <div class="kpi-grid">
              <div class="kpi-cell">
                <div class="kpi-card" style="border-left: 4px solid #10b981;">
                  <div class="kpi-label">${MONTH_NAMES[targetMonth - 1]} Total Revenue</div>
                  <div class="kpi-value" style="color: #059669;">Rs. ${totalMonthRevenue.toLocaleString()}</div>
                  <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${totalCurrPaidStudents} paying students</div>
                </div>
              </div>
              <div class="kpi-cell">
                <div class="kpi-card" style="border-left: 4px solid #8b5cf6;">
                  <div class="kpi-label">Retention Rate</div>
                  <div class="kpi-value" style="color: #7c3aed;">${overallRetentionRate}%</div>
                  <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${retainedCount} of ${totalPrevPaidStudents} retained</div>
                </div>
              </div>
              <div class="kpi-cell">
                <div class="kpi-card" style="border-left: 4px solid #ef4444;">
                  <div class="kpi-label">At-Risk / Dropped</div>
                  <div class="kpi-value" style="color: #dc2626;">${droppedCount}</div>
                  <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Lost ~Rs. ${potentialLostRevenue.toLocaleString()}</div>
                </div>
              </div>
            </div>

            <div class="action-box">
              <strong style="color: #1e40af; display: block; margin-bottom: 6px; font-size: 14px;">🎯 Priority Focus Areas for Today's Team:</strong>
              <ul style="margin: 0; padding-left: 18px; color: #1e293b; display: flex; flex-direction: column; gap: 4px;">
                <li><strong>Follow up on ${droppedCount} dropped students</strong> from last month (Check attached CSV for parent phone numbers).</li>
                <li><strong>Outstanding debts check:</strong> Rs. ${totalDebtAmount.toLocaleString()} pending across ${outstandingList.length} accounts.</li>
                <li><strong>Yesterday's Collection:</strong> Processed Rs. ${totalDailyRevenue.toLocaleString()} (${paymentsList.length} slips).</li>
              </ul>
            </div>

            <div class="section-title">📈 ${targetYear} Revenue Momentum Curve (Jan → ${MONTH_NAMES[targetMonth - 1]})</div>
            ${svgTrendChartHtml}

            <div class="section-title">📊 Grade-Wise Retention &amp; Continuity Matrix</div>
            <table class="data">
              <thead>
                <tr>
                  <th>Grade</th>
                  <th style="text-align: center;">Last Month</th>
                  <th style="text-align: center;">This Month</th>
                  <th style="text-align: center;">Retained</th>
                  <th style="text-align: center;">Dropped</th>
                  <th style="text-align: right;">Retention %</th>
                </tr>
              </thead>
              <tbody>
                ${targetGrades.map(g => {
                  const st = gradeStatsMap[g] || { prev: 0, curr: 0, retained: 0, dropped: 0 }
                  const rRate = st.prev > 0 ? ((st.retained / st.prev) * 100).toFixed(1) : '100.0'
                  const isGood = parseFloat(rRate) >= 80
                  return `
                    <tr>
                      <td><strong>Grade ${g}</strong></td>
                      <td style="text-align: center;">${st.prev}</td>
                      <td style="text-align: center; font-weight: 700;">${st.curr}</td>
                      <td style="text-align: center; color: #10b981; font-weight: 600;">${st.retained}</td>
                      <td style="text-align: center; color: ${st.dropped > 0 ? '#ef4444' : '#64748b'}; font-weight: 600;">${st.dropped}</td>
                      <td style="text-align: right; font-weight: 800; color: ${isGood ? '#10b981' : '#ef4444'};">${rRate}%</td>
                    </tr>
                  `
                }).join('')}
              </tbody>
            </table>
          </div>

          <div class="footer">
            Generated by <strong>MathsPS Executive Analytics Suite</strong>.<br>
            Direct follow-up list attached as: <code>At_Risk_Unpaid_Students_${MONTH_NAMES[targetMonth - 1]}_${targetYear}.csv</code>
          </div>
        </div>
      </body>
      </html>
    `

    if (droppedStudentsList.length > 0) {
      csvFilename = `At_Risk_Unpaid_Students_${MONTH_NAMES[targetMonth - 1]}_${targetYear}.csv`
      const csvHeader = 'PS Code,Student Name,Grade,Parent Name,Parent Phone,Address,Last Class,Last Amount,Last Paid Date\n'
      const csvRows = droppedStudentsList.map(p => {
        const ps = `"${p.students?.ps_code || p.student_id || ''}"`
        const name = `"${(p.students?.full_name || '').replace(/"/g, '""')}"`
        const grade = `"${p.students?.grade || ''}"`
        const parent = `"${(p.students?.household?.parent_name || '').replace(/"/g, '""')}"`
        const phone = `"${(p.students?.household?.parent_phone || '').replace(/"/g, '""')}"`
        const addr = `"${(p.students?.household?.address || '').replace(/"/g, '""')}"`
        const cls = `"${p.class_type || ''}"`
        const amt = `"${p.amount_paid || 0}"`
        const date = `"${p.date_paid || p.created_at || ''}"`
        return [ps, name, grade, parent, phone, addr, cls, amt, date].join(',')
      }).join('\n')
      csvContent = `${csvHeader}${csvRows}`
    }

  } else if (reportType === 'weekly') {
    // =========================================================================
    // 📅 WEEKLY PERFORMANCE DIGEST TEMPLATE
    // =========================================================================
    const isUp = parseFloat(weekRevDeltaPercent) >= 0
    emailSubject = `📅 MathsPS Weekly Executive Digest (${sevenDaysAgo} → ${targetDate}) — Rs. ${totalWeekRevenue.toLocaleString()}`
    emailHtml = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><style>${baseEmailCss}</style></head>
      <body>
        <div class="container">
          <div class="header" style="background: linear-gradient(135deg, #1e1b4b 0%, #3730a3 50%, #4f46e5 100%);">
            <h1>📅 MathsPS Weekly Velocity &amp; Executive Digest</h1>
            <p>7-Day Rolling Operational Performance (${sevenDaysAgo} to ${targetDate})</p>
          </div>

          <div class="content">
            <div class="kpi-grid">
              <div class="kpi-cell">
                <div class="kpi-card" style="border-left: 4px solid #4f46e5;">
                  <div class="kpi-label">7-Day Total Revenue</div>
                  <div class="kpi-value" style="color: #4338ca;">Rs. ${totalWeekRevenue.toLocaleString()}</div>
                  <div style="font-size: 11px; color: ${isUp ? '#059669' : '#dc2626'}; font-weight: 700; margin-top: 2px;">
                    ${isUp ? '▲ +' : '▼ '}${weekRevDeltaPercent}% vs prior 7d
                  </div>
                </div>
              </div>
              <div class="kpi-cell">
                <div class="kpi-card" style="border-left: 4px solid #10b981;">
                  <div class="kpi-label">Weekly New Registrations</div>
                  <div class="kpi-value" style="color: #059669;">+${weekRegList.length}</div>
                  <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Enrolled students</div>
                </div>
              </div>
              <div class="kpi-cell">
                <div class="kpi-card" style="border-left: 4px solid #0284c7;">
                  <div class="kpi-label">Total Slips Audited</div>
                  <div class="kpi-value" style="color: #0369a1;">${weekPays.length}</div>
                  <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Avg Rs. ${(weekPays.length > 0 ? Math.round(totalWeekRevenue / weekPays.length) : 0).toLocaleString()} / slip</div>
                </div>
              </div>
            </div>

            <div class="section-title">📊 7-Day Grade Revenue &amp; Intake Distribution</div>
            <table class="data">
              <thead>
                <tr>
                  <th>Grade</th>
                  <th style="text-align: center;">New Reg</th>
                  <th style="text-align: center;">Slips</th>
                  <th style="text-align: right;">Collections (Rs.)</th>
                  <th style="text-align: right;">Share</th>
                </tr>
              </thead>
              <tbody>
                ${targetGrades.map(g => {
                  const pList = weekPays.filter(p => p.students?.grade === g)
                  const rList = weekRegList.filter(s => s.grade === g)
                  const rev = pList.reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0)
                  const share = totalWeekRevenue > 0 ? ((rev / totalWeekRevenue) * 100).toFixed(1) : '0.0'
                  return `
                    <tr>
                      <td><strong>Grade ${g}</strong></td>
                      <td style="text-align: center;">${rList.length}</td>
                      <td style="text-align: center;">${pList.length}</td>
                      <td style="text-align: right; font-weight: 700;">Rs. ${rev.toLocaleString()}</td>
                      <td style="text-align: right; color: #64748b;">${share}%</td>
                    </tr>
                  `
                }).join('')}
                <tr style="background: #f8fafc; font-weight: 800; border-top: 2px solid #cbd5e1;">
                  <td>WEEK TOTAL</td>
                  <td style="text-align: center;">${weekRegList.length}</td>
                  <td style="text-align: center;">${weekPays.length}</td>
                  <td style="text-align: right; color: #4f46e5;">Rs. ${totalWeekRevenue.toLocaleString()}</td>
                  <td style="text-align: right;">100%</td>
                </tr>
              </tbody>
            </table>

            <div class="section-title">🏦 Weekly Bank &amp; Payment Gateway Distribution</div>
            <table class="data">
              <thead>
                <tr>
                  <th>Bank / Channel</th>
                  <th style="text-align: center;">Transactions</th>
                  <th style="text-align: right;">Collections (Rs.)</th>
                  <th style="text-align: right;">Share</th>
                </tr>
              </thead>
              <tbody>
                ${Object.entries(bankWeeklyRevenueMap).sort((a, b) => b[1].total - a[1].total).map(([bank, data]) => {
                  const share = totalWeekRevenue > 0 ? ((data.total / totalWeekRevenue) * 100).toFixed(1) : '0.0'
                  return `
                    <tr>
                      <td><strong>${bank}</strong></td>
                      <td style="text-align: center;">${data.count}</td>
                      <td style="text-align: right; font-weight: 700;">Rs. ${data.total.toLocaleString()}</td>
                      <td style="text-align: right; color: #64748b;">${share}%</td>
                    </tr>
                  `
                }).join('')}
              </tbody>
            </table>

            <div class="section-title">👤 Staff Weekly Audit Activity</div>
            <table class="data">
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th style="text-align: center;">New Reg</th>
                  <th style="text-align: center;">Slips Verified</th>
                  <th style="text-align: right;">Total Verified (Rs.)</th>
                </tr>
              </thead>
              <tbody>
                ${Object.entries(auditorWeeklyRevenueMap).sort((a, b) => b[1].total - a[1].total).map(([who, data]) => `
                  <tr>
                    <td><strong>🔒 ${who}</strong></td>
                    <td style="text-align: center;">${data.regCount}</td>
                    <td style="text-align: center;">${data.count}</td>
                    <td style="text-align: right; font-weight: 700; color: #4338ca;">Rs. ${data.total.toLocaleString()}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="footer">
            Generated automatically by <strong>MathsPS CRM Weekly Scheduler</strong>.<br>
            Full week transaction register attached as: <code>Weekly_Report_${sevenDaysAgo}_to_${targetDate}.csv</code>
          </div>
        </div>
      </body>
      </html>
    `

    if (weekPays.length > 0) {
      csvFilename = `Weekly_Report_${sevenDaysAgo}_to_${targetDate}.csv`
      const csvHeader = 'PS Code,Student Name,Grade,Class,Amount Paid,Method,Bank,Auditor,Date,Time,Notes\n'
      const csvRows = weekPays.map(p => {
        const ps = `"${p.students?.ps_code || ''}"`
        const name = `"${(p.students?.full_name || '').replace(/"/g, '""')}"`
        const grade = `"${p.students?.grade || ''}"`
        const cls = `"${p.class_type || ''}"`
        const amt = `"${p.amount_paid || 0}"`
        const method = `"${p.payment_type || 'BANK'}"`
        const bank = `"${(p.bank_name || '').replace(/"/g, '""')}"`
        const auditor = `"${(p.recorded_by || 'System').replace(/"/g, '""')}"`
        const date = `"${p.date_paid || (p.created_at ? p.created_at.slice(0, 10) : '')}"`
        const time = `"${new Date(p.created_at).toLocaleTimeString()}"`
        const notes = `"${(p.notes || '').replace(/"/g, '""')}"`
        return [ps, name, grade, cls, amt, method, bank, auditor, date, time, notes].join(',')
      }).join('\n')
      csvContent = `${csvHeader}${csvRows}`
    }

  } else if (reportType === 'monthly') {
    // =========================================================================
    // 📊 MONTHLY BUSINESS CLOSE & LEDGER TEMPLATE
    // =========================================================================
    const prevMonthRev = prevPayList.reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0)
    const momDelta = prevMonthRev > 0 ? (((totalMonthRevenue - prevMonthRev) / prevMonthRev) * 100).toFixed(1) : '0.0'
    const isMomUp = parseFloat(momDelta) >= 0

    emailSubject = `📊 MathsPS Monthly Financial & Retention Close — ${MONTH_NAMES[targetMonth - 1]} ${targetYear} (Rs. ${totalMonthRevenue.toLocaleString()})`
    emailHtml = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><style>${baseEmailCss}</style></head>
      <body>
        <div class="container">
          <div class="header" style="background: linear-gradient(135deg, #064e3b 0%, #047857 50%, #059669 100%);">
            <h1>📊 MathsPS Monthly Executive Business Close</h1>
            <p>Financial Ledger, Student Retention &amp; Cohort Analytics for <strong>${MONTH_NAMES[targetMonth - 1]} ${targetYear}</strong></p>
          </div>

          <div class="content">
            <div class="kpi-grid">
              <div class="kpi-cell">
                <div class="kpi-card" style="border-left: 4px solid #059669;">
                  <div class="kpi-label">${MONTH_NAMES[targetMonth - 1]} Revenue</div>
                  <div class="kpi-value" style="color: #047857;">Rs. ${totalMonthRevenue.toLocaleString()}</div>
                  <div style="font-size: 11px; color: ${isMomUp ? '#059669' : '#dc2626'}; font-weight: 700; margin-top: 2px;">
                    ${isMomUp ? '▲ +' : '▼ '}${momDelta}% vs ${MONTH_NAMES[prevMonthNum - 1]}
                  </div>
                </div>
              </div>
              <div class="kpi-cell">
                <div class="kpi-card" style="border-left: 4px solid #8b5cf6;">
                  <div class="kpi-label">Student Retention</div>
                  <div class="kpi-value" style="color: #7c3aed;">${overallRetentionRate}%</div>
                  <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${retainedCount} active (${droppedCount} dropped)</div>
                </div>
              </div>
              <div class="kpi-cell">
                <div class="kpi-card" style="border-left: 4px solid #0284c7;">
                  <div class="kpi-label">Paid Transactions</div>
                  <div class="kpi-value" style="color: #0369a1;">${currPayList.length}</div>
                  <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${totalCurrPaidStudents} unique students</div>
                </div>
              </div>
            </div>

            <div class="section-title">📈 Year-to-Date Revenue Velocity Curve</div>
            ${svgTrendChartHtml}

            <div class="section-title">📊 Grade Master Ledger &amp; Retention Performance</div>
            <table class="data">
              <thead>
                <tr>
                  <th>Grade</th>
                  <th style="text-align: center;">Students</th>
                  <th style="text-align: center;">Slips</th>
                  <th style="text-align: center;">Retention %</th>
                  <th style="text-align: right;">Total Collected (Rs.)</th>
                </tr>
              </thead>
              <tbody>
                ${targetGrades.map(g => {
                  const pList = currPayList.filter(p => p.students?.grade === g)
                  const st = gradeStatsMap[g] || { prev: 0, curr: 0, retained: 0, dropped: 0 }
                  const rRate = st.prev > 0 ? ((st.retained / st.prev) * 100).toFixed(1) : '100.0'
                  const rev = pList.reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0)
                  return `
                    <tr>
                      <td><strong>Grade ${g}</strong></td>
                      <td style="text-align: center;">${st.curr}</td>
                      <td style="text-align: center;">${pList.length}</td>
                      <td style="text-align: center; font-weight: 700; color: ${parseFloat(rRate) >= 80 ? '#059669' : '#dc2626'};">${rRate}%</td>
                      <td style="text-align: right; font-weight: 700;">Rs. ${rev.toLocaleString()}</td>
                    </tr>
                  `
                }).join('')}
                <tr style="background: #f8fafc; font-weight: 800; border-top: 2px solid #cbd5e1;">
                  <td>MONTH TOTAL</td>
                  <td style="text-align: center;">${totalCurrPaidStudents}</td>
                  <td style="text-align: center;">${currPayList.length}</td>
                  <td style="text-align: center; color: #7c3aed;">${overallRetentionRate}%</td>
                  <td style="text-align: right; color: #047857;">Rs. ${totalMonthRevenue.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>

            <div class="section-title">🏦 Monthly Bank Collection Portfolios</div>
            <table class="data">
              <thead>
                <tr>
                  <th>Bank Name</th>
                  <th style="text-align: center;">Slips</th>
                  <th style="text-align: right;">Total (Rs.)</th>
                  <th style="text-align: right;">Portfolio %</th>
                </tr>
              </thead>
              <tbody>
                ${Object.entries(bankMonthlyRevenueMap).sort((a, b) => b[1].total - a[1].total).map(([bank, data]) => {
                  const share = totalMonthRevenue > 0 ? ((data.total / totalMonthRevenue) * 100).toFixed(1) : '0.0'
                  return `
                    <tr>
                      <td><strong>${bank}</strong></td>
                      <td style="text-align: center;">${data.count}</td>
                      <td style="text-align: right; font-weight: 700;">Rs. ${data.total.toLocaleString()}</td>
                      <td style="text-align: right; color: #64748b;">${share}%</td>
                    </tr>
                  `
                }).join('')}
              </tbody>
            </table>
          </div>

          <div class="footer">
            Generated by <strong>MathsPS CRM Accounting Engine</strong>.<br>
            Monthly audit ledger attached as: <code>Monthly_Master_Ledger_${MONTH_NAMES[targetMonth - 1]}_${targetYear}.csv</code>
          </div>
        </div>
      </body>
      </html>
    `

    if (currPayList.length > 0) {
      csvFilename = `Monthly_Master_Ledger_${MONTH_NAMES[targetMonth - 1]}_${targetYear}.csv`
      const csvHeader = 'PS Code,Student Name,Grade,Parent Name,Parent Phone,Class,Amount Paid,Method,Bank,Auditor,Date,Notes\n'
      const csvRows = currPayList.map(p => {
        const ps = `"${p.students?.ps_code || ''}"`
        const name = `"${(p.students?.full_name || '').replace(/"/g, '""')}"`
        const grade = `"${p.students?.grade || ''}"`
        const parent = `"${(p.students?.household?.parent_name || '').replace(/"/g, '""')}"`
        const phone = `"${(p.students?.household?.parent_phone || '').replace(/"/g, '""')}"`
        const cls = `"${p.class_type || ''}"`
        const amt = `"${p.amount_paid || 0}"`
        const method = `"${p.payment_type || 'BANK'}"`
        const bank = `"${(p.bank_name || '').replace(/"/g, '""')}"`
        const auditor = `"${(p.recorded_by || 'System').replace(/"/g, '""')}"`
        const date = `"${p.date_paid || (p.created_at ? p.created_at.slice(0, 10) : '')}"`
        const notes = `"${(p.notes || '').replace(/"/g, '""')}"`
        return [ps, name, grade, parent, phone, cls, amt, method, bank, auditor, date, notes].join(',')
      }).join('\n')
      csvContent = `${csvHeader}${csvRows}`
    }

  } else if (reportType === 'yearly') {
    // =========================================================================
    // 🏆 ANNUAL STRATEGIC REVIEW TEMPLATE
    // =========================================================================
    const uniqueYearStudents = new Set(yearPayList.map((p: any) => (Array.isArray(p.students) ? p.students[0]?.ps_code : p.students?.ps_code) || p.student_id)).size
    emailSubject = `🏆 MathsPS Annual Strategic Financial & Growth Review — Year ${targetYear} (Rs. ${totalYearRevenue.toLocaleString()})`
    emailHtml = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><style>${baseEmailCss}</style></head>
      <body>
        <div class="container">
          <div class="header" style="background: linear-gradient(135deg, #78350f 0%, #b45309 50%, #d97706 100%);">
            <h1>🏆 MathsPS Annual Strategic &amp; Financial Review</h1>
            <p>Annual Performance, Enrollment Metrics &amp; Revenue Growth for <strong>Year ${targetYear}</strong></p>
          </div>

          <div class="content">
            <div class="kpi-grid">
              <div class="kpi-cell">
                <div class="kpi-card" style="border-left: 4px solid #d97706;">
                  <div class="kpi-label">${targetYear} Annual Revenue</div>
                  <div class="kpi-value" style="color: #b45309;">Rs. ${totalYearRevenue.toLocaleString()}</div>
                  <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Total audited gross</div>
                </div>
              </div>
              <div class="kpi-cell">
                <div class="kpi-card" style="border-left: 4px solid #10b981;">
                  <div class="kpi-label">Annual Enrolled Students</div>
                  <div class="kpi-value" style="color: #059669;">${uniqueYearStudents}</div>
                  <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Unique paying students</div>
                </div>
              </div>
              <div class="kpi-cell">
                <div class="kpi-card" style="border-left: 4px solid #6366f1;">
                  <div class="kpi-label">Total Annual Slips</div>
                  <div class="kpi-value" style="color: #4f46e5;">${yearPayList.length}</div>
                  <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Processed receipts</div>
                </div>
              </div>
            </div>

            <div class="section-title">📈 12-Month Revenue Trajectory</div>
            ${svgTrendChartHtml}

            <div class="section-title">🗓️ Monthly Revenue Breakdown (12-Month Ledger)</div>
            <table class="data">
              <thead>
                <tr>
                  <th>Month</th>
                  <th style="text-align: center;">Paying Students</th>
                  <th style="text-align: right;">Collections (Rs.)</th>
                  <th style="text-align: right;">Annual Share</th>
                </tr>
              </thead>
              <tbody>
                ${monthlyTrendData.map(d => {
                  const share = totalYearRevenue > 0 ? ((d.revenue / totalYearRevenue) * 100).toFixed(1) : '0.0'
                  return `
                    <tr>
                      <td><strong>${MONTH_NAMES[d.month - 1]}</strong></td>
                      <td style="text-align: center;">${d.students}</td>
                      <td style="text-align: right; font-weight: 700;">Rs. ${d.revenue.toLocaleString()}</td>
                      <td style="text-align: right; color: #64748b;">${share}%</td>
                    </tr>
                  `
                }).join('')}
                <tr style="background: #f8fafc; font-weight: 800; border-top: 2px solid #cbd5e1;">
                  <td>ANNUAL TOTAL</td>
                  <td style="text-align: center;">${uniqueYearStudents}</td>
                  <td style="text-align: right; color: #b45309;">Rs. ${totalYearRevenue.toLocaleString()}</td>
                  <td style="text-align: right;">100%</td>
                </tr>
              </tbody>
            </table>

            <div class="section-title">📊 Grade-Wise Annual Contribution</div>
            <table class="data">
              <thead>
                <tr>
                  <th>Grade</th>
                  <th style="text-align: center;">Annual Slips</th>
                  <th style="text-align: right;">Total Revenue (Rs.)</th>
                  <th style="text-align: right;">Contribution %</th>
                </tr>
              </thead>
              <tbody>
                ${targetGrades.map(g => {
                  const pList = yearPayList.filter((p: any) => {
                    const stGrade = Array.isArray(p.students) ? p.students[0]?.grade : p.students?.grade
                    return stGrade === g
                  })
                  const rev = pList.reduce((sum: number, p: any) => sum + (Number(p.amount_paid) || 0), 0)
                  const share = totalYearRevenue > 0 ? ((rev / totalYearRevenue) * 100).toFixed(1) : '0.0'
                  return `
                    <tr>
                      <td><strong>Grade ${g}</strong></td>
                      <td style="text-align: center;">${pList.length}</td>
                      <td style="text-align: right; font-weight: 700;">Rs. ${rev.toLocaleString()}</td>
                      <td style="text-align: right; color: #64748b;">${share}%</td>
                    </tr>
                  `
                }).join('')}
              </tbody>
            </table>
          </div>

          <div class="footer">
            Generated by <strong>MathsPS CRM Executive Suite</strong>.<br>
            Annual financial summary attached as: <code>Annual_Financial_Summary_${targetYear}.csv</code>
          </div>
        </div>
      </body>
      </html>
    `

    if (yearPayList.length > 0) {
      csvFilename = `Annual_Financial_Summary_${targetYear}.csv`
      const csvHeader = 'Month,PS Code,Student Name,Grade,Class,Amount Paid,Method,Bank,Date\n'
      const csvRows = yearPayList.map((p: any) => {
        const m = `"${MONTH_NAMES[(p.month || 1) - 1]}"`
        const ps = `"${(Array.isArray(p.students) ? p.students[0]?.ps_code : p.students?.ps_code) || ''}"`
        const name = `"${((Array.isArray(p.students) ? p.students[0]?.full_name : p.students?.full_name) || '').replace(/"/g, '""')}"`
        const grade = `"${(Array.isArray(p.students) ? p.students[0]?.grade : p.students?.grade) || ''}"`
        const cls = `"${p.class_type || ''}"`
        const amt = `"${p.amount_paid || 0}"`
        const method = `"${p.payment_type || 'BANK'}"`
        const bank = `"${(p.bank_name || '').replace(/"/g, '""')}"`
        const date = `"${p.date_paid || (p.created_at ? p.created_at.slice(0, 10) : '')}"`
        return [m, ps, name, grade, cls, amt, method, bank, date].join(',')
      }).join('\n')
      csvContent = `${csvHeader}${csvRows}`
    }

  } else {
    // =========================================================================
    // 🌅 EVENING DAY-END CASH AUDIT & CUMULATIVE PROGRESSION REPORT
    // =========================================================================
    const regProgressionTotal = cumulativeRegMatrixRows[cumulativeRegMatrixRows.length - 1]?.cumulativeTotal || 0
    const payProgressionTotal = cumulativePayMatrixRows[cumulativePayMatrixRows.length - 1]?.cumulativeTotal || 0

    const matrix1Html = renderProgressionMatrixHtml(
      `📅 ${MONTH_NAMES[targetMonth - 1]} ${targetYear} — Grade-Wise Cumulative Progression Sheet`,
      'Daily and cumulative count of new registered students across Grades 5–11',
      regProgressionTotal,
      cumulativeRegMatrixRows,
      'linear-gradient(135deg, #15803d 0%, #166534 100%)'
    )

    const matrix2Html = renderProgressionMatrixHtml(
      `💳 ${MONTH_NAMES[targetMonth - 1]} ${targetYear} — Grade-Wise Cumulative Progression Sheet`,
      'Daily and cumulative count of students paying fees across Grades 5–11',
      payProgressionTotal,
      cumulativePayMatrixRows,
      'linear-gradient(135deg, #047857 0%, #065f46 100%)'
    )

    emailSubject = `🌅 MathsPS Day-End Summary — ${targetDate} (Rs. ${totalDailyRevenue.toLocaleString()})`
    emailHtml = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><style>${baseEmailCss}</style></head>
      <body>
        <div class="container">
          <div class="header" style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);">
            <h1>MathsPS CRM — Executive Day-End Digest</h1>
            <p>Audit, Cash Collection &amp; Cumulative Progression for <strong>${targetDate}</strong></p>
          </div>

          <div class="content">
            <div class="kpi-grid">
              <div class="kpi-cell">
                <div class="kpi-card" style="border-left: 4px solid #3b82f6;">
                  <div class="kpi-label">Total Revenue Today</div>
                  <div class="kpi-value" style="color: #2563eb;">Rs. ${totalDailyRevenue.toLocaleString()}</div>
                  <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${paymentsList.length} slips audited</div>
                </div>
              </div>
              <div class="kpi-cell">
                <div class="kpi-card" style="border-left: 4px solid #10b981;">
                  <div class="kpi-label">New Registered</div>
                  <div class="kpi-value" style="color: #059669;">${regList.length}</div>
                  <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Students added today</div>
                </div>
              </div>
              <div class="kpi-cell">
                <div class="kpi-card" style="border-left: 4px solid #8b5cf6;">
                  <div class="kpi-label">Month-to-Date</div>
                  <div class="kpi-value" style="color: #7c3aed;">Rs. ${totalMonthRevenue.toLocaleString()}</div>
                  <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${MONTH_NAMES[targetMonth - 1]} total</div>
                </div>
              </div>
            </div>

            <div class="section-title">📊 Today's Grade-Wise Intake &amp; Revenue Breakdown</div>
            <table class="data">
              <thead>
                <tr>
                  <th>Grade</th>
                  <th style="text-align: center;">New Registered</th>
                  <th style="text-align: center;">Paid Slips</th>
                  <th style="text-align: right;">Amount Collected</th>
                </tr>
              </thead>
              <tbody>
                ${targetGrades.map(g => {
                  const pays = paymentsList.filter(p => p.students?.grade === g)
                  const regs = regList.filter(s => s.grade === g)
                  const rev = pays.reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0)
                  return `
                    <tr>
                      <td><strong>Grade ${g}</strong></td>
                      <td style="text-align: center;">${regs.length}</td>
                      <td style="text-align: center;">${pays.length}</td>
                      <td style="text-align: right; font-weight: 700;">Rs. ${rev.toLocaleString()}</td>
                    </tr>
                  `
                }).join('')}
                <tr style="background: #f8fafc; font-weight: 800; border-top: 2px solid #cbd5e1;">
                  <td>TOTAL</td>
                  <td style="text-align: center;">${regList.length}</td>
                  <td style="text-align: center;">${paymentsList.length}</td>
                  <td style="text-align: right; color: #2563eb;">Rs. ${totalDailyRevenue.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>

            <div class="section-title">👥 Progression Report 1: New Registrations (Cumulative)</div>
            ${matrix1Html}

            <div class="section-title">💳 Progression Report 2: Paid Students / Slips (Cumulative)</div>
            ${matrix2Html}

            <div class="section-title">🏦 Bank &amp; Payment Method Breakdown</div>
            <table class="data">
              <thead>
                <tr>
                  <th>Bank / Channel</th>
                  <th style="text-align: center;">Transactions</th>
                  <th style="text-align: right;">Collections (Rs.)</th>
                  <th style="text-align: right;">Share</th>
                </tr>
              </thead>
              <tbody>
                ${Object.entries(bankDailyRevenueMap).sort((a, b) => b[1].total - a[1].total).map(([bank, data]) => {
                  const share = totalDailyRevenue > 0 ? ((data.total / totalDailyRevenue) * 100).toFixed(1) : '0.0'
                  return `
                    <tr>
                      <td><strong>${bank}</strong></td>
                      <td style="text-align: center;">${data.count}</td>
                      <td style="text-align: right; font-weight: 700; color: #0f172a;">Rs. ${data.total.toLocaleString()}</td>
                      <td style="text-align: right; color: #64748b;">${share}%</td>
                    </tr>
                  `
                }).join('')}
                ${Object.keys(bankDailyRevenueMap).length === 0 ? '<tr><td colspan="4" style="text-align:center;color:#64748b;">No bank collections recorded today.</td></tr>' : ''}
              </tbody>
            </table>

            <div class="section-title">👤 Staff Performance &amp; Audit Activity</div>
            <table class="data">
              <thead>
                <tr>
                  <th>Staff / Auditor</th>
                  <th style="text-align: center;">New Reg</th>
                  <th style="text-align: center;">Slips Audited</th>
                  <th style="text-align: right;">Total Verified (Rs.)</th>
                </tr>
              </thead>
              <tbody>
                ${Object.entries(auditorDailyRevenueMap).sort((a, b) => b[1].total - a[1].total).map(([who, data]) => `
                  <tr>
                    <td><strong>🔒 ${who}</strong></td>
                    <td style="text-align: center;">${data.regCount}</td>
                    <td style="text-align: center;">${data.count}</td>
                    <td style="text-align: right; font-weight: 700; color: #2563eb;">Rs. ${data.total.toLocaleString()}</td>
                  </tr>
                `).join('')}
                ${Object.keys(auditorDailyRevenueMap).length === 0 ? '<tr><td colspan="4" style="text-align:center;color:#64748b;">No staff activity logged today.</td></tr>' : ''}
              </tbody>
            </table>
          </div>

          <div class="footer">
            Generated automatically by <strong>MathsPS CRM &amp; Admin Suite</strong>.<br>
            Attached: <code>Day_End_Audit_${targetDate}.csv</code>, <code>Cumulative_Registrations_${targetDate}.csv</code>, <code>Cumulative_Paid_Students_${targetDate}.csv</code>
          </div>
        </div>
      </body>
      </html>
    `

    if (paymentsList.length > 0) {
      csvFilename = `Day_End_Audit_${targetDate}.csv`
      const csvHeader = 'PS Code,Student Name,Grade,Class,Amount Paid,Method,Bank,Auditor,Time,Notes\n'
      const csvRows = paymentsList.map(p => {
        const ps = `"${p.students?.ps_code || ''}"`
        const name = `"${(p.students?.full_name || '').replace(/"/g, '""')}"`
        const grade = `"${p.students?.grade || ''}"`
        const cls = `"${p.class_type || ''}"`
        const amt = `"${p.amount_paid || 0}"`
        const method = `"${p.payment_type || 'BANK'}"`
        const bank = `"${(p.bank_name || '').replace(/"/g, '""')}"`
        const auditor = `"${(p.recorded_by || 'System').replace(/"/g, '""')}"`
        const time = `"${new Date(p.created_at).toLocaleTimeString()}"`
        const notes = `"${(p.notes || '').replace(/"/g, '""')}"`
        return [ps, name, grade, cls, amt, method, bank, auditor, time, notes].join(',')
      }).join('\n')
      csvContent = `${csvHeader}${csvRows}`
    }

    // CSV Attachment for Cumulative Registrations Progression
    const regMatrixCsvHeader = 'Date,Grade 5,Grade 6,Grade 7,Grade 8,Grade 9,Grade 10,Grade 11,Cumulative Total\n'
    const regMatrixCsvRows = cumulativeRegMatrixRows.map(r => [
      `"${r.dateStr}"`,
      r.counts[5] || 0,
      r.counts[6] || 0,
      r.counts[7] || 0,
      r.counts[8] || 0,
      r.counts[9] || 0,
      r.counts[10] || 0,
      r.counts[11] || 0,
      r.cumulativeTotal
    ].join(',')).join('\n')
    additionalCsvFiles.push({
      filename: `Cumulative_Registrations_${targetDate}.csv`,
      content: `${regMatrixCsvHeader}${regMatrixCsvRows}`
    })

    // CSV Attachment for Cumulative Paid Students Progression
    const payMatrixCsvHeader = 'Date,Grade 5,Grade 6,Grade 7,Grade 8,Grade 9,Grade 10,Grade 11,Cumulative Total\n'
    const payMatrixCsvRows = cumulativePayMatrixRows.map(r => [
      `"${r.dateStr}"`,
      r.counts[5] || 0,
      r.counts[6] || 0,
      r.counts[7] || 0,
      r.counts[8] || 0,
      r.counts[9] || 0,
      r.counts[10] || 0,
      r.counts[11] || 0,
      r.cumulativeTotal
    ].join(',')).join('\n')
    additionalCsvFiles.push({
      filename: `Cumulative_Paid_Students_${targetDate}.csv`,
      content: `${payMatrixCsvHeader}${payMatrixCsvRows}`
    })
  }

  // Attachments generation
  const attachments: any[] = []
  const nodemailerAttachments: any[] = []

  if (includeCsv) {
    if (csvContent) {
      const buf = Buffer.from(csvContent, 'utf-8')
      attachments.push({
        filename: csvFilename,
        content: buf.toString('base64')
      })
      nodemailerAttachments.push({
        filename: csvFilename,
        content: buf
      })
    }

    for (const addCsv of additionalCsvFiles) {
      if (addCsv.content) {
        const buf = Buffer.from(addCsv.content, 'utf-8')
        attachments.push({
          filename: addCsv.filename,
          content: buf.toString('base64')
        })
        nodemailerAttachments.push({
          filename: addCsv.filename,
          content: buf
        })
      }
    }
  }

  let emailId = ''

  if (provider === 'smtp') {
    const user = smtpUser || process.env.SMTP_USER
    const pass = (smtpPass || process.env.SMTP_PASS || '').replace(/\s+/g, '')

    const transporter = nodemailer.createTransport({
      host: smtpHost || 'smtp.gmail.com',
      port: Number(smtpPort) || 465,
      secure: Number(smtpPort) === 465,
      auth: { user, pass }
    })

    const info = await transporter.sendMail({
      from: `"MathsPS Executive Reports" <${user}>`,
      to: recipients.join(', '),
      subject: emailSubject,
      html: emailHtml,
      attachments: nodemailerAttachments.length > 0 ? nodemailerAttachments : undefined
    })

    emailId = info.messageId || 'smtp-ok'

  } else {
    const apiKey = senderApiKey || process.env.RESEND_API_KEY
    const resend = new Resend(apiKey)

    const senderAddress = fromEmail && fromEmail.trim()
      ? fromEmail.trim()
      : 'MathsPS Reports <onboarding@resend.dev>'

    const sendResult = await resend.emails.send({
      from: senderAddress,
      to: recipients,
      subject: emailSubject,
      html: emailHtml,
      attachments: attachments.length > 0 ? attachments : undefined
    })

    if (sendResult.error) {
      const errMsg = sendResult.error.message || 'Resend delivery failed'
      throw new Error(errMsg)
    }

    emailId = sendResult.data?.id || 'resend-ok'
  }

  const reportNames: Record<string, string> = {
    morning: 'Morning Strategic Brief',
    evening: 'Evening Day-End Summary',
    weekly: 'Weekly Velocity Digest',
    monthly: 'Monthly Financial Close',
    yearly: 'Annual Strategic Review'
  }

  return {
    success: true,
    message: `${reportNames[reportType] || reportType} sent successfully via ${provider.toUpperCase()} to ${recipients.join(', ')}`,
    emailId,
    reportType,
    provider,
    stats: {
      dailyRevenue: totalDailyRevenue,
      weeklyRevenue: totalWeekRevenue,
      monthlyRevenue: totalMonthRevenue,
      yearlyRevenue: totalYearRevenue,
      retentionRate: overallRetentionRate,
      droppedStudents: droppedCount
    }
  }
}
