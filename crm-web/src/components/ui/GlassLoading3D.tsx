'use client'

import React, { useEffect, useState } from 'react'

interface LoadingProps {
  message?: string
  subMessage?: string
}

export default function GlassLoading3D({
  message = 'Loading analytics & ledger…',
  subMessage = 'Connecting to real-time database'
}: LoadingProps) {
  const [progress, setProgress] = useState(15)
  const [stepText, setStepText] = useState('Fetching live financial ledgers...')

  useEffect(() => {
    const steps = [
      { p: 30, text: 'Verifying authenticated session...' },
      { p: 55, text: 'Aggregating daily student collections...' },
      { p: 80, text: 'Synchronizing real-time websocket channels...' },
      { p: 95, text: 'Finalizing charts and analytics...' }
    ]

    let idx = 0
    const interval = setInterval(() => {
      if (idx < steps.length) {
        setProgress(steps[idx].p)
        setStepText(steps[idx].text)
        idx++
      }
    }, 1100)

    return () => clearInterval(interval)
  }, [])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '65vh',
        width: '100%',
        perspective: '1000px',
        userSelect: 'none',
      }}
    >
      {/* 3D Floating Isometric Cube Scene */}
      <div
        style={{
          width: 90,
          height: 90,
          position: 'relative',
          transformStyle: 'preserve-3d',
          animation: 'cube3dSpin 5s infinite cubic-bezier(0.4, 0, 0.2, 1)',
          marginBottom: 36,
        }}
      >
        {/* Glow halo behind 3D core */}
        <div
          style={{
            position: 'absolute',
            inset: -20,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(14, 165, 233, 0.35) 0%, rgba(99, 102, 241, 0.15) 50%, transparent 70%)',
            filter: 'blur(16px)',
            transform: 'translateZ(-40px)',
          }}
        />

        {/* 6 Cube Faces with Liquid Glass Gradient */}
        {/* Front */}
        <div
          style={{
            position: 'absolute',
            width: 90,
            height: 90,
            background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.45), rgba(59, 130, 246, 0.2))',
            border: '1.5px solid rgba(56, 189, 248, 0.6)',
            boxShadow: '0 0 24px rgba(14, 165, 233, 0.35) inset',
            backdropFilter: 'blur(8px)',
            borderRadius: 16,
            transform: 'translateZ(45px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 12px #38bdf8' }} />
        </div>

        {/* Back */}
        <div
          style={{
            position: 'absolute',
            width: 90,
            height: 90,
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.35), rgba(168, 85, 247, 0.2))',
            border: '1.5px solid rgba(129, 140, 248, 0.45)',
            boxShadow: '0 0 24px rgba(99, 102, 241, 0.3) inset',
            backdropFilter: 'blur(8px)',
            borderRadius: 16,
            transform: 'rotateY(180deg) translateZ(45px)',
          }}
        />

        {/* Right */}
        <div
          style={{
            position: 'absolute',
            width: 90,
            height: 90,
            background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.4), rgba(14, 165, 233, 0.2))',
            border: '1.5px solid rgba(96, 165, 250, 0.55)',
            boxShadow: '0 0 24px rgba(37, 99, 235, 0.35) inset',
            backdropFilter: 'blur(8px)',
            borderRadius: 16,
            transform: 'rotateY(90deg) translateZ(45px)',
          }}
        />

        {/* Left */}
        <div
          style={{
            position: 'absolute',
            width: 90,
            height: 90,
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.35), rgba(14, 165, 233, 0.2))',
            border: '1.5px solid rgba(52, 211, 153, 0.5)',
            boxShadow: '0 0 24px rgba(16, 185, 129, 0.3) inset',
            backdropFilter: 'blur(8px)',
            borderRadius: 16,
            transform: 'rotateY(-90deg) translateZ(45px)',
          }}
        />

        {/* Top */}
        <div
          style={{
            position: 'absolute',
            width: 90,
            height: 90,
            background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.5), rgba(14, 165, 233, 0.3))',
            border: '1.5px solid rgba(125, 211, 252, 0.65)',
            boxShadow: '0 0 24px rgba(56, 189, 248, 0.4) inset',
            backdropFilter: 'blur(8px)',
            borderRadius: 16,
            transform: 'rotateX(90deg) translateZ(45px)',
          }}
        />

        {/* Bottom */}
        <div
          style={{
            position: 'absolute',
            width: 90,
            height: 90,
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9))',
            border: '1.5px solid rgba(71, 85, 105, 0.4)',
            borderRadius: 16,
            transform: 'rotateX(-90deg) translateZ(45px)',
          }}
        />

        {/* Inner Floating Gyro Ring */}
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: 20,
            width: 50,
            height: 50,
            borderRadius: '50%',
            border: '2px dashed #38bdf8',
            transform: 'translateZ(0px)',
            animation: 'gyroRotate 3s linear infinite',
          }}
        />
      </div>

      {/* Progress & Label Typography */}
      <div style={{ textAlign: 'center', maxWidth: 360, width: '100%', padding: '0 16px' }}>
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '-0.3px',
            marginBottom: 6,
          }}
        >
          {message}
        </div>
        <div
          style={{
            fontSize: 12.5,
            color: 'var(--text-muted)',
            fontWeight: 500,
            marginBottom: 16,
            minHeight: 18,
            transition: 'all 0.3s ease',
          }}
        >
          {stepText}
        </div>

        {/* Premium Neon Progress Bar */}
        <div
          style={{
            width: '100%',
            height: 6,
            background: 'rgba(51, 65, 85, 0.3)',
            borderRadius: 10,
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            position: 'relative',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              borderRadius: 10,
              background: 'linear-gradient(90deg, #0ea5e9, #38bdf8, #6366f1)',
              boxShadow: '0 0 12px rgba(56, 189, 248, 0.8)',
              transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 8,
            fontSize: 11,
            color: 'var(--text-muted)',
            opacity: 0.8,
          }}
        >
          <span>{subMessage}</span>
          <span style={{ fontWeight: 700, color: '#38bdf8' }}>{progress}%</span>
        </div>
      </div>

      {/* Embedded 3D Keyframe Animations */}
      <style jsx>{`
        @keyframes cube3dSpin {
          0% {
            transform: rotateX(-22deg) rotateY(0deg) rotateZ(0deg);
          }
          50% {
            transform: rotateX(25deg) rotateY(180deg) rotateZ(12deg);
          }
          100% {
            transform: rotateX(-22deg) rotateY(360deg) rotateZ(0deg);
          }
        }
        @keyframes gyroRotate {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  )
}
