'use client'

import { useEffect, useState } from 'react'
import { Sparkles, Check, ChevronRight } from 'lucide-react'

export interface TutorProfile {
  id: 'prabuddha' | 'sanduni'
  name: string
  title: string
  codePrefix: 'PS' | 'SM'
  subject: string
  avatar: string
  themeColor: string
  bgGradient: string
}

export const TUTOR_PROFILES: TutorProfile[] = [
  {
    id: 'prabuddha',
    name: 'Prabuddha Sampath',
    title: 'Lead Mathematics Tutor',
    codePrefix: 'PS',
    subject: 'Mathematics (Theory & Revision)',
    avatar: '👨‍🏫',
    themeColor: '#3b82f6',
    bgGradient: 'linear-gradient(135deg, rgba(59, 130, 246, 0.25), rgba(139, 92, 246, 0.25))',
  },
  {
    id: 'sanduni',
    name: 'Sanduni Malshika',
    title: 'Mathematics Tutor',
    codePrefix: 'SM',
    subject: 'Mathematics (Theory & Paper Class)',
    avatar: '👩‍🏫',
    themeColor: '#ec4899',
    bgGradient: 'linear-gradient(135deg, rgba(236, 72, 153, 0.25), rgba(168, 85, 247, 0.25))',
  },
]

export default function TutorProfileModal() {
  const [showModal, setShowModal] = useState(false)
  const [selectedTutor, setSelectedTutor] = useState<'prabuddha' | 'sanduni'>('prabuddha')
  const [animatingOut, setAnimatingOut] = useState(false)

  useEffect(() => {
    // Check if user already picked a tutor profile in this session or localStorage
    const saved = localStorage.getItem('mathsps_active_tutor') as 'prabuddha' | 'sanduni'
    if (saved) {
      setSelectedTutor(saved)
    }

    // Check if modal was already shown during this browser session
    const sessionSeen = sessionStorage.getItem('mathsps_tutor_selected_session')
    if (!sessionSeen) {
      setShowModal(true)
    }
  }, [])

  function selectProfile(profileId: 'prabuddha' | 'sanduni') {
    setSelectedTutor(profileId)
    localStorage.setItem('mathsps_active_tutor', profileId)
    sessionStorage.setItem('mathsps_tutor_selected_session', 'true')

    setAnimatingOut(true)
    setTimeout(() => {
      setShowModal(false)
      setAnimatingOut(false)
      window.location.reload() // Refresh page to re-initialize active tutor views
    }, 400)
  }

  if (!showModal) return null

  return (
    <>
      <style>{`
        .tutor-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 999999;
          background: rgba(5, 8, 18, 0.88);
          backdrop-filter: blur(28px);
          -webkit-backdrop-filter: blur(28px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: tutorFadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .tutor-modal-overlay.out {
          animation: tutorFadeOut 0.35s ease forwards;
        }
        @keyframes tutorFadeIn {
          from { opacity: 0; transform: scale(1.03); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes tutorFadeOut {
          from { opacity: 1; transform: scale(1); }
          to { opacity: 0; transform: scale(0.96); }
        }
        .tutor-card-option {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          padding: 28px 24px;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
          overflow: hidden;
        }
        .tutor-card-option:hover {
          transform: translateY(-4px) scale(1.02);
          border-color: rgba(255, 255, 255, 0.25);
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
        }
      `}</style>

      <div className={`tutor-modal-overlay ${animatingOut ? 'out' : ''}`}>
        <div style={{ maxWidth: 640, width: '100%', textAlign: 'center' }}>
          {/* Header */}
          <div style={{ marginBottom: 32 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)',
              color: '#60a5fa', padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16
            }}>
              <Sparkles size={14} /> Select Tutor Account
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', margin: '0 0 8px', letterSpacing: '-0.5px' }}>
              Who is handling today&apos;s workspace?
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>
              Choose tutor profile to switch between <b>PS Code System</b> (Prabuddha) and <b>SM Code System</b> (Sanduni).
            </p>
          </div>

          {/* Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {TUTOR_PROFILES.map((p) => {
              const isSelected = selectedTutor === p.id
              return (
                <div
                  key={p.id}
                  className="tutor-card-option"
                  onClick={() => selectProfile(p.id)}
                  style={{
                    background: p.bgGradient,
                    borderColor: isSelected ? p.themeColor : 'rgba(255,255,255,0.1)',
                    boxShadow: isSelected ? `0 0 30px ${p.themeColor}40` : undefined,
                  }}
                >
                  <div style={{ fontSize: 52, marginBottom: 14, lineHeight: 1 }}>{p.avatar}</div>

                  <div style={{
                    display: 'inline-block', padding: '3px 10px', borderRadius: 12,
                    background: 'rgba(0,0,0,0.4)', color: p.themeColor, fontSize: 11,
                    fontWeight: 800, letterSpacing: '0.06em', marginBottom: 10
                  }}>
                    {p.codePrefix} CODE SYSTEM ({p.codePrefix}1 - {p.codePrefix}10000+)
                  </div>

                  <h3 style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: '0 0 4px' }}>
                    {p.name}
                  </h3>

                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 16 }}>
                    {p.title}
                  </div>

                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 16px', borderRadius: 10,
                    background: p.themeColor, color: '#fff',
                    fontSize: 13, fontWeight: 700
                  }}>
                    <span>Select Profile</span>
                    <ChevronRight size={14} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
