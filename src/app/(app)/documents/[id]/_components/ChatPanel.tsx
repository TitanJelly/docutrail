'use client'

import { useState } from 'react'
import { MessageSquare, ChevronDown, ChevronUp } from 'lucide-react'
import DocumentChat from '@/components/chat/DocumentChat'
import type { ChatMessage } from '@/lib/chat-actions'

interface Props {
  documentId: string
  currentUserId: string
  initialMessages: ChatMessage[]
}

export default function ChatPanel({ documentId, currentUserId, initialMessages }: Props) {
  const [open, setOpen] = useState(true)

  return (
    <section className="rounded-md border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/40 transition-colors rounded-t-md"
      >
        <div className="flex items-center gap-2">
          <MessageSquare size={15} />
          Document Chat
        </div>
        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>

      {open && (
        <DocumentChat
          documentId={documentId}
          currentUserId={currentUserId}
          initialMessages={initialMessages}
        />
      )}
    </section>
  )
}
