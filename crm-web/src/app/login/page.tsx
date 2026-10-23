'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Lock, Mail, ArrowRight, Shield, Eye, EyeOff, Building2, Sparkles } from 'lucide-react'

// Pre-defined fallback team members
const TEAM_MEMBERS = [
  { name: 'Prabuddha', email: 'admin@mathsps.com', role: 'Executive Director', desk: 'Floor 5 · Penthouse Suite', color: '#f59e0b' },
  { name: 'Thisal', email: 'thisal@mathsps.com', role: 'Payment Auditor', desk: 'Floor 4 · Cash Vault Bay', color: '#10b981' },
  { name: 'Kavinda', email: 'kavinda@mathsps.com', role: 'Call Center Lead', desk: 'Floor 2 · Telephony Hub', color: '#3b82f6' },
  { name: 'Kaushalya', email: 'kaushalya@mathsps.com', role: 'Operations Officer', desk: 'Floor 1 · Reception Suite', color: '#8b5cf6' },
]

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#f8fafc' }} />}>
      <InteractiveLobbyLoginForm />
    </Suspense>
  )
}

function InteractiveLobbyLoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [infoBanner, setInfoBanner] = useState('')
  const [selectedMember, setSelectedMember] = useState<any>(null)
  const [dbMembers, setDbMembers] = useState<any[]>([])
  const [onlineMemberNames, setOnlineMemberNames] = useState<Set<string>>(new Set())

  // Interactive Mascot Physics & Eye Tracking
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [isTypingEmail, setIsTypingEmail] = useState(false)
  const [isTypingPassword, setIsTypingPassword] = useState(false)
  const [isHoveringSubmit, setIsHoveringSubmit] = useState(false)
  const [showWorkstations, setShowWorkstations] = useState(false)
  const [mascotClicked, setMascotClicked] = useState(false)
  const leftColRef = useRef<HTMLDivElement>(null)

  function handleMascotSecretClick() {
    setMascotClicked(true)
    setShowWorkstations(prev => !prev)
    setTimeout(() => setMascotClicked(false), 400)
  }

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!leftColRef.current) return
      const rect = leftColRef.current.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      const deltaX = Math.max(-1, Math.min(1, (e.clientX - centerX) / (window.innerWidth / 2)))
      const deltaY = Math.max(-1, Math.min(1, (e.clientY - centerY) / (window.innerHeight / 2)))
      setMousePos({ x: deltaX, y: deltaY })
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  useEffect(() => {
    if (searchParams.get('reason') === 'inactivity_timeout') {
      setInfoBanner('Your session timed out due to inactivity. Please sign in again.')
    }

    async function loadMembers() {
      try {
        const res = await fetch('/api/members/public')
        const data = await res.json()
        if (data && Array.isArray(data.members)) {
          setDbMembers(data.members)
        }
      } catch (e) {
        console.error('Failed to load public members:', e)
      }
    }
    loadMembers()

    // Real-time Live Lobby Presence Channel
    const presenceChannel = supabase.channel('online_hq_workers', {
      config: { presence: { key: 'login_lobby_viewer' } }
    })

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState()
        const activeUsers = new Set<string>()
        activeUsers.add('admin user')
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

        setOnlineMemberNames(activeUsers)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(presenceChannel)
    }
  }, [searchParams])

  function getMemberDisplayRole(m: any) {
    if (m.name === 'Admin User' || m.email === 'admin@mathsps.com' || m.role === 'admin' || m.role === 'owner') {
      return { roleLabel: 'Executive Admin', color: '#f59e0b' }
    }
    let subRole = m.role || 'member'
    try {
      if (m.notes) {
        const parsed = JSON.parse(m.notes)
        if (parsed.sub_role) subRole = parsed.sub_role
      }
    } catch {}

    if (subRole === 'payments') {
      return { roleLabel: 'Payment Auditor', color: '#10b981' }
    }
    if (subRole === 'callcenter') {
      return { roleLabel: 'Call Center Agent', color: '#38bdf8' }
    }
    return { roleLabel: 'Team Member', color: '#8b5cf6' }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (err) {
      setError(err.message)
      setLoading(false)
    } else {
      sessionStorage.setItem('crm_show_greeting', '1')
      sessionStorage.setItem('crm_just_logged_in', '1')

      // Detect if user is on mobile phone or if tutor direct link is preferred
      const isMobileDevice = typeof window !== 'undefined' && (
        /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
        window.innerWidth < 768
      )

      // Fetch user role to route admins on phone directly to /tutor executive hub
      const { data: { user } } = await supabase.auth.getUser()
      const uEmail = user?.email || email
      let isAdminRole = uEmail === 'admin@mathsps.com'

      if (uEmail) {
        const { data: dbMem } = await supabase.from('members').select('role').eq('email', uEmail).single()
        if (dbMem?.role === 'admin' || dbMem?.role === 'owner') {
          isAdminRole = true
        }
      }

      if (isMobileDevice && isAdminRole) {
        router.push('/tutor')
      } else {
        router.push('/dashboard')
      }
      router.refresh()
    }
  }

  function handleSelectMember(m: any) {
    const info = getMemberDisplayRole(m)
    setSelectedMember({ ...m, ...info })
    setEmail(m.email)
    setError('')
  }

  // Eye and Mascot Look calculations
  const eyeX = isTypingEmail ? 5 : isTypingPassword ? 0 : mousePos.x * 7
  const eyeY = isTypingEmail ? 3 : isTypingPassword ? 4 : mousePos.y * 5
  const bodyLean = isTypingEmail ? 4 : isTypingPassword ? -2 : isHoveringSubmit ? 6 : mousePos.x * 6

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      background: '#f8fafc',
      fontFamily: 'var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <style>{`
        .login-split-card {
          display: grid;
          grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
          width: 100%;
          max-width: 1040px;
        }
        .login-left-stage {
          display: flex;
        }
        @media (max-width: 768px) {
          .login-split-card {
            grid-template-columns: 1fr !important;
            max-width: 440px !important;
            border-radius: 24px !important;
          }
          .login-left-stage {
            display: none !important;
          }
          .login-right-col {
            padding: 32px 24px !important;
          }
        }
      `}</style>

      {/* Background Ambient Glows */}
      <div style={{
        position: 'absolute', top: -80, left: -80, width: 450, height: 450, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(245, 158, 11, 0.08) 0%, transparent 70%)', pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute', bottom: -100, right: -80, width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, transparent 70%)', pointerEvents: 'none'
      }} />

      {/* Main Split-Screen Container */}
      <div className="login-split-card" style={{
        background: '#ffffff',
        borderRadius: 28,
        boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.08), 0 0 0 1px #e2e8f0',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 10
      }}>

        {/* LEFT COLUMN: Clean Studio Stage with Ground Shadow (Matching Reference) */}
        <div
          ref={leftColRef}
          className="login-left-stage"
          style={{
            background: '#eef2f6',
            padding: '36px 32px 28px',
            flexDirection: 'column',
            justifyContent: 'space-between',
            borderRight: '1px solid #e2e8f0',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Top Brand Header (Prominent Logo & Brand Identity) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ position: 'relative' }}>
                <img
                  src="/brand-logo.jpg"
                  alt="MathsPS"
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '2.5px solid #ffffff',
                    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.08)'
                  }}
                />
                <span style={{
                  position: 'absolute', bottom: -2, right: -2,
                  width: 14, height: 14, borderRadius: '50%',
                  background: '#10b981', border: '2px solid #ffffff'
                }} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18, fontWeight: 900, color: '#090d16', letterSpacing: '-0.4px' }}>
                    MathsPS
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 800, background: '#fef3c7', color: '#b45309',
                    padding: '2px 7px', borderRadius: 6, textTransform: 'uppercase'
                  }}>
                    Portal
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#475569', fontWeight: 600, marginTop: 1 }}>
                  Prabuddha Sampath · Higher Education Institute
                </div>
              </div>
            </div>

            {/* Live System Status Pill */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#ffffff', border: '1px solid #d1fae5',
              padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, color: '#047857',
              boxShadow: '0 2px 6px rgba(16, 185, 129, 0.08)'
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%', background: '#10b981',
                boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.3), 0 0 8px #10b981'
              }} />
              Live
            </div>
          </div>

          {/* HIGH RESOLUTION ANIMATED MASCOT ILLUSTRATION WITH FLAT BASE & DIFFUSE SHADOW */}
          <div
            onClick={handleMascotSecretClick}
            style={{
              margin: '20px 0 10px',
              minHeight: 250,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              position: 'relative',
              cursor: 'pointer'
            }}
            title="Click the characters to reveal/hide Office Workstations"
          >
            {/* 1. Multi-Stage Studio Ground Lighting & Diffuse Contact Shadow */}
            {/* Outer soft ambient halo */}
            <div style={{
              position: 'absolute',
              bottom: -4,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 360,
              height: 24,
              borderRadius: '50%',
              background: 'radial-gradient(ellipse at center, rgba(100, 116, 139, 0.18) 0%, rgba(100, 116, 139, 0.05) 55%, transparent 75%)',
              filter: 'blur(8px)',
              pointerEvents: 'none',
              zIndex: 1
            }} />
            {/* Direct contact shadow under characters */}
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 290,
              height: 10,
              borderRadius: '50%',
              background: 'radial-gradient(ellipse at center, rgba(15, 23, 42, 0.28) 0%, rgba(15, 23, 42, 0.08) 60%, transparent 80%)',
              filter: 'blur(3px)',
              pointerEvents: 'none',
              zIndex: 2
            }} />

            {/* 2. ACTIVE MASCOT GROUP (Crisp modern 3D vector styling) */}
            <div style={{
              position: 'relative',
              width: 340,
              height: 200,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              transform: mascotClicked ? 'scale(1.06) translateY(-8px)' : 'none',
              transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
              zIndex: 5
            }}>

              {/* 1. ORANGE HALF-CIRCLE CHARACTER (Left) */}
              <div style={{
                position: 'absolute',
                left: 12,
                bottom: 0,
                width: 140,
                height: 78,
                background: 'linear-gradient(180deg, #fb923c 0%, #f97316 60%, #ea580c 100%)',
                borderTopLeftRadius: 78,
                borderTopRightRadius: 78,
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: 0,
                boxShadow: '0 8px 24px rgba(234, 88, 12, 0.25), inset 0 2px 4px rgba(255, 255, 255, 0.35)',
                transform: `translateX(${mousePos.x * 4}px) translateY(${isTypingPassword ? 14 : mascotClicked ? -8 : 0}px) scale(${isTypingPassword ? 0.95 : 1})`,
                transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                zIndex: 4
              }}>
                {/* Orange Eyes */}
                <div style={{
                  position: 'absolute',
                  top: 36,
                  right: 36,
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center',
                  transform: `translate(${eyeX * 0.7}px, ${eyeY * 0.7}px)`,
                  transition: 'transform 0.12s ease-out'
                }}>
                  {isTypingPassword ? (
                    <>
                      <div style={{ width: 8, height: 2.5, background: '#1e293b', borderRadius: 2 }} />
                      <div style={{ width: 8, height: 2.5, background: '#1e293b', borderRadius: 2 }} />
                    </>
                  ) : (
                    <>
                      <div style={{ width: 6.5, height: 6.5, borderRadius: '50%', background: '#090d16' }} />
                      <div style={{ width: 6.5, height: 6.5, borderRadius: '50%', background: '#090d16' }} />
                    </>
                  )}
                </div>

                {/* Subtle Mouth */}
                <div style={{
                  position: 'absolute',
                  top: 52,
                  right: 42,
                  width: 10,
                  height: 3,
                  borderTop: '2px solid #090d16',
                  borderRadius: '3px 3px 0 0',
                  transform: isHoveringSubmit || showWorkstations ? 'scaleY(-1) translateY(-2px)' : 'none'
                }} />
              </div>

              {/* 2. PURPLE TALL LEADER CHARACTER (Center-Left) */}
              <div style={{
                position: 'absolute',
                left: 85,
                bottom: 0,
                width: 98,
                height: isTypingPassword ? 135 : 175,
                background: 'linear-gradient(180deg, #818cf8 0%, #6366f1 55%, #4f46e5 100%)',
                borderTopLeftRadius: 36,
                borderTopRightRadius: 36,
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: 0,
                boxShadow: '0 14px 32px rgba(99, 102, 241, 0.3), inset 0 2px 4px rgba(255, 255, 255, 0.35)',
                transform: `rotate(${bodyLean}deg) translateY(${isHoveringSubmit || mascotClicked ? -8 : 0}px)`,
                transformOrigin: 'bottom center',
                transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                zIndex: 2
              }}>
                {/* Purple Eyes */}
                <div style={{
                  position: 'absolute',
                  top: 36,
                  left: 28,
                  display: 'flex',
                  gap: 16,
                  alignItems: 'center',
                  transform: `translate(${eyeX}px, ${eyeY}px)`,
                  transition: 'transform 0.1s ease-out'
                }}>
                  {isTypingPassword ? (
                    <div style={{ display: 'flex', gap: 14 }}>
                      <span style={{ fontSize: 13, fontWeight: 900, color: '#ffffff', lineHeight: 1 }}>&gt;</span>
                      <span style={{ fontSize: 13, fontWeight: 900, color: '#ffffff', lineHeight: 1 }}>&lt;</span>
                    </div>
                  ) : (
                    <>
                      <div style={{
                        width: 9, height: 9, borderRadius: '50%', background: '#ffffff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        <div style={{ width: 4.5, height: 4.5, borderRadius: '50%', background: '#090d16' }} />
                      </div>
                      <div style={{
                        width: 9, height: 9, borderRadius: '50%', background: '#ffffff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        <div style={{ width: 4.5, height: 4.5, borderRadius: '50%', background: '#090d16' }} />
                      </div>
                    </>
                  )}
                </div>

                {/* Purple Mouth */}
                <div style={{
                  position: 'absolute',
                  top: 56,
                  left: 42,
                  width: 12,
                  height: 4,
                  borderBottom: isHoveringSubmit || showWorkstations ? '2.5px solid #ffffff' : 'none',
                  borderTop: isHoveringSubmit || showWorkstations ? 'none' : '2.5px solid #ffffff',
                  borderRadius: isHoveringSubmit || showWorkstations ? '0 0 6px 6px' : '6px 6px 0 0',
                  transform: `translateX(${eyeX * 0.4}px)`
                }} />
              </div>

              {/* 3. BLACK TOWER MASCOT (Center-Right) */}
              <div style={{
                position: 'absolute',
                left: 162,
                bottom: 0,
                width: 62,
                height: 125,
                background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 60%, #020617 100%)',
                borderTopLeftRadius: 18,
                borderTopRightRadius: 18,
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: 0,
                boxShadow: '0 10px 25px rgba(0,0,0,0.35), inset 0 1.5px 2px rgba(255, 255, 255, 0.15)',
                transform: `rotate(${mousePos.x * -3}deg)`,
                transformOrigin: 'bottom center',
                transition: 'all 0.25s ease-out',
                zIndex: 3
              }}>
                {/* Black Eyes */}
                <div style={{
                  position: 'absolute',
                  top: 26,
                  left: 16,
                  display: 'flex',
                  gap: 10,
                  transform: `translate(${eyeX * 0.8}px, ${eyeY * 0.8}px)`
                }}>
                  <div style={{
                    width: 7.5, height: 7.5, borderRadius: '50%', background: '#ffffff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <div style={{ width: 3.5, height: 3.5, borderRadius: '50%', background: '#090d16' }} />
                  </div>
                  <div style={{
                    width: 7.5, height: 7.5, borderRadius: '50%', background: '#ffffff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <div style={{ width: 3.5, height: 3.5, borderRadius: '50%', background: '#090d16' }} />
                  </div>
                </div>
              </div>

              {/* 4. YELLOW CURIOUS MASCOT (Right) */}
              <div style={{
                position: 'absolute',
                left: 205,
                bottom: 0,
                width: 76,
                height: 110,
                background: 'linear-gradient(180deg, #fde047 0%, #eab308 60%, #ca8a04 100%)',
                borderTopLeftRadius: 38,
                borderTopRightRadius: 38,
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: 0,
                boxShadow: '0 8px 24px rgba(234, 179, 8, 0.28), inset 0 2px 4px rgba(255, 255, 255, 0.45)',
                transform: `translateX(${mousePos.x * 5}px) scaleY(${isHoveringSubmit || showWorkstations ? 1.05 : 1})`,
                transformOrigin: 'bottom center',
                transition: 'all 0.2s ease-out',
                zIndex: 5
              }}>
                {/* Yellow Eye & Beak/Smile */}
                <div style={{
                  position: 'absolute',
                  top: 28,
                  right: 22,
                  transform: `translate(${eyeX * 0.9}px, ${eyeY * 0.9}px)`
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#090d16' }} />
                  {/* Beak */}
                  <div style={{
                    width: 14,
                    height: 2.5,
                    background: '#090d16',
                    marginTop: 8,
                    borderRadius: 2,
                    transform: isHoveringSubmit || showWorkstations ? 'rotate(-10deg)' : 'none',
                    transition: 'transform 0.15s ease'
                  }} />
                </div>
              </div>

            </div>
          </div>



          {/* Active Team Members Panel (Appears on Mascot Click) */}
          {showWorkstations ? (
            <div style={{
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              borderRadius: 18,
              padding: '14px 16px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 8px 24px -4px rgba(15, 23, 42, 0.08)',
              animation: 'fadeIn 0.25s ease-out'
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 10, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b'
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6' }} />
                  Team Members
                </span>
                <span style={{ color: '#2563eb', fontSize: 11, fontWeight: 700 }}>
                  {dbMembers.length > 0 ? `${dbMembers.length} Active` : 'MathsPS Team'}
                </span>
              </div>

              {/* Clickable Staff Desk Pills */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(115px, 1fr))',
                gap: 6,
                maxHeight: 115,
                overflowY: 'auto',
                paddingRight: 4
              }}>
                {[...(dbMembers.length > 0 ? dbMembers : TEAM_MEMBERS)].map((m: any) => {
                  const info = getMemberDisplayRole(m)
                  const isSelected = email === m.email
                  const memberName = m.name === 'Admin User' ? 'Prabuddha (Admin)' : m.name
                  const mNameLower = (m.name || '').toLowerCase().trim()
                  const mEmailPrefix = (m.email || '').split('@')[0].toLowerCase().trim()
                  const isWorkerActive = onlineMemberNames.has(mNameLower) || onlineMemberNames.has(mEmailPrefix) || m.name === 'Admin User'

                  return (
                    <button
                      key={m.id || m.email}
                      type="button"
                      onClick={() => handleSelectMember(m)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 10,
                        background: isSelected ? 'rgba(37, 99, 235, 0.08)' : '#ffffff',
                        border: isSelected ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                        color: isSelected ? '#1d4ed8' : '#1e293b',
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                        boxShadow: isSelected ? '0 2px 8px rgba(37, 99, 235, 0.15)' : 'none'
                      }}
                    >
                      <span style={{ textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {memberName}
                      </span>
                      {isWorkerActive ? (
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981', flexShrink: 0 }} />
                      ) : (
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#cbd5e1', flexShrink: 0 }} />
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Selected Member Indicator */}
              {selectedMember && (
                <div style={{
                  marginTop: 8,
                  padding: '6px 10px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  fontSize: 11,
                  color: '#334155',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <span>Selected: <strong style={{ textTransform: 'capitalize' }}>{selectedMember.name}</strong></span>
                  <span style={{ color: selectedMember.color, fontWeight: 700 }}>{selectedMember.roleLabel}</span>
                </div>
              )}
            </div>
          ) : (
            <div
              onClick={handleMascotSecretClick}
              style={{
                textAlign: 'center',
                padding: '8px 12px',
                fontSize: 11.5,
                color: '#64748b',
                cursor: 'pointer',
                userSelect: 'none',
                borderRadius: 12,
                transition: 'color 0.2s',
                fontWeight: 500,
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#1e293b'}
              onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
            >
              MathsPS Higher Education Institute · Sri Lanka
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Clean Auth Console (MathsPS Branded) */}
        <div className="login-right-col" style={{
          padding: '44px 38px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: '#ffffff'
        }}>
          {/* MathsPS Brand Badge & Header */}
          <div style={{ marginBottom: 24 }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              padding: '4px 10px',
              borderRadius: 20,
              marginBottom: 16
            }}>
              <img
                src="/brand-logo.jpg"
                alt="MathsPS"
                style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover' }}
              />
              <span style={{ fontSize: 11.5, fontWeight: 800, color: '#090d16', letterSpacing: '-0.2px' }}>
                MathsPS CRM &amp; LMS
              </span>
            </div>
            <h2 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 6px', color: '#090d16', letterSpacing: '-0.5px' }}>
              Welcome back!
            </h2>
            <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
              Please enter your staff credentials to enter the system
            </p>
          </div>

          {infoBanner && (
            <div style={{
              padding: '9px 12px', background: '#fffbeb', border: '1px solid #fef3c7',
              borderRadius: 8, color: '#d97706', fontSize: 12, marginBottom: 16
            }}>
              {infoBanner}
            </div>
          )}

          {error && (
            <div style={{
              padding: '9px 12px', background: '#fef2f2', border: '1px solid #fee2e2',
              borderRadius: 8, color: '#dc2626', fontSize: 12, marginBottom: 16
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* Form with Clean Border-Bottom / Modern Rounded Inputs */}
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Email Field */}
            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                Email
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setSelectedMember(null) }}
                  onFocus={() => setIsTypingEmail(true)}
                  onBlur={() => setIsTypingEmail(false)}
                  required
                  placeholder="name@mathsps.com"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    background: '#ffffff',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: 12,
                    color: '#090d16',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#cbd5e1'}
                  onMouseLeave={e => { if (document.activeElement !== e.currentTarget) e.currentTarget.style.borderColor = '#e2e8f0' }}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onFocus={() => setIsTypingPassword(true)}
                  onBlur={() => setIsTypingPassword(false)}
                  required
                  placeholder="••••••••••••"
                  style={{
                    width: '100%',
                    padding: '12px 42px 12px 14px',
                    background: '#ffffff',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: 12,
                    color: '#090d16',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#cbd5e1'}
                  onMouseLeave={e => { if (document.activeElement !== e.currentTarget) e.currentTarget.style.borderColor = '#e2e8f0' }}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Action Pill Button (Matching Reference) */}
            <button
              type="submit"
              disabled={loading}
              onMouseEnter={() => setIsHoveringSubmit(true)}
              onMouseLeave={() => setIsHoveringSubmit(false)}
              style={{
                marginTop: 6,
                padding: '13px 20px',
                background: '#090d16',
                color: '#ffffff',
                border: 'none',
                borderRadius: 24,
                fontSize: 14.5,
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 6px 20px rgba(9, 13, 22, 0.18)',
                opacity: loading ? 0.7 : 1,
                transition: 'all 0.2s ease',
                transform: isHoveringSubmit ? 'translateY(-1px)' : 'none'
              }}
            >
              {loading ? 'Authenticating...' : 'Log in'}
            </button>
          </form>

          {/* Footer Security Badge */}
          <div style={{
            marginTop: 26,
            paddingTop: 16,
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 11,
            color: '#475569'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Shield size={12} style={{ color: '#047857' }} />
              <span>Enterprise Encrypted</span>
            </div>
            <span>MathsPS Portal</span>
          </div>
        </div>

      </div>
    </div>
  )
}
