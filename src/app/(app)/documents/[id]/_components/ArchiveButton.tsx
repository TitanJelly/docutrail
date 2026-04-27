'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Archive } from 'lucide-react'
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
import { archiveDocumentAction } from '../../actions'

export default function ArchiveButton({ documentId }: { documentId: string }) {
  const router = useRouter()
  const [archiving, setArchiving] = useState(false)

  async function handleArchive() {
    setArchiving(true)
    const result = await archiveDocumentAction(documentId)
    setArchiving(false)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    toast.success('Document archived')
    router.refresh()
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger render={
        <Button variant="outline" size="sm" className="gap-1.5" disabled={archiving}>
          <Archive size={13} />
          Archive
        </Button>
      } />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive this document?</AlertDialogTitle>
          <AlertDialogDescription>
            The document will be marked as archived. It will remain viewable but cannot be edited or re-submitted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleArchive}>Archive</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
