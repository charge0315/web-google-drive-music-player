import { NextResponse } from 'next/server'

const GENIUS_API_URL = 'https://api.genius.com'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const songId = searchParams.get('id')
    const songUrl = searchParams.get('url')

    if (!songId && !songUrl) {
      return NextResponse.json(
        { error: '曲IDまたはURLが必要です' },
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

    let lyricsUrl = songUrl

    // URLが提供されていない場合は、曲IDからURLを取得
    if (!lyricsUrl && songId) {
      const songResponse = await fetch(
        `${GENIUS_API_URL}/songs/${songId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      )

      if (!songResponse.ok) {
        throw new Error(`Genius API error: ${songResponse.status}`)
      }

      const songData = await songResponse.json()
      lyricsUrl = songData.response?.song?.url
    }

    if (!lyricsUrl) {
      return NextResponse.json(
        { error: '歌詞URLを取得できませんでした' },
        { status: 404 }
      )
    }

    // Geniusの歌詞ページから歌詞を取得
    // 注意: Genius APIは直接歌詞を返さないため、ページをスクレイピングする必要があります
    // ここでは、歌詞ページのURLを返し、クライアント側で処理するか、
    // サーバー側でスクレイピングを行います
    
    // サーバー側でスクレイピング（簡易版）
    try {
      const pageResponse = await fetch(lyricsUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      })

      if (!pageResponse.ok) {
        throw new Error(`Failed to fetch lyrics page: ${pageResponse.status}`)
      }

      const html = await pageResponse.text()
      
      // 歌詞を抽出（GeniusのHTML構造に基づく）
      // 注意: この方法はGeniusのHTML構造が変更されると動作しなくなる可能性があります
      
      // より正確な歌詞抽出: 複数の方法を試す
      let lyricsMatch = null
      
      // 方法1: <div data-lyrics-container="true"> を探す（最も正確）
      lyricsMatch = html.match(/<div[^>]*data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/i)
      
      // 方法2: data-lyrics-container属性を持つdivを探す（非貪欲マッチ）
      if (!lyricsMatch) {
        lyricsMatch = html.match(/<div[^>]*data-lyrics-container[^>]*>([\s\S]*?)<\/div>/i)
      }
      
      // 方法3: lyrics-containerクラスを持つdivを探す
      if (!lyricsMatch) {
        lyricsMatch = html.match(/<div[^>]*class="[^"]*lyrics-container[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
      }
      
      // 方法4: <div class="lyrics"> を探す
      if (!lyricsMatch) {
        lyricsMatch = html.match(/<div[^>]*class="[^"]*lyrics[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
      }
      
      // 方法5: より広範囲に検索（data-lyrics-containerを含む要素の親要素を探す）
      if (!lyricsMatch) {
        const containerMatch = html.match(/<div[^>]*data-lyrics-container[^>]*>/i)
        if (containerMatch) {
          const startIndex = containerMatch.index || 0
          // 開始タグから次の閉じタグまでを探す（ネストされたdivも考慮）
          const remainingHtml = html.substring(startIndex)
          let depth = 0
          let endIndex = -1
          for (let i = 0; i < remainingHtml.length; i++) {
            if (remainingHtml.substring(i, i + 4) === '<div') depth++
            if (remainingHtml.substring(i, i + 6) === '</div>') {
              depth--
              if (depth === 0) {
                endIndex = i + 6
                break
              }
            }
          }
          if (endIndex > 0) {
            lyricsMatch = [null, remainingHtml.substring(0, endIndex)]
          }
        }
      }
      
      if (lyricsMatch && lyricsMatch[1]) {
        // HTMLタグを除去してテキストのみを抽出
        let lyrics = lyricsMatch[1]
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // scriptタグを除去
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // styleタグを除去
          .replace(/<[^>]*>/g, '\n')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&#x27;/g, "'")
          .replace(/&#x2F;/g, '/')
          .split('\n')
          .map(line => line.trim())
                    .filter(line => {
            // 空行を除去
            if (line.length === 0) return false
            // UI/メタテキストの除去
            if (/^translations?$/i.test(line)) return false
            // "Contributor"を含む行を除去
            if (/contributor/i.test(line)) return false
            // 数字と"Contributor"のパターンを除去（例: "1 Contributor"）
            if (/^\d+\s*contributor/i.test(line)) return false
            // その他のメタ情報を除去
            if (/^\d+\s*(contributor|contributors|writer|writers|producer|producers)/i.test(line)) return false
            // "Embed"や"Share"などのボタンテキストを除去
            if (/^(embed|share|more|less|show|hide)$/i.test(line)) return false
            // 年号のみの行を除去（例: "2010-2019"）
            if (/^\d{4}[-–—]\d{4}$/.test(line)) return false
            return true
          })
          .join('\n')
          .trim()

        // 歌詞が空でないか確認
        if (lyrics && lyrics.length > 0) {
          return NextResponse.json({ lyrics, url: lyricsUrl })
        } else {
          console.warn('Extracted lyrics is empty, trying alternative methods')
        }
      }

      // 別の方法: より広範囲に検索（最後の手段）
      // <div class="lyrics"> や <div class="Lyrics__Container"> などを探す
      const fallbackPatterns = [
        /<div[^>]*class="[^"]*Lyrics__Container[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
        /<div[^>]*class="[^"]*lyrics[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
        /<div[^>]*id="[^"]*lyrics[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      ]

      for (const pattern of fallbackPatterns) {
        const match = html.match(pattern)
        if (match && match[1]) {
          let lyrics = match[1]
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]*>/g, '\n')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&#x27;/g, "'")
            .replace(/&#x2F;/g, '/')
            .split('\n')
            .map(line => line.trim())
                        .filter(line => {
              if (line.length === 0) return false
              if (/^translations?$/i.test(line)) return false
              if (/contributor/i.test(line)) return false
              if (/^\d+\s*contributor/i.test(line)) return false
              if (/^\d+\s*(contributor|contributors|writer|writers|producer|producers)/i.test(line)) return false
              if (/^(embed|share|more|less|show|hide)$/i.test(line)) return false
              if (/^\d{4}[-–—]\d{4}$/.test(line)) return false
              return true
            })
            .join('\n')
            .trim()

          if (lyrics && lyrics.length > 0) {
            return NextResponse.json({ lyrics, url: lyricsUrl })
          }
        }
      }

      // 歌詞が見つからない場合はURLのみを返す
      console.error('Could not extract lyrics from HTML. URL:', lyricsUrl)
      return NextResponse.json({ 
        lyrics: null, 
        url: lyricsUrl,
        error: '歌詞を抽出できませんでした。GeniusのHTML構造が変更された可能性があります。' 
      })
    } catch (scrapeError: any) {
      console.error('Lyrics scraping error:', scrapeError)
      // スクレイピングに失敗した場合はURLのみを返す
      return NextResponse.json({ 
        lyrics: null, 
        url: lyricsUrl,
        error: '歌詞の取得に失敗しました' 
      })
    }
  } catch (error: any) {
    console.error('Genius lyrics error:', error)
    return NextResponse.json(
      { error: error.message || '歌詞の取得に失敗しました' },
      { status: 500 }
    )
  }
}

