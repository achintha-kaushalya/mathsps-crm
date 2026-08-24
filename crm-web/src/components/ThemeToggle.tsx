'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Read saved theme or system preference
    const saved = localStorage.getItem('mathsps_theme') as 'dark' | 'light' | null
    if (saved) {
      setTheme(saved)
      document.documentElement.setAttribute('data-theme', saved)
    } else {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      const initial = prefersDark ? 'dark' : 'dark' // Default to dark theme
      setTheme(initial)
      document.documentElement.setAttribute('data-theme', initial)
    }
    setMounted(true)
  }, [])

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('mathsps_theme', next)
  }

  if (!mounted) return null

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="btn-secondary"
      style={{
        padding: '5px 10px',
        fontSize: 12,
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        borderRadius: 8,
        cursor: 'pointer',
      }}
      title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
    >
      {theme === 'dark' ? (
        <>
          <Sun size={14} style={{ color: '#fbbf24' }} />
          <span>Light</span>
        </>
      ) : (
        <>
          <Moon size={14} style={{ color: '#6366f1' }} />
          <span>Dark</span>
        </>
      )}
    </button>
  )
}
