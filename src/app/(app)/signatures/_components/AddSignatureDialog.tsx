'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import SignaturePad from '@/components/signature/SignaturePad'
import { createSignatureAction } from '../actions'

export default function AddSignatureDialog() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleCapture(dataBase64: string, type: 'drawn' | 'typed' | 'image', mimeType: string) {
    setLoading(true)
    const result = await createSignatureAction({ type, dataBase64, mimeType })
    if (!result.success) {
      toast.error(result.error)
    } else {
      toast.success('Signature saved')
      setOpen(false)
    }
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">Add Signature</Button>} />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Signature</DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="py-4 text-sm text-muted-foreground text-center">Saving…</p>
        ) : (
          <SignaturePad onCapture={handleCapture} />
        )}
      </DialogContent>
    </Dialog>
  )
}
