import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      recipients = [],
      targetDate = new Date().toISOString().slice(0, 10),
      includeCsv = true,
      senderApiKey,
      fromEmail,
      sections = {
        kpis: true,
        gradeTable: true,
        auditors: true,
        retention: true
      }
    } = body

    if (!recipients || recipients.length === 0) {
      return NextResponse.json({ error: 'At least one recipient email is required.' }, { status: 400 })
    }

    const apiKey = senderApiKey || process.env.RESEND_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        error: 'Resend API Key is missing. Please provide your API Key or set RESEND_API_KEY in environment variables.'
      }, { status: 400 })
    }

    const resend = new Resend(apiKey)

    // Supabase Admin/Server Client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const startOfDay = `${targetDate}T00:00:00.000Z`
    const endOfDay = `${targetDate}T23:59:59.999Z`

    const targetYear = parseInt(targetDate.split('-')[0], 10)
    const targetMonth = parseInt(targetDate.split('-')[1], 10)

    // Fetch Day's Data
    const [
      { data: dailyPayments },
      { data: dailyRegistrations },
      { data: monthPayments }
    ] = await Promise.all([
      supabase
        .from('payments')
        .select('*, students(ps_code, full_name, grade, household:households(parent_name, parent_phone, address))')
        .or(`created_at.gte.${startOfDay},date_paid.eq.${targetDate}`)
        .lte('created_at', endOfDay),
      supabase
        .from('students')
        .select('*, household:households(*), enrollments(*)')
        .not('created_by', 'ilike', '%Auto-Pre-generated%')
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay),
      supabase
        .from('payments')
        .select('amount_paid')
        .eq('month', targetMonth)
        .eq('year', targetYear)
    ])

    const paymentsList = dailyPayments || []
    const regList = dailyRegistrations || []
    const monthPayList = monthPayments || []

    const totalDailyRevenue = paymentsList.reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0)
    const totalMonthRevenue = monthPayList.reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0)

    // Grade breakdown
    const targetGrades = [6, 7, 8, 9, 10, 11]
    const gradePaidMap: Record<number, { count: number; total: number }> = {}
    const gradeRegMap: Record<number, number> = {}

    targetGrades.forEach(g => {
      gradePaidMap[g] = { count: 0, total: 0 }
      gradeRegMap[g] = 0
    })

    regList.forEach(s => {
      const gr = s.grade || 0
      if (gradeRegMap[gr] !== undefined) gradeRegMap[gr] += 1
    })

    const auditorMap: Record<string, { count: number; total: number }> = {}

    paymentsList.forEach(p => {
      const gr = p.students?.grade || 0
      const amt = Number(p.amount_paid) || 0
      const who = p.recorded_by || 'System User'

      if (gradePaidMap[gr] !== undefined) {
        gradePaidMap[gr].count += 1
        gradePaidMap[gr].total += amt
      }

      if (!auditorMap[who]) auditorMap[who] = { count: 0, total: 0 }
      auditorMap[who].count += 1
      auditorMap[who].total += amt
    })

    // Build modern HTML email template
    const emailHtml = `
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
            <p>Audit &amp; Performance Summary for <strong>${targetDate}</strong></p>
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
                  <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Month total</div>
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
                ${targetGrades.map(g => `
                  <tr>
                    <td><strong>Grade ${g}</strong></td>
                    <td style="text-align: center;">${gradeRegMap[g] || 0}</td>
                    <td style="text-align: center;">${gradePaidMap[g]?.count || 0}</td>
                    <td style="text-align: right; font-weight: 700;">Rs. ${(gradePaidMap[g]?.total || 0).toLocaleString()}</td>
                  </tr>
                `).join('')}
                <tr style="background: #f8fafc; font-weight: 800; border-top: 2px solid #cbd5e1;">
                  <td>TOTAL</td>
                  <td style="text-align: center;">${regList.length}</td>
                  <td style="text-align: center;">${paymentsList.length}</td>
                  <td style="text-align: right; color: #2563eb;">Rs. ${totalDailyRevenue.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>

            <div class="section-title">👤 Staff &amp; Auditor Activity</div>
            <table class="data">
              <thead>
                <tr>
                  <th>Auditor (Recorded By)</th>
                  <th style="text-align: center;">Slips Processed</th>
                  <th style="text-align: right;">Revenue Logged</th>
                </tr>
              </thead>
              <tbody>
                ${Object.keys(auditorMap).length > 0 ? Object.entries(auditorMap).map(([who, data]) => `
                  <tr>
                    <td><strong>${who}</strong></td>
                    <td style="text-align: center;">${data.count}</td>
                    <td style="text-align: right; font-weight: 600;">Rs. ${data.total.toLocaleString()}</td>
                  </tr>
                `).join('') : `
                  <tr>
                    <td colspan="3" style="text-align: center; color: #94a3b8; padding: 14px;">No auditor transactions recorded today.</td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>

          <div class="footer">
            Generated automatically by <strong>MathsPS CRM &amp; Admin Suite</strong>.<br>
            For live dashboards, visit: <a href="https://mathsps-lead-crm.vercel.app/reports" style="color: #3b82f6; text-decoration: none;">Reports &amp; Analytics Dashboard</a>
          </div>
        </div>
      </body>
      </html>
    `

    // Generate CSV attachment if enabled
    const attachments: any[] = []
    if (includeCsv && paymentsList.length > 0) {
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
      const base64Csv = Buffer.from(csvContent, 'utf-8').toString('base64')

      attachments.push({
        filename: `Day_End_Audit_${targetDate}.csv`,
        content: base64Csv
      })
    }

    // Send email via Resend
    const senderAddress = fromEmail && fromEmail.trim()
      ? fromEmail.trim()
      : 'MathsPS Reports <onboarding@resend.dev>'

    const sendResult = await resend.emails.send({
      from: senderAddress,
      to: recipients,
      subject: `🌅 MathsPS Day-End Summary — ${targetDate} (Rs. ${totalDailyRevenue.toLocaleString()})`,
      html: emailHtml,
      attachments: attachments.length > 0 ? attachments : undefined
    })

    if (sendResult.error) {
      const errMsg = sendResult.error.message || 'Resend delivery failed'
      return NextResponse.json({ error: errMsg }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: `Daily executive digest sent successfully to ${recipients.join(', ')}`,
      emailId: sendResult.data?.id,
      stats: {
        dailyRevenue: totalDailyRevenue,
        dailySlips: paymentsList.length,
        dailyReg: regList.length,
        recipientsCount: recipients.length
      }
    })

  } catch (error: any) {
    console.error('Email report send error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
