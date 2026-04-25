'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { JSONContent } from '@tiptap/core'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import Tiptap from '@/components/editor/Tiptap'
import { updateDocumentAction } from '../../../actions'

interface Props {
  documentId: string
  initialContent: JSONContent
}

export default function EditDocumentForm({ documentId, initialContent }: Props) {
  const router = useRouter()
  const [content, setContent] = useState<JSONContent>(initialContent)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const result = await updateDocumentAction({
      documentId,
      content: content as Record<string, unknown>,
    })
    if (!result.success) {
      toast.error(result.error)
    } else {
      toast.success('Document saved')
      router.push(`/documents/${documentId}`)
    }
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-white shadow-sm overflow-hidden">
        <Image
          src="/ccs-header.png"
          alt="CCS Header"
          width={1200}
          height={123}
          className="w-full"
          priority
        />
        <div className="px-8 py-4">
          <Tiptap content={content} onChange={setContent} />
        </div>
        <Image
          src="/ccs-footer.png"
          alt="CCS Footer"
          width={1200}
          height={67}
          className="w-full"
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => router.push(`/documents/${documentId}`)}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}
