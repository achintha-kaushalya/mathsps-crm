'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Truck,
  Printer,
  Search,
  CheckCircle2,
  Package,
  History,
  Check,
  RotateCcw,
  Clock,
  AlertCircle,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Phone,
  MapPin,
  Sparkles,
  Layers,
  Send,
  Download,
  Filter,
  X,
  ChevronDown,
  GraduationCap,
  BookOpen,
  CheckSquare,
  Square
} from 'lucide-react'
import { CLASS_LABELS, MONTH_NAMES } from '@/lib/types'
import {
  DEFAULT_GRADE_COURSES,
  DEFAULT_STANDALONE_COURSES,
  CourseConfig,
  getAllCourseLabels
} from '@/lib/courses'

interface DeliveryStudentItem {
  paymentId: string
  studentId: string
  ps_code: string
  full_name: string
  grade: number
  class_type: string
  date_paid: string
  notes: string
  dispatched: boolean
  batch_id?: string
  dispatched_at?: string
}

interface DeliveryGroup {
  household_id: string
  parent_name: string
  parent_phone: string
  address: string
  area: string
  isDispatched: boolean
  latestBatchId?: string
  dispatchedAt?: string
  students: DeliveryStudentItem[]
}

const AVAILABLE_GRADES = [5, 6, 7, 8, 9, 10, 11, 12, 13]

