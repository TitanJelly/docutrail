import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import * as fs from 'fs'
import * as path from 'path'
import type { JSONContent } from '@tiptap/core'
import { CCSDocument } from './CCSDocument'

export async function generateDocumentPdf(args: {
  title: string
  contentJson: unknown
}): Promise<Uint8Array> {
  const headerPath = path.join(process.cwd(), 'public', 'ccs-header.png')
  const footerPath = path.join(process.cwd(), 'public', 'ccs-footer.png')
  const headerBase64 = fs.readFileSync(headerPath).toString('base64')
  const footerBase64 = fs.readFileSync(footerPath).toString('base64')

  const element = React.createElement(CCSDocument, {
    title: args.title,
    contentJson: args.contentJson as JSONContent,
    headerBase64,
    footerBase64,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(element as any)
  return new Uint8Array(buffer)
}
