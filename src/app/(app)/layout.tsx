import { redirect } from 'next/navigation'
import { getCurrentUserProfile } from '@/lib/user'
import Sidebar from '@/components/app/Sidebar'
import { NotificationBell } from '@/components/notifications/NotificationBell'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentUserProfile()

  if (!profile) redirect('/login')

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={profile.role} fullName={profile.fullName} email={profile.email} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-12 shrink-0 items-center justify-end border-b px-4">
          <NotificationBell userId={profile.id} />
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  )
}
