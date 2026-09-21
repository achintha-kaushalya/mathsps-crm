'use client'

import { useState, useMemo } from 'react'
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
  Layers
} from 'lucide-react'
import { CLASS_LABELS } from '@/lib/types'
import { exportLmsBulkCsv, formatMobileForLms } from '@/lib/reports-analytics'

interface LmsBulkExporterTabProps {
  dailyPayments: any[]
  allPaymentsMonth: any[]
  newStudents: any[]
  courseLabels: Record<string, string>
  month: number
  year: number
  startDate: string
  endDate: string
}

export default function LmsBulkExporterTab({
  dailyPayments,
  allPaymentsMonth,
  newStudents,
  courseLabels,
  month,
  year,
  startDate,
  endDate
}: LmsBulkExporterTabProps) {
  // Source dataset: 'daily' (today/date range) | 'monthly' (selected month) | 'registrations'
  const [sourceType, setSourceType] = useState<'daily' | 'monthly' | 'registrations'>('daily')

  // Filters
  const [selectedGrade, setSelectedGrade] = useState<string>('ALL')
  const [selectedClassType, setSelectedClassType] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [copied, setCopied] = useState(false)

  // Determine active raw dataset
  const rawList = useMemo(() => {
    if (sourceType === 'daily') {
      return dailyPayments
    } else if (sourceType === 'monthly') {
      return allPaymentsMonth
    } else {
      return newStudents
    }
  }, [sourceType, dailyPayments, allPaymentsMonth, newStudents])

  // Extract distinct grades and distinct courses available in the active dataset
  const availableGrades = useMemo(() => {
    const set = new Set<number>()
    rawList.forEach((item: any) => {
      const gr = item.students?.grade || item.grade
      if (gr) set.add(Number(gr))
    })
    return Array.from(set).sort((a, b) => a - b)
  }, [rawList])

  const availableCourses = useMemo(() => {
    const map = new Map<string, string>()
    rawList.forEach((item: any) => {
      if (item.class_type) {
        const lbl = courseLabels[item.class_type] || CLASS_LABELS[item.class_type] || item.class_type
        map.set(item.class_type, lbl)
      } else if (item.enrollments && Array.isArray(item.enrollments)) {
        item.enrollments.forEach((e: any) => {
          if (e.class_type) {
            const lbl = courseLabels[e.class_type] || CLASS_LABELS[e.class_type] || e.class_type
            map.set(e.class_type, lbl)
          }
        })
      }
    })
    return Array.from(map.entries())
  }, [rawList, courseLabels])

  // Deduplicate and filter students to LMS export item: { name, mobile, ps_code, grade, class_type }
  const filteredStudents = useMemo(() => {
    const studentMap = new Map<string, { name: string; mobile: string; ps_code: string; grade: number; class_type: string }>()

    rawList.forEach((item: any) => {
      const ps = item.students?.ps_code || item.ps_code || item.student_id || ''
      const name = item.students?.full_name || item.full_name || 'Student'
      const gr = Number(item.students?.grade || item.grade || 0)
      const phone = item.students?.household?.parent_phone || item.household?.parent_phone || item.parent_phone || ''
      const cls = item.class_type || (item.enrollments && item.enrollments[0]?.class_type) || 'GENERAL'

      // Apply Grade Filter
      if (selectedGrade !== 'ALL' && String(gr) !== selectedGrade) {
        return
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
    const sourceLabel = sourceType === 'daily' ? `${startDate}_to_${endDate}` : `${month}_${year}`
    const filename = `LMS_Billing_Bulk_${gradeLabel}_${courseLabel}_${sourceLabel}`

    exportLmsBulkCsv(filename, filteredStudents)
  }

  return (
    <div className="fade-in">
      {/* Top Banner */}
      <div className="glass-card" style={{ padding: 20, marginBottom: 20, borderLeft: '4px solid var(--accent-blue)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={20} style={{ color: 'var(--accent-blue)' }} />
            LMS Bulk Billing &amp; Numbers Exporter (assign-billing-bulk-sample.csv)
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Generate and export <code style={{ color: '#38bdf8' }}>name,mobile</code> templates per grade, course, or verified payment batches for instant LMS profile auto-linking.
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
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          
          {/* Source Dataset Toggle */}
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6, fontWeight: 700 }}>
              1. Payment / Student Source
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={() => setSourceType('daily')}
                className={sourceType === 'daily' ? 'btn-primary' : 'btn-secondary'}
                style={{ padding: '6px 14px', fontSize: 12 }}
              >
                📅 Day-End / Range ({startDate === endDate ? startDate : `${startDate} to ${endDate}`})
              </button>
              <button
                type="button"
                onClick={() => setSourceType('monthly')}
                className={sourceType === 'monthly' ? 'btn-primary' : 'btn-secondary'}
                style={{ padding: '6px 14px', fontSize: 12 }}
              >
                📆 Monthly Matrix ({month}/{year})
              </button>
              <button
                type="button"
                onClick={() => setSourceType('registrations')}
                className={sourceType === 'registrations' ? 'btn-primary' : 'btn-secondary'}
                style={{ padding: '6px 14px', fontSize: 12 }}
              >
                🎓 New Registrations
              </button>
            </div>
          </div>

          {/* Grade Selector */}
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

          {/* Class / Subject Selector */}
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6, fontWeight: 700 }}>
              3. Filter Course / Subject
            </label>
            <select
              className="select-input"
              style={{ padding: '6px 12px', minWidth: 220 }}
              value={selectedClassType}
              onChange={e => setSelectedClassType(e.target.value)}
            >
              <option value="ALL">All Courses / Subjects</option>
              {availableCourses.map(([cKey, cLabel]) => (
                <option key={cKey} value={cKey}>
                  {cLabel}
                </option>
              ))}
            </select>
          </div>

          {/* Search Bar */}
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
          <div className="stat-card label">Active Grade Scope</div>
          <div className="stat-card value" style={{ color: '#38bdf8', fontSize: 24 }}>
            {selectedGrade === 'ALL' ? 'All Grades' : `Grade ${selectedGrade}`}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            {selectedClassType === 'ALL' ? 'All Subjects' : (courseLabels[selectedClassType] || selectedClassType)}
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
            LMS Bulk Batch Preview ({filteredStudents.length} Records)
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

              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                    No students with valid phone numbers found for the selected grade / course criteria.
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
