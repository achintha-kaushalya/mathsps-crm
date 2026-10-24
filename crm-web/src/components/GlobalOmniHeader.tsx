'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  Command,
  X,
  User,
  Phone,
  GraduationCap,
  Clock,
  Sparkles,
  ArrowRight,
  PlusCircle,
  Truck,
  CreditCard,
  FileSpreadsheet,
  CornerDownLeft,
  ChevronRight,
  Shield,
  Trash2
} from 'lucide-react'
import { extractLmsNumber } from '@/lib/types'

interface RecentItem {
  id: string
  type: 'student' | 'lead'
  code: string
  name: string
  subText?: string
  url: string
  timestamp: number
}

const STORAGE_KEY = 'mathsps_omni_recent_v1'

export default function GlobalOmniHeader() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<{ students: any[]; leads: any[] }>({ students: [], leads: [] })
  const [recentItems, setRecentItems] = useState<RecentItem[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const modalInputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Load recent history from LocalStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        setRecentItems(JSON.parse(stored))
      }
    } catch {}
  }, [isOpen])

  // Save to recent items
  const addToRecent = (item: Omit<RecentItem, 'timestamp'>) => {
    try {
      const existing = recentItems.filter(i => i.url !== item.url)
      const updated: RecentItem[] = [{ ...item, timestamp: Date.now() }, ...existing].slice(0, 8)
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

  // Global Keyboard Shortcut: Cmd+K or Ctrl+K
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

  // Focus modal input on open
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

  // Live Debounced Omni Search
  useEffect(() => {
    if (!query.trim()) {
      setResults({ students: [], leads: [] })
      setLoading(false)
      return
    }

    setLoading(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`)
        if (res.ok) {
          const data = await res.json()
          setResults({
            students: data.students || [],
            leads: data.leads || []
          })
        }
      } catch (err) {
        console.error('Search query failed:', err)
      } finally {
        setLoading(false)
      }
    }, 200)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  // Quick navigation helpers
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
      {/* ── 1. Top Glassmorphic Global Omni Header ── */}
      <header
        style={{
          width: '100%',
          height: 56,
          background: 'var(--bg-card)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--border)',
          position: 'sticky',
          top: 0,
          zIndex: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 28px',
          transition: 'all 0.2s ease',
        }}
      >
        {/* Left: Brand / System Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: 14,
              boxShadow: '0 2px 8px rgba(2, 132, 199, 0.25)',
            }}
          >
            Σ
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-0.3px', color: 'var(--text-primary)' }}>
              MathsPS
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Executive Hub
            </span>
          </div>
        </div>

        {/* Center: Global Omni Search Trigger Bar */}
        <div style={{ flex: 1, maxWidth: 560, margin: '0 24px' }}>
          <div
            onClick={() => setIsOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '7px 14px',
              borderRadius: 12,
              background: 'var(--bg-base)',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              transition: 'border-color 0.15s, box-shadow 0.15s, background 0.15s',
              boxShadow: 'var(--shadow-sm)',
            }}
            className="hover-card"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)' }}>
              <Search size={15} style={{ color: 'var(--accent-blue)' }} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>
                Search students, phone, leads, F-codes, payments...
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text-muted)',
                background: 'var(--bg-card)',
                padding: '3px 7px',
                borderRadius: 6,
                border: '1px solid var(--border)',
              }}
            >
              <Command size={11} /> K
            </div>
          </div>
        </div>

        {/* Right: Quick Action Shortcuts */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => {
              setIsOpen(true)
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
            className="btn-secondary"
            title="Open Command Palette"
          >
            <Sparkles size={13} style={{ color: 'var(--accent-purple)' }} />
            Omni Command
          </button>
        </div>
      </header>

      {/* ── 2. Modal Spotlight Command Palette (Cmd + K) ── */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '10vh',
          }}
          onClick={() => setIsOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 640,
              background: 'var(--bg-card)',
              borderRadius: 18,
              border: '1px solid var(--border-light)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '80vh',
            }}
            onClick={e => e.stopPropagation()}
            className="fade-in"
          >
            {/* Search Input Box */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '16px 20px',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <Search size={20} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
              <input
                ref={modalInputRef}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: 16,
                  color: 'var(--text-primary)',
                  fontWeight: 500,
                }}
                placeholder="Search anything (PS code, Student Name, Phone, F-code, Area)..."
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  <X size={16} />
                </button>
              )}
              <kbd
                onClick={() => setIsOpen(false)}
                style={{
                  fontSize: 11,
                  padding: '3px 8px',
                  borderRadius: 6,
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                ESC
              </kbd>
            </div>

            {/* Results & History Body */}
            <div style={{ overflowY: 'auto', padding: '12px 14px', flex: 1 }}>
              {loading && (
                <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  <div className="animate-spin" style={{ display: 'inline-block', marginBottom: 8 }}>🌀</div>
                  <div>Searching across students, households & leads...</div>
                </div>
              )}

              {/* A. If Query is empty: Show Recent Searches & Quick Nav Shortcuts */}
              {!query.trim() && !loading && (
                <>
                  {recentItems.length > 0 && (
                    <div style={{ marginBottom: 18 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0 8px 8px',
                          fontSize: 11,
                          fontWeight: 700,
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Clock size={12} /> Recently Viewed & Searched
                        </span>
                        <button
                          onClick={clearRecent}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            fontSize: 11,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                          className="hover-color"
                        >
                          <Trash2 size={11} /> Clear
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {recentItems.map(item => (
                          <div
                            key={item.id + item.url}
                            onClick={() => handleSelectRecent(item)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '9px 12px',
                              borderRadius: 10,
                              cursor: 'pointer',
                              background: 'transparent',
                              transition: 'background 0.15s ease',
                            }}
                            className="hover-bg"
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: 8,
                                  background: item.type === 'student' ? '#eff6ff' : '#faf5ff',
                                  color: item.type === 'student' ? '#2563eb' : '#9333ea',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 11,
                                  fontWeight: 700,
                                }}
                              >
                                {item.type === 'student' ? 'PS' : 'F'}
                              </div>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                                  {item.code} · {item.name}
                                </div>
                                {item.subText && (
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.subText}</div>
                                )}
                              </div>
                            </div>
                            <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quick System Navigation Shortcuts */}
                  <div>
                    <div
                      style={{
                        padding: '0 8px 8px',
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      Quick System Shortcuts
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <button
                        onClick={() => {
                          setIsOpen(false)
                          router.push('/students/new')
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '10px 14px',
                          borderRadius: 10,
                          background: 'var(--bg-base)',
                          border: '1px solid var(--border)',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                        className="hover-card"
                      >
                        <PlusCircle size={16} style={{ color: 'var(--accent-blue)' }} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Add Student</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Enroll new student code</div>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          setIsOpen(false)
                          router.push('/payments/add')
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '10px 14px',
                          borderRadius: 10,
                          background: 'var(--bg-base)',
                          border: '1px solid var(--border)',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                        className="hover-card"
                      >
                        <CreditCard size={16} style={{ color: 'var(--accent-green)' }} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Add Payment</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Bank slip, cash or free</div>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          setIsOpen(false)
                          router.push('/leads')
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '10px 14px',
                          borderRadius: 10,
                          background: 'var(--bg-base)',
                          border: '1px solid var(--border)',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                        className="hover-card"
                      >
                        <Phone size={16} style={{ color: 'var(--accent-purple)' }} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Leads Hub</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Campaign call center</div>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          setIsOpen(false)
                          router.push('/delivery')
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '10px 14px',
                          borderRadius: 10,
                          background: 'var(--bg-base)',
                          border: '1px solid var(--border)',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                        className="hover-card"
                      >
                        <Truck size={16} style={{ color: 'var(--accent-orange)' }} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Deliveries</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Tute & courier dispatch</div>
                        </div>
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* B. If Query is typed: Categorized Search Results */}
              {query.trim() && !loading && (
                <>
                  {results.students.length === 0 && results.leads.length === 0 ? (
                    <div style={{ padding: '36px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <Search size={32} style={{ opacity: 0.3, marginBottom: 10 }} />
                      <div style={{ fontSize: 14, fontWeight: 600 }}>No results found for &ldquo;{query}&rdquo;</div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>
                        Try searching with PS Code, Student Name, Phone, or Town.
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {/* 1. Students Results */}
                      {results.students.length > 0 && (
                        <div>
                          <div
                            style={{
                              padding: '0 8px 6px',
                              fontSize: 11,
                              fontWeight: 700,
                              color: 'var(--accent-blue)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <span>Students ({results.students.length})</span>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Press Enter to view</span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {results.students.map(stu => {
                              const lms = extractLmsNumber(stu)
                              const hh = stu.household as any
                              return (
                                <div
                                  key={stu.id}
                                  onClick={() => handleSelectStudent(stu)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '10px 14px',
                                    borderRadius: 10,
                                    cursor: 'pointer',
                                    background: 'var(--bg-base)',
                                    border: '1px solid var(--border)',
                                    transition: 'transform 0.15s, border-color 0.15s',
                                  }}
                                  className="hover-card"
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div
                                      style={{
                                        padding: '4px 8px',
                                        borderRadius: 6,
                                        background: '#eff6ff',
                                        color: '#2563eb',
                                        fontWeight: 700,
                                        fontSize: 12,
                                        border: '1px solid #bfdbfe',
                                      }}
                                    >
                                      {stu.ps_code}
                                    </div>
                                    <div>
                                      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                                        {stu.full_name || 'No Name Set'}
                                      </div>
                                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', gap: 8, marginTop: 2 }}>
                                        {stu.grade && <span>Grade {stu.grade}</span>}
                                        {lms && <span style={{ color: '#10b981', fontWeight: 600 }}>📱 LMS: {lms}</span>}
                                        {hh?.area && <span>📍 {hh.area}</span>}
                                        {hh?.parent_phone && <span>📞 {hh.parent_phone}</span>}
                                      </div>
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-blue)', fontSize: 12, fontWeight: 600 }}>
                                    View Profile <ArrowRight size={13} />
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* 2. Leads Results */}
                      {results.leads.length > 0 && (
                        <div>
                          <div
                            style={{
                              padding: '0 8px 6px',
                              fontSize: 11,
                              fontWeight: 700,
                              color: 'var(--accent-purple)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                            }}
                          >
                            Leads & Inquiries ({results.leads.length})
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {results.leads.map(lead => (
                              <div
                                key={lead.id}
                                onClick={() => handleSelectLead(lead)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '10px 14px',
                                  borderRadius: 10,
                                  cursor: 'pointer',
                                  background: 'var(--bg-base)',
                                  border: '1px solid var(--border)',
                                }}
                                className="hover-card"
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                  <div
                                    style={{
                                      padding: '4px 8px',
                                      borderRadius: 6,
                                      background: '#faf5ff',
                                      color: '#9333ea',
                                      fontWeight: 700,
                                      fontSize: 12,
                                      border: '1px solid #f3e8ff',
                                    }}
                                  >
                                    {lead.fcode}
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                                      {lead.student_name || lead.parent_name || 'No Name'}
                                    </div>
                                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', gap: 8, marginTop: 2 }}>
                                      {lead.phone && <span>📞 {lead.phone}</span>}
                                      {lead.grade && <span>Grade {lead.grade}</span>}
                                      {lead.status && (
                                        <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                                          [{lead.status}]
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-purple)', fontSize: 12, fontWeight: 600 }}>
                                  Open in Leads <ArrowRight size={13} />
                                </div>
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

            {/* Modal Footer Controls */}
            <div
              style={{
                padding: '10px 18px',
                background: 'var(--bg-base)',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 11.5,
                color: 'var(--text-muted)',
              }}
            >
              <div style={{ display: 'flex', gap: 14 }}>
                <span>Navigation: <kbd style={{ padding: '2px 5px', borderRadius: 4, border: '1px solid var(--border)' }}>↑</kbd> <kbd style={{ padding: '2px 5px', borderRadius: 4, border: '1px solid var(--border)' }}>↓</kbd></span>
                <span>Select: <kbd style={{ padding: '2px 5px', borderRadius: 4, border: '1px solid var(--border)' }}>↵ Enter</kbd></span>
                <span>Close: <kbd style={{ padding: '2px 5px', borderRadius: 4, border: '1px solid var(--border)' }}>ESC</kbd></span>
              </div>
              <div style={{ fontWeight: 600, color: 'var(--accent-blue)' }}>MathsPS Omni Search</div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
