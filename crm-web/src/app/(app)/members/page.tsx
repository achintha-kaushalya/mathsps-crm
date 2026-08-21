'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Users, UserPlus, Shield, Check, Lock, Mail, Eye, EyeOff } from 'lucide-react'
import { Member } from '@/lib/types'

export default function MembersPage() {
  const supabase = createClient()

  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberEmail, setNewMemberEmail] = useState('')
  const [newMemberPassword, setNewMemberPassword] = useState('')
  const [newMemberRole, setNewMemberRole] = useState<'member' | 'admin'>('member')
  const [showCreatePassword, setShowCreatePassword] = useState(false)
  const [showModalAdminPassword, setShowModalAdminPassword] = useState(false)
  const [showModalNewPassword, setShowModalNewPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => { loadMembers() }, [])

  async function loadMembers() {
    setLoading(true)
    const { data } = await supabase.from('members').select('*').order('name')
    setMembers(data || [])
    setLoading(false)
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault()
    if (!newMemberName.trim() || !newMemberEmail.trim() || !newMemberPassword.trim()) {
      setError('Name, email, and password are required.')
      return
    }
    setSaving(true); setError(''); setSuccessMsg('')

    try {
      const res = await fetch('/api/members/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newMemberName.trim(),
          email: newMemberEmail.trim(),
          password: newMemberPassword.trim(),
          role: newMemberRole,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create member account')

      setSuccessMsg(`✓ Member account created! (${newMemberEmail})`)
      setNewMemberName('')
      setNewMemberEmail('')
      setNewMemberPassword('')
      loadMembers()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // Admin Password Verification Modal State
  const [modalAction, setModalAction] = useState<{
    type: 'role' | 'active' | 'delete' | 'reset_pwd' | 'permissions'
    member: Member
    newRole?: 'member' | 'admin'
    newActive?: boolean
    permissions?: { allowed_members: string[]; can_view_all: boolean }
  } | null>(null)
  const [adminPasswordInput, setAdminPasswordInput] = useState('')
  const [newStaffPasswordInput, setNewStaffPasswordInput] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [modalError, setModalError] = useState('')

  async function handleConfirmAdminAction(e: React.FormEvent) {
    e.preventDefault()
    if (!modalAction || !adminPasswordInput) return
    setActionLoading(true)
    setModalError('')

    try {
      let actionType = 'update_role'
      if (modalAction.type === 'active') actionType = 'toggle_active'
      if (modalAction.type === 'delete') actionType = 'delete_member'
      if (modalAction.type === 'reset_pwd') actionType = 'reset_password'
      if (modalAction.type === 'permissions') actionType = 'update_permissions'

      const res = await fetch('/api/members/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionType,
          memberId: modalAction.member.id,
          newRole: modalAction.newRole,
          newActive: modalAction.newActive,
          newMemberPassword: newStaffPasswordInput,
          permissions: modalAction.permissions,
          adminPassword: adminPasswordInput,
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Operation failed')

      setSuccessMsg(
        modalAction.type === 'reset_pwd'
          ? `✓ Successfully reset password for ${modalAction.member.name}!`
          : modalAction.type === 'permissions'
          ? `✓ Lead visibility permissions updated for ${modalAction.member.name}!`
          : `✓ Successfully updated ${modalAction.member.name}!`
      )
      setModalAction(null)
      setAdminPasswordInput('')
      setNewStaffPasswordInput('')
      loadMembers()
    } catch (err: any) {
      setModalError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Users size={22} style={{ color: 'var(--accent-blue)' }} />
            Team Members & Account Registration
          </h1>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
            Manage staff members, switch roles, toggle active status, and clean up member roster
          </div>
        </div>
      </div>

      <div className="page-content">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>

          {/* Members List */}
          <div className="glass-card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Active Team Roster ({members.length})</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>🔒 Role & Status changes require Admin Password</span>
            </div>

            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading members...</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Member Name</th>
                    <th>Email Account</th>
                    <th style={{ textAlign: 'center' }}>Role</th>
                    <th style={{ textAlign: 'center' }}>Lead Visibility (2nd Calls)</th>
                    <th style={{ textAlign: 'center' }}>Active Status</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map(m => {
                    let perms: { allowed_members?: string[]; can_view_all?: boolean } = {}
                    try {
                      if (m.notes) perms = JSON.parse(m.notes)
                    } catch {}
                    const isAll = perms.can_view_all || m.role === 'admin'
                    const allowed = perms.allowed_members || []

                    return (
                    <tr key={m.id}>
                      <td style={{ fontWeight: 600 }}>{m.name}</td>
                      <td style={{ color: m.email ? 'var(--text-primary)' : 'var(--accent-orange)', fontSize: 12 }}>
                        {m.email ? m.email : '⚠️ No Login Account'}
                      </td>

                      {/* Interactive Role Switcher */}
                      <td style={{ textAlign: 'center' }}>
                        <select
                          className="input-field"
                          style={{
                            padding: '3px 8px', fontSize: 11, height: 26, width: 95,
                            background: m.role === 'admin' ? '#2a1a3a' : '#1e3a5f',
                            color: m.role === 'admin' ? '#c084fc' : '#60a5fa',
                            fontWeight: 700, border: '1px solid var(--border)',
                            margin: '0 auto'
                          }}
                          value={m.role}
                          onChange={(e) => {
                            const selectedRole = e.target.value as 'member' | 'admin'
                            if (selectedRole !== m.role) {
                              setModalAction({ type: 'role', member: m, newRole: selectedRole })
                              setAdminPasswordInput('')
                              setModalError('')
                            }
                          }}
                        >
                          <option value="member" style={{ background: '#0d1424', color: '#60a5fa' }}>MEMBER</option>
                          <option value="admin" style={{ background: '#0d1424', color: '#c084fc' }}>ADMIN</option>
                        </select>
                      </td>

                      {/* Lead Visibility Permission Column */}
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => {
                            setModalAction({
                              type: 'permissions',
                              member: m,
                              permissions: {
                                can_view_all: isAll,
                                allowed_members: allowed
                              }
                            })
                            setAdminPasswordInput('')
                            setModalError('')
                          }}
                          style={{
                            background: isAll ? 'rgba(59, 130, 246, 0.15)' : allowed.length > 0 ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                            border: `1px solid ${isAll ? '#3b82f6' : allowed.length > 0 ? '#a855f7' : 'var(--border)'}`,
                            color: isAll ? '#60a5fa' : allowed.length > 0 ? '#c084fc' : 'var(--text-muted)',
                            padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
                            transition: 'all 0.15s'
                          }}
                          title="Click to configure which members' assigned leads this user can view"
                        >
                          <span>{isAll ? '🌐 All Leads' : allowed.length > 0 ? `👥 Own + ${allowed.length} others` : '🔒 Own leads only'}</span>
                          <span style={{ fontSize: 10 }}>⚙</span>
                        </button>
                      </td>

                      {/* Clean Flat 2D On/Off Button */}
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => {
                            setModalAction({ type: 'active', member: m, newActive: !m.active })
                            setAdminPasswordInput('')
                            setModalError('')
                          }}
                          style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                            cursor: 'pointer', border: '1px solid', width: 62,
                            background: m.active ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            borderColor: m.active ? '#10b981' : '#ef4444',
                            color: m.active ? '#34d399' : '#f87171',
                            transition: 'background 0.15s, border-color 0.15s'
                          }}
                          title={`Click to turn ${m.active ? 'OFF' : 'ON'}`}
                        >
                          <span style={{
                            width: 6, height: 6, borderRadius: '50%',
                            background: m.active ? '#10b981' : '#ef4444'
                          }} />
                          <span>{m.active ? 'ON' : 'OFF'}</span>
                        </button>
                      </td>

                      {/* Actions & Delete Member */}
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
                          <div style={{ width: 68, display: 'flex', justifyContent: 'center' }}>
                            {!m.email ? (
                              <button
                                onClick={() => {
                                  setNewMemberName(m.name)
                                  setNewMemberEmail(`${m.name.toLowerCase().replace(/\s+/g, '')}@mathsps.com`)
                                  setNewMemberPassword('StaffPassword123!')
                                  setNewMemberRole(m.role as any || 'member')
                                  window.scrollTo({ top: 0, behavior: 'smooth' })
                                }}
                                className="btn-primary"
                                style={{ padding: '3px 8px', fontSize: 11, whiteSpace: 'nowrap' }}
                                title="Set up login email and password for this member"
                              >
                                🔑 Setup
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setModalAction({ type: 'reset_pwd', member: m })
                                  setAdminPasswordInput('')
                                  setNewStaffPasswordInput('StaffPassword123!')
                                  setModalError('')
                                }}
                                className="btn-secondary"
                                style={{ padding: '3px 8px', fontSize: 11, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}
                                title={`Reset login password for ${m.name}`}
                              >
                                🔑 Reset
                              </button>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              setModalAction({ type: 'delete', member: m })
                              setAdminPasswordInput('')
                              setModalError('')
                            }}
                            style={{
                              background: 'none', border: 'none', color: '#ef4444',
                              cursor: 'pointer', fontSize: 14, padding: '4px 6px', opacity: 0.85,
                              transition: 'opacity 0.15s, transform 0.15s',
                              display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                            onMouseLeave={e => e.currentTarget.style.opacity = '0.85'}
                            title={`Delete ${m.name} from team`}
                          >
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Add Member Form */}
          <div className="glass-card" style={{ padding: 20 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16, color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserPlus size={16} /> Create Staff Account
            </div>

            {error && (
              <div style={{ padding: '8px 12px', background: '#2a1a1a', border: '1px solid var(--accent-red)', borderRadius: 6, color: '#f87171', fontSize: 12, marginBottom: 14 }}>
                ⚠️ {error}
              </div>
            )}

            {successMsg && (
              <div style={{ padding: '8px 12px', background: '#1a3a2a', border: '1px solid #10b981', borderRadius: 6, color: '#34d399', fontSize: 12, marginBottom: 14 }}>
                {successMsg}
              </div>
            )}

            <form onSubmit={addMember}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                  Staff Member Name *
                </label>
                <input
                  className="input-field"
                  placeholder="e.g. shamali"
                  required
                  value={newMemberName}
                  onChange={e => {
                    const name = e.target.value
                    setNewMemberName(name)
                    // Automatically generate email according to template: (name)@mathsps.com
                    const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '')
                    setNewMemberEmail(cleanName ? `${cleanName}@mathsps.com` : '')
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      document.getElementById('staff-register-password')?.focus()
                    }
                  }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                  Login Email *
                </label>
                <input
                  className="input-field"
                  type="email"
                  placeholder="shamali@mathsps.com"
                  required
                  value={newMemberEmail}
                  onChange={e => setNewMemberEmail(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                  Password *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="staff-register-password"
                    className="input-field"
                    type={showCreatePassword ? 'text' : 'password'}
                    placeholder="At least 6 characters"
                    required
                    style={{ paddingRight: 36 }}
                    value={newMemberPassword}
                    onChange={e => setNewMemberPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreatePassword(v => !v)}
                    style={{
                      position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4
                    }}
                    title={showCreatePassword ? 'Hide password' : 'Show password'}
                  >
                    {showCreatePassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                  Access Role
                </label>
                <select
                  className="input-field"
                  value={newMemberRole}
                  onChange={e => setNewMemberRole(e.target.value as any)}
                >
                  <option value="member">Member (Regular Staff - No Reports/Dashboard)</option>
                  <option value="admin">Admin (Manager - Full Access)</option>
                </select>
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={saving}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {saving ? 'Creating Account...' : '➕ Create Member Account'}
              </button>
            </form>
          </div>

        </div>
      </div>

      {/* Admin Password Confirmation Modal */}
      {modalAction && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div className="card" style={{ maxWidth: 420, width: '90%', padding: 24, borderRadius: 14, border: '1px solid var(--border)', boxShadow: '0 20px 40px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 22 }}>🔒</span>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Admin Authorization Required
                </h3>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {modalAction.type === 'role' && `Change role for ${modalAction.member.name} to ${modalAction.newRole?.toUpperCase()}`}
                  {modalAction.type === 'active' && `Toggle active status for ${modalAction.member.name} to ${modalAction.newActive ? 'ACTIVE' : 'INACTIVE'}`}
                  {modalAction.type === 'permissions' && `Configure lead visibility for ${modalAction.member.name}`}
                  {modalAction.type === 'reset_pwd' && `Set new password for ${modalAction.member.name} (${modalAction.member.email})`}
                  {modalAction.type === 'delete' && `Permanently delete ${modalAction.member.name} from team roster`}
                </div>
              </div>
            </div>

            {modalError && (
              <div style={{ padding: '8px 12px', background: '#2a1a1a', border: '1px solid var(--accent-red)', borderRadius: 6, color: '#f87171', fontSize: 12, marginBottom: 14 }}>
                ⚠️ {modalError}
              </div>
            )}

            <form onSubmit={handleConfirmAdminAction}>
              {modalAction.type === 'permissions' && (
                <div style={{ marginBottom: 16, background: 'rgba(255,255,255,0.03)', padding: 14, borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      <input
                        type="checkbox"
                        checked={modalAction.permissions?.can_view_all || false}
                        onChange={(e) => {
                          const val = e.target.checked
                          setModalAction(prev => prev ? {
                            ...prev,
                            permissions: {
                              can_view_all: val,
                              allowed_members: val ? [] : (prev.permissions?.allowed_members || [])
                            }
                          } : null)
                        }}
                      />
                      <span>Allow viewing ALL team leads (Global Access)</span>
                    </label>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 24, marginTop: 2 }}>
                      If checked, this member can view leads assigned to all team members.
                    </div>
                  </div>

                  {!modalAction.permissions?.can_view_all && (
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 8, fontWeight: 700 }}>
                        Select additional team members whose leads {modalAction.member.name} can view:
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, maxHeight: 150, overflowY: 'auto', paddingRight: 4 }}>
                        {members
                          .filter(otherM => otherM.name.toLowerCase() !== modalAction.member.name.toLowerCase())
                          .map(otherM => {
                            const isChecked = (modalAction.permissions?.allowed_members || []).includes(otherM.name)
                            return (
                              <label
                                key={otherM.id}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 6,
                                  fontSize: 12, padding: '4px 8px', borderRadius: 6,
                                  background: isChecked ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.02)',
                                  border: `1px solid ${isChecked ? '#3b82f6' : 'var(--border)'}`,
                                  cursor: 'pointer', color: isChecked ? '#93c5fd' : 'var(--text-secondary)'
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    const checked = e.target.checked
                                    setModalAction(prev => {
                                      if (!prev) return null
                                      const currentList = prev.permissions?.allowed_members || []
                                      const updatedList = checked
                                        ? [...currentList, otherM.name]
                                        : currentList.filter(n => n !== otherM.name)
                                      return {
                                        ...prev,
                                        permissions: {
                                          can_view_all: false,
                                          allowed_members: updatedList
                                        }
                                      }
                                    })
                                  }}
                                />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{otherM.name}</span>
                              </label>
                            )
                          })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {modalAction.type === 'reset_pwd' && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                    New Password for {modalAction.member.name} *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showModalNewPassword ? 'text' : 'password'}
                      className="input-field"
                      placeholder="Enter new password (min 6 chars)"
                      required
                      style={{ paddingRight: 36 }}
                      value={newStaffPasswordInput}
                      onChange={e => setNewStaffPasswordInput(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowModalNewPassword(v => !v)}
                      style={{
                        position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4
                      }}
                      title={showModalNewPassword ? 'Hide password' : 'Show password'}
                    >
                      {showModalNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                  Enter Admin Password to Authorize *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showModalAdminPassword ? 'text' : 'password'}
                    className="input-field"
                    placeholder="Enter your admin password"
                    autoFocus={modalAction.type !== 'reset_pwd'}
                    required
                    style={{ paddingRight: 36 }}
                    value={adminPasswordInput}
                    onChange={e => setAdminPasswordInput(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowModalAdminPassword(v => !v)}
                    style={{
                      position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4
                    }}
                    title={showModalAdminPassword ? 'Hide password' : 'Show password'}
                  >
                    {showModalAdminPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setModalAction(null)}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={modalAction.type === 'delete' ? 'btn-danger' : 'btn-primary'}
                  disabled={actionLoading}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {actionLoading
                    ? 'Verifying...'
                    : modalAction.type === 'delete'
                    ? '🗑 Delete Member'
                    : modalAction.type === 'reset_pwd'
                    ? '🔑 Update Password'
                    : modalAction.type === 'permissions'
                    ? '✓ Save Permissions'
                    : '✓ Confirm & Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
