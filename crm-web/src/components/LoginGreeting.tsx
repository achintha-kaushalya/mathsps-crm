'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// ────────────────────────────────────────────────────────────────
// 100+ time-matched greetings pool
// ────────────────────────────────────────────────────────────────
const GREETINGS = {
  // 05:00 – 11:59  Early / Morning
  morning: [
    { text: 'Rise and shine!', sub: 'Let\'s make today count 🚀', emoji: '🌅' },
    { text: 'Good Morning!', sub: 'Coffee up, leads are waiting ☕', emoji: '☕' },
    { text: 'Early bird wins!', sub: 'You\'re ahead of the game already', emoji: '🐦' },
    { text: 'Morning hustle!', sub: 'Let\'s crush those targets today', emoji: '💪' },
    { text: 'Good Morning!', sub: 'Fresh day, fresh opportunities', emoji: '🌤️' },
    { text: 'Hello, champion!', sub: 'Another day to be amazing', emoji: '🏆' },
    { text: 'Rise & grind!', sub: 'Your leads won\'t call themselves', emoji: '📞' },
    { text: 'Morning star!', sub: 'Bright and early — love it!', emoji: '⭐' },
    { text: 'Good Morning!', sub: 'Let\'s build something great today', emoji: '🌟' },
    { text: 'Wake & win!', sub: 'Today\'s goals are waiting for you', emoji: '🎯' },
    { text: 'Morning mode ON', sub: 'Focused, sharp, unstoppable!', emoji: '🔥' },
    { text: 'Hello, sunrise!', sub: 'Great day to close some leads', emoji: '🌄' },
    { text: 'Morning energy!', sub: 'You\'ve got this — let\'s go!', emoji: '⚡' },
    { text: 'Good Morning!', sub: 'Team MathsPS is counting on you', emoji: '💼' },
    { text: 'Dawn patrol!', sub: 'First in wins — let\'s do this', emoji: '🌞' },
    { text: 'Morning, legend!', sub: 'Today\'s dashboard is yours to own', emoji: '👑' },
    { text: 'Up and at \'em!', sub: 'The best leads are added early', emoji: '📋' },
    { text: 'Wakey wakey!', sub: 'Systems are ready, are you?', emoji: '🔔' },
    { text: 'Good Morning!', sub: 'Start strong, finish stronger', emoji: '💡' },
    { text: 'Hello, bright one!', sub: 'Shine on — you\'ve got a great day ahead', emoji: '✨' },
    { text: 'Morning warrior!', sub: 'Battle station: active ⚔️', emoji: '⚔️' },
    { text: 'Good Morning!', sub: 'Every call today could change a student\'s life', emoji: '🎓' },
    { text: 'Dawn\'s early light!', sub: 'Let the leads flow in', emoji: '🌻' },
    { text: 'Morning, superstar!', sub: 'Ready to make some magic?', emoji: '🌠' },
    { text: 'Fresh start!', sub: 'New morning, new opportunities', emoji: '🍀' },
    { text: 'Good Morning!', sub: 'Your pipeline won\'t fill itself!', emoji: '📊' },
  ],

  // 12:00 – 16:59  Afternoon
  afternoon: [
    { text: 'Good Afternoon!', sub: 'Halfway there — keep pushing!', emoji: '☀️' },
    { text: 'Afternoon grind!', sub: 'Peak hours for student calls', emoji: '📞' },
    { text: 'Hello, afternoon!', sub: 'Perfect time to follow up on leads', emoji: '🔄' },
    { text: 'Midday mission!', sub: 'Stay sharp, stay focused', emoji: '🎯' },
    { text: 'Good Afternoon!', sub: 'Coffee refill time? Don\'t stop now', emoji: '☕' },
    { text: 'Sun\'s at its peak!', sub: 'So should your energy be', emoji: '🌞' },
    { text: 'Afternoon blaze!', sub: 'Hot leads, hotter hustle', emoji: '🔥' },
    { text: 'Good Afternoon!', sub: 'Every lead today is a future student', emoji: '🎓' },
    { text: 'Midday magic!', sub: 'Keep the momentum going strong', emoji: '✨' },
    { text: 'Hello, go-getter!', sub: 'Afternoon is prime time — make it count', emoji: '💪' },
    { text: 'Afternoon champion!', sub: 'You\'re already winning', emoji: '🏆' },
    { text: 'Good Afternoon!', sub: 'The pipeline needs your attention', emoji: '📋' },
    { text: 'Sun-powered mode!', sub: 'Full energy, maximum output', emoji: '⚡' },
    { text: 'Hello, rockstar!', sub: 'Keep rocking those leads', emoji: '🎸' },
    { text: 'Good Afternoon!', sub: 'Quality over quantity — always', emoji: '💎' },
    { text: 'Afternoon warrior!', sub: 'Battle on, victory is near', emoji: '⚔️' },
    { text: 'Sunny hello!', sub: 'Bright ideas for a bright afternoon', emoji: '💡' },
    { text: 'Good Afternoon!', sub: 'Students are waiting for your call!', emoji: '📱' },
    { text: 'Afternoon hustle!', sub: 'No slowing down now', emoji: '🚀' },
    { text: 'Hello, achiever!', sub: 'Your numbers are looking great', emoji: '📈' },
    { text: 'Good Afternoon!', sub: 'Power through — the finish line is close', emoji: '🏁' },
    { text: 'Midday boss!', sub: 'Running the show like a pro', emoji: '👑' },
    { text: 'Afternoon focus!', sub: 'Zone in, tune out distractions', emoji: '🎯' },
    { text: 'Hello, high-flyer!', sub: 'Keep soaring through those targets', emoji: '🦅' },
    { text: 'Good Afternoon!', sub: 'Team MathsPS is proud of you', emoji: '🌟' },
  ],

  // 17:00 – 20:59  Evening
  evening: [
    { text: 'Good Evening!', sub: 'Wrapping up strong — nice work', emoji: '🌆' },
    { text: 'Evening hustle!', sub: 'Golden hour for student calls', emoji: '🌇' },
    { text: 'Hello, evening!', sub: 'Last push of the day — let\'s go', emoji: '🔥' },
    { text: 'Good Evening!', sub: 'Sunset means success is near', emoji: '🌅' },
    { text: 'Evening glow!', sub: 'You\'ve worked hard — keep it up', emoji: '✨' },
    { text: 'Day\'s not over!', sub: 'Evening calls convert the best', emoji: '📞' },
    { text: 'Good Evening!', sub: 'End the day on a high note', emoji: '🎵' },
    { text: 'Evening star!', sub: 'You\'re shining bright today', emoji: '⭐' },
    { text: 'Hello, closer!', sub: 'Close strong, sleep well', emoji: '🎯' },
    { text: 'Good Evening!', sub: 'One more lead could change everything', emoji: '💎' },
    { text: 'Evening champion!', sub: 'Champions work when others stop', emoji: '🏆' },
    { text: 'Sunset grind!', sub: 'Make the most of every hour', emoji: '🌄' },
    { text: 'Good Evening!', sub: 'Parents are home — perfect call time!', emoji: '🏠' },
    { text: 'Evening power!', sub: 'Finishing strong is your signature', emoji: '💪' },
    { text: 'Hello, night owl!', sub: 'Evening productivity is real', emoji: '🦉' },
    { text: 'Good Evening!', sub: 'The CRM never sleeps, and neither do leads', emoji: '💻' },
    { text: 'Golden hour!', sub: 'Capture every last opportunity', emoji: '🌟' },
    { text: 'Evening legend!', sub: 'Legends log in, others log out', emoji: '👑' },
    { text: 'Good Evening!', sub: 'Your dedication is noticed', emoji: '❤️' },
    { text: 'Dusk hustle!', sub: 'Still here? You\'re amazing', emoji: '🌙' },
    { text: 'Good Evening!', sub: 'Evening energy is underrated', emoji: '⚡' },
    { text: 'Hello, finisher!', sub: 'Today\'s logs look great so far', emoji: '📊' },
    { text: 'Evening strong!', sub: 'Discipline separates great teams', emoji: '🎖️' },
    { text: 'Good Evening!', sub: 'MathsPS students thank you for this!', emoji: '🎓' },
    { text: 'Twilight time!', sub: 'That last call might be the best one', emoji: '🌠' },
  ],

  // 21:00 – 04:59  Night / Late
  night: [
    { text: 'Burning midnight oil!', sub: 'Dedicated staff — respect!', emoji: '🕯️' },
    { text: 'Good Night, hustler!', sub: 'Late nights build empires', emoji: '🌙' },
    { text: 'Night shift hero!', sub: 'The silent backbone of the team', emoji: '🦸' },
    { text: 'Stars are out!', sub: 'And so are you — incredible', emoji: '⭐' },
    { text: 'Late night mode!', sub: 'System armed and ready', emoji: '🔒' },
    { text: 'Good Night!', sub: 'Night owls catch the best leads', emoji: '🦉' },
    { text: 'Hello, nightcrawler!', sub: 'The CRM is yours after dark', emoji: '🌃' },
    { text: 'Midnight mission!', sub: 'Logging in late? Committed.', emoji: '🎯' },
    { text: 'Good Night!', sub: 'Quality work at any hour — impressive', emoji: '💎' },
    { text: 'Night warrior!', sub: 'While others sleep, you lead', emoji: '⚔️' },
    { text: 'Stargazer mode!', sub: 'Reaching for the top — always', emoji: '🌠' },
    { text: 'Good Night!', sub: 'The numbers you add now matter tomorrow', emoji: '📊' },
    { text: 'Nocturnal legend!', sub: 'True dedication knows no hours', emoji: '👑' },
    { text: 'Night energy!', sub: 'Still going? Respect.', emoji: '⚡' },
    { text: 'Good Night!', sub: 'Team MathsPS appreciates your hustle', emoji: '❤️' },
    { text: 'Moon shift ON!', sub: 'Quiet hours, maximum focus', emoji: '🌕' },
    { text: 'Hello, night owl!', sub: 'Productivity after dark — real talk', emoji: '🔥' },
    { text: 'Good Night!', sub: 'Rest soon — you\'ve earned it', emoji: '😴' },
    { text: 'Midnight clarity!', sub: 'Night brings focus like nothing else', emoji: '💡' },
    { text: 'Late shift king!', sub: 'The best reports come from you', emoji: '📋' },
    { text: 'Night grind mode!', sub: 'Consistent work creates success', emoji: '🚀' },
    { text: 'Hello, dreamer!', sub: 'Even at night you\'re chasing goals', emoji: '🌙' },
    { text: 'Dark mode, bright mind!', sub: 'Night login = maximum dedication', emoji: '💻' },
    { text: 'Good Night!', sub: 'Students will thank you tomorrow', emoji: '🎓' },
    { text: 'Night guardian!', sub: 'Watching over the CRM around the clock', emoji: '🛡️' },
  ],
}

