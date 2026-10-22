'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Users, Phone, TrendingUp, Activity, BarChart2,
  RefreshCw, CheckCircle, CreditCard, Calendar,
  CheckCircle2, FileSpreadsheet, Target, Award, Clock, ArrowRight,
  Sparkles, Trophy, Layers, DollarSign, History, AlertCircle
} from 'lucide-react'
import Link from 'next/link'

// ──────────────────────────────────────────────────────────────
// Clean & Unified Pro Color Theme (No Rainbow clutter)
// ──────────────────────────────────────────────────────────────

const GRADES = ['6', '7', '8', '9', '10', '11']

const STATUS_GROUPS = {
  hot: { label: 'Hot / Active', statuses: ['Contacted', 'Interested', 'Second Call Pending', 'Follow-up'] },
  converted: { label: 'Converted', statuses: ['Converted'] },
  new: { label: 'New Leads', statuses: ['New'] },
  cold: { label: 'Cold / Inactive', statuses: ['Not Interested', 'Off', 'Invalid', 'Wrong number', 'Busy', 'Call Another Number', 'No Answer'] },
}

interface LeadRow {
  id?: string
  assigned_member: string | null
  grade: string | null
  status: string
  campaign: string | null
  date_added: string | null
  created_at?: string | null
  paid?: boolean
  comments?: string | null
}

