'use client'

import { Printer, FileSpreadsheet } from 'lucide-react'
import { MONTH_NAMES } from '@/lib/types'
import { exportTableToCsv, TARGET_GRADES } from '@/lib/reports-analytics'

interface MonthlyMatrixTabProps {
  month: number
  setMonth: (m: number) => void
  year: number
  setYear: (y: number) => void
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
}

export default function MonthlyMatrixTab({
  month,
  setMonth,
  year,
  setYear,
  matrixMode,
  setMatrixMode,
  cumulativeMatrixRows
}: MonthlyMatrixTabProps) {
  const matrixTargetGrades = TARGET_GRADES

  return (
    <div className="fade-in">
      {/* Filter & Export Bar */}
      <div className="glass-card" style={{ padding: 18, marginBottom: 20, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
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
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
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
            <FileSpreadsheet size={16} /> Export Excel / CSV
          </button>
        </div>
      </div>

      {/* Matrix SpreadSheet Layout */}
      <div className="glass-card" style={{ overflow: 'hidden', padding: 0, borderRadius: 12 }}>
        {/* Green Excel Header Banner */}
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
                ? 'Daily and cumulative count of new registered students across Grades 6–11'
                : 'Daily and cumulative count of students paying fees across Grades 6–11'}
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
              {/* Top Grouping Header: Date | August (Grades 6-11) | Total */}
              <tr style={{ background: '#2e7d32', color: '#fff', fontWeight: 800 }}>
                <th rowSpan={2} style={{ padding: '12px 16px', border: '1px solid #1b5e20', width: 130 }}>
                  Date
                </th>
                <th colSpan={6} style={{ padding: '8px 12px', border: '1px solid #1b5e20', fontSize: 14, letterSpacing: 1 }}>
                  {MONTH_NAMES[month - 1]} (Grades)
                </th>
                <th rowSpan={2} style={{ padding: '12px 16px', border: '1px solid #1b5e20', width: 110, background: '#1b5e20' }}>
                  Total
                </th>
              </tr>
              {/* Grade Columns Subheader */}
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
                    {/* Date Column */}
                    <td style={{
                      padding: '10px 14px',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      borderRight: '1px solid var(--border)',
                      textAlign: 'center'
                    }}>
                      {r.dateStr}
                    </td>

                    {/* Grade 6 to 11 Columns */}
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

                    {/* Cumulative Row Total Column */}
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
  )
}
