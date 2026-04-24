'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { documents, documentVersions } from '@/lib/db/schema'
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
