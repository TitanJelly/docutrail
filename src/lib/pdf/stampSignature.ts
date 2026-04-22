// Stamps a signature image onto an existing PDF at the step's configured position.
// Implemented in Phase 4.

export async function stampSignatureOnPdf(_args: {
  pdfBytes: Uint8Array
  signatureBytes: Uint8Array
  page: number
  x: number
  y: number
  width: number
  height: number
}): Promise<Uint8Array> {
  throw new Error('stampSignatureOnPdf is not implemented yet (Phase 4).')
}
