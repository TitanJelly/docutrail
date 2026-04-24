import { redirect } from 'next/navigation'
import { isNull } from 'drizzle-orm'
import { getCurrentUserProfile } from '@/lib/user'
import { db } from '@/lib/db'
import { documentTemplates } from '@/lib/db/schema'
import NewDocumentForm from './_components/NewDocumentForm'

export const metadata = { title: 'New Document — DocuTrail' }

export default async function NewDocumentPage() {
  const profile = await getCurrentUserProfile()
  if (!profile) redirect('/login')

  const templates = await db
    .select({
      id: documentTemplates.id,
      name: documentTemplates.name,
      type: documentTemplates.type,
      headerHtml: documentTemplates.headerHtml,
      footerHtml: documentTemplates.footerHtml,
    })
    .from(documentTemplates)
    .where(isNull(documentTemplates.deletedAt))
    .orderBy(documentTemplates.name)

  if (templates.length === 0) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">New Document</h1>
        <p className="text-muted-foreground text-sm">
          No templates available. Ask your IT Admin to create at least one template before
          you can create a document.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">New Document</h1>
      <NewDocumentForm templates={templates} />
    </div>
  )
}
