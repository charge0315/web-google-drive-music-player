import { NextResponse } from 'next/server'
import { google } from 'googleapis'

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/drive/auth/callback'
)

export async function GET() {
  try {
    const scopes = [
      'https://www.googleapis.com/auth/drive.readonly',
    ]

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
    })

    return NextResponse.json({ authUrl })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || '認証URLの生成に失敗しました' },
      { status: 500 }
    )
  }
}

