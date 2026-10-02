'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  Download,
  Copy,
  Check,
  FileSpreadsheet,
  GraduationCap,
  BookOpen,
  Filter,
  Users,
  Search,
  Phone,
  Sparkles,
  Layers,
  Calendar,
  Video,
  History,
  RotateCw
} from 'lucide-react'
import { CLASS_LABELS, MONTH_NAMES } from '@/lib/types'
import { exportLmsBulkCsv, formatMobileForLms, getGradeFromPayment } from '@/lib/reports-analytics'
import { DEFAULT_GRADE_COURSES, DEFAULT_STANDALONE_COURSES } from '@/lib/courses'
import { createClient } from '@/lib/supabase/client'

interface LmsBulkExporterTabProps {
  dailyPayments: any[]
  allPaymentsMonth: any[]
  newStudents: any[]
  courseLabels: Record<string, string>
  month: number
  year: number
  setMonth?: (m: number) => void
  setYear?: (y: number) => void
  startDate: string
  endDate: string
  tutorFilter?: 'ps' | 'sm' | 'all'
}

export default function LmsBulkExporterTab({
  dailyPayments,
  allPaymentsMonth,
  newStudents,
  courseLabels,
  month,
  year,
  setMonth,
  setYear,
  startDate,
  endDate,
  tutorFilter = 'ps'
}: LmsBulkExporterTabProps) {
  const supabase = createClient()

  // Source dataset: 'monthly' (specific month for recording access) | 'daily' (today/date range) | 'registrations' | 'custom_month'
  const [sourceType, setSourceType] = useState<'monthly' | 'daily' | 'registrations'>('monthly')

  // Selected Month & Year for Previous Month Recording Access
  const [selectedMonth, setSelectedMonth] = useState<number>(month)
  const [selectedYear, setSelectedYear] = useState<number>(year)

  // Local state for fetched previous month recordings payments if different from parent month
  const [fetchedMonthPayments, setFetchedMonthPayments] = useState<any[]>([])
  const [loadingCustomMonth, setLoadingCustomMonth] = useState<boolean>(false)

  // Filters
  const [selectedGrade, setSelectedGrade] = useState<string>('ALL')
  const [selectedClassType, setSelectedClassType] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [copied, setCopied] = useState(false)

  // Keep selectedMonth/Year in sync when parent month/year changes if user hasn't changed them
  useEffect(() => {
    if (month && year && sourceType !== 'monthly') {
      setSelectedMonth(month)
      setSelectedYear(year)
    }
  }, [month, year])

  // Helper function to check tutor filter
  function matchesTutor(psCode: string | null | undefined): boolean {
    if (!psCode || tutorFilter === 'all') return true
    const clean = psCode.toUpperCase().trim()
    if (tutorFilter === 'sm') {
      return clean.startsWith('SM')
    }
    return clean.startsWith('PS') || (!clean.startsWith('SM'))
  }

  // Fetch payments for the selected month/year whenever it differs from current page props or changes
  useEffect(() => {
    let isCancelled = false

    async function fetchMonthRecordingsData() {
      if (sourceType !== 'monthly') return
      
      // If selected month/year matches parent's active month/year and we have allPaymentsMonth, use it
      if (selectedMonth === month && selectedYear === year && allPaymentsMonth.length > 0) {
        setFetchedMonthPayments(allPaymentsMonth)
        return
      }

      setLoadingCustomMonth(true)
      try {
        let results: any[] = []
        let from = 0
        let hasMore = true
        const CHUNK = 1000

        while (hasMore) {
          const { data, error } = await supabase
            .from('payments')
            .select('id, student_id, amount_paid, payment_type, bank_name, recorded_by, created_at, date_paid, class_type, students(id, ps_code, full_name, grade, household:households(parent_name, parent_phone))')
            .eq('month', selectedMonth)
            .eq('year', selectedYear)
            .range(from, from + CHUNK - 1)

          if (error) throw error
          results = results.concat(data || [])
          if (!data || data.length < CHUNK) {
            hasMore = false
          } else {
            from += CHUNK
          }
        }

        if (isCancelled) return

        const filtered = results.filter((p: any) => matchesTutor(p.students?.ps_code || p.student_id))
        setFetchedMonthPayments(filtered)
      } catch (err) {
        console.error('Error fetching month recordings payments:', err)
      } finally {
        if (!isCancelled) setLoadingCustomMonth(false)
      }
    }

    fetchMonthRecordingsData()

    return () => {
      isCancelled = true
    }
  }, [sourceType, selectedMonth, selectedYear, month, year, allPaymentsMonth, tutorFilter])

  // Determine active raw dataset
  const rawList = useMemo(() => {
    if (sourceType === 'daily') {
      return dailyPayments
    } else if (sourceType === 'monthly') {
      return fetchedMonthPayments.length > 0 || (selectedMonth !== month || selectedYear !== year)
        ? fetchedMonthPayments
        : allPaymentsMonth
    } else {
      return newStudents
    }
  }, [sourceType, dailyPayments, fetchedMonthPayments, allPaymentsMonth, newStudents, selectedMonth, selectedYear, month, year])

  // Extract distinct grades available in the active dataset + standard catalog grades (5-11)
  const availableGrades = useMemo(() => {
    const set = new Set<number>([5, 6, 7, 8, 9, 10, 11])
    rawList.forEach((item: any) => {
      const gr = getGradeFromPayment(item) || item.students?.grade || item.grade
      if (gr) set.add(Number(gr))
    })
    return Array.from(set).sort((a, b) => a - b)
  }, [rawList])

  // Extract distinct courses available in the active dataset PLUS all registered standalone & grade catalog courses
  const availableCourses = useMemo(() => {
    const map = new Map<string, { label: string; grade?: number; isStandalone?: boolean }>()

    // 1. Add all configured standalone courses (Geometry, BODMAS, Short Qns, etc.)
    DEFAULT_STANDALONE_COURSES.forEach(c => {
      map.set(c.code, {
        label: courseLabels[c.code] || c.name,
        isStandalone: true
      })
    })

    // 2. Add all configured grade courses
    Object.entries(DEFAULT_GRADE_COURSES).forEach(([gStr, list]) => {
      const gNum = Number(gStr)
      list.forEach(c => {
        map.set(c.code, {
          label: courseLabels[c.code] || c.name,
          grade: gNum
        })
      })
    })

    // 3. Add dynamic custom courseLabels passed in or found in rawList
    Object.entries(courseLabels).forEach(([code, label]) => {
      if (!map.has(code)) {
        map.set(code, { label })
      }
    })

    rawList.forEach((item: any) => {
      if (item.class_type && !map.has(item.class_type)) {
        const lbl = courseLabels[item.class_type] || CLASS_LABELS[item.class_type] || item.class_type
        map.set(item.class_type, {
          label: lbl,
          grade: getGradeFromPayment(item) || item.students?.grade
        })
      } else if (item.enrollments && Array.isArray(item.enrollments)) {
        item.enrollments.forEach((e: any) => {
          if (e.class_type && !map.has(e.class_type)) {
            const lbl = courseLabels[e.class_type] || CLASS_LABELS[e.class_type] || e.class_type
            map.set(e.class_type, {
              label: lbl,
              grade: item.students?.grade || item.grade
            })
          }
        })
      }
    })

    // Filter courses if a specific grade is selected (keep standalone courses accessible across all grades)
    const list: { code: string; label: string; group: string }[] = []
    map.forEach((data, code) => {
      if (selectedGrade !== 'ALL') {
        const selG = Number(selectedGrade)
        // If course is tied to a different grade and not standalone, exclude it
        if (data.grade && data.grade !== selG && !data.isStandalone) {
          return
        }
      }

      list.push({
        code,
        label: data.label,
        group: data.isStandalone ? 'Specialist / Standalone Courses' : data.grade ? `Grade ${data.grade} Classes` : 'Other Classes'
      })
    })

    return list
  }, [rawList, courseLabels, selectedGrade])

  // Deduplicate and filter students to LMS export item: { name, mobile, ps_code, grade, class_type }
  const filteredStudents = useMemo(() => {
    const studentMap = new Map<string, { name: string; mobile: string; ps_code: string; grade: number; class_type: string }>()

    rawList.forEach((item: any) => {
      const ps = item.students?.ps_code || item.ps_code || item.student_id || ''
      const name = item.students?.full_name || item.full_name || 'Student'
      const gr = getGradeFromPayment(item) || Number(item.students?.grade || item.grade || 0)
      const phone = item.students?.household?.parent_phone || item.household?.parent_phone || item.parent_phone || ''
      const cls = item.class_type || (item.enrollments && item.enrollments[0]?.class_type) || 'GENERAL'

      // Apply Grade Filter (unless standalone course is specifically selected)
      if (selectedGrade !== 'ALL' && String(gr) !== selectedGrade) {
        // If user specifically picked a standalone course (e.g. Geometry), allow cross-grade matching
        const isStandaloneMatch = selectedClassType !== 'ALL' && (cls === selectedClassType || (item.enrollments && item.enrollments.some((e: any) => e.class_type === selectedClassType)))
        if (!isStandaloneMatch) {
          return
        }
      }

      // Apply Course Filter
      if (selectedClassType !== 'ALL') {
        if (item.class_type) {
          if (item.class_type !== selectedClassType) return
        } else if (item.enrollments && Array.isArray(item.enrollments)) {
          const hasCourse = item.enrollments.some((e: any) => e.class_type === selectedClassType)
          if (!hasCourse) return
        } else {
          return
        }
      }

      // Apply Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matches =
          ps.toLowerCase().includes(q) ||
          name.toLowerCase().includes(q) ||
          phone.toLowerCase().includes(q)
        if (!matches) return
      }

      // Ensure valid mobile
      const formattedMobile = formatMobileForLms(phone)
      if (!formattedMobile || formattedMobile.length < 9) return

      // Deduplicate by mobile + class
      const dedupeKey = `${formattedMobile}_${selectedClassType === 'ALL' ? 'ALL' : cls}`
      if (!studentMap.has(dedupeKey)) {
        studentMap.set(dedupeKey, {
          name,
          mobile: formattedMobile,
          ps_code: ps,
          grade: gr,
          class_type: cls
        })
      }
    })

    return Array.from(studentMap.values())
  }, [rawList, selectedGrade, selectedClassType, searchQuery])

  // Copy line-by-line numbers
  function copyNumbersLineByLine() {
    const numbers = filteredStudents.map(s => s.mobile).join('\n')
    navigator.clipboard.writeText(numbers)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  // Copy comma-separated numbers
  function copyNumbersCommaSeparated() {
    const numbers = filteredStudents.map(s => s.mobile).join(', ')
    navigator.clipboard.writeText(numbers)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  // Export LMS Bulk CSV (assign-billing-bulk-sample.csv format: name,mobile)
  function handleExportCsv() {
    const gradeLabel = selectedGrade === 'ALL' ? 'AllGrades' : `Grade_${selectedGrade}`
    const courseLabel = selectedClassType === 'ALL' ? 'AllCourses' : (courseLabels[selectedClassType] || selectedClassType).replace(/[\s\(\)\/\:]+/g, '_')
    const sourceLabel = sourceType === 'daily'
      ? `${startDate}_to_${endDate}`
      : sourceType === 'monthly'
        ? `${MONTH_NAMES[selectedMonth - 1]}_${selectedYear}_Recordings`
        : `NewRegistrations_${selectedYear}`
    
    const filename = `LMS_Billing_Bulk_${gradeLabel}_${courseLabel}_${sourceLabel}`

    exportLmsBulkCsv(filename, filteredStudents)
  }

  // Generate Year options (current year down to past 3 years, plus next year)
  const currentActualYear = new Date().getFullYear()
  const yearOptions = [currentActualYear + 1, currentActualYear, currentActualYear - 1, currentActualYear - 2, currentActualYear - 3]

  return (
    <div className="fade-in">
      {/* Top Banner */}
      <div className="glass-card" style={{ padding: 20, marginBottom: 20, borderLeft: '4px solid var(--accent-blue)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Video size={20} style={{ color: 'var(--accent-blue)' }} />
            LMS Bulk Billing &amp; Past Recording Access Exporter
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Filter paid students from any <strong>Previous Month (e.g. August, July, January)</strong> or today&apos;s verified batches, and export in <code style={{ color: '#38bdf8' }}>name,mobile</code> format for LMS video access.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={copyNumbersCommaSeparated}
            disabled={filteredStudents.length === 0}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
          >
            {copied ? <Check size={16} style={{ color: '#10b981' }} /> : <Copy size={16} />}
            {copied ? 'Copied!' : 'Copy Numbers'}
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredStudents.length === 0}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, background: '#10b981' }}
          >
            <Download size={16} /> Export LMS CSV ({filteredStudents.length})
          </button>
        </div>
      </div>

      {/* Control & Filter Center */}
      <div className="glass-card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          
          {/* 1. Source Dataset Toggle */}
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6, fontWeight: 700 }}>
              1. Access Period / Source
            </label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setSourceType('monthly')}
                className={sourceType === 'monthly' ? 'btn-primary' : 'btn-secondary'}
                style={{ padding: '6px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Video size={14} />
                📹 Monthly / Previous Month Recording
              </button>
              <button
                type="button"
                onClick={() => setSourceType('daily')}
                className={sourceType === 'daily' ? 'btn-primary' : 'btn-secondary'}
                style={{ padding: '6px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Calendar size={14} />
                📅 Day-End / Range ({startDate === endDate ? startDate : `${startDate} to ${endDate}`})
              </button>
              <button
                type="button"
                onClick={() => setSourceType('registrations')}
                className={sourceType === 'registrations' ? 'btn-primary' : 'btn-secondary'}
                style={{ padding: '6px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                🎓 New Registrations
              </button>
            </div>
          </div>

          {/* 1.5. Previous Month & Year Selectors (Active when sourceType is 'monthly') */}
          {sourceType === 'monthly' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(56,189,248,0.08)',
              padding: '6px 12px',
              borderRadius: 10,
              border: '1px solid rgba(56,189,248,0.25)'
            }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--accent-blue)', textTransform: 'uppercase', display: 'block', marginBottom: 2, fontWeight: 800 }}>
                  Select Month
                </label>
                <select
                  className="select-input"
                  style={{ padding: '4px 8px', fontSize: 12, fontWeight: 700, minWidth: 120 }}
                  value={selectedMonth}
                  onChange={e => {
                    const newM = Number(e.target.value)
                    setSelectedMonth(newM)
                    if (setMonth) setMonth(newM)
                  }}
                >
                  {MONTH_NAMES.map((mName, idx) => (
                    <option key={idx + 1} value={idx + 1}>
                      {mName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 10, color: 'var(--accent-blue)', textTransform: 'uppercase', display: 'block', marginBottom: 2, fontWeight: 800 }}>
                  Year
                </label>
                <select
                  className="select-input"
                  style={{ padding: '4px 8px', fontSize: 12, fontWeight: 700, minWidth: 80 }}
                  value={selectedYear}
                  onChange={e => {
                    const newY = Number(e.target.value)
                    setSelectedYear(newY)
                    if (setYear) setYear(newY)
                  }}
                >
                  {yearOptions.map(y => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              {loadingCustomMonth && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--accent-blue)', marginLeft: 4 }}>
                  <RotateCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> Loading...
                </div>
              )}
            </div>
          )}

          {/* 2. Grade Selector */}
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6, fontWeight: 700 }}>
              2. Filter Grade
            </label>
            <select
              className="select-input"
              style={{ padding: '6px 12px', minWidth: 150 }}
              value={selectedGrade}
              onChange={e => setSelectedGrade(e.target.value)}
            >
              <option value="ALL">All Grades (5–11)</option>
              {availableGrades.map(g => (
                <option key={g} value={String(g)}>
                  Grade {g}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Class / Subject Selector */}
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6, fontWeight: 700 }}>
              3. Filter Course / Subject
            </label>
            <select
              className="select-input"
              style={{ padding: '6px 12px', minWidth: 260 }}
              value={selectedClassType}
              onChange={e => setSelectedClassType(e.target.value)}
            >
              <option value="ALL">All Courses &amp; Subjects</option>
              {Array.from(new Set(availableCourses.map(c => c.group))).map(groupName => (
                <optgroup key={groupName} label={groupName}>
                  {availableCourses
                    .filter(c => c.group === groupName)
                    .map(c => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* 4. Search Filter */}
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6, fontWeight: 700 }}>
              Search Filter
            </label>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="search-bar"
                placeholder="Search student, mobile, PS code..."
                style={{ width: '100%', paddingLeft: 30, fontSize: 12 }}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Summary Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div className="stat-card" style={{ borderLeft: '4px solid #10b981', boxShadow: '0 4px 20px -4px rgba(16, 185, 129, 0.25)' }}>
          <div className="stat-card label">Total Numbers Ready for LMS</div>
          <div className="stat-card value" style={{ color: '#10b981', fontSize: 26 }}>
            {filteredStudents.length} Students
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Formatted to 10-digit mobile (07XXXXXXXX)
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #38bdf8', boxShadow: '0 4px 20px -4px rgba(56, 189, 248, 0.25)' }}>
          <div className="stat-card label">Active Recording Scope</div>
          <div className="stat-card value" style={{ color: '#38bdf8', fontSize: 22 }}>
            {sourceType === 'monthly'
              ? `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`
              : sourceType === 'daily'
                ? startDate
                : 'Registrations'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            {selectedGrade === 'ALL' ? 'All Grades' : `Grade ${selectedGrade}`} • {selectedClassType === 'ALL' ? 'All Subjects' : (courseLabels[selectedClassType] || selectedClassType)}
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b', boxShadow: '0 4px 20px -4px rgba(245, 158, 11, 0.25)' }}>
          <div className="stat-card label">CSV Template Specification</div>
          <div className="stat-card value" style={{ color: '#f59e0b', fontSize: 20 }}>
            name,mobile
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Strictly matches <code style={{ color: '#f59e0b' }}>assign-billing-bulk-sample.csv</code>
          </div>
        </div>
      </div>

      {/* Preview Table */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={16} style={{ color: 'var(--accent-blue)' }} />
            LMS Bulk Batch Preview ({filteredStudents.length} Records for {sourceType === 'monthly' ? `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}` : 'Selected Filter'})
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={copyNumbersLineByLine}
              className="btn-secondary"
              style={{ fontSize: 12, padding: '4px 10px' }}
            >
              Copy Line-by-Line (Enter)
            </button>
            <button
              type="button"
              onClick={copyNumbersCommaSeparated}
              className="btn-secondary"
              style={{ fontSize: 12, padding: '4px 10px' }}
            >
              Copy Comma-Separated
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto', maxHeight: 520 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 60 }}>#</th>
                <th>name (LMS Column 1)</th>
                <th>mobile (LMS Column 2)</th>
                <th>PS Code</th>
                <th>Grade</th>
                <th>Class / Course</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((s, idx) => (
                <tr key={`${s.mobile}-${s.ps_code}-${idx}`}>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{idx + 1}</td>
                  <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{s.name}</td>
                  <td style={{ fontWeight: 800, color: '#10b981', fontFamily: 'monospace', fontSize: 13 }}>
                    {s.mobile}
                  </td>
                  <td>
                    <span className="badge" style={{ background: 'rgba(56,189,248,0.12)', color: 'var(--accent-blue)', fontWeight: 700 }}>
                      {s.ps_code}
                    </span>
                  </td>
                  <td>Grade {s.grade || '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {courseLabels[s.class_type] || CLASS_LABELS[s.class_type] || s.class_type}
                  </td>
                </tr>
              ))}

              {filteredStudents.length === 0 && !loadingCustomMonth && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                    No paid students found for {sourceType === 'monthly' ? `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}` : 'the selected criteria'}.
                  </td>
                </tr>
              )}

              {loadingCustomMonth && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                    <div style={{ width: 24, height: 24, border: '2px solid rgba(56,189,248,0.2)', borderTopColor: 'var(--accent-blue)', borderRadius: '50%', margin: '0 auto 8px', animation: 'spin 0.8s linear infinite' }} />
                    Loading paid student records for {MONTH_NAMES[selectedMonth - 1]} {selectedYear}...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
