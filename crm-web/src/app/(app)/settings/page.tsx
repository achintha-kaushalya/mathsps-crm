'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Settings,
  Lock,
  User,
  Shield,
  Eye,
  EyeOff,
  Database,
  Download,
  Upload,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  FileJson,
  Layers,
  Archive
} from 'lucide-react'

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

  // Backup & Restore State
  const [backupLoading, setBackupLoading] = useState(false)
  const [backupStatus, setBackupStatus] = useState('')
  const [restoreFile, setRestoreFile] = useState<File | null>(null)
  const [backupPayload, setBackupPayload] = useState<any | null>(null)
  const [restoreLoading, setRestoreLoading] = useState(false)
  const [restoreProgress, setRestoreProgress] = useState('')
  const [restoreSuccess, setRestoreSuccess] = useState('')
  const [restoreError, setRestoreError] = useState('')
  const [showRestoreModal, setShowRestoreModal] = useState(false)
  const [restoreMode, setRestoreMode] = useState<'upsert' | 'clean_wipe'>('upsert')
  const [confirmText, setConfirmText] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)

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

  // Helper to fetch all rows for a table with chunking
  async function fetchAllTableRows(tableName: string) {
    const CHUNK_SIZE = 1000
    let all: any[] = []
    let from = 0
    let hasMore = true

    while (hasMore) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .range(from, from + CHUNK_SIZE - 1)

      if (error) throw error
      all = all.concat(data || [])

      if (!data || data.length < CHUNK_SIZE) {
        hasMore = false
      } else {
        from += CHUNK_SIZE
      }
    }
    return all
  }

  // Generate & Download Backup Snapshot
  async function handleCreateBackup() {
    setBackupLoading(true)
    setBackupStatus('Exporting database tables...')
    try {
      setBackupStatus('Exporting members & configurations...')
      const members = await fetchAllTableRows('members')

      setBackupStatus('Exporting households & addresses...')
      const households = await fetchAllTableRows('households')

      setBackupStatus('Exporting students...')
      const students = await fetchAllTableRows('students')

      setBackupStatus('Exporting enrollments...')
      const enrollments = await fetchAllTableRows('enrollments')

      setBackupStatus('Exporting payments history...')
      const payments = await fetchAllTableRows('payments')

      setBackupStatus('Exporting student balances...')
      const student_balances = await fetchAllTableRows('student_balances')

      setBackupStatus('Exporting leads CRM...')
      const leads = await fetchAllTableRows('leads')

      const backupData = {
        app: 'MathsPS Lead & Payment CRM',
        version: '1.0',
        exported_at: new Date().toISOString(),
        exported_by: name || email || 'Admin',
        summary: {
          total_members: members.length,
          total_households: households.length,
          total_students: students.length,
          total_enrollments: enrollments.length,
          total_payments: payments.length,
          total_student_balances: student_balances.length,
          total_leads: leads.length,
        },
        database: {
          members,
          households,
          students,
          enrollments,
          payments,
          student_balances,
          leads,
        }
      }

      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(backupData, null, 2))}`
      const downloadAnchor = document.createElement('a')
      const dateTag = new Date().toISOString().slice(0, 10)
      const timeTag = new Date().toTimeString().slice(0, 5).replace(':', '')
      downloadAnchor.setAttribute('href', jsonString)
      downloadAnchor.setAttribute('download', `mathsps_crm_backup_${dateTag}_${timeTag}.json`)
      document.body.appendChild(downloadAnchor)
      downloadAnchor.click()
      downloadAnchor.remove()

      setBackupStatus(`✓ Backup downloaded successfully (${students.length} students, ${payments.length} payments, ${leads.length} leads).`)
    } catch (e: any) {
      alert('Failed to generate backup: ' + e.message)
      setBackupStatus('⚠️ Backup failed: ' + e.message)
    } finally {
      setBackupLoading(false)
    }
  }

  // Handle file select for restore
  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setRestoreFile(file)
    setRestoreError('')
    setRestoreSuccess('')

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string)
        if (!parsed.database || (!parsed.database.students && !parsed.database.payments)) {
          throw new Error('Invalid backup file structure: missing database tables.')
        }
        setBackupPayload(parsed)
        setShowRestoreModal(true)
      } catch (err: any) {
        setRestoreError('Failed to parse backup file: ' + err.message)
        setBackupPayload(null)
      }
    }
    reader.readAsText(file)
  }

  // Chunk insert/upsert helper
  async function chunkInsert(table: string, rows: any[], updateProgressText: string) {
    if (!rows || rows.length === 0) return
    const BATCH = 200
    for (let i = 0; i < rows.length; i += BATCH) {
      const slice = rows.slice(i, i + BATCH).map(row => {
        // Clean out generated columns if present
        if (table === 'payments' && 'balance_after' in row) {
          const { balance_after, ...rest } = row
          return rest
        }
        return row
      })

      setRestoreProgress(`${updateProgressText} (${Math.min(i + BATCH, rows.length)} / ${rows.length})...`)
      const { error } = await supabase.from(table).upsert(slice)
      if (error) throw new Error(`Error restoring ${table}: ${error.message}`)
    }
  }

  // Execute restore process
  async function executeRestore() {
    if (!backupPayload?.database) return
    setRestoreLoading(true)
    setRestoreError('')
    setRestoreSuccess('')

    const db = backupPayload.database

    try {
      // If Clean Wipe mode selected, delete tables in reverse foreign key order
      if (restoreMode === 'clean_wipe') {
        if (confirmText !== 'RESTORE') {
          throw new Error('Please type RESTORE to confirm full database rebuild.')
        }
        setRestoreProgress('Clearing existing database records...')
        await supabase.from('payments').delete().neq('id', '00000000-0000-0000-0000-000000000000')
        await supabase.from('student_balances').delete().neq('id', '00000000-0000-0000-0000-000000000000')
        await supabase.from('enrollments').delete().neq('id', '00000000-0000-0000-0000-000000000000')
        await supabase.from('students').delete().neq('id', '00000000-0000-0000-0000-000000000000')
        await supabase.from('households').delete().neq('id', '00000000-0000-0000-0000-000000000000')
        await supabase.from('leads').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      }

      // Restore in strict foreign-key order
      if (db.members) await chunkInsert('members', db.members, 'Restoring members')
      if (db.households) await chunkInsert('households', db.households, 'Restoring households')
      if (db.students) await chunkInsert('students', db.students, 'Restoring students')
      if (db.enrollments) await chunkInsert('enrollments', db.enrollments, 'Restoring enrollments')
      if (db.payments) await chunkInsert('payments', db.payments, 'Restoring payments')
      if (db.student_balances) await chunkInsert('student_balances', db.student_balances, 'Restoring student balances')
      if (db.leads) await chunkInsert('leads', db.leads, 'Restoring marketing leads')

      setRestoreSuccess(`✓ System restored successfully! Restored ${db.students?.length || 0} students and ${db.payments?.length || 0} payment records.`)
      setShowRestoreModal(false)
      setBackupPayload(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (e: any) {
      setRestoreError(e.message || 'Failed to restore database.')
    } finally {
      setRestoreLoading(false)
      setRestoreProgress('')
    }
  }

  const isAdmin = role === 'admin'

  return (
    <div className="fade-in" style={{ paddingBottom: 60 }}>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Settings size={22} style={{ color: 'var(--accent-blue)' }} />
            Account Settings &amp; System Backup
          </h1>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
            Manage staff credentials, export full system snapshots, and restore database
          </div>
        </div>
      </div>

      <div className="page-content" style={{ maxWidth: 760 }}>

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

        {/* Database Backup & Restore Engine (Admin Only) */}
        {isAdmin && (
          <div className="glass-card" style={{ padding: 24, marginBottom: 20 }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6, color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Database size={18} /> Database Backup &amp; Disaster Recovery
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 18px' }}>
              Download a complete offline snapshot file (.json) containing all students, payments, balances, households, and marketing leads. You can use this file anytime to restore the entire CRM.
            </p>

            {backupStatus && (
              <div style={{
                padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16,
                background: backupStatus.startsWith('✓') ? 'rgba(16,185,129,0.1)' : 'rgba(59,130,246,0.1)',
                border: `1px solid ${backupStatus.startsWith('✓') ? '#10b981' : 'var(--accent-blue)'}`,
                color: backupStatus.startsWith('✓') ? '#34d399' : 'var(--accent-blue)'
              }}>
                {backupStatus}
              </div>
            )}

            {restoreSuccess && (
              <div style={{ padding: '10px 14px', background: 'rgba(16,185,129,0.1)', border: '1px solid #10b981', borderRadius: 8, color: '#34d399', fontSize: 13, marginBottom: 16 }}>
                {restoreSuccess}
              </div>
            )}

            {restoreError && (
              <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid var(--accent-red)', borderRadius: 8, color: '#f87171', fontSize: 13, marginBottom: 16 }}>
                ⚠️ {restoreError}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {/* Export Button */}
              <div style={{ padding: 16, borderRadius: 8, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Download size={15} style={{ color: 'var(--accent-blue)' }} /> Download Backup
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>
                  Generates full system snapshot with all active records and history.
                </div>
                <button
                  type="button"
                  onClick={handleCreateBackup}
                  disabled={backupLoading}
                  className="btn-primary"
                  style={{ width: '100%', justifyContent: 'center', padding: '9px 14px', fontSize: 13 }}
                >
                  {backupLoading ? <RefreshCw size={14} className="spin" /> : <Download size={14} />}
                  {backupLoading ? 'Exporting...' : 'Download Full Backup (.json)'}
                </button>
              </div>

              {/* Restore Button */}
              <div style={{ padding: 16, borderRadius: 8, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Upload size={15} style={{ color: 'var(--accent-purple)' }} /> Restore Database
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>
                  Upload a previously saved .json backup snapshot to restore records.
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json"
                  onChange={handleFileSelected}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-secondary"
                  style={{ width: '100%', justifyContent: 'center', padding: '9px 14px', fontSize: 13 }}
                >
                  <FileJson size={14} /> Select Backup File to Restore
                </button>
              </div>
            </div>
          </div>
        )}

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

      {/* Restore Inspection & Confirmation Modal */}
      {showRestoreModal && backupPayload && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16
        }}>
          <div className="glass-card" style={{ maxWidth: 540, width: '100%', padding: 24, borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <Archive size={22} style={{ color: 'var(--accent-purple)' }} />
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Inspect &amp; Restore Backup</h3>
            </div>

            <div style={{ padding: 14, background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                Backup Date: <strong>{new Date(backupPayload.exported_at || Date.now()).toLocaleString()}</strong>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                <div>👥 Students: <strong>{(backupPayload.database?.students?.length || 0).toLocaleString()}</strong></div>
                <div>💳 Payments: <strong>{(backupPayload.database?.payments?.length || 0).toLocaleString()}</strong></div>
                <div>🏠 Households: <strong>{(backupPayload.database?.households?.length || 0).toLocaleString()}</strong></div>
                <div>📞 Leads: <strong>{(backupPayload.database?.leads?.length || 0).toLocaleString()}</strong></div>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Restore Mode:</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="restore_mode"
                    value="upsert"
                    checked={restoreMode === 'upsert'}
                    onChange={() => setRestoreMode('upsert')}
                  />
                  <span><strong>Merge &amp; Update (Safe)</strong> — Updates existing records and adds missing ones</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="restore_mode"
                    value="clean_wipe"
                    checked={restoreMode === 'clean_wipe'}
                    onChange={() => setRestoreMode('clean_wipe')}
                  />
                  <span style={{ color: '#f87171' }}><strong>Clean Wipe &amp; Full Rebuild</strong> — Clears existing database before restoring</span>
                </label>
              </div>
            </div>

            {restoreMode === 'clean_wipe' && (
              <div style={{ marginBottom: 16, padding: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid var(--accent-red)', borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: '#f87171', marginBottom: 6 }}>
                  Type <strong>RESTORE</strong> below to confirm replacing current data:
                </div>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Type RESTORE"
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                />
              </div>
            )}

            {restoreProgress && (
              <div style={{ padding: '8px 12px', background: 'rgba(59,130,246,0.15)', borderRadius: 6, color: 'var(--accent-blue)', fontSize: 13, marginBottom: 14 }}>
                <RefreshCw size={13} className="spin" style={{ display: 'inline', marginRight: 6 }} />
                {restoreProgress}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-secondary"
                disabled={restoreLoading}
                onClick={() => {
                  setShowRestoreModal(false)
                  setBackupPayload(null)
                  if (fileInputRef.current) fileInputRef.current.value = ''
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={restoreLoading || (restoreMode === 'clean_wipe' && confirmText !== 'RESTORE')}
                onClick={executeRestore}
              >
                {restoreLoading ? 'Restoring...' : '🚀 Start Restore'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

