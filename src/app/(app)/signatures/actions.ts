'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { signatures } from '@/lib/db/schema'
import { getCurrentUserProfile } from '@/lib/user'
import { createAdminClient } from '@/lib/supabase/admin'

const createSchema = z.object({
  type: z.enum(['drawn', 'typed', 'image']),
  dataBase64: z.string().min(1, 'Signature data is required'),
  mimeType: z.string().default('image/png'),
})

export async function createSignatureAction(data: {
  type: 'drawn' | 'typed' | 'image'
  dataBase64: string
  mimeType?: string
}): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const profile = await getCurrentUserProfile()
  if (!profile) return { success: false, error: 'Unauthorized' }

  const parsed = createSchema.safeParse(data)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

  const { type, dataBase64, mimeType } = parsed.data
  const buffer = Buffer.from(dataBase64, 'base64')
  const ext = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png'

  const [sig] = await db
    .insert(signatures)
    .values({ userId: profile.id, type, dataPath: '_placeholder' })
    .returning({ id: signatures.id })

  const storagePath = `${profile.id}/${sig.id}.${ext}`
  const supabase = createAdminClient()

  const { error: uploadError } = await supabase.storage
    .from('signatures')
    .upload(storagePath, buffer, { contentType: mimeType, upsert: false })

  if (uploadError) {
    await db.delete(signatures).where(eq(signatures.id, sig.id))
    return { success: false, error: `Upload failed: ${uploadError.message}` }
  }

  await db.update(signatures).set({ dataPath: storagePath }).where(eq(signatures.id, sig.id))
  revalidatePath('/signatures')
  return { success: true, id: sig.id }
}

export async function deleteSignatureAction(
  id: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const profile = await getCurrentUserProfile()
  if (!profile) return { success: false, error: 'Unauthorized' }

  const [sig] = await db
    .select({ userId: signatures.userId, dataPath: signatures.dataPath })
    .from(signatures)
    .where(and(eq(signatures.id, id), eq(signatures.userId, profile.id)))

  if (!sig) return { success: false, error: 'Signature not found' }

  const supabase = createAdminClient()
  await supabase.storage.from('signatures').remove([sig.dataPath])
  await db.delete(signatures).where(eq(signatures.id, id))

  revalidatePath('/signatures')
  return { success: true }
}
