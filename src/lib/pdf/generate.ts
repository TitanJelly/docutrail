// Renders a Tiptap JSON document to PDF with CCS header/footer.
// Implemented in Phase 4.

export async function generateDocumentPdf(_args: {
  title: string
  contentJson: unknown
  templateHeaderHtml: string
  templateFooterHtml: string
}): Promise<Uint8Array> {
  throw new Error('generateDocumentPdf is not implemented yet (Phase 4).')
}
