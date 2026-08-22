'use client'

import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'

export interface TutorProfile {
  id: 'prabuddha' | 'sanduni'
  name: string
  title: string
  codePrefix: 'PS' | 'SM'
  subject: string
  image: string
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
    image: '/prabuddha-profile.jpg',
    themeColor: '#3b82f6',
    bgGradient: 'linear-gradient(135deg, rgba(59, 130, 246, 0.22), rgba(139, 92, 246, 0.22))',
  },
  {
    id: 'sanduni',
    name: 'Sanduni Malshika',
    title: 'Mathematics Tutor',
    codePrefix: 'SM',
    subject: 'Mathematics (Theory & Paper Class)',
    image: '/sanduni-profile.jpg',
    themeColor: '#ec4899',
    bgGradient: 'linear-gradient(135deg, rgba(236, 72, 153, 0.22), rgba(168, 85, 247, 0.22))',
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
    }, 350)
  }

  if (!showModal) return null

  return (
    <>
      <style>{`
        .tutor-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 999999;
          background: rgba(5, 8, 18, 0.92);
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
          border-radius: 24px;
          padding: 32px 24px;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }
        .tutor-card-option:hover {
          transform: translateY(-6px) scale(1.03);
          border-color: rgba(255, 255, 255, 0.3);
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
        }
        .tutor-avatar-img {
          width: 100px;
          height: 100px;
          border-radius: 50%;
          object-fit: cover;
          object-position: center top;
          margin-bottom: 16px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.4);
          transition: transform 0.25s ease;
        }
        .tutor-card-option:hover .tutor-avatar-img {
          transform: scale(1.08);
        }
      `}</style>

      <div className={`tutor-modal-overlay ${animatingOut ? 'out' : ''}`}>
        <div style={{ maxWidth: 580, width: '100%', textAlign: 'center' }}>
          {/* Header */}
          <div style={{ marginBottom: 36 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)',
              color: '#60a5fa', padding: '8px 20px', borderRadius: 30, fontSize: 13, fontWeight: 800,
              textTransform: 'uppercase', letterSpacing: '0.1em'
            }}>
              <Sparkles size={15} /> Select Tutor Account
            </div>
          </div>

          {/* Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {TUTOR_PROFILES.map((p) => {
              const isSelected = selectedTutor === p.id
              return (
                <div
                  key={p.id}
                  className="tutor-card-option"
                  onClick={() => selectProfile(p.id)}
                  style={{
                    background: p.bgGradient,
                    borderColor: isSelected ? p.themeColor : 'rgba(255,255,255,0.12)',
                    boxShadow: isSelected ? `0 0 35px ${p.themeColor}50` : undefined,
                  }}
                >
                  {/* Photo Ring */}
                  <div style={{ position: 'relative', width: 104, height: 104, marginBottom: 16 }}>
                    <div style={{
                      position: 'absolute', inset: -3,
                      borderRadius: '50%',
                      background: `linear-gradient(135deg, ${p.themeColor}, #ffffff80)`,
                      opacity: isSelected ? 1 : 0.6,
                    }} />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.image}
                      alt={p.name}
                      className="tutor-avatar-img"
                      style={{ position: 'relative', zIndex: 1, margin: 0 }}
                    />
                  </div>

                  {/* Code System Pill */}
                  <div style={{
                    display: 'inline-block', padding: '4px 12px', borderRadius: 20,
                    background: 'rgba(0,0,0,0.5)', color: p.themeColor, fontSize: 11,
                    fontWeight: 800, letterSpacing: '0.06em', marginBottom: 10,
                    border: `1px solid ${p.themeColor}40`
                  }}>
                    {p.codePrefix} CODE SYSTEM
                  </div>

                  {/* Name */}
                  <h3 style={{ fontSize: 20, fontWeight: 800, color: '#fff', margin: '0 0 4px', letterSpacing: '-0.3px' }}>
                    {p.name}
                  </h3>

                  {/* Title */}
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                    {p.title}
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
