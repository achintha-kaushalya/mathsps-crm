'use client'

import { useState, useMemo } from 'react'
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Search,
  ExternalLink,
  Users,
  Phone,
  Truck,
  Hash,
  Copy,
  Check,
  Filter
} from 'lucide-react'
import { exportTableToCsv, sanitizePhoneForWhatsApp, TARGET_GRADES } from '@/lib/reports-analytics'
import { extractLmsNumber } from '@/lib/types'

interface DataQualityAuditTabProps {
  allPaymentsMonth: any[]
  dailyPayments: any[]
  newStudents: any[]
  loading?: boolean
}

export default function DataQualityAuditTab({
  allPaymentsMonth,
  dailyPayments,
  newStudents,
  loading = false
}: DataQualityAuditTabProps) {
  const [activeQualityTab, setActiveQualityTab] = useState<'missing_lms' | 'missing_phone' | 'duplicate_phones' | 'undelivered_tutes'>('missing_lms')
  const [searchQuery, setSearchQuery] = useState('')

  // 1. Audit: Missing LMS numbers across students who paid this month
  const missingLmsStudents = useMemo(() => {
    const map = new Map<string, any>()
    allPaymentsMonth.forEach(p => {
      const s = p.students
      if (!s) return
      const lmsNum = extractLmsNumber(s)
      if (!lmsNum || lmsNum.trim().length === 0) {
        if (!map.has(s.ps_code || s.id)) {
          map.set(s.ps_code || s.id, {
            ps_code: s.ps_code,
            full_name: s.full_name || 'Student',
            grade: s.grade,
            parent_name: s.household?.parent_name || '—',
            parent_phone: s.household?.parent_phone || '—',
            created_at: s.created_at,
            paymentsCount: 1,
            amountPaid: Number(p.amount_paid || 0)
          })
        } else {
          const item = map.get(s.ps_code || s.id)
          item.paymentsCount += 1
          item.amountPaid += Number(p.amount_paid || 0)
        }
      }
    })
    return Array.from(map.values())
  }, [allPaymentsMonth])

  // 2. Audit: Missing household phone numbers
  const missingPhoneStudents = useMemo(() => {
    const map = new Map<string, any>()
    allPaymentsMonth.forEach(p => {
      const s = p.students
      if (!s) return
      const phone = s.household?.parent_phone || ''
      if (!phone || phone.trim().length < 9) {
        if (!map.has(s.ps_code || s.id)) {
          map.set(s.ps_code || s.id, {
            ps_code: s.ps_code,
            full_name: s.full_name || 'Student',
            grade: s.grade,
            parent_name: s.household?.parent_name || '—',
            address: s.household?.address || '—',
            created_at: s.created_at
          })
        }
      }
    })
    return Array.from(map.values())
  }, [allPaymentsMonth])

  // 3. Audit: Duplicate parent phone numbers (different PS codes sharing same phone number)
  const duplicatePhoneGroups = useMemo(() => {
    const phoneMap = new Map<string, any[]>()
    allPaymentsMonth.forEach(p => {
      const s = p.students
      if (!s) return
      const phone = (s.household?.parent_phone || '').trim().replace(/[^0-9]/g, '')
      if (phone && phone.length >= 9) {
        if (!phoneMap.has(phone)) {
          phoneMap.set(phone, [])
        }
        const list = phoneMap.get(phone)!
        if (!list.some(existing => existing.ps_code === s.ps_code)) {
          list.push({
            ps_code: s.ps_code,
            full_name: s.full_name,
            grade: s.grade,
            parent_name: s.household?.parent_name
          })
        }
      }
    })

    const dups: { phone: string; students: any[] }[] = []
    phoneMap.forEach((students, phone) => {
      if (students.length > 1) {
        dups.push({ phone, students })
      }
    })
    return dups
  }, [allPaymentsMonth])

  // 4. Audit: Payments with tute_delivered = true but not yet marked dispatched in dispatch batch
  const undeliveredTutesList = useMemo(() => {
    return allPaymentsMonth.filter(p => {
      const notes = p.notes || ''
      const isDispatched = notes.includes('[DISPATCHED:')
      return p.tute_delivered === true && !isDispatched
    })
  }, [allPaymentsMonth])

  return (
    <div className="fade-in">
      {/* 1. Quality Scanner Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
        {/* Missing LMS Card */}
        <div
          onClick={() => setActiveQualityTab('missing_lms')}
          className="stat-card"
          style={{
            borderLeft: '4px solid #f59e0b',
            cursor: 'pointer',
            background: activeQualityTab === 'missing_lms' ? 'rgba(245, 158, 11, 0.08)' : undefined,
            boxShadow: '0 4px 20px -4px rgba(245, 158, 11, 0.2)'
          }}
        >
          <div className="stat-card label" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Missing LMS Number</span>
            {activeQualityTab === 'missing_lms' && <span className="badge" style={{ fontSize: 10, background: '#f59e0b', color: '#fff' }}>VIEWING</span>}
          </div>
          <div className="stat-card value" style={{ color: '#f59e0b', fontSize: 24 }}>
            {missingLmsStudents.length} Students
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Paid this month but LMS number not registered
          </div>
        </div>

        {/* Missing Phone Card */}
        <div
          onClick={() => setActiveQualityTab('missing_phone')}
          className="stat-card"
          style={{
            borderLeft: '4px solid #ef4444',
            cursor: 'pointer',
            background: activeQualityTab === 'missing_phone' ? 'rgba(239, 68, 68, 0.08)' : undefined,
            boxShadow: '0 4px 20px -4px rgba(239, 68, 68, 0.25)'
          }}
        >
          <div className="stat-card label" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Missing Household Phone</span>
            {activeQualityTab === 'missing_phone' && <span className="badge" style={{ fontSize: 10, background: '#ef4444', color: '#fff' }}>VIEWING</span>}
          </div>
          <div className="stat-card value" style={{ color: '#ef4444', fontSize: 24 }}>
            {missingPhoneStudents.length} Students
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Incomplete contact profile in database
          </div>
        </div>

        {/* Shared / Duplicate Phone Numbers */}
        <div
          onClick={() => setActiveQualityTab('duplicate_phones')}
          className="stat-card"
          style={{
            borderLeft: '4px solid #8b5cf6',
            cursor: 'pointer',
            background: activeQualityTab === 'duplicate_phones' ? 'rgba(139, 92, 246, 0.08)' : undefined,
            boxShadow: '0 4px 20px -4px rgba(139, 92, 246, 0.2)'
          }}
        >
          <div className="stat-card label" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Shared Phone / Sibling Links</span>
            {activeQualityTab === 'duplicate_phones' && <span className="badge" style={{ fontSize: 10, background: '#8b5cf6', color: '#fff' }}>VIEWING</span>}
          </div>
          <div className="stat-card value" style={{ color: '#8b5cf6', fontSize: 24 }}>
            {duplicatePhoneGroups.length} Phone Numbers
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Shared across 2 or more student codes
          </div>
        </div>

        {/* Undispatched Tutes */}
        <div
          onClick={() => setActiveQualityTab('undelivered_tutes')}
          className="stat-card"
          style={{
            borderLeft: '4px solid #3b82f6',
            cursor: 'pointer',
            background: activeQualityTab === 'undelivered_tutes' ? 'rgba(59, 130, 246, 0.08)' : undefined,
            boxShadow: '0 4px 20px -4px rgba(59, 130, 246, 0.2)'
          }}
        >
          <div className="stat-card label" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Tute Delivery Pipeline</span>
            {activeQualityTab === 'undelivered_tutes' && <span className="badge" style={{ fontSize: 10, background: '#3b82f6', color: '#fff' }}>VIEWING</span>}
          </div>
          <div className="stat-card value" style={{ color: '#3b82f6', fontSize: 24 }}>
            {undeliveredTutesList.length} Slips
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Paid with tute delivery enabled (Pending dispatch)
          </div>
        </div>
      </div>

      {/* 2. Sub-tab Detail View */}
      {activeQualityTab === 'missing_lms' && (
        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={18} />
                Paid Students with Missing LMS Numbers ({missingLmsStudents.length} Students)
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                These students paid fees this month but cannot receive LMS video access until their LMS mobile number is recorded.
              </div>
            </div>

            <button
              type="button"
              disabled={missingLmsStudents.length === 0}
              onClick={() => {
                const headers = ['PS CODE', 'STUDENT NAME', 'GRADE', 'PARENT NAME', 'PARENT PHONE', 'TOTAL AMOUNT PAID (RS)']
                const rows = missingLmsStudents.map(s => [
                  `"${s.ps_code}"`,
                  `"${(s.full_name || '').replace(/"/g, '""')}"`,
                  `"Grade ${s.grade || '?'}"`,
                  `"${(s.parent_name || '').replace(/"/g, '""')}"`,
                  `"${(s.parent_phone || '').replace(/"/g, '""')}"`,
                  `"${s.amountPaid}"`
                ])
                exportTableToCsv(`Missing_LMS_Numbers_${new Date().toISOString().slice(0, 10)}`, headers, rows)
              }}
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <FileSpreadsheet size={15} /> Export Audit List
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>PS Code</th>
                  <th>Student Name</th>
                  <th>Grade</th>
                  <th>Parent Contact</th>
                  <th style={{ textAlign: 'right' }}>Fees Paid</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {missingLmsStudents.map(s => {
                  const rawPhone = s.parent_phone || ''
                  const waPhone = sanitizePhoneForWhatsApp(rawPhone)
                  const waMsg = encodeURIComponent(`Hello ${s.parent_name || 'Parent'}, we received your payment for ${s.full_name} (${s.ps_code}). Please send us your LMS registered mobile number so we can activate your online video class access. Thank you!`)

                  return (
                    <tr key={s.ps_code}>
                      <td>
                        <a href={`/students/${encodeURIComponent(s.ps_code)}`} style={{ color: 'var(--accent-blue)', fontWeight: 800, textDecoration: 'none' }}>
                          {s.ps_code}
                        </a>
                      </td>
                      <td style={{ fontWeight: 600 }}>{s.full_name}</td>
                      <td>Grade {s.grade || '—'}</td>
                      <td>
                        <div>{s.parent_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{rawPhone}</div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                        Rs. {s.amountPaid.toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          {waPhone && (
                            <a
                              href={`https://wa.me/${waPhone}?text=${waMsg}`}
                              target="_blank"
                              rel="noreferrer"
                              className="btn-primary"
                              style={{ padding: '3px 8px', fontSize: 11, background: '#10b981', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
                            >
                              Request LMS No
                            </a>
                          )}
                          <a href={`/students/${encodeURIComponent(s.ps_code)}`} className="btn-secondary" style={{ padding: '3px 8px', fontSize: 11 }}>
                            Edit
                          </a>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Duplicate / Sibling Phone Groups View */}
      {activeQualityTab === 'duplicate_phones' && (
        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#8b5cf6', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={18} />
            Shared Phone Numbers / Sibling Groupings ({duplicatePhoneGroups.length} Groups)
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
            {duplicatePhoneGroups.map((grp, idx) => (
              <div key={idx} style={{ padding: 14, background: 'var(--bg-base)', borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontWeight: 800, color: 'var(--accent-blue)', fontSize: 14 }}>
                    📞 {grp.phone}
                  </span>
                  <span className="badge" style={{ background: 'rgba(139,92,246,0.15)', color: '#8b5cf6', fontWeight: 700 }}>
                    {grp.students.length} Linked Students
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {grp.students.map((st: any) => (
                    <div key={st.ps_code} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
                      <a href={`/students/${encodeURIComponent(st.ps_code)}`} style={{ fontWeight: 700, color: 'var(--accent-blue)', textDecoration: 'none' }}>
                        {st.ps_code} ({st.full_name})
                      </a>
                      <span style={{ color: 'var(--text-muted)' }}>Grade {st.grade || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
