import { redirect } from 'next/navigation'
import { getCurrentUserProfile } from '@/lib/user'
import { can } from '@/lib/rbac/permissions'
import { db } from '@/lib/db'
import {
  documents,
  documentApprovals,
  users,
  offices,
} from '@/lib/db/schema'
import { eq, sql, count, and, isNotNull } from 'drizzle-orm'
import { AnalyticsCharts, type StatusCount, type MonthlyCount, type OfficeBottleneck } from './_components/AnalyticsCharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata = { title: 'Analytics — DocuTrail' }

async function fetchStats() {
  const [statusRows, monthlyRows, pendingByOffice, totalApprovals, avgApprovalHours] =
    await Promise.all([
      // doc count by status
      db
        .select({ status: documents.currentStatus, count: count() })
        .from(documents)
        .groupBy(documents.currentStatus),

      // monthly submission trend (last 6 months)
      db.execute(sql`
        SELECT to_char(date_trunc('month', created_at), 'Mon YY') AS month,
               count(*)::int AS count
        FROM documents
        WHERE created_at >= now() - interval '6 months'
        GROUP BY date_trunc('month', created_at)
        ORDER BY date_trunc('month', created_at)
      `),

      // pending approvals count grouped by assignee's office
      db.execute(sql`
        SELECT COALESCE(o.name, 'Unassigned') AS office,
               count(da.id)::int AS pending
        FROM document_approvals da
        JOIN users u ON u.id = da.assignee_id
        LEFT JOIN offices o ON o.id = u.office_id
        WHERE da.status = 'pending'
        GROUP BY o.name
        ORDER BY pending DESC
        LIMIT 8
      `),

      // total approvals acted on
      db
        .select({ count: count() })
        .from(documentApprovals)
        .where(
          and(
            eq(documentApprovals.status, 'approved'),
            isNotNull(documentApprovals.actedAt),
          ),
        ),

      // avg hours from approval created_at → acted_at
      db.execute(sql`
        SELECT round(
          avg(
            extract(epoch from (acted_at - created_at)) / 3600
          )::numeric, 1
        ) AS avg_hours
        FROM document_approvals
        WHERE status = 'approved' AND acted_at IS NOT NULL
      `),
    ])

  const statusCounts: StatusCount[] = statusRows.map((r) => ({
    status: r.status,
    count: Number(r.count),
  }))

  const monthlyTrend: MonthlyCount[] = (monthlyRows as unknown as { month: string; count: number }[]).map(
    (r) => ({ month: r.month, count: Number(r.count) }),
  )

  const bottleneck: OfficeBottleneck[] = (
    pendingByOffice as unknown as { office: string; pending: number }[]
  ).map((r) => ({ office: r.office, pending: Number(r.pending), avgHours: 0 }))

  const totalApproved = totalApprovals[0]?.count ?? 0
  const avgHours = (avgApprovalHours as unknown as { avg_hours: string | null }[])[0]?.avg_hours ?? null

  const totalDocs = statusCounts.reduce((s, r) => s + r.count, 0)
  const pendingCount = bottleneck.reduce((s, r) => s + r.pending, 0)

  return { statusCounts, monthlyTrend, bottleneck, totalDocs, pendingCount, totalApproved, avgHours }
}

export default async function AnalyticsPage() {
  const profile = await getCurrentUserProfile()
  if (!profile) redirect('/login')
  if (!can(profile.role, 'read_all_documents')) redirect('/dashboard')

  const { statusCounts, monthlyTrend, bottleneck, totalDocs, pendingCount, totalApproved, avgHours } =
    await fetchStats()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Analytics</h1>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Docs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalDocs}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Pending Approvals</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{Number(totalApproved)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Avg. Approval Time</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{avgHours != null ? `${avgHours}h` : '—'}</p>
          </CardContent>
        </Card>
      </div>

      <AnalyticsCharts
        statusCounts={statusCounts}
        monthlyTrend={monthlyTrend}
        bottleneck={bottleneck}
      />
    </div>
  )
}
