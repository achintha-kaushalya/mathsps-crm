import BottomFloatingDock from '@/components/BottomFloatingDock'
import ClientOnly from '@/components/ClientOnly'
import LoginGreeting from '@/components/LoginGreeting'
import TutorProfileModal from '@/components/TutorProfileModal'
import PageTransition from '@/components/PageTransition'
import SessionTimeoutManager from '@/components/SessionTimeoutManager'
import VirtualOfficePresenceBroadcaster from '@/components/VirtualOfficePresenceBroadcaster'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClientOnly>
      <div style={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
        <main className="main-content" style={{ paddingBottom: 48 }}>
          <PageTransition>
            {children}
          </PageTransition>
        </main>
      </div>
      <BottomFloatingDock />
      <LoginGreeting />
      <TutorProfileModal />
      <SessionTimeoutManager />
      <VirtualOfficePresenceBroadcaster />
    </ClientOnly>
  )
}
