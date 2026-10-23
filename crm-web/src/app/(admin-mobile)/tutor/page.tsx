'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  TrendingUp,
  Users,
  CreditCard,
  PhoneCall,
  Bell,
  Download,
  Share2,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
  LogOut,
  Calendar,
  Layers,
  ArrowUpRight,
  Eye,
  X,
  FileText,
  Phone,
  BarChart3,
  SlidersHorizontal,
  ChevronDown,
  LayoutDashboard
} from 'lucide-react'

interface TutorData {
  generatedAt: string
  dateStr: string
  fromStr: string
  toStr: string
  monthName: string
  year: number
  metrics: {
    todayIncome: number
    todayTransactionsCount: number
    monthIncome: number
    monthlyTarget: number
    targetProgress: number
    totalStudents: number
    paidStudentsCount: number
    paidRatio: number
    projectedMonthEndRevenue: number
    atRiskUnpaidStudents: number
  }
  staffRoster: Array<{
    id: string
    name: string
    role: string
    callsToday: number
    convertedToday: number
    paymentsVerifiedToday: number
    revenueCollectedToday: number
  }>
  periodPaymentsSummary?: {
    totalAmount: number
    count: number
    byStaff: Record<string, { count: number; total: number }>
  }
}

export default function TutorMobilePage() {
  const supabase = createClient()
  const [data, setData] = useState<TutorData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  // Navigation tabs: bottom bar driven
  const [activeTab, setActiveTab] = useState<'overview' | 'staff' | 'reports'>('overview')
  const [pushStatus, setPushStatus] = useState<'prompt' | 'granted' | 'denied'>('prompt')
  const [actionNotice, setActionNotice] = useState('')

  // Date Filtering State
  const [datePreset, setDatePreset] = useState<'today' | 'yesterday' | 'month' | 'custom'>('today')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  // Report Modal Viewer State
  const [viewingReport, setViewingReport] = useState<{
    type: 'morning' | 'evening' | 'monthly' | 'custom'
    title: string
    dateLabel: string
    summaryText: string
  } | null>(null)

  // Real-time live online staff tracker
  const [onlineMembers, setOnlineMembers] = useState<Set<string>>(new Set())

  // Calculate dates based on preset
  function getQueryDates(preset: string) {
    const now = new Date()
    const today = now.toISOString().slice(0, 10)

    if (preset === 'yesterday') {
      const y = new Date(now)
      y.setDate(y.getDate() - 1)
      const yStr = y.toISOString().slice(0, 10)
      return { from: yStr, to: yStr }
    } else if (preset === 'month') {
      const curMonth = now.getMonth() + 1
      const startOfMonth = `${now.getFullYear()}-${String(curMonth).padStart(2, '0')}-01`
      return { from: startOfMonth, to: today }
    } else if (preset === 'custom' && customFrom && customTo) {
      return { from: customFrom, to: customTo }
    }
    return { from: today, to: today }
  }

  async function fetchSummary(preset = datePreset) {
    try {
      setRefreshing(true)
      const { from, to } = getQueryDates(preset)
      const res = await fetch(`/api/reports/tutor-mobile?from=${from}&to=${to}`)
      if (res.ok) {
        const json = await res.json()
        setData(json.data)
      }
    } catch (e) {
      console.error('Error fetching tutor metrics:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchSummary()

    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPushStatus(Notification.permission as any)
    }

    // Real-time presence listener
    const presenceChannel = supabase.channel('online_hq_workers', {
      config: { presence: { key: 'tutor_iphone_viewer' } }
    })

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState()
        const activeUsers = new Set<string>()
        activeUsers.add('prabuddha')

        Object.values(state).forEach((presences: any) => {
          presences.forEach((p: any) => {
            if (p.name) activeUsers.add(String(p.name).toLowerCase().trim())
            if (p.email) {
              const prefix = p.email.split('@')[0].toLowerCase().trim()
              activeUsers.add(prefix)
            }
          })
        })
        setOnlineMembers(activeUsers)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(presenceChannel)
    }
  }, [])

  // Push notification permission request & test trigger
  async function handleRequestPush() {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const permission = await Notification.requestPermission()
        setPushStatus(permission as any)
        if (permission === 'granted') {
          showActionNotice('✓ Push Notifications Activated! Sending test alert...')
          sendTestNotification()
        }
      } catch (err) {
        alert('Could not enable notifications: ' + err)
      }
    } else {
      alert('Push notifications require iOS 16.4+ on iPhone. Add this page to Home Screen first!')
    }
  }

  function sendTestNotification() {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('🔔 MathsPS Executive Live Alert', {
          body: `Today's Collection: Rs. ${(data?.metrics.todayIncome || 0).toLocaleString()} · ${data?.staffRoster.length || 0} Staff Active`,
          icon: '/brand-logo.jpg'
        })
        showActionNotice('✓ Test notification delivered to your iPhone!')
      } catch (e) {
        // Fallback for Service Worker notification if standalone
        if (navigator.serviceWorker && navigator.serviceWorker.ready) {
          navigator.serviceWorker.ready.then(reg => {
            reg.showNotification('🔔 MathsPS Executive Live Alert', {
              body: `Today's Collection: Rs. ${(data?.metrics.todayIncome || 0).toLocaleString()}`,
              icon: '/brand-logo.jpg'
            })
            showActionNotice('✓ Test notification delivered!')
          })
        }
      }
    }
  }

  function showActionNotice(msg: string) {
    setActionNotice(msg)
    setTimeout(() => setActionNotice(''), 4500)
  }

  function buildReportText(type: 'morning' | 'evening' | 'monthly') {
    if (!data) return ''
    const now = new Date()
    const dateFormatted = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

    if (type === 'morning') {
      return `☀️ *MathsPS Morning Executive Briefing*\n📅 ${dateFormatted}\n\n` +
        `• Total Enrolled Students: ${data.metrics.totalStudents}\n` +
        `• Fees Paid so far: ${data.metrics.paidStudentsCount} (${data.metrics.paidRatio}%)\n` +
        `• Month Target: Rs. ${data.metrics.monthIncome.toLocaleString()} / Rs. ${data.metrics.monthlyTarget.toLocaleString()} (${data.metrics.targetProgress}%)\n` +
        `• Projected Month End: Rs. ${data.metrics.projectedMonthEndRevenue.toLocaleString()}\n\n` +
        `_Generated via MathsPS Executive Hub_`
    } else if (type === 'evening') {
      return `🌙 *MathsPS Day-End Executive Summary*\n📅 ${dateFormatted}\n\n` +
        `💰 *Today's Collection: Rs. ${data.metrics.todayIncome.toLocaleString()}* (${data.metrics.todayTransactionsCount} transactions)\n` +
        `📊 MTD Revenue: Rs. ${data.metrics.monthIncome.toLocaleString()} (${data.metrics.targetProgress}% Target)\n\n` +
        `👥 *Staff Activity Audit:*\n` +
        data.staffRoster.map(s => `• ${s.name}: ${s.callsToday} Calls, ${s.paymentsVerifiedToday} Payments (Rs. ${s.revenueCollectedToday.toLocaleString()})`).join('\n') +
        `\n\n_Generated via MathsPS Executive Hub_`
    } else {
      return `📊 *MathsPS Mid-Month Financial Audit*\nMonth: ${data.monthName} ${data.year}\n\n` +
        `• Total Revenue Collected: Rs. ${data.metrics.monthIncome.toLocaleString()}\n` +
        `• Paid Student Ratio: ${data.metrics.paidRatio}%\n` +
        `• Unpaid / At-Risk Followups: ${data.metrics.atRiskUnpaidStudents} Students\n\n` +
        `_Generated via MathsPS Executive Hub_`
    }
  }

  function handleOpenReportModal(type: 'morning' | 'evening' | 'monthly') {
    const titles = {
      morning: '☀️ Morning Executive Briefing',
      evening: '🌙 Day-End Audit & Performance Ledger',
      monthly: '📊 Mid-Month Financial Audit'
    }
    const summary = buildReportText(type)
    setViewingReport({
      type,
      title: titles[type],
      dateLabel: data?.dateStr || '',
      summaryText: summary
    })
  }

  async function handleShareText(text: string, title: string) {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text })
      } catch (e) {
        await navigator.clipboard.writeText(text)
        showActionNotice('✓ Report copied to clipboard for WhatsApp!')
      }
    } else {
      await navigator.clipboard.writeText(text)
      showActionNotice('✓ Report copied to clipboard for WhatsApp!')
    }
  }

  function downloadStaffAuditCsv() {
    if (!data) return
    const headers = ['Staff Member', 'Role', 'Calls Taken', 'Leads Converted', 'Payments Verified', 'Revenue Collected (Rs)']
    const rows = data.staffRoster.map(s => [
      `"${s.name}"`,
      `"${s.role}"`,
      s.callsToday,
      s.convertedToday,
      s.paymentsVerifiedToday,
      s.revenueCollectedToday
    ])
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `MathsPS_Staff_Work_Audit_${data.dateStr}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const m = data?.metrics

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f8fafc',
        color: '#0f172a',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
        paddingBottom: 110,
        WebkitFontSmoothing: 'antialiased',
        userSelect: 'none'
      }}
    >
      {/* ── TOP EXECUTIVE APP HEADER (Enterprise Clean Light) ── */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'rgba(255, 255, 255, 0.94)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid #e2e8f0',
          padding: '14px 18px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 10px rgba(15, 23, 42, 0.03)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{ position: 'relative' }}>
            <img
              src="/brand-logo.jpg"
              alt="MathsPS"
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                objectFit: 'cover',
                border: '2px solid #e0f2fe',
                boxShadow: '0 2px 8px rgba(2, 132, 199, 0.15)'
              }}
            />
            <span
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: '#10b981',
                border: '2px solid #ffffff'
              }}
            />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: '-0.3px', color: '#0f172a' }}>
              MathsPS <span style={{ color: '#0284c7' }}>Executive</span>
            </div>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
              Prabuddha Sampath · Tutor View
            </div>
          </div>
        </div>

        {/* Top Action Buttons: Refresh, Alerts & Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => fetchSummary()}
            disabled={refreshing}
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 20,
              padding: '6px 10px',
              color: '#334155',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11.5,
              fontWeight: 700,
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin text-blue-600' : ''} />
            Sync
          </button>

          {/* Test / Enable Alerts Button */}
          <button
            onClick={pushStatus === 'granted' ? sendTestNotification : handleRequestPush}
            style={{
              background: pushStatus === 'granted' ? '#f0fdf4' : 'linear-gradient(135deg, #0284c7, #0ea5e9)',
              border: pushStatus === 'granted' ? '1px solid #bbf7d0' : 'none',
              borderRadius: 20,
              padding: '6px 11px',
              color: pushStatus === 'granted' ? '#166534' : '#ffffff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11.5,
              fontWeight: 700,
              boxShadow: pushStatus === 'granted' ? 'none' : '0 2px 8px rgba(14, 165, 233, 0.3)'
            }}
          >
            <Bell size={12} />
            {pushStatus === 'granted' ? 'Test Alert' : 'Alerts'}
          </button>

          {/* Quick Sign Out */}
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              window.location.href = '/login'
            }}
            title="Log Out"
            style={{
              background: '#fee2e2',
              border: '1px solid #fecaca',
              borderRadius: 20,
              padding: '6px 9px',
              color: '#dc2626',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <LogOut size={12} />
          </button>
        </div>
      </header>

      {/* ── ACTION NOTIFICATION TOAST ── */}
      {actionNotice && (
        <div
          style={{
            margin: '12px 16px 0',
            padding: '10px 14px',
            borderRadius: 14,
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            fontSize: 12.5,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 2px 8px rgba(5, 150, 105, 0.08)'
          }}
        >
          <CheckCircle2 size={16} className="text-emerald-600" />
          <span>{actionNotice}</span>
        </div>
      )}

      {loading ? (
        <div style={{ padding: '80px 20px', textAlign: 'center', color: '#64748b' }}>
          <div
            style={{
              width: 36,
              height: 36,
              border: '3px solid #e0f2fe',
              borderTopColor: '#0284c7',
              borderRadius: '50%',
              margin: '0 auto 16px',
              animation: 'spin 0.8s linear infinite'
            }}
          />
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Syncing Executive Pulse…</div>
          <div style={{ fontSize: 12, marginTop: 4, color: '#64748b' }}>Analyzing live collections &amp; staff operations</div>
        </div>
      ) : data && (
        <div style={{ padding: '16px 16px 0' }}>
          
          {/* ──────────────── TAB 1: EXECUTIVE DASHBOARD ──────────────── */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* TODAY'S COLLECTION CARD (Light Blue Ambient Crown Jewel) */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)',
                  border: '1.5px solid #bae6fd',
                  borderRadius: 22,
                  padding: '22px 20px',
                  boxShadow: '0 8px 24px -4px rgba(2, 132, 199, 0.08)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#0284c7' }}>
                    TODAY&apos;S COLLECTION
                  </div>
                  <span
                    style={{
                      background: '#dcfce7',
                      color: '#15803d',
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: 12,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
                    LIVE SYNC
                  </span>
                </div>

                <div style={{ fontSize: 36, fontWeight: 900, color: '#0f172a', letterSpacing: '-1px', lineHeight: 1.1 }}>
                  Rs. {m?.todayIncome.toLocaleString()}
                </div>

                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginTop: 8 }}>
                  <strong>{m?.todayTransactionsCount}</strong> Student Payments Verified Today
                </div>
              </div>

              {/* MONTH-TO-DATE & TARGET PROGRESS */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 20,
                  padding: '18px',
                  boxShadow: '0 4px 16px -2px rgba(15, 23, 42, 0.04)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.04em' }}>
                      {data.monthName.toUpperCase()} REVENUE (MTD)
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', marginTop: 2 }}>
                      Rs. {m?.monthIncome.toLocaleString()}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700 }}>
                      Target: Rs. {(m?.monthlyTarget || 0).toLocaleString()}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: (m?.targetProgress || 0) >= 100 ? '#16a34a' : '#0284c7' }}>
                      {m?.targetProgress}%
                    </div>
                  </div>
                </div>

                {/* Progress Bar (Light Blue Highlight) */}
                <div style={{ height: 8, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden', marginTop: 8 }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(100, m?.targetProgress || 0)}%`,
                      background: (m?.targetProgress || 0) >= 100
                        ? 'linear-gradient(90deg, #10b981, #22c55e)'
                        : 'linear-gradient(90deg, #0284c7, #38bdf8)',
                      borderRadius: 99,
                      transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
                    }}
                  />
                </div>
              </div>

              {/* 2-COLUMN KPI TILES */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {/* Tile 1: Paid Ratio */}
                <div
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 18,
                    padding: '16px',
                    boxShadow: '0 4px 14px -2px rgba(15, 23, 42, 0.04)'
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>
                    PAID RATIO
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: '#16a34a', marginTop: 4 }}>
                    {m?.paidRatio}%
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginTop: 4 }}>
                    {m?.paidStudentsCount} of {m?.totalStudents} Paid
                  </div>
                </div>

                {/* Tile 2: Predictive Month-End Forecast */}
                <div
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 18,
                    padding: '16px',
                    boxShadow: '0 4px 14px -2px rgba(15, 23, 42, 0.04)'
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Sparkles size={11} className="text-amber-500" />
                    FORECAST
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', marginTop: 4 }}>
                    Rs. {(m?.projectedMonthEndRevenue || 0).toLocaleString()}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginTop: 4 }}>
                    Projected Month-End
                  </div>
                </div>
              </div>

              {/* UNPAID AT-RISK ALERT CARD */}
              {(m?.atRiskUnpaidStudents || 0) > 0 && (
                <div
                  style={{
                    background: '#fff1f2',
                    border: '1px solid #fecdd3',
                    borderRadius: 18,
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: '0 2px 8px rgba(225, 29, 72, 0.05)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <AlertTriangle size={20} className="text-rose-600 flex-shrink-0" />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#9f1239' }}>
                        {m?.atRiskUnpaidStudents} Unpaid Students
                      </div>
                      <div style={{ fontSize: 11.5, color: '#be123c', marginTop: 2 }}>
                        Action required for {data.monthName} fees
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleOpenReportModal('monthly')}
                    style={{
                      background: '#e11d48',
                      border: 'none',
                      borderRadius: 10,
                      padding: '6px 12px',
                      color: '#ffffff',
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    View
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ──────────────── TAB 2: STAFF WORK AUDIT PULSE ──────────────── */}
          {activeTab === 'staff' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
                    Live Workplace Activity
                  </div>
                  <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                    Active personnel calls, verified receipts &amp; collected totals
                  </div>
                </div>
                <button
                  onClick={downloadStaffAuditCsv}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 12,
                    padding: '6px 10px',
                    color: '#334155',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  <Download size={12} /> CSV
                </button>
              </div>

              {/* Staff Cards Grid */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data.staffRoster.map(s => {
                  const sNameLower = s.name.toLowerCase().trim()
                  const isOnline = onlineMembers.has(sNameLower) || sNameLower.includes('prabuddha')

                  return (
                    <div
                      key={s.id || s.name}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: 18,
                        padding: '14px 16px',
                        boxShadow: '0 2px 10px rgba(15, 23, 42, 0.03)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <span
                            style={{
                              width: 9,
                              height: 9,
                              borderRadius: '50%',
                              background: isOnline ? '#22c55e' : '#cbd5e1',
                              boxShadow: isOnline ? '0 0 8px rgba(34, 197, 94, 0.4)' : 'none'
                            }}
                          />
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
                              {s.name}
                            </div>
                            <div style={{ fontSize: 11, color: '#64748b', textTransform: 'capitalize' }}>
                              {s.role} {isOnline ? '· Online Now' : ''}
                            </div>
                          </div>
                        </div>

                        {/* Revenue Collected by Worker */}
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 13, fontWeight: 900, color: s.revenueCollectedToday > 0 ? '#0284c7' : '#64748b' }}>
                            Rs. {s.revenueCollectedToday.toLocaleString()}
                          </div>
                          <div style={{ fontSize: 10, color: '#94a3b8' }}>
                            Collected Today
                          </div>
                        </div>
                      </div>

                      {/* 2-Column Mini Stat Badges */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div
                          style={{
                            background: '#f8fafc',
                            border: '1px solid #f1f5f9',
                            borderRadius: 10,
                            padding: '6px 10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}
                        >
                          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>📞 Calls Taken</span>
                          <span style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>{s.callsToday}</span>
                        </div>

                        <div
                          style={{
                            background: '#f8fafc',
                            border: '1px solid #f1f5f9',
                            borderRadius: 10,
                            padding: '6px 10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}
                        >
                          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>💳 Payments</span>
                          <span style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>{s.paymentsVerifiedToday}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ──────────────── TAB 3: REPORTS & AUDIT VIEWER ──────────────── */}
          {activeTab === 'reports' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              
              {/* DATE RANGE FILTER BAR */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 18,
                  padding: '12px 14px',
                  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)'
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#64748b', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Calendar size={12} className="text-blue-600" />
                  REPORT DATE PERIOD
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
                  {[
                    { id: 'today', label: 'Today' },
                    { id: 'yesterday', label: 'Yesterday' },
                    { id: 'month', label: 'This Month' },
                    { id: 'custom', label: 'Custom' }
                  ].map(p => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setDatePreset(p.id as any)
                        if (p.id !== 'custom') fetchSummary(p.id as any)
                      }}
                      style={{
                        padding: '7px 0',
                        borderRadius: 10,
                        border: datePreset === p.id ? '1.5px solid #0284c7' : '1px solid #e2e8f0',
                        background: datePreset === p.id ? '#e0f2fe' : '#f8fafc',
                        color: datePreset === p.id ? '#0284c7' : '#475569',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Custom Date Pickers */}
                {datePreset === 'custom' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 6, marginTop: 10 }}>
                    <input
                      type="date"
                      value={customFrom}
                      onChange={e => setCustomFrom(e.target.value)}
                      style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 11 }}
                    />
                    <input
                      type="date"
                      value={customTo}
                      onChange={e => setCustomTo(e.target.value)}
                      style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 11 }}
                    />
                    <button
                      onClick={() => fetchSummary('custom')}
                      style={{
                        background: '#0284c7',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 8,
                        padding: '6px 12px',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Apply
                    </button>
                  </div>
                )}
              </div>

              {/* REPORT 1: MORNING BRIEFING */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 18,
                  padding: '16px',
                  boxShadow: '0 2px 10px rgba(15, 23, 42, 0.03)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
                    ☀️ Morning Executive Briefing
                  </div>
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>
                  Target progress, active registrations &amp; day projection
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button
                    onClick={() => handleOpenReportModal('morning')}
                    style={{
                      background: '#f0f9ff',
                      border: '1px solid #bae6fd',
                      borderRadius: 12,
                      padding: '9px 0',
                      color: '#0284c7',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 5
                    }}
                  >
                    <Eye size={13} /> View Report
                  </button>
                  <button
                    onClick={() => handleShareText(buildReportText('morning'), 'MathsPS Morning Report')}
                    style={{
                      background: 'linear-gradient(135deg, #0284c7, #0ea5e9)',
                      border: 'none',
                      borderRadius: 12,
                      padding: '9px 0',
                      color: '#ffffff',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 5
                    }}
                  >
                    <Share2 size={13} /> WhatsApp
                  </button>
                </div>
              </div>

              {/* REPORT 2: DAY-END AUDIT & LEDGER */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1.5px solid #bbf7d0',
                  borderRadius: 18,
                  padding: '16px',
                  boxShadow: '0 4px 14px -2px rgba(16, 185, 129, 0.08)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
                    🌙 Day-End Audit &amp; Performance
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 800, background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: 10 }}>
                    Rs. {m?.todayIncome.toLocaleString()}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>
                  Verified slips, student collections &amp; individual staff contributions
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button
                    onClick={() => handleOpenReportModal('evening')}
                    style={{
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: 12,
                      padding: '9px 0',
                      color: '#15803d',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 5
                    }}
                  >
                    <Eye size={13} /> View Ledger
                  </button>
                  <button
                    onClick={() => handleShareText(buildReportText('evening'), 'MathsPS Day-End Audit')}
                    style={{
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      border: 'none',
                      borderRadius: 12,
                      padding: '9px 0',
                      color: '#ffffff',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 5
                    }}
                  >
                    <Share2 size={13} /> WhatsApp
                  </button>
                </div>
              </div>

              {/* REPORT 3: MID-MONTH AUDIT */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 18,
                  padding: '16px',
                  boxShadow: '0 2px 10px rgba(15, 23, 42, 0.03)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
                    📊 Mid-Month Financial Audit
                  </div>
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>
                  Revenue to date, target gap &amp; unpaid students
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button
                    onClick={() => handleOpenReportModal('monthly')}
                    style={{
                      background: '#fffbeb',
                      border: '1px solid #fde68a',
                      borderRadius: 12,
                      padding: '9px 0',
                      color: '#b45309',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 5
                    }}
                  >
                    <Eye size={13} /> View Audit
                  </button>
                  <button
                    onClick={() => handleShareText(buildReportText('monthly'), 'MathsPS Monthly Audit')}
                    style={{
                      background: 'linear-gradient(135deg, #d97706, #f59e0b)',
                      border: 'none',
                      borderRadius: 12,
                      padding: '9px 0',
                      color: '#ffffff',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 5
                    }}
                  >
                    <Share2 size={13} /> WhatsApp
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ── INTERACTIVE IN-APP REPORT VIEWER MODAL ── */}
      {viewingReport && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center'
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 480,
              background: '#ffffff',
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              padding: '24px 20px 36px',
              boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.15)',
              maxHeight: '88vh',
              overflowY: 'auto'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a' }}>
                  {viewingReport.title}
                </div>
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  {viewingReport.dateLabel} · In-App Preview
                </div>
              </div>
              <button
                onClick={() => setViewingReport(null)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#475569'
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Formatted Report Content */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 16,
                padding: '16px',
                fontSize: 12.5,
                lineHeight: 1.6,
                color: '#1e293b',
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace',
                marginBottom: 18
              }}
            >
              {viewingReport.summaryText}
            </div>

            {/* Modal Bottom Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(viewingReport.summaryText)
                  showActionNotice('✓ Report copied to clipboard!')
                  setViewingReport(null)
                }}
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: 14,
                  padding: '12px 0',
                  color: '#334155',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Copy Text
              </button>
              <button
                onClick={() => {
                  handleShareText(viewingReport.summaryText, viewingReport.title)
                  setViewingReport(null)
                }}
                style={{
                  background: 'linear-gradient(135deg, #0284c7, #0ea5e9)',
                  border: 'none',
                  borderRadius: 14,
                  padding: '12px 0',
                  color: '#ffffff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                <Share2 size={15} /> Send WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ERGONOMIC NATIVE iOS BOTTOM NAVIGATION BAR (FIXED) ── */}
      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 60,
          background: 'rgba(255, 255, 255, 0.94)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderTop: '1px solid #e2e8f0',
          padding: '8px 24px 24px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 12,
          boxShadow: '0 -4px 20px rgba(15, 23, 42, 0.05)'
        }}
      >
        {/* Tab 1: Dashboard */}
        <button
          onClick={() => setActiveTab('overview')}
          style={{
            background: 'transparent',
            border: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: '4px 0',
            color: activeTab === 'overview' ? '#0284c7' : '#94a3b8',
            transition: 'color 0.15s ease'
          }}
        >
          <LayoutDashboard size={20} strokeWidth={activeTab === 'overview' ? 2.5 : 2} />
          <span style={{ fontSize: 11, fontWeight: activeTab === 'overview' ? 800 : 600, marginTop: 4 }}>
            Dashboard
          </span>
        </button>

        {/* Tab 2: Staff Pulse */}
        <button
          onClick={() => setActiveTab('staff')}
          style={{
            background: 'transparent',
            border: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: '4px 0',
            color: activeTab === 'staff' ? '#0284c7' : '#94a3b8',
            transition: 'color 0.15s ease'
          }}
        >
          <div style={{ position: 'relative' }}>
            <Users size={20} strokeWidth={activeTab === 'staff' ? 2.5 : 2} />
            <span
              style={{
                position: 'absolute',
                top: -2,
                right: -6,
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: '#22c55e',
                border: '1.5px solid #ffffff'
              }}
            />
          </div>
          <span style={{ fontSize: 11, fontWeight: activeTab === 'staff' ? 800 : 600, marginTop: 4 }}>
            Staff Pulse
          </span>
        </button>

        {/* Tab 3: Reports */}
        <button
          onClick={() => setActiveTab('reports')}
          style={{
            background: 'transparent',
            border: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: '4px 0',
            color: activeTab === 'reports' ? '#0284c7' : '#94a3b8',
            transition: 'color 0.15s ease'
          }}
        >
          <BarChart3 size={20} strokeWidth={activeTab === 'reports' ? 2.5 : 2} />
          <span style={{ fontSize: 11, fontWeight: activeTab === 'reports' ? 800 : 600, marginTop: 4 }}>
            Reports
          </span>
        </button>
      </nav>
    </div>
  )
}
