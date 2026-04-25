'use client'

import { useRef, useState } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface Props {
  onCapture: (dataBase64: string, type: 'drawn' | 'typed' | 'image', mimeType: string) => void
}

export default function SignaturePad({ onCapture }: Props) {
  const canvasRef = useRef<SignatureCanvas>(null)
  const [typedName, setTypedName] = useState('')

  function captureDrawn() {
    const canvas = canvasRef.current
    if (!canvas || canvas.isEmpty()) return
    const dataUrl = canvas.toDataURL('image/png')
    onCapture(dataUrl.split(',')[1], 'drawn', 'image/png')
  }

  function captureTyped() {
    if (!typedName.trim()) return
    const offscreen = document.createElement('canvas')
    offscreen.width = 400
    offscreen.height = 100
    const ctx = offscreen.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, 400, 100)
    ctx.fillStyle = '#1a1a2e'
    ctx.font = 'italic 38px Georgia, serif'
    ctx.textBaseline = 'middle'
    ctx.fillText(typedName.trim().slice(0, 28), 10, 50)
    const dataUrl = offscreen.toDataURL('image/png')
    onCapture(dataUrl.split(',')[1], 'typed', 'image/png')
  }

  function captureImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      onCapture(result.split(',')[1], 'image', file.type || 'image/png')
    }
    reader.readAsDataURL(file)
  }

  return (
    <Tabs defaultValue="drawn">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="drawn">Draw</TabsTrigger>
        <TabsTrigger value="typed">Type</TabsTrigger>
        <TabsTrigger value="image">Upload</TabsTrigger>
      </TabsList>

      <TabsContent value="drawn" className="space-y-2">
        <div className="rounded-md border overflow-hidden bg-white">
          <SignatureCanvas
            ref={canvasRef}
            penColor="#1a1a2e"
            canvasProps={{ width: 400, height: 120, className: 'block' }}
          />
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => canvasRef.current?.clear()}>
            Clear
          </Button>
          <Button size="sm" onClick={captureDrawn}>
            Use this signature
          </Button>
        </div>
      </TabsContent>

      <TabsContent value="typed" className="space-y-2">
        <Input
          placeholder="Type your full name"
          value={typedName}
          onChange={(e) => setTypedName(e.target.value)}
          className="font-serif italic text-lg"
        />
        <Button size="sm" onClick={captureTyped} disabled={!typedName.trim()}>
          Use this signature
        </Button>
      </TabsContent>

      <TabsContent value="image" className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Upload a PNG or JPEG of your handwritten signature.
        </p>
        <Input type="file" accept="image/png,image/jpeg" onChange={captureImage} />
      </TabsContent>
    </Tabs>
  )
}
