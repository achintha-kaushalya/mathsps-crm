'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard,
  Users,
  Phone,
  CreditCard,
  Truck,
  BarChart2,
  Settings,
  Building2,
  UserPlus,
  BookOpen,
  MessageCircle,
  LogOut,
  Pin,
  PinOff,
  ChevronUp
} from 'lucide-react'
import ThemeToggle from './ThemeToggle'

export default function BottomFloatingDock() {
  const pathname = usePathname()
  const supabase = createClient()
  const [role, setRole] = useState<'member' | 'admin' | 'owner' | 'callcenter' | 'payments'>('member')
  const [mounted, setMounted] = useState(false)
  const [activeTutor, setActiveTutor] = useState('prabuddha')
  const [hoveredTab, setHoveredTab] = useState<string | null>(null)
  const [isPinned, setIsPinned] = useState(false)
  const [isHoveredNearBottom, setIsHoveredNearBottom] = useState(false)
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null)

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

    if (typeof window !== 'undefined') {
      const tutor = localStorage.getItem('mathsps_active_tutor') || 'prabuddha'
      setActiveTutor(tutor)
      const savedPinned = localStorage.getItem('mathsps_dock_pinned') === 'true'
      setIsPinned(savedPinned)
    }

    // Throttled global mouse tracking to reveal dock when cursor approaches bottom 45px of screen
    let rafId: number | null = null
    const handleMouseMove = (e: MouseEvent) => {
      if (rafId) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        const windowHeight = window.innerHeight
        if (windowHeight - e.clientY <= 45) {
          if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
          setIsHoveredNearBottom(true)
        }
      })
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      window.removeEventListener('mousemove', handleMouseMove)
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [])

  function togglePin() {
    const next = !isPinned
    setIsPinned(next)
    localStorage.setItem('mathsps_dock_pinned', String(next))
  }

  function handleDockMouseEnter() {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    setIsHoveredNearBottom(true)
  }

  function handleDockMouseLeave() {
    if (!isPinned) {
      hideTimerRef.current = setTimeout(() => {
        setIsHoveredNearBottom(false)
      }, 350)
    }
  }

  function switchTutor(tutor: 'prabuddha' | 'sanduni') {
    setActiveTutor(tutor)
    localStorage.setItem('mathsps_active_tutor', tutor)
    window.dispatchEvent(new Event('mathsps_tutor_changed'))
  }

  const isAdmin = mounted && (role === 'admin' || role === 'owner')
  const isCallCenterOnly = mounted && role === 'callcenter'
  const isPaymentsOnly = mounted && role === 'payments'

  const dockItems = [
    ...(isAdmin ? [{ label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, color: '#38bdf8' }] : []),
    ...(!isPaymentsOnly ? [{ label: 'Leads', href: '/leads', icon: Phone, color: '#10b981' }] : []),
    ...(!isCallCenterOnly ? [
      { label: 'Students', href: '/students', icon: Building2, color: '#38bdf8' },
      { label: 'Register', href: '/students/new', icon: UserPlus, color: '#06b6d4' },
      { label: 'Payments', href: '/payments/add', icon: CreditCard, color: '#10b981' },
      { label: 'Delivery', href: '/delivery', icon: Truck, color: '#f43f5e' },
      ...(isAdmin ? [{ label: 'Courses', href: '/courses', icon: BookOpen, color: '#8b5cf6' }] : []),
      ...(isAdmin ? [{ label: 'Reports', href: '/reports', icon: BarChart2, color: '#f59e0b' }] : []),
    ] : []),
    { label: 'Settings', href: '/settings', icon: Settings, color: '#64748b' }
  ]

  const isVisible = isPinned || isHoveredNearBottom

  return (
    <>
      <style>{`
        /* Bottom Screen Trigger Area (40px high at screen bottom) */
        .dock-trigger-hitbox {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 35px;
          z-index: 9998;
          pointer-events: auto;
        }

        /* Floating Pill Indicator when Dock is Hidden */
        .dock-hidden-indicator {
          position: fixed;
          bottom: 6px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 9998;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 14px;
          background: rgba(15, 23, 42, 0.75);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 20px;
          color: #f8fafc;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          animation: dockPulse 2.5s infinite ease-in-out;
        }
        @keyframes dockPulse {
          0%, 100% { opacity: 0.85; transform: translateX(-50%) translateY(0); }
          50% { opacity: 1; transform: translateX(-50%) translateY(-2px); }
        }
        .dock-hidden-indicator:hover {
          background: rgba(15, 23, 42, 0.95);
          transform: translateX(-50%) translateY(-3px) scale(1.05);
        }

        /* Main Floating Dock Container */
        .dock-floating-container {
          position: fixed;
          bottom: 18px;
          left: 50%;
          transform: translateX(-50%) translateY(${isVisible ? '0' : '120%'});
          opacity: ${isVisible ? '1' : '0'};
          pointer-events: ${isVisible ? 'auto' : 'none'};
          z-index: 9999;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 7px 12px;
          background: rgba(255, 255, 255, 0.84);
          backdrop-filter: blur(28px) saturate(180%);
          -webkit-backdrop-filter: blur(28px) saturate(180%);
          border: 1px solid rgba(255, 255, 255, 0.85);
          border-radius: 28px;
          box-shadow: 0 20px 50px -12px rgba(15, 23, 42, 0.18), 0 0 0 1px rgba(226, 232, 240, 0.7);
          transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease;
        }
        [data-theme="dark"] .dock-floating-container {
          background: rgba(15, 23, 42, 0.82);
          border-color: rgba(255, 255, 255, 0.12);
          box-shadow: 0 24px 60px -12px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.08);
        }
        .dock-item-btn {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 7px 11px;
          border-radius: 14px;
          text-decoration: none;
          color: #64748b;
          font-size: 11px;
          font-weight: 700;
          transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
          cursor: pointer;
        }
        .dock-item-btn:hover {
          transform: translateY(-7px) scale(1.15);
          color: #0f172a;
        }
        [data-theme="dark"] .dock-item-btn:hover {
          color: #f8fafc;
        }
        .dock-item-btn.active {
          color: #0284c7;
          background: rgba(2, 132, 199, 0.1);
        }
        [data-theme="dark"] .dock-item-btn.active {
          color: #38bdf8;
          background: rgba(56, 189, 248, 0.15);
        }
        .dock-quick-action {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: none;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .dock-quick-action:hover {
          transform: translateY(-5px) scale(1.15);
        }
        .dock-tutor-pill {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 3px 9px 3px 4px;
          border-radius: 20px;
          background: rgba(245, 158, 11, 0.08);
          border: 1px solid rgba(245, 158, 11, 0.22);
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .dock-tutor-pill:hover {
          transform: translateY(-3px) scale(1.08);
          background: rgba(245, 158, 11, 0.16);
        }
        .dock-brand-name {
          font-weight: 800;
          font-size: 12.5px;
          background: linear-gradient(135deg, #0284c7, #6366f1);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
      `}</style>

      {/* Mouse Bottom Trigger Area */}
      {!isVisible && (
        <div
          className="dock-trigger-hitbox"
          onMouseEnter={() => setIsHoveredNearBottom(true)}
        >
          <div
            className="dock-hidden-indicator"
            onClick={() => setIsHoveredNearBottom(true)}
            title="Hover or click to show navigation dock"
          >
            <ChevronUp size={14} />
            <span>Menu Dock</span>
          </div>
        </div>
      )}

      {/* Floating Centered Dock Component */}
      <div
        className="dock-floating-container"
        onMouseEnter={handleDockMouseEnter}
        onMouseLeave={handleDockMouseLeave}
      >
        {/* Left Section: Sleek Circular Profile Avatar Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', paddingRight: 8, borderRight: '1px solid var(--border)' }}>
          <button
            type="button"
            className="dock-profile-avatar-btn"
            onClick={() => switchTutor(activeTutor === 'prabuddha' ? 'sanduni' : 'prabuddha')}
            title={`Active Tutor: ${activeTutor === 'sanduni' ? 'Sanduni (SM)' : 'Prabuddha (PS)'} — Click to Switch`}
            style={{
              position: 'relative',
              width: 36,
              height: 36,
              borderRadius: '50%',
              padding: 0,
              border: activeTutor === 'sanduni' ? '2px solid #ec4899' : '2px solid #f59e0b',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: activeTutor === 'sanduni' ? '0 0 10px rgba(236,72,153,0.35)' : '0 0 10px rgba(245,158,11,0.35)',
              transition: 'all 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}
          >
            <img
              src={activeTutor === 'sanduni' ? '/sanduni-profile.jpg' : '/brand-logo.jpg'}
              alt="Tutor Profile"
              style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
            />
            {/* Active Indicator Dot */}
            <span
              style={{
                position: 'absolute',
                bottom: -1,
                right: -1,
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: activeTutor === 'sanduni' ? '#ec4899' : '#10b981',
                border: '2px solid #ffffff',
                boxShadow: '0 0 4px rgba(0,0,0,0.2)'
              }}
            />
          </button>
        </div>

        {/* Center Section: Animated Primary Navigation Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          {dockItems.map(item => {
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
            const Icon = item.icon
            const isHovered = hoveredTab === item.label

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`dock-item-btn ${active ? 'active' : ''}`}
                onMouseEnter={() => setHoveredTab(item.label)}
                onMouseLeave={() => setHoveredTab(null)}
              >
                <div style={{
                  position: 'relative',
                  width: 26,
                  height: 26,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Icon
                    size={19}
                    style={{
                      color: active ? (item.color || 'var(--accent-blue)') : 'currentColor',
                      transition: 'transform 0.2s ease',
                      transform: isHovered ? 'scale(1.15)' : 'scale(1)'
                    }}
                  />
                  {active && (
                    <span style={{
                      position: 'absolute',
                      bottom: -3,
                      width: 4.5,
                      height: 4.5,
                      borderRadius: '50%',
                      background: item.color || '#0284c7',
                      boxShadow: `0 0 8px ${item.color || '#0284c7'}`
                    }} />
                  )}
                </div>
                <span style={{ marginTop: 2, fontSize: 10, letterSpacing: '-0.2px' }}>{item.label}</span>
              </Link>
            )
          })}
        </div>

        {/* Right Section: Theme, Pin, and Signout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, paddingLeft: 6, borderLeft: '1px solid var(--border)' }}>
          <ThemeToggle />

          {/* Pin / Auto-Hide Toggle */}
          <button
            type="button"
            onClick={togglePin}
            className="dock-quick-action"
            style={{
              background: isPinned ? 'rgba(2, 132, 199, 0.12)' : 'var(--bg-card)',
              color: isPinned ? '#0284c7' : 'var(--text-secondary)',
              border: isPinned ? '1px solid rgba(2, 132, 199, 0.3)' : '1px solid var(--border)'
            }}
            title={isPinned ? 'Dock Pinned (Click to enable Auto-Hide)' : 'Auto-Hide Active (Click to Pin dock permanently)'}
          >
            {isPinned ? <Pin size={15} /> : <PinOff size={15} />}
          </button>

          {/* Quick Sign Out */}
          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut()
              window.location.href = '/login'
            }}
            className="dock-quick-action"
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.2)'
            }}
            title="Sign Out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </>
  )
}

