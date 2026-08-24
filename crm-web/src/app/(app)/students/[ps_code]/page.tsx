'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Plus, Printer, ExternalLink, Trash2, Edit2, Shield, Home, Phone, MapPin, UserCheck } from 'lucide-react'
import { Student, Payment, Enrollment, CLASS_LABELS, MONTH_NAMES } from '@/lib/types'

const MONTH_NUM_TO_NAME = (m: number) => MONTH_NAMES[m - 1] || '?'

export default function StudentDetailPage() {
  const { ps_code } = useParams<{ ps_code: string }>()
  const decodedCode = decodeURIComponent(ps_code)
  const supabase = createClient()
  const router = useRouter()

  const [student, setStudent] = useState<Student | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [balances, setBalances] = useState<any[]>([])
  const [householdSiblings, setHouseholdSiblings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Student Edit State
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Partial<Student>>({})
  const [savingStudent, setSavingStudent] = useState(false)

  // Household / Address / Parent Contact Edit State
  const [editingHousehold, setEditingHousehold] = useState(false)
  const [parentNameInput, setParentNameInput] = useState('')
  const [parentPhoneInput, setParentPhoneInput] = useState('')
  const [addressInput, setAddressInput] = useState('')
  const [areaInput, setAreaInput] = useState('')
  const [savingHousehold, setSavingHousehold] = useState(false)

  // User Role & Name
  const [userRole, setUserRole] = useState<'member' | 'admin' | 'owner'>('member')
  const [currentUserName, setCurrentUserName] = useState('')

  // Edit payment modal state
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null)
  const [editAmountPaid, setEditAmountPaid] = useState<string>('')
  const [editPaymentType, setEditPaymentType] = useState<string>('BANK')
  const [editBankName, setEditBankName] = useState<string>('BOC')
  const [editDatePaid, setEditDatePaid] = useState<string>('')
  const [editAddedGroup, setEditAddedGroup] = useState<boolean>(false)
  const [editTuteDelivered, setEditTuteDelivered] = useState<boolean>(false)
  const [savingPayment, setSavingPayment] = useState<boolean>(false)

  const isAdmin = userRole === 'admin' || userRole === 'owner' || (currentUserName && currentUserName.toLowerCase().includes('admin'))

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        let name = user.user_metadata?.full_name || user.email?.split('@')[0] || ''
        let role: 'member' | 'admin' | 'owner' = 'member'
        if (user.email) {
          const { data: dbMem } = await supabase.from('members').select('name, role').eq('email', user.email).single()
          if (dbMem?.name) name = dbMem.name
          if (dbMem?.role) role = dbMem.role as any
        }
        if (user.email?.toLowerCase().includes('admin')) {
          role = 'admin'
        }
        setCurrentUserName(name)
        setUserRole(role)
      }
    })
  }, [])

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

      const hh = stu.household as any || {}
      setParentNameInput(hh.parent_name || '')
      setParentPhoneInput(hh.parent_phone || '')
      setAddressInput(hh.address || '')
      setAreaInput(hh.area || '')

      const [
        { data: pays },
        { data: enrols },
        { data: bals },
      ] = await Promise.all([
        supabase.from('payments').select('*').eq('student_id', stu.id).order('year', { ascending: false }).order('month', { ascending: false }),
        supabase.from('enrollments').select('*').eq('student_id', stu.id),
        supabase.from('student_balances').select('*').eq('student_id', stu.id),
      ])
      setPayments(pays || [])
      setEnrollments(enrols || [])
      setBalances(bals || [])

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

  async function saveStudentInfo() {
    if (!student) return
    setSavingStudent(true)
    try {
      const { error: err } = await supabase.from('students').update({
        full_name: form.full_name?.trim() || null,
        grade: form.grade ? parseInt(String(form.grade)) : null,
        school: form.school?.trim() || null,
        notes: form.notes?.trim() || null,
        fcode_ref: form.fcode_ref?.trim() || null,
      }).eq('id', student.id)

      if (err) throw err

      setEditing(false)
      await load()
    } catch (e: any) {
      alert('Failed to update student info: ' + e.message)
    } finally {
      setSavingStudent(false)
    }
  }

  async function saveHouseholdInfo() {
    if (!student) return
    setSavingHousehold(true)
    try {
      const hh = (student as any).household
      if (hh?.id) {
        // Update existing household
        const { error: hhErr } = await supabase.from('households').update({
          parent_name: parentNameInput.trim() || null,
          parent_phone: parentPhoneInput.trim() || null,
          address: addressInput.trim() || null,
          area: areaInput.trim() || null,
        }).eq('id', hh.id)

        if (hhErr) throw hhErr
      } else {
        // Create new household and attach to this student
        const { data: newHh, error: newHhErr } = await supabase.from('households').insert({
          parent_name: parentNameInput.trim() || null,
          parent_phone: parentPhoneInput.trim() || null,
          address: addressInput.trim() || null,
          area: areaInput.trim() || null,
        }).select().single()

        if (newHhErr) throw newHhErr

        await supabase.from('students').update({ household_id: newHh.id }).eq('id', student.id)
      }

      setEditingHousehold(false)
      await load()
    } catch (e: any) {
      alert('Failed to save household details: ' + e.message)
    } finally {
      setSavingHousehold(false)
    }
  }

  async function handleDeleteStudent() {
    if (!student) return
    const confirmation = prompt(`Type "DELETE" to permanently delete student ${student.ps_code} (${student.full_name || 'No Name'}):`)
    if (confirmation !== 'DELETE') return

    try {
      // 1. Delete associated payments
      await supabase.from('payments').delete().eq('student_id', student.id)
      // 2. Delete enrollments
      await supabase.from('enrollments').delete().eq('student_id', student.id)
      // 3. Delete student balances
      await supabase.from('student_balances').delete().eq('student_id', student.id)
      // 4. Delete student record
      const { error: delErr } = await supabase.from('students').delete().eq('id', student.id)
      if (delErr) throw delErr

      alert(`Student ${student.ps_code} deleted successfully.`)
      router.push('/students')
    } catch (err: any) {
      alert('Failed to delete student: ' + err.message)
    }
  }

  function handleOpenEditPayment(payment: Payment) {
    setEditingPayment(payment)
    setEditAmountPaid(String(payment.amount_paid))
    setEditPaymentType(payment.payment_type || 'BANK')
    setEditBankName(payment.bank_name || 'BOC')
    setEditDatePaid(payment.date_paid || new Date().toISOString().slice(0, 10))
    setEditAddedGroup(payment.added_to_group || false)
    setEditTuteDelivered(payment.tute_delivered || false)
  }

  async function handleSavePaymentEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingPayment) return

    setSavingPayment(true)
    try {
      const paid = ['FREE', 'IMS'].includes(editPaymentType) ? 0 : parseFloat(editAmountPaid) || 0

      const { error: err } = await supabase.from('payments').update({
        amount_paid: paid,
        payment_type: editPaymentType,
        bank_name: editPaymentType === 'BANK' ? editBankName : null,
        date_paid: editPaymentType !== 'FREE' ? editDatePaid : null,
        added_to_group: editAddedGroup,
        tute_delivered: editTuteDelivered,
      }).eq('id', editingPayment.id)

      if (err) throw err

      setEditingPayment(null)
      await load()
    } catch (err: any) {
      alert('Failed to update payment: ' + err.message)
    } finally {
      setSavingPayment(false)
    }
  }

  async function handleDeletePayment(payment: Payment) {
    if (!confirm(`Are you sure you want to delete payment record for ${MONTH_NUM_TO_NAME(payment.month)} ${payment.year} (${CLASS_LABELS[payment.class_type] || payment.class_type})?`)) return

    try {
      const { error: err } = await supabase.from('payments').delete().eq('id', payment.id)
      if (err) throw err
      await load()
    } catch (err: any) {
      alert('Failed to delete payment: ' + err.message)
    }
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

  if (loading) return <div style={{ padding: 40, color: 'var(--text-muted)' }}>Loading student profile...</div>
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
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={printAddress} className="btn-secondary">
            <Printer size={14} /> Print Address
          </button>
          <a href={`/payments/add?ps=${encodeURIComponent(student.ps_code)}`} className="btn-primary">
            <Plus size={14} /> Add Payment
          </a>
          {isAdmin && (
            <button
              onClick={handleDeleteStudent}
              style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                color: '#ef4444', borderRadius: 8, padding: '7px 12px', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
              }}
              title="Permanently delete student and payment history"
            >
              <Trash2 size={14} /> Delete Student
            </button>
          )}
        </div>
      </div>

      <div className="page-content">
        <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20 }}>
          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Student info */}
            <div className="glass-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--accent-blue)' }}>Student Info</div>
                {!editing ? (
                  <button
                    onClick={() => setEditing(true)}
                    className="btn-secondary"
                    style={{ padding: '3px 8px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    ✏ Edit
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={saveStudentInfo}
                      disabled={savingStudent}
                      className="btn-primary"
                      style={{ padding: '3px 8px', fontSize: 11 }}
                    >
                      {savingStudent ? 'Saving...' : '✓ Save'}
                    </button>
                    <button
                      onClick={() => setEditing(false)}
                      className="btn-secondary"
                      style={{ padding: '3px 8px', fontSize: 11 }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {editing ? (
                <>
                  <Input label="Full Name" value={form.full_name || ''} onChange={v => setForm(f => ({ ...f, full_name: v }))} placeholder="e.g. Kasun Perera" />
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>Grade</label>
                    <select
                      className="input-field"
                      value={form.grade || ''}
                      onChange={e => setForm(f => ({ ...f, grade: e.target.value ? parseInt(e.target.value) : undefined }))}
                    >
                      <option value="">Select Grade</option>
                      {[6, 7, 8, 9, 10, 11, 12, 13].map(g => (
                        <option key={g} value={g}>Grade {g}</option>
                      ))}
                    </select>
                  </div>
                  <Input label="School" value={form.school || ''} onChange={v => setForm(f => ({ ...f, school: v }))} placeholder="e.g. Royal College" />
                  <Input label="Notes" value={form.notes || ''} onChange={v => setForm(f => ({ ...f, notes: v }))} placeholder="Internal student notes..." />
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

            {/* Household / Parent & Delivery Address Card */}
            <div className="glass-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--accent-purple)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Home size={16} /> Household & Delivery Info
                </div>
                {!editingHousehold ? (
                  <button
                    onClick={() => setEditingHousehold(true)}
                    className="btn-secondary"
                    style={{ padding: '3px 8px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    ✏ Edit Address/Phone
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={saveHouseholdInfo}
                      disabled={savingHousehold}
                      className="btn-primary"
                      style={{ padding: '3px 8px', fontSize: 11 }}
                    >
                      {savingHousehold ? 'Saving...' : '✓ Save'}
                    </button>
                    <button
                      onClick={() => setEditingHousehold(false)}
                      className="btn-secondary"
                      style={{ padding: '3px 8px', fontSize: 11 }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {!editingHousehold ? (
                <>
                  <Info label="Parent / Guardian Name" value={hh?.parent_name || 'Not registered'} />
                  <Info label="Parent Phone Number" value={hh?.parent_phone || 'Not registered'} />
                  <Info label="Delivery Address" value={hh?.address || 'Not registered'} />
                  <Info label="Area / Delivery Route" value={hh?.area || 'Not registered'} />

                  {householdSiblings.length > 0 && (
                    <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-blue)', marginBottom: 6, textTransform: 'uppercase' }}>
                        👨‍👩‍👧‍👦 SIBLINGS IN SAME HOUSEHOLD ({householdSiblings.length})
                      </div>
                      {householdSiblings.map(s => (
                        <a
                          key={s.id}
                          href={`/students/${encodeURIComponent(s.ps_code)}`}
                          style={{
                            display: 'flex', justifyContent: 'space-between', padding: '5px 8px',
                            background: 'rgba(255,255,255,0.03)', borderRadius: 6, marginBottom: 4,
                            color: 'var(--text-primary)', textDecoration: 'none', fontSize: 12
                          }}
                          className="hover-bg"
                        >
                          <span style={{ fontWeight: 600, color: 'var(--accent-blue)' }}>{s.ps_code}</span>
                          <span>{s.full_name || 'No name'}</span>
                          <span style={{ color: 'var(--text-muted)' }}>Gr {s.grade || '?'}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Input label="Parent / Guardian Name" value={parentNameInput} onChange={setParentNameInput} placeholder="e.g. Sunil Perera" />
                  <Input label="Parent Contact Number" value={parentPhoneInput} onChange={setParentPhoneInput} placeholder="e.g. 0771234567" />
                  <Input label="Delivery Address" value={addressInput} onChange={setAddressInput} placeholder="House No, Street, City" />
                  <Input label="Area / Delivery Route" value={areaInput} onChange={setAreaInput} placeholder="e.g. Kandy Town" />
                </div>
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
                  <input className="input-field" placeholder="F-code e.g. F80001"
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

          {/* Right column — Payment Ledger with Admin Edit/Delete */}
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
                        {enrol.tier} · Monthly Fee: Rs.{enrol.fee_amount.toLocaleString()} · {enrol.active ? '✅ Active' : '⏹ Inactive'}
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
                        {isAdmin && <th style={{ width: 80, textAlign: 'center' }}>Action</th>}
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
                          {isAdmin && (
                            <td style={{ textAlign: 'center' }}>
                              <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditPayment(p)}
                                  className="btn-secondary"
                                  style={{ padding: '2px 6px', fontSize: 11 }}
                                  title="Edit payment"
                                >
                                  <Edit2 size={11} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePayment(p)}
                                  style={{
                                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                                    color: '#ef4444', borderRadius: 4, padding: '2px 6px', fontSize: 11, cursor: 'pointer'
                                  }}
                                  title="Delete payment record"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            </td>
                          )}
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

      {/* Admin Edit Payment Modal */}
      {editingPayment && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: 20
        }}>
          <div className="glass-card" style={{ maxWidth: 440, width: '100%', padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px' }}>
              ✏ Edit Payment Record — {MONTH_NUM_TO_NAME(editingPayment.month)} {editingPayment.year}
            </h3>
            <form onSubmit={handleSavePaymentEdit}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  Class Type
                </label>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-blue)' }}>
                  {CLASS_LABELS[editingPayment.class_type] || editingPayment.class_type}
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  Payment Type
                </label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {['BANK', 'CASH', 'FREE', 'IMS', 'PHYSICAL'].map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setEditPaymentType(t)}
                      className={editPaymentType === t ? 'btn-primary' : 'btn-secondary'}
                      style={{ padding: '4px 10px', fontSize: 11 }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {['BANK', 'CASH', 'PHYSICAL'].includes(editPaymentType) && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                    Amount Paid (Rs.)
                  </label>
                  <input
                    type="number"
                    className="input-field"
                    value={editAmountPaid}
                    onChange={e => setEditAmountPaid(e.target.value)}
                    required
                  />
                </div>
              )}

              {editPaymentType === 'BANK' && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                    Bank
                  </label>
                  <select
                    className="input-field"
                    value={editBankName}
                    onChange={e => setEditBankName(e.target.value)}
                  >
                    {['BOC', 'Sampath', 'Commercial', 'HNB', 'People\'s Bank', 'NSB', 'Seylan', 'NTB', 'Other'].map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  Date Paid
                </label>
                <input
                  type="date"
                  className="input-field"
                  value={editDatePaid}
                  onChange={e => setEditDatePaid(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <input
                  type="checkbox"
                  id="chk-grp-edit"
                  checked={editAddedGroup}
                  onChange={e => setEditAddedGroup(e.target.checked)}
                />
                <label htmlFor="chk-grp-edit" style={{ fontSize: 13 }}>Added to WhatsApp Group</label>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <input
                  type="checkbox"
                  id="chk-tute-edit"
                  checked={editTuteDelivered}
                  onChange={e => setEditTuteDelivered(e.target.checked)}
                />
                <label htmlFor="chk-tute-edit" style={{ fontSize: 13 }}>Tute / Material Delivered</label>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setEditingPayment(null)}
                  className="btn-secondary"
                  style={{ padding: '6px 14px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ padding: '6px 14px' }}
                  disabled={savingPayment}
                >
                  {savingPayment ? 'Saving...' : '✓ Update Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ fontSize: 13, marginTop: 2, fontWeight: 500 }}>{value}</div>
    </div>
  )
}

function Input({ label, value, onChange, placeholder = '', type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>{label}</label>
      <input className="input-field" type={type} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
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
