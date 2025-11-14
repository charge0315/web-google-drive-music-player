import { NextResponse } from 'next/server'

const GENIUS_API_URL = 'https://api.genius.com'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')

    if (!query) {
      return NextResponse.json(
        { error: '検索クエリが必要です' },
        { status: 400 }
      )
    }

    const accessToken = process.env.GENIUS_ACCESS_TOKEN

    if (!accessToken) {
      return NextResponse.json(
        { error: 'GENIUS_ACCESS_TOKENが設定されていません' },
        { status: 500 }
      )
    }

    // GENIUS APIで曲を検索
    const response = await fetch(
      `${GENIUS_API_URL}/search?q=${encodeURIComponent(query)}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Genius API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    // 検索結果から曲情報を抽出
    const songs = data.response?.hits?.map((hit: any) => ({
      id: hit.result.id,
      title: hit.result.title,
      artist: hit.result.primary_artist.name,
      url: hit.result.url,
      thumbnail: hit.result.song_art_image_thumbnail_url,
    })) || []

    return NextResponse.json({ songs })
  } catch (error: any) {
    console.error('Genius search error:', error)
    return NextResponse.json(
      { error: error.message || '検索に失敗しました' },
      { status: 500 }
    )
  }
}

