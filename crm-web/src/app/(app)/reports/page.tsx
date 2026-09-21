'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  BarChart2,
  Calendar,
  Building2,
  Users,
  AlertCircle,
  FileSpreadsheet,
  Search,
  ShieldCheck,
  Layers,
  Sparkles,
  RefreshCw,
  LineChart as LineChartIcon,
  Mail
} from 'lucide-react'
import { MONTH_NAMES, CLASS_LABELS } from '@/lib/types'
import { exportTableToCsv, TARGET_GRADES, getGradeFromPayment } from '@/lib/reports-analytics'
import {
  DEFAULT_GRADE_COURSES,
  DEFAULT_STANDALONE_COURSES,
  CourseConfig,
  getAllCourseLabels
} from '@/lib/courses'
import DayEndSummaryTab from './components/DayEndSummaryTab'
import MonthlyMatrixTab from './components/MonthlyMatrixTab'
import MultiMonthTrendsTab from './components/MultiMonthTrendsTab'
import RetentionAnalyzerTab from './components/RetentionAnalyzerTab'

export function isNewRegistrationPsCode(psCode: string | null | undefined): boolean {
  if (!psCode) return false
  const clean = psCode.toUpperCase().trim()
  const num = parseInt(clean.replace(/\D/g, ''), 10)
  if (isNaN(num)) return false

  if (clean.startsWith('SM')) {
    return num >= 101
  }
  // Default PS codes: PS10500 and upper are new students in the new system
  return num >= 10500
}

