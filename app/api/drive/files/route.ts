import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { cookies } from 'next/headers'

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/drive/auth/callback'
)

export async function GET() {
  try {
    const cookieStore = await cookies()
    const tokenCookie = cookieStore.get('google_drive_token')
    
    if (!tokenCookie) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      )
    }

    const tokens = JSON.parse(tokenCookie.value)
    oauth2Client.setCredentials(tokens)

    const drive = google.drive({ version: 'v3', auth: oauth2Client })

    // 音楽ファイルのMIMEタイプ
    const audioMimeTypes = [
      'audio/mpeg',
      'audio/mp3',
      'audio/mp4',
      'audio/wav',
      'audio/ogg',
      'audio/flac',
      'audio/aac',
      'audio/x-ms-wma',
      'audio/webm',
    ]

    const mimeTypeQuery = audioMimeTypes.map(type => `mimeType='${type}'`).join(' or ')

    const response = await drive.files.list({
      q: `(${mimeTypeQuery}) and trashed=false`,
      fields: 'files(id, name, mimeType, size, modifiedTime)',
      pageSize: 100,
      orderBy: 'modifiedTime desc',
    })

    return NextResponse.json({ files: response.data.files || [] })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'ファイルの取得に失敗しました' },
      { status: 500 }
    )
  }
}