export default function DeliveryPage() {
  const supabase = createClient()

  // Active Tab: 'unexported' (Ready to Dispatch) vs 'dispatched' (Already Exported History)
  const [activeTab, setActiveTab] = useState<'unexported' | 'dispatched'>('unexported')

  const [allGroups, setAllGroups] = useState<DeliveryGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())

  // Dynamic Course Config & Labels State
  const [gradeCourses, setGradeCourses] = useState<Record<number, CourseConfig[]>>(DEFAULT_GRADE_COURSES)
  const [standaloneCourses, setStandaloneCourses] = useState<CourseConfig[]>(DEFAULT_STANDALONE_COURSES)
  const [courseLabels, setCourseLabels] = useState<Record<string, string>>(() => getAllCourseLabels(DEFAULT_GRADE_COURSES, DEFAULT_STANDALONE_COURSES))

  // Multi-Choice Filters
  const [selectedGrades, setSelectedGrades] = useState<number[]>([])
  const [selectedCourses, setSelectedCourses] = useState<string[]>([])
  const [includeStandaloneOnly, setIncludeStandaloneOnly] = useState(false)
  const [areaFilter, setAreaFilter] = useState('')
  const [areas, setAreas] = useState<string[]>([])
  const [search, setSearch] = useState('')

  // Popover state for Course dropdown filter
  const [isCourseDropdownOpen, setIsCourseDropdownOpen] = useState(false)
  const [courseSearch, setCourseSearch] = useState('')
  const courseDropdownRef = useRef<HTMLDivElement>(null)

  // Pagination State for high performance (solves browser DOM lag with 2,300+ items)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(36)

  // Batch action state
  const [selectedHouseholds, setSelectedHouseholds] = useState<Set<string>>(new Set())
  const [marking, setMarking] = useState(false)
  const [actionMessage, setActionMessage] = useState('')

  // Load Admin Course Configuration (localStorage + Supabase + Realtime)
  useEffect(() => {
    function hydrateCoursesFromCache() {
      try {
        const cached = localStorage.getItem('MATHSPS_COURSES_CACHE')
        if (cached) {
          const parsed = JSON.parse(cached)
          if (parsed.gradeCourses && parsed.standaloneCourses) {
            setGradeCourses(parsed.gradeCourses)
            setStandaloneCourses(parsed.standaloneCourses)
            setCourseLabels(getAllCourseLabels(parsed.gradeCourses, parsed.standaloneCourses))
          }
        }
      } catch (e) {
        console.error('Error hydrating courses cache:', e)
      }
    }

    hydrateCoursesFromCache()

    async function fetchServerCourses() {
      try {
        const { data } = await supabase
          .from('members')
          .select('notes')
          .ilike('notes', '%SYSTEM_COURSES_CONFIG%')
          .limit(1)

        if (data && data[0]?.notes) {
          const match = data[0].notes.match(/\[SYSTEM_COURSES_CONFIG:\s*(\{.+?\})\]/)
          if (match) {
            const parsed = JSON.parse(match[1])
            if (parsed.gradeCourses && parsed.standaloneCourses) {
              setGradeCourses(parsed.gradeCourses)
              setStandaloneCourses(parsed.standaloneCourses)
              setCourseLabels(getAllCourseLabels(parsed.gradeCourses, parsed.standaloneCourses))
              localStorage.setItem('MATHSPS_COURSES_CACHE', JSON.stringify(parsed))
            }
          }
        }
      } catch (err) {
        console.error('Error loading server courses:', err)
      }
    }

    fetchServerCourses()

    // Realtime channel listener for instant course updates
    const channel = supabase.channel('delivery-courses-sync')
      .on('broadcast', { event: 'courses-updated' }, (payload: any) => {
        if (payload?.payload?.gradeCourses) {
          setGradeCourses(payload.payload.gradeCourses)
          setStandaloneCourses(payload.payload.standaloneCourses || [])
          setCourseLabels(getAllCourseLabels(payload.payload.gradeCourses, payload.payload.standaloneCourses || []))
        }
      })
      .subscribe()

    // Close course dropdown on outside click
    function handleClickOutside(e: MouseEvent) {
      if (courseDropdownRef.current && !courseDropdownRef.current.contains(e.target as Node)) {
        setIsCourseDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      supabase.removeChannel(channel)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  useEffect(() => {
    loadDeliveryList()
  }, [month, year])

  // Reset to page 1 on filter or tab change
  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab, search, selectedGrades, selectedCourses, includeStandaloneOnly, areaFilter, pageSize])

  async function loadDeliveryList() {
    setLoading(true)
    try {
      // 1. Fetch ALL eligible payments for this month where tute is explicitly marked to be delivered (paginated to exceed 1,000 limit)
      const CHUNK_SIZE = 1000
      let allRows: any[] = []
      let from = 0
      let hasMore = true

      while (hasMore) {
        const { data, error } = await supabase
          .from('payments')
          .select(`
            id, student_id, class_type, month, year, amount_paid, payment_type, tute_delivered, date_paid, notes,
            students!inner(
              id, ps_code, full_name, grade, household_id,
              households(id, parent_name, address, area, parent_phone)
            )
          `)
          .eq('month', month)
          .eq('year', year)
          .eq('tute_delivered', true)
          .range(from, from + CHUNK_SIZE - 1)

        if (error) throw error

        allRows = allRows.concat(data || [])
        if (!data || data.length < CHUNK_SIZE) {
          hasMore = false
        } else {
          from += CHUNK_SIZE
        }
      }

      const groupedMap: Record<string, DeliveryGroup> = {}
      const areaSet = new Set<string>()

      allRows.forEach((item: any) => {
        const stu = item.students
        const hh = stu?.households
        const key = hh?.id || `no-hh-${stu.id}`

        const areaName = hh?.area || 'Unassigned Area'
        if (hh?.area) areaSet.add(hh.area)

        // Parse dispatch notes if saved in notes format: [DISPATCHED: BATCH_YYYYMMDD_HHMM]
        const isItemDispatched = (item.notes || '').includes('[DISPATCHED:')
        let batchId = ''
        let dispatchedAt = ''

        if (isItemDispatched) {
          const match = item.notes.match(/\[DISPATCHED:\s*([^\]]+)\]/)
          if (match) {
            batchId = match[1].trim()
            dispatchedAt = batchId.replace('BATCH_', '')
          }
        }

        if (!groupedMap[key]) {
          groupedMap[key] = {
            household_id: key,
            parent_name: hh?.parent_name || stu.full_name || 'Parent / Student',
            parent_phone: hh?.parent_phone || '',
            address: hh?.address || 'No address provided',
            area: areaName,
            isDispatched: isItemDispatched,
            latestBatchId: batchId,
            dispatchedAt: dispatchedAt,
            students: [],
          }
        }

        // Add class item
        const existingStudentIndex = groupedMap[key].students.findIndex(
          s => s.paymentId === item.id
        )
        if (existingStudentIndex === -1) {
          groupedMap[key].students.push({
            paymentId: item.id,
            studentId: stu.id,
            ps_code: stu.ps_code,
            full_name: stu.full_name || 'Student',
            grade: stu.grade || 0,
            class_type: item.class_type,
            date_paid: item.date_paid || '',
            notes: item.notes || '',
            dispatched: isItemDispatched,
            batch_id: batchId,
            dispatched_at: dispatchedAt,
          })
        }
      })

      // Determine household dispatch status:
      // A household has pending items if at least one class item is NOT dispatched
      Object.values(groupedMap).forEach(group => {
        const hasPendingItems = group.students.some(st => !st.dispatched)
        group.isDispatched = !hasPendingItems
      })

      const result = Object.values(groupedMap)
      setAreas(Array.from(areaSet).sort())
      setAllGroups(result)

      // Auto-select all unexported by default
      const unexp = new Set(result.filter(g => !g.isDispatched).map(g => g.household_id))
      setSelectedHouseholds(unexp)

    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // Get all available course options across gradeCourses, standaloneCourses, and existing student payments
  const allCourseOptions = useMemo(() => {
    const list: { code: string; name: string; grade?: number; isStandalone?: boolean }[] = []
    const seenCodes = new Set<string>()

    // 1. Grade courses
    Object.entries(gradeCourses).forEach(([gr, courses]) => {
      courses.forEach(c => {
        if (!seenCodes.has(c.code)) {
          seenCodes.add(c.code)
          list.push({ code: c.code, name: c.name, grade: parseInt(gr), isStandalone: false })
        }
      })
    })

    // 2. Standalone courses
    standaloneCourses.forEach(c => {
      if (!seenCodes.has(c.code)) {
        seenCodes.add(c.code)
        list.push({ code: c.code, name: c.name, isStandalone: true })
      }
    })

    // 3. Fallback from CLASS_LABELS and active groups
    allGroups.forEach(g => {
      g.students.forEach(st => {
        if (!seenCodes.has(st.class_type)) {
          seenCodes.add(st.class_type)
          list.push({
            code: st.class_type,
            name: courseLabels[st.class_type] || CLASS_LABELS[st.class_type] || st.class_type,
            grade: st.grade,
            isStandalone: st.grade === 0
          })
        }
      })
    })

    return list
  }, [gradeCourses, standaloneCourses, allGroups, courseLabels])

  // Filter based on active tab + multi-grade + multi-course + standalone + area + search
  const visibleGroups = useMemo(() => {
    return allGroups
      .filter(g => (activeTab === 'unexported' ? !g.isDispatched : g.isDispatched))
      .filter(g => {
        // Area Filter
        if (areaFilter && g.area !== areaFilter) {
          return false
        }

        const targetStudents = activeTab === 'unexported'
          ? g.students.filter(st => !st.dispatched)
          : g.students

        // If target students list is empty for this tab, skip
        if (targetStudents.length === 0) return false

        // Multi-Select Grade Filter
        if (selectedGrades.length > 0) {
          const hasMatchingGrade = targetStudents.some(st => selectedGrades.includes(st.grade))
          if (!hasMatchingGrade) return false
        }

        // Multi-Select Course Filter
        if (selectedCourses.length > 0) {
          const hasMatchingCourse = targetStudents.some(st => selectedCourses.includes(st.class_type))
          if (!hasMatchingCourse) return false
        }

        // Standalone Courses Filter Toggle
        if (includeStandaloneOnly) {
          const hasStandalone = targetStudents.some(st => {
            const isStandaloneCode = standaloneCourses.some(sc => sc.code === st.class_type)
            return isStandaloneCode || st.grade === 0
          })
          if (!hasStandalone) return false
        }

        // Text Search
        if (search.trim()) {
          const s = search.toLowerCase()
          const matchesSearch =
            g.parent_name.toLowerCase().includes(s) ||
            g.address.toLowerCase().includes(s) ||
            g.area.toLowerCase().includes(s) ||
            g.parent_phone.toLowerCase().includes(s) ||
            targetStudents.some(st => {
              const label = (courseLabels[st.class_type] || CLASS_LABELS[st.class_type] || st.class_type).toLowerCase()
              return (
                st.ps_code.toLowerCase().includes(s) ||
                st.full_name.toLowerCase().includes(s) ||
                label.includes(s)
              )
            })
          if (!matchesSearch) return false
        }

        return true
      })
  }, [allGroups, activeTab, areaFilter, selectedGrades, selectedCourses, includeStandaloneOnly, search, standaloneCourses, courseLabels])

  // Count summaries
  const unexportedCount = useMemo(() => allGroups.filter(g => !g.isDispatched).length, [allGroups])
  const dispatchedCount = useMemo(() => allGroups.filter(g => g.isDispatched).length, [allGroups])

  const totalTutesCount = useMemo(() => {
    return visibleGroups.reduce((acc, g) => {
      const count = activeTab === 'unexported'
        ? g.students.filter(st => !st.dispatched).length
        : g.students.length
      return acc + count
    }, 0)
  }, [visibleGroups, activeTab])

  // Paginated Slicing for fast DOM rendering
  const totalPages = Math.max(1, Math.ceil(visibleGroups.length / pageSize))
  const paginatedGroups = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return visibleGroups.slice(start, start + pageSize)
  }, [visibleGroups, currentPage, pageSize])

  function toggleSelectHousehold(hhId: string) {
    const next = new Set(selectedHouseholds)
    if (next.has(hhId)) {
      next.delete(hhId)
    } else {
      next.add(hhId)
    }
    setSelectedHouseholds(next)
  }

  function toggleSelectAllVisible() {
    if (selectedHouseholds.size === visibleGroups.length && visibleGroups.length > 0) {
      setSelectedHouseholds(new Set())
    } else {
      setSelectedHouseholds(new Set(visibleGroups.map(g => g.household_id)))
    }
  }

  function selectCurrentPageOnly() {
    const next = new Set(selectedHouseholds)
    paginatedGroups.forEach(g => next.add(g.household_id))
    setSelectedHouseholds(next)
  }

  function deselectCurrentPageOnly() {
    const next = new Set(selectedHouseholds)
    paginatedGroups.forEach(g => next.delete(g.household_id))
    setSelectedHouseholds(next)
  }

  // Batch Export & Auto-Mark as Dispatched
  async function exportAndMarkBatch() {
    const targetGroups = visibleGroups.filter(g => selectedHouseholds.has(g.household_id))
    if (targetGroups.length === 0) {
      alert('Please select at least one household to export.')
      return
    }

    const now = new Date()
    const timeStampStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
    const humanTime = now.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
    const batchTag = `BATCH_${timeStampStr}`

    // 1. Generate Post Office CSV
    const headers = [
      'BATCH ID',
      'DISPATCH TIME',
      'PS CODE',
      'STUDENT NAME',
      'GRADE',
      'PARENT / RECIPIENT',
      'PHONE',
      'DELIVERY ADDRESS',
      'AREA / ROUTE',
      'ENROLLED CLASSES & TUTES',
      'MONTH / YEAR',
    ]

    const rows: string[][] = []
    const paymentIdsToUpdate: string[] = []

    targetGroups.forEach(g => {
      const itemsToExport = activeTab === 'unexported' ? g.students.filter(st => !st.dispatched) : g.students

      itemsToExport.forEach(st => {
        paymentIdsToUpdate.push(st.paymentId)
        const courseName = courseLabels[st.class_type] || CLASS_LABELS[st.class_type] || st.class_type
        rows.push([
          `"${batchTag}"`,
          `"${humanTime}"`,
          `"${st.ps_code}"`,
          `"${(st.full_name || '').replace(/"/g, '""')}"`,
          `"Grade ${st.grade || '?'}"`,
          `"${(g.parent_name || '').replace(/"/g, '""')}"`,
          `"${(g.parent_phone || '').replace(/"/g, '""')}"`,
          `"${(g.address || '').replace(/"/g, '""')}"`,
          `"${(g.area || '').replace(/"/g, '""')}"`,
          `"${courseName.replace(/"/g, '""')}"`,
          `"${MONTH_NAMES[month - 1]} ${year}"`,
        ])
      })
    })

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Post_Office_Dispatch_${batchTag}_(${targetGroups.length}_Houses).csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    // 2. Mark updated payment records in Supabase
    setMarking(true)
    try {
      for (const pId of paymentIdsToUpdate) {
        const { data: curPay } = await supabase.from('payments').select('notes').eq('id', pId).single()
        const oldNotes = (curPay?.notes || '').replace(/\[DISPATCHED:[^\]]+\]/g, '').trim()
        const newNotes = oldNotes ? `${oldNotes} [DISPATCHED: ${batchTag}]` : `[DISPATCHED: ${batchTag}]`

        await supabase.from('payments').update({ notes: newNotes }).eq('id', pId)
      }

      setActionMessage(`✓ Successfully exported & marked ${targetGroups.length} Houses as Dispatched (${batchTag})!`)
      setTimeout(() => setActionMessage(''), 6000)

      await loadDeliveryList()
    } catch (err: any) {
      alert('Failed to mark batch status: ' + err.message)
    } finally {
      setMarking(false)
    }
  }

  // Restore Dispatched items back to Unexported queue
  async function revertDispatchedBatch(g: DeliveryGroup) {
    if (!confirm(`Revert ${g.parent_name} (${g.students.map(s => s.ps_code).join(', ')}) back to Ready to Export queue?`)) return

    setMarking(true)
    try {
      for (const st of g.students) {
        const { data: curPay } = await supabase.from('payments').select('notes').eq('id', st.paymentId).single()
        const cleanedNotes = (curPay?.notes || '').replace(/\[DISPATCHED:[^\]]+\]/g, '').trim()
        await supabase.from('payments').update({ notes: cleanedNotes || null }).eq('id', st.paymentId)
      }
      await loadDeliveryList()
    } catch (err: any) {
      alert('Failed to revert: ' + err.message)
    } finally {
      setMarking(false)
    }
  }

  function printBatchEnvelopes() {
    const targetGroups = visibleGroups.filter(g => selectedHouseholds.has(g.household_id))
    if (targetGroups.length === 0) {
      alert('No envelopes selected to print.')
      return
    }

    const win = window.open('', '_blank')
    win?.document.write(`
      <html>
        <head>
          <title>Tute Delivery Envelopes — ${MONTH_NAMES[month - 1]} ${year}</title>
          <style>
            @page { size: A4 portrait; margin: 10mm; }
            body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #fff; color: #000; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12mm; }
            .card {
              border: 2px solid #000;
              border-radius: 8px;
              padding: 16px;
              box-sizing: border-box;
              page-break-inside: avoid;
              min-height: 120mm;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
            }
            .header { border-bottom: 2px dashed #000; padding-bottom: 8px; margin-bottom: 12px; }
            .title { font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #555; }
            .to-name { font-size: 16px; font-weight: bold; margin-top: 4px; }
            .phone { font-size: 13px; font-weight: bold; color: #222; margin-top: 2px; }
            .address { font-size: 14px; line-height: 1.4; margin-top: 6px; white-space: pre-line; }
            .area { font-size: 12px; font-weight: bold; margin-top: 6px; background: #eee; padding: 2px 6px; display: inline-block; border-radius: 4px; }
            .pack-list { border-top: 1px solid #ccc; padding-top: 10px; margin-top: 10px; }
            .pack-title { font-size: 11px; font-weight: bold; text-transform: uppercase; margin-bottom: 6px; }
            .item { font-size: 12px; margin-bottom: 4px; }
          </style>
        </head>
        <body onload="window.print()">
          <div class="grid">
            ${targetGroups.map(g => {
              const studentsToPrint = activeTab === 'unexported'
                ? g.students.filter(st => !st.dispatched)
                : g.students

              return `
              <div class="card">
                <div>
                  <div class="header">
                    <div class="title">TUTE DELIVERY ENVELOPE (ONE PACK PER HOUSE)</div>
                    <div class="to-name">To: ${g.parent_name}</div>
                    ${g.parent_phone ? `<div class="phone">📞 Phone: ${g.parent_phone}</div>` : ''}
                    <div class="address">${g.address}</div>
                    <div class="area">AREA: ${g.area}</div>
                  </div>
                </div>
                <div class="pack-list">
                  <div class="pack-title">TUTES INSIDE THIS ENVELOPE:</div>
                  ${studentsToPrint.map(st => {
                    const cName = courseLabels[st.class_type] || CLASS_LABELS[st.class_type] || st.class_type
                    return `
                    <div class="item">
                      ✔ <b>[${st.ps_code}]</b> ${st.full_name} (Gr ${st.grade}) — ${cName}
                    </div>
                  `}).join('')}
                </div>
              </div>
            `}).join('')}
          </div>
        </body>
      </html>
    `)
  }

  const selectedCount = visibleGroups.filter(g => selectedHouseholds.has(g.household_id)).length
  const totalTutesSelected = visibleGroups
    .filter(g => selectedHouseholds.has(g.household_id))
    .reduce((acc, g) => {
      const count = activeTab === 'unexported'
        ? g.students.filter(st => !st.dispatched).length
        : g.students.length
      return acc + count
    }, 0)

  return (
    <div className="fade-in" style={{ paddingBottom: 60 }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', boxShadow: '0 4px 12px rgba(234,88,12,0.25)'
            }}>
              <Truck size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
                Tute Delivery & Post Office Dispatch
              </h1>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                Batch parcel management, one-pack-per-household grouping, and Post Office CSV exports
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {activeTab === 'unexported' ? (
            <>
              <button
                onClick={exportAndMarkBatch}
                disabled={marking || selectedCount === 0}
                className="btn-primary"
                style={{
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontWeight: 600, padding: '9px 18px',
                  boxShadow: '0 4px 12px rgba(16,185,129,0.25)',
                  opacity: selectedCount === 0 ? 0.6 : 1
                }}
              >
                <FileSpreadsheet size={16} />
                {marking ? 'Exporting...' : `Export Post Office CSV (${selectedCount})`}
              </button>
              <button
                onClick={printBatchEnvelopes}
                disabled={selectedCount === 0}
                className="btn-primary"
                style={{
                  background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontWeight: 600, padding: '9px 18px',
                  boxShadow: '0 4px 12px rgba(245,158,11,0.25)',
                  opacity: selectedCount === 0 ? 0.6 : 1
                }}
              >
                <Printer size={16} /> Print Envelopes ({selectedCount})
              </button>
            </>
          ) : (
            <button
              onClick={printBatchEnvelopes}
              disabled={selectedCount === 0}
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', fontWeight: 600 }}
            >
              <Printer size={16} /> Print Selected Envelopes ({selectedCount})
            </button>
          )}
        </div>
      </div>

      <div className="page-content">
        {/* Success Action Message */}
        {actionMessage && (
          <div style={{
            padding: '14px 18px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
            borderRadius: 10, color: '#059669', fontSize: 13, fontWeight: 600, marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 2px 8px rgba(16,185,129,0.08)'
          }}>
            <CheckCircle2 size={18} /> {actionMessage}
          </div>
        )}

        {/* Top KPI Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 22 }}>
          {/* Ready for Export */}
          <div
            onClick={() => {
              setActiveTab('unexported')
              const unexp = new Set(allGroups.filter(g => !g.isDispatched).map(g => g.household_id))
              setSelectedHouseholds(unexp)
            }}
            className="stat-card"
            style={{
              padding: '16px 20px',
              borderRadius: 16,
              borderLeft: '4px solid #f97316',
              boxShadow: activeTab === 'unexported'
                ? '0 8px 24px -4px rgba(249, 115, 22, 0.22)'
                : '0 4px 20px -4px rgba(249, 115, 22, 0.14)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Ready to Export
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
                {unexportedCount} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>houses</span>
              </div>
            </div>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(249, 115, 22, 0.15)', color: '#f97316',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Clock size={20} />
            </div>
          </div>

          {/* Already Dispatched History */}
          <div
            onClick={() => {
              setActiveTab('dispatched')
              setSelectedHouseholds(new Set())
            }}
            className="stat-card"
            style={{
              padding: '16px 20px',
              borderRadius: 16,
              borderLeft: '4px solid #10b981',
              boxShadow: activeTab === 'dispatched'
                ? '0 8px 24px -4px rgba(16, 185, 129, 0.22)'
                : '0 4px 20px -4px rgba(16, 185, 129, 0.14)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Dispatched History
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
                {dispatchedCount} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>houses</span>
              </div>
            </div>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(16, 185, 129, 0.15)', color: '#10b981',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <History size={20} />
            </div>
          </div>

          {/* Selected Status */}
          <div className="stat-card" style={{
            padding: '16px 20px',
            borderRadius: 16,
            borderLeft: '4px solid var(--accent-blue)',
            boxShadow: '0 4px 20px -4px rgba(56, 189, 248, 0.16)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Active Selection
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--accent-blue)', marginTop: 4 }}>
                {selectedCount} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>({totalTutesSelected} tutes)</span>
              </div>
            </div>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(56, 189, 248, 0.15)', color: 'var(--accent-blue)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <CheckCircle2 size={20} />
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div style={{
          padding: '16px 20px',
          background: 'var(--bg-card)',
          borderRadius: 14,
          border: '1px solid var(--border)',
          marginBottom: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 14
        }}>
          {/* Top Row: Month, Year, Course Filter, Area, and Search */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {/* Month */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                Month
              </label>
              <select
                className="input-field"
                style={{ width: 135, fontWeight: 600 }}
                value={month}
                onChange={e => setMonth(parseInt(e.target.value))}
              >
                {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>

            {/* Year */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                Year
              </label>
              <select
                className="input-field"
                style={{ width: 95, fontWeight: 600 }}
                value={year}
                onChange={e => setYear(parseInt(e.target.value))}
              >
                {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            {/* Multi-Select Course Popover */}
            <div style={{ position: 'relative' }} ref={courseDropdownRef}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                Courses ({selectedCourses.length > 0 ? selectedCourses.length : 'All'})
              </label>
              <button
                type="button"
                onClick={() => setIsCourseDropdownOpen(prev => !prev)}
                className="input-field"
                style={{
                  width: 210,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  cursor: 'pointer',
                  textAlign: 'left',
                  background: selectedCourses.length > 0 ? 'rgba(249, 115, 22, 0.08)' : 'var(--bg-base)',
                  borderColor: selectedCourses.length > 0 ? '#f97316' : 'var(--border)',
                  color: selectedCourses.length > 0 ? '#f97316' : 'var(--text-primary)',
                  fontWeight: selectedCourses.length > 0 ? 600 : 500,
                  padding: '8px 12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <BookOpen size={14} style={{ flexShrink: 0, color: selectedCourses.length > 0 ? '#f97316' : 'var(--text-muted)' }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {selectedCourses.length === 0
                      ? 'All Courses'
                      : `${selectedCourses.length} selected`}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {selectedCourses.length > 0 && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedCourses([])
                      }}
                      style={{
                        padding: '1px 5px',
                        borderRadius: 4,
                        background: 'rgba(249,115,22,0.2)',
                        fontSize: 10,
                        fontWeight: 700
                      }}
                      title="Clear course selection"
                    >
                      ✕
                    </span>
                  )}
                  <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
                </div>
              </button>

              {/* Course Dropdown Popover */}
              {isCourseDropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: 6,
                  width: 340,
                  maxHeight: 380,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                  zIndex: 100,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden'
                }}>
                  {/* Popover Header with Search */}
                  <div style={{ padding: 10, borderBottom: '1px solid var(--border)', background: 'var(--bg-card-hover)' }}>
                    <div style={{ position: 'relative', marginBottom: 8 }}>
                      <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input
                        className="input-field"
                        style={{ paddingLeft: 28, fontSize: 12, width: '100%', height: 32 }}
                        placeholder="Search courses..."
                        value={courseSearch}
                        onChange={e => setCourseSearch(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                      <button
                        type="button"
                        onClick={() => {
                          const allCodes = allCourseOptions.map(c => c.code)
                          setSelectedCourses(allCodes)
                        }}
                        style={{ background: 'none', border: 'none', color: '#f97316', cursor: 'pointer', fontWeight: 600, padding: 0 }}
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedCourses([])}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600, padding: 0 }}
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  {/* Popover Course List */}
                  <div style={{ padding: '6px 0', overflowY: 'auto', flex: 1, maxHeight: 260 }}>
                    {allCourseOptions
                      .filter(c => {
                        if (!courseSearch.trim()) return true
                        const q = courseSearch.toLowerCase()
                        return c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
                      })
                      .map(c => {
                        const isChecked = selectedCourses.includes(c.code)
                        return (
                          <div
                            key={c.code}
                            onClick={() => {
                              setSelectedCourses(prev =>
                                prev.includes(c.code)
                                  ? prev.filter(x => x !== c.code)
                                  : [...prev, c.code]
                              )
                            }}
                            style={{
                              padding: '7px 12px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 8,
                              cursor: 'pointer',
                              background: isChecked ? 'rgba(249, 115, 22, 0.08)' : 'transparent',
                              borderLeft: isChecked ? '3px solid #f97316' : '3px solid transparent',
                              transition: 'background 0.15s'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}} // handled by parent div click
                                style={{ cursor: 'pointer', accentColor: '#f97316' }}
                              />
                              <div style={{ fontSize: 12, color: isChecked ? '#f97316' : 'var(--text-primary)', fontWeight: isChecked ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {c.name}
                              </div>
                            </div>
                            {c.grade ? (
                              <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: 'var(--bg-base)', color: 'var(--text-muted)', border: '1px solid var(--border)', flexShrink: 0 }}>
                                Gr {c.grade}
                              </span>
                            ) : c.isStandalone ? (
                              <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: 'rgba(56, 189, 248, 0.15)', color: 'var(--accent-blue)', border: '1px solid rgba(56, 189, 248, 0.3)', flexShrink: 0 }}>
                                Course
                              </span>
                            ) : null}
                          </div>
                        )
                      })}
                  </div>
                </div>
              )}
            </div>

            {/* Area Filter */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                Area / Route
              </label>
              <select
                className="input-field"
                style={{ width: 160, fontWeight: 500 }}
                value={areaFilter}
                onChange={e => setAreaFilter(e.target.value)}
              >
                <option value="">All Areas ({areas.length})</option>
                {areas.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            {/* Search Input */}
            <div style={{ flex: 1, minWidth: 220 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                Search Recipient / PS Code / Address
              </label>
              <div style={{ position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  className="input-field"
                  style={{ paddingLeft: 34, width: '100%' }}
                  placeholder="Type name, phone, address, course, or PS code..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Bottom Row: Multi-Choice Grade Pills & Presets */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
            paddingTop: 12,
            borderTop: '1px dashed var(--border)'
          }}>
            {/* Grade Pills Multi-Select */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginRight: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <GraduationCap size={14} /> Grades:
              </div>

              {/* "All" button */}
              <button
                type="button"
                onClick={() => {
                  setSelectedGrades([])
                  setIncludeStandaloneOnly(false)
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: selectedGrades.length === 0 && !includeStandaloneOnly ? 700 : 500,
                  cursor: 'pointer',
                  border: selectedGrades.length === 0 && !includeStandaloneOnly ? '1px solid #f97316' : '1px solid var(--border)',
                  background: selectedGrades.length === 0 && !includeStandaloneOnly ? '#f97316' : 'var(--bg-base)',
                  color: selectedGrades.length === 0 && !includeStandaloneOnly ? '#fff' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease'
                }}
              >
                All
              </button>

              {/* Grade Buttons (5 through 13) */}
              {AVAILABLE_GRADES.map(gr => {
                const isSelected = selectedGrades.includes(gr)
                return (
                  <button
                    key={gr}
                    type="button"
                    onClick={() => {
                      setIncludeStandaloneOnly(false)
                      setSelectedGrades(prev =>
                        prev.includes(gr)
                          ? prev.filter(g => g !== gr)
                          : [...prev, gr]
                      )
                    }}
                    style={{
                      padding: '4px 9px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: isSelected ? 700 : 500,
                      cursor: 'pointer',
                      border: isSelected ? '1px solid #f97316' : '1px solid var(--border)',
                      background: isSelected ? 'rgba(249, 115, 22, 0.15)' : 'var(--bg-base)',
                      color: isSelected ? '#f97316' : 'var(--text-secondary)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {isSelected && <Check size={11} />} Gr {gr}
                  </button>
                )
              })}

              {/* Standalone Courses Only Pill */}
              <button
                type="button"
                onClick={() => {
                  setIncludeStandaloneOnly(prev => !prev)
                  setSelectedGrades([])
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: includeStandaloneOnly ? 700 : 500,
                  cursor: 'pointer',
                  border: includeStandaloneOnly ? '1px solid var(--accent-blue)' : '1px solid var(--border)',
                  background: includeStandaloneOnly ? 'rgba(56, 189, 248, 0.15)' : 'var(--bg-base)',
                  color: includeStandaloneOnly ? 'var(--accent-blue)' : 'var(--text-secondary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'all 0.15s ease'
                }}
              >
                {includeStandaloneOnly && <Check size={11} />} Standalone Courses
              </button>
            </div>

            {/* Quick Presets & Clear All */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
              <span style={{ color: 'var(--text-muted)' }}>Presets:</span>
              <button
                type="button"
                onClick={() => {
                  setSelectedGrades([10, 11])
                  setIncludeStandaloneOnly(false)
                }}
                className="btn-secondary"
                style={{ padding: '3px 8px', fontSize: 11, borderRadius: 6 }}
              >
                O/L (10–11)
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedGrades([6, 7, 8, 9])
                  setIncludeStandaloneOnly(false)
                }}
                className="btn-secondary"
                style={{ padding: '3px 8px', fontSize: 11, borderRadius: 6 }}
              >
                Middle (6–9)
              </button>

              {(selectedGrades.length > 0 || selectedCourses.length > 0 || includeStandaloneOnly || areaFilter || search) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedGrades([])
                    setSelectedCourses([])
                    setIncludeStandaloneOnly(false)
                    setAreaFilter('')
                    setSearch('')
                  }}
                  style={{
                    marginLeft: 6,
                    padding: '3px 8px',
                    fontSize: 11,
                    borderRadius: 6,
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#ef4444',
                    cursor: 'pointer',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3
                  }}
                >
                  <X size={11} /> Reset Filters
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Selection Controller & View Settings */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          padding: '12px 18px',
          background: 'var(--bg-card)',
          borderRadius: 10,
          border: '1px solid var(--border)',
          marginBottom: 16
        }}>
          {/* Left Selection Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={visibleGroups.length > 0 && selectedHouseholds.size === visibleGroups.length}
                onChange={toggleSelectAllVisible}
                style={{ width: 17, height: 17, cursor: 'pointer', accentColor: '#f97316' }}
              />
              Select All {visibleGroups.length} Houses
            </label>

            <span style={{ color: 'var(--border)' }}>|</span>

            <button
              onClick={selectCurrentPageOnly}
              className="btn-secondary"
              style={{ padding: '4px 10px', fontSize: 12, borderRadius: 6 }}
            >
              Select Page ({paginatedGroups.length})
            </button>

            <button
              onClick={deselectCurrentPageOnly}
              className="btn-secondary"
              style={{ padding: '4px 10px', fontSize: 12, borderRadius: 6 }}
            >
              Clear Page
            </button>
          </div>

          {/* Right: Page Size & Current View Stats */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Showing <b>{visibleGroups.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, visibleGroups.length)}</b> of <b>{visibleGroups.length}</b> houses
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Per page:</span>
              <select
                className="input-field"
                style={{ width: 75, padding: '4px 8px', fontSize: 12 }}
                value={pageSize}
                onChange={e => setPageSize(parseInt(e.target.value))}
              >
                <option value={24}>24</option>
                <option value={36}>36</option>
                <option value={60}>60</option>
                <option value={120}>120</option>
              </select>
            </div>
          </div>
        </div>

        {/* Delivery Cards Grid */}
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ width: 36, height: 36, border: '3px solid rgba(249,115,22,0.2)', borderTopColor: '#f97316', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }} />
            <div style={{ fontWeight: 600, fontSize: 15 }}>Loading and grouping parcel dispatches...</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Organizing one delivery pack per household</div>
          </div>
        ) : visibleGroups.length === 0 ? (
          <div style={{
            padding: 50, textAlign: 'center', background: 'var(--bg-card)',
            borderRadius: 12, border: '1px solid var(--border)'
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: 26, background: 'rgba(249,115,22,0.1)',
              color: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <CheckCircle2 size={28} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              {activeTab === 'unexported' ? 'All Clear — No Pending Deliveries!' : 'No Dispatched History Found'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, maxWidth: 450, margin: '6px auto 0' }}>
              {activeTab === 'unexported'
                ? `All student tutes marked for delivery in ${MONTH_NAMES[month - 1]} ${year} have already been exported and dispatched.`
                : `No exported batches match your current filter criteria for ${MONTH_NAMES[month - 1]} ${year}.`}
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 16 }}>
              {paginatedGroups.map(g => {
                const isSelected = selectedHouseholds.has(g.household_id)
                const isDispatched = g.isDispatched
                const accentColor = isDispatched ? '#10b981' : '#f97316'
                const shadowColor = isDispatched ? 'rgba(16, 185, 129, 0.14)' : 'rgba(249, 115, 22, 0.14)'

                return (
                  <div
                    key={g.household_id}
                    className="stat-card"
                    style={{
                      padding: 18,
                      borderRadius: 16,
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderLeft: `4px solid ${accentColor}`,
                      boxShadow: isSelected
                        ? `0 8px 24px -4px ${shadowColor}`
                        : `0 4px 18px -4px ${shadowColor}`,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div>
                      {/* Card Header: Checkbox + Name + Badge */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectHousehold(g.household_id)}
                            style={{ width: 18, height: 18, marginTop: 2, cursor: 'pointer', accentColor: accentColor }}
                          />
                          <div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                              {g.parent_name}
                            </div>
                            {g.parent_phone && (
                              <a
                                href={`tel:${g.parent_phone}`}
                                style={{
                                  fontSize: 12,
                                  color: 'var(--accent-blue)',
                                  fontWeight: 600,
                                  marginTop: 3,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  textDecoration: 'none'
                                }}
                              >
                                <Phone size={12} /> {g.parent_phone}
                              </a>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                          <span style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: isDispatched ? 'rgba(16, 185, 129, 0.15)' : 'rgba(249, 115, 22, 0.15)',
                            color: isDispatched ? '#10b981' : '#f97316',
                            border: `1px solid ${isDispatched ? 'rgba(16, 185, 129, 0.3)' : 'rgba(249, 115, 22, 0.3)'}`
                          }}>
                            {g.students.length} {g.students.length === 1 ? 'Tute' : 'Tutes'}
                          </span>
                        </div>
                      </div>

                      {/* Address & Area Box */}
                      <div style={{
                        fontSize: 13,
                        color: 'var(--text-primary)',
                        marginBottom: 12,
                        background: 'var(--bg-card-hover)',
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: '1px solid var(--border)',
                        lineHeight: 1.45
                      }}>
                        <div style={{ whiteSpace: 'pre-line' }}>{g.address}</div>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          fontSize: 11, fontWeight: 600, color: accentColor,
                          marginTop: 6, paddingTop: 6, borderTop: '1px dashed var(--border)'
                        }}>
                          <MapPin size={12} /> AREA: {g.area}
                        </div>
                      </div>

                      {/* Included Tutes List */}
                      <div style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: 'var(--text-secondary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        marginBottom: 6
                      }}>
                        {activeTab === 'unexported' ? 'Tutes in this Pack:' : 'Enclosed Tutes:'}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {g.students.map(st => {
                          const isPending = !st.dispatched

                          return (
                            <div
                              key={`${st.paymentId}-${st.class_type}`}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 8,
                                fontSize: 12,
                                padding: '6px 10px',
                                borderRadius: 8,
                                background: isPending ? 'rgba(249,115,22,0.1)' : 'var(--bg-card-hover)',
                                border: `1px solid ${isPending ? 'rgba(249,115,22,0.25)' : 'var(--border)'}`
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                                <Package size={13} style={{ color: isPending ? '#f97316' : '#10b981', flexShrink: 0 }} />
                                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>
                                  <strong style={{ color: 'var(--accent-blue)' }}>{st.ps_code}</strong> · {st.full_name} <span style={{ color: 'var(--text-secondary)' }}>(Gr {st.grade})</span> — {courseLabels[st.class_type] || CLASS_LABELS[st.class_type] || st.class_type}
                                </span>
                              </div>

                              <span style={{
                                fontSize: 9,
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: 4,
                                whiteSpace: 'nowrap',
                                background: isPending ? 'rgba(249, 115, 22, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                                color: isPending ? '#f97316' : '#10b981',
                                border: `1px solid ${isPending ? 'rgba(249, 115, 22, 0.35)' : 'rgba(16, 185, 129, 0.35)'}`
                              }}>
                                {isPending ? '📦 READY' : '✓ DISPATCHED'}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Footer for Dispatched Cards */}
                    {g.isDispatched && (
                      <div style={{
                        marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--border)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}>
                        <div style={{ fontSize: 11, color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Check size={13} /> {g.latestBatchId || 'Dispatched'}
                        </div>
                        <button
                          type="button"
                          onClick={() => revertDispatchedBatch(g)}
                          className="btn-secondary"
                          style={{ padding: '3px 8px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                          title="Move back to Ready to Export queue"
                        >
                          <RotateCcw size={12} /> Revert
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div style={{
                marginTop: 24,
                padding: '14px 20px',
                background: 'var(--bg-card)',
                borderRadius: 12,
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12
              }}>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Page <b>{currentPage}</b> of <b>{totalPages}</b> ({visibleGroups.length} total houses)
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="btn-secondary"
                    style={{ padding: '6px 12px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <ChevronLeft size={16} /> Prev
                  </button>

                  {/* Page Numbers */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum = currentPage
                    if (totalPages <= 5) {
                      pageNum = i + 1
                    } else if (currentPage <= 3) {
                      pageNum = i + 1
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i
                    } else {
                      pageNum = currentPage - 2 + i
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 8,
                          border: pageNum === currentPage ? '1px solid #f97316' : '1px solid var(--border)',
                          background: pageNum === currentPage ? '#f97316' : 'var(--bg-base)',
                          color: pageNum === currentPage ? '#fff' : 'var(--text-primary)',
                          fontWeight: pageNum === currentPage ? 700 : 500,
                          fontSize: 13,
                          cursor: 'pointer'
                        }}
                      >
                        {pageNum}
                      </button>
                    )
                  })}

                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="btn-secondary"
                    style={{ padding: '6px 12px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    Next <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

