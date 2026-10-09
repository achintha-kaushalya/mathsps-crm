'use client'

import { useState, useMemo } from 'react'
import {
  AlertTriangle,
  FileSpreadsheet,
  Search,
  Phone,
  MessageSquare,
  Clock,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  DollarSign,
  TrendingDown,
  Users
} from 'lucide-react'
import { exportTableToCsv, sanitizePhoneForWhatsApp, TARGET_GRADES } from '@/lib/reports-analytics'
import { CLASS_LABELS } from '@/lib/types'

interface DebtAgingItem {
  id: string
  student_id: string
  ps_code: string
  full_name: string
  grade: number
  class_type: string
  current_balance: number
  last_payment_date: string | null
  parent_name?: string
  parent_phone?: string
  address?: string
  daysOverdue: number
  bucket: '1_7' | '8_15' | '15_plus' | 'current'
}

interface DebtAgingTabProps {
  outstandingList: any[]
  courseLabels?: Record<string, string>
  loading?: boolean
}

export default function DebtAgingTab({
  outstandingList,
  courseLabels = {},
  loading = false
}: DebtAgingTabProps) {
  const [searchDebt, setSearchDebt] = useState('')
  const [selectedBucket, setSelectedBucket] = useState<'ALL' | '1_7' | '8_15' | '15_plus'>('ALL')
  const [selectedGrade, setSelectedGrade] = useState<string>('ALL')

  // Process and compute aging buckets for every debtor
  const processedDebtors = useMemo(() => {
    const today = new Date()
    
    return outstandingList.map(d => {
      const debtAmount = Math.abs(Number(d.current_balance || 0))
      let daysOverdue = 0
      
      if (d.last_payment_date) {
        const lastPay = new Date(d.last_payment_date)
        const diffMs = today.getTime() - lastPay.getTime()
        daysOverdue = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
      } else {
        // If never paid or record created, default to 30+ days overdue
        daysOverdue = 35
      }

      let bucket: '1_7' | '8_15' | '15_plus' | 'current' = '15_plus'
      if (daysOverdue <= 7) bucket = '1_7'
      else if (daysOverdue <= 15) bucket = '8_15'
      else bucket = '15_plus'

      return {
        ...d,
        current_balance: debtAmount,
        daysOverdue,
        bucket
      } as DebtAgingItem
    })
  }, [outstandingList])

  // Bucket statistics
  const bucketStats = useMemo(() => {
    let b1_7Count = 0, b1_7Amount = 0
    let b8_15Count = 0, b8_15Amount = 0
    let b15PlusCount = 0, b15PlusAmount = 0
    let totalDebt = 0

    processedDebtors.forEach(d => {
      totalDebt += d.current_balance
      if (d.bucket === '1_7') {
        b1_7Count++
        b1_7Amount += d.current_balance
      } else if (d.bucket === '8_15') {
        b8_15Count++
        b8_15Amount += d.current_balance
      } else {
        b15PlusCount++
        b15PlusAmount += d.current_balance
      }
    })

    return {
      totalDebt,
      totalCount: processedDebtors.length,
      b1_7: { count: b1_7Count, amount: b1_7Amount },
      b8_15: { count: b8_15Count, amount: b8_15Amount },
      b15Plus: { count: b15PlusCount, amount: b15PlusAmount }
    }
  }, [processedDebtors])

  // Filter debtors by bucket, grade, search
  const filteredDebtors = useMemo(() => {
    return processedDebtors.filter(d => {
      if (selectedBucket !== 'ALL' && d.bucket !== selectedBucket) return false
      if (selectedGrade !== 'ALL' && String(d.grade) !== selectedGrade) return false
      if (searchDebt.trim()) {
        const q = searchDebt.toLowerCase()
        const match =
          (d.ps_code || '').toLowerCase().includes(q) ||
          (d.full_name || '').toLowerCase().includes(q) ||
          (d.parent_name || '').toLowerCase().includes(q) ||
          (d.parent_phone || '').toLowerCase().includes(q) ||
          (d.address || '').toLowerCase().includes(q)
        if (!match) return false
      }
      return true
    }).sort((a, b) => b.current_balance - a.current_balance) // sort by largest debt
  }, [processedDebtors, selectedBucket, selectedGrade, searchDebt])

  // Top 10 largest debtors for instant high-priority recovery action
  const top10Debtors = useMemo(() => {
    return [...processedDebtors]
      .sort((a, b) => b.current_balance - a.current_balance)
      .slice(0, 10)
  }, [processedDebtors])

  return (
    <div className="fade-in">
      {/* 1. Header & Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div className="stat-card" style={{ borderLeft: '4px solid #ef4444', boxShadow: '0 4px 20px -4px rgba(239, 68, 68, 0.25)' }}>
          <div className="stat-card label">Total Unpaid Fee Portfolio</div>
          <div className="stat-card value" style={{ color: '#ef4444', fontSize: 24 }}>
            Rs. {bucketStats.totalDebt.toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Across {bucketStats.totalCount} student ledger records
          </div>
        </div>

        {/* 1 - 7 Days Aging Card */}
        <div
          onClick={() => setSelectedBucket(selectedBucket === '1_7' ? 'ALL' : '1_7')}
          className="stat-card"
          style={{
            borderLeft: '4px solid #f59e0b',
            cursor: 'pointer',
            background: selectedBucket === '1_7' ? 'rgba(245, 158, 11, 0.08)' : undefined,
            boxShadow: '0 4px 20px -4px rgba(245, 158, 11, 0.2)'
          }}
        >
          <div className="stat-card label" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>🟡 1–7 Days Overdue</span>
            {selectedBucket === '1_7' && <span className="badge" style={{ fontSize: 10, background: '#f59e0b', color: '#fff' }}>ACTIVE</span>}
          </div>
          <div className="stat-card value" style={{ color: '#f59e0b', fontSize: 22 }}>
            Rs. {bucketStats.b1_7.amount.toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            {bucketStats.b1_7.count} students (Recent Grace Period)
          </div>
        </div>

        {/* 8 - 15 Days Aging Card */}
        <div
          onClick={() => setSelectedBucket(selectedBucket === '8_15' ? 'ALL' : '8_15')}
          className="stat-card"
          style={{
            borderLeft: '4px solid #ea580c',
            cursor: 'pointer',
            background: selectedBucket === '8_15' ? 'rgba(234, 88, 12, 0.08)' : undefined,
            boxShadow: '0 4px 20px -4px rgba(234, 88, 12, 0.2)'
          }}
        >
          <div className="stat-card label" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>🟠 8–15 Days Overdue</span>
            {selectedBucket === '8_15' && <span className="badge" style={{ fontSize: 10, background: '#ea580c', color: '#fff' }}>ACTIVE</span>}
          </div>
          <div className="stat-card value" style={{ color: '#ea580c', fontSize: 22 }}>
            Rs. {bucketStats.b8_15.amount.toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            {bucketStats.b8_15.count} students (Mid-Month Follow-up Required)
          </div>
        </div>

        {/* 15+ Days Aging Card */}
        <div
          onClick={() => setSelectedBucket(selectedBucket === '15_plus' ? 'ALL' : '15_plus')}
          className="stat-card"
          style={{
            borderLeft: '4px solid #dc2626',
            cursor: 'pointer',
            background: selectedBucket === '15_plus' ? 'rgba(220, 38, 38, 0.08)' : undefined,
            boxShadow: '0 4px 20px -4px rgba(220, 38, 38, 0.25)'
          }}
        >
          <div className="stat-card label" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>🔴 15+ Days High Risk</span>
            {selectedBucket === '15_plus' && <span className="badge" style={{ fontSize: 10, background: '#dc2626', color: '#fff' }}>ACTIVE</span>}
          </div>
          <div className="stat-card value" style={{ color: '#dc2626', fontSize: 22 }}>
            Rs. {bucketStats.b15Plus.amount.toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            {bucketStats.b15Plus.count} students (Urgent Call Escalation)
          </div>
        </div>
      </div>

      {/* 2. Top 10 High-Priority Recovery List (1-Click WhatsApp) */}
      <div className="glass-card" style={{ padding: 20, marginBottom: 20, borderLeft: '4px solid #ef4444' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldAlert size={18} />
              🚨 Top 10 High-Priority Overdue Accounts (Instant Recovery)
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Reach out directly to these highest-balance accounts with pre-filled WhatsApp reminder templates.
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
          {top10Debtors.map((d, index) => {
            const rawPhone = d.parent_phone || ''
            const waPhone = sanitizePhoneForWhatsApp(rawPhone)
            const waMsg = encodeURIComponent(`Hello ${d.parent_name || 'Parent'}, gentle reminder regarding MathsPS fee balance of Rs. ${d.current_balance.toLocaleString()} for student ${d.full_name} (${d.ps_code}). Kindly send us the payment slip once completed. Thank you!`)

            return (
              <div key={d.id || index} style={{
                background: 'var(--bg-base)',
                borderRadius: 10,
                padding: 14,
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 10
              }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div>
                      <a href={`/students/${encodeURIComponent(d.ps_code)}`} target="_blank" rel="noreferrer" style={{ fontWeight: 800, fontSize: 14, color: 'var(--accent-blue)', textDecoration: 'none' }}>
                        {d.ps_code}
                      </a>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginLeft: 6 }}>
                        {d.full_name}
                      </span>
                    </div>
                    <span className="badge" style={{
                      background: d.bucket === '15_plus' ? 'rgba(220,38,38,0.15)' : 'rgba(245,158,11,0.15)',
                      color: d.bucket === '15_plus' ? '#dc2626' : '#f59e0b',
                      fontSize: 11,
                      fontWeight: 700
                    }}>
                      {d.daysOverdue}d Overdue
                    </span>
                  </div>

                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>
                    Grade {d.grade || '—'} · {courseLabels[d.class_type] || CLASS_LABELS[d.class_type] || d.class_type}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Parent: <strong style={{ color: 'var(--text-primary)' }}>{d.parent_name || '—'}</strong> ({rawPhone || 'No Phone'})
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: '#ef4444' }}>
                    Rs. {d.current_balance.toLocaleString()}
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    {waPhone ? (
                      <a
                        href={`https://wa.me/${waPhone}?text=${waMsg}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-primary"
                        style={{
                          padding: '4px 8px',
                          fontSize: 11,
                          background: '#10b981',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          textDecoration: 'none'
                        }}
                      >
                        <MessageSquare size={12} /> WhatsApp
                      </a>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>No Phone</span>
                    )}

                    <a
                      href={`/students/${encodeURIComponent(d.ps_code)}`}
                      className="btn-secondary"
                      style={{ padding: '4px 8px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 3 }}
                    >
                      View <ExternalLink size={10} />
                    </a>
                  </div>
                </div>
              </div>
            )
          })}

          {top10Debtors.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: '#10b981', gridColumn: '1 / -1' }}>
              🎉 Zero student accounts currently in debt.
            </div>
          )}
        </div>
      </div>

      {/* 3. Comprehensive Debtor Ledger & Advanced Filters */}
      <div className="glass-card" style={{ padding: 18, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Aging Bucket Filter */}
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                Aging Bucket
              </label>
              <select
                className="input-field"
                style={{ width: 170 }}
                value={selectedBucket}
                onChange={e => setSelectedBucket(e.target.value as any)}
              >
                <option value="ALL">All Aging Buckets ({processedDebtors.length})</option>
                <option value="1_7">🟡 1–7 Days ({bucketStats.b1_7.count})</option>
                <option value="8_15">🟠 8–15 Days ({bucketStats.b8_15.count})</option>
                <option value="15_plus">🔴 15+ Days ({bucketStats.b15Plus.count})</option>
              </select>
            </div>

            {/* Grade Filter */}
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                Grade Level
              </label>
              <select
                className="input-field"
                style={{ width: 120 }}
                value={selectedGrade}
                onChange={e => setSelectedGrade(e.target.value)}
              >
                <option value="ALL">All Grades</option>
                {TARGET_GRADES.map(g => (
                  <option key={g} value={String(g)}>Grade {g}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Export CSV Button */}
          <div>
            <button
              type="button"
              disabled={filteredDebtors.length === 0}
              onClick={() => {
                const headers = ['PS CODE', 'STUDENT NAME', 'GRADE', 'CLASS', 'OUTSTANDING DEBT (RS)', 'DAYS OVERDUE', 'AGING BUCKET', 'PARENT NAME', 'PHONE', 'ADDRESS']
                const rows = filteredDebtors.map(d => [
                  `"${d.ps_code}"`,
                  `"${(d.full_name || '').replace(/"/g, '""')}"`,
                  `"Grade ${d.grade || '?'}"`,
                  `"${courseLabels[d.class_type] || CLASS_LABELS[d.class_type] || d.class_type}"`,
                  `"${d.current_balance}"`,
                  `"${d.daysOverdue} Days"`,
                  `"${d.bucket === '1_7' ? '1-7 Days' : d.bucket === '8_15' ? '8-15 Days' : '15+ Days'}"`,
                  `"${(d.parent_name || '').replace(/"/g, '""')}"`,
                  `"${(d.parent_phone || '').replace(/"/g, '""')}"`,
                  `"${(d.address || '').replace(/"/g, '""')}"`
                ])
                exportTableToCsv(`MathsPS_Debt_Aging_Recovery_Register_${new Date().toISOString().slice(0, 10)}`, headers, rows)
              }}
              className="btn-primary"
              style={{ background: '#ef4444', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <FileSpreadsheet size={16} /> Export Recovery Register CSV
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input-field"
            style={{ paddingLeft: 36, width: '100%' }}
            placeholder="Search debtor by PS Code, Student Name, Phone, Address..."
            value={searchDebt}
            onChange={e => setSearchDebt(e.target.value)}
          />
        </div>
      </div>

      {/* 4. Complete Debtor Register Table */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingDown size={16} />
            Outstanding Fee Ledger ({filteredDebtors.length} Debtor Records)
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Total Filtered Unpaid: <strong style={{ color: '#ef4444' }}>Rs. {filteredDebtors.reduce((sum, d) => sum + d.current_balance, 0).toLocaleString()}</strong>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>PS Code</th>
                <th>Student Name</th>
                <th>Grade &amp; Class</th>
                <th style={{ textAlign: 'right' }}>Debt Amount</th>
                <th style={{ textAlign: 'center' }}>Aging / Days</th>
                <th>Parent &amp; Contact</th>
                <th>Address</th>
                <th style={{ textAlign: 'center', width: 140 }}>Quick Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredDebtors.map(d => {
                const rawPhone = d.parent_phone || ''
                const waPhone = sanitizePhoneForWhatsApp(rawPhone)
                const waMsg = encodeURIComponent(`Hello ${d.parent_name || 'Parent'}, gentle reminder regarding MathsPS fee balance of Rs. ${d.current_balance.toLocaleString()} for student ${d.full_name} (${d.ps_code}). Kindly send us the payment slip once completed. Thank you!`)

                return (
                  <tr key={d.id}>
                    <td>
                      <a href={`/students/${encodeURIComponent(d.ps_code)}`} style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontWeight: 800 }}>
                        {d.ps_code}
                      </a>
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {d.full_name || '—'}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      <span className="badge" style={{ marginRight: 6 }}>Grade {d.grade || '—'}</span>
                      {courseLabels[d.class_type] || CLASS_LABELS[d.class_type] || d.class_type}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: '#ef4444' }}>
                      Rs. {d.current_balance.toLocaleString()}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge" style={{
                        background: d.bucket === '15_plus' ? 'rgba(220,38,38,0.15)' : d.bucket === '8_15' ? 'rgba(234,88,12,0.15)' : 'rgba(245,158,11,0.15)',
                        color: d.bucket === '15_plus' ? '#dc2626' : d.bucket === '8_15' ? '#ea580c' : '#f59e0b',
                        fontWeight: 700
                      }}>
                        {d.daysOverdue} Days
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{d.parent_name || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{rawPhone || 'No Phone'}</div>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {d.address || '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        {waPhone && (
                          <a
                            href={`https://wa.me/${waPhone}?text=${waMsg}`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-primary"
                            style={{ padding: '3px 8px', fontSize: 11, background: '#10b981', display: 'inline-flex', alignItems: 'center', gap: 3, textDecoration: 'none' }}
                            title="Send WhatsApp Payment Reminder"
                          >
                            <MessageSquare size={12} /> WA
                          </a>
                        )}
                        <a
                          href={`/students/${encodeURIComponent(d.ps_code)}`}
                          className="btn-secondary"
                          style={{ padding: '3px 8px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 3 }}
                        >
                          Profile
                        </a>
                      </div>
                    </td>
                  </tr>
                )
              })}

              {filteredDebtors.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
                    No outstanding debtors found matching your filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
