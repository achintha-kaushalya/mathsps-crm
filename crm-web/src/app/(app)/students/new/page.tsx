'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, UserPlus, Plus, Trash2, Home, Sparkles, AlertTriangle, ExternalLink, Lock } from 'lucide-react'
import { MONTH_NAMES } from '@/lib/types'
import { DEFAULT_GRADE_COURSES, DEFAULT_STANDALONE_COURSES, CourseConfig, getAllCourseLabels, getAllCourseFees } from '@/lib/courses'

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

  // 1 PS Code per Registration / Household (LOCKED - Auto-generated)
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

  // Specialist / Standalone Courses Selection
  const [standaloneCourses, setStandaloneCourses] = useState<CourseConfig[]>(DEFAULT_STANDALONE_COURSES)
  const [selectedStandalone, setSelectedStandalone] = useState<Record<string, { fee: number; enabled: boolean }>>({})

  // User details
  const [createdBy, setCreatedBy] = useState('')
  const [currentUserEmail, setCurrentUserEmail] = useState('')
  const [userRole, setUserRole] = useState<'member' | 'admin' | 'owner'>('member')

  // Grade-aligned courses configuration
  const [gradeCourses, setGradeCourses] = useState<Record<number, CourseConfig[]>>(DEFAULT_GRADE_COURSES)
  const [availableClasses, setAvailableClasses] = useState<Record<string, string>>(getAllCourseLabels(DEFAULT_GRADE_COURSES, DEFAULT_STANDALONE_COURSES))
  const [classDefaultFees, setClassDefaultFees] = useState<Record<string, number>>(getAllCourseFees(DEFAULT_GRADE_COURSES, DEFAULT_STANDALONE_COURSES))

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
  const [classDeliverTute, setClassDeliverTute] = useState<Record<string, boolean>>({})

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
        let gc = { ...DEFAULT_GRADE_COURSES }
        let sc = [...DEFAULT_STANDALONE_COURSES]

        if (notesObj.grade_courses) {
          gc = { ...DEFAULT_GRADE_COURSES }
          Object.entries(notesObj.grade_courses).forEach(([grStr, list]: [string, any]) => {
            gc[Number(grStr)] = list
          })
          setGradeCourses(gc)
        }

        if (notesObj.standalone_courses && Array.isArray(notesObj.standalone_courses)) {
          sc = notesObj.standalone_courses
          setStandaloneCourses(sc)
        }

        setAvailableClasses(getAllCourseLabels(gc, sc))
        setClassDefaultFees(getAllCourseFees(gc, sc))
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
        if (payload?.payload?.grade_courses || payload?.payload?.standalone_courses) {
          const gc = payload.payload.grade_courses || gradeCourses
          const sc = payload.payload.standalone_courses || standaloneCourses
          if (payload.payload.grade_courses) setGradeCourses(gc)
          if (payload.payload.standalone_courses) setStandaloneCourses(sc)
          setAvailableClasses(getAllCourseLabels(gc, sc))
          setClassDefaultFees(getAllCourseFees(gc, sc))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(room)
    }
  }, [])

  // Toggle Standalone Course Selection
  function handleToggleStandalone(code: string, defaultFee: number) {
    setSelectedStandalone(prev => {
      const current = prev[code]
      if (current?.enabled) {
        const next = { ...prev }
        delete next[code]
        return next
      } else {
        return {
          ...prev,
          [code]: { fee: current?.fee !== undefined ? current.fee : defaultFee, enabled: true }
        }
      }
    })
  }

  function handleStandaloneFeeChange(code: string, newFee: number) {
    setSelectedStandalone(prev => ({
      ...prev,
      [code]: { ...prev[code], fee: newFee, enabled: true }
    }))
  }

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

        if (hhList && hhList.length > 0) {
          // Only show duplicate alert if there is actually at least 1 student linked to this household
          const hhWithStudent = hhList.find((h: any) => h.students && h.students.length > 0)
          if (hhWithStudent) {
            setExistingHousehold(hhWithStudent)
            if (!parentName.trim() && hhWithStudent.parent_name) {
              setParentName(hhWithStudent.parent_name)
            }
            if (!address.trim() && hhWithStudent.address) {
              setAddress(hhWithStudent.address)
            }
          }
        }
        setCheckingPhone(false)
      }, 400)
    }
  }

  // Sync initial class amount paid and delivery defaults for payment section
  useEffect(() => {
    const amounts: Record<string, string> = { ...classAmountPaid }
    const delivers: Record<string, boolean> = { ...classDeliverTute }

    enrolledClasses.forEach(r => {
      if (r.courseCode && amounts[r.courseCode] === undefined) {
        amounts[r.courseCode] = String(r.fee)
        delivers[r.courseCode] = true
      }
    })

    Object.entries(selectedStandalone).forEach(([code, data]) => {
      if (data.enabled && amounts[code] === undefined) {
        amounts[code] = String(data.fee)
        delivers[code] = true
      }
    })

    setClassAmountPaid(amounts)
    setClassDeliverTute(delivers)
  }, [enrolledClasses, selectedStandalone])

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
    if (enrolledClasses.length === 1 && Object.keys(selectedStandalone).length === 0) {
      alert('At least one class or specialist course enrollment is required.')
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
    const defaultFee = classDefaultFees[newCourseCode] ?? 1800
    setEnrolledClasses(prev => prev.map(r => {
      if (r.id === id) {
        return { ...r, courseCode: newCourseCode, fee: defaultFee }
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
      setError('Parent / Guardian Name is REQUIRED in Household Details.')
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

    const validGradeClasses = enrolledClasses.filter(c => c.courseCode)
    const validStandaloneList = Object.entries(selectedStandalone)
      .filter(([_, item]) => item.enabled)
      .map(([code, item]) => ({
        courseCode: code,
        fee: item.fee,
        isStandalone: true
      }))

    if (validGradeClasses.length === 0 && validStandaloneList.length === 0) {
      setError('Please select at least one Grade Class or Specialist Course to enroll.')
      return
    }

    setSaving(true)

    try {
      // Auto-fallback for student name if left empty
      const finalStudentName = studentName.trim() || `${parentName.trim()}'s Child`

      // 1. Create Household record
      let householdId: string | null = null
      const { data: hhData, error: hhErr } = await supabase.from('households').insert({
        parent_name: parentName.trim(),
        parent_phone: normalizedPhone,
        address: address.trim(),
        area: area.trim() || null,
      }).select().single()

      if (hhErr) throw hhErr
      householdId = hhData?.id || null

      // 2. Create Student Record under this single locked PS Code
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

      // 3. Create all enrolled classes (grade courses + standalone courses)
      const allToEnroll = [
        ...validGradeClasses.map(c => ({ courseCode: c.courseCode, fee: c.fee })),
        ...validStandaloneList.map(s => ({ courseCode: s.courseCode, fee: s.fee }))
      ]

      for (const cls of allToEnroll) {
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
        for (const cls of allToEnroll) {
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
            tute_delivered: classDeliverTute[cls.courseCode] ?? false,
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

  const activeStandaloneList = Object.entries(selectedStandalone)
    .filter(([_, item]) => item.enabled)
    .map(([code, item]) => ({ code, fee: item.fee }))

  const totalGradeMonthlyFee = enrolledClasses.reduce((sum, c) => sum + c.fee, 0)
  const totalStandaloneFee = activeStandaloneList.reduce((sum, s) => sum + s.fee, 0)
  const totalMonthlyFee = totalGradeMonthlyFee + totalStandaloneFee

  const allSelectedCourseCodes = [
    ...enrolledClasses.map(c => c.courseCode),
    ...activeStandaloneList.map(s => s.code)
  ]

  const totalAmountPaidNow = allSelectedCourseCodes.reduce((sum, code) => sum + (parseFloat(classAmountPaid[code]) || 0), 0)

  return (
    <div className="fade-in" style={{ paddingBottom: 60, minHeight: '100vh', width: '100%' }}>
      {/* Header */}
      <div className="page-header" style={{ padding: '18px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <a href="/students" className="btn-secondary" style={{ padding: '7px 11px', borderRadius: 8 }}>
            <ArrowLeft size={15} />
          </a>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserPlus size={22} style={{ color: 'var(--accent-blue)' }} />
                Student Registration
              </h1>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: 'rgba(56, 189, 248, 0.15)', color: 'var(--accent-blue)', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                New Admission
              </span>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 3 }}>
              Step 1: Student Details · Step 2: Household &amp; Delivery (Required) · Step 3: Class Enrollments
            </div>
          </div>
        </div>
      </div>

      <div className="page-content" style={{ maxWidth: 960, margin: '24px auto', padding: 0 }}>
        {successPs ? (
          <div className="glass-card" style={{ padding: '48px 32px', textAlign: 'center', borderRadius: 20, border: '1px solid var(--border)', boxShadow: '0 10px 30px rgba(0,0,0,0.06)' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Sparkles size={32} />
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 8px', color: 'var(--text-primary)' }}>Registration Successful!</h2>
            <div style={{
              display: 'inline-block', padding: '10px 28px', background: 'rgba(56, 189, 248, 0.15)',
              border: '2px solid var(--accent-blue)', borderRadius: 12, fontSize: 28, fontWeight: 900,
              color: 'var(--accent-blue)', letterSpacing: 2, margin: '14px 0'
            }}>
              {successPs}
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: '0 0 28px', maxWidth: 460, marginInline: 'auto', lineHeight: 1.5 }}>
              Student record with <strong>{enrolledClasses.length} enrolled class(es)</strong> {recordImmediatePayment ? 'and payment' : ''} have been registered into the institute directory.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <a href={`/students/${encodeURIComponent(successPs)}`} className="btn-primary" style={{ padding: '10px 22px', fontSize: 14, borderRadius: 10, fontWeight: 700 }}>
                View Student Profile →
              </a>
              <button
                className="btn-secondary"
                style={{ padding: '10px 20px', fontSize: 14, borderRadius: 10, fontWeight: 700 }}
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
              <div style={{ padding: '12px 16px', background: 'rgba(239, 68, 68, 0.15)', border: '1.5px solid rgba(239, 68, 68, 0.3)', borderRadius: 10, color: '#ef4444', marginBottom: 20, fontSize: 13.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={18} /> {error}
              </div>
            )}

            {/* Section 1: Student Details */}
            <div className="glass-card" style={{ padding: '24px 26px', marginBottom: 20, borderRadius: 16, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(56, 189, 248, 0.15)', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <UserPlus size={16} />
                  </div>
                  1. Student Details
                </div>
                <span style={{ fontSize: 11, background: 'var(--bg-card-hover)', color: 'var(--text-secondary)', padding: '3px 9px', borderRadius: 6, fontWeight: 700 }}>
                  Student Name is Optional
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 16, marginBottom: 16 }}>
                {/* Locked Auto-Generated PS Code */}
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                    <Lock size={12} style={{ color: 'var(--accent-blue)' }} /> PS Code (Auto)
                  </label>
                  <input
                    className="input-field"
                    value={psCode || 'Generating...'}
                    readOnly
                    disabled
                    style={{
                      fontWeight: 900,
                      fontSize: 15,
                      letterSpacing: 1.5,
                      color: 'var(--accent-blue)',
                      cursor: 'not-allowed',
                      height: 42
                    }}
                    title="Auto-generated unique identifier (Locked)"
                  />
                </div>

                {/* Optional Student / Children Names */}
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>
                    Student / Children Full Name(s) <span style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: 11 }}>(Optional)</span>
                  </label>
                  <input
                    className="input-field"
                    placeholder="e.g. Kasun Perera (Leave blank if unknown, will use Parent's Child)"
                    value={studentName}
                    onChange={e => setStudentName(e.target.value)}
                    autoFocus
                    style={{
                      borderRadius: 10,
                      fontSize: 13.5,
                      height: 42
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 140px', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>
                    Primary Grade
                  </label>
                  <select
                    className="input-field"
                    value={primaryGrade}
                    onChange={e => handlePrimaryGradeChange(parseInt(e.target.value))}
                    style={{ fontWeight: 700, borderRadius: 10, height: 42 }}
                  >
                    {[5, 6, 7, 8, 9, 10, 11, 12, 13].map(g => (
                      <option key={g} value={g}>Grade {g}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>
                    School (Optional)
                  </label>
                  <input
                    className="input-field"
                    placeholder="e.g. Royal College"
                    value={school}
                    onChange={e => setSchool(e.target.value)}
                    style={{ borderRadius: 10, height: 42 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>
                    CRM F-Code
                  </label>
                  <input
                    className="input-field"
                    placeholder="e.g. F80001"
                    value={fcodeRef}
                    onChange={e => setFcodeRef(e.target.value)}
                    style={{ borderRadius: 10, height: 42 }}
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Household & Postal Delivery Details (REQUIRED) */}
            <div className="glass-card" style={{ padding: '24px 26px', marginBottom: 20, borderRadius: 16, border: '1.5px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(236, 72, 153, 0.15)', color: '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Home size={16} />
                  </div>
                  2. Household &amp; Delivery Details
                </div>
                <span style={{ fontSize: 11, background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '3px 9px', borderRadius: 6, fontWeight: 800, border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                  * Required for Courier Delivery
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 11.5, color: 'var(--text-primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>
                    Parent / Guardian Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    className="input-field"
                    placeholder="e.g. Sunil Perera"
                    value={parentName}
                    onChange={e => setParentName(e.target.value)}
                    required
                    style={{ borderRadius: 10, height: 42, fontWeight: 600 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11.5, color: 'var(--text-primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>
                    Parent Contact Number <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    className="input-field"
                    placeholder="07XXXXXXXX (e.g. 0771234567)"
                    value={parentPhone}
                    onChange={e => handlePhoneChange(e.target.value)}
                    required
                    style={{ borderRadius: 10, height: 42, fontWeight: 600 }}
                  />
                </div>
              </div>

              {/* Existing Household Alert Banner if Phone Already Exists */}
              {existingHousehold && (
                <div style={{
                  marginTop: 16, padding: '12px 16px', background: 'rgba(245, 158, 11, 0.15)', border: '1.5px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: 10, color: '#f59e0b', fontSize: 12.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertTriangle size={18} style={{ color: '#f59e0b', flexShrink: 0 }} />
                    <span>
                      <b>Existing Household Found:</b> {existingHousehold.parent_name || 'Parent'} ({existingHousehold.parent_phone})
                      {existingHousehold.students?.length > 0 && ` — Linked PS Code: ${existingHousehold.students[0].ps_code}`}
                    </span>
                  </div>
                  {existingHousehold.students?.length > 0 && (
                    <a
                      href={`/students/${existingHousehold.students[0].ps_code}`}
                      target="_blank"
                      style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}
                    >
                      View Profile <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginTop: 16 }}>
                <div>
                  <label style={{ fontSize: 11.5, color: 'var(--text-primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>
                    Delivery Address <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    className="input-field"
                    placeholder="House No, Street, City (e.g. No 45, Main Street, Kandy)"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    required
                    style={{ borderRadius: 10, height: 42 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11.5, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>
                    Area / Delivery Route
                  </label>
                  <input
                    className="input-field"
                    placeholder="e.g. Kandy Town"
                    value={area}
                    onChange={e => setArea(e.target.value)}
                    style={{ borderRadius: 10, height: 42 }}
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Class Enrollments */}
            <div className="glass-card" style={{ padding: '24px 26px', marginBottom: 20, borderRadius: 16, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Sparkles size={16} />
                    </div>
                    3. Class Enrollments
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Add classes for this student or siblings in this household (all share this PS Code).
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={handleAddClassRow}
                    className="btn-primary"
                    style={{ padding: '8px 16px', fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', borderRadius: 10 }}
                  >
                    <Plus size={14} /> Add Class
                  </button>
                </div>
              </div>

              {/* Dynamic Class Rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                {enrolledClasses.map((row) => {
                  const coursesForThisGrade = gradeCourses[row.grade] || []

                  return (
                    <div
                      key={row.id}
                      style={{
                        padding: '14px 16px',
                        borderRadius: 12,
                        border: '1px solid var(--border)',
                        background: 'var(--bg-card-hover)',
                        display: 'grid',
                        gridTemplateColumns: '120px 1fr 140px 36px',
                        gap: 14,
                        alignItems: 'center'
                      }}
                    >
                      {/* Grade Dropdown */}
                      <div>
                        <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                          Grade
                        </label>
                        <select
                          className="input-field"
                          value={row.grade}
                          onChange={e => handleClassGradeChange(row.id, parseInt(e.target.value))}
                          style={{ padding: '6px 8px', fontSize: 13, fontWeight: 700, borderRadius: 8, height: 38 }}
                        >
                          {[5, 6, 7, 8, 9, 10, 11, 12, 13].map(g => (
                            <option key={g} value={g}>Grade {g}</option>
                          ))}
                        </select>
                      </div>

                      {/* Aligned Course Dropdown */}
                      <div>
                        <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                          Aligned Course ({coursesForThisGrade.length} options)
                        </label>
                        <select
                          className="input-field"
                          value={row.courseCode}
                          onChange={e => handleClassCourseChange(row.id, e.target.value)}
                          style={{ padding: '6px 10px', fontSize: 13, fontWeight: 700, color: 'var(--accent-blue)', borderRadius: 8, height: 38 }}
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
                        <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                          Fee / Offer (Rs.)
                        </label>
                        <input
                          type="number"
                          className="input-field"
                          value={row.fee}
                          onChange={e => handleClassFeeChange(row.id, parseFloat(e.target.value) || 0)}
                          style={{ padding: '6px 10px', fontSize: 13.5, fontWeight: 800, color: '#10b981', borderRadius: 8, height: 38 }}
                        />
                      </div>

                      {/* Delete Row */}
                      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 18 }}>
                        <button
                          type="button"
                          onClick={() => handleRemoveClassRow(row.id)}
                          disabled={enrolledClasses.length === 1 && activeStandaloneList.length === 0}
                          style={{
                            background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 8,
                            color: enrolledClasses.length === 1 && activeStandaloneList.length === 0 ? 'var(--text-muted)' : '#ef4444',
                            cursor: enrolledClasses.length === 1 && activeStandaloneList.length === 0 ? 'not-allowed' : 'pointer',
                            width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            opacity: enrolledClasses.length === 1 && activeStandaloneList.length === 0 ? 0.4 : 1
                          }}
                          title="Remove class"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Courses Section */}
              <div style={{
                marginTop: 20,
                padding: '16px 18px',
                borderRadius: 14,
                background: 'rgba(56, 189, 248, 0.03)',
                border: '1px solid var(--border)',
                marginBottom: 20
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      Courses ({standaloneCourses.length} available)
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                      Enroll student in standalone subjects or courses
                    </div>
                  </div>
                  {activeStandaloneList.length > 0 && (
                    <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'var(--accent-blue)', color: '#fff' }}>
                      {activeStandaloneList.length} Selected
                    </span>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                  {standaloneCourses.map(sc => {
                    const isSelected = !!selectedStandalone[sc.code]?.enabled
                    const currentFee = selectedStandalone[sc.code]?.fee !== undefined ? selectedStandalone[sc.code].fee : sc.defaultFee
                    const isOneTime = sc.billingType === 'ONE_TIME'

                    return (
                      <div
                        key={sc.code}
                        onClick={() => handleToggleStandalone(sc.code, sc.defaultFee)}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 12,
                          border: isSelected ? '1.5px solid var(--accent-blue)' : '1px solid var(--border)',
                          background: isSelected ? 'rgba(56, 189, 248, 0.08)' : 'var(--bg-card)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              style={{ width: 16, height: 16, accentColor: 'var(--accent-blue)', cursor: 'pointer' }}
                            />
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: isSelected ? 'var(--accent-blue)' : 'var(--text-primary)' }}>
                                {sc.name}
                              </div>
                              {sc.description && (
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                                  {sc.description}
                                </div>
                              )}
                            </div>
                          </div>
                          <span style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: 6,
                            background: isOneTime ? 'rgba(16, 185, 129, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                            color: isOneTime ? '#059669' : 'var(--accent-blue)',
                            whiteSpace: 'nowrap'
                          }}>
                            {isOneTime ? 'One-Time' : 'Monthly'}
                          </span>
                        </div>

                        {isSelected && (
                          <div
                            onClick={e => e.stopPropagation()}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              paddingTop: 8,
                              marginTop: 4,
                              borderTop: '1px solid var(--border)'
                            }}
                          >
                            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
                              Fee (Rs.):
                            </label>
                            <input
                              type="number"
                              className="input-field"
                              value={currentFee}
                              onChange={e => handleStandaloneFeeChange(sc.code, parseFloat(e.target.value) || 0)}
                              style={{ width: 100, padding: '4px 8px', fontSize: 12.5, fontWeight: 700, color: 'var(--accent-blue)', height: 30, borderRadius: 6 }}
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Total Fee Summary */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10,
                padding: '14px 18px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: 12, border: '1px solid rgba(59, 130, 246, 0.25)'
              }}>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
                  Enrolled: <strong style={{ color: 'var(--accent-blue)' }}>{enrolledClasses.length} Grade Class(es)</strong>
                  {activeStandaloneList.length > 0 && (
                    <span> + <strong style={{ color: 'var(--accent-blue)' }}>{activeStandaloneList.length} Course(s)</strong></span>
                  )}
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#10b981' }}>
                  Total Fee / Tuition: Rs. {totalMonthlyFee.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Optional Immediate Payment Section */}
            <div className="glass-card" style={{ padding: '20px 24px', marginBottom: 24, borderRadius: 16, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    type="checkbox"
                    id="chk-immediate-pay"
                    checked={recordImmediatePayment}
                    onChange={e => setRecordImmediatePayment(e.target.checked)}
                    style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#2563eb' }}
                  />
                  <label htmlFor="chk-immediate-pay" style={{ cursor: 'pointer', fontSize: 14.5, fontWeight: 800, color: recordImmediatePayment ? 'var(--accent-blue)' : 'var(--text-primary)' }}>
                    Record Payment Right Now
                  </label>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Optional (Can pay later via Add Payment)
                </div>
              </div>

              {recordImmediatePayment && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Month</label>
                      <select className="input-field" style={{ borderRadius: 8, height: 38 }} value={paymentForm.month} onChange={e => setPaymentForm(f => ({ ...f, month: parseInt(e.target.value) }))}>
                        {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Year</label>
                      <select className="input-field" style={{ borderRadius: 8, height: 38 }} value={paymentForm.year} onChange={e => setPaymentForm(f => ({ ...f, year: parseInt(e.target.value) }))}>
                        {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Payment Method</label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {['BANK', 'CASH', 'FREE', 'IMS', 'PHYSICAL'].map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setPaymentForm(f => ({ ...f, payment_type: t }))}
                          className={paymentForm.payment_type === t ? 'btn-primary' : 'btn-secondary'}
                          style={{ padding: '6px 14px', fontSize: 12, borderRadius: 8, fontWeight: 700 }}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {paymentForm.payment_type === 'BANK' && (
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Bank</label>
                      <select className="input-field" style={{ borderRadius: 8, height: 38 }} value={paymentForm.bank_name} onChange={e => setPaymentForm(f => ({ ...f, bank_name: e.target.value }))}>
                        {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                  )}

                  {/* Payment Amount & Delivery Checkbox */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block' }}>
                      Enrolled Classes, Amounts &amp; Postal Delivery:
                    </label>

                    {/* Grade Class Payment Rows */}
                    {enrolledClasses.map(c => (
                      <div key={c.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap',
                        gap: 10, padding: '12px 14px', background: 'var(--bg-card-hover)', borderRadius: 10, border: '1px solid var(--border)'
                      }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                            Grade {c.grade} · {availableClasses[c.courseCode] || c.courseCode}
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                            Class Fee: Rs. {c.fee.toLocaleString()}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {['BANK', 'CASH', 'PHYSICAL'].includes(paymentForm.payment_type) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-blue)' }}>Paid (Rs.):</label>
                              <input
                                type="number"
                                className="input-field"
                                style={{ width: 110, padding: '4px 8px', fontWeight: 800, color: '#10b981', borderRadius: 8 }}
                                value={classAmountPaid[c.courseCode] ?? ''}
                                onChange={e => setClassAmountPaid({ ...classAmountPaid, [c.courseCode]: e.target.value })}
                              />
                            </div>
                          )}

                          <div style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '4px 10px', borderRadius: 8,
                            background: classDeliverTute[c.courseCode] ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-card)',
                            border: `1px solid ${classDeliverTute[c.courseCode] ? 'rgba(16, 185, 129, 0.3)' : 'var(--border)'}`
                          }}>
                            <input
                              type="checkbox"
                              id={`reg-tute-${c.id}`}
                              checked={classDeliverTute[c.courseCode] ?? true}
                              onChange={e => setClassDeliverTute({ ...classDeliverTute, [c.courseCode]: e.target.checked })}
                              style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#10b981' }}
                            />
                            <label htmlFor={`reg-tute-${c.id}`} style={{
                              fontSize: 12, fontWeight: 700, cursor: 'pointer',
                              color: classDeliverTute[c.courseCode] ? '#10b981' : 'var(--text-secondary)'
                            }}>
                              Deliver Tute
                            </label>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Standalone Course Payment Rows */}
                    {activeStandaloneList.map(scItem => {
                      const scConfig = standaloneCourses.find(c => c.code === scItem.code)
                      return (
                        <div key={scItem.code} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap',
                          gap: 10, padding: '12px 14px', background: 'var(--bg-card-hover)', borderRadius: 10, border: '1px solid var(--border)'
                        }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                              {scConfig?.name || scItem.code}
                              <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(56, 189, 248, 0.15)', color: 'var(--accent-blue)' }}>
                                {scConfig?.billingType === 'ONE_TIME' ? 'One-Time' : 'Monthly'}
                              </span>
                            </div>
                            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                              Fee: Rs. {scItem.fee.toLocaleString()}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {['BANK', 'CASH', 'PHYSICAL'].includes(paymentForm.payment_type) && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-blue)' }}>Paid (Rs.):</label>
                                <input
                                  type="number"
                                  className="input-field"
                                  style={{ width: 110, padding: '4px 8px', fontWeight: 800, color: '#10b981', borderRadius: 8 }}
                                  value={classAmountPaid[scItem.code] ?? ''}
                                  onChange={e => setClassAmountPaid({ ...classAmountPaid, [scItem.code]: e.target.value })}
                                />
                              </div>
                            )}

                            <div style={{
                              display: 'flex', alignItems: 'center', gap: 6,
                              padding: '4px 10px', borderRadius: 8,
                              background: classDeliverTute[scItem.code] ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-card)',
                              border: `1px solid ${classDeliverTute[scItem.code] ? 'rgba(16, 185, 129, 0.3)' : 'var(--border)'}`
                            }}>
                              <input
                                type="checkbox"
                                id={`reg-tute-${scItem.code}`}
                                checked={classDeliverTute[scItem.code] ?? true}
                                onChange={e => setClassDeliverTute({ ...classDeliverTute, [scItem.code]: e.target.checked })}
                                style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#10b981' }}
                              />
                              <label htmlFor={`reg-tute-${scItem.code}`} style={{
                                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                                color: classDeliverTute[scItem.code] ? '#10b981' : 'var(--text-secondary)'
                              }}>
                                Deliver Tute
                              </label>
                            </div>
                          </div>
                        </div>
                      )
                    })}

                    {['BANK', 'CASH', 'PHYSICAL'].includes(paymentForm.payment_type) && (
                      <div style={{ textAlign: 'right', fontSize: 14.5, fontWeight: 800, color: '#10b981', marginTop: 4 }}>
                        Total Slip Payment: Rs. {totalAmountPaidNow.toLocaleString()}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--bg-card-hover)', borderRadius: 8, border: '1px solid var(--border)', width: 'fit-content' }}>
                    <input
                      type="checkbox"
                      id="chk-add-grp"
                      checked={paymentForm.added_to_group}
                      onChange={e => setPaymentForm(f => ({ ...f, added_to_group: e.target.checked }))}
                      style={{ accentColor: '#2563eb' }}
                    />
                    <label htmlFor="chk-add-grp" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>Added to WhatsApp Group</label>
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              className="btn-primary"
              style={{ width: '100%', padding: '14px 20px', fontSize: 15, fontWeight: 800, borderRadius: 12, justifyContent: 'center', boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)' }}
              onClick={submit}
              disabled={saving}
            >
              {saving ? 'Registering Student...' : recordImmediatePayment ? 'Register & Record Payment' : 'Complete Registration'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
