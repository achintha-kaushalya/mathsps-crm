'use client'

import React, { useEffect, useState, useRef } from 'react'

interface LoadingProps {
  isLoading?: boolean
  onComplete?: () => void
  minDurationMs?: number
}

type Phase = 'call' | 'dispatch' | 'delivered'

export default function PhoneDeliveryLoading({
  isLoading = true,
  onComplete,
  minDurationMs = 2800
}: LoadingProps) {
  const [percent, setPercent] = useState(0)
  const [phase, setPhase] = useState<Phase>('call')
  const [isExiting, setIsExiting] = useState(false)
  const [shouldUnmount, setShouldUnmount] = useState(false)

  // Track mount timestamp and data ready state
  const mountTimeRef = useRef(performance.now())
  const dataReadyRef = useRef(!isLoading)
  dataReadyRef.current = !isLoading

  useEffect(() => {
    let animId: number
    mountTimeRef.current = performance.now()

    const step = (now: number) => {
      const elapsed = now - mountTimeRef.current
      const isDataReady = dataReadyRef.current

      setPercent(prev => {
        let target = prev

        if (!isDataReady) {
          // If real data is still fetching, smoothly progress up to ~85% over minDurationMs
          const progress = Math.min(1, elapsed / minDurationMs)
          target = Math.floor(progress * 85)
        } else {
          // Data is finished! Fast forward to 100% smoothly
          target = Math.min(100, prev + 3)
        }

        const nextPercent = Math.max(prev, target)

        // Phase calculations
        if (nextPercent < 45) {
          setPhase('call')
        } else if (nextPercent < 88) {
          setPhase('dispatch')
        } else {
          setPhase('delivered')
        }

        return nextPercent
      })

      // Continue animating until 100% is reached AND data is ready
      if (!dataReadyRef.current || percent < 100) {
        animId = requestAnimationFrame(step)
      }
    }

    animId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(animId)
  }, [minDurationMs])

  // Trigger smooth transition once 100% is hit
  useEffect(() => {
    if (percent >= 100 && !isLoading && !isExiting) {
      // Small pause to let user see "Delivered to Student • 100%"
      const pauseTimer = setTimeout(() => {
        setIsExiting(true)
        setTimeout(() => {
          setShouldUnmount(true)
          if (onComplete) onComplete()
        }, 550) // Matches CSS transition duration
      }, 400)
      return () => clearTimeout(pauseTimer)
    }
  }, [percent, isLoading, isExiting, onComplete])

  if (shouldUnmount) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: '#090d16',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        overflow: 'hidden',
        opacity: isExiting ? 0 : 1,
        transform: isExiting ? 'scale(1.02)' : 'scale(1)',
        pointerEvents: isExiting ? 'none' : 'auto',
        transition: 'opacity 0.55s cubic-bezier(0.16, 1, 0.3, 1), transform 0.55s cubic-bezier(0.16, 1, 0.3, 1)',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Ambient Center Glow */}
      <div
        style={{
          position: 'absolute',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: phase === 'call'
            ? 'radial-gradient(circle, rgba(16, 185, 129, 0.12) 0%, transparent 70%)'
            : phase === 'dispatch'
            ? 'radial-gradient(circle, rgba(59, 130, 246, 0.14) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(16, 185, 129, 0.18) 0%, transparent 70%)',
          filter: 'blur(50px)',
          transition: 'background 0.8s ease',
          pointerEvents: 'none',
        }}
      />

      {/* ── CORE BORDERLESS SEAMLESS CANVAS ── */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Animated Icon Stage */}
        <div
          style={{
            position: 'relative',
            width: 200,
            height: 120,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* ── 1. PHONE CALL PHASE (0% - 45%) ── */}
          {phase === 'call' && (
            <div className="anim-fade-scale" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ position: 'relative', width: 72, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="pure-ring ring-1" />
                <div className="pure-ring ring-2" />

                <div
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 28px rgba(16, 185, 129, 0.5)',
                    animation: 'phoneRing 1.1s ease-in-out infinite',
                  }}
                >
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                </div>
              </div>

              {/* Minimal Audio Voice Frequencies */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 18, marginTop: 14 }}>
                {[0.4, 0.9, 0.5, 1, 0.7, 0.3].map((val, idx) => (
                  <span
                    key={idx}
                    style={{
                      width: 3,
                      borderRadius: 2,
                      background: '#34d399',
                      height: `${val * 16}px`,
                      animation: 'barOscillate 0.7s ease-in-out infinite alternate',
                      animationDelay: `${idx * 0.12}s`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── 2. DISPATCH & COURIER PHASE (45% - 88%) ── */}
          {phase === 'dispatch' && (
            <div className="anim-fade-scale" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ position: 'relative', width: 140, height: 65, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="motion-streak s1" />
                <div className="motion-streak s2" />
                <div className="motion-streak s3" />

                <div
                  style={{
                    position: 'relative',
                    width: 68,
                    height: 48,
                    borderRadius: 14,
                    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 30px rgba(59, 130, 246, 0.5)',
                    animation: 'vehicleGlide 0.4s ease-in-out infinite alternate',
                  }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="3" width="15" height="13" />
                    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                    <circle cx="5.5" cy="18.5" r="2.5" />
                    <circle cx="18.5" cy="18.5" r="2.5" />
                  </svg>
                </div>
              </div>

              {/* Dotted Speed Path */}
              <div
                style={{
                  width: 130,
                  height: 2,
                  background: 'repeating-linear-gradient(90deg, #60a5fa 0, #60a5fa 6px, transparent 6px, transparent 12px)',
                  animation: 'roadFlow 0.5s linear infinite',
                  marginTop: 6,
                  opacity: 0.8,
                }}
              />
            </div>
          )}

          {/* ── 3. DELIVERED CHECKMARK (88% - 100%) ── */}
          {phase === 'delivered' && (
            <div className="anim-fade-scale" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div
                style={{
                  width: 62,
                  height: 62,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 32px rgba(16, 185, 129, 0.65)',
                  animation: 'successSpring 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* ── SINGLE ELEGANT STATUS LINE ── */}
        <div
          style={{
            marginTop: 18,
            fontSize: 14,
            fontWeight: 500,
            color: '#cbd5e1',
            letterSpacing: '0.2px',
            fontVariantNumeric: 'tabular-nums',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span>
            {phase === 'call' && 'Connecting Lead…'}
            {phase === 'dispatch' && 'Delivering Tutes…'}
            {phase === 'delivered' && 'Delivered to Student'}
          </span>
          <span style={{ color: '#64748b' }}>•</span>
          <span style={{ color: '#94a3b8', fontFamily: 'monospace', fontWeight: 600 }}>
            {percent}%
          </span>
        </div>

        {/* Thin Minimalist Glow Track */}
        <div
          style={{
            width: 140,
            height: 3,
            borderRadius: 999,
            background: 'rgba(255, 255, 255, 0.08)',
            marginTop: 12,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${percent}%`,
              background: phase === 'dispatch'
                ? '#38bdf8'
                : '#10b981',
              boxShadow: phase === 'dispatch'
                ? '0 0 8px rgba(56, 189, 248, 0.8)'
                : '0 0 8px rgba(16, 185, 129, 0.8)',
              transition: 'width 0.12s linear',
              borderRadius: 999,
            }}
          />
        </div>
      </div>

      {/* Ultra-smooth micro-animations */}
      <style jsx global>{`
        @keyframes phoneRing {
          0%, 100% { transform: rotate(0deg) scale(1); }
          15% { transform: rotate(-12deg) scale(1.04); }
          30% { transform: rotate(12deg) scale(1.04); }
          45% { transform: rotate(-8deg) scale(1.02); }
          60% { transform: rotate(8deg) scale(1.02); }
          75% { transform: rotate(0deg) scale(1); }
        }

        .pure-ring {
          position: absolute;
          border-radius: 50%;
          border: 1.5px solid rgba(16, 185, 129, 0.35);
          animation: ringPulse 1.6s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
          pointer-events: none;
        }
        .ring-1 {
          width: 68px;
          height: 68px;
        }
        .ring-2 {
          width: 88px;
          height: 88px;
          animation-delay: 0.4s;
        }
        @keyframes ringPulse {
          0% { transform: scale(0.7); opacity: 0.8; }
          100% { transform: scale(1.35); opacity: 0; }
        }

        @keyframes barOscillate {
          0% { transform: scaleY(0.35); }
          100% { transform: scaleY(1.25); }
        }

        @keyframes vehicleGlide {
          0% { transform: translateY(0); }
          100% { transform: translateY(-2.5px); }
        }

        .motion-streak {
          position: absolute;
          height: 1.5px;
          background: linear-gradient(to right, transparent, rgba(96, 165, 250, 0.8), transparent);
          border-radius: 999px;
          animation: streakAnim 0.6s linear infinite;
        }
        .s1 { top: 18px; left: 15px; width: 35px; animation-delay: 0.05s; }
        .s2 { top: 32px; left: 0px; width: 45px; animation-delay: 0.25s; }
        .s3 { top: 44px; left: 20px; width: 30px; animation-delay: 0.15s; }

        @keyframes streakAnim {
          0% { transform: translateX(25px); opacity: 0; }
          50% { opacity: 0.9; }
          100% { transform: translateX(-25px); opacity: 0; }
        }

        @keyframes roadFlow {
          0% { background-position: 0 0; }
          100% { background-position: -24px 0; }
        }

        @keyframes successSpring {
          0% { transform: scale(0.3); opacity: 0; }
          75% { transform: scale(1.12); }
          100% { transform: scale(1); opacity: 1; }
        }

        .anim-fade-scale {
          animation: animIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes animIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
