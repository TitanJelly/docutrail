import React from 'react'
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import type { JSONContent } from '@tiptap/core'

// A4 in points: 595.28 × 841.89
const MARGIN_H = 50
const CONTENT_W = 595.28 - MARGIN_H * 2

// ccs-header.png 1200×123 → at 495pt wide ≈ 50.7pt tall
// ccs-footer.png 1200×67  → at 495pt wide ≈ 27.6pt tall
const HEADER_H = 51
const FOOTER_H = 28

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#111111',
  },
  header: {
    position: 'absolute',
    top: 18,
    left: MARGIN_H,
    width: CONTENT_W,
    height: HEADER_H,
  },
  footer: {
    position: 'absolute',
    bottom: 8,
    left: MARGIN_H,
    width: CONTENT_W,
    height: FOOTER_H,
  },
  content: {
    marginTop: 18 + HEADER_H + 12,
    marginBottom: 8 + FOOTER_H + 12,
    marginLeft: MARGIN_H,
    marginRight: MARGIN_H,
  },
  docTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 13,
    marginBottom: 10,
  },
  paragraph: {
    marginBottom: 6,
    lineHeight: 1.4,
  },
  h1: { fontFamily: 'Helvetica-Bold', fontSize: 16, marginBottom: 8 },
  h2: { fontFamily: 'Helvetica-Bold', fontSize: 14, marginBottom: 6 },
  h3: { fontFamily: 'Helvetica-Bold', fontSize: 12, marginBottom: 5 },
  listItem: { flexDirection: 'row', marginBottom: 3 },
  listBullet: { width: 14 },
  listContent: { flex: 1 },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: '#cccccc',
    paddingLeft: 10,
    marginBottom: 6,
    color: '#555555',
  },
  hr: {
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
    marginTop: 6,
    marginBottom: 10,
  },
})

function resolveFont(marks: JSONContent['marks']): string {
  const bold = marks?.some((m) => m.type === 'bold')
  const italic = marks?.some((m) => m.type === 'italic')
  if (bold && italic) return 'Helvetica-BoldOblique'
  if (bold) return 'Helvetica-Bold'
  if (italic) return 'Helvetica-Oblique'
  return 'Helvetica'
}

function renderInlines(nodes: JSONContent[] | undefined): React.ReactNode {
  if (!nodes?.length) return null
  return nodes.map((n, i) => {
    if (n.type === 'text') {
      const underline = n.marks?.some((m) => m.type === 'underline')
      return (
        <Text
          key={i}
          style={{
            fontFamily: resolveFont(n.marks),
            textDecoration: underline ? 'underline' : undefined,
          }}
        >
          {n.text ?? ''}
        </Text>
      )
    }
    if (n.type === 'hardBreak') return <Text key={i}>{'\n'}</Text>
    return null
  })
}

function renderBlock(node: JSONContent, key: number): React.ReactNode {
  switch (node.type) {
    case 'paragraph':
      return (
        <Text key={key} style={s.paragraph}>
          {renderInlines(node.content)}
        </Text>
      )
    case 'heading': {
      const level = node.attrs?.level ?? 1
      const hs = level === 1 ? s.h1 : level === 2 ? s.h2 : s.h3
      return (
        <Text key={key} style={hs}>
          {renderInlines(node.content)}
        </Text>
      )
    }
    case 'bulletList':
      return (
        <View key={key}>
          {(node.content ?? []).map((item, i) => (
            <View key={i} style={s.listItem}>
              <Text style={s.listBullet}>{'• '}</Text>
              <View style={s.listContent}>
                {(item.content ?? []).map((child, j) => renderBlock(child, j))}
              </View>
            </View>
          ))}
        </View>
      )
    case 'orderedList':
      return (
        <View key={key}>
          {(node.content ?? []).map((item, i) => (
            <View key={i} style={s.listItem}>
              <Text style={s.listBullet}>{`${i + 1}. `}</Text>
              <View style={s.listContent}>
                {(item.content ?? []).map((child, j) => renderBlock(child, j))}
              </View>
            </View>
          ))}
        </View>
      )
    case 'blockquote':
      return (
        <View key={key} style={s.blockquote}>
          {(node.content ?? []).map((child, i) => renderBlock(child, i))}
        </View>
      )
    case 'horizontalRule':
      return <View key={key} style={s.hr} />
    default:
      return null
  }
}

interface CCSDocumentProps {
  title: string
  contentJson: JSONContent
  headerBase64: string
  footerBase64: string
}

export function CCSDocument({ title, contentJson, headerBase64, footerBase64 }: CCSDocumentProps) {
  return (
    <Document title={title} author="DocuTrail — CCS">
      <Page size="A4" style={s.page}>
        <Image src={`data:image/png;base64,${headerBase64}`} style={s.header} />
        <View style={s.content}>
          <Text style={s.docTitle}>{title}</Text>
          {(contentJson.content ?? []).map((node, i) => renderBlock(node, i))}
        </View>
        <Image src={`data:image/png;base64,${footerBase64}`} style={s.footer} />
      </Page>
    </Document>
  )
}
