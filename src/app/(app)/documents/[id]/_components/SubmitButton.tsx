'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { submitDocumentAction } from '../../actions'

export default function SubmitButton({ documentId }: { documentId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setLoading(true)
    const result = await submitDocumentAction(documentId)
    if (!result.success) {
      toast.error(result.error)
    } else {
      toast.success('Document submitted for review')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <Button onClick={handleSubmit} disabled={loading}>
      {loading ? 'Submitting…' : 'Submit for Review'}
    </Button>
  )
}
