'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Building2, ChevronUp, ChevronDown, Compass, Sparkles, X } from 'lucide-react'

interface FloorItem {
  floor: number
  label: string
  subtitle: string
  path: string
  color: string
}

const FLOORS: FloorItem[] = [
  { floor: 5, label: 'Executive Penthouse', subtitle: 'Analytics & Automation', path: '/reports', color: '#f59e0b' },
  { floor: 4, label: 'Cash Vault & Logistics', subtitle: 'Payments & Delivery', path: '/payments/add', color: '#10b981' },
  { floor: 3, label: 'Student Pavilion', subtitle: 'Enrollment & Directory', path: '/students', color: '#38bdf8' },
  { floor: 2, label: 'Telephony & Call Center', subtitle: 'Leads & Inquiries', path: '/leads', color: '#818cf8' },
  { floor: 1, label: 'Reception & Main Lobby', subtitle: 'Dashboard Overview', path: '/dashboard', color: '#c084fc' },
]

export default function VirtualElevatorWidget() {
  const router = useRouter()
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [transitAnimation, setTransitAnimation] = useState(false)
  const [destinationLabel, setDestinationLabel] = useState('')

  // Determine current floor based on URL
  const currentFloorItem = FLOORS.find(f => {
    if (f.path === '/dashboard' && pathname === '/dashboard') return true
    if (f.path !== '/dashboard' && pathname.startsWith(f.path)) return true
    return false
  }) || FLOORS[4] // default Floor 1

  function handleFloorSelect(targetFloor: FloorItem) {
    if (targetFloor.path === pathname) {
      setIsOpen(false)
      return
    }

    setDestinationLabel(`Elevator moving to Floor ${targetFloor.floor} · ${targetFloor.label}...`)
    setTransitAnimation(true)
    setIsOpen(false)

    setTimeout(() => {
      router.push(targetFloor.path)
      setTimeout(() => {
        setTransitAnimation(false)
      }, 400)
    }, 450)
  }

  return (
    <>
      {/* 1. Interactive Elevator Floating Trigger Button (Bottom Right) */}
      <div style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9990,
      }}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 18px',
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.95) 100%)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            borderRadius: 30,
            color: '#ffffff',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.45), 0 0 16px rgba(56, 189, 248, 0.25)',
            cursor: 'pointer',
            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: isOpen ? 'scale(0.96)' : 'scale(1)',
          }}
          title="Open Virtual Office Elevator"
        >
          <div style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #0284c7, #38bdf8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: 13,
            color: '#ffffff',
            boxShadow: '0 0 10px rgba(56, 189, 248, 0.6)'
          }}>
            {currentFloorItem.floor}
          </div>

          <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', fontWeight: 700 }}>
              Virtual Lift
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc', whiteSpace: 'nowrap' }}>
              Floor {currentFloorItem.floor} · {currentFloorItem.label.split(' ')[0]}
            </span>
          </div>

          <Compass size={16} style={{ color: '#38bdf8', marginLeft: 4 }} />
        </button>
      </div>

      {/* 2. Interactive Elevator Control Panel Modal */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: 84,
          right: 24,
          zIndex: 9995,
          width: 310,
          background: 'rgba(15, 23, 42, 0.88)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          border: '1px solid rgba(255, 255, 255, 0.22)',
          borderRadius: 20,
          padding: '20px 18px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          color: '#ffffff',
          animation: 'fadeSlideUp 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
              <span style={{ fontWeight: 800, fontSize: 13, letterSpacing: '0.2px' }}>🏢 HQ Elevator Control</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}
            >
              <X size={16} />
            </button>
          </div>

          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12 }}>
            Select destination floor to navigate:
          </div>

          {/* Floor Buttons Stack */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {FLOORS.map(f => {
              const isActive = f.floor === currentFloorItem.floor
              return (
                <button
                  key={f.floor}
                  onClick={() => handleFloorSelect(f)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 12,
                    background: isActive ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    border: isActive ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                    color: '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: isActive ? '0 0 18px rgba(56, 189, 248, 0.3)' : 'none',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      background: isActive ? '#0284c7' : 'rgba(255, 255, 255, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: 13,
                      color: isActive ? '#ffffff' : '#cbd5e1'
                    }}>
                      0{f.floor}
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc' }}>{f.label}</div>
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>{f.subtitle}</div>
                    </div>
                  </div>

                  {isActive && (
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#38bdf8', background: 'rgba(56, 189, 248, 0.15)', padding: '2px 8px', borderRadius: 10 }}>
                      Current
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* 3. Elevator Transition Screen Overlay */}
      {transitAnimation && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          background: 'rgba(15, 23, 42, 0.94)',
          backdropFilter: 'blur(30px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          animation: 'fadeIn 0.2s ease'
        }}>
          <div style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: 'rgba(56, 189, 248, 0.15)',
            border: '2px solid #38bdf8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
            boxShadow: '0 0 30px rgba(56, 189, 248, 0.4)',
            animation: 'pulse 1s infinite alternate'
          }}>
            <Building2 size={32} style={{ color: '#38bdf8' }} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '0.3px', marginBottom: 6 }}>
            {destinationLabel}
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            MathsPS High-Speed Virtual Elevator in Transit...
          </div>
        </div>
      )}
    </>
  )
}
