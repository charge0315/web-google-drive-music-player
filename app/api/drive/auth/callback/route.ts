import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { cookies } from 'next/headers'

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/drive/auth/callback'
)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')

    if (!code) {
      return NextResponse.json(
        { error: '認証コードが取得できませんでした' },
        { status: 400 }
      )
    }

    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)

        // トークンをCookieに保存（実際の実装では、セッションストレージやデータベースを使用することを推奨）
    const cookieStore = await cookies()
    cookieStore.set('google_drive_token', JSON.stringify(tokens), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7日間
    })

    // 親ウィンドウからのwindow.closeはCOOPでブロックされる場合があるため
    // ポップアップ自身でクローズ＋通知してからフォールバックでリダイレクト
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>Auth Completed</title></head>
<body>
<script>
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({ type: 'google-drive-auth-complete' }, window.location.origin);
    }
    window.close();
  } catch (e) {}
  // 念のためのフォールバック（タブ/ポップアップが閉じられない場合）
  setTimeout(function(){ window.location.replace('/'); }, 500);
</script>
認証が完了しました。このウィンドウは自動的に閉じられます。
</body></html>`

    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || '認証に失敗しました' },
      { status: 500 }
    )
  }
}

