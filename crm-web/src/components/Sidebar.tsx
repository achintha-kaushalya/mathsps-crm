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
  const [role, setRole] = useState<'member' | 'admin' | 'owner'>('member')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const uRole = user.user_metadata?.role || (user.email?.includes('admin') ? 'admin' : 'member')
        setRole(uRole)
      }
    })
  }, [])

  const isAdmin = mounted && (role === 'admin' || role === 'owner')

  const navGroups = [
    ...(isAdmin ? [{
      group: 'Overview',
      items: [
        { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      ]
    }] : []),
    {
      group: 'CRM — Leads',
      items: [
        { label: 'Master Leads', href: '/leads', icon: Phone },
        ...(isAdmin ? [{ label: 'Members & Roles', href: '/members', icon: Users }] : []),
      ]
    },
    {
      group: 'Payment System',
      items: [
        { label: 'Students', href: '/students', icon: Building2 },
        { label: 'Register Student', href: '/students/new', icon: UserPlus },
        { label: 'Add Payment', href: '/payments/add', icon: CreditCard },
        { label: 'Delivery', href: '/delivery', icon: Truck },
        ...(isAdmin ? [{ label: 'Reports & Debts', href: '/reports', icon: BarChart2 }] : []),
      ]
    },
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
