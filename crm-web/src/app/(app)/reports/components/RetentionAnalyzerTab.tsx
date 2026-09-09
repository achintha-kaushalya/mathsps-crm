'use client'

import {
  Printer,
  FileSpreadsheet,
  BarChart2,
  TrendingUp,
  Users,
  Search,
  Phone
} from 'lucide-react'
import { MONTH_NAMES } from '@/lib/types'
import { exportTableToCsv, sanitizePhoneForWhatsApp, TARGET_GRADES } from '@/lib/reports-analytics'

interface RetentionAnalyzerTabProps {
  month: number
  setMonth: (m: number) => void
  year: number
  setYear: (y: number) => void
  totalPrevPaid: number
  totalCurrPaid: number
  totalRetained: number
  totalDropped: number
  totalNewPaying: number
  overallRetentionRate: string
  overallChurnRate: string
  potentialLostRevenue: number
  gradeRetentionMatrix: Record<number, { prev: number; retained: number; dropped: number; newPaying: number; rate: string }>
  filteredRetentionList: any[]
  allRetentionCombined: any[]
  retentionGradeFilter: string
  setRetentionGradeFilter: (g: string) => void
  retentionStatusFilter: 'ALL' | 'RETAINED' | 'DROPPED' | 'NEW' | 'REACTIVATED'
  setRetentionStatusFilter: (s: 'ALL' | 'RETAINED' | 'DROPPED' | 'NEW' | 'REACTIVATED') => void
  searchRetention: string
  setSearchRetention: (term: string) => void
}

