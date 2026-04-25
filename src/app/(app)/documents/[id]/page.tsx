import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { eq, and, desc, asc, isNull } from 'drizzle-orm'
import { getCurrentUserProfile } from '@/lib/user'
import { db } from '@/lib/db'
import {
  documents,
  documentVersions,
  documentTemplates,
  documentApprovals,
  approvalSteps,
  approvalRoutes,
  roles,
  offices,
  users,
  signatures,
} from '@/lib/db/schema'
import { createAdminClient } from '@/lib/supabase/admin'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, CheckCircle, Clock, Download, XCircle } from 'lucide-react'
import Image from 'next/image'
import type { JSONContent } from '@tiptap/core'
import TiptapViewer from '@/components/editor/TiptapViewer'
import ApprovalActions from './_components/ApprovalActions'
import SubmitButton from './_components/SubmitButton'

export const metadata = { title: 'Document — DocuTrail' }

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  draft: 'secondary',
  in_review: 'default',
  approved: 'outline',
  returned: 'destructive',
  archived: 'outline',
}

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentUserProfile()
  if (!profile) redirect('/login')

  const { id } = await params

  const [doc] = await db
    .select({
      id: documents.id,
      title: documents.title,
      currentStatus: documents.currentStatus,
      currentStepId: documents.currentStepId,
      routeId: documents.routeId,
      creatorId: documents.creatorId,
      templateName: documentTemplates.name,
      routeName: approvalRoutes.name,
    })
    .from(documents)
    .leftJoin(documentTemplates, eq(documents.templateId, documentTemplates.id))
    .leftJoin(approvalRoutes, eq(documents.routeId, approvalRoutes.id))
    .where(and(eq(documents.id, id), isNull(documents.deletedAt)))

  if (!doc) notFound()

  // Permission check: creator, assignee, or read_all_documents
  const isCreator = doc.creatorId === profile.id
  const hasReadAll = ['it_admin', 'dean', 'exec_director', 'dept_chair'].includes(profile.role)

  // Latest version — content + PDF path in one query
  const [latestVersion] = await db
    .select({
      content: documentVersions.content,
      generatedPdfPath: documentVersions.generatedPdfPath,
    })
    .from(documentVersions)
    .where(eq(documentVersions.documentId, id))
    .orderBy(desc(documentVersions.versionNo))
    .limit(1)

  const hasPdf = !!latestVersion?.generatedPdfPath

  // User's saved signatures (passed to ApprovalActions for the signature picker)
  const userSigRows = await db
    .select({ id: signatures.id, type: signatures.type, dataPath: signatures.dataPath })
    .from(signatures)
    .where(eq(signatures.userId, profile.id))
    .orderBy(desc(signatures.createdAt))

  const supabase = createAdminClient()
  const userSignatures = await Promise.all(
    userSigRows.map(async (sig) => {
      const { data } = await supabase.storage
        .from('signatures')
        .createSignedUrl(sig.dataPath, 3600)
      return { id: sig.id, type: sig.type, signedUrl: data?.signedUrl ?? '' }
    }),
  )

  // Approval chain (all steps in route order with their approval rows)
  let chain: {
    stepId: string
    orderIndex: number
    roleName: string | null
    officeScope: string
    officeName: string | null
    approvalId: string | null
    assigneeName: string | null
    approvalStatus: string | null
    comment: string | null
    actedAt: Date | null
  }[] = []

  let pendingApprovalForCurrentUser: string | null = null

  if (doc.routeId) {
    const steps = await db
      .select({
        stepId: approvalSteps.id,
        orderIndex: approvalSteps.orderIndex,
        officeScope: approvalSteps.officeScope,
        roleName: roles.name,
        officeName: offices.name,
      })
      .from(approvalSteps)
      .leftJoin(roles, eq(approvalSteps.approverRoleId, roles.id))
      .leftJoin(offices, eq(approvalSteps.officeId, offices.id))
      .where(eq(approvalSteps.routeId, doc.routeId))
      .orderBy(asc(approvalSteps.orderIndex))

    // Get approval rows for this document
    const approvalRows = await db
      .select({
        id: documentApprovals.id,
        stepId: documentApprovals.stepId,
        assigneeId: documentApprovals.assigneeId,
        assigneeName: users.fullName,
        status: documentApprovals.status,
        comment: documentApprovals.comment,
        actedAt: documentApprovals.actedAt,
      })
      .from(documentApprovals)
      .leftJoin(users, eq(documentApprovals.assigneeId, users.id))
      .where(eq(documentApprovals.documentId, id))
      .orderBy(desc(documentApprovals.createdAt))

    chain = steps.map((step) => {
      const stepApprovals = approvalRows.filter((a) => a.stepId === step.stepId)
      // Show the most recent approval for this step
      const latest = stepApprovals[0] ?? null
      return {
        stepId: step.stepId,
        orderIndex: step.orderIndex,
        roleName: step.roleName,
        officeScope: step.officeScope,
        officeName: step.officeName,
        approvalId: latest?.id ?? null,
        assigneeName: latest?.assigneeName ?? null,
        approvalStatus: latest?.status ?? null,
        comment: latest?.comment ?? null,
        actedAt: latest?.actedAt ?? null,
      }
    })

    // Check if current user has a pending approval for the current step
    if (doc.currentStepId) {
      const myPending = approvalRows.find(
        (a) =>
          a.stepId === doc.currentStepId &&
          a.assigneeId === profile.id &&
          a.status === 'pending',
      )
      if (myPending) pendingApprovalForCurrentUser = myPending.id
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/documents">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft size={14} />
            Documents
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">{doc.title}</h1>
          <div className="mt-0.5 flex items-center gap-2">
            <Badge variant={STATUS_VARIANT[doc.currentStatus] ?? 'outline'}>
              {doc.currentStatus.replace('_', ' ')}
            </Badge>
            {doc.templateName && (
              <span className="text-sm text-muted-foreground">{doc.templateName}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {hasPdf && (
            <Link href={`/documents/${id}/pdf`} target="_blank">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Download size={13} />
                PDF
              </Button>
            </Link>
          )}
          {(doc.currentStatus === 'draft' || doc.currentStatus === 'returned') && isCreator && (
            <>
              <Link href={`/documents/${id}/edit`}>
                <Button variant="outline" size="sm">Edit</Button>
              </Link>
              <SubmitButton documentId={id} />
            </>
          )}
          {pendingApprovalForCurrentUser && (
            <ApprovalActions
              approvalId={pendingApprovalForCurrentUser}
              userSignatures={userSignatures}
            />
          )}
        </div>
      </div>

      {/* Document content */}
      <div className="rounded-md border bg-white shadow-sm overflow-hidden">
        <Image
          src="/ccs-header.png"
          alt="CCS Header"
          width={1200}
          height={123}
          className="w-full"
          priority
        />
        {latestVersion?.content ? (
          <TiptapViewer content={latestVersion.content as JSONContent} />
        ) : (
          <div className="px-8 py-4 text-sm text-muted-foreground">No content yet.</div>
        )}
        <Image
          src="/ccs-footer.png"
          alt="CCS Footer"
          width={1200}
          height={67}
          className="w-full"
        />
      </div>

      {/* Approval chain */}
      {chain.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-base font-medium">Approval Chain</h2>
          <ol className="space-y-2">
            {chain.map((step) => {
              const isCurrent = doc.currentStepId === step.stepId
              const statusIcon =
                step.approvalStatus === 'approved' ? (
                  <CheckCircle size={16} className="text-green-500" />
                ) : step.approvalStatus === 'rejected' ? (
                  <XCircle size={16} className="text-destructive" />
                ) : isCurrent ? (
                  <Clock size={16} className="text-blue-500 animate-pulse" />
                ) : (
                  <Clock size={16} className="text-muted-foreground" />
                )

              return (
                <li
                  key={step.stepId}
                  className={`flex items-start gap-3 rounded-md border p-3 text-sm ${isCurrent ? 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20' : ''}`}
                >
                  {statusIcon}
                  <div className="flex-1">
                    <div className="font-medium capitalize">
                      Step {step.orderIndex} — {step.roleName?.replace('_', ' ')}
                      {step.officeScope === 'specific_office' && step.officeName && (
                        <span className="ml-1 text-muted-foreground">({step.officeName})</span>
                      )}
                      {step.officeScope === 'creator_office' && (
                        <span className="ml-1 text-muted-foreground">(creator's office)</span>
                      )}
                    </div>
                    {step.assigneeName && (
                      <div className="text-muted-foreground">
                        {step.assigneeName}
                        {step.actedAt && (
                          <span className="ml-1">· {new Date(step.actedAt).toLocaleDateString()}</span>
                        )}
                      </div>
                    )}
                    {step.comment && (
                      <div className="mt-1 text-muted-foreground italic">"{step.comment}"</div>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        </section>
      )}
    </div>
  )
}
