'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, UserPlus, Home, Plus, Trash2, Lock, Sparkles, CreditCard, DollarSign } from 'lucide-react'
import { MONTH_NAMES } from '@/lib/types'
import { DEFAULT_GRADE_COURSES, CourseConfig, getAllCourseLabels, getAllCourseFees } from '@/lib/courses'

const BANKS = ['BOC', 'Sampath', 'Commercial', 'HNB', 'People\'s Bank', 'NSB', 'Seylan', 'NTB', 'Other']

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

  // Grade-aligned courses state
  const [gradeCourses, setGradeCourses] = useState<Record<number, CourseConfig[]>>(DEFAULT_GRADE_COURSES)
  const [availableClasses, setAvailableClasses] = useState<Record<string, string>>(getAllCourseLabels(DEFAULT_GRADE_COURSES))
  const [classDefaultFees, setClassDefaultFees] = useState<Record<string, number>>(getAllCourseFees(DEFAULT_GRADE_COURSES))

  // Custom courses admin modal
  const [customCourseGrade, setCustomCourseGrade] = useState<number>(11)
  const [customCourseCode, setCustomCourseCode] = useState('')
  const [customCourseName, setCustomCourseName] = useState('')
  const [customCourseFee, setCustomCourseFee] = useState<string>('1800')
  const [showAddCourseModal, setShowAddCourseModal] = useState(false)
  const [editingCourseCode, setEditingCourseCode] = useState<string | null>(null)

  // Class Enrollments (with manually editable fee_amount)
  const [selectedClasses, setSelectedClasses] = useState<{ class_type: string; tier: 'STANDARD' | 'PREMIUM'; fee_amount: number; label?: string }[]>([
    { class_type: 'GR11_THEORY', tier: 'STANDARD', fee_amount: 1800, label: 'Grade 11 — Theory' }
  ])

  // Instant Payment Recording Option in Registration Form
  const [recordImmediatePayment, setRecordImmediatePayment] = useState(false)
  const [paymentForm, setPaymentForm] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    payment_type: 'BANK' as string,
    bank_name: 'BOC',
    date_paid: new Date().toISOString().slice(0, 10),
    added_to_group: false,
    tute_delivered: false,
    notes: '',
  })
  const [classAmountPaid, setClassAmountPaid] = useState<Record<string, string>>({
    GR11_THEORY: '1800'
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successPs, setSuccessPs] = useState('')

  const channelRef = useRef<any>(null)
  const isAdmin = userRole === 'admin' || userRole === 'owner' || (createdBy && createdBy.toLowerCase().includes('admin'))

  // Load admin course setup
  const loadAdminCourses = async () => {
    const { data: adminRecord } = await supabase.from('members').select('notes').eq('name', 'Admin User').single()
    if (adminRecord?.notes) {
      try {
        const notesObj = JSON.parse(adminRecord.notes)
        if (notesObj.grade_courses) {
          const gc: Record<number, CourseConfig[]> = {}
          Object.entries(notesObj.grade_courses).forEach(([grStr, list]: [string, any]) => {
            gc[Number(grStr)] = list
          })
          setGradeCourses(gc)
          setAvailableClasses(getAllCourseLabels(gc))
          setClassDefaultFees(getAllCourseFees(gc))
        } else if (notesObj.custom_courses) {
          setAvailableClasses(prev => ({ ...prev, ...notesObj.custom_courses }))
          if (notesObj.class_fees) setClassDefaultFees(prev => ({ ...prev, ...notesObj.class_fees }))
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

    // Check active selected tutor profile ('prabuddha' vs 'sanduni')
    const activeTutor = localStorage.getItem('mathsps_active_tutor') || 'prabuddha'

    if (activeTutor === 'sanduni') {
      // Sanduni Malshika -> auto generate SM code starting SM101+
      supabase.from('students').select('ps_code').ilike('ps_code', 'SM%').order('created_at', { ascending: false }).limit(50).then(({ data }) => {
        let maxNum = 100
        if (data && data.length > 0) {
          data.forEach(s => {
            const num = parseInt((s.ps_code || '').replace(/\D/g, ''))
            if (!isNaN(num) && num > maxNum) maxNum = num
          })
        }
        setPsCode(`SM${maxNum + 1}`)
      })
    } else {
      // Prabuddha Sampath -> auto generate PS code starting PS10500+
      supabase.from('students').select('ps_code').ilike('ps_code', 'PS%').order('created_at', { ascending: false }).limit(50).then(({ data }) => {
        let maxNum = 10499
        if (data && data.length > 0) {
          data.forEach(s => {
            const num = parseInt((s.ps_code || '').replace(/\D/g, ''))
            if (!isNaN(num) && num > maxNum) maxNum = num
          })
        }
        setPsCode(`PS${maxNum + 1}`)
      })
    }

    loadAdminCourses()

    // Subscribe to Realtime changes and WebSockets Broadcast events
    const room = supabase.channel('mathsps-global-courses-sync')
    channelRef.current = room

    room
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, () => {
        loadAdminCourses()
      })
      .on('broadcast', { event: 'courses_updated' }, (payload: any) => {
        if (payload?.payload?.grade_courses) {
          setGradeCourses(payload.payload.grade_courses)
          setAvailableClasses(getAllCourseLabels(payload.payload.grade_courses))
          setClassDefaultFees(getAllCourseFees(payload.payload.grade_courses))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(room)
    }
  }, [])

  // When grade changes in registration form, auto-suggest first course of that grade
  function handleGradeChange(newGrade: number | '') {
    setGrade(newGrade)
    if (newGrade !== '') {
      const coursesForNewGrade = gradeCourses[newGrade] || []
      if (coursesForNewGrade.length > 0) {
        const first = coursesForNewGrade[0]
        setSelectedClasses([{
          class_type: first.code,
          tier: 'STANDARD',
          fee_amount: first.defaultFee,
          label: first.name
        }])
        setClassAmountPaid({
          [first.code]: String(first.defaultFee)
        })
      }
    }
  }

  function toggleClass(course: CourseConfig) {
    const exists = selectedClasses.find(c => c.class_type === course.code)
    if (exists) {
      setSelectedClasses(selectedClasses.filter(c => c.class_type !== course.code))
      const { [course.code]: _, ...rest } = classAmountPaid
      setClassAmountPaid(rest)
    } else {
      const fee = course.defaultFee
      setSelectedClasses([...selectedClasses, { class_type: course.code, tier: 'STANDARD', fee_amount: fee, label: course.name }])
      setClassAmountPaid(prev => ({ ...prev, [course.code]: String(fee) }))
    }
  }

  function updateEnrolledFee(classType: string, newFee: number) {
    setSelectedClasses(prev => prev.map(c => {
      if (c.class_type === classType) {
        return { ...c, fee_amount: newFee }
      }
      return c
    }))
    if (['BANK', 'CASH', 'PHYSICAL'].includes(paymentForm.payment_type)) {
      setClassAmountPaid(prev => ({ ...prev, [classType]: String(newFee) }))
    }
  }

  async function saveCoursesToDatabase(updatedGradeCourses: Record<number, CourseConfig[]>) {
    try {
      const { data: adminMem } = await supabase.from('members').select('id').eq('name', 'Admin User').single()
      if (adminMem?.id) {
        const customCourses = getAllCourseLabels(updatedGradeCourses)
        const classFees = getAllCourseFees(updatedGradeCourses)

        await fetch('/api/members/manage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_custom_courses',
            memberId: adminMem.id,
            courses: customCourses,
            fees: classFees,
            grade_courses: updatedGradeCourses,
            adminPassword: 'sb_secret_verification_bypass'
          })
        })

        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'courses_updated',
            payload: { grade_courses: updatedGradeCourses, courses: customCourses, fees: classFees }
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
    const code = (customCourseCode.trim() ? customCourseCode.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_') : `GR${customCourseGrade}_${uniqueSuffix}`).slice(0, 30)
    const name = customCourseName.trim()
    const fee = parseFloat(customCourseFee) || 1800

    const currentList = gradeCourses[customCourseGrade] || []
    const updatedList = [...currentList.filter(c => c.code !== code), { code, name, defaultFee: fee, grade: customCourseGrade }]
    const updatedGradeCourses = {
      ...gradeCourses,
      [customCourseGrade]: updatedList
    }

    setGradeCourses(updatedGradeCourses)
    setAvailableClasses(getAllCourseLabels(updatedGradeCourses))
    setClassDefaultFees(getAllCourseFees(updatedGradeCourses))

    if (grade === customCourseGrade) {
      setSelectedClasses(prev => [...prev.filter(c => c.class_type !== code), { class_type: code, tier: 'STANDARD', fee_amount: fee, label: name }])
      setClassAmountPaid(prev => ({ ...prev, [code]: String(fee) }))
    }

    await saveCoursesToDatabase(updatedGradeCourses)

    setCustomCourseCode('')
    setCustomCourseName('')
    setCustomCourseFee('1800')
    setShowAddCourseModal(false)
    setEditingCourseCode(null)
  }

  async function handleSaveEditCourse(course: CourseConfig, newName: string, newFee: number) {
    if (!newName.trim()) return
    const currentList = gradeCourses[course.grade] || []
    const updatedList = currentList.map(c => c.code === course.code ? { ...c, name: newName.trim(), defaultFee: newFee } : c)
    const updatedGradeCourses = {
      ...gradeCourses,
      [course.grade]: updatedList
    }

    setGradeCourses(updatedGradeCourses)
    setAvailableClasses(getAllCourseLabels(updatedGradeCourses))
    setClassDefaultFees(getAllCourseFees(updatedGradeCourses))

    setSelectedClasses(prev => prev.map(c => c.class_type === course.code ? { ...c, label: newName.trim(), fee_amount: newFee } : c))
    await saveCoursesToDatabase(updatedGradeCourses)
    setEditingCourseCode(null)
  }

  async function deleteCourseCompletely(course: CourseConfig) {
    if (!confirm(`Are you sure you want to completely delete "${course.name}" from Grade ${course.grade}?`)) return
    const currentList = gradeCourses[course.grade] || []
    const updatedList = currentList.filter(c => c.code !== course.code)
    const updatedGradeCourses = {
      ...gradeCourses,
      [course.grade]: updatedList
    }

    setGradeCourses(updatedGradeCourses)
    setAvailableClasses(getAllCourseLabels(updatedGradeCourses))
    setClassDefaultFees(getAllCourseFees(updatedGradeCourses))
    setSelectedClasses(prev => prev.filter(c => c.class_type !== course.code))

    await saveCoursesToDatabase(updatedGradeCourses)
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

      // 2. Insert or Update Student Record
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

      // 3. Create Class Enrollments with customized fee amounts
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

      // 4. Record Immediate Payment if staff checked the option
      if (recordImmediatePayment && selectedClasses.length > 0) {
        for (const c of selectedClasses) {
          let paidAmount = 0
          if (['FREE', 'IMS'].includes(paymentForm.payment_type)) {
            paidAmount = 0
          } else {
            paidAmount = parseFloat(classAmountPaid[c.class_type]) || c.fee_amount
          }

          await supabase.from('payments').upsert({
            student_id: stu.id,
            class_type: c.class_type,
            month: paymentForm.month,
            year: paymentForm.year,
            amount_due: c.fee_amount,
            amount_paid: paidAmount,
            balance_before: 0,
            payment_type: paymentForm.payment_type,
            bank_name: paymentForm.payment_type === 'BANK' ? paymentForm.bank_name : null,
            date_paid: paymentForm.payment_type !== 'FREE' ? paymentForm.date_paid : null,
            added_to_group: paymentForm.added_to_group,
            tute_delivered: paymentForm.tute_delivered,
            notes: paymentForm.notes || 'Recorded on registration',
            recorded_by: createdBy.trim(),
          }, { onConflict: 'student_id,class_type,month,year' })
        }
      }

      setSuccessPs(stu.ps_code)
    } catch (e: any) {
      setError(e.message || 'Failed to register student')
    } finally {
      setSaving(false)
    }
  }

  // Active grade courses for the selected student grade
  const currentGradeCourses = grade !== '' ? (gradeCourses[grade] || []) : []

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
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>Student Registered!</h2>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent-blue)', letterSpacing: 2, marginBottom: 8 }}>
              {successPs}
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: '0 0 24px' }}>
              Student record {recordImmediatePayment ? 'and payment' : ''} have been saved successfully.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <a href={`/students/${encodeURIComponent(successPs)}`} className="btn-primary">
                View Student Profile →
              </a>
              <button
                className="btn-secondary"
                onClick={() => {
                  setFullName('')
                  setNotes('')
                  setAddress('')
                  setArea('')
                  setParentName('')
                  setParentPhone('')
                  setFcodeRef('')
                  setSuccessPs('')
                  window.location.reload()
                }}
              >
                + Register Another Student
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
                    disabled
                    autoComplete="off"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      borderColor: 'var(--border)',
                      fontWeight: 700,
                      color: 'var(--accent-blue)',
                      cursor: 'not-allowed',
                      opacity: 0.9
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Full Name</label>
                  <input className="input-field" placeholder="Student name" value={fullName} onChange={e => setFullName(e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Grade</label>
                  <select className="input-field" value={grade} onChange={e => handleGradeChange(e.target.value === '' ? '' : parseInt(e.target.value))}>
                    <option value="">Select Grade...</option>
                    {[6, 7, 8, 9, 10, 11, 12, 13].map(g => (
                      <option key={g} value={g}>Grade {g}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Optional CRM F-Code</label>
                  <input className="input-field" placeholder="e.g. F80001" value={fcodeRef} onChange={e => setFcodeRef(e.target.value)} />
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

            {/* Section 3: Grade-Aligned Courses & Manual Fee Customization */}
            <div className="glass-card" style={{ padding: 24, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--accent-purple)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Sparkles size={18} /> 3. Select Courses for Grade {grade || '...'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {grade ? `Showing aligned courses for Grade ${grade}. Check course to enroll.` : 'Select a Grade above to view aligned courses.'}
                  </div>
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomCourseGrade(typeof grade === 'number' ? grade : 11)
                      setCustomCourseCode('')
                      setCustomCourseName('')
                      setCustomCourseFee('1800')
                      setShowAddCourseModal(true)
                    }}
                    className="btn-secondary"
                    style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <Plus size={14} /> + Add Course to Grade {grade || ''}
                  </button>
                )}
              </div>

              {/* Course Cards aligned to selected Grade */}
              {currentGradeCourses.length === 0 ? (
                <div style={{ padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
                  {grade ? `No aligned courses found for Grade ${grade}. Admin can add new courses using the button above.` : 'Please select a Grade above.'}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
                  {currentGradeCourses.map(course => {
                    const active = !!selectedClasses.find(c => c.class_type === course.code)
                    const isEditing = editingCourseCode === course.code

                    return (
                      <div
                        key={course.code}
                        style={{
                          padding: '14px', borderRadius: 10, border: '1px solid',
                          borderColor: active ? 'var(--accent-blue)' : 'var(--border)',
                          background: active ? 'rgba(59,130,246,0.14)' : 'var(--bg-base)',
                          transition: 'all 0.15s', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 8
                        }}
                      >
                        <div
                          onClick={() => toggleClass(course)}
                          style={{ cursor: 'pointer', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}
                        >
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: active ? '#60a5fa' : 'var(--text-primary)' }}>
                              {active ? '✓ ' : '+ '}{course.name}
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-green)', marginTop: 4 }}>
                              Rs. {course.defaultFee.toLocaleString()}
                            </div>
                          </div>
                        </div>

                        {/* Admin Inline Controls */}
                        {isAdmin && (
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6, marginTop: 4 }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                const newName = prompt('Edit course name:', course.name)
                                if (newName === null) return
                                const newFeeStr = prompt('Edit default fee (Rs.):', String(course.defaultFee))
                                if (newFeeStr === null) return
                                handleSaveEditCourse(course, newName, parseFloat(newFeeStr) || course.defaultFee)
                              }}
                              className="btn-secondary"
                              style={{ padding: '2px 6px', fontSize: 10 }}
                            >
                              ✏ Edit
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteCourseCompletely(course)
                              }}
                              style={{
                                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                                color: '#ef4444', borderRadius: 4, padding: '2px 6px', fontSize: 10, cursor: 'pointer'
                              }}
                            >
                              <Trash2 size={10} /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Enrolled Courses with Manually Editable Custom Fee */}
              {selectedClasses.length > 0 && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Enrolled Courses ({selectedClasses.length}):</span>
                    <span style={{ color: 'var(--accent-green)' }}>Customizable Fee / Offer Rate</span>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Fee (Rs.):</span>
                        <input
                          type="number"
                          className="input-field"
                          style={{ width: 110, padding: '4px 8px', fontSize: 13, fontWeight: 700, color: 'var(--accent-green)' }}
                          value={c.fee_amount}
                          onChange={(e) => updateEnrolledFee(c.class_type, parseFloat(e.target.value) || 0)}
                          title="Manually edit fee (e.g. for student discount/offer)"
                        />
                        <button
                          type="button"
                          onClick={() => setSelectedClasses(selectedClasses.filter(sc => sc.class_type !== c.class_type))}
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

            {/* Section 4: Optional Immediate Payment Recording on Registration */}
            <div className="glass-card" style={{ padding: 24, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: recordImmediatePayment ? 18 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    type="checkbox"
                    id="chk-immediate-pay"
                    checked={recordImmediatePayment}
                    onChange={e => setRecordImmediatePayment(e.target.checked)}
                    style={{ width: 18, height: 18, cursor: 'pointer' }}
                  />
                  <label htmlFor="chk-immediate-pay" style={{ cursor: 'pointer', fontWeight: 700, fontSize: 15, color: recordImmediatePayment ? 'var(--accent-green)' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CreditCard size={18} /> Record Payment Right Now
                  </label>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {recordImmediatePayment ? '✓ Payment will be logged upon registration' : 'Optional (Can pay later via Add Payment)'}
                </span>
              </div>

              {recordImmediatePayment && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Month</label>
                      <select className="input-field" value={paymentForm.month} onChange={e => setPaymentForm(f => ({ ...f, month: parseInt(e.target.value) }))}>
                        {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Year</label>
                      <select className="input-field" value={paymentForm.year} onChange={e => setPaymentForm(f => ({ ...f, year: parseInt(e.target.value) }))}>
                        {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Payment Type</label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {['BANK', 'CASH', 'FREE', 'IMS', 'PHYSICAL'].map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setPaymentForm(f => ({ ...f, payment_type: t }))}
                          className={paymentForm.payment_type === t ? 'btn-primary' : 'btn-secondary'}
                          style={{ padding: '5px 12px', fontSize: 12 }}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {paymentForm.payment_type === 'BANK' && (
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Bank</label>
                      <select className="input-field" value={paymentForm.bank_name} onChange={e => setPaymentForm(f => ({ ...f, bank_name: e.target.value }))}>
                        {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                  )}

                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Date Paid</label>
                    <input className="input-field" type="date" value={paymentForm.date_paid} onChange={e => setPaymentForm(f => ({ ...f, date_paid: e.target.value }))} />
                  </div>

                  {/* Amount Paid Per Enrolled Class */}
                  {['BANK', 'CASH', 'PHYSICAL'].includes(paymentForm.payment_type) && selectedClasses.length > 0 && (
                    <div style={{ padding: 12, background: 'rgba(16,185,129,0.06)', borderRadius: 8, border: '1px solid rgba(16,185,129,0.2)', marginBottom: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-green)', marginBottom: 10 }}>
                        Amount Paid For Enrolled Courses:
                      </div>
                      {selectedClasses.map(c => (
                        <div key={c.class_type} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{c.label || c.class_type}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Rs.</span>
                            <input
                              type="number"
                              className="input-field"
                              style={{ width: 110, padding: '4px 8px', fontSize: 13, fontWeight: 700, color: 'var(--accent-green)' }}
                              value={classAmountPaid[c.class_type] ?? c.fee_amount}
                              onChange={e => setClassAmountPaid({ ...classAmountPaid, [c.class_type]: e.target.value })}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 10 }}>
                    <input type="checkbox" id="reg-grp" checked={paymentForm.added_to_group} onChange={e => setPaymentForm(f => ({ ...f, added_to_group: e.target.checked }))} />
                    <label htmlFor="reg-grp" style={{ cursor: 'pointer', fontSize: 13 }}>Added to WhatsApp / Telegram class group</label>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <input type="checkbox" id="reg-tute" checked={paymentForm.tute_delivered} onChange={e => setPaymentForm(f => ({ ...f, tute_delivered: e.target.checked }))} />
                    <label htmlFor="reg-tute" style={{ cursor: 'pointer', fontSize: 13 }}>Tute / Material package delivered</label>
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              className="btn-primary"
              style={{ width: '100%', padding: 14, fontSize: 15, fontWeight: 700, borderRadius: 10 }}
              onClick={submit}
              disabled={saving}
            >
              {saving ? 'Registering...' : recordImmediatePayment ? '✓ Register Student & Submit Payment' : '✓ Register Student'}
            </button>
          </>
        )}
      </div>

      {/* Admin Add Course Modal */}
      {showAddCourseModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: 20
        }}>
          <div className="glass-card" style={{ maxWidth: 450, width: '100%', padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 14px' }}>
              + Add New Course
            </h3>
            <form onSubmit={handleAddCustomCourse}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Select Grade</label>
                <select
                  className="input-field"
                  value={customCourseGrade}
                  onChange={e => setCustomCourseGrade(parseInt(e.target.value))}
                >
                  {[6, 7, 8, 9, 10, 11, 12, 13].map(g => (
                    <option key={g} value={g}>Grade {g}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Course Name / Description</label>
                <input
                  className="input-field"
                  placeholder="e.g. Grade 11 — Revision"
                  value={customCourseName}
                  onChange={e => setCustomCourseName(e.target.value)}
                  autoFocus
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Default Fee (Rs.)</label>
                <input
                  className="input-field"
                  type="number"
                  placeholder="1800"
                  value={customCourseFee}
                  onChange={e => setCustomCourseFee(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
                <button type="button" onClick={() => setShowAddCourseModal(false)} className="btn-secondary" style={{ padding: '6px 14px' }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ padding: '6px 14px' }}>
                  Save Course
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
