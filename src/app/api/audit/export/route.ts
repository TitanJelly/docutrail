import { NextResponse } from 'next/server'
import { getCurrentUserProfile } from '@/lib/user'
import { can } from '@/lib/rbac/permissions'
import { db } from '@/lib/db'
import { auditLog, users } from '@/lib/db/schema'
import { desc, eq } from 'drizzle-orm'

export async function GET() {
  const profile = await getCurrentUserProfile()
  if (!profile || !can(profile.role, 'view_audit_log')) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const rows = await db
    .select({
      id: auditLog.id,
      createdAt: auditLog.createdAt,
      actorId: auditLog.actorId,
      actorName: users.fullName,
      action: auditLog.action,
      resourceType: auditLog.resourceType,
      resourceId: auditLog.resourceId,
      ip: auditLog.ip,
      userAgent: auditLog.userAgent,
      prevHash: auditLog.prevHash,
      rowHash: auditLog.rowHash,
    })
    .from(auditLog)
    .leftJoin(users, eq(auditLog.actorId, users.id))
    .orderBy(desc(auditLog.createdAt))

  const header = [
    'id',
    'created_at',
    'actor_id',
    'actor_name',
    'action',
    'resource_type',
    'resource_id',
    'ip',
    'user_agent',
    'prev_hash',
    'row_hash',
  ]

  const escape = (v: unknown) => {
    if (v == null) return ''
    const s = String(v).replace(/"/g, '""')
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s
  }

  const lines = [
    header.join(','),
    ...rows.map((r) =>
      [
        r.id,
        r.createdAt.toISOString(),
        r.actorId ?? '',
        r.actorName ?? '',
        r.action,
        r.resourceType,
        r.resourceId ?? '',
        r.ip ?? '',
        r.userAgent ?? '',
        r.prevHash ?? '',
        r.rowHash,
      ]
        .map(escape)
        .join(','),
    ),
  ]

  const csv = lines.join('\r\n')
  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="docutrail-audit-${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
