import { redirect } from 'next/navigation'
import Link from 'next/link'
import { eq, and, desc } from 'drizzle-orm'
import { getCurrentUserProfile } from '@/lib/user'
import { db } from '@/lib/db'
import { documentApprovals, documents, documentTemplates, users, approvalSteps, roles } from '@/lib/db/schema'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ChevronRight } from 'lucide-react'

export const metadata = { title: 'Approvals — DocuTrail' }

export default async function ApprovalsPage() {
  const profile = await getCurrentUserProfile()
  if (!profile) redirect('/login')

  // Pending approvals where this user is the assignee AND it's the document's current step
  const pending = await db
    .select({
      approvalId: documentApprovals.id,
      documentId: documents.id,
      documentTitle: documents.title,
      templateName: documentTemplates.name,
      creatorName: users.fullName,
      stepOrder: approvalSteps.orderIndex,
      roleName: roles.name,
      deadlineHours: approvalSteps.deadlineHours,
      submittedAt: documentApprovals.createdAt,
    })
    .from(documentApprovals)
    .innerJoin(documents, eq(documentApprovals.documentId, documents.id))
    .innerJoin(documentTemplates, eq(documents.templateId, documentTemplates.id))
    .innerJoin(users, eq(documents.creatorId, users.id))
    .innerJoin(approvalSteps, eq(documentApprovals.stepId, approvalSteps.id))
    .innerJoin(roles, eq(approvalSteps.approverRoleId, roles.id))
    .where(
      and(
        eq(documentApprovals.assigneeId, profile.id),
        eq(documentApprovals.status, 'pending'),
        // Only show when this is the active step
        eq(documents.currentStepId, documentApprovals.stepId),
      ),
    )
    .orderBy(desc(documentApprovals.createdAt))

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Pending Approvals</h1>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>From</TableHead>
              <TableHead>Step</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pending.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No pending approvals.
                </TableCell>
              </TableRow>
            ) : (
              pending.map((row) => (
                <TableRow key={row.approvalId}>
                  <TableCell className="font-medium">{row.documentTitle}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{row.templateName}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{row.creatorName}</TableCell>
                  <TableCell className="text-sm">
                    Step {row.stepOrder}
                    <span className="ml-1 text-muted-foreground capitalize">
                      ({row.roleName?.replace('_', ' ')})
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(row.submittedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/documents/${row.documentId}`}
                      className="flex items-center justify-center text-muted-foreground hover:text-foreground"
                    >
                      <ChevronRight size={16} />
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
