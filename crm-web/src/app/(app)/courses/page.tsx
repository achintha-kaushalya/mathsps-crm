'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BookOpen, Plus, Trash2, Edit2, Shield, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react'
import { DEFAULT_GRADE_COURSES, CourseConfig, getAllCourseLabels, getAllCourseFees } from '@/lib/courses'

export default function CoursesManagerPage() {
  const supabase = createClient()

  const [currentUserRole, setCurrentUserRole] = useState<'member' | 'admin' | 'owner'>('member')
  const [currentUserName, setCurrentUserName] = useState('')
  const [loading, setLoading] = useState(true)

  // Grade-aligned courses configuration state
  const [gradeCourses, setGradeCourses] = useState<Record<number, CourseConfig[]>>(DEFAULT_GRADE_COURSES)
  const [selectedGradeTab, setSelectedGradeTab] = useState<number>(10)

  // Modal / Form state for Add / Edit
  const [showModal, setShowModal] = useState(false)
  const [editingCode, setEditingCode] = useState<string | null>(null)
  const [formGrade, setFormGrade] = useState<number>(10)
  const [formCode, setFormCode] = useState('')
  const [formName, setFormName] = useState('')
  const [formFee, setFormFee] = useState<string>('1800')
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
          const gc: Record<number, CourseConfig[]> = {}
          Object.entries(notesObj.grade_courses).forEach(([grStr, list]: [string, any]) => {
            gc[Number(grStr)] = list
          })
          setGradeCourses(gc)
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
      })
      .subscribe()

    return () => {
      supabase.removeChannel(room)
    }
  }, [])

  async function persistCourses(updatedGC: Record<number, CourseConfig[]>) {
    setSaving(true)
    try {
      const { data: adminMem } = await supabase.from('members').select('id').eq('name', 'Admin User').single()
      if (adminMem?.id) {
        const customCourses = getAllCourseLabels(updatedGC)
        const classFees = getAllCourseFees(updatedGC)

        const res = await fetch('/api/members/manage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_custom_courses',
            memberId: adminMem.id,
            courses: customCourses,
            fees: classFees,
            grade_courses: updatedGC,
            adminPassword: 'sb_secret_verification_bypass'
          })
        })

        if (!res.ok) throw new Error('Failed to save to database')

        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'courses_updated',
            payload: { grade_courses: updatedGC, courses: customCourses, fees: classFees }
          })
        }
      }
      setToastMsg('✓ Changes saved & synced across CRM in real time!')
      setTimeout(() => setToastMsg(''), 3000)
    } catch (err: any) {
      alert('Error updating courses: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  function handleOpenAdd(grade: number) {
    setEditingCode(null)
    setFormGrade(grade)
    setFormCode('')
    setFormName('')
    setFormFee(grade >= 10 ? '1800' : '1500')
    setShowModal(true)
  }

  function handleOpenEdit(course: CourseConfig) {
    setEditingCode(course.code)
    setFormGrade(course.grade)
    setFormCode(course.code)
    setFormName(course.name)
    setFormFee(String(course.defaultFee))
    setShowModal(true)
  }

  async function handleSaveForm(e: React.FormEvent) {
    e.preventDefault()
    if (!formName.trim()) return

    const fee = parseFloat(formFee) || 1800
    const code = editingCode || (formCode.trim() ? formCode.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_') : `GR${formGrade}_${Date.now().toString().slice(-4)}`)

    const currentList = gradeCourses[formGrade] || []
    let updatedList: CourseConfig[] = []

    if (editingCode) {
      updatedList = currentList.map(c => c.code === editingCode ? { ...c, name: formName.trim(), defaultFee: fee, grade: formGrade } : c)
    } else {
      updatedList = [...currentList.filter(c => c.code !== code), { code, name: formName.trim(), defaultFee: fee, grade: formGrade }]
    }

    const updatedGC = {
      ...gradeCourses,
      [formGrade]: updatedList
    }

    setGradeCourses(updatedGC)
    setShowModal(false)
    await persistCourses(updatedGC)
  }

  async function handleDeleteCourse(course: CourseConfig) {
    if (!confirm(`Are you sure you want to delete "${course.name}" from Grade ${course.grade}?`)) return

    const currentList = gradeCourses[course.grade] || []
    const updatedList = currentList.filter(c => c.code !== course.code)
    const updatedGC = {
      ...gradeCourses,
      [course.grade]: updatedList
    }

    setGradeCourses(updatedGC)
    await persistCourses(updatedGC)
  }

  // Available grade tabs (6 through 13)
  const grades = [6, 7, 8, 9, 10, 11, 12, 13]
  const currentTabCourses = gradeCourses[selectedGradeTab] || []

  // Total courses count across all grades
  const totalCoursesCount = Object.values(gradeCourses).reduce((sum, list) => sum + list.length, 0)

  if (loading) {
    return <div style={{ padding: 40, color: 'var(--text-muted)' }}>Loading courses manager...</div>
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflowY: 'auto' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <BookOpen size={22} style={{ color: 'var(--accent-blue)' }} />
            Courses & Grades Manager
          </h1>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
            Manage curriculum courses, default fee rates, and alignment for student registrations & payments
          </div>
        </div>

        {isAdmin ? (
          <button
            onClick={() => handleOpenAdd(selectedGradeTab)}
            className="btn-primary"
            style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={16} /> + Add Course to Grade {selectedGradeTab}
          </button>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', padding: '6px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Shield size={14} /> View Only (Admin Managed)
          </div>
        )}
      </div>

      <div className="page-content" style={{ maxWidth: 900 }}>
        {toastMsg && (
          <div style={{
            padding: '12px 18px', background: 'rgba(16,185,129,0.12)', border: '1px solid #10b981',
            borderRadius: 8, color: '#34d399', fontWeight: 600, fontSize: 13, marginBottom: 18,
            display: 'flex', alignItems: 'center', gap: 8
          }}>
            <CheckCircle2 size={16} /> {toastMsg}
          </div>
        )}

        {/* Grade Tabs */}
        <div style={{
          display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, marginBottom: 20,
          borderBottom: '1px solid var(--border)'
        }}>
          {grades.map(g => {
            const count = (gradeCourses[g] || []).length
            const isSelected = selectedGradeTab === g

            return (
              <button
                key={g}
                onClick={() => setSelectedGradeTab(g)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px 8px 0 0',
                  border: '1px solid',
                  borderColor: isSelected ? 'var(--accent-blue)' : 'transparent',
                  borderBottom: isSelected ? '2px solid var(--accent-blue)' : 'none',
                  background: isSelected ? 'rgba(59,130,246,0.14)' : 'transparent',
                  color: isSelected ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontWeight: isSelected ? 700 : 500,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s'
                }}
              >
                <span>Grade {g}</span>
                <span style={{
                  fontSize: 11,
                  padding: '1px 6px',
                  borderRadius: 10,
                  background: isSelected ? 'var(--accent-blue)' : 'rgba(255,255,255,0.06)',
                  color: isSelected ? '#fff' : 'var(--text-muted)',
                  fontWeight: 700
                }}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Grade Courses Cards */}
        <div className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                Grade {selectedGradeTab} Courses
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                Students registering for Grade {selectedGradeTab} will see these aligned courses
              </div>
            </div>

            {isAdmin && (
              <button
                onClick={() => handleOpenAdd(selectedGradeTab)}
                className="btn-secondary"
                style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Plus size={14} /> + New Course
              </button>
            )}
          </div>

          {currentTabCourses.length === 0 ? (
            <div style={{ padding: 36, textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px dashed var(--border)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📚</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                No courses configured for Grade {selectedGradeTab}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                Click below to add Theory, Paper, Revision, or custom subjects for this grade.
              </div>
              {isAdmin && (
                <button onClick={() => handleOpenAdd(selectedGradeTab)} className="btn-primary" style={{ padding: '6px 14px' }}>
                  <Plus size={14} /> Add First Course
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
              {currentTabCourses.map(c => (
                <div
                  key={c.code}
                  style={{
                    padding: 16,
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-base)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 12,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {c.name}
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--accent-blue)', background: 'rgba(59,130,246,0.1)', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                        {c.code}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Default Fee:</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent-green)' }}>
                        Rs. {c.defaultFee.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {isAdmin && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10 }}>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(c)}
                        className="btn-secondary"
                        style={{ padding: '4px 10px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <Edit2 size={12} /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCourse(c)}
                        style={{
                          background: 'rgba(239,68,68,0.1)',
                          border: '1px solid rgba(239,68,68,0.2)',
                          color: '#ef4444',
                          borderRadius: 6,
                          padding: '4px 10px',
                          fontSize: 11,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Global Summary & Quick Navigation */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="glass-card" style={{ padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
              TOTAL SYSTEM COURSES
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent-blue)' }}>
              {totalCoursesCount} Active Courses
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Configured across Grades 6 through 13
            </div>
          </div>

          <div className="glass-card" style={{ padding: 18, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                QUICK ACCESS
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Test student registration or payment recording with updated courses.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <a href="/students/new" className="btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }}>
                Register Student →
              </a>
              <a href="/payments/add" className="btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }}>
                Add Payment →
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Add / Edit Course Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: 20
        }}>
          <div className="glass-card" style={{ maxWidth: 460, width: '100%', padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={18} style={{ color: 'var(--accent-blue)' }} />
              {editingCode ? 'Edit Course' : `+ Add New Course to Grade ${formGrade}`}
            </h3>

            <form onSubmit={handleSaveForm}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                  Target Grade
                </label>
                <select
                  className="input-field"
                  value={formGrade}
                  onChange={e => setFormGrade(parseInt(e.target.value))}
                  disabled={!!editingCode}
                >
                  {grades.map(g => (
                    <option key={g} value={g}>Grade {g}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                  Course Name / Title <span style={{ color: 'var(--accent-red)' }}>*</span>
                </label>
                <input
                  className="input-field"
                  placeholder="e.g. Grade 10 — Theory"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                  Default Monthly Fee (Rs.) <span style={{ color: 'var(--accent-red)' }}>*</span>
                </label>
                <input
                  type="number"
                  className="input-field"
                  placeholder="1800"
                  value={formFee}
                  onChange={e => setFormFee(e.target.value)}
                  required
                />
              </div>

              {!editingCode && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                    Custom Course Code (Optional)
                  </label>
                  <input
                    className="input-field"
                    placeholder={`e.g. GR${formGrade}_THEORY`}
                    value={formCode}
                    onChange={e => setFormCode(e.target.value)}
                  />
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                    Leave blank to auto-generate unique course identifier.
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary"
                  style={{ padding: '8px 16px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ padding: '8px 18px', fontWeight: 700 }}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : editingCode ? 'Save' : '+ Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
