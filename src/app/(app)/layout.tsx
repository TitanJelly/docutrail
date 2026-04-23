import { redirect } from 'next/navigation'
import { getCurrentUserProfile } from '@/lib/user'
import Sidebar from '@/components/app/Sidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentUserProfile()

  if (!profile) redirect('/login')

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={profile.role} fullName={profile.fullName} email={profile.email} />
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  )
}
