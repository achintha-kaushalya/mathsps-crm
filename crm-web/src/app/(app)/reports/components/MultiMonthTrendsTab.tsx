'use client'

import {
  LineChart as LineChartIcon,
  TrendingUp,
  FileSpreadsheet
} from 'lucide-react'
import { MONTH_NAMES } from '@/lib/types'
import { exportTableToCsv, GRADE_COLOR_MAP } from '@/lib/reports-analytics'

interface MultiMonthTrendsTabProps {
  trendYear: number
  setTrendYear: (y: number) => void
  trendMetric: 'students' | 'revenue' | 'registrations'
  setTrendMetric: (m: 'students' | 'revenue' | 'registrations') => void
  selectedTrendMonths: number[]
  setSelectedTrendMonths: (m: number[]) => void
  activeTrendGrades: number[]
  setActiveTrendGrades: (g: number[]) => void
  trendHoverPoint: { month: number; grade: number; value: number; x: number; y: number } | null
  setTrendHoverPoint: (p: { month: number; grade: number; value: number; x: number; y: number } | null) => void
  trendMonthlySeries: {
    month: number
    monthName: string
    studentCountsByGrade: Record<number, number>
    revenueByGrade: Record<number, number>
    regByGrade: Record<number, number>
  }[]
  trendMoMTable: any[]
  chartMaxVal: number
  svgWidth: number
  svgHeight: number
  padLeft: number
  padRight: number
  padTop: number
  padBottom: number
  plotWidth: number
  plotHeight: number
}

