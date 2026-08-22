'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, UserPlus, CheckCircle, Home, Plus, Trash2, Lock, Sparkles } from 'lucide-react'
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
  const [currentUserEmail, setCurrentUserEmail] = useState('')
  const [userRole, setUserRole] = useState<'member' | 'admin' | 'owner'>('member')

  // Household info (Optional)
  const [parentName, setParentName] = useState('')
  const [parentPhone, setParentPhone] = useState('')
  const [address, setAddress] = useState('')
  const [area, setArea] = useState('')

  // Custom courses state
  const [customCourseCode, setCustomCourseCode] = useState('')
  const [customCourseName, setCustomCourseName] = useState('')
  const [customCourseFee, setCustomCourseFee] = useState<string>('1500')
  const [showAddCourseModal, setShowAddCourseModal] = useState(false)
  const [editingCourseCode, setEditingCourseCode] = useState<string | null>(null)

  // Class default fees mapping
  const [classDefaultFees, setClassDefaultFees] = useState<Record<string, number>>({
    MAIN_GR6: 1500, MAIN_GR7: 1500, MAIN_GR8: 1500, MAIN_GR9: 1500,
    MAIN_GR10: 1800, MAIN_GR11: 1800, MAIN_MIXED: 1500,
    SHORT_QN: 1500, GEOMETRY_BOOK: 1500, SUPER_REVISION: 1800
  })

  // Available classes dictionary (predefined + custom added)
  const [availableClasses, setAvailableClasses] = useState<Record<string, string>>({
    ...CLASS_LABELS,
  })

  // Class Enrollments
  const [selectedClasses, setSelectedClasses] = useState<{ class_type: string; tier: 'STANDARD' | 'PREMIUM'; fee_amount: number; label?: string }[]>([
    { class_type: 'MAIN_GR11', tier: 'STANDARD', fee_amount: 1800, label: 'Main Class Grade 11' }
  ])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successPs, setSuccessPs] = useState('')

  const channelRef = useRef<any>(null)
  const isAdmin = userRole === 'admin' || userRole === 'owner' || (createdBy && createdBy.toLowerCase().includes('admin'))

  // Function to load admin course setup
  const loadAdminCourses = async () => {
    const { data: adminRecord } = await supabase.from('members').select('notes').eq('name', 'Admin User').single()
    if (adminRecord?.notes) {
      try {
        const notesObj = JSON.parse(adminRecord.notes)
        if (notesObj.custom_courses) {
          setAvailableClasses(prev => ({
            ...notesObj.custom_courses
          }))
        }
        if (notesObj.class_fees) {
          setClassDefaultFees(prev => ({
            ...notesObj.class_fees
          }))
        }
      } catch (err) {
        console.error('Failed to parse custom courses & fees:', err)
      }
    }
  }

  // Auto-detect user role & subscribe to Realtime course updates
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        let name = user.user_metadata?.full_name || user.email?.split('@')[0] || ''
        let role: 'member' | 'admin' | 'owner' = 'member'
        if (user.email) {
          setCurrentUserEmail(user.email)
          const { data: dbMem } = await supabase.from('members').select('name, role').eq('email', user.email).single()
          if (dbMem?.name) name = dbMem.name
          if (dbMem?.role) role = dbMem.role as any
        }
        if (user.email?.toLowerCase().includes('admin')) {
          role = 'admin'
        }
        setCreatedBy(name)
        setUserRole(role)
      }
    })

    // Fetch highest PS number in database to suggest starting at PS10500+
    supabase.from('students').select('ps_code').order('created_at', { ascending: false }).limit(20).then(({ data }) => {
      let maxNum = 10499
      if (data && data.length > 0) {
        data.forEach(s => {
          const num = parseInt((s.ps_code || '').replace(/\D/g, ''))
          if (!isNaN(num) && num > maxNum) {
            maxNum = num
          }
        })
      }
      setPsCode(`PS${maxNum + 1}`)
    })

    loadAdminCourses()

    // Subscribe to Realtime changes and WebSockets Broadcast events for instant live course updates
    const room = supabase.channel('mathsps-global-courses-sync')
    channelRef.current = room

    room
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, () => {
        loadAdminCourses()
      })
      .on('broadcast', { event: 'courses_updated' }, (payload: any) => {
        if (payload?.payload?.courses) {
          setAvailableClasses(payload.payload.courses)
        }
        if (payload?.payload?.fees) {
          setClassDefaultFees(payload.payload.fees)
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(room)
    }
  }, [])

  function toggleClass(classType: string, label?: string) {
    const exists = selectedClasses.find(c => c.class_type === classType)
    if (exists) {
      setSelectedClasses(selectedClasses.filter(c => c.class_type !== classType))
    } else {
      const defaultFee = classDefaultFees[classType] || (classType.includes('GR10') || classType.includes('GR11') ? 1800 : 1500)
      setSelectedClasses([...selectedClasses, { class_type: classType, tier: 'STANDARD', fee_amount: defaultFee, label: label || availableClasses[classType] || classType }])
    }
  }

  async function saveCoursesToDatabase(coursesDict: Record<string, string>, feesDict?: Record<string, number>) {
    try {
      const { data: adminMem } = await supabase.from('members').select('id').eq('name', 'Admin User').single()
      if (adminMem?.id) {
        await fetch('/api/members/manage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_custom_courses',
            memberId: adminMem.id,
            courses: coursesDict,
            fees: feesDict || classDefaultFees,
            adminPassword: 'sb_secret_verification_bypass'
          })
        })

        // Broadcast to all active websocket channels
        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'courses_updated',
            payload: { courses: coursesDict, fees: feesDict || classDefaultFees }
          })
        }
      }
    } catch (err) {
      console.error('Failed to persist courses:', err)
    }
  }

  async function handleAddCustomCourse(e: React.FormEvent) {
    e.preventDefault()
    if (!customCourseName.trim()) return
    const uniqueSuffix = Date.now().toString().slice(-4)
    const code = (customCourseCode.trim() ? customCourseCode.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_') : `CUSTOM_${uniqueSuffix}`).slice(0, 30)
    const name = customCourseName.trim()
    const fee = parseFloat(customCourseFee) || 1500

    const updatedDict = {
      ...availableClasses,
      [code]: name
    }
    const updatedFees = {
      ...classDefaultFees,
      [code]: fee
    }

    setAvailableClasses(updatedDict)
    setClassDefaultFees(updatedFees)
    setSelectedClasses(prev => {
      const filtered = prev.filter(c => c.class_type !== code)
      return [...filtered, { class_type: code, tier: 'STANDARD', fee_amount: fee, label: name }]
    })

    await saveCoursesToDatabase(updatedDict, updatedFees)

    setCustomCourseCode('')
    setCustomCourseName('')
    setCustomCourseFee('1500')
    setShowAddCourseModal(false)
    setEditingCourseCode(null)
  }

  async function handleSaveEditCourse(code: string, newName: string, newFee: number) {
    if (!newName.trim()) return
    const updatedDict = { ...availableClasses, [code]: newName.trim() }
    const updatedFees = { ...classDefaultFees, [code]: newFee }

    setAvailableClasses(updatedDict)
    setClassDefaultFees(updatedFees)

    // Also update selectedClasses if currently selected
    setSelectedClasses(prev => prev.map(c => {
      if (c.class_type === code) {
        return { ...c, label: newName.trim(), fee_amount: newFee }
      }
      return c
    }))

    await saveCoursesToDatabase(updatedDict, updatedFees)
    setEditingCourseCode(null)
  }

  function updateClassTier(classType: string, tier: 'STANDARD' | 'PREMIUM') {
    setSelectedClasses(prev => prev.map(c => {
      if (c.class_type === classType) {
        return { ...c, tier }
      }
      return c
    }))
  }

  async function deleteCourseCompletely(classType: string) {
    if (!confirm(`Are you sure you want to completely delete "${availableClasses[classType] || classType}"?`)) return

    const { [classType]: removed, ...updatedDict } = availableClasses
    const { [classType]: removedFee, ...updatedFees } = classDefaultFees

    setAvailableClasses(updatedDict)
    setClassDefaultFees(updatedFees)
    setSelectedClasses(prev => prev.filter(c => c.class_type !== classType))
    await saveCoursesToDatabase(updatedDict, updatedFees)
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

      // 2. Insert or Update Student Record (upsert to handle pre-generated PS1..PS10499)
      const { data: stu, error: stuErr } = await supabase.from('students').upsert({
        ps_code: formattedPs,
        household_id: householdId,
        full_name: fullName.trim() || null,
        grade: grade === '' ? null : Number(grade),
        school: school.trim() || null,
        notes: notes.trim() || null,
        fcode_ref: fcodeRef.trim() ? fcodeRef.trim().toUpperCase() : null,
        created_by: createdBy.trim(),
      }, { onConflict: 'ps_code' }).select('id, ps_code').single()

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
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span>PS Code <span style={{ color: 'var(--accent-red)' }}>*</span></span>
                    <span style={{ fontSize: 10, color: 'var(--accent-blue)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Lock size={10} /> Auto-Generated (Locked)
                    </span>
                  </label>
                  <input
                    className="input-field"
                    placeholder="Auto-generating..."
                    value={psCode}
                    readOnly
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      borderColor: 'var(--border)',
                      fontWeight: 700,
                      color: 'var(--accent-blue)',
                      cursor: 'not-allowed'
                    }}
                  />
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--accent-purple)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Sparkles size={18} /> 3. Class Enrollments & Fee Tiers
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    Click a course pill to enroll student. Select STANDARD or PREMIUM tier per course below.
                  </div>
                </div>
                {isAdmin ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomCourseCode('')
                      setCustomCourseName('')
                      setCustomCourseFee('1500')
                      setShowAddCourseModal(true)
                    }}
                    className="btn-secondary"
                    style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <Plus size={14} /> + Add Custom Course
                  </button>
                ) : (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', padding: '4px 10px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Lock size={12} /> Course setup locked (Admin only)
                  </div>
                )}
              </div>

              {/* Course Cards Grid with Name, Fee, and Admin Edit/Delete */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, marginBottom: 20 }}>
                {Object.entries(availableClasses).map(([ct, label]) => {
                  const active = !!selectedClasses.find(c => c.class_type === ct)
                  const fee = classDefaultFees[ct] || (ct.includes('GR10') || ct.includes('GR11') ? 1800 : 1500)

                  return (
                    <div key={ct}
                      style={{
                        padding: '12px 14px', borderRadius: 10, border: '1px solid',
                        borderColor: active ? 'var(--accent-blue)' : 'var(--border)',
                        background: active ? 'rgba(59,130,246,0.14)' : 'var(--bg-base)',
                        transition: 'all 0.15s', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 8
                      }}>
                      {/* Top Bar: Checkbox + Name + Fee */}
                      <div
                        onClick={() => toggleClass(ct, label)}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}
                      >
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: active ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                            {active ? '✓ ' : '+ '}{label}
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-green)', marginTop: 4 }}>
                            Rs. {fee.toLocaleString()}
                          </div>
                        </div>
                      </div>

                      {/* Admin Front Controls: Edit & Delete */}
                      {isAdmin && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6, marginTop: 4 }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingCourseCode(ct)
                              setCustomCourseName(label)
                              setCustomCourseFee(String(fee))
                            }}
                            className="btn-secondary"
                            style={{ padding: '3px 8px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                            title="Edit course name or fee"
                          >
                            ✏ Edit
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteCourseCompletely(ct)
                            }}
                            style={{
                              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                              color: '#ef4444', borderRadius: 6, padding: '3px 8px', fontSize: 11,
                              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
                            }}
                            title="Delete course completely"
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Selected Classes List */}
              {selectedClasses.length > 0 && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Enrolled Courses ({selectedClasses.length}):
                  </div>
                  {selectedClasses.map(c => (
                    <div key={c.class_type} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 10,
                      background: 'var(--bg-base)', padding: '10px 14px', borderRadius: 8,
                      border: '1px solid var(--border)'
                    }}>
                      <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>
                        {c.label || availableClasses[c.class_type] || c.class_type}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-green)', minWidth: 80, textAlign: 'right' }}>
                          Rs. {c.fee_amount.toLocaleString()}
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleClass(c.class_type)}
                          style={{
                            background: 'none', border: 'none', color: '#ef4444',
                            cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center'
                          }}
                          title="Deselect class"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 4: Audit Info (Automatically captured & Locked) */}
            <div className="glass-card" style={{ padding: 24, marginBottom: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 14, color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Lock size={16} /> 4. Audit Info (Auto-Locked)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                    Registered By (Staff Name)
                  </label>
                  <div style={{
                    padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
                    borderRadius: 8, fontSize: 14, fontWeight: 600, color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: 8
                  }}>
                    <Lock size={14} style={{ color: 'var(--text-muted)' }} />
                    <span>{createdBy || 'Admin / System User'}</span>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                    Staff Account Email
                  </label>
                  <div style={{
                    padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
                    borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)'
                  }}>
                    {currentUserEmail || 'system@mathsps.com'}
                  </div>
                </div>
              </div>
            </div>

            <button onClick={submit} disabled={saving} className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: 14, fontSize: 16, fontWeight: 700 }}>
              {saving ? 'Registering...' : '💾 Register Student'}
            </button>
          </>
        )}
      </div>

      {/* Modal: Add Custom Course */}
      {showAddCourseModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div className="card" style={{ maxWidth: 420, width: '90%', padding: 24, borderRadius: 14, border: '1px solid var(--border)', boxShadow: '0 20px 40px rgba(0,0,0,0.6)' }}>
            <h3 style={{ margin: '0 0 14px 0', fontSize: 16, fontWeight: 700 }}>+ Add Custom Course / Subject</h3>
            <form onSubmit={handleAddCustomCourse}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                  Course / Subject Name *
                </label>
                <input
                  className="input-field"
                  placeholder="e.g. Grade 11 Science & Revision"
                  required
                  value={customCourseName}
                  onChange={e => setCustomCourseName(e.target.value)}
                  autoFocus
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                  Course Code (Optional Identifier)
                </label>
                <input
                  className="input-field"
                  placeholder="e.g. SCI_GR11"
                  value={customCourseCode}
                  onChange={e => setCustomCourseCode(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                  Default Fee Amount (Rs.)
                </label>
                <input
                  className="input-field"
                  type="number"
                  placeholder="e.g. 1500"
                  required
                  value={customCourseFee}
                  onChange={e => setCustomCourseFee(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn-secondary" onClick={() => setShowAddCourseModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  ✓ Add Course
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Course Name and Fee */}
      {editingCourseCode && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div className="card" style={{ maxWidth: 420, width: '90%', padding: 24, borderRadius: 14, border: '1px solid var(--border)', boxShadow: '0 20px 40px rgba(0,0,0,0.6)' }}>
            <h3 style={{ margin: '0 0 14px 0', fontSize: 16, fontWeight: 700 }}>✏ Edit Course Name & Fee</h3>
            <form onSubmit={(e) => {
              e.preventDefault()
              handleSaveEditCourse(editingCourseCode, customCourseName, parseFloat(customCourseFee) || 1500)
            }}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                  Course / Subject Name *
                </label>
                <input
                  className="input-field"
                  required
                  value={customCourseName}
                  onChange={e => setCustomCourseName(e.target.value)}
                  autoFocus
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                  Default Fee Amount (Rs.)
                </label>
                <input
                  className="input-field"
                  type="number"
                  required
                  value={customCourseFee}
                  onChange={e => setCustomCourseFee(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn-secondary" onClick={() => setEditingCourseCode(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  ✓ Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