export default function ReportsPage() {
  const supabase = createClient()

  // Dynamic Course Labels State
  const [courseLabels, setCourseLabels] = useState<Record<string, string>>(() =>
    getAllCourseLabels(DEFAULT_GRADE_COURSES, DEFAULT_STANDALONE_COURSES)
  )

  // Primary 4 Categorized Tab selection
  const [activeTab, setActiveTab] = useState<'daily_operations' | 'monthly_financials' | 'growth_retention' | 'debts'>('daily_operations')

  // Sub-view Tab Selections
  const [dailySubTab, setDailySubTab] = useState<'matrix' | 'ledger' | 'staff'>('matrix')
  const [monthlySubTab, setMonthlySubTab] = useState<'matrix' | 'bank' | 'registrations'>('matrix')
  const [growthSubTab, setGrowthSubTab] = useState<'trends' | 'retention'>('trends')

  // Date filters
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))

  // Range-based date filters for Day-End / Period Summary & Audit Log
  const [dateRangePreset, setDateRangePreset] = useState<'today' | 'yesterday' | 'last7' | 'this_month' | 'last_month' | 'custom'>('today')
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10))
  const [bankFilter, setBankFilter] = useState('')

  const [loading, setLoading] = useState(true)
  const [loadingDaily, setLoadingDaily] = useState(true)

  // 0. Day-End Registrations State
  const [dayEndRegisteredStudents, setDayEndRegisteredStudents] = useState<any[]>([])

  // 0.5. Monthly Cumulative Matrix Mode ('payments' vs 'registrations')
  const [matrixMode, setMatrixMode] = useState<'registrations' | 'payments'>('payments')

  // 0.6. Multi-Month Business Trend Line Chart Analytics State
  const [trendYear, setTrendYear] = useState(new Date().getFullYear())
  const [trendMetric, setTrendMetric] = useState<'students' | 'revenue' | 'registrations'>('students')
  const [selectedTrendMonths, setSelectedTrendMonths] = useState<number[]>([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  const [activeTrendGrades, setActiveTrendGrades] = useState<number[]>([0, 5, 6, 7, 8, 9, 10, 11]) // 0 is Total
  const [trendPaymentsYear, setTrendPaymentsYear] = useState<any[]>([])
  const [trendStudentsYear, setTrendStudentsYear] = useState<any[]>([])
  const [trendHoverPoint, setTrendHoverPoint] = useState<{ month: number; grade: number; value: number; x: number; y: number } | null>(null)

  // 0.75. Retention & Month Continuity State
  const [prevMonthPayments, setPrevMonthPayments] = useState<any[]>([])
  const [retentionGradeFilter, setRetentionGradeFilter] = useState<string>('ALL')
  const [retentionStatusFilter, setRetentionStatusFilter] = useState<'ALL' | 'RETAINED' | 'DROPPED' | 'NEW' | 'REACTIVATED'>('ALL')
  const [searchRetention, setSearchRetention] = useState('')

  // 1. Month-by-Month New Registrations State
  const [newStudents, setNewStudents] = useState<any[]>([])
  const [gradeStats, setGradeStats] = useState<Record<number, number>>({})
  const [searchStu, setSearchStu] = useState('')

  // 2. Bank-Wise Total Revenue State
  const [bankRevenue, setBankRevenue] = useState<{ bank: string; count: number; total: number }[]>([])
  const [methodRevenue, setMethodRevenue] = useState<{ method: string; count: number; total: number }[]>([])
  const [allPaymentsMonth, setAllPaymentsMonth] = useState<any[]>([])

  // 3. Date-Wise Daily Payment Mark & Audit Report State
  const [dailyPayments, setDailyPayments] = useState<any[]>([])
  const [auditorStats, setAuditorStats] = useState<Record<string, { count: number; total: number }>>({})
  const [auditorFilter, setAuditorFilter] = useState('')
  const [searchAudit, setSearchAudit] = useState('')
  const [dateFilterType, setDateFilterType] = useState<'created_at' | 'date_paid'>('created_at')

  // 4. Outstanding Debts State
  const [outstandingList, setOutstandingList] = useState<any[]>([])
  const [searchDebt, setSearchDebt] = useState('')

  // Active Tutor Filter: 'ps' | 'sm' | 'all'
  const [tutorFilter, setTutorFilter] = useState<'ps' | 'sm' | 'all'>('ps')
  const [mounted, setMounted] = useState(false)

  // Helper to apply quick date range presets
  function applyDateRangePreset(preset: 'today' | 'yesterday' | 'last7' | 'this_month' | 'last_month' | 'custom') {
    setDateRangePreset(preset)
    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)

    if (preset === 'today') {
      setStartDate(todayStr)
      setEndDate(todayStr)
      setSelectedDate(todayStr)
    } else if (preset === 'yesterday') {
      const y = new Date()
      y.setDate(y.getDate() - 1)
      const yStr = y.toISOString().slice(0, 10)
      setStartDate(yStr)
      setEndDate(yStr)
      setSelectedDate(yStr)
    } else if (preset === 'last7') {
      const l7 = new Date()
      l7.setDate(l7.getDate() - 6)
      const l7Str = l7.toISOString().slice(0, 10)
      setStartDate(l7Str)
      setEndDate(todayStr)
      setSelectedDate(todayStr)
    } else if (preset === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
      setStartDate(firstDay)
      setEndDate(todayStr)
      setSelectedDate(todayStr)
    } else if (preset === 'last_month') {
      const firstDayLast = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10)
      const lastDayLast = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10)
      setStartDate(firstDayLast)
      setEndDate(lastDayLast)
      setSelectedDate(lastDayLast)
    }
  }

  useEffect(() => {
    setMounted(true)
    if (typeof window !== 'undefined') {
      const active = localStorage.getItem('mathsps_active_tutor') || 'prabuddha'
      setTutorFilter(active === 'sanduni' ? 'sm' : 'ps')
    }

    function hydrateCoursesFromCache() {
      try {
        const cached = localStorage.getItem('MATHSPS_COURSES_CACHE')
        if (cached) {
          const parsed = JSON.parse(cached)
          const gc = parsed.grade_courses || parsed.gradeCourses
          const sc = parsed.standalone_courses || parsed.standaloneCourses
          if (gc || sc) {
            setCourseLabels(getAllCourseLabels(gc || DEFAULT_GRADE_COURSES, sc || DEFAULT_STANDALONE_COURSES))
          }
        }
      } catch (e) {
        console.error('Error hydrating courses in reports:', e)
      }
    }
    hydrateCoursesFromCache()

    async function fetchServerCourses() {
      try {
        let { data: adminRecord } = await supabase.from('members').select('notes').eq('name', 'Admin User').maybeSingle()
        if (!adminRecord) {
          const res = await supabase.from('members').select('notes').eq('email', 'admin@mathsps.com').maybeSingle()
          adminRecord = res.data
        }
        if (!adminRecord) {
          const res = await supabase.from('members').select('notes').in('role', ['admin', 'owner']).limit(1).maybeSingle()
          adminRecord = res.data
        }
        if (adminRecord?.notes) {
          try {
            const notesObj = JSON.parse(adminRecord.notes)
            const gc = notesObj.grade_courses || notesObj.gradeCourses
            const sc = notesObj.standalone_courses || notesObj.standaloneCourses
            if (gc || sc) {
              setCourseLabels(getAllCourseLabels(gc || DEFAULT_GRADE_COURSES, sc || DEFAULT_STANDALONE_COURSES))
            }
          } catch {}
        }
      } catch (err) {
        console.error('Error loading server courses in reports:', err)
      }
    }
    fetchServerCourses()

    const channel = supabase.channel('reports-courses-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, () => {
        fetchServerCourses()
      })
      .on('broadcast', { event: 'courses_updated' }, (payload: any) => {
        const gc = payload?.payload?.grade_courses || payload?.payload?.gradeCourses
        const sc = payload?.payload?.standalone_courses || payload?.payload?.standaloneCourses
        if (gc || sc) {
          setCourseLabels(getAllCourseLabels(gc || DEFAULT_GRADE_COURSES, sc || DEFAULT_STANDALONE_COURSES))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Helper function to fetch all rows beyond 1,000 limit with pagination
  async function fetchAllPaginated(buildQuery: (from: number, to: number) => any) {
    let results: any[] = []
    let from = 0
    let hasMore = true
    const CHUNK = 1000
    while (hasMore) {
      const { data, error } = await buildQuery(from, from + CHUNK - 1)
      if (error) throw error
      results = results.concat(data || [])
      if (!data || data.length < CHUNK) {
        hasMore = false
      } else {
        from += CHUNK
      }
    }
    return results
  }

  // Helper to check if a student or payment matches the selected tutorFilter
  function matchesTutor(psCode: string | null | undefined): boolean {
    if (!psCode || tutorFilter === 'all') return true
    const clean = psCode.toUpperCase().trim()
    if (tutorFilter === 'sm') {
      return clean.startsWith('SM')
    }
    // tutorFilter === 'ps': anything starting with PS or standard digits
    return clean.startsWith('PS') || (!clean.startsWith('SM'))
  }

  // 1. FAST LEAN LOADER: Daily Operations & Day-End Audit Data (<100ms)
  useEffect(() => {
    let isCancelled = false

    async function loadDailyData() {
      setLoadingDaily(true)
      try {
        const startOfRangeIso = `${startDate}T00:00:00.000Z`
        const endOfRangeIso = `${endDate}T23:59:59.999Z`

        const [dailyList, { data: dayEndRegisteredData }] = await Promise.all([
          // Lean daily payments query - only fetch necessary columns
          fetchAllPaginated((from, to) => {
            let q = supabase
              .from('payments')
              .select('id, student_id, amount_paid, payment_type, bank_name, recorded_by, created_at, date_paid, class_type, notes, tute_delivered, students(ps_code, full_name, grade)')
              .range(from, to)
              .order('created_at', { ascending: false })

            if (dateFilterType === 'created_at') {
              return q.gte('created_at', startOfRangeIso).lte('created_at', endOfRangeIso)
            } else {
              return q.gte('date_paid', startDate).lte('date_paid', endDate)
            }
          }),
          // Real new registered students in date range
          supabase
            .from('students')
            .select('id, ps_code, full_name, grade, created_at, created_by, household:households(parent_name, parent_phone, address), enrollments(class_type)')
            .not('created_by', 'ilike', '%Auto-Pre-generated%')
            .gte('created_at', startOfRangeIso)
            .lte('created_at', endOfRangeIso)
            .order('created_at', { ascending: false })
        ])

        if (isCancelled) return

        // Filter by tutor and new registration threshold
        const filteredDailyPaymentsList = (dailyList || []).filter((p: any) => matchesTutor(p.students?.ps_code || p.student_id))
        setDailyPayments(filteredDailyPaymentsList)

        const aMap: Record<string, { count: number; total: number }> = {}
        filteredDailyPaymentsList.forEach((p: any) => {
          const who = p.recorded_by || 'System User'
          const amt = Number(p.amount_paid) || 0
          if (!aMap[who]) aMap[who] = { count: 0, total: 0 }
          aMap[who].count += 1
          aMap[who].total += amt
        })
        setAuditorStats(aMap)

        const filteredDayEndRegistered = (dayEndRegisteredData || []).filter(s => matchesTutor(s.ps_code) && isNewRegistrationPsCode(s.ps_code))
        setDayEndRegisteredStudents(filteredDayEndRegistered)
      } catch (err) {
        console.error('Error loading daily operations report:', err)
      } finally {
        if (!isCancelled) setLoadingDaily(false)
      }
    }

    loadDailyData()
    return () => {
      isCancelled = true
    }
  }, [startDate, endDate, dateFilterType, tutorFilter])

  // 2. ON-DEMAND LAZY LOADER: Monthly Matrix & Financials (Only loaded when monthly_financials is active)
  useEffect(() => {
    if (activeTab !== 'monthly_financials') return
    let isCancelled = false

    async function loadMonthlyData() {
      setLoading(true)
      try {
        const startOfMonth = new Date(year, month - 1, 1).toISOString()
        const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999).toISOString()
        const startOfAdvanceLookback = new Date(year, month - 2, 1).toISOString()

        const prevMonthNum = month === 1 ? 12 : month - 1
        const prevYearNum = month === 1 ? year - 1 : year
        const nextMonthNum = month === 12 ? 1 : month + 1
        const nextYearNum = month === 12 ? year + 1 : year

        const [
          monthlyPaymentsData,
          prevMonthPaymentsData,
          nextMonthPaymentsData,
          { data: registeredData }
        ] = await Promise.all([
          fetchAllPaginated((from, to) =>
            supabase
              .from('payments')
              .select('id, student_id, amount_paid, payment_type, bank_name, recorded_by, created_at, date_paid, class_type, students(id, ps_code, full_name, grade, created_at, created_by, household:households(parent_name, parent_phone, address), enrollments(class_type))')
              .eq('month', month)
              .eq('year', year)
              .range(from, to)
          ),
          fetchAllPaginated((from, to) =>
            supabase
              .from('payments')
              .select('student_id, students(ps_code)')
              .eq('month', prevMonthNum)
              .eq('year', prevYearNum)
              .range(from, to)
          ),
          fetchAllPaginated((from, to) =>
            supabase
              .from('payments')
              .select('month, year, student_id, students(ps_code)')
              .eq('month', nextMonthNum)
              .eq('year', nextYearNum)
              .range(from, to)
          ),
          supabase
            .from('students')
            .select('id, ps_code, full_name, grade, created_at, created_by, household:households(parent_name, parent_phone, address), enrollments(class_type)')
            .not('created_by', 'ilike', '%Auto-Pre-generated%')
            .gte('created_at', startOfAdvanceLookback)
            .lte('created_at', endOfMonth)
            .order('created_at', { ascending: false })
        ])

        if (isCancelled) return

        const payList = (monthlyPaymentsData || []).filter((p: any) => matchesTutor(p.students?.ps_code || p.student_id))
        setAllPaymentsMonth(payList)

        const prevPaidPsCodes = new Set<string>()
        ;(prevMonthPaymentsData || []).filter((p: any) => matchesTutor(p.students?.ps_code || p.student_id)).forEach((p: any) => {
          const ps = p.students?.ps_code || p.student_id
          if (ps) prevPaidPsCodes.add(ps)
        })

        const thisPaidPsCodes = new Set<string>()
        payList.forEach((p: any) => {
          const ps = p.students?.ps_code || p.student_id
          if (ps) thisPaidPsCodes.add(ps)
        })

        const nextPaidPsCodes = new Set<string>()
        ;(nextMonthPaymentsData || []).filter((p: any) => matchesTutor(p.students?.ps_code || p.student_id)).forEach((p: any) => {
          const ps = p.students?.ps_code || p.student_id
          if (ps) nextPaidPsCodes.add(ps)
        })

        const newStuMap = new Map<string, any>()
        ;(registeredData || []).filter(s => matchesTutor(s.ps_code)).forEach(s => {
          const ps = s.ps_code || s.id
          if (!isNewRegistrationPsCode(ps)) return

          const sCreatedAt = s.created_at ? new Date(s.created_at).toISOString() : ''
          if (sCreatedAt >= startOfMonth && sCreatedAt <= endOfMonth) {
            if (nextPaidPsCodes.has(ps) && !thisPaidPsCodes.has(ps)) {
              return
            }
            newStuMap.set(ps, s)
          }
        })

        payList.forEach((p: any) => {
          const s = p.students
          if (!s) return
          const ps = s.ps_code || p.student_id
          if (!ps || !isNewRegistrationPsCode(ps) || prevPaidPsCodes.has(ps)) return

          const sCreatedAt = s.created_at ? new Date(s.created_at).toISOString() : ''
          if (sCreatedAt && sCreatedAt <= endOfMonth) {
            if (!newStuMap.has(ps)) {
              newStuMap.set(ps, {
                id: s.id || p.student_id,
                ps_code: s.ps_code || ps,
                full_name: s.full_name || '—',
                grade: s.grade || 0,
                created_at: s.created_at,
                created_by: s.created_by || p.recorded_by || 'Admin',
                household: s.household || {},
                enrollments: s.enrollments || []
              })
            }
          }
        })

        const stuList = Array.from(newStuMap.values())
        setNewStudents(stuList)

        const gMap: Record<number, number> = {}
        stuList.forEach(s => {
          const gr = s.grade || 0
          gMap[gr] = (gMap[gr] || 0) + 1
        })
        setGradeStats(gMap)

        const bMap: Record<string, { count: number; total: number }> = {}
        const mMap: Record<string, { count: number; total: number }> = {}

        payList.forEach((p: any) => {
          const amt = Number(p.amount_paid) || 0
          const method = p.payment_type || 'BANK'
          const bank = p.bank_name || (method === 'BANK' ? 'Other Bank' : method)

          if (!bMap[bank]) bMap[bank] = { count: 0, total: 0 }
          bMap[bank].count += 1
          bMap[bank].total += amt

          if (!mMap[method]) mMap[method] = { count: 0, total: 0 }
          mMap[method].count += 1
          mMap[method].total += amt
        })

        setBankRevenue(
          Object.entries(bMap)
            .map(([bank, data]) => ({ bank, count: data.count, total: data.total }))
            .sort((a, b) => b.total - a.total)
        )

        setMethodRevenue(
          Object.entries(mMap)
            .map(([method, data]) => ({ method, count: data.count, total: data.total }))
            .sort((a, b) => b.total - a.total)
        )
      } catch (err) {
        console.error('Error loading monthly report:', err)
      } finally {
        if (!isCancelled) setLoading(false)
      }
    }

    loadMonthlyData()
    return () => {
      isCancelled = true
    }
  }, [activeTab, month, year, tutorFilter])

  // 3. ON-DEMAND LAZY LOADER: Growth, Retention & Multi-Month Trends (Only loaded when growth_retention is active)
  useEffect(() => {
    if (activeTab !== 'growth_retention') return
    let isCancelled = false

    async function loadGrowthData() {
      setLoading(true)
      try {
        const startOfTrendYear = new Date(trendYear, 0, 1).toISOString()
        const endOfTrendYear = new Date(trendYear, 11, 31, 23, 59, 59, 999).toISOString()

        const prevMonthNum = month === 1 ? 12 : month - 1
        const prevYearNum = month === 1 ? year - 1 : year

        const [
          trendYearPaymentsData,
          prevMonthPaymentsData,
          monthlyPaymentsData,
          { data: trendYearStudentsData }
        ] = await Promise.all([
          fetchAllPaginated((from, to) =>
            supabase
              .from('payments')
              .select('month, year, amount_paid, class_type, students(ps_code, full_name, grade, created_at)')
              .eq('year', trendYear)
              .range(from, to)
          ),
          fetchAllPaginated((from, to) =>
            supabase
              .from('payments')
              .select('amount_paid, class_type, date_paid, created_at, students(ps_code, full_name, grade, household:households(parent_name, parent_phone, address))')
              .eq('month', prevMonthNum)
              .eq('year', prevYearNum)
              .range(from, to)
          ),
          fetchAllPaginated((from, to) =>
            supabase
              .from('payments')
              .select('amount_paid, class_type, date_paid, created_at, students(ps_code, full_name, grade, household:households(parent_name, parent_phone, address))')
              .eq('month', month)
              .eq('year', year)
              .range(from, to)
          ),
          supabase
            .from('students')
            .select('ps_code, created_at, grade')
            .not('created_by', 'ilike', '%Auto-Pre-generated%')
            .gte('created_at', startOfTrendYear)
            .lte('created_at', endOfTrendYear)
        ])

        if (isCancelled) return

        const filteredTrendPayments = (trendYearPaymentsData || []).filter((p: any) => matchesTutor(p.students?.ps_code || p.student_id))
        const filteredTrendStudents = (trendYearStudentsData || []).filter((s: any) => matchesTutor(s.ps_code))
        setTrendPaymentsYear(filteredTrendPayments)
        setTrendStudentsYear(filteredTrendStudents)

        const filteredPrevPayments = (prevMonthPaymentsData || []).filter((p: any) => matchesTutor(p.students?.ps_code || p.student_id))
        setPrevMonthPayments(filteredPrevPayments)

        const payList = (monthlyPaymentsData || []).filter((p: any) => matchesTutor(p.students?.ps_code || p.student_id))
        setAllPaymentsMonth(payList)
      } catch (err) {
        console.error('Error loading growth and retention data:', err)
      } finally {
        if (!isCancelled) setLoading(false)
      }
    }

    loadGrowthData()
    return () => {
      isCancelled = true
    }
  }, [activeTab, trendYear, month, year, tutorFilter])

  // 4. ON-DEMAND LAZY LOADER: Outstanding Debts (Only loaded when debts tab is active)
  useEffect(() => {
    if (activeTab !== 'debts') return
    let isCancelled = false

    async function loadDebtsData() {
      setLoading(true)
      try {
        const { data: outData, error } = await supabase.from('students_outstanding').select('*')
        if (error) throw error
        if (isCancelled) return

        const filteredDebtsList = (outData || []).filter((d: any) => matchesTutor(d.ps_code))
        setOutstandingList(filteredDebtsList)
      } catch (err) {
        console.error('Error loading outstanding debts:', err)
      } finally {
        if (!isCancelled) setLoading(false)
      }
    }

    loadDebtsData()
    return () => {
      isCancelled = true
    }
  }, [activeTab, tutorFilter])



  // Filtered lists for simple tabs
  const filteredNewStudents = useMemo(() => {
    if (!searchStu.trim()) return newStudents
    const term = searchStu.toLowerCase()
    return newStudents.filter(s =>
      s.ps_code?.toLowerCase().includes(term) ||
      s.full_name?.toLowerCase().includes(term) ||
      s.household?.parent_name?.toLowerCase().includes(term) ||
      s.household?.parent_phone?.toLowerCase().includes(term)
    )
  }, [newStudents, searchStu])

  const filteredDailyPayments = useMemo(() => {
    return dailyPayments.filter(p => {
      if (auditorFilter && (p.recorded_by || 'System User') !== auditorFilter) {
        return false
      }
      if (bankFilter) {
        const pBank = p.bank_name || p.payment_type || ''
        if (pBank !== bankFilter && p.payment_type !== bankFilter) {
          return false
        }
      }
      if (!searchAudit.trim()) return true
      const term = searchAudit.toLowerCase()
      return (
        p.students?.ps_code?.toLowerCase().includes(term) ||
        p.students?.full_name?.toLowerCase().includes(term) ||
        p.payment_type?.toLowerCase().includes(term) ||
        p.bank_name?.toLowerCase().includes(term) ||
        p.recorded_by?.toLowerCase().includes(term) ||
        p.notes?.toLowerCase().includes(term)
      )
    })
  }, [dailyPayments, auditorFilter, bankFilter, searchAudit])

  const filteredDebts = useMemo(() => {
    if (!searchDebt.trim()) return outstandingList
    const term = searchDebt.toLowerCase()
    return outstandingList.filter(d =>
      d.ps_code?.toLowerCase().includes(term) ||
      d.full_name?.toLowerCase().includes(term) ||
      d.address?.toLowerCase().includes(term)
    )
  }, [outstandingList, searchDebt])

  const totalMonthlyRevenue = useMemo(() => allPaymentsMonth.reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0), [allPaymentsMonth])
  const totalDailyRevenue = useMemo(() => dailyPayments.reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0), [dailyPayments])
  const totalDebtAmount = useMemo(() => outstandingList.reduce((sum, d) => sum + Math.abs(d.current_balance || 0), 0), [outstandingList])

  // -------------------------------------------------------------------------
  // 1. DAY-END CALCULATIONS
  // -------------------------------------------------------------------------
  const dayEndGradeNewMap: Record<number, number> = {}
  dayEndRegisteredStudents.forEach(s => {
    const gr = s.grade || 0
    dayEndGradeNewMap[gr] = (dayEndGradeNewMap[gr] || 0) + 1
  })

  const dayEndGradePaidMap: Record<number, { count: number; total: number }> = {}
  const dayEndClassPaidMap: Record<string, { count: number; total: number }> = {}
  const dayEndAuditorMap: Record<string, { regCount: number; payCount: number; total: number }> = {}

  dayEndRegisteredStudents.forEach(s => {
    const who = s.created_by || 'System User'
    if (!dayEndAuditorMap[who]) dayEndAuditorMap[who] = { regCount: 0, payCount: 0, total: 0 }
    dayEndAuditorMap[who].regCount += 1
  })

  dailyPayments.forEach(p => {
    const gr = getGradeFromPayment(p)
    const amt = Number(p.amount_paid) || 0
    const cls = p.class_type || 'UNKNOWN'
    const who = p.recorded_by || 'System User'

    if (!dayEndGradePaidMap[gr]) dayEndGradePaidMap[gr] = { count: 0, total: 0 }
    dayEndGradePaidMap[gr].count += 1
    dayEndGradePaidMap[gr].total += amt

    if (!dayEndClassPaidMap[cls]) dayEndClassPaidMap[cls] = { count: 0, total: 0 }
    dayEndClassPaidMap[cls].count += 1
    dayEndClassPaidMap[cls].total += amt

    if (!dayEndAuditorMap[who]) dayEndAuditorMap[who] = { regCount: 0, payCount: 0, total: 0 }
    dayEndAuditorMap[who].payCount += 1
    dayEndAuditorMap[who].total += amt
  })

  const allDistinctGrades = Array.from(
    new Set([5, 6, 7, 8, 9, 10, 11, ...Object.keys(dayEndGradeNewMap).map(Number), ...Object.keys(dayEndGradePaidMap).map(Number)])
  ).filter(g => g > 0).sort((a, b) => a - b)

  // -------------------------------------------------------------------------
  // 2. MONTHLY CUMULATIVE MATRIX CALCULATIONS
  // -------------------------------------------------------------------------
  const daysInSelectedMonth = new Date(year, month, 0).getDate()
  const matrixTargetGrades = TARGET_GRADES

  const rawDailyCounts: Record<number, Record<number, number>> = {}
  for (let d = 1; d <= daysInSelectedMonth; d++) {
    rawDailyCounts[d] = { 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0 }
  }

  if (matrixMode === 'registrations') {
    const monthStartIso = `${year}-${String(month).padStart(2, '0')}-01`
    newStudents.forEach(s => {
      let d = 1
      if (s.created_at) {
        const sCreatedAt = new Date(s.created_at).toISOString()
        if (sCreatedAt < monthStartIso) {
          // Advance registration made before this month (e.g. late August for September) -> counts on Day 1
          d = 1
        } else {
          d = new Date(s.created_at).getDate()
        }
      }
      if (d < 1) d = 1
      if (d > daysInSelectedMonth) d = daysInSelectedMonth
      const g = s.grade || 0
      if (rawDailyCounts[d] && rawDailyCounts[d][g] !== undefined) {
        rawDailyCounts[d][g] += 1
      }
    })
  } else {
    // Unique students paid for this month:
    // Uses getGradeFromPayment(p) to map payment class_type (e.g. GR6_THEORY) to its respective grade column.
    // If paid before day 1 of the selected month (e.g. advance payment in August for September month),
    // it counts on Day 1 (01/MM).
    // If paid on or after day 1 of the selected month, it counts on its respective day.
    const monthStartIso = `${year}-${String(month).padStart(2, '0')}-01`
    
    // Group unique students by grade and day so multiple class payments by same student don't double count if measuring students
    const seenStudentDay = new Set<string>()

    allPaymentsMonth.forEach(p => {
      const psCode = p.students?.ps_code || p.student_id || p.id
      const g = getGradeFromPayment(p)
      if (!matrixTargetGrades.includes(g as any)) return

      const paidDateStr = p.date_paid || (p.created_at ? p.created_at.slice(0, 10) : '')
      
      let targetDay = 1
      if (paidDateStr) {
        if (paidDateStr < monthStartIso) {
          // Advance payment made before this month started (e.g., Aug 31 for Sept month) -> starts on Day 1
          targetDay = 1
        } else {
          const parts = paidDateStr.split('-')
          if (parts.length >= 3 && parseInt(parts[0], 10) === year && parseInt(parts[1], 10) === month) {
            targetDay = parseInt(parts[2], 10)
          } else {
            targetDay = 1
          }
        }
      }

      if (targetDay < 1) targetDay = 1
      if (targetDay > daysInSelectedMonth) targetDay = daysInSelectedMonth

      const dedupeKey = `${psCode}_G${g}`
      if (!seenStudentDay.has(dedupeKey)) {
        seenStudentDay.add(dedupeKey)
        if (rawDailyCounts[targetDay] && rawDailyCounts[targetDay][g] !== undefined) {
          rawDailyCounts[targetDay][g] += 1
        }
      }
    })
  }

  // Calculate max days to display in table:
  // If viewing current year & current month, only show up to today's date so future days are not repeated.
  // If viewing a past month/year, show all days of that month.
  const today = new Date()
  const isCurrentMonthAndYear = (today.getFullYear() === year && (today.getMonth() + 1) === month)
  const isFutureMonthAndYear = (year > today.getFullYear() || (year === today.getFullYear() && month > (today.getMonth() + 1)))
  
  const maxDisplayDays = isFutureMonthAndYear 
    ? 0 
    : isCurrentMonthAndYear 
      ? Math.min(today.getDate(), daysInSelectedMonth) 
      : daysInSelectedMonth

  const cumulativeMatrixRows: {
    day: number
    dateStr: string
    counts: Record<number, number>
    dailyCountTotal: number
    cumulativeTotal: number
    isWeekend: boolean
    hasActivity: boolean
  }[] = []

  const runningGradeTotals: Record<number, number> = { 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0 }

  for (let d = 1; d <= maxDisplayDays; d++) {
    const dayDate = new Date(year, month - 1, d)
    const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6
    const dateFormatted = `${String(d).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`

    let dayRawSum = 0
    matrixTargetGrades.forEach(g => {
      const rawCount = rawDailyCounts[d][g] || 0
      runningGradeTotals[g] += rawCount
      dayRawSum += rawCount
    })

    const cumTotal = Object.values(runningGradeTotals).reduce((a, b) => a + b, 0)

    cumulativeMatrixRows.push({
      day: d,
      dateStr: dateFormatted,
      counts: { ...runningGradeTotals },
      dailyCountTotal: dayRawSum,
      cumulativeTotal: cumTotal,
      isWeekend,
      hasActivity: dayRawSum > 0
    })
  }

  // -------------------------------------------------------------------------
  // 3. RETENTION & CONTINUITY CALCULATIONS
  // -------------------------------------------------------------------------
  const prevMonthStudentsMap = new Map<string, any>()
  prevMonthPayments.forEach(p => {
    const ps = p.students?.ps_code || p.student_id
    if (!ps) return
    if (!prevMonthStudentsMap.has(ps)) {
      prevMonthStudentsMap.set(ps, {
        ps_code: ps,
        full_name: p.students?.full_name || '—',
        grade: p.students?.grade || 0,
        parent_name: p.students?.household?.parent_name || '—',
        parent_phone: p.students?.household?.parent_phone || '—',
        address: p.students?.household?.address || '—',
        last_class_type: p.class_type,
        last_amount: Number(p.amount_paid) || 0,
        last_date_paid: p.date_paid || p.created_at
      })
    }
  })

  const currentMonthStudentsMap = new Map<string, any>()
  allPaymentsMonth.forEach(p => {
    const ps = p.students?.ps_code || p.student_id
    if (!ps) return
    if (!currentMonthStudentsMap.has(ps)) {
      currentMonthStudentsMap.set(ps, {
        ps_code: ps,
        full_name: p.students?.full_name || '—',
        grade: p.students?.grade || 0,
        parent_name: p.students?.household?.parent_name || '—',
        parent_phone: p.students?.household?.parent_phone || '—',
        address: p.students?.household?.address || '—',
        curr_class_type: p.class_type,
        curr_amount: Number(p.amount_paid) || 0,
        curr_date_paid: p.date_paid || p.created_at
      })
    }
  })

  const retainedStudentsList: any[] = []
  const droppedStudentsList: any[] = []
  const newPayingStudentsList: any[] = []

  prevMonthStudentsMap.forEach((prevStu, ps) => {
    if (currentMonthStudentsMap.has(ps)) {
      const currStu = currentMonthStudentsMap.get(ps)
      retainedStudentsList.push({
        ...prevStu,
        curr_amount: currStu.curr_amount,
        curr_class_type: currStu.curr_class_type,
        curr_date_paid: currStu.curr_date_paid,
        status: 'RETAINED'
      })
    } else {
      droppedStudentsList.push({
        ...prevStu,
        status: 'DROPPED'
      })
    }
  })

  currentMonthStudentsMap.forEach((currStu, ps) => {
    if (!prevMonthStudentsMap.has(ps)) {
      newPayingStudentsList.push({
        ...currStu,
        status: 'NEW'
      })
    }
  })

  const totalPrevPaid = prevMonthStudentsMap.size
  const totalCurrPaid = currentMonthStudentsMap.size
  const totalRetained = retainedStudentsList.length
  const totalDropped = droppedStudentsList.length
  const totalNewPaying = newPayingStudentsList.length

  const overallRetentionRate = totalPrevPaid > 0 ? ((totalRetained / totalPrevPaid) * 100).toFixed(1) : '0.0'
  const overallChurnRate = totalPrevPaid > 0 ? ((totalDropped / totalPrevPaid) * 100).toFixed(1) : '0.0'
  const potentialLostRevenue = droppedStudentsList.reduce((sum, s) => sum + (Number(s.last_amount) || 0), 0)

  const gradeRetentionMatrix: Record<number, { prev: number; retained: number; dropped: number; newPaying: number; rate: string }> = {}
  matrixTargetGrades.forEach(g => {
    const prevCount = Array.from(prevMonthStudentsMap.values()).filter(s => s.grade === g).length
    const retCount = retainedStudentsList.filter(s => s.grade === g).length
    const dropCount = droppedStudentsList.filter(s => s.grade === g).length
    const newCount = newPayingStudentsList.filter(s => s.grade === g).length
    const rate = prevCount > 0 ? ((retCount / prevCount) * 100).toFixed(1) : '0.0'

    gradeRetentionMatrix[g] = {
      prev: prevCount,
      retained: retCount,
      dropped: dropCount,
      newPaying: newCount,
      rate
    }
  })

  const allRetentionCombined = [
    ...droppedStudentsList,
    ...retainedStudentsList,
    ...newPayingStudentsList
  ]

  const filteredRetentionList = allRetentionCombined.filter(s => {
    if (retentionGradeFilter !== 'ALL' && String(s.grade) !== retentionGradeFilter) {
      return false
    }
    if (retentionStatusFilter !== 'ALL' && s.status !== retentionStatusFilter) {
      return false
    }
    if (!searchRetention.trim()) return true
    const term = searchRetention.toLowerCase()
    return (
      s.ps_code?.toLowerCase().includes(term) ||
      s.full_name?.toLowerCase().includes(term) ||
      s.parent_name?.toLowerCase().includes(term) ||
      s.parent_phone?.toLowerCase().includes(term) ||
      s.address?.toLowerCase().includes(term)
    )
  })

  // -------------------------------------------------------------------------
  // 4. MULTI-MONTH BUSINESS TREND LINE CHART CALCULATIONS
  // -------------------------------------------------------------------------
  // Build student earliest payment month mapping for accurate multi-month trend registration cohorts
  const studentFirstPaidMonthInTrendYear = new Map<string, number>()
  trendPaymentsYear.forEach((p: any) => {
    const ps = p.students?.ps_code || p.student_id
    if (!ps || !p.month) return
    const cur = studentFirstPaidMonthInTrendYear.get(ps)
    if (cur === undefined || p.month < cur) {
      studentFirstPaidMonthInTrendYear.set(ps, p.month)
    }
  })

  const sortedTrendMonths: number[] = [...selectedTrendMonths].sort((a: number, b: number) => a - b)

  const trendMonthlySeries = sortedTrendMonths.map((m: number) => {
    const mPayments = trendPaymentsYear.filter(p => p.month === m)

    const gradePayingStudentsMap: Record<number, Set<string>> = {
      5: new Set(), 6: new Set(), 7: new Set(), 8: new Set(), 9: new Set(), 10: new Set(), 11: new Set()
    }
    const allPayingStudentsSet = new Set<string>()
    const gradeRevenueMap: Record<number, number> = { 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0 }
    let totalRevenue = 0

    mPayments.forEach((p: any) => {
      const ps = p.students?.ps_code || p.student_id || 'unknown'
      const gr = getGradeFromPayment(p)
      const amt = Number(p.amount_paid) || 0

      allPayingStudentsSet.add(ps)
      if (gradePayingStudentsMap[gr]) {
        gradePayingStudentsMap[gr].add(ps)
      }

      totalRevenue += amt
      if (gradeRevenueMap[gr] !== undefined) {
        gradeRevenueMap[gr] += amt
      }
    })

    const mStudents = trendStudentsYear.filter(s => {
      const ps = s.ps_code || s.id
      if (!isNewRegistrationPsCode(ps)) return false

      const firstPaidMonth = ps ? studentFirstPaidMonthInTrendYear.get(ps) : undefined
      if (firstPaidMonth !== undefined) {
        return firstPaidMonth === m
      }
      const d = new Date(s.created_at)
      return d.getMonth() + 1 === m
    })
    const gradeRegMap: Record<number, number> = { 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0 }
    mStudents.forEach((s: any) => {
      const gr = s.grade || 0
      if (gradeRegMap[gr] !== undefined) {
        gradeRegMap[gr] += 1
      }
    })

    return {
      month: m,
      monthName: MONTH_NAMES[m - 1],
      studentCountsByGrade: {
        0: allPayingStudentsSet.size,
        5: gradePayingStudentsMap[5].size,
        6: gradePayingStudentsMap[6].size,
        7: gradePayingStudentsMap[7].size,
        8: gradePayingStudentsMap[8].size,
        9: gradePayingStudentsMap[9].size,
        10: gradePayingStudentsMap[10].size,
        11: gradePayingStudentsMap[11].size,
      } as Record<number, number>,
      revenueByGrade: {
        0: totalRevenue,
        5: gradeRevenueMap[5],
        6: gradeRevenueMap[6],
        7: gradeRevenueMap[7],
        8: gradeRevenueMap[8],
        9: gradeRevenueMap[9],
        10: gradeRevenueMap[10],
        11: gradeRevenueMap[11],
      } as Record<number, number>,
      regByGrade: {
        0: mStudents.length,
        5: gradeRegMap[5],
        6: gradeRegMap[6],
        7: gradeRegMap[7],
        8: gradeRegMap[8],
        9: gradeRegMap[9],
        10: gradeRegMap[10],
        11: gradeRegMap[11],
      } as Record<number, number>
    }
  })

  const trendMoMTable = trendMonthlySeries.map((item, idx) => {
    const prevItem = idx > 0 ? trendMonthlySeries[idx - 1] : null
    
    let currentVal = 0
    let prevVal = 0

    if (trendMetric === 'students') {
      currentVal = item.studentCountsByGrade[0]
      prevVal = prevItem ? prevItem.studentCountsByGrade[0] : 0
    } else if (trendMetric === 'revenue') {
      currentVal = item.revenueByGrade[0]
      prevVal = prevItem ? prevItem.revenueByGrade[0] : 0
    } else {
      currentVal = item.regByGrade[0]
      prevVal = prevItem ? prevItem.regByGrade[0] : 0
    }

    const delta = prevItem ? currentVal - prevVal : 0
    const pctChange = prevItem && prevVal > 0 ? ((delta / prevVal) * 100).toFixed(1) : null

    return {
      ...item,
      currentVal,
      prevVal,
      delta,
      pctChange
    }
  })

  let chartMaxVal = 10
  trendMonthlySeries.forEach(mItem => {
    activeTrendGrades.forEach(g => {
      let val = 0
      if (trendMetric === 'students') val = mItem.studentCountsByGrade[g] || 0
      else if (trendMetric === 'revenue') val = mItem.revenueByGrade[g] || 0
      else val = mItem.regByGrade[g] || 0

      if (val > chartMaxVal) chartMaxVal = val
    })
  })
  chartMaxVal = Math.ceil((chartMaxVal * 1.15) / 10) * 10
  if (chartMaxVal < 10) chartMaxVal = 10

  const svgWidth = 900
  const svgHeight = 360
  const padLeft = 70
  const padRight = 30
  const padTop = 30
  const padBottom = 50
  const plotWidth = svgWidth - padLeft - padRight
  const plotHeight = svgHeight - padTop - padBottom

  return (
    <div className="fade-in" style={{ paddingBottom: 60 }}>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <BarChart2 size={22} style={{ color: 'var(--accent-blue)' }} />
            Admin Reports &amp; Audit Analytics
          </h1>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
            Day-End summaries, month-by-month registrations, revenue breakdowns, and auditor logs
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Tutor Profile Scope Selector */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '4px 6px',
            gap: 4
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '0 6px' }}>
              Tutor:
            </span>
            <button
              type="button"
              onClick={() => setTutorFilter('ps')}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                border: 'none',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                background: tutorFilter === 'ps' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                color: tutorFilter === 'ps' ? '#60a5fa' : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <img src="/prabuddha-profile.jpg" alt="PS" style={{ width: 16, height: 16, borderRadius: '50%' }} />
              Prabuddha (PS)
            </button>
            <button
              type="button"
              onClick={() => setTutorFilter('sm')}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                border: 'none',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                background: tutorFilter === 'sm' ? 'rgba(236, 72, 153, 0.2)' : 'transparent',
                color: tutorFilter === 'sm' ? '#f472b6' : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <img src="/sanduni-profile.jpg" alt="SM" style={{ width: 16, height: 16, borderRadius: '50%' }} />
              Sanduni (SM)
            </button>
            <button
              type="button"
              onClick={() => setTutorFilter('all')}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                border: 'none',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                background: tutorFilter === 'all' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                color: tutorFilter === 'all' ? '#34d399' : 'var(--text-secondary)'
              }}
            >
              🌐 All Combined
            </button>
          </div>

          <a
            href="/settings"
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, textDecoration: 'none', padding: '8px 14px' }}
          >
            <Mail size={16} style={{ color: 'var(--accent-blue)' }} />
            📧 Email Automation Settings
          </a>
        </div>
      </div>

      <div className="page-content">
        {/* 4 Clean Consolidated Navigation Tabs */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 12, flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveTab('daily_operations')}
            className={activeTab === 'daily_operations' ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '8px 18px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Sparkles size={16} />
            🌅 Daily Operations &amp; Audit
            <span style={{
              background: activeTab === 'daily_operations' ? 'rgba(255,255,255,0.2)' : 'rgba(56,189,248,0.15)',
              color: activeTab === 'daily_operations' ? '#fff' : '#38bdf8',
              padding: '2px 8px', borderRadius: 12, fontSize: 11
            }}>
              {dailyPayments.length} slips
            </span>
          </button>

          <button
            onClick={() => setActiveTab('monthly_financials')}
            className={activeTab === 'monthly_financials' ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '8px 18px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Calendar size={16} />
            📅 Monthly Financials &amp; Matrix
            <span style={{
              background: activeTab === 'monthly_financials' ? 'rgba(255,255,255,0.2)' : 'rgba(74,222,128,0.15)',
              color: activeTab === 'monthly_financials' ? '#fff' : '#4ade80',
              padding: '2px 8px', borderRadius: 12, fontSize: 11
            }}>
              {MONTH_NAMES[month - 1]}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('growth_retention')}
            className={activeTab === 'growth_retention' ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '8px 18px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <LineChartIcon size={16} />
            📈 Growth &amp; Retention Intelligence
            <span style={{
              background: activeTab === 'growth_retention' ? 'rgba(255,255,255,0.2)' : 'rgba(129,140,248,0.15)',
              color: activeTab === 'growth_retention' ? '#fff' : '#818cf8',
              padding: '2px 8px', borderRadius: 12, fontSize: 11
            }}>
              {trendYear}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('debts')}
            className={activeTab === 'debts' ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '8px 18px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <AlertCircle size={16} />
            ⚠️ Outstanding Debts &amp; Arrears
            <span style={{
              background: activeTab === 'debts' ? 'rgba(255,255,255,0.2)' : 'rgba(239,68,68,0.15)',
              color: activeTab === 'debts' ? '#fff' : '#ef4444',
              padding: '2px 8px', borderRadius: 12, fontSize: 11
            }}>
              {outstandingList.length}
            </span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* CATEGORY 1: DAILY OPERATIONS & AUDIT LOG                                  */}
        {/* ========================================================================= */}
        {activeTab === 'daily_operations' && (
          <DayEndSummaryTab
            dateRangePreset={dateRangePreset}
            startDate={startDate}
            endDate={endDate}
            setStartDate={setStartDate}
            setEndDate={setEndDate}
            applyDateRangePreset={applyDateRangePreset}
            dateFilterType={dateFilterType}
            setDateFilterType={setDateFilterType}
            dailySubTab={dailySubTab}
            setDailySubTab={setDailySubTab}
            dayEndRegisteredStudents={dayEndRegisteredStudents}
            dailyPayments={dailyPayments}
            filteredDailyPayments={filteredDailyPayments}
            auditorFilter={auditorFilter}
            setAuditorFilter={setAuditorFilter}
            auditorStats={auditorStats}
            bankFilter={bankFilter}
            setBankFilter={setBankFilter}
            searchAudit={searchAudit}
            setSearchAudit={setSearchAudit}
            totalDailyRevenue={totalDailyRevenue}
            allDistinctGrades={allDistinctGrades}
            dayEndGradeNewMap={dayEndGradeNewMap}
            dayEndGradePaidMap={dayEndGradePaidMap}
            dayEndClassPaidMap={dayEndClassPaidMap}
            dayEndAuditorMap={dayEndAuditorMap}
            courseLabels={courseLabels}
            loading={loadingDaily}
          />
        )}

        {/* ========================================================================= */}
        {/* CATEGORY 2: MONTHLY FINANCIALS, MATRIX & ADMISSIONS                       */}
        {/* ========================================================================= */}
        {activeTab === 'monthly_financials' && (
          <MonthlyMatrixTab
            month={month}
            setMonth={setMonth}
            year={year}
            setYear={setYear}
            monthlySubTab={monthlySubTab}
            setMonthlySubTab={setMonthlySubTab}
            matrixMode={matrixMode}
            setMatrixMode={setMatrixMode}
            cumulativeMatrixRows={cumulativeMatrixRows}
            bankRevenue={bankRevenue}
            methodRevenue={methodRevenue}
            totalMonthlyRevenue={totalMonthlyRevenue}
            allPaymentsMonth={allPaymentsMonth}
            newStudents={newStudents}
            filteredNewStudents={filteredNewStudents}
            gradeStats={gradeStats}
            searchStu={searchStu}
            setSearchStu={setSearchStu}
            courseLabels={courseLabels}
          />
        )}

        {/* ========================================================================= */}
        {/* CATEGORY 3: GROWTH & RETENTION INTELLIGENCE                               */}
        {/* ========================================================================= */}
        {activeTab === 'growth_retention' && (
          <div className="fade-in">
            {/* Sub-view switcher for Growth & Retention */}
            <div className="glass-card" style={{ padding: '12px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setGrowthSubTab('trends')}
                  style={{
                    padding: '8px 16px',
                    fontSize: 13,
                    fontWeight: 700,
                    borderRadius: 8,
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: growthSubTab === 'trends' ? 'var(--accent-blue)' : 'var(--bg-base)',
                    color: growthSubTab === 'trends' ? '#fff' : 'var(--text-secondary)'
                  }}
                >
                  <LineChartIcon size={16} />
                  📊 Multi-Month Interactive Trends ({trendYear})
                </button>

                <button
                  type="button"
                  onClick={() => setGrowthSubTab('retention')}
                  style={{
                    padding: '8px 16px',
                    fontSize: 13,
                    fontWeight: 700,
                    borderRadius: 8,
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: growthSubTab === 'retention' ? 'var(--accent-blue)' : 'var(--bg-base)',
                    color: growthSubTab === 'retention' ? '#fff' : 'var(--text-secondary)'
                  }}
                >
                  <RefreshCw size={16} />
                  🔄 Month Retention &amp; Churn Analyzer
                </button>
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Comparing year {trendYear} performance metrics
              </div>
            </div>

            {growthSubTab === 'trends' ? (
              <MultiMonthTrendsTab
                trendYear={trendYear}
                setTrendYear={setTrendYear}
                trendMetric={trendMetric}
                setTrendMetric={setTrendMetric}
                selectedTrendMonths={selectedTrendMonths}
                setSelectedTrendMonths={setSelectedTrendMonths}
                activeTrendGrades={activeTrendGrades}
                setActiveTrendGrades={setActiveTrendGrades}
                trendHoverPoint={trendHoverPoint}
                setTrendHoverPoint={setTrendHoverPoint}
                trendMonthlySeries={trendMonthlySeries}
                trendMoMTable={trendMoMTable}
                chartMaxVal={chartMaxVal}
                svgWidth={svgWidth}
                svgHeight={svgHeight}
                padLeft={padLeft}
                padRight={padRight}
                padTop={padTop}
                padBottom={padBottom}
                plotWidth={plotWidth}
                plotHeight={plotHeight}
              />
            ) : (
              <RetentionAnalyzerTab
                month={month}
                setMonth={setMonth}
                year={year}
                setYear={setYear}
                totalPrevPaid={totalPrevPaid}
                totalCurrPaid={totalCurrPaid}
                totalRetained={totalRetained}
                totalDropped={totalDropped}
                totalNewPaying={totalNewPaying}
                overallRetentionRate={overallRetentionRate}
                overallChurnRate={overallChurnRate}
                potentialLostRevenue={potentialLostRevenue}
                gradeRetentionMatrix={gradeRetentionMatrix}
                filteredRetentionList={filteredRetentionList}
                allRetentionCombined={allRetentionCombined}
                retentionGradeFilter={retentionGradeFilter}
                setRetentionGradeFilter={setRetentionGradeFilter}
                retentionStatusFilter={retentionStatusFilter}
                setRetentionStatusFilter={setRetentionStatusFilter}
                searchRetention={searchRetention}
                setSearchRetention={setSearchRetention}
              />
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* CATEGORY 4: OUTSTANDING DEBTS TABLE                                       */}
        {/* ========================================================================= */}
        {activeTab === 'debts' && (
          <div className="fade-in">
            <div className="glass-card" style={{ padding: 18, marginBottom: 20, display: 'flex', gap: 14, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div style={{ width: 280 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Search Debtor</label>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input className="search-bar" style={{ paddingLeft: 32 }} placeholder="Search PS code, student name, address..."
                    value={searchDebt} onChange={e => setSearchDebt(e.target.value)} />
                </div>
              </div>

              <div>
                <button
                  onClick={() => {
                    const headers = ['PS CODE', 'STUDENT NAME', 'GRADE', 'CLASS', 'OUTSTANDING DEBT (RS)', 'DELIVERY ADDRESS']
                    const rows = filteredDebts.map(d => [
                      `"${d.ps_code}"`,
                      `"${(d.full_name || '').replace(/"/g, '""')}"`,
                      `"Grade ${d.grade || '?'}"`,
                      `"${courseLabels[d.class_type] || CLASS_LABELS[d.class_type] || d.class_type}"`,
                      `"${Math.abs(d.current_balance || 0)}"`,
                      `"${(d.address || '').replace(/"/g, '""')}"`
                    ])
                    exportTableToCsv(`Outstanding_Debts_Report`, headers, rows)
                  }}
                  className="btn-primary"
                  style={{ background: '#ef4444', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <FileSpreadsheet size={16} /> Export CSV
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
              <div className="stat-card" style={{ borderLeft: '4px solid #f87171', boxShadow: '0 4px 20px -4px rgba(248, 113, 113, 0.25)' }}>
                <div className="stat-card label">Total Outstanding Portfolio Debt</div>
                <div className="stat-card value" style={{ color: '#f87171' }}>Rs. {totalDebtAmount.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{outstandingList.length} student ledger balances in debt</div>
              </div>
            </div>

            <div className="glass-card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#f87171', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircle size={16} /> Students with Outstanding Debt ({filteredDebts.length} Records)
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>PS Code</th>
                      <th>Student Name</th>
                      <th>Grade</th>
                      <th>Class</th>
                      <th>Outstanding Debt</th>
                      <th>Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDebts.map((item, idx) => (
                      <tr key={`${item.ps_code}-${idx}`}>
                        <td>
                          <a href={`/students/${encodeURIComponent(item.ps_code)}`} style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontWeight: 700 }}>
                            {item.ps_code}
                          </a>
                        </td>
                        <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{item.full_name || '—'}</td>
                        <td>Gr {item.grade || '—'}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{courseLabels[item.class_type] || CLASS_LABELS[item.class_type] || item.class_type}</td>
                        <td style={{ color: '#f87171', fontWeight: 800, fontSize: 14 }}>Rs. {Math.abs(item.current_balance).toLocaleString()}</td>
                        <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.address || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
