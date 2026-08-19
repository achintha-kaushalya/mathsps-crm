'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Users, Phone, TrendingUp, Activity, BarChart2,
  Target, Award, Filter, RefreshCw, CheckCircle,
  Clock, XCircle, AlertCircle, CreditCard
} from 'lucide-react'
import { MONTH_NAMES } from '@/lib/types'

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

const GRADES = ['6', '7', '8', '9', '10', '11']
const GRADE_COLORS = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4']

const STATUS_GROUPS = {
  hot:       { label: 'Hot / Active',    color: '#10b981', statuses: ['Contacted','Interested','Second Call Pending','Follow-up'] },
  converted: { label: 'Converted',       color: '#3b82f6', statuses: ['Converted'] },
  new:       { label: 'New',             color: '#f59e0b', statuses: ['New'] },
  cold:      { label: 'Cold / Dead',     color: '#ef4444', statuses: ['Not Interested','Off','Invalid','Wrong number','Busy','Call Another Number','No Answer'] },
}

interface LeadRow {
  assigned_member: string | null
  grade: string | null
  status: string
  campaign: string | null
  date_added: string | null
}

const NOW = new Date()
const CUR_MONTH = NOW.getMonth() + 1
const CUR_YEAR = NOW.getFullYear()

// ──────────────────────────────────────────────────────────────
export default function AnalyticsDashboard() {
  const supabase = createClient()

  const [leads, setLeads] = useState<LeadRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filterStart, setFilterStart] = useState('')
  const [filterEnd, setFilterEnd] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  // also pull payment + student stats
  const [revenueThisMonth, setRevenueThisMonth] = useState(0)
  const [paidThisMonth, setPaidThisMonth] = useState(0)
  const [totalStudents, setTotalStudents] = useState(0)
  const [recentPayments, setRecentPayments] = useState<any[]>([])

  async function loadData() {
    setRefreshing(true)
    try {
      const [leadsRes, payRes, studRes, recRes] = await Promise.all([
        fetch('/api/leads/analytics').then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          return r.json()
        }),
        supabase.from('payments').select('amount_paid,payment_type,student_id')
          .eq('month', CUR_MONTH).eq('year', CUR_YEAR),
        supabase.from('students').select('*', { count: 'exact', head: true }),
        supabase.from('payments').select(`
          id,amount_paid,payment_type,bank_name,date_paid,recorded_by,month,year,
          students(ps_code,full_name,grade)
        `).order('created_at', { ascending: false }).limit(6),
      ])
      setLeads((leadsRes.leads || []) as LeadRow[])
      const pmts = payRes.data || []
      const rev = pmts.filter((p: any) => !['FREE','SIPSA'].includes(p.payment_type || ''))
                       .reduce((s: number, p: any) => s + (p.amount_paid || 0), 0)
      setRevenueThisMonth(rev)
      setPaidThisMonth(new Set(pmts.map((p: any) => p.student_id)).size)
      setTotalStudents(studRes.count || 0)
      setRecentPayments(recRes.data || [])
      setLastUpdated(new Date())
    } catch (e) {
      console.error('loadData error:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
    const ch = supabase.channel('analytics-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, loadData)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  // Helper to extract grades from grade string (handles "6", "6, 8", "7, 9, 11", "Grade 8", etc.)
  function extractGrades(rawGrade: string | number | null): string[] {
    if (rawGrade === null || rawGrade === undefined) return []
    const str = String(rawGrade).trim()
    if (!str) return []
    
    // Find all standalone grade numbers (6 to 11) using regex
    const matches = str.match(/\b(6|7|8|9|10|11)\b/g)
    if (matches && matches.length > 0) {
      return Array.from(new Set(matches))
    }
    
    // Fallback: check if standard grade digits are contained
    const found: string[] = []
    GRADES.forEach(g => {
      // Look for grade number separated by comma, space, slash or word boundary
      const regex = new RegExp(`(^|[^0-9])${g}([^0-9]|$)`)
      if (regex.test(str)) {
        found.push(g)
      }
    })
    return found
  }

  // Apply date filter
  const filtered = useMemo(() => {
    if (!filterStart && !filterEnd) return leads
    return leads.filter(l => {
      if (!l.date_added) return false
      const d = l.date_added.slice(0, 10)
      if (filterStart && d < filterStart) return false
      if (filterEnd   && d > filterEnd)   return false
      return true
    })
  }, [leads, filterStart, filterEnd])

  // ── Aggregations ──────────────────────────────────────────
  const totalFiltered = filtered.length

  // All distinct members (sorted by total leads desc)
  const members = useMemo(() => {
    const counts: Record<string, number> = {}
    filtered.forEach(l => {
      const m = l.assigned_member || 'Unassigned'
      counts[m] = (counts[m] || 0) + 1
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, total]) => ({ name, total }))
  }, [filtered])

  // TABLE 1: Member × Grade matrix (supports single & multiple children grades in 1 lead)
  const memberGradeMatrix = useMemo(() => {
    const matrix: Record<string, Record<string, number>> = {}
    filtered.forEach(l => {
      const m = l.assigned_member || 'Unassigned'
      if (!matrix[m]) matrix[m] = {}
      
      const gradesInLead = extractGrades(l.grade)
      if (gradesInLead.length > 0) {
        gradesInLead.forEach(g => {
          matrix[m][g] = (matrix[m][g] || 0) + 1
        })
      } else {
        matrix[m]['Other'] = (matrix[m]['Other'] || 0) + 1
      }
    })
    return matrix
  }, [filtered])

  // Grade column totals (counts every grade occurrence across all leads)
  const gradeTotals = useMemo(() => {
    const t: Record<string, number> = {}
    filtered.forEach(l => {
      const gradesInLead = extractGrades(l.grade)
      if (gradesInLead.length > 0) {
        gradesInLead.forEach(g => {
          t[g] = (t[g] || 0) + 1
        })
      } else {
        t['Other'] = (t['Other'] || 0) + 1
      }
    })
    return t
  }, [filtered])

  // Status breakdown
  const statusCounts = useMemo(() => {
    const c: Record<string, number> = {}
    filtered.forEach(l => { c[l.status] = (c[l.status] || 0) + 1 })
    return c
  }, [filtered])

  // Campaign performance
  const campaignCounts = useMemo(() => {
    const c: Record<string, number> = {}
    filtered.forEach(l => {
      const camp = l.campaign || 'No Campaign'
      c[camp] = (c[camp] || 0) + 1
    })
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [filtered])

  // Conversion rate
  const convertedCount = statusCounts['Converted'] || 0
  const conversionRate = totalFiltered > 0 ? ((convertedCount / totalFiltered) * 100).toFixed(1) : '0.0'

  const topMember = members[0]

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
        <Activity size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
        <div>Loading analytics…</div>
      </div>
    </div>
  )

  return (
    <div className="fade-in">
      {/* ── Page Header ─────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>CRM Analytics</h1>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Leads · Grades · Members · Campaigns · Conversion
            {filterStart || filterEnd
              ? ` · Filtered: ${filterStart || '∞'} → ${filterEnd || '∞'}`
              : ' · All Time'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* Date filters */}
          <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>From</label>
          <input type="date" className="input-field" value={filterStart} onChange={e => setFilterStart(e.target.value)}
            style={{ padding: '5px 10px', fontSize: 12, width: 140 }} />
          <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>To</label>
          <input type="date" className="input-field" value={filterEnd} onChange={e => setFilterEnd(e.target.value)}
            style={{ padding: '5px 10px', fontSize: 12, width: 140 }} />
          {(filterStart || filterEnd) && (
            <button className="btn-secondary" onClick={() => { setFilterStart(''); setFilterEnd('') }}
              style={{ padding: '5px 10px', fontSize: 12 }}>Clear</button>
          )}
          <button className="btn-secondary" onClick={loadData} disabled={refreshing}
            style={{ padding: '5px 10px', fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
            <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Updated {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>

      <div className="page-content">

        {/* ── KPI Cards ───────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 22 }}>
          <KpiCard icon={<Phone size={18}/>} label="Total Leads" value={totalFiltered.toLocaleString()} color="#3b82f6" />
          <KpiCard icon={<TrendingUp size={18}/>} label="Converted" value={convertedCount.toLocaleString()} color="#10b981" sub={`${conversionRate}% rate`} />
          <KpiCard icon={<Users size={18}/>} label="Total Students" value={totalStudents.toLocaleString()} color="#8b5cf6" />
          <KpiCard icon={<CheckCircle size={18}/>} label={`Paid — ${MONTH_NAMES[CUR_MONTH-1]}`} value={paidThisMonth.toLocaleString()} color="#10b981" />
          <KpiCard icon={<CreditCard size={18}/>} label="Revenue This Month" value={`Rs. ${revenueThisMonth.toLocaleString()}`} color="#f59e0b" />
        </div>

        {/* ── Status Group Cards ──────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 22 }}>
          {Object.entries(STATUS_GROUPS).map(([key, grp]) => {
            const count = grp.statuses.reduce((s, st) => s + (statusCounts[st] || 0), 0)
            const pct = totalFiltered > 0 ? ((count / totalFiltered) * 100).toFixed(1) : '0.0'
            return (
              <div key={key} className="glass-card" style={{ padding: '14px 18px', borderLeft: `3px solid ${grp.color}` }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{grp.label}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: grp.color }}>{count.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>{pct}% of all leads</div>
                <div style={{ height: 3, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: grp.color, borderRadius: 99, transition: 'width 0.6s ease' }} />
                </div>
              </div>
            )
          })}
        </div>

        {/* ── TABLE 1: Member × Grade ─────────────────────── */}
        <div className="glass-card" style={{ marginBottom: 22, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>📊 Leads by Member &amp; Grade</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Real-time lead distribution across members and grade levels</div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-hover)', padding: '4px 10px', borderRadius: 6 }}>
              {members.length} members · {totalFiltered.toLocaleString()} leads
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: 130, textAlign: 'left' }}>Member</th>
                  {GRADES.map((g, i) => (
                    <th key={g} style={{ textAlign: 'center', color: GRADE_COLORS[i] }}>Grade {g}</th>
                  ))}
                  <th style={{ textAlign: 'center', fontWeight: 700 }}>Total</th>
                  <th style={{ textAlign: 'center', fontWeight: 700 }}>Share %</th>
                  <th style={{ textAlign: 'right' }}>Conversion</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m, idx) => {
                  const row = memberGradeMatrix[m.name] || {}
                  const share = totalFiltered > 0 ? ((m.total / totalFiltered) * 100).toFixed(1) : '0.0'
                  // per-member status counts
                  const memberLeads = filtered.filter(l => (l.assigned_member || 'Unassigned') === m.name)
                  const memberConverted = memberLeads.filter(l => l.status === 'Converted').length
                  const mConvRate = m.total > 0 ? ((memberConverted / m.total) * 100).toFixed(1) : '0.0'
                  const COLORS = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4','#ec4899','#a855f7','#14b8a6','#f97316']
                  const col = COLORS[idx % COLORS.length]
                  return (
                    <tr key={m.name} style={{ borderLeft: `3px solid ${col}20` }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 26, height: 26, borderRadius: '50%',
                            background: col + '20', color: col,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 700, flexShrink: 0
                          }}>{m.name[0]?.toUpperCase()}</div>
                          <span style={{ fontWeight: 500, fontSize: 13 }}>{m.name}</span>
                        </div>
                      </td>
                      {GRADES.map((g, gi) => {
                        const count = row[g] || 0
                        return (
                          <td key={g} style={{ textAlign: 'center', fontSize: 13 }}>
                            {count > 0 ? (
                              <span style={{
                                color: GRADE_COLORS[gi],
                                fontWeight: count > 100 ? 700 : 500,
                              }}>{count.toLocaleString()}</span>
                            ) : <span style={{ color: 'var(--text-muted)', opacity: 0.4 }}>—</span>}
                          </td>
                        )
                      })}
                      <td style={{ textAlign: 'center', fontWeight: 800, color: col, fontSize: 14 }}>
                        {m.total.toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                          <span style={{ fontSize: 12, fontWeight: 600 }}>{share}%</span>
                          <div style={{ width: 60, height: 3, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                            <div style={{ width: `${share}%`, height: '100%', background: col, borderRadius: 99 }} />
                          </div>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700,
                          color: parseFloat(mConvRate) >= 5 ? '#10b981' : parseFloat(mConvRate) >= 2 ? '#f59e0b' : '#ef4444',
                          background: parseFloat(mConvRate) >= 5 ? 'rgba(16,185,129,0.1)' : parseFloat(mConvRate) >= 2 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                          padding: '2px 7px', borderRadius: 4,
                        }}>{mConvRate}%</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 800, borderTop: '2px solid var(--border)', background: 'rgba(59,130,246,0.05)' }}>
                  <td style={{ fontWeight: 700, fontSize: 12, letterSpacing: '0.05em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>TOTAL</td>
                  {GRADES.map((g, gi) => (
                    <td key={g} style={{ textAlign: 'center', fontWeight: 700, color: GRADE_COLORS[gi] }}>
                      {(gradeTotals[g] || 0).toLocaleString()}
                    </td>
                  ))}
                  <td style={{ textAlign: 'center', fontWeight: 900, color: 'var(--text-primary)', fontSize: 15 }}>
                    {totalFiltered.toLocaleString()}
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>100.0%</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>{conversionRate}%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ── Bottom 3-col grid ────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18, marginBottom: 22 }}>

          {/* Grade Distribution bars */}
          <div className="glass-card" style={{ padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>📐 Grade Distribution</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>Children &amp; leads per grade level</div>
            {(() => {
              const totalGradeCount = GRADES.reduce((sum, g) => sum + (gradeTotals[g] || 0), 0)
              return GRADES.map((g, i) => {
                const cnt = gradeTotals[g] || 0
                const pct = totalGradeCount > 0 ? (cnt / totalGradeCount) * 100 : 0
                return (
                  <div key={g} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: GRADE_COLORS[i], fontWeight: 600 }}>Grade {g}</span>
                      <span style={{ fontSize: 12, fontWeight: 700 }}>{cnt.toLocaleString()} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({pct.toFixed(1)}%)</span></span>
                    </div>
                    <div style={{ height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: GRADE_COLORS[i], borderRadius: 99, transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                )
              })
            })()}
          </div>

          {/* Lead Status Breakdown */}
          <div className="glass-card" style={{ padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>📋 Status Breakdown</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>All lead statuses ranked</div>
            <div style={{ maxHeight: 260, overflowY: 'auto' }}>
              {Object.entries(statusCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([status, count]) => {
                  const pct = totalFiltered > 0 ? (count / totalFiltered) * 100 : 0
                  const col = status === 'Converted' ? '#10b981'
                    : status === 'Interested' ? '#3b82f6'
                    : status === 'Contacted' ? '#8b5cf6'
                    : status === 'New' ? '#f59e0b'
                    : status === 'Second Call Pending' ? '#06b6d4'
                    : '#6b7280'
                  return (
                    <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: col, flexShrink: 0 }} />
                      <div style={{ fontSize: 12, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{status}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: col, width: 40, textAlign: 'right' }}>{count}</div>
                      <div style={{ width: 50, height: 4, background: 'var(--border)', borderRadius: 99, overflow: 'hidden', flexShrink: 0 }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: col, borderRadius: 99 }} />
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>

          {/* Campaign Performance */}
          <div className="glass-card" style={{ padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>🎯 Campaign Performance</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>Top campaigns by lead count</div>
            {campaignCounts.length === 0
              ? <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No campaign data</div>
              : campaignCounts.map(([camp, count], i) => {
                const pct = totalFiltered > 0 ? (count / totalFiltered) * 100 : 0
                const CAMP_COLORS = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4','#ec4899','#a855f7']
                const col = CAMP_COLORS[i % CAMP_COLORS.length]
                return (
                  <div key={camp} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{camp}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: col }}>{count}</span>
                    </div>
                    <div style={{ height: 4, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: col, borderRadius: 99, transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                )
              })}
          </div>
        </div>

        {/* ── Member Leaderboard + Recent Payments ───────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 18 }}>

          {/* Leaderboard */}
          <div className="glass-card" style={{ padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>🏆 Member Leaderboard</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>Ranked by total leads assigned</div>
            {members.slice(0, 8).map((m, i) => {
              const pct = totalFiltered > 0 ? (m.total / totalFiltered) * 100 : 0
              const COLORS = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4','#ec4899','#a855f7']
              const col = COLORS[i % COLORS.length]
              const medals = ['🥇','🥈','🥉']
              const memberLeads = filtered.filter(l => (l.assigned_member || 'Unassigned') === m.name)
              const conv = memberLeads.filter(l => l.status === 'Converted').length
              return (
                <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 13 }}>
                  <div style={{ width: 22, textAlign: 'center', fontSize: 14, flexShrink: 0 }}>
                    {i < 3 ? medals[i] : <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>#{i+1}</span>}
                  </div>
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%',
                    background: col + '20', color: col,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 800, flexShrink: 0
                  }}>{m.name[0]?.toUpperCase()}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{m.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: col, borderRadius: 99 }} />
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{pct.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: col }}>{m.total.toLocaleString()}</div>
                    <div style={{ fontSize: 10, color: '#10b981' }}>{conv} conv.</div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Recent Payments */}
          <div className="glass-card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>💳 Recent Payments</div>
              <a href="/payments" style={{ fontSize: 12, color: 'var(--accent-blue)', textDecoration: 'none' }}>View all →</a>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>PS Code</th>
                    <th>Student</th>
                    <th>Amount</th>
                    <th>Type</th>
                    <th>Month</th>
                    <th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPayments.map((p: any) => (
                    <tr key={p.id}>
                      <td>
                        <a href={`/students/${encodeURIComponent(p.students?.ps_code||'')}`}
                          style={{ color:'var(--accent-blue)',textDecoration:'none',fontWeight:500 }}>
                          {p.students?.ps_code||'—'}
                        </a>
                      </td>
                      <td style={{ color:'var(--text-secondary)' }}>{p.students?.full_name||'—'}</td>
                      <td style={{ fontWeight:600,color:'#10b981' }}>
                        {p.payment_type==='FREE'?'FREE':p.payment_type==='SIPSA'?'SIPSA':`Rs. ${(p.amount_paid||0).toLocaleString()}`}
                      </td>
                      <td>
                        <PayTypeBadge type={p.payment_type} bank={p.bank_name} />
                      </td>
                      <td style={{ color:'var(--text-muted)',fontSize:12 }}>
                        {MONTH_NAMES[(p.month||1)-1]?.slice(0,3)} {p.year}
                      </td>
                      <td style={{ color:'var(--text-muted)',fontSize:12 }}>{p.recorded_by}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────

function KpiCard({ icon, label, value, color, sub }: {
  icon: React.ReactNode; label: string; value: string; color: string; sub?: string
}) {
  return (
    <div className="stat-card" style={{ borderLeft: `3px solid ${color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="stat-card label">{label}</div>
          <div className="stat-card value" style={{ fontSize: 24, color }}>{value}</div>
          {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
        </div>
        <div style={{ color, opacity: 0.7 }}>{icon}</div>
      </div>
    </div>
  )
}

function PayTypeBadge({ type, bank }: { type: string; bank?: string }) {
  const map: Record<string, string> = {
    BANK: 'pay-bank', CASH: 'pay-cash', FREE: 'pay-free',
    SIPSA: 'pay-sipsa', PHYSICAL: 'pay-physical'
  }
  return <span className={`badge ${map[type] || 'pay-physical'}`}>{type === 'BANK' && bank ? bank : type}</span>
}
