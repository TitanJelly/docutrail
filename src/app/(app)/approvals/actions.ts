'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { eq, and, asc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { documentApprovals, documents, approvalSteps } from '@/lib/db/schema'
import { getCurrentUserProfile } from '@/lib/user'

type ActionResult = { success: true } | { success: false; error: string }

const actSchema = z.object({
  approvalId: z.string().uuid(),
  comment: z.string().optional(),
})

export async function approveAction(data: z.infer<typeof actSchema>): Promise<ActionResult> {
  const profile = await getCurrentUserProfile()
  if (!profile) return { success: false, error: 'Unauthorized' }

  const parsed = actSchema.safeParse(data)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

  const { approvalId, comment } = parsed.data

  // Verify the current user is the assignee and the row is pending
  const [approval] = await db
    .select()
    .from(documentApprovals)
    .where(
      and(
        eq(documentApprovals.id, approvalId),
        eq(documentApprovals.assigneeId, profile.id),
        eq(documentApprovals.status, 'pending'),
      ),
    )

  if (!approval) return { success: false, error: 'Approval not found or not actionable' }

  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, approval.documentId))

  if (!doc || doc.currentStepId !== approval.stepId) {
    return { success: false, error: 'This step is not the current active step' }
  }

  const now = new Date()

  // Mark approval row as approved
  await db
    .update(documentApprovals)
    .set({ status: 'approved', actedAt: now, comment: comment ?? null })
    .where(eq(documentApprovals.id, approvalId))

  // Find the next step in the route
  const [currentStep] = await db
    .select({ orderIndex: approvalSteps.orderIndex, routeId: approvalSteps.routeId })
    .from(approvalSteps)
    .where(eq(approvalSteps.id, approval.stepId))

  if (!currentStep) return { success: false, error: 'Step not found' }

  const nextSteps = await db
    .select({ id: approvalSteps.id, orderIndex: approvalSteps.orderIndex })
    .from(approvalSteps)
    .where(eq(approvalSteps.routeId, currentStep.routeId))
    .orderBy(asc(approvalSteps.orderIndex))

  const nextStep = nextSteps.find((s) => s.orderIndex > currentStep.orderIndex)

  if (nextStep) {
    // Advance to next step
    await db
      .update(documents)
      .set({ currentStepId: nextStep.id, updatedAt: now })
      .where(eq(documents.id, approval.documentId))
  } else {
    // All steps done → fully approved
    await db
      .update(documents)
      .set({ currentStatus: 'approved', currentStepId: null, updatedAt: now })
      .where(eq(documents.id, approval.documentId))
  }

  revalidatePath('/approvals')
  revalidatePath(`/documents/${approval.documentId}`)
  revalidatePath('/documents')
  return { success: true }
}

export async function returnDocumentAction(data: z.infer<typeof actSchema>): Promise<ActionResult> {
  const profile = await getCurrentUserProfile()
  if (!profile) return { success: false, error: 'Unauthorized' }

  const parsed = actSchema.safeParse(data)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

  const { approvalId, comment } = parsed.data

  const [approval] = await db
    .select()
    .from(documentApprovals)
    .where(
      and(
        eq(documentApprovals.id, approvalId),
        eq(documentApprovals.assigneeId, profile.id),
        eq(documentApprovals.status, 'pending'),
      ),
    )

  if (!approval) return { success: false, error: 'Approval not found or not actionable' }

  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, approval.documentId))

  if (!doc || doc.currentStepId !== approval.stepId) {
    return { success: false, error: 'This step is not the current active step' }
  }

  const now = new Date()

  await db
    .update(documentApprovals)
    .set({ status: 'rejected', actedAt: now, comment: comment ?? null })
    .where(eq(documentApprovals.id, approvalId))

  await db
    .update(documents)
    .set({ currentStatus: 'returned', currentStepId: null, updatedAt: now })
    .where(eq(documents.id, approval.documentId))

  revalidatePath('/approvals')
  revalidatePath(`/documents/${approval.documentId}`)
  revalidatePath('/documents')
  return { success: true }
}
