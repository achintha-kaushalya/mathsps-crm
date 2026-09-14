'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, Users, Phone, CreditCard,
  Truck, BarChart2, Settings, Building2, UserPlus, BookOpen
} from 'lucide-react'
import { clsx } from 'clsx'
import ThemeToggle from './ThemeToggle'

export default function Sidebar() {
  const pathname = usePathname()
  const supabase = createClient()
  const [role, setRole] = useState<'member' | 'admin' | 'owner' | 'callcenter' | 'payments'>('member')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        let uRole = user.user_metadata?.role || (user.email?.includes('admin') ? 'admin' : 'member')
        if (user.email) {
          const { data: dbMem } = await supabase.from('members').select('role, notes').eq('email', user.email).single()
          if (dbMem) {
            try {
              if (dbMem.notes) {
                const perms = JSON.parse(dbMem.notes)
                if (perms.sub_role) uRole = perms.sub_role
              }
            } catch {}
          }
        }
        setRole(uRole as any)
      }
    })
  }, [])

  const isAdmin = mounted && (role === 'admin' || role === 'owner')
  const isCallCenterOnly = mounted && role === 'callcenter'
  const isPaymentsOnly = mounted && role === 'payments'

  const navGroups = [
    {
      group: 'Overview',
      items: [
        { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      ]
    },
    ...(!isPaymentsOnly ? [{
      group: 'CRM — Leads',
      items: [
        { label: 'Leads', href: '/leads', icon: Phone },
        ...(isAdmin ? [{ label: 'Members', href: '/members', icon: Users }] : []),
      ]
    }] : []),
    ...(!isCallCenterOnly ? [{
      group: 'Payment System',
      items: [
        { label: 'Students', href: '/students', icon: Building2 },
        { label: 'Register', href: '/students/new', icon: UserPlus },
        { label: 'Payments', href: '/payments/add', icon: CreditCard },
        { label: 'Delivery', href: '/delivery', icon: Truck },
        ...(isAdmin ? [{ label: 'Courses', href: '/courses', icon: BookOpen }] : []),
        ...(isAdmin ? [{ label: 'Reports', href: '/reports', icon: BarChart2 }] : []),
      ]
    }] : []),
    {
      group: 'System',
      items: [
        { label: 'Settings', href: '/settings', icon: Settings },
      ]
    }
  ]

  return (
    <aside className="sidebar" style={{
      width: 230,
      height: '100vh',
      maxHeight: '100vh',
      background: '#ffffff',
      borderRight: '1px solid #e2e8f0',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '12px 10px',
      boxSizing: 'border-box',
      fontFamily: 'inherit',
      position: 'fixed',
      top: 0,
      left: 0,
      zIndex: 50,
      overflow: 'hidden'
    }} suppressHydrationWarning>
      {/* Top Header + Scrollable Nav Area */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Compact Logo & Tutor Switcher */}
        <div style={{
          padding: '8px 10px',
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(239, 68, 68, 0.06) 100%)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          borderRadius: 12,
          marginBottom: 10,
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ position: 'relative', width: 32, height: 32, flexShrink: 0 }}>
              <div style={{
                position: 'absolute', inset: -1.5,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                zIndex: 0,
              }} />
              <img
                src="/brand-logo.jpg"
                alt="MathsPS"
                style={{
                  width: 32, height: 32,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  position: 'relative', zIndex: 1,
                  display: 'block',
                  border: '1.5px solid #ffffff'
                }}
              />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: '#090d16', lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                MathsPS Portal
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#d97706', marginTop: 1 }}>
                {isAdmin ? '🛡 Executive Suite' : '👤 Staff Terminal'}
              </div>
            </div>
          </div>

          {/* Compact Active Tutor Switcher Bar */}
          {!isCallCenterOnly && (
            <button
              type="button"
              onClick={() => {
                sessionStorage.removeItem('mathsps_tutor_selected_session')
                window.location.reload()
              }}
              style={{
                width: '100%',
                marginTop: 6,
                padding: '4px 8px',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 6,
                transition: 'all 0.15s ease',
              }}
              title="Switch Tutor Account"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#f59e0b' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#090d16' }}>
                  {typeof window !== 'undefined' && localStorage.getItem('mathsps_active_tutor') === 'sanduni' ? 'Sanduni' : 'Prabuddha'}
                </span>
              </div>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: '#64748b' }}>
                ⇄ Switch
              </span>
            </button>
          )}
        </div>

        {/* Navigation Menu with Exact Vivid Colors (Matching Reference) */}
        <nav style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          paddingRight: 2
        }}>
          {navGroups.map((group) => (
            <div key={group.group}>
              <div style={{
                fontSize: 9,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: '#94a3b8',
                padding: '0 8px 4px'
              }}>
                {group.group}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {group.items.map((item) => {
                  const Icon = item.icon
                  const active = pathname === item.href || pathname.startsWith(item.href + '/')
                  
                  // Exact colorful badge mapping from LMS student portal reference
                  const colorMap: Record<string, { bg: string; color: string; border: string }> = {
                    '/dashboard': { bg: '#e0f2fe', color: '#0284c7', border: '#38bdf8' },
                    '/leads': { bg: '#dcfce7', color: '#16a34a', border: '#4ade80' },
                    '/members': { bg: '#ffedd5', color: '#ea580c', border: '#fb923c' },
                    '/students': { bg: '#e0e7ff', color: '#4f46e5', border: '#818cf8' },
                    '/students/new': { bg: '#ccfbf1', color: '#0d9488', border: '#2dd4bf' },
                    '/payments/add': { bg: '#d1fae5', color: '#059669', border: '#34d399' },
                    '/delivery': { bg: '#fce7f3', color: '#db2777', border: '#f472b6' },
                    '/courses': { bg: '#ede9fe', color: '#7c3aed', border: '#a78bfa' },
                    '/reports': { bg: '#fef3c7', color: '#d97706', border: '#fcd34d' },
                    '/settings': { bg: '#f1f5f9', color: '#475569', border: '#94a3b8' },
                  }
                  const c = colorMap[item.href] || { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' }

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '7px 9px',
                        borderRadius: 12,
                        textDecoration: 'none',
                        background: active ? '#f0fdfa' : 'transparent',
                        border: active ? '1.5px solid #0d9488' : '1.5px solid transparent',
                        color: active ? '#0f766e' : '#475569',
                        fontWeight: active ? 700 : 600,
                        fontSize: 13,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <div style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          background: c.bg,
                          color: c.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                        }}>
                          <Icon size={15} />
                        </div>
                        <span style={{ color: active ? '#0f766e' : '#334155', whiteSpace: 'nowrap' }}>{item.label}</span>
                      </div>
                      {active && (
                        <span style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: '#0d9488',
                          boxShadow: '0 0 8px #0d9488'
                        }} />
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Staff Profile Card & Crimson Red Logout Pill (Matching Reference) */}
      <div style={{
        marginTop: 6,
        paddingTop: 8,
        borderTop: '1px solid #f1f5f9',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        flexShrink: 0
      }}>
        {/* User Card Pill */}
        <div style={{
          padding: '6px 8px',
          borderRadius: 10,
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <div style={{
            width: 26,
            height: 26,
            borderRadius: 6,
            background: '#8b5cf6',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: 11
          }}>
            PS
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#090d16', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Prabuddha Sampath
            </div>
            <div style={{ fontSize: 9.5, color: '#94a3b8' }}>077 749 2398</div>
          </div>
        </div>

        {/* Theme and Full Width Red Logout Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ThemeToggle />
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              window.location.href = '/login'
            }}
            style={{
              flex: 1,
              padding: '8px 10px',
              background: '#ef4444',
              color: '#ffffff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              boxShadow: '0 3px 8px rgba(239, 68, 68, 0.25)',
              transition: 'all 0.15s ease'
            }}
          >
            Sign Out
          </button>
        </div>
      </div>
    </aside>
  )
}
