'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import type { JSONContent } from '@tiptap/core'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import Tiptap from '@/components/editor/Tiptap'
import { createDocumentAction, uploadDocumentAction } from '../../actions'
import Image from 'next/image'
import { FileUp, Upload } from 'lucide-react'

interface Template {
  id: string
  name: string
  type: string
  headerHtml: string | null
  footerHtml: string | null
}

interface Props {
  templates: Template[]
}

const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  templateId: z.string().uuid('Select a template'),
})
type FormValues = z.infer<typeof schema>

export default function NewDocumentForm({ templates }: Props) {
  const router = useRouter()
  const [content, setContent] = useState<JSONContent>({ type: 'doc', content: [] })
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const selectedTemplateId = watch('templateId')
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId)

  // ── Editor submit ────────────────────────────────────────────────────────────
  async function onEditorSubmit(values: FormValues) {
    const result = await createDocumentAction({
      title: values.title,
      templateId: values.templateId,
      content: content as Record<string, unknown>,
    })
    if (!result.success) {
      toast.error(result.error)
      return
    }
    toast.success('Draft saved')
    router.push('/documents')
  }

  // ── Upload submit ────────────────────────────────────────────────────────────
  async function onUploadSubmit(values: FormValues) {
    if (!uploadFile) {
      toast.error('Please select a PDF file')
      return
    }
    const formData = new FormData()
    formData.append('title', values.title)
    formData.append('templateId', values.templateId)
    formData.append('file', uploadFile)

    setUploading(true)
    const result = await uploadDocumentAction(formData)
    setUploading(false)

    if (!result.success) {
      toast.error(result.error)
      return
    }
    toast.success('Document uploaded')
    router.push(`/documents/${result.documentId}`)
  }

  // ── Shared header (title + template) ────────────────────────────────────────
  const sharedHeader = (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
      <div className="flex-1 space-y-1.5">
        <Label htmlFor="title">Document Title</Label>
        <Input id="title" placeholder="Enter document title" {...register('title')} />
        {errors.title && (
          <p className="text-sm text-destructive">{errors.title.message}</p>
        )}
      </div>

      <div className="w-full sm:w-64 space-y-1.5">
        <Label>Template</Label>
        <Controller
          control={control}
          name="templateId"
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value ?? ''}>
              <SelectTrigger>
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.templateId && (
          <p className="text-sm text-destructive">{errors.templateId.message}</p>
        )}
      </div>
    </div>
  )

  return (
    <Tabs defaultValue="editor" className="space-y-5">
      <TabsList>
        <TabsTrigger value="editor">Write with Editor</TabsTrigger>
        <TabsTrigger value="upload">Upload PDF</TabsTrigger>
      </TabsList>

      {/* ── Editor tab ──────────────────────────────────────────────────────── */}
      <TabsContent value="editor">
        <form onSubmit={handleSubmit(onEditorSubmit)} className="space-y-5">
          {sharedHeader}

          {selectedTemplate ? (
            <div className="rounded-md border bg-white shadow-sm overflow-hidden">
              <Image
                src="/ccs-header.png"
                alt="CCS Header"
                width={1200}
                height={123}
                className="w-full"
                priority
              />
              <div className="px-8 py-4">
                <Tiptap content={content} onChange={setContent} />
              </div>
              <Image
                src="/ccs-footer.png"
                alt="CCS Footer"
                width={1200}
                height={67}
                className="w-full"
              />
            </div>
          ) : (
            <div className="flex h-48 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
              Select a template above to start editing
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/documents')}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !selectedTemplate}>
              {isSubmitting ? 'Saving…' : 'Save Draft'}
            </Button>
          </div>
        </form>
      </TabsContent>

      {/* ── Upload tab ──────────────────────────────────────────────────────── */}
      <TabsContent value="upload">
        <form onSubmit={handleSubmit(onUploadSubmit)} className="space-y-5">
          {sharedHeader}

          <div className="space-y-1.5">
            <Label>PDF File</Label>
            <div
              className="flex h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed transition-colors hover:bg-muted/40"
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadFile ? (
                <>
                  <FileUp size={24} className="text-primary" />
                  <p className="text-sm font-medium">{uploadFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(uploadFile.size / 1024 / 1024).toFixed(2)} MB · click to change
                  </p>
                </>
              ) : (
                <>
                  <Upload size={24} className="text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Click to select a PDF (max 20 MB)</p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/documents')}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={uploading || !selectedTemplate || !uploadFile}
            >
              {uploading ? 'Uploading…' : 'Upload Document'}
            </Button>
          </div>
        </form>
      </TabsContent>
    </Tabs>
  )
}
