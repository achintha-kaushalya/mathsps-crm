'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import LoadingScreen from './LoadingScreen'

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [loading, setLoading] = useState(false)
  const [displayChildren, setDisplayChildren] = useState(children)
  const [contentVisible, setContentVisible] = useState(true)
  const prevPath = useRef(pathname)
  const firstMount = useRef(true)

  useEffect(() => {
    if (firstMount.current) {
      firstMount.current = false
      return
    }
    if (pathname === prevPath.current) return
    prevPath.current = pathname

    // 1. Fade out content
    setContentVisible(false)
    setLoading(true)

    // 2. Short loading screen
    const t1 = setTimeout(() => {
      setDisplayChildren(children)
      setLoading(false)
      // 3. Fade in new content
      const t2 = setTimeout(() => setContentVisible(true), 40)
      return () => clearTimeout(t2)
    }, 550)

    return () => clearTimeout(t1)
  }, [pathname])

  // Keep children fresh when not transitioning
  useEffect(() => {
    if (!loading) setDisplayChildren(children)
  }, [children, loading])

  return (
    <>
      {loading && <LoadingScreen message="Navigating" />}
      <div
        style={{
          opacity: contentVisible ? 1 : 0,
          transform: contentVisible ? 'translateY(0) scale(1)' : 'translateY(6px) scale(0.995)',
          transition: 'opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1), transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
          willChange: 'opacity, transform',
          minHeight: '100%',
        }}
      >
        {displayChildren}
      </div>
    </>
  )
}
