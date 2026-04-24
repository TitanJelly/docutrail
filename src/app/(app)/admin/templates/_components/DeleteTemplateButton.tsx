'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { deleteTemplateAction } from '../actions'

interface Props {
  id: string
  name: string
}

export default function DeleteTemplateButton({ id, name }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    const result = await deleteTemplateAction(id)
    setLoading(false)
    if (!result.success) {
      toast.error(result.error)
    } else {
      toast.success('Template deleted')
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
            <Trash2 size={14} />
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete template?</AlertDialogTitle>
          <AlertDialogDescription>
            &ldquo;{name}&rdquo; will be soft-deleted. Existing documents using this template are
            not affected.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={loading}>
            {loading ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
