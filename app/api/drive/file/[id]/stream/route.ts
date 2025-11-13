import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { cookies } from 'next/headers'

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/drive/auth/callback'
)

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const fileId = params.id

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

    // ファイルをストリーミング
    const fileResponse = await drive.files.get(
      {
        fileId,
        alt: 'media',
      },
      {
        responseType: 'stream',
      }
    )

    // ストリーミングレスポンスを返す
    const headers = new Headers()
    
    // ファイルのMIMEタイプを設定
    if (fileResponse.headers['content-type']) {
      headers.set('Content-Type', fileResponse.headers['content-type'])
    }
    
    // 範囲リクエスト（Range）をサポート
    const range = request.headers.get('range')
    if (range) {
      headers.set('Accept-Ranges', 'bytes')
    }

    // ストリームをReadableStreamに変換
    const stream = fileResponse.data as any
    const readableStream = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk: Buffer) => {
          controller.enqueue(chunk)
        })
        stream.on('end', () => {
          controller.close()
        })
        stream.on('error', (err: Error) => {
          controller.error(err)
        })
      },
    })

    return new Response(readableStream, {
      headers,
      status: range ? 206 : 200,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'ファイルのストリーミングに失敗しました' },
      { status: 500 }
    )
  }
}

