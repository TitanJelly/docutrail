'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { eq, and, asc, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  documentApprovals,
  documents,
  approvalSteps,
  documentVersions,
  signatures,
} from '@/lib/db/schema'
import { getCurrentUserProfile } from '@/lib/user'
import { createAdminClient } from '@/lib/supabase/admin'

type ActionResult = { success: true } | { success: false; error: string }

const actSchema = z.object({
  approvalId: z.string().uuid(),
  comment: z.string().optional(),
  signatureId: z.string().uuid().optional(),
})

export async function approveAction(
  data: z.infer<typeof actSchema>,
): Promise<ActionResult> {
  const profile = await getCurrentUserProfile()
  if (!profile) return { success: false, error: 'Unauthorized' }

  const parsed = actSchema.safeParse(data)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

  const { approvalId, comment, signatureId } = parsed.data

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

  // Mark this approval row done (include signatureId so we can trace who signed)
  await db
    .update(documentApprovals)
    .set({
      status: 'approved',
      actedAt: now,
      comment: comment ?? null,
      signatureId: signatureId ?? null,
    })
    .where(eq(documentApprovals.id, approvalId))

  // Stamp signature onto the PDF (best-effort — advance even if stamp fails)
  if (signatureId) {
    try {
      const [currentStep] = await db
        .select({ orderIndex: approvalSteps.orderIndex })
        .from(approvalSteps)
        .where(eq(approvalSteps.id, approval.stepId))

      const [latestVer] = await db
        .select({ generatedPdfPath: documentVersions.generatedPdfPath })
        .from(documentVersions)
        .where(eq(documentVersions.documentId, approval.documentId))
        .orderBy(desc(documentVersions.versionNo))
        .limit(1)

      const pdfPath = latestVer?.generatedPdfPath

      if (currentStep && pdfPath) {
        const [sig] = await db
          .select({ dataPath: signatures.dataPath })
          .from(signatures)
          .where(eq(signatures.id, signatureId))

        if (sig?.dataPath) {
          const supabase = createAdminClient()

          const { data: pdfBlob } = await supabase.storage
            .from('documents')
            .download(pdfPath)
          const { data: sigBlob } = await supabase.storage
            .from('signatures')
            .download(sig.dataPath)

          if (pdfBlob && sigBlob) {
            const pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer())
            const sigBytes = new Uint8Array(await sigBlob.arrayBuffer())

            // Signatures are stamped near the bottom of the last page.
            // Each step gets its own horizontal slot (130pt apart, 110pt wide).
            const orderIndex = currentStep.orderIndex
            const x = 30 + (orderIndex - 1) * 130
            const y = 38  // 38pt from bottom — just above the CCS footer banner
            const { stampSignatureOnPdf } = await import('@/lib/pdf/stampSignature')

            const stamped = await stampSignatureOnPdf({
              pdfBytes,
              signatureBytes: sigBytes,
              page: -1,
              x,
              y,
              width: 110,
              height: 40,
            })

            await supabase.storage.from('documents').upload(pdfPath, stamped, {
              contentType: 'application/pdf',
              upsert: true,
            })
          }
        }
      }
    } catch (stampErr) {
      console.error('[PDF] signature stamp failed (non-fatal):', stampErr)
    }
  }

  // Determine next step
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
    await db
      .update(documents)
      .set({ currentStepId: nextStep.id, updatedAt: now })
      .where(eq(documents.id, approval.documentId))
  } else {
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
