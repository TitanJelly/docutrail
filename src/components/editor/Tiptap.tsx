'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import type { JSONContent } from '@tiptap/core'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import {
  Bold, Italic, Strikethrough,
  Heading1, Heading2, Heading3,
  List, ListOrdered, Quote,
  Undo, Redo,
} from 'lucide-react'

interface TiptapProps {
  content?: JSONContent
  onChange?: (content: JSONContent) => void
  editable?: boolean
  className?: string
}

interface ToolbarBtnProps {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}

function ToolbarBtn({ onClick, active, disabled, title, children }: ToolbarBtnProps) {
  return (
    <Button
      type="button"
      variant={active ? 'secondary' : 'ghost'}
      size="icon"
      className="h-7 w-7"
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </Button>
  )
}

export default function Tiptap({ content, onChange, editable = true, className }: TiptapProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: content ?? '',
    editable,
    shouldRerenderOnTransaction: true,
    onUpdate({ editor }) {
      onChange?.(editor.getJSON())
    },
  })

  if (!editor) return null

  return (
    <div className={cn('flex flex-col rounded-md border overflow-hidden', className)}>
      {editable && (
        <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/40 px-1.5 py-1">
          <ToolbarBtn
            title="Bold"
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold size={13} />
          </ToolbarBtn>
          <ToolbarBtn
            title="Italic"
            active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic size={13} />
          </ToolbarBtn>
          <ToolbarBtn
            title="Strikethrough"
            active={editor.isActive('strike')}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          >
            <Strikethrough size={13} />
          </ToolbarBtn>

          <Separator orientation="vertical" className="mx-1 h-5" />

          <ToolbarBtn
            title="Heading 1"
            active={editor.isActive('heading', { level: 1 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          >
            <Heading1 size={13} />
          </ToolbarBtn>
          <ToolbarBtn
            title="Heading 2"
            active={editor.isActive('heading', { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            <Heading2 size={13} />
          </ToolbarBtn>
          <ToolbarBtn
            title="Heading 3"
            active={editor.isActive('heading', { level: 3 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          >
            <Heading3 size={13} />
          </ToolbarBtn>

          <Separator orientation="vertical" className="mx-1 h-5" />

          <ToolbarBtn
            title="Bullet list"
            active={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List size={13} />
          </ToolbarBtn>
          <ToolbarBtn
            title="Ordered list"
            active={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered size={13} />
          </ToolbarBtn>
          <ToolbarBtn
            title="Blockquote"
            active={editor.isActive('blockquote')}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          >
            <Quote size={13} />
          </ToolbarBtn>

          <Separator orientation="vertical" className="mx-1 h-5" />

          <ToolbarBtn
            title="Undo"
            disabled={!editor.can().undo()}
            onClick={() => editor.chain().focus().undo().run()}
          >
            <Undo size={13} />
          </ToolbarBtn>
          <ToolbarBtn
            title="Redo"
            disabled={!editor.can().redo()}
            onClick={() => editor.chain().focus().redo().run()}
          >
            <Redo size={13} />
          </ToolbarBtn>
        </div>
      )}

      <EditorContent
        editor={editor}
        className="tiptap-content cursor-text px-4 py-3 text-sm"
      />
    </div>
  )
}
