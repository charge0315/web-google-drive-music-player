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

    // ファイル情報を取得
    const fileResponse = await drive.files.get({
      fileId,
      fields: 'id, name, mimeType',
    })

    // ダウンロードURLを生成（一時的なURL）
    // 実際には、プロキシ経由でファイルをストリーミングすることを推奨
    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
    
    // 認証トークンを含むURLを生成するために、プロキシエンドポイントを使用
    // セキュリティのため、直接URLを返すのではなく、プロキシ経由でストリーミング
    return NextResponse.json({
      id: fileResponse.data.id,
      name: fileResponse.data.name,
      mimeType: fileResponse.data.mimeType,
      downloadUrl: `/api/drive/file/${fileId}/stream`,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'ファイルの取得に失敗しました' },
      { status: 500 }
    )
  }
}