export default function MultiMonthTrendsTab({
  trendYear,
  setTrendYear,
  trendMetric,
  setTrendMetric,
  selectedTrendMonths,
  setSelectedTrendMonths,
  activeTrendGrades,
  setActiveTrendGrades,
  trendHoverPoint,
  setTrendHoverPoint,
  trendMonthlySeries,
  trendMoMTable,
  chartMaxVal,
  svgWidth,
  svgHeight,
  padLeft,
  padRight,
  padTop,
  padBottom,
  plotWidth,
  plotHeight
}: MultiMonthTrendsTabProps) {
  const gradeColorMap = GRADE_COLOR_MAP

  return (
    <div className="fade-in">
      {/* Control & Filter Dashboard */}
      <div className="glass-card" style={{ padding: 18, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Year selector */}
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                Analysis Year
              </label>
              <select
                className="input-field"
                style={{ width: 110 }}
                value={trendYear}
                onChange={e => setTrendYear(parseInt(e.target.value))}
              >
                {[2024, 2025, 2026, 2027].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Metric Switcher */}
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                Chart Metric
              </label>
              <div style={{ display: 'flex', gap: 4, background: 'var(--bg-base)', padding: 4, borderRadius: 8, border: '1px solid var(--border)' }}>
                <button
                  type="button"
                  onClick={() => setTrendMetric('students')}
                  style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 700,
                    borderRadius: 6,
                    border: 'none',
                    cursor: 'pointer',
                    background: trendMetric === 'students' ? 'var(--accent-blue)' : 'transparent',
                    color: trendMetric === 'students' ? '#fff' : 'var(--text-muted)'
                  }}
                >
                  👥 Active Paying Students
                </button>
                <button
                  type="button"
                  onClick={() => setTrendMetric('revenue')}
                  style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 700,
                    borderRadius: 6,
                    border: 'none',
                    cursor: 'pointer',
                    background: trendMetric === 'revenue' ? '#10b981' : 'transparent',
                    color: trendMetric === 'revenue' ? '#fff' : 'var(--text-muted)'
                  }}
                >
                  💰 Total Revenue (Rs.)
                </button>
                <button
                  type="button"
                  onClick={() => setTrendMetric('registrations')}
                  style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 700,
                    borderRadius: 6,
                    border: 'none',
                    cursor: 'pointer',
                    background: trendMetric === 'registrations' ? '#8b5cf6' : 'transparent',
                    color: trendMetric === 'registrations' ? '#fff' : 'var(--text-muted)'
                  }}
                >
                  ✨ New Registrations
                </button>
              </div>
            </div>
          </div>

          {/* Quick Multi-Month Preset Range Buttons */}
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
              Quick Month Presets
            </label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setSelectedTrendMonths([6, 7, 8])}
                className="btn-secondary"
                style={{ padding: '5px 10px', fontSize: 12 }}
              >
                Last 3 Months (Jun-Aug)
              </button>
              <button
                type="button"
                onClick={() => setSelectedTrendMonths([3, 4, 5, 6, 7, 8])}
                className="btn-secondary"
                style={{ padding: '5px 10px', fontSize: 12 }}
              >
                Last 6 Months (Mar-Aug)
              </button>
              <button
                type="button"
                onClick={() => setSelectedTrendMonths([1, 2, 3, 4, 5, 6, 7, 8])}
                className="btn-secondary"
                style={{ padding: '5px 10px', fontSize: 12 }}
              >
                YTD (Jan–Aug)
              </button>
              <button
                type="button"
                onClick={() => setSelectedTrendMonths([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])}
                className="btn-secondary"
                style={{ padding: '5px 10px', fontSize: 12 }}
              >
                All 12 Months
              </button>
            </div>
          </div>
        </div>

        {/* Multi-Month Interactive Checkboxes */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
            Select Individual Months to Include ({selectedTrendMonths.length} Selected):
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {MONTH_NAMES.map((mName, idx) => {
              const mNum = idx + 1
              const isSelected = selectedTrendMonths.includes(mNum)
              return (
                <button
                  key={mNum}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      if (selectedTrendMonths.length > 1) {
                        setSelectedTrendMonths(selectedTrendMonths.filter(m => m !== mNum))
                      }
                    } else {
                      setSelectedTrendMonths([...selectedTrendMonths, mNum])
                    }
                  }}
                  style={{
                    padding: '4px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 20,
                    border: isSelected ? '1px solid var(--accent-blue)' : '1px solid var(--border)',
                    background: isSelected ? 'rgba(59,130,246,0.15)' : 'var(--bg-base)',
                    color: isSelected ? 'var(--accent-blue)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  {isSelected ? '✓ ' : ''}{mName.slice(0, 3)}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Top KPI Metrics Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
        {/* Peak Month */}
        {(() => {
          let peakItem = trendMonthlySeries[0]
          trendMonthlySeries.forEach(item => {
            let v = 0
            if (trendMetric === 'students') v = item.studentCountsByGrade[0]
            else if (trendMetric === 'revenue') v = item.revenueByGrade[0]
            else v = item.regByGrade[0]

            let peakV = 0
            if (trendMetric === 'students') peakV = peakItem?.studentCountsByGrade[0] || 0
            else if (trendMetric === 'revenue') peakV = peakItem?.revenueByGrade[0] || 0
            else peakV = peakItem?.regByGrade[0] || 0

            if (v > peakV) peakItem = item
          })

          return (
            <div className="stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
              <div className="stat-card label">Highest Performing Month</div>
              <div className="stat-card value" style={{ color: '#3b82f6', fontSize: 22 }}>
                {peakItem?.monthName || '—'} {trendYear}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                {trendMetric === 'students' && `${peakItem?.studentCountsByGrade[0] || 0} Students`}
                {trendMetric === 'revenue' && `Rs. ${(peakItem?.revenueByGrade[0] || 0).toLocaleString()}`}
                {trendMetric === 'registrations' && `${peakItem?.regByGrade[0] || 0} New Registrations`}
              </div>
            </div>
          )
        })()}

        {/* Latest Month In Series */}
        {(() => {
          const latest = trendMonthlySeries[trendMonthlySeries.length - 1]
          return (
            <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
              <div className="stat-card label">Latest Selected Month ({latest?.monthName || '—'})</div>
              <div className="stat-card value" style={{ color: '#10b981', fontSize: 22 }}>
                {trendMetric === 'students' && `${latest?.studentCountsByGrade[0] || 0} Students`}
                {trendMetric === 'revenue' && `Rs. ${(latest?.revenueByGrade[0] || 0).toLocaleString()}`}
                {trendMetric === 'registrations' && `${latest?.regByGrade[0] || 0} New Registrations`}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Active Grade 6–11 pool
              </div>
            </div>
          )
        })()}

        {/* Average Monthly Volume */}
        {(() => {
          const total = trendMonthlySeries.reduce((sum, item) => {
            if (trendMetric === 'students') return sum + item.studentCountsByGrade[0]
            if (trendMetric === 'revenue') return sum + item.revenueByGrade[0]
            return sum + item.regByGrade[0]
          }, 0)
          const avg = trendMonthlySeries.length > 0 ? Math.round(total / trendMonthlySeries.length) : 0

          return (
            <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
              <div className="stat-card label">Selected Average / Month</div>
              <div className="stat-card value" style={{ color: '#f59e0b', fontSize: 22 }}>
                {trendMetric === 'revenue' ? `Rs. ${avg.toLocaleString()}` : `${avg.toLocaleString()} / Mo`}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Across {trendMonthlySeries.length} selected months
              </div>
            </div>
          )
        })()}

        {/* Total Accumulated in Range */}
        {(() => {
          const totalRev = trendMonthlySeries.reduce((sum, item) => sum + item.revenueByGrade[0], 0)
          const totalReg = trendMonthlySeries.reduce((sum, item) => sum + item.regByGrade[0], 0)

          return (
            <div className="stat-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
              <div className="stat-card label">Total Cumulative in Range</div>
              <div className="stat-card value" style={{ color: '#8b5cf6', fontSize: 22 }}>
                {trendMetric === 'revenue'
                  ? `Rs. ${totalRev.toLocaleString()}`
                  : trendMetric === 'registrations'
                  ? `${totalReg} Total Regs`
                  : `Rs. ${totalRev.toLocaleString()}`}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Aggregated revenue &amp; momentum
              </div>
            </div>
          )
        })()}
      </div>

      {/* Interactive SVG Multi-Line Chart Card */}
      <div className="glass-card" style={{ padding: 22, marginBottom: 20, position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <LineChartIcon size={18} style={{ color: 'var(--accent-blue)' }} />
              Multi-Month Trend Line Chart ({trendYear})
            </h2>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Click badges below to toggle Total or Grade-specific trajectory lines
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                if (activeTrendGrades.length === 7) {
                  setActiveTrendGrades([0])
                } else {
                  setActiveTrendGrades([0, 6, 7, 8, 9, 10, 11])
                }
              }}
              className="btn-secondary"
              style={{ padding: '4px 10px', fontSize: 11 }}
            >
              {activeTrendGrades.length === 7 ? 'Show Total Only' : 'Show All Grades'}
            </button>
          </div>
        </div>

        {/* Interactive Grade Toggles Badges */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Toggle Lines:</span>
          {[0, 6, 7, 8, 9, 10, 11].map(g => {
            const isActive = activeTrendGrades.includes(g)
            const meta = gradeColorMap[g]
            return (
              <button
                key={g}
                type="button"
                onClick={() => {
                  if (isActive) {
                    if (activeTrendGrades.length > 1) {
                      setActiveTrendGrades(activeTrendGrades.filter(x => x !== g))
                    }
                  } else {
                    setActiveTrendGrades([...activeTrendGrades, g])
                  }
                }}
                style={{
                  padding: '4px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  borderRadius: 16,
                  border: `1px solid ${isActive ? meta.stroke : 'var(--border)'}`,
                  background: isActive ? meta.fill : 'var(--bg-base)',
                  color: isActive ? meta.stroke : 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  opacity: isActive ? 1 : 0.6,
                  transition: 'all 0.15s'
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.stroke }} />
                {meta.name}
              </button>
            )
          })}
        </div>

        {/* Responsive SVG Chart Container */}
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            style={{ width: '100%', minWidth: 600, height: 'auto', overflow: 'visible' }}
          >
            {/* Grid Lines & Y-Axis Labels (5 levels) */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
              const y = padTop + plotHeight * (1 - ratio)
              const val = Math.round(chartMaxVal * ratio)
              return (
                <g key={idx}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={padLeft + plotWidth}
                    y2={y}
                    stroke="var(--border)"
                    strokeDasharray="4 4"
                    strokeWidth={1}
                  />
                  <text
                    x={padLeft - 10}
                    y={y + 4}
                    fill="var(--text-muted)"
                    fontSize={11}
                    textAnchor="end"
                    fontFamily="sans-serif"
                  >
                    {trendMetric === 'revenue'
                      ? val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val
                      : val}
                  </text>
                </g>
              )
            })}

            {/* X-Axis Month Labels */}
            {trendMonthlySeries.map((mItem, idx) => {
              const x =
                trendMonthlySeries.length > 1
                  ? padLeft + (idx / (trendMonthlySeries.length - 1)) * plotWidth
                  : padLeft + plotWidth / 2

              return (
                <g key={mItem.month}>
                  <line
                    x1={x}
                    y1={padTop + plotHeight}
                    x2={x}
                    y2={padTop + plotHeight + 6}
                    stroke="var(--text-muted)"
                    strokeWidth={1}
                  />
                  <text
                    x={x}
                    y={padTop + plotHeight + 22}
                    fill="var(--text-primary)"
                    fontSize={12}
                    fontWeight={600}
                    textAnchor="middle"
                    fontFamily="sans-serif"
                  >
                    {mItem.monthName.slice(0, 3)}
                  </text>
                </g>
              )
            })}

            {/* Draw Trajectory Lines for Active Grades */}
            {activeTrendGrades.map(g => {
              const meta = gradeColorMap[g]
              if (!meta) return null

              const points = trendMonthlySeries.map((mItem, idx) => {
                let val = 0
                if (trendMetric === 'students') val = mItem.studentCountsByGrade[g] || 0
                else if (trendMetric === 'revenue') val = mItem.revenueByGrade[g] || 0
                else val = mItem.regByGrade[g] || 0

                const x =
                  trendMonthlySeries.length > 1
                    ? padLeft + (idx / (trendMonthlySeries.length - 1)) * plotWidth
                    : padLeft + plotWidth / 2
                const y = padTop + plotHeight * (1 - Math.min(val, chartMaxVal) / chartMaxVal)

                return { x, y, val, month: mItem.month, monthName: mItem.monthName }
              })

              const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ')

              const firstP = points[0]
              const lastP = points[points.length - 1]
              const areaPath = `M ${firstP?.x},${padTop + plotHeight} ` +
                points.map(p => `L ${p.x},${p.y}`).join(' ') +
                ` L ${lastP?.x},${padTop + plotHeight} Z`

              const isTotalLine = g === 0

              return (
                <g key={g}>
                  {/* Shaded Area for Total Line */}
                  {isTotalLine && (
                    <path
                      d={areaPath}
                      fill={meta.fill}
                      opacity={0.4}
                    />
                  )}

                  {/* Line Stroke */}
                  <polyline
                    fill="none"
                    stroke={meta.stroke}
                    strokeWidth={isTotalLine ? 3.5 : 2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={polylinePoints}
                    style={{ filter: isTotalLine ? 'drop-shadow(0 2px 4px rgba(59,130,246,0.3))' : undefined }}
                  />

                  {/* Data Points / Dots */}
                  {points.map((p, pIdx) => (
                    <circle
                      key={pIdx}
                      cx={p.x}
                      cy={p.y}
                      r={isTotalLine ? 5.5 : 4}
                      fill="#fff"
                      stroke={meta.stroke}
                      strokeWidth={isTotalLine ? 3 : 2}
                      style={{ cursor: 'pointer', transition: 'r 0.15s' }}
                      onMouseEnter={() => {
                        setTrendHoverPoint({
                          month: p.month,
                          grade: g,
                          value: p.val,
                          x: p.x,
                          y: p.y
                        })
                      }}
                      onMouseLeave={() => setTrendHoverPoint(null)}
                    />
                  ))}
                </g>
              )
            })}

            {/* Hover Tooltip Overlay in SVG */}
            {trendHoverPoint && (
              <g pointerEvents="none">
                <rect
                  x={Math.min(trendHoverPoint.x - 60, svgWidth - 140)}
                  y={Math.max(trendHoverPoint.y - 45, 10)}
                  width={120}
                  height={34}
                  rx={6}
                  fill="#1e293b"
                  stroke="var(--border)"
                  strokeWidth={1}
                  style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.4))' }}
                />
                <text
                  x={Math.min(trendHoverPoint.x, svgWidth - 80)}
                  y={Math.max(trendHoverPoint.y - 28, 27)}
                  fill="#94a3b8"
                  fontSize={10}
                  fontWeight={600}
                  textAnchor="middle"
                  fontFamily="sans-serif"
                >
                  {gradeColorMap[trendHoverPoint.grade]?.name} ({MONTH_NAMES[trendHoverPoint.month - 1].slice(0, 3)})
                </text>
                <text
                  x={Math.min(trendHoverPoint.x, svgWidth - 80)}
                  y={Math.max(trendHoverPoint.y - 14, 41)}
                  fill="#ffffff"
                  fontSize={12}
                  fontWeight={800}
                  textAnchor="middle"
                  fontFamily="sans-serif"
                >
                  {trendMetric === 'revenue'
                    ? `Rs. ${trendHoverPoint.value.toLocaleString()}`
                    : `${trendHoverPoint.value} students`}
                </text>
              </g>
            )}
          </svg>
        </div>
      </div>

      {/* Month-Over-Month Detailed Growth Analytics Table */}
      <div className="glass-card" style={{ overflow: 'hidden', padding: 0, borderRadius: 12 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={16} style={{ color: '#10b981' }} />
              Month-over-Month (MoM) Grade Breakdown &amp; Growth Analysis
            </h3>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Detailed progression across Grades 6 through 11 for {trendYear}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={() => {
                const headers = ['Month', 'Gr 6', 'Gr 7', 'Gr 8', 'Gr 9', 'Gr 10', 'Gr 11', 'Total', 'MoM Delta', 'MoM Growth %']
                const rows = trendMoMTable.map(r => {
                  let grCounts = [6, 7, 8, 9, 10, 11].map(g => {
                    if (trendMetric === 'students') return r.studentCountsByGrade[g]
                    if (trendMetric === 'revenue') return r.revenueByGrade[g]
                    return r.regByGrade[g]
                  })

                  return [
                    `"${r.monthName} ${trendYear}"`,
                    ...grCounts.map(c => `"${c}"`),
                    `"${r.currentVal}"`,
                    `"${r.delta >= 0 ? '+' : ''}${r.delta}"`,
                    `"${r.pctChange !== null ? r.pctChange + '%' : '—'}"`
                  ]
                })

                exportTableToCsv(`${trendYear}_MultiMonth_Trend_Analytics`, headers, rows)
              }}
              className="btn-primary"
              style={{ background: '#10b981', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
            >
              <FileSpreadsheet size={15} /> Export Trend CSV
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
            <thead>
              <tr style={{ background: 'var(--bg-base)' }}>
                <th style={{ textAlign: 'left', padding: '12px 16px' }}>Month</th>
                <th>Gr 6</th>
                <th>Gr 7</th>
                <th>Gr 8</th>
                <th>Gr 9</th>
                <th>Gr 10</th>
                <th>Gr 11</th>
                <th style={{ fontWeight: 800, color: 'var(--accent-blue)', background: 'rgba(59,130,246,0.08)' }}>
                  {trendMetric === 'revenue' ? 'Total Revenue' : 'Total Count'}
                </th>
                <th>MoM Delta</th>
                <th>Growth %</th>
              </tr>
            </thead>
            <tbody>
              {trendMoMTable.map(row => {
                const isPositive = row.delta > 0
                const isNegative = row.delta < 0

                return (
                  <tr key={row.month} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ textAlign: 'left', fontWeight: 700, padding: '12px 16px', color: 'var(--text-primary)' }}>
                      {row.monthName} {trendYear}
                    </td>
                    <td style={{ color: '#10b981', fontWeight: 600 }}>
                      {trendMetric === 'revenue' ? `Rs. ${row.revenueByGrade[6].toLocaleString()}` : trendMetric === 'students' ? row.studentCountsByGrade[6] : row.regByGrade[6]}
                    </td>
                    <td style={{ color: '#f59e0b', fontWeight: 600 }}>
                      {trendMetric === 'revenue' ? `Rs. ${row.revenueByGrade[7].toLocaleString()}` : trendMetric === 'students' ? row.studentCountsByGrade[7] : row.regByGrade[7]}
                    </td>
                    <td style={{ color: '#ec4899', fontWeight: 600 }}>
                      {trendMetric === 'revenue' ? `Rs. ${row.revenueByGrade[8].toLocaleString()}` : trendMetric === 'students' ? row.studentCountsByGrade[8] : row.regByGrade[8]}
                    </td>
                    <td style={{ color: '#8b5cf6', fontWeight: 600 }}>
                      {trendMetric === 'revenue' ? `Rs. ${row.revenueByGrade[9].toLocaleString()}` : trendMetric === 'students' ? row.studentCountsByGrade[9] : row.regByGrade[9]}
                    </td>
                    <td style={{ color: '#06b6d4', fontWeight: 600 }}>
                      {trendMetric === 'revenue' ? `Rs. ${row.revenueByGrade[10].toLocaleString()}` : trendMetric === 'students' ? row.studentCountsByGrade[10] : row.regByGrade[10]}
                    </td>
                    <td style={{ color: '#f97316', fontWeight: 600 }}>
                      {trendMetric === 'revenue' ? `Rs. ${row.revenueByGrade[11].toLocaleString()}` : trendMetric === 'students' ? row.studentCountsByGrade[11] : row.regByGrade[11]}
                    </td>
                    <td style={{ fontWeight: 800, fontSize: 14, color: 'var(--accent-blue)', background: 'rgba(59,130,246,0.08)' }}>
                      {trendMetric === 'revenue' ? `Rs. ${row.currentVal.toLocaleString()}` : `${row.currentVal.toLocaleString()}`}
                    </td>
                    <td>
                      {row.prevVal > 0 ? (
                        <span style={{
                          color: isPositive ? '#10b981' : isNegative ? '#ef4444' : 'var(--text-muted)',
                          fontWeight: 700,
                          fontSize: 12
                        }}>
                          {isPositive ? `+${row.delta.toLocaleString()}` : row.delta.toLocaleString()}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>— (Base)</span>
                      )}
                    </td>
                    <td>
                      {row.pctChange !== null ? (
                        <span
                          className="badge"
                          style={{
                            background: isPositive ? 'rgba(16,185,129,0.15)' : isNegative ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
                            color: isPositive ? '#10b981' : isNegative ? '#ef4444' : 'var(--text-muted)',
                            fontWeight: 700,
                            fontSize: 11
                          }}
                        >
                          {isPositive ? '↗ +' : isNegative ? '↘ ' : ''}{row.pctChange}%
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                      )}
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
