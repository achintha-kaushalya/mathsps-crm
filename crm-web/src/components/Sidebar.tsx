'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, Users, Phone, CreditCard,
  Truck, BarChart2, Settings, Building2, UserPlus
} from 'lucide-react'
import { clsx } from 'clsx'

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
    ...(isAdmin ? [{
      group: 'Overview',
      items: [
        { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      ]
    }] : []),
    ...(!isPaymentsOnly ? [{
      group: 'CRM — Leads',
      items: [
        { label: 'Master Leads', href: '/leads', icon: Phone },
        ...(isAdmin ? [{ label: 'Members & Roles', href: '/members', icon: Users }] : []),
      ]
    }] : []),
    ...(!isCallCenterOnly ? [{
      group: 'Payment System',
      items: [
        { label: 'Students', href: '/students', icon: Building2 },
        { label: 'Register Student', href: '/students/new', icon: UserPlus },
        { label: 'Add Payment', href: '/payments/add', icon: CreditCard },
        { label: 'Delivery', href: '/delivery', icon: Truck },
        ...(isAdmin ? [{ label: 'Reports & Debts', href: '/reports', icon: BarChart2 }] : []),
      ]
    }] : []),
    {
      group: 'System',
      items: [
        { label: 'Settings & Security', href: '/settings', icon: Settings },
      ]
    }
  ]

  return (
    <aside className="sidebar" suppressHydrationWarning>
      {/* Logo */}
      <div className="sidebar-logo" suppressHydrationWarning>
        <div className="flex items-center gap-3">
          {/* Brand photo ring */}
          <div style={{ position: 'relative', width: 36, height: 36, flexShrink: 0 }}>
            <div style={{
              position: 'absolute', inset: -2,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              zIndex: 0,
            }} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand-logo.jpg"
              alt="MathsPS"
              style={{
                width: 36, height: 36,
                borderRadius: '50%',
                objectFit: 'cover',
                objectPosition: 'center top',
                position: 'relative', zIndex: 1,
                display: 'block',
              }}
            />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
              MathsPS CRM
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {isAdmin ? '🛡 Admin Access' : '👤 Staff Member'}
            </div>
          </div>
        </div>

        {/* Active Tutor Switcher Bar (Only visible to Payment System assigned roles) */}
        {!isCallCenterOnly && (
          <div
            onClick={() => {
              sessionStorage.removeItem('mathsps_tutor_selected_session')
              window.location.reload()
            }}
            style={{
              marginTop: 14,
              padding: '8px 12px',
              background: typeof window !== 'undefined' && localStorage.getItem('mathsps_active_tutor') === 'sanduni'
                ? 'rgba(236, 72, 153, 0.12)'
                : 'rgba(59, 130, 246, 0.12)',
              border: `1px solid ${typeof window !== 'undefined' && localStorage.getItem('mathsps_active_tutor') === 'sanduni' ? 'rgba(236, 72, 153, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
              borderRadius: 10,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              transition: 'all 0.15s',
            }}
            title="Click to switch active Tutor profile (Prabuddha vs Sanduni)"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <img
                src={typeof window !== 'undefined' && localStorage.getItem('mathsps_active_tutor') === 'sanduni' ? '/sanduni-profile.jpg' : '/prabuddha-profile.jpg'}
                alt="Tutor"
                style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', objectPosition: 'center top' }}
              />
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
                  Active Tutor
                </div>
                <div style={{
                  fontSize: 12, fontWeight: 800,
                  color: typeof window !== 'undefined' && localStorage.getItem('mathsps_active_tutor') === 'sanduni' ? '#f472b6' : '#60a5fa'
                }}>
                  {typeof window !== 'undefined' && localStorage.getItem('mathsps_active_tutor') === 'sanduni' ? 'Sanduni (SM)' : 'Prabuddha (PS)'}
                </div>
              </div>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 4 }}>
              Switch ⇄
            </span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {navGroups.map((group) => (
          <div key={group.group} style={{ marginBottom: 8 }}>
            <div className="nav-group-label">{group.group}</div>
            {group.items.map((item) => {
              const Icon = item.icon
              const active = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx('nav-item', active && 'active')}
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          v1.0 · Protected
        </div>
        <button
          onClick={async () => {
            await supabase.auth.signOut()
            window.location.href = '/login'
          }}
          style={{ background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
        >
          Sign Out
        </button>
      </div>
    </aside>
  )
}
