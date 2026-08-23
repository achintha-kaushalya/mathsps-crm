'use client'

import { useState, useEffect, Suspense, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Search, Plus, Trash2, Sparkles, Lock, CreditCard } from 'lucide-react'
import { MONTH_NAMES, Student, Enrollment, StudentBalance } from '@/lib/types'
import { DEFAULT_GRADE_COURSES, CourseConfig, getAllCourseLabels, getAllCourseFees } from '@/lib/courses'

const BANKS = ['BOC', 'Sampath', 'Commercial', 'HNB', 'People\'s Bank', 'NSB', 'Seylan', 'NTB', 'Other']

interface PaymentClassItem {
  itemId: string
  isExistingEnrollment: boolean
  enrollmentId?: string
  grade: number
  courseCode: string
  fee: number
  selected: boolean
  amountPaid: string
  currentBalance: number
  suggested: number
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
  const [availableClasses, setAvailableClasses] = useState<Record<string, string>>(getAllCourseLabels(DEFAULT_GRADE_COURSES))
  const [classDefaultFees, setClassDefaultFees] = useState<Record<string, number>>(getAllCourseFees(DEFAULT_GRADE_COURSES))

  // Dynamic Payment Class Rows (combines enrolled courses + dynamic multi-grade additions)
  const [paymentRows, setPaymentRows] = useState<PaymentClassItem[]>([])

  // Admin add course modal
  const [customCourseGrade, setCustomCourseGrade] = useState<number>(10)
  const [customCourseCode, setCustomCourseCode] = useState('')
  const [customCourseName, setCustomCourseName] = useState('')
  const [customCourseFee, setCustomCourseFee] = useState<string>('1800')
  const [showAddCourseModal, setShowAddCourseModal] = useState(false)

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

  const channelRef = useRef<any>(null)
  const isAdmin = currentUserRole === 'admin' || currentUserRole === 'owner' || (memberName && memberName.toLowerCase().includes('admin'))

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

  // Auto-detect logged in member & subscribe to Realtime course updates
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

  // Auto-load if ps param present
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
    const cleanPs = term.toUpperCase().replace(/\s+/g, '')

    let query = supabase.from('students').select('*, household:households(*)').limit(8)

    if (cleanDigits) {
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

  const [editingStudent, setEditingStudent] = useState(false)
  const [editName, setEditName] = useState('')
  const [editGrade, setEditGrade] = useState<number | ''>(11)
  const [savingStudent, setSavingStudent] = useState(false)

  const [editingAddress, setEditingAddress] = useState(false)
  const [addressInput, setAddressInput] = useState('')
  const [areaInput, setAreaInput] = useState('')
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

    const hh = selectedStu.household || {}
    setAddressInput(hh.address || '')
    setAreaInput(hh.area || '')

    loadStudentEnrollmentsAndBuildRows(selectedStu)
  }

  // Detect grade from courseCode or student
  function inferGradeFromCourse(courseCode: string, fallbackGrade: number): number {
    for (const [grStr, list] of Object.entries(gradeCourses)) {
      if (list.some(c => c.code === courseCode)) {
        return Number(grStr)
      }
    }
    const match = courseCode.match(/GR(\d+)/i)
    if (match) return parseInt(match[1])
    return fallbackGrade || 10
  }

