'use client'

import { useState, useEffect } from 'react'
import {
  Sparkles,
  X,
  ChevronRight,
  ChevronLeft,
  SunMoon,
  Zap,
  Users,
  Layers,
  CheckCircle2,
  GraduationCap
} from 'lucide-react'

interface FeatureStep {
  badge: string
  title: string
  subtitle: string
  description: string
  icon: any
  color: string
  previewType: 'darkmode' | 'dock' | 'forms' | 'performance'
  highlights: string[]
}

const V2_STEPS: FeatureStep[] = [
  {
    badge: 'MAJOR UPGRADE',
    title: 'Welcome to MathsPS Virtual HQ 2.0',
    subtitle: 'High Performance, Modernized Dark Mode & Real-Time Sync',
    description: 'Version 2.0 is a complete ground-up upgrade designed for high productivity, instant page speeds, and a sleek modern aesthetic.',
    icon: Sparkles,
    color: '#38bdf8',
    previewType: 'performance',
    highlights: [
      '⚡ Zero-lag route transitions & instant tab switching',
      '🌙 Full high-contrast Dark & Light mode support across all screens',
      '🔄 1-click Profile & Tutor Switcher between Prabuddha (PS) & Sanduni (SM)',
      '📊 Optimized large-scale student reports with 50-row pagination'
    ]
  },
  {
    badge: 'NEW THEME ENGINE',
    title: 'High-Contrast Pro Dark Mode',
    subtitle: 'Vibrant, crystal-clear typography on all devices',
    description: 'Every screen — Courses, Delivery, Payments, Leads, Students, and Reports — now features refined dark backgrounds, luminous indicators, and zero unreadable text.',
    icon: SunMoon,
    color: '#8b5cf6',
    previewType: 'darkmode',
    highlights: [
      '✨ Glowing status pills for Theory, Paper, Revision, and Combo bundles',
      '🎨 Tailored color-coded KPIs with glowing cyan, emerald, and amber metrics',
      '👁️ 100% eye-comfort design for day and night call center shifts',
      '☀️ Quick toggle between Dark and Light mode right in the bottom dock'
    ]
  },
  {
    badge: 'NAVIGATION UPGRADE',
    title: 'Intelligent Bottom Dock & Tutor Switcher',
    subtitle: 'Auto-hiding navigation bar with instant tutor switching',
    description: 'The bottom navigation bar floats gracefully, auto-hides when you scroll or move away, and instantly reveals when you hover near the bottom.',
    icon: Users,
    color: '#f59e0b',
    previewType: 'dock',
    highlights: [
      '👤 Circular avatar switcher: Click avatar to toggle between PS & SM instantly',
      '📌 Pin/Unpin option to keep navigation fixed or floating',
      '🚀 One-click access to Register, Payments, Delivery, and Settings',
      '📱 Clean workspace layout with maximum screen real-estate'
    ]
  },
  {
    badge: 'WORKFLOW BOOST',
    title: 'Centered Forms & High-Speed Tables',
    subtitle: 'Balanced data entry layouts and instant processing',
    description: 'Student registration and fee recording forms now use centered, distraction-free cards with responsive payment matrices.',
    icon: Layers,
    color: '#10b981',
    previewType: 'forms',
    highlights: [
      '📝 Centered forms with balanced margins for fast student entry',
      '💳 Real-time student fee matrices with auto-populating tuition rates',
      '📦 Delivery tab with parcel dispatch tracking & barcode export filters',
      '📈 Retention & Churn Analyzer with direct WhatsApp parent follow-up'
    ]
  }
]

export default function ReleaseGuideModal2() {
  const [isOpen, setIsOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasSeenV2 = localStorage.getItem('mathsps_seen_v2_guide')
      if (!hasSeenV2) {
        // Show after a gentle 1.2s delay upon login
        const timer = setTimeout(() => {
          setIsOpen(true)
        }, 1200)
        return () => clearTimeout(timer)
      }
    }
  }, [])

  function handleClose() {
    setIsOpen(false)
    if (typeof window !== 'undefined') {
      localStorage.setItem('mathsps_seen_v2_guide', 'true')
    }
  }

  function handleNext() {
    if (currentStep < V2_STEPS.length - 1) {
      setCurrentStep(s => s + 1)
    } else {
      handleClose()
    }
  }

  function handlePrev() {
    if (currentStep > 0) {
      setCurrentStep(s => s - 1)
    }
  }

  if (!isOpen) return null

  const step = V2_STEPS[currentStep]
  const IconComponent = step.icon

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(5, 10, 24, 0.85)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 999999,
      padding: 16
    }}>
      <div style={{
        maxWidth: 680,
        width: '100%',
        background: 'var(--bg-card)',
        borderRadius: 20,
        border: '1px solid rgba(56, 189, 248, 0.3)',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 35px rgba(56, 189, 248, 0.15)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        animation: 'fadeInScale 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards'
      }}>
        <style>{`
          @keyframes fadeInScale {
            from { opacity: 0; transform: scale(0.96) translateY(8px); }
            to   { opacity: 1; transform: scale(1) translateY(0); }
          }
          .v2-bullet-item {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            padding: 9px 12px;
            background: var(--bg-base);
            border: 1px solid var(--border);
            border-radius: 10px;
            font-size: 13px;
            color: var(--text-primary);
            line-height: 1.4;
          }
        `}</style>

        {/* Top Header Banner */}
        <div style={{
          padding: '20px 24px 16px',
          background: 'linear-gradient(135deg, rgba(37,99,235,0.12) 0%, rgba(139,92,246,0.12) 100%)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: `linear-gradient(135deg, ${step.color} 0%, #2563eb 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: `0 4px 16px ${step.color}40`
            }}>
              <IconComponent size={22} />
            </div>
            <div>
              <div style={{
                fontSize: 10,
                fontWeight: 800,
                color: step.color,
                letterSpacing: '0.08em',
                textTransform: 'uppercase'
              }}>
                {step.badge}
              </div>
              <h2 style={{ fontSize: 19, fontWeight: 800, margin: '2px 0 0', color: 'var(--text-primary)' }}>
                {step.title}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Close Guide"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px 24px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
            {step.subtitle}
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 18px', lineHeight: 1.5 }}>
            {step.description}
          </p>

          {/* Interactive Feature Visual Mock / Bullets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {step.highlights.map((item, idx) => (
              <div key={idx} className="v2-bullet-item">
                <CheckCircle2 size={16} style={{ color: step.color, marginTop: 1, flexShrink: 0 }} />
                <span>{item}</span>
              </div>
            ))}
          </div>

          {/* Step Progress Dots */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, margin: '14px 0 4px' }}>
            {V2_STEPS.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentStep(idx)}
                style={{
                  width: currentStep === idx ? 24 : 8,
                  height: 8,
                  borderRadius: 4,
                  background: currentStep === idx ? step.color : 'var(--border)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.25s ease'
                }}
              />
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{
          padding: '14px 24px',
          background: 'var(--bg-base)',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
            Feature {currentStep + 1} of {V2_STEPS.length}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            {currentStep > 0 && (
              <button
                type="button"
                onClick={handlePrev}
                className="btn-secondary"
                style={{ padding: '7px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <ChevronLeft size={15} /> Back
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="btn-primary"
              style={{
                padding: '7px 18px',
                fontSize: 12,
                fontWeight: 700,
                background: `linear-gradient(135deg, ${step.color} 0%, #2563eb 100%)`,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              {currentStep === V2_STEPS.length - 1 ? (
                <>Get Started with 2.0 <Sparkles size={14} /></>
              ) : (
                <>Next Feature <ChevronRight size={15} /></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
