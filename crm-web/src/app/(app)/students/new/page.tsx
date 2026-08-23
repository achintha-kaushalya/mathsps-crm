'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, UserPlus, Users, Plus, Trash2, Sparkles, CreditCard, CheckCircle2, Home } from 'lucide-react'
import { MONTH_NAMES } from '@/lib/types'
import { DEFAULT_GRADE_COURSES, CourseConfig, getAllCourseLabels, getAllCourseFees } from '@/lib/courses'

const BANKS = ['BOC', 'Sampath', 'Commercial', 'HNB', 'People\'s Bank', 'NSB', 'Seylan', 'NTB', 'Other']

interface SiblingChild {
  id: string
  psCode: string
  fullName: string
  grade: number
  school: string
  courseCode: string
  fee: number
}

export default function NewStudentPage() {
  const supabase = createClient()

  // Registration Mode: Single Child (default, ultra-clean) vs Multiple Children / Siblings
  const [regMode, setRegMode] = useState<'single' | 'siblings'>('single')

  // --- Single Student State ---
  const [psCode, setPsCode] = useState('')
  const [fullName, setFullName] = useState('')
  const [primaryGrade, setPrimaryGrade] = useState<number>(10)
  const [school, setSchool] = useState('')
  const [selectedCourseCode, setSelectedCourseCode] = useState('')
  const [courseFee, setCourseFee] = useState<number>(1800)
  const [fcodeRef, setFcodeRef] = useState('')

  // Household info (Parent Contact & Delivery)
  const [parentName, setParentName] = useState('')
  const [parentPhone, setParentPhone] = useState('')
  const [address, setAddress] = useState('')
  const [area, setArea] = useState('')

  // --- Multi-Child / Siblings State ---
  const [siblingsList, setSiblingsList] = useState<SiblingChild[]>([
    {
      id: 'child-1',
      psCode: '',
      fullName: '',
      grade: 10,
      school: '',
      courseCode: '',
      fee: 1800
    },
    {
      id: 'child-2',
      psCode: '',
      fullName: '',
      grade: 6,
      school: '',
      courseCode: '',
      fee: 1500
    }
  ])

  // User details
  const [createdBy, setCreatedBy] = useState('')
  const [currentUserEmail, setCurrentUserEmail] = useState('')
  const [userRole, setUserRole] = useState<'member' | 'admin' | 'owner'>('member')

  // Grade-aligned courses configuration
  const [gradeCourses, setGradeCourses] = useState<Record<number, CourseConfig[]>>(DEFAULT_GRADE_COURSES)
  const [availableClasses, setAvailableClasses] = useState<Record<string, string>>(getAllCourseLabels(DEFAULT_GRADE_COURSES))
  const [classDefaultFees, setClassDefaultFees] = useState<Record<string, number>>(getAllCourseFees(DEFAULT_GRADE_COURSES))

  // Instant Payment Recording Option
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
  const [singleAmountPaid, setSingleAmountPaid] = useState<string>('1800')
  const [siblingAmountPaid, setSiblingAmountPaid] = useState<Record<string, string>>({})

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successResult, setSuccessResult] = useState<{ codes: string[]; isMulti: boolean } | null>(null)

  const channelRef = useRef<any>(null)

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
        }
      } catch (err) {
        console.error('Failed to parse custom courses & fees:', err)
      }
    }
  }

  // Generate next available PS codes
  async function fetchNextPsCode(prefix: string, count: number = 1): Promise<string[]> {
    const { data } = await supabase
      .from('students')
      .select('ps_code')
      .ilike('ps_code', `${prefix}%`)
      .order('created_at', { ascending: false })
      .limit(80)

    let maxNum = prefix === 'SM' ? 100 : 10499
    if (data && data.length > 0) {
      data.forEach(s => {
        const num = parseInt((s.ps_code || '').replace(/\D/g, ''))
        if (!isNaN(num) && num > maxNum) maxNum = num
      })
    }

    const generated: string[] = []
    for (let i = 1; i <= count; i++) {
      generated.push(`${prefix}${maxNum + i}`)
    }
    return generated
  }

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

    const activeTutor = localStorage.getItem('mathsps_active_tutor') || 'prabuddha'
    const prefix = activeTutor === 'sanduni' ? 'SM' : 'PS'

    fetchNextPsCode(prefix, 4).then(codes => {
      if (codes[0]) setPsCode(codes[0])
      setSiblingsList(prev => prev.map((s, idx) => ({ ...s, psCode: codes[idx] || `${prefix}${10500 + idx}` })))
    })

    loadAdminCourses()

    const room = supabase.channel('mathsps-global-courses-sync')
    channelRef.current = room
    room
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, () => loadAdminCourses())
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

  // Auto-set default course for single mode
  useEffect(() => {
    const coursesForGrade = gradeCourses[primaryGrade] || []
    if (coursesForGrade.length > 0) {
      const def = coursesForGrade[0]
      setSelectedCourseCode(def.code)
      setCourseFee(def.defaultFee)
      setSingleAmountPaid(String(def.defaultFee))
    }
  }, [primaryGrade, gradeCourses])

  // Auto-set default courses for siblings mode
  useEffect(() => {
    setSiblingsList(prev => prev.map(s => {
      const coursesForGrade = gradeCourses[s.grade] || []
      const def = coursesForGrade[0]
      const cCode = s.courseCode && coursesForGrade.some(c => c.code === s.courseCode) ? s.courseCode : (def ? def.code : '')
      const fee = def ? def.defaultFee : s.fee
      return { ...s, courseCode: cCode, fee }
    }))
  }, [gradeCourses])

  // Sibling Helpers
  function handleAddSiblingRow() {
    const activeTutor = localStorage.getItem('mathsps_active_tutor') || 'prabuddha'
    const prefix = activeTutor === 'sanduni' ? 'SM' : 'PS'
    const nextIdx = siblingsList.length + 1

    fetchNextPsCode(prefix, nextIdx).then(codes => {
      const nextCode = codes[codes.length - 1] || `${prefix}${10500 + nextIdx}`
      const defGrade = 6
      const courses = gradeCourses[defGrade] || []
      const defCourse = courses[0]

      const newSib: SiblingChild = {
        id: `child-${Date.now()}`,
        psCode: nextCode,
        fullName: '',
        grade: defGrade,
        school: '',
        courseCode: defCourse ? defCourse.code : '',
        fee: defCourse ? defCourse.defaultFee : 1500
      }
      setSiblingsList([...siblingsList, newSib])
    })
  }

  function handleRemoveSiblingRow(id: string) {
    if (siblingsList.length <= 2) {
      alert('Keep at least 2 children for Sibling Registration mode, or switch to Single Student.')
      return
    }
    setSiblingsList(siblingsList.filter(s => s.id !== id))
  }

  function handleSiblingChange(id: string, updates: Partial<SiblingChild>) {
    setSiblingsList(prev => prev.map(s => {
      if (s.id === id) {
        const merged = { ...s, ...updates }
        if (updates.grade !== undefined) {
          const courses = gradeCourses[updates.grade] || []
          const def = courses[0]
          merged.courseCode = def ? def.code : ''
          merged.fee = def ? def.defaultFee : 1800
        } else if (updates.courseCode !== undefined) {
          const fee = classDefaultFees[updates.courseCode] || 1800
          merged.fee = fee
        }
        return merged
      }
      return s
    }))
  }

  // Form Submission
  async function submit() {
    setError('')
    setSaving(true)

    try {
      let householdId: string | null = null

      // 1. Create Household record if parent details or address are provided
      if (parentName.trim() || parentPhone.trim() || address.trim() || area.trim()) {
        const { data: hhData, error: hhErr } = await supabase.from('households').insert({
          parent_name: parentName.trim() || null,
          parent_phone: parentPhone.trim() || null,
          address: address.trim() || null,
          area: area.trim() || null,
        }).select().single()

        if (hhErr) throw hhErr
        householdId = hhData?.id || null
      }

      if (regMode === 'single') {
        // --- SINGLE STUDENT REGISTRATION ---
        if (!psCode.trim()) throw new Error('PS Code is required')
        if (!selectedCourseCode) throw new Error('Please select a course for this student')

        const { data: stuData, error: stuErr } = await supabase.from('students').insert({
          ps_code: psCode.trim().toUpperCase(),
          full_name: fullName.trim() || null,
          grade: primaryGrade,
          school: school.trim() || null,
          household_id: householdId,
          fcode_ref: fcodeRef.trim() || null,
          created_by: createdBy.trim() || 'Admin / System User',
        }).select().single()

        if (stuErr) throw stuErr

        // Create Enrollment
        const { error: enrolErr } = await supabase.from('enrollments').insert({
          student_id: stuData.id,
          class_type: selectedCourseCode,
          tier: 'STANDARD',
          fee_amount: courseFee,
          active: true,
        })
        if (enrolErr) throw enrolErr

        // Optional Immediate Payment
        if (recordImmediatePayment) {
          const paid = ['FREE', 'IMS'].includes(paymentForm.payment_type) ? 0 : parseFloat(singleAmountPaid) || 0
          const { error: payErr } = await supabase.from('payments').insert({
            student_id: stuData.id,
            class_type: selectedCourseCode,
            month: paymentForm.month,
            year: paymentForm.year,
            amount_due: courseFee,
            amount_paid: paid,
            balance_before: 0,
            payment_type: paymentForm.payment_type,
            bank_name: paymentForm.payment_type === 'BANK' ? paymentForm.bank_name : null,
            date_paid: paymentForm.payment_type !== 'FREE' ? paymentForm.date_paid : null,
            added_to_group: paymentForm.added_to_group,
            tute_delivered: paymentForm.tute_delivered,
            notes: paymentForm.notes || null,
            recorded_by: createdBy.trim() || 'Admin / System User',
          })
          if (payErr) throw payErr
        }

        setSuccessResult({ codes: [psCode.trim().toUpperCase()], isMulti: false })

      } else {
        // --- MULTIPLE CHILDREN / SIBLINGS REGISTRATION ---
        const registeredCodes: string[] = []

        for (const sib of siblingsList) {
          if (!sib.psCode.trim()) throw new Error(`PS Code is required for all children`)
          if (!sib.courseCode) throw new Error(`Please select an enrolled course for ${sib.fullName || sib.psCode}`)

          const { data: sibStu, error: sibErr } = await supabase.from('students').insert({
            ps_code: sib.psCode.trim().toUpperCase(),
            full_name: sib.fullName.trim() || null,
            grade: sib.grade,
            school: sib.school.trim() || null,
            household_id: householdId,
            fcode_ref: fcodeRef.trim() || null,
            created_by: createdBy.trim() || 'Admin / System User',
          }).select().single()

          if (sibErr) throw sibErr
          registeredCodes.push(sib.psCode.trim().toUpperCase())

          // Create Enrollment for this child
          const { error: enrolErr } = await supabase.from('enrollments').insert({
            student_id: sibStu.id,
            class_type: sib.courseCode,
            tier: 'STANDARD',
            fee_amount: sib.fee,
            active: true,
          })
          if (enrolErr) throw enrolErr

          // Optional Immediate Payment for this child
          if (recordImmediatePayment) {
            const enteredAmount = siblingAmountPaid[sib.id] !== undefined ? siblingAmountPaid[sib.id] : String(sib.fee)
            const paid = ['FREE', 'IMS'].includes(paymentForm.payment_type) ? 0 : parseFloat(enteredAmount) || 0

            const { error: payErr } = await supabase.from('payments').insert({
              student_id: sibStu.id,
              class_type: sib.courseCode,
              month: paymentForm.month,
              year: paymentForm.year,
              amount_due: sib.fee,
              amount_paid: paid,
              balance_before: 0,
              payment_type: paymentForm.payment_type,
              bank_name: paymentForm.payment_type === 'BANK' ? paymentForm.bank_name : null,
              date_paid: paymentForm.payment_type !== 'FREE' ? paymentForm.date_paid : null,
              added_to_group: paymentForm.added_to_group,
              tute_delivered: paymentForm.tute_delivered,
              notes: paymentForm.notes || null,
              recorded_by: createdBy.trim() || 'Admin / System User',
            })
            if (payErr) throw payErr
          }
        }

        setSuccessResult({ codes: registeredCodes, isMulti: true })
      }

    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // Calculate totals for payment summary
  const totalSiblingsFee = siblingsList.reduce((sum, s) => sum + s.fee, 0)
  const totalSiblingsPaid = siblingsList.reduce((sum, s) => {
    const val = siblingAmountPaid[s.id] !== undefined ? siblingAmountPaid[s.id] : String(s.fee)
    return sum + (parseFloat(val) || 0)
  }, 0)

  return (
    <div className="fade-in" style={{ paddingBottom: 60 }}>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <a href="/students" className="btn-secondary" style={{ padding: '6px 10px' }}><ArrowLeft size={14} /></a>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserPlus size={22} style={{ color: 'var(--accent-blue)' }} />
              Register Student
            </h1>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
              Add a new student or register siblings under the same household & delivery address
            </div>
          </div>
        </div>
      </div>

      <div className="page-content" style={{ maxWidth: 760 }}>
        {successResult ? (
          <div className="glass-card" style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>
              {successResult.isMulti ? 'Siblings Registered Successfully!' : 'Student Registered Successfully!'}
            </h2>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', margin: '16px 0' }}>
              {successResult.codes.map(c => (
                <div key={c} style={{
                  padding: '8px 16px', background: 'rgba(59,130,246,0.15)', border: '1px solid var(--accent-blue)',
                  borderRadius: 8, fontSize: 22, fontWeight: 800, color: 'var(--accent-blue)', letterSpacing: 1
                }}>
                  {c}
                </div>
              ))}
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: '0 0 24px' }}>
              Records {recordImmediatePayment ? 'and initial payments' : ''} have been linked to household.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <a href={`/students/${encodeURIComponent(successResult.codes[0])}`} className="btn-primary">
                View Student Profile →
              </a>
              <button
                className="btn-secondary"
                onClick={() => {
                  setFullName('')
                  setAddress('')
                  setArea('')
                  setParentName('')
                  setParentPhone('')
                  setFcodeRef('')
                  setSuccessResult(null)
                  window.location.reload()
                }}
              >
                + Register Next Student
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

            {/* Top Registration Mode Selector */}
            <div className="glass-card" style={{ padding: 18, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Registration Type:
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Choose whether registering one student or siblings in the same home
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setRegMode('single')}
                  style={{
                    padding: '8px 16px', borderRadius: 8, border: '1px solid',
                    borderColor: regMode === 'single' ? 'var(--accent-blue)' : 'var(--border)',
                    background: regMode === 'single' ? 'var(--accent-blue)' : 'rgba(255,255,255,0.03)',
                    color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s'
                  }}
                >
                  <UserPlus size={15} /> 👤 Single Child (Normal)
                </button>
                <button
                  type="button"
                  onClick={() => setRegMode('siblings')}
                  style={{
                    padding: '8px 16px', borderRadius: 8, border: '1px solid',
                    borderColor: regMode === 'siblings' ? 'var(--accent-purple)' : 'var(--border)',
                    background: regMode === 'siblings' ? 'var(--accent-purple)' : 'rgba(255,255,255,0.03)',
                    color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s'
                  }}
                >
                  <Users size={15} /> 👨‍👩‍👧‍👦 Multiple Children / Siblings
                </button>
              </div>
            </div>

            {/* MODE 1: SINGLE STUDENT FORM */}
            {regMode === 'single' && (
              <>
                {/* Step 1: Student Details */}
                <div className="glass-card" style={{ padding: 24, marginBottom: 20 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 18, color: 'var(--accent-blue)' }}>
                    1. Student Details
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 14, marginBottom: 14 }}>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                        PS Code
                      </label>
                      <input
                        className="input-field"
                        value={psCode}
                        onChange={e => setPsCode(e.target.value.toUpperCase())}
                        style={{ fontWeight: 700, letterSpacing: 1, color: 'var(--accent-blue)' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                        Student Full Name
                      </label>
                      <input
                        className="input-field"
                        placeholder="e.g. Kasun Perera"
                        value={fullName}
                        onChange={e => setFullName(e.target.value)}
                        autoFocus
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 14 }}>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                        Grade
                      </label>
                      <select
                        className="input-field"
                        value={primaryGrade}
                        onChange={e => setPrimaryGrade(parseInt(e.target.value))}
                        style={{ fontWeight: 600 }}
                      >
                        {[6, 7, 8, 9, 10, 11, 12, 13].map(g => (
                          <option key={g} value={g}>Grade {g}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                        School (Optional)
                      </label>
                      <input
                        className="input-field"
                        placeholder="e.g. Royal College"
                        value={school}
                        onChange={e => setSchool(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Step 2: Course & Fee Selection */}
                <div className="glass-card" style={{ padding: 24, marginBottom: 20 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16, color: 'var(--accent-purple)' }}>
                    2. Enrolled Course & Monthly Fee
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 14, alignItems: 'center' }}>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                        Select Grade {primaryGrade} Aligned Course
                      </label>
                      <select
                        className="input-field"
                        value={selectedCourseCode}
                        onChange={e => {
                          setSelectedCourseCode(e.target.value)
                          const fee = classDefaultFees[e.target.value] || 1800
                          setCourseFee(fee)
                          setSingleAmountPaid(String(fee))
                        }}
                        style={{ fontWeight: 600, color: 'var(--accent-blue)' }}
                      >
                        {(gradeCourses[primaryGrade] || []).map(c => (
                          <option key={c.code} value={c.code}>
                            {c.name} (Default: Rs. {c.defaultFee.toLocaleString()})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                        Monthly Fee (Rs.)
                      </label>
                      <input
                        type="number"
                        className="input-field"
                        value={courseFee}
                        onChange={e => {
                          const val = parseFloat(e.target.value) || 0
                          setCourseFee(val)
                          setSingleAmountPaid(String(val))
                        }}
                        style={{ fontWeight: 700, color: 'var(--accent-green)' }}
                        title="Edit customized fee or offer rate"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* MODE 2: MULTIPLE CHILDREN / SIBLINGS FORM */}
            {regMode === 'siblings' && (
              <div className="glass-card" style={{ padding: 24, marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--accent-purple)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Users size={18} /> Siblings & Children in Household
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      Each child gets their own PS Code, Grade, and Course, all linked under one household.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddSiblingRow}
                    className="btn-primary"
                    style={{ padding: '6px 14px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Plus size={14} /> Add Sibling
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {siblingsList.map((sib, idx) => {
                    const coursesForThisGrade = gradeCourses[sib.grade] || []

                    return (
                      <div
                        key={sib.id}
                        style={{
                          padding: 16,
                          borderRadius: 10,
                          border: '1px solid var(--border)',
                          background: 'var(--bg-base)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-blue)' }}>
                            Child #{idx + 1}
                          </span>
                          {siblingsList.length > 2 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveSiblingRow(sib.id)}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 2 }}
                              title="Remove child"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 100px', gap: 10, marginBottom: 10 }}>
                          <div>
                            <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>PS Code</label>
                            <input
                              className="input-field"
                              value={sib.psCode}
                              onChange={e => handleSiblingChange(sib.id, { psCode: e.target.value.toUpperCase() })}
                              style={{ fontWeight: 700, color: 'var(--accent-blue)', padding: '5px 8px' }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Child Name</label>
                            <input
                              className="input-field"
                              placeholder="e.g. Nethmi Perera"
                              value={sib.fullName}
                              onChange={e => handleSiblingChange(sib.id, { fullName: e.target.value })}
                              style={{ padding: '5px 8px' }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Grade</label>
                            <select
                              className="input-field"
                              value={sib.grade}
                              onChange={e => handleSiblingChange(sib.id, { grade: parseInt(e.target.value) })}
                              style={{ padding: '5px 8px', fontWeight: 600 }}
                            >
                              {[6, 7, 8, 9, 10, 11, 12, 13].map(g => (
                                <option key={g} value={g}>Grade {g}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 10 }}>
                          <div>
                            <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>
                              Grade {sib.grade} Course
                            </label>
                            <select
                              className="input-field"
                              value={sib.courseCode}
                              onChange={e => handleSiblingChange(sib.id, { courseCode: e.target.value })}
                              style={{ padding: '5px 8px', fontSize: 12, color: 'var(--accent-blue)' }}
                            >
                              {coursesForThisGrade.map(c => (
                                <option key={c.code} value={c.code}>
                                  {c.name} (Rs. {c.defaultFee})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Monthly Fee (Rs.)</label>
                            <input
                              type="number"
                              className="input-field"
                              value={sib.fee}
                              onChange={e => handleSiblingChange(sib.id, { fee: parseFloat(e.target.value) || 0 })}
                              style={{ padding: '5px 8px', fontWeight: 700, color: 'var(--accent-green)' }}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(16,185,129,0.08)', borderRadius: 8, border: '1px solid rgba(16,185,129,0.2)', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Total Children: <b>{siblingsList.length}</b></span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-green)' }}>Total Monthly Fees: Rs. {totalSiblingsFee.toLocaleString()}</span>
                </div>
              </div>
            )}

            {/* Step: Household & Delivery Address (Common for Both Modes) */}
            <div className="glass-card" style={{ padding: 24, marginBottom: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 18, color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Home size={18} /> Household & Delivery Details
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Parent / Guardian Name</label>
                  <input className="input-field" placeholder="e.g. Sunil Perera" value={parentName} onChange={e => setParentName(e.target.value)} />
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

            {/* Optional Immediate Payment Section */}
            <div className="glass-card" style={{ padding: 20, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    type="checkbox"
                    id="chk-immediate-pay"
                    checked={recordImmediatePayment}
                    onChange={e => setRecordImmediatePayment(e.target.checked)}
                    style={{ width: 18, height: 18, cursor: 'pointer' }}
                  />
                  <label htmlFor="chk-immediate-pay" style={{ cursor: 'pointer', fontSize: 14, fontWeight: 700, color: recordImmediatePayment ? 'var(--accent-blue)' : 'var(--text-primary)' }}>
                    💳 Record Payment Right Now
                  </label>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Optional (Can pay later via Add Payment)
                </div>
              </div>

              {recordImmediatePayment && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
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
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Payment Method</label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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

                  {/* Payment Amount Input */}
                  {['BANK', 'CASH', 'PHYSICAL'].includes(paymentForm.payment_type) && (
                    <div style={{ marginBottom: 14 }}>
                      {regMode === 'single' ? (
                        <div>
                          <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                            Amount Paid Now (Rs.)
                          </label>
                          <input
                            type="number"
                            className="input-field"
                            value={singleAmountPaid}
                            onChange={e => setSingleAmountPaid(e.target.value)}
                            style={{ fontWeight: 700, color: 'var(--accent-green)' }}
                          />
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>
                            Amount Paid per Sibling:
                          </label>
                          {siblingsList.map(s => (
                            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
                              <span style={{ fontSize: 13 }}>{s.fullName || s.psCode} ({availableClasses[s.courseCode] || s.courseCode}):</span>
                              <input
                                type="number"
                                className="input-field"
                                style={{ width: 140, padding: '4px 8px', fontWeight: 700, color: 'var(--accent-green)' }}
                                value={siblingAmountPaid[s.id] !== undefined ? siblingAmountPaid[s.id] : String(s.fee)}
                                onChange={e => setSiblingAmountPaid({ ...siblingAmountPaid, [s.id]: e.target.value })}
                              />
                            </div>
                          ))}
                          <div style={{ textAlign: 'right', fontSize: 14, fontWeight: 700, color: 'var(--accent-green)', marginTop: 4 }}>
                            Total Batch Payment: Rs. {totalSiblingsPaid.toLocaleString()}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
                      <input
                        type="checkbox"
                        id="chk-add-grp"
                        checked={paymentForm.added_to_group}
                        onChange={e => setPaymentForm(f => ({ ...f, added_to_group: e.target.checked }))}
                      />
                      <label htmlFor="chk-add-grp" style={{ fontSize: 12 }}>Added to WhatsApp Group</label>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
                      <input
                        type="checkbox"
                        id="chk-add-tute"
                        checked={paymentForm.tute_delivered}
                        onChange={e => setPaymentForm(f => ({ ...f, tute_delivered: e.target.checked }))}
                      />
                      <label htmlFor="chk-add-tute" style={{ fontSize: 12 }}>Mark Tute Delivered</label>
                    </div>
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
              {saving ? 'Registering...' : recordImmediatePayment ? '✓ Register & Save Payment' : regMode === 'siblings' ? `✓ Register All ${siblingsList.length} Siblings` : '✓ Register Student'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
