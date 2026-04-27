'use server'

import { eq, asc, and, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { chatMessages, documents, documentApprovals, users } from '@/lib/db/schema'
import { getCurrentUserProfile } from '@/lib/user'

const READ_ALL_ROLES = ['it_admin', 'dean', 'exec_director', 'dept_chair'] as const

async function canAccessDocument(documentId: string, userId: string, userRole: string) {
  const [doc] = await db
    .select({ creatorId: documents.creatorId })
    .from(documents)
    .where(and(eq(documents.id, documentId), isNull(documents.deletedAt)))

  if (!doc) return false
  if (doc.creatorId === userId) return true
  if (READ_ALL_ROLES.includes(userRole as (typeof READ_ALL_ROLES)[number])) return true

  const [assignment] = await db
    .select({ id: documentApprovals.id })
    .from(documentApprovals)
    .where(
      and(eq(documentApprovals.documentId, documentId), eq(documentApprovals.assigneeId, userId)),
    )
    .limit(1)

  return !!assignment
}

export type ChatMessage = {
  id: string
  body: string
  createdAt: Date
  senderId: string
  senderName: string | null
  recipientId: string | null
}

export async function getChatMessagesAction(documentId: string): Promise<ChatMessage[]> {
  const profile = await getCurrentUserProfile()
  if (!profile) return []

  const allowed = await canAccessDocument(documentId, profile.id, profile.role)
  if (!allowed) return []

  return db
    .select({
      id: chatMessages.id,
      body: chatMessages.body,
      createdAt: chatMessages.createdAt,
      senderId: chatMessages.senderId,
      senderName: users.fullName,
      recipientId: chatMessages.recipientId,
    })
    .from(chatMessages)
    .leftJoin(users, eq(chatMessages.senderId, users.id))
    .where(eq(chatMessages.documentId, documentId))
    .orderBy(asc(chatMessages.createdAt))
    .limit(100)
}

export async function sendChatMessageAction(data: {
  documentId: string
  body: string
}): Promise<{ success: true } | { success: false; error: string }> {
  const profile = await getCurrentUserProfile()
  if (!profile) return { success: false, error: 'Unauthorized' }

  if (!data.body.trim()) return { success: false, error: 'Message cannot be empty' }

  const allowed = await canAccessDocument(data.documentId, profile.id, profile.role)
  if (!allowed) return { success: false, error: 'Unauthorized' }

  await db.insert(chatMessages).values({
    documentId: data.documentId,
    senderId: profile.id,
    body: data.body.trim(),
  })

  return { success: true }
}
