import { redirect } from 'next/navigation'
import { eq, desc } from 'drizzle-orm'
import { getCurrentUserProfile } from '@/lib/user'
import { db } from '@/lib/db'
import { signatures } from '@/lib/db/schema'
import { createAdminClient } from '@/lib/supabase/admin'
import { Badge } from '@/components/ui/badge'
import AddSignatureDialog from './_components/AddSignatureDialog'
import DeleteSignatureButton from './_components/DeleteSignatureButton'

export const metadata = { title: 'My Signatures — DocuTrail' }

export default async function SignaturesPage() {
  const profile = await getCurrentUserProfile()
  if (!profile) redirect('/login')

  const rows = await db
    .select({
      id: signatures.id,
      type: signatures.type,
      dataPath: signatures.dataPath,
      createdAt: signatures.createdAt,
    })
    .from(signatures)
    .where(eq(signatures.userId, profile.id))
    .orderBy(desc(signatures.createdAt))

  const supabase = createAdminClient()
  const sigsWithUrls = await Promise.all(
    rows.map(async (sig) => {
      const { data } = await supabase.storage
        .from('signatures')
        .createSignedUrl(sig.dataPath, 3600)
      return { ...sig, signedUrl: data?.signedUrl ?? '' }
    }),
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">My Signatures</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Saved signatures are stamped onto PDFs when you approve a document.
          </p>
        </div>
        <AddSignatureDialog />
      </div>

      {sigsWithUrls.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          No signatures yet. Add one to start approving documents with your signature.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sigsWithUrls.map((sig) => (
            <div key={sig.id} className="rounded-lg border bg-card p-3 space-y-2">
              <div className="bg-white rounded border flex items-center justify-center h-20 overflow-hidden">
                {sig.signedUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={sig.signedUrl}
                    alt={`${sig.type} signature`}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">Preview unavailable</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Badge variant="secondary" className="capitalize text-xs">
                    {sig.type}
                  </Badge>
                  <p className="text-xs text-muted-foreground">
                    {new Date(sig.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <DeleteSignatureButton id={sig.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
