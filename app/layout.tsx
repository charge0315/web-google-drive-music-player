import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Google Drive Music Player',
  description: 'Google Driveにある曲を検索、閲覧、ストリーミング再生',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}

