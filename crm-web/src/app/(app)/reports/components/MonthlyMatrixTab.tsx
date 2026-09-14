'use client'

import { Printer, FileSpreadsheet, Building2, Users, Calendar, Layers } from 'lucide-react'
import { MONTH_NAMES, CLASS_LABELS } from '@/lib/types'
import { exportTableToCsv, TARGET_GRADES } from '@/lib/reports-analytics'

interface MonthlyMatrixTabProps {
  month: number
  setMonth: (m: number) => void
  year: number
  setYear: (y: number) => void
  monthlySubTab: 'matrix' | 'bank' | 'registrations'
  setMonthlySubTab: (tab: 'matrix' | 'bank' | 'registrations') => void
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
  setSearchStu
}: MonthlyMatrixTabProps) {
  const matrixTargetGrades = TARGET_GRADES

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
                    `"${(s.enrollments || []).map((e: any) => CLASS_LABELS[e.class_type] || e.class_type).join('; ')}"`,
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

      {/* SUB-VIEW 2: BANK REVENUE */}
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
                              • {CLASS_LABELS[e.class_type] || e.class_type}
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
