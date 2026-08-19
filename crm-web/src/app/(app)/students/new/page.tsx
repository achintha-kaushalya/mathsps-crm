'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, UserPlus, CheckCircle, Home } from 'lucide-react'
import { CLASS_TYPES, CLASS_LABELS } from '@/lib/types'

export default function NewStudentPage() {
  const supabase = createClient()

  // Form State
  const [psCode, setPsCode] = useState('')
  const [fullName, setFullName] = useState('')
  const [grade, setGrade] = useState<number | ''>(11)
  const [school, setSchool] = useState('')
  const [notes, setNotes] = useState('')
  const [fcodeRef, setFcodeRef] = useState('')
  const [createdBy, setCreatedBy] = useState('')

  // Household info (Optional)
  const [parentName, setParentName] = useState('')
  const [parentPhone, setParentPhone] = useState('')
  const [address, setAddress] = useState('')
  const [area, setArea] = useState('')

  // Class Enrollments
  const [selectedClasses, setSelectedClasses] = useState<{ class_type: string; tier: 'STANDARD' | 'PREMIUM'; fee_amount: number }[]>([
    { class_type: 'MAIN_GR11', tier: 'STANDARD', fee_amount: 1500 }
  ])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successPs, setSuccessPs] = useState('')

  function toggleClass(classType: string) {
    const exists = selectedClasses.find(c => c.class_type === classType)
    if (exists) {
      setSelectedClasses(selectedClasses.filter(c => c.class_type !== classType))
    } else {
      const defaultFee = classType.includes('GR10') || classType.includes('GR11') ? 1800 : 1500
      setSelectedClasses([...selectedClasses, { class_type: classType, tier: 'STANDARD', fee_amount: defaultFee }])
    }
  }

  function updateClassConfig(classType: string, field: 'tier' | 'fee_amount', value: any) {
    setSelectedClasses(selectedClasses.map(c => {
      if (c.class_type === classType) {
        return { ...c, [field]: value }
      }
      return c
    }))
  }

  async function submit() {
    setError(''); setSuccessPs('')
    if (!psCode.trim()) { setError('PS Code is required'); return }
    if (!createdBy.trim()) { setError('Member Name (Registered by) is required'); return }

    const formattedPs = psCode.trim().toUpperCase().replace(/\s+/g, '')
    setSaving(true)

    try {
      // 1. Create Household if address or parent phone provided
      let householdId: string | null = null
      if (address.trim() || parentPhone.trim() || parentName.trim()) {
        const { data: hh, error: hhErr } = await supabase.from('households').insert({
          parent_name: parentName.trim() || null,
          parent_phone: parentPhone.trim() || null,
          address: address.trim() || null,
          area: area.trim() || null,
        }).select('id').single()

        if (hhErr) throw hhErr
        householdId = hh.id
      }

      // 2. Create Student Record
      const { data: stu, error: stuErr } = await supabase.from('students').insert({
        ps_code: formattedPs,
        household_id: householdId,
        full_name: fullName.trim() || null,
        grade: grade === '' ? null : Number(grade),
        school: school.trim() || null,
        notes: notes.trim() || null,
        fcode_ref: fcodeRef.trim() ? fcodeRef.trim().toUpperCase() : null,
        created_by: createdBy.trim(),
      }).select('id, ps_code').single()

      if (stuErr) throw stuErr

      // 3. Create Class Enrollments
      if (selectedClasses.length > 0) {
        const enrolRows = selectedClasses.map(c => ({
          student_id: stu.id,
          class_type: c.class_type,
          tier: c.tier,
          fee_amount: c.fee_amount,
          active: true,
        }))

        const { error: enrolErr } = await supabase.from('enrollments').insert(enrolRows)
        if (enrolErr) throw enrolErr
      }

      setSuccessPs(stu.ps_code)
    } catch (e: any) {
      setError(e.message || 'Failed to register student')
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
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              <UserPlus size={22} style={{ color: 'var(--accent-blue)' }} />
              Register New Student
            </h1>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>Add a new student, household details, & class enrollments</div>
          </div>
        </div>
      </div>

      <div className="page-content" style={{ maxWidth: 760 }}>
        {successPs ? (
          <div className="glass-card" style={{ padding: 40, textAlign: 'center' }}>
            <CheckCircle size={48} style={{ color: '#10b981', margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>Student Registered Successfully!</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
              <b>{successPs}</b> has been saved to the database.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <a href={`/payments/add?ps=${encodeURIComponent(successPs)}`} className="btn-primary">
                ➕ Add First Payment
              </a>
              <a href={`/students/${encodeURIComponent(successPs)}`} className="btn-secondary">
                👤 View Profile
              </a>
              <button onClick={() => { setSuccessPs(''); setPsCode(''); setFullName(''); }} className="btn-secondary">
                Registered Another Student
              </button>
            </div>
          </div>
        ) : (
          <>
            {error && (
              <div style={{ padding: 14, background: '#2a1a1a', border: '1px solid var(--accent-red)', borderRadius: 8, color: '#f87171', marginBottom: 20, fontSize: 14 }}>
                ⚠️ {error}
              </div>
            )}

            {/* Section 1: Basic Info */}
            <div className="glass-card" style={{ padding: 24, marginBottom: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 18, color: 'var(--accent-blue)' }}>
                1. Student Registration Details
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                    PS Code <span style={{ color: 'var(--accent-red)' }}>*</span>
                  </label>
                  <input className="input-field" placeholder="e.g. PS9988" value={psCode} onChange={e => setPsCode(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Full Name</label>
                  <input className="input-field" placeholder="Student name" value={fullName} onChange={e => setFullName(e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginTop: 14 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Grade</label>
                  <select className="input-field" value={grade} onChange={e => setGrade(e.target.value === '' ? '' : parseInt(e.target.value))}>
                    <option value="">Select...</option>
                    {[6,7,8,9,10,11,12,13].map(g => <option key={g} value={g}>Grade {g}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>School</label>
                  <input className="input-field" placeholder="School name" value={school} onChange={e => setSchool(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Optional CRM F-Code</label>
                  <input className="input-field" placeholder="e.g. F70001" value={fcodeRef} onChange={e => setFcodeRef(e.target.value)} />
                </div>
              </div>
            </div>

            {/* Section 2: Household & Address (For Tute Delivery) */}
            <div className="glass-card" style={{ padding: 24, marginBottom: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 18, color: 'var(--accent-orange)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Home size={18} /> 2. Household & Delivery Address
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Parent / Guardian Name</label>
                  <input className="input-field" placeholder="Parent name" value={parentName} onChange={e => setParentName(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Parent Contact Number</label>
                  <input className="input-field" placeholder="07XXXXXXXX" value={parentPhone} onChange={e => setParentPhone(e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginTop: 14 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Delivery Address</label>
                  <input className="input-field" placeholder="House No, Street, City" value={address} onChange={e => setAddress(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Area / Delivery Route</label>
                  <input className="input-field" placeholder="e.g. Colombo 07" value={area} onChange={e => setArea(e.target.value)} />
                </div>
              </div>
            </div>

            {/* Section 3: Class Enrollments & Fee Tiers */}
            <div className="glass-card" style={{ padding: 24, marginBottom: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 18, color: 'var(--accent-purple)' }}>
                3. Class Enrollments & Fee Tiers
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10, marginBottom: 20 }}>
                {CLASS_TYPES.map(ct => {
                  const active = !!selectedClasses.find(c => c.class_type === ct)
                  return (
                    <div key={ct} onClick={() => toggleClass(ct)}
                      style={{
                        padding: '10px 14px', borderRadius: 8, cursor: 'pointer', border: '1px solid',
                        borderColor: active ? 'var(--accent-blue)' : 'var(--border)',
                        background: active ? 'rgba(59,130,246,0.12)' : 'var(--bg-base)',
                        color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                        fontSize: 13, fontWeight: 500, transition: 'all 0.15s'
                      }}>
                      {active ? '✓ ' : '+ '}{CLASS_LABELS[ct] || ct}
                    </div>
                  )
                })}
              </div>

              {selectedClasses.length > 0 && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12 }}>CONFIGURE SELECTED CLASSES:</div>
                  {selectedClasses.map(c => (
                    <div key={c.class_type} style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10, background: 'var(--bg-base)', padding: 10, borderRadius: 8 }}>
                      <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{CLASS_LABELS[c.class_type] || c.class_type}</div>
                      <div>
                        <select className="input-field" style={{ width: 140, padding: '4px 8px', fontSize: 12 }}
                          value={c.tier} onChange={e => updateClassConfig(c.class_type, 'tier', e.target.value)}>
                          <option value="STANDARD">STANDARD (No Tute)</option>
                          <option value="PREMIUM">PREMIUM (Tute Delivery)</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Rs.</span>
                        <input className="input-field" style={{ width: 90, padding: '4px 8px', fontSize: 12 }} type="number"
                          value={c.fee_amount} onChange={e => updateClassConfig(c.class_type, 'fee_amount', parseFloat(e.target.value) || 0)} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 4: Audit & Submit */}
            <div className="glass-card" style={{ padding: 24, marginBottom: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 14, color: 'var(--accent-green)' }}>
                4. Audit Info
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                  Registered By (Your Member Name) <span style={{ color: 'var(--accent-red)' }}>*</span>
                </label>
                <input className="input-field" placeholder="Enter your member name" value={createdBy} onChange={e => setCreatedBy(e.target.value)} />
              </div>
            </div>

            <button onClick={submit} disabled={saving} className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: 14, fontSize: 16, fontWeight: 700 }}>
              {saving ? 'Registering...' : '💾 Register Student'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