export default function AnalyticsDashboard() {
  const supabase = createClient()

  // User Authentication & Workstation State
  const [currentMemberName, setCurrentMemberName] = useState<string>('')
  const [userRole, setUserRole] = useState<string>('member')
  const [userSubRole, setUserSubRole] = useState<string>('')
  const [allowedMembers, setAllowedMembers] = useState<string[]>([])
  const [canViewAll, setCanViewAll] = useState<boolean>(false)

  // Commission Rates State (Configurable by Admin)
  // Grade 6-8: Rs. 65 | Grade 9: Rs. 70 | Grade 10-11: Rs. 75
  const [rateG6_8, setRateG6_8] = useState<number>(65)
  const [rateG9, setRateG9] = useState<number>(70)
  const [rateG10_11, setRateG10_11] = useState<number>(75)
  const [commissionViewFilter, setCommissionViewFilter] = useState<'current_active' | 'all_paid'>('current_active')
  const [settlementSuccess, setSettlementSuccess] = useState<string>('')
  const [settlingModalOpen, setSettlingModalOpen] = useState(false)
  const [settleTargetMember, setSettleTargetMember] = useState<string | null>(null) // null = all members, string = specific member name
  const [settlingLoading, setSettlingLoading] = useState(false)
  const [adminPasswordForSettle, setAdminPasswordForSettle] = useState('')
  const [settleError, setSettleError] = useState('')

  // Primary Tab Switcher
  const [activeTab, setActiveTab] = useState<'overview' | 'daily_member_tracking' | 'master_paid_report'>('overview')

  const [leads, setLeads] = useState<LeadRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Date filters for overview
  const [filterStart, setFilterStart] = useState('')
  const [filterEnd, setFilterEnd] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  // Specific Day selection for Day-by-Day Member Lead Tracking tab
  const [selectedDay, setSelectedDay] = useState(new Date().toISOString().slice(0, 10))

  // KPI States
  const [revenueThisMonth, setRevenueThisMonth] = useState(0)
  const [paidThisMonth, setPaidThisMonth] = useState(0)
  const [totalStudents, setTotalStudents] = useState(0)

  // Fetch all leads using fast parallel chunking
  async function fetchAllLeadsSequential(): Promise<LeadRow[]> {
    const pageSize = 1000
    // Get total count first to spawn exact parallel chunks
    const { count } = await supabase.from('leads').select('id', { count: 'exact', head: true })
    const totalCount = count || 20000
    const numBatches = Math.ceil(totalCount / pageSize)

    const batchPromises = Array.from({ length: numBatches }, (_, i) => {
      const from = i * pageSize
      return supabase
        .from('leads')
        .select('id,assigned_member,grade,status,campaign,date_added,created_at,paid,comments')
        .range(from, from + pageSize - 1)
    })

    const results = await Promise.all(batchPromises)
    let allLeads: LeadRow[] = []
    for (const res of results) {
      if (res.data && res.data.length > 0) {
        allLeads.push(...res.data)
      }
    }
    return allLeads
  }

  async function loadData() {
    setRefreshing(true)
    try {
      const now = new Date()
      const curMonth = now.getMonth() + 1
      const curYear = now.getFullYear()

      // Chunked fetch for payments to bypass Supabase 1,000-row limit
      const fetchAllPaymentsThisMonth = async () => {
        let allPmts: any[] = []
        let from = 0
        const pageSize = 1000
        let hasMore = true
        while (hasMore) {
          const { data, error } = await supabase
            .from('payments')
            .select('amount_paid,payment_type,student_id')
            .eq('month', curMonth)
            .eq('year', curYear)
            .range(from, from + pageSize - 1)
          if (error) {
            console.error('Error fetching payments in dashboard:', error)
            break
          }
          if (data && data.length > 0) {
            allPmts = allPmts.concat(data)
            if (data.length < pageSize) {
              hasMore = false
            } else {
              from += pageSize
            }
          } else {
            hasMore = false
          }
        }
        return allPmts
      }

      const [leadsData, pmts, studRes] = await Promise.all([
        fetchAllLeadsSequential().catch(async (err) => {
          console.warn('Direct fetch failed, falling back to API:', err)
          const res = await fetch('/api/leads/analytics')
          const json = await res.json()
          return (json.leads || []) as LeadRow[]
        }),
        fetchAllPaymentsThisMonth(),
        supabase.from('students').select('*', { count: 'exact', head: true }).not('created_by', 'ilike', '%Auto-Pre-generated%'),
      ])

      setLeads(leadsData || [])
      const rev = pmts
        .filter((p: any) => !['FREE', 'IMS'].includes(p.payment_type || ''))
        .reduce((s: number, p: any) => s + (p.amount_paid || 0), 0)

      setRevenueThisMonth(rev)
      setPaidThisMonth(new Set(pmts.map((p: any) => p.student_id)).size)
      setTotalStudents(studRes.count || 0)
      setLastUpdated(new Date())
    } catch (e) {
      console.error('loadData error:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const isAdmin = Boolean(userRole === 'admin' || userRole === 'owner' || (currentMemberName && currentMemberName.toLowerCase().includes('admin')))
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        const uName = user.user_metadata?.full_name || user.email?.split('@')[0] || ''
        let uRole = user.user_metadata?.role || (user.email?.toLowerCase().includes('admin') ? 'admin' : 'member')
        let uSubRole = ''

        if (user.email) {
          const { data: dbMem } = await supabase.from('members').select('name, role, notes').eq('email', user.email).single()
          if (dbMem) {
            if (dbMem.name) setCurrentMemberName(dbMem.name)
            else setCurrentMemberName(uName)

            if (dbMem.role) uRole = dbMem.role
            try {
              if (dbMem.notes) {
                const perms = JSON.parse(dbMem.notes)
                if (perms.allowed_members) setAllowedMembers(perms.allowed_members)
                if (perms.can_view_all !== undefined) setCanViewAll(perms.can_view_all)
                if (perms.sub_role) uSubRole = perms.sub_role
              }
            } catch {}
          } else {
            setCurrentMemberName(uName)
          }
        } else {
          setCurrentMemberName(uName)
        }

        if (user.email?.toLowerCase().includes('admin')) {
          uRole = 'admin'
        }

        setUserRole(uRole)
        setUserSubRole(uSubRole)
      }
    })
  }, [])

  useEffect(() => {
    loadData()

    const handleRealtimeChange = () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = setTimeout(() => {
        loadData()
      }, 1500)
    }

    const ch = supabase.channel('analytics-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, handleRealtimeChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, handleRealtimeChange)
      .subscribe()

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      supabase.removeChannel(ch)
    }
  }, [])

  // Helper to extract grade numbers
  function extractGrades(rawGrade: string | number | null): string[] {
    if (rawGrade === null || rawGrade === undefined) return []
    const str = String(rawGrade).trim()
    if (!str) return []

    const matches = str.match(/\b(6|7|8|9|10|11)\b/g)
    if (matches && matches.length > 0) {
      return Array.from(new Set(matches))
    }

    const found: string[] = []
    GRADES.forEach(g => {
      const regex = new RegExp(`(^|[^0-9])${g}([^0-9]|$)`)
      if (regex.test(str)) found.push(g)
    })
    return found
  }

  // Settle / Clear Current Active Commissions and log history (All or Single Member)
  async function executeCommissionSettlement(e: React.FormEvent) {
    e.preventDefault()
    if (!adminPasswordForSettle) {
      setSettleError('Admin password is required to settle commissions.')
      return
    }

    setSettlingLoading(true)
    setSettleError('')

    try {
      const now = new Date()
      const timeStampStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
      const prefix = settleTargetMember ? `COMM_${settleTargetMember.toUpperCase().replace(/\s+/g, '_')}_` : 'COMM_'
      const batchId = `${prefix}${timeStampStr}`

      // Filter paid members and leads based on target
      const targetMembersList = settleTargetMember
        ? paidMembersList.filter(m => m.name.toLowerCase() === settleTargetMember.toLowerCase())
        : paidMembersList

      const leadsToMark = paidLeads.filter(l => {
        if (!l.id) return false
        if (settleTargetMember) {
          const assigned = (l.assigned_member || 'Unassigned').trim().toLowerCase()
          return assigned === settleTargetMember.trim().toLowerCase()
        }
        return true
      })

      if (leadsToMark.length === 0 || targetMembersList.length === 0) {
        throw new Error('No unsettled leads found for the selected member/target.')
      }

      // 1. Prepare settlement record
      const memberBreakdown = targetMembersList.map(m => ({
        member_name: m.name,
        paid_classes: m.totalPaidClasses,
        commission_amount: m.commissionAmount,
        grades: paidMemberGradeMatrix[m.name] || {}
      }))

      const settledAmount = targetMembersList.reduce((acc, m) => acc + m.commissionAmount, 0)
      const settledClassesCount = targetMembersList.reduce((acc, m) => acc + m.totalPaidClasses, 0)

      const settlementRecord = {
        batch_id: batchId,
        settled_at: now.toISOString(),
        settled_by: currentMemberName || 'Admin',
        target_member: settleTargetMember || 'ALL_MEMBERS',
        lead_count: leadsToMark.length,
        total_paid_classes: settledClassesCount,
        total_commission_amount: settledAmount,
        rates_used: { g6_8: rateG6_8, g9: rateG9, g10_11: rateG10_11 },
        member_breakdown: memberBreakdown
      }

      // 2. Save settlement history to admin member notes
      const { data: adminRecord } = await supabase.from('members').select('id, notes').eq('name', 'Admin User').maybeSingle()
      let existingNotes: any = {}
      try {
        if (adminRecord?.notes) existingNotes = JSON.parse(adminRecord.notes)
      } catch {}

      const existingHistory = existingNotes.commission_settlements || []
      const updatedNotes = {
        ...existingNotes,
        commission_settlements: [settlementRecord, ...existingHistory]
      }

      const saveHistRes = await fetch('/api/members/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_custom_courses',
          adminPassword: adminPasswordForSettle,
          memberId: adminRecord?.id || 'admin_user_auto',
          courses: existingNotes.courses || [],
          fees: existingNotes.fees || {},
          grade_courses: existingNotes.grade_courses || existingNotes.gradeCourses,
          standalone_courses: existingNotes.standalone_courses || existingNotes.standaloneCourses,
          ...updatedNotes
        })
      })

      if (!saveHistRes.ok) {
        const errJson = await saveHistRes.json()
        throw new Error(errJson.error || 'Failed to authenticate admin or save settlement history.')
      }

      // 3. Mark targeted unsettled leads with [SETTLED: batchId] tag in comments
      for (const l of leadsToMark) {
        const oldComments = (l.comments || '').trim()
        const newComments = oldComments ? `${oldComments} [SETTLED:${batchId}]` : `[SETTLED:${batchId}]`
        await supabase.from('leads').update({ comments: newComments }).eq('id', l.id)
      }

      const targetLabel = settleTargetMember ? `for ${settleTargetMember}` : 'for all team members'
      setSettlingModalOpen(false)
      setAdminPasswordForSettle('')
      setSettleTargetMember(null)
      setSettlementSuccess(`✓ Successfully cleared commissions ${targetLabel} (${batchId})! Amount: Rs. ${settledAmount.toLocaleString()}`)
      setTimeout(() => setSettlementSuccess(''), 8000)

      await loadData()
    } catch (err: any) {
      setSettleError(err.message)
    } finally {
      setSettlingLoading(false)
    }
  }

  // Filtered leads based on Date Range
  const filtered = useMemo(() => {
    if (!filterStart && !filterEnd) return leads
    return leads.filter(l => {
      const dateStr = l.date_added || l.created_at || ''
      if (!dateStr) return true
      const d = dateStr.slice(0, 10)
      if (filterStart && d < filterStart) return false
      if (filterEnd && d > filterEnd) return false
      return true
    })
  }, [leads, filterStart, filterEnd])

  const totalFiltered = filtered.length

  // All distinct members in filtered dataset
  const members = useMemo(() => {
    const counts: Record<string, number> = {}
    filtered.forEach(l => {
      const m = l.assigned_member || 'Unassigned'
      counts[m] = (counts[m] || 0) + 1
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, total]) => ({ name, total }))
  }, [filtered])

  // Member × Grade Matrix (All leads / filtered range)
  const memberGradeMatrix = useMemo(() => {
    const matrix: Record<string, Record<string, number>> = {}
    filtered.forEach(l => {
      const m = l.assigned_member || 'Unassigned'
      if (!matrix[m]) matrix[m] = {}

      const gradesInLead = extractGrades(l.grade)
      if (gradesInLead.length > 0) {
        gradesInLead.forEach(g => {
          matrix[m][g] = (matrix[m][g] || 0) + 1
        })
      } else {
        matrix[m]['Other'] = (matrix[m]['Other'] || 0) + 1
      }
    })
    return matrix
  }, [filtered])

  // Grade Totals
  const gradeTotals = useMemo(() => {
    const t: Record<string, number> = {}
    filtered.forEach(l => {
      const gradesInLead = extractGrades(l.grade)
      if (gradesInLead.length > 0) {
        gradesInLead.forEach(g => {
          t[g] = (t[g] || 0) + 1
        })
      } else {
        t['Other'] = (t['Other'] || 0) + 1
      }
    })
    return t
  }, [filtered])

  // Status breakdown
  const statusCounts = useMemo(() => {
    const c: Record<string, number> = {}
    filtered.forEach(l => { c[l.status] = (c[l.status] || 0) + 1 })
    return c
  }, [filtered])

  // Conversion rate
  const convertedCount = statusCounts['Converted'] || 0
  const conversionRate = totalFiltered > 0 ? ((convertedCount / totalFiltered) * 100).toFixed(1) : '0.0'

  // =========================================================================
  // 1. DAY-BY-DAY MEMBER LEAD TRACKING COMPUTATIONS
  // =========================================================================
  const dayLeads = useMemo(() => {
    return leads.filter(l => {
      const d = (l.date_added || l.created_at || '').slice(0, 10)
      return d === selectedDay
    })
  }, [leads, selectedDay])

  const dayMembers = useMemo(() => {
    const counts: Record<string, number> = {}
    dayLeads.forEach(l => {
      const m = l.assigned_member || 'Unassigned'
      counts[m] = (counts[m] || 0) + 1
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, total]) => ({ name, total }))
  }, [dayLeads])

  const dayMemberGradeMatrix = useMemo(() => {
    const matrix: Record<string, Record<string, number>> = {}
    dayLeads.forEach(l => {
      const m = l.assigned_member || 'Unassigned'
      if (!matrix[m]) matrix[m] = {}

      const gradesInLead = extractGrades(l.grade)
      if (gradesInLead.length > 0) {
        gradesInLead.forEach(g => {
          matrix[m][g] = (matrix[m][g] || 0) + 1
        })
      } else {
        matrix[m]['Other'] = (matrix[m]['Other'] || 0) + 1
      }
    })
    return matrix
  }, [dayLeads])

  const dayGradeTotals = useMemo(() => {
    const t: Record<string, number> = {}
    dayLeads.forEach(l => {
      const gradesInLead = extractGrades(l.grade)
      if (gradesInLead.length > 0) {
        gradesInLead.forEach(g => {
          t[g] = (t[g] || 0) + 1
        })
      } else {
        t['Other'] = (t['Other'] || 0) + 1
      }
    })
    return t
  }, [dayLeads])

  // =========================================================================
  // 2. MASTER LEAD PAID TICK REPORT COMPUTATIONS (MEMBERS × GRADE × COUNT & COMMISSIONS)
  // =========================================================================
  const allPaidLeads = useMemo(() => {
    return filtered.filter(l => Boolean(l.paid))
  }, [filtered])

  // If viewing 'current_active', filter out leads whose comments already indicate settlement [SETTLED: ...]
  const paidLeads = useMemo(() => {
    if (commissionViewFilter === 'all_paid') {
      return allPaidLeads
    }
    return allPaidLeads.filter(l => !(l.comments && l.comments.includes('[SETTLED:')))
  }, [allPaidLeads, commissionViewFilter])

  const paidMemberGradeMatrix = useMemo(() => {
    const matrix: Record<string, Record<string, number>> = {}
    paidLeads.forEach(l => {
      const m = l.assigned_member || 'Unassigned'
      if (!matrix[m]) matrix[m] = {}

      const gradesToCount = extractGrades(l.grade)
      if (gradesToCount.length > 0) {
        gradesToCount.forEach(g => {
          matrix[m][g] = (matrix[m][g] || 0) + 1
        })
      } else {
        matrix[m]['Other'] = (matrix[m]['Other'] || 0) + 1
      }
    })
    return matrix
  }, [paidLeads])

  const paidGradeTotals = useMemo(() => {
    const t: Record<string, number> = {}
    paidLeads.forEach(l => {
      const gradesToCount = extractGrades(l.grade)
      if (gradesToCount.length > 0) {
        gradesToCount.forEach(g => {
          t[g] = (t[g] || 0) + 1
        })
      } else {
        t['Other'] = (t['Other'] || 0) + 1
      }
    })
    return t
  }, [paidLeads])

  // Helper to compute commission for a given grade count distribution
  // G6-8: rateG6_8 (default Rs. 65), G9: rateG9 (default Rs. 70), G10-11: rateG10_11 (default Rs. 75)
  function computeCommissionFromGradeCounts(row: Record<string, number>): number {
    const g6_8Count = (row['6'] || 0) + (row['7'] || 0) + (row['8'] || 0)
    const g9Count = row['9'] || 0
    const g10_11Count = (row['10'] || 0) + (row['11'] || 0)
    // Any other unmapped grade counted at G6-8 base rate
    const otherCount = row['Other'] || 0
    return (g6_8Count * rateG6_8) + (g9Count * rateG9) + (g10_11Count * rateG10_11) + (otherCount * rateG6_8)
  }

  const paidMembersList = useMemo(() => {
    const counts: Record<string, number> = {}
    paidLeads.forEach(l => {
      const m = l.assigned_member || 'Unassigned'
      const gradesToCount = extractGrades(l.grade)
      const count = Math.max(1, gradesToCount.length)
      counts[m] = (counts[m] || 0) + count
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, totalPaidClasses]) => {
      const gradeCounts = paidMemberGradeMatrix[name] || {}
      const commissionAmount = computeCommissionFromGradeCounts(gradeCounts)
      return { name, totalPaidClasses, commissionAmount }
    })
  }, [paidLeads, paidMemberGradeMatrix, rateG6_8, rateG9, rateG10_11])

  const totalPaidConversions = paidLeads.length
  const totalPaidClassesCount = Object.values(paidGradeTotals).reduce((sum, c) => sum + c, 0)
  const totalCommissionAmount = paidMembersList.reduce((acc, m) => acc + m.commissionAmount, 0)

  // =========================================================================
  // 3. PERSONALIZED AGENT WORKSTATION COMPUTATIONS (FOR NON-ADMIN USERS)
  // =========================================================================
  const myLeads = useMemo(() => {
    if (!currentMemberName) return []
    return filtered.filter(l => {
      const assigned = (l.assigned_member || '').trim().toLowerCase()
      const curr = currentMemberName.trim().toLowerCase()
      return assigned === curr || (allowedMembers.length > 0 && allowedMembers.map(m => m.toLowerCase()).includes(assigned))
    })
  }, [filtered, currentMemberName, allowedMembers])

  const myConvertedLeads = useMemo(() => {
    return myLeads.filter(l => l.status === 'Converted')
  }, [myLeads])

  const myPaidLeads = useMemo(() => {
    return myLeads.filter(l => Boolean(l.paid))
  }, [myLeads])

  const myConversionRate = myLeads.length > 0 
    ? ((myConvertedLeads.length / myLeads.length) * 100).toFixed(1)
    : '0.0'

  const myGradeBreakdown = useMemo(() => {
    const t: Record<string, { total: number; converted: number; paid: number }> = {}
    GRADES.forEach(g => { t[g] = { total: 0, converted: 0, paid: 0 } })
    t['Other'] = { total: 0, converted: 0, paid: 0 }

    myLeads.forEach(l => {
      const gradesInLead = extractGrades(l.grade)
      const isConv = l.status === 'Converted'
      const isPaid = Boolean(l.paid)

      if (gradesInLead.length > 0) {
        gradesInLead.forEach(g => {
          if (!t[g]) t[g] = { total: 0, converted: 0, paid: 0 }
          t[g].total += 1
          if (isConv) t[g].converted += 1
          if (isPaid) t[g].paid += 1
        })
      } else {
        t['Other'].total += 1
        if (isConv) t['Other'].converted += 1
        if (isPaid) t['Other'].paid += 1
      }
    })
    return t
  }, [myLeads])

  const myStatusCounts = useMemo(() => {
    const c: Record<string, number> = {}
    myLeads.forEach(l => { c[l.status] = (c[l.status] || 0) + 1 })
    return c
  }, [myLeads])

  // Member's Own Live Active Commission Calculation (G6-8: 65, G9: 70, G10-11: 75)
  const myActivePaidLeads = useMemo(() => {
    return myPaidLeads.filter(l => !(l.comments && l.comments.includes('[SETTLED:')))
  }, [myPaidLeads])

  const myCommissionAmount = useMemo(() => {
    let g6_8 = 0
    let g9 = 0
    let g10_11 = 0
    let other = 0

    myActivePaidLeads.forEach(l => {
      const gradesInLead = extractGrades(l.grade)
      if (gradesInLead.length > 0) {
        gradesInLead.forEach(g => {
          if (['6', '7', '8'].includes(g)) g6_8 += 1
          else if (g === '9') g9 += 1
          else if (['10', '11'].includes(g)) g10_11 += 1
          else other += 1
        })
      } else {
        other += 1
      }
    })

    return (g6_8 * rateG6_8) + (g9 * rateG9) + (g10_11 * rateG10_11) + (other * rateG6_8)
  }, [myActivePaidLeads, rateG6_8, rateG9, rateG10_11])

  // Export CSV Helper
  function exportCsv(filename: string, headers: string[], rows: string[][]) {
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

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          <Activity size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
          <div>Loading analytics…</div>
        </div>
      </div>
    )
  }

  return (
    <div className="fade-in" style={{ paddingBottom: 60, fontFamily: 'inherit' }}>
      {/* ── Radiant Welcome Hero Banner (Exact Match to LMS Student/Staff Reference) ── */}
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 50%, #7c3aed 100%)',
        borderRadius: 22,
        padding: '28px 32px',
        color: '#ffffff',
        marginBottom: 24,
        overflow: 'hidden',
        boxShadow: '0 20px 40px -15px rgba(2, 132, 199, 0.35)'
      }}>
        {/* Glow orb */}
        <div style={{
          position: 'absolute',
          top: -60,
          right: 40,
          width: 220,
          height: 220,
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.18)',
          filter: 'blur(40px)',
          pointerEvents: 'none'
        }} />

        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 6px', color: '#ffffff', display: 'flex', alignItems: 'center', gap: 10 }}>
                Welcome back, {currentMemberName || (isAdmin ? 'Admin' : 'Team Member')}!
                <Sparkles size={22} style={{ color: '#fcd34d' }} />
              </h1>
              <p style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.85)', margin: 0 }}>
                {isAdmin
                  ? 'Ready to continue institutional operations and lead management today?'
                  : 'Here is your personalized lead pipeline and active conversion progress.'}
              </p>
            </div>

            {/* Live Clock & Translucent Metric Stat Pills (Matching Reference) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{
                background: 'rgba(255, 255, 255, 0.18)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                padding: '10px 18px',
                borderRadius: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 10
              }}>
                <span style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.8)', fontWeight: 700, textTransform: 'uppercase' }}>
                  {isAdmin ? 'Total Leads' : 'My Leads'}
                </span>
                <strong style={{ fontSize: 16, color: '#ffffff' }}>
                  {(isAdmin ? totalFiltered : myLeads.length).toLocaleString()}
                </strong>
              </div>

              <div style={{
                background: 'rgba(255, 255, 255, 0.18)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                padding: '10px 18px',
                borderRadius: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 10
              }}>
                <span style={{ fontSize: 11, color: '#a7f3d0', fontWeight: 700, textTransform: 'uppercase' }}>Converted</span>
                <strong style={{ fontSize: 16, color: '#ffffff' }}>
                  {(isAdmin ? convertedCount : myConvertedLeads.length).toLocaleString()}
                </strong>
              </div>

              <div style={{
                background: 'rgba(255, 255, 255, 0.22)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.35)',
                padding: '10px 18px',
                borderRadius: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 8px #34d399' }} />
                <span style={{ fontSize: 13, fontWeight: 800, color: '#ffffff', letterSpacing: '0.5px' }}>
                  {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Learning Motivation / Daily Progress Alert Bar ── */}
      <div className="glass-card" style={{
        borderRadius: 16,
        padding: '14px 20px',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        border: '1px solid rgba(245, 158, 11, 0.3)',
        boxShadow: '0 4px 20px -5px rgba(245, 158, 11, 0.12)',
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: 'rgba(245, 158, 11, 0.15)',
            color: '#f59e0b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Target size={20} />
          </div>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text-primary)' }}>
              {isAdmin ? "Today's Institutional Lead Target" : "Your Daily Target & Call Performance"}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              {isAdmin
                ? "Keep follow-ups warm and review payment status for all confirmed students!"
                : "Follow up with pending students today and lock in admissions for this term!"}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn-secondary" onClick={loadData} disabled={refreshing}
            style={{ padding: '7px 16px', fontSize: 12, display: 'flex', gap: 6, alignItems: 'center', borderRadius: 10 }}>
            <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none', color: '#f59e0b' }} />
            {refreshing ? 'Refreshing…' : 'Sync Live'}
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>

      <div className="page-content">

        {/* ── Navigation Tabs ───────────────────────────── */}
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
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              boxSizing: 'border-box',
              border: activeTab === 'overview' ? '1px solid var(--accent-blue)' : '1px solid transparent',
              background: activeTab === 'overview' ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
              color: activeTab === 'overview' ? 'var(--accent-blue)' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              whiteSpace: 'nowrap',
              transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease'
            }}
          >
            <BarChart2 size={15} />
            <span>{isAdmin ? 'Overview' : 'My Workstation'}</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab('daily_member_tracking')}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                boxSizing: 'border-box',
                border: activeTab === 'daily_member_tracking' ? '1px solid var(--accent-blue)' : '1px solid transparent',
                background: activeTab === 'daily_member_tracking' ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                color: activeTab === 'daily_member_tracking' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                whiteSpace: 'nowrap',
                transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease'
              }}
            >
              <Calendar size={15} />
              <span>Daily Tracking</span>
              <span style={{
                fontSize: 11,
                padding: '2px 7px',
                borderRadius: 10,
                boxSizing: 'border-box',
                background: activeTab === 'daily_member_tracking' ? 'var(--accent-blue)' : 'var(--bg-card-hover)',
                color: activeTab === 'daily_member_tracking' ? '#fff' : 'var(--text-muted)',
                border: '1px solid ' + (activeTab === 'daily_member_tracking' ? 'var(--accent-blue)' : 'var(--border)'),
                fontWeight: 600
              }}>
                {dayLeads.length} today
              </span>
            </button>
          )}

          {isAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab('master_paid_report')}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                boxSizing: 'border-box',
                border: activeTab === 'master_paid_report' ? '1px solid var(--accent-blue)' : '1px solid transparent',
                background: activeTab === 'master_paid_report' ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                color: activeTab === 'master_paid_report' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                whiteSpace: 'nowrap',
                transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease'
              }}
            >
              <CheckCircle2 size={15} />
              <span>Paid Report</span>
              <span style={{
                fontSize: 11,
                padding: '2px 7px',
                borderRadius: 10,
                boxSizing: 'border-box',
                background: activeTab === 'master_paid_report' ? 'var(--accent-blue)' : 'var(--bg-card-hover)',
                color: activeTab === 'master_paid_report' ? '#fff' : 'var(--text-muted)',
                border: '1px solid ' + (activeTab === 'master_paid_report' ? 'var(--accent-blue)' : 'var(--border)'),
                fontWeight: 600
              }}>
                {totalPaidConversions} paid leads
              </span>
            </button>
          )}
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: OVERALL CRM ANALYTICS (ADMIN) / MY WORKSTATION (STAFF)             */}
        {/* ========================================================================= */}
        {activeTab === 'overview' && (
          <div className="fade-in">
            {/* Filter Bar */}
            <div className="glass-card" style={{ padding: 14, marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>From Date</label>
              <input type="date" className="input-field" value={filterStart} onChange={e => setFilterStart(e.target.value)}
                style={{ padding: '5px 10px', fontSize: 12, width: 140 }} />
              <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>To Date</label>
              <input type="date" className="input-field" value={filterEnd} onChange={e => setFilterEnd(e.target.value)}
                style={{ padding: '5px 10px', fontSize: 12, width: 140 }} />
              {(filterStart || filterEnd) && (
                <button className="btn-secondary" onClick={() => { setFilterStart(''); setFilterEnd('') }}
                  style={{ padding: '5px 10px', fontSize: 12 }}>Clear</button>
              )}
            </div>

            {isAdmin ? (
              /* ── ADMIN EXECUTIVE KPI CARDS ── */
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 22 }}>
                <KpiCard
                  icon={<Phone size={18} />}
                  iconBg="#e0f2fe"
                  iconColor="#0284c7"
                  borderColor="#38bdf8"
                  label="Total Leads"
                  value={totalFiltered.toLocaleString()}
                />
                <KpiCard
                  icon={<TrendingUp size={18} />}
                  iconBg="#dcfce7"
                  iconColor="#16a34a"
                  borderColor="#4ade80"
                  label="Converted"
                  value={convertedCount.toLocaleString()}
                  sub={`${conversionRate}% rate`}
                />
                <KpiCard
                  icon={<Users size={18} />}
                  iconBg="#e0e7ff"
                  iconColor="#4f46e5"
                  borderColor="#818cf8"
                  label="Total Students"
                  value={totalStudents.toLocaleString()}
                />
                <KpiCard
                  icon={<CheckCircle size={18} />}
                  iconBg="#ccfbf1"
                  iconColor="#0d9488"
                  borderColor="#2dd4bf"
                  label="Paid Leads (Ticks)"
                  value={paidLeads.length.toLocaleString()}
                />
                <KpiCard
                  icon={<CreditCard size={18} />}
                  iconBg="#fef3c7"
                  iconColor="#d97706"
                  borderColor="#fcd34d"
                  label="Monthly Revenue"
                  value={`Rs. ${revenueThisMonth.toLocaleString()}`}
                />
              </div>
            ) : (
              /* ── PERSONAL AGENT WORKSTATION KPI CARDS ── */
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 22 }}>
                <KpiCard
                  icon={<Phone size={18} />}
                  iconBg="#e0f2fe"
                  iconColor="#0284c7"
                  borderColor="#38bdf8"
                  label="My Assigned Leads"
                  value={myLeads.length.toLocaleString()}
                />
                <KpiCard
                  icon={<TrendingUp size={18} />}
                  iconBg="#dcfce7"
                  iconColor="#16a34a"
                  borderColor="#4ade80"
                  label="My Conversions"
                  value={myConvertedLeads.length.toLocaleString()}
                  sub={`${myConversionRate}% conversion`}
                />
                <KpiCard
                  icon={<CheckCircle size={18} />}
                  iconBg="#ccfbf1"
                  iconColor="#0d9488"
                  borderColor="#2dd4bf"
                  label="My Paid Leads"
                  value={myPaidLeads.length.toLocaleString()}
                />
                <KpiCard
                  icon={<Award size={18} />}
                  iconBg="#fef3c7"
                  iconColor="#d97706"
                  borderColor="#fcd34d"
                  label="Conversion Rate"
                  value={`${myConversionRate}%`}
                  sub="Target: >20%"
                />
                <KpiCard
                  icon={<DollarSign size={18} />}
                  iconBg="rgba(16, 185, 129, 0.15)"
                  iconColor="#34d399"
                  borderColor="#10b981"
                  label="My Live Commission"
                  value={`Rs. ${myCommissionAmount.toLocaleString()}`}
                  sub={`${myActivePaidLeads.length} active seats in cycle`}
                />
              </div>
            )}

            {/* Clean Status Group Bento Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 22 }}>
              {Object.entries(STATUS_GROUPS).map(([key, grp]) => {
                const count = grp.statuses.reduce((s, st) => s + ((isAdmin ? statusCounts[st] : myStatusCounts[st]) || 0), 0)
                const denom = isAdmin ? totalFiltered : myLeads.length
                const pct = denom > 0 ? ((count / denom) * 100).toFixed(1) : '0.0'
                const barColor = key === 'hot' ? '#f59e0b' : key === 'converted' ? '#10b981' : key === 'new' ? '#38bdf8' : '#94a3b8'
                return (
                  <div key={key} className="glass-card bento-kpi-card" style={{ padding: '16px 20px', borderTop: `3px solid ${barColor}` }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 6 }}>
                      {isAdmin ? grp.label : `My ${grp.label}`}
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{count.toLocaleString()}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 10, fontWeight: 500 }}>{pct}% of {isAdmin ? 'all' : 'my'} leads</div>
                    <div style={{ height: 4, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 99, transition: 'width 0.6s ease', boxShadow: `0 0 8px ${barColor}` }} />
                    </div>
                  </div>
                )
              })}
            </div>

            {isAdmin ? (
              /* ── TABLE 1: ADMIN - Member × Grade Matrix ── */
              <div className="glass-card" style={{ marginBottom: 22, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)' }}>
                      <BarChart2 size={16} style={{ color: 'var(--accent-blue)' }} />
                      Leads by Member &amp; Grade
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Lead distribution across members and grade levels</div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-hover)', padding: '4px 10px', borderRadius: 6 }}>
                    {members.length} members · {totalFiltered.toLocaleString()} leads
                  </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ tableLayout: 'fixed' }}>
                    <thead>
                      <tr>
                        <th style={{ width: 150, textAlign: 'left' }}>Member</th>
                        {GRADES.map((g) => (
                          <th key={g} style={{ textAlign: 'center' }}>Grade {g}</th>
                        ))}
                        <th style={{ textAlign: 'center', fontWeight: 700 }}>Total Leads</th>
                        <th style={{ textAlign: 'center', fontWeight: 700 }}>Share %</th>
                        <th style={{ textAlign: 'right' }}>Conversion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m) => {
                        const row = memberGradeMatrix[m.name] || {}
                        const share = totalFiltered > 0 ? ((m.total / totalFiltered) * 100).toFixed(1) : '0.0'
                        const memberLeads = filtered.filter(l => (l.assigned_member || 'Unassigned') === m.name)
                        const memberConverted = memberLeads.filter(l => l.status === 'Converted').length
                        const mConvRate = m.total > 0 ? ((memberConverted / m.total) * 100).toFixed(1) : '0.0'

                        return (
                          <tr key={m.name}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{
                                  width: 26, height: 26, borderRadius: '50%',
                                  background: 'rgba(59,130,246,0.12)', color: 'var(--accent-blue)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 11, fontWeight: 700, flexShrink: 0
                                }}>{m.name[0]?.toUpperCase()}</div>
                                <span style={{ fontWeight: 500, fontSize: 13, color: 'var(--text-primary)' }}>{m.name}</span>
                              </div>
                            </td>
                            {GRADES.map((g) => {
                              const count = row[g] || 0
                              return (
                                <td key={g} style={{ textAlign: 'center', fontSize: 13 }}>
                                  {count > 0 ? (
                                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                                      {count.toLocaleString()}
                                    </span>
                                  ) : <span style={{ color: 'var(--text-muted)', opacity: 0.3 }}>—</span>}
                                </td>
                              )
                            })}
                            <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>
                              {m.total.toLocaleString()}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{share}%</span>
                                <div style={{ width: 60, height: 3, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                                  <div style={{ width: `${share}%`, height: '100%', background: 'var(--accent-blue)', borderRadius: 99 }} />
                                </div>
                              </div>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <span style={{
                                fontSize: 11, fontWeight: 600,
                                color: parseFloat(mConvRate) > 0 ? 'var(--accent-blue)' : 'var(--text-muted)',
                                background: parseFloat(mConvRate) > 0 ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.04)',
                                padding: '2px 8px', borderRadius: 4,
                              }}>{mConvRate}%</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ fontWeight: 800, borderTop: '2px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                        <td style={{ fontWeight: 700, fontSize: 12, letterSpacing: '0.05em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>TOTAL</td>
                        {GRADES.map((g) => (
                          <td key={g} style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {(gradeTotals[g] || 0).toLocaleString()}
                          </td>
                        ))}
                        <td style={{ textAlign: 'center', fontWeight: 900, color: 'var(--text-primary)', fontSize: 15 }}>
                          {totalFiltered.toLocaleString()}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-secondary)' }}>100.0%</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent-blue)' }}>{conversionRate}%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ) : (
              /* ── TABLE 1: NON-ADMIN STAFF - My Grade-Wise Pipeline & Quick Actions ── */
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 22 }}>
                {/* My Grade-Wise Lead Breakdown */}
                <div className="glass-card" style={{ overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)' }}>
                      <Target size={16} style={{ color: 'var(--accent-blue)' }} />
                      My Pipeline by Grade
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-hover)', padding: '4px 10px', borderRadius: 6 }}>
                      {myLeads.length} leads assigned
                    </div>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Grade</th>
                          <th style={{ textAlign: 'center' }}>Total Leads</th>
                          <th style={{ textAlign: 'center' }}>Converted</th>
                          <th style={{ textAlign: 'center' }}>Paid</th>
                          <th style={{ textAlign: 'right' }}>Conversion Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {GRADES.map(g => {
                          const item = myGradeBreakdown[g] || { total: 0, converted: 0, paid: 0 }
                          const rate = item.total > 0 ? ((item.converted / item.total) * 100).toFixed(1) : '0.0'
                          return (
                            <tr key={g}>
                              <td style={{ fontWeight: 600 }}>Grade {g}</td>
                              <td style={{ textAlign: 'center', fontWeight: 700 }}>{item.total}</td>
                              <td style={{ textAlign: 'center', color: '#16a34a', fontWeight: 600 }}>{item.converted}</td>
                              <td style={{ textAlign: 'center', color: '#0d9488', fontWeight: 600 }}>{item.paid}</td>
                              <td style={{ textAlign: 'right' }}>
                                <span style={{
                                  fontSize: 11, fontWeight: 700,
                                  color: parseFloat(rate) > 0 ? 'var(--accent-blue)' : 'var(--text-muted)',
                                  background: parseFloat(rate) > 0 ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.04)',
                                  padding: '2px 8px', borderRadius: 4,
                                }}>{rate}%</span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{ fontWeight: 800, borderTop: '2px solid var(--border)' }}>
                          <td>TOTAL</td>
                          <td style={{ textAlign: 'center' }}>{myLeads.length}</td>
                          <td style={{ textAlign: 'center', color: '#16a34a' }}>{myConvertedLeads.length}</td>
                          <td style={{ textAlign: 'center', color: '#0d9488' }}>{myPaidLeads.length}</td>
                          <td style={{ textAlign: 'right', color: 'var(--accent-blue)' }}>{myConversionRate}%</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Quick Action Navigation Card for Agents */}
                <div className="glass-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Activity size={18} style={{ color: 'var(--accent-blue)' }} /> Quick Work Queue
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 16 }}>
                      Jump directly to your active leads, start dialing, and update records seamlessly in real-time.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <Link
                        href="/leads"
                        className="btn-primary"
                        style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textDecoration: 'none', borderRadius: 12 }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700 }}>
                          <Phone size={16} /> Open Leads CRM Sheet
                        </span>
                        <ArrowRight size={16} />
                      </Link>

                      {userSubRole === 'payments' && (
                        <Link
                          href="/payments/add"
                          className="btn-secondary"
                          style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textDecoration: 'none', borderRadius: 12 }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700 }}>
                            <CreditCard size={16} /> Record Student Payment
                          </span>
                          <ArrowRight size={16} />
                        </Link>
                      )}
                    </div>
                  </div>

                  <div style={{ marginTop: 20, padding: 12, background: 'var(--bg-hover)', borderRadius: 10, fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Sparkles size={14} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
                    <span><b>Pro-Tip:</b> Use the bottom floating dock to quickly jump between Leads and Dashboard anytime.</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: DAY-BY-DAY MEMBER LEAD TRACKING                                    */}
        {/* ========================================================================= */}
        {activeTab === 'daily_member_tracking' && (
          <div className="fade-in">
            {/* Filter Bar */}
            <div className="glass-card" style={{ padding: 18, marginBottom: 20, display: 'flex', gap: 14, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Select Day</label>
                  <input
                    type="date"
                    className="input-field"
                    style={{ width: 170 }}
                    value={selectedDay}
                    onChange={e => setSelectedDay(e.target.value)}
                  />
                </div>
                <div style={{ paddingTop: 18, fontSize: 13, color: 'var(--text-secondary)' }}>
                  Total leads added on <b>{selectedDay}</b>: <b style={{ color: 'var(--accent-blue)' }}>{dayLeads.length} leads</b>
                </div>
              </div>

              <div>
                <button
                  onClick={() => {
                    const headers = ['MEMBER', ...GRADES.map(g => `GRADE ${g}`), 'TOTAL LEADS', 'DATE']
                    const rows = dayMembers.map(m => {
                      const r = dayMemberGradeMatrix[m.name] || {}
                      return [
                        `"${m.name}"`,
                        ...GRADES.map(g => `"${r[g] || 0}"`),
                        `"${m.total}"`,
                        `"${selectedDay}"`
                      ]
                    })
                    exportCsv(`Daily_Member_Leads_${selectedDay}`, headers, rows)
                  }}
                  className="btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <FileSpreadsheet size={16} /> Export CSV
                </button>
              </div>
            </div>

            {/* Daily Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
              <div className="stat-card" style={{ padding: '12px 14px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Day Leads</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{dayLeads.length}</div>
              </div>
              {GRADES.map((g) => (
                <div key={g} className="stat-card" style={{ padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Grade {g}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: (dayGradeTotals[g] || 0) > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    {dayGradeTotals[g] || 0}
                  </div>
                </div>
              ))}
            </div>

            {/* Day Member Matrix Table */}
            <div className="glass-card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Calendar size={16} style={{ color: 'var(--accent-blue)' }} />
                  Member Lead Distribution for {selectedDay} ({dayMembers.length} Active Members)
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ tableLayout: 'fixed' }}>
                  <thead>
                    <tr>
                      <th style={{ width: 160, textAlign: 'left' }}>Member Name</th>
                      {GRADES.map((g) => (
                        <th key={g} style={{ textAlign: 'center' }}>Grade {g}</th>
                      ))}
                      <th style={{ textAlign: 'center', fontWeight: 700 }}>Total Leads</th>
                      <th style={{ textAlign: 'right', fontWeight: 700 }}>Daily Share %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayMembers.map((m) => {
                      const row = dayMemberGradeMatrix[m.name] || {}
                      const share = dayLeads.length > 0 ? ((m.total / dayLeads.length) * 100).toFixed(1) : '0.0'

                      return (
                        <tr key={m.name}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{
                                width: 26, height: 26, borderRadius: '50%',
                                background: 'rgba(59,130,246,0.12)', color: 'var(--accent-blue)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 11, fontWeight: 700, flexShrink: 0
                              }}>{m.name[0]?.toUpperCase()}</div>
                              <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{m.name}</span>
                            </div>
                          </td>
                          {GRADES.map((g) => {
                            const count = row[g] || 0
                            return (
                              <td key={g} style={{ textAlign: 'center', fontSize: 13 }}>
                                {count > 0 ? (
                                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                                    {count}
                                  </span>
                                ) : <span style={{ color: 'var(--text-muted)', opacity: 0.3 }}>—</span>}
                              </td>
                            )
                          })}
                          <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>
                            {m.total}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)' }}>
                            {share}%
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 800, borderTop: '2px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                      <td style={{ fontWeight: 700, fontSize: 12, letterSpacing: '0.05em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>TOTAL DAY LEADS</td>
                      {GRADES.map((g) => (
                        <td key={g} style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {(dayGradeTotals[g] || 0).toLocaleString()}
                        </td>
                      ))}
                      <td style={{ textAlign: 'center', fontWeight: 900, color: 'var(--text-primary)', fontSize: 15 }}>
                        {dayLeads.length.toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-secondary)' }}>100.0%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {dayMembers.length === 0 && (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No leads recorded on {selectedDay}. Select a different date above.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: MASTER LEAD PAID TICK REPORT & MEMBER COMMISSIONS                  */}
        {/* ========================================================================= */}
        {activeTab === 'master_paid_report' && (
          <div className="fade-in">
            {/* Success Message Banner */}
            {settlementSuccess && (
              <div style={{
                padding: '12px 18px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)',
                borderRadius: 10, color: '#059669', fontSize: 13, fontWeight: 700, marginBottom: 16,
                display: 'flex', alignItems: 'center', gap: 10
              }}>
                <CheckCircle2 size={18} /> {settlementSuccess}
              </div>
            )}

            {/* Header / Filter / Settle / Export Bar */}
            <div className="glass-card" style={{ padding: 18, marginBottom: 16, display: 'flex', gap: 14, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: 'rgba(56, 189, 248, 0.12)', color: 'var(--accent-blue)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <DollarSign size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>Master Lead Paid &amp; Commission Ledger</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Live commission calculation, grade-based payout rates &amp; settlement lifecycle</div>
                  </div>
                </div>

                {/* Filter Toggle: Current Active Period vs All Paid Leads */}
                <div style={{
                  display: 'flex', background: 'var(--bg-base, #f1f5f9)', padding: 3, borderRadius: 8,
                  border: '1px solid var(--border)'
                }}>
                  <button
                    type="button"
                    onClick={() => setCommissionViewFilter('current_active')}
                    style={{
                      border: 'none',
                      background: commissionViewFilter === 'current_active' ? 'var(--bg-card, #ffffff)' : 'transparent',
                      color: commissionViewFilter === 'current_active' ? 'var(--accent-blue)' : 'var(--text-muted)',
                      fontWeight: 700, fontSize: 11.5, padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
                      boxShadow: commissionViewFilter === 'current_active' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none'
                    }}
                  >
                    Active Unsettled Period
                  </button>
                  <button
                    type="button"
                    onClick={() => setCommissionViewFilter('all_paid')}
                    style={{
                      border: 'none',
                      background: commissionViewFilter === 'all_paid' ? 'var(--bg-card, #ffffff)' : 'transparent',
                      color: commissionViewFilter === 'all_paid' ? 'var(--accent-blue)' : 'var(--text-muted)',
                      fontWeight: 700, fontSize: 11.5, padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
                      boxShadow: commissionViewFilter === 'all_paid' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none'
                    }}
                  >
                    All-Time Paid Leads
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                {userRole === 'admin' && (
                  <button
                    onClick={() => {
                      setSettleTargetMember(null)
                      setSettlingModalOpen(true)
                      setAdminPasswordForSettle('')
                      setSettleError('')
                    }}
                    disabled={totalPaidConversions === 0 || commissionViewFilter !== 'current_active'}
                    className="btn-primary"
                    style={{
                      background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 16px', fontWeight: 700, fontSize: 12.5,
                      boxShadow: '0 2px 8px rgba(245,158,11,0.2)',
                      border: '1px solid rgba(245,158,11,0.3)',
                      opacity: (totalPaidConversions === 0 || commissionViewFilter !== 'current_active') ? 0.5 : 1
                    }}
                    title="Clear current paid leads and settle commissions (resets calculation to 0 for next cycle)"
                  >
                    <CheckCircle size={15} /> Clear &amp; Settle Commissions
                  </button>
                )}

                <button
                  onClick={() => {
                    const headers = [
                      'MEMBER',
                      ...GRADES.map(g => `GRADE ${g} PAID`),
                      'TOTAL PAID SEATS',
                      'RATE G6-8 (Rs.)',
                      'RATE G9 (Rs.)',
                      'RATE G10-11 (Rs.)',
                      'TOTAL COMMISSION (Rs.)',
                      'SHARE %'
                    ]
                    const rows = paidMembersList.map(m => {
                      const r = paidMemberGradeMatrix[m.name] || {}
                      const share = totalPaidClassesCount > 0 ? ((m.totalPaidClasses / totalPaidClassesCount) * 100).toFixed(1) : '0.0'
                      return [
                        `"${m.name}"`,
                        ...GRADES.map(g => `"${r[g] || 0}"`),
                        `"${m.totalPaidClasses}"`,
                        `"${rateG6_8}"`,
                        `"${rateG9}"`,
                        `"${rateG10_11}"`,
                        `"${m.commissionAmount}"`,
                        `"${share}%"`
                      ]
                    })
                    exportCsv(`Master_Lead_Paid_Commissions_${commissionViewFilter}`, headers, rows)
                  }}
                  className="btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 12.5 }}
                >
                  <FileSpreadsheet size={15} /> Export CSV
                </button>
              </div>
            </div>

            {/* Dynamic Commission Rate Configurator Bar */}
            <div className="glass-card" style={{ padding: '12px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Commission Rate Rules:
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  (Adjust rates live to re-compute commission balances)
                </span>
              </div>

              <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Grade 6 – 8:</label>
                  <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 3 }}>Rs.</span>
                    <input
                      type="number"
                      min="0"
                      value={rateG6_8}
                      onChange={e => setRateG6_8(Number(e.target.value) || 0)}
                      disabled={userRole !== 'admin'}
                      style={{ width: 50, border: 'none', background: 'transparent', fontWeight: 800, fontSize: 12.5, color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Grade 9:</label>
                  <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 3 }}>Rs.</span>
                    <input
                      type="number"
                      min="0"
                      value={rateG9}
                      onChange={e => setRateG9(Number(e.target.value) || 0)}
                      disabled={userRole !== 'admin'}
                      style={{ width: 50, border: 'none', background: 'transparent', fontWeight: 800, fontSize: 12.5, color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Grade 10 – 11:</label>
                  <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 3 }}>Rs.</span>
                    <input
                      type="number"
                      min="0"
                      value={rateG10_11}
                      onChange={e => setRateG10_11(Number(e.target.value) || 0)}
                      disabled={userRole !== 'admin'}
                      style={{ width: 50, border: 'none', background: 'transparent', fontWeight: 800, fontSize: 12.5, color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Paid Conversions & Total Commission KPI Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
              <div className="stat-card" style={{ padding: '12px 14px', borderTop: '2px solid var(--accent-blue)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Paid Leads</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{totalPaidConversions}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{commissionViewFilter === 'current_active' ? 'Active Cycle' : 'All-Time'}</div>
              </div>

              <div className="stat-card" style={{ padding: '12px 14px', borderTop: '2px solid #10b981' }}>
                <div style={{ fontSize: 11, color: '#059669', textTransform: 'uppercase', fontWeight: 700 }}>Total Commission</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#059669' }}>Rs. {totalCommissionAmount.toLocaleString()}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{paidMembersList.length} members eligible</div>
              </div>

              {GRADES.map((g) => (
                <div key={g} className="stat-card" style={{ padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Gr {g} Paid</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: (paidGradeTotals[g] || 0) > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    {paidGradeTotals[g] || 0}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    @ Rs. {['6','7','8'].includes(g) ? rateG6_8 : g === '9' ? rateG9 : rateG10_11}
                  </div>
                </div>
              ))}
            </div>

            {/* Paid Members × Grade Matrix Table with Commission Column */}
            <div className="glass-card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Trophy size={16} style={{ color: '#f59e0b' }} />
                  Member Conversion &amp; Payout Leaderboard
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Total {totalPaidClassesCount} paid class seats converted &bull; Rs. {totalCommissionAmount.toLocaleString()} payable
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ tableLayout: 'fixed' }}>
                  <thead>
                    <tr>
                      <th style={{ width: 150, textAlign: 'left' }}>Member Name</th>
                      {GRADES.map((g) => (
                        <th key={g} style={{ textAlign: 'center' }}>Gr {g}</th>
                      ))}
                      <th style={{ textAlign: 'center', fontWeight: 700 }}>Total Paid Seats</th>
                      <th style={{ textAlign: 'right', fontWeight: 800, color: '#059669', width: 140 }}>Commission (Rs.)</th>
                      <th style={{ textAlign: 'right', fontWeight: 700, width: 80 }}>Share %</th>
                      {userRole === 'admin' && (
                        <th style={{ textAlign: 'center', width: 110 }}>Action</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {paidMembersList.map((m) => {
                      const row = paidMemberGradeMatrix[m.name] || {}
                      const share = totalPaidClassesCount > 0 ? ((m.totalPaidClasses / totalPaidClassesCount) * 100).toFixed(1) : '0.0'

                      return (
                        <tr key={m.name}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{
                                width: 26, height: 26, borderRadius: '50%',
                                background: 'rgba(59,130,246,0.12)', color: 'var(--accent-blue)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 11, fontWeight: 700, flexShrink: 0
                              }}>{m.name[0]?.toUpperCase()}</div>
                              <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{m.name}</span>
                            </div>
                          </td>
                          {GRADES.map((g) => {
                            const count = row[g] || 0
                            return (
                              <td key={g} style={{ textAlign: 'center', fontSize: 13 }}>
                                {count > 0 ? (
                                  <span style={{ color: 'var(--text-primary)', fontWeight: 600, background: 'rgba(59,130,246,0.08)', padding: '2px 8px', borderRadius: 4 }}>
                                    ✓ {count}
                                  </span>
                                ) : <span style={{ color: 'var(--text-muted)', opacity: 0.3 }}>—</span>}
                              </td>
                            )
                          })}
                          <td style={{ textAlign: 'center', fontWeight: 800, color: 'var(--text-primary)', fontSize: 15 }}>
                            {m.totalPaidClasses}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 14, color: '#059669' }}>
                            Rs. {m.commissionAmount.toLocaleString()}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)' }}>
                            {share}%
                          </td>
                          {userRole === 'admin' && (
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setSettleTargetMember(m.name)
                                  setSettlingModalOpen(true)
                                  setAdminPasswordForSettle('')
                                  setSettleError('')
                                }}
                                disabled={commissionViewFilter !== 'current_active' || m.commissionAmount === 0}
                                style={{
                                  background: 'rgba(217, 119, 6, 0.12)',
                                  border: '1px solid rgba(217, 119, 6, 0.35)',
                                  color: '#f59e0b',
                                  padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                                  cursor: (commissionViewFilter !== 'current_active' || m.commissionAmount === 0) ? 'not-allowed' : 'pointer',
                                  display: 'inline-flex', alignItems: 'center', gap: 4,
                                  opacity: (commissionViewFilter !== 'current_active' || m.commissionAmount === 0) ? 0.4 : 1,
                                  transition: 'all 0.15s'
                                }}
                                title={`Clear and settle commissions only for ${m.name}`}
                              >
                                <span>Clear</span>
                              </button>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 800, borderTop: '2px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                      <td style={{ fontWeight: 700, fontSize: 12, letterSpacing: '0.05em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>TOTALS</td>
                      {GRADES.map((g) => (
                        <td key={g} style={{ textAlign: 'center', fontWeight: 800, color: 'var(--text-primary)' }}>
                          {(paidGradeTotals[g] || 0).toLocaleString()}
                        </td>
                      ))}
                      <td style={{ textAlign: 'center', fontWeight: 900, color: 'var(--text-primary)', fontSize: 16 }}>
                        {totalPaidClassesCount.toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 900, color: '#059669', fontSize: 16 }}>
                        Rs. {totalCommissionAmount.toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-secondary)' }}>100.0%</td>
                      {userRole === 'admin' && <td />}
                    </tr>
                  </tfoot>
                </table>
              </div>

              {paidMembersList.length === 0 && (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
                  {commissionViewFilter === 'current_active'
                    ? 'All past commissions have been cleared! No unsettled paid leads in current cycle.'
                    : 'No leads with Paid ticks found in database.'}
                </div>
              )}
            </div>

            {/* Settle Commissions Confirmation Modal (Dark Glassmorphism) */}
            {settlingModalOpen && (() => {
              const targetMembers = settleTargetMember
                ? paidMembersList.filter(m => m.name.toLowerCase() === settleTargetMember.toLowerCase())
                : paidMembersList
              const targetAmount = targetMembers.reduce((sum, m) => sum + m.commissionAmount, 0)
              const targetClasses = targetMembers.reduce((sum, m) => sum + m.totalPaidClasses, 0)
              const targetLeadsCount = paidLeads.filter(l => {
                if (!settleTargetMember) return true
                return (l.assigned_member || 'Unassigned').trim().toLowerCase() === settleTargetMember.trim().toLowerCase()
              }).length

              return (
                <div style={{
                  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16
                }}>
                  <div className="glass-card" style={{
                    maxWidth: 480, width: '100%', padding: 24, borderRadius: 16,
                    background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <DollarSign size={22} />
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text-primary)' }}>
                          {settleTargetMember ? `Clear Commission — ${settleTargetMember}` : 'Clear & Settle All Commissions'}
                        </h3>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {settleTargetMember ? `Individual settlement for ${settleTargetMember}` : 'Batch settlement for all eligible team members'}
                        </div>
                      </div>
                    </div>

                    <div style={{
                      padding: 14, background: 'var(--bg-card-hover)', borderRadius: 10,
                      border: '1px solid var(--border)', marginBottom: 16, fontSize: 13, lineHeight: 1.6
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ color: 'var(--text-muted)' }}>Target:</span>
                        <b style={{ color: settleTargetMember ? 'var(--accent-blue)' : '#f59e0b' }}>
                          {settleTargetMember ? `Single Member (${settleTargetMember})` : `All Team Members (${targetMembers.length})`}
                        </b>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ color: 'var(--text-muted)' }}>Total Payable:</span>
                        <span style={{ color: '#34d399', fontWeight: 900, fontSize: 15 }}>Rs. {targetAmount.toLocaleString()}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ color: 'var(--text-muted)' }}>Paid Leads / Seats:</span>
                        <span style={{ fontWeight: 700 }}>{targetLeadsCount} leads ({targetClasses} class seats)</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                        ⚠️ <b>Admin Password Required:</b> Marking these leads as settled will reset {settleTargetMember ? `${settleTargetMember}'s` : 'the active'} commission balance back to <b>Rs. 0</b>. The settlement record will be archived in Member profiles.
                      </div>
                    </div>

                    {settleError && (
                      <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.35)', borderRadius: 8, color: '#f87171', fontSize: 12, marginBottom: 14 }}>
                        ⚠️ {settleError}
                      </div>
                    )}

                    <form onSubmit={executeCommissionSettlement}>
                      <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                          Enter Admin Password to Authorize *
                        </label>
                        <input
                          type="password"
                          className="input-field"
                          placeholder="Admin password (admin@mathsps.com)"
                          required
                          autoFocus
                          value={adminPasswordForSettle}
                          onChange={e => setAdminPasswordForSettle(e.target.value)}
                          style={{ height: 38 }}
                        />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            setSettlingModalOpen(false)
                            setSettleTargetMember(null)
                          }}
                          disabled={settlingLoading}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="btn-primary"
                          disabled={settlingLoading}
                          style={{ background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)', border: 'none', color: '#ffffff' }}
                        >
                          {settlingLoading ? 'Settling...' : `✓ Confirm & Clear ${settleTargetMember ? settleTargetMember : 'All'}`}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )
            })()}
          </div>
        )}

      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────

function KpiCard({ icon, iconBg, iconColor, borderColor, label, value, sub }: {
  icon: React.ReactNode
  iconBg?: string
  iconColor?: string
  borderColor?: string
  label: string
  value: string
  sub?: string
}) {
  const accent = borderColor || 'var(--accent-blue)'
  return (
    <div
      className="stat-card"
      style={{
        borderTop: `2px solid ${accent}`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        minHeight: 110,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{
          fontSize: 11.5,
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          fontWeight: 700,
          letterSpacing: '0.06em'
        }}>
          {label}
        </div>
        <div style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: iconBg ? `color-mix(in srgb, ${accent} 12%, transparent)` : 'var(--bg-base)',
          border: `1px solid color-mix(in srgb, ${accent} 25%, var(--border))`,
          color: iconColor || accent,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          {icon}
        </div>
      </div>

      <div>
        <div style={{
          fontSize: 26,
          fontWeight: 800,
          color: 'var(--text-primary)',
          lineHeight: 1.15,
          letterSpacing: '-0.025em'
        }}>
          {value}
        </div>
        {sub && (
          <div style={{
            fontSize: 11.5,
            fontWeight: 600,
            color: 'var(--accent-green)',
            marginTop: 6,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4
          }}>
            <span>↑</span> {sub}
          </div>
        )}
      </div>
    </div>
  )
}
