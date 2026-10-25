'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  BookOpen,
  Plus,
  Trash2,
  Edit2,
  Shield,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  GraduationCap,
  Layers,
  DollarSign,
  Radio,
  FileText,
  BookmarkCheck,
  UserCheck,
  CreditCard,
  Building2,
  ChevronRight,
  ChevronLeft,
  X,
  ExternalLink,
  ImageIcon
} from 'lucide-react'
import {
  DEFAULT_GRADE_COURSES,
  DEFAULT_STANDALONE_COURSES,
  DEFAULT_PAYMENT_METHODS,
  DEFAULT_BANKS,
  CourseConfig,
  BillingType,
  getAllCourseLabels,
  getAllCourseFees
} from '@/lib/courses'

export default function CoursesManagerPage() {
  const supabase = createClient()

  const [currentUserRole, setCurrentUserRole] = useState<'member' | 'admin' | 'owner'>('member')
  const [currentUserName, setCurrentUserName] = useState('')
  const [loading, setLoading] = useState(true)

  // Grade-aligned courses configuration state
  const [gradeCourses, setGradeCourses] = useState<Record<number, CourseConfig[]>>(DEFAULT_GRADE_COURSES)
  const [standaloneCourses, setStandaloneCourses] = useState<CourseConfig[]>(DEFAULT_STANDALONE_COURSES)
  const [paymentMethods, setPaymentMethods] = useState<string[]>(DEFAULT_PAYMENT_METHODS)
  const [banks, setBanks] = useState<string[]>(DEFAULT_BANKS)

  const [selectedGradeTab, setSelectedGradeTab] = useState<number | 'standalone' | 'payments'>(10)

  // Modal / Form state for Add / Edit Course
  const [showModal, setShowModal] = useState(false)
  const [showAiPanel, setShowAiPanel] = useState(false)
  const [editingCode, setEditingCode] = useState<string | null>(null)
  const [isFormStandalone, setIsFormStandalone] = useState(false)
  const [formGrade, setFormGrade] = useState<number>(10)
  const [formCode, setFormCode] = useState('')
  const [formName, setFormName] = useState('')
  const [formFee, setFormFee] = useState<string>('1800')
  const [formBillingType, setFormBillingType] = useState<BillingType>('MONTHLY')
  const [formDesc, setFormDesc] = useState('')
  const [formFlyerUrl, setFormFlyerUrl] = useState('')
  const [formGroupLink, setFormGroupLink] = useState('')
  const [saving, setSaving] = useState(false)
  const [toastMsg, setToastMsg] = useState('')

  // Payment Methods / Bank Input State
  const [newPayMethod, setNewPayMethod] = useState('')
  const [newBank, setNewBank] = useState('')

  const channelRef = useRef<any>(null)
  const isAdmin = currentUserRole === 'admin' || currentUserRole === 'owner'

  const getAdminMember = async () => {
    try {
      let { data: adminMem } = await supabase.from('members').select('id, notes').eq('name', 'Admin User').maybeSingle()
      if (!adminMem) {
        const res = await supabase.from('members').select('id, notes').eq('email', 'admin@mathsps.com').maybeSingle()
        adminMem = res.data
      }
      if (!adminMem) {
        const res = await supabase.from('members').select('id, notes').in('role', ['admin', 'owner']).limit(1).maybeSingle()
        adminMem = res.data
      }
      if (!adminMem) {
        const res = await supabase.from('members').select('id, notes').limit(1).maybeSingle()
        adminMem = res.data
      }
      return adminMem
    } catch (e) {
      return null
    }
  }

  // Load courses setup from local cache + admin user metadata
  const loadCourses = async () => {
    try {
      // 1. Check local cache first for instant load
      try {
        const cached = localStorage.getItem('MATHSPS_COURSES_CACHE')
        if (cached) {
          const c = JSON.parse(cached)
          if (c.grade_courses) setGradeCourses(c.grade_courses)
          if (c.standalone_courses) setStandaloneCourses(c.standalone_courses)
          if (c.payment_methods) setPaymentMethods(c.payment_methods)
          if (c.banks) setBanks(c.banks)
        }
      } catch {}

      // 2. Fetch latest persisted settings from server API (bypasses RLS)
      let notesObj: any = null
      try {
        const apiRes = await fetch('/api/courses')
        if (apiRes.ok) {
          const apiJson = await apiRes.json()
          if (apiJson.data?.config) {
            notesObj = apiJson.data.config
          }
        }
      } catch (apiErr) {
        console.warn('API courses fetch failed, trying direct DB...', apiErr)
      }

      if (!notesObj) {
        const adminRecord = await getAdminMember()
        if (adminRecord?.notes) {
          try {
            notesObj = JSON.parse(adminRecord.notes)
          } catch {}
        }
      }

      if (notesObj) {
        if (notesObj.grade_courses) {
          const gc: Record<number, CourseConfig[]> = { ...DEFAULT_GRADE_COURSES }
          Object.entries(notesObj.grade_courses).forEach(([grStr, list]: [string, any]) => {
            const gr = Number(grStr)
            const defaults = DEFAULT_GRADE_COURSES[gr] || []
            gc[gr] = (list as CourseConfig[]).map(dbCourse => {
              const def = defaults.find(d => d.code === dbCourse.code)
              return {
                ...def,
                ...dbCourse,
                billingType: dbCourse.billingType || def?.billingType || 'MONTHLY',
                description: dbCourse.description !== undefined ? dbCourse.description : def?.description,
                flyerUrl: dbCourse.flyerUrl !== undefined ? dbCourse.flyerUrl : def?.flyerUrl
              }
            })
          })
          setGradeCourses(gc)
        }
        if (notesObj.standalone_courses) {
          setStandaloneCourses(notesObj.standalone_courses)
        }
        if (notesObj.payment_methods && Array.isArray(notesObj.payment_methods)) {
          setPaymentMethods(notesObj.payment_methods)
        }
        if (notesObj.banks && Array.isArray(notesObj.banks)) {
          setBanks(notesObj.banks)
        }
        try {
          localStorage.setItem('MATHSPS_COURSES_CACHE', JSON.stringify(notesObj))
        } catch {}
      }
    } catch (err) {
      console.error('Failed to load courses configuration:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        let name = user.user_metadata?.full_name || user.email?.split('@')[0] || ''
        let role: 'member' | 'admin' | 'owner' = 'member'
        if (user.email) {
          const { data: dbMem } = await supabase.from('members').select('name, role').eq('email', user.email).maybeSingle()
          if (dbMem?.name) name = dbMem.name
          if (dbMem?.role) role = dbMem.role as any
        }
        setCurrentUserName(name)
        setCurrentUserRole(role)
      }
    })

    loadCourses()

    const room = supabase.channel('mathsps-global-courses-sync')
    channelRef.current = room

    room
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, () => {
        loadCourses()
      })
      .on('broadcast', { event: 'courses_updated' }, (payload: any) => {
        if (payload?.payload?.grade_courses) {
          setGradeCourses(payload.payload.grade_courses)
        }
        if (payload?.payload?.standalone_courses) {
          setStandaloneCourses(payload.payload.standalone_courses)
        }
        if (payload?.payload?.payment_methods) {
          setPaymentMethods(payload.payload.payment_methods)
        }
        if (payload?.payload?.banks) {
          setBanks(payload.payload.banks)
        }
        try {
          localStorage.setItem('MATHSPS_COURSES_CACHE', JSON.stringify(payload.payload))
        } catch {}
      })
      .subscribe()

    return () => {
      supabase.removeChannel(room)
    }
  }, [])

  async function persistCourses(
    updatedGC: Record<number, CourseConfig[]>,
    updatedStandalone: CourseConfig[],
    updatedPayMethods: string[] = paymentMethods,
    updatedBanks: string[] = banks
  ) {
    setSaving(true)
    const cacheData = {
      grade_courses: updatedGC,
      standalone_courses: updatedStandalone,
      payment_methods: updatedPayMethods,
      banks: updatedBanks
    }

    // 1. Instant local storage cache
    try {
      localStorage.setItem('MATHSPS_COURSES_CACHE', JSON.stringify(cacheData))
    } catch {}

    // 2. Real-time broadcast to all browser tabs
    if (channelRef.current) {
      try {
        channelRef.current.send({
          type: 'broadcast',
          event: 'courses_updated',
          payload: cacheData
        })
      } catch (bcErr) {
        console.warn('Realtime broadcast error:', bcErr)
      }
    }

    try {
      // 3. Server API call with service role key & session authorization
      const res = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grade_courses: updatedGC,
          standalone_courses: updatedStandalone,
          payment_methods: updatedPayMethods,
          banks: updatedBanks
        })
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `Server error (${res.status})`)
      }

      setToastMsg('✓ Changes saved & synced across CRM in real time!')
      setTimeout(() => setToastMsg(''), 3000)
    } catch (err: any) {
      console.error('Save error:', err)
      setToastMsg(`❌ Save failed on server: ${err.message || 'Unknown error'}`)
      setTimeout(() => setToastMsg(''), 5000)
    } finally {
      setSaving(false)
    }
  }

  // Payment Methods & Banks Management Handlers
  async function handleAddPaymentMethod(e: React.FormEvent) {
    e.preventDefault()
    const clean = newPayMethod.trim().toUpperCase()
    if (!clean) return
    if (paymentMethods.includes(clean)) {
      alert('This payment method already exists.')
      return
    }
    const updated = [...paymentMethods, clean]
    setPaymentMethods(updated)
    setNewPayMethod('')
    await persistCourses(gradeCourses, standaloneCourses, updated, banks)
    setToastMsg(`Payment method "${clean}" added!`)
    setTimeout(() => setToastMsg(''), 3000)
  }

  async function handleDeletePaymentMethod(method: string) {
    if (paymentMethods.length <= 1) {
      alert('At least one payment method is required.')
      return
    }
    if (!confirm(`Delete payment method "${method}"?`)) return
    const updated = paymentMethods.filter(m => m !== method)
    setPaymentMethods(updated)
    await persistCourses(gradeCourses, standaloneCourses, updated, banks)
    setToastMsg(`Payment method "${method}" removed.`)
    setTimeout(() => setToastMsg(''), 3000)
  }

  async function handleAddBank(e: React.FormEvent) {
    e.preventDefault()
    const clean = newBank.trim()
    if (!clean) return
    if (banks.some(b => b.toLowerCase() === clean.toLowerCase())) {
      alert('This bank already exists.')
      return
    }
    const updated = [...banks, clean]
    setBanks(updated)
    setNewBank('')
    await persistCourses(gradeCourses, standaloneCourses, paymentMethods, updated)
    setToastMsg(`Bank "${clean}" added!`)
    setTimeout(() => setToastMsg(''), 3000)
  }

  async function handleDeleteBank(bankName: string) {
    if (banks.length <= 1) {
      alert('At least one bank is required.')
      return
    }
    if (!confirm(`Delete bank "${bankName}"?`)) return
    const updated = banks.filter(b => b !== bankName)
    setBanks(updated)
    await persistCourses(gradeCourses, standaloneCourses, paymentMethods, updated)
    setToastMsg(`Bank "${bankName}" removed.`)
    setTimeout(() => setToastMsg(''), 3000)
  }

  function handleOpenAdd(target: number | 'standalone') {
    setEditingCode(null)
    if (target === 'standalone') {
      setIsFormStandalone(true)
      setFormGrade(10)
      setFormCode('')
      setFormName('')
      setFormFee('2500')
      setFormBillingType('ONE_TIME')
      setFormDesc('')
      setFormFlyerUrl('')
    } else {
      setIsFormStandalone(false)
      setFormGrade(target)
      setFormCode('')
      setFormName('')
      setFormFee(target >= 10 ? '1800' : '1500')
      setFormBillingType('MONTHLY')
      setFormDesc('')
      setFormFlyerUrl('')
      setFormGroupLink('')
    }
    setShowAiPanel(false)
    setShowModal(true)
  }

  function handleOpenEdit(course: CourseConfig) {
    setEditingCode(course.code)
    setIsFormStandalone(Boolean(course.isStandalone))
    setFormGrade(course.grade || 10)
    setFormCode(course.code)
    setFormName(course.name)
    setFormFee(String(course.defaultFee))
    setFormBillingType(course.billingType || (course.isStandalone ? 'ONE_TIME' : 'MONTHLY'))
    setFormDesc(course.description || '')
    setFormFlyerUrl(course.flyerUrl || '')
    setFormGroupLink((course as any).groupLink || '')
    setShowAiPanel(false)
    setShowModal(true)
  }

  async function handleSaveForm(e: React.FormEvent) {
    e.preventDefault()
    if (!formName.trim()) return

    const fee = parseFloat(formFee) || 1800
    const flyer = formFlyerUrl.trim() || undefined
    const groupL = formGroupLink.trim() || undefined

    if (isFormStandalone) {
      const code = editingCode || (formCode.trim() ? formCode.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_') : `SPEC_${Date.now().toString().slice(-5)}`)
      let updatedStandalone: CourseConfig[] = []

      if (editingCode) {
        updatedStandalone = standaloneCourses.map(c => c.code === editingCode ? {
          ...c,
          name: formName.trim(),
          defaultFee: fee,
          isStandalone: true,
          billingType: formBillingType,
          description: formDesc.trim() || undefined,
          flyerUrl: flyer,
          groupLink: groupL
        } : c)
      } else {
        updatedStandalone = [...standaloneCourses.filter(c => c.code !== code), {
          code,
          name: formName.trim(),
          defaultFee: fee,
          isStandalone: true,
          billingType: formBillingType,
          description: formDesc.trim() || undefined,
          flyerUrl: flyer,
          groupLink: groupL
        }]
      }

      setStandaloneCourses(updatedStandalone)
      setShowModal(false)
      await persistCourses(gradeCourses, updatedStandalone)
    } else {
      const code = editingCode || (formCode.trim() ? formCode.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_') : `GR${formGrade}_${Date.now().toString().slice(-4)}`)
      const currentList = gradeCourses[formGrade] || []
      let updatedList: CourseConfig[] = []

      if (editingCode) {
        updatedList = currentList.map(c => c.code === editingCode ? {
          ...c,
          name: formName.trim(),
          defaultFee: fee,
          grade: formGrade,
          billingType: formBillingType,
          description: formDesc.trim() || undefined,
          flyerUrl: flyer,
          groupLink: groupL
        } : c)
      } else {
        updatedList = [...currentList.filter(c => c.code !== code), {
          code,
          name: formName.trim(),
          defaultFee: fee,
          grade: formGrade,
          billingType: formBillingType,
          description: formDesc.trim() || undefined,
          flyerUrl: flyer,
          groupLink: groupL
        }]
      }

      const updatedGC = {
        ...gradeCourses,
        [formGrade]: updatedList
      }

      setGradeCourses(updatedGC)
      setShowModal(false)
      await persistCourses(updatedGC, standaloneCourses)
    }
  }

  async function handleDeleteCourse(course: CourseConfig) {
    if (course.isStandalone) {
      if (!confirm(`Are you sure you want to delete Standalone Course "${course.name}"?`)) return
      const updatedStandalone = standaloneCourses.filter(c => c.code !== course.code)
      setStandaloneCourses(updatedStandalone)
      await persistCourses(gradeCourses, updatedStandalone)
    } else {
      if (!confirm(`Are you sure you want to delete "${course.name}" from Grade ${course.grade}?`)) return
      const currentList = gradeCourses[course.grade || 10] || []
      const updatedList = currentList.filter(c => c.code !== course.code)
      const updatedGC = {
        ...gradeCourses,
        [course.grade || 10]: updatedList
      }
      setGradeCourses(updatedGC)
      await persistCourses(updatedGC, standaloneCourses)
    }
  }

  // Available grade tabs (5 through 13)
  const grades = [5, 6, 7, 8, 9, 10, 11, 12, 13]
  const currentTabCourses: CourseConfig[] = selectedGradeTab === 'standalone'
    ? standaloneCourses
    : typeof selectedGradeTab === 'number'
    ? (gradeCourses[selectedGradeTab] || [])
    : []

  // Total courses count across all grades + standalone
  const totalCoursesCount = Object.values(gradeCourses).reduce((sum, list) => sum + list.length, 0) + standaloneCourses.length
  const configuredGradesCount = Object.keys(gradeCourses).filter(k => (gradeCourses[Number(k)] || []).length > 0).length

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ width: 36, height: 36, border: '3px solid rgba(59,130,246,0.2)', borderTopColor: 'var(--accent-blue)', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }} />
        <div style={{ fontWeight: 600, fontSize: 15 }}>Loading course curriculum...</div>
      </div>
    )
  }

  return (
    <div className="fade-in" style={{ paddingBottom: 60 }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', boxShadow: '0 4px 12px rgba(37,99,235,0.25)'
            }}>
              <BookOpen size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
                Courses & Grades Curriculum
              </h1>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                Configure grade-aligned courses, default monthly fee rates, and registration subjects
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {isAdmin ? (
            <button
              onClick={() => handleOpenAdd(selectedGradeTab === 'payments' ? 10 : selectedGradeTab)}
              className="btn-primary"
              style={{
                background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
                padding: '9px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontWeight: 600,
                boxShadow: '0 4px 12px rgba(37,99,235,0.25)'
              }}
            >
              <Plus size={16} /> {selectedGradeTab === 'standalone' ? 'Add Course' : selectedGradeTab === 'payments' ? 'Add Grade Course' : `Add Course to Grade ${selectedGradeTab}`}
            </button>
          ) : (
            <div style={{
              fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-base)',
              padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500
            }}>
              <Shield size={14} style={{ color: 'var(--accent-blue)' }} /> View Only (Admin Protected)
            </div>
          )}
        </div>
      </div>

      <div className="page-content" style={{ width: '100%', maxWidth: '100%' }}>
        {/* Success / Realtime Toast */}
        {toastMsg && (
          <div style={{
            padding: '14px 18px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
            borderRadius: 10, color: '#059669', fontWeight: 600, fontSize: 13, marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 2px 8px rgba(16,185,129,0.08)'
          }}>
            <CheckCircle2 size={18} /> {toastMsg}
          </div>
        )}

        {/* Top KPI Summary Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 22 }}>
          {/* Total Active Courses */}
          <div className="stat-card" style={{
            padding: '16px 20px',
            borderRadius: 16,
            borderLeft: '4px solid #38bdf8',
            boxShadow: '0 4px 20px -4px rgba(56, 189, 248, 0.16)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Total Active Courses
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
                {totalCoursesCount} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>streams</span>
              </div>
            </div>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(56, 189, 248, 0.15)', color: 'var(--accent-blue)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Layers size={20} />
            </div>
          </div>

          {/* Configured Grades */}
          <div className="stat-card" style={{
            padding: '16px 20px',
            borderRadius: 16,
            borderLeft: '4px solid #4ade80',
            boxShadow: '0 4px 20px -4px rgba(74, 222, 128, 0.16)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Configured Grades
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
                {configuredGradesCount} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>of {grades.length} grades</span>
              </div>
            </div>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(16, 185, 129, 0.15)', color: '#10b981',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <GraduationCap size={20} />
            </div>
          </div>

          {/* Total Fee Streams / Currency */}
          <div className="stat-card" style={{
            padding: '16px 20px',
            borderRadius: 16,
            borderLeft: '4px solid #f97316',
            boxShadow: '0 4px 20px -4px rgba(249, 115, 22, 0.16)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Tuition Fee Streams
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
                {paymentMethods.length} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>payment methods</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{banks.length} bank deposit channels configured</div>
            </div>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(249, 115, 22, 0.15)', color: '#ea580c',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <CreditCard size={19} />
            </div>
          </div>
        </div>

        {/* Grade & Standalone Tabs Navigation */}
        <div style={{
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          padding: '6px 8px',
          marginBottom: 20,
          background: 'var(--bg-card)',
          borderRadius: 12,
          border: '1px solid var(--border)'
        }}>
          {/* Standalone Courses Tab */}
          <button
            onClick={() => setSelectedGradeTab('standalone')}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              boxSizing: 'border-box',
              border: selectedGradeTab === 'standalone' ? '1px solid var(--accent-blue)' : '1px solid transparent',
              background: selectedGradeTab === 'standalone' ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
              color: selectedGradeTab === 'standalone' ? 'var(--accent-blue)' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              whiteSpace: 'nowrap',
              transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease'
            }}
          >
            <BookOpen size={15} />
            <span>Courses</span>
            <span style={{
              fontSize: 11,
              padding: '2px 7px',
              borderRadius: 10,
              boxSizing: 'border-box',
              background: selectedGradeTab === 'standalone' ? 'var(--accent-blue)' : 'var(--bg-card-hover)',
              color: selectedGradeTab === 'standalone' ? '#fff' : 'var(--text-muted)',
              border: '1px solid ' + (selectedGradeTab === 'standalone' ? 'var(--accent-blue)' : 'var(--border)'),
              fontWeight: 600
            }}>
              {standaloneCourses.length}
            </span>
          </button>

          <div style={{ width: 1, height: 22, background: 'var(--border)', margin: 'auto 4px' }} />

          {grades.map(g => {
            const count = (gradeCourses[g] || []).length
            const isSelected = selectedGradeTab === g

            return (
              <button
                key={g}
                onClick={() => setSelectedGradeTab(g)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  boxSizing: 'border-box',
                  border: isSelected ? '1px solid var(--accent-blue)' : '1px solid transparent',
                  background: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                  color: isSelected ? 'var(--accent-blue)' : 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  whiteSpace: 'nowrap',
                  transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease'
                }}
              >
                <span>Grade {g}</span>
                <span style={{
                  fontSize: 11,
                  padding: '2px 7px',
                  borderRadius: 10,
                  boxSizing: 'border-box',
                  background: isSelected ? 'var(--accent-blue)' : 'var(--bg-card-hover)',
                  color: isSelected ? '#fff' : 'var(--text-muted)',
                  border: '1px solid ' + (isSelected ? 'var(--accent-blue)' : 'var(--border)'),
                  fontWeight: 600
                }}>
                  {count}
                </span>
              </button>
            )
          })}

          <div style={{ width: 1, height: 22, background: 'var(--border)', margin: 'auto 4px' }} />

          {/* Payment Methods & Banks Tab */}
          <button
            onClick={() => setSelectedGradeTab('payments')}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              boxSizing: 'border-box',
              border: selectedGradeTab === 'payments' ? '1px solid var(--accent-blue)' : '1px solid transparent',
              background: selectedGradeTab === 'payments' ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
              color: selectedGradeTab === 'payments' ? 'var(--accent-blue)' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              whiteSpace: 'nowrap',
              transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease'
            }}
          >
            <CreditCard size={15} />
            <span>Payment Methods & Banks</span>
            <span style={{
              fontSize: 11,
              padding: '2px 7px',
              borderRadius: 10,
              boxSizing: 'border-box',
              background: selectedGradeTab === 'payments' ? 'var(--accent-blue)' : 'var(--bg-card-hover)',
              color: selectedGradeTab === 'payments' ? '#fff' : 'var(--text-muted)',
              border: '1px solid ' + (selectedGradeTab === 'payments' ? 'var(--accent-blue)' : 'var(--border)'),
              fontWeight: 600
            }}>
              {paymentMethods.length + banks.length}
            </span>
          </button>
        </div>

        {/* Payment Methods & Banks Manager View */}
        {selectedGradeTab === 'payments' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20, marginBottom: 24 }}>
            {/* Payment Methods Card */}
            <div style={{
              padding: 24,
              background: 'var(--bg-card)',
              borderRadius: 12,
              border: '1px solid var(--border)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CreditCard size={18} style={{ color: 'var(--accent-blue)' }} />
                    Payment Methods
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    Accepted methods in Student Registration &amp; Add Payment forms
                  </div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-card-hover)', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)' }}>
                  {paymentMethods.length} methods
                </span>
              </div>

              {/* Add Payment Method Input */}
              {isAdmin && (
                <form onSubmit={handleAddPaymentMethod} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <input
                    className="input-field"
                    placeholder="e.g. KOKO, MINTPAY, SIPSA"
                    value={newPayMethod}
                    onChange={e => setNewPayMethod(e.target.value)}
                    style={{ flex: 1, textTransform: 'uppercase', fontWeight: 600, fontSize: 13 }}
                  />
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={saving || !newPayMethod.trim()}
                    style={{ padding: '7px 14px', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <Plus size={14} /> Add
                  </button>
                </form>
              )}

              {/* Payment Methods List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {paymentMethods.map(pm => (
                  <div
                    key={pm}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: 'var(--bg-card-hover)',
                      borderRadius: 8,
                      border: '1px solid var(--border)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: 'rgba(56, 189, 248, 0.15)',
                        color: 'var(--accent-blue)',
                        border: '1px solid rgba(56, 189, 248, 0.3)'
                      }}>
                        {pm}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {pm === 'BANK' ? 'Bank Deposit / Slip Upload' : pm === 'CASH' ? 'Cash Collection' : pm === 'FREE' ? 'Free / Scholarship Access' : pm === 'IMS' ? 'IMS Portal Payment' : pm === 'PHYSICAL' ? 'Physical Class Collection' : `${pm} Payment`}
                      </span>
                    </div>

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleDeletePaymentMethod(pm)}
                        disabled={saving || paymentMethods.length <= 1}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: paymentMethods.length <= 1 ? 'var(--text-muted)' : '#ef4444',
                          cursor: paymentMethods.length <= 1 ? 'not-allowed' : 'pointer',
                          padding: 4,
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        title="Delete method"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Banks Card */}
            <div style={{
              padding: 24,
              background: 'var(--bg-card)',
              borderRadius: 12,
              border: '1px solid var(--border)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Building2 size={18} style={{ color: '#10b981' }} />
                    Deposit Banks
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    Bank options available for bank transfer &amp; slip verification
                  </div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-card-hover)', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)' }}>
                  {banks.length} banks
                </span>
              </div>

              {/* Add Bank Input */}
              {isAdmin && (
                <form onSubmit={handleAddBank} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <input
                    className="input-field"
                    placeholder="e.g. NDB, DFCC, Union Bank"
                    value={newBank}
                    onChange={e => setNewBank(e.target.value)}
                    style={{ flex: 1, fontWeight: 600, fontSize: 13 }}
                  />
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={saving || !newBank.trim()}
                    style={{ padding: '7px 14px', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <Plus size={14} /> Add
                  </button>
                </form>
              )}

              {/* Banks List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {banks.map(b => (
                  <div
                    key={b}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: 'var(--bg-card-hover)',
                      borderRadius: 8,
                      border: '1px solid var(--border)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: '#10b981',
                        border: '1px solid rgba(16, 185, 129, 0.3)'
                      }}>
                        BANK
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {b}
                      </span>
                    </div>

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleDeleteBank(b)}
                        disabled={saving || banks.length <= 1}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: banks.length <= 1 ? 'var(--text-muted)' : '#ef4444',
                          cursor: banks.length <= 1 ? 'not-allowed' : 'pointer',
                          padding: 4,
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        title="Delete bank"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
        /* Grade / Standalone Courses Cards Section */
        <div style={{
          padding: 24,
          background: 'var(--bg-card)',
          borderRadius: 12,
          border: '1px solid var(--border)',
          marginBottom: 24,
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>
                  {selectedGradeTab === 'standalone'
                    ? 'Courses'
                    : `Grade ${selectedGradeTab} Courses`}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-card-hover)', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)' }}>
                  {currentTabCourses.length} {currentTabCourses.length === 1 ? 'course' : 'courses'}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                {selectedGradeTab === 'standalone'
                  ? 'Courses that can be enrolled independently or bundled with grade classes.'
                  : `Curriculum streams configured for Grade ${selectedGradeTab}.`}
              </div>
            </div>

            {isAdmin && (
              <button
                onClick={() => handleOpenAdd(selectedGradeTab)}
                className="btn-secondary"
                style={{ padding: '7px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
              >
                <Plus size={14} /> {selectedGradeTab === 'standalone' ? 'Add Course' : `Add Course to Grade ${selectedGradeTab}`}
              </button>
            )}
          </div>

          {currentTabCourses.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', background: 'var(--bg-base)', borderRadius: 10, border: '1px dashed var(--border)' }}>
              <div style={{
                width: 52, height: 52, borderRadius: 26, background: 'rgba(59,130,246,0.1)',
                color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 14px'
              }}>
                <BookmarkCheck size={26} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                {selectedGradeTab === 'standalone'
                  ? 'No courses configured yet'
                  : `No courses configured for Grade ${selectedGradeTab}`}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18, maxWidth: 420, margin: '4px auto 18px' }}>
                {selectedGradeTab === 'standalone'
                  ? 'Click Add Course to create standalone subjects like Geometry Full Course or BODMAS.'
                  : 'Add Theory, Paper, Revision, or custom bundle courses for this grade.'}
              </div>
              {isAdmin && (
                <button
                  onClick={() => handleOpenAdd(selectedGradeTab)}
                  className="btn-primary"
                  style={{ padding: '8px 18px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Plus size={15} /> Add Course
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 16 }}>
              {currentTabCourses.map((c: CourseConfig) => {
                const isCombo = c.name.toLowerCase().includes('both') || c.name.toLowerCase().includes('full package') || c.name.toLowerCase().includes('+')
                const isPaper = c.name.toLowerCase().includes('paper') && !isCombo
                const isRevision = c.name.toLowerCase().includes('revision') && !isCombo
                const isStandalone = Boolean(c.isStandalone)

                const cardBorderColor = isStandalone ? 'var(--accent-blue)' : isCombo ? '#f59e0b' : isPaper ? '#818cf8' : isRevision ? '#c084fc' : '#10b981'

                return (
                  <div
                    key={c.code}
                    className="stat-card"
                    style={{
                      padding: 18,
                      borderRadius: 14,
                      border: '1px solid var(--border)',
                      borderTop: `3px solid ${cardBorderColor}`,
                      background: 'var(--bg-card)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 14,
                      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div>
                      {/* Top Header: Name + Code */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                          {c.name}
                        </div>
                        <span style={{
                          fontSize: 10,
                          color: 'var(--accent-blue)',
                          background: 'rgba(56, 189, 248, 0.12)',
                          border: '1px solid rgba(56, 189, 248, 0.25)',
                          padding: '2px 7px',
                          borderRadius: 6,
                          fontWeight: 700,
                          whiteSpace: 'nowrap'
                        }}>
                          {c.code}
                        </span>
                      </div>

                      {/* Course Type & Billing Badge */}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 6,
                          background: isStandalone ? 'rgba(59, 130, 246, 0.12)' : isCombo ? 'rgba(245, 158, 11, 0.15)' : isPaper ? 'rgba(99, 102, 241, 0.15)' : isRevision ? 'rgba(192, 132, 252, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          color: isStandalone ? 'var(--accent-blue)' : isCombo ? '#f59e0b' : isPaper ? '#818cf8' : isRevision ? '#c084fc' : '#10b981',
                          border: `1px solid ${isStandalone ? 'rgba(59, 130, 246, 0.25)' : isCombo ? 'rgba(245, 158, 11, 0.3)' : isPaper ? 'rgba(99, 102, 241, 0.3)' : isRevision ? 'rgba(192, 132, 252, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
                        }}>
                          {isStandalone ? 'COURSE' : isCombo ? 'COMBO BUNDLE' : isPaper ? 'PAPER CLASS' : isRevision ? 'REVISION' : 'THEORY'}
                        </span>

                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 6,
                          background: c.billingType === 'ONE_TIME' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(56, 189, 248, 0.12)',
                          color: c.billingType === 'ONE_TIME' ? '#10b981' : 'var(--accent-blue)',
                          border: `1px solid ${c.billingType === 'ONE_TIME' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(56, 189, 248, 0.25)'}`
                        }}>
                          {c.billingType === 'ONE_TIME' ? 'ONE-TIME' : 'MONTHLY'}
                        </span>
                      </div>

                      {c.flyerUrl && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          marginBottom: 10,
                          padding: '6px 10px',
                          borderRadius: 8,
                          background: 'rgba(59, 130, 246, 0.08)',
                          border: '1px solid rgba(59, 130, 246, 0.2)'
                        }}>
                          <img
                            src={c.flyerUrl}
                            alt={c.name}
                            style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover' }}
                            onError={(e: any) => { e.target.style.display = 'none' }}
                          />
                          <div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-blue)', display: 'block' }}>
                              🖼️ Post Attached
                            </span>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                              WhatsApp auto-dispatch ready
                            </span>
                          </div>
                        </div>
                      )}

                      {c.description && (
                        <div style={{
                          fontSize: 12,
                          color: 'var(--text-secondary)',
                          lineHeight: 1.5,
                          marginBottom: 12,
                          whiteSpace: 'pre-line',
                          background: 'var(--bg-base)',
                          padding: '8px 10px',
                          borderRadius: 8,
                          border: '1px solid var(--border)'
                        }}>
                          {c.description}
                        </div>
                      )}

                      {/* Default Fee */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'var(--bg-card-hover)',
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: '1px solid var(--border)'
                      }}>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
                          {c.billingType === 'ONE_TIME' ? 'Full Course Fee:' : 'Monthly Tuition:'}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Rs.</span>
                          <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)' }}>
                            {c.defaultFee.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {isAdmin && (
                      <div style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: 8,
                        borderTop: '1px solid var(--border)',
                        paddingTop: 12
                      }}>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(c)}
                          className="btn-secondary"
                          style={{ padding: '5px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5, fontWeight: 500 }}
                        >
                          <Edit2 size={13} /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCourse(c)}
                          style={{
                            background: 'rgba(239,68,68,0.12)',
                            border: '1px solid rgba(239,68,68,0.25)',
                            color: '#ef4444',
                            borderRadius: 6,
                            padding: '5px 12px',
                            fontSize: 12,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            fontWeight: 500
                          }}
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

        {/* Global Summary & Quick Access */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          <div style={{
            padding: 20,
            background: 'var(--bg-card)',
            borderRadius: 12,
            border: '1px solid var(--border)'
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              CURRICULUM ARCHITECTURE
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
              {totalCoursesCount} Active Course Streams ({standaloneCourses.length} Courses)
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>
              Configured across Grades 5 through 13 and standalone courses. Fee structure auto-populates in student registrations and payment receipts.
            </div>
          </div>

          <div style={{
            padding: 20,
            background: 'var(--bg-card)',
            borderRadius: 12,
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                QUICK NAVIGATION
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Test student registration or record student fee payments with configured subjects:
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
              <a
                href="/students/new"
                className="btn-secondary"
                style={{ fontSize: 12, padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', fontWeight: 600 }}
              >
                <UserCheck size={14} /> Register Student →
              </a>
              <a
                href="/payments/add"
                className="btn-secondary"
                style={{ fontSize: 12, padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', fontWeight: 600 }}
              >
                <CreditCard size={14} /> Record Payment →
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Add / Edit Course Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: 16,
          backdropFilter: 'blur(5px)'
        }}>
          <div style={{
            maxWidth: showAiPanel ? 880 : 500,
            width: '100%',
            maxHeight: 'calc(100vh - 100px)',
            background: 'var(--bg-card)',
            borderRadius: 18,
            border: '1px solid var(--border)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
            display: 'flex',
            flexDirection: 'column',
            transition: 'max-width 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 22px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10, background: 'rgba(59,130,246,0.12)',
                  color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  <BookOpen size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
                    {editingCode
                      ? (isFormStandalone ? 'Edit Course' : `Edit Course Stream`)
                      : (isFormStandalone ? 'Add New Course' : `Add New Course to Grade ${formGrade}`)}
                  </h3>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {showAiPanel ? 'Curriculum parameters & dynamic AI agent knowledge' : 'Set course title, payment type, and default tuition fee'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowAiPanel(!showAiPanel)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                    background: showAiPanel ? 'rgba(59,130,246,0.15)' : 'var(--bg-base)',
                    color: showAiPanel ? 'var(--accent-blue)' : 'var(--text-secondary)',
                    border: '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.15s'
                  }}
                  title={showAiPanel ? 'Collapse to simple width' : 'Expand width for AI notes & marketing post'}
                >
                  <Sparkles size={13} style={{ color: 'var(--accent-blue)' }} />
                  <span>{showAiPanel ? 'Simple View' : 'AI Notes & Flyer'}</span>
                  {showAiPanel ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
                </button>

                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', padding: 6, borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}
                  title="Close modal"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSaveForm} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>
                <div style={{
                  display: showAiPanel ? 'grid' : 'block',
                  gridTemplateColumns: showAiPanel ? '1.05fr 1fr' : undefined,
                  gap: showAiPanel ? 20 : undefined,
                  alignItems: 'start'
                }}>
                  {/* Left Column / Core Settings */}
                  <div>
                    {/* Course Category */}
                    <div style={{ marginBottom: 13 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                        Course Category
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <button
                          type="button"
                          disabled={!!editingCode}
                          onClick={() => setIsFormStandalone(false)}
                          style={{
                            padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                            border: !isFormStandalone ? '1.5px solid var(--accent-blue)' : '1px solid var(--border)',
                            background: !isFormStandalone ? 'rgba(56, 189, 248, 0.15)' : 'var(--bg-card)',
                            color: !isFormStandalone ? 'var(--accent-blue)' : 'var(--text-secondary)'
                          }}
                        >
                          Grade Class
                        </button>
                        <button
                          type="button"
                          disabled={!!editingCode}
                          onClick={() => setIsFormStandalone(true)}
                          style={{
                            padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                            border: isFormStandalone ? '1.5px solid var(--accent-blue)' : '1px solid var(--border)',
                            background: isFormStandalone ? 'rgba(56, 189, 248, 0.15)' : 'var(--bg-card)',
                            color: isFormStandalone ? 'var(--accent-blue)' : 'var(--text-secondary)'
                          }}
                        >
                          Course
                        </button>
                      </div>
                    </div>

                    {!isFormStandalone && (
                      <div style={{ marginBottom: 13 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                          Target Grade
                        </label>
                        <select
                          className="input-field"
                          value={formGrade}
                          onChange={e => setFormGrade(parseInt(e.target.value))}
                          disabled={!!editingCode}
                          style={{ width: '100%', fontWeight: 600, padding: '7px 10px' }}
                        >
                          {grades.map(g => (
                            <option key={g} value={g}>Grade {g}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div style={{ marginBottom: 13 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                        Course Title <span style={{ color: 'var(--accent-red)' }}>*</span>
                      </label>
                      <input
                        className="input-field"
                        style={{ width: '100%', padding: '7px 10px' }}
                        placeholder={isFormStandalone ? "e.g. Geometry Full Course (ජ්‍යාමිතිය)" : "e.g. Grade 10 — Theory"}
                        value={formName}
                        onChange={e => setFormName(e.target.value)}
                        autoFocus
                        required
                      />
                    </div>

                    {/* Billing / Payment Type */}
                    <div style={{ marginBottom: 13 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                        Billing Type
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => setFormBillingType('ONE_TIME')}
                          style={{
                            padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                            border: formBillingType === 'ONE_TIME' ? '1.5px solid #10b981' : '1px solid var(--border)',
                            background: formBillingType === 'ONE_TIME' ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-card)',
                            color: formBillingType === 'ONE_TIME' ? '#10b981' : 'var(--text-secondary)'
                          }}
                        >
                          One-Time Fee
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormBillingType('MONTHLY')}
                          style={{
                            padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                            border: formBillingType === 'MONTHLY' ? '1.5px solid var(--accent-blue)' : '1px solid var(--border)',
                            background: formBillingType === 'MONTHLY' ? 'rgba(56, 189, 248, 0.15)' : 'var(--bg-card)',
                            color: formBillingType === 'MONTHLY' ? 'var(--accent-blue)' : 'var(--text-secondary)'
                          }}
                        >
                          Monthly Recurring
                        </button>
                      </div>
                    </div>

                    <div style={{ marginBottom: 13 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                        {formBillingType === 'ONE_TIME' ? 'One-Time Course Fee (Rs.)' : 'Default Monthly Fee (Rs.)'} <span style={{ color: 'var(--accent-red)' }}>*</span>
                      </label>
                      <input
                        type="number"
                        className="input-field"
                        style={{ width: '100%', fontWeight: 700, fontSize: 14, padding: '7px 10px' }}
                        placeholder="2500"
                        value={formFee}
                        onChange={e => setFormFee(e.target.value)}
                        required
                      />
                      {/* Fee Quick Presets */}
                      <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
                        {['1500', '1800', '2000', '2500', '3000', '3500'].map(f => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => setFormFee(f)}
                            style={{
                              padding: '2px 7px', borderRadius: 5, fontSize: 11, fontWeight: 600,
                              background: formFee === f ? 'var(--accent-blue)' : 'var(--bg-base)',
                              color: formFee === f ? '#fff' : 'var(--text-secondary)',
                              border: '1px solid var(--border)', cursor: 'pointer'
                            }}
                          >
                            Rs. {f}
                          </button>
                        ))}
                      </div>
                    </div>

                    {!editingCode && (
                      <div style={{ marginBottom: 13 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                          Custom Identifier Code (Optional)
                        </label>
                        <input
                          className="input-field"
                          style={{ width: '100%', padding: '7px 10px' }}
                          placeholder={isFormStandalone ? "e.g. GEOMETRY_FULL" : `e.g. GR${formGrade}_THEORY`}
                          value={formCode}
                          onChange={e => setFormCode(e.target.value)}
                        />
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                          Leave blank to automatically generate unique code.
                        </div>
                      </div>
                    )}

                    {/* Quick Expand AI Panel Banner when closed */}
                    {!showAiPanel && (
                      <div
                        onClick={() => setShowAiPanel(true)}
                        style={{
                          marginTop: 10,
                          padding: '11px 14px',
                          borderRadius: 10,
                          background: 'rgba(59, 130, 246, 0.06)',
                          border: '1.5px dashed rgba(59, 130, 246, 0.35)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: 8,
                            background: 'rgba(59,130,246,0.15)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'var(--accent-blue)', flexShrink: 0
                          }}>
                            <Sparkles size={16} />
                          </div>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                              AI Knowledge Notes & Promotional Flyer
                              {(formDesc || formFlyerUrl) && (
                                <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'rgba(16,185,129,0.15)', color: '#10b981', fontWeight: 700 }}>
                                  Configured
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              Click right arrow to expand & set physical/online schedule & flyer
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, color: 'var(--accent-blue)', whiteSpace: 'nowrap' }}>
                          <span>Expand</span>
                          <ChevronRight size={15} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column: AI Knowledge & Marketing Post Panel (Visible when showAiPanel is true) */}
                  {showAiPanel && (
                    <div style={{
                      background: 'var(--bg-base)',
                      border: '1px solid var(--border)',
                      borderRadius: 14,
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Sparkles size={14} style={{ color: 'var(--accent-blue)' }} />
                            AI Knowledge & Marketing Post
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                            AI Agent uses these details when talking with parents
                          </div>
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--accent-blue)', fontWeight: 600, background: 'rgba(59,130,246,0.1)', padding: '2px 6px', borderRadius: 4 }}>
                          🤖 AI Reads This
                        </span>
                      </div>

                      {/* Course Schedule & Knowledge Notes */}
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                          Class Schedule & Knowledge Notes
                        </label>
                        <textarea
                          className="input-field"
                          rows={5}
                          style={{ width: '100%', fontFamily: 'inherit', fontSize: 11.5, lineHeight: 1.5, resize: 'vertical', padding: '8px 10px' }}
                          placeholder={`e.g.:
- Physical: MathsPS Kandy Hall (සෙනසුරාදා උදෑසන 8.00 - 10.30)
- Online: සෙනසුරාදා සවස 3.00 - 5.30 Zoom Live + LMS Recordings
- Notes: ජ්‍යාමිතිය ප්‍රමේය 20 ම සාකච්ඡා කෙරේ. Tute Speed Post මඟින් නිවසටම ලැබේ.`}
                          value={formDesc}
                          onChange={e => setFormDesc(e.target.value)}
                        />
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                          Include physical & online times, venue, and special notes for AI voice/chat.
                        </div>
                      </div>

                      {/* Promotional Flyer Image Link */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                            Promotional Flyer / Post Link
                          </label>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                            Auto-sent on WhatsApp
                          </span>
                        </div>
                        <input
                          className="input-field"
                          style={{ width: '100%', fontSize: 11.5, padding: '7px 10px' }}
                          placeholder="e.g. https://images.unsplash.com/... or flyer image link"
                          value={formFlyerUrl}
                          onChange={e => setFormFlyerUrl(e.target.value)}
                        />

                        {/* Small Image Preview */}
                        {formFlyerUrl ? (
                          <div style={{
                            marginTop: 8,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: 8,
                            background: 'var(--bg-card)',
                            borderRadius: 8,
                            border: '1px solid var(--border)'
                          }}>
                            <img
                              src={formFlyerUrl}
                              alt="Flyer Preview"
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: 6,
                                objectFit: 'cover',
                                border: '1px solid var(--border)',
                                flexShrink: 0
                              }}
                              onError={(e: any) => { e.target.style.display = 'none' }}
                            />
                            <div style={{ flex: 1, minWidth: 0, fontSize: 11 }}>
                              <div style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <CheckCircle2 size={12} style={{ color: '#10b981' }} />
                                Flyer Preview Loaded
                              </div>
                              <div style={{ color: 'var(--text-muted)', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {formFlyerUrl}
                              </div>
                              <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
                                <a
                                  href={formFlyerUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10 }}
                                >
                                  View Full <ExternalLink size={10} />
                                </a>
                                <button
                                  type="button"
                                  onClick={() => setFormFlyerUrl('')}
                                  style={{ background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', padding: 0, fontWeight: 600, fontSize: 10 }}
                                >
                                  Clear
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div style={{
                            marginTop: 8,
                            padding: '8px 10px',
                            background: 'var(--bg-card)',
                            borderRadius: 8,
                            border: '1px dashed var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            color: 'var(--text-muted)',
                            fontSize: 10.5
                          }}>
                            <ImageIcon size={16} style={{ opacity: 0.6, flexShrink: 0 }} />
                            <div>Paste an image URL above to see a preview thumbnail & auto-send to parents on WhatsApp.</div>
                          </div>
                        )}
                      </div>

                      {/* WhatsApp Group Link */}
                      <div style={{ marginTop: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                            Official WhatsApp Group Link
                          </label>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                            Auto-sent to joining students
                          </span>
                        </div>
                        <input
                          className="input-field"
                          style={{ width: '100%', fontSize: 11.5, padding: '7px 10px' }}
                          placeholder="e.g. https://chat.whatsapp.com/G2397Wv6uK7..."
                          value={formGroupLink}
                          onChange={e => setFormGroupLink(e.target.value)}
                        />
                        {formGroupLink ? (
                          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                            <CheckCircle2 size={12} style={{ color: '#10b981' }} />
                            <a
                              href={formGroupLink}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11 }}
                            >
                              Test Group Link <ExternalLink size={10} />
                            </a>
                          </div>
                        ) : (
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                            AI will send this WhatsApp invitation link whenever a parent or student asks how to join.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 22px', borderTop: '1px solid var(--border)', background: 'var(--bg-card)'
              }}>
                <div>
                  {!showAiPanel ? (
                    <button
                      type="button"
                      onClick={() => setShowAiPanel(true)}
                      style={{
                        background: 'none', border: 'none', color: 'var(--accent-blue)',
                        fontSize: 11.5, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: 0
                      }}
                    >
                      <Sparkles size={13} /> AI Notes & Flyer <ChevronRight size={13} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowAiPanel(false)}
                      style={{
                        background: 'none', border: 'none', color: 'var(--text-secondary)',
                        fontSize: 11.5, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: 0
                      }}
                    >
                      <ChevronLeft size={13} /> Simple View
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="btn-secondary"
                    style={{ padding: '7px 14px', fontWeight: 600, fontSize: 12 }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    style={{ padding: '7px 18px', fontWeight: 700, fontSize: 12, background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)' }}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : editingCode ? 'Save Changes' : '+ Create Course'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
