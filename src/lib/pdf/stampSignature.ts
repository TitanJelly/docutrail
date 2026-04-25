import { PDFDocument } from 'pdf-lib'

export async function stampSignatureOnPdf(args: {
  pdfBytes: Uint8Array
  signatureBytes: Uint8Array
  page: number    // 0-indexed; pass -1 for the last page
  x: number       // points from left edge
  y: number       // points from bottom edge
  width: number
  height: number
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(args.pdfBytes)

  let sigImage
  try {
    sigImage = await pdfDoc.embedPng(args.signatureBytes)
  } catch {
    sigImage = await pdfDoc.embedJpg(args.signatureBytes)
  }

  const pages = pdfDoc.getPages()
  const pageIndex =
    args.page < 0
      ? pages.length + args.page
      : Math.min(args.page, pages.length - 1)
  const target = pages[pageIndex]

  target.drawImage(sigImage, {
    x: args.x,
    y: args.y,
    width: args.width,
    height: args.height,
  })

  return new Uint8Array(await pdfDoc.save())
}
