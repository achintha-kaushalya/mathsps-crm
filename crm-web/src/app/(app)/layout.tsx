import Sidebar from '@/components/Sidebar'
import ClientOnly from '@/components/ClientOnly'
import LoginGreeting from '@/components/LoginGreeting'
import TutorProfileModal from '@/components/TutorProfileModal'
import PageTransition from '@/components/PageTransition'
import SessionTimeoutManager from '@/components/SessionTimeoutManager'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClientOnly>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar />
        <main className="main-content">
          <PageTransition>
            {children}
          </PageTransition>
        </main>
      </div>
      <LoginGreeting />
      <TutorProfileModal />
      <SessionTimeoutManager />
    </ClientOnly>
  )
}
