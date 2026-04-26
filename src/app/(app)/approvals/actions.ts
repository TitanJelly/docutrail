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

  // ── 1. Load & verify the approval row ───────────────────────────────────────
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

  // ── 2. Fetch step info (needed for stamp position and next-step logic) ───────
  const [currentStep] = await db
    .select({ orderIndex: approvalSteps.orderIndex, routeId: approvalSteps.routeId })
    .from(approvalSteps)
    .where(eq(approvalSteps.id, approval.stepId))

  if (!currentStep) return { success: false, error: 'Step not found' }

  // ── 3. Fetch latest version (L10: record which snapshot was approved) ────────
  const [latestVer] = await db
    .select({ id: documentVersions.id, generatedPdfPath: documentVersions.generatedPdfPath })
    .from(documentVersions)
    .where(eq(documentVersions.documentId, approval.documentId))
    .orderBy(desc(documentVersions.versionNo))
    .limit(1)

  // ── 4. Stamp signature BEFORE any DB write (L5: fatal on failure) ────────────
  // The approval is not written to the DB until the stamp succeeds.
  // If stamping fails, the function returns an error and the approval stays pending.
  if (signatureId) {
    const [sig] = await db
      .select({ dataPath: signatures.dataPath })
      .from(signatures)
      .where(eq(signatures.id, signatureId))

    if (!sig?.dataPath) return { success: false, error: 'Signature not found' }

    const pdfPath = latestVer?.generatedPdfPath
    if (!pdfPath) {
      return {
        success: false,
        error: 'No PDF found for this document. Re-submit the document to regenerate it.',
      }
    }

    const supabase = createAdminClient()

    const { data: pdfBlob, error: pdfErr } = await supabase.storage
      .from('documents')
      .download(pdfPath)
    if (pdfErr || !pdfBlob) {
      return {
        success: false,
        error: `Could not load PDF for stamping: ${pdfErr?.message ?? 'unknown error'}`,
      }
    }

    const { data: sigBlob, error: sigErr } = await supabase.storage
      .from('signatures')
      .download(sig.dataPath)
    if (sigErr || !sigBlob) {
      return {
        success: false,
        error: `Could not load signature image: ${sigErr?.message ?? 'unknown error'}`,
      }
    }

    const pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer())
    const sigBytes = new Uint8Array(await sigBlob.arrayBuffer())

    // Each step's signature occupies its own 130pt-wide horizontal slot
    const x = 30 + (currentStep.orderIndex - 1) * 130
    const y = 38 // 38pt from bottom — just above the CCS footer banner

    let stamped: Uint8Array
    try {
      const { stampSignatureOnPdf } = await import('@/lib/pdf/stampSignature')
      stamped = await stampSignatureOnPdf({
        pdfBytes,
        signatureBytes: sigBytes,
        page: -1,
        x,
        y,
        width: 110,
        height: 40,
      })
    } catch (stampErr) {
      return {
        success: false,
        error: `Signature stamping failed: ${stampErr instanceof Error ? stampErr.message : 'unknown error'}`,
      }
    }

    const { error: uploadErr } = await supabase.storage
      .from('documents')
      .upload(pdfPath, stamped, { contentType: 'application/pdf', upsert: true })
    if (uploadErr) {
      return { success: false, error: `Failed to upload stamped PDF: ${uploadErr.message}` }
    }
  }

  // ── 5. DB writes — only reached after stamp succeeds (or no signature) ───────
  const now = new Date()

  await db
    .update(documentApprovals)
    .set({
      status: 'approved',
      actedAt: now,
      comment: comment ?? null,
      signatureId: signatureId ?? null,
      approvedVersionId: latestVer?.id ?? null, // L10
    })
    .where(eq(documentApprovals.id, approvalId))

  // ── 6. Advance document to next step or mark fully approved ─────────────────
  const allSteps = await db
    .select({ id: approvalSteps.id, orderIndex: approvalSteps.orderIndex })
    .from(approvalSteps)
    .where(eq(approvalSteps.routeId, currentStep.routeId))
    .orderBy(asc(approvalSteps.orderIndex))

  const nextStep = allSteps.find((s) => s.orderIndex > currentStep.orderIndex)

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
