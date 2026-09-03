'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  BarChart2,
  Calendar,
  Building2,
  Users,
  AlertCircle,
  FileSpreadsheet,
  Search,
  ShieldCheck,
  Layers
} from 'lucide-react'
import { MONTH_NAMES, CLASS_LABELS } from '@/lib/types'

export default function ReportsPage() {
  const supabase = createClient()

  // Primary Tab selection
  const [activeTab, setActiveTab] = useState<'registrations' | 'bank_revenue' | 'daily_audit' | 'debts'>('registrations')

  // Date filters
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))

  const [loading, setLoading] = useState(true)

  // 1. Month-by-Month New Registrations State
  const [newStudents, setNewStudents] = useState<any[]>([])
  const [gradeStats, setGradeStats] = useState<Record<number, number>>({})
  const [searchStu, setSearchStu] = useState('')

  // 2. Bank-Wise Total Revenue State
  const [bankRevenue, setBankRevenue] = useState<{ bank: string; count: number; total: number }[]>([])
  const [methodRevenue, setMethodRevenue] = useState<{ method: string; count: number; total: number }[]>([])
  const [allPaymentsMonth, setAllPaymentsMonth] = useState<any[]>([])

  // 3. Date-Wise Daily Payment Mark & Audit Report State
  const [dailyPayments, setDailyPayments] = useState<any[]>([])
  const [auditorStats, setAuditorStats] = useState<Record<string, { count: number; total: number }>>({})
  const [auditorFilter, setAuditorFilter] = useState('')

  // 4. Outstanding Debts State
  const [outstandingList, setOutstandingList] = useState<any[]>([])
  const [searchDebt, setSearchDebt] = useState('')

  useEffect(() => {
    loadAllReportData()
  }, [month, year, selectedDate])

  async function loadAllReportData() {
    setLoading(true)
    try {
      // Calculate start and end of the selected month
      const startOfMonth = new Date(year, month - 1, 1).toISOString()
      const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999).toISOString()

      const [
        { data: registeredData },
        { data: monthlyPaymentsData },
        { data: dailyPaymentsData },
        { data: outData }
      ] = await Promise.all([
        // 1. Real new registered students in this month (filtering out pre-generated unassigned empty slots)
        supabase
          .from('students')
          .select('*, household:households(*), enrollments(*)')
          .not('created_by', 'ilike', '%Auto-Pre-generated%')
          .gte('created_at', startOfMonth)
          .lte('created_at', endOfMonth)
          .order('created_at', { ascending: false }),

        // 2. Payments in this month (for Bank & Method revenue)
        supabase
          .from('payments')
          .select('*, students(ps_code, full_name, grade)')
          .eq('month', month)
          .eq('year', year),

        // 3. Payments marked on the selected specific calendar day
        supabase
          .from('payments')
          .select('*, students(ps_code, full_name, grade)')
          .or(`date_paid.eq.${selectedDate},created_at.gte.${selectedDate}T00:00:00,created_at.lte.${selectedDate}T23:59:59`)
          .order('created_at', { ascending: false }),

        // 4. Outstanding debts
        supabase
          .from('students_outstanding')
          .select('*')
      ])

      // 1. Process New Registered Students & Grade Breakdown
      const stuList = registeredData || []
      setNewStudents(stuList)

      const gMap: Record<number, number> = {}
      stuList.forEach(s => {
        const gr = s.grade || 0
        gMap[gr] = (gMap[gr] || 0) + 1
      })
      setGradeStats(gMap)

      // 2. Process Bank-Wise & Payment Type Breakdown
      const payList = monthlyPaymentsData || []
      setAllPaymentsMonth(payList)

      const bMap: Record<string, { count: number; total: number }> = {}
      const mMap: Record<string, { count: number; total: number }> = {}

      payList.forEach((p: any) => {
        const amt = Number(p.amount_paid) || 0
        const method = p.payment_type || 'BANK'
        const bank = p.bank_name || (method === 'BANK' ? 'Other Bank' : method)

        if (!bMap[bank]) bMap[bank] = { count: 0, total: 0 }
        bMap[bank].count += 1
        bMap[bank].total += amt

        if (!mMap[method]) mMap[method] = { count: 0, total: 0 }
        mMap[method].count += 1
        mMap[method].total += amt
      })

      setBankRevenue(
        Object.entries(bMap)
          .map(([bank, data]) => ({ bank, count: data.count, total: data.total }))
          .sort((a, b) => b.total - a.total)
      )

      setMethodRevenue(
        Object.entries(mMap)
          .map(([method, data]) => ({ method, count: data.count, total: data.total }))
          .sort((a, b) => b.total - a.total)
      )

      // 3. Process Date-Wise Daily Payment & Auditor Logs
      const dList = dailyPaymentsData || []
      setDailyPayments(dList)

      const aMap: Record<string, { count: number; total: number }> = {}
      dList.forEach((p: any) => {
        const who = p.recorded_by || 'System User'
        const amt = Number(p.amount_paid) || 0
        if (!aMap[who]) aMap[who] = { count: 0, total: 0 }
        aMap[who].count += 1
        aMap[who].total += amt
      })
      setAuditorStats(aMap)

      // 4. Debts
      setOutstandingList(outData || [])

    } catch (e) {
      console.error('Error loading report analytics:', e)
    } finally {
      setLoading(false)
    }
  }

  // Export CSV Helper
  function exportTableToCsv(filename: string, headers: string[], rows: string[][]) {
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

  // Filtered lists
  const filteredNewStudents = newStudents.filter(s => {
    if (!searchStu.trim()) return true
    const term = searchStu.toLowerCase()
    return (
      s.ps_code?.toLowerCase().includes(term) ||
      s.full_name?.toLowerCase().includes(term) ||
      s.household?.parent_name?.toLowerCase().includes(term) ||
      s.household?.parent_phone?.toLowerCase().includes(term)
    )
  })

  const filteredDailyPayments = dailyPayments.filter(p => {
    if (!auditorFilter) return true
    return (p.recorded_by || 'System User') === auditorFilter
  })

  const filteredDebts = outstandingList.filter(d => {
    if (!searchDebt.trim()) return true
    const term = searchDebt.toLowerCase()
    return (
      d.ps_code?.toLowerCase().includes(term) ||
      d.full_name?.toLowerCase().includes(term) ||
      d.address?.toLowerCase().includes(term)
    )
  })

  const totalMonthlyRevenue = allPaymentsMonth.reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0)
  const totalDailyRevenue = dailyPayments.reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0)
  const totalDebtAmount = outstandingList.reduce((sum, d) => sum + Math.abs(d.current_balance || 0), 0)

  return (
    <div className="fade-in" style={{ paddingBottom: 60 }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <BarChart2 size={22} style={{ color: 'var(--accent-blue)' }} />
            Admin Reports &amp; Audit Analytics
          </h1>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
            Month-by-month registrations, bank-wise revenue breakdowns, and daily auditor payment logs
          </div>
        </div>
      </div>

      <div className="page-content">
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 12, flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveTab('registrations')}
            className={activeTab === 'registrations' ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '8px 18px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Users size={16} />
            Registrations
            <span style={{
              background: activeTab === 'registrations' ? 'rgba(255,255,255,0.2)' : 'rgba(59,130,246,0.15)',
              color: activeTab === 'registrations' ? '#fff' : 'var(--accent-blue)',
              padding: '2px 8px', borderRadius: 12, fontSize: 11
            }}>
              {newStudents.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('bank_revenue')}
            className={activeTab === 'bank_revenue' ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '8px 18px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Building2 size={16} />
            Bank Revenue
            <span style={{
              background: activeTab === 'bank_revenue' ? 'rgba(255,255,255,0.2)' : 'rgba(59,130,246,0.15)',
              color: activeTab === 'bank_revenue' ? '#fff' : 'var(--accent-blue)',
              padding: '2px 8px', borderRadius: 12, fontSize: 11
            }}>
              Rs. {totalMonthlyRevenue.toLocaleString()}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('daily_audit')}
            className={activeTab === 'daily_audit' ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '8px 18px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <ShieldCheck size={16} />
            Audit Log
            <span style={{
              background: activeTab === 'daily_audit' ? 'rgba(255,255,255,0.2)' : 'rgba(59,130,246,0.15)',
              color: activeTab === 'daily_audit' ? '#fff' : 'var(--accent-blue)',
              padding: '2px 8px', borderRadius: 12, fontSize: 11
            }}>
              {dailyPayments.length} slips
            </span>
          </button>

          <button
            onClick={() => setActiveTab('debts')}
            className={activeTab === 'debts' ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '8px 18px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <AlertCircle size={16} />
            Debts
            <span style={{
              background: activeTab === 'debts' ? 'rgba(255,255,255,0.2)' : 'rgba(239,68,68,0.15)',
              color: activeTab === 'debts' ? '#fff' : '#ef4444',
              padding: '2px 8px', borderRadius: 12, fontSize: 11
            }}>
              {outstandingList.length}
            </span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: MONTH-BY-MONTH NEW REGISTRATIONS (PS CODES, GRADES, COUNTS)        */}
        {/* ========================================================================= */}
        {activeTab === 'registrations' && (
          <div className="fade-in">
            {/* Filter Bar */}
            <div className="glass-card" style={{ padding: 18, marginBottom: 20, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Registration Month</label>
                  <select className="input-field" style={{ width: 140 }} value={month} onChange={e => setMonth(parseInt(e.target.value))}>
                    {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Year</label>
                  <select className="input-field" style={{ width: 100 }} value={year} onChange={e => setYear(parseInt(e.target.value))}>
                    {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div style={{ width: 220 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Search Student / PS</label>
                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input className="search-bar" style={{ paddingLeft: 32 }} placeholder="Search PS code or name..."
                      value={searchStu} onChange={e => setSearchStu(e.target.value)} />
                  </div>
                </div>
              </div>

              <div>
                <button
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
                  <FileSpreadsheet size={16} /> Export Excel
                </button>
              </div>
            </div>

            {/* Grade-by-Grade Summary Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
              <div className="stat-card" style={{ padding: '12px 14px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total New</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{newStudents.length}</div>
              </div>
              {[6, 7, 8, 9, 10, 11, 12, 13].map(g => (
                <div key={g} className="stat-card" style={{ padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Grade {g}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: (gradeStats[g] || 0) > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    {gradeStats[g] || 0}
                  </div>
                </div>
              ))}
            </div>

            {/* Students Table */}
            <div className="glass-card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Users size={16} style={{ color: 'var(--accent-blue)' }} />
                  New Registered Students in {MONTH_NAMES[month - 1]} {year} ({filteredNewStudents.length} Records)
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
                  <div style={{ fontSize: 12, marginTop: 4 }}>Newly registered students will appear here cleanly as they are added.</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: BANK-WISE TOTAL REVENUE & PAYMENT METHOD BREAKDOWN                  */}
        {/* ========================================================================= */}
        {activeTab === 'bank_revenue' && (
          <div className="fade-in">
            {/* Filter Bar */}
            <div className="glass-card" style={{ padding: 18, marginBottom: 20, display: 'flex', gap: 14, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Month</label>
                  <select className="input-field" style={{ width: 140 }} value={month} onChange={e => setMonth(parseInt(e.target.value))}>
                    {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Year</label>
                  <select className="input-field" style={{ width: 100 }} value={year} onChange={e => setYear(parseInt(e.target.value))}>
                    {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <button
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
                  <FileSpreadsheet size={16} /> Export CSV
                </button>
              </div>
            </div>

            {/* Revenue Highlights */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
              <div className="stat-card">
                <div className="stat-card label">Total Collected ({MONTH_NAMES[month - 1]})</div>
                <div className="stat-card value" style={{ color: 'var(--text-primary)' }}>Rs. {totalMonthlyRevenue.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Total {allPaymentsMonth.length} class payment records</div>
              </div>

              <div className="stat-card">
                <div className="stat-card label">Top Bank Revenue</div>
                <div className="stat-card value" style={{ color: 'var(--text-primary)', fontSize: 20 }}>
                  {bankRevenue[0]?.bank || 'None'}: Rs. {(bankRevenue[0]?.total || 0).toLocaleString()}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{bankRevenue[0]?.count || 0} deposits</div>
              </div>
            </div>

            {/* Bank-Wise Grid & Payment Channel Breakdown */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20 }}>
              {/* Bank Revenue Table */}
              <div className="glass-card" style={{ padding: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Building2 size={18} style={{ color: 'var(--accent-blue)' }} />
                  Bank-Wise Revenue Breakdown
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

                {bankRevenue.length === 0 && (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
                    No payment deposits recorded for {MONTH_NAMES[month - 1]} {year}.
                  </div>
                )}
              </div>

              {/* Payment Method / Channel Breakdown */}
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

        {/* ========================================================================= */}
        {/* TAB 3: DATE-WISE DAILY PAYMENT MARK PANEL & AUDIT REPORT                  */}
        {/* ========================================================================= */}
        {activeTab === 'daily_audit' && (
          <div className="fade-in">
            {/* Date & Auditor Filter Bar */}
            <div className="glass-card" style={{ padding: 18, marginBottom: 20, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Select Payment Date</label>
                  <input
                    type="date"
                    className="input-field"
                    style={{ width: 170 }}
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Filter Auditor / Staff</label>
                  <select className="input-field" style={{ width: 180 }} value={auditorFilter} onChange={e => setAuditorFilter(e.target.value)}>
                    <option value="">All Auditors / Staff</option>
                    {Object.keys(auditorStats).map(who => (
                      <option key={who} value={who}>{who} ({auditorStats[who].count})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <button
                  onClick={() => {
                    const headers = ['PS CODE', 'STUDENT NAME', 'CLASS', 'AMOUNT (RS)', 'PAYMENT TYPE', 'BANK', 'AUDITOR (RECORDED BY)', 'TIME', 'NOTES']
                    const rows = filteredDailyPayments.map(p => [
                      `"${p.students?.ps_code || ''}"`,
                      `"${(p.students?.full_name || '').replace(/"/g, '""')}"`,
                      `"${CLASS_LABELS[p.class_type] || p.class_type}"`,
                      `"${p.amount_paid || 0}"`,
                      `"${p.payment_type || 'BANK'}"`,
                      `"${p.bank_name || ''}"`,
                      `"${p.recorded_by || 'System'}"`,
                      `"${new Date(p.created_at).toLocaleTimeString()}"`,
                      `"${(p.notes || '').replace(/"/g, '""')}"`
                    ])
                    exportTableToCsv(`Daily_Audit_Log_${selectedDate}`, headers, rows)
                  }}
                  className="btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <FileSpreadsheet size={16} /> Export CSV
                </button>
              </div>
            </div>

            {/* Daily Auditor Performance Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
              <div className="stat-card">
                <div className="stat-card label">Total Collected ({selectedDate})</div>
                <div className="stat-card value" style={{ color: 'var(--text-primary)' }}>Rs. {totalDailyRevenue.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{dailyPayments.length} slips audited</div>
              </div>

              {Object.entries(auditorStats).map(([who, data]) => (
                <div key={who} className="stat-card">
                  <div className="stat-card label">Auditor: {who}</div>
                  <div className="stat-card value" style={{ color: 'var(--text-primary)', fontSize: 20 }}>
                    Rs. {data.total.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{data.count} slips marked</div>
                </div>
              ))}
            </div>

            {/* Daily Audit Table */}
            <div className="glass-card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ShieldCheck size={16} style={{ color: 'var(--accent-blue)' }} />
                  Payments Logged on {selectedDate} ({filteredDailyPayments.length} Slips)
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
                          {CLASS_LABELS[p.class_type] || p.class_type} (Gr {p.students?.grade || '?'})
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
              </div>

              {filteredDailyPayments.length === 0 && (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No payment entries logged on {selectedDate}.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: OUTSTANDING DEBTS TABLE                                            */}
        {/* ========================================================================= */}
        {activeTab === 'debts' && (
          <div className="fade-in">
            {/* Filter Bar */}
            <div className="glass-card" style={{ padding: 18, marginBottom: 20, display: 'flex', gap: 14, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div style={{ width: 280 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Search Debtor</label>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input className="search-bar" style={{ paddingLeft: 32 }} placeholder="Search PS code, student name, address..."
                    value={searchDebt} onChange={e => setSearchDebt(e.target.value)} />
                </div>
              </div>

              <div>
                <button
                  onClick={() => {
                    const headers = ['PS CODE', 'STUDENT NAME', 'GRADE', 'CLASS', 'OUTSTANDING DEBT (RS)', 'DELIVERY ADDRESS']
                    const rows = filteredDebts.map(d => [
                      `"${d.ps_code}"`,
                      `"${(d.full_name || '').replace(/"/g, '""')}"`,
                      `"Grade ${d.grade || '?'}"`,
                      `"${CLASS_LABELS[d.class_type] || d.class_type}"`,
                      `"${Math.abs(d.current_balance || 0)}"`,
                      `"${(d.address || '').replace(/"/g, '""')}"`
                    ])
                    exportTableToCsv(`Outstanding_Debts_Report`, headers, rows)
                  }}
                  className="btn-primary"
                  style={{ background: '#ef4444', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <FileSpreadsheet size={16} /> Export CSV
                </button>
              </div>
            </div>

            {/* Debts Total Stat Card */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
              <div className="stat-card" style={{ borderLeft: '4px solid #ef4444' }}>
                <div className="stat-card label">Total Outstanding Portfolio Debt</div>
                <div className="stat-card value" style={{ color: '#ef4444' }}>Rs. {totalDebtAmount.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{outstandingList.length} student ledger balances in debt</div>
              </div>
            </div>

            {/* Debts Table */}
            <div className="glass-card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircle size={16} /> Students with Outstanding Debt ({filteredDebts.length} Records)
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>PS Code</th>
                      <th>Student Name</th>
                      <th>Grade</th>
                      <th>Class</th>
                      <th>Outstanding Debt</th>
                      <th>Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDebts.map((item, idx) => (
                      <tr key={`${item.ps_code}-${idx}`}>
                        <td>
                          <a href={`/students/${encodeURIComponent(item.ps_code)}`} style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontWeight: 700 }}>
                            {item.ps_code}
                          </a>
                        </td>
                        <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{item.full_name || '—'}</td>
                        <td>Gr {item.grade || '—'}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{CLASS_LABELS[item.class_type] || item.class_type}</td>
                        <td style={{ color: '#ef4444', fontWeight: 800, fontSize: 14 }}>Rs. {Math.abs(item.current_balance).toLocaleString()}</td>
                        <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.address || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredDebts.length === 0 && (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No outstanding debts recorded in system!
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
