'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send } from 'lucide-react'
import { getChatMessagesAction, sendChatMessageAction } from '@/lib/chat-actions'
import type { ChatMessage } from '@/lib/chat-actions'

interface Props {
  documentId: string
  currentUserId: string
  initialMessages: ChatMessage[]
}

export default function DocumentChat({ documentId, currentUserId, initialMessages }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel(`chat:${documentId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `document_id=eq.${documentId}`,
        },
        async () => {
          const fresh = await getChatMessagesAction(documentId)
          setMessages(fresh)
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [documentId, supabase])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    const trimmed = body.trim()
    if (!trimmed) return
    setSending(true)
    const result = await sendChatMessageAction({ documentId, body: trimmed })
    if (!result.success) {
      toast.error(result.error)
    } else {
      setBody('')
    }
    setSending(false)
  }

  return (
    <div className="flex flex-col" style={{ height: '320px' }}>
      <div className="flex-1 overflow-y-auto space-y-3 p-3">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">
            No messages yet. Start the conversation.
          </p>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.senderId === currentUserId
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
              >
                <span className="text-xs text-muted-foreground mb-0.5">
                  {isOwn ? 'You' : (msg.senderName ?? 'Unknown')}
                </span>
                <div
                  className={`max-w-[78%] rounded-lg px-3 py-1.5 text-sm whitespace-pre-wrap break-words ${
                    isOwn
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  {msg.body}
                </div>
                <span className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date(msg.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t p-2 flex gap-2 items-end">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
          className="min-h-[36px] max-h-24 resize-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
        />
        <Button
          size="sm"
          onClick={handleSend}
          disabled={sending || !body.trim()}
          className="shrink-0"
        >
          <Send size={14} />
        </Button>
      </div>
    </div>
  )
}
