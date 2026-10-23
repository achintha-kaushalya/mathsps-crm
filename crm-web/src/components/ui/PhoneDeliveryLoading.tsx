'use client'

import React, { useEffect, useState } from 'react'
import { Phone, PhoneCall, Package, CheckCircle2, Truck, Navigation, Sparkles } from 'lucide-react'

interface LoadingProps {
  onComplete?: () => void
  durationMs?: number
}

type Phase = 'call' | 'dispatch' | 'delivered'

export default function PhoneDeliveryLoading({
  onComplete,
  durationMs = 4600
}: LoadingProps) {
  const [percent, setPercent] = useState(0)
  const [phase, setPhase] = useState<Phase>('call')
  const [isDone, setIsDone] = useState(false)

  useEffect(() => {
    const startTime = performance.now()

    const updateTimer = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(1, elapsed / durationMs)
      const currentPct = Math.min(100, Math.floor(progress * 100))
      
      setPercent(currentPct)

      if (currentPct < 38) {
        setPhase('call')
      } else if (currentPct < 82) {
        setPhase('dispatch')
      } else {
        setPhase('delivered')
      }

      if (progress < 1) {
        requestAnimationFrame(updateTimer)
      } else {
        setPercent(100)
        setTimeout(() => {
          setIsDone(true)
          if (onComplete) onComplete()
        }, 450)
      }
    }

    const animId = requestAnimationFrame(updateTimer)
    return () => cancelAnimationFrame(animId)
  }, [durationMs, onComplete])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'radial-gradient(ellipse 90% 80% at 50% 20%, #0d1527 0%, #060911 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        overflow: 'hidden',
        opacity: isDone ? 0 : 1,
        pointerEvents: isDone ? 'none' : 'auto',
        transition: 'opacity 0.55s cubic-bezier(0.16, 1, 0.3, 1)',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Background Subtle Tech Grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          maskImage: 'radial-gradient(ellipse 60% 50% at 50% 50%, #000 60%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 60% 50% at 50% 50%, #000 60%, transparent 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Main Narrative Stage Box */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 480,
          padding: '36px 28px',
          margin: '0 20px',
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 24,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 40px rgba(37, 99, 235, 0.12)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        {/* Top Floating Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 12px',
            borderRadius: 999,
            background: 'rgba(59, 130, 246, 0.12)',
            border: '1px solid rgba(59, 130, 246, 0.28)',
            color: '#60a5fa',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.8px',
            textTransform: 'uppercase',
            marginBottom: 28,
          }}
        >
          <Sparkles size={12} className="animate-spin" style={{ animationDuration: '4s' }} />
          Maths PS • Pipeline Sync
        </div>

        {/* ── CENTRAL DYNAMIC ANIMATION VIEWPORT ── */}
        <div
          style={{
            position: 'relative',
            width: 220,
            height: 140,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
          }}
        >
          {/* ──────── PHASE 1: PHONE CALL ──────── */}
          {phase === 'call' && (
            <div className="fade-scale-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {/* Sonar Ripple Rings */}
              <div style={{ position: 'relative', width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="sonar-ring sonar-1" />
                <div className="sonar-ring sonar-2" />
                
                {/* Central Ringing Phone Icon */}
                <div
                  style={{
                    position: 'relative',
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    boxShadow: '0 0 24px rgba(16, 185, 129, 0.45), inset 0 2px 4px rgba(255, 255, 255, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    animation: 'phoneWiggle 1s ease-in-out infinite',
                  }}
                >
                  <PhoneCall size={28} />
                </div>
              </div>

              {/* Dynamic Sound Wave Audio Frequency bars */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 28, marginTop: 14 }}>
                {[0.4, 0.8, 1, 0.6, 0.9, 0.5, 0.7, 0.3].map((scale, i) => (
                  <span
                    key={i}
                    style={{
                      width: 3.5,
                      borderRadius: 3,
                      background: 'linear-gradient(to top, #10b981, #34d399)',
                      animation: `audioBounce 0.8s ease-in-out infinite alternate`,
                      animationDelay: `${i * 0.1}s`,
                      height: `${12 + scale * 16}px`
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ──────── PHASE 2: COURIER DELIVERY ROAD TRIP ──────── */}
          {phase === 'dispatch' && (
            <div className="fade-scale-in" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {/* Van & Speed lines */}
              <div style={{ position: 'relative', width: '100%', height: 75, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {/* Moving Wind / Speed Trails */}
                <div className="speed-trail trail-1" />
                <div className="speed-trail trail-2" />
                <div className="speed-trail trail-3" />

                {/* Animated Delivery Van Icon Container */}
                <div
                  style={{
                    position: 'relative',
                    zIndex: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 76,
                    height: 52,
                    borderRadius: 14,
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    boxShadow: '0 8px 24px rgba(37, 99, 235, 0.5), inset 0 2px 4px rgba(255, 255, 255, 0.35)',
                    color: '#ffffff',
                    animation: 'truckBounce 0.35s ease-in-out infinite alternate',
                  }}
                >
                  <Truck size={32} />
                  {/* Package badge inside truck */}
                  <div
                    style={{
                      position: 'absolute',
                      top: -6,
                      right: -6,
                      background: '#f59e0b',
                      borderRadius: '50%',
                      width: 20,
                      height: 20,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 0 10px rgba(245, 158, 11, 0.7)',
                    }}
                  >
                    <Package size={11} color="#fff" />
                  </div>
                </div>
              </div>

              {/* Dotted Road Way with Highway Lines */}
              <div
                style={{
                  width: '90%',
                  height: 3,
                  background: 'repeating-linear-gradient(90deg, #3b82f6 0, #3b82f6 10px, transparent 10px, transparent 18px)',
                  animation: 'roadFlow 0.6s linear infinite',
                  marginTop: 8,
                  opacity: 0.7,
                }}
              />
            </div>
          )}

          {/* ──────── PHASE 3: DELIVERED & SUCCESS ──────── */}
          {phase === 'delivered' && (
            <div className="fade-scale-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div
                style={{
                  position: 'relative',
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
                  boxShadow: '0 0 32px rgba(16, 185, 129, 0.6), inset 0 2px 4px rgba(255, 255, 255, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  animation: 'popSuccess 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                }}
              >
                <CheckCircle2 size={40} />
              </div>
              <div
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  color: '#34d399',
                  fontWeight: 600,
                  letterSpacing: '0.4px',
                }}
              >
                Tutes Received & Verified
              </div>
            </div>
          )}
        </div>

        {/* ── DYNAMIC STATUS LABELS ── */}
        <div style={{ height: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h2
            style={{
              margin: 0,
              fontSize: 19,
              fontWeight: 800,
              color: '#f8fafc',
              letterSpacing: '-0.3px',
              transition: 'all 0.3s ease',
            }}
          >
            {phase === 'call' && 'Connecting Telemarketing Lead…'}
            {phase === 'dispatch' && 'Dispatching Tutes via Courier…'}
            {phase === 'delivered' && 'Delivered to Student!'}
          </h2>
          <p
            style={{
              margin: '5px 0 0',
              fontSize: 13,
              color: '#94a3b8',
              fontWeight: 500,
            }}
          >
            {phase === 'call' && 'Voice inquiry synced • Lead status confirmed'}
            {phase === 'dispatch' && 'Waybill created • Courier in-transit'}
            {phase === 'delivered' && 'LMS student access confirmed • Ready'}
          </p>
        </div>

        {/* ── PROGRESS BAR & STEP MILESTONES ── */}
        <div style={{ width: '100%', marginTop: 26 }}>
          {/* Glowing Continuous Bar */}
          <div
            style={{
              width: '100%',
              height: 6,
              borderRadius: 999,
              background: 'rgba(255, 255, 255, 0.08)',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${percent}%`,
                background: phase === 'delivered'
                  ? 'linear-gradient(90deg, #10b981, #34d399)'
                  : 'linear-gradient(90deg, #2563eb, #38bdf8)',
                boxShadow: '0 0 12px rgba(56, 189, 248, 0.7)',
                transition: 'width 0.1s linear',
                borderRadius: 999,
              }}
            />
          </div>

          {/* 3 Step Indicator Pills */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 14,
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {/* Step 1: Call */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                color: percent >= 20 ? '#34d399' : '#64748b',
                transition: 'color 0.3s ease',
              }}
            >
              <Phone size={12} />
              <span>1. Call</span>
            </div>

            {/* Step 2: Delivery */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                color: percent >= 45 ? '#38bdf8' : '#64748b',
                transition: 'color 0.3s ease',
              }}
            >
              <Navigation size={12} />
              <span>2. Delivery</span>
            </div>

            {/* Step 3: Success */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                color: percent >= 85 ? '#34d399' : '#64748b',
                transition: 'color 0.3s ease',
              }}
            >
              <CheckCircle2 size={12} />
              <span>3. Delivered</span>
            </div>
          </div>
        </div>

        {/* Monospace Numeric Counter */}
        <div
          style={{
            marginTop: 18,
            fontSize: 12,
            fontFamily: 'monospace',
            color: '#64748b',
            letterSpacing: '0.5px',
          }}
        >
          SYNCING LIVE LEDGERS • {percent}%
        </div>
      </div>

      {/* Embedded CSS Animations */}
      <style jsx global>{`
        @keyframes phoneWiggle {
          0%, 100% { transform: rotate(0deg) scale(1); }
          15% { transform: rotate(-14deg) scale(1.06); }
          30% { transform: rotate(14deg) scale(1.06); }
          45% { transform: rotate(-10deg) scale(1.04); }
          60% { transform: rotate(10deg) scale(1.04); }
          75% { transform: rotate(0deg) scale(1); }
        }

        .sonar-ring {
          position: absolute;
          border-radius: 50%;
          border: 2px solid rgba(16, 185, 129, 0.4);
          animation: sonarPulse 1.8s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
          pointer-events: none;
        }
        .sonar-1 {
          width: 80px;
          height: 80px;
        }
        .sonar-2 {
          width: 104px;
          height: 104px;
          animation-delay: 0.5s;
        }

        @keyframes sonarPulse {
          0% { transform: scale(0.65); opacity: 0.8; }
          100% { transform: scale(1.4); opacity: 0; }
        }

        @keyframes audioBounce {
          0% { transform: scaleY(0.4); }
          100% { transform: scaleY(1.3); }
        }

        @keyframes truckBounce {
          0% { transform: translateY(0); }
          100% { transform: translateY(-3px); }
        }

        .speed-trail {
          position: absolute;
          height: 2px;
          background: linear-gradient(to right, transparent, rgba(56, 189, 248, 0.8), transparent);
          border-radius: 999px;
          animation: speedFlow 0.7s linear infinite;
        }
        .trail-1 { top: 16px; left: 10px; width: 50px; animation-delay: 0.1s; }
        .trail-2 { top: 38px; left: -10px; width: 70px; animation-delay: 0.35s; }
        .trail-3 { top: 58px; left: 20px; width: 45px; animation-delay: 0.2s; }

        @keyframes speedFlow {
          0% { transform: translateX(40px); opacity: 0; }
          50% { opacity: 0.9; }
          100% { transform: translateX(-40px); opacity: 0; }
        }

        @keyframes roadFlow {
          0% { background-position: 0 0; }
          100% { background-position: -36px 0; }
        }

        @keyframes popSuccess {
          0% { transform: scale(0.4) rotate(-30deg); opacity: 0; }
          70% { transform: scale(1.15) rotate(5deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }

        .fade-scale-in {
          animation: fadeScale 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes fadeScale {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
