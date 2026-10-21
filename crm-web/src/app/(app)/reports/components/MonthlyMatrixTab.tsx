'use client'

import { Printer, FileSpreadsheet, Building2, Users, Calendar, Layers, BookOpen, GraduationCap, Download, CheckCircle2, TrendingUp } from 'lucide-react'
import { MONTH_NAMES, CLASS_LABELS, extractLmsNumber } from '@/lib/types'
import { exportTableToCsv, exportLmsBulkCsv, TARGET_GRADES, getGradeFromPayment } from '@/lib/reports-analytics'

interface MonthlyMatrixTabProps {
  month: number
  setMonth: (m: number) => void
  year: number
  setYear: (y: number) => void
  monthlySubTab: 'matrix' | 'courses' | 'bank' | 'registrations'
  setMonthlySubTab: (tab: 'matrix' | 'courses' | 'bank' | 'registrations') => void
  matrixMode: 'registrations' | 'payments'
  setMatrixMode: (mode: 'registrations' | 'payments') => void
  cumulativeMatrixRows: {
    day: number
    dateStr: string
    counts: Record<number, number>
    dailyCountTotal: number
    cumulativeTotal: number
    isWeekend: boolean
    hasActivity: boolean
  }[]
  bankRevenue: { bank: string; count: number; total: number }[]
  methodRevenue: { method: string; count: number; total: number }[]
  totalMonthlyRevenue: number
  allPaymentsMonth: any[]
  newStudents: any[]
  filteredNewStudents: any[]
  gradeStats: Record<number, number>
  searchStu: string
  setSearchStu: (s: string) => void
  courseLabels?: Record<string, string>
}

