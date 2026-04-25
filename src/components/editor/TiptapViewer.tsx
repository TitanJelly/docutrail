'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import type { JSONContent } from '@tiptap/core'

export default function TiptapViewer({ content }: { content: JSONContent }) {
  const editor = useEditor({
    extensions: [StarterKit],
    content,
    editable: false,
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
  })

  return (
    <EditorContent
      editor={editor}
      className="prose prose-sm max-w-none px-8 py-4 dark:prose-invert"
    />
  )
}
