'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BarChart2, DollarSign, Users, AlertCircle, FileText } from 'lucide-react'
import { MONTH_NAMES, CLASS_LABELS } from '@/lib/types'

export default function ReportsPage() {
  const supabase = createClient()
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [outstandingList, setOutstandingList] = useState<any[]>([])
  const [revenueByClass, setRevenueByClass] = useState<any[]>([])
  const [revenueByType, setRevenueByType] = useState<any[]>([])

  useEffect(() => { loadReports() }, [month, year])

  async function loadReports() {
    setLoading(true)
    try {
      const [
        { data: out },
        { data: rev },
      ] = await Promise.all([
        supabase.from('students_outstanding').select('*'),
        supabase.from('payments').select('amount_paid, payment_type, class_type').eq('month', month).eq('year', year),
      ])

      setOutstandingList(out || [])

      // Revenue breakdown by class
      const classMap: Record<string, number> = {}
      const typeMap: Record<string, number> = {}

      ;(rev || []).forEach((p: any) => {
        const amt = p.amount_paid || 0
        const c = p.class_type || 'Unknown'
        const t = p.payment_type || 'Other'

        classMap[c] = (classMap[c] || 0) + amt
        typeMap[t] = (typeMap[t] || 0) + amt
      })

      setRevenueByClass(Object.entries(classMap).map(([name, total]) => ({ name, total })))
      setRevenueByType(Object.entries(typeMap).map(([name, total]) => ({ name, total })))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const totalOutstanding = outstandingList.reduce((acc, i) => acc + Math.abs(i.current_balance), 0)
  const totalMonthRevenue = revenueByClass.reduce((acc, i) => acc + i.total, 0)

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <BarChart2 size={22} style={{ color: 'var(--accent-purple)' }} />
            Financial & Outstanding Reports
          </h1>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
            Detailed breakdown of revenue, balances, and non-payers
          </div>
        </div>
      </div>

      <div className="page-content">
        {/* Date Filter */}
        <div className="glass-card" style={{ padding: 18, marginBottom: 20, display: 'flex', gap: 14, alignItems: 'center' }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Report Month</label>
            <select className="input-field" style={{ width: 140 }} value={month} onChange={e => setMonth(parseInt(e.target.value))}>
              {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Report Year</label>
            <select className="input-field" style={{ width: 110 }} value={year} onChange={e => setYear(parseInt(e.target.value))}>
              {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {/* Overview Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div className="stat-card" style={{ borderLeft: '3px solid #10b981' }}>
            <div className="stat-card label">Total Revenue ({MONTH_NAMES[month - 1]})</div>
            <div className="stat-card value" style={{ color: '#10b981' }}>Rs. {totalMonthRevenue.toLocaleString()}</div>
          </div>
          <div className="stat-card" style={{ borderLeft: '3px solid #ef4444' }}>
            <div className="stat-card label">Total Outstanding Debt</div>
            <div className="stat-card value" style={{ color: '#ef4444' }}>Rs. {totalOutstanding.toLocaleString()}</div>
          </div>
          <div className="stat-card" style={{ borderLeft: '3px solid var(--accent-purple)' }}>
            <div className="stat-card label">Students Owning Money</div>
            <div className="stat-card value" style={{ color: 'var(--accent-purple)' }}>{outstandingList.length}</div>
          </div>
        </div>

        {/* Revenue Breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
          <div className="glass-card" style={{ padding: 20 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16, color: 'var(--text-primary)' }}>
              Revenue by Class ({MONTH_NAMES[month - 1]})
            </div>
            {revenueByClass.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No payment data for this month.</div>
            ) : (
              revenueByClass.map(r => (
                <div key={r.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{CLASS_LABELS[r.name] || r.name}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#10b981' }}>Rs. {r.total.toLocaleString()}</span>
                </div>
              ))
            )}
          </div>

          <div className="glass-card" style={{ padding: 20 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16, color: 'var(--text-primary)' }}>
              Revenue by Payment Method ({MONTH_NAMES[month - 1]})
            </div>
            {revenueByType.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No payment data for this month.</div>
            ) : (
              revenueByType.map(r => (
                <div key={r.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span className={`badge pay-${r.name.toLowerCase()}`}>{r.name}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#10b981' }}>Rs. {r.total.toLocaleString()}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Outstanding Debts Table */}
        <div className="glass-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={16} /> Students with Outstanding Debt
            </div>
          </div>
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
              {outstandingList.map((item, idx) => (
                <tr key={`${item.ps_code}-${idx}`}>
                  <td>
                    <a href={`/students/${encodeURIComponent(item.ps_code)}`} style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontWeight: 600 }}>
                      {item.ps_code}
                    </a>
                  </td>
                  <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{item.full_name || '—'}</td>
                  <td>Gr {item.grade || '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{CLASS_LABELS[item.class_type] || item.class_type}</td>
                  <td style={{ color: '#ef4444', fontWeight: 700 }}>Rs. {Math.abs(item.current_balance).toLocaleString()}</td>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.address || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {outstandingList.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No outstanding debts recorded!</div>
          )}
        </div>
      </div>
    </div>
  )
}
