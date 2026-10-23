'use client'

import React, { useEffect, useState } from 'react'

interface LoadingProps {
  onComplete?: () => void
  durationMs?: number
}

export default function NeoLeafLoading({
  onComplete,
  durationMs = 4500
}: LoadingProps) {
  const [percent, setPercent] = useState(0)
  const [isDone, setIsDone] = useState(false)

  useEffect(() => {
    const startTime = performance.now()

    const updateTimer = (now: number) => {
      const elapsed = now - startTime
      const rawProgress = Math.min(1, elapsed / durationMs)
      
      // Smooth cubic easing for organic liquid feel
      const eased = 1 - Math.pow(1 - rawProgress, 3)
      const currentPct = Math.min(100, Math.floor(eased * 100))
      
      setPercent(currentPct)

      if (rawProgress < 1) {
        requestAnimationFrame(updateTimer)
      } else {
        setPercent(100)
        setTimeout(() => {
          setIsDone(true)
          if (onComplete) onComplete()
        }, 400)
      }
    }

    const animId = requestAnimationFrame(updateTimer)
    return () => cancelAnimationFrame(animId)
  }, [durationMs, onComplete])

  // Water level in SVG coordinates (viewBox height 240, text baseline centered around 140)
  // At 0%, waterLevel = 220 (below text). At 100%, waterLevel = -20 (completely submerged)
  const waterLevel = 210 - (percent / 100) * 220

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#121212',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        overflow: 'hidden',
        opacity: isDone ? 0 : 1,
        pointerEvents: isDone ? 'none' : 'auto',
        transition: 'opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 960,
          padding: '0 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative'
        }}
      >
        {/* SVG Liquid Fill Typography Engine */}
        <svg
          viewBox="0 0 860 220"
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
            overflow: 'visible',
          }}
        >
          <defs>
            {/* The bold, chunky silhouette for "Maths PS" */}
            <mask id="mathsps-text-mask">
              <text
                x="50%"
                y="155"
                textAnchor="middle"
                fill="#ffffff"
                style={{
                  fontFamily: 'Impact, "Arial Black", "Montserrat Black", sans-serif',
                  fontWeight: 900,
                  fontSize: 165,
                  letterSpacing: '-2px',
                }}
              >
                Maths PS
              </text>
            </mask>

            {/* Continuous rolling sine wave pattern */}
            <path
              id="fluid-wave"
              d={`
                M 0 0
                Q 100 22 200 0
                T 400 0
                T 600 0
                T 800 0
                T 1000 0
                T 1200 0
                V 300
                H 0
                Z
              `}
            />

            {/* Primary Liquid ClipPath */}
            <clipPath id="water-clip">
              <g
                style={{
                  transform: `translate3d(0, ${waterLevel}px, 0)`,
                  transition: 'transform 0.08s linear'
                }}
              >
                <use href="#fluid-wave" x="0" y="0" className="wave-flow" />
              </g>
            </clipPath>
          </defs>

          {/* 1. Underlying Dark Charcoal Base Text */}
          <text
            x="50%"
            y="155"
            textAnchor="middle"
            fill="#3a3a3a"
            style={{
              fontFamily: 'Impact, "Arial Black", "Montserrat Black", sans-serif',
              fontWeight: 900,
              fontSize: 165,
              letterSpacing: '-2px',
            }}
          >
            Maths PS
          </text>

          {/* 2. Rising Solid White Liquid Layer clipped to Text Mask */}
          <g mask="url(#mathsps-text-mask)">
            {/* Ambient Cyan/White Liquid Gradient */}
            <rect
              x="0"
              y="0"
              width="860"
              height="220"
              fill="#ffffff"
              clipPath="url(#water-clip)"
            />
          </g>

          {/* 3. Floating Orb / Physics Dot */}
          <circle
            cx={430 + Math.sin(percent * 0.15) * 35}
            cy={Math.max(30, waterLevel - 20 - Math.abs(Math.sin(percent * 0.2)) * 14)}
            r={percent > 96 ? 0 : 4.5}
            fill="#ffffff"
            style={{
              filter: 'drop-shadow(0 0 6px rgba(255, 255, 255, 0.8))',
              transition: 'all 0.1s ease-out'
            }}
          />
        </svg>

        {/* Minimalist Sub-Status Label aligned at bottom right of typography */}
        <div
          style={{
            width: '100%',
            maxWidth: 820,
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            marginTop: 4,
            paddingRight: 18,
          }}
        >
          <div
            style={{
              color: '#d4d4d4',
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '0.4px',
              fontVariantNumeric: 'tabular-nums'
            }}
          >
            loading… {percent} %
          </div>
        </div>
      </div>

      {/* Wave flow keyframe animation */}
      <style jsx global>{`
        .wave-flow {
          animation: waveShift 2.4s linear infinite;
        }
        @keyframes waveShift {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-400px);
          }
        }
      `}</style>
    </div>
  )
}
