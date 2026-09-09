'use client'

import {
  Sparkles,
  Printer,
  FileSpreadsheet,
  GraduationCap,
  BookOpen,
  Users
} from 'lucide-react'
import { CLASS_LABELS } from '@/lib/types'
import { exportTableToCsv } from '@/lib/reports-analytics'

interface DayEndSummaryTabProps {
  dateRangePreset: 'today' | 'yesterday' | 'last7' | 'this_month' | 'last_month' | 'custom'
  startDate: string
  endDate: string
  setStartDate: (d: string) => void
  setEndDate: (d: string) => void
  applyDateRangePreset: (preset: 'today' | 'yesterday' | 'last7' | 'this_month' | 'last_month' | 'custom') => void
  dateFilterType: 'created_at' | 'date_paid'
  setDateFilterType: (t: 'created_at' | 'date_paid') => void
  dayEndRegisteredStudents: any[]
  dailyPayments: any[]
  totalDailyRevenue: number
  allDistinctGrades: number[]
  dayEndGradeNewMap: Record<number, number>
  dayEndGradePaidMap: Record<number, { count: number; total: number }>
  dayEndClassPaidMap: Record<string, { count: number; total: number }>
  dayEndAuditorMap: Record<string, { regCount: number; payCount: number; total: number }>
}

