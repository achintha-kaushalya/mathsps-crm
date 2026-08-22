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

  const [selectedClassTypes, setSelectedClassTypes] = useState<string[]>([])
  const [classAmountPaid, setClassAmountPaid] = useState<Record<string, string>>({})
  const [allBalances, setAllBalances] = useState<Record<string, StudentBalance>>({})

  const [form, setForm] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    payment_type: 'BANK' as string,
    amount_paid: '',
    bank_name: 'BOC',
    date_paid: new Date().toISOString().slice(0, 10),
    added_to_group: false,
    tute_delivered: false,
    notes: '',
  })

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [searchResults, setSearchResults] = useState<Student[]>([])
  const [searching, setSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)

  // Live real-time search suggestions as user types (supporting PS5000, pS 5000, 5000, name, etc.)
  useEffect(() => {
    if (!psSearch.trim()) {
      setSearchResults([])
      setShowDropdown(false)
      return
    }

    const term = psSearch.trim()
    const cleanDigits = term.replace(/\D/g, '')
    const cleanPs = term.toUpperCase().replace(/\s+/g, '')

    // Perform fuzzy live search query
    let query = supabase.from('students').select('*, household:households(*)').limit(8)

    if (cleanDigits) {
      // User typed numbers e.g. "5000" or "ps 5000"
      query = query.or(`ps_code.ilike.%${cleanDigits}%,full_name.ilike.%${term}%,ps_code.ilike.%${cleanPs}%`)
    } else {
      query = query.or(`ps_code.ilike.%${cleanPs}%,full_name.ilike.%${term}%`)
    }

    setSearching(true)
    query.then(({ data }) => {
      setSearchResults(data || [])
      setShowDropdown(true)
      setSearching(false)
    })
  }, [psSearch])

  // Auto-detect logged in member
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        let name = user.user_metadata?.full_name || user.email?.split('@')[0] || ''
        if (user.email) {
          const { data: dbMem } = await supabase.from('members').select('name').eq('email', user.email).single()
          if (dbMem?.name) name = dbMem.name
        }
        setMemberName(name)
      }
    })
  }, [])

  // Auto-load if ps param present
  useEffect(() => {
    if (psSearch) searchStudent()
  }, [])

  const [editingStudent, setEditingStudent] = useState(false)
  const [editName, setEditName] = useState('')
  const [editGrade, setEditGrade] = useState<number | ''>(11)
  const [editSchool, setEditSchool] = useState('')
  const [savingStudent, setSavingStudent] = useState(false)

  const [editingAddress, setEditingAddress] = useState(false)
  const [addressInput, setAddressInput] = useState('')
  const [areaInput, setAreaInput] = useState('')
  const [parentNameInput, setParentNameInput] = useState('')
  const [parentPhoneInput, setParentPhoneInput] = useState('')
  const [savingAddress, setSavingAddress] = useState(false)

  function selectStudent(selectedStu: any) {
    setStudent(selectedStu)
    setPsSearch(selectedStu.ps_code)
    setShowDropdown(false)
    setError('')
    setEditingStudent(false)
    setEditingAddress(false)

    setEditName(selectedStu.full_name || '')
    setEditGrade(selectedStu.grade || 11)
    setEditSchool(selectedStu.school || '')

    const hh = selectedStu.household || {}
    setAddressInput(hh.address || '')
    setAreaInput(hh.area || '')
    setParentNameInput(hh.parent_name || '')
    setParentPhoneInput(hh.parent_phone || '')
    
    supabase.from('enrollments').select('*').eq('student_id', selectedStu.id).eq('active', true).then(async ({ data: enrols }) => {
      setEnrollments(enrols || [])
      if (enrols && enrols.length > 0) {
        const defaultSelected = enrols.map(e => e.class_type)
        setSelectedClassTypes(defaultSelected)

        // Load balances for all enrolled classes
        const { data: bData } = await supabase.from('student_balances').select('*').eq('student_id', selectedStu.id)
        const bMap: Record<string, StudentBalance> = {}
        const initialAmounts: Record<string, string> = {}

        ;(bData || []).forEach(b => {
          bMap[b.class_type] = b
        })
        setAllBalances(bMap)

        enrols.forEach(e => {
          const bVal = bMap[e.class_type]?.current_balance || 0
          const suggested = Math.max(0, e.fee_amount - bVal)
          initialAmounts[e.class_type] = String(suggested)
        })
        setClassAmountPaid(initialAmounts)
      } else {
        setSelectedClassTypes([])
        setClassAmountPaid({})
        setAllBalances({})
      }
    })
  }

  async function saveStudentProfile() {
    if (!student) return
    setSavingStudent(true)
    try {
      const { error: err } = await supabase.from('students').update({
        full_name: editName.trim() || null,
        grade: editGrade ? parseInt(String(editGrade)) : null,
        school: editSchool.trim() || null
      }).eq('id', student.id)

      if (err) throw err

      setStudent({
        ...student,
        full_name: editName.trim(),
        grade: editGrade ? parseInt(String(editGrade)) : null,
        school: editSchool.trim()
      } as any)
      setEditingStudent(false)
    } catch (e: any) {
      alert('Failed to update student profile: ' + e.message)
    } finally {
      setSavingStudent(false)
    }
  }

  async function saveAddress() {
    if (!student) return
    setSavingAddress(true)
    try {
      const hh = (student as any).household
      if (hh?.id) {
        // Update existing household
        const { error: hhErr } = await supabase.from('households').update({
          address: addressInput.trim() || null,
          area: areaInput.trim() || null,
          parent_name: parentNameInput.trim() || null,
          parent_phone: parentPhoneInput.trim() || null,
        }).eq('id', hh.id)

        if (hhErr) throw hhErr
        setStudent({
          ...student,
          household: {
            ...hh,
            address: addressInput.trim(),
            area: areaInput.trim(),
            parent_name: parentNameInput.trim(),
            parent_phone: parentPhoneInput.trim()
          }
        } as any)
      } else {
        // Create new household and link to student
        const { data: newHh, error: hhErr } = await supabase.from('households').insert({
          address: addressInput.trim() || null,
          area: areaInput.trim() || null,
          parent_name: parentNameInput.trim() || null,
          parent_phone: parentPhoneInput.trim() || null,
        }).select().single()

        if (hhErr) throw hhErr

        await supabase.from('students').update({ household_id: newHh.id }).eq('id', student.id)
        setStudent({
          ...student,
          household_id: newHh.id,
          household: newHh
        } as any)
      }
      setEditingAddress(false)
    } catch (e: any) {
      alert('Failed to save address: ' + e.message)
    } finally {
      setSavingAddress(false)
    }
  }

  async function searchStudent() {
    setStudent(null); setError('')
    if (!psSearch.trim()) return

    const rawInput = psSearch.trim()
    const cleanDigits = rawInput.replace(/\D/g, '')
    const cleanPs = rawInput.toUpperCase().replace(/\s+/g, '')
    
    // Try multiple search strategies: exact match, formatted PS, digits match, or name
    let { data: matches } = await supabase
      .from('students')
      .select('*, household:households(*)')
      .or(`ps_code.eq.${cleanPs},ps_code.eq.PS${cleanDigits},ps_code.ilike.%${cleanDigits}%,full_name.ilike.%${rawInput}%`)
      .limit(5)

    if (!matches || matches.length === 0) {
      setError(`No student found for "${psSearch}". Try typing digits like 5000 or student name.`)
      return
    }

    // Pick best match (exact PS match first, else first candidate)
    const bestMatch = matches.find(s => s.ps_code.toUpperCase() === cleanPs || s.ps_code.toUpperCase() === `PS${cleanDigits}`) || matches[0]
    selectStudent(bestMatch)
  }



  async function submit() {
    if (!student) { setError('Please search and select a student first'); return }
    if (selectedClassTypes.length === 0) { setError('Select at least one class to record payment'); return }
    if (!memberName.trim()) { setError('Enter your name (recorded by)'); return }

    setSaving(true); setError('')
    try {
      // Loop over each selected class and record payment
      for (const ct of selectedClassTypes) {
        const enrol = enrollments.find(e => e.class_type === ct)
        const amountDue = enrol?.fee_amount || 0
        const bVal = allBalances[ct]?.current_balance || 0

        let amountPaid = 0
        if (['FREE', 'SIPSA'].includes(form.payment_type)) {
          amountPaid = 0
        } else {
          amountPaid = parseFloat(classAmountPaid[ct]) || 0
        }

        const { error: err } = await supabase.from('payments').upsert({
          student_id: student.id,
          class_type: ct,
          month: form.month,
          year: form.year,
          amount_due: amountDue,
          amount_paid: amountPaid,
          balance_before: bVal,
          payment_type: form.payment_type,
          bank_name: form.payment_type === 'BANK' ? form.bank_name : null,
          date_paid: form.payment_type !== 'FREE' ? form.date_paid : null,
          added_to_group: form.added_to_group,
          tute_delivered: form.tute_delivered,
          notes: form.notes || null,
          recorded_by: memberName.trim(),
        }, { onConflict: 'student_id,class_type,month,year' })

        if (err) throw err
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 3500)

      // Reload balances for all classes
      const { data: bData } = await supabase.from('student_balances').select('*').eq('student_id', student.id)
      const bMap: Record<string, StudentBalance> = {}
      ;(bData || []).forEach(b => { bMap[b.class_type] = b })
      setAllBalances(bMap)

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
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <input className="input-field" placeholder="Search by PS Code (e.g. 5000, ps 5000) or Student Name"
                value={psSearch} onChange={e => setPsSearch(e.target.value)}
                onFocus={() => psSearch.trim() && setShowDropdown(true)}
                onKeyDown={e => e.key === 'Enter' && searchStudent()}
                autoFocus
              />
              <button className="btn-primary" onClick={searchStudent}>
                <Search size={14} /> Search
              </button>
            </div>

            {/* Live Search Suggestions Dropdown */}
            {showDropdown && searchResults.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 90, marginTop: 4,
                background: '#0d1424', border: '1px solid var(--border)', borderRadius: 8,
                zIndex: 9999, boxShadow: '0 10px 25px rgba(0,0,0,0.5)', maxHeight: 240, overflowY: 'auto'
              }}>
                {searchResults.map(st => (
                  <div
                    key={st.id}
                    onClick={() => selectStudent(st)}
                    style={{
                      padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)',
                      cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      transition: 'background 0.15s'
                    }}
                    onMouseDown={e => e.preventDefault()}
                  >
                    <div>
                      <span style={{ fontWeight: 700, color: 'var(--accent-blue)', fontSize: 14 }}>{st.ps_code}</span>
                      <span style={{ marginLeft: 10, fontSize: 13, color: 'var(--text-primary)' }}>{st.full_name || 'No name'}</span>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Gr {st.grade || '?'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <div style={{ marginTop: 12, color: 'var(--accent-red)', fontSize: 13 }}>⚠ {error}</div>}

          {student && (
            <div style={{ marginTop: 14, padding: 14, background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 600, color: '#10b981' }}>✓ Found: {student.ps_code}</div>
                {!editingStudent ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditName(student.full_name || '')
                      setEditGrade(student.grade || 11)
                      setEditSchool(student.school || '')
                      setEditingStudent(true)
                    }}
                    className="btn-secondary"
                    style={{ padding: '3px 8px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    ✏ Edit Student Details
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={saveStudentProfile}
                      disabled={savingStudent}
                      className="btn-primary"
                      style={{ padding: '3px 8px', fontSize: 11 }}
                    >
                      {savingStudent ? 'Saving...' : '✓ Save Profile'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingStudent(false)}
                      className="btn-secondary"
                      style={{ padding: '3px 8px', fontSize: 11 }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {!editingStudent ? (
                <>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
                    <span style={{ fontWeight: 600, color: student.full_name ? 'var(--text-primary)' : 'var(--accent-red)' }}>
                      {student.full_name || '⚠ No name set'}
                    </span> · Grade {student.grade || '?'}
                  </div>
                  {(student.household as any)?.address && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      📍 {(student.household as any).address}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Student Full Name</label>
                    <input
                      className="input-field"
                      placeholder="e.g. Kasun Perera"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Grade</label>
                    <select
                      className="input-field"
                      value={editGrade}
                      onChange={e => setEditGrade(e.target.value ? parseInt(e.target.value) : '')}
                    >
                      {[6, 7, 8, 9, 10, 11, 12, 13].map(g => (
                        <option key={g} value={g}>Grade {g}</option>
                      ))}
                    </select>
                  </div>
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

              <FormRow label="Select Enrolled Classes to Record Payment">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                  {enrollments.length === 0 ? (
                    <div style={{ fontSize: 13, color: 'var(--accent-red)', padding: 10, background: 'rgba(239,68,68,0.1)', borderRadius: 8 }}>
                      ⚠ No active class enrollments found for this student.
                    </div>
                  ) : (
                    enrollments.map(e => {
                      const isSelected = selectedClassTypes.includes(e.class_type)
                      const bObj = allBalances[e.class_type]
                      const curBalance = bObj?.current_balance || 0
                      const suggested = Math.max(0, e.fee_amount - curBalance)

                      return (
                        <div key={e.class_type} style={{
                          padding: '12px 14px', borderRadius: 8, border: '1px solid',
                          borderColor: isSelected ? 'var(--accent-blue)' : 'var(--border)',
                          background: isSelected ? 'rgba(59,130,246,0.12)' : 'var(--bg-base)',
                          transition: 'all 0.15s'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <input
                                type="checkbox"
                                id={`chk-${e.class_type}`}
                                checked={isSelected}
                                onChange={(chkEvent) => {
                                  if (chkEvent.target.checked) {
                                    setSelectedClassTypes(prev => [...prev, e.class_type])
                                    if (!classAmountPaid[e.class_type]) {
                                      setClassAmountPaid(prev => ({ ...prev, [e.class_type]: String(suggested) }))
                                    }
                                  } else {
                                    setSelectedClassTypes(prev => prev.filter(c => c !== e.class_type))
                                  }
                                }}
                                style={{ width: 16, height: 16, cursor: 'pointer' }}
                              />
                              <label htmlFor={`chk-${e.class_type}`} style={{ cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                                {CLASS_LABELS[e.class_type] || e.class_type}
                                <span style={{ fontSize: 12, color: 'var(--accent-green)', marginLeft: 8 }}>
                                  (Fee: Rs. {e.fee_amount.toLocaleString()})
                                </span>
                              </label>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                              <div style={{ fontSize: 11, textAlign: 'right' }}>
                                <div style={{ color: 'var(--text-muted)' }}>Balance</div>
                                <div style={{ fontWeight: 700, color: curBalance > 0 ? '#10b981' : curBalance < 0 ? '#ef4444' : 'var(--text-muted)' }}>
                                  {curBalance >= 0 ? '+' : ''}Rs.{curBalance.toLocaleString()}
                                </div>
                              </div>
                              <div style={{ fontSize: 11, textAlign: 'right' }}>
                                <div style={{ color: 'var(--text-muted)' }}>Suggested</div>
                                <div style={{ fontWeight: 700, color: 'var(--accent-blue)' }}>
                                  Rs.{suggested.toLocaleString()}
                                </div>
                              </div>
                            </div>
                          </div>

                          {isSelected && ['BANK', 'CASH', 'PHYSICAL'].includes(form.payment_type) && (
                            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
                              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Amount Paid for this class (Rs.):</label>
                              <input
                                className="input-field"
                                type="number"
                                style={{ width: 160, padding: '5px 10px', fontSize: 13, fontWeight: 700, color: 'var(--accent-green)' }}
                                placeholder={`e.g. ${suggested}`}
                                value={classAmountPaid[e.class_type] ?? ''}
                                onChange={eVal => setClassAmountPaid({ ...classAmountPaid, [e.class_type]: eVal.target.value })}
                              />
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </FormRow>

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
                  {['BANK', 'CASH', 'FREE', 'IMS', 'PHYSICAL'].map(t => (
                    <button key={t} onClick={() => setForm(f => ({ ...f, payment_type: t }))}
                      className={form.payment_type === t ? 'btn-primary' : 'btn-secondary'}
                      style={{ padding: '6px 12px', fontSize: 12 }}>
                      {t}
                    </button>
                  ))}
                </div>
              </FormRow>

              {form.payment_type === 'BANK' && (
                <FormRow label="Bank">
                  <select className="input-field" value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))}>
                    {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </FormRow>
              )}

              <FormRow label="Date Paid">
                <input className="input-field" type="date" value={form.date_paid}
                  onChange={e => setForm(f => ({ ...f, date_paid: e.target.value }))} />
              </FormRow>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 14 }}>
                <input type="checkbox" id="group" checked={form.added_to_group}
                  onChange={e => setForm(f => ({ ...f, added_to_group: e.target.checked }))}
                  style={{ width: 16, height: 16, cursor: 'pointer' }} />
                <label htmlFor="group" style={{ fontSize: 13, cursor: 'pointer' }}>Added to WhatsApp Group?</label>
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: form.tute_delivered ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.08)', borderRadius: 8, border: `1px solid ${form.tute_delivered ? '#10b981' : 'var(--border)'}`, marginBottom: 8 }}>
                  <input type="checkbox" id="tute" checked={form.tute_delivered}
                    onChange={e => setForm(f => ({ ...f, tute_delivered: e.target.checked }))}
                    style={{ width: 16, height: 16, cursor: 'pointer' }} />
                  <label htmlFor="tute" style={{ fontSize: 13, cursor: 'pointer', fontWeight: 600, color: form.tute_delivered ? '#34d399' : 'var(--text-primary)' }}>
                    📦 Mark Tute Deliver (Pick tick on)
                  </label>
                </div>

                {/* Show & Verify Current Address under Tute Deliver */}
                <div style={{
                  padding: 14, background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border)',
                  marginLeft: 4
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      📍 Delivery Address Verification:
                    </div>
                    {!editingAddress ? (
                      <button
                        type="button"
                        onClick={() => setEditingAddress(true)}
                        className="btn-secondary"
                        style={{ padding: '3px 8px', fontSize: 11 }}
                      >
                        ✏ Edit Address
                      </button>
                    ) : (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          onClick={saveAddress}
                          disabled={savingAddress}
                          className="btn-primary"
                          style={{ padding: '3px 8px', fontSize: 11 }}
                        >
                          {savingAddress ? 'Saving...' : '✓ Save Address'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingAddress(false)}
                          className="btn-secondary"
                          style={{ padding: '3px 8px', fontSize: 11 }}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>

                  {!editingAddress ? (
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: (student?.household as any)?.address ? 'var(--text-primary)' : 'var(--accent-red)' }}>
                        {(student?.household as any)?.address || '⚠ No postal address registered yet!'}
                      </div>
                      {(student?.household as any)?.area && (
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                          Route / Area: {(student?.household as any)?.area}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                      <div>
                        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>House No / Street / City Address</label>
                        <input
                          className="input-field"
                          placeholder="e.g. No 45, Main Street, Kandy"
                          value={addressInput}
                          onChange={e => setAddressInput(e.target.value)}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Area / Delivery Route</label>
                        <input
                          className="input-field"
                          placeholder="e.g. Kandy Town"
                          value={areaInput}
                          onChange={e => setAreaInput(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <FormRow label="Notes (optional)">
                <input className="input-field" placeholder="Any notes..."
                  value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </FormRow>
            </div>

            {/* Step 3: Who recorded (Auto-Locked from logged in user) */}
            <div className="glass-card" style={{ padding: 24, marginBottom: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14, color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: 8 }}>
                🔒 3. Audit Info (Auto-Locked)
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                  Recorded By (Member Name)
                </label>
                <div style={{
                  padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
                  borderRadius: 8, fontSize: 14, fontWeight: 600, color: 'var(--accent-blue)'
                }}>
                  {memberName || 'Admin / System User'}
                </div>
              </div>
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
