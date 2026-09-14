'use client'

import { useEffect, useState } from 'react'

interface LoadingScreenProps {
  message?: string
}

export default function LoadingScreen({ message = 'Loading…' }: LoadingScreenProps) {
  const [dots, setDots] = useState(0)
  const [isDark, setIsDark] = useState(false)
  const [activeTutor, setActiveTutor] = useState<'prabuddha' | 'sanduni'>('prabuddha')

  useEffect(() => {
    const t = setInterval(() => setDots(d => (d + 1) % 4), 380)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const theme = document.documentElement.getAttribute('data-theme')
      setIsDark(theme === 'dark')

      const tutor = localStorage.getItem('mathsps_active_tutor') || 'prabuddha'
      setActiveTutor(tutor === 'sanduni' ? 'sanduni' : 'prabuddha')
    }
  }, [])

  const dotStr = '.'.repeat(dots)
  const isSM = activeTutor === 'sanduni'

  return (
    <>
      <style>{`
        @keyframes loadFadeIn {
          from { opacity: 0; transform: scale(0.98); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes avatarPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 10px 25px -5px rgba(2, 132, 199, 0.25); }
          50%      { transform: scale(1.03); box-shadow: 0 15px 35px -5px rgba(2, 132, 199, 0.38); }
        }
        @keyframes avatarPulseSM {
          0%, 100% { transform: scale(1); box-shadow: 0 10px 25px -5px rgba(236, 72, 153, 0.25); }
          50%      { transform: scale(1.03); box-shadow: 0 15px 35px -5px rgba(236, 72, 153, 0.38); }
        }
        @keyframes spinRing {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes barSlideGlow {
          0%   { left: -50%; width: 40%; opacity: 0.6; }
          50%  { width: 60%; opacity: 1; }
          100% { left: 110%; width: 40%; opacity: 0.6; }
        }
        .load-screen-container {
          animation: loadFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .load-avatar-anim {
          animation: ${isSM ? 'avatarPulseSM' : 'avatarPulse'} 2.2s ease-in-out infinite;
        }
        .load-ring-spin {
          animation: spinRing 2s linear infinite;
        }
        .load-bar-anim {
          animation: barSlideGlow 1.4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
      `}</style>

      <div
        className="load-screen-container"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: isDark
            ? 'rgba(10, 14, 26, 0.94)'
            : 'rgba(248, 250, 252, 0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          transition: 'background 0.2s ease'
        }}
      >
        {/* Central Floating Card */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '36px 44px',
            background: isDark ? 'rgba(17, 24, 39, 0.85)' : 'rgba(255, 255, 255, 0.92)',
            border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #e2e8f0',
            borderRadius: 24,
            boxShadow: isDark
              ? '0 20px 50px -10px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05)'
              : '0 20px 50px -10px rgba(15, 23, 42, 0.08), 0 4px 16px -4px rgba(15, 23, 42, 0.04)',
            maxWidth: 340,
            width: '90%',
            textAlign: 'center'
          }}
        >
          {/* Avatar Ring Structure */}
          <div style={{ position: 'relative', width: 88, height: 88, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            {/* Spinning Gradient Border */}
            <svg
              className="load-ring-spin"
              width="88"
              height="88"
              viewBox="0 0 88 88"
              style={{ position: 'absolute', inset: 0 }}
            >
              <circle
                cx="44"
                cy="44"
                r="41"
                fill="none"
                stroke={isSM ? 'url(#smArcGrad)' : 'url(#psArcGrad)'}
                strokeWidth="2.5"
                strokeDasharray="65 190"
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="psArcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0284c7" />
                  <stop offset="60%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#818cf8" />
                </linearGradient>
                <linearGradient id="smArcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ec4899" />
                  <stop offset="60%" stopColor="#f472b6" />
                  <stop offset="100%" stopColor="#c084fc" />
                </linearGradient>
              </defs>
            </svg>

            {/* Avatar Image with Glow */}
            <div
              className="load-avatar-anim"
              style={{
                width: 68,
                height: 68,
                borderRadius: '50%',
                overflow: 'hidden',
                border: isDark ? '2px solid rgba(255, 255, 255, 0.15)' : '2px solid #ffffff',
                position: 'relative',
                zIndex: 2,
                background: '#ffffff'
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={isSM ? '/sanduni-profile.jpg' : '/brand-logo.jpg'}
                alt="MathsPS CRM"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'center top'
                }}
              />
            </div>
          </div>

          {/* Title & Brand */}
          <div style={{ fontSize: 18, fontWeight: 800, color: isDark ? '#f8fafc' : '#0f172a', letterSpacing: '-0.3px', marginBottom: 4 }}>
            MathsPS CRM
          </div>

          {/* Subtitle / Active Status */}
          <div style={{ fontSize: 12, fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b', marginBottom: 18 }}>
            {message}{dotStr}
          </div>

          {/* Clean Progress Track */}
          <div
            style={{
              width: '100%',
              maxWidth: 180,
              height: 4,
              borderRadius: 99,
              background: isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0',
              overflow: 'hidden',
              position: 'relative'
            }}
          >
            <div
              className="load-bar-anim"
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                borderRadius: 99,
                background: isSM
                  ? 'linear-gradient(90deg, transparent, #ec4899 50%, #f472b6 80%, transparent)'
                  : 'linear-gradient(90deg, transparent, #0284c7 50%, #38bdf8 80%, transparent)'
              }}
            />
          </div>
        </div>
      </div>
    </>
  )
}
