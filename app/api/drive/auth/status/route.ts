import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('google_drive_token')
    
    return NextResponse.json({ 
      authenticated: !!token 
    })
  } catch (error: any) {
    return NextResponse.json(
      { authenticated: false, error: error.message },
      { status: 500 }
    )
  }
}

