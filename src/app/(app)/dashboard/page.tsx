import { getCurrentUserProfile } from '@/lib/user'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const metadata = { title: 'Dashboard — DocuTrail' }

export default async function DashboardPage() {
  const profile = await getCurrentUserProfile()
  if (!profile) redirect('/login')

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <Card className="max-w-sm">
        <CardHeader>
          <CardTitle className="text-base">Welcome, {profile.fullName}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Role</span>
            <Badge variant="outline">{profile.role}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Email</span>
            <span>{profile.email}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
