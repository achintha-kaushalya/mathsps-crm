'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ShieldAlert, RefreshCw, LogOut } from 'lucide-react'

// Timeout configs (in milliseconds)
const INACTIVITY_TIMEOUT_MS = 45 * 60 * 1000 // 45 minutes of total inactivity
const WARNING_COUNTDOWN_MS = 2 * 60 * 1000   // 2 minutes warning countdown before logout

export default function SessionTimeoutManager() {
  const supabase = createClient()
  const [showWarning, setShowWarning] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(120)

  const lastActivityRef = useRef<number>(Date.now())
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null)
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Reset user's last activity timestamp
  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now()
    if (showWarning) {
      setShowWarning(false)
    }
  }, [showWarning])

  // Perform full sign out
  const handleSignOut = useCallback(async () => {
    try {
      await supabase.auth.signOut()
    } catch {}
    window.location.href = '/login?reason=inactivity_timeout'
  }, [supabase])

  useEffect(() => {
    // Activity events to listen on
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']

    const handleUserAction = () => {
      // If modal is NOT showing, bump activity time
      if (!showWarning) {
        lastActivityRef.current = Date.now()
      }
    }

    events.forEach(evt => window.addEventListener(evt, handleUserAction, { passive: true }))

    // Periodic check every 10 seconds
    const interval = setInterval(() => {
      const now = Date.now()
      const elapsed = now - lastActivityRef.current

      // Time to show warning modal (43 minutes elapsed)
      if (elapsed >= INACTIVITY_TIMEOUT_MS - WARNING_COUNTDOWN_MS && !showWarning) {
        setShowWarning(true)
        const remainingSeconds = Math.max(0, Math.ceil((INACTIVITY_TIMEOUT_MS - elapsed) / 1000))
        setSecondsLeft(remainingSeconds)
      }

      // Time to forcibly log out (45 minutes elapsed)
      if (elapsed >= INACTIVITY_TIMEOUT_MS) {
        clearInterval(interval)
        handleSignOut()
      }
    }, 5000)

    return () => {
      events.forEach(evt => window.removeEventListener(evt, handleUserAction))
      clearInterval(interval)
    }
  }, [showWarning, handleSignOut])

  // Countdown timer when warning modal is active
  useEffect(() => {
    if (showWarning) {
      countdownIntervalRef.current = setInterval(() => {
        setSecondsLeft(prev => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current!)
            handleSignOut()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
      }
    }

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
      }
    }
  }, [showWarning, handleSignOut])

  if (!showWarning) return null

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const formattedTime = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: 16
    }}>
      <div className="glass-card" style={{
        maxWidth: 440,
        width: '100%',
        padding: 26,
        borderRadius: 14,
        textAlign: 'center',
        border: '1px solid rgba(239, 68, 68, 0.4)',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)'
      }}>
        <div style={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: 'rgba(239, 68, 68, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
          color: '#ef4444'
        }}>
          <ShieldAlert size={28} />
        </div>

        <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700 }}>
          Session Security Timeout
        </h3>

        <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '0 0 16px', lineHeight: 1.5 }}>
          You have been inactive for a while. For data security, your session will automatically log out in:
        </p>

        <div style={{
          fontSize: 32,
          fontWeight: 800,
          color: '#ef4444',
          letterSpacing: 2,
          marginBottom: 20,
          fontFamily: 'monospace',
          background: 'rgba(239, 68, 68, 0.08)',
          padding: '8px 16px',
          borderRadius: 8,
          display: 'inline-block'
        }}>
          {formattedTime}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleSignOut}
            style={{ flex: 1, justifyContent: 'center', padding: '10px 14px' }}
          >
            <LogOut size={14} /> Log Out Now
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={resetActivity}
            style={{ flex: 1.3, justifyContent: 'center', padding: '10px 14px' }}
          >
            <RefreshCw size={14} /> Stay Logged In
          </button>
        </div>
      </div>
    </div>
  )
}
