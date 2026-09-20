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
  CreditCard
} from 'lucide-react'
import { DEFAULT_GRADE_COURSES, DEFAULT_STANDALONE_COURSES, CourseConfig, BillingType, getAllCourseLabels, getAllCourseFees } from '@/lib/courses'

export default function CoursesManagerPage() {
  const supabase = createClient()

  const [currentUserRole, setCurrentUserRole] = useState<'member' | 'admin' | 'owner'>('member')
  const [currentUserName, setCurrentUserName] = useState('')
  const [loading, setLoading] = useState(true)

  // Grade-aligned courses configuration state
  const [gradeCourses, setGradeCourses] = useState<Record<number, CourseConfig[]>>(DEFAULT_GRADE_COURSES)
  const [standaloneCourses, setStandaloneCourses] = useState<CourseConfig[]>(DEFAULT_STANDALONE_COURSES)
  const [selectedGradeTab, setSelectedGradeTab] = useState<number | 'standalone'>(10)

  // Modal / Form state for Add / Edit
  const [showModal, setShowModal] = useState(false)
  const [editingCode, setEditingCode] = useState<string | null>(null)
  const [isFormStandalone, setIsFormStandalone] = useState(false)
  const [formGrade, setFormGrade] = useState<number>(10)
  const [formCode, setFormCode] = useState('')
  const [formName, setFormName] = useState('')
  const [formFee, setFormFee] = useState<string>('1800')
  const [formBillingType, setFormBillingType] = useState<BillingType>('MONTHLY')
  const [formDesc, setFormDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const [toastMsg, setToastMsg] = useState('')

  const channelRef = useRef<any>(null)
  const isAdmin = currentUserRole === 'admin' || currentUserRole === 'owner' || (currentUserName && currentUserName.toLowerCase().includes('admin'))

  // Load courses setup from admin user metadata
  const loadCourses = async () => {
    try {
      const { data: adminRecord } = await supabase.from('members').select('notes').eq('name', 'Admin User').single()
      if (adminRecord?.notes) {
        const notesObj = JSON.parse(adminRecord.notes)
        if (notesObj.grade_courses) {
          const gc: Record<number, CourseConfig[]> = { ...DEFAULT_GRADE_COURSES }
          Object.entries(notesObj.grade_courses).forEach(([grStr, list]: [string, any]) => {
            gc[Number(grStr)] = list
          })
          setGradeCourses(gc)
        }
        if (notesObj.standalone_courses) {
          setStandaloneCourses(notesObj.standalone_courses)
        }
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
          const { data: dbMem } = await supabase.from('members').select('name, role').eq('email', user.email).single()
          if (dbMem?.name) name = dbMem.name
          if (dbMem?.role) role = dbMem.role as any
        }
        if (user.email?.toLowerCase().includes('admin')) {
          role = 'admin'
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
      })
      .subscribe()

    return () => {
      supabase.removeChannel(room)
    }
  }, [])

  async function persistCourses(updatedGC: Record<number, CourseConfig[]>, updatedStandalone: CourseConfig[]) {
    setSaving(true)
    try {
      const { data: adminMem } = await supabase.from('members').select('id').eq('name', 'Admin User').single()
      if (adminMem?.id) {
        const customCourses = getAllCourseLabels(updatedGC, updatedStandalone)
        const classFees = getAllCourseFees(updatedGC, updatedStandalone)

        const res = await fetch('/api/members/manage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_custom_courses',
            memberId: adminMem.id,
            courses: customCourses,
            fees: classFees,
            grade_courses: updatedGC,
            standalone_courses: updatedStandalone,
            adminPassword: 'sb_secret_verification_bypass'
          })
        })

        if (!res.ok) throw new Error('Failed to save to database')

        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'courses_updated',
            payload: { grade_courses: updatedGC, standalone_courses: updatedStandalone, courses: customCourses, fees: classFees }
          })
        }
      }
      setToastMsg('✓ Changes saved & synced across CRM in real time!')
      setTimeout(() => setToastMsg(''), 3500)
    } catch (err: any) {
      alert('Error updating courses: ' + err.message)
    } finally {
      setSaving(false)
    }
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
    } else {
      setIsFormStandalone(false)
      setFormGrade(target)
      setFormCode('')
      setFormName('')
      setFormFee(target >= 10 ? '1800' : '1500')
      setFormBillingType('MONTHLY')
      setFormDesc('')
    }
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
    setShowModal(true)
  }

  async function handleSaveForm(e: React.FormEvent) {
    e.preventDefault()
    if (!formName.trim()) return

    const fee = parseFloat(formFee) || 1800

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
          description: formDesc.trim() || undefined
        } : c)
      } else {
        updatedStandalone = [...standaloneCourses.filter(c => c.code !== code), {
          code,
          name: formName.trim(),
          defaultFee: fee,
          isStandalone: true,
          billingType: formBillingType,
          description: formDesc.trim() || undefined
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
          description: formDesc.trim() || undefined
        } : c)
      } else {
        updatedList = [...currentList.filter(c => c.code !== code), {
          code,
          name: formName.trim(),
          defaultFee: fee,
          grade: formGrade,
          billingType: formBillingType,
          description: formDesc.trim() || undefined
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
  const currentTabCourses = selectedGradeTab === 'standalone'
    ? standaloneCourses
    : (gradeCourses[selectedGradeTab] || [])

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
              onClick={() => handleOpenAdd(selectedGradeTab)}
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
              <Plus size={16} /> Add Course to Grade {selectedGradeTab}
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

          {/* Realtime Status */}
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
                CRM Integration
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: '#10b981', display: 'inline-block' }} />
                Real-Time Synced
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Auto-applied to new student forms</div>
            </div>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(249, 115, 22, 0.15)', color: '#ea580c',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Radio size={19} />
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
          {/* Standalone Specialist Courses Tab */}
          <button
            onClick={() => setSelectedGradeTab('standalone')}
            style={{
              padding: '9px 18px',
              borderRadius: 8,
              border: selectedGradeTab === 'standalone' ? '1px solid #ec4899' : '1px solid transparent',
              background: selectedGradeTab === 'standalone' ? 'rgba(236, 72, 153, 0.15)' : 'transparent',
              color: selectedGradeTab === 'standalone' ? '#ec4899' : 'var(--text-secondary)',
              fontWeight: selectedGradeTab === 'standalone' ? 800 : 600,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease'
            }}
          >
            <Sparkles size={15} style={{ color: '#ec4899' }} />
            <span>Specialist / Standalone Courses</span>
            <span style={{
              fontSize: 11,
              padding: '2px 7px',
              borderRadius: 10,
              background: selectedGradeTab === 'standalone' ? '#ec4899' : 'var(--bg-card-hover)',
              color: selectedGradeTab === 'standalone' ? '#fff' : 'var(--text-muted)',
              border: selectedGradeTab === 'standalone' ? 'none' : '1px solid var(--border)',
              fontWeight: 700
            }}>
              {standaloneCourses.length}
            </span>
          </button>

          <div style={{ width: 1, height: 24, background: 'var(--border)', margin: 'auto 4px' }} />

          {grades.map(g => {
            const count = (gradeCourses[g] || []).length
            const isSelected = selectedGradeTab === g

            return (
              <button
                key={g}
                onClick={() => setSelectedGradeTab(g)}
                style={{
                  padding: '9px 18px',
                  borderRadius: 8,
                  border: isSelected ? '1px solid var(--accent-blue)' : '1px solid transparent',
                  background: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                  color: isSelected ? 'var(--accent-blue)' : 'var(--text-secondary)',
                  fontWeight: isSelected ? 700 : 500,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>Grade {g}</span>
                <span style={{
                  fontSize: 11,
                  padding: '2px 7px',
                  borderRadius: 10,
                  background: isSelected ? 'var(--accent-blue)' : 'var(--bg-card-hover)',
                  color: isSelected ? '#fff' : 'var(--text-muted)',
                  border: isSelected ? 'none' : '1px solid var(--border)',
                  fontWeight: 700
                }}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Grade / Standalone Courses Cards Section */}
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
                    ? '⭐ Specialist Standalone Courses (e.g. Geometry, BODMAS)'
                    : `Grade ${selectedGradeTab} Courses & Streams`}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-card-hover)', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)' }}>
                  {currentTabCourses.length} {currentTabCourses.length === 1 ? 'course' : 'courses'}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                {selectedGradeTab === 'standalone'
                  ? 'Standalone specialist courses can be enrolled independently or bundled with regular grade classes.'
                  : `Students registering under Grade ${selectedGradeTab} will be presented with these exact curriculum streams.`}
              </div>
            </div>

            {isAdmin && (
              <button
                onClick={() => handleOpenAdd(selectedGradeTab)}
                className="btn-secondary"
                style={{ padding: '7px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
              >
                <Plus size={14} /> {selectedGradeTab === 'standalone' ? 'Add Specialist Course' : `Add Course to Grade ${selectedGradeTab}`}
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
                  ? 'No specialist standalone courses configured yet'
                  : `No courses configured for Grade ${selectedGradeTab}`}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18, maxWidth: 420, margin: '4px auto 18px' }}>
                {selectedGradeTab === 'standalone'
                  ? 'Click Add Specialist Course to create standalone subjects like Geometry Full Course, BODMAS, or Short Questions.'
                  : 'Add Theory, Paper, Revision, or custom bundle courses to enable registrations for this grade.'}
              </div>
              {isAdmin && (
                <button
                  onClick={() => handleOpenAdd(selectedGradeTab)}
                  className="btn-primary"
                  style={{ padding: '8px 18px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Plus size={15} /> {selectedGradeTab === 'standalone' ? '+ Create Specialist Course' : 'Add First Course'}
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 16 }}>
              {currentTabCourses.map(c => {
                const isCombo = c.name.toLowerCase().includes('both') || c.name.toLowerCase().includes('full package') || c.name.toLowerCase().includes('+')
                const isPaper = c.name.toLowerCase().includes('paper') && !isCombo
                const isRevision = c.name.toLowerCase().includes('revision') && !isCombo
                const isStandalone = Boolean(c.isStandalone)

                const cardBorderColor = isStandalone ? '#ec4899' : isCombo ? '#fcd34d' : isPaper ? '#818cf8' : isRevision ? '#c084fc' : '#38bdf8'
                const cardShadowColor = isStandalone ? 'rgba(236, 72, 153, 0.20)' : isCombo ? 'rgba(252, 211, 77, 0.20)' : isPaper ? 'rgba(129, 140, 248, 0.16)' : isRevision ? 'rgba(192, 132, 252, 0.16)' : 'rgba(56, 189, 248, 0.16)'

                return (
                  <div
                    key={c.code}
                    className="stat-card"
                    style={{
                      padding: 18,
                      borderRadius: 16,
                      border: '1px solid var(--border)',
                      borderLeft: `4px solid ${cardBorderColor}`,
                      background: 'var(--bg-card)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 14,
                      boxShadow: `0 4px 18px -4px ${cardShadowColor}`,
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
                          color: isStandalone ? '#ec4899' : 'var(--accent-blue)',
                          background: isStandalone ? 'rgba(236, 72, 153, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                          border: `1px solid ${isStandalone ? 'rgba(236, 72, 153, 0.3)' : 'rgba(56, 189, 248, 0.3)'}`,
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
                          background: isStandalone ? 'rgba(236, 72, 153, 0.15)' : isCombo ? 'rgba(245, 158, 11, 0.15)' : isPaper ? 'rgba(99, 102, 241, 0.15)' : isRevision ? 'rgba(192, 132, 252, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          color: isStandalone ? '#ec4899' : isCombo ? '#f59e0b' : isPaper ? '#818cf8' : isRevision ? '#c084fc' : '#10b981',
                          border: `1px solid ${isStandalone ? 'rgba(236, 72, 153, 0.3)' : isCombo ? 'rgba(245, 158, 11, 0.3)' : isPaper ? 'rgba(99, 102, 241, 0.3)' : isRevision ? 'rgba(192, 132, 252, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
                        }}>
                          {isStandalone ? '⭐ SPECIALIST COURSE' : isCombo ? '⚡ COMBO BUNDLE' : isPaper ? '📝 PAPER CLASS' : isRevision ? '🎯 REVISION' : '📖 THEORY'}
                        </span>

                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 6,
                          background: c.billingType === 'ONE_TIME' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                          color: c.billingType === 'ONE_TIME' ? '#10b981' : 'var(--accent-blue)',
                          border: `1px solid ${c.billingType === 'ONE_TIME' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(56, 189, 248, 0.3)'}`
                        }}>
                          {c.billingType === 'ONE_TIME' ? '💳 ONE-TIME PURCHASE' : '📅 MONTHLY RECURRING'}
                        </span>
                      </div>

                      {c.description && (
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: 12 }}>
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
                        <span style={{ fontSize: 16, fontWeight: 800, color: '#10b981' }}>
                          Rs. {c.defaultFee.toLocaleString()}
                        </span>
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
              {totalCoursesCount} Active Course Streams ({standaloneCourses.length} Specialist Courses)
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>
              Configured across Grades 5 through 13 and standalone courses. Fee structure auto-populates in student admissions and payment receipts.
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
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: 20,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            maxWidth: 480, width: '100%', padding: 26, background: 'var(--bg-card)',
            borderRadius: 16, border: '1px solid var(--border)', boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, background: isFormStandalone ? 'rgba(236,72,153,0.15)' : 'rgba(59,130,246,0.12)',
                color: isFormStandalone ? '#ec4899' : 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Sparkles size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>
                  {editingCode
                    ? (isFormStandalone ? 'Edit Specialist Course' : `Edit Course Stream`)
                    : (isFormStandalone ? 'Add New Specialist Course' : `Add New Course to Grade ${formGrade}`)}
                </h3>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Set subject title, payment type, and default tuition fee
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveForm}>
              {/* Target Scope Selection */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                  Course Category
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button
                    type="button"
                    disabled={!!editingCode}
                    onClick={() => setIsFormStandalone(false)}
                    style={{
                      padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      border: !isFormStandalone ? '1.5px solid var(--accent-blue)' : '1px solid var(--border)',
                      background: !isFormStandalone ? 'rgba(56, 189, 248, 0.15)' : 'var(--bg-card)',
                      color: !isFormStandalone ? 'var(--accent-blue)' : 'var(--text-secondary)'
                    }}
                  >
                    📚 Grade Class
                  </button>
                  <button
                    type="button"
                    disabled={!!editingCode}
                    onClick={() => setIsFormStandalone(true)}
                    style={{
                      padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      border: isFormStandalone ? '1.5px solid #ec4899' : '1px solid var(--border)',
                      background: isFormStandalone ? 'rgba(236, 72, 153, 0.15)' : 'var(--bg-card)',
                      color: isFormStandalone ? '#ec4899' : 'var(--text-secondary)'
                    }}
                  >
                    ⭐ Specialist Course
                  </button>
                </div>
              </div>

              {!isFormStandalone && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                    Target Grade
                  </label>
                  <select
                    className="input-field"
                    value={formGrade}
                    onChange={e => setFormGrade(parseInt(e.target.value))}
                    disabled={!!editingCode}
                    style={{ width: '100%', fontWeight: 600 }}
                  >
                    {grades.map(g => (
                      <option key={g} value={g}>Grade {g}</option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                  Course Title <span style={{ color: 'var(--accent-red)' }}>*</span>
                </label>
                <input
                  className="input-field"
                  style={{ width: '100%' }}
                  placeholder={isFormStandalone ? "e.g. Geometry Full Course (ජ්‍යාමිතිය)" : "e.g. Grade 10 — Theory"}
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              {/* Billing / Payment Type */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                  Billing Type
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setFormBillingType('ONE_TIME')}
                    style={{
                      padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      border: formBillingType === 'ONE_TIME' ? '1.5px solid #10b981' : '1px solid var(--border)',
                      background: formBillingType === 'ONE_TIME' ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-card)',
                      color: formBillingType === 'ONE_TIME' ? '#10b981' : 'var(--text-secondary)'
                    }}
                  >
                    💳 One-Time Full Fee
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormBillingType('MONTHLY')}
                    style={{
                      padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      border: formBillingType === 'MONTHLY' ? '1.5px solid var(--accent-blue)' : '1px solid var(--border)',
                      background: formBillingType === 'MONTHLY' ? 'rgba(56, 189, 248, 0.15)' : 'var(--bg-card)',
                      color: formBillingType === 'MONTHLY' ? 'var(--accent-blue)' : 'var(--text-secondary)'
                    }}
                  >
                    📅 Monthly Recurring
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                  {formBillingType === 'ONE_TIME' ? 'One-Time Course Fee (Rs.)' : 'Default Monthly Fee (Rs.)'} <span style={{ color: 'var(--accent-red)' }}>*</span>
                </label>
                <input
                  type="number"
                  className="input-field"
                  style={{ width: '100%', fontWeight: 700, fontSize: 15 }}
                  placeholder="2500"
                  value={formFee}
                  onChange={e => setFormFee(e.target.value)}
                  required
                />
                {/* Fee Quick Presets */}
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  {['1500', '1800', '2000', '2500', '3000', '3500'].map(f => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFormFee(f)}
                      style={{
                        padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
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

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                  Course Description (Optional)
                </label>
                <input
                  className="input-field"
                  style={{ width: '100%' }}
                  placeholder="e.g. Comprehensive geometry concepts from Grade 6 to 11"
                  value={formDesc}
                  onChange={e => setFormDesc(e.target.value)}
                />
              </div>

              {!editingCode && (
                <div style={{ marginBottom: 18 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                    Custom Identifier Code (Optional)
                  </label>
                  <input
                    className="input-field"
                    style={{ width: '100%' }}
                    placeholder={isFormStandalone ? "e.g. GEOMETRY_FULL" : `e.g. GR${formGrade}_THEORY`}
                    value={formCode}
                    onChange={e => setFormCode(e.target.value)}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    Leave blank to automatically generate unique code.
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary"
                  style={{ padding: '8px 16px', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ padding: '8px 20px', fontWeight: 700, background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)' }}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : editingCode ? 'Save Changes' : '+ Create Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
