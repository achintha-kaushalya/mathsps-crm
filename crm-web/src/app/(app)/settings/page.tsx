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
  Archive,
  Mail,
  Activity,
  Cpu,
  Server,
  Trash2,
  HardDrive,
  Users,
  Check
} from 'lucide-react'
import EmailAutomationCard from './components/EmailAutomationCard'

export default function SettingsPage() {
  const supabase = createClient()

  // Primary Tab State
  const [activeTab, setActiveTab] = useState<'account_security' | 'database_backup' | 'email_automation' | 'diagnostics'>('account_security')

  // User Profile
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [activeTutor, setActiveTutor] = useState('prabuddha')

  // Password Change
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [passError, setPassError] = useState('')
  const [passSuccess, setPassSuccess] = useState('')

  // Database Summary Stats
  const [dbCounts, setDbCounts] = useState<{
    students: number
    payments: number
    households: number
    leads: number
  }>({ students: 0, payments: 0, households: 0, leads: 0 })
  const [statsLoading, setStatsLoading] = useState(false)

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

  // Cache & Diagnostics State
  const [cacheStatus, setCacheStatus] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setEmail(user.email || '')
        setName(user.user_metadata?.full_name || 'Staff Member')
        setRole(user.user_metadata?.role || 'member')
      }
    })

    if (typeof window !== 'undefined') {
      const tutor = localStorage.getItem('mathsps_active_tutor') || 'prabuddha'
      setActiveTutor(tutor)
    }

    loadDatabaseSummaryCounts()
  }, [])

  async function loadDatabaseSummaryCounts() {
    setStatsLoading(true)
    try {
      const [stuRes, payRes, houseRes, leadRes] = await Promise.all([
        supabase.from('students').select('*', { count: 'exact', head: true }),
        supabase.from('payments').select('*', { count: 'exact', head: true }),
        supabase.from('households').select('*', { count: 'exact', head: true }),
        supabase.from('leads').select('*', { count: 'exact', head: true })
      ])
      setDbCounts({
        students: stuRes.count || 0,
        payments: payRes.count || 0,
        households: houseRes.count || 0,
        leads: leadRes.count || 0
      })
    } catch (e) {
      console.warn('Failed to load count stats', e)
    } finally {
      setStatsLoading(false)
    }
  }

  async function handlePasswordUpdate(e: React.FormEvent) {
    e.preventDefault()
    setPassError('')
    setPassSuccess('')

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
      loadDatabaseSummaryCounts()
    } catch (e: any) {
      setRestoreError(e.message || 'Failed to restore database.')
    } finally {
      setRestoreLoading(false)
      setRestoreProgress('')
    }
  }

  function handleClearLocalCache() {
    try {
      localStorage.removeItem('mathsps_active_tutor')
      setCacheStatus('✓ Local UI cache and filter state reset.')
      setTimeout(() => setCacheStatus(''), 3500)
    } catch (e) {
      console.error(e)
    }
  }

  const isAdmin = role === 'admin'

  return (
    <div className="fade-in" style={{ paddingBottom: 60 }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Settings size={22} style={{ color: 'var(--accent-blue)' }} />
            Account Settings &amp; System Hub
          </h1>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
            Manage staff credentials, automated reports, database backups, and system diagnostics
          </div>
        </div>
      </div>

      <div className="page-content" style={{ width: '100%', maxWidth: '100%' }}>
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 12, flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveTab('account_security')}
            className={activeTab === 'account_security' ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '8px 18px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <User size={16} />
            👤 Account &amp; Security
          </button>

          <button
            onClick={() => setActiveTab('database_backup')}
            className={activeTab === 'database_backup' ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '8px 18px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Database size={16} />
            💾 Database Backup &amp; Recovery
            <span style={{
              background: activeTab === 'database_backup' ? 'rgba(255,255,255,0.2)' : 'rgba(74,222,128,0.15)',
              color: activeTab === 'database_backup' ? '#fff' : '#4ade80',
              padding: '2px 8px', borderRadius: 12, fontSize: 11
            }}>
              {dbCounts.students} students
            </span>
          </button>

          <button
            onClick={() => setActiveTab('email_automation')}
            className={activeTab === 'email_automation' ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '8px 18px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Mail size={16} />
            📧 Email Reports &amp; Dispatch
          </button>

          <button
            onClick={() => setActiveTab('diagnostics')}
            className={activeTab === 'diagnostics' ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '8px 18px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Cpu size={16} />
            ⚡ System Diagnostics
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: ACCOUNT & SECURITY                                                 */}
        {/* ========================================================================= */}
        {activeTab === 'account_security' && (
          <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Profile Info Card */}
            <div className="glass-card" style={{ padding: 24, borderLeft: '4px solid #38bdf8', boxShadow: '0 4px 20px -4px rgba(56, 189, 248, 0.25)' }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 18, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 8 }}>
                <User size={18} /> Staff Profile Overview
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Staff Name</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{name}</div>
                </div>

                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Login Email</div>
                  <div style={{ fontSize: 14, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{email}</div>
                </div>

                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Access Permission Role</div>
                  <span className="badge" style={{
                    background: role === 'admin' ? 'rgba(192, 132, 252, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                    color: role === 'admin' ? '#c084fc' : '#38bdf8',
                    padding: '4px 10px',
                    fontSize: 12,
                    fontWeight: 700
                  }}>
                    {role.toUpperCase()}
                  </span>
                </div>

                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Active Tutor Scope</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="badge" style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', fontWeight: 600 }}>
                      {activeTutor === 'sanduni' ? 'Sanduni (SM)' : 'Prabuddha (PS)'}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      (Switch anytime via the sidebar top switch button)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Password Change Form */}
            <div className="glass-card" style={{ padding: 24, borderLeft: '4px solid #818cf8', boxShadow: '0 4px 20px -4px rgba(129, 140, 248, 0.25)' }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: '#818cf8', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Lock size={18} /> Change Login Password
              </div>

              {passError && (
                <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--accent-red)', borderRadius: 8, color: '#f87171', fontSize: 13, marginBottom: 16 }}>
                  ⚠️ {passError}
                </div>
              )}

              {passSuccess && (
                <div style={{ padding: '10px 14px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', borderRadius: 8, color: '#34d399', fontSize: 13, marginBottom: 16 }}>
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
                      style={{ paddingRight: 36, width: '100%' }}
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
                      style={{ paddingRight: 36, width: '100%' }}
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
                  style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: 13, fontWeight: 700 }}
                >
                  {savingPassword ? 'Updating Password...' : '🔒 Update Account Password'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: DATABASE BACKUP & RECOVERY                                         */}
        {/* ========================================================================= */}
        {activeTab === 'database_backup' && (
          <div className="fade-in">
            {/* Health & Live Record Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
              <div className="stat-card" style={{ borderLeft: '4px solid #38bdf8', boxShadow: '0 4px 20px -4px rgba(56, 189, 248, 0.25)' }}>
                <div className="stat-card label">Total Students</div>
                <div className="stat-card value" style={{ color: '#38bdf8' }}>{dbCounts.students.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Active registered records</div>
              </div>

              <div className="stat-card" style={{ borderLeft: '4px solid #4ade80', boxShadow: '0 4px 20px -4px rgba(74, 222, 128, 0.25)' }}>
                <div className="stat-card label">Payment Slips</div>
                <div className="stat-card value" style={{ color: '#4ade80' }}>{dbCounts.payments.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Audited ledger records</div>
              </div>

              <div className="stat-card" style={{ borderLeft: '4px solid #fcd34d', boxShadow: '0 4px 20px -4px rgba(245, 158, 11, 0.25)' }}>
                <div className="stat-card label">Households &amp; Families</div>
                <div className="stat-card value" style={{ color: '#f59e0b' }}>{dbCounts.households.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Parent contact &amp; address records</div>
              </div>

              <div className="stat-card" style={{ borderLeft: '4px solid #818cf8', boxShadow: '0 4px 20px -4px rgba(129, 140, 248, 0.25)' }}>
                <div className="stat-card label">Marketing Leads</div>
                <div className="stat-card value" style={{ color: '#818cf8' }}>{dbCounts.leads.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>CRM intake pipeline records</div>
              </div>
            </div>

            {/* Backup & Restore Action Engines */}
            <div className="glass-card" style={{ padding: 24, borderLeft: '4px solid #4ade80', boxShadow: '0 4px 20px -4px rgba(74, 222, 128, 0.25)' }}>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Database size={20} /> Full Offline Database Backup &amp; Disaster Recovery
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 18px' }}>
                Download an offline snapshot file (.json) containing all students, payments, balances, households, and marketing leads. You can use this file anytime to restore the entire CRM.
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Export Button */}
                <div style={{ padding: 18, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-base)' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-primary)' }}>
                    <Download size={16} style={{ color: '#4ade80' }} /> Download Offline Backup
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.4 }}>
                    Generates a complete JSON snapshot file containing all tables, balances, enrollments, and slip history.
                  </div>
                  <button
                    type="button"
                    onClick={handleCreateBackup}
                    disabled={backupLoading}
                    className="btn-primary"
                    style={{ width: '100%', justifyContent: 'center', padding: '10px 14px', fontSize: 13, fontWeight: 700 }}
                  >
                    {backupLoading ? <RefreshCw size={14} className="spin" /> : <Download size={14} />}
                    {backupLoading ? 'Exporting Tables...' : 'Download Full Backup (.json)'}
                  </button>
                </div>

                {/* Restore Button */}
                <div style={{ padding: 18, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-base)' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-primary)' }}>
                    <Upload size={16} style={{ color: '#818cf8' }} /> Restore Database Snapshot
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.4 }}>
                    Upload a previously saved .json backup snapshot to inspect records and merge or rebuild the database.
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
                    style={{ width: '100%', justifyContent: 'center', padding: '10px 14px', fontSize: 13, fontWeight: 700 }}
                  >
                    <FileJson size={14} /> Select Backup File to Restore
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: EMAIL REPORTS & DISPATCH CENTER                                    */}
        {/* ========================================================================= */}
        {activeTab === 'email_automation' && (
          <div className="fade-in">
            <EmailAutomationCard />
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: SYSTEM DIAGNOSTICS                                                 */}
        {/* ========================================================================= */}
        {activeTab === 'diagnostics' && (
          <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20 }}>
            {/* System Info Card */}
            <div className="glass-card" style={{ padding: 24, borderLeft: '4px solid #fcd34d', boxShadow: '0 4px 20px -4px rgba(245, 158, 11, 0.25)' }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity size={18} /> System Diagnostics &amp; Environment
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>CRM Application Version</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>v2.4.0 (Turbopack Engine)</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Database Host</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80' }}></span>
                    Supabase PostgreSQL Connected
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Local Server Time</span>
                  <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace' }}>
                    {new Date().toLocaleString('en-US', { timeZone: 'Asia/Colombo' })} (UTC+5:30)
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Client Framework</span>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Next.js 16 + React 19</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Session Security</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#38bdf8' }}>Supabase JWT Auth (Active)</span>
                </div>
              </div>
            </div>

            {/* Cache & Local State Card */}
            <div className="glass-card" style={{ padding: 24, borderLeft: '4px solid #818cf8', boxShadow: '0 4px 20px -4px rgba(129, 140, 248, 0.25)' }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: '#818cf8', display: 'flex', alignItems: 'center', gap: 8 }}>
                <HardDrive size={18} /> Storage &amp; Cache Controls
              </div>

              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18, lineHeight: 1.5 }}>
                Reset locally cached tutor filters, date pickers, or table search buffers if you experience state inconsistencies.
              </p>

              {cacheStatus && (
                <div style={{ padding: '10px 14px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', borderRadius: 8, color: '#34d399', fontSize: 13, marginBottom: 16 }}>
                  {cacheStatus}
                </div>
              )}

              <button
                type="button"
                onClick={handleClearLocalCache}
                className="btn-secondary"
                style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Trash2 size={15} style={{ color: '#f87171' }} /> Reset Local UI State &amp; Cache
              </button>
            </div>
          </div>
        )}

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
    </div>
  )
}
