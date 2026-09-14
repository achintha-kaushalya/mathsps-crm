'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [showTopProgress, setShowTopProgress] = useState(false)
  const prevPath = useRef(pathname)

  useEffect(() => {
    if (pathname !== prevPath.current) {
      prevPath.current = pathname
      setShowTopProgress(true)
      const t = setTimeout(() => setShowTopProgress(false), 250)
      return () => clearTimeout(t)
    }
  }, [pathname])

  return (
    <>
      {/* Sleek Enterprise Top Progress Bar (Stripe / GitHub style) */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: 2.5,
          zIndex: 10000,
          background: 'linear-gradient(90deg, #38bdf8 0%, #6366f1 50%, #06b6d4 100%)',
          boxShadow: '0 0 10px rgba(56, 189, 248, 0.7)',
          opacity: showTopProgress ? 1 : 0,
          transform: showTopProgress ? 'scaleX(1)' : 'scaleX(0)',
          transformOrigin: 'left',
          transition: 'transform 0.25s ease-out, opacity 0.2s ease',
          pointerEvents: 'none',
        }}
      />

      {/* Main Content Container */}
      <div
        style={{
          minHeight: '100%',
          width: '100%',
        }}
      >
        {children}
      </div>
    </>
  )
}


