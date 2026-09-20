'use client'

import { useState, useEffect, Suspense, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Search, Plus, Trash2, CreditCard, Home, Phone, User, MapPin, CheckCircle, Edit3, ShieldAlert } from 'lucide-react'
import { MONTH_NAMES, Student, Enrollment, StudentBalance } from '@/lib/types'
import { DEFAULT_GRADE_COURSES, DEFAULT_STANDALONE_COURSES, CourseConfig, getAllCourseLabels, getAllCourseFees } from '@/lib/courses'

const BANKS = ['BOC', 'Sampath', 'Commercial', 'HNB', 'People\'s Bank', 'NSB', 'Seylan', 'NTB', 'Other']

interface PaymentClassItem {
  itemId: string
  isExistingEnrollment: boolean
  enrollmentId?: string
  grade: number | 'standalone'
  courseCode: string
  fee: number
  selected: boolean
  amountPaid: string
  currentBalance: number
  suggested: number
  deliverTute: boolean
  isStandalone?: boolean
}

// Sri Lanka phone normalizer: returns 10-digit 07XXXXXXXX or formatted string
function normalizePhone(raw: string): string {
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
  return raw
}

function AddPaymentForm() {
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [psSearch, setPsSearch] = useState(searchParams.get('ps') || '')
  const [student, setStudent] = useState<Student | null>(null)

  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [allBalances, setAllBalances] = useState<Record<string, StudentBalance>>({})
  const [memberName, setMemberName] = useState('')
  const [currentUserRole, setCurrentUserRole] = useState<'member' | 'admin' | 'owner'>('member')

  // Course configuration state
  const [gradeCourses, setGradeCourses] = useState<Record<number, CourseConfig[]>>(DEFAULT_GRADE_COURSES)
  const [standaloneCourses, setStandaloneCourses] = useState<CourseConfig[]>(DEFAULT_STANDALONE_COURSES)
  const [availableClasses, setAvailableClasses] = useState<Record<string, string>>(getAllCourseLabels(DEFAULT_GRADE_COURSES, DEFAULT_STANDALONE_COURSES))
  const [classDefaultFees, setClassDefaultFees] = useState<Record<string, number>>(getAllCourseFees(DEFAULT_GRADE_COURSES, DEFAULT_STANDALONE_COURSES))

  // Dynamic Payment Class Rows under this 1 PS Code
  const [paymentRows, setPaymentRows] = useState<PaymentClassItem[]>([])

  const [form, setForm] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    payment_type: 'BANK' as string,
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

  // Student Profile Edit State
  const [editingStudent, setEditingStudent] = useState(false)
  const [editName, setEditName] = useState('')
  const [editGrade, setEditGrade] = useState<number | ''>(11)
  const [savingStudent, setSavingStudent] = useState(false)

  // Household & Delivery Verification / Live Edit State
  const [editingHousehold, setEditingHousehold] = useState(false)
  const [parentNameInput, setParentNameInput] = useState('')
  const [parentPhoneInput, setParentPhoneInput] = useState('')
  const [addressInput, setAddressInput] = useState('')
  const [areaInput, setAreaInput] = useState('')
  const [savingHousehold, setSavingHousehold] = useState(false)
  const [householdSavedSuccess, setHouseholdSavedSuccess] = useState(false)

  const channelRef = useRef<any>(null)
  const isAdmin = currentUserRole === 'admin' || currentUserRole === 'owner' || (memberName && memberName.toLowerCase().includes('admin'))

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
        setMemberName(name)
        setCurrentUserRole(role)
      }
    })

    loadAdminCourses()

    const room = supabase.channel('mathsps-global-courses-sync')
    channelRef.current = room

    room
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, () => {
        loadAdminCourses()
      })
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

  useEffect(() => {
    if (psSearch) searchStudent()
  }, [])

  // Live real-time search suggestions
  useEffect(() => {
    if (!psSearch.trim()) {
      setSearchResults([])
      setShowDropdown(false)
      return
    }

    const term = psSearch.trim()
    const cleanDigits = term.replace(/\D/g, '')
    const cleanCode = term.toUpperCase().replace(/\s+/g, '')

    setSearching(true)

    // Parallel fetch: Exact match lookup + broader search
    Promise.all([
      supabase.from('students').select('*, household:households(*)').or(`ps_code.eq.${cleanCode},ps_code.eq.PS${cleanDigits}`).maybeSingle(),
      supabase.from('students').select('*, household:households(*)').or(`ps_code.ilike.${cleanCode}%,ps_code.ilike.%${cleanDigits}%,full_name.ilike.%${term}%`).limit(15)
    ]).then(([{ data: exactMatch }, { data: broadMatches }]) => {
      const combined = exactMatch
        ? [exactMatch, ...(broadMatches || []).filter(m => m.id !== exactMatch.id)]
        : (broadMatches || [])

      // Sort dropdown results:
      // 1. Exact match code
      // 2. Starts with search code
      // 3. Registered students (with actual name) first
      // 4. Shorter code length
      const sorted = combined.sort((a, b) => {
        const aCode = (a.ps_code || '').toUpperCase()
        const bCode = (b.ps_code || '').toUpperCase()

        if (aCode === cleanCode && bCode !== cleanCode) return -1
        if (bCode === cleanCode && aCode !== cleanCode) return 1

        const aStarts = aCode.startsWith(cleanCode)
        const bStarts = bCode.startsWith(cleanCode)
        if (aStarts && !bStarts) return -1
        if (!aStarts && bStarts) return 1

        const aHasName = !!(a.full_name && a.full_name !== 'System Auto-Pre-generated')
        const bHasName = !!(b.full_name && b.full_name !== 'System Auto-Pre-generated')
        if (aHasName && !bHasName) return -1
        if (!aHasName && bHasName) return 1

        return aCode.length - bCode.length
      })

      setSearchResults(sorted.slice(0, 8))
      setShowDropdown(true)
      setSearching(false)
    })
  }, [psSearch])

  function selectStudent(selectedStu: any) {
    setStudent(selectedStu)
    setPsSearch(selectedStu.ps_code)
    setShowDropdown(false)
    setError('')
    setEditingStudent(false)
    setEditingHousehold(false)
    setHouseholdSavedSuccess(false)

    setEditName(selectedStu.full_name || '')
    setEditGrade(selectedStu.grade || 11)

    const hh = selectedStu.household || {}
    setParentNameInput(hh.parent_name || '')
    setParentPhoneInput(hh.parent_phone || '')
    setAddressInput(hh.address || '')
    setAreaInput(hh.area || '')

    loadStudentClasses(selectedStu)
  }

  function inferGradeFromCourse(courseCode: string, fallbackGrade: number): number | 'standalone' {
    if (standaloneCourses.some(sc => sc.code === courseCode)) {
      return 'standalone'
    }
    for (const [grStr, list] of Object.entries(gradeCourses)) {
      if (list.some(c => c.code === courseCode)) {
        return Number(grStr)
      }
    }
    const match = courseCode.match(/GR(\d+)/i)
    if (match) return parseInt(match[1])
    return fallbackGrade || 10
  }

  async function loadStudentClasses(stu: any) {
    const stuGrade = stu.grade || 10

    // Fetch student active enrollments
    const { data: enrols } = await supabase
      .from('enrollments')
      .select('*')
      .eq('student_id', stu.id)
      .eq('active', true)
    setEnrollments(enrols || [])

    // Fetch balances
    const { data: bData } = await supabase
      .from('student_balances')
      .select('*')
      .eq('student_id', stu.id)

    const bMap: Record<string, StudentBalance> = {}
    ;(bData || []).forEach(b => {
      bMap[b.class_type] = b
    })
    setAllBalances(bMap)

    if (enrols && enrols.length > 0) {
      const rows: PaymentClassItem[] = enrols.map(e => {
        const curBal = bMap[e.class_type]?.current_balance || 0
        const sug = Math.max(0, e.fee_amount - curBal)
        const rowGrade = inferGradeFromCourse(e.class_type, stuGrade)
        const isStandalone = rowGrade === 'standalone'

        return {
          itemId: `enrol-${e.id}`,
          isExistingEnrollment: true,
          enrollmentId: e.id,
          grade: rowGrade,
          courseCode: e.class_type,
          fee: e.fee_amount,
          selected: true,
          amountPaid: String(sug),
          currentBalance: curBal,
          suggested: sug,
          deliverTute: true,
          isStandalone
        }
      })
      setPaymentRows(rows)
    } else {
      const courses = gradeCourses[stuGrade] || []
      const def = courses[0]
      const fee = def ? def.defaultFee : 1800
      const code = def ? def.code : 'GR10_THEORY'

      setPaymentRows([
        {
          itemId: `init-${stu.id}`,
          isExistingEnrollment: false,
          grade: stuGrade,
          courseCode: code,
          fee: fee,
          selected: true,
          amountPaid: String(fee),
          currentBalance: 0,
          suggested: fee,
          deliverTute: true,
          isStandalone: false
        }
      ])
    }
  }

  // Row management for Add Payment
  function handleAddPaymentRow() {
    const stu = student
    if (!stu) return
    const stuGrade = stu.grade || 10
    const coursesForGrade = gradeCourses[stuGrade] || []
    const firstCourse = coursesForGrade[0]
    const defFee = firstCourse ? firstCourse.defaultFee : 1800
    const defCode = firstCourse ? firstCourse.code : 'GR10_THEORY'

    const newRow: PaymentClassItem = {
      itemId: `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      isExistingEnrollment: false,
      grade: stuGrade,
      courseCode: defCode,
      fee: defFee,
      selected: true,
      amountPaid: String(defFee),
      currentBalance: 0,
      suggested: defFee,
      deliverTute: true,
      isStandalone: false
    }
    setPaymentRows([...paymentRows, newRow])
  }

  function handleRemovePaymentRow(itemId: string) {
    if (paymentRows.length === 1) {
      alert('At least one class is required to record payment.')
      return
    }
    setPaymentRows(paymentRows.filter(r => r.itemId !== itemId))
  }

  function handleRowGradeChange(itemId: string, newGrade: number | 'standalone') {
    if (newGrade === 'standalone') {
      const firstSc = standaloneCourses[0]
      const defFee = firstSc ? firstSc.defaultFee : 2500
      const defCode = firstSc ? firstSc.code : 'GEOMETRY_FULL'

      setPaymentRows(prev => prev.map(r => {
        if (r.itemId === itemId) {
          const curBal = allBalances[defCode]?.current_balance || 0
          const sug = Math.max(0, defFee - curBal)
          return {
            ...r,
            grade: 'standalone',
            courseCode: defCode,
            fee: defFee,
            currentBalance: curBal,
            suggested: sug,
            amountPaid: String(sug),
            isStandalone: true
          }
        }
        return r
      }))
      return
    }

    const coursesForGrade = gradeCourses[newGrade] || []
    const firstCourse = coursesForGrade[0]
    const defFee = firstCourse ? firstCourse.defaultFee : 1800
    const defCode = firstCourse ? firstCourse.code : ''

    setPaymentRows(prev => prev.map(r => {
      if (r.itemId === itemId) {
        const curBal = allBalances[defCode]?.current_balance || 0
        const sug = Math.max(0, defFee - curBal)
        return {
          ...r,
          grade: newGrade,
          courseCode: defCode,
          fee: defFee,
          currentBalance: curBal,
          suggested: sug,
          amountPaid: String(sug),
          isStandalone: false
        }
      }
      return r
    }))
  }

  function handleRowCourseChange(itemId: string, newCourseCode: string) {
    const fee = classDefaultFees[newCourseCode] || 1800

    setPaymentRows(prev => prev.map(r => {
      if (r.itemId === itemId) {
        const curBal = allBalances[newCourseCode]?.current_balance || 0
        const sug = Math.max(0, fee - curBal)
        return {
          ...r,
          courseCode: newCourseCode,
          fee,
          currentBalance: curBal,
          suggested: sug,
          amountPaid: String(sug)
        }
      }
      return r
    }))
  }

  function handleRowFeeChange(itemId: string, newFee: number) {
    setPaymentRows(prev => prev.map(r => {
      if (r.itemId === itemId) {
        const sug = Math.max(0, newFee - r.currentBalance)
        return {
          ...r,
          fee: newFee,
          suggested: sug,
          amountPaid: String(sug)
        }
      }
      return r
    }))
  }

  function handleRowAmountPaidChange(itemId: string, val: string) {
    setPaymentRows(prev => prev.map(r => {
      if (r.itemId === itemId) {
        return { ...r, amountPaid: val }
      }
      return r
    }))
  }

  function handleRowToggleSelect(itemId: string, checked: boolean) {
    setPaymentRows(prev => prev.map(r => {
      if (r.itemId === itemId) {
        return { ...r, selected: checked }
      }
      return r
    }))
  }

  function handleRowToggleDeliverTute(itemId: string, deliver: boolean) {
    setPaymentRows(prev => prev.map(r => {
      if (r.itemId === itemId) {
        return { ...r, deliverTute: deliver }
      }
      return r
    }))
  }

  async function saveStudentProfile() {
    if (!student) return
    setSavingStudent(true)
    try {
      const { error: err } = await supabase.from('students').update({
        full_name: editName.trim() || null,
        grade: editGrade ? parseInt(String(editGrade)) : null,
      }).eq('id', student.id)

      if (err) throw err

      setStudent({
        ...student,
        full_name: editName.trim(),
        grade: editGrade ? parseInt(String(editGrade)) : null,
      } as any)
      setEditingStudent(false)
    } catch (e: any) {
      alert('Failed to update student profile: ' + e.message)
    } finally {
      setSavingStudent(false)
    }
  }

  // Live save / update Household & Delivery Information
  async function saveHouseholdDetails() {
    if (!student) return
    setSavingHousehold(true)
    setHouseholdSavedSuccess(false)
    try {
      const hh = (student as any).household
      const normPhone = normalizePhone(parentPhoneInput.trim())

      if (hh?.id) {
        const { error: hhErr } = await supabase.from('households').update({
          parent_name: parentNameInput.trim() || null,
          parent_phone: normPhone || null,
          address: addressInput.trim() || null,
          area: areaInput.trim() || null,
        }).eq('id', hh.id)

        if (hhErr) throw hhErr

        setStudent({
          ...student,
          household: {
            ...hh,
            parent_name: parentNameInput.trim(),
            parent_phone: normPhone,
            address: addressInput.trim(),
            area: areaInput.trim(),
          }
        } as any)
      } else {
        const { data: newHh, error: hhErr } = await supabase.from('households').insert({
          parent_name: parentNameInput.trim() || null,
          parent_phone: normPhone || null,
          address: addressInput.trim() || null,
          area: areaInput.trim() || null,
        }).select().single()

        if (hhErr) throw hhErr

        await supabase.from('students').update({ household_id: newHh.id }).eq('id', student.id)
        setStudent({
          ...student,
          household_id: newHh.id,
          household: newHh
        } as any)
      }
      setEditingHousehold(false)
      setHouseholdSavedSuccess(true)
      setTimeout(() => setHouseholdSavedSuccess(false), 4000)
    } catch (e: any) {
      alert('Failed to save household details: ' + e.message)
    } finally {
      setSavingHousehold(false)
    }
  }

  async function searchStudent() {
    setStudent(null); setError('')
    if (!psSearch.trim()) return

    const rawInput = psSearch.trim()
    const cleanDigits = rawInput.replace(/\D/g, '')
    const cleanPs = rawInput.toUpperCase().replace(/\s+/g, '')

    // Parallel fetch: Exact match lookup + broader search
    const [{ data: exactMatch }, { data: matches }] = await Promise.all([
      supabase.from('students').select('*, household:households(*)').or(`ps_code.eq.${cleanPs},ps_code.eq.PS${cleanDigits}`).maybeSingle(),
      supabase.from('students').select('*, household:households(*)').or(`ps_code.ilike.${cleanPs}%,ps_code.ilike.%${cleanDigits}%,full_name.ilike.%${rawInput}%`).limit(10)
    ])

    const combined = exactMatch
      ? [exactMatch, ...(matches || []).filter(m => m.id !== exactMatch.id)]
      : (matches || [])

    if (combined.length === 0) {
      setError(`No student found for "${psSearch}". Try typing digits like 185 or student name.`)
      return
    }

    // Sort to guarantee exact match is first
    const sorted = combined.sort((a, b) => {
      const aCode = (a.ps_code || '').toUpperCase()
      const bCode = (b.ps_code || '').toUpperCase()

      if (aCode === cleanPs && bCode !== cleanPs) return -1
      if (bCode === cleanPs && aCode !== cleanPs) return 1

      const aStarts = aCode.startsWith(cleanPs)
      const bStarts = bCode.startsWith(cleanPs)
      if (aStarts && !bStarts) return -1
      if (!aStarts && bStarts) return 1

      const aHasName = !!(a.full_name && a.full_name !== 'System Auto-Pre-generated')
      const bHasName = !!(b.full_name && b.full_name !== 'System Auto-Pre-generated')
      if (aHasName && !bHasName) return -1
      if (!aHasName && bHasName) return 1

      return aCode.length - bCode.length
    })

    selectStudent(sorted[0])
  }

  async function submit() {
    if (!student) { setError('Please search and select a student first'); return }

    const selectedRows = paymentRows.filter(r => r.selected && r.courseCode)
    if (selectedRows.length === 0) {
      setError('Select at least one class to record payment')
      return
    }
    if (!memberName.trim()) { setError('Enter your name (recorded by)'); return }

    setSaving(true); setError('')
    try {
      // 1. Ensure enrollments are recorded for selected classes
      for (const r of selectedRows) {
        if (!r.isExistingEnrollment) {
          await supabase.from('enrollments').upsert({
            student_id: student.id,
            class_type: r.courseCode,
            tier: 'STANDARD',
            fee_amount: r.fee,
            active: true
          }, { onConflict: 'student_id,class_type' })
        } else if (r.enrollmentId) {
          await supabase.from('enrollments').update({
            fee_amount: r.fee
          }).eq('id', r.enrollmentId)
        }
      }

      // 2. Loop over each selected class row and record payment
      for (const r of selectedRows) {
        const amountDue = r.fee || 0
        const bVal = allBalances[r.courseCode]?.current_balance || 0

        let amountPaid = 0
        if (['FREE', 'IMS'].includes(form.payment_type)) {
          amountPaid = amountDue
        } else {
          amountPaid = parseFloat(r.amountPaid) || 0
        }

        const balBefore = bVal
        const balAfter = balBefore + amountPaid - amountDue

        // Insert payment record (balance_after is automatically computed by PostgreSQL GENERATED column)
        const { error: pErr } = await supabase.from('payments').insert({
          student_id: student.id,
          class_type: r.courseCode,
          month: form.month,
          year: form.year,
          amount_due: amountDue,
          amount_paid: amountPaid,
          balance_before: balBefore,
          payment_type: form.payment_type,
          bank_name: form.payment_type === 'BANK' ? form.bank_name : null,
          date_paid: form.date_paid,
          added_to_group: form.added_to_group,
          tute_delivered: r.deliverTute ?? false,
          recorded_by: memberName.trim(),
          notes: form.notes || null,
        })

        if (pErr) throw pErr

        // Update student balance ledger
        await supabase.from('student_balances').upsert({
          student_id: student.id,
          class_type: r.courseCode,
          current_balance: balAfter,
          last_payment_date: form.date_paid,
          last_payment_amount: amountPaid,
        }, { onConflict: 'student_id,class_type' })
      }

      setSaved(true)
      // Refresh balances & enrollments
      loadStudentClasses(student)
    } catch (e: any) {
      setError(e.message || 'Failed to save payment')
    } finally {
      setSaving(false)
    }
  }

  const selectedRows = paymentRows.filter(r => r.selected)
  const totalAmountToPay = selectedRows.reduce((sum, r) => sum + (parseFloat(r.amountPaid) || 0), 0)

  return (
    <div className="fade-in" style={{ width: '100%', maxWidth: 1040, margin: '0 auto', paddingBottom: 60, minHeight: '100vh' }}>
      {/* Back to Dashboard link with proper spacing */}
      <div style={{ marginBottom: 14 }}>
        <a
          href="/dashboard"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            color: 'var(--text-secondary)',
            fontSize: 13,
            textDecoration: 'none',
            fontWeight: 700,
            padding: '4px 0'
          }}
        >
          <ArrowLeft size={15} /> Back to Dashboard
        </a>
      </div>

      {/* Page Header with clear visible typography */}
      <div className="page-header" style={{ padding: '22px 28px', borderRadius: 16, border: '1px solid var(--border)', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(56, 189, 248, 0.15)', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CreditCard size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                  Record Payment &amp; Verify Household
                </h1>
                <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 10px', borderRadius: 14, background: 'rgba(56, 189, 248, 0.15)', color: 'var(--accent-blue)', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                  Cashier &amp; Vault
                </span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, fontWeight: 500 }}>
                Search student PS code, verify &amp; update delivery details, and record class payments in 1 click
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        {/* Step 1: Search Student PS Code */}
        <div className="glass-card" style={{ padding: '24px 26px', marginBottom: 20, borderRadius: 16, border: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(56, 189, 248, 0.15)', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Search size={15} />
            </div>
            1. Search Student by PS Code
          </div>
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  className="search-bar"
                  style={{
                    width: '100%',
                    paddingLeft: 40,
                    paddingRight: 14,
                    fontSize: 14,
                    height: 44,
                    borderRadius: 10,
                    fontWeight: 600
                  }}
                  placeholder="Type PS Code or Name (e.g. PS5000, SM20, Kasun...)"
                  value={psSearch}
                  onChange={e => setPsSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && searchStudent()}
                />
              </div>
              <button
                className="btn-primary"
                onClick={searchStudent}
                style={{ padding: '0 24px', fontSize: 13.5, fontWeight: 700, borderRadius: 10, height: 44 }}
              >
                Search
              </button>
            </div>

            {/* Dropdown search suggestions */}
            {showDropdown && searchResults.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12,
                marginTop: 6, maxHeight: 280, overflowY: 'auto', boxShadow: '0 12px 30px rgba(0,0,0,0.25)'
              }}>
                {searchResults.map(s => (
                  <div
                    key={s.id}
                    onClick={() => selectStudent(s)}
                    style={{
                      padding: '12px 16px', borderBottom: '1px solid var(--border)',
                      cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}
                  >
                    <div>
                      <span style={{ fontWeight: 800, color: 'var(--accent-blue)', marginRight: 10, background: 'rgba(56, 189, 248, 0.15)', padding: '2px 8px', borderRadius: 6, border: '1px solid rgba(56, 189, 248, 0.3)', fontSize: 12 }}>
                        {s.ps_code}
                      </span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 13.5 }}>{s.full_name || 'Pending Name'}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
                      Gr {s.grade || '—'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginTop: 12, fontWeight: 600 }}>
              ⚠️ {error}
            </div>
          )}

          {/* Student Profile Card */}
          {student && (
            <div style={{ marginTop: 18, padding: 18, background: 'rgba(56, 189, 248, 0.1)', borderRadius: 12, border: '1.5px solid rgba(56, 189, 248, 0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 800, color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                  <CheckCircle size={18} style={{ color: 'var(--accent-blue)' }} />
                  Selected Student: <span style={{ color: 'var(--text-primary)', background: 'var(--bg-card)', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)' }}>{student.ps_code}</span>
                </div>
                {!editingStudent ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditName(student.full_name || '')
                      setEditGrade(student.grade || 11)
                      setEditingStudent(true)
                    }}
                    className="btn-secondary"
                    style={{ padding: '5px 12px', fontSize: 11.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, borderRadius: 8 }}
                  >
                    <Edit3 size={13} /> Edit Profile
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={saveStudentProfile}
                      disabled={savingStudent}
                      className="btn-primary"
                      style={{ padding: '5px 12px', fontSize: 11.5, fontWeight: 700, borderRadius: 8 }}
                    >
                      {savingStudent ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingStudent(false)}
                      className="btn-secondary"
                      style={{ padding: '5px 12px', fontSize: 11.5, fontWeight: 700, borderRadius: 8 }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {!editingStudent ? (
                <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginTop: 10 }}>
                  <span style={{ fontWeight: 700, color: student.full_name ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    {student.full_name || '⚠ Student Name not registered'}
                  </span> · <span style={{ color: 'var(--accent-blue)', fontWeight: 800 }}>Grade {student.grade || '—'}</span>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 12, marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Student Full Name</label>
                    <input
                      className="input-field"
                      placeholder="e.g. Kasun Perera"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      style={{ borderRadius: 8, height: 38 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Grade</label>
                    <select
                      className="input-field"
                      value={editGrade}
                      onChange={e => setEditGrade(e.target.value ? parseInt(e.target.value) : '')}
                      style={{ borderRadius: 8, height: 38, fontWeight: 700 }}
                    >
                      {[5, 6, 7, 8, 9, 10, 11, 12, 13].map(g => (
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
            {/* Step 2: Household & Delivery Details */}
            <div className="glass-card" style={{ padding: '24px 26px', marginBottom: 20, borderRadius: 16, border: '1.5px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(236, 72, 153, 0.15)', color: '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Home size={16} />
                  </div>
                  2. Household &amp; Delivery Details
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {householdSavedSuccess && (
                    <span style={{ fontSize: 12, color: '#10b981', fontWeight: 700, background: 'rgba(16, 185, 129, 0.15)', padding: '2px 8px', borderRadius: 6 }}>
                      ✓ Address Saved!
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={saveHouseholdDetails}
                    disabled={savingHousehold}
                    className="btn-secondary"
                    style={{ padding: '5px 12px', fontSize: 11.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, borderRadius: 8 }}
                  >
                    {savingHousehold ? 'Saving...' : 'Save Updates'}
                  </button>
                  <span style={{ fontSize: 11, background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '3px 9px', borderRadius: 6, fontWeight: 800, border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                    * Required for Courier
                  </span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 11.5, color: 'var(--text-primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>
                    Parent / Guardian Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    className="input-field"
                    placeholder="e.g. Sunil Perera"
                    value={parentNameInput}
                    onChange={e => setParentNameInput(e.target.value)}
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
                    value={parentPhoneInput}
                    onChange={e => setParentPhoneInput(e.target.value)}
                    required
                    style={{ borderRadius: 10, height: 42, fontWeight: 600 }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginTop: 16 }}>
                <div>
                  <label style={{ fontSize: 11.5, color: 'var(--text-primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>
                    Delivery Address <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    className="input-field"
                    placeholder="House No, Street, City (e.g. No 45, Main Street, Kandy)"
                    value={addressInput}
                    onChange={e => setAddressInput(e.target.value)}
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
                    value={areaInput}
                    onChange={e => setAreaInput(e.target.value)}
                    style={{ borderRadius: 10, height: 42 }}
                  />
                </div>
              </div>
            </div>

            {/* Step 3: Payment Class Selection */}
            <div className="glass-card" style={{ padding: '24px 26px', marginBottom: 20, borderRadius: 16, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(56, 189, 248, 0.15)', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CreditCard size={16} />
                    </div>
                    3. Enrolled Classes &amp; Payment Amounts
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Check classes to include in this payment slip. Click <b>+ Class</b> to add extra classes or siblings.
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={handleAddPaymentRow}
                    className="btn-primary"
                    style={{ padding: '8px 16px', fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', borderRadius: 10 }}
                  >
                    <Plus size={14} /> + Class
                  </button>
                </div>
              </div>

              {/* Payment Class Rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                {paymentRows.map((row) => {
                  const coursesForThisGrade: CourseConfig[] = typeof row.grade === 'number' ? (gradeCourses[row.grade] || []) : []

                  return (
                    <div
                      key={row.itemId}
                      style={{
                        padding: '14px 16px',
                        borderRadius: 12,
                        border: '1.5px solid',
                        borderColor: row.selected ? 'var(--accent-blue)' : 'var(--border)',
                        background: row.selected ? 'var(--bg-card-hover)' : 'var(--bg-card)',
                        transition: 'all 0.15s'
                      }}
                    >
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '28px 120px 1fr 130px 110px 36px',
                        gap: 12,
                        alignItems: 'center'
                      }}>
                        {/* Checkbox */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <input
                            type="checkbox"
                            checked={row.selected}
                            onChange={e => handleRowToggleSelect(row.itemId, e.target.checked)}
                            style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#2563eb' }}
                          />
                        </div>

                        {/* Grade Dropdown */}
                        <div>
                          <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>
                            Category / Grade
                          </label>
                          <select
                            className="input-field"
                            value={row.grade}
                            onChange={e => {
                              const val = e.target.value
                              handleRowGradeChange(row.itemId, val === 'standalone' ? 'standalone' : parseInt(val))
                            }}
                            style={{
                              padding: '5px 8px',
                              fontSize: 12.5,
                              fontWeight: 700,
                              borderRadius: 8,
                              height: 36,
                              color: row.grade === 'standalone' ? 'var(--accent-blue)' : 'inherit',
                              border: row.grade === 'standalone' ? '1px solid var(--accent-blue)' : undefined
                            }}
                          >
                            <optgroup label="Regular Grades">
                              {[5, 6, 7, 8, 9, 10, 11, 12, 13].map(g => (
                                <option key={g} value={g}>Grade {g}</option>
                              ))}
                            </optgroup>
                            <optgroup label="Other Courses">
                              <option value="standalone">Courses</option>
                            </optgroup>
                          </select>
                        </div>

                        {/* Aligned Course Dropdown */}
                        <div>
                          <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>
                            {row.grade === 'standalone' ? 'Course' : 'Aligned Course'}
                          </label>
                          <select
                            className="input-field"
                            value={row.courseCode}
                            onChange={e => handleRowCourseChange(row.itemId, e.target.value)}
                            style={{
                              padding: '5px 10px',
                              fontSize: 12.5,
                              fontWeight: 700,
                              color: 'var(--accent-blue)',
                              borderRadius: 8,
                              height: 36
                            }}
                          >
                            {row.grade === 'standalone' ? (
                              standaloneCourses.map((sc: CourseConfig) => (
                                <option key={sc.code} value={sc.code}>
                                  {sc.name} ({sc.billingType === 'ONE_TIME' ? 'One-Time' : 'Monthly'})
                                </option>
                              ))
                            ) : coursesForThisGrade.length === 0 ? (
                              <option value="">No courses for Grade {row.grade}</option>
                            ) : (
                              coursesForThisGrade.map((c: CourseConfig) => (
                                <option key={c.code} value={c.code}>
                                  {c.name}
                                </option>
                              ))
                            )}
                          </select>
                        </div>

                        {/* Monthly Fee / Rate */}
                        <div>
                          <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>
                            {row.grade === 'standalone' ? 'Fee Rate (Rs.)' : 'Fee Rate (Rs.)'}
                          </label>
                          <input
                            type="number"
                            className="input-field"
                            value={row.fee}
                            onChange={e => handleRowFeeChange(row.itemId, parseFloat(e.target.value) || 0)}
                            style={{ padding: '5px 8px', fontSize: 13, fontWeight: 800, color: '#10b981', borderRadius: 8, height: 36 }}
                            title="Edit monthly rate for this student"
                          />
                        </div>

                        {/* Balance Info */}
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Balance</div>
                          <div style={{
                            fontSize: 12.5, fontWeight: 800,
                            color: row.currentBalance > 0 ? '#10b981' : row.currentBalance < 0 ? '#ef4444' : 'var(--text-secondary)'
                          }}>
                            {row.currentBalance >= 0 ? '+' : ''}Rs.{row.currentBalance.toLocaleString()}
                          </div>
                        </div>

                        {/* Delete Row */}
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleRemovePaymentRow(row.itemId)}
                            disabled={paymentRows.length === 1}
                            style={{
                              background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 8,
                              color: paymentRows.length === 1 ? 'var(--text-muted)' : '#ef4444',
                              cursor: paymentRows.length === 1 ? 'not-allowed' : 'pointer',
                              width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                              opacity: paymentRows.length === 1 ? 0.4 : 1
                            }}
                            title="Remove this class"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Bottom Paid Amount Field & Per-Class Deliver Tute Checkbox */}
                      {row.selected && (
                        <div style={{
                          marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10
                        }}>
                          {['BANK', 'CASH', 'PHYSICAL'].includes(form.payment_type) ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
                                Suggested: <strong style={{ color: 'var(--text-primary)' }}>Rs. {row.suggested.toLocaleString()}</strong>
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-blue)' }}>
                                  Paid:
                                </label>
                                <input
                                  type="number"
                                  className="input-field"
                                  style={{ width: 110, padding: '4px 8px', fontSize: 13.5, fontWeight: 800, color: '#10b981', borderRadius: 8 }}
                                  placeholder={`e.g. ${row.suggested}`}
                                  value={row.amountPaid}
                                  onChange={e => handleRowAmountPaidChange(row.itemId, e.target.value)}
                                />
                              </div>
                            </div>
                          ) : (
                            <div style={{ fontSize: 12, color: '#10b981', fontWeight: 700 }}>
                              {form.payment_type} Access (Rs. {row.fee.toLocaleString()})
                            </div>
                          )}

                          {/* Per-Class Tute Deliver Checkbox */}
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '4px 10px', borderRadius: 8,
                            background: row.deliverTute ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-card-hover)',
                            border: `1px solid ${row.deliverTute ? 'rgba(16, 185, 129, 0.3)' : 'var(--border)'}`
                          }}>
                            <input
                              type="checkbox"
                              id={`tute-${row.itemId}`}
                              checked={row.deliverTute}
                              onChange={e => handleRowToggleDeliverTute(row.itemId, e.target.checked)}
                              style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#10b981' }}
                            />
                            <label htmlFor={`tute-${row.itemId}`} style={{
                              fontSize: 12, fontWeight: 700, cursor: 'pointer',
                              color: row.deliverTute ? '#10b981' : 'var(--text-secondary)'
                            }}>
                              📦 Deliver Tute (Postal)
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Total Payment Summary Box */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 18px', background: 'rgba(56, 189, 248, 0.1)', borderRadius: 10, border: '1px solid rgba(56, 189, 248, 0.25)'
              }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Selected Classes: <strong style={{ color: 'var(--accent-blue)' }}>{selectedRows.length}</strong>
                </span>
                <span style={{ fontSize: 16, fontWeight: 900, color: '#10b981' }}>
                  Total Payment: {['FREE', 'IMS'].includes(form.payment_type) ? form.payment_type : `Rs. ${totalAmountToPay.toLocaleString()}`}
                </span>
              </div>
            </div>

            {/* Step 4: Payment Method, Date, Delivery & Group */}
            <div className="glass-card" style={{ padding: '24px 26px', marginBottom: 20, borderRadius: 16, border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 16, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CreditCard size={16} />
                </div>
                4. Payment Method &amp; Dispatch Details
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <FormRow label="Month">
                  <select className="input-field" style={{ borderRadius: 8, height: 38, fontWeight: 700 }} value={form.month} onChange={e => setForm(f => ({ ...f, month: parseInt(e.target.value) }))}>
                    {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </FormRow>
                <FormRow label="Year">
                  <select className="input-field" style={{ borderRadius: 8, height: 38, fontWeight: 700 }} value={form.year} onChange={e => setForm(f => ({ ...f, year: parseInt(e.target.value) }))}>
                    {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </FormRow>
              </div>

              <FormRow label="Payment Type">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {['BANK', 'CASH', 'FREE', 'IMS', 'PHYSICAL'].map(t => (
                    <button key={t} onClick={() => setForm(f => ({ ...f, payment_type: t }))}
                      className={form.payment_type === t ? 'btn-primary' : 'btn-secondary'}
                      style={{ padding: '6px 14px', fontSize: 12, borderRadius: 8, fontWeight: 700 }}>
                      {t}
                    </button>
                  ))}
                </div>
              </FormRow>

              {form.payment_type === 'BANK' && (
                <FormRow label="Bank">
                  <select className="input-field" style={{ borderRadius: 8, height: 38, fontWeight: 700 }} value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))}>
                    {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </FormRow>
              )}

              <FormRow label="Date Paid">
                <input className="input-field" type="date" style={{ borderRadius: 8, height: 38, fontWeight: 600 }} value={form.date_paid}
                  onChange={e => setForm(f => ({ ...f, date_paid: e.target.value }))} />
              </FormRow>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg-card-hover)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 14 }}>
                <input type="checkbox" id="group" checked={form.added_to_group}
                  onChange={e => setForm(f => ({ ...f, added_to_group: e.target.checked }))}
                  style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#2563eb' }} />
                <label htmlFor="group" style={{ fontSize: 13, cursor: 'pointer', fontWeight: 600, color: 'var(--text-primary)' }}>Added to WhatsApp Group?</label>
              </div>

              <FormRow label="Notes (optional)">
                <input className="input-field" placeholder="Any notes or slip details..."
                  value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  style={{ borderRadius: 8, height: 38 }} />
              </FormRow>
            </div>

            {/* Step 5: Audit log */}
            <div className="glass-card" style={{ padding: '20px 24px', marginBottom: 24, borderRadius: 16, border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                🔒 Audit Log (Auto-Locked)
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                  Recorded By (Member Name)
                </label>
                <div style={{
                  padding: '10px 14px', background: 'var(--bg-card-hover)', border: '1.5px solid var(--border)',
                  borderRadius: 8, fontSize: 14, fontWeight: 700, color: 'var(--accent-blue)'
                }}>
                  {memberName || 'Admin / System User'}
                </div>
              </div>
            </div>

            {/* Submit */}
            <button
              className="btn-primary"
              onClick={submit}
              disabled={saving}
              style={{ width: '100%', justifyContent: 'center', padding: '14px 20px', fontSize: 15, fontWeight: 800, borderRadius: 12, boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)' }}
            >
              {saving ? 'Recording Payment...' : saved ? '✓ Payment Saved' : 'Save Payment'}
            </button>
            {saved && (
              <div style={{ marginTop: 14, padding: '14px 18px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 10, color: '#10b981', fontSize: 13.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>✓ Payment recorded successfully for {selectedRows.length} class(es)!</span>
                <a href={`/students/${encodeURIComponent(student.ps_code)}`}
                  style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontWeight: 800 }}>
                  View Student Profile →
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
      <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}
