'use client'

import { useState, useEffect } from 'react'
import {
  Bot,
  Sparkles,
  PhoneCall,
  MessageSquare,
  Image as ImageIcon,
  Building2,
  Save,
  CheckCircle2,
  RefreshCw,
  Send,
  Layers,
  ArrowRight,
  Shield,
  Zap,
  Clock,
  Play,
  Share2,
  Check,
  Volume2,
  VolumeX,
  UserCheck
} from 'lucide-react'

export default function AiCallCenterStudio() {
  const [config, setConfig] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Active Sub-Tab in Flow Builder
  const [activeStep, setActiveStep] = useState<'flow' | 'prompts' | 'flyers' | 'banks' | 'test' | 'ai-convo'>('ai-convo')

  // Test Console State
  const [testPhone, setTestPhone] = useState('')
  const [testGrade, setTestGrade] = useState('10')
  const [testType, setTestType] = useState<'BANK_DETAILS' | 'CLASS_FLYER'>('CLASS_FLYER')
  const [testSending, setTestSending] = useState(false)
  const [testStatus, setTestStatus] = useState('')

  // Interactive Parent AI Conversation Simulator
  const [chatMessages, setChatMessages] = useState<Array<{
    role: 'parent' | 'ai'
    text: string
    flyerUrl?: string | null
    grade?: number | null
    bank?: boolean
    lead?: any
  }>>([
    {
      role: 'ai',
      text: 'ආයුබෝවන් MathsPS වෙතින්! මම ඔබගේ පන්ති සහ ගාස්තු විස්තර පිළිබඳ සහායකයා. අද ඔබට උදව් කළ හැක්කේ කෙසේද?'
    }
  ])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null)

  useEffect(() => {
    loadConfig()
  }, [])

  async function loadConfig() {
    setLoading(true)
    try {
      const res = await fetch('/api/ai-agent/config')
      if (res.ok) {
        const data = await res.json()
        setConfig(data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveConfig() {
    if (!config) return
    setSaving(true)
    setSaveSuccess(false)
    try {
      const res = await fetch('/api/ai-agent/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })
      if (res.ok) {
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
      } else {
        alert('Failed to save AI Agent configuration.')
      }
    } catch (e: any) {
      alert('Error: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleSendTestDispatch() {
    if (!testPhone.trim()) {
      alert('Please enter a WhatsApp phone number for testing.')
      return
    }

    setTestSending(true)
    setTestStatus('Sending via Meta WhatsApp Cloud API...')

    try {
      const payload: any = {
        to: testPhone,
        type: testType,
        grade: parseInt(testGrade),
        studentCode: 'TEST001'
      }

      if (testType === 'CLASS_FLYER') {
        payload.imageUrl = config?.class_flyers?.[testGrade] || 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=800'
        payload.caption = `MathsPS Grade ${testGrade} Class Timetable & Fees: ${config?.timetables?.[testGrade] || ''}`
      }

      const res = await fetch('/api/whatsapp/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const result = await res.json()
      if (res.ok && result.success) {
        setTestStatus(`✓ Success! Message dispatched to ${testPhone} via Official WhatsApp API.`)
      } else {
        setTestStatus(`⚠️ Dispatch Failed: ${result.error || 'Check WhatsApp API credentials'}`)
      }
    } catch (e: any) {
      setTestStatus(`Error: ${e.message}`)
    } finally {
      setTestSending(false)
    }
  }

  // Handle Parent AI Real-Time Chat Simulation
  async function handleSendChatMessage(overrideText?: string) {
    const textToSend = overrideText || chatInput
    if (!textToSend.trim() || chatLoading) return

    const userMsg = { role: 'parent' as const, text: textToSend }
    setChatMessages(prev => [...prev, userMsg])
    setChatInput('')
    setChatLoading(true)

    try {
      const res = await fetch('/api/ai-agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: textToSend })
      })
      const json = await res.json()
      if (res.ok && json.success) {
        const aiMsg = {
          role: 'ai' as const,
          text: json.data.replyText,
          flyerUrl: json.data.flyerUrl,
          grade: json.data.dispatchFlyerGrade,
          bank: json.data.dispatchBank,
          lead: json.data.leadInfo
        }
        setChatMessages(prev => [...prev, aiMsg])
        speakText(json.data.replyText, chatMessages.length + 1)
      } else {
        setChatMessages(prev => [
          ...prev,
          { role: 'ai' as const, text: 'සමාවන්න, සේවාදායක දෝෂයක් හටගැණිනි. කරුණාකර නැවත උත්සාහ කරන්න.' }
        ])
      }
    } catch (err: any) {
      setChatMessages(prev => [
        ...prev,
        { role: 'ai' as const, text: 'Error: ' + err.message }
      ])
    } finally {
      setChatLoading(false)
    }
  }

  function speakText(text: string, idx: number) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    if (speakingIdx === idx) {
      setSpeakingIdx(null)
      return
    }

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'si-LK'
    utterance.rate = 1.0
    utterance.pitch = 1.0

    utterance.onend = () => setSpeakingIdx(null)
    utterance.onerror = () => setSpeakingIdx(null)

    setSpeakingIdx(idx)
    window.speechSynthesis.speak(utterance)
  }

  if (loading || !config) {
    return (
      <div className="glass-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px' }} />
        <div>Loading 24/7 AI Call Center Studio...</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 1. Header Banner */}
      <div
        className="glass-card"
        style={{
          padding: '24px 28px',
          borderLeft: '4px solid var(--accent-blue)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          boxShadow: '0 4px 20px -4px rgba(56, 189, 248, 0.25)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)',
            }}
          >
            <Bot size={26} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: '-0.3px' }}>
                24/7 Autonomous AI Call Center &amp; WhatsApp Agent
              </h2>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                  border: '1px solid rgba(16, 185, 129, 0.3)'
                }}
              >
                LIVE CLOUD API CONNECTED
              </span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Real-time conversational agent that answers student &amp; parent inquiries, sends class flyers and bank slips automatically via WhatsApp.
            </p>
          </div>
        </div>

        <button
          onClick={handleSaveConfig}
          disabled={saving}
          className="btn-primary"
          style={{
            padding: '10px 20px',
            fontSize: 13,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 2px 8px rgba(2, 132, 199, 0.35)'
          }}
        >
          {saving ? <RefreshCw size={15} className="animate-spin" /> : saveSuccess ? <Check size={15} /> : <Save size={15} />}
          {saveSuccess ? 'Changes Saved!' : 'Save Configuration'}
        </button>
      </div>

      {/* 2. Visual Wireframe Flow Ribbon */}
      <div
        className="glass-card"
        style={{
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          overflowX: 'auto',
          background: 'rgba(18, 24, 38, 0.7)'
        }}
      >
        {[
          { id: 'ai-convo', label: '1. Parent AI Voice Chat', icon: Sparkles, desc: 'Realtime Voice & Chat' },
          { id: 'flow', label: '2. Architecture & Flow', icon: Layers, desc: 'Visual Wireframe' },
          { id: 'prompts', label: '3. Voice & Greeting', icon: MessageSquare, desc: 'Personality & Rules' },
          { id: 'flyers', label: '4. Class Timetables & Flyers', icon: ImageIcon, desc: 'Posters (Gr 6-11)' },
          { id: 'banks', label: '5. Bank Accounts', icon: Building2, desc: 'Payment Slips' },
          { id: 'test', label: '6. Live Simulator', icon: Zap, desc: 'Test Dispatch' },
        ].map(tab => {
          const Icon = tab.icon
          const isActive = activeStep === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveStep(tab.id as any)}
              style={{
                flex: 1,
                minWidth: 160,
                padding: '10px 14px',
                borderRadius: 10,
                border: isActive ? '1px solid var(--accent-blue)' : '1px solid transparent',
                background: isActive ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                color: isActive ? 'var(--accent-blue)' : 'var(--text-secondary)',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                transition: 'all 0.15s ease'
              }}
              className="hover-card"
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: isActive ? 'var(--accent-blue)' : 'var(--bg-base)',
                  color: isActive ? '#ffffff' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <Icon size={15} />
              </div>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700 }}>{tab.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tab.desc}</div>
              </div>
            </button>
          )
        })}
      </div>

      {/* 3. Tab Contents */}
      {/* ── 0. Parent AI Voice & Chat Interactive Console ── */}
      {activeStep === 'ai-convo' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 20 }}>
          {/* Left: Chat & Voice Interactive Stream */}
          <div className="glass-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', height: 640 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Parent AI Voice &amp; Chat Live Console
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Test how the AI talks with parents, resolves schedules, and triggers WhatsApp packets in real-time.
                </div>
              </div>
              <button
                onClick={() => setChatMessages([
                  { role: 'ai', text: config?.greeting_text || 'ආයුබෝවන් MathsPS වෙතින්! මම ඔබගේ පන්ති සහ ගාස්තු විස්තර පිළිබඳ සහායකයා. අද ඔබට උදව් කළ හැක්කේ කෙසේද?' }
                ])}
                className="btn-ghost"
                style={{ fontSize: 11, padding: '4px 10px', height: 'auto' }}
              >
                Clear Chat
              </button>
            </div>

            {/* Quick Test Chips */}
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10, marginBottom: 10 }}>
              {[
                '10 වසර පන්ති තියෙන්නේ කවද්ද?',
                'Bank details සහ ගාස්තු විස්තර එවන්න',
                'මගේ දුව කාවින්දි, කොළඹ, 11 වසර',
                'Online Zoom classes තියෙනවද?',
                'Grade 8 class timetable please'
              ].map((chip, i) => (
                <button
                  key={i}
                  onClick={() => handleSendChatMessage(chip)}
                  disabled={chatLoading}
                  style={{
                    fontSize: 11.5,
                    padding: '5px 12px',
                    borderRadius: 20,
                    background: 'rgba(56, 189, 248, 0.08)',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    color: 'var(--accent-blue)',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  className="hover-card"
                >
                  ⚡ {chip}
                </button>
              ))}
            </div>

            {/* Messages Body */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                paddingRight: 6
              }}
            >
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: msg.role === 'parent' ? 'flex-end' : 'flex-start'
                  }}
                >
                  <div
                    style={{
                      maxWidth: '82%',
                      padding: '12px 16px',
                      borderRadius: 14,
                      background: msg.role === 'parent'
                        ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'
                        : 'rgba(30, 41, 59, 0.85)',
                      border: msg.role === 'parent'
                        ? '1px solid rgba(56, 189, 248, 0.3)'
                        : '1px solid rgba(255, 255, 255, 0.08)',
                      color: '#ffffff',
                      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.25)',
                      fontSize: 13,
                      lineHeight: 1.5
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', opacity: 0.8 }}>
                        {msg.role === 'parent' ? '👤 Parent / Caller' : '🤖 MathsPS AI Agent'}
                      </span>
                      {msg.role === 'ai' && (
                        <button
                          onClick={() => speakText(msg.text, idx)}
                          title="Listen to Sinhala Speech"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: speakingIdx === idx ? '#38bdf8' : 'rgba(255, 255, 255, 0.6)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            padding: 2
                          }}
                        >
                          {speakingIdx === idx ? <VolumeX size={15} /> : <Volume2 size={15} />}
                        </button>
                      )}
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>

                    {/* Triggered Actions Preview */}
                    {msg.grade && msg.flyerUrl && (
                      <div
                        style={{
                          marginTop: 10,
                          padding: 10,
                          borderRadius: 8,
                          background: 'rgba(16, 185, 129, 0.1)',
                          border: '1px solid rgba(16, 185, 129, 0.3)'
                        }}
                      >
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                          <CheckCircle2 size={13} />
                          Auto Dispatched Grade {msg.grade} Flyer to WhatsApp
                        </div>
                        <img
                          src={msg.flyerUrl}
                          alt={`Grade ${msg.grade} Flyer`}
                          style={{ width: '100%', maxHeight: 140, objectFit: 'cover', borderRadius: 6 }}
                        />
                      </div>
                    )}

                    {msg.bank && (
                      <div
                        style={{
                          marginTop: 10,
                          padding: 10,
                          borderRadius: 8,
                          background: 'rgba(245, 158, 11, 0.1)',
                          border: '1px solid rgba(245, 158, 11, 0.3)'
                        }}
                      >
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Building2 size={13} />
                          Auto Dispatched Bank Accounts Packet to WhatsApp
                        </div>
                      </div>
                    )}

                    {msg.lead && (
                      <div
                        style={{
                          marginTop: 10,
                          padding: 10,
                          borderRadius: 8,
                          background: 'rgba(56, 189, 248, 0.1)',
                          border: '1px solid rgba(56, 189, 248, 0.3)'
                        }}
                      >
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <UserCheck size={13} />
                          Captured Lead: {msg.lead.studentName || 'Student'} (Grade {msg.lead.grade || 'N/A'})
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {chatLoading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 12 }}>
                  <RefreshCw size={14} className="animate-spin" />
                  MathsPS AI is thinking &amp; resolving...
                </div>
              )}
            </div>

            {/* Input Bar */}
            <div style={{ display: 'flex', gap: 10, marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
              <input
                className="input-field"
                placeholder="Type question in Sinhala, Singlish, or English (e.g. 10 වසර පන්ති තියෙන්නේ කවද්ද?)..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSendChatMessage()
                }}
              />
              <button
                onClick={() => handleSendChatMessage()}
                disabled={chatLoading || !chatInput.trim()}
                className="btn-primary"
                style={{
                  padding: '10px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontWeight: 700,
                  fontSize: 13
                }}
              >
                {chatLoading ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />}
                Send
              </button>
            </div>
          </div>

          {/* Right: AI Intelligence Status Card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="glass-card" style={{ padding: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 12 }}>
                Model &amp; Engine Status
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Engine</span>
                  <span style={{ fontWeight: 700, color: '#38bdf8' }}>Gemini 3.8 Flash</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Languages</span>
                  <span style={{ fontWeight: 600 }}>Sinhala, Singlish, English</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>WhatsApp Voice Notes</span>
                  <span style={{ fontWeight: 600, color: '#10b981' }}>Supported (.ogg/opus)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Auto Lead Sync</span>
                  <span style={{ fontWeight: 600, color: '#10b981' }}>Active (Supabase)</span>
                </div>
              </div>
            </div>

            <div className="glass-card" style={{ padding: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 12 }}>
                Autonomous Dispatches
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Whenever a parent asks about a specific grade, the AI automatically dispatches the corresponding flyer with schedule times.
                When payment, slip, or fees are inquired, the bank packet is automatically delivered.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── A. Visual Flow Wireframe ── */}
      {activeStep === 'flow' && (
        <div className="glass-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Interactive AI Call Center Lifecycle (Wireframe)
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            {/* Step 1 */}
            <div className="stat-card" style={{ borderLeft: '4px solid #38bdf8' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: '#38bdf8', fontWeight: 700, fontSize: 13 }}>
                <PhoneCall size={16} /> 1. Inbound Voice/WhatsApp
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                Parent or student calls the MathsPS hotline (+94 71 063 1093) or sends a WhatsApp inquiry.
              </p>
            </div>

            {/* Step 2 */}
            <div className="stat-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: '#8b5cf6', fontWeight: 700, fontSize: 13 }}>
                <Bot size={16} /> 2. Real-time Sinhala AI
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                AI Voice Agent greets warmly in natural Sinhala/English and detects caller intent (e.g., Grade 10 time &amp; fees).
              </p>
            </div>

            {/* Step 3 */}
            <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: '#10b981', fontWeight: 700, fontSize: 13 }}>
                <Send size={16} /> 3. WhatsApp Auto-Dispatch
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                While speaking, the AI executes background tools to send the exact class timetable flyer &amp; bank accounts to the caller&apos;s WhatsApp.
              </p>
            </div>

            {/* Step 4 */}
            <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: '#f59e0b', fontWeight: 700, fontSize: 13 }}>
                <Shield size={16} /> 4. Human Escalation (Fail-safe)
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                If caller asks for an urgent matter or complex payment issue, call routes to staff mobile ({config.human_escalation_number}).
              </p>
            </div>
          </div>

          {/* Connected Telephony Details */}
          <div style={{ padding: '16px 20px', borderRadius: 12, background: 'var(--bg-base)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Official Meta WhatsApp Channel</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Prabuddha Sampath · +94 71 063 1093 · ID: 1045258928679015</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setActiveStep('test')} className="btn-secondary" style={{ fontSize: 12 }}>
                <Zap size={14} style={{ color: 'var(--accent-orange)' }} /> Open Test Console
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── B. Voice & Personality Prompts ── */}
      {activeStep === 'prompts' && (
        <div className="glass-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>
              AI Agent Greeting (When Caller Connects)
            </label>
            <input
              className="input-field"
              value={config.greeting_text || ''}
              onChange={e => setConfig({ ...config, greeting_text: e.target.value })}
              placeholder="e.g. ආයුබෝවන් MathsPS වෙතින්!..."
            />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>
              System Prompt &amp; Conversational Knowledge Rules
            </label>
            <textarea
              className="input-field"
              style={{ minHeight: 180, lineHeight: 1.6, fontFamily: 'inherit' }}
              value={config.system_prompt || ''}
              onChange={e => setConfig({ ...config, system_prompt: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>
                Voice Profile
              </label>
              <select
                className="input-field"
                value={config.voice_name || ''}
                onChange={e => setConfig({ ...config, voice_name: e.target.value })}
              >
                <option value="Sinhala Professional (Female)">Sinhala Professional (Female - Cartesia/ElevenLabs)</option>
                <option value="Sinhala Friendly (Male)">Sinhala Friendly (Male)</option>
                <option value="English/Sinhala Bilingual">English / Sinhala Bilingual</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>
                Human Escalation Hotline (Transfer Number)
              </label>
              <input
                className="input-field"
                value={config.human_escalation_number || ''}
                onChange={e => setConfig({ ...config, human_escalation_number: e.target.value })}
                placeholder="e.g. 0710631093"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── C. Class Flyers & Timetable Knowledge ── */}
      {activeStep === 'flyers' && (
        <div className="glass-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Grade 6 to 11 Class Timetables &amp; WhatsApp Flyer Links
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0 }}>
            When a parent asks for a specific grade, the AI reads the timetable text verbally and dispatches the corresponding image URL directly to their WhatsApp.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[6, 7, 8, 9, 10, 11].map(grade => (
              <div
                key={grade}
                style={{
                  padding: 14,
                  borderRadius: 12,
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border)',
                  display: 'grid',
                  gridTemplateColumns: '90px 1fr 1fr',
                  gap: 12,
                  alignItems: 'center'
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--accent-blue)' }}>
                  Grade {grade}
                </div>

                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                    Timetable &amp; Schedule
                  </label>
                  <input
                    className="input-field"
                    value={config.timetables?.[grade] || ''}
                    onChange={e => {
                      const updated = { ...config.timetables, [grade]: e.target.value }
                      setConfig({ ...config, timetables: updated })
                    }}
                    placeholder={`e.g. සෑම සෙනසුරාදා දිනකම...`}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                    Flyer Image / Cloud URL (WhatsApp Attachment)
                  </label>
                  <input
                    className="input-field"
                    value={config.class_flyers?.[grade] || ''}
                    onChange={e => {
                      const updated = { ...config.class_flyers, [grade]: e.target.value }
                      setConfig({ ...config, class_flyers: updated })
                    }}
                    placeholder="https://..."
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── D. Bank Details Knowledge ── */}
      {activeStep === 'banks' && (
        <div className="glass-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-green)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Bank Accounts &amp; Payment Slip Dispatch
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0 }}>
            These accounts are formatted and sent automatically when a caller asks for class fee payment methods.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(config.bank_accounts || []).map((acc: any, idx: number) => (
              <div
                key={idx}
                style={{
                  padding: 14,
                  borderRadius: 12,
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border)',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr 1fr',
                  gap: 12,
                  alignItems: 'center'
                }}
              >
                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Bank Name</label>
                  <input
                    className="input-field"
                    value={acc.bank}
                    onChange={e => {
                      const copy = [...config.bank_accounts]
                      copy[idx].bank = e.target.value
                      setConfig({ ...config, bank_accounts: copy })
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Account Number</label>
                  <input
                    className="input-field"
                    value={acc.account_no}
                    onChange={e => {
                      const copy = [...config.bank_accounts]
                      copy[idx].account_no = e.target.value
                      setConfig({ ...config, bank_accounts: copy })
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Branch</label>
                  <input
                    className="input-field"
                    value={acc.branch}
                    onChange={e => {
                      const copy = [...config.bank_accounts]
                      copy[idx].branch = e.target.value
                      setConfig({ ...config, bank_accounts: copy })
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Account Holder</label>
                  <input
                    className="input-field"
                    value={acc.name}
                    onChange={e => {
                      const copy = [...config.bank_accounts]
                      copy[idx].name = e.target.value
                      setConfig({ ...config, bank_accounts: copy })
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── E. Live Dispatch Simulator ── */}
      {activeStep === 'test' && (
        <div className="glass-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-orange)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            ⚡ Live WhatsApp Dispatch Simulator (Test Real Numbers)
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0 }}>
            Test sending flyers and bank details to your own phone number directly from your official Meta WhatsApp Cloud API (+94 71 063 1093).
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                Recipient WhatsApp Number
              </label>
              <input
                className="input-field"
                placeholder="07XXXXXXXX or 947XXXXXXXX"
                value={testPhone}
                onChange={e => setTestPhone(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                Select Packet Type
              </label>
              <select
                className="input-field"
                value={testType}
                onChange={e => setTestType(e.target.value as any)}
              >
                <option value="CLASS_FLYER">Class Flyer Poster + Timetable</option>
                <option value="BANK_DETAILS">Bank Account Details (BOC, Commercial)</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                Target Grade
              </label>
              <select
                className="input-field"
                value={testGrade}
                onChange={e => setTestGrade(e.target.value)}
              >
                {[6, 7, 8, 9, 10, 11].map(g => (
                  <option key={g} value={g}>Grade {g}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              onClick={handleSendTestDispatch}
              disabled={testSending}
              className="btn-primary"
              style={{
                padding: '10px 20px',
                fontWeight: 700,
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                boxShadow: '0 2px 10px rgba(16, 185, 129, 0.3)'
              }}
            >
              {testSending ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />}
              {testSending ? 'Sending via WhatsApp...' : 'Dispatch Live Message'}
            </button>
            {testStatus && (
              <span style={{ fontSize: 12.5, fontWeight: 600, color: testStatus.startsWith('✓') ? '#10b981' : '#f59e0b' }}>
                {testStatus}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
