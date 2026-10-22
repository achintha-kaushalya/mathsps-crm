'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  Search, Plus, ArrowRight, User, GraduationCap, MapPin, Calendar,
  Phone, Home, ExternalLink, Filter, X, Sparkles, CheckCircle2, 
  BookOpen, Building2, ChevronRight, Eye, RefreshCw, FileSpreadsheet, Download
} from 'lucide-react'
import { Student, extractLmsNumber } from '@/lib/types'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet'

const GRADE_BADGE_STYLES: Record<number, { bg: string; color: string; border: string }> = {
  5:  { bg: '#eff6ff', color: '#2563eb', border: '#dbeafe' },
  6:  { bg: '#f0fdf4', color: '#16a34a', border: '#dcfce7' },
  7:  { bg: '#faf5ff', color: '#9333ea', border: '#f3e8ff' },
  8:  { bg: '#fff7ed', color: '#ea580c', border: '#ffedd5' },
  9:  { bg: '#fdf2f8', color: '#db2777', border: '#fce7f3' },
  10: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  11: { bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' },
}

const AVATAR_PALETTES = [
  { bg: 'color-mix(in srgb, var(--accent-blue) 14%, var(--bg-card))', color: 'var(--accent-blue)', border: 'color-mix(in srgb, var(--accent-blue) 30%, var(--border))' },
  { bg: 'color-mix(in srgb, var(--accent-purple) 14%, var(--bg-card))', color: 'var(--accent-purple)', border: 'color-mix(in srgb, var(--accent-purple) 30%, var(--border))' },
  { bg: 'color-mix(in srgb, var(--accent-green) 14%, var(--bg-card))', color: 'var(--accent-green)', border: 'color-mix(in srgb, var(--accent-green) 30%, var(--border))' },
  { bg: 'color-mix(in srgb, var(--accent-orange) 14%, var(--bg-card))', color: 'var(--accent-orange)', border: 'color-mix(in srgb, var(--accent-orange) 30%, var(--border))' },
  { bg: 'color-mix(in srgb, #ec4899 14%, var(--bg-card))', color: '#ec4899', border: 'color-mix(in srgb, #ec4899 30%, var(--border))' },
]

export default function StudentsPage() {
  const supabase = createClient()
  const [students, setStudents] = useState<Student[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [gradeFilter, setGradeFilter] = useState('')
  const [tutorFilter, setTutorFilter] = useState<string>('all')
  const [areaFilter, setAreaFilter] = useState('')
  const [page, setPage] = useState(0)
  
  // KPI state
  const [kpiStats, setKpiStats] = useState({
    totalStudents: 0,
    activeThisMonth: 0,
    grade10Count: 0,
    grade11Count: 0
  })

  // Quick Detail Drawer State
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [studentEnrollments, setStudentEnrollments] = useState<any[]>([])
  const [studentRecentPayments, setStudentRecentPayments] = useState<any[]>([])

  const searchTimeout = useRef<NodeJS.Timeout | undefined>(undefined)
  const PAGE_SIZE = 50

  useEffect(() => {
    loadKpiStats()
  }, [])

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => { setPage(0); loadStudents(0) }, 250)
    return () => clearTimeout(searchTimeout.current)
  }, [search, gradeFilter, tutorFilter, areaFilter])

  useEffect(() => { 
    loadStudents(page) 
  }, [page])

  async function loadKpiStats() {
    try {
      const now = new Date()
      const curMonth = now.getMonth() + 1
      const curYear = now.getFullYear()

      const [{ count: totalCount }, { count: gr10Count }, { count: gr11Count }, { count: paidCount }] = await Promise.all([
        supabase.from('students').select('*', { count: 'exact', head: true }),
        supabase.from('students').select('*', { count: 'exact', head: true }).eq('grade', 10),
        supabase.from('students').select('*', { count: 'exact', head: true }).eq('grade', 11),
        supabase.from('payments').select('*', { count: 'exact', head: true }).eq('month', curMonth).eq('year', curYear)
      ])

      setKpiStats({
        totalStudents: totalCount || 0,
        activeThisMonth: paidCount || 0,
        grade10Count: gr10Count || 0,
        grade11Count: gr11Count || 0
      })
    } catch (e) {
      console.error('Failed to load student KPI stats:', e)
    }
  }

  async function loadStudents(p: number) {
    setLoading(true)
    try {
      const activeTutor = typeof window !== 'undefined' ? (localStorage.getItem('mathsps_active_tutor') || 'prabuddha') : 'prabuddha'
      let targetPrefix = tutorFilter === 'sanduni' ? 'SM' : tutorFilter === 'prabuddha' ? 'PS' : ''

      if (search.trim() || areaFilter.trim()) {
        const raw = search.trim()
        const cleanDigits = raw.replace(/\D/g, '')
        const cleanCode = raw.toUpperCase().replace(/\s+/g, '')

        let exactMatch: Student | null = null
        if (cleanCode) {
          const { data: exact1 } = await supabase.from('students').select(`
            *, household:households(parent_name, parent_phone, address, area)
          `).ilike('ps_code', cleanCode).maybeSingle()

          if (exact1) {
            exactMatch = exact1 as Student
          } else if (cleanDigits) {
            const prefix = targetPrefix || (activeTutor === 'sanduni' ? 'SM' : 'PS')
            const { data: exact2 } = await supabase.from('students').select(`
              *, household:households(parent_name, parent_phone, address, area)
            `).ilike('ps_code', `${prefix}${cleanDigits}`).maybeSingle()
            if (exact2) exactMatch = exact2 as Student
          }
        }

        const orClauses: string[] = []
        if (raw) {
          orClauses.push(`ps_code.ilike.${cleanCode}%`)
          orClauses.push(`full_name.ilike.%${raw}%`)
          orClauses.push(`notes.ilike.%${raw}%`)
        }
        if (cleanDigits) {
          orClauses.push(`ps_code.ilike.PS${cleanDigits}%`)
          orClauses.push(`ps_code.ilike.SM${cleanDigits}%`)
          orClauses.push(`notes.ilike.%${cleanDigits}%`)
        }

        let q = supabase.from('students').select(`
          *, household:households(parent_name, parent_phone, address, area)
        `, { count: 'exact' })

        if (orClauses.length > 0) {
          q = q.or(orClauses.join(','))
        }

        if (targetPrefix) {
          q = q.ilike('ps_code', `${targetPrefix}%`)
        }
        if (gradeFilter) {
          q = q.eq('grade', parseInt(gradeFilter))
        }

        const { data, count } = await q.limit(100)

        let combined = data || []
        if (exactMatch) {
          combined = [exactMatch, ...combined.filter(s => s.id !== exactMatch?.id)]
        }

        // Apply local Area filter if provided
        if (areaFilter.trim()) {
          const aLower = areaFilter.toLowerCase()
          combined = combined.filter(s => {
            const area = (s.household as any)?.area?.toLowerCase() || ''
            const address = (s.household as any)?.address?.toLowerCase() || ''
            return area.includes(aLower) || address.includes(aLower)
          })
        }

        // Sort candidates
        const sortedData = combined.sort((a, b) => {
          const aCode = (a.ps_code || '').toUpperCase()
          const bCode = (b.ps_code || '').toUpperCase()

          if (aCode === cleanCode && bCode !== cleanCode) return -1
          if (bCode === cleanCode && aCode !== cleanCode) return 1

          const aHasName = !!(a.full_name && a.full_name !== 'System Auto-Pre-generated')
          const bHasName = !!(b.full_name && b.full_name !== 'System Auto-Pre-generated')
          if (aHasName && !bHasName) return -1
          if (!aHasName && bHasName) return 1

          return aCode.length - bCode.length
        })

        const mappedList = sortedData.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE).map(s => ({
          ...s,
          lms_number: extractLmsNumber(s)
        }))

        setStudents(mappedList)
        setTotal(Math.max(count || 0, exactMatch ? 1 : 0))
      } else {
        // Standard Paginated Query
        let q = supabase.from('students').select(`
          *, household:households(parent_name, parent_phone, address, area)
        `, { count: 'exact' })

        if (targetPrefix) {
          q = q.ilike('ps_code', `${targetPrefix}%`)
        }
        if (gradeFilter) {
          q = q.eq('grade', parseInt(gradeFilter))
        }

        q = q.order('created_at', { ascending: false }).range(p * PAGE_SIZE, (p + 1) * PAGE_SIZE - 1)
        const { data, count } = await q
        const mappedList = (data || []).map(s => ({
          ...s,
          lms_number: extractLmsNumber(s)
        }))
        setStudents(mappedList)
        setTotal(count || 0)
      }
    } finally {
      setLoading(false)
    }
  }

  async function openStudentDrawer(s: Student) {
    setSelectedStudent(s)
    setDrawerOpen(true)
    setDrawerLoading(true)

    try {
      const [enrollRes, pmtRes] = await Promise.all([
        supabase.from('enrollments').select('*').eq('student_id', s.id),
        supabase.from('payments').select('*').eq('student_id', s.id).order('year', { ascending: false }).order('month', { ascending: false }).limit(5)
      ])
      setStudentEnrollments(enrollRes.data || [])
      setStudentRecentPayments(pmtRes.data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setDrawerLoading(false)
    }
  }

  function getAvatarStyle(name: string | null, code: string) {
    const char = (name || code || 'S').trim().toUpperCase().charAt(0)
    const codeSum = (code || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
    const palette = AVATAR_PALETTES[codeSum % AVATAR_PALETTES.length]
    return { char, ...palette }
  }

  const [exportingLms, setExportingLms] = useState(false)

  async function exportLmsNumbersCsv() {
    setExportingLms(true)
    try {
      const CHUNK = 1000
      let allStudents: any[] = []
      let from = 0
      let hasMore = true

      while (hasMore) {
        let q = supabase
          .from('students')
          .select('ps_code, full_name, grade, notes, created_at')

        if (tutorFilter === 'sanduni') {
          q = q.ilike('ps_code', 'SM%')
        } else if (tutorFilter === 'prabuddha') {
          q = q.ilike('ps_code', 'PS%')
        }

        if (gradeFilter) {
          q = q.eq('grade', parseInt(gradeFilter))
        }

        const { data, error } = await q.order('created_at', { ascending: false }).range(from, from + CHUNK - 1)
        if (error) throw error

        allStudents = allStudents.concat(data || [])
        if (!data || data.length < CHUNK) {
          hasMore = false
        } else {
          from += CHUNK
        }
      }

      const studentsWithLms = allStudents
        .map(s => ({ ...s, lms_number: extractLmsNumber(s) }))
        .filter(s => !!s.lms_number)

      if (studentsWithLms.length === 0) {
        alert('No registered LMS Mobile Numbers found matching your filter criteria.')
        return
      }

      const headers = ['LMS Mobile Number', 'PS Code', 'Student Name', 'Grade', 'Registered Date']
      const rows = studentsWithLms.map(s => [
        `"${s.lms_number}"`,
        `"${s.ps_code || ''}"`,
        `"${(s.full_name || '').replace(/"/g, '""')}"`,
        `"${s.grade ? `Grade ${s.grade}` : ''}"`,
        `"${s.created_at ? new Date(s.created_at).toLocaleDateString('en-GB') : ''}"`
      ])

      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n')
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const dateStr = new Date().toISOString().slice(0, 10)
      a.download = `MathsPS_LMS_Numbers_Bulk_Import_${dateStr}_(${allStudents.length}_Students).csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e: any) {
      alert('Failed to export LMS numbers: ' + e.message)
    } finally {
      setExportingLms(false)
    }
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-base)' }}>
      {/* 1. Page Header */}
      <div className="page-header" style={{ borderBottom: '1px solid var(--border)', background: '#ffffff', padding: '18px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
            border: '1px solid #bfdbfe',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#2563eb', boxShadow: '0 2px 8px rgba(37, 99, 235, 0.12)'
          }}>
            <GraduationCap size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.4px' }}>
                Students Directory
              </h1>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12,
                background: '#eff6ff', color: '#2563eb', border: '1px solid #dbeafe'
              }}>
                {total.toLocaleString()} Records
              </span>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '2px 0 0' }}>
              Institute student registry, household contacts, and academic profiles
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button 
            onClick={exportLmsNumbersCsv}
            disabled={exportingLms}
            className="btn-primary"
            title="Export bulk LMS numbers CSV for your LMS portal"
            style={{
              padding: '9px 16px',
              borderRadius: 10,
              fontWeight: 700,
              background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)'
            }}
          >
            <FileSpreadsheet size={15} />
            {exportingLms ? 'Exporting LMS...' : 'Export LMS Numbers'}
          </button>
          <button 
            onClick={() => { loadKpiStats(); loadStudents(page) }} 
            className="btn-secondary"
            title="Refresh Directory"
            style={{ padding: '8px 12px' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <a href="/students/new" className="btn-primary" style={{ padding: '9px 18px', borderRadius: 10, fontWeight: 700 }}>
            <Plus size={15} /> Add Student
          </a>
        </div>
      </div>

      {/* 2. Top Summary KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 14,
        padding: '16px 28px',
        background: 'var(--bg-base)',
        borderBottom: '1px solid var(--border)'
      }}>
        {/* KPI 1 */}
        <div className="stat-card" style={{
          borderTop: '2px solid var(--accent-blue)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 82
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Enrolled</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2, letterSpacing: '-0.02em' }}>{kpiStats.totalStudents.toLocaleString()}</div>
          </div>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'color-mix(in srgb, var(--accent-blue) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-blue) 25%, var(--border))', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <User size={18} />
          </div>
        </div>

        {/* KPI 2 */}
        <div className="stat-card" style={{
          borderTop: '2px solid var(--accent-green)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 82
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Active This Month</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent-green)', marginTop: 2, letterSpacing: '-0.02em' }}>{kpiStats.activeThisMonth.toLocaleString()}</div>
          </div>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'color-mix(in srgb, var(--accent-green) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-green) 25%, var(--border))', color: 'var(--accent-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <CheckCircle2 size={18} />
          </div>
        </div>

        {/* KPI 3 */}
        <div className="stat-card" style={{
          borderTop: '2px solid var(--accent-purple)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 82
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Grade 10 Batch</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent-purple)', marginTop: 2, letterSpacing: '-0.02em' }}>{kpiStats.grade10Count.toLocaleString()}</div>
          </div>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'color-mix(in srgb, var(--accent-purple) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-purple) 25%, var(--border))', color: 'var(--accent-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <BookOpen size={18} />
          </div>
        </div>

        {/* KPI 4 */}
        <div className="stat-card" style={{
          borderTop: '2px solid var(--accent-orange)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 82
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Grade 11 Batch</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent-orange)', marginTop: 2, letterSpacing: '-0.02em' }}>{kpiStats.grade11Count.toLocaleString()}</div>
          </div>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'color-mix(in srgb, var(--accent-orange) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-orange) 25%, var(--border))', color: 'var(--accent-orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Building2 size={18} />
          </div>
        </div>
      </div>

      {/* 3. Search & Comprehensive Filter Bar */}
      <div className="glass-card" style={{
        padding: '14px 18px',
        marginBottom: 16,
        borderRadius: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 300, maxWidth: 500 }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="search-bar"
              style={{
                width: '100%',
                paddingLeft: 34,
                paddingRight: 28,
                fontSize: 13,
                height: 38
              }}
              placeholder="Search PS code, student name, LMS number, or phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button 
                onClick={() => setSearch('')}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Quick Filter Selectors */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Tutor Prefix Filter */}
          <select
            className="input-field"
            style={{ width: 140, height: 38, borderRadius: 10, fontSize: 12.5, fontWeight: 600 }}
            value={tutorFilter}
            onChange={e => setTutorFilter(e.target.value)}
          >
            <option value="all">All Tutors</option>
            <option value="prabuddha">PS · Prabuddha</option>
            <option value="sanduni">SM · Sanduni</option>
          </select>

          {/* Grade Selector */}
          <select
            className="input-field"
            style={{ width: 125, height: 38, borderRadius: 10, fontSize: 12.5, fontWeight: 600 }}
            value={gradeFilter}
            onChange={e => setGradeFilter(e.target.value)}
          >
            <option value="">All Grades</option>
            {[5, 6, 7, 8, 9, 10, 11].map(g => (
              <option key={g} value={g}>Grade {g}</option>
            ))}
          </select>

          {/* City / Address Filter Input */}
          <input
            className="input-field"
            style={{ width: 140, height: 38, borderRadius: 10, fontSize: 12.5 }}
            placeholder="City / Town..."
            value={areaFilter}
            onChange={e => setAreaFilter(e.target.value)}
          />

          {(gradeFilter || tutorFilter !== 'all' || areaFilter || search) && (
            <button
              onClick={() => { setGradeFilter(''); setTutorFilter('all'); setAreaFilter(''); setSearch('') }}
              className="btn-secondary"
              style={{ height: 38, padding: '0 10px', fontSize: 12, borderRadius: 10 }}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* 4. Main Students Data Table Container */}
      <div className="glass-card" style={{ flex: 1, overflow: 'hidden', borderRadius: 16, position: 'relative' }}>
        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ padding: '12px 16px', width: 110 }}>PS Code</th>
              <th style={{ padding: '12px 16px', minWidth: 220 }}>Student Name</th>
              <th style={{ padding: '12px 12px', width: 90, textAlign: 'center' }}>Grade</th>
              <th style={{ padding: '12px 14px', minWidth: 160 }}>LMS Number</th>
              <th style={{ padding: '12px 14px', minWidth: 130 }}>Registered Date</th>
              <th style={{ padding: '12px 14px', minWidth: 220 }}>Address / Parent Phone</th>
              <th style={{ padding: '12px 12px', width: 100, textAlign: 'center' }}>CRM Ref</th>
              <th style={{ padding: '12px 14px', width: 90, textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '50px 0', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Loading student records...</span>
                  </div>
                </td>
              </tr>
            ) : students.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>No students found matching your criteria</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Try clearing the filters or searching by PS code number</div>
                </td>
              </tr>
            ) : (
              students.map(s => {
                const avatar = getAvatarStyle(s.full_name, s.ps_code)
                const gradeBadge = s.grade ? GRADE_BADGE_STYLES[s.grade] || { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' } : null
                const household = s.household as any

                return (
                  <tr
                    key={s.id}
                    onClick={() => openStudentDrawer(s)}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease'
                    }}
                  >
                    {/* PS Code Pill */}
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '3px 8px',
                        borderRadius: 6,
                        background: 'rgba(56, 189, 248, 0.15)',
                        color: 'var(--accent-blue)',
                        fontWeight: 800,
                        fontSize: 12,
                        letterSpacing: '-0.2px',
                        border: '1px solid rgba(56, 189, 248, 0.3)'
                      }}>
                        {s.ps_code}
                      </span>
                    </td>

                    {/* Student Avatar & Name */}
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 10,
                          background: avatar.bg, color: avatar.color, border: `1px solid ${avatar.border}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12.5, fontWeight: 800, flexShrink: 0
                        }}>
                          {avatar.char}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                            {s.full_name || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Pending Name</span>}
                          </div>
                          {household?.parent_name && (
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                              Parent: {household.parent_name}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Grade Badge */}
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      {s.grade && gradeBadge ? (
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 12,
                          background: gradeBadge.bg,
                          color: gradeBadge.color,
                          border: `1px solid ${gradeBadge.border}`,
                          fontSize: 11,
                          fontWeight: 800
                        }}>
                          Gr {s.grade}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                      )}
                    </td>

                    {/* LMS Mobile Number */}
                    <td style={{ padding: '10px 14px', fontSize: 12.5 }}>
                      {s.lms_number ? (
                        <span style={{ color: '#10b981', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Phone size={11} /> {s.lms_number}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                      )}
                    </td>

                    {/* Registered Date */}
                    <td style={{ padding: '10px 14px', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                      {s.created_at ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          background: 'rgba(56, 189, 248, 0.08)',
                          color: 'var(--accent-blue)',
                          border: '1px solid rgba(56, 189, 248, 0.2)',
                          padding: '3px 8px', borderRadius: 8, fontSize: 11.5, fontWeight: 600
                        }}>
                          <Calendar size={11} style={{ opacity: 0.8 }} />
                          {new Date(s.created_at).toLocaleDateString('en-CA')}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>

                    {/* Address & Parent Phone */}
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-primary)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {household?.address || <span style={{ color: 'var(--text-muted)' }}>No address recorded</span>}
                      </div>
                      {household?.parent_phone && (
                        <div style={{ fontSize: 11, color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                          <Phone size={10} /> {household.parent_phone}
                        </div>
                      )}
                    </td>

                    {/* CRM Link Ref */}
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      {s.fcode_ref ? (
                        <a
                          href={`/leads/${s.fcode_ref}`}
                          onClick={e => e.stopPropagation()}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            padding: '2px 7px',
                            borderRadius: 6,
                            background: 'rgba(139, 92, 246, 0.15)',
                            color: '#8b5cf6',
                            fontSize: 11,
                            fontWeight: 700,
                            textDecoration: 'none',
                            border: '1px solid rgba(139, 92, 246, 0.3)'
                          }}
                        >
                          {s.fcode_ref} <ExternalLink size={9} />
                        </a>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                      )}
                    </td>

                    {/* Action Arrow */}
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      <a
                        href={`/students/${encodeURIComponent(s.ps_code)}`}
                        onClick={e => e.stopPropagation()}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '4px 9px',
                          borderRadius: 8,
                          background: 'var(--bg-base)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-primary)',
                          fontSize: 11.5,
                          fontWeight: 700,
                          textDecoration: 'none',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-blue)'; e.currentTarget.style.color = 'var(--accent-blue)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                      >
                        Profile <ChevronRight size={12} />
                      </a>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 5. Pagination Bottom Bar */}
      <div style={{
        padding: '12px 28px',
        background: '#ffffff',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Showing <strong>{total > 0 ? page * PAGE_SIZE + 1 : 0}</strong>–<strong>{Math.min((page + 1) * PAGE_SIZE, total)}</strong> of <strong>{total.toLocaleString()}</strong> students
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn-secondary"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            style={{ borderRadius: 8, padding: '6px 14px', fontSize: 12.5 }}
          >
            ← Previous
          </button>
          <button
            className="btn-secondary"
            onClick={() => setPage(p => p + 1)}
            disabled={(page + 1) * PAGE_SIZE >= total}
            style={{ borderRadius: 8, padding: '6px 14px', fontSize: 12.5 }}
          >
            Next →
          </button>
        </div>
      </div>

      {/* 6. Sleek Bottom Horizontal Quick Preview Bar */}
      {drawerOpen && selectedStudent && (
        <div
          className="pop-up-bar"
          style={{
            position: 'fixed',
            bottom: 84, // positioned cleanly above the dock
            left: 20,
            right: 20,
            maxWidth: 1200,
            margin: '0 auto',
            zIndex: 9995,
            background: 'var(--bg-card)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid var(--border)',
            borderRadius: 20,
            padding: '16px 22px',
            boxShadow: '0 20px 50px -10px rgba(0, 0, 0, 0.4), 0 0 0 1px var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }}
        >
          {/* Top Bar: Label & Close Button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '2px 8px', borderRadius: 6,
                background: 'rgba(56, 189, 248, 0.12)', color: 'var(--accent-blue)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                fontSize: 11, fontWeight: 800, letterSpacing: '0.04em'
              }}>
                {selectedStudent.ps_code}
              </span>
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>
                Quick Student Preview
              </span>
            </div>

            {/* Close Button on Top Right */}
            <button
              onClick={() => setDrawerOpen(false)}
              style={{
                background: 'var(--bg-card-hover)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px 8px',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
                fontWeight: 700,
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#ef4444' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}
              title="Close Preview (Esc)"
            >
              <X size={13} />
              <span>Close</span>
            </button>
          </div>

          {/* 3 Horizontal Columns Layout */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1.3fr 1.3fr 1.8fr auto',
            gap: 18,
            alignItems: 'center'
          }}>
            {/* 1. Lokuwata Grade Number Eka */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 72,
              height: 72,
              borderRadius: 16,
              background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.15), rgba(99, 102, 241, 0.15))',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              padding: '6px 12px'
            }}>
              <span style={{ fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-blue)' }}>
                GRADE
              </span>
              <span style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.1, color: 'var(--text-primary)' }}>
                {selectedStudent.grade || '—'}
              </span>
            </div>

            {/* 2. Name Eka (Peli 2-3 Kata) */}
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: 15,
                fontWeight: 800,
                color: 'var(--text-primary)',
                lineHeight: 1.3,
                wordBreak: 'break-word'
              }}>
                {selectedStudent.full_name || 'Pending Registration'}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                <User size={12} style={{ color: 'var(--text-muted)' }} />
                <span>Parent: <strong>{(selectedStudent.household as any)?.parent_name || 'Not provided'}</strong></span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                LMS: <b style={{ color: selectedStudent.lms_number ? '#10b981' : 'var(--text-muted)' }}>{selectedStudent.lms_number || 'Not Set'}</b>
              </div>
            </div>

            {/* 3. Address & Contact */}
            <div style={{ minWidth: 0, borderLeft: '1px solid var(--border)', paddingLeft: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 3 }}>
                Address & Contact
              </div>
              <div style={{
                fontSize: 12,
                color: 'var(--text-primary)',
                lineHeight: 1.4,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }} title={(selectedStudent.household as any)?.address}>
                <MapPin size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle', color: 'var(--accent-blue)' }} />
                {(selectedStudent.household as any)?.address || 'No address recorded'}
                {(selectedStudent.household as any)?.area ? ` (${(selectedStudent.household as any).area})` : ''}
              </div>
              {(selectedStudent.household as any)?.parent_phone && (
                <div style={{ fontSize: 11.5, color: '#10b981', fontWeight: 700, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Phone size={11} /> {(selectedStudent.household as any).parent_phone}
                </div>
              )}
            </div>

            {/* 4. Enrolled Courses Tika */}
            <div style={{ minWidth: 0, borderLeft: '1px solid var(--border)', paddingLeft: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 6 }}>
                Enrolled Courses
              </div>
              {drawerLoading ? (
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Loading enrollments...</div>
              ) : studentEnrollments.length === 0 ? (
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontStyle: 'italic' }}>No active classes</span>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 62, overflowY: 'auto' }}>
                  {studentEnrollments.map((e, idx) => (
                    <span
                      key={idx}
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 8,
                        background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        color: '#10b981',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <span>{e.class_type}</span>
                      <span style={{ fontSize: 10, opacity: 0.8 }}>Rs.{e.fee_amount?.toLocaleString()}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Action: Open Full Profile Button */}
            <div style={{ paddingLeft: 8 }}>
              <a
                href={`/students/${encodeURIComponent(selectedStudent.ps_code)}`}
                className="btn-primary"
                style={{
                  padding: '9px 15px',
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                  textDecoration: 'none'
                }}
              >
                <span>Full Profile</span>
                <ArrowRight size={13} />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

