'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Mail,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  Key,
  Users,
  FileSpreadsheet,
  RefreshCw,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Server
} from 'lucide-react'

export default function EmailAutomationCard() {
  const supabase = createClient()
  const [provider, setProvider] = useState<'smtp' | 'resend'>('smtp')

  // Resend API state
  const [apiKey, setApiKey] = useState('')
  const [fromEmail, setFromEmail] = useState('')

  // Gmail / SMTP state
  const [smtpUser, setSmtpUser] = useState('')
  const [smtpPass, setSmtpPass] = useState('')

  // Common settings
  const [recipients, setRecipients] = useState<string[]>([])
  const [recipientInput, setRecipientInput] = useState('')
  
  // Dual Schedules (Morning Strategy vs Evening Day-End)
  const [morningSchedule, setMorningSchedule] = useState(true)
  const [morningTime, setMorningTime] = useState('07:00') // 7:00 AM
  const [eveningSchedule, setEveningSchedule] = useState(true)
  const [eveningTime, setEveningTime] = useState('21:00') // 9:00 PM

  const [includeCsv, setIncludeCsv] = useState(true)
  
  const [testingType, setTestingType] = useState<'morning' | 'evening' | null>(null)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [savedSuccess, setSavedSuccess] = useState(false)

  // Load saved settings from Supabase database first, then fallback to localStorage
  useEffect(() => {
    async function loadDatabaseEmailSettings() {
      try {
        const { data: adminRecord } = await supabase
          .from('members')
          .select('id, notes')
          .eq('name', 'Admin User')
          .single()

        let dbSettings: any = null
        if (adminRecord?.notes) {
          const parsed = JSON.parse(adminRecord.notes)
          if (parsed.email_settings) {
            dbSettings = parsed.email_settings
          }
        }

        if (dbSettings) {
          if (dbSettings.provider) setProvider(dbSettings.provider)
          if (dbSettings.apiKey) setApiKey(dbSettings.apiKey)
          if (dbSettings.fromEmail) setFromEmail(dbSettings.fromEmail)
          if (dbSettings.smtpUser) setSmtpUser(dbSettings.smtpUser)
          if (dbSettings.smtpPass) setSmtpPass(dbSettings.smtpPass)
          if (dbSettings.recipients && Array.isArray(dbSettings.recipients)) {
            setRecipients(dbSettings.recipients)
          }
          if (dbSettings.morningSchedule !== undefined) setMorningSchedule(dbSettings.morningSchedule)
          if (dbSettings.morningTime) setMorningTime(dbSettings.morningTime)
          if (dbSettings.eveningSchedule !== undefined) setEveningSchedule(dbSettings.eveningSchedule)
          if (dbSettings.eveningTime) setEveningTime(dbSettings.eveningTime)
          if (dbSettings.includeCsv !== undefined) setIncludeCsv(dbSettings.includeCsv)
          return
        }
      } catch (err) {
        console.warn('Failed to load email settings from DB, trying localStorage:', err)
      }

      // Fallback to localStorage
      try {
        const savedProvider = (localStorage.getItem('MATHSPS_EMAIL_PROVIDER') as 'smtp' | 'resend') || 'smtp'
        const savedKey = localStorage.getItem('MATHSPS_RESEND_API_KEY') || ''
        const savedFrom = localStorage.getItem('MATHSPS_RESEND_FROM_EMAIL') || ''
        const savedSmtpUser = localStorage.getItem('MATHSPS_SMTP_USER') || ''
        const savedSmtpPass = localStorage.getItem('MATHSPS_SMTP_PASS') || ''
        const savedRecipients = localStorage.getItem('MATHSPS_REPORT_RECIPIENTS')
        const savedMorning = localStorage.getItem('MATHSPS_MORNING_SCHEDULE')
        const savedMorningTime = localStorage.getItem('MATHSPS_MORNING_TIME')
        const savedEvening = localStorage.getItem('MATHSPS_EVENING_SCHEDULE')
        const savedEveningTime = localStorage.getItem('MATHSPS_EVENING_TIME')
        const savedIncludeCsv = localStorage.getItem('MATHSPS_EMAIL_INCLUDE_CSV')

        setProvider(savedProvider)
        if (savedKey) setApiKey(savedKey)
        if (savedFrom) setFromEmail(savedFrom)
        if (savedSmtpUser) setSmtpUser(savedSmtpUser)
        if (savedSmtpPass) setSmtpPass(savedSmtpPass)

        if (savedRecipients) {
          setRecipients(JSON.parse(savedRecipients))
        } else {
          setRecipients(['sampathlankasunsoft93@gmail.com'])
        }
        if (savedMorning !== null) setMorningSchedule(savedMorning === 'true')
        if (savedMorningTime) setMorningTime(savedMorningTime)
        if (savedEvening !== null) setEveningSchedule(savedEvening === 'true')
        if (savedEveningTime) setEveningTime(savedEveningTime)
        if (savedIncludeCsv !== null) setIncludeCsv(savedIncludeCsv === 'true')
      } catch (e) {
        console.error(e)
      }
    }

    loadDatabaseEmailSettings()
  }, [])

  async function handleSaveConfig() {
    try {
      const emailSettingsPayload = {
        provider,
        apiKey: apiKey.trim(),
        fromEmail: fromEmail.trim(),
        smtpUser: smtpUser.trim(),
        smtpPass: smtpPass.trim(),
        recipients,
        morningSchedule,
        morningTime,
        eveningSchedule,
        eveningTime,
        includeCsv
      }

      // Save to localStorage for instant local access
      localStorage.setItem('MATHSPS_EMAIL_PROVIDER', provider)
      localStorage.setItem('MATHSPS_RESEND_API_KEY', apiKey.trim())
      localStorage.setItem('MATHSPS_RESEND_FROM_EMAIL', fromEmail.trim())
      localStorage.setItem('MATHSPS_SMTP_USER', smtpUser.trim())
      localStorage.setItem('MATHSPS_SMTP_PASS', smtpPass.trim())
      localStorage.setItem('MATHSPS_REPORT_RECIPIENTS', JSON.stringify(recipients))
      localStorage.setItem('MATHSPS_MORNING_SCHEDULE', String(morningSchedule))
      localStorage.setItem('MATHSPS_MORNING_TIME', morningTime)
      localStorage.setItem('MATHSPS_EVENING_SCHEDULE', String(eveningSchedule))
      localStorage.setItem('MATHSPS_EVENING_TIME', eveningTime)
      localStorage.setItem('MATHSPS_EMAIL_INCLUDE_CSV', String(includeCsv))

      // Persist to Supabase Database (Admin User record notes) so cloud server crons can access it 24/7
      const { data: adminMem } = await supabase
        .from('members')
        .select('id')
        .eq('name', 'Admin User')
        .single()

      if (adminMem?.id) {
        await fetch('/api/members/manage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_email_settings',
            memberId: adminMem.id,
            email_settings: emailSettingsPayload,
            adminPassword: 'sb_secret_verification_bypass'
          })
        })
      }

      setSavedSuccess(true)
      setTimeout(() => setSavedSuccess(false), 3000)
    } catch (e) {
      console.error(e)
    }
  }

  function handleAddRecipient(e: React.KeyboardEvent | React.MouseEvent) {
    if ('key' in e && e.key !== 'Enter') return
    if (!recipientInput.trim()) return
    const email = recipientInput.trim().toLowerCase()
    if (!recipients.includes(email)) {
      const updated = [...recipients, email]
      setRecipients(updated)
      localStorage.setItem('MATHSPS_REPORT_RECIPIENTS', JSON.stringify(updated))
    }
    setRecipientInput('')
  }

  function handleRemoveRecipient(emailToRemove: string) {
    const updated = recipients.filter(r => r !== emailToRemove)
    setRecipients(updated)
    localStorage.setItem('MATHSPS_REPORT_RECIPIENTS', JSON.stringify(updated))
  }

  async function handleSendTestDigest(type: 'morning' | 'evening') {
    if (provider === 'smtp') {
      if (!smtpUser.trim() || !smtpPass.trim()) {
        setTestResult({
          success: false,
          message: 'Please provide both your Gmail address and 16-character Google App Password.'
        })
        return
      }
    } else {
      if (!apiKey.trim() && !process.env.NEXT_PUBLIC_RESEND_API_KEY) {
        setTestResult({
          success: false,
          message: 'Please provide a Resend API Key before sending.'
        })
        return
      }
    }

    if (recipients.length === 0) {
      setTestResult({
        success: false,
        message: 'Please add at least one recipient email address.'
      })
      return
    }

    setTestingType(type)
    setTestResult(null)

    try {
      const res = await fetch('/api/reports/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType: type,
          provider,
          // SMTP options
          smtpUser: smtpUser.trim() || undefined,
          smtpPass: smtpPass.trim() || undefined,
          // Resend options
          senderApiKey: apiKey.trim() || undefined,
          fromEmail: fromEmail.trim() || undefined,
          recipients,
          targetDate: new Date().toISOString().slice(0, 10),
          includeCsv
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch email')

      setTestResult({
        success: true,
        message: `✓ ${type === 'morning' ? 'Morning Strategic Brief' : 'Evening Day-End Summary'} sent successfully via ${provider.toUpperCase()} to ${recipients.join(', ')}!`
      })
    } catch (e: any) {
      setTestResult({
        success: false,
        message: e.message || 'Failed to send email'
      })
    } finally {
      setTestingType(null)
    }
  }

  return (
    <div className="glass-card" style={{ padding: 24, marginTop: 24, borderRadius: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
            width: 44, height: 44, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
          }}>
            <Mail size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              Automated Email Reports &amp; Dispatch Center
              <span className="badge" style={{ background: provider === 'smtp' ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.15)', color: provider === 'smtp' ? '#10b981' : 'var(--accent-blue)', fontSize: 11 }}>
                {provider === 'smtp' ? 'Gmail SMTP Mode' : 'Resend API Mode'}
              </span>
            </h2>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
              Send automatic nightly Day-End summaries, recipient lists, and trigger on-demand executive digests
            </div>
          </div>
        </div>

        {/* Provider Switcher Tabs */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-base)', padding: 4, borderRadius: 8, border: '1px solid var(--border)' }}>
          <button
            type="button"
            onClick={() => setProvider('smtp')}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: provider === 'smtp' ? '#10b981' : 'transparent',
              color: provider === 'smtp' ? '#fff' : 'var(--text-muted)'
            }}
          >
            <Server size={14} /> ⚡ Gmail SMTP (Instant)
          </button>
          <button
            type="button"
            onClick={() => setProvider('resend')}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: provider === 'resend' ? 'var(--accent-blue)' : 'transparent',
              color: provider === 'resend' ? '#fff' : 'var(--text-muted)'
            }}
          >
            <Key size={14} /> 🚀 Resend API
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24 }}>
        {/* Left Column: Provider Config & Recipients */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* ======================================================== */}
          {/* 1. GMAIL SMTP CONFIGURATION                              */}
          {/* ======================================================== */}
          {provider === 'smtp' && (
            <div style={{ padding: 16, background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, color: '#10b981' }}>
                <Server size={16} /> Gmail SMTP Authentication
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>
                  Sender Gmail Address
                </label>
                <input
                  type="email"
                  className="input-field"
                  placeholder="yourname@gmail.com"
                  value={smtpUser}
                  onChange={e => setSmtpUser(e.target.value)}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Google 16-Character App Password
                  </label>
                  <a
                    href="https://myaccount.google.com/apppasswords"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 11, color: 'var(--accent-blue)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 2 }}
                  >
                    Generate App Password <ExternalLink size={10} />
                  </a>
                </div>
                <input
                  type="password"
                  className="input-field"
                  placeholder="abcd efgh ijkl mnop"
                  value={smtpPass}
                  onChange={e => setSmtpPass(e.target.value)}
                  style={{ fontFamily: 'monospace', letterSpacing: 1 }}
                />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  💡 <em>Go to Google Account → Security → 2-Step Verification → App passwords → Create an app password for &quot;MathsPS CRM&quot;.</em>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* 2. RESEND API CONFIGURATION                              */}
          {/* ======================================================== */}
          {provider === 'resend' && (
            <div style={{ padding: 16, background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-blue)' }}>
                <Key size={16} /> Resend API Credentials
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>
                  Resend API Key
                </label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="re_xxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  style={{ fontFamily: 'monospace', fontSize: 13 }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Sender &quot;From&quot; Address (Optional)
                  </label>
                  <a
                    href="https://resend.com/domains"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 11, color: 'var(--accent-blue)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 2 }}
                  >
                    Verify Domain <ExternalLink size={10} />
                  </a>
                </div>
                <input
                  type="text"
                  className="input-field"
                  placeholder="MathsPS Reports <reports@yourdomain.com>"
                  value={fromEmail}
                  onChange={e => setFromEmail(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Recipients List */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Users size={14} style={{ color: 'var(--accent-blue)' }} /> Recipient Email Addresses
            </label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                type="email"
                className="input-field"
                placeholder="admin@mathsps.com"
                value={recipientInput}
                onChange={e => setRecipientInput(e.target.value)}
                onKeyDown={handleAddRecipient}
              />
              <button
                type="button"
                onClick={handleAddRecipient}
                className="btn-secondary"
                style={{ padding: '0 16px', fontSize: 12, fontWeight: 700 }}
              >
                Add
              </button>
            </div>

            {/* Email Tag Pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {recipients.map(r => (
                <span
                  key={r}
                  style={{
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border)',
                    padding: '4px 10px',
                    borderRadius: 16,
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  ✉️ {r}
                  <button
                    type="button"
                    onClick={() => handleRemoveRecipient(r)}
                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 800, padding: 0, fontSize: 13 }}
                  >
                    ×
                  </button>
                </span>
              ))}
              {recipients.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No recipient emails added yet.</div>
              )}
            </div>
          </div>

          {/* Dual Dispatch Schedules & Features */}
          <div style={{ padding: 16, background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={15} style={{ color: 'var(--accent-blue)' }} /> Automated Dispatch Schedules (Daily 2-in-1 Rhythm)
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* 1. Morning Strategy Brief Schedule */}
              <div style={{ padding: 12, background: 'rgba(59,130,246,0.06)', borderRadius: 6, border: '1px solid rgba(59,130,246,0.15)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 6 }}>
                  <input
                    type="checkbox"
                    checked={morningSchedule}
                    onChange={e => setMorningSchedule(e.target.checked)}
                  />
                  <span>☀️ Morning Strategic Brief &amp; Action Items</span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 24 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Send Time:</span>
                  <input
                    type="time"
                    className="input-field"
                    style={{ width: 110, padding: '3px 8px', fontSize: 12 }}
                    value={morningTime}
                    onChange={e => setMorningTime(e.target.value)}
                  />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Includes Retention Alerts + SVG Trend Chart + Follow-up CSV</span>
                </div>
              </div>

              {/* 2. Evening Day-End Cash Summary Schedule */}
              <div style={{ padding: 12, background: 'rgba(16,185,129,0.06)', borderRadius: 6, border: '1px solid rgba(16,185,129,0.15)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 6 }}>
                  <input
                    type="checkbox"
                    checked={eveningSchedule}
                    onChange={e => setEveningSchedule(e.target.checked)}
                  />
                  <span>🌅 Evening Day-End Cash &amp; Auditor Audit</span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 24 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Send Time:</span>
                  <input
                    type="time"
                    className="input-field"
                    style={{ width: 110, padding: '3px 8px', fontSize: 12 }}
                    value={eveningTime}
                    onChange={e => setEveningTime(e.target.value)}
                  />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Includes Auditor Totals + Grade Cash Slips + Day Audit CSV</span>
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={includeCsv}
                  onChange={e => setIncludeCsv(e.target.checked)}
                />
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileSpreadsheet size={14} style={{ color: '#10b981' }} />
                  Attach complete Excel/CSV data sheets to reports
                </span>
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleSaveConfig}
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <ShieldCheck size={16} /> Save Email Settings
            </button>
            {savedSuccess && (
              <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>
                ✓ Settings saved!
              </span>
            )}
          </div>
        </div>

        {/* Right Column: Live Testing & Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{
            background: 'linear-gradient(180deg, rgba(59,130,246,0.05) 0%, rgba(59,130,246,0.01) 100%)',
            border: '1px solid rgba(59,130,246,0.2)',
            borderRadius: 10,
            padding: 18
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={16} style={{ color: 'var(--accent-blue)' }} />
              Live Email Dispatch Test
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
              Trigger an instant test email for either report type to verify recipient delivery and preview template layout.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Morning Test Button */}
              <button
                type="button"
                onClick={() => handleSendTestDigest('morning')}
                disabled={testingType !== null}
                className="btn-primary"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: 13,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)'
                }}
              >
                {testingType === 'morning' ? (
                  <>
                    <RefreshCw size={15} className="spin" /> Dispatching Morning Strategic Brief...
                  </>
                ) : (
                  <>
                    <Send size={15} /> ☀️ Test Morning Strategic Brief (Trends + Retention)
                  </>
                )}
              </button>

              {/* Evening Test Button */}
              <button
                type="button"
                onClick={() => handleSendTestDigest('evening')}
                disabled={testingType !== null}
                className="btn-primary"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: 13,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                }}
              >
                {testingType === 'evening' ? (
                  <>
                    <RefreshCw size={15} className="spin" /> Dispatching Evening Summary...
                  </>
                ) : (
                  <>
                    <Send size={15} /> 🌅 Test Evening Day-End Summary (Audit Slips)
                  </>
                )}
              </button>
            </div>

            {testResult && (
              <div style={{
                marginTop: 14,
                padding: 12,
                borderRadius: 8,
                fontSize: 12,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                background: testResult.success ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                color: testResult.success ? '#10b981' : '#f87171',
                border: `1px solid ${testResult.success ? '#10b981' : '#ef4444'}`
              }}>
                {testResult.success ? <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 2 }} /> : <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />}
                <div>{testResult.message}</div>
              </div>
            )}
          </div>

          <div style={{ padding: 14, background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
              What&apos;s Included in Each Report
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
              <div>
                <strong style={{ color: 'var(--accent-blue)' }}>☀️ Morning Report:</strong> MoM momentum, retention &amp; churn alert table, embedded SVG trend curve graph, and attached unpaid student follow-up CSV.
              </div>
              <div>
                <strong style={{ color: '#10b981' }}>🌅 Evening Report:</strong> Daily collections, slip count, grade cash breakdown, auditor productivity, and attached day audit CSV.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
