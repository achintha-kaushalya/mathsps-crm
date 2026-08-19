'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Settings, Lock, User, CheckCircle, Shield, Eye, EyeOff } from 'lucide-react'

export default function SettingsPage() {
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  
  // Password Change
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [passError, setPassError] = useState('')
  const [passSuccess, setPassSuccess] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setEmail(user.email || '')
        setName(user.user_metadata?.full_name || 'Staff Member')
        setRole(user.user_metadata?.role || 'member')
      }
    })
  }, [])

  async function handlePasswordUpdate(e: React.FormEvent) {
    e.preventDefault()
    setPassError(''); setPassSuccess('')

    if (newPassword.length < 6) {
      setPassError('Password must be at least 6 characters long.')
      return
    }

    if (newPassword !== confirmPassword) {
      setPassError('Passwords do not match.')
      return
    }

    setSavingPassword(true)

    try {
      const { error: err } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (err) throw err

      setPassSuccess('✓ Password updated successfully!')
      setNewPassword('')
      setConfirmPassword('')
    } catch (e: any) {
      setPassError(e.message || 'Failed to update password')
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Settings size={22} style={{ color: 'var(--accent-blue)' }} />
            Account Settings & Security
          </h1>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
            Manage your login password and staff account details
          </div>
        </div>
      </div>

      <div className="page-content" style={{ maxWidth: 600 }}>

        {/* Profile Card */}
        <div className="glass-card" style={{ padding: 24, marginBottom: 20 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16, color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <User size={16} /> My Account Info
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Staff Name</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{name}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Login Email</div>
              <div style={{ fontSize: 14, fontFamily: 'monospace' }}>{email}</div>
            </div>
          </div>

          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Access Role</div>
            <span className="badge" style={{
              background: role === 'admin' ? '#2a1a3a' : '#1e3a5f',
              color: role === 'admin' ? '#c084fc' : '#60a5fa'
            }}>
              {role.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Password Change Form */}
        <div className="glass-card" style={{ padding: 24 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16, color: 'var(--accent-purple)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Lock size={16} /> Change Login Password
          </div>

          {passError && (
            <div style={{ padding: '10px 14px', background: '#2a1a1a', border: '1px solid var(--accent-red)', borderRadius: 8, color: '#f87171', fontSize: 13, marginBottom: 16 }}>
              ⚠️ {passError}
            </div>
          )}

          {passSuccess && (
            <div style={{ padding: '10px 14px', background: '#1a3a2a', border: '1px solid #10b981', borderRadius: 8, color: '#34d399', fontSize: 13, marginBottom: 16 }}>
              {passSuccess}
            </div>
          )}

          <form onSubmit={handlePasswordUpdate}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                New Password *
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  className="input-field"
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="Enter new password (min 6 chars)"
                  required
                  style={{ paddingRight: 36 }}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(v => !v)}
                  style={{
                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4
                  }}
                  title={showNewPassword ? 'Hide password' : 'Show password'}
                >
                  {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                Confirm New Password *
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  className="input-field"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Re-enter new password"
                  required
                  style={{ paddingRight: 36 }}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(v => !v)}
                  style={{
                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4
                  }}
                  title={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={savingPassword}
              style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
            >
              {savingPassword ? 'Updating...' : '🔒 Update Password'}
            </button>
          </form>
        </div>

      </div>
    </div>
  )
}