function getPool(): { text: string; sub: string; emoji: string }[] {
  const h = new Date().getHours()
  if (h >= 5 && h < 12) return GREETINGS.morning
  if (h >= 12 && h < 17) return GREETINGS.afternoon
  if (h >= 17 && h < 21) return GREETINGS.evening
  return GREETINGS.night
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// ────────────────────────────────────────────────────────────────

export default function LoginGreeting() {
  const supabase = createClient()
  const [visible, setVisible] = useState(false)
  const [animOut, setAnimOut] = useState(false)
  const [name, setName] = useState('')
  const [role, setRole] = useState('member')
  const [greeting, setGreeting] = useState<{ text: string; sub: string; emoji: string } | null>(null)

  useEffect(() => {
    const shouldGreet = sessionStorage.getItem('crm_show_greeting')
    if (!shouldGreet) return
    sessionStorage.removeItem('crm_show_greeting')

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Staff'
      const userRole = user.user_metadata?.role || 'member'
      setName(displayName)
      setRole(userRole)
      setGreeting(pickRandom(getPool()))

      setTimeout(() => {
        setVisible(true)
        setTimeout(() => {
          setAnimOut(true)
          setTimeout(() => setVisible(false), 500)
        }, 4500)
      }, 400)
    })
  }, [])

  if (!visible || !greeting) return null

  const capitalName = name.charAt(0).toUpperCase() + name.slice(1)
  const isAdmin = role === 'admin'

  return (
    <>
      <style>{`
        @keyframes greetSlideIn {
          from { transform: translateX(120%) scale(0.95); opacity: 0; }
          to   { transform: translateX(0)    scale(1);    opacity: 1; }
        }
        @keyframes greetSlideOut {
          from { transform: translateX(0)    scale(1);    opacity: 1; }
          to   { transform: translateX(120%) scale(0.95); opacity: 0; }
        }
        .greet-toast {
          animation: greetSlideIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .greet-toast.out {
          animation: greetSlideOut 0.4s cubic-bezier(0.55, 0, 0.45, 1) forwards;
        }
        @keyframes greetPulse {
          0%,100% { transform: scale(1) rotate(0deg); }
          30%      { transform: scale(1.2) rotate(-6deg); }
          60%      { transform: scale(1.14) rotate(5deg); }
        }
        .greet-emoji { animation: greetPulse 2.4s ease-in-out infinite; display: inline-block; }
        @keyframes greetLogoGlow {
          0%,100% { box-shadow: 0 0 16px rgba(59,130,246,0.35), 0 4px 20px rgba(0,0,0,0.4); }
          50%      { box-shadow: 0 0 28px rgba(139,92,246,0.5), 0 4px 20px rgba(0,0,0,0.4); }
        }
        .greet-logo { animation: greetLogoGlow 2.5s ease-in-out infinite; }
        .greet-progress {
          animation: greetBar 4.5s linear forwards;
          animation-delay: 0.5s;
        }
        @keyframes greetBar {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>

      <div
        className={`greet-toast${animOut ? ' out' : ''}`}
        style={{
          position: 'fixed',
          top: 20, right: 20,
          zIndex: 99999,
          background: 'rgba(10, 15, 28, 0.92)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderTop: '1px solid rgba(255,255,255,0.14)',
          borderRadius: 18,
          padding: 0,
          minWidth: 280,
          maxWidth: 330,
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(59,130,246,0.1)',
        }}
      >
        {/* Coloured accent strip at top */}
        <div style={{
          height: 3,
          background: isAdmin
            ? 'linear-gradient(90deg, #8b5cf6, #c084fc, #ec4899)'
            : 'linear-gradient(90deg, #3b82f6, #06b6d4, #10b981)',
          borderRadius: '18px 18px 0 0',
        }} />

        <div style={{ padding: '14px 18px 12px' }}>
          {/* Top row: role badge + time */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
              color: isAdmin ? '#c084fc' : '#60a5fa',
              background: isAdmin ? 'rgba(192,132,252,0.12)' : 'rgba(96,165,250,0.12)',
              padding: '2px 8px', borderRadius: 20,
              border: `1px solid ${isAdmin ? 'rgba(192,132,252,0.3)' : 'rgba(96,165,250,0.3)'}`,
              textTransform: 'uppercase',
            }}>
              {isAdmin ? '👑 Admin' : '🔵 Staff'}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* Greeting body */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <span className="greet-emoji" style={{ fontSize: 30, lineHeight: 1, flexShrink: 0 }}>{greeting.emoji}</span>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.3 }}>{greeting.text},</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.15, letterSpacing: '-0.5px' }}>
                {capitalName}!
              </div>
            </div>
          </div>

          {/* Sub-message */}
          <div style={{
            fontSize: 11.5, color: 'var(--text-secondary)',
            marginBottom: 10, paddingLeft: 42, lineHeight: 1.5,
          }}>
            {greeting.sub}
          </div>

          {/* Countdown bar */}
          <div style={{ height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 99, overflow: 'hidden' }}>
            <div className="greet-progress" style={{
              height: '100%',
              background: isAdmin
                ? 'linear-gradient(90deg, #8b5cf6, #c084fc)'
                : 'linear-gradient(90deg, #3b82f6, #06b6d4)',
              borderRadius: 99, width: '100%',
            }} />
          </div>
        </div>

      </div>
    </>
  )
}