export default function RetentionAnalyzerTab({
  month,
  setMonth,
  year,
  setYear,
  totalPrevPaid,
  totalCurrPaid,
  totalRetained,
  totalDropped,
  totalNewPaying,
  overallRetentionRate,
  overallChurnRate,
  potentialLostRevenue,
  gradeRetentionMatrix,
  filteredRetentionList,
  allRetentionCombined,
  retentionGradeFilter,
  setRetentionGradeFilter,
  retentionStatusFilter,
  setRetentionStatusFilter,
  searchRetention,
  setSearchRetention
}: RetentionAnalyzerTabProps) {
  const matrixTargetGrades = TARGET_GRADES

  return (
    <div className="fade-in">
      {/* Filter & Export Bar */}
      <div className="glass-card" style={{ padding: 18, marginBottom: 20, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
              Current Month
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

          <div style={{ padding: '8px 14px', background: 'rgba(139,92,246,0.1)', borderRadius: 8, border: '1px solid rgba(139,92,246,0.2)' }}>
            <div style={{ fontSize: 11, color: '#a78bfa', fontWeight: 600 }}>Comparing Baseline:</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              {MONTH_NAMES[month === 1 ? 11 : month - 2]} {month === 1 ? year - 1 : year} ➡️ {MONTH_NAMES[month - 1]} {year}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => window.print()}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Printer size={16} /> Print Retention Report
          </button>

          <button
            type="button"
            onClick={() => {
              const headers = ['PS CODE', 'STUDENT NAME', 'GRADE', 'STATUS', 'LAST MONTH AMOUNT', 'CURRENT MONTH AMOUNT', 'PARENT NAME', 'PARENT PHONE', 'ADDRESS']
              const rows = filteredRetentionList.map(s => [
                `"${s.ps_code}"`,
                `"${(s.full_name || '').replace(/"/g, '""')}"`,
                `"Grade ${s.grade || '?'}"`,
                `"${s.status}"`,
                `"${s.last_amount || 0}"`,
                `"${s.curr_amount || 0}"`,
                `"${(s.parent_name || '').replace(/"/g, '""')}"`,
                `"${(s.parent_phone || '').replace(/"/g, '""')}"`,
                `"${(s.address || '').replace(/"/g, '""')}"`
              ])
              exportTableToCsv(`Retention_Analysis_${MONTH_NAMES[month - 1]}_${year}`, headers, rows)
            }}
            className="btn-primary"
            style={{ background: '#8b5cf6', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <FileSpreadsheet size={16} /> Export Follow-Up List (CSV)
          </button>
        </div>
      </div>

      {/* Top 4 KPI Executive Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div className="stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div className="stat-card label">Paid Last Month ({MONTH_NAMES[month === 1 ? 11 : month - 2]})</div>
          <div className="stat-card value" style={{ color: '#3b82f6', fontSize: 24 }}>
            {totalPrevPaid} Students
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Baseline cohort paying pool</div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="stat-card label">🟢 Retained This Month</div>
          <div className="stat-card value" style={{ color: '#10b981', fontSize: 24 }}>
            {totalRetained} Students
            <span style={{ fontSize: 14, fontWeight: 600, marginLeft: 8, color: '#10b981' }}>
              ({overallRetentionRate}%)
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Paid both last &amp; this month</div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #ef4444' }}>
          <div className="stat-card label">🔴 Dropped / Unpaid (Churn)</div>
          <div className="stat-card value" style={{ color: '#ef4444', fontSize: 24 }}>
            {totalDropped} Students
            <span style={{ fontSize: 14, fontWeight: 600, marginLeft: 8, color: '#ef4444' }}>
              ({overallChurnRate}%)
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Est. revenue at risk: Rs. {potentialLostRevenue.toLocaleString()}
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="stat-card label">🔵 New Paying Students</div>
          <div className="stat-card value" style={{ color: '#f59e0b', fontSize: 24 }}>
            +{totalNewPaying} Students
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Net Student Change: <strong style={{ color: totalCurrPaid >= totalPrevPaid ? '#10b981' : '#ef4444' }}>
              {totalCurrPaid >= totalPrevPaid ? `+${totalCurrPaid - totalPrevPaid}` : `${totalCurrPaid - totalPrevPaid}`} Students
            </strong>
          </div>
        </div>
      </div>

      {/* VISUAL CHARTS SECTION */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Chart 1: Grade-Wise Retention vs Drop-off Progress Bars */}
        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart2 size={18} style={{ color: 'var(--accent-blue)' }} />
            Grade-Wise Student Retention &amp; Churn Bars
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {matrixTargetGrades.map(g => {
              const row = gradeRetentionMatrix[g] || { prev: 0, retained: 0, dropped: 0, newPaying: 0, rate: '0.0' }
              const rateNum = parseFloat(row.rate) || 0

              return (
                <div key={g} style={{ padding: '10px 14px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                      Grade {g}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: rateNum >= 90 ? '#10b981' : rateNum >= 75 ? '#f59e0b' : '#ef4444' }}>
                      {row.rate}% Retained ({row.retained}/{row.prev})
                    </span>
                  </div>

                  {/* Stacked Visual Bar */}
                  <div style={{ height: 10, width: '100%', background: 'rgba(255,255,255,0.08)', borderRadius: 6, overflow: 'hidden', display: 'flex' }}>
                    <div
                      style={{
                        width: `${rateNum}%`,
                        background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                        borderRadius: '6px 0 0 6px',
                        transition: 'width 0.5s'
                      }}
                      title={`Retained: ${row.retained}`}
                    />
                    <div
                      style={{
                        width: `${100 - rateNum}%`,
                        background: '#ef4444',
                        borderRadius: '0 6px 6px 0',
                        transition: 'width 0.5s'
                      }}
                      title={`Dropped: ${row.dropped}`}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                    <span>🟢 Retained: <strong style={{ color: '#10b981' }}>{row.retained}</strong></span>
                    <span>🔴 Unpaid / Dropped: <strong style={{ color: '#ef4444' }}>{row.dropped}</strong></span>
                    <span>🔵 New Inflow: <strong style={{ color: 'var(--accent-blue)' }}>+{row.newPaying}</strong></span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Chart 2: Retention Gauge & Flow Summary */}
        <div className="glass-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={18} style={{ color: '#10b981' }} />
              Cohort Flow &amp; Institute Retention Gauge
            </div>

            {/* Circular Gauge Representation */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px 0',
              background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)'
            }}>
              <div style={{
                width: 130,
                height: 130,
                borderRadius: '50%',
                border: '8px solid #10b981',
                borderTopColor: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                transform: 'rotate(-45deg)'
              }}>
                <div style={{ transform: 'rotate(45deg)', textAlign: 'center' }}>
                  <div style={{ fontSize: 26, fontWeight: 800, color: '#10b981' }}>
                    {overallRetentionRate}%
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Retention
                  </div>
                </div>
              </div>
            </div>

            {/* Flow Summary Legend */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(16,185,129,0.08)', borderRadius: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#10b981' }}>🟢 Retained Students</span>
                <strong style={{ color: 'var(--text-primary)' }}>{totalRetained}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#ef4444' }}>🔴 Churned / Dropped</span>
                <strong style={{ color: 'var(--text-primary)' }}>{totalDropped}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(59,130,246,0.08)', borderRadius: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-blue)' }}>🔵 New Inflow</span>
                <strong style={{ color: 'var(--text-primary)' }}>+{totalNewPaying}</strong>
              </div>
            </div>
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 14, textAlign: 'center' }}>
            Target Benchmark: <strong style={{ color: '#10b981' }}>&gt;85% Retention</strong> | Call dropped students within the first 10 days to maximize recovery.
          </div>
        </div>
      </div>

      {/* ACTIONABLE STUDENT LIST & CALL CENTER FOLLOW-UP TABLE */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={16} style={{ color: 'var(--accent-blue)' }} />
            Actionable Student List ({filteredRetentionList.length} Students)
          </div>

          {/* Sub Filters: Status + Grade + Search */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Status Pills */}
            <div style={{ display: 'flex', gap: 4, background: 'var(--bg-base)', padding: 3, borderRadius: 8, border: '1px solid var(--border)' }}>
              <button
                type="button"
                onClick={() => setRetentionStatusFilter('DROPPED')}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  background: retentionStatusFilter === 'DROPPED' ? '#ef4444' : 'transparent',
                  color: retentionStatusFilter === 'DROPPED' ? '#fff' : 'var(--text-muted)'
                }}
              >
                🔴 Unpaid / Dropped ({totalDropped})
              </button>
              <button
                type="button"
                onClick={() => setRetentionStatusFilter('RETAINED')}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  background: retentionStatusFilter === 'RETAINED' ? '#10b981' : 'transparent',
                  color: retentionStatusFilter === 'RETAINED' ? '#fff' : 'var(--text-muted)'
                }}
              >
                🟢 Retained ({totalRetained})
              </button>
              <button
                type="button"
                onClick={() => setRetentionStatusFilter('NEW')}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  background: retentionStatusFilter === 'NEW' ? 'var(--accent-blue)' : 'transparent',
                  color: retentionStatusFilter === 'NEW' ? '#fff' : 'var(--text-muted)'
                }}
              >
                🔵 New Inflow ({totalNewPaying})
              </button>
              <button
                type="button"
                onClick={() => setRetentionStatusFilter('ALL')}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  background: retentionStatusFilter === 'ALL' ? 'var(--text-primary)' : 'transparent',
                  color: retentionStatusFilter === 'ALL' ? 'var(--bg-base)' : 'var(--text-muted)'
                }}
              >
                All ({allRetentionCombined.length})
              </button>
            </div>

            {/* Grade Filter */}
            <select
              className="input-field"
              style={{ width: 110, padding: '4px 8px', fontSize: 12 }}
              value={retentionGradeFilter}
              onChange={e => setRetentionGradeFilter(e.target.value)}
            >
              <option value="ALL">All Grades</option>
              {[5, 6, 7, 8, 9, 10, 11].map(g => (
                <option key={g} value={String(g)}>Grade {g}</option>
              ))}
            </select>

            {/* Search Input */}
            <div style={{ position: 'relative', width: 200 }}>
              <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="input-field"
                style={{ paddingLeft: 26, paddingRight: 8, paddingBottom: 4, paddingTop: 4, fontSize: 12, width: '100%' }}
                placeholder="Search PS, Name, Phone..."
                value={searchRetention}
                onChange={e => setSearchRetention(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Data Table with Direct WhatsApp / Call Links */}
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>PS Code</th>
                <th>Student Name</th>
                <th>Grade</th>
                <th>Status</th>
                <th>Last Month Fee</th>
                <th>This Month Fee</th>
                <th>Parent Contact</th>
                <th>Direct Follow-Up</th>
              </tr>
            </thead>
            <tbody>
              {filteredRetentionList.map(s => {
                const waPhone = sanitizePhoneForWhatsApp(s.parent_phone)

                return (
                  <tr key={`${s.ps_code}-${s.status}`}>
                    <td>
                      <a href={`/students/${encodeURIComponent(s.ps_code)}`} style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontWeight: 700 }}>
                        {s.ps_code}
                      </a>
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {s.full_name || '—'}
                    </td>
                    <td>
                      <span className="badge" style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--accent-blue)' }}>
                        Grade {s.grade || '—'}
                      </span>
                    </td>
                    <td>
                      {s.status === 'DROPPED' && (
                        <span className="badge" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontWeight: 700 }}>
                          🔴 Unpaid / Dropped
                        </span>
                      )}
                      {s.status === 'RETAINED' && (
                        <span className="badge" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', fontWeight: 700 }}>
                          🟢 Paid &amp; Retained
                        </span>
                      )}
                      {s.status === 'NEW' && (
                        <span className="badge" style={{ background: 'rgba(59,130,246,0.15)', color: 'var(--accent-blue)', fontWeight: 700 }}>
                          🔵 New Inflow
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {s.last_amount ? (
                        <span>Rs. {s.last_amount.toLocaleString()}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12, fontWeight: s.curr_amount ? 700 : 400, color: s.curr_amount ? '#10b981' : 'var(--text-muted)' }}>
                      {s.curr_amount ? `Rs. ${s.curr_amount.toLocaleString()}` : 'Not Paid Yet'}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      <div>{s.parent_name || '—'}</div>
                      <div style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>{s.parent_phone || '—'}</div>
                    </td>
                    <td>
                      {s.parent_phone ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <a
                            href={`tel:${s.parent_phone}`}
                            className="btn-secondary"
                            style={{ padding: '4px 8px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
                            title="Call Parent"
                          >
                            <Phone size={12} /> Call
                          </a>
                          <a
                            href={`https://wa.me/${waPhone}?text=${encodeURIComponent(`Hello ${s.parent_name || 'Parent'}, regarding ${s.full_name || 'student'}'s (${s.ps_code}) Maths class registration for ${MONTH_NAMES[month - 1]} ${year}. Please let us know if you need assistance with class fees.`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-primary"
                            style={{ padding: '4px 8px', fontSize: 11, background: '#25D366', color: '#fff', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
                            title="Send WhatsApp Follow-Up"
                          >
                            💬 WhatsApp
                          </a>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>No phone</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {filteredRetentionList.length === 0 && (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
            No students match the selected retention filters.
          </div>
        )}
      </div>
    </div>
  )
}
