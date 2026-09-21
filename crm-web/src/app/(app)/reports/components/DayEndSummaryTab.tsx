'use client'

import {
  Sparkles,
  Printer,
  FileSpreadsheet,
  GraduationCap,
  BookOpen,
  Users,
  ShieldCheck,
  Search,
  CheckCircle2,
  Clock,
  Package
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
  dailySubTab: 'matrix' | 'ledger' | 'staff'
  setDailySubTab: (tab: 'matrix' | 'ledger' | 'staff') => void
  dayEndRegisteredStudents: any[]
  dailyPayments: any[]
  filteredDailyPayments: any[]
  auditorFilter: string
  setAuditorFilter: (a: string) => void
  auditorStats: Record<string, { count: number; total: number }>
  bankFilter: string
  setBankFilter: (b: string) => void
  searchAudit: string
  setSearchAudit: (s: string) => void
  totalDailyRevenue: number
  allDistinctGrades: number[]
  dayEndGradeNewMap: Record<number, number>
  dayEndGradePaidMap: Record<number, { count: number; total: number }>
  dayEndClassPaidMap: Record<string, { count: number; total: number }>
  dayEndAuditorMap: Record<string, { regCount: number; payCount: number; total: number }>
  courseLabels?: Record<string, string>
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
  dailySubTab,
  setDailySubTab,
  dayEndRegisteredStudents,
  dailyPayments,
  filteredDailyPayments,
  auditorFilter,
  setAuditorFilter,
  auditorStats,
  bankFilter,
  setBankFilter,
  searchAudit,
  setSearchAudit,
  totalDailyRevenue,
  allDistinctGrades,
  dayEndGradeNewMap,
  dayEndGradePaidMap,
  dayEndClassPaidMap,
  dayEndAuditorMap,
  courseLabels = {}
}: DayEndSummaryTabProps) {
  const isSingleDay = startDate === endDate
  const periodLabel = isSingleDay ? startDate : `${startDate} to ${endDate}`

  return (
    <div className="fade-in">
      {/* Control & Date Bar */}
      <div className="glass-card" style={{ padding: 18, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14 }}>
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

            {/* Date Pickers (From / To) */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                  From
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
                  To
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
                    `${courseLabels[cls] || CLASS_LABELS[cls] || cls}`,
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

        {/* Sub-view Segmented Switcher */}
        <div style={{ display: 'flex', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 14, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setDailySubTab('matrix')}
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
              background: dailySubTab === 'matrix' ? 'var(--accent-blue)' : 'var(--bg-base)',
              color: dailySubTab === 'matrix' ? '#fff' : 'var(--text-secondary)'
            }}
          >
            <GraduationCap size={15} />
            Grade &amp; Class Matrix
          </button>

          <button
            type="button"
            onClick={() => setDailySubTab('ledger')}
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
              background: dailySubTab === 'ledger' ? 'var(--accent-blue)' : 'var(--bg-base)',
              color: dailySubTab === 'ledger' ? '#fff' : 'var(--text-secondary)'
            }}
          >
            <ShieldCheck size={15} />
            Audited Slips Ledger ({filteredDailyPayments.length})
          </button>

          <button
            type="button"
            onClick={() => setDailySubTab('staff')}
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
              background: dailySubTab === 'staff' ? 'var(--accent-blue)' : 'var(--bg-base)',
              color: dailySubTab === 'staff' ? '#fff' : 'var(--text-secondary)'
            }}
          >
            <Users size={15} />
            Staff Verification Matrix
          </button>
        </div>
      </div>

      {/* Top KPI Cards with Dashboard Colored Shadows & Left Borders */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div className="stat-card" style={{ borderLeft: '4px solid #38bdf8', boxShadow: '0 4px 20px -4px rgba(56, 189, 248, 0.25)' }}>
          <div className="stat-card label">New Registered Students ({isSingleDay ? 'Today' : 'Period'})</div>
          <div className="stat-card value" style={{ color: '#38bdf8', fontSize: 26 }}>
            {dayEndRegisteredStudents.length} Students
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Added into CRM during {periodLabel}
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #4ade80', boxShadow: '0 4px 20px -4px rgba(74, 222, 128, 0.25)' }}>
          <div className="stat-card label">Payment Slips Processed</div>
          <div className="stat-card value" style={{ color: '#4ade80', fontSize: 26 }}>
            {dailyPayments.length} Slips
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Verified &amp; audited payments
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #fcd34d', boxShadow: '0 4px 20px -4px rgba(245, 158, 11, 0.25)' }}>
          <div className="stat-card label">Total Collections ({isSingleDay ? 'Day-End' : 'Period'})</div>
          <div className="stat-card value" style={{ color: '#f59e0b', fontSize: 26 }}>
            Rs. {totalDailyRevenue.toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Total collected across {periodLabel}
          </div>
        </div>
      </div>

      {/* SUB-VIEW 1: GRADE & CLASS MATRIX */}
      {dailySubTab === 'matrix' && (
        <div className="fade-in">
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

          {/* Section 2: Class-Wise Breakdown */}
          <div className="glass-card" style={{ padding: 20, marginBottom: 20 }}>
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
                      {courseLabels[cls] || CLASS_LABELS[cls] || cls}
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
        </div>
      )}

      {/* SUB-VIEW 2: AUDITED SLIPS LEDGER */}
      {dailySubTab === 'ledger' && (
        <div className="fade-in">
          <div className="glass-card" style={{ padding: 18, marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                    Filter Auditor
                  </label>
                  <select
                    className="input-field"
                    style={{ width: 160 }}
                    value={auditorFilter}
                    onChange={e => setAuditorFilter(e.target.value)}
                  >
                    <option value="">All Auditors ({dailyPayments.length})</option>
                    {Object.keys(auditorStats).map(who => (
                      <option key={who} value={who}>{who} ({auditorStats[who].count})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                    Bank / Method
                  </label>
                  <select
                    className="input-field"
                    style={{ width: 160 }}
                    value={bankFilter}
                    onChange={e => setBankFilter(e.target.value)}
                  >
                    <option value="">All Banks &amp; Methods</option>
                    {Array.from(new Set(dailyPayments.map(p => p.bank_name || p.payment_type).filter(Boolean))).sort().map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => {
                    const headers = ['PS CODE', 'STUDENT NAME', 'CLASS', 'AMOUNT (RS)', 'PAYMENT TYPE', 'BANK', 'AUDITOR (RECORDED BY)', 'ENTRY DATE & TIME', 'SLIP DATE', 'DELIVERY', 'NOTES']
                    const rows = filteredDailyPayments.map(p => [
                      `"${p.students?.ps_code || ''}"`,
                      `"${(p.students?.full_name || '').replace(/"/g, '""')}"`,
                      `"${courseLabels[p.class_type] || CLASS_LABELS[p.class_type] || p.class_type}"`,
                      `"${p.amount_paid || 0}"`,
                      `"${p.payment_type || 'BANK'}"`,
                      `"${p.bank_name || ''}"`,
                      `"${p.recorded_by || 'System'}"`,
                      `"${new Date(p.created_at).toLocaleString()}"`,
                      `"${p.date_paid || ''}"`,
                      `"${(p.notes || '').includes('[DISPATCHED:') ? 'Dispatched' : p.tute_delivered ? 'Ready to Export' : 'No Delivery'}"`,
                      `"${(p.notes || '').replace(/"/g, '""')}"`
                    ])
                    const fileSuffix = startDate === endDate ? startDate : `${startDate}_to_${endDate}`
                    exportTableToCsv(`Audit_Log_${fileSuffix}`, headers, rows)
                  }}
                  className="btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <FileSpreadsheet size={16} /> Export CSV
                </button>
              </div>
            </div>

            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="input-field"
                style={{ paddingLeft: 36, width: '100%' }}
                placeholder="Search slips by PS Code, Student Name, Bank, Auditor..."
                value={searchAudit}
                onChange={e => setSearchAudit(e.target.value)}
              />
            </div>
          </div>

          <div className="glass-card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldCheck size={16} style={{ color: 'var(--accent-blue)' }} />
                Payments Logged ({periodLabel}) — {filteredDailyPayments.length} Slips
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>PS Code</th>
                    <th>Student Name</th>
                    <th>Class</th>
                    <th>Amount Paid</th>
                    <th>Method &amp; Bank</th>
                    <th>Auditor (Recorded By)</th>
                    <th>Time</th>
                    <th>Delivery / Dispatch</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDailyPayments.map(p => (
                    <tr key={p.id}>
                      <td>
                        <a href={`/students/${encodeURIComponent(p.students?.ps_code || '')}`} style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontWeight: 700 }}>
                          {p.students?.ps_code || '—'}
                        </a>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {p.students?.full_name || '—'}
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {courseLabels[p.class_type] || CLASS_LABELS[p.class_type] || p.class_type} (Gr {p.students?.grade || '?'})
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        Rs. {Number(p.amount_paid || 0).toLocaleString()}
                      </td>
                      <td>
                        <span className="badge" style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--accent-blue)' }}>
                          {p.payment_type || 'BANK'} {p.bank_name ? `(${p.bank_name})` : ''}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        🔒 {p.recorded_by || 'Admin / System'}
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ fontSize: 11 }}>
                        {(p.notes || '').includes('[DISPATCHED:') ? (
                          <span style={{ color: '#10b981', fontWeight: 600 }}>
                            ✓ Dispatched ({p.notes.match(/\[DISPATCHED:\s*([^\]]+)\]/)?.[1] || 'Batch'})
                          </span>
                        ) : p.tute_delivered ? (
                          <span style={{ color: '#f59e0b', fontWeight: 600 }}>
                            📦 Ready to Export (Pending Dispatch)
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>
                            — No Postal Delivery
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.notes ? p.notes.replace(/\[DISPATCHED:[^\]]+\]/g, '').trim() || '—' : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredDailyPayments.length === 0 && (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No payment slips found matching current filters.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 3: STAFF PRODUCTIVITY MATRIX */}
      {dailySubTab === 'staff' && (
        <div className="fade-in">
          <div className="glass-card" style={{ padding: 20, marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={18} style={{ color: 'var(--accent-blue)' }} />
              Staff / Registrar Verification Matrix ({periodLabel})
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
              {Object.entries(dayEndAuditorMap).map(([who, data]) => (
                <div key={who} style={{ padding: 16, background: 'var(--bg-base)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                      👤 {who}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b' }}>
                      Rs. {data.total.toLocaleString()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                    <span>New Registrations:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{data.regCount}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
                    <span>Payment Slips Audited:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{data.payCount}</strong>
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

          {/* Registered Students List for the Period */}
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
                          {(s.enrollments || []).map((e: any) => courseLabels[e.class_type] || CLASS_LABELS[e.class_type] || e.class_type).join(', ') || 'None'}
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
      )}
    </div>
  )
}
