'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Users, Phone, TrendingUp, Activity, BarChart2,
  Target, Award, Filter, RefreshCw, CheckCircle,
  Clock, XCircle, AlertCircle, CreditCard, Calendar,
  CheckCircle2, FileSpreadsheet, Layers, Sparkles
} from 'lucide-react'
import { MONTH_NAMES } from '@/lib/types'

// ──────────────────────────────────────────────────────────────
// Types & Constants
// ──────────────────────────────────────────────────────────────

const GRADES = ['6', '7', '8', '9', '10', '11']
const GRADE_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4']

const STATUS_GROUPS = {
  hot: { label: 'Hot / Active', color: '#10b981', statuses: ['Contacted', 'Interested', 'Second Call Pending', 'Follow-up'] },
  converted: { label: 'Converted', color: '#3b82f6', statuses: ['Converted'] },
  new: { label: 'New', color: '#f59e0b', statuses: ['New'] },
  cold: { label: 'Cold / Dead', color: '#ef4444', statuses: ['Not Interested', 'Off', 'Invalid', 'Wrong number', 'Busy', 'Call Another Number', 'No Answer'] },
}

interface LeadRow {
  assigned_member: string | null
  grade: string | null
  status: string
  campaign: string | null
  date_added: string | null
  created_at?: string | null
  paid?: boolean
  paid_grades?: string | null
}

