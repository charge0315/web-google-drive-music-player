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

    // まずファイル情報を取得してサイズを確認
    const fileInfo = await drive.files.get({
      fileId,
      fields: 'size, mimeType',
    })

    const fileSize = fileInfo.data.size ? parseInt(fileInfo.data.size) : 0
    const mimeType = fileInfo.data.mimeType || 'audio/mpeg'

    // Rangeリクエストを処理
    const range = request.headers.get('range')
    let start = 0
    let end = fileSize - 1

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-')
      start = parseInt(parts[0], 10)
      end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
    }

        // 認証トークンを取得（必要なら自動リフレッシュ）
    const accessTokenResult = await oauth2Client.getAccessToken()
    const accessToken = accessTokenResult?.token
    if (!accessToken) {
      throw new Error('Google Drive access token を取得できませんでした')
    }

    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
    const fetchOnce = async () => {
      const fetchHeaders: HeadersInit = {
        'Authorization': `Bearer ${accessToken}`,
      }
      if (range) {
        fetchHeaders['Range'] = `bytes=${start}-${end}`
      }
      return fetch(url, { headers: fetchHeaders })
    }

    // 直接HTTPリクエストを送信（1回目）
    let fileResponse = await fetchOnce()

    // 401が返った場合はアクセストークン再取得を試し、1回だけ再試行
    if (fileResponse.status === 401) {
      const refreshed = await oauth2Client.getAccessToken()
      const newToken = refreshed?.token
      if (!newToken) {
        throw new Error(`Google Drive API error: ${fileResponse.status} Unauthorized`)
      }
      const retryHeaders: HeadersInit = {
        'Authorization': `Bearer ${newToken}`,
      }
      if (range) {
        retryHeaders['Range'] = `bytes=${start}-${end}`
      }
      fileResponse = await fetch(url, { headers: retryHeaders })
    }

    if (!fileResponse.ok) {
      throw new Error(`Google Drive API error: ${fileResponse.status} ${fileResponse.statusText}`)
    }

    // レスポンスヘッダーを設定
    const responseHeaders = new Headers()

    // Google Drive APIからのContent-Typeを取得
    const contentType = fileResponse.headers.get('Content-Type') || mimeType
    responseHeaders.set('Content-Type', contentType)
    responseHeaders.set('Accept-Ranges', 'bytes')

    // Rangeリクエストの場合はContent-Rangeを設定
    // Google Drive APIが既にContent-Rangeを返している場合はそれを使用
    const contentRange = fileResponse.headers.get('Content-Range')
    if (contentRange) {
      responseHeaders.set('Content-Range', contentRange)
    } else if (range) {
      responseHeaders.set('Content-Range', `bytes ${start}-${end}/${fileSize}`)
    }

    // Content-Lengthを設定
    const contentLength = fileResponse.headers.get('Content-Length')
    if (contentLength) {
      responseHeaders.set('Content-Length', contentLength)
    } else if (range) {
      responseHeaders.set('Content-Length', (end - start + 1).toString())
    } else if (fileSize > 0) {
      responseHeaders.set('Content-Length', fileSize.toString())
    }

    // CORSヘッダーを設定（必要に応じて）
    responseHeaders.set('Access-Control-Allow-Origin', '*')
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
    responseHeaders.set('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges')

    // ストリームをそのまま返す
    return new Response(fileResponse.body, {
      headers: responseHeaders,
      status: fileResponse.status,
    })
  } catch (error: any) {
    console.error('Streaming error:', error)
    return NextResponse.json(
      { error: error.message || 'ファイルのストリーミングに失敗しました' },
      { status: 500 }
    )
  }
}

