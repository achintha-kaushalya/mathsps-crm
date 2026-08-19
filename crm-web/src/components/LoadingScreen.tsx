'use client'

import { useEffect, useState } from 'react'

interface LoadingScreenProps {
  message?: string
}

export default function LoadingScreen({ message = 'Loading…' }: LoadingScreenProps) {
  const [dots, setDots] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setDots(d => (d + 1) % 4), 420)
    return () => clearInterval(t)
  }, [])

  const dotStr = '.'.repeat(dots)

  return (
    <>
      <style>{`
        @keyframes loadFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes loadFadeOut {
          from { opacity: 1; }
          to   { opacity: 0; }
        }
        @keyframes logoFloat {
          0%,100% { transform: translateY(0px) scale(1); }
          50%      { transform: translateY(-8px) scale(1.03); }
        }
        @keyframes ringPulse {
          0%   { transform: scale(0.85); opacity: 0.5; }
          50%  { transform: scale(1.15); opacity: 0.15; }
          100% { transform: scale(0.85); opacity: 0.5; }
        }
        @keyframes spinArc {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes barGlow {
          0%,100% { opacity: 0.6; }
          50%      { opacity: 1; }
        }
        .load-screen {
          animation: loadFadeIn 0.3s ease forwards;
        }
        .load-logo {
          animation: logoFloat 2.4s ease-in-out infinite;
        }
        .load-ring {
          animation: ringPulse 2s ease-in-out infinite;
        }
        .load-ring-2 {
          animation: ringPulse 2s ease-in-out infinite;
          animation-delay: 0.6s;
        }
        .load-arc {
          animation: spinArc 1.2s linear infinite;
          transform-origin: center;
        }
        .load-bar {
          animation: barGlow 1.4s ease-in-out infinite;
        }
      `}</style>

      <div
        className="load-screen"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(10, 14, 26, 0.92)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
        }}
      >
        {/* Pulse rings behind logo */}
        <div style={{ position: 'relative', width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 32 }}>
          <div className="load-ring" style={{
            position: 'absolute',
            width: 110, height: 110, borderRadius: '50%',
            border: '1.5px solid rgba(59,130,246,0.4)',
          }} />
          <div className="load-ring-2" style={{
            position: 'absolute',
            width: 130, height: 130, borderRadius: '50%',
            border: '1px solid rgba(139,92,246,0.25)',
          }} />

          {/* Spinning arc */}
          <svg className="load-arc" width="100" height="100" viewBox="0 0 100 100" style={{ position: 'absolute' }}>
            <circle
              cx="50" cy="50" r="46"
              fill="none"
              stroke="url(#arcGrad)"
              strokeWidth="2.5"
              strokeDasharray="72 216"
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>
          </svg>

          {/* Logo with brand photo */}
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            position: 'relative',
          }}>
            {/* Gradient ring */}
            <div style={{
              position: 'absolute', inset: -3, borderRadius: '50%',
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6, #ec4899)',
              zIndex: 0,
              boxShadow: '0 0 40px rgba(59,130,246,0.35), 0 0 80px rgba(139,92,246,0.2)',
            }} />
            <div style={{
              position: 'absolute', inset: -1, borderRadius: '50%',
              background: 'rgba(10,14,26,0.9)',
              zIndex: 1,
            }} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand-logo.jpg"
              alt="MathsPS"
              style={{
                width: 72, height: 72, borderRadius: '50%',
                objectFit: 'cover', objectPosition: 'center top',
                position: 'relative', zIndex: 2, display: 'block',
              }}
            />
          </div>
        </div>

        {/* Brand name */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px',
            background: 'linear-gradient(135deg, #f1f5f9 0%, #94a3b8 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>MathsPS CRM</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, letterSpacing: '0.05em' }}>
            {message}{dotStr}
          </div>
        </div>

        {/* Glass progress bar track */}
        <div style={{
          width: 180, height: 4, borderRadius: 99,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.08)',
          overflow: 'hidden',
          position: 'relative',
        }}>
          <div className="load-bar" style={{
            position: 'absolute', left: '-60%', width: '60%', height: '100%',
            background: 'linear-gradient(90deg, transparent, #3b82f6 40%, #8b5cf6 70%, transparent)',
            animation: 'barGlow 1.4s ease-in-out infinite, barSlide 1.6s ease-in-out infinite',
            borderRadius: 99,
          }} />
        </div>
        <style>{`
          @keyframes barSlide {
            from { left: -60%; }
            to   { left: 110%; }
          }
          .load-bar { animation: barSlide 1.6s ease-in-out infinite, barGlow 1.4s ease-in-out infinite; }
        `}</style>
      </div>
    </>
  )
}
