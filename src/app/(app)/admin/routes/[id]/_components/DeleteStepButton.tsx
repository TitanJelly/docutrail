'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { deleteStepAction } from '../../actions'

export default function DeleteStepButton({ id }: { id: string }) {
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    const result = await deleteStepAction(id)
    if (!result.success) toast.error(result.error)
    else toast.success('Step removed')
    setLoading(false)
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 text-muted-foreground hover:text-destructive"
      onClick={handleDelete}
      disabled={loading}
    >
      <Trash2 size={14} />
    </Button>
  )
}
