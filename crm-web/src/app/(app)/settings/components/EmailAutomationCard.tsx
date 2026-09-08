'use client'

import { useState, useEffect } from 'react'
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
  ShieldCheck
} from 'lucide-react'

export default function EmailAutomationCard() {
  const [apiKey, setApiKey] = useState('')
  const [fromEmail, setFromEmail] = useState('')
  const [recipients, setRecipients] = useState<string[]>([])
  const [recipientInput, setRecipientInput] = useState('')
  const [autoSchedule, setAutoSchedule] = useState(true)
  const [scheduleTime, setScheduleTime] = useState('21:00') // 9:00 PM
  const [includeCsv, setIncludeCsv] = useState(true)
  
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [savedSuccess, setSavedSuccess] = useState(false)

  // Load saved settings from localStorage
  useEffect(() => {
    try {
      const savedKey = localStorage.getItem('MATHSPS_RESEND_API_KEY') || ''
      const savedFrom = localStorage.getItem('MATHSPS_RESEND_FROM_EMAIL') || ''
      const savedRecipients = localStorage.getItem('MATHSPS_REPORT_RECIPIENTS')
      const savedSchedule = localStorage.getItem('MATHSPS_EMAIL_SCHEDULE')
      const savedIncludeCsv = localStorage.getItem('MATHSPS_EMAIL_INCLUDE_CSV')
      const savedTime = localStorage.getItem('MATHSPS_EMAIL_TIME')

      if (savedKey) setApiKey(savedKey)
      if (savedFrom) setFromEmail(savedFrom)
      if (savedRecipients) {
        setRecipients(JSON.parse(savedRecipients))
      } else {
        setRecipients(['achibro12903@gmail.com'])
      }
      if (savedSchedule !== null) setAutoSchedule(savedSchedule === 'true')
      if (savedIncludeCsv !== null) setIncludeCsv(savedIncludeCsv === 'true')
      if (savedTime) setScheduleTime(savedTime)
    } catch (e) {
      console.error(e)
    }
  }, [])

  function handleSaveConfig() {
    try {
      localStorage.setItem('MATHSPS_RESEND_API_KEY', apiKey.trim())
      localStorage.setItem('MATHSPS_RESEND_FROM_EMAIL', fromEmail.trim())
      localStorage.setItem('MATHSPS_REPORT_RECIPIENTS', JSON.stringify(recipients))
      localStorage.setItem('MATHSPS_EMAIL_SCHEDULE', String(autoSchedule))
      localStorage.setItem('MATHSPS_EMAIL_INCLUDE_CSV', String(includeCsv))
      localStorage.setItem('MATHSPS_EMAIL_TIME', scheduleTime)

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

  async function handleSendTestDigest() {
    if (!apiKey.trim() && !process.env.NEXT_PUBLIC_RESEND_API_KEY) {
      setTestResult({
        success: false,
        message: 'Please provide a Resend API Key before sending.'
      })
      return
    }

    if (recipients.length === 0) {
      setTestResult({
        success: false,
        message: 'Please add at least one recipient email address.'
      })
      return
    }

    setTesting(true)
    setTestResult(null)

    try {
      const res = await fetch('/api/reports/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        message: `✓ Email sent successfully to ${recipients.join(', ')}! Check your inbox.`
      })
    } catch (e: any) {
      setTestResult({
        success: false,
        message: e.message || 'Failed to send email'
      })
    } finally {
      setTesting(false)
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
              <span className="badge" style={{ background: 'rgba(59,130,246,0.15)', color: 'var(--accent-blue)', fontSize: 11 }}>
                Resend Engine
              </span>
            </h2>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
              Configure automatic nightly Day-End summaries, recipient lists, and trigger on-demand executive digests
            </div>
          </div>
        </div>

        <a
          href="https://resend.com/api-keys"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 12, color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
        >
          Get Free Resend API Key <ExternalLink size={12} />
        </a>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24 }}>
        {/* Left Column: API & Schedule Settings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* API Key */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Key size={14} style={{ color: 'var(--accent-blue)' }} /> Resend API Key
            </label>
            <input
              type="password"
              className="input-field"
              placeholder="re_xxxxxxxxxxxxxxxxxxxxxxxxx"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              style={{ fontFamily: 'monospace', fontSize: 13 }}
            />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Stored securely on your device or configurable via <code>RESEND_API_KEY</code> environment variable.
            </div>
          </div>

          {/* Custom Sender / From Email */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Mail size={14} style={{ color: 'var(--accent-blue)' }} /> Sender &quot;From&quot; Email Address (Optional)
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
              style={{ fontSize: 13 }}
            />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Leave blank to use Resend Sandbox (<code>onboarding@resend.dev</code>). <em>Note: In Sandbox mode, Resend only allows sending to your registered account email (<code>achibro12903@gmail.com</code>). To send to any email, add your domain in Resend.</em>
            </div>
          </div>

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

          {/* Dispatch Schedule & Features */}
          <div style={{ padding: 14, background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={15} style={{ color: 'var(--accent-blue)' }} /> Nightly Auto-Dispatch Preferences
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={autoSchedule}
                  onChange={e => setAutoSchedule(e.target.checked)}
                />
                <span>Enable Automated Nightly Email Digest (Vercel Cron)</span>
              </label>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 24 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Dispatch Time:</span>
                <input
                  type="time"
                  className="input-field"
                  style={{ width: 120, padding: '4px 8px' }}
                  value={scheduleTime}
                  onChange={e => setScheduleTime(e.target.value)}
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Every night</span>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={includeCsv}
                  onChange={e => setIncludeCsv(e.target.checked)}
                />
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileSpreadsheet size={14} style={{ color: '#10b981' }} />
                  Attach complete Day-End CSV audit report file to email
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
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={16} style={{ color: 'var(--accent-blue)' }} />
              Live Email Dispatch Test
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              Trigger an instant Day-End executive email to test your Resend connection and verify recipient deliverability.
            </div>

            <button
              type="button"
              onClick={handleSendTestDigest}
              disabled={testing}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '10px 16px',
                fontSize: 13,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
              }}
            >
              {testing ? (
                <>
                  <RefreshCw size={16} className="spin" /> Generating &amp; Dispatching Email...
                </>
              ) : (
                <>
                  <Send size={16} /> 🚀 Send Today's Digest Now
                </>
              )}
            </button>

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
              Email Contents Summary
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <li>Executive Revenue &amp; Slips Total KPI Cards</li>
              <li>Month-to-Date total comparison</li>
              <li>Grade 6 to 11 registered vs paying breakdown</li>
              <li>Staff Auditor processing metrics</li>
              <li>Attached <code>Day_End_Audit.csv</code> data sheet</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
