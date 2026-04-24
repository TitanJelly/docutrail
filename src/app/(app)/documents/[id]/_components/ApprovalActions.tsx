'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { approveAction, returnDocumentAction } from '../../../approvals/actions'

interface Props {
  approvalId: string
}

export default function ApprovalActions({ approvalId }: Props) {
  const router = useRouter()
  const [returnOpen, setReturnOpen] = useState(false)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleApprove() {
    setLoading(true)
    const result = await approveAction({ approvalId })
    if (!result.success) {
      toast.error(result.error)
    } else {
      toast.success('Document approved')
      router.refresh()
    }
    setLoading(false)
  }

  async function handleReturn() {
    if (!comment.trim()) {
      toast.error('Please provide a reason for returning the document')
      return
    }
    setLoading(true)
    const result = await returnDocumentAction({ approvalId, comment })
    if (!result.success) {
      toast.error(result.error)
    } else {
      toast.success('Document returned to creator')
      setReturnOpen(false)
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="flex gap-2">
      <Button onClick={handleApprove} disabled={loading}>
        Approve
      </Button>

      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogTrigger render={<Button variant="outline" disabled={loading}>Return</Button>} />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="comment">Reason (required)</Label>
              <Textarea
                id="comment"
                placeholder="Explain what needs to be revised…"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setReturnOpen(false)} disabled={loading}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleReturn} disabled={loading || !comment.trim()}>
                {loading ? 'Returning…' : 'Return to Creator'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
