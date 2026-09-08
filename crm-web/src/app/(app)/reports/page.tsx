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
  Printer,
  Sparkles,
  BookOpen,
  GraduationCap,
  RefreshCw,
  Phone,
  TrendingUp,
  TrendingDown,
  UserCheck,
  UserX,
  UserPlus,
  LineChart as LineChartIcon
} from 'lucide-react'
import { MONTH_NAMES, CLASS_LABELS } from '@/lib/types'

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

  // 0.5. Monthly Cumulative Matrix Mode ('registrations' vs 'payments')
  const [matrixMode, setMatrixMode] = useState<'registrations' | 'payments'>('registrations')

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
          .select('*, students(ps_code, full_name, grade)')
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

      // Calculate previous month and year for retention comparison
      const prevMonthNum = month === 1 ? 12 : month - 1
      const prevYearNum = month === 1 ? year - 1 : year

      // 2. Fetch monthly data, day-end registrations, prev month payments, debts & trend year data in parallel
      const [
        { data: registeredData },
        { data: dayEndRegisteredData },
        { data: monthlyPaymentsData },
        { data: prevMonthPaymentsData },
        { data: outData },
        { data: trendYearPaymentsData },
        { data: trendYearStudentsData }
      ] = await Promise.all([
        // Real new registered students in this month
        supabase
          .from('students')
          .select('*, household:households(*), enrollments(*)')
          .not('created_by', 'ilike', '%Auto-Pre-generated%')
          .gte('created_at', startOfMonth)
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

        // Payments in this month (for Bank & Method revenue and retention comparison)
        supabase
          .from('payments')
          .select('*, students(ps_code, full_name, grade, household:households(parent_name, parent_phone, address))')
          .eq('month', month)
          .eq('year', year),

        // Payments in PREVIOUS month (for retention & churn comparison)
        supabase
          .from('payments')
          .select('*, students(ps_code, full_name, grade, household:households(parent_name, parent_phone, address))')
          .eq('month', prevMonthNum)
          .eq('year', prevYearNum),

        // Outstanding debts
        supabase
          .from('students_outstanding')
          .select('*'),

        // Multi-Month Trends: All payments for the selected trend year
        supabase
          .from('payments')
          .select('month, year, amount_paid, class_type, students(ps_code, full_name, grade)')
          .eq('year', trendYear),

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
      const stuList = registeredData || []
      setNewStudents(stuList)

      const gMap: Record<number, number> = {}
      stuList.forEach(s => {
        const gr = s.grade || 0
        gMap[gr] = (gMap[gr] || 0) + 1
      })
      setGradeStats(gMap)

      // 2. Process Bank-Wise & Payment Type Breakdown
      const payList = monthlyPaymentsData || []
      setAllPaymentsMonth(payList)

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

  // Export CSV Helper
  function exportTableToCsv(filename: string, headers: string[], rows: string[][]) {
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Filtered lists
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

  // Day-End calculations
  const dayEndGradeNewMap: Record<number, number> = {}
  dayEndRegisteredStudents.forEach(s => {
    const gr = s.grade || 0
    dayEndGradeNewMap[gr] = (dayEndGradeNewMap[gr] || 0) + 1
  })

  // Day-End Paid Students & Revenue Grade-wise and Class-wise
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
  // MONTHLY CUMULATIVE DATE-BY-DATE GRADE MATRIX CALCULATIONS
  // -------------------------------------------------------------------------
  const daysInSelectedMonth = new Date(year, month, 0).getDate()
  const matrixTargetGrades = [6, 7, 8, 9, 10, 11]

  // Daily raw bucket maps: dayNumber -> { grade -> count, dailyTotal }
  const rawDailyCounts: Record<number, Record<number, number>> = {}
  for (let d = 1; d <= daysInSelectedMonth; d++) {
    rawDailyCounts[d] = { 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0 }
  }

  if (matrixMode === 'registrations') {
    newStudents.forEach(s => {
      const d = new Date(s.created_at).getDate()
      const g = s.grade || 0
      if (rawDailyCounts[d] && rawDailyCounts[d][g] !== undefined) {
        rawDailyCounts[d][g] += 1
      }
    })
  } else {
    // Payments mode: payments in that month bucketed by payment entry/deposit day
    allPaymentsMonth.forEach(p => {
      const d = p.date_paid ? parseInt(p.date_paid.split('-')[2], 10) : new Date(p.created_at).getDate()
      const g = p.students?.grade || 0
      if (rawDailyCounts[d] && rawDailyCounts[d][g] !== undefined) {
        rawDailyCounts[d][g] += 1
      }
    })
  }

  // Calculate Cumulative totals progressing day by day
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

  for (let d = 1; d <= daysInSelectedMonth; d++) {
    const dayDate = new Date(year, month - 1, d)
    const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6 // Sunday or Saturday
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
  // MONTH-OVER-MONTH RETENTION & PAYMENT CONTINUITY ANALYZER CALCULATIONS
  // -------------------------------------------------------------------------
  // 1. Unique students who paid in PREVIOUS month
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

  // 2. Unique students who paid in CURRENT month
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

  // 3. Classify students into categories
  const retainedStudentsList: any[] = []
  const droppedStudentsList: any[] = []
  const newPayingStudentsList: any[] = []

  // Check from Previous Month pool
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

  // Check for New Inflow in Current Month pool
  currentMonthStudentsMap.forEach((currStu, ps) => {
    if (!prevMonthStudentsMap.has(ps)) {
      newPayingStudentsList.push({
        ...currStu,
        status: 'NEW'
      })
    }
  })

  // Overall Retention Metrics
  const totalPrevPaid = prevMonthStudentsMap.size
  const totalCurrPaid = currentMonthStudentsMap.size
  const totalRetained = retainedStudentsList.length
  const totalDropped = droppedStudentsList.length
  const totalNewPaying = newPayingStudentsList.length

  const overallRetentionRate = totalPrevPaid > 0 ? ((totalRetained / totalPrevPaid) * 100).toFixed(1) : '0.0'
  const overallChurnRate = totalPrevPaid > 0 ? ((totalDropped / totalPrevPaid) * 100).toFixed(1) : '0.0'
  const potentialLostRevenue = droppedStudentsList.reduce((sum, s) => sum + (Number(s.last_amount) || 0), 0)

  // Grade-wise Retention Matrix Calculations
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

  // Filtered Retention Action List
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
  // MULTI-MONTH BUSINESS TREND LINE CHART CALCULATIONS
  // -------------------------------------------------------------------------
  const sortedTrendMonths = [...selectedTrendMonths].sort((a, b) => a - b)

  // Grade color map for multi-line SVG chart
  const gradeColorMap: Record<number, { stroke: string; fill: string; name: string }> = {
    0: { stroke: '#3b82f6', fill: 'rgba(59, 130, 246, 0.2)', name: 'Total All Grades' },
    6: { stroke: '#10b981', fill: 'rgba(16, 185, 129, 0.2)', name: 'Grade 6' },
    7: { stroke: '#f59e0b', fill: 'rgba(245, 158, 11, 0.2)', name: 'Grade 7' },
    8: { stroke: '#ec4899', fill: 'rgba(236, 72, 153, 0.2)', name: 'Grade 8' },
    9: { stroke: '#8b5cf6', fill: 'rgba(139, 92, 246, 0.2)', name: 'Grade 9' },
    10: { stroke: '#06b6d4', fill: 'rgba(6, 182, 212, 0.2)', name: 'Grade 10' },
    11: { stroke: '#f97316', fill: 'rgba(249, 115, 22, 0.2)', name: 'Grade 11' },
  }

  // Monthly aggregated data series
  const trendMonthlySeries = sortedTrendMonths.map(m => {
    // Payments in this month of trendYear
    const mPayments = trendPaymentsYear.filter(p => p.month === m)

    // Grade breakdown for paying students (distinct students per grade)
    const gradePayingStudentsMap: Record<number, Set<string>> = {
      6: new Set(), 7: new Set(), 8: new Set(), 9: new Set(), 10: new Set(), 11: new Set()
    }
    const allPayingStudentsSet = new Set<string>()

    // Grade breakdown for revenue
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

    // Registrations in this month
    const mStudents = trendStudentsYear.filter(s => {
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

    const studentCountsByGrade: Record<number, number> = {
      0: allPayingStudentsSet.size,
      6: gradePayingStudentsMap[6].size,
      7: gradePayingStudentsMap[7].size,
      8: gradePayingStudentsMap[8].size,
      9: gradePayingStudentsMap[9].size,
      10: gradePayingStudentsMap[10].size,
      11: gradePayingStudentsMap[11].size,
    }

    const revenueByGrade: Record<number, number> = {
      0: totalRevenue,
      6: gradeRevenueMap[6],
      7: gradeRevenueMap[7],
      8: gradeRevenueMap[8],
      9: gradeRevenueMap[9],
      10: gradeRevenueMap[10],
      11: gradeRevenueMap[11],
    }

    const regByGrade: Record<number, number> = {
      0: mStudents.length,
      6: gradeRegMap[6],
      7: gradeRegMap[7],
      8: gradeRegMap[8],
      9: gradeRegMap[9],
      10: gradeRegMap[10],
      11: gradeRegMap[11],
    }

    return {
      month: m,
      monthName: MONTH_NAMES[m - 1],
      studentCountsByGrade,
      revenueByGrade,
      regByGrade
    }
  })

  // MoM Growth calculations
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

  // Maximum value for SVG chart scaling
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
  // Pad the max value nicely
  chartMaxVal = Math.ceil((chartMaxVal * 1.15) / 10) * 10
  if (chartMaxVal < 10) chartMaxVal = 10

  // SVG Chart Dimensions
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
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <BarChart2 size={22} style={{ color: 'var(--accent-blue)' }} />
            Admin Reports &amp; Audit Analytics
          </h1>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
            Day-End summaries, month-by-month registrations, revenue breakdowns, and auditor logs
          </div>
        </div>
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
          <div className="fade-in">
            {/* Control & Date Bar */}
            <div className="glass-card" style={{ padding: 18, marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                      Report Date
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
                      Payment Filter Mode
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
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <Printer size={16} /> Print Day-End Slip
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const headers = ['METRIC TYPE', 'CATEGORY / ITEM', 'STUDENTS / COUNT', 'TOTAL AMOUNT (RS)']
                      const rows: string[][] = []

                      // Top summary
                      rows.push(['SUMMARY', 'Total New Registered Students', `${dayEndRegisteredStudents.length}`, '0'])
                      rows.push(['SUMMARY', 'Total Payment Slips Processed', `${dailyPayments.length}`, `${totalDailyRevenue}`])

                      // Grade wise
                      allDistinctGrades.forEach(g => {
                        rows.push([
                          'GRADE WISE',
                          `Grade ${g}`,
                          `New Reg: ${dayEndGradeNewMap[g] || 0} | Paid: ${dayEndGradePaidMap[g]?.count || 0}`,
                          `${dayEndGradePaidMap[g]?.total || 0}`
                        ])
                      })

                      // Class wise
                      Object.entries(dayEndClassPaidMap).forEach(([cls, data]) => {
                        rows.push([
                          'CLASS WISE',
                          `${CLASS_LABELS[cls] || cls}`,
                          `${data.count}`,
                          `${data.total}`
                        ])
                      })

                      // Staff wise
                      Object.entries(dayEndAuditorMap).forEach(([who, data]) => {
                        rows.push([
                          'STAFF PERFORMANCE',
                          `${who}`,
                          `Reg: ${data.regCount} | Slips: ${data.payCount}`,
                          `${data.total}`
                        ])
                      })

                      exportTableToCsv(`Day_End_Report_${selectedDate}`, headers, rows)
                    }}
                    className="btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <FileSpreadsheet size={16} /> Export Day-End CSV
                  </button>
                </div>
              </div>
            </div>

            {/* Top KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
              <div className="stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
                <div className="stat-card label">New Registered Students Today</div>
                <div className="stat-card value" style={{ color: '#3b82f6', fontSize: 26 }}>
                  {dayEndRegisteredStudents.length} Students
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Added into CRM on {selectedDate}
                </div>
              </div>

              <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
                <div className="stat-card label">Payment Slips Processed</div>
                <div className="stat-card value" style={{ color: '#10b981', fontSize: 26 }}>
                  {dailyPayments.length} Slips
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Verified &amp; audited payments
                </div>
              </div>

              <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
                <div className="stat-card label">Total Day-End Collections</div>
                <div className="stat-card value" style={{ color: '#f59e0b', fontSize: 26 }}>
                  Rs. {totalDailyRevenue.toLocaleString()}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Total collected on {selectedDate}
                </div>
              </div>
            </div>

            {/* Section 1: Grade-Wise Registration & Payment Breakdown Matrix */}
            <div className="glass-card" style={{ padding: 20, marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <GraduationCap size={20} style={{ color: 'var(--accent-blue)' }} />
                1. Grade-Wise Daily Registration &amp; Payment Matrix
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 140 }}>Grade Level</th>
                      <th style={{ textAlign: 'center' }}>New Registrations Today</th>
                      <th style={{ textAlign: 'center' }}>Students Paid / Slips Today</th>
                      <th style={{ textAlign: 'right' }}>Total Collections (Rs.)</th>
                      <th style={{ textAlign: 'right' }}>% Revenue Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allDistinctGrades.map(g => {
                      const newCount = dayEndGradeNewMap[g] || 0
                      const paidData = dayEndGradePaidMap[g] || { count: 0, total: 0 }
                      const share = totalDailyRevenue > 0 ? ((paidData.total / totalDailyRevenue) * 100).toFixed(1) : '0.0'

                      return (
                        <tr key={g}>
                          <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                            Grade {g}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {newCount > 0 ? (
                              <span className="badge" style={{ background: 'rgba(59,130,246,0.15)', color: 'var(--accent-blue)', fontWeight: 700, fontSize: 12 }}>
                                {newCount} New {newCount === 1 ? 'Student' : 'Students'}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>0</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {paidData.count > 0 ? (
                              <span className="badge" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', fontWeight: 700, fontSize: 12 }}>
                                {paidData.count} {paidData.count === 1 ? 'Student' : 'Students'}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>0</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                            Rs. {paidData.total.toLocaleString()}
                          </td>
                          <td style={{ textAlign: 'right', fontSize: 12, color: 'var(--accent-blue)', fontWeight: 600 }}>
                            {share}%
                          </td>
                        </tr>
                      )
                    })}

                    {/* Matrix Totals Row */}
                    <tr style={{ background: 'rgba(255,255,255,0.03)', fontWeight: 800 }}>
                      <td style={{ color: 'var(--text-primary)', fontSize: 14 }}>
                        TOTAL SUMMARY
                      </td>
                      <td style={{ textAlign: 'center', color: 'var(--accent-blue)', fontSize: 14 }}>
                        {dayEndRegisteredStudents.length} Students
                      </td>
                      <td style={{ textAlign: 'center', color: '#10b981', fontSize: 14 }}>
                        {dailyPayments.length} Slips
                      </td>
                      <td style={{ textAlign: 'right', color: '#f59e0b', fontSize: 15 }}>
                        Rs. {totalDailyRevenue.toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--text-primary)', fontSize: 13 }}>
                        100.0%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section 2 & 3: Class-Wise Breakdown & Staff Productivity */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20, marginBottom: 20 }}>
              {/* Class / Subject Breakdown */}
              <div className="glass-card" style={{ padding: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BookOpen size={18} style={{ color: 'var(--accent-blue)' }} />
                  2. Class &amp; Subject-Wise Collections
                </div>

                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Class / Subject</th>
                      <th style={{ textAlign: 'center' }}>Students Paid</th>
                      <th style={{ textAlign: 'right' }}>Amount (Rs.)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(dayEndClassPaidMap).map(([cls, data]) => (
                      <tr key={cls}>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {CLASS_LABELS[cls] || cls}
                        </td>
                        <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                          {data.count}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                          Rs. {data.total.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {Object.keys(dayEndClassPaidMap).length === 0 && (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
                    No payments recorded for {selectedDate}.
                  </div>
                )}
              </div>

              {/* Staff / Registrar Breakdown */}
              <div className="glass-card" style={{ padding: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Users size={18} style={{ color: 'var(--accent-blue)' }} />
                  3. Staff / Registrar Activity Today
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {Object.entries(dayEndAuditorMap).map(([who, data]) => (
                    <div key={who} style={{ padding: 14, background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          👤 {who}
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b' }}>
                          Rs. {data.total.toLocaleString()}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
                        <span>New Registrations: <strong style={{ color: 'var(--text-primary)' }}>{data.regCount}</strong></span>
                        <span>Payment Slips: <strong style={{ color: 'var(--text-primary)' }}>{data.payCount}</strong></span>
                      </div>
                    </div>
                  ))}

                  {Object.keys(dayEndAuditorMap).length === 0 && (
                    <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
                      No staff actions logged on {selectedDate}.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Section 4: Registered Students List for the Day */}
            {dayEndRegisteredStudents.length > 0 && (
              <div className="glass-card" style={{ overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Users size={16} style={{ color: 'var(--accent-blue)' }} />
                    New Students Registered on {selectedDate} ({dayEndRegisteredStudents.length} Students)
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>PS Code</th>
                        <th>Student Name</th>
                        <th>Grade</th>
                        <th>Parent Name &amp; Phone</th>
                        <th>Classes</th>
                        <th>Registrar</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dayEndRegisteredStudents.map(s => (
                        <tr key={s.id}>
                          <td>
                            <a href={`/students/${encodeURIComponent(s.ps_code)}`} style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontWeight: 700 }}>
                              {s.ps_code}
                            </a>
                          </td>
                          <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.full_name || '—'}</td>
                          <td>
                            <span className="badge" style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--accent-blue)' }}>
                              Grade {s.grade || '—'}
                            </span>
                          </td>
                          <td style={{ fontSize: 12 }}>
                            <div>{s.household?.parent_name || '—'}</div>
                            <div style={{ color: 'var(--text-muted)' }}>{s.household?.parent_phone || '—'}</div>
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {(s.enrollments || []).map((e: any) => CLASS_LABELS[e.class_type] || e.class_type).join(', ') || 'None'}
                          </td>
                          <td style={{ fontSize: 12 }}>{s.created_by || 'System'}</td>
                          <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 1: MONTH-BY-MONTH NEW REGISTRATIONS (PS CODES, GRADES, COUNTS)        */}
        {/* ========================================================================= */}
        {activeTab === 'registrations' && (
          <div className="fade-in">
            {/* Filter Bar */}
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

            {/* Grade-by-Grade Summary Cards Grid */}
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

            {/* Students Table */}
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
                  <div style={{ fontSize: 12, marginTop: 4 }}>Newly registered students will appear here cleanly as they are added.</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: BANK-WISE TOTAL REVENUE & PAYMENT METHOD BREAKDOWN                  */}
        {/* ========================================================================= */}
        {activeTab === 'bank_revenue' && (
          <div className="fade-in">
            {/* Filter Bar */}
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

            {/* Revenue Highlights */}
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

            {/* Bank-Wise Grid & Payment Channel Breakdown */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20 }}>
              {/* Bank Revenue Table */}
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

                {bankRevenue.length === 0 && (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
                    No payment deposits recorded for {MONTH_NAMES[month - 1]} {year}.
                  </div>
                )}
              </div>

              {/* Payment Method / Channel Breakdown */}
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
        {/* TAB 3: DATE-WISE DAILY PAYMENT MARK PANEL & AUDIT REPORT                  */}
        {/* ========================================================================= */}
        {activeTab === 'daily_audit' && (
          <div className="fade-in">
            {/* Date & Auditor Filter Bar */}
            <div className="glass-card" style={{ padding: 18, marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  {/* Select Date */}
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

                  {/* Quick Preset Buttons */}
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

                  {/* Filter Mode (System Entry Time vs Bank Slip Date) */}
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

                  {/* Filter Auditor */}
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

              {/* Search Audit Box */}
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

            {/* Daily Auditor Performance Stat Cards */}
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

            {/* Daily Audit Table */}
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

              {filteredDailyPayments.length === 0 && (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No payment entries logged on {selectedDate}.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: OUTSTANDING DEBTS TABLE                                            */}
        {/* ========================================================================= */}
        {activeTab === 'debts' && (
          <div className="fade-in">
            {/* Filter Bar */}
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

            {/* Debts Total Stat Card */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
              <div className="stat-card" style={{ borderLeft: '4px solid #ef4444' }}>
                <div className="stat-card label">Total Outstanding Portfolio Debt</div>
                <div className="stat-card value" style={{ color: '#ef4444' }}>Rs. {totalDebtAmount.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{outstandingList.length} student ledger balances in debt</div>
              </div>
            </div>

            {/* Debts Table */}
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

              {filteredDebts.length === 0 && (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No outstanding debts recorded in system!
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: MONTHLY CUMULATIVE DATE-BY-DATE GRADE PROGRESSION MATRIX           */}
        {/* ========================================================================= */}
        {activeTab === 'matrix_report' && (
          <div className="fade-in">
            {/* Filter & Export Bar */}
            <div className="glass-card" style={{ padding: 18, marginBottom: 20, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                    Month
                  </label>
                  <select
                    className="input-field"
                    style={{ width: 140 }}
                    value={month}
                    onChange={e => setMonth(parseInt(e.target.value))}
                  >
                    {MONTH_NAMES.map((m, i) => (
                      <option key={i} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                    Year
                  </label>
                  <select
                    className="input-field"
                    style={{ width: 100 }}
                    value={year}
                    onChange={e => setYear(parseInt(e.target.value))}
                  >
                    {[2024, 2025, 2026, 2027].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                    Matrix Data Metric
                  </label>
                  <div style={{ display: 'flex', gap: 4, background: 'var(--bg-base)', padding: 4, borderRadius: 8, border: '1px solid var(--border)' }}>
                    <button
                      type="button"
                      onClick={() => setMatrixMode('registrations')}
                      style={{
                        padding: '6px 12px',
                        fontSize: 12,
                        fontWeight: 700,
                        borderRadius: 6,
                        border: 'none',
                        cursor: 'pointer',
                        background: matrixMode === 'registrations' ? 'var(--accent-blue)' : 'transparent',
                        color: matrixMode === 'registrations' ? '#fff' : 'var(--text-muted)'
                      }}
                    >
                      👥 New Registrations
                    </button>
                    <button
                      type="button"
                      onClick={() => setMatrixMode('payments')}
                      style={{
                        padding: '6px 12px',
                        fontSize: 12,
                        fontWeight: 700,
                        borderRadius: 6,
                        border: 'none',
                        cursor: 'pointer',
                        background: matrixMode === 'payments' ? '#10b981' : 'transparent',
                        color: matrixMode === 'payments' ? '#fff' : 'var(--text-muted)'
                      }}
                    >
                      💳 Paid Students / Slips
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Printer size={16} /> Print Matrix Sheet
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const monthTitle = MONTH_NAMES[month - 1]
                    // CSV headers
                    const headers = ['Date', '6', '7', '8', '9', '10', '11', 'Total', 'Daily Increment']
                    const rows = cumulativeMatrixRows.map(r => [
                      `"${r.dateStr}"`,
                      `"${r.counts[6] || 0}"`,
                      `"${r.counts[7] || 0}"`,
                      `"${r.counts[8] || 0}"`,
                      `"${r.counts[9] || 0}"`,
                      `"${r.counts[10] || 0}"`,
                      `"${r.counts[11] || 0}"`,
                      `"${r.cumulativeTotal}"`,
                      `"${r.dailyCountTotal}"`
                    ])
                    exportTableToCsv(`${monthTitle}_${year}_Grade_Progression_Matrix`, headers, rows)
                  }}
                  className="btn-primary"
                  style={{ background: '#1e7e34', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <FileSpreadsheet size={16} /> Export Excel / CSV
                </button>
              </div>
            </div>

            {/* Matrix SpreadSheet Layout */}
            <div className="glass-card" style={{ overflow: 'hidden', padding: 0, borderRadius: 12 }}>
              {/* Green Excel Header Banner */}
              <div style={{
                background: 'linear-gradient(135deg, #1b5e20 0%, #2e7d32 100%)',
                color: '#fff',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '2px solid #145a17'
              }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: 0.5 }}>
                    📅 {MONTH_NAMES[month - 1]} {year} — Grade-Wise Cumulative Progression Sheet
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>
                    {matrixMode === 'registrations'
                      ? 'Daily and cumulative count of new registered students across Grades 6–11'
                      : 'Daily and cumulative count of students paying fees across Grades 6–11'}
                  </div>
                </div>
                <span style={{
                  background: 'rgba(255,255,255,0.2)',
                  padding: '4px 12px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700
                }}>
                  {MONTH_NAMES[month - 1]} Total: {cumulativeMatrixRows[cumulativeMatrixRows.length - 1]?.cumulativeTotal || 0}
                </span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  textAlign: 'center',
                  fontFamily: 'inherit',
                  fontSize: 13
                }}>
                  <thead>
                    {/* Top Grouping Header: Date | August (Grades 6-11) | Total */}
                    <tr style={{ background: '#2e7d32', color: '#fff', fontWeight: 800 }}>
                      <th rowSpan={2} style={{ padding: '12px 16px', border: '1px solid #1b5e20', width: 130 }}>
                        Date
                      </th>
                      <th colSpan={6} style={{ padding: '8px 12px', border: '1px solid #1b5e20', fontSize: 14, letterSpacing: 1 }}>
                        {MONTH_NAMES[month - 1]} (Grades)
                      </th>
                      <th rowSpan={2} style={{ padding: '12px 16px', border: '1px solid #1b5e20', width: 110, background: '#1b5e20' }}>
                        Total
                      </th>
                    </tr>
                    {/* Grade Columns Subheader */}
                    <tr style={{ background: '#388e3c', color: '#fff', fontWeight: 700 }}>
                      {matrixTargetGrades.map(g => (
                        <th key={g} style={{ padding: '8px 12px', border: '1px solid #1b5e20', minWidth: 65 }}>
                          {g}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cumulativeMatrixRows.map((r, idx) => {
                      // Distinct styling: Highlight weekend days in a soft rose/peach tint matching user screenshot
                      const rowBg = r.isWeekend
                        ? 'rgba(239, 68, 68, 0.12)'
                        : idx % 2 === 0
                        ? 'var(--bg-base)'
                        : 'rgba(255, 255, 255, 0.02)'

                      return (
                        <tr
                          key={r.day}
                          style={{
                            background: rowBg,
                            borderBottom: '1px solid var(--border)',
                            transition: 'background 0.15s'
                          }}
                        >
                          {/* Date Column */}
                          <td style={{
                            padding: '10px 14px',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            borderRight: '1px solid var(--border)',
                            textAlign: 'center'
                          }}>
                            {r.dateStr}
                          </td>

                          {/* Grade 6 to 11 Columns */}
                          {matrixTargetGrades.map(g => {
                            const count = r.counts[g] || 0
                            return (
                              <td
                                key={g}
                                style={{
                                  padding: '10px 12px',
                                  borderRight: '1px solid var(--border)',
                                  fontWeight: count > 0 ? 600 : 400,
                                  color: count > 0 ? 'var(--text-primary)' : 'var(--text-muted)'
                                }}
                              >
                                {count}
                              </td>
                            )
                          })}

                          {/* Cumulative Row Total Column */}
                          <td style={{
                            padding: '10px 14px',
                            fontWeight: 800,
                            color: '#10b981',
                            fontSize: 14,
                            background: r.isWeekend ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.08)'
                          }}>
                            {r.cumulativeTotal}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: STUDENT PAYMENT RETENTION & CONTINUITY ANALYZER (WITH CHARTS)      */}
        {/* ========================================================================= */}
        {activeTab === 'retention' && (
          <div className="fade-in">
            {/* Filter & Export Bar */}
            <div className="glass-card" style={{ padding: 18, marginBottom: 20, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                    Current Month
                  </label>
                  <select
                    className="input-field"
                    style={{ width: 140 }}
                    value={month}
                    onChange={e => setMonth(parseInt(e.target.value))}
                  >
                    {MONTH_NAMES.map((m, i) => (
                      <option key={i} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                    Year
                  </label>
                  <select
                    className="input-field"
                    style={{ width: 100 }}
                    value={year}
                    onChange={e => setYear(parseInt(e.target.value))}
                  >
                    {[2024, 2025, 2026, 2027].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

                <div style={{ padding: '8px 14px', background: 'rgba(139,92,246,0.1)', borderRadius: 8, border: '1px solid rgba(139,92,246,0.2)' }}>
                  <div style={{ fontSize: 11, color: '#a78bfa', fontWeight: 600 }}>Comparing Baseline:</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {MONTH_NAMES[month === 1 ? 11 : month - 2]} {month === 1 ? year - 1 : year} ➡️ {MONTH_NAMES[month - 1]} {year}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Printer size={16} /> Print Retention Report
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const headers = ['PS CODE', 'STUDENT NAME', 'GRADE', 'STATUS', 'LAST MONTH AMOUNT', 'CURRENT MONTH AMOUNT', 'PARENT NAME', 'PARENT PHONE', 'ADDRESS']
                    const rows = filteredRetentionList.map(s => [
                      `"${s.ps_code}"`,
                      `"${(s.full_name || '').replace(/"/g, '""')}"`,
                      `"Grade ${s.grade || '?'}"`,
                      `"${s.status}"`,
                      `"${s.last_amount || 0}"`,
                      `"${s.curr_amount || 0}"`,
                      `"${(s.parent_name || '').replace(/"/g, '""')}"`,
                      `"${(s.parent_phone || '').replace(/"/g, '""')}"`,
                      `"${(s.address || '').replace(/"/g, '""')}"`
                    ])
                    exportTableToCsv(`Retention_Analysis_${MONTH_NAMES[month - 1]}_${year}`, headers, rows)
                  }}
                  className="btn-primary"
                  style={{ background: '#8b5cf6', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <FileSpreadsheet size={16} /> Export Follow-Up List (CSV)
                </button>
              </div>
            </div>

            {/* Top 4 KPI Executive Metric Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 20 }}>
              <div className="stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
                <div className="stat-card label">Paid Last Month ({MONTH_NAMES[month === 1 ? 11 : month - 2]})</div>
                <div className="stat-card value" style={{ color: '#3b82f6', fontSize: 24 }}>
                  {totalPrevPaid} Students
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Baseline cohort paying pool</div>
              </div>

              <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
                <div className="stat-card label">🟢 Retained This Month</div>
                <div className="stat-card value" style={{ color: '#10b981', fontSize: 24 }}>
                  {totalRetained} Students
                  <span style={{ fontSize: 14, fontWeight: 600, marginLeft: 8, color: '#10b981' }}>
                    ({overallRetentionRate}%)
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Paid both last &amp; this month</div>
              </div>

              <div className="stat-card" style={{ borderLeft: '4px solid #ef4444' }}>
                <div className="stat-card label">🔴 Dropped / Unpaid (Churn)</div>
                <div className="stat-card value" style={{ color: '#ef4444', fontSize: 24 }}>
                  {totalDropped} Students
                  <span style={{ fontSize: 14, fontWeight: 600, marginLeft: 8, color: '#ef4444' }}>
                    ({overallChurnRate}%)
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Est. revenue at risk: Rs. {potentialLostRevenue.toLocaleString()}
                </div>
              </div>

              <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
                <div className="stat-card label">🔵 New Paying Students</div>
                <div className="stat-card value" style={{ color: '#f59e0b', fontSize: 24 }}>
                  +{totalNewPaying} Students
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Net Student Change: <strong style={{ color: totalCurrPaid >= totalPrevPaid ? '#10b981' : '#ef4444' }}>
                    {totalCurrPaid >= totalPrevPaid ? `+${totalCurrPaid - totalPrevPaid}` : `${totalCurrPaid - totalPrevPaid}`} Students
                  </strong>
                </div>
              </div>
            </div>

            {/* VISUAL CHARTS SECTION */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20, marginBottom: 20 }}>
              {/* Chart 1: Grade-Wise Retention vs Drop-off Progress Bars */}
              <div className="glass-card" style={{ padding: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BarChart2 size={18} style={{ color: 'var(--accent-blue)' }} />
                  Grade-Wise Student Retention &amp; Churn Bars
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {matrixTargetGrades.map(g => {
                    const row = gradeRetentionMatrix[g] || { prev: 0, retained: 0, dropped: 0, newPaying: 0, rate: '0.0' }
                    const rateNum = parseFloat(row.rate) || 0

                    return (
                      <div key={g} style={{ padding: '10px 14px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                            Grade {g}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: rateNum >= 90 ? '#10b981' : rateNum >= 75 ? '#f59e0b' : '#ef4444' }}>
                            {row.rate}% Retained ({row.retained}/{row.prev})
                          </span>
                        </div>

                        {/* Stacked Visual Bar */}
                        <div style={{ height: 10, width: '100%', background: 'rgba(255,255,255,0.08)', borderRadius: 6, overflow: 'hidden', display: 'flex' }}>
                          <div
                            style={{
                              width: `${rateNum}%`,
                              background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                              borderRadius: '6px 0 0 6px',
                              transition: 'width 0.5s'
                            }}
                            title={`Retained: ${row.retained}`}
                          />
                          <div
                            style={{
                              width: `${100 - rateNum}%`,
                              background: '#ef4444',
                              borderRadius: '0 6px 6px 0',
                              transition: 'width 0.5s'
                            }}
                            title={`Dropped: ${row.dropped}`}
                          />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                          <span>🟢 Retained: <strong style={{ color: '#10b981' }}>{row.retained}</strong></span>
                          <span>🔴 Unpaid / Dropped: <strong style={{ color: '#ef4444' }}>{row.dropped}</strong></span>
                          <span>🔵 New Inflow: <strong style={{ color: 'var(--accent-blue)' }}>+{row.newPaying}</strong></span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Chart 2: Retention Gauge & Flow Summary */}
              <div className="glass-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <TrendingUp size={18} style={{ color: '#10b981' }} />
                    Cohort Flow &amp; Institute Retention Gauge
                  </div>

                  {/* Circular Gauge Representation */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '24px 0',
                    background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)'
                  }}>
                    <div style={{
                      width: 130,
                      height: 130,
                      borderRadius: '50%',
                      border: '8px solid #10b981',
                      borderTopColor: '#ef4444',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'column',
                      transform: 'rotate(-45deg)'
                    }}>
                      <div style={{ transform: 'rotate(45deg)', textAlign: 'center' }}>
                        <div style={{ fontSize: 26, fontWeight: 800, color: '#10b981' }}>
                          {overallRetentionRate}%
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                          Retention
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Flow Summary Legend */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(16,185,129,0.08)', borderRadius: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#10b981' }}>🟢 Retained Students</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{totalRetained}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#ef4444' }}>🔴 Churned / Dropped</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{totalDropped}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(59,130,246,0.08)', borderRadius: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-blue)' }}>🔵 New Inflow</span>
                      <strong style={{ color: 'var(--text-primary)' }}>+{totalNewPaying}</strong>
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 14, textAlign: 'center' }}>
                  Target Benchmark: <strong style={{ color: '#10b981' }}>&gt;85% Retention</strong> | Call dropped students within the first 10 days to maximize recovery.
                </div>
              </div>
            </div>

            {/* ACTIONABLE STUDENT LIST & CALL CENTER FOLLOW-UP TABLE */}
            <div className="glass-card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Users size={16} style={{ color: 'var(--accent-blue)' }} />
                  Actionable Student List ({filteredRetentionList.length} Students)
                </div>

                {/* Sub Filters: Status + Grade + Search */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* Status Pills */}
                  <div style={{ display: 'flex', gap: 4, background: 'var(--bg-base)', padding: 3, borderRadius: 8, border: '1px solid var(--border)' }}>
                    <button
                      type="button"
                      onClick={() => setRetentionStatusFilter('DROPPED')}
                      style={{
                        padding: '4px 10px',
                        fontSize: 11,
                        fontWeight: 700,
                        borderRadius: 6,
                        border: 'none',
                        cursor: 'pointer',
                        background: retentionStatusFilter === 'DROPPED' ? '#ef4444' : 'transparent',
                        color: retentionStatusFilter === 'DROPPED' ? '#fff' : 'var(--text-muted)'
                      }}
                    >
                      🔴 Unpaid / Dropped ({totalDropped})
                    </button>
                    <button
                      type="button"
                      onClick={() => setRetentionStatusFilter('RETAINED')}
                      style={{
                        padding: '4px 10px',
                        fontSize: 11,
                        fontWeight: 700,
                        borderRadius: 6,
                        border: 'none',
                        cursor: 'pointer',
                        background: retentionStatusFilter === 'RETAINED' ? '#10b981' : 'transparent',
                        color: retentionStatusFilter === 'RETAINED' ? '#fff' : 'var(--text-muted)'
                      }}
                    >
                      🟢 Retained ({totalRetained})
                    </button>
                    <button
                      type="button"
                      onClick={() => setRetentionStatusFilter('NEW')}
                      style={{
                        padding: '4px 10px',
                        fontSize: 11,
                        fontWeight: 700,
                        borderRadius: 6,
                        border: 'none',
                        cursor: 'pointer',
                        background: retentionStatusFilter === 'NEW' ? 'var(--accent-blue)' : 'transparent',
                        color: retentionStatusFilter === 'NEW' ? '#fff' : 'var(--text-muted)'
                      }}
                    >
                      🔵 New Inflow ({totalNewPaying})
                    </button>
                    <button
                      type="button"
                      onClick={() => setRetentionStatusFilter('ALL')}
                      style={{
                        padding: '4px 10px',
                        fontSize: 11,
                        fontWeight: 700,
                        borderRadius: 6,
                        border: 'none',
                        cursor: 'pointer',
                        background: retentionStatusFilter === 'ALL' ? 'var(--text-primary)' : 'transparent',
                        color: retentionStatusFilter === 'ALL' ? 'var(--bg-base)' : 'var(--text-muted)'
                      }}
                    >
                      All ({allRetentionCombined.length})
                    </button>
                  </div>

                  {/* Grade Filter */}
                  <select
                    className="input-field"
                    style={{ width: 110, padding: '4px 8px', fontSize: 12 }}
                    value={retentionGradeFilter}
                    onChange={e => setRetentionGradeFilter(e.target.value)}
                  >
                    <option value="ALL">All Grades</option>
                    {[6, 7, 8, 9, 10, 11].map(g => (
                      <option key={g} value={String(g)}>Grade {g}</option>
                    ))}
                  </select>

                  {/* Search Input */}
                  <div style={{ position: 'relative', width: 200 }}>
                    <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      className="input-field"
                      style={{ paddingLeft: 26, paddingRight: 8, paddingBottom: 4, paddingTop: 4, fontSize: 12, width: '100%' }}
                      placeholder="Search PS, Name, Phone..."
                      value={searchRetention}
                      onChange={e => setSearchRetention(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Data Table with Direct WhatsApp / Call Links */}
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>PS Code</th>
                      <th>Student Name</th>
                      <th>Grade</th>
                      <th>Status</th>
                      <th>Last Month Fee</th>
                      <th>This Month Fee</th>
                      <th>Parent Contact</th>
                      <th>Direct Follow-Up</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRetentionList.map(s => {
                      const cleanPhone = (s.parent_phone || '').replace(/[^0-9]/g, '')
                      const waPhone = cleanPhone.startsWith('0') ? `94${cleanPhone.slice(1)}` : cleanPhone

                      return (
                        <tr key={`${s.ps_code}-${s.status}`}>
                          <td>
                            <a href={`/students/${encodeURIComponent(s.ps_code)}`} style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontWeight: 700 }}>
                              {s.ps_code}
                            </a>
                          </td>
                          <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {s.full_name || '—'}
                          </td>
                          <td>
                            <span className="badge" style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--accent-blue)' }}>
                              Grade {s.grade || '—'}
                            </span>
                          </td>
                          <td>
                            {s.status === 'DROPPED' && (
                              <span className="badge" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontWeight: 700 }}>
                                🔴 Unpaid / Dropped
                              </span>
                            )}
                            {s.status === 'RETAINED' && (
                              <span className="badge" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', fontWeight: 700 }}>
                                🟢 Paid &amp; Retained
                              </span>
                            )}
                            {s.status === 'NEW' && (
                              <span className="badge" style={{ background: 'rgba(59,130,246,0.15)', color: 'var(--accent-blue)', fontWeight: 700 }}>
                                🔵 New Inflow
                              </span>
                            )}
                          </td>
                          <td style={{ fontSize: 12 }}>
                            {s.last_amount ? (
                              <span>Rs. {s.last_amount.toLocaleString()}</span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>—</span>
                            )}
                          </td>
                          <td style={{ fontSize: 12, fontWeight: s.curr_amount ? 700 : 400, color: s.curr_amount ? '#10b981' : 'var(--text-muted)' }}>
                            {s.curr_amount ? `Rs. ${s.curr_amount.toLocaleString()}` : 'Not Paid Yet'}
                          </td>
                          <td style={{ fontSize: 12 }}>
                            <div>{s.parent_name || '—'}</div>
                            <div style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>{s.parent_phone || '—'}</div>
                          </td>
                          <td>
                            {s.parent_phone ? (
                              <div style={{ display: 'flex', gap: 6 }}>
                                <a
                                  href={`tel:${s.parent_phone}`}
                                  className="btn-secondary"
                                  style={{ padding: '4px 8px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
                                  title="Call Parent"
                                >
                                  <Phone size={12} /> Call
                                </a>
                                <a
                                  href={`https://wa.me/${waPhone}?text=${encodeURIComponent(`Hello ${s.parent_name || 'Parent'}, regarding ${s.full_name || 'student'}'s (${s.ps_code}) Maths class registration for ${MONTH_NAMES[month - 1]} ${year}. Please let us know if you need assistance with class fees.`)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn-primary"
                                  style={{ padding: '4px 8px', fontSize: 11, background: '#25D366', color: '#fff', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
                                  title="Send WhatsApp Follow-Up"
                                >
                                  💬 WhatsApp
                                </a>
                              </div>
                            ) : (
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>No phone</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {filteredRetentionList.length === 0 && (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No students match the selected retention filters.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 7: MULTI-MONTH BUSINESS TRENDS & MULTI-LINE GROWTH ANALYTICS          */}
        {/* ========================================================================= */}
        {activeTab === 'trend_analytics' && (
          <div className="fade-in">
            {/* Control & Filter Dashboard */}
            <div className="glass-card" style={{ padding: 18, marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* Year selector */}
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                      Analysis Year
                    </label>
                    <select
                      className="input-field"
                      style={{ width: 110 }}
                      value={trendYear}
                      onChange={e => setTrendYear(parseInt(e.target.value))}
                    >
                      {[2024, 2025, 2026, 2027].map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>

                  {/* Metric Switcher */}
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                      Chart Metric
                    </label>
                    <div style={{ display: 'flex', gap: 4, background: 'var(--bg-base)', padding: 4, borderRadius: 8, border: '1px solid var(--border)' }}>
                      <button
                        type="button"
                        onClick={() => setTrendMetric('students')}
                        style={{
                          padding: '6px 12px',
                          fontSize: 12,
                          fontWeight: 700,
                          borderRadius: 6,
                          border: 'none',
                          cursor: 'pointer',
                          background: trendMetric === 'students' ? 'var(--accent-blue)' : 'transparent',
                          color: trendMetric === 'students' ? '#fff' : 'var(--text-muted)'
                        }}
                      >
                        👥 Active Paying Students
                      </button>
                      <button
                        type="button"
                        onClick={() => setTrendMetric('revenue')}
                        style={{
                          padding: '6px 12px',
                          fontSize: 12,
                          fontWeight: 700,
                          borderRadius: 6,
                          border: 'none',
                          cursor: 'pointer',
                          background: trendMetric === 'revenue' ? '#10b981' : 'transparent',
                          color: trendMetric === 'revenue' ? '#fff' : 'var(--text-muted)'
                        }}
                      >
                        💰 Total Revenue (Rs.)
                      </button>
                      <button
                        type="button"
                        onClick={() => setTrendMetric('registrations')}
                        style={{
                          padding: '6px 12px',
                          fontSize: 12,
                          fontWeight: 700,
                          borderRadius: 6,
                          border: 'none',
                          cursor: 'pointer',
                          background: trendMetric === 'registrations' ? '#8b5cf6' : 'transparent',
                          color: trendMetric === 'registrations' ? '#fff' : 'var(--text-muted)'
                        }}
                      >
                        ✨ New Registrations
                      </button>
                    </div>
                  </div>
                </div>

                {/* Quick Multi-Month Preset Range Buttons */}
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                    Quick Month Presets
                  </label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedTrendMonths([6, 7, 8])}
                      className="btn-secondary"
                      style={{ padding: '5px 10px', fontSize: 12 }}
                    >
                      Last 3 Months (Jun-Aug)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedTrendMonths([3, 4, 5, 6, 7, 8])}
                      className="btn-secondary"
                      style={{ padding: '5px 10px', fontSize: 12 }}
                    >
                      Last 6 Months (Mar-Aug)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedTrendMonths([1, 2, 3, 4, 5, 6, 7, 8])}
                      className="btn-secondary"
                      style={{ padding: '5px 10px', fontSize: 12 }}
                    >
                      YTD (Jan–Aug)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedTrendMonths([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])}
                      className="btn-secondary"
                      style={{ padding: '5px 10px', fontSize: 12 }}
                    >
                      All 12 Months
                    </button>
                  </div>
                </div>
              </div>

              {/* Multi-Month Interactive Checkboxes */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                  Select Individual Months to Include ({selectedTrendMonths.length} Selected):
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {MONTH_NAMES.map((mName, idx) => {
                    const mNum = idx + 1
                    const isSelected = selectedTrendMonths.includes(mNum)
                    return (
                      <button
                        key={mNum}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            if (selectedTrendMonths.length > 1) {
                              setSelectedTrendMonths(selectedTrendMonths.filter(m => m !== mNum))
                            }
                          } else {
                            setSelectedTrendMonths([...selectedTrendMonths, mNum])
                          }
                        }}
                        style={{
                          padding: '4px 12px',
                          fontSize: 12,
                          fontWeight: 600,
                          borderRadius: 20,
                          border: isSelected ? '1px solid var(--accent-blue)' : '1px solid var(--border)',
                          background: isSelected ? 'rgba(59,130,246,0.15)' : 'var(--bg-base)',
                          color: isSelected ? 'var(--accent-blue)' : 'var(--text-muted)',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        {isSelected ? '✓ ' : ''}{mName.slice(0, 3)}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Top KPI Metrics Bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
              {/* Peak Month */}
              {(() => {
                let peakItem = trendMonthlySeries[0]
                trendMonthlySeries.forEach(item => {
                  let v = 0
                  if (trendMetric === 'students') v = item.studentCountsByGrade[0]
                  else if (trendMetric === 'revenue') v = item.revenueByGrade[0]
                  else v = item.regByGrade[0]

                  let peakV = 0
                  if (trendMetric === 'students') peakV = peakItem?.studentCountsByGrade[0] || 0
                  else if (trendMetric === 'revenue') peakV = peakItem?.revenueByGrade[0] || 0
                  else peakV = peakItem?.regByGrade[0] || 0

                  if (v > peakV) peakItem = item
                })

                return (
                  <div className="stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
                    <div className="stat-card label">Highest Performing Month</div>
                    <div className="stat-card value" style={{ color: '#3b82f6', fontSize: 22 }}>
                      {peakItem?.monthName || '—'} {trendYear}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      {trendMetric === 'students' && `${peakItem?.studentCountsByGrade[0] || 0} Students`}
                      {trendMetric === 'revenue' && `Rs. ${(peakItem?.revenueByGrade[0] || 0).toLocaleString()}`}
                      {trendMetric === 'registrations' && `${peakItem?.regByGrade[0] || 0} New Registrations`}
                    </div>
                  </div>
                )
              })()}

              {/* Latest Month In Series */}
              {(() => {
                const latest = trendMonthlySeries[trendMonthlySeries.length - 1]
                return (
                  <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
                    <div className="stat-card label">Latest Selected Month ({latest?.monthName || '—'})</div>
                    <div className="stat-card value" style={{ color: '#10b981', fontSize: 22 }}>
                      {trendMetric === 'students' && `${latest?.studentCountsByGrade[0] || 0} Students`}
                      {trendMetric === 'revenue' && `Rs. ${(latest?.revenueByGrade[0] || 0).toLocaleString()}`}
                      {trendMetric === 'registrations' && `${latest?.regByGrade[0] || 0} New Registrations`}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      Active Grade 6–11 pool
                    </div>
                  </div>
                )
              })()}

              {/* Average Monthly Volume */}
              {(() => {
                const total = trendMonthlySeries.reduce((sum, item) => {
                  if (trendMetric === 'students') return sum + item.studentCountsByGrade[0]
                  if (trendMetric === 'revenue') return sum + item.revenueByGrade[0]
                  return sum + item.regByGrade[0]
                }, 0)
                const avg = trendMonthlySeries.length > 0 ? Math.round(total / trendMonthlySeries.length) : 0

                return (
                  <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
                    <div className="stat-card label">Selected Average / Month</div>
                    <div className="stat-card value" style={{ color: '#f59e0b', fontSize: 22 }}>
                      {trendMetric === 'revenue' ? `Rs. ${avg.toLocaleString()}` : `${avg.toLocaleString()} / Mo`}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      Across {trendMonthlySeries.length} selected months
                    </div>
                  </div>
                )
              })()}

              {/* Total Accumulated in Range */}
              {(() => {
                const totalRev = trendMonthlySeries.reduce((sum, item) => sum + item.revenueByGrade[0], 0)
                const totalReg = trendMonthlySeries.reduce((sum, item) => sum + item.regByGrade[0], 0)

                return (
                  <div className="stat-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
                    <div className="stat-card label">Total Cumulative in Range</div>
                    <div className="stat-card value" style={{ color: '#8b5cf6', fontSize: 22 }}>
                      {trendMetric === 'revenue'
                        ? `Rs. ${totalRev.toLocaleString()}`
                        : trendMetric === 'registrations'
                        ? `${totalReg} Total Regs`
                        : `Rs. ${totalRev.toLocaleString()}`}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      Aggregated revenue &amp; momentum
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* Interactive SVG Multi-Line Chart Card */}
            <div className="glass-card" style={{ padding: 22, marginBottom: 20, position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <LineChartIcon size={18} style={{ color: 'var(--accent-blue)' }} />
                    Multi-Month Trend Line Chart ({trendYear})
                  </h2>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    Click badges below to toggle Total or Grade-specific trajectory lines
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (activeTrendGrades.length === 7) {
                        setActiveTrendGrades([0])
                      } else {
                        setActiveTrendGrades([0, 6, 7, 8, 9, 10, 11])
                      }
                    }}
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: 11 }}
                  >
                    {activeTrendGrades.length === 7 ? 'Show Total Only' : 'Show All Grades'}
                  </button>
                </div>
              </div>

              {/* Interactive Grade Toggles Badges */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Toggle Lines:</span>
                {[0, 6, 7, 8, 9, 10, 11].map(g => {
                  const isActive = activeTrendGrades.includes(g)
                  const meta = gradeColorMap[g]
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => {
                        if (isActive) {
                          if (activeTrendGrades.length > 1) {
                            setActiveTrendGrades(activeTrendGrades.filter(x => x !== g))
                          }
                        } else {
                          setActiveTrendGrades([...activeTrendGrades, g])
                        }
                      }}
                      style={{
                        padding: '4px 12px',
                        fontSize: 12,
                        fontWeight: 700,
                        borderRadius: 16,
                        border: `1px solid ${isActive ? meta.stroke : 'var(--border)'}`,
                        background: isActive ? meta.fill : 'var(--bg-base)',
                        color: isActive ? meta.stroke : 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        opacity: isActive ? 1 : 0.6,
                        transition: 'all 0.15s'
                      }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.stroke }} />
                      {meta.name}
                    </button>
                  )
                })}
              </div>

              {/* Responsive SVG Chart Container */}
              <div style={{ width: '100%', overflowX: 'auto' }}>
                <svg
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                  style={{ width: '100%', minWidth: 600, height: 'auto', overflow: 'visible' }}
                >
                  {/* Grid Lines & Y-Axis Labels (5 levels) */}
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                    const y = padTop + plotHeight * (1 - ratio)
                    const val = Math.round(chartMaxVal * ratio)
                    return (
                      <g key={idx}>
                        <line
                          x1={padLeft}
                          y1={y}
                          x2={padLeft + plotWidth}
                          y2={y}
                          stroke="var(--border)"
                          strokeDasharray="4 4"
                          strokeWidth={1}
                        />
                        <text
                          x={padLeft - 10}
                          y={y + 4}
                          fill="var(--text-muted)"
                          fontSize={11}
                          textAnchor="end"
                          fontFamily="sans-serif"
                        >
                          {trendMetric === 'revenue'
                            ? val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val
                            : val}
                        </text>
                      </g>
                    )
                  })}

                  {/* X-Axis Month Labels */}
                  {trendMonthlySeries.map((mItem, idx) => {
                    const x =
                      trendMonthlySeries.length > 1
                        ? padLeft + (idx / (trendMonthlySeries.length - 1)) * plotWidth
                        : padLeft + plotWidth / 2

                    return (
                      <g key={mItem.month}>
                        <line
                          x1={x}
                          y1={padTop + plotHeight}
                          x2={x}
                          y2={padTop + plotHeight + 6}
                          stroke="var(--text-muted)"
                          strokeWidth={1}
                        />
                        <text
                          x={x}
                          y={padTop + plotHeight + 22}
                          fill="var(--text-primary)"
                          fontSize={12}
                          fontWeight={600}
                          textAnchor="middle"
                          fontFamily="sans-serif"
                        >
                          {mItem.monthName.slice(0, 3)}
                        </text>
                      </g>
                    )
                  })}

                  {/* Draw Trajectory Lines for Active Grades */}
                  {activeTrendGrades.map(g => {
                    const meta = gradeColorMap[g]
                    if (!meta) return null

                    // Generate points for this grade
                    const points = trendMonthlySeries.map((mItem, idx) => {
                      let val = 0
                      if (trendMetric === 'students') val = mItem.studentCountsByGrade[g] || 0
                      else if (trendMetric === 'revenue') val = mItem.revenueByGrade[g] || 0
                      else val = mItem.regByGrade[g] || 0

                      const x =
                        trendMonthlySeries.length > 1
                          ? padLeft + (idx / (trendMonthlySeries.length - 1)) * plotWidth
                          : padLeft + plotWidth / 2
                      const y = padTop + plotHeight * (1 - Math.min(val, chartMaxVal) / chartMaxVal)

                      return { x, y, val, month: mItem.month, monthName: mItem.monthName }
                    })

                    const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ')

                    // Area path under line
                    const firstP = points[0]
                    const lastP = points[points.length - 1]
                    const areaPath = `M ${firstP?.x},${padTop + plotHeight} ` +
                      points.map(p => `L ${p.x},${p.y}`).join(' ') +
                      ` L ${lastP?.x},${padTop + plotHeight} Z`

                    const isTotalLine = g === 0

                    return (
                      <g key={g}>
                        {/* Shaded Area for Total Line */}
                        {isTotalLine && (
                          <path
                            d={areaPath}
                            fill={meta.fill}
                            opacity={0.4}
                          />
                        )}

                        {/* Line Stroke */}
                        <polyline
                          fill="none"
                          stroke={meta.stroke}
                          strokeWidth={isTotalLine ? 3.5 : 2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={polylinePoints}
                          style={{ filter: isTotalLine ? 'drop-shadow(0 2px 4px rgba(59,130,246,0.3))' : undefined }}
                        />

                        {/* Data Points / Dots */}
                        {points.map((p, pIdx) => (
                          <circle
                            key={pIdx}
                            cx={p.x}
                            cy={p.y}
                            r={isTotalLine ? 5.5 : 4}
                            fill="#fff"
                            stroke={meta.stroke}
                            strokeWidth={isTotalLine ? 3 : 2}
                            style={{ cursor: 'pointer', transition: 'r 0.15s' }}
                            onMouseEnter={() => {
                              setTrendHoverPoint({
                                month: p.month,
                                grade: g,
                                value: p.val,
                                x: p.x,
                                y: p.y
                              })
                            }}
                            onMouseLeave={() => setTrendHoverPoint(null)}
                          />
                        ))}
                      </g>
                    )
                  })}

                  {/* Hover Tooltip Overlay in SVG */}
                  {trendHoverPoint && (
                    <g pointerEvents="none">
                      <rect
                        x={Math.min(trendHoverPoint.x - 60, svgWidth - 140)}
                        y={Math.max(trendHoverPoint.y - 45, 10)}
                        width={120}
                        height={34}
                        rx={6}
                        fill="#1e293b"
                        stroke="var(--border)"
                        strokeWidth={1}
                        style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.4))' }}
                      />
                      <text
                        x={Math.min(trendHoverPoint.x, svgWidth - 80)}
                        y={Math.max(trendHoverPoint.y - 28, 27)}
                        fill="#94a3b8"
                        fontSize={10}
                        fontWeight={600}
                        textAnchor="middle"
                        fontFamily="sans-serif"
                      >
                        {gradeColorMap[trendHoverPoint.grade]?.name} ({MONTH_NAMES[trendHoverPoint.month - 1].slice(0, 3)})
                      </text>
                      <text
                        x={Math.min(trendHoverPoint.x, svgWidth - 80)}
                        y={Math.max(trendHoverPoint.y - 14, 41)}
                        fill="#ffffff"
                        fontSize={12}
                        fontWeight={800}
                        textAnchor="middle"
                        fontFamily="sans-serif"
                      >
                        {trendMetric === 'revenue'
                          ? `Rs. ${trendHoverPoint.value.toLocaleString()}`
                          : `${trendHoverPoint.value} students`}
                      </text>
                    </g>
                  )}
                </svg>
              </div>
            </div>

            {/* Month-Over-Month Detailed Growth Analytics Table */}
            <div className="glass-card" style={{ overflow: 'hidden', padding: 0, borderRadius: 12 }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <TrendingUp size={16} style={{ color: '#10b981' }} />
                    Month-over-Month (MoM) Grade Breakdown &amp; Growth Analysis
                  </h3>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    Detailed progression across Grades 6 through 11 for {trendYear}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => {
                      const headers = ['Month', 'Gr 6', 'Gr 7', 'Gr 8', 'Gr 9', 'Gr 10', 'Gr 11', 'Total', 'MoM Delta', 'MoM Growth %']
                      const rows = trendMoMTable.map(r => {
                        let grCounts = [6, 7, 8, 9, 10, 11].map(g => {
                          if (trendMetric === 'students') return r.studentCountsByGrade[g]
                          if (trendMetric === 'revenue') return r.revenueByGrade[g]
                          return r.regByGrade[g]
                        })

                        return [
                          `"${r.monthName} ${trendYear}"`,
                          ...grCounts.map(c => `"${c}"`),
                          `"${r.currentVal}"`,
                          `"${r.delta >= 0 ? '+' : ''}${r.delta}"`,
                          `"${r.pctChange !== null ? r.pctChange + '%' : '—'}"`
                        ]
                      })

                      exportTableToCsv(`${trendYear}_MultiMonth_Trend_Analytics`, headers, rows)
                    }}
                    className="btn-primary"
                    style={{ background: '#10b981', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
                  >
                    <FileSpreadsheet size={15} /> Export Trend CSV
                  </button>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-base)' }}>
                      <th style={{ textAlign: 'left', padding: '12px 16px' }}>Month</th>
                      <th>Gr 6</th>
                      <th>Gr 7</th>
                      <th>Gr 8</th>
                      <th>Gr 9</th>
                      <th>Gr 10</th>
                      <th>Gr 11</th>
                      <th style={{ fontWeight: 800, color: 'var(--accent-blue)', background: 'rgba(59,130,246,0.08)' }}>
                        {trendMetric === 'revenue' ? 'Total Revenue' : 'Total Count'}
                      </th>
                      <th>MoM Delta</th>
                      <th>Growth %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trendMoMTable.map(row => {
                      const isPositive = row.delta > 0
                      const isNegative = row.delta < 0

                      return (
                        <tr key={row.month} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ textAlign: 'left', fontWeight: 700, padding: '12px 16px', color: 'var(--text-primary)' }}>
                            {row.monthName} {trendYear}
                          </td>
                          <td style={{ color: '#10b981', fontWeight: 600 }}>
                            {trendMetric === 'revenue' ? `Rs. ${row.revenueByGrade[6].toLocaleString()}` : trendMetric === 'students' ? row.studentCountsByGrade[6] : row.regByGrade[6]}
                          </td>
                          <td style={{ color: '#f59e0b', fontWeight: 600 }}>
                            {trendMetric === 'revenue' ? `Rs. ${row.revenueByGrade[7].toLocaleString()}` : trendMetric === 'students' ? row.studentCountsByGrade[7] : row.regByGrade[7]}
                          </td>
                          <td style={{ color: '#ec4899', fontWeight: 600 }}>
                            {trendMetric === 'revenue' ? `Rs. ${row.revenueByGrade[8].toLocaleString()}` : trendMetric === 'students' ? row.studentCountsByGrade[8] : row.regByGrade[8]}
                          </td>
                          <td style={{ color: '#8b5cf6', fontWeight: 600 }}>
                            {trendMetric === 'revenue' ? `Rs. ${row.revenueByGrade[9].toLocaleString()}` : trendMetric === 'students' ? row.studentCountsByGrade[9] : row.regByGrade[9]}
                          </td>
                          <td style={{ color: '#06b6d4', fontWeight: 600 }}>
                            {trendMetric === 'revenue' ? `Rs. ${row.revenueByGrade[10].toLocaleString()}` : trendMetric === 'students' ? row.studentCountsByGrade[10] : row.regByGrade[10]}
                          </td>
                          <td style={{ color: '#f97316', fontWeight: 600 }}>
                            {trendMetric === 'revenue' ? `Rs. ${row.revenueByGrade[11].toLocaleString()}` : trendMetric === 'students' ? row.studentCountsByGrade[11] : row.regByGrade[11]}
                          </td>
                          <td style={{ fontWeight: 800, fontSize: 14, color: 'var(--accent-blue)', background: 'rgba(59,130,246,0.08)' }}>
                            {trendMetric === 'revenue' ? `Rs. ${row.currentVal.toLocaleString()}` : `${row.currentVal.toLocaleString()}`}
                          </td>
                          <td>
                            {row.prevVal > 0 ? (
                              <span style={{
                                color: isPositive ? '#10b981' : isNegative ? '#ef4444' : 'var(--text-muted)',
                                fontWeight: 700,
                                fontSize: 12
                              }}>
                                {isPositive ? `+${row.delta.toLocaleString()}` : row.delta.toLocaleString()}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>— (Base)</span>
                            )}
                          </td>
                          <td>
                            {row.pctChange !== null ? (
                              <span
                                className="badge"
                                style={{
                                  background: isPositive ? 'rgba(16,185,129,0.15)' : isNegative ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
                                  color: isPositive ? '#10b981' : isNegative ? '#ef4444' : 'var(--text-muted)',
                                  fontWeight: 700,
                                  fontSize: 11
                                }}
                              >
                                {isPositive ? '↗ +' : isNegative ? '↘ ' : ''}{row.pctChange}%
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
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