export default function AnalyticsDashboard() {
  const supabase = createClient()

  // Primary Tab Switcher
  const [activeTab, setActiveTab] = useState<'overview' | 'daily_member_tracking' | 'master_paid_report'>('overview')

  const [leads, setLeads] = useState<LeadRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Date filters for overview
  const [filterStart, setFilterStart] = useState('')
  const [filterEnd, setFilterEnd] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  // Specific Day selection for Day-by-Day Member Lead Tracking tab
  const [selectedDay, setSelectedDay] = useState(new Date().toISOString().slice(0, 10))

  // KPI States
  const [revenueThisMonth, setRevenueThisMonth] = useState(0)
  const [paidThisMonth, setPaidThisMonth] = useState(0)
  const [totalStudents, setTotalStudents] = useState(0)

  // Fetch all leads using sequential pagination to ensure 100% data retrieval
  async function fetchAllLeadsSequential(): Promise<LeadRow[]> {
    let allLeads: LeadRow[] = []
    const pageSize = 1000
    let from = 0
    let hasMore = true

    while (hasMore) {
      const { data, error } = await supabase
        .from('leads')
        .select('assigned_member,grade,status,campaign,date_added,created_at,paid,paid_grades')
        .range(from, from + pageSize - 1)

      if (error) {
        console.error('Error fetching batch at offset', from, error)
        break
      }

      if (data && data.length > 0) {
        allLeads.push(...data)
        from += pageSize
        if (data.length < pageSize) {
          hasMore = false
        }
      } else {
        hasMore = false
      }
    }
    return allLeads
  }

  async function loadData() {
    setRefreshing(true)
    try {
      const now = new Date()
      const curMonth = now.getMonth() + 1
      const curYear = now.getFullYear()

      const [leadsData, payRes, studRes] = await Promise.all([
        fetchAllLeadsSequential(),
        supabase.from('payments').select('amount_paid,payment_type,student_id')
          .eq('month', curMonth).eq('year', curYear),
        supabase.from('students').select('*', { count: 'exact', head: true }),
      ])

      setLeads(leadsData || [])
      const pmts = payRes.data || []
      const rev = pmts
        .filter((p: any) => !['FREE', 'IMS'].includes(p.payment_type || ''))
        .reduce((s: number, p: any) => s + (p.amount_paid || 0), 0)

      setRevenueThisMonth(rev)
      setPaidThisMonth(new Set(pmts.map((p: any) => p.student_id)).size)
      setTotalStudents(studRes.count || 0)
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

  // Helper to extract grade numbers
  function extractGrades(rawGrade: string | number | null): string[] {
    if (rawGrade === null || rawGrade === undefined) return []
    const str = String(rawGrade).trim()
    if (!str) return []

    const matches = str.match(/\b(6|7|8|9|10|11)\b/g)
    if (matches && matches.length > 0) {
      return Array.from(new Set(matches))
    }

    const found: string[] = []
    GRADES.forEach(g => {
      const regex = new RegExp(`(^|[^0-9])${g}([^0-9]|$)`)
      if (regex.test(str)) found.push(g)
    })
    return found
  }

  // Filtered leads based on Date Range
  const filtered = useMemo(() => {
    if (!filterStart && !filterEnd) return leads
    return leads.filter(l => {
      const dateStr = l.date_added || l.created_at || ''
      if (!dateStr) return false
      const d = dateStr.slice(0, 10)
      if (filterStart && d < filterStart) return false
      if (filterEnd && d > filterEnd) return false
      return true
    })
  }, [leads, filterStart, filterEnd])

  const totalFiltered = filtered.length

  // All distinct members in filtered dataset
  const members = useMemo(() => {
    const counts: Record<string, number> = {}
    filtered.forEach(l => {
      const m = l.assigned_member || 'Unassigned'
      counts[m] = (counts[m] || 0) + 1
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, total]) => ({ name, total }))
  }, [filtered])

  // Member × Grade Matrix (All leads / filtered range)
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

  // Grade Totals
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

  // =========================================================================
  // 1. DAY-BY-DAY MEMBER LEAD TRACKING COMPUTATIONS
  // =========================================================================
  const dayLeads = useMemo(() => {
    return leads.filter(l => {
      const d = (l.date_added || l.created_at || '').slice(0, 10)
      return d === selectedDay
    })
  }, [leads, selectedDay])

  const dayMembers = useMemo(() => {
    const counts: Record<string, number> = {}
    dayLeads.forEach(l => {
      const m = l.assigned_member || 'Unassigned'
      counts[m] = (counts[m] || 0) + 1
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, total]) => ({ name, total }))
  }, [dayLeads])

  const dayMemberGradeMatrix = useMemo(() => {
    const matrix: Record<string, Record<string, number>> = {}
    dayLeads.forEach(l => {
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
  }, [dayLeads])

  const dayGradeTotals = useMemo(() => {
    const t: Record<string, number> = {}
    dayLeads.forEach(l => {
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
  }, [dayLeads])

  // =========================================================================
  // 2. MASTER LEAD PAID TICK REPORT COMPUTATIONS (MEMBERS × GRADE × COUNT)
  // =========================================================================
  const paidLeads = useMemo(() => {
    return filtered.filter(l => Boolean(l.paid) || Boolean(l.paid_grades))
  }, [filtered])

  const paidMemberGradeMatrix = useMemo(() => {
    const matrix: Record<string, Record<string, number>> = {}
    paidLeads.forEach(l => {
      const m = l.assigned_member || 'Unassigned'
      if (!matrix[m]) matrix[m] = {}

      // If specific paid_grades exists, count those grades; else use lead grade
      const gradesToCount = l.paid_grades ? extractGrades(l.paid_grades) : extractGrades(l.grade)

      if (gradesToCount.length > 0) {
        gradesToCount.forEach(g => {
          matrix[m][g] = (matrix[m][g] || 0) + 1
        })
      } else {
        matrix[m]['Other'] = (matrix[m]['Other'] || 0) + 1
      }
    })
    return matrix
  }, [paidLeads])

  const paidGradeTotals = useMemo(() => {
    const t: Record<string, number> = {}
    paidLeads.forEach(l => {
      const gradesToCount = l.paid_grades ? extractGrades(l.paid_grades) : extractGrades(l.grade)
      if (gradesToCount.length > 0) {
        gradesToCount.forEach(g => {
          t[g] = (t[g] || 0) + 1
        })
      } else {
        t['Other'] = (t['Other'] || 0) + 1
      }
    })
    return t
  }, [paidLeads])

  const paidMembersList = useMemo(() => {
    const counts: Record<string, number> = {}
    paidLeads.forEach(l => {
      const m = l.assigned_member || 'Unassigned'
      const gradesToCount = l.paid_grades ? extractGrades(l.paid_grades) : extractGrades(l.grade)
      const count = Math.max(1, gradesToCount.length)
      counts[m] = (counts[m] || 0) + count
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, totalPaidClasses]) => ({ name, totalPaidClasses }))
  }, [paidLeads])

  const totalPaidConversions = paidLeads.length
  const totalPaidClassesCount = Object.values(paidGradeTotals).reduce((sum, c) => sum + c, 0)

  // Export CSV Helper
  function exportCsv(filename: string, headers: string[], rows: string[][]) {
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          <Activity size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
          <div>Loading analytics…</div>
        </div>
      </div>
    )
  }

  return (
    <div className="fade-in" style={{ paddingBottom: 60 }}>
      {/* ── Page Header ─────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <BarChart2 size={22} style={{ color: 'var(--accent-blue)' }} />
            Admin CRM &amp; Lead Analytics Dashboard
          </h1>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Lead Tracking · Day-by-Day Performance · Master Paid Conversions by Member &amp; Grade
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn-secondary" onClick={loadData} disabled={refreshing}
            style={{ padding: '5px 12px', fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
            <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            {refreshing ? 'Refreshing…' : 'Refresh Data'}
          </button>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Updated {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>

      <div className="page-content">

        {/* ── Navigation Tabs ───────────────────────────── */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 12, flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveTab('overview')}
            className={activeTab === 'overview' ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '8px 18px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <BarChart2 size={16} />
            1. Overall CRM Analytics
          </button>

          <button
            onClick={() => setActiveTab('daily_member_tracking')}
            className={activeTab === 'daily_member_tracking' ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '8px 18px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Calendar size={16} />
            2. Day-by-Day Member Lead Tracking
            <span style={{
              background: activeTab === 'daily_member_tracking' ? 'rgba(255,255,255,0.2)' : 'rgba(59,130,246,0.15)',
              color: activeTab === 'daily_member_tracking' ? '#fff' : 'var(--accent-blue)',
              padding: '2px 8px', borderRadius: 12, fontSize: 11
            }}>
              {dayLeads.length} today
            </span>
          </button>

          <button
            onClick={() => setActiveTab('master_paid_report')}
            className={activeTab === 'master_paid_report' ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '8px 18px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <CheckCircle2 size={16} style={{ color: '#10b981' }} />
            3. Master Lead Paid Tick Report (Members × Grade × Count)
            <span style={{
              background: activeTab === 'master_paid_report' ? 'rgba(255,255,255,0.2)' : 'rgba(16,185,129,0.15)',
              color: activeTab === 'master_paid_report' ? '#fff' : '#10b981',
              padding: '2px 8px', borderRadius: 12, fontSize: 11
            }}>
              {totalPaidConversions} paid leads
            </span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: OVERALL CRM ANALYTICS                                              */}
        {/* ========================================================================= */}
        {activeTab === 'overview' && (
          <div className="fade-in">
            {/* Filter Bar */}
            <div className="glass-card" style={{ padding: 14, marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>From Date</label>
              <input type="date" className="input-field" value={filterStart} onChange={e => setFilterStart(e.target.value)}
                style={{ padding: '5px 10px', fontSize: 12, width: 140 }} />
              <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>To Date</label>
              <input type="date" className="input-field" value={filterEnd} onChange={e => setFilterEnd(e.target.value)}
                style={{ padding: '5px 10px', fontSize: 12, width: 140 }} />
              {(filterStart || filterEnd) && (
                <button className="btn-secondary" onClick={() => { setFilterStart(''); setFilterEnd('') }}
                  style={{ padding: '5px 10px', fontSize: 12 }}>Clear Filter</button>
              )}
            </div>

            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 22 }}>
              <KpiCard icon={<Phone size={18} />} label="Total Leads" value={totalFiltered.toLocaleString()} color="#3b82f6" />
              <KpiCard icon={<TrendingUp size={18} />} label="Converted" value={convertedCount.toLocaleString()} color="#10b981" sub={`${conversionRate}% rate`} />
              <KpiCard icon={<Users size={18} />} label="Total Registered Students" value={totalStudents.toLocaleString()} color="#8b5cf6" />
              <KpiCard icon={<CheckCircle size={18} />} label="Paid Leads (Ticks)" value={paidLeads.length.toLocaleString()} color="#10b981" />
              <KpiCard icon={<CreditCard size={18} />} label="Monthly Fee Revenue" value={`Rs. ${revenueThisMonth.toLocaleString()}`} color="#f59e0b" />
            </div>

            {/* Status Group Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 22 }}>
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

            {/* TABLE 1: Member × Grade Matrix */}
            <div className="glass-card" style={{ marginBottom: 22, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>📊 Leads by Member &amp; Grade</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Lead distribution across members and grade levels</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-hover)', padding: '4px 10px', borderRadius: 6 }}>
                  {members.length} members · {totalFiltered.toLocaleString()} leads
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ tableLayout: 'fixed' }}>
                  <thead>
                    <tr>
                      <th style={{ width: 140, textAlign: 'left' }}>Member</th>
                      {GRADES.map((g, i) => (
                        <th key={g} style={{ textAlign: 'center', color: GRADE_COLORS[i] }}>Grade {g}</th>
                      ))}
                      <th style={{ textAlign: 'center', fontWeight: 700 }}>Total Leads</th>
                      <th style={{ textAlign: 'center', fontWeight: 700 }}>Share %</th>
                      <th style={{ textAlign: 'right' }}>Conversion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m, idx) => {
                      const row = memberGradeMatrix[m.name] || {}
                      const share = totalFiltered > 0 ? ((m.total / totalFiltered) * 100).toFixed(1) : '0.0'
                      const memberLeads = filtered.filter(l => (l.assigned_member || 'Unassigned') === m.name)
                      const memberConverted = memberLeads.filter(l => l.status === 'Converted').length
                      const mConvRate = m.total > 0 ? ((memberConverted / m.total) * 100).toFixed(1) : '0.0'
                      const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#a855f7']
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
                                  <span style={{ color: GRADE_COLORS[gi], fontWeight: count > 100 ? 700 : 500 }}>
                                    {count.toLocaleString()}
                                  </span>
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
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: DAY-BY-DAY MEMBER LEAD TRACKING                                    */}
        {/* ========================================================================= */}
        {activeTab === 'daily_member_tracking' && (
          <div className="fade-in">
            {/* Filter Bar */}
            <div className="glass-card" style={{ padding: 18, marginBottom: 20, display: 'flex', gap: 14, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Select Day</label>
                  <input
                    type="date"
                    className="input-field"
                    style={{ width: 170 }}
                    value={selectedDay}
                    onChange={e => setSelectedDay(e.target.value)}
                  />
                </div>
                <div style={{ paddingTop: 18, fontSize: 13, color: 'var(--text-secondary)' }}>
                  Total leads added on <b>{selectedDay}</b>: <b style={{ color: 'var(--accent-blue)' }}>{dayLeads.length} leads</b>
                </div>
              </div>

              <div>
                <button
                  onClick={() => {
                    const headers = ['MEMBER', ...GRADES.map(g => `GRADE ${g}`), 'TOTAL LEADS', 'DATE']
                    const rows = dayMembers.map(m => {
                      const r = dayMemberGradeMatrix[m.name] || {}
                      return [
                        `"${m.name}"`,
                        ...GRADES.map(g => `"${r[g] || 0}"`),
                        `"${m.total}"`,
                        `"${selectedDay}"`
                      ]
                    })
                    exportCsv(`Daily_Member_Leads_${selectedDay}`, headers, rows)
                  }}
                  className="btn-primary"
                  style={{ background: '#10b981', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <FileSpreadsheet size={16} /> Export Day Leads CSV
                </button>
              </div>
            </div>

            {/* Daily Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
              <div className="stat-card" style={{ borderLeft: '3px solid var(--accent-blue)', padding: '12px 14px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Day Leads</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent-blue)' }}>{dayLeads.length}</div>
              </div>
              {GRADES.map((g, i) => (
                <div key={g} className="stat-card" style={{ borderLeft: `3px solid ${GRADE_COLORS[i]}`, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Grade {g}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: (dayGradeTotals[g] || 0) > 0 ? GRADE_COLORS[i] : 'var(--text-muted)' }}>
                    {dayGradeTotals[g] || 0}
                  </div>
                </div>
              ))}
            </div>

            {/* Day Member Matrix Table */}
            <div className="glass-card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Calendar size={16} style={{ color: 'var(--accent-orange)' }} />
                  Member Lead Distribution for {selectedDay} ({dayMembers.length} Active Members)
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ tableLayout: 'fixed' }}>
                  <thead>
                    <tr>
                      <th style={{ width: 160, textAlign: 'left' }}>Member Name</th>
                      {GRADES.map((g, i) => (
                        <th key={g} style={{ textAlign: 'center', color: GRADE_COLORS[i] }}>Grade {g}</th>
                      ))}
                      <th style={{ textAlign: 'center', fontWeight: 700 }}>Total Leads</th>
                      <th style={{ textAlign: 'right', fontWeight: 700 }}>Daily Share %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayMembers.map((m, idx) => {
                      const row = dayMemberGradeMatrix[m.name] || {}
                      const share = dayLeads.length > 0 ? ((m.total / dayLeads.length) * 100).toFixed(1) : '0.0'
                      const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#a855f7']
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
                              <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{m.name}</span>
                            </div>
                          </td>
                          {GRADES.map((g, gi) => {
                            const count = row[g] || 0
                            return (
                              <td key={g} style={{ textAlign: 'center', fontSize: 13 }}>
                                {count > 0 ? (
                                  <span style={{ color: GRADE_COLORS[gi], fontWeight: 700 }}>
                                    {count}
                                  </span>
                                ) : <span style={{ color: 'var(--text-muted)', opacity: 0.4 }}>—</span>}
                              </td>
                            )
                          })}
                          <td style={{ textAlign: 'center', fontWeight: 800, color: col, fontSize: 14 }}>
                            {m.total}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)' }}>
                            {share}%
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 800, borderTop: '2px solid var(--border)', background: 'rgba(59,130,246,0.05)' }}>
                      <td style={{ fontWeight: 700, fontSize: 12, letterSpacing: '0.05em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>TOTAL DAY LEADS</td>
                      {GRADES.map((g, gi) => (
                        <td key={g} style={{ textAlign: 'center', fontWeight: 700, color: GRADE_COLORS[gi] }}>
                          {(dayGradeTotals[g] || 0).toLocaleString()}
                        </td>
                      ))}
                      <td style={{ textAlign: 'center', fontWeight: 900, color: 'var(--text-primary)', fontSize: 15 }}>
                        {dayLeads.length.toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>100.0%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {dayMembers.length === 0 && (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No leads recorded on {selectedDay}. Select a different date above.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: MASTER LEAD PAID TICK REPORT (MEMBERS × GRADE × COUNT)             */}
        {/* ========================================================================= */}
        {activeTab === 'master_paid_report' && (
          <div className="fade-in">
            {/* Header / Filter / Export Bar */}
            <div className="glass-card" style={{ padding: 18, marginBottom: 20, display: 'flex', gap: 14, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle2 size={20} style={{ color: '#10b981' }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#10b981' }}>Master Lead Paid Conversions</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Counts leads with Paid Tick enabled across assigned members &amp; grades</div>
                  </div>
                </div>
              </div>

              <div>
                <button
                  onClick={() => {
                    const headers = ['MEMBER', ...GRADES.map(g => `GRADE ${g} PAID`), 'TOTAL PAID CLASSES', 'SHARE %']
                    const rows = paidMembersList.map(m => {
                      const r = paidMemberGradeMatrix[m.name] || {}
                      const share = totalPaidClassesCount > 0 ? ((m.totalPaidClasses / totalPaidClassesCount) * 100).toFixed(1) : '0.0'
                      return [
                        `"${m.name}"`,
                        ...GRADES.map(g => `"${r[g] || 0}"`),
                        `"${m.totalPaidClasses}"`,
                        `"${share}%"`
                      ]
                    })
                    exportCsv(`Master_Lead_Paid_Report_Members_Grades`, headers, rows)
                  }}
                  className="btn-primary"
                  style={{ background: '#10b981', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <FileSpreadsheet size={16} /> Export Paid Ticks Excel
                </button>
              </div>
            </div>

            {/* Paid Conversions Grade Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
              <div className="stat-card" style={{ borderLeft: '3px solid #10b981', padding: '12px 14px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Paid Leads</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#10b981' }}>{totalPaidConversions}</div>
              </div>
              {GRADES.map((g, i) => (
                <div key={g} className="stat-card" style={{ borderLeft: `3px solid ${GRADE_COLORS[i]}`, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Gr {g} Paid</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: (paidGradeTotals[g] || 0) > 0 ? '#10b981' : 'var(--text-muted)' }}>
                    {paidGradeTotals[g] || 0}
                  </div>
                </div>
              ))}
            </div>

            {/* Paid Members × Grade Matrix Table */}
            <div className="glass-card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  🏆 Member Conversion Leaderboard (Paid Ticks by Grade)
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Total {totalPaidClassesCount} paid class seats converted
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ tableLayout: 'fixed' }}>
                  <thead>
                    <tr>
                      <th style={{ width: 160, textAlign: 'left' }}>Member Name</th>
                      {GRADES.map((g, i) => (
                        <th key={g} style={{ textAlign: 'center', color: GRADE_COLORS[i] }}>Grade {g} Paid</th>
                      ))}
                      <th style={{ textAlign: 'center', fontWeight: 700, color: '#10b981' }}>Total Paid Seats</th>
                      <th style={{ textAlign: 'right', fontWeight: 700 }}>Conversion Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paidMembersList.map((m, idx) => {
                      const row = paidMemberGradeMatrix[m.name] || {}
                      const share = totalPaidClassesCount > 0 ? ((m.totalPaidClasses / totalPaidClassesCount) * 100).toFixed(1) : '0.0'
                      const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#a855f7']
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
                              <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{m.name}</span>
                            </div>
                          </td>
                          {GRADES.map((g, gi) => {
                            const count = row[g] || 0
                            return (
                              <td key={g} style={{ textAlign: 'center', fontSize: 13 }}>
                                {count > 0 ? (
                                  <span style={{ color: '#10b981', fontWeight: 700, background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: 4 }}>
                                    ✓ {count}
                                  </span>
                                ) : <span style={{ color: 'var(--text-muted)', opacity: 0.4 }}>—</span>}
                              </td>
                            )
                          })}
                          <td style={{ textAlign: 'center', fontWeight: 900, color: '#10b981', fontSize: 15 }}>
                            {m.totalPaidClasses}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 13, color: 'var(--accent-blue)' }}>
                            {share}%
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 800, borderTop: '2px solid var(--border)', background: 'rgba(16,185,129,0.06)' }}>
                      <td style={{ fontWeight: 700, fontSize: 12, letterSpacing: '0.05em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>TOTAL PAID TICKS</td>
                      {GRADES.map((g, gi) => (
                        <td key={g} style={{ textAlign: 'center', fontWeight: 800, color: '#10b981' }}>
                          {(paidGradeTotals[g] || 0).toLocaleString()}
                        </td>
                      ))}
                      <td style={{ textAlign: 'center', fontWeight: 900, color: '#10b981', fontSize: 16 }}>
                        {totalPaidClassesCount.toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>100.0%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {paidMembersList.length === 0 && (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No leads with Paid ticks found in current filter.
                </div>
              )}
            </div>
          </div>
        )}

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
