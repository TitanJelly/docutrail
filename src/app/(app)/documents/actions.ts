'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { eq, asc, and, isNull, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  documents,
  documentVersions,
  documentTemplates,
  approvalSteps,
  documentApprovals,
  users,
  roles,
} from '@/lib/db/schema'
import { getCurrentUserProfile } from '@/lib/user'

const createSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  templateId: z.string().uuid('Select a template'),
  content: z.record(z.string(), z.unknown()),
})

type ActionResult =
  | { success: true; documentId: string }
  | { success: false; error: string }

export async function createDocumentAction(data: {
  title: string
  templateId: string
  content: Record<string, unknown>
}): Promise<ActionResult> {
  const profile = await getCurrentUserProfile()
  if (!profile) return { success: false, error: 'Unauthorized' }

  const parsed = createSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const [doc] = await db
    .insert(documents)
    .values({
      title: parsed.data.title,
      templateId: parsed.data.templateId,
      creatorId: profile.id,
    })
    .returning({ id: documents.id })

  await db.insert(documentVersions).values({
    documentId: doc.id,
    versionNo: 1,
    content: parsed.data.content,
    createdBy: profile.id,
  })

  revalidatePath('/documents')
  return { success: true, documentId: doc.id }
}

type UpdateResult = { success: true } | { success: false; error: string }

export async function updateDocumentAction(data: {
  documentId: string
  content: Record<string, unknown>
}): Promise<UpdateResult> {
  const profile = await getCurrentUserProfile()
  if (!profile) return { success: false, error: 'Unauthorized' }

  const [doc] = await db
    .select({ creatorId: documents.creatorId, currentStatus: documents.currentStatus })
    .from(documents)
    .where(and(eq(documents.id, data.documentId), isNull(documents.deletedAt)))

  if (!doc) return { success: false, error: 'Document not found' }
  if (doc.creatorId !== profile.id) return { success: false, error: 'Unauthorized' }
  if (doc.currentStatus !== 'draft' && doc.currentStatus !== 'returned') {
    return { success: false, error: 'Only draft or returned documents can be edited' }
  }

  const [latest] = await db
    .select({ versionNo: documentVersions.versionNo })
    .from(documentVersions)
    .where(eq(documentVersions.documentId, data.documentId))
    .orderBy(desc(documentVersions.versionNo))
    .limit(1)

  const nextVersion = (latest?.versionNo ?? 0) + 1

  await db.insert(documentVersions).values({
    documentId: data.documentId,
    versionNo: nextVersion,
    content: data.content,
    createdBy: profile.id,
  })

  await db
    .update(documents)
    .set({ updatedAt: new Date() })
    .where(eq(documents.id, data.documentId))

  revalidatePath(`/documents/${data.documentId}`)
  revalidatePath('/documents')
  return { success: true }
}

type SubmitResult = { success: true } | { success: false; error: string }

export async function submitDocumentAction(documentId: string): Promise<SubmitResult> {
  const profile = await getCurrentUserProfile()
  if (!profile) return { success: false, error: 'Unauthorized' }

  // Load document — verify ownership and draft state
  const [doc] = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.id, documentId),
        isNull(documents.deletedAt),
      ),
    )

  if (!doc) return { success: false, error: 'Document not found' }
  if (doc.creatorId !== profile.id) return { success: false, error: 'Unauthorized' }
  if (doc.currentStatus !== 'draft' && doc.currentStatus !== 'returned') {
    return { success: false, error: 'Only draft or returned documents can be submitted' }
  }

  // Load template → route
  const [template] = await db
    .select({ defaultRouteId: documentTemplates.defaultRouteId })
    .from(documentTemplates)
    .where(eq(documentTemplates.id, doc.templateId))

  if (!template?.defaultRouteId) {
    return { success: false, error: 'This template has no approval route assigned. Ask IT Admin to assign one.' }
  }

  // Load steps for the route (ordered)
  const steps = await db
    .select({
      id: approvalSteps.id,
      orderIndex: approvalSteps.orderIndex,
      approverRoleId: approvalSteps.approverRoleId,
      officeScope: approvalSteps.officeScope,
      officeId: approvalSteps.officeId,
      deadlineHours: approvalSteps.deadlineHours,
    })
    .from(approvalSteps)
    .where(eq(approvalSteps.routeId, template.defaultRouteId))
    .orderBy(asc(approvalSteps.orderIndex))

  if (steps.length === 0) {
    return { success: false, error: 'The assigned route has no steps. Ask IT Admin to add approval steps.' }
  }

  // Resolve assignees for each step
  const assigneeMap: Map<string, string[]> = new Map()

  for (const step of steps) {
    const candidates = await db
      .select({ id: users.id, officeId: users.officeId })
      .from(users)
      .where(
        and(
          eq(users.roleId, step.approverRoleId),
          eq(users.isActive, true),
          isNull(users.deletedAt),
        ),
      )

    let filtered: string[]
    if (step.officeScope === 'creator_office') {
      filtered = candidates
        .filter((u) => u.officeId === profile.officeId)
        .map((u) => u.id)
    } else if (step.officeScope === 'specific_office' && step.officeId) {
      filtered = candidates
        .filter((u) => u.officeId === step.officeId)
        .map((u) => u.id)
    } else {
      filtered = candidates.map((u) => u.id)
    }

    if (filtered.length === 0) {
      const [roleRow] = await db.select({ name: roles.name }).from(roles).where(eq(roles.id, step.approverRoleId))
      return {
        success: false,
        error: `No active user found for step ${step.orderIndex} (${roleRow?.name ?? 'unknown role'}). Ask IT Admin to provision an account.`,
      }
    }

    assigneeMap.set(step.id, filtered)
  }

  // Write everything in sequence (Drizzle postgres.js doesn't expose tx natively here; sequential is safe enough for a capstone)
  const now = new Date()

  // Expire any previous pending approvals for this document (re-submission after return)
  await db
    .update(documentApprovals)
    .set({ status: 'rejected', actedAt: now, comment: 'Superseded by re-submission' })
    .where(
      and(
        eq(documentApprovals.documentId, documentId),
        eq(documentApprovals.status, 'pending'),
      ),
    )

  // Insert fresh approval rows
  for (const step of steps) {
    const assignees = assigneeMap.get(step.id) ?? []
    for (const assigneeId of assignees) {
      await db.insert(documentApprovals).values({
        documentId,
        stepId: step.id,
        assigneeId,
        status: 'pending',
      })
    }
  }

  // Flip document status
  const firstStep = steps[0]
  await db
    .update(documents)
    .set({
      currentStatus: 'in_review',
      routeId: template.defaultRouteId,
      currentStepId: firstStep.id,
      updatedAt: now,
    })
    .where(eq(documents.id, documentId))

  revalidatePath('/documents')
  revalidatePath(`/documents/${documentId}`)
  return { success: true }
}