export default function DayEndSummaryTab({
  dateRangePreset,
  startDate,
  endDate,
  setStartDate,
  setEndDate,
  applyDateRangePreset,
  dateFilterType,
  setDateFilterType,
  dayEndRegisteredStudents,
  dailyPayments,
  totalDailyRevenue,
  allDistinctGrades,
  dayEndGradeNewMap,
  dayEndGradePaidMap,
  dayEndClassPaidMap,
  dayEndAuditorMap
}: DayEndSummaryTabProps) {
  const isSingleDay = startDate === endDate
  const periodLabel = isSingleDay ? startDate : `${startDate} to ${endDate}`

  return (
    <div className="fade-in">
      {/* Control & Date Bar */}
      <div className="glass-card" style={{ padding: 18, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            
            {/* Quick Preset Pills */}
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                Period Preset
              </label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => applyDateRangePreset('today')}
                  className={dateRangePreset === 'today' ? 'btn-primary' : 'btn-secondary'}
                  style={{ padding: '6px 12px', fontSize: 12 }}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => applyDateRangePreset('yesterday')}
                  className={dateRangePreset === 'yesterday' ? 'btn-primary' : 'btn-secondary'}
                  style={{ padding: '6px 12px', fontSize: 12 }}
                >
                  Yesterday
                </button>
                <button
                  type="button"
                  onClick={() => applyDateRangePreset('last7')}
                  className={dateRangePreset === 'last7' ? 'btn-primary' : 'btn-secondary'}
                  style={{ padding: '6px 12px', fontSize: 12 }}
                >
                  Last 7 Days
                </button>
                <button
                  type="button"
                  onClick={() => applyDateRangePreset('this_month')}
                  className={dateRangePreset === 'this_month' ? 'btn-primary' : 'btn-secondary'}
                  style={{ padding: '6px 12px', fontSize: 12 }}
                >
                  This Month
                </button>
                <button
                  type="button"
                  onClick={() => applyDateRangePreset('last_month')}
                  className={dateRangePreset === 'last_month' ? 'btn-primary' : 'btn-secondary'}
                  style={{ padding: '6px 12px', fontSize: 12 }}
                >
                  Last Month
                </button>
                <button
                  type="button"
                  onClick={() => applyDateRangePreset('custom')}
                  className={dateRangePreset === 'custom' ? 'btn-primary' : 'btn-secondary'}
                  style={{ padding: '6px 12px', fontSize: 12 }}
                >
                  Custom Range ▾
                </button>
              </div>
            </div>

            {/* Custom Date Pickers (From / To) */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                  From Date
                </label>
                <input
                  type="date"
                  className="input-field"
                  style={{ width: 145 }}
                  value={startDate}
                  onChange={e => {
                    setStartDate(e.target.value)
                    applyDateRangePreset('custom')
                  }}
                />
              </div>
              <span style={{ paddingBottom: 8, color: 'var(--text-muted)', fontWeight: 700 }}>➔</span>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                  To Date
                </label>
                <input
                  type="date"
                  className="input-field"
                  style={{ width: 145 }}
                  value={endDate}
                  onChange={e => {
                    setEndDate(e.target.value)
                    applyDateRangePreset('custom')
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                Payment Filter Mode
              </label>
              <select
                className="input-field"
                style={{ width: 170 }}
                value={dateFilterType}
                onChange={e => setDateFilterType(e.target.value as any)}
              >
                <option value="created_at">System Entry Time</option>
                <option value="date_paid">Slip Paid Date</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => window.print()}
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Printer size={16} /> Print Period Slip
            </button>

            <button
              type="button"
              onClick={() => {
                const headers = ['METRIC TYPE', 'CATEGORY / ITEM', 'STUDENTS / COUNT', 'TOTAL AMOUNT (RS)']
                const rows: string[][] = []

                // Top summary
                rows.push(['SUMMARY', 'Total New Registered Students', `${dayEndRegisteredStudents.length}`, '0'])
                rows.push(['SUMMARY', 'Total Payment Slips Processed', `${dailyPayments.length}`, `${totalDailyRevenue}`])

                // Grade wise
                allDistinctGrades.forEach(g => {
                  rows.push([
                    'GRADE WISE',
                    `Grade ${g}`,
                    `New Reg: ${dayEndGradeNewMap[g] || 0} | Paid: ${dayEndGradePaidMap[g]?.count || 0}`,
                    `${dayEndGradePaidMap[g]?.total || 0}`
                  ])
                })

                // Class wise
                Object.entries(dayEndClassPaidMap).forEach(([cls, data]) => {
                  rows.push([
                    'CLASS WISE',
                    `${CLASS_LABELS[cls] || cls}`,
                    `${data.count}`,
                    `${data.total}`
                  ])
                })

                // Staff wise
                Object.entries(dayEndAuditorMap).forEach(([who, data]) => {
                  rows.push([
                    'STAFF PERFORMANCE',
                    `${who}`,
                    `Reg: ${data.regCount} | Slips: ${data.payCount}`,
                    `${data.total}`
                  ])
                })

                exportTableToCsv(`Summary_Report_${periodLabel.replace(/[\s\:]+/g, '_')}`, headers, rows)
              }}
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <FileSpreadsheet size={16} /> Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Top KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div className="stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div className="stat-card label">New Registered Students ({isSingleDay ? 'Today' : 'Period'})</div>
          <div className="stat-card value" style={{ color: '#3b82f6', fontSize: 26 }}>
            {dayEndRegisteredStudents.length} Students
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Added into CRM during {periodLabel}
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="stat-card label">Payment Slips Processed</div>
          <div className="stat-card value" style={{ color: '#10b981', fontSize: 26 }}>
            {dailyPayments.length} Slips
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Verified &amp; audited payments
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="stat-card label">Total Collections ({isSingleDay ? 'Day-End' : 'Period'})</div>
          <div className="stat-card value" style={{ color: '#f59e0b', fontSize: 26 }}>
            Rs. {totalDailyRevenue.toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Total collected across {periodLabel}
          </div>
        </div>
      </div>

      {/* Section 1: Grade-Wise Registration & Payment Breakdown Matrix */}
      <div className="glass-card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <GraduationCap size={20} style={{ color: 'var(--accent-blue)' }} />
          1. Grade-Wise Registration &amp; Payment Matrix ({periodLabel})
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 140 }}>Grade Level</th>
                <th style={{ textAlign: 'center' }}>New Registrations</th>
                <th style={{ textAlign: 'center' }}>Students Paid / Slips</th>
                <th style={{ textAlign: 'right' }}>Total Collections (Rs.)</th>
                <th style={{ textAlign: 'right' }}>% Revenue Share</th>
              </tr>
            </thead>
            <tbody>
              {allDistinctGrades.map(g => {
                const newCount = dayEndGradeNewMap[g] || 0
                const paidData = dayEndGradePaidMap[g] || { count: 0, total: 0 }
                const share = totalDailyRevenue > 0 ? ((paidData.total / totalDailyRevenue) * 100).toFixed(1) : '0.0'

                return (
                  <tr key={g}>
                    <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                      Grade {g}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {newCount > 0 ? (
                        <span className="badge" style={{ background: 'rgba(59,130,246,0.15)', color: 'var(--accent-blue)', fontWeight: 700, fontSize: 12 }}>
                          {newCount} New {newCount === 1 ? 'Student' : 'Students'}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>0</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {paidData.count > 0 ? (
                        <span className="badge" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', fontWeight: 700, fontSize: 12 }}>
                          {paidData.count} {paidData.count === 1 ? 'Student' : 'Students'}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>0</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Rs. {paidData.total.toLocaleString()}
                    </td>
                    <td style={{ textAlign: 'right', fontSize: 12, color: 'var(--accent-blue)', fontWeight: 600 }}>
                      {share}%
                    </td>
                  </tr>
                )
              })}

              {/* Matrix Totals Row */}
              <tr style={{ background: 'rgba(255,255,255,0.03)', fontWeight: 800 }}>
                <td style={{ color: 'var(--text-primary)', fontSize: 14 }}>
                  TOTAL SUMMARY
                </td>
                <td style={{ textAlign: 'center', color: 'var(--accent-blue)', fontSize: 14 }}>
                  {dayEndRegisteredStudents.length} Students
                </td>
                <td style={{ textAlign: 'center', color: '#10b981', fontSize: 14 }}>
                  {dailyPayments.length} Slips
                </td>
                <td style={{ textAlign: 'right', color: '#f59e0b', fontSize: 15 }}>
                  Rs. {totalDailyRevenue.toLocaleString()}
                </td>
                <td style={{ textAlign: 'right', color: 'var(--text-primary)', fontSize: 13 }}>
                  100.0%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2 & 3: Class-Wise Breakdown & Staff Productivity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Class / Subject Breakdown */}
        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOpen size={18} style={{ color: 'var(--accent-blue)' }} />
            2. Class &amp; Subject-Wise Collections
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>Class / Subject</th>
                <th style={{ textAlign: 'center' }}>Students Paid</th>
                <th style={{ textAlign: 'right' }}>Amount (Rs.)</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(dayEndClassPaidMap).map(([cls, data]) => (
                <tr key={cls}>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {CLASS_LABELS[cls] || cls}
                  </td>
                  <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    {data.count}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Rs. {data.total.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {Object.keys(dayEndClassPaidMap).length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
              No payments recorded for {periodLabel}.
            </div>
          )}
        </div>

        {/* Staff / Registrar Breakdown */}
        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={18} style={{ color: 'var(--accent-blue)' }} />
            3. Staff / Registrar Activity ({periodLabel})
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Object.entries(dayEndAuditorMap).map(([who, data]) => (
              <div key={who} style={{ padding: 14, background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                    👤 {who}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b' }}>
                    Rs. {data.total.toLocaleString()}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
                  <span>New Registrations: <strong style={{ color: 'var(--text-primary)' }}>{data.regCount}</strong></span>
                  <span>Payment Slips: <strong style={{ color: 'var(--text-primary)' }}>{data.payCount}</strong></span>
                </div>
              </div>
            ))}

            {Object.keys(dayEndAuditorMap).length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
                No staff actions logged for {periodLabel}.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section 4: Registered Students List for the Period */}
      {dayEndRegisteredStudents.length > 0 && (
        <div className="glass-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={16} style={{ color: 'var(--accent-blue)' }} />
              New Students Registered ({periodLabel}) — {dayEndRegisteredStudents.length} Students
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>PS Code</th>
                  <th>Student Name</th>
                  <th>Grade</th>
                  <th>Parent Name &amp; Phone</th>
                  <th>Classes</th>
                  <th>Registrar</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {dayEndRegisteredStudents.map(s => (
                  <tr key={s.id}>
                    <td>
                      <a href={`/students/${encodeURIComponent(s.ps_code)}`} style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontWeight: 700 }}>
                        {s.ps_code}
                      </a>
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.full_name || '—'}</td>
                    <td>
                      <span className="badge" style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--accent-blue)' }}>
                        Grade {s.grade || '—'}
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>
                      <div>{s.household?.parent_name || '—'}</div>
                      <div style={{ color: 'var(--text-muted)' }}>{s.household?.parent_phone || '—'}</div>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {(s.enrollments || []).map((e: any) => CLASS_LABELS[e.class_type] || e.class_type).join(', ') || 'None'}
                    </td>
                    <td style={{ fontSize: 12 }}>{s.created_by || 'System'}</td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
