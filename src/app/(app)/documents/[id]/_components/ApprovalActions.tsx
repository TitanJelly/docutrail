'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
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

interface UserSignature {
  id: string
  type: string
  signedUrl: string
}

interface Props {
  approvalId: string
  userSignatures: UserSignature[]
}

export default function ApprovalActions({ approvalId, userSignatures }: Props) {
  const router = useRouter()
  const [approveOpen, setApproveOpen] = useState(false)
  const [returnOpen, setReturnOpen] = useState(false)
  const [comment, setComment] = useState('')
  const [selectedSigId, setSelectedSigId] = useState<string | null>(
    userSignatures[0]?.id ?? null,
  )
  const [loading, setLoading] = useState(false)

  async function handleApprove() {
    setLoading(true)
    const result = await approveAction({
      approvalId,
      comment: comment.trim() || undefined,
      signatureId: selectedSigId ?? undefined,
    })
    if (!result.success) {
      toast.error(result.error)
    } else {
      toast.success('Document approved')
      setApproveOpen(false)
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
      {/* Approve dialog */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogTrigger render={<Button disabled={loading}>Approve</Button>} />
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Approve Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Signature picker */}
            <div className="space-y-2">
              <Label>Signature</Label>
              {userSignatures.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {userSignatures.map((sig) => (
                    <button
                      key={sig.id}
                      type="button"
                      onClick={() => setSelectedSigId(sig.id)}
                      className={cn(
                        'rounded border p-1.5 text-left transition-colors bg-white',
                        selectedSigId === sig.id
                          ? 'border-primary ring-1 ring-primary'
                          : 'border-border hover:border-muted-foreground',
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={sig.signedUrl}
                        alt={sig.type}
                        className="h-10 w-full object-contain"
                      />
                      <p className="mt-1 text-center text-xs capitalize text-muted-foreground">
                        {sig.type}
                      </p>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSelectedSigId(null)}
                    className={cn(
                      'rounded border p-1.5 text-center text-xs text-muted-foreground transition-colors',
                      selectedSigId === null
                        ? 'border-primary ring-1 ring-primary'
                        : 'border-border hover:border-muted-foreground',
                    )}
                  >
                    No signature
                  </button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No signatures saved.{' '}
                  <Link href="/signatures" className="underline">
                    Add one
                  </Link>{' '}
                  first, or approve without a signature.
                </p>
              )}
            </div>

            {/* Optional comment */}
            <div className="space-y-1.5">
              <Label htmlFor="approve-comment">Comment (optional)</Label>
              <Textarea
                id="approve-comment"
                placeholder="Add a note…"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setApproveOpen(false)} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handleApprove} disabled={loading}>
                {loading ? 'Approving…' : 'Confirm Approval'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Return dialog */}
      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogTrigger render={<Button variant="outline" disabled={loading}>Return</Button>} />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="return-comment">Reason (required)</Label>
              <Textarea
                id="return-comment"
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
              <Button
                variant="destructive"
                onClick={handleReturn}
                disabled={loading || !comment.trim()}
              >
                {loading ? 'Returning…' : 'Return to Creator'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
