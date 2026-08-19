import Sidebar from '@/components/Sidebar'
import ClientOnly from '@/components/ClientOnly'
import LoginGreeting from '@/components/LoginGreeting'
import PageTransition from '@/components/PageTransition'

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
    </ClientOnly>
  )
}
