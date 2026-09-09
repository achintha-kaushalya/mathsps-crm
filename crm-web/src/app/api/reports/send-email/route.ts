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
    const reportType = (searchParams.get('type') as 'morning' | 'evening') || 'evening'

    // Verify Vercel Cron Authorization Secret if configured
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized cron invocation.' }, { status: 401 })
    }

    const recipientsEnv = process.env.REPORT_RECIPIENTS || 'sampathlankasunsoft93@gmail.com'
    const recipients = recipientsEnv.split(',').map(e => e.trim()).filter(Boolean)

    const result = await dispatchReportEmail({
      reportType,
      provider: (process.env.EMAIL_PROVIDER as 'smtp' | 'resend') || 'smtp',
      recipients,
      targetDate: new Date().toISOString().slice(0, 10),
      includeCsv: true,
      smtpUser: process.env.SMTP_USER,
      smtpPass: process.env.SMTP_PASS,
      smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
      smtpPort: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 465,
      senderApiKey: process.env.RESEND_API_KEY,
      fromEmail: process.env.RESEND_FROM_EMAIL
    })

    return NextResponse.json(result)
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
  reportType?: 'morning' | 'evening'
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

    const startOfTrendYear = new Date(targetYear, 0, 1).toISOString()
    const endOfTrendYear = new Date(targetYear, 11, 31, 23, 59, 59, 999).toISOString()

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

    // Query Comprehensive Datasets
    const [
      dailyPayments,
      currentMonthPayments,
      prevMonthPayments,
      yearPayments,
      { data: dailyRegistrations },
      { data: debtsData }
    ] = await Promise.all([
      fetchAllPaginated((from, to) =>
        supabase
          .from('payments')
          .select('*, students(ps_code, full_name, grade, household:households(parent_name, parent_phone, address))')
          .or(`created_at.gte.${startOfDay},date_paid.eq.${targetDate}`)
          .lte('created_at', endOfDay)
          .range(from, to)
      ),
      fetchAllPaginated((from, to) =>
        supabase
          .from('payments')
          .select('*, students(ps_code, full_name, grade, household:households(parent_name, parent_phone, address))')
          .eq('month', targetMonth)
          .eq('year', targetYear)
          .range(from, to)
      ),
      fetchAllPaginated((from, to) =>
        supabase
          .from('payments')
          .select('*, students(ps_code, full_name, grade, household:households(parent_name, parent_phone, address))')
          .eq('month', prevMonthNum)
          .eq('year', prevYearNum)
          .range(from, to)
      ),
      fetchAllPaginated((from, to) =>
        supabase
          .from('payments')
          .select('month, year, amount_paid, class_type, students(ps_code, full_name, grade)')
          .eq('year', targetYear)
          .range(from, to)
      ),
      supabase
        .from('students')
        .select('*, household:households(*), enrollments(*)')
        .not('created_by', 'ilike', '%Auto-Pre-generated%')
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay),
      supabase
        .from('students_outstanding')
        .select('*')
    ])

    const paymentsList = dailyPayments || []
    const regList = dailyRegistrations || []
    const currPayList = currentMonthPayments || []
    const prevPayList = prevMonthPayments || []
    const outstandingList = debtsData || []

    const totalDailyRevenue = paymentsList.reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0)
    const totalMonthRevenue = currPayList.reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0)
    const totalDebtAmount = outstandingList.reduce((sum, d) => sum + Math.abs(d.current_balance || 0), 0)

    const targetGrades = [6, 7, 8, 9, 10, 11]

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

    // Multi-month totals for SVG chart (Jan -> targetMonth)
    const monthlyTrendData: { month: number; monthName: string; revenue: number; students: number }[] = []
    const yearPayList = (yearPayments as any[]) || []
    for (let m = 1; m <= targetMonth; m++) {
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

    // Generate Mini SVG Chart for email
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
        <!-- Grid lines -->
        <line x1="${padL}" y1="${padT}" x2="${svgChartWidth - padR}" y2="${padT}" stroke="#334155" stroke-dasharray="3,3" />
        <line x1="${padL}" y1="${padT + plotH / 2}" x2="${svgChartWidth - padR}" y2="${padT + plotH / 2}" stroke="#334155" stroke-dasharray="3,3" />
        <line x1="${padL}" y1="${padT + plotH}" x2="${svgChartWidth - padR}" y2="${padT + plotH}" stroke="#475569" stroke-width="1.5" />
        
        <!-- Y Axis Labels -->
        <text x="${padL - 6}" y="${padT + 4}" fill="#94a3b8" font-size="10" text-anchor="end">${(maxTrendRevenue / 1000000).toFixed(1)}M</text>
        <text x="${padL - 6}" y="${padT + plotH / 2 + 4}" fill="#94a3b8" font-size="10" text-anchor="end">${(maxTrendRevenue / 2000000).toFixed(1)}M</text>
        <text x="${padL - 6}" y="${padT + plotH + 3}" fill="#94a3b8" font-size="10" text-anchor="end">0</text>

        <!-- Trend Line -->
        <path d="${pathD}" fill="none" stroke="#3b82f6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
        
        <!-- Points & X Labels -->
        ${points.map(p => `
          <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.5" fill="#60a5fa" stroke="#1e3a8a" stroke-width="2" />
          <text x="${p.x.toFixed(1)}" y="${svgChartHeight - 8}" fill="#cbd5e1" font-size="11" font-weight="600" text-anchor="middle">${p.monthName}</text>
        `).join('')}
      </svg>
    `

    // Build Email Templates
    let emailSubject = ''
    let emailHtml = ''

    if (reportType === 'morning') {
      // =========================================================================
      // ☀️ MORNING STRATEGIC BRIEF TEMPLATE
      // =========================================================================
      emailSubject = `☀️ MathsPS Morning Strategic Brief — ${targetDate} (Retention: ${overallRetentionRate}%)`
      emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #1e293b; }
            .container { max-width: 660px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.07); border: 1px solid #cbd5e1; }
            .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #3b82f6 100%); color: #ffffff; padding: 28px 24px; text-align: center; }
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
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>☀️ MathsPS Executive Morning Strategic Brief</h1>
              <p>Performance Momentum, Retention Analytics &amp; Daily Action Items (${targetDate})</p>
            </div>

            <div class="content">
              <!-- KPI Row 1: Month Momentum -->
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

              <!-- Action Items Box -->
              <div class="action-box">
                <strong style="color: #1e40af; display: block; margin-bottom: 6px; font-size: 14px;">🎯 Priority Focus Areas for Today's Team:</strong>
                <ul style="margin: 0; padding-left: 18px; color: #1e293b; display: flex; flex-direction: column; gap: 4px;">
                  <li><strong>Follow up on ${droppedCount} dropped students</strong> from last month (Check attached CSV for parent phone numbers).</li>
                  <li><strong>Outstanding debts check:</strong> Rs. ${totalDebtAmount.toLocaleString()} pending across ${outstandingList.length} accounts.</li>
                  <li><strong>Yesterday's Collection:</strong> Processed Rs. ${totalDailyRevenue.toLocaleString()} (${paymentsList.length} slips).</li>
                </ul>
              </div>

              <!-- SVG Trend Visual -->
              <div class="section-title">📈 ${targetYear} Revenue Momentum Curve (Jan → ${MONTH_NAMES[targetMonth - 1]})</div>
              ${svgTrendChartHtml}

              <!-- Grade-Wise Retention Benchmark Table -->
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
    } else {
      // =========================================================================
      // 🌅 EVENING DAY-END CASH AUDIT TEMPLATE
      // =========================================================================
      emailSubject = `🌅 MathsPS Day-End Summary — ${targetDate} (Rs. ${totalDailyRevenue.toLocaleString()})`
      emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 24px; color: #1e293b; }
            .container { max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
            .header { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: #ffffff; padding: 28px 24px; text-align: center; }
            .header h1 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
            .header p { margin: 6px 0 0 0; opacity: 0.9; font-size: 14px; }
            .content { padding: 24px; }
            .kpi-grid { display: table; width: 100%; table-layout: fixed; margin-bottom: 24px; }
            .kpi-cell { display: table-cell; padding: 8px; vertical-align: top; }
            .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; text-align: center; }
            .kpi-label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 4px; }
            .kpi-value { font-size: 20px; font-weight: 800; color: #0f172a; }
            .section-title { font-size: 15px; font-weight: 700; color: #0f172a; margin: 20px 0 10px 0; border-bottom: 2px solid #3b82f6; padding-bottom: 4px; display: inline-block; }
            table.data { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
            table.data th { background: #f1f5f9; color: #475569; font-weight: 700; text-align: left; padding: 10px; border-bottom: 2px solid #cbd5e1; }
            table.data td { padding: 9px 10px; border-bottom: 1px solid #e2e8f0; }
            .footer { background: #f8fafc; padding: 18px 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>MathsPS CRM — Executive Day-End Digest</h1>
              <p>Audit &amp; Cash Collection Summary for <strong>${targetDate}</strong></p>
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
                    <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Students added</div>
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

              <div class="section-title">📊 Grade-Wise Performance Breakdown</div>
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
            </div>

            <div class="footer">
              Generated automatically by <strong>MathsPS CRM &amp; Admin Suite</strong>.<br>
              Attachment: <code>Day_End_Audit_${targetDate}.csv</code>
            </div>
          </div>
        </body>
        </html>
      `
    }

    // Attachments generation
    const attachments: any[] = []
    let csvRawBuffer: Buffer | null = null

    if (includeCsv) {
      if (reportType === 'morning' && droppedStudentsList.length > 0) {
        // Morning CSV: At-risk unpaid follow-up roster with direct WhatsApp phone
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

        const csvContent = `${csvHeader}${csvRows}`
        csvRawBuffer = Buffer.from(csvContent, 'utf-8')
        attachments.push({
          filename: `At_Risk_Unpaid_Students_${MONTH_NAMES[targetMonth - 1]}_${targetYear}.csv`,
          content: csvRawBuffer.toString('base64')
        })
      } else if (paymentsList.length > 0) {
        // Evening CSV: Day end audit slips
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

        const csvContent = `${csvHeader}${csvRows}`
        csvRawBuffer = Buffer.from(csvContent, 'utf-8')
        attachments.push({
          filename: `Day_End_Audit_${targetDate}.csv`,
          content: csvRawBuffer.toString('base64')
        })
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
        attachments: csvRawBuffer ? [
          {
            filename: attachments[0]?.filename || `Report_${targetDate}.csv`,
            content: csvRawBuffer
          }
        ] : undefined
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

    return {
      success: true,
      message: `${reportType === 'morning' ? 'Morning Strategic Brief' : 'Evening Day-End Summary'} sent successfully via ${provider.toUpperCase()} to ${recipients.join(', ')}`,
      emailId,
      reportType,
      provider,
      stats: {
        dailyRevenue: totalDailyRevenue,
        monthlyRevenue: totalMonthRevenue,
        retentionRate: overallRetentionRate,
        droppedStudents: droppedCount
      }
    }
}
