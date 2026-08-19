'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Search } from 'lucide-react'
import { CLASS_LABELS, MONTH_NAMES, Student, Enrollment, StudentBalance } from '@/lib/types'

const BANKS = ['BOC', 'Sampath', 'Commercial', 'HNB', 'People\'s Bank', 'NSB', 'Seylan', 'NTB', 'Other']

function AddPaymentForm() {
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [psSearch, setPsSearch] = useState(searchParams.get('ps') || '')
  const [student, setStudent] = useState<Student | null>(null)
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [balance, setBalance] = useState<StudentBalance | null>(null)
  const [memberName, setMemberName] = useState('')

  const [form, setForm] = useState({
    class_type: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    payment_type: 'BANK' as string,
    amount_paid: '',
    bank_name: 'BOC',
    date_paid: new Date().toISOString().slice(0, 10),
    added_to_group: false,
    notes: '',
  })

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // Auto-load if ps param present
  useEffect(() => {
    if (psSearch) searchStudent()
  }, [])

  async function searchStudent() {
    setStudent(null); setError('')
    const { data } = await supabase.from('students').select('*, household:households(*)').eq('ps_code', psSearch.trim().toUpperCase()).single()
    if (!data) { setError(`Student "${psSearch}" not found`); return }
    setStudent(data)
    const { data: enrols } = await supabase.from('enrollments').select('*').eq('student_id', data.id).eq('active', true)
    setEnrollments(enrols || [])
    if (enrols && enrols[0]) {
      setForm(f => ({ ...f, class_type: enrols[0].class_type }))
      loadBalance(data.id, enrols[0].class_type)
    }
  }

  async function loadBalance(studentId: string, classType: string) {
    const { data } = await supabase.from('student_balances')
      .select('*').eq('student_id', studentId).eq('class_type', classType).single()
    setBalance(data)
  }

  function onClassChange(classType: string) {
    setForm(f => ({ ...f, class_type: classType }))
    if (student) loadBalance(student.id, classType)
  }

  const enrol = enrollments.find(e => e.class_type === form.class_type)
  const suggestedAmount = enrol
    ? enrol.fee_amount - (balance?.current_balance || 0)
    : 0

  async function submit() {
    if (!student || !form.class_type) { setError('Select student and class'); return }
    if (!memberName.trim()) { setError('Enter your name (recorded by)'); return }
    if (form.payment_type === 'BANK' && !parseFloat(form.amount_paid)) {
      setError('Enter payment amount'); return
    }

    setSaving(true); setError('')
    try {
      const amountPaid = ['FREE','SIPSA'].includes(form.payment_type) ? 0 : parseFloat(form.amount_paid) || 0
      const amountDue = enrol?.fee_amount || 0
      const balanceBefore = balance?.current_balance || 0

      const { error: err } = await supabase.from('payments').upsert({
        student_id: student.id,
        class_type: form.class_type,
        month: form.month,
        year: form.year,
        amount_due: amountDue,
        amount_paid: amountPaid,
        balance_before: balanceBefore,
        payment_type: form.payment_type,
        bank_name: form.payment_type === 'BANK' ? form.bank_name : null,
        date_paid: form.payment_type !== 'FREE' ? form.date_paid : null,
        added_to_group: form.added_to_group,
        notes: form.notes || null,
        recorded_by: memberName.trim(),
      }, { onConflict: 'student_id,class_type,month,year' })

      if (err) throw err
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      loadBalance(student.id, form.class_type)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <a href="/students" className="btn-secondary" style={{ padding: '6px 10px' }}><ArrowLeft size={14} /></a>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Add Payment</h1>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>Record a student payment</div>
          </div>
        </div>
      </div>

      <div className="page-content" style={{ maxWidth: 640 }}>

        {/* Step 1: Find student */}
        <div className="glass-card" style={{ padding: 24, marginBottom: 20 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14, color: 'var(--accent-blue)' }}>
            1. Find Student
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input className="input-field" placeholder="PS code e.g. PS6359"
              value={psSearch} onChange={e => setPsSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchStudent()}
            />
            <button className="btn-primary" onClick={searchStudent}>
              <Search size={14} /> Search
            </button>
          </div>

          {error && <div style={{ marginTop: 12, color: 'var(--accent-red)', fontSize: 13 }}>⚠ {error}</div>}

          {student && (
            <div style={{ marginTop: 14, padding: 14, background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 600, color: '#10b981' }}>✓ Found: {student.ps_code}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                {student.full_name || 'No name set'} · Grade {student.grade || '?'} · {student.school || 'School not set'}
              </div>
              {(student.household as any)?.address && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  📍 {(student.household as any).address}
                </div>
              )}
            </div>
          )}
        </div>

        {student && (
          <>
            {/* Step 2: Payment details */}
            <div className="glass-card" style={{ padding: 24, marginBottom: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16, color: 'var(--accent-blue)' }}>
                2. Payment Details
              </div>

              <FormRow label="Class">
                <select className="input-field" value={form.class_type} onChange={e => onClassChange(e.target.value)}>
                  <option value="">Select class...</option>
                  {enrollments.map(e => (
                    <option key={e.class_type} value={e.class_type}>{CLASS_LABELS[e.class_type] || e.class_type} (Rs.{e.fee_amount})</option>
                  ))}
                </select>
              </FormRow>

              {balance && (
                <div style={{ padding: '10px 14px', background: '#0d1424', borderRadius: 8, marginBottom: 14, display: 'flex', gap: 20 }}>
                  <BalanceInfo label="Current Balance" value={balance.current_balance} />
                  <BalanceInfo label="Suggested Payment" value={suggestedAmount} suggested />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormRow label="Month">
                  <select className="input-field" value={form.month} onChange={e => setForm(f => ({ ...f, month: parseInt(e.target.value) }))}>
                    {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </FormRow>
                <FormRow label="Year">
                  <select className="input-field" value={form.year} onChange={e => setForm(f => ({ ...f, year: parseInt(e.target.value) }))}>
                    {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </FormRow>
              </div>

              <FormRow label="Payment Type">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {['BANK', 'CASH', 'FREE', 'SIPSA', 'PHYSICAL'].map(t => (
                    <button key={t} onClick={() => setForm(f => ({ ...f, payment_type: t }))}
                      className={form.payment_type === t ? 'btn-primary' : 'btn-secondary'}
                      style={{ padding: '6px 12px', fontSize: 12 }}>
                      {t}
                    </button>
                  ))}
                </div>
              </FormRow>

              {['BANK', 'CASH', 'PHYSICAL'].includes(form.payment_type) && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <FormRow label="Amount Paid (Rs.)">
                    <input className="input-field" type="number" placeholder={`Suggested: ${suggestedAmount}`}
                      value={form.amount_paid}
                      onChange={e => setForm(f => ({ ...f, amount_paid: e.target.value }))} />
                  </FormRow>
                  {form.payment_type === 'BANK' && (
                    <FormRow label="Bank">
                      <select className="input-field" value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))}>
                        {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </FormRow>
                  )}
                </div>
              )}

              <FormRow label="Date Paid">
                <input className="input-field" type="date" value={form.date_paid}
                  onChange={e => setForm(f => ({ ...f, date_paid: e.target.value }))} />
              </FormRow>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <input type="checkbox" id="group" checked={form.added_to_group}
                  onChange={e => setForm(f => ({ ...f, added_to_group: e.target.checked }))}
                  style={{ width: 16, height: 16, cursor: 'pointer' }} />
                <label htmlFor="group" style={{ fontSize: 13, cursor: 'pointer' }}>Added to WhatsApp Group?</label>
              </div>

              <FormRow label="Notes (optional)">
                <input className="input-field" placeholder="Any notes..."
                  value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </FormRow>
            </div>

            {/* Step 3: Who recorded */}
            <div className="glass-card" style={{ padding: 24, marginBottom: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14, color: 'var(--accent-blue)' }}>
                3. Recorded By
              </div>
              <input className="input-field" placeholder="Your name (member who checked this payment)"
                value={memberName} onChange={e => setMemberName(e.target.value)} />
            </div>

            {/* Submit */}
            <button className="btn-primary" onClick={submit} disabled={saving}
              style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 15 }}>
              {saving ? 'Saving...' : saved ? '✓ Payment Saved!' : '💾 Save Payment'}
            </button>
            {saved && (
              <div style={{ marginTop: 12, padding: '12px 16px', background: '#1a3a2a', borderRadius: 8, color: '#34d399', fontSize: 13 }}>
                ✓ Payment recorded successfully!
                <a href={`/students/${encodeURIComponent(student.ps_code)}`}
                  style={{ color: 'var(--accent-blue)', marginLeft: 12, textDecoration: 'none' }}>
                  View student profile →
                </a>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function AddPaymentPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: 'var(--text-muted)' }}>Loading...</div>}>
      <AddPaymentForm />
    </Suspense>
  )
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}

function BalanceInfo({ label, value, suggested }: { label: string; value: number; suggested?: boolean }) {
  const color = suggested ? '#3b82f6' : value < 0 ? '#ef4444' : value > 0 ? '#10b981' : 'var(--text-muted)'
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color }}>
        {value >= 0 ? '+' : ''}Rs.{value.toLocaleString()}
      </div>
    </div>
  )
}
