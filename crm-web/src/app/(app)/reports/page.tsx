'use client'

import { useEffect, useState } from 'react'
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
import { exportTableToCsv, TARGET_GRADES } from '@/lib/reports-analytics'
import DayEndSummaryTab from './components/DayEndSummaryTab'
import MonthlyMatrixTab from './components/MonthlyMatrixTab'
import MultiMonthTrendsTab from './components/MultiMonthTrendsTab'
import RetentionAnalyzerTab from './components/RetentionAnalyzerTab'

export default function ReportsPage() {
  const supabase = createClient()

  // Primary Tab selection
  const [activeTab, setActiveTab] = useState<'day_end' | 'matrix_report' | 'trend_analytics' | 'retention' | 'daily_audit' | 'registrations' | 'bank_revenue' | 'debts'>('day_end')

  // Date filters
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))

  const [loading, setLoading] = useState(true)

  // 0. Day-End Registrations State
  const [dayEndRegisteredStudents, setDayEndRegisteredStudents] = useState<any[]>([])

  // 0.5. Monthly Cumulative Matrix Mode ('payments' vs 'registrations')
  const [matrixMode, setMatrixMode] = useState<'registrations' | 'payments'>('payments')

  // 0.6. Multi-Month Business Trend Line Chart Analytics State
  const [trendYear, setTrendYear] = useState(new Date().getFullYear())
  const [trendMetric, setTrendMetric] = useState<'students' | 'revenue' | 'registrations'>('students')
  const [selectedTrendMonths, setSelectedTrendMonths] = useState<number[]>([1, 2, 3, 4, 5, 6, 7, 8])
  const [activeTrendGrades, setActiveTrendGrades] = useState<number[]>([0, 6, 7, 8, 9, 10, 11]) // 0 is Total
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

  useEffect(() => {
    loadAllReportData()
  }, [month, year, trendYear, selectedDate, dateFilterType])

  async function loadAllReportData() {
    setLoading(true)
    try {
      // Calculate start and end of the selected month
      const startOfMonth = new Date(year, month - 1, 1).toISOString()
      const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999).toISOString()
      // Also look back 45 days before the selected month for any advance registrations targeting this month
      const startOfAdvanceLookback = new Date(year, month - 2, 1).toISOString()

      // Calculate start and end of the trend analysis year
      const startOfTrendYear = new Date(trendYear, 0, 1).toISOString()
      const endOfTrendYear = new Date(trendYear, 11, 31, 23, 59, 59, 999).toISOString()

      // Calculate start and end bounds for the selected day in UTC/ISO
      const startOfDay = `${selectedDate}T00:00:00.000Z`
      const endOfDay = `${selectedDate}T23:59:59.999Z`

      // 1. Fetch daily audit payments with pagination to support large volume
      let dailyList: any[] = []
      let dailyFrom = 0
      let hasMoreDaily = true
      const CHUNK_SIZE = 1000

      while (hasMoreDaily) {
        let q = supabase
          .from('payments')
          .select('*, students(ps_code, full_name, grade, created_at, household:households(parent_name, parent_phone, address), enrollments(*))')
          .range(dailyFrom, dailyFrom + CHUNK_SIZE - 1)
          .order('created_at', { ascending: false })

        if (dateFilterType === 'created_at') {
          q = q.gte('created_at', startOfDay).lte('created_at', endOfDay)
        } else {
          q = q.eq('date_paid', selectedDate)
        }

        const { data: chunk, error: dErr } = await q
        if (dErr) throw dErr

        dailyList = dailyList.concat(chunk || [])
        if (!chunk || chunk.length < CHUNK_SIZE) {
          hasMoreDaily = false
        } else {
          dailyFrom += CHUNK_SIZE
        }
      }

      // Calculate previous and next month/year numbers
      const prevMonthNum = month === 1 ? 12 : month - 1
      const prevYearNum = month === 1 ? year - 1 : year
      const nextMonthNum = month === 12 ? 1 : month + 1
      const nextYearNum = month === 12 ? year + 1 : year

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

      // Fetch paginated payments in parallel
      const [
        monthlyPaymentsData,
        prevMonthPaymentsData,
        nextMonthPaymentsData,
        trendYearPaymentsData,
        { data: registeredData },
        { data: dayEndRegisteredData },
        { data: outData },
        { data: trendYearStudentsData }
      ] = await Promise.all([
        // Payments in THIS month (paginated) - with students info, created_at, household & enrollments
        fetchAllPaginated((from, to) =>
          supabase
            .from('payments')
            .select('*, students(id, ps_code, full_name, grade, created_at, created_by, household:households(parent_name, parent_phone, address), enrollments(*))')
            .eq('month', month)
            .eq('year', year)
            .range(from, to)
        ),
        // Payments in PREVIOUS month (paginated)
        fetchAllPaginated((from, to) =>
          supabase
            .from('payments')
            .select('*, students(ps_code, full_name, grade, household:households(parent_name, parent_phone, address))')
            .eq('month', prevMonthNum)
            .eq('year', prevYearNum)
            .range(from, to)
        ),
        // Payments in NEXT month (paginated) - to identify advance registrants belonging to next month
        fetchAllPaginated((from, to) =>
          supabase
            .from('payments')
            .select('month, year, student_id, students(ps_code)')
            .eq('month', nextMonthNum)
            .eq('year', nextYearNum)
            .range(from, to)
        ),
        // Multi-Month Trends: All payments for the selected trend year (paginated)
        fetchAllPaginated((from, to) =>
          supabase
            .from('payments')
            .select('month, year, amount_paid, class_type, students(ps_code, full_name, grade, created_at)')
            .eq('year', trendYear)
            .range(from, to)
        ),
        // Real new registered students created in this month or advance window
        supabase
          .from('students')
          .select('*, household:households(*), enrollments(*)')
          .not('created_by', 'ilike', '%Auto-Pre-generated%')
          .gte('created_at', startOfAdvanceLookback)
          .lte('created_at', endOfMonth)
          .order('created_at', { ascending: false }),
        // Real new registered students specifically on selected date
        supabase
          .from('students')
          .select('*, household:households(*), enrollments(*)')
          .not('created_by', 'ilike', '%Auto-Pre-generated%')
          .gte('created_at', startOfDay)
          .lte('created_at', endOfDay)
          .order('created_at', { ascending: false }),
        // Outstanding debts
        supabase
          .from('students_outstanding')
          .select('*'),
        // Multi-Month Trends: All new students registered in the selected trend year
        supabase
          .from('students')
          .select('created_at, grade')
          .not('created_by', 'ilike', '%Auto-Pre-generated%')
          .gte('created_at', startOfTrendYear)
          .lte('created_at', endOfTrendYear)
      ])

      // Process Multi-Month Trend Year Datasets
      setTrendPaymentsYear(trendYearPaymentsData || [])
      setTrendStudentsYear(trendYearStudentsData || [])

      // 0. Process Day-End Registered Students
      setDayEndRegisteredStudents(dayEndRegisteredData || [])

      // 0.75. Process Previous Month Payments for Retention
      setPrevMonthPayments(prevMonthPaymentsData || [])

      // 1. Process New Registered Students & Grade Breakdown
      // Sync advance registrations: A student whose first target payment month is this month
      // or who physically registered in this month (without prior payments) belongs to this month's cohort.
      const payList = monthlyPaymentsData || []
      setAllPaymentsMonth(payList)

      const prevPaidPsCodes = new Set<string>()
      ;(prevMonthPaymentsData || []).forEach((p: any) => {
        const ps = p.students?.ps_code || p.student_id
        if (ps) prevPaidPsCodes.add(ps)
      })

      const thisPaidPsCodes = new Set<string>()
      payList.forEach((p: any) => {
        const ps = p.students?.ps_code || p.student_id
        if (ps) thisPaidPsCodes.add(ps)
      })

      const nextPaidPsCodes = new Set<string>()
      ;(nextMonthPaymentsData || []).forEach((p: any) => {
        const ps = p.students?.ps_code || p.student_id
        if (ps) nextPaidPsCodes.add(ps)
      })

      // Collect unique new registered students for this month
      const newStuMap = new Map<string, any>()

      // A. Add students directly registered in the current month bounds
      // BUT if they paid for NEXT month (and NOT for this month), they are advance registrants for next month!
      ;(registeredData || []).forEach(s => {
        const ps = s.ps_code || s.id
        const sCreatedAt = s.created_at ? new Date(s.created_at).toISOString() : ''
        if (sCreatedAt >= startOfMonth && sCreatedAt <= endOfMonth) {
          // If this student has paid for next month (e.g. September) and didn't pay for this month (e.g. August),
          // they belong to September, so do not include them in August!
          if (nextPaidPsCodes.has(ps) && !thisPaidPsCodes.has(ps)) {
            return
          }
          newStuMap.set(ps, s)
        }
      })

      // B. Add students from payments for this month who registered in advance (e.g. late August for September)
      // and who were not already paying students in previous months
      payList.forEach((p: any) => {
        const s = p.students
        if (!s) return
        const ps = s.ps_code || p.student_id
        if (!ps || prevPaidPsCodes.has(ps)) return

        const sCreatedAt = s.created_at ? new Date(s.created_at).toISOString() : ''
        // If created before this month started (advance registration) up to end of this month
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

      // 3. Process Date-Wise Daily Payment & Auditor Logs
      setDailyPayments(dailyList)

      const aMap: Record<string, { count: number; total: number }> = {}
      dailyList.forEach((p: any) => {
        const who = p.recorded_by || 'System User'
        const amt = Number(p.amount_paid) || 0
        if (!aMap[who]) aMap[who] = { count: 0, total: 0 }
        aMap[who].count += 1
        aMap[who].total += amt
      })
      setAuditorStats(aMap)

      // 4. Debts
      setOutstandingList(outData || [])

    } catch (e) {
      console.error('Error loading report analytics:', e)
    } finally {
      setLoading(false)
    }
  }

  // Filtered lists for simple tabs
  const filteredNewStudents = newStudents.filter(s => {
    if (!searchStu.trim()) return true
    const term = searchStu.toLowerCase()
    return (
      s.ps_code?.toLowerCase().includes(term) ||
      s.full_name?.toLowerCase().includes(term) ||
      s.household?.parent_name?.toLowerCase().includes(term) ||
      s.household?.parent_phone?.toLowerCase().includes(term)
    )
  })

  const filteredDailyPayments = dailyPayments.filter(p => {
    if (auditorFilter && (p.recorded_by || 'System User') !== auditorFilter) {
      return false
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

  const filteredDebts = outstandingList.filter(d => {
    if (!searchDebt.trim()) return true
    const term = searchDebt.toLowerCase()
    return (
      d.ps_code?.toLowerCase().includes(term) ||
      d.full_name?.toLowerCase().includes(term) ||
      d.address?.toLowerCase().includes(term)
    )
  })

  const totalMonthlyRevenue = allPaymentsMonth.reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0)
  const totalDailyRevenue = dailyPayments.reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0)
  const totalDebtAmount = outstandingList.reduce((sum, d) => sum + Math.abs(d.current_balance || 0), 0)

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
    const gr = p.students?.grade || 0
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
    new Set([6, 7, 8, 9, 10, 11, ...Object.keys(dayEndGradeNewMap).map(Number), ...Object.keys(dayEndGradePaidMap).map(Number)])
  ).filter(g => g > 0).sort((a, b) => a - b)

  // -------------------------------------------------------------------------
  // 2. MONTHLY CUMULATIVE MATRIX CALCULATIONS
  // -------------------------------------------------------------------------
  const daysInSelectedMonth = new Date(year, month, 0).getDate()
  const matrixTargetGrades = TARGET_GRADES

  const rawDailyCounts: Record<number, Record<number, number>> = {}
  for (let d = 1; d <= daysInSelectedMonth; d++) {
    rawDailyCounts[d] = { 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0 }
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
    // If paid before day 1 of the selected month (e.g. advance payment in August for September month),
    // it counts on Day 1 (01/MM).
    // If paid on or after day 1 of the selected month, it counts on its respective day.
    const monthStartIso = `${year}-${String(month).padStart(2, '0')}-01`
    
    // Group unique students by grade and day so multiple class payments by same student don't double count if measuring students
    const seenStudentDay = new Set<string>()

    allPaymentsMonth.forEach(p => {
      const psCode = p.students?.ps_code || p.student_id || p.id
      const g = p.students?.grade || 0
      if (!matrixTargetGrades.includes(g)) return

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

  const runningGradeTotals: Record<number, number> = { 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0 }

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
      6: new Set(), 7: new Set(), 8: new Set(), 9: new Set(), 10: new Set(), 11: new Set()
    }
    const allPayingStudentsSet = new Set<string>()
    const gradeRevenueMap: Record<number, number> = { 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0 }
    let totalRevenue = 0

    mPayments.forEach((p: any) => {
      const ps = p.students?.ps_code || p.student_id || 'unknown'
      const gr = p.students?.grade || 0
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
      const firstPaidMonth = ps ? studentFirstPaidMonthInTrendYear.get(ps) : undefined
      if (firstPaidMonth !== undefined) {
        return firstPaidMonth === m
      }
      const d = new Date(s.created_at)
      return d.getMonth() + 1 === m
    })
    const gradeRegMap: Record<number, number> = { 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0 }
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
        6: gradePayingStudentsMap[6].size,
        7: gradePayingStudentsMap[7].size,
        8: gradePayingStudentsMap[8].size,
        9: gradePayingStudentsMap[9].size,
        10: gradePayingStudentsMap[10].size,
        11: gradePayingStudentsMap[11].size,
      } as Record<number, number>,
      revenueByGrade: {
        0: totalRevenue,
        6: gradeRevenueMap[6],
        7: gradeRevenueMap[7],
        8: gradeRevenueMap[8],
        9: gradeRevenueMap[9],
        10: gradeRevenueMap[10],
        11: gradeRevenueMap[11],
      } as Record<number, number>,
      regByGrade: {
        0: mStudents.length,
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

        <a
          href="/settings"
          className="btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, textDecoration: 'none', padding: '8px 14px' }}
        >
          <Mail size={16} style={{ color: 'var(--accent-blue)' }} />
          📧 Email Automation Settings
        </a>
      </div>

      <div className="page-content">
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 12, flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveTab('day_end')}
            className={activeTab === 'day_end' ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '8px 18px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Sparkles size={16} />
            🌅 Day-End Summary
            <span style={{
              background: activeTab === 'day_end' ? 'rgba(255,255,255,0.2)' : 'rgba(59,130,246,0.15)',
              color: activeTab === 'day_end' ? '#fff' : 'var(--accent-blue)',
              padding: '2px 8px', borderRadius: 12, fontSize: 11
            }}>
              {selectedDate}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('matrix_report')}
            className={activeTab === 'matrix_report' ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '8px 18px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Calendar size={16} />
            📈 Monthly Date Matrix
            <span style={{
              background: activeTab === 'matrix_report' ? 'rgba(255,255,255,0.2)' : 'rgba(16,185,129,0.15)',
              color: activeTab === 'matrix_report' ? '#fff' : '#10b981',
              padding: '2px 8px', borderRadius: 12, fontSize: 11
            }}>
              {MONTH_NAMES[month - 1]}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('trend_analytics')}
            className={activeTab === 'trend_analytics' ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '8px 18px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <LineChartIcon size={16} />
            📊 Multi-Month Trends
            <span style={{
              background: activeTab === 'trend_analytics' ? 'rgba(255,255,255,0.2)' : 'rgba(59,130,246,0.15)',
              color: activeTab === 'trend_analytics' ? '#fff' : 'var(--accent-blue)',
              padding: '2px 8px', borderRadius: 12, fontSize: 11
            }}>
              {trendYear} ({selectedTrendMonths.length}M)
            </span>
          </button>

          <button
            onClick={() => setActiveTab('retention')}
            className={activeTab === 'retention' ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '8px 18px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <RefreshCw size={16} />
            🔄 Retention &amp; Continuity
            <span style={{
              background: activeTab === 'retention' ? 'rgba(255,255,255,0.2)' : 'rgba(139,92,246,0.15)',
              color: activeTab === 'retention' ? '#fff' : '#8b5cf6',
              padding: '2px 8px', borderRadius: 12, fontSize: 11
            }}>
              Analysis
            </span>
          </button>

          <button
            onClick={() => setActiveTab('daily_audit')}
            className={activeTab === 'daily_audit' ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '8px 18px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <ShieldCheck size={16} />
            Audit Log
            <span style={{
              background: activeTab === 'daily_audit' ? 'rgba(255,255,255,0.2)' : 'rgba(59,130,246,0.15)',
              color: activeTab === 'daily_audit' ? '#fff' : 'var(--accent-blue)',
              padding: '2px 8px', borderRadius: 12, fontSize: 11
            }}>
              {dailyPayments.length} slips
            </span>
          </button>

          <button
            onClick={() => setActiveTab('registrations')}
            className={activeTab === 'registrations' ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '8px 18px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Users size={16} />
            Monthly Registrations
            <span style={{
              background: activeTab === 'registrations' ? 'rgba(255,255,255,0.2)' : 'rgba(59,130,246,0.15)',
              color: activeTab === 'registrations' ? '#fff' : 'var(--accent-blue)',
              padding: '2px 8px', borderRadius: 12, fontSize: 11
            }}>
              {newStudents.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('bank_revenue')}
            className={activeTab === 'bank_revenue' ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '8px 18px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Building2 size={16} />
            Bank Revenue
            <span style={{
              background: activeTab === 'bank_revenue' ? 'rgba(255,255,255,0.2)' : 'rgba(59,130,246,0.15)',
              color: activeTab === 'bank_revenue' ? '#fff' : 'var(--accent-blue)',
              padding: '2px 8px', borderRadius: 12, fontSize: 11
            }}>
              Rs. {totalMonthlyRevenue.toLocaleString()}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('debts')}
            className={activeTab === 'debts' ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '8px 18px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <AlertCircle size={16} />
            Debts
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
        {/* TAB 0: DAY-END CLASS & GRADE-WISE SUMMARY REPORT                          */}
        {/* ========================================================================= */}
        {activeTab === 'day_end' && (
          <DayEndSummaryTab
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            dateFilterType={dateFilterType}
            setDateFilterType={setDateFilterType}
            dayEndRegisteredStudents={dayEndRegisteredStudents}
            dailyPayments={dailyPayments}
            totalDailyRevenue={totalDailyRevenue}
            allDistinctGrades={allDistinctGrades}
            dayEndGradeNewMap={dayEndGradeNewMap}
            dayEndGradePaidMap={dayEndGradePaidMap}
            dayEndClassPaidMap={dayEndClassPaidMap}
            dayEndAuditorMap={dayEndAuditorMap}
          />
        )}

        {/* ========================================================================= */}
        {/* TAB 1: MONTH-BY-MONTH NEW REGISTRATIONS                                    */}
        {/* ========================================================================= */}
        {activeTab === 'registrations' && (
          <div className="fade-in">
            <div className="glass-card" style={{ padding: 18, marginBottom: 20, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Registration Month</label>
                  <select className="input-field" style={{ width: 140 }} value={month} onChange={e => setMonth(parseInt(e.target.value))}>
                    {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Year</label>
                  <select className="input-field" style={{ width: 100 }} value={year} onChange={e => setYear(parseInt(e.target.value))}>
                    {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div style={{ width: 220 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Search Student / PS</label>
                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input className="search-bar" style={{ paddingLeft: 32 }} placeholder="Search PS code or name..."
                      value={searchStu} onChange={e => setSearchStu(e.target.value)} />
                  </div>
                </div>
              </div>

              <div>
                <button
                  onClick={() => {
                    const headers = ['PS CODE', 'STUDENT NAME', 'GRADE', 'PARENT NAME', 'PHONE', 'ADDRESS', 'ENROLLED CLASSES', 'REGISTERED DATE', 'REGISTERED BY']
                    const rows = filteredNewStudents.map(s => [
                      `"${s.ps_code}"`,
                      `"${(s.full_name || '').replace(/"/g, '""')}"`,
                      `"Grade ${s.grade || '?'}"`,
                      `"${(s.household?.parent_name || '').replace(/"/g, '""')}"`,
                      `"${(s.household?.parent_phone || '').replace(/"/g, '""')}"`,
                      `"${(s.household?.address || '').replace(/"/g, '""')}"`,
                      `"${(s.enrollments || []).map((e: any) => CLASS_LABELS[e.class_type] || e.class_type).join('; ')}"`,
                      `"${new Date(s.created_at).toLocaleDateString()}"`,
                      `"${s.created_by || 'System'}"`
                    ])
                    exportTableToCsv(`New_Registrations_${MONTH_NAMES[month - 1]}_${year}`, headers, rows)
                  }}
                  className="btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <FileSpreadsheet size={16} /> Export Excel
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
              <div className="stat-card" style={{ padding: '12px 14px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total New</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{newStudents.length}</div>
              </div>
              {[6, 7, 8, 9, 10, 11, 12, 13].map(g => (
                <div key={g} className="stat-card" style={{ padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Grade {g}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: (gradeStats[g] || 0) > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    {gradeStats[g] || 0}
                  </div>
                </div>
              ))}
            </div>

            <div className="glass-card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Users size={16} style={{ color: 'var(--accent-blue)' }} />
                  New Registered Students in {MONTH_NAMES[month - 1]} {year} ({filteredNewStudents.length} Records)
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>PS Code</th>
                      <th>Student / Child Name</th>
                      <th>Grade</th>
                      <th>Enrolled Classes</th>
                      <th>Parent Contact &amp; Delivery Address</th>
                      <th>Registered On</th>
                      <th>Registered By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredNewStudents.map(s => (
                      <tr key={s.id}>
                        <td>
                          <a
                            href={`/students/${encodeURIComponent(s.ps_code)}`}
                            style={{ color: 'var(--accent-blue)', fontWeight: 700, textDecoration: 'none', letterSpacing: 0.5 }}
                          >
                            {s.ps_code}
                          </a>
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {s.full_name || '—'}
                        </td>
                        <td>
                          <span className="badge" style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--accent-blue)' }}>
                            Grade {s.grade || '?'}
                          </span>
                        </td>
                        <td style={{ fontSize: 12 }}>
                          {(s.enrollments || []).length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              {(s.enrollments || []).map((e: any) => (
                                <span key={e.id} style={{ color: 'var(--text-secondary)' }}>
                                • {CLASS_LABELS[e.class_type] || e.class_type}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>No active classes</span>
                          )}
                        </td>
                        <td>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                            {s.household?.parent_name || '—'}
                          </div>
                          {s.household?.parent_phone && (
                            <div style={{ fontSize: 11, color: 'var(--accent-blue)' }}>📞 {s.household.parent_phone}</div>
                          )}
                          {s.household?.address && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              📍 {s.household.address}
                            </div>
                          )}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
                          {s.created_by || 'Admin / System'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredNewStudents.length === 0 && (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Users size={32} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
                  <div>No new student registrations recorded in {MONTH_NAMES[month - 1]} {year}.</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: BANK-WISE TOTAL REVENUE                                            */}
        {/* ========================================================================= */}
        {activeTab === 'bank_revenue' && (
          <div className="fade-in">
            <div className="glass-card" style={{ padding: 18, marginBottom: 20, display: 'flex', gap: 14, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Month</label>
                  <select className="input-field" style={{ width: 140 }} value={month} onChange={e => setMonth(parseInt(e.target.value))}>
                    {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Year</label>
                  <select className="input-field" style={{ width: 100 }} value={year} onChange={e => setYear(parseInt(e.target.value))}>
                    {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <button
                  onClick={() => {
                    const headers = ['BANK NAME', 'TRANSACTIONS COUNT', 'TOTAL REVENUE (RS)', 'SHARE %']
                    const rows = bankRevenue.map(b => [
                      `"${b.bank}"`,
                      `"${b.count}"`,
                      `"${b.total}"`,
                      `"${totalMonthlyRevenue > 0 ? ((b.total / totalMonthlyRevenue) * 100).toFixed(1) : 0}%"`
                    ])
                    exportTableToCsv(`Bank_Revenue_${MONTH_NAMES[month - 1]}_${year}`, headers, rows)
                  }}
                  className="btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <FileSpreadsheet size={16} /> Export CSV
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
              <div className="stat-card">
                <div className="stat-card label">Total Collected ({MONTH_NAMES[month - 1]})</div>
                <div className="stat-card value" style={{ color: 'var(--text-primary)' }}>Rs. {totalMonthlyRevenue.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Total {allPaymentsMonth.length} class payment records</div>
              </div>

              <div className="stat-card">
                <div className="stat-card label">Top Bank Revenue</div>
                <div className="stat-card value" style={{ color: 'var(--text-primary)', fontSize: 20 }}>
                  {bankRevenue[0]?.bank || 'None'}: Rs. {(bankRevenue[0]?.total || 0).toLocaleString()}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{bankRevenue[0]?.count || 0} deposits</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20 }}>
              <div className="glass-card" style={{ padding: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Building2 size={18} style={{ color: 'var(--accent-blue)' }} />
                  Bank-Wise Revenue Breakdown
                </div>

                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Bank Name</th>
                      <th style={{ textAlign: 'center' }}>Transactions</th>
                      <th style={{ textAlign: 'right' }}>Total Revenue (Rs.)</th>
                      <th style={{ textAlign: 'right' }}>% Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bankRevenue.map(b => {
                      const share = totalMonthlyRevenue > 0 ? ((b.total / totalMonthlyRevenue) * 100).toFixed(1) : '0.0'
                      return (
                        <tr key={b.bank}>
                          <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            🏛 {b.bank}
                          </td>
                          <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                            {b.count} slips
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                            Rs. {b.total.toLocaleString()}
                          </td>
                          <td style={{ textAlign: 'right', fontSize: 12, color: 'var(--accent-blue)', fontWeight: 600 }}>
                            {share}%
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="glass-card" style={{ padding: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Layers size={18} style={{ color: 'var(--accent-blue)' }} />
                  Payment Channels &amp; Types
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {methodRevenue.map(m => {
                    const share = totalMonthlyRevenue > 0 ? ((m.total / totalMonthlyRevenue) * 100).toFixed(1) : '0.0'
                    return (
                      <div key={m.method} style={{ padding: 14, background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span className="badge" style={{ fontSize: 12, fontWeight: 700, background: 'rgba(59,130,246,0.1)', color: 'var(--accent-blue)' }}>
                            {m.method}
                          </span>
                          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                            Rs. {m.total.toLocaleString()}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
                          <span>{m.count} payments processed</span>
                          <span>{share}% of month</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: DATE-WISE DAILY PAYMENT AUDIT REPORT                               */}
        {/* ========================================================================= */}
        {activeTab === 'daily_audit' && (
          <div className="fade-in">
            <div className="glass-card" style={{ padding: 18, marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                      Select Date
                    </label>
                    <input
                      type="date"
                      className="input-field"
                      style={{ width: 160 }}
                      value={selectedDate}
                      onChange={e => setSelectedDate(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))}
                      className={selectedDate === new Date().toISOString().slice(0, 10) ? 'btn-primary' : 'btn-secondary'}
                      style={{ padding: '6px 12px', fontSize: 12 }}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date()
                        d.setDate(d.getDate() - 1)
                        setSelectedDate(d.toISOString().slice(0, 10))
                      }}
                      className={(() => {
                        const d = new Date()
                        d.setDate(d.getDate() - 1)
                        return selectedDate === d.toISOString().slice(0, 10)
                      })() ? 'btn-primary' : 'btn-secondary'}
                      style={{ padding: '6px 12px', fontSize: 12 }}
                    >
                      Yesterday
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date()
                        d.setDate(d.getDate() - 2)
                        setSelectedDate(d.toISOString().slice(0, 10))
                      }}
                      className={(() => {
                        const d = new Date()
                        d.setDate(d.getDate() - 2)
                        return selectedDate === d.toISOString().slice(0, 10)
                      })() ? 'btn-primary' : 'btn-secondary'}
                      style={{ padding: '6px 12px', fontSize: 12 }}
                    >
                      2 Days Ago
                    </button>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                      Audit By
                    </label>
                    <select
                      className="input-field"
                      style={{ width: 170 }}
                      value={dateFilterType}
                      onChange={e => setDateFilterType(e.target.value as any)}
                    >
                      <option value="created_at">System Entry Time</option>
                      <option value="date_paid">Slip Paid Date</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                      Filter Auditor
                    </label>
                    <select
                      className="input-field"
                      style={{ width: 160 }}
                      value={auditorFilter}
                      onChange={e => setAuditorFilter(e.target.value)}
                    >
                      <option value="">All Auditors ({dailyPayments.length})</option>
                      {Object.keys(auditorStats).map(who => (
                        <option key={who} value={who}>{who} ({auditorStats[who].count})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <button
                    onClick={() => {
                      const headers = ['PS CODE', 'STUDENT NAME', 'CLASS', 'AMOUNT (RS)', 'PAYMENT TYPE', 'BANK', 'AUDITOR (RECORDED BY)', 'TIME', 'DELIVERY', 'NOTES']
                      const rows = filteredDailyPayments.map(p => [
                        `"${p.students?.ps_code || ''}"`,
                        `"${(p.students?.full_name || '').replace(/"/g, '""')}"`,
                        `"${CLASS_LABELS[p.class_type] || p.class_type}"`,
                        `"${p.amount_paid || 0}"`,
                        `"${p.payment_type || 'BANK'}"`,
                        `"${p.bank_name || ''}"`,
                        `"${p.recorded_by || 'System'}"`,
                        `"${new Date(p.created_at).toLocaleTimeString()}"`,
                        `"${(p.notes || '').includes('[DISPATCHED:') ? 'Dispatched' : p.tute_delivered ? 'Ready to Export' : 'No Delivery'}"`,
                        `"${(p.notes || '').replace(/"/g, '""')}"`
                      ])
                      exportTableToCsv(`Daily_Audit_Log_${selectedDate}`, headers, rows)
                    }}
                    className="btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <FileSpreadsheet size={16} /> Export CSV
                  </button>
                </div>
              </div>

              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="input-field"
                  style={{ paddingLeft: 36, width: '100%' }}
                  placeholder="Search daily slips by PS Code, Student Name, Bank, Auditor..."
                  value={searchAudit}
                  onChange={e => setSearchAudit(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
              <div className="stat-card">
                <div className="stat-card label">Total Collected ({selectedDate})</div>
                <div className="stat-card value" style={{ color: 'var(--text-primary)' }}>Rs. {totalDailyRevenue.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{dailyPayments.length} slips audited</div>
              </div>

              {Object.entries(auditorStats).map(([who, data]) => (
                <div key={who} className="stat-card">
                  <div className="stat-card label">Auditor: {who}</div>
                  <div className="stat-card value" style={{ color: 'var(--text-primary)', fontSize: 20 }}>
                    Rs. {data.total.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{data.count} slips marked</div>
                </div>
              ))}
            </div>

            <div className="glass-card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ShieldCheck size={16} style={{ color: 'var(--accent-blue)' }} />
                  Payments Logged on {selectedDate} ({filteredDailyPayments.length} Slips)
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>PS Code</th>
                      <th>Student Name</th>
                      <th>Class</th>
                      <th>Amount Paid</th>
                      <th>Method &amp; Bank</th>
                      <th>Auditor (Recorded By)</th>
                      <th>Time</th>
                      <th>Delivery / Dispatch</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDailyPayments.map(p => (
                      <tr key={p.id}>
                        <td>
                          <a href={`/students/${encodeURIComponent(p.students?.ps_code || '')}`} style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontWeight: 700 }}>
                            {p.students?.ps_code || '—'}
                          </a>
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {p.students?.full_name || '—'}
                        </td>
                        <td style={{ fontSize: 12 }}>
                          {CLASS_LABELS[p.class_type] || p.class_type} (Gr {p.students?.grade || '?'})
                        </td>
                        <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          Rs. {Number(p.amount_paid || 0).toLocaleString()}
                        </td>
                        <td>
                          <span className="badge" style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--accent-blue)' }}>
                            {p.payment_type || 'BANK'} {p.bank_name ? `(${p.bank_name})` : ''}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          🔒 {p.recorded_by || 'Admin / System'}
                        </td>
                        <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ fontSize: 11 }}>
                          {(p.notes || '').includes('[DISPATCHED:') ? (
                            <span style={{ color: '#10b981', fontWeight: 600 }}>
                              ✓ Dispatched ({p.notes.match(/\[DISPATCHED:\s*([^\]]+)\]/)?.[1] || 'Batch'})
                            </span>
                          ) : p.tute_delivered ? (
                            <span style={{ color: '#f59e0b', fontWeight: 600 }}>
                              📦 Ready to Export (Pending Dispatch)
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>
                              — No Postal Delivery
                            </span>
                          )}
                        </td>
                        <td style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.notes ? p.notes.replace(/\[DISPATCHED:[^\]]+\]/g, '').trim() || '—' : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: OUTSTANDING DEBTS TABLE                                            */}
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
                      `"${CLASS_LABELS[d.class_type] || d.class_type}"`,
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
              <div className="stat-card" style={{ borderLeft: '4px solid #ef4444' }}>
                <div className="stat-card label">Total Outstanding Portfolio Debt</div>
                <div className="stat-card value" style={{ color: '#ef4444' }}>Rs. {totalDebtAmount.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{outstandingList.length} student ledger balances in debt</div>
              </div>
            </div>

            <div className="glass-card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 8 }}>
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
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{CLASS_LABELS[item.class_type] || item.class_type}</td>
                        <td style={{ color: '#ef4444', fontWeight: 800, fontSize: 14 }}>Rs. {Math.abs(item.current_balance).toLocaleString()}</td>
                        <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.address || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: MONTHLY CUMULATIVE DATE-BY-DATE GRADE PROGRESSION MATRIX           */}
        {/* ========================================================================= */}
        {activeTab === 'matrix_report' && (
          <MonthlyMatrixTab
            month={month}
            setMonth={setMonth}
            year={year}
            setYear={setYear}
            matrixMode={matrixMode}
            setMatrixMode={setMatrixMode}
            cumulativeMatrixRows={cumulativeMatrixRows}
          />
        )}

        {/* ========================================================================= */}
        {/* TAB 6: STUDENT PAYMENT RETENTION & CONTINUITY ANALYZER                     */}
        {/* ========================================================================= */}
        {activeTab === 'retention' && (
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

        {/* ========================================================================= */}
        {/* TAB 7: MULTI-MONTH BUSINESS TRENDS & MULTI-LINE GROWTH ANALYTICS          */}
        {/* ========================================================================= */}
        {activeTab === 'trend_analytics' && (
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
        )}
      </div>
    </div>
  )
}
