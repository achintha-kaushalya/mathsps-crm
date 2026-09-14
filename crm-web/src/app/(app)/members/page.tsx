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

  useEffect(() => {
    loadMembers()

    // Realtime postgres changes subscription for members table
    const channel = supabase.channel('members-realtime-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, () => {
        loadMembers()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

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
    <div className="fade-in" style={{ padding: '0 4px' }}>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-primary)' }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
              color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Users size={18} />
            </div>
            Team Members & Access Control
          </h1>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Manage staff members, switch roles, configure lead visibility permissions, and toggle active status
          </div>
        </div>
      </div>

      <div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>

          {/* Members List */}
          <div className="stat-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{
              padding: '14px 20px', borderBottom: '1px solid var(--border)',
              background: '#f8fafc',
              fontWeight: 700, fontSize: 13.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--text-primary)' }}>Active Team Roster</span>
                <span style={{ fontSize: 11, background: '#e2e8f0', color: '#475569', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
                  {members.length}
                </span>
              </div>
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Lock size={12} /> Admin verification required for changes
              </span>
            </div>

            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading members...</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ paddingLeft: 16 }}>Member Name</th>
                      <th>Email Account</th>
                      <th style={{ textAlign: 'center', width: 115 }}>Role</th>
                      <th style={{ textAlign: 'center', width: 140 }}>Lead Visibility</th>
                      <th style={{ textAlign: 'center', width: 70 }}>Status</th>
                      <th style={{ textAlign: 'center', width: 95, paddingRight: 16 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map(m => {
                      let perms: { allowed_members?: string[]; can_view_all?: boolean; sub_role?: string } = {}
                      try {
                        if (m.notes) perms = JSON.parse(m.notes)
                      } catch {}
                      const isAll = perms.can_view_all || m.role === 'admin'
                      const allowed = perms.allowed_members || []
                      const effectiveRole = perms.sub_role || m.role

                      const roleBadgeStyles: Record<string, { bg: string; color: string; border: string }> = {
                        admin: { bg: '#faf5ff', color: '#7c3aed', border: '#e9d5ff' },
                        callcenter: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
                        payments: { bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
                        member: { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
                      }
                      const currentRoleStyle = roleBadgeStyles[effectiveRole] || roleBadgeStyles.member

                      return (
                      <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ fontWeight: 700, paddingLeft: 16, color: 'var(--text-primary)' }}>
                          {m.name}
                        </td>
                        <td style={{ color: m.email ? '#475569' : '#ea580c', fontSize: 12 }}>
                          {m.email ? m.email : '⚠️ No Login Account'}
                        </td>

                        {/* Interactive Role Switcher */}
                        <td style={{ textAlign: 'center' }}>
                          <select
                            className="input-field"
                            style={{
                              padding: '2px 6px', fontSize: 11, height: 26, width: 110,
                              background: currentRoleStyle.bg,
                              color: currentRoleStyle.color,
                              borderColor: currentRoleStyle.border,
                              fontWeight: 700,
                              margin: '0 auto'
                            }}
                            value={effectiveRole}
                            onChange={(e) => {
                              const selectedRole = e.target.value as any
                              if (selectedRole !== effectiveRole) {
                                setModalAction({ type: 'role', member: m, newRole: selectedRole })
                                setAdminPasswordInput('')
                                setModalError('')
                              }
                            }}
                          >
                            <option value="member" style={{ background: '#ffffff', color: '#16a34a' }}>MEMBER (Both)</option>
                            <option value="callcenter" style={{ background: '#ffffff', color: '#2563eb' }}>CALL CENTER</option>
                            <option value="payments" style={{ background: '#ffffff', color: '#d97706' }}>PAYMENTS</option>
                            <option value="admin" style={{ background: '#ffffff', color: '#7c3aed' }}>ADMIN (Full)</option>
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
                              background: isAll ? '#eff6ff' : allowed.length > 0 ? '#faf5ff' : '#f8fafc',
                              border: `1px solid ${isAll ? '#bfdbfe' : allowed.length > 0 ? '#e9d5ff' : '#e2e8f0'}`,
                              color: isAll ? '#2563eb' : allowed.length > 0 ? '#7c3aed' : '#64748b',
                              padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
                              transition: 'all 0.15s'
                            }}
                            title="Click to configure which members' assigned leads this user can view"
                          >
                            <span>{isAll ? '🌐 All Leads' : allowed.length > 0 ? `👥 Own + ${allowed.length}` : '🔒 Own leads'}</span>
                            <span style={{ fontSize: 9, opacity: 0.7 }}>⚙</span>
                          </button>
                        </td>

                        {/* Clean Flat On/Off Button */}
                        <td style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => {
                              setModalAction({ type: 'active', member: m, newActive: !m.active })
                              setAdminPasswordInput('')
                              setModalError('')
                            }}
                            style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                              padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                              cursor: 'pointer', border: '1px solid', width: 56, height: 24,
                              background: m.active ? '#ecfdf5' : '#fef2f2',
                              borderColor: m.active ? '#a7f3d0' : '#fee2e2',
                              color: m.active ? '#059669' : '#dc2626',
                              transition: 'all 0.15s'
                            }}
                            title={`Click to turn ${m.active ? 'OFF' : 'ON'}`}
                          >
                            <span style={{
                              width: 5, height: 5, borderRadius: '50%',
                              background: m.active ? '#059669' : '#dc2626'
                            }} />
                            <span>{m.active ? 'ON' : 'OFF'}</span>
                          </button>
                        </td>

                        {/* Actions & Delete Member */}
                        <td style={{ textAlign: 'center', paddingRight: 16 }}>
                          <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ width: 60, display: 'flex', justifyContent: 'center' }}>
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
                                  style={{ padding: '2px 6px', fontSize: 11, height: 24, whiteSpace: 'nowrap' }}
                                  title="Set up login email and password for this member"
                                >
                                  Setup
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
                                  style={{ padding: '2px 6px', fontSize: 11, height: 24, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 3 }}
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
                                cursor: 'pointer', fontSize: 13, padding: '2px 4px', opacity: 0.75,
                                transition: 'opacity 0.15s, transform 0.15s',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                              }}
                              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                              onMouseLeave={e => e.currentTarget.style.opacity = '0.75'}
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
              </div>
            )}
          </div>

          {/* Add Member Form */}
          <div className="stat-card" style={{ padding: 22, border: '1px solid #e2e8f0' }}>
            <div style={{ fontWeight: 800, fontSize: 14.5, marginBottom: 16, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 6,
                background: '#eff6ff', color: '#2563eb',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <UserPlus size={15} />
              </div>
              Create Staff Account
            </div>

            {error && (
              <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 8, color: '#dc2626', fontSize: 12, marginBottom: 14 }}>
                ⚠️ {error}
              </div>
            )}

            {successMsg && (
              <div style={{ padding: '8px 12px', background: '#ecfdf5', border: '1px solid #d1fae5', borderRadius: 8, color: '#059669', fontSize: 12, marginBottom: 14 }}>
                {successMsg}
              </div>
            )}

            <form onSubmit={addMember}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 5 }}>
                  Staff Member Name *
                </label>
                <input
                  className="input-field"
                  placeholder="e.g. shamali"
                  required
                  style={{ height: 36, fontSize: 13 }}
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
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 5 }}>
                  Login Email *
                </label>
                <input
                  className="input-field"
                  type="email"
                  placeholder="shamali@mathsps.com"
                  required
                  style={{ height: 36, fontSize: 13 }}
                  value={newMemberEmail}
                  onChange={e => setNewMemberEmail(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 5 }}>
                  Password *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="staff-register-password"
                    className="input-field"
                    type={showCreatePassword ? 'text' : 'password'}
                    placeholder="At least 6 characters"
                    required
                    style={{ height: 36, fontSize: 13, paddingRight: 36 }}
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
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 5 }}>
                  Access Role
                </label>
                <select
                  className="input-field"
                  style={{ height: 36, fontSize: 13 }}
                  value={newMemberRole}
                  onChange={e => setNewMemberRole(e.target.value as any)}
                >
                  <option value="member">Member (CRM & Payments)</option>
                  <option value="callcenter">Call Center (CRM Only)</option>
                  <option value="payments">Payments (Payments Only)</option>
                  <option value="admin">Admin (Full Access)</option>
                </select>
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={saving}
                style={{ width: '100%', height: 38, justifyContent: 'center', fontSize: 13.5 }}
              >
                {saving ? 'Creating...' : '+ Add Member'}
              </button>
            </form>
          </div>

        </div>
      </div>

      {/* Admin Password Confirmation Modal */}
      {modalAction && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div className="stat-card" style={{ maxWidth: 440, width: '90%', padding: 26, borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                🔒
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
                  Admin Authorization Required
                </h3>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {modalAction.type === 'role' && `Change role for ${modalAction.member.name} to ${modalAction.newRole?.toUpperCase()}`}
                  {modalAction.type === 'active' && `Toggle active status for ${modalAction.member.name} to ${modalAction.newActive ? 'ACTIVE' : 'INACTIVE'}`}
                  {modalAction.type === 'permissions' && `Configure lead visibility for ${modalAction.member.name}`}
                  {modalAction.type === 'reset_pwd' && `Set new password for ${modalAction.member.name} (${modalAction.member.email})`}
                  {modalAction.type === 'delete' && `Permanently delete ${modalAction.member.name} from team roster`}
                </div>
              </div>
            </div>

            {modalError && (
              <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 8, color: '#dc2626', fontSize: 12, marginBottom: 14 }}>
                ⚠️ {modalError}
              </div>
            )}

            <form onSubmit={handleConfirmAdminAction}>
              {modalAction.type === 'permissions' && (
                <div style={{ marginBottom: 16, background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
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
