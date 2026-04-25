import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { eq, and, isNull, desc } from 'drizzle-orm'
import { getCurrentUserProfile } from '@/lib/user'
import { db } from '@/lib/db'
import { documents, documentVersions } from '@/lib/db/schema'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import type { JSONContent } from '@tiptap/core'
import EditDocumentForm from './_components/EditDocumentForm'

export const metadata = { title: 'Edit Document — DocuTrail' }

export default async function EditDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentUserProfile()
  if (!profile) redirect('/login')

  const { id } = await params

  const [doc] = await db
    .select({ id: documents.id, title: documents.title, currentStatus: documents.currentStatus, creatorId: documents.creatorId })
    .from(documents)
    .where(and(eq(documents.id, id), isNull(documents.deletedAt)))

  if (!doc) notFound()
  if (doc.creatorId !== profile.id) redirect(`/documents/${id}`)
  if (doc.currentStatus !== 'draft' && doc.currentStatus !== 'returned') redirect(`/documents/${id}`)

  const [latestVersion] = await db
    .select({ content: documentVersions.content })
    .from(documentVersions)
    .where(eq(documentVersions.documentId, id))
    .orderBy(desc(documentVersions.versionNo))
    .limit(1)

  const content = (latestVersion?.content ?? { type: 'doc', content: [] }) as JSONContent

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href={`/documents/${id}`}>
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft size={14} />
            Back
          </Button>
        </Link>
        <h1 className="text-2xl font-semibold">Edit — {doc.title}</h1>
      </div>

      <EditDocumentForm documentId={id} initialContent={content} />
    </div>
  )
}
