'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Plus, Printer, ExternalLink } from 'lucide-react'
import { Student, Payment, Enrollment, CLASS_LABELS, MONTH_NAMES } from '@/lib/types'

const MONTH_NUM_TO_NAME = (m: number) => MONTH_NAMES[m - 1] || '?'

export default function StudentDetailPage() {
  const { ps_code } = useParams<{ ps_code: string }>()
  const decodedCode = decodeURIComponent(ps_code)
  const supabase = createClient()

  const [student, setStudent] = useState<Student | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [balances, setBalances] = useState<any[]>([])
  const [householdSiblings, setHouseholdSiblings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Partial<Student>>({})

  useEffect(() => { if (decodedCode) load() }, [decodedCode])

  async function load() {
    setLoading(true)
    const { data: stu } = await supabase
      .from('students')
      .select('*, household:households(*)')
      .eq('ps_code', decodedCode)
      .single()

    if (stu) {
      setStudent(stu)
      setForm(stu)

      const [
        { data: pays },
        { data: enrols },
        { data: bals },
      ] = await Promise.all([
        supabase.from('payments').select('*').eq('student_id', stu.id).order('year').order('month'),
        supabase.from('enrollments').select('*').eq('student_id', stu.id),
        supabase.from('student_balances').select('*').eq('student_id', stu.id),
      ])
      setPayments(pays || [])
      setEnrollments(enrols || [])
      setBalances(bals || [])

      // Load household siblings
      if (stu.household_id) {
        const { data: siblings } = await supabase
          .from('students').select('id, ps_code, full_name, grade')
          .eq('household_id', stu.household_id)
          .neq('id', stu.id)
        setHouseholdSiblings(siblings || [])
      }
    }
    setLoading(false)
  }

  async function save() {
    if (!student) return
    await supabase.from('students').update({
      full_name: form.full_name,
      grade: form.grade,
      school: form.school,
      notes: form.notes,
      fcode_ref: form.fcode_ref,
    }).eq('id', student.id)
    setEditing(false)
    load()
  }

  function printAddress() {
    const hh = student?.household as any
    if (!hh?.address) { alert('No address stored for this student\'s household.'); return }
    const win = window.open('', '_blank')
    win?.document.write(`
      <html><head><title>Address Label</title>
      <style>
        body { font-family: Arial; display: flex; justify-content: center; padding: 40px; }
        .label { border: 2px solid #000; padding: 28px 36px; width: 340px; border-radius: 8px; }
        .to { font-size: 12px; color: #666; margin-bottom: 8px; }
        .name { font-size: 18px; font-weight: bold; margin-bottom: 6px; }
        .address { font-size: 15px; margin-bottom: 12px; line-height: 1.5; }
        .meta { font-size: 11px; color: #999; border-top: 1px solid #ddd; padding-top: 8px; }
      </style></head>
      <body onload="window.print()">
        <div class="label">
          <div class="to">To:</div>
          <div class="name">${hh.parent_name || student?.full_name || 'Student'}</div>
          <div class="address">${hh.address}</div>
          <div class="meta">
            ${student?.ps_code} · Grade ${student?.grade}
            ${householdSiblings.length > 0 ? `<br>Also: ${householdSiblings.map(s => s.full_name || s.ps_code).join(', ')}` : ''}
          </div>
        </div>
      </body></html>
    `)
  }

  if (loading) return <div style={{ padding: 40, color: 'var(--text-muted)' }}>Loading...</div>
  if (!student) return <div style={{ padding: 40, color: 'var(--accent-red)' }}>Student not found: {decodedCode}</div>

  const hh = student.household as any
  const totalPaid = balances.reduce((s, b) => s + b.total_paid, 0)
  const totalDue = balances.reduce((s, b) => s + b.total_due, 0)
  const totalBalance = balances.reduce((s, b) => s + b.current_balance, 0)

  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <a href="/students" className="btn-secondary" style={{ padding: '6px 10px' }}>
            <ArrowLeft size={14} />
          </a>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
              {student.ps_code}
              {student.full_name && <span style={{ fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 8 }}>· {student.full_name}</span>}
            </h1>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
              {student.grade ? `Grade ${student.grade}` : 'Grade not set'} · {student.school || 'School not set'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={printAddress} className="btn-secondary">
            <Printer size={14} /> Print Address
          </button>
          <a href={`/payments/add?ps=${encodeURIComponent(student.ps_code)}`} className="btn-primary">
            <Plus size={14} /> Add Payment
          </a>
        </div>
      </div>

      <div className="page-content">
        <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20 }}>
          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Student info */}
            <div className="glass-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Student Info</div>
                <button onClick={() => editing ? save() : setEditing(true)}
                  className={editing ? 'btn-primary' : 'btn-secondary'}
                  style={{ padding: '4px 10px', fontSize: 12 }}>
                  {editing ? '✓ Save' : '✏ Edit'}
                </button>
              </div>
              {editing ? (
                <>
                  <Input label="Full Name" value={form.full_name || ''} onChange={v => setForm(f => ({ ...f, full_name: v }))} />
                  <Input label="Grade" value={String(form.grade || '')} type="number" onChange={v => setForm(f => ({ ...f, grade: parseInt(v) }))} />
                  <Input label="School" value={form.school || ''} onChange={v => setForm(f => ({ ...f, school: v }))} />
                  <Input label="Notes" value={form.notes || ''} onChange={v => setForm(f => ({ ...f, notes: v }))} />
                </>
              ) : (
                <>
                  <Info label="PS Code" value={student.ps_code} />
                  <Info label="Full Name" value={student.full_name || 'Not set'} />
                  <Info label="Grade" value={student.grade ? `Grade ${student.grade}` : 'Not set'} />
                  <Info label="School" value={student.school || 'Not set'} />
                  {student.notes && <Info label="Notes" value={student.notes} />}
                </>
              )}
            </div>

            {/* Audit & Registration Info */}
            <div className="glass-card" style={{ padding: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14, color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: 8 }}>
                🔒 Registration Audit
              </div>
              <Info label="Registered By" value={student.created_by || 'Admin / System User'} />
              <Info label="Date Created" value={student.created_at ? new Date(student.created_at).toLocaleString() : 'Not recorded'} />
            </div>

            {/* Household */}
            <div className="glass-card" style={{ padding: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>🏠 Household</div>
              {hh ? (
                <>
                  <Info label="Parent/Guardian" value={hh.parent_name || 'Not set'} />
                  <Info label="Parent Phone" value={hh.parent_phone || 'Not set'} />
                  <Info label="Address" value={hh.address || 'Not set'} />
                  <Info label="Area" value={hh.area || 'Not set'} />
                  {householdSiblings.length > 0 && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>SIBLINGS IN SAME HOUSE</div>
                      {householdSiblings.map(s => (
                        <a key={s.id} href={`/students/${encodeURIComponent(s.ps_code)}`}
                          style={{ display: 'block', color: 'var(--accent-blue)', fontSize: 13, marginBottom: 4, textDecoration: 'none' }}>
                          {s.ps_code} · {s.full_name || 'No name'} (Gr {s.grade})
                        </a>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No household linked</div>
              )}
            </div>

            {/* Balance summary */}
            <div className="glass-card" style={{ padding: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>💰 Balance Summary</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
                <MiniStat label="Total Paid" value={`Rs.${totalPaid.toLocaleString()}`} color="#10b981" />
                <MiniStat label="Total Due" value={`Rs.${totalDue.toLocaleString()}`} color="#f59e0b" />
                <MiniStat label="Balance" value={`Rs.${totalBalance.toLocaleString()}`}
                  color={totalBalance < 0 ? '#ef4444' : totalBalance > 0 ? '#10b981' : 'var(--text-muted)'} />
              </div>
              {balances.map(b => (
                <div key={b.class_type} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{CLASS_LABELS[b.class_type] || b.class_type}</span>
                  <span className={b.current_balance < 0 ? 'balance-negative' : b.current_balance > 0 ? 'balance-positive' : 'balance-zero'}>
                    {b.current_balance >= 0 ? '+' : ''}Rs.{b.current_balance.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>

            {/* CRM Link */}
            <div className="glass-card" style={{ padding: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>🔗 CRM Link (Optional)</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {editing ? (
                  <input className="input-field" placeholder="F-code e.g. F70000"
                    value={form.fcode_ref || ''}
                    onChange={e => setForm(f => ({ ...f, fcode_ref: e.target.value }))} />
                ) : (
                  <div style={{ fontSize: 13 }}>
                    {student.fcode_ref ? (
                      <a href={`/leads/${student.fcode_ref}`} style={{ color: 'var(--accent-purple)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <ExternalLink size={13} /> {student.fcode_ref}
                      </a>
                    ) : <span style={{ color: 'var(--text-muted)' }}>Not linked to CRM</span>}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right column — Payment Ledger */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {enrollments.length > 0 ? enrollments.map(enrol => {
              const enrolPayments = payments.filter(p => p.class_type === enrol.class_type)
              const balance = balances.find(b => b.class_type === enrol.class_type)

              return (
                <div key={enrol.id} className="glass-card" style={{ overflow: 'hidden' }}>
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{CLASS_LABELS[enrol.class_type] || enrol.class_type}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {enrol.tier} · Fee: Rs.{enrol.fee_amount.toLocaleString()} · {enrol.active ? '✅ Active' : '⏹ Inactive'}
                      </div>
                    </div>
                    {balance && (
                      <div style={{ textAlign: 'right' }}>
                        <div className={balance.current_balance < 0 ? 'balance-negative' : balance.current_balance > 0 ? 'balance-positive' : 'balance-zero'}
                          style={{ fontWeight: 700, fontSize: 16 }}>
                          {balance.current_balance >= 0 ? '+' : ''}Rs.{balance.current_balance.toLocaleString()}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>current balance</div>
                      </div>
                    )}
                  </div>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th>Due</th>
                        <th>Paid</th>
                        <th>Balance</th>
                        <th>Type</th>
                        <th>Bank</th>
                        <th>Date</th>
                        <th>Group</th>
                      </tr>
                    </thead>
                    <tbody>
                      {enrolPayments.map(p => (
                        <tr key={p.id}>
                          <td style={{ fontWeight: 500 }}>{MONTH_NUM_TO_NAME(p.month)} {p.year}</td>
                          <td style={{ color: 'var(--text-muted)' }}>Rs.{(p.amount_due || 0).toLocaleString()}</td>
                          <td style={{ color: '#10b981', fontWeight: 500 }}>
                            {['FREE','IMS','SIPSA'].includes(p.payment_type || '') ? p.payment_type : `Rs.${p.amount_paid.toLocaleString()}`}
                          </td>
                          <td className={p.balance_after < 0 ? 'balance-negative' : p.balance_after > 0 ? 'balance-positive' : 'balance-zero'}>
                            {p.balance_after >= 0 ? '+' : ''}Rs.{p.balance_after.toLocaleString()}
                          </td>
                          <td>
                            <span className={`badge pay-${(p.payment_type || 'other').toLowerCase()}`}>
                              {p.payment_type}
                            </span>
                          </td>
                          <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{p.bank_name || '—'}</td>
                          <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{p.date_paid || '—'}</td>
                          <td style={{ textAlign: 'center', color: p.added_to_group ? '#10b981' : 'var(--text-muted)' }}>
                            {p.added_to_group ? '✓' : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {enrolPayments.length === 0 && (
                    <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                      No payments recorded yet
                    </div>
                  )}
                </div>
              )
            }) : (
              <div className="glass-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                <div style={{ marginBottom: 12 }}>No class enrollments found</div>
                <a href={`/payments/add?ps=${encodeURIComponent(student.ps_code)}`} className="btn-primary">
                  <Plus size={14} /> Add First Payment
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ fontSize: 13, marginTop: 2 }}>{value}</div>
    </div>
  )
}

function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>{label}</label>
      <input className="input-field" type={type} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  )
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '8px', background: 'var(--bg-base)', borderRadius: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
    </div>
  )
}
