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
  ArrowUpRight
} from 'lucide-react'

interface TutorData {
  generatedAt: string
  dateStr: string
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
}

export default function TutorMobilePage() {
  const supabase = createClient()
  const [data, setData] = useState<TutorData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'staff' | 'reports'>('overview')
  const [pushStatus, setPushStatus] = useState<'prompt' | 'granted' | 'denied'>('prompt')
  const [actionNotice, setActionNotice] = useState('')

  // Real-time live online staff tracker
  const [onlineMembers, setOnlineMembers] = useState<Set<string>>(new Set())

  async function fetchSummary() {
    try {
      setRefreshing(true)
      const res = await fetch('/api/reports/tutor-mobile')
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

    // 1. Check Notification permissions
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPushStatus(Notification.permission as any)
    }

    // 2. Real-time presence listener
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

  // Push notification permission request
  async function handleRequestPush() {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const permission = await Notification.requestPermission()
        setPushStatus(permission as any)
        if (permission === 'granted') {
          showActionNotice('✓ Push Notifications Activated for your iPhone!')
          new Notification('MathsPS Executive Alert', {
            body: 'Tutor Alerts enabled! You will receive Morning & Evening reports right here.',
            icon: '/brand-logo.jpg'
          })
        }
      } catch (err) {
        alert('Could not enable notifications: ' + err)
      }
    } else {
      alert('Push notifications require iOS 16.4+ on iPhone. Add this page to Home Screen first!')
    }
  }

  function showActionNotice(msg: string) {
    setActionNotice(msg)
    setTimeout(() => setActionNotice(''), 5000)
  }

  // 1-Tap Native iOS Share Sheet for Reports
  async function handleShareBriefing(type: 'morning' | 'evening' | 'monthly') {
    if (!data) return

    const dateFormatted = new Date().toLocaleDateString('en-US', { dateStyle: 'full' })
    let textSummary = ''

    if (type === 'morning') {
      textSummary = `☀️ *MathsPS Morning Executive Briefing*\n📅 ${dateFormatted}\n\n` +
        `• Total Enrolled Students: ${data.metrics.totalStudents}\n` +
        `• Fees Paid so far: ${data.metrics.paidStudentsCount} (${data.metrics.paidRatio}%)\n` +
        `• Month Target: Rs. ${data.metrics.monthIncome.toLocaleString()} / Rs. ${data.metrics.monthlyTarget.toLocaleString()} (${data.metrics.targetProgress}%)\n` +
        `• Projected Month End: Rs. ${data.metrics.projectedMonthEndRevenue.toLocaleString()}\n\n` +
        `_Generated via MathsPS Executive Hub_`
    } else if (type === 'evening') {
      textSummary = `🌙 *MathsPS Day-End Executive Summary*\n📅 ${dateFormatted}\n\n` +
        `💰 *Today's Collection: Rs. ${data.metrics.todayIncome.toLocaleString()}* (${data.metrics.todayTransactionsCount} transactions)\n` +
        `📊 MTD Revenue: Rs. ${data.metrics.monthIncome.toLocaleString()} (${data.metrics.targetProgress}% Target)\n\n` +
        `👥 *Staff Activity Audit:*\n` +
        data.staffRoster.map(s => `• ${s.name}: ${s.callsToday} Calls, ${s.paymentsVerifiedToday} Payments (Rs. ${s.revenueCollectedToday.toLocaleString()})`).join('\n') +
        `\n\n_Generated via MathsPS Executive Hub_`
    } else {
      textSummary = `📊 *MathsPS Mid-Month Financial Audit*\nMonth: ${data.monthName} ${data.year}\n\n` +
        `• Total Revenue Collected: Rs. ${data.metrics.monthIncome.toLocaleString()}\n` +
        `• Paid Student Ratio: ${data.metrics.paidRatio}%\n` +
        `• Unpaid / At-Risk Followups: ${data.metrics.atRiskUnpaidStudents} Students\n\n` +
        `_Generated via MathsPS Executive Hub_`
    }

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `MathsPS Report — ${dateFormatted}`,
          text: textSummary,
        })
      } catch (e) {
        // Fallback to clipboard
        await navigator.clipboard.writeText(textSummary)
        showActionNotice('✓ Report copied to clipboard for WhatsApp!')
      }
    } else {
      await navigator.clipboard.writeText(textSummary)
      showActionNotice('✓ Report copied to clipboard for WhatsApp!')
    }
  }

  // Quick download CSV
  function downloadStaffAuditCsv() {
    if (!data) return
    const headers = ['Staff Member', 'Role', 'Calls Today', 'Leads Converted', 'Payments Verified', 'Revenue Collected (Rs)']
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
        background: '#090d16',
        color: '#f8fafc',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
        paddingBottom: 90,
        WebkitFontSmoothing: 'antialiased',
        userSelect: 'none'
      }}
    >
      {/* ── TOP EXECUTIVE APP HEADER (iPhone Notch-Safe) ── */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'rgba(9, 13, 22, 0.88)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '16px 20px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <img
              src="/brand-logo.jpg"
              alt="MathsPS"
              style={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                objectFit: 'cover',
                border: '2px solid rgba(56, 189, 248, 0.4)',
                boxShadow: '0 0 16px rgba(56, 189, 248, 0.25)'
              }}
            />
            <span
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 11,
                height: 11,
                borderRadius: '50%',
                background: '#10b981',
                border: '2px solid #090d16'
              }}
            />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: '-0.3px', color: '#ffffff' }}>
              MathsPS <span style={{ color: '#38bdf8' }}>Executive</span>
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>
              Prabuddha Sampath · Tutor View
            </div>
          </div>
        </div>

        {/* Top Action Pills: Refresh & Alerts */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={fetchSummary}
            disabled={refreshing}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 20,
              padding: '6px 10px',
              color: '#cbd5e1',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 12,
              fontWeight: 600
            }}
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Sync
          </button>

          {pushStatus !== 'granted' && (
            <button
              onClick={handleRequestPush}
              style={{
                background: 'linear-gradient(135deg, #2563eb, #38bdf8)',
                border: 'none',
                borderRadius: 20,
                padding: '6px 12px',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12,
                fontWeight: 700,
                boxShadow: '0 0 12px rgba(56, 189, 248, 0.4)'
              }}
            >
              <Bell size={13} />
              Alerts
            </button>
          )}
        </div>
      </header>

      {/* ── ACTION NOTIFICATION TOAST ── */}
      {actionNotice && (
        <div
          style={{
            margin: '12px 18px 0',
            padding: '10px 14px',
            borderRadius: 12,
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#34d399',
            fontSize: 12.5,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            animation: 'fadeIn 0.2s ease-in'
          }}
        >
          <CheckCircle2 size={16} />
          {actionNotice}
        </div>
      )}

      {/* ── SEGMENTED TOP SWITCHER (Overview vs Staff vs Reports) ── */}
      <div style={{ padding: '16px 18px 8px' }}>
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 14,
            padding: 3,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 4
          }}
        >
          <button
            onClick={() => setActiveTab('overview')}
            style={{
              padding: '8px 0',
              borderRadius: 11,
              background: activeTab === 'overview' ? '#1e293b' : 'transparent',
              border: activeTab === 'overview' ? '1px solid rgba(255, 255, 255, 0.15)' : 'none',
              color: activeTab === 'overview' ? '#38bdf8' : '#94a3b8',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('staff')}
            style={{
              padding: '8px 0',
              borderRadius: 11,
              background: activeTab === 'staff' ? '#1e293b' : 'transparent',
              border: activeTab === 'staff' ? '1px solid rgba(255, 255, 255, 0.15)' : 'none',
              color: activeTab === 'staff' ? '#38bdf8' : '#94a3b8',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            Staff Pulse ({data?.staffRoster.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            style={{
              padding: '8px 0',
              borderRadius: 11,
              background: activeTab === 'reports' ? '#1e293b' : 'transparent',
              border: activeTab === 'reports' ? '1px solid rgba(255, 255, 255, 0.15)' : 'none',
              color: activeTab === 'reports' ? '#38bdf8' : '#94a3b8',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            Reports
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 80, textAlign: 'center', color: '#64748b' }}>
          <div
            style={{
              width: 38,
              height: 38,
              border: '3px solid rgba(56, 189, 248, 0.2)',
              borderTopColor: '#38bdf8',
              borderRadius: '50%',
              margin: '0 auto 16px',
              animation: 'spin 0.8s linear infinite'
            }}
          />
          <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>Syncing Executive Pulse…</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Analyzing today&apos;s revenue &amp; staff calls</div>
        </div>
      ) : data && (
        <div style={{ padding: '0 18px' }}>
          {/* ──────────────── TAB 1: EXECUTIVE OVERVIEW ──────────────── */}
          {activeTab === 'overview' && (
            <div>
              {/* TODAY'S FLASH CARD (Crown Jewel) */}
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.2) 0%, rgba(16, 185, 129, 0.15) 100%)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  borderRadius: 22,
                  padding: '22px 20px',
                  margin: '10px 0 16px',
                  boxShadow: '0 12px 36px -8px rgba(37, 99, 235, 0.25)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#38bdf8', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                    Today&apos;s Collection
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: 20,
                      background: 'rgba(16, 185, 129, 0.2)',
                      color: '#34d399',
                      border: '1px solid rgba(16, 185, 129, 0.35)'
                    }}
                  >
                    LIVE SYNC
                  </span>
                </div>

                <div style={{ fontSize: 34, fontWeight: 900, color: '#ffffff', margin: '8px 0 4px', letterSpacing: '-0.5px' }}>
                  Rs. {m?.todayIncome.toLocaleString()}
                </div>

                <div style={{ fontSize: 12.5, color: '#94a3b8', fontWeight: 500 }}>
                  {m?.todayTransactionsCount} Student Payments Verified Today
                </div>
              </div>

              {/* MONTHLY REVENUE & TARGET PROGRESS */}
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.65)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 20,
                  padding: '18px 18px',
                  marginBottom: 16
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {data.monthName} Revenue (MTD)
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: '#f8fafc', marginTop: 2 }}>
                      Rs. {m?.monthIncome.toLocaleString()}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Target: Rs. 1.5M</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#38bdf8' }}>
                      {m?.targetProgress}%
                    </div>
                  </div>
                </div>

                {/* Target Progress Bar */}
                <div
                  style={{
                    width: '100%',
                    height: 7,
                    borderRadius: 999,
                    background: 'rgba(255, 255, 255, 0.06)',
                    overflow: 'hidden'
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${m?.targetProgress}%`,
                      background: 'linear-gradient(90deg, #2563eb, #38bdf8)',
                      borderRadius: 999,
                      boxShadow: '0 0 10px rgba(56, 189, 248, 0.7)'
                    }}
                  />
                </div>
              </div>

              {/* DUAL STATS: Students & Predictions */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                {/* Active Students & Paid Ratio */}
                <div
                  style={{
                    background: 'rgba(15, 23, 42, 0.65)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 18,
                    padding: '16px 14px'
                  }}
                >
                  <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
                    Paid Ratio
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#10b981', margin: '4px 0 2px' }}>
                    {m?.paidRatio}%
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    {m?.paidStudentsCount} of {m?.totalStudents} Paid
                  </div>
                </div>

                {/* AI Predictive Month-End */}
                <div
                  style={{
                    background: 'rgba(15, 23, 42, 0.65)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 18,
                    padding: '16px 14px'
                  }}
                >
                  <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Sparkles size={11} /> Forecast
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#f8fafc', margin: '4px 0 2px' }}>
                    Rs. {(m?.projectedMonthEndRevenue || 0).toLocaleString()}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    Projected Month-End
                  </div>
                </div>
              </div>

              {/* AT-RISK CALLOUT */}
              {(m?.atRiskUnpaidStudents || 0) > 0 && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    borderRadius: 16,
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 20
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <AlertTriangle size={18} color="#ef4444" />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#fca5a5' }}>
                        {m?.atRiskUnpaidStudents} Unpaid Students
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>
                        Follow-up required for {data.monthName}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleShareBriefing('evening')}
                    style={{
                      background: 'rgba(239, 68, 68, 0.2)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      borderRadius: 10,
                      padding: '4px 8px',
                      color: '#fecaca',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Share
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ──────────────── TAB 2: STAFF LIVE ACTIVITY AUDIT ──────────────── */}
          {activeTab === 'staff' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '10px 0 14px' }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Live Staff Performance
                </div>
                <button
                  onClick={downloadStaffAuditCsv}
                  style={{
                    background: 'rgba(56, 189, 248, 0.12)',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    borderRadius: 8,
                    padding: '4px 8px',
                    color: '#38bdf8',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  <Download size={11} /> Export CSV
                </button>
              </div>

              {/* Staff Cards List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data.staffRoster.map(s => {
                  const sNameLower = s.name.toLowerCase().trim()
                  const isOnline = onlineMembers.has(sNameLower)

                  return (
                    <div
                      key={s.id}
                      style={{
                        background: 'rgba(15, 23, 42, 0.7)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: 16,
                        padding: '14px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10
                      }}
                    >
                      {/* Name & Online Pill */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: isOnline ? '#10b981' : '#64748b',
                              boxShadow: isOnline ? '0 0 8px #10b981' : 'none'
                            }}
                          />
                          <span style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc', textTransform: 'capitalize' }}>
                            {s.name}
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '2px 7px',
                            borderRadius: 6,
                            background: isOnline ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                            color: isOnline ? '#34d399' : '#94a3b8'
                          }}
                        >
                          {isOnline ? 'Online Now' : 'Idle / Offline'}
                        </span>
                      </div>

                      {/* Work Metrics Breakdown */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: 8,
                          paddingTop: 8,
                          borderTop: '1px dashed rgba(255, 255, 255, 0.08)'
                        }}
                      >
                        {/* Calls Taken */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <PhoneCall size={14} color="#38bdf8" />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc' }}>
                              {s.callsToday} Calls
                            </div>
                            <div style={{ fontSize: 10.5, color: '#64748b' }}>
                              {s.convertedToday} converted
                            </div>
                          </div>
                        </div>

                        {/* Payments Verified */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <CreditCard size={14} color="#10b981" />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc' }}>
                              {s.paymentsVerifiedToday} Payments
                            </div>
                            <div style={{ fontSize: 10.5, color: '#34d399', fontWeight: 600 }}>
                              Rs. {s.revenueCollectedToday.toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ──────────────── TAB 3: 1-TAP REPORT GENERATOR & SHARE ──────────────── */}
          {activeTab === 'reports' && (
            <div style={{ paddingTop: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 14 }}>
                Instant Shareable Executive Reports
              </div>

              {/* Morning Briefing Card */}
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.65)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 18,
                  padding: 16,
                  marginBottom: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc' }}>
                    ☀️ Morning Briefing
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                    Daily targets, active student enrollments &amp; projection
                  </div>
                </div>
                <button
                  onClick={() => handleShareBriefing('morning')}
                  style={{
                    background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                    border: 'none',
                    borderRadius: 10,
                    padding: '8px 14px',
                    color: '#ffffff',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5
                  }}
                >
                  <Share2 size={13} /> Share
                </button>
              </div>

              {/* Evening Day-End Reconciliation Card */}
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.65)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 18,
                  padding: 16,
                  marginBottom: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc' }}>
                    🌙 Day-End Audit
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                    Today&apos;s collections &amp; individual staff performance
                  </div>
                </div>
                <button
                  onClick={() => handleShareBriefing('evening')}
                  style={{
                    background: 'linear-gradient(135deg, #059669, #10b981)',
                    border: 'none',
                    borderRadius: 10,
                    padding: '8px 14px',
                    color: '#ffffff',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5
                  }}
                >
                  <Share2 size={13} /> Share
                </button>
              </div>

              {/* Mid-Month Audit Card */}
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.65)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 18,
                  padding: 16,
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc' }}>
                    📅 Mid-Month Audit
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                    Revenue to date, target gap &amp; unpaid students
                  </div>
                </div>
                <button
                  onClick={() => handleShareBriefing('monthly')}
                  style={{
                    background: 'linear-gradient(135deg, #d97706, #f59e0b)',
                    border: 'none',
                    borderRadius: 10,
                    padding: '8px 14px',
                    color: '#ffffff',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5
                  }}
                >
                  <Share2 size={13} /> Share
                </button>
              </div>

              {/* iPhone Home Screen Guide Box */}
              <div
                style={{
                  background: 'rgba(56, 189, 248, 0.08)',
                  border: '1px solid rgba(56, 189, 248, 0.2)',
                  borderRadius: 18,
                  padding: '16px 18px',
                  marginTop: 20
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 800, color: '#38bdf8', marginBottom: 4 }}>
                  📲 iPhone 17 Pro Max Installation Tip
                </div>
                <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.5 }}>
                  Safari එකේ පහළ ඇති <strong>Share Icon</strong> එක ඔබා <strong>&quot;Add to Home Screen&quot;</strong> තෝරන්න. එවිට මෙය App Store app එකක් මෙන් Native Fullscreen ලෙස ක්‍රියාත්මක වේ.
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
