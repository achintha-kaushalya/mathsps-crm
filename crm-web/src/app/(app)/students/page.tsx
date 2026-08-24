'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, Plus, ArrowLeft } from 'lucide-react'
import { Student } from '@/lib/types'

export default function StudentsPage() {
  const supabase = createClient()
  const [students, setStudents] = useState<Student[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [gradeFilter, setGradeFilter] = useState('')
  const [page, setPage] = useState(0)
  const searchTimeout = useRef<NodeJS.Timeout | undefined>(undefined)
  const PAGE_SIZE = 50

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => { setPage(0); loadStudents(0) }, 300)
    return () => clearTimeout(searchTimeout.current)
  }, [search, gradeFilter])

  useEffect(() => { loadStudents(page) }, [page])

  async function loadStudents(p: number) {
    setLoading(true)
    try {
      let q = supabase.from('students').select(`
        *, household:households(parent_name, address, area)
      `, { count: 'exact' })

      const activeTutor = typeof window !== 'undefined' ? (localStorage.getItem('mathsps_active_tutor') || 'prabuddha') : 'prabuddha'
      const tutorPrefix = activeTutor === 'sanduni' ? 'SM' : 'PS'

      if (search.trim()) {
        const raw = search.trim()
        const cleanDigits = raw.replace(/\D/g, '')
        const cleanCode = raw.toUpperCase().replace(/\s+/g, '')

        // Build targeted OR conditions:
        // 1. Exact match PS code (e.g. PS67)
        // 2. Starts with code (e.g. PS67%)
        // 3. Name or school contains search string
        const orClauses: string[] = [
          `ps_code.ilike.${cleanCode}`,
          `ps_code.ilike.${cleanCode}%`,
          `full_name.ilike.%${raw}%`,
          `school.ilike.%${raw}%`
        ]

        if (cleanDigits) {
          orClauses.push(`ps_code.ilike.${tutorPrefix}${cleanDigits}`)
          orClauses.push(`ps_code.ilike.${tutorPrefix}${cleanDigits}%`)
          orClauses.push(`ps_code.ilike.%${cleanDigits}%`)
        } else {
          orClauses.push(`ps_code.ilike.%${cleanCode}%`)
        }

        q = q.or(orClauses.join(','))
      } else {
        // Filter by active tutor's code prefix if no search query
        q = q.ilike('ps_code', `${tutorPrefix}%`)
      }
      if (gradeFilter) q = q.eq('grade', parseInt(gradeFilter))

      q = q.order('created_at', { ascending: false }).range(p * PAGE_SIZE, (p + 1) * PAGE_SIZE - 1)
      const { data, count } = await q

      // Smart Sorting for Search Results:
      // 1. Exact match code first (e.g. PS67)
      // 2. Code starting with search (e.g. PS675)
      // 3. Real registered students (with full_name) before unassigned placeholder slots
      // 4. Shortest code length
      const rawSearch = search.trim().toUpperCase().replace(/\s+/g, '')
      const sortedData = (data || []).sort((a, b) => {
        if (rawSearch) {
          const aCode = (a.ps_code || '').toUpperCase()
          const bCode = (b.ps_code || '').toUpperCase()

          // Exact match
          if (aCode === rawSearch && bCode !== rawSearch) return -1
          if (bCode === rawSearch && aCode !== rawSearch) return 1

          // Starts with search code
          const aStarts = aCode.startsWith(rawSearch)
          const bStarts = bCode.startsWith(rawSearch)
          if (aStarts && !bStarts) return -1
          if (!aStarts && bStarts) return 1

          // Real registered students (having actual names) rank higher
          const aHasName = !!(a.full_name && a.full_name !== 'System Auto-Pre-generated')
          const bHasName = !!(b.full_name && b.full_name !== 'System Auto-Pre-generated')
          if (aHasName && !bHasName) return -1
          if (!aHasName && bHasName) return 1

          // Shorter codes first (PS67 before PS6700)
          return aCode.length - bCode.length
        }
        return 0
      })

      setStudents(sortedData)
      setTotal(count || 0)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Students</h1>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
            {total.toLocaleString()} students in payment system
          </div>
        </div>
        <a href="/students/new" className="btn-primary">
          <Plus size={14} /> Add Student
        </a>
      </div>

      {/* Filters */}
      <div style={{ padding: '12px 28px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="search-bar" style={{ paddingLeft: 36 }}
            placeholder="Search PS code, name, school..." value={search}
            onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input-field" style={{ width: 120 }} value={gradeFilter} onChange={e => setGradeFilter(e.target.value)}>
          <option value="">All Grades</option>
          {[6,7,8,9,10,11].map(g => <option key={g} value={g}>Grade {g}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>PS Code</th>
              <th>Name</th>
              <th>Grade</th>
              <th>School</th>
              <th>Area</th>
              <th>Address</th>
              <th>CRM Link</th>
            </tr>
          </thead>
          <tbody>
            {students.map(s => (
              <tr key={s.id}>
                <td>
                  <a href={`/students/${encodeURIComponent(s.ps_code)}`}
                    style={{ color: 'var(--accent-blue)', fontWeight: 600, textDecoration: 'none', fontSize: 12 }}>
                    {s.ps_code}
                  </a>
                </td>
                <td style={{ fontWeight: 500 }}>{s.full_name || <span style={{ color: 'var(--text-muted)' }}>Not set</span>}</td>
                <td style={{ textAlign: 'center' }}>
                  {s.grade ? (
                    <span className="badge" style={{ background: '#1e3a5f', color: '#60a5fa' }}>Gr {s.grade}</span>
                  ) : '—'}
                </td>
                <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{s.school || '—'}</td>
                <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  {(s.household as any)?.area || '—'}
                </td>
                <td style={{ color: 'var(--text-muted)', fontSize: 11, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {(s.household as any)?.address || <span style={{ color: '#3b1a1a' }}>No address</span>}
                </td>
                <td>
                  {s.fcode_ref ? (
                    <a href={`/leads/${s.fcode_ref}`} style={{ color: 'var(--accent-purple)', fontSize: 12, textDecoration: 'none' }}>
                      {s.fcode_ref}
                    </a>
                  ) : <span style={{ color: 'var(--border-light)', fontSize: 11 }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ padding: '12px 28px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center' }}>
        <button className="btn-secondary" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>← Prev</button>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total.toLocaleString()}
        </span>
        <button className="btn-secondary" onClick={() => setPage(p => p + 1)} disabled={(page + 1) * PAGE_SIZE >= total}>Next →</button>
      </div>
    </div>
  )
}
