import { redirect } from 'next/navigation'
import { getCurrentUserProfile } from '@/lib/user'
import { can } from '@/lib/rbac/permissions'
import { db } from '@/lib/db'
import { auditLog, users } from '@/lib/db/schema'
import { desc, eq } from 'drizzle-orm'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Download } from 'lucide-react'

export const metadata = { title: 'Audit Log — DocuTrail' }

const ACTION_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  INSERT: 'default',
  UPDATE: 'secondary',
  DELETE: 'destructive',
}

export default async function AuditLogPage() {
  const profile = await getCurrentUserProfile()
  if (!profile) redirect('/login')
  if (!can(profile.role, 'view_audit_log')) redirect('/dashboard')

  const rows = await db
    .select({
      id: auditLog.id,
      actorId: auditLog.actorId,
      actorName: users.fullName,
      action: auditLog.action,
      resourceType: auditLog.resourceType,
      resourceId: auditLog.resourceId,
      createdAt: auditLog.createdAt,
      rowHash: auditLog.rowHash,
    })
    .from(auditLog)
    .leftJoin(users, eq(auditLog.actorId, users.id))
    .orderBy(desc(auditLog.createdAt))
    .limit(200)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Audit Log</h1>
        <Link href="/api/audit/export">
          <Button variant="outline" size="sm" className="gap-2">
            <Download size={14} />
            Export CSV
          </Button>
        </Link>
      </div>

      <p className="text-sm text-muted-foreground">
        Showing up to 200 most recent entries. Use CSV export for a full archive.
      </p>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-left font-medium">When</th>
              <th className="px-3 py-2 text-left font-medium">Actor</th>
              <th className="px-3 py-2 text-left font-medium">Action</th>
              <th className="px-3 py-2 text-left font-medium">Table</th>
              <th className="px-3 py-2 text-left font-medium">Resource ID</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Row Hash</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-muted/20">
                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(new Date(row.createdAt), { addSuffix: true })}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {row.actorName ?? (row.actorId ? row.actorId.slice(0, 8) + '…' : 'system')}
                </td>
                <td className="px-3 py-2">
                  <Badge variant={ACTION_VARIANT[row.action] ?? 'outline'} className="font-mono text-xs">
                    {row.action}
                  </Badge>
                </td>
                <td className="px-3 py-2 font-mono text-xs">{row.resourceType}</td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                  {row.resourceId ? row.resourceId.slice(0, 8) + '…' : '—'}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground max-w-[120px] truncate">
                  {row.rowHash}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  No audit entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