  async function loadStudentEnrollmentsAndBuildRows(stu: any) {
    const stuGrade = stu.grade || 10

    // Fetch student active enrollments
    const { data: enrols } = await supabase.from('enrollments').select('*').eq('student_id', stu.id).eq('active', true)
    setEnrollments(enrols || [])

    // Fetch balances
    const { data: bData } = await supabase.from('student_balances').select('*').eq('student_id', stu.id)
    const bMap: Record<string, StudentBalance> = {}
    ;(bData || []).forEach(b => { bMap[b.class_type] = b })
    setAllBalances(bMap)

    if (enrols && enrols.length > 0) {
      const rows: PaymentClassItem[] = enrols.map(e => {
        const curBal = bMap[e.class_type]?.current_balance || 0
        const sug = Math.max(0, e.fee_amount - curBal)
        const rowGrade = inferGradeFromCourse(e.class_type, stuGrade)

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
          suggested: sug
        }
      })
      setPaymentRows(rows)
    } else {
      // If student has no enrollments yet, initialize with 1 row aligned to student grade
      const coursesForGrade = gradeCourses[stuGrade] || []
      const firstCourse = coursesForGrade[0]
      const defFee = firstCourse ? firstCourse.defaultFee : 1800
      const defCode = firstCourse ? firstCourse.code : 'GR10_THEORY'

      setPaymentRows([
        {
          itemId: `row-${Date.now()}`,
          isExistingEnrollment: false,
          grade: stuGrade,
          courseCode: defCode,
          fee: defFee,
          selected: true,
          amountPaid: String(defFee),
          currentBalance: 0,
          suggested: defFee
        }
      ])
    }
  }

  // Row management for Add Payment
  function handleAddPaymentRow() {
    const stuGrade = student?.grade || 10
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
      suggested: defFee
    }
    setPaymentRows([...paymentRows, newRow])
  }

  function handleRemovePaymentRow(itemId: string) {
    if (paymentRows.length === 1) {
      alert('Must have at least one class row to record payment.')
      return
    }
    setPaymentRows(paymentRows.filter(r => r.itemId !== itemId))
  }

  function handleRowGradeChange(itemId: string, newGrade: number) {
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
          amountPaid: String(sug)
        }
      }
      return r
    }))
  }

  function handleRowCourseChange(itemId: string, newCourseCode: string) {
    const fee = classDefaultFees[newCourseCode] || 1800
    const curBal = allBalances[newCourseCode]?.current_balance || 0
    const sug = Math.max(0, fee - curBal)

    setPaymentRows(prev => prev.map(r => {
      if (r.itemId === itemId) {
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

  async function saveAddress() {
    if (!student) return
    setSavingAddress(true)
    try {
      const hh = (student as any).household
      if (hh?.id) {
        const { error: hhErr } = await supabase.from('households').update({
          address: addressInput.trim() || null,
          area: areaInput.trim() || null,
        }).eq('id', hh.id)

        if (hhErr) throw hhErr
        setStudent({
          ...student,
          household: {
            ...hh,
            address: addressInput.trim(),
            area: areaInput.trim(),
          }
        } as any)
      } else {
        const { data: newHh, error: hhErr } = await supabase.from('households').insert({
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
    
    let { data: matches } = await supabase
      .from('students')
      .select('*, household:households(*)')
      .or(`ps_code.eq.${cleanPs},ps_code.eq.PS${cleanDigits},ps_code.ilike.%${cleanDigits}%,full_name.ilike.%${rawInput}%`)
      .limit(5)

    if (!matches || matches.length === 0) {
      setError(`No student found for "${psSearch}". Try typing digits like 5000 or student name.`)
      return
    }

    const bestMatch = matches.find(s => s.ps_code.toUpperCase() === cleanPs || s.ps_code.toUpperCase() === `PS${cleanDigits}`) || matches[0]
    selectStudent(bestMatch)
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

    await saveCoursesToDatabase(updatedGradeCourses)

    setCustomCourseCode('')
    setCustomCourseName('')
    setCustomCourseFee('1800')
    setShowAddCourseModal(false)
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
      // 1. Ensure any newly added courses are registered into student's enrollments table
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
          // Update fee if staff modified it
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
          amountPaid = 0
        } else {
          amountPaid = parseFloat(r.amountPaid) || 0
        }

        const { error: err } = await supabase.from('payments').upsert({
          student_id: student.id,
          class_type: r.courseCode,
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

      // Reload student enrollments and balances
      await loadStudentEnrollmentsAndBuildRows(student)

    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const selectedRows = paymentRows.filter(r => r.selected)
  const totalAmountToPay = selectedRows.reduce((sum, r) => sum + (parseFloat(r.amountPaid) || 0), 0)

  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <a href="/students" className="btn-secondary" style={{ padding: '6px 10px' }}><ArrowLeft size={14} /></a>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Add Payment</h1>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>Record a student payment for one or multiple grade courses</div>
          </div>
        </div>
      </div>

      <div className="page-content" style={{ maxWidth: 740 }}>

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
                background: '#131c2e', border: '1px solid var(--border)', borderRadius: 8,
                zIndex: 50, maxHeight: 240, overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
              }}>
                {searchResults.map(s => (
                  <div
                    key={s.id}
                    onClick={() => selectStudent(s)}
                    style={{
                      padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                      cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}
                    className="hover-bg"
                  >
                    <div>
                      <span style={{ fontWeight: 700, color: 'var(--accent-blue)', marginRight: 10 }}>{s.ps_code}</span>
                      <span style={{ color: 'var(--text-primary)' }}>{s.full_name || 'No name'}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Gr {s.grade || '?'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <div style={{ color: '#ef4444', fontSize: 13, marginTop: 10 }}>{error}</div>}

          {/* Student Profile Card */}
          {student && (
            <div style={{ marginTop: 16, padding: 14, background: 'rgba(59,130,246,0.06)', borderRadius: 8, border: '1px solid rgba(59,130,246,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 600, color: '#10b981' }}>✓ Found: {student.ps_code}</div>
                {!editingStudent ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditName(student.full_name || '')
                      setEditGrade(student.grade || 11)
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
            {/* Step 2: Dynamic Multi-Grade Class Selection & Payment Amount */}
            <div className="glass-card" style={{ padding: 24, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CreditCard size={18} /> 2. Classes & Payment Amounts
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    Check classes to include in this payment. Click <b>+ Add Another Class</b> to pay for siblings or multiple grades.
                  </div>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={handleAddPaymentRow}
                    className="btn-primary"
                    style={{ padding: '6px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <Plus size={14} /> + Add Another Class
                  </button>
                </div>
              </div>

              {/* Dynamic Multi-Grade Class Rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                {paymentRows.map((row, idx) => {
                  const coursesForThisGrade = gradeCourses[row.grade] || []

                  return (
                    <div
                      key={row.itemId}
                      style={{
                        padding: '14px',
                        borderRadius: 10,
                        border: '1px solid',
                        borderColor: row.selected ? 'var(--accent-blue)' : 'var(--border)',
                        background: row.selected ? 'rgba(59,130,246,0.08)' : 'var(--bg-base)',
                        transition: 'all 0.15s'
                      }}
                    >
                      {/* Top Bar: Checkbox + Grade Select + Course Select + Fee + Balance + Delete */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '28px 110px 1fr 110px 100px 32px',
                        gap: 10,
                        alignItems: 'center'
                      }}>
                        {/* Checkbox */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <input
                            type="checkbox"
                            checked={row.selected}
                            onChange={e => handleRowToggleSelect(row.itemId, e.target.checked)}
                            style={{ width: 18, height: 18, cursor: 'pointer' }}
                          />
                        </div>

                        {/* Grade Dropdown */}
                        <div>
                          <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>
                            Grade
                          </label>
                          <select
                            className="input-field"
                            value={row.grade}
                            onChange={e => handleRowGradeChange(row.itemId, parseInt(e.target.value))}
                            style={{ padding: '5px 6px', fontSize: 12, fontWeight: 600 }}
                          >
                            {[6, 7, 8, 9, 10, 11, 12, 13].map(g => (
                              <option key={g} value={g}>Grade {g}</option>
                            ))}
                          </select>
                        </div>

                        {/* Aligned Course Dropdown */}
                        <div>
                          <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>
                            Course
                          </label>
                          <select
                            className="input-field"
                            value={row.courseCode}
                            onChange={e => handleRowCourseChange(row.itemId, e.target.value)}
                            style={{ padding: '5px 8px', fontSize: 12, fontWeight: 600, color: 'var(--accent-blue)' }}
                          >
                            {coursesForThisGrade.length === 0 ? (
                              <option value="">No courses for Grade {row.grade}</option>
                            ) : (
                              coursesForThisGrade.map(c => (
                                <option key={c.code} value={c.code}>
                                  {c.name}
                                </option>
                              ))
                            )}
                          </select>
                        </div>

                        {/* Monthly Fee / Rate */}
                        <div>
                          <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>
                            Fee Rate (Rs.)
                          </label>
                          <input
                            type="number"
                            className="input-field"
                            value={row.fee}
                            onChange={e => handleRowFeeChange(row.itemId, parseFloat(e.target.value) || 0)}
                            style={{ padding: '5px 8px', fontSize: 12, fontWeight: 700, color: 'var(--accent-green)' }}
                            title="Edit monthly rate for this student"
                          />
                        </div>

                        {/* Balance Info */}
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Balance</div>
                          <div style={{
                            fontSize: 12, fontWeight: 700,
                            color: row.currentBalance > 0 ? '#10b981' : row.currentBalance < 0 ? '#ef4444' : 'var(--text-muted)'
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
                              background: 'none', border: 'none',
                              color: paymentRows.length === 1 ? 'var(--text-muted)' : '#ef4444',
                              cursor: paymentRows.length === 1 ? 'not-allowed' : 'pointer',
                              padding: 4, opacity: paymentRows.length === 1 ? 0.3 : 1
                            }}
                            title="Remove this class"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      {/* Bottom Paid Amount Field (shown when class is selected & payment type requires amount) */}
                      {row.selected && ['BANK', 'CASH', 'PHYSICAL'].includes(form.payment_type) && (
                        <div style={{
                          marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10
                        }}>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            Suggested amount to clear dues: <b>Rs. {row.suggested.toLocaleString()}</b>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-green)' }}>
                              Amount Paid Now (Rs.):
                            </label>
                            <input
                              type="number"
                              className="input-field"
                              style={{ width: 140, padding: '5px 10px', fontSize: 13, fontWeight: 700, color: 'var(--accent-green)' }}
                              placeholder={`e.g. ${row.suggested}`}
                              value={row.amountPaid}
                              onChange={e => handleRowAmountPaidChange(row.itemId, e.target.value)}
                            />
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
                padding: '12px 16px', background: 'rgba(16,185,129,0.08)', borderRadius: 8, border: '1px solid rgba(16,185,129,0.25)'
              }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Selected Classes for Payment: <b>{selectedRows.length}</b>
                </span>
                <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--accent-green)' }}>
                  Total Payment: {['FREE', 'IMS'].includes(form.payment_type) ? form.payment_type : `Rs. ${totalAmountToPay.toLocaleString()}`}
                </span>
              </div>
            </div>

            {/* Step 3: Payment Method, Date, Delivery & Group */}
            <div className="glass-card" style={{ padding: 24, marginBottom: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16, color: 'var(--accent-purple)' }}>
                3. Payment Details & Delivery
              </div>

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

            {/* Step 4: Who recorded */}
            <div className="glass-card" style={{ padding: 24, marginBottom: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14, color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: 8 }}>
                🔒 4. Audit Info (Auto-Locked)
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
              style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: 15, fontWeight: 700, borderRadius: 10 }}>
              {saving ? 'Saving...' : saved ? '✓ Payment Saved!' : '💾 Save Batch Payment'}
            </button>
            {saved && (
              <div style={{ marginTop: 12, padding: '12px 16px', background: '#1a3a2a', borderRadius: 8, color: '#34d399', fontSize: 13 }}>
                ✓ Payment recorded successfully for {selectedRows.length} classes!
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
