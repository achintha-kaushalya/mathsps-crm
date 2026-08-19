'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Lock, Mail, ArrowRight, Shield, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (err) {
      setError(err.message)
      setLoading(false)
    } else {
      // Set a flag so the greeting shows on the next page
      sessionStorage.setItem('crm_show_greeting', '1')
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-base)',
      padding: 20
    }}>
      <div className="glass-card fade-in" style={{ width: '100%', maxWidth: 400, padding: 32 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          {/* Brand photo with gradient ring */}
          <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 14px' }}>
            <div style={{
              position: 'absolute', inset: -3,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6, #ec4899)',
              zIndex: 0,
            }} />
            <div style={{
              position: 'absolute', inset: -1,
              borderRadius: '50%',
              background: 'var(--bg-card)',
              zIndex: 1,
            }} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand-logo.jpg"
              alt="MathsPS"
              style={{
                width: 80, height: 80,
                borderRadius: '50%',
                objectFit: 'cover',
                objectPosition: 'center top',
                position: 'relative', zIndex: 2,
                display: 'block',
                boxShadow: '0 0 20px rgba(59,130,246,0.3), 0 4px 16px rgba(0,0,0,0.4)',
              }}
            />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px', color: 'var(--text-primary)' }}>
            MathsPS CRM
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
            Staff Portal · Sign in to continue
          </p>
        </div>

        {error && (
          <div style={{
            padding: '10px 14px', background: '#2a1a1a', border: '1px solid var(--accent-red)',
            borderRadius: 8, color: '#f87171', fontSize: 13, marginBottom: 20, textAlign: 'center'
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
              Member Email
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                className="input-field"
                style={{ paddingLeft: 38 }}
                type="email"
                placeholder="name@mathsps.com"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                className="input-field"
                style={{ paddingLeft: 38, paddingRight: 38 }}
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4
                }}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 15 }}
          >
            {loading ? 'Signing in...' : (
              <>Sign In <ArrowRight size={16} /></>
            )}
          </button>
        </form>

        <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--border)', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
          Protected by Supabase Auth · Team Members Only
        </div>
      </div>
    </div>
  )
}