export default function MonthlyMatrixTab({
  month,
  setMonth,
  year,
  setYear,
  monthlySubTab,
  setMonthlySubTab,
  matrixMode,
  setMatrixMode,
  cumulativeMatrixRows,
  bankRevenue,
  methodRevenue,
  totalMonthlyRevenue,
  allPaymentsMonth,
  newStudents,
  filteredNewStudents,
  gradeStats,
  searchStu,
  setSearchStu,
  courseLabels = {}
}: MonthlyMatrixTabProps) {
  const matrixTargetGrades = TARGET_GRADES

  // =========================================================================
  // COURSE FINANCIAL ALIGNMENT & BREAKDOWN
  // =========================================================================
  // 1. Group all month payments by class_type / course
  const coursePaymentMap = new Map<string, {
    classCode: string
    courseName: string
    grade: number
    studentIds: Set<string>
    slipsCount: number
    revenue: number
    studentsList: { name: string; mobile: string; ps_code: string; amount: number; date_paid: string }[]
  }>()

  allPaymentsMonth.forEach(p => {
    const rawClass = p.class_type || 'UNKNOWN'
    const amt = Number(p.amount_paid) || 0
    const ps = p.students?.ps_code || p.student_id || 'UNKNOWN'
    const studentName = p.students?.full_name || 'Student'
    const studentMobile = extractLmsNumber(p.students) || p.students?.household?.parent_phone || ''
    const studentGrade = getGradeFromPayment(p) || p.students?.grade || 0
    const courseTitle = courseLabels[rawClass] || CLASS_LABELS[rawClass] || rawClass

    if (!coursePaymentMap.has(rawClass)) {
      coursePaymentMap.set(rawClass, {
        classCode: rawClass,
        courseName: courseTitle,
        grade: studentGrade,
        studentIds: new Set<string>(),
        slipsCount: 0,
        revenue: 0,
        studentsList: []
      })
    }

    const entry = coursePaymentMap.get(rawClass)!
    entry.studentIds.add(ps)
    entry.slipsCount += 1
    entry.revenue += amt
    entry.studentsList.push({
      name: studentName,
      mobile: studentMobile,
      ps_code: ps,
      amount: amt,
      date_paid: p.date_paid || (p.created_at ? p.created_at.slice(0, 10) : '')
    })
  })

  // 2. Also incorporate newly registered students with enrolled classes
  const courseEnrollmentMap = new Map<string, number>()
  newStudents.forEach(s => {
    (s.enrollments || []).forEach((e: any) => {
      const c = e.class_type
      if (c) {
        courseEnrollmentMap.set(c, (courseEnrollmentMap.get(c) || 0) + 1)
      }
    })
  })

  // 3. Flatten into course breakdown list sorted by revenue descending
  const courseBreakdownList = Array.from(coursePaymentMap.values()).map(c => ({
    code: c.classCode,
    name: c.courseName,
    grade: c.grade,
    studentCount: c.studentIds.size,
    slipsCount: c.slipsCount,
    revenue: c.revenue,
    newEnrollments: courseEnrollmentMap.get(c.classCode) || 0,
    students: c.studentsList
  })).sort((a, b) => b.revenue - a.revenue)

  // 4. Grade-grouped courses summary
  const gradeWiseCourseMap: Record<number, typeof courseBreakdownList> = {}
  courseBreakdownList.forEach(c => {
    const g = c.grade || 0
    if (!gradeWiseCourseMap[g]) gradeWiseCourseMap[g] = []
    gradeWiseCourseMap[g].push(c)
  })

  return (
    <div className="fade-in">
      {/* Filter & Sub-view Switcher Bar */}
      <div className="glass-card" style={{ padding: 18, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                Month
              </label>
              <select
                className="input-field"
                style={{ width: 140 }}
                value={month}
                onChange={e => setMonth(parseInt(e.target.value))}
              >
                {MONTH_NAMES.map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                Year
              </label>
              <select
                className="input-field"
                style={{ width: 100 }}
                value={year}
                onChange={e => setYear(parseInt(e.target.value))}
              >
                {[2024, 2025, 2026, 2027].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {monthlySubTab === 'matrix' && (
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                  Matrix Data Metric
                </label>
                <div style={{ display: 'flex', gap: 4, background: 'var(--bg-base)', padding: 4, borderRadius: 8, border: '1px solid var(--border)' }}>
                  <button
                    type="button"
                    onClick={() => setMatrixMode('registrations')}
                    style={{
                      padding: '6px 12px',
                      fontSize: 12,
                      fontWeight: 700,
                      borderRadius: 6,
                      border: 'none',
                      cursor: 'pointer',
                      background: matrixMode === 'registrations' ? 'var(--accent-blue)' : 'transparent',
                      color: matrixMode === 'registrations' ? '#fff' : 'var(--text-muted)'
                    }}
                  >
                    👥 New Registrations
                  </button>
                  <button
                    type="button"
                    onClick={() => setMatrixMode('payments')}
                    style={{
                      padding: '6px 12px',
                      fontSize: 12,
                      fontWeight: 700,
                      borderRadius: 6,
                      border: 'none',
                      cursor: 'pointer',
                      background: matrixMode === 'payments' ? '#10b981' : 'transparent',
                      color: matrixMode === 'payments' ? '#fff' : 'var(--text-muted)'
                    }}
                  >
                    💳 Paid Students / Slips
                  </button>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {monthlySubTab === 'matrix' && (
              <>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Printer size={16} /> Print Matrix Sheet
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const monthTitle = MONTH_NAMES[month - 1]
                    const headers = ['Date', '6', '7', '8', '9', '10', '11', 'Total', 'Daily Increment']
                    const rows = cumulativeMatrixRows.map(r => [
                      `"${r.dateStr}"`,
                      `"${r.counts[6] || 0}"`,
                      `"${r.counts[7] || 0}"`,
                      `"${r.counts[8] || 0}"`,
                      `"${r.counts[9] || 0}"`,
                      `"${r.counts[10] || 0}"`,
                      `"${r.counts[11] || 0}"`,
                      `"${r.cumulativeTotal}"`,
                      `"${r.dailyCountTotal}"`
                    ])
                    exportTableToCsv(`${monthTitle}_${year}_Grade_Progression_Matrix`, headers, rows)
                  }}
                  className="btn-primary"
                  style={{ background: '#1e7e34', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <FileSpreadsheet size={16} /> Export Matrix CSV
                </button>
              </>
            )}

            {monthlySubTab === 'courses' && (
              <button
                type="button"
                onClick={() => {
                  const headers = ['GRADE', 'COURSE / SUBJECT', 'STUDENTS ENROLLED / PAID', 'TOTAL REVENUE (RS)', 'SHARE %']
                  const rows = courseBreakdownList.map(c => [
                    `"Grade ${c.grade || 'Other'}"`,
                    `"${(c.name || '').replace(/"/g, '""')}"`,
                    `"${c.studentCount}"`,
                    `"${c.revenue}"`,
                    `"${totalMonthlyRevenue > 0 ? ((c.revenue / totalMonthlyRevenue) * 100).toFixed(1) : 0}%"`
                  ])
                  exportTableToCsv(`Course_Financials_${MONTH_NAMES[month - 1]}_${year}`, headers, rows)
                }}
                className="btn-primary"
                style={{ background: '#7c3aed', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <FileSpreadsheet size={16} /> Export Courses CSV
              </button>
            )}

            {monthlySubTab === 'bank' && (
              <button
                type="button"
                onClick={() => {
                  const headers = ['BANK NAME', 'TRANSACTIONS COUNT', 'TOTAL REVENUE (RS)', 'SHARE %']
                  const rows = bankRevenue.map(b => [
                    `"${b.bank}"`,
                    `"${b.count}"`,
                    `"${b.total}"`,
                    `"${totalMonthlyRevenue > 0 ? ((b.total / totalMonthlyRevenue) * 100).toFixed(1) : 0}%"`
                  ])
                  exportTableToCsv(`Bank_Revenue_${MONTH_NAMES[month - 1]}_${year}`, headers, rows)
                }}
                className="btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <FileSpreadsheet size={16} /> Export Bank CSV
              </button>
            )}

            {monthlySubTab === 'registrations' && (
              <button
                type="button"
                onClick={() => {
                  const headers = ['PS CODE', 'STUDENT NAME', 'GRADE', 'PARENT NAME', 'PHONE', 'ADDRESS', 'ENROLLED CLASSES', 'REGISTERED DATE', 'REGISTERED BY']
                  const rows = filteredNewStudents.map(s => [
                    `"${s.ps_code}"`,
                    `"${(s.full_name || '').replace(/"/g, '""')}"`,
                    `"Grade ${s.grade || '?'}"`,
                    `"${(s.household?.parent_name || '').replace(/"/g, '""')}"`,
                    `"${(s.household?.parent_phone || '').replace(/"/g, '""')}"`,
                    `"${(s.household?.address || '').replace(/"/g, '""')}"`,
                    `"${(s.enrollments || []).map((e: any) => courseLabels[e.class_type] || CLASS_LABELS[e.class_type] || e.class_type).join('; ')}"`,
                    `"${new Date(s.created_at).toLocaleDateString()}"`,
                    `"${s.created_by || 'System'}"`
                  ])
                  exportTableToCsv(`New_Registrations_${MONTH_NAMES[month - 1]}_${year}`, headers, rows)
                }}
                className="btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <FileSpreadsheet size={16} /> Export Registrations Excel
              </button>
            )}
          </div>
        </div>

        {/* Sub-view Segmented Switcher */}
        <div style={{ display: 'flex', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 14, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setMonthlySubTab('matrix')}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: monthlySubTab === 'matrix' ? 'var(--accent-blue)' : 'var(--bg-base)',
              color: monthlySubTab === 'matrix' ? '#fff' : 'var(--text-secondary)'
            }}
          >
            <Calendar size={15} />
            1–31 Progression Matrix
          </button>

          <button
            type="button"
            onClick={() => setMonthlySubTab('courses')}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: monthlySubTab === 'courses' ? '#7c3aed' : 'var(--bg-base)',
              color: monthlySubTab === 'courses' ? '#fff' : 'var(--text-secondary)'
            }}
          >
            <BookOpen size={15} />
            Courses &amp; Financials ({courseBreakdownList.length})
          </button>

          <button
            type="button"
            onClick={() => setMonthlySubTab('bank')}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: monthlySubTab === 'bank' ? 'var(--accent-blue)' : 'var(--bg-base)',
              color: monthlySubTab === 'bank' ? '#fff' : 'var(--text-secondary)'
            }}
          >
            <Building2 size={15} />
            Bank Revenue &amp; Channels
          </button>

          <button
            type="button"
            onClick={() => setMonthlySubTab('registrations')}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: monthlySubTab === 'registrations' ? 'var(--accent-blue)' : 'var(--bg-base)',
              color: monthlySubTab === 'registrations' ? '#fff' : 'var(--text-secondary)'
            }}
          >
            <Users size={15} />
            Monthly Admissions ({newStudents.length})
          </button>
        </div>
      </div>

      {/* Top KPI Cards with Dashboard Colored Shadows & Left Borders */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div className="stat-card" style={{ borderLeft: '4px solid #38bdf8', boxShadow: '0 4px 20px -4px rgba(56, 189, 248, 0.25)' }}>
          <div className="stat-card label">Total Revenue ({MONTH_NAMES[month - 1]} {year})</div>
          <div className="stat-card value" style={{ color: '#38bdf8', fontSize: 24 }}>
            Rs. {totalMonthlyRevenue.toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            {allPaymentsMonth.length} student slips collected
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #4ade80', boxShadow: '0 4px 20px -4px rgba(74, 222, 128, 0.25)' }}>
          <div className="stat-card label">Month-End Cumulative Total</div>
          <div className="stat-card value" style={{ color: '#4ade80', fontSize: 24 }}>
            {cumulativeMatrixRows[cumulativeMatrixRows.length - 1]?.cumulativeTotal || 0}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Across Grades 5–11 ({matrixMode === 'registrations' ? 'Registered' : 'Paid'})
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #818cf8', boxShadow: '0 4px 20px -4px rgba(129, 140, 248, 0.25)' }}>
          <div className="stat-card label">New Admissions</div>
          <div className="stat-card value" style={{ color: '#818cf8', fontSize: 24 }}>
            {newStudents.length} Students
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Joined during {MONTH_NAMES[month - 1]} {year}
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #fcd34d', boxShadow: '0 4px 20px -4px rgba(245, 158, 11, 0.25)' }}>
          <div className="stat-card label">Top Bank Partner</div>
          <div className="stat-card value" style={{ color: '#f59e0b', fontSize: 20 }}>
            {bankRevenue[0]?.bank || 'None'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Rs. {(bankRevenue[0]?.total || 0).toLocaleString()} ({bankRevenue[0]?.count || 0} slips)
          </div>
        </div>
      </div>

      {/* Monthly Collection Target Goal & Trajectory Forecast Gauge */}
      {(() => {
        const defaultGoal = 6000000 // Rs. 6M default target
        const daysInMonth = new Date(year, month, 0).getDate()
        const now = new Date()
        const isCurrentMonth = now.getMonth() + 1 === month && now.getFullYear() === year
        const currentDayNum = isCurrentMonth ? Math.min(now.getDate(), daysInMonth) : daysInMonth
        const pctAchieved = Math.min(100, Math.round((totalMonthlyRevenue / defaultGoal) * 100))
        const dailyAvg = currentDayNum > 0 ? Math.round(totalMonthlyRevenue / currentDayNum) : 0
        const projectedMonthEnd = Math.round(dailyAvg * daysInMonth)
        const projectedPct = Math.min(150, Math.round((projectedMonthEnd / defaultGoal) * 100))

        return (
          <div className="glass-card" style={{ padding: 18, marginBottom: 20, background: 'linear-gradient(180deg, rgba(59,130,246,0.06) 0%, rgba(59,130,246,0.01) 100%)', border: '1px solid rgba(59,130,246,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  🎯 Monthly Collection Target &amp; Pace Gauge ({MONTH_NAMES[month - 1]} {year})
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  Target: <strong>Rs. {defaultGoal.toLocaleString()}</strong> · Collected: <strong style={{ color: '#10b981' }}>Rs. {totalMonthlyRevenue.toLocaleString()} ({pctAchieved}%)</strong> · Daily Pace: <strong>Rs. {dailyAvg.toLocaleString()}/day</strong>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span className="badge" style={{
                  background: projectedMonthEnd >= defaultGoal ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                  color: projectedMonthEnd >= defaultGoal ? '#10b981' : '#f59e0b',
                  fontSize: 12,
                  fontWeight: 700
                }}>
                  Projected Finish: Rs. {projectedMonthEnd.toLocaleString()} ({projectedPct}%)
                </span>
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div style={{ width: '100%', height: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 20, overflow: 'hidden', position: 'relative' }}>
              <div style={{
                width: `${pctAchieved}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #3b82f6 0%, #10b981 100%)',
                borderRadius: 20,
                transition: 'width 0.6s ease'
              }} />
            </div>
          </div>
        )
      })()}

      {/* SUB-VIEW 1: PROGRESSION MATRIX */}
      {monthlySubTab === 'matrix' && (
        <div className="fade-in">
          <div className="glass-card" style={{ overflow: 'hidden', padding: 0, borderRadius: 12 }}>
            <div style={{
              background: 'linear-gradient(135deg, #1b5e20 0%, #2e7d32 100%)',
              color: '#fff',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '2px solid #145a17'
            }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: 0.5 }}>
                  📅 {MONTH_NAMES[month - 1]} {year} — Grade-Wise Cumulative Progression Sheet
                </div>
                <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>
                  {matrixMode === 'registrations'
                    ? 'Daily and cumulative count of new registered students across Grades 5–11'
                    : 'Daily and cumulative count of students paying fees across Grades 5–11'}
                </div>
              </div>
              <span style={{
                background: 'rgba(255,255,255,0.2)',
                padding: '4px 12px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700
              }}>
                {MONTH_NAMES[month - 1]} Total: {cumulativeMatrixRows[cumulativeMatrixRows.length - 1]?.cumulativeTotal || 0}
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                textAlign: 'center',
                fontFamily: 'inherit',
                fontSize: 13
              }}>
                <thead>
                  <tr style={{ background: '#2e7d32', color: '#fff', fontWeight: 800 }}>
                    <th rowSpan={2} style={{ padding: '12px 16px', border: '1px solid #1b5e20', width: 130 }}>
                      Date
                    </th>
                    <th colSpan={matrixTargetGrades.length} style={{ padding: '8px 12px', border: '1px solid #1b5e20', fontSize: 14, letterSpacing: 1 }}>
                      {MONTH_NAMES[month - 1]} (Grades)
                    </th>
                    <th rowSpan={2} style={{ padding: '12px 16px', border: '1px solid #1b5e20', width: 110, background: '#1b5e20' }}>
                      Total
                    </th>
                  </tr>
                  <tr style={{ background: '#388e3c', color: '#fff', fontWeight: 700 }}>
                    {matrixTargetGrades.map(g => (
                      <th key={g} style={{ padding: '8px 12px', border: '1px solid #1b5e20', minWidth: 65 }}>
                        {g}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cumulativeMatrixRows.map((r, idx) => {
                    const rowBg = r.isWeekend
                      ? 'rgba(239, 68, 68, 0.12)'
                      : idx % 2 === 0
                      ? 'var(--bg-base)'
                      : 'rgba(255, 255, 255, 0.02)'

                    return (
                      <tr
                        key={r.day}
                        style={{
                          background: rowBg,
                          borderBottom: '1px solid var(--border)',
                          transition: 'background 0.15s'
                        }}
                      >
                        <td style={{
                          padding: '10px 14px',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          borderRight: '1px solid var(--border)',
                          textAlign: 'center'
                        }}>
                          {r.dateStr}
                        </td>

                        {matrixTargetGrades.map(g => {
                          const count = r.counts[g] || 0
                          return (
                            <td
                              key={g}
                              style={{
                                padding: '10px 12px',
                                borderRight: '1px solid var(--border)',
                                fontWeight: count > 0 ? 600 : 400,
                                color: count > 0 ? 'var(--text-primary)' : 'var(--text-muted)'
                              }}
                            >
                              {count}
                            </td>
                          )
                        })}

                        <td style={{
                          padding: '10px 14px',
                          fontWeight: 800,
                          color: '#10b981',
                          fontSize: 14,
                          background: r.isWeekend ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.08)'
                        }}>
                          {r.cumulativeTotal}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 2: COURSES & FINANCIALS TRACKING */}
      {monthlySubTab === 'courses' && (
        <div className="fade-in">
          {/* Top Course Analytics Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
            <div className="stat-card" style={{ borderLeft: '4px solid #8b5cf6', boxShadow: '0 4px 20px -4px rgba(139, 92, 246, 0.25)' }}>
              <div className="stat-card label">Active Courses Monetized</div>
              <div className="stat-card value" style={{ color: '#8b5cf6', fontSize: 24 }}>
                {courseBreakdownList.length} Courses
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                With verified payment collections
              </div>
            </div>

            <div className="stat-card" style={{ borderLeft: '4px solid #10b981', boxShadow: '0 4px 20px -4px rgba(16, 185, 129, 0.25)' }}>
              <div className="stat-card label">Top Revenue Course</div>
              <div className="stat-card value" style={{ color: '#10b981', fontSize: 18, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {courseBreakdownList[0]?.name || 'None'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Rs. {(courseBreakdownList[0]?.revenue || 0).toLocaleString()} ({courseBreakdownList[0]?.studentCount || 0} students)
              </div>
            </div>

            <div className="stat-card" style={{ borderLeft: '4px solid #38bdf8', boxShadow: '0 4px 20px -4px rgba(56, 189, 248, 0.25)' }}>
              <div className="stat-card label">Average Course Yield</div>
              <div className="stat-card value" style={{ color: '#38bdf8', fontSize: 24 }}>
                Rs. {courseBreakdownList.length > 0 ? Math.round(totalMonthlyRevenue / courseBreakdownList.length).toLocaleString() : 0}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Per active course in {MONTH_NAMES[month - 1]}
              </div>
            </div>
          </div>

          {/* Master Course-Wise Financial Breakdown Table */}
          <div className="glass-card" style={{ padding: 20, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <BookOpen size={20} style={{ color: '#8b5cf6' }} />
                Course Performance &amp; Revenue Alignment ({MONTH_NAMES[month - 1]} {year})
              </div>
              <span className="badge" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6', fontWeight: 700, fontSize: 12 }}>
                {courseBreakdownList.length} Active Courses / Classes
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Course / Class Name</th>
                    <th style={{ textAlign: 'center' }}>Grade</th>
                    <th style={{ textAlign: 'center' }}>Paying Students</th>
                    <th style={{ textAlign: 'center' }}>Slips Audited</th>
                    <th style={{ textAlign: 'center' }}>New Enrolled</th>
                    <th style={{ textAlign: 'right' }}>Total Collections (Rs.)</th>
                    <th style={{ textAlign: 'right' }}>% Revenue Share</th>
                    <th style={{ textAlign: 'center', width: 140 }}>LMS Export</th>
                  </tr>
                </thead>
                <tbody>
                  {courseBreakdownList.map(c => {
                    const share = totalMonthlyRevenue > 0 ? ((c.revenue / totalMonthlyRevenue) * 100).toFixed(1) : '0.0'
                    return (
                      <tr key={c.code}>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {c.name}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            {c.code}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="badge" style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--accent-blue)', fontWeight: 700, fontSize: 11 }}>
                            {c.grade > 0 ? `Grade ${c.grade}` : 'Specialist'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: '#10b981' }}>
                          {c.studentCount}
                        </td>
                        <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                          {c.slipsCount}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {c.newEnrollments > 0 ? (
                            <span className="badge" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', fontSize: 11, fontWeight: 700 }}>
                              +{c.newEnrollments} new
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>
                          Rs. {c.revenue.toLocaleString()}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--accent-blue)', fontSize: 12 }}>
                          {share}%
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            disabled={c.students.length === 0}
                            onClick={() => {
                              const safeName = c.name.replace(/[\s\(\)\/\:]+/g, '_')
                              exportLmsBulkCsv(`LMS_Billing_${safeName}_${MONTH_NAMES[month - 1]}_${year}`, c.students)
                            }}
                            className="btn-secondary"
                            style={{ padding: '4px 10px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            title="Export LMS Bulk Sample CSV (name,mobile)"
                          >
                            <Download size={12} style={{ color: '#10b981' }} /> LMS CSV
                          </button>
                        </td>
                      </tr>
                    )
                  })}

                  {/* Summary Footer Row */}
                  <tr style={{ background: 'rgba(255,255,255,0.03)', fontWeight: 800 }}>
                    <td colSpan={2} style={{ color: 'var(--text-primary)', fontSize: 13 }}>
                      TOTAL ALL COURSES
                    </td>
                    <td style={{ textAlign: 'center', color: '#10b981', fontSize: 14 }}>
                      {allPaymentsMonth.length}
                    </td>
                    <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      {allPaymentsMonth.length}
                    </td>
                    <td style={{ textAlign: 'center', color: '#10b981' }}>
                      {newStudents.length}
                    </td>
                    <td style={{ textAlign: 'right', color: '#10b981', fontSize: 15 }}>
                      Rs. {totalMonthlyRevenue.toLocaleString()}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-primary)' }}>
                      100.0%
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        disabled={allPaymentsMonth.length === 0}
                        onClick={() => {
                          const allPaid = allPaymentsMonth.map(p => ({
                            name: p.students?.full_name || 'Student',
                            mobile: extractLmsNumber(p.students) || p.students?.household?.parent_phone || ''
                          }))
                          exportLmsBulkCsv(`LMS_Billing_AllCourses_${MONTH_NAMES[month - 1]}_${year}`, allPaid)
                        }}
                        className="btn-primary"
                        style={{ padding: '4px 10px', fontSize: 11, background: '#10b981', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        <Download size={12} /> All LMS
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Grade-Wise Course Alignment Breakdown */}
          <div style={{ marginTop: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <GraduationCap size={20} style={{ color: 'var(--accent-blue)' }} />
              Grade-Wise Course Alignment Breakdown
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
              {matrixTargetGrades.map(g => {
                const gradeCourses = gradeWiseCourseMap[g] || []
                const gradeTotalRev = gradeCourses.reduce((sum, c) => sum + c.revenue, 0)
                const gradeTotalStudents = gradeCourses.reduce((sum, c) => sum + c.studentCount, 0)

                return (
                  <div key={g} className="glass-card" style={{ padding: 16, borderTop: '3px solid var(--accent-blue)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>
                          Grade {g}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {gradeCourses.length} active {gradeCourses.length === 1 ? 'course' : 'courses'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, color: '#10b981', fontSize: 15 }}>
                          Rs. {gradeTotalRev.toLocaleString()}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {gradeTotalStudents} students paid
                        </div>
                      </div>
                    </div>

                    {gradeCourses.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {gradeCourses.map(c => (
                          <div key={c.code} style={{ padding: '8px 10px', background: 'var(--bg-base)', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                            <div style={{ maxWidth: '65%' }}>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {c.name}
                              </div>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                {c.studentCount} students ({c.slipsCount} slips)
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                                Rs. {c.revenue.toLocaleString()}
                              </div>
                              <div style={{ fontSize: 10, color: 'var(--accent-blue)', fontWeight: 600 }}>
                                {totalMonthlyRevenue > 0 ? ((c.revenue / totalMonthlyRevenue) * 100).toFixed(1) : 0}% share
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ padding: 14, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                        No course payments recorded in Grade {g} for this month.
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 3: BANK REVENUE */}
      {monthlySubTab === 'bank' && (
        <div className="fade-in">
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20 }}>
            <div className="glass-card" style={{ padding: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Building2 size={18} style={{ color: 'var(--accent-blue)' }} />
                Bank-Wise Revenue Breakdown ({MONTH_NAMES[month - 1]} {year})
              </div>

              <table className="data-table">
                <thead>
                  <tr>
                    <th>Bank Name</th>
                    <th style={{ textAlign: 'center' }}>Transactions</th>
                    <th style={{ textAlign: 'right' }}>Total Revenue (Rs.)</th>
                    <th style={{ textAlign: 'right' }}>% Share</th>
                  </tr>
                </thead>
                <tbody>
                  {bankRevenue.map(b => {
                    const share = totalMonthlyRevenue > 0 ? ((b.total / totalMonthlyRevenue) * 100).toFixed(1) : '0.0'
                    return (
                      <tr key={b.bank}>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          🏛 {b.bank}
                        </td>
                        <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                          {b.count} slips
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                          Rs. {b.total.toLocaleString()}
                        </td>
                        <td style={{ textAlign: 'right', fontSize: 12, color: 'var(--accent-blue)', fontWeight: 600 }}>
                          {share}%
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="glass-card" style={{ padding: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Layers size={18} style={{ color: 'var(--accent-blue)' }} />
                Payment Channels &amp; Types
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {methodRevenue.map(m => {
                  const share = totalMonthlyRevenue > 0 ? ((m.total / totalMonthlyRevenue) * 100).toFixed(1) : '0.0'
                  return (
                    <div key={m.method} style={{ padding: 14, background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span className="badge" style={{ fontSize: 12, fontWeight: 700, background: 'rgba(59,130,246,0.1)', color: 'var(--accent-blue)' }}>
                          {m.method}
                        </span>
                        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                          Rs. {m.total.toLocaleString()}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
                        <span>{m.count} payments processed</span>
                        <span>{share}% of month</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 3: MONTHLY ADMISSIONS */}
      {monthlySubTab === 'registrations' && (
        <div className="fade-in">
          {/* Grade Breakdown Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
            <div className="stat-card" style={{ padding: '12px 14px', borderLeft: '4px solid #38bdf8' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total New</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{newStudents.length}</div>
            </div>
            {[5, 6, 7, 8, 9, 10, 11, 12, 13].map(g => (
              <div key={g} className="stat-card" style={{ padding: '12px 14px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Grade {g}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: (gradeStats[g] || 0) > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  {gradeStats[g] || 0}
                </div>
              </div>
            ))}
          </div>

          <div className="glass-card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={16} style={{ color: 'var(--accent-blue)' }} />
                New Registered Students in {MONTH_NAMES[month - 1]} {year} ({filteredNewStudents.length} Records)
              </div>
              <div style={{ width: 240 }}>
                <input
                  className="search-bar"
                  placeholder="Search PS code or name..."
                  value={searchStu}
                  onChange={e => setSearchStu(e.target.value)}
                />
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>PS Code</th>
                    <th>Student / Child Name</th>
                    <th>Grade</th>
                    <th>Enrolled Classes</th>
                    <th>Parent Contact &amp; Delivery Address</th>
                    <th>Registered On</th>
                    <th>Registered By</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredNewStudents.map(s => (
                    <tr key={s.id}>
                      <td>
                        <a
                          href={`/students/${encodeURIComponent(s.ps_code)}`}
                          style={{ color: 'var(--accent-blue)', fontWeight: 700, textDecoration: 'none', letterSpacing: 0.5 }}
                        >
                          {s.ps_code}
                        </a>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {s.full_name || '—'}
                      </td>
                      <td>
                        <span className="badge" style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--accent-blue)' }}>
                          Grade {s.grade || '?'}
                        </span>
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {(s.enrollments || []).length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {(s.enrollments || []).map((e: any) => (
                              <span key={e.id} style={{ color: 'var(--text-secondary)' }}>
                              • {courseLabels[e.class_type] || CLASS_LABELS[e.class_type] || e.class_type}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>No active classes</span>
                        )}
                      </td>
                      <td>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {s.household?.parent_name || '—'}
                        </div>
                        {s.household?.parent_phone && (
                          <div style={{ fontSize: 11, color: 'var(--accent-blue)' }}>📞 {s.household.parent_phone}</div>
                        )}
                        {s.household?.address && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            📍 {s.household.address}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
                        {s.created_by || 'Admin / System'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredNewStudents.length === 0 && (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                <Users size={32} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
                <div>No new student registrations recorded in {MONTH_NAMES[month - 1]} {year}.</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
