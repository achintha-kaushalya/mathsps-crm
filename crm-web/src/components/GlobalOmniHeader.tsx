'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  Command,
  X,
  PlusCircle,
  Truck,
  CreditCard,
  Phone,
  ArrowRight,
  ChevronRight,
  History
} from 'lucide-react'
import { extractLmsNumber } from '@/lib/types'

interface RecentItem {
  id: string
  type: 'student' | 'lead'
  code: string
  name: string
  subText?: string
  url: string
}

const STORAGE_KEY = 'mathsps_omni_recent_v1'

export default function GlobalOmniHeader() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<{ students: any[]; leads: any[] }>({ students: [], leads: [] })
  const [recentItems, setRecentItems] = useState<RecentItem[]>([])

  const modalInputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Load history from LocalStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        setRecentItems(JSON.parse(stored))
      }
    } catch {}
  }, [isOpen])

  const addToRecent = (item: RecentItem) => {
    try {
      const filtered = recentItems.filter(i => i.url !== item.url)
      const updated = [item, ...filtered].slice(0, 5)
      setRecentItems(updated)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    } catch {}
  }

  const clearRecent = () => {
    setRecentItems([])
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {}
  }

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsOpen(prev => !prev)
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Focus on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        modalInputRef.current?.focus()
      }, 50)
    } else {
      setQuery('')
      setResults({ students: [], leads: [] })
    }
  }, [isOpen])

  // Ultra-fast search with 140ms debounce
  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed || trimmed.length < 2) {
      setResults({ students: [], leads: [] })
      setLoading(false)
      return
    }

    setLoading(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`)
        if (res.ok) {
          const data = await res.json()
          setResults({
            students: data.students || [],
            leads: data.leads || []
          })
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }, 140)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  const handleSelectStudent = (stu: any) => {
    const psCode = stu.ps_code
    addToRecent({
      id: stu.id,
      type: 'student',
      code: psCode,
      name: stu.full_name || 'No Name',
      subText: stu.grade ? `Grade ${stu.grade}` : '',
      url: `/students/${encodeURIComponent(psCode)}`
    })
    setIsOpen(false)
    router.push(`/students/${encodeURIComponent(psCode)}`)
  }

  const handleSelectLead = (lead: any) => {
    const fcode = lead.fcode
    addToRecent({
      id: lead.id,
      type: 'lead',
      code: fcode,
      name: lead.student_name || lead.parent_name || 'Lead',
      subText: lead.phone || '',
      url: `/leads`
    })
    setIsOpen(false)
    router.push(`/leads`)
  }

  const handleSelectRecent = (item: RecentItem) => {
    setIsOpen(false)
    router.push(item.url)
  }

  return (
    <>
      {/* ── Top Bar ── */}
      <header
        style={{
          width: '100%',
          height: 48,
          background: 'var(--bg-card)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--border)',
          position: 'sticky',
          top: 0,
          zIndex: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              background: '#0284c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: 13,
            }}
          >
            Σ
          </div>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>
            MathsPS
          </span>
        </div>

        {/* Minimal trigger input */}
        <div style={{ flex: 1, maxWidth: 440, margin: '0 20px' }}>
          <div
            onClick={() => setIsOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 12px',
              borderRadius: 8,
              background: 'var(--bg-base)',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              height: 32,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)' }}>
              <Search size={13} style={{ color: 'var(--accent-blue)' }} />
              <span style={{ fontSize: 12.5 }}>Search anything...</span>
            </div>
            <kbd
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                fontSize: 10.5,
                fontWeight: 600,
                color: 'var(--text-muted)',
                background: 'var(--bg-card)',
                padding: '2px 5px',
                borderRadius: 4,
                border: '1px solid var(--border)',
              }}
            >
              <Command size={10} /> K
            </kbd>
          </div>
        </div>

        <div style={{ width: 60 }} />
      </header>

      {/* ── Modal Command Palette (Clean & Concise) ── */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '12vh',
          }}
          onClick={() => setIsOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 540,
              background: 'var(--bg-card)',
              borderRadius: 14,
              border: '1px solid var(--border-light)',
              boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '75vh',
            }}
            onClick={e => e.stopPropagation()}
            className="fade-in"
          >
            {/* Input Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 16px',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <Search size={16} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
              <input
                ref={modalInputRef}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: 14,
                  color: 'var(--text-primary)',
                  fontWeight: 500,
                }}
                placeholder="Search PS code, name, phone, F-code..."
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <X size={14} />
                </button>
              )}
              <kbd
                onClick={() => setIsOpen(false)}
                style={{
                  fontSize: 10,
                  padding: '2px 5px',
                  borderRadius: 4,
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                ESC
              </kbd>
            </div>

            {/* Results Body */}
            <div style={{ overflowY: 'auto', padding: '10px 12px', flex: 1 }}>
              {loading && (
                <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                  Searching...
                </div>
              )}

              {/* Recent & Quick Actions (When input is empty) */}
              {!query.trim() && !loading && (
                <>
                  {recentItems.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0 4px 6px',
                          fontSize: 10.5,
                          fontWeight: 700,
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <History size={11} /> Recent
                        </span>
                        <button
                          onClick={clearRecent}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            fontSize: 10.5,
                            cursor: 'pointer',
                          }}
                        >
                          Clear
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {recentItems.map(item => (
                          <div
                            key={item.id + item.url}
                            onClick={() => handleSelectRecent(item)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '7px 10px',
                              borderRadius: 8,
                              cursor: 'pointer',
                            }}
                            className="hover-bg"
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: item.type === 'student' ? 'var(--accent-blue)' : 'var(--accent-purple)',
                                  width: 55,
                                }}
                              >
                                {item.code}
                              </span>
                              <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)' }}>
                                {item.name}
                              </span>
                              {item.subText && (
                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {item.subText}</span>
                              )}
                            </div>
                            <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Shortcuts */}
                  <div>
                    <div
                      style={{
                        padding: '0 4px 6px',
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      Shortcuts
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      <button
                        onClick={() => {
                          setIsOpen(false)
                          router.push('/students/new')
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '8px 10px',
                          borderRadius: 8,
                          background: 'var(--bg-base)',
                          border: '1px solid var(--border)',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                        className="hover-card"
                      >
                        <PlusCircle size={14} style={{ color: 'var(--accent-blue)' }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>New Student</span>
                      </button>

                      <button
                        onClick={() => {
                          setIsOpen(false)
                          router.push('/payments/add')
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '8px 10px',
                          borderRadius: 8,
                          background: 'var(--bg-base)',
                          border: '1px solid var(--border)',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                        className="hover-card"
                      >
                        <CreditCard size={14} style={{ color: 'var(--accent-green)' }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Add Payment</span>
                      </button>

                      <button
                        onClick={() => {
                          setIsOpen(false)
                          router.push('/leads')
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '8px 10px',
                          borderRadius: 8,
                          background: 'var(--bg-base)',
                          border: '1px solid var(--border)',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                        className="hover-card"
                      >
                        <Phone size={14} style={{ color: 'var(--accent-purple)' }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Leads Hub</span>
                      </button>

                      <button
                        onClick={() => {
                          setIsOpen(false)
                          router.push('/delivery')
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '8px 10px',
                          borderRadius: 8,
                          background: 'var(--bg-base)',
                          border: '1px solid var(--border)',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                        className="hover-card"
                      >
                        <Truck size={14} style={{ color: 'var(--accent-orange)' }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Deliveries</span>
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Dynamic Results */}
              {query.trim() && !loading && (
                <>
                  {results.students.length === 0 && results.leads.length === 0 ? (
                    <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5 }}>
                      No results for &ldquo;{query}&rdquo;
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {/* Students */}
                      {results.students.length > 0 && (
                        <div>
                          <div
                            style={{
                              padding: '0 4px 4px',
                              fontSize: 10.5,
                              fontWeight: 700,
                              color: 'var(--accent-blue)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                            }}
                          >
                            Students
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {results.students.map(stu => {
                              const lms = extractLmsNumber(stu)
                              return (
                                <div
                                  key={stu.id}
                                  onClick={() => handleSelectStudent(stu)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '7px 10px',
                                    borderRadius: 8,
                                    cursor: 'pointer',
                                    background: 'var(--bg-base)',
                                    border: '1px solid var(--border)',
                                  }}
                                  className="hover-card"
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span
                                      style={{
                                        padding: '2px 6px',
                                        borderRadius: 4,
                                        background: '#eff6ff',
                                        color: '#2563eb',
                                        fontWeight: 700,
                                        fontSize: 11,
                                      }}
                                    >
                                      {stu.ps_code}
                                    </span>
                                    <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                                      {stu.full_name || 'No Name'}
                                    </span>
                                    {stu.grade && (
                                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Gr {stu.grade}</span>
                                    )}
                                    {lms && (
                                      <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>{lms}</span>
                                    )}
                                  </div>
                                  <ArrowRight size={12} style={{ color: 'var(--accent-blue)' }} />
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Leads */}
                      {results.leads.length > 0 && (
                        <div>
                          <div
                            style={{
                              padding: '0 4px 4px',
                              fontSize: 10.5,
                              fontWeight: 700,
                              color: 'var(--accent-purple)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                            }}
                          >
                            Leads
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {results.leads.map(lead => (
                              <div
                                key={lead.id}
                                onClick={() => handleSelectLead(lead)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '7px 10px',
                                  borderRadius: 8,
                                  cursor: 'pointer',
                                  background: 'var(--bg-base)',
                                  border: '1px solid var(--border)',
                                }}
                                className="hover-card"
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span
                                    style={{
                                      padding: '2px 6px',
                                      borderRadius: 4,
                                      background: '#faf5ff',
                                      color: '#9333ea',
                                      fontWeight: 700,
                                      fontSize: 11,
                                    }}
                                  >
                                    {lead.fcode}
                                  </span>
                                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {lead.student_name || lead.parent_name || 'No Name'}
                                  </span>
                                  {lead.phone && (
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{lead.phone}</span>
                                  )}
                                  {lead.status && (
                                    <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
                                      [{lead.status}]
                                    </span>
                                  )}
                                </div>
                                <ArrowRight size={12} style={{ color: 'var(--accent-purple)' }} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Clean Footer */}
            <div
              style={{
                padding: '6px 14px',
                background: 'var(--bg-base)',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 11,
                color: 'var(--text-muted)',
              }}
            >
              <span>Press <kbd style={{ padding: '1px 4px', borderRadius: 3, border: '1px solid var(--border)' }}>ESC</kbd> to exit</span>
              <span style={{ fontWeight: 600, color: 'var(--accent-blue)' }}>MathsPS</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
