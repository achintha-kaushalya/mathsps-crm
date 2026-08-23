'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, UserPlus, Plus, Trash2, Home, Sparkles, AlertTriangle, ExternalLink } from 'lucide-react'
import { MONTH_NAMES } from '@/lib/types'
import { DEFAULT_GRADE_COURSES, CourseConfig, getAllCourseLabels, getAllCourseFees } from '@/lib/courses'

const BANKS = ['BOC', 'Sampath', 'Commercial', 'HNB', 'People\'s Bank', 'NSB', 'Seylan', 'NTB', 'Other']

interface ClassRow {
  id: string
  grade: number
  courseCode: string
  fee: number
}

// Sri Lanka phone normalizer: returns 10-digit 07XXXXXXXX or null if invalid
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('94') && digits.length === 11) {
    return '0' + digits.slice(2)
  }
  if (digits.length === 9 && digits.startsWith('7')) {
    return '0' + digits
  }
  if (digits.length === 10 && digits.startsWith('07')) {
    return digits
  }
  return null
}

export default function NewStudentPage() {
  const supabase = createClient()

  // 1 PS Code per Registration / Household
  const [psCode, setPsCode] = useState('')
  const [studentName, setStudentName] = useState('') // OPTIONAL
  const [primaryGrade, setPrimaryGrade] = useState<number>(10)
  const [school, setSchool] = useState('')
  const [fcodeRef, setFcodeRef] = useState('')

  // Household Contact & Delivery Details (REQUIRED)
  const [parentName, setParentName] = useState('')
  const [parentPhone, setParentPhone] = useState('')
  const [address, setAddress] = useState('')
  const [area, setArea] = useState('')

  // Live duplicate phone check alert
  const [existingHousehold, setExistingHousehold] = useState<any>(null)
  const [checkingPhone, setCheckingPhone] = useState(false)

  // Class Enrollments (1 or multiple classes / sibling grades under this same PS Code)
  const [enrolledClasses, setEnrolledClasses] = useState<ClassRow[]>([
    {
      id: 'class-1',
      grade: 10,
      courseCode: DEFAULT_GRADE_COURSES[10]?.[0]?.code || 'GR10_THEORY',
      fee: DEFAULT_GRADE_COURSES[10]?.[0]?.defaultFee || 1800
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
  const [classAmountPaid, setClassAmountPaid] = useState<Record<string, string>>({})

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successPs, setSuccessPs] = useState('')

  const channelRef = useRef<any>(null)
  const phoneCheckTimer = useRef<NodeJS.Timeout | undefined>(undefined)

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

  // Next available PS Code
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

    supabase.from('students').select('ps_code').ilike('ps_code', `${prefix}%`).order('created_at', { ascending: false }).limit(60).then(({ data }) => {
      let maxNum = prefix === 'SM' ? 100 : 10499
      if (data && data.length > 0) {
        data.forEach(s => {
          const num = parseInt((s.ps_code || '').replace(/\D/g, ''))
          if (!isNaN(num) && num > maxNum) maxNum = num
        })
      }
      setPsCode(`${prefix}${maxNum + 1}`)
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

  // Live Household Phone Duplication Check
  function handlePhoneChange(val: string) {
    setParentPhone(val)
    setExistingHousehold(null)

    if (phoneCheckTimer.current) clearTimeout(phoneCheckTimer.current)
    const normalized = normalizePhone(val)

    if (normalized) {
      phoneCheckTimer.current = setTimeout(async () => {
        setCheckingPhone(true)
        const clean9Digits = normalized.slice(1) // e.g. 771234567

        const { data: hhList } = await supabase
          .from('households')
          .select('*, students:students(*)')
          .or(`parent_phone.ilike.%${clean9Digits}%,parent_phone.ilike.%${normalized}%`)
          .limit(1)

        if (hhList && hhList.length > 0) {
          setExistingHousehold(hhList[0])
        }
        setCheckingPhone(false)
      }, 400)
    }
  }

  // Sync initial class amount paid for payment section
  useEffect(() => {
    const amounts: Record<string, string> = {}
    enrolledClasses.forEach(r => {
      if (r.courseCode) {
        amounts[r.courseCode] = String(r.fee)
      }
    })
    setClassAmountPaid(amounts)
  }, [enrolledClasses])

  // Change primary grade in Section 1 and update first class row
  function handlePrimaryGradeChange(g: number) {
    setPrimaryGrade(g)
    setEnrolledClasses(prev => {
      if (prev.length === 0) return prev
      const coursesForGrade = gradeCourses[g] || []
      const def = coursesForGrade[0]
      const updatedFirst: ClassRow = {
        ...prev[0],
        grade: g,
        courseCode: def ? def.code : '',
        fee: def ? def.defaultFee : 1800
      }
      return [updatedFirst, ...prev.slice(1)]
    })
  }

  // Row Management Functions for Multi-Class / Sibling Enrollments
  function handleAddClassRow() {
    const defGrade = primaryGrade || 10
    const coursesForGrade = gradeCourses[defGrade] || []
    const defCourse = coursesForGrade[0]

    const newRow: ClassRow = {
      id: `class-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      grade: defGrade,
      courseCode: defCourse ? defCourse.code : '',
      fee: defCourse ? defCourse.defaultFee : 1800
    }
    setEnrolledClasses([...enrolledClasses, newRow])
  }

  function handleRemoveClassRow(id: string) {
    if (enrolledClasses.length === 1) {
      alert('At least one class enrollment is required.')
      return
    }
    setEnrolledClasses(enrolledClasses.filter(r => r.id !== id))
  }

  function handleClassGradeChange(id: string, newGrade: number) {
    const coursesForGrade = gradeCourses[newGrade] || []
    const defCourse = coursesForGrade[0]

    setEnrolledClasses(prev => prev.map(r => {
      if (r.id === id) {
        return {
          ...r,
          grade: newGrade,
          courseCode: defCourse ? defCourse.code : '',
          fee: defCourse ? defCourse.defaultFee : 1800
        }
      }
      return r
    }))
  }

  function handleClassCourseChange(id: string, newCourseCode: string) {
    const fee = classDefaultFees[newCourseCode] || 1800
    setEnrolledClasses(prev => prev.map(r => {
      if (r.id === id) {
        return { ...r, courseCode: newCourseCode, fee }
      }
      return r
    }))
  }

  function handleClassFeeChange(id: string, newFee: number) {
    setEnrolledClasses(prev => prev.map(r => {
      if (r.id === id) {
        return { ...r, fee: newFee }
      }
      return r
    }))
  }

  // Form Submission with Strict Validations
  async function submit() {
    setError('')

    // 1. Mandatory Validations
    if (!psCode.trim()) {
      setError('PS Code is required.')
      return
    }

    if (!parentName.trim()) {
      setError('Parent / Guardian Name is REQUIRED.')
      return
    }

    const normalizedPhone = normalizePhone(parentPhone)
    if (!normalizedPhone) {
      setError('Valid Sri Lankan Parent Contact Number (10 digits starting with 07X) is REQUIRED.')
      return
    }

    if (!address.trim() || address.trim().length < 5) {
      setError('Complete Postal Delivery Address (House No, Street, City) is REQUIRED.')
      return
    }

    const validClasses = enrolledClasses.filter(c => c.courseCode)
    if (validClasses.length === 0) {
      setError('Please select at least one class to enroll.')
      return
    }

    setSaving(true)

    try {
      // Auto-fallback for student name if left empty
      const finalStudentName = studentName.trim() || `${parentName.trim()}'s Child`

      // 1. Create or Reuse Household record
      let householdId: string | null = null
      const { data: hhData, error: hhErr } = await supabase.from('households').insert({
        parent_name: parentName.trim(),
        parent_phone: normalizedPhone,
        address: address.trim(),
        area: area.trim() || null,
      }).select().single()

      if (hhErr) throw hhErr
      householdId = hhData?.id || null

      // 2. Create Student Record under this single PS Code
      const { data: stuData, error: stuErr } = await supabase.from('students').insert({
        ps_code: psCode.trim().toUpperCase(),
        full_name: finalStudentName,
        grade: primaryGrade,
        school: school.trim() || null,
        household_id: householdId,
        fcode_ref: fcodeRef.trim() || null,
        created_by: createdBy.trim() || 'Admin / System User',
      }).select().single()

      if (stuErr) throw stuErr

      // 3. Create all enrolled classes (subjects & sibling grades) under this student's ID
      for (const cls of validClasses) {
        const { error: enrolErr } = await supabase.from('enrollments').insert({
          student_id: stuData.id,
          class_type: cls.courseCode,
          tier: 'STANDARD',
          fee_amount: cls.fee,
          active: true,
        })
        if (enrolErr) throw enrolErr
      }

      // 4. Optional Immediate Payment for all enrolled classes
      if (recordImmediatePayment) {
        for (const cls of validClasses) {
          let paid = 0
          if (['FREE', 'IMS'].includes(paymentForm.payment_type)) {
            paid = 0
          } else {
            paid = parseFloat(classAmountPaid[cls.courseCode]) || 0
          }

          const { error: payErr } = await supabase.from('payments').insert({
            student_id: stuData.id,
            class_type: cls.courseCode,
            month: paymentForm.month,
            year: paymentForm.year,
            amount_due: cls.fee,
            amount_paid: Math.max(0, paid),
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

      setSuccessPs(psCode.trim().toUpperCase())

    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const totalMonthlyFee = enrolledClasses.reduce((sum, c) => sum + c.fee, 0)
  const totalAmountPaidNow = enrolledClasses.reduce((sum, c) => sum + (parseFloat(classAmountPaid[c.courseCode]) || 0), 0)

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
              Household & delivery details are required. Student name is optional.
            </div>
          </div>
        </div>
      </div>

      <div className="page-content" style={{ maxWidth: 760 }}>
        {successPs ? (
          <div className="glass-card" style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>Registration Complete!</h2>
            <div style={{
              display: 'inline-block', padding: '10px 24px', background: 'rgba(59,130,246,0.15)',
              border: '1px solid var(--accent-blue)', borderRadius: 8, fontSize: 24, fontWeight: 800,
              color: 'var(--accent-blue)', letterSpacing: 2, margin: '14px 0'
            }}>
              {successPs}
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: '0 0 24px' }}>
              Student record with {enrolledClasses.length} enrolled class(es) {recordImmediatePayment ? 'and payment' : ''} have been saved successfully.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <a href={`/students/${encodeURIComponent(successPs)}`} className="btn-primary">
                View Student Profile →
              </a>
              <button
                className="btn-secondary"
                onClick={() => {
                  setStudentName('')
                  setAddress('')
                  setArea('')
                  setParentName('')
                  setParentPhone('')
                  setFcodeRef('')
                  setSuccessPs('')
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

            {/* Section 1: Household & Postal Delivery Details (REQUIRED) */}
            <div className="glass-card" style={{ padding: 24, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Home size={18} /> 1. Household & Delivery Details (Required)
                </div>
                <span style={{ fontSize: 11, background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '3px 8px', borderRadius: 6, fontWeight: 700 }}>
                  * Required for Delivery & Contact
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                    Parent / Guardian Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    className="input-field"
                    placeholder="e.g. Sunil Perera"
                    value={parentName}
                    onChange={e => setParentName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                    Parent Contact Number <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    className="input-field"
                    placeholder="07XXXXXXXX (e.g. 0771234567)"
                    value={parentPhone}
                    onChange={e => handlePhoneChange(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Existing Household Alert Banner if Phone Already Exists */}
              {existingHousehold && (
                <div style={{
                  marginTop: 14, padding: '12px 14px', background: 'rgba(245,158,11,0.1)', border: '1px solid #f59e0b',
                  borderRadius: 8, color: '#fbbf24', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertTriangle size={16} />
                    <span>
                      <b>Existing Household Found:</b> {existingHousehold.parent_name || 'Parent'} ({existingHousehold.parent_phone})
                      {existingHousehold.students?.length > 0 && ` — Linked PS Code: ${existingHousehold.students[0].ps_code}`}
                    </span>
                  </div>
                  {existingHousehold.students?.length > 0 && (
                    <a
                      href={`/students/${existingHousehold.students[0].ps_code}`}
                      target="_blank"
                      style={{ color: '#60a5fa', textDecoration: 'none', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}
                    >
                      View Profile <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginTop: 14 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                    Delivery Address <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    className="input-field"
                    placeholder="House No, Street, City (e.g. No 45, Main Street, Kandy)"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                    Area / Delivery Route
                  </label>
                  <input
                    className="input-field"
                    placeholder="e.g. Kandy Town"
                    value={area}
                    onChange={e => setArea(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Student Details (Student Name is OPTIONAL) */}
            <div className="glass-card" style={{ padding: 24, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--accent-purple)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <UserPlus size={18} /> 2. Student Info (Student Name Optional)
                </div>
                <span style={{ fontSize: 11, background: 'rgba(59,130,246,0.1)', color: 'var(--accent-blue)', padding: '3px 8px', borderRadius: 6, fontWeight: 600 }}>
                  Auto-defaults to Parent's Child if empty
                </span>
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
                    Student / Children Name(s) <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>(Optional)</span>
                  </label>
                  <input
                    className="input-field"
                    placeholder="e.g. Kasun Perera (Leave blank if unknown, will use Parent's Child)"
                    value={studentName}
                    onChange={e => setStudentName(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 130px', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                    Primary Grade
                  </label>
                  <select
                    className="input-field"
                    value={primaryGrade}
                    onChange={e => handlePrimaryGradeChange(parseInt(e.target.value))}
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
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                    CRM F-Code
                  </label>
                  <input
                    className="input-field"
                    placeholder="e.g. F80001"
                    value={fcodeRef}
                    onChange={e => setFcodeRef(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Class Enrollments & Multi-Subject / Sibling Classes */}
            <div className="glass-card" style={{ padding: 24, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--accent-purple)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Sparkles size={18} /> 3. Class Enrollments
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    Add classes for this student or siblings in this home. All classes share this 1 PS Code.
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={handleAddClassRow}
                    className="btn-primary"
                    style={{ padding: '6px 14px', fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
                  >
                    <Plus size={14} /> Add Class
                  </button>
                </div>
              </div>

              {/* Dynamic Class Rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                {enrolledClasses.map((row) => {
                  const coursesForThisGrade = gradeCourses[row.grade] || []

                  return (
                    <div
                      key={row.id}
                      style={{
                        padding: '14px',
                        borderRadius: 10,
                        border: '1px solid var(--border)',
                        background: 'var(--bg-base)',
                        display: 'grid',
                        gridTemplateColumns: '110px 1fr 130px 32px',
                        gap: 12,
                        alignItems: 'center'
                      }}
                    >
                      {/* Grade Dropdown */}
                      <div>
                        <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                          Grade
                        </label>
                        <select
                          className="input-field"
                          value={row.grade}
                          onChange={e => handleClassGradeChange(row.id, parseInt(e.target.value))}
                          style={{ padding: '6px 8px', fontSize: 13, fontWeight: 600 }}
                        >
                          {[6, 7, 8, 9, 10, 11, 12, 13].map(g => (
                            <option key={g} value={g}>Grade {g}</option>
                          ))}
                        </select>
                      </div>

                      {/* Aligned Course Dropdown */}
                      <div>
                        <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                          Aligned Course ({coursesForThisGrade.length} options)
                        </label>
                        <select
                          className="input-field"
                          value={row.courseCode}
                          onChange={e => handleClassCourseChange(row.id, e.target.value)}
                          style={{ padding: '6px 10px', fontSize: 13, fontWeight: 600, color: 'var(--accent-blue)' }}
                        >
                          {coursesForThisGrade.map(c => (
                            <option key={c.code} value={c.code}>
                              {c.name} (Default: Rs. {c.defaultFee.toLocaleString()})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Monthly Fee / Rate */}
                      <div>
                        <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                          Fee / Offer (Rs.)
                        </label>
                        <input
                          type="number"
                          className="input-field"
                          value={row.fee}
                          onChange={e => handleClassFeeChange(row.id, parseFloat(e.target.value) || 0)}
                          style={{ padding: '6px 10px', fontSize: 13, fontWeight: 700, color: 'var(--accent-green)' }}
                        />
                      </div>

                      {/* Delete Row */}
                      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 18 }}>
                        <button
                          type="button"
                          onClick={() => handleRemoveClassRow(row.id)}
                          disabled={enrolledClasses.length === 1}
                          style={{
                            background: 'none', border: 'none',
                            color: enrolledClasses.length === 1 ? 'var(--text-muted)' : '#ef4444',
                            cursor: enrolledClasses.length === 1 ? 'not-allowed' : 'pointer',
                            padding: 4, opacity: enrolledClasses.length === 1 ? 0.3 : 1
                          }}
                          title="Remove class"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Total Fee Summary */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px', background: 'rgba(59,130,246,0.06)', borderRadius: 8, border: '1px solid rgba(59,130,246,0.2)'
              }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Total Enrolled Classes: <b>{enrolledClasses.length}</b>
                </span>
                <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--accent-green)' }}>
                  Total Monthly Fee: Rs. {totalMonthlyFee.toLocaleString()}
                </span>
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

                  {/* Payment Amount Fields for each enrolled class */}
                  {['BANK', 'CASH', 'PHYSICAL'].includes(paymentForm.payment_type) && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>
                        Amount Paid Now per Class (Rs.):
                      </label>
                      {enrolledClasses.map(c => (
                        <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
                          <span style={{ fontSize: 13 }}>
                            Grade {c.grade} · {availableClasses[c.courseCode] || c.courseCode} (Fee: Rs. {c.fee}):
                          </span>
                          <input
                            type="number"
                            className="input-field"
                            style={{ width: 140, padding: '5px 10px', fontWeight: 700, color: 'var(--accent-green)' }}
                            value={classAmountPaid[c.courseCode] ?? ''}
                            onChange={e => setClassAmountPaid({ ...classAmountPaid, [c.courseCode]: e.target.value })}
                          />
                        </div>
                      ))}
                      <div style={{ textAlign: 'right', fontSize: 14, fontWeight: 700, color: 'var(--accent-green)', marginTop: 4 }}>
                        Total Slip Payment: Rs. {totalAmountPaidNow.toLocaleString()}
                      </div>
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
              {saving ? 'Registering...' : recordImmediatePayment ? '✓ Register Student & Save Payment' : '✓ Register Student'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
