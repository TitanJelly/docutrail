'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import { deleteSignatureAction } from '../actions'

export default function DeleteSignatureButton({ id }: { id: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    const result = await deleteSignatureAction(id)
    if (!result.success) {
      toast.error(result.error)
    } else {
      toast.success('Signature deleted')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="text-muted-foreground hover:text-destructive"
      onClick={handleDelete}
      disabled={loading}
    >
      <Trash2 size={14} />
    </Button>
  )
}
