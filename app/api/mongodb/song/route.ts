import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

// 既存歌詞が有効かを判定
function hasLyrics(value: any): boolean {
  try {
    if (!value) return false
    if (typeof value === 'string') return value.trim().length > 0
    if (Array.isArray(value)) return value.some(v => typeof v === 'string' && v.trim().length > 0)
    if (typeof value === 'object' && typeof (value as any).text === 'string') return (value as any).text.trim().length > 0
    return false
  } catch {
    return false
  }
}

// GENIUS APIから歌詞を取得する関数
async function fetchLyricsFromGenius(title: string, artist?: string): Promise<string | null> {
  try {
    const accessToken = process.env.GENIUS_ACCESS_TOKEN
    if (!accessToken) {
      console.warn('GENIUS_ACCESS_TOKENが設定されていません')
      return null
    }

    const searchQuery = artist ? `${artist} ${title}` : title
        console.log('[Genius] 検索開始', { title, artist })
    const searchResponse = await fetch(
      `https://api.genius.com/search?q=${encodeURIComponent(searchQuery)}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    )

    if (!searchResponse.ok) {
      return null
    }

    const searchData = await searchResponse.json()
    const songs = searchData.response?.hits || []

    if (songs.length === 0) {
      return null
    }

        const song = songs[0].result
    const lyricsUrl = song.url
    console.log('[Genius] 検索ヒット', { id: song.id, title: song.title, artist: song.primary_artist?.name, url: lyricsUrl })

    // 歌詞を取得（サーバー側で直接スクレイピング）
    try {
            console.log('[Genius] 歌詞ページ取得', lyricsUrl)
            const pageResponse = await fetch(lyricsUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Referer': 'https://genius.com/',
        },
      })

      if (!pageResponse.ok) {
        return null
      }

                  const html = await pageResponse.text()
      console.log('[Genius] HTML受信', { length: html.length, hasDataLyrics: /data-lyrics-container/i.test(html), hasLyricsContainer: /Lyrics__Container/i.test(html) })

      // まずは複数の歌詞コンテナを結合して抽出（より堅牢）
      try {
        const joinContainers = (pattern: RegExp) => {
          const matches = [...html.matchAll(pattern)]
          if (!matches || matches.length === 0) return ''
          return matches.map(m => m[1]).join('\n')
        }
        let combined = joinContainers(/<div[^>]*data-lyrics-container[^>]*>([\s\S]*?)<\/div>/gi)
        if (!combined) {
          combined = joinContainers(/<div[^>]*class="[^"]*Lyrics__Container[^"]*"[^>]*>([\s\S]*?)<\/div>/gi)
        }
        if (combined) {
                    const decodeEntities = (s: string) => s
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&#x27;/g, "'")
            .replace(/&#x2F;/g, '/')
            .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
            .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))

          let extracted = combined
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<br\s*\/?>(?=\s*\n?)/gi, '\n')
            .replace(/<[^>]*>/g, '\n')
            .split('\n')
            .map(line => decodeEntities(line.trim()))
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
          if (extracted && extracted.length > 0) {
            console.log('[Genius] 歌詞抽出成功(複数コンテナ)', extracted.slice(0, 120) + '...')
            return extracted
          }
        }
      } catch (e) {
        console.warn('[Genius] 複数コンテナ抽出で例外', e)
      }

            // 歌詞を抽出（GeniusのHTML構造に基づく）（従来の単一コンテナfallback）
      let lyricsMatch = html.match(/<div[^>]*data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/i)
      
      if (!lyricsMatch) {
        lyricsMatch = html.match(/<div[^>]*data-lyrics-container[^>]*>([\s\S]*?)<\/div>/i)
      }
      
      if (!lyricsMatch) {
        lyricsMatch = html.match(/<div[^>]*class="[^"]*lyrics-container[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
      }
      
      if (!lyricsMatch) {
        lyricsMatch = html.match(/<div[^>]*class="[^"]*lyrics[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
      }

      if (lyricsMatch && lyricsMatch[1]) {
        let lyrics = lyricsMatch[1]
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

        if (lyrics.length > 0) {
          console.log('[Genius] 歌詞抽出成功', lyrics.slice(0, 120) + '...')
          return lyrics
        }
        return null
      }
      
      return null
    } catch (error) {
      console.error('Lyrics scraping error:', error)
      return null
    }
  } catch (error) {
    console.error('Genius lyrics fetch error:', error)
    return null
  }
}

// メタデータと音響特徴量を取得する関数（Google Drive APIから直接取得）
async function extractAudioMetadata(fileId: string): Promise<any> {
  try {
    // Google Drive APIから直接ファイルを取得（認証が必要）
    const { google } = await import('googleapis')
    const { cookies } = await import('next/headers')
    
    const cookieStore = await cookies()
    const tokenCookie = cookieStore.get('google_drive_token')
    
    if (!tokenCookie) {
      console.warn('Google Drive認証トークンが見つかりません')
      return null
    }

    const tokens = JSON.parse(tokenCookie.value)
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/drive/auth/callback'
    )
    oauth2Client.setCredentials(tokens)

    const drive = google.drive({ version: 'v3', auth: oauth2Client })

    // ファイルをストリームとして取得（メタデータのみを読み込むため、最初の部分だけ）
    const fileResponse = await drive.files.get(
      {
        fileId,
        alt: 'media',
      },
      {
        responseType: 'stream',
      }
    )

    // ストリームから最初の部分を読み込む（メタデータは通常ファイルの先頭にある）
    const chunks: Buffer[] = []
    const maxBytes = 1024 * 1024 // 1MBまで読み込む（メタデータには十分）
    let totalBytes = 0

    return new Promise((resolve) => {
      const stream = fileResponse.data as any
      
      stream.on('data', (chunk: Buffer) => {
        chunks.push(chunk)
        totalBytes += chunk.length
        if (totalBytes >= maxBytes) {
          stream.destroy()
          processChunks(chunks, resolve)
        }
      })

      stream.on('end', () => {
        processChunks(chunks, resolve)
      })

      stream.on('error', (error: Error) => {
        console.error('Stream error:', error)
        resolve(null)
      })
    })

    async function processChunks(chunks: Buffer[], resolve: (value: any) => void) {
      try {
        const buffer = Buffer.concat(chunks)

        // music-metadataを使用してメタデータを取得
        const { parseBuffer } = await import('music-metadata')
        const metadata = await parseBuffer(buffer)

        // メタデータと音響特徴量を抽出
        const result = {
          // メタデータ
          title: metadata.common.title || null,
          artist: metadata.common.artist || null,
          album: metadata.common.album || null,
          year: metadata.common.year || null,
          genre: metadata.common.genre?.[0] || null,
          track: metadata.common.track?.no || null,
          // 音響特徴量
          audioFeatures: {
            duration: metadata.format.duration || null,
            bitrate: metadata.format.bitrate || null,
            sampleRate: metadata.format.sampleRate || null,
            codec: metadata.format.codec || null,
            container: metadata.format.container || null,
            // より高度な特徴量は別のライブラリが必要
            // BPM, Key, Energy などは外部APIや専用ライブラリが必要
          }
        }

        resolve(result)
      } catch (error) {
        console.error('Metadata parsing error:', error)
        resolve(null)
      }
    }
  } catch (error) {
    console.error('Audio metadata extraction error:', error)
    return null
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get('fileId')
    const fileName = searchParams.get('fileName')

    if (!fileId && !fileName) {
      return NextResponse.json(
        { error: 'fileIdまたはfileNameが必要です' },
        { status: 400 }
      )
    }

    const mongoEnabled = !!process.env.MONGO_URI

        // MongoDB接続を試行
    let song = null
        if (mongoEnabled) {
      try {
        const client = await clientPromise
        const db = client.db('my-music')
        const collection = db.collection('my-collection')

        // fileIdまたはfileNameで検索（複数のフィールド名に対応）
        let query: any = {}
        if (fileId) {
          query = {
            $or: [
              { fileId: fileId },
              { id: fileId },
              { driveId: fileId },
              { googleDriveId: fileId },
            ],
          }
        } else if (fileName) {
          query = {
            $or: [
              { fileName: fileName },
              { name: fileName },
              { title: fileName },
            ],
          }
        }

        song = await collection.findOne(query)

        // 見つからない場合はfileNameベースでもう一度試す（冪等）
        if (!song && fileName) {
          const fallbackQuery = {
            $or: [
              { fileName: fileName },
              { name: fileName },
              { title: fileName },
            ],
          }
          song = await collection.findOne(fallbackQuery)
        }
      } catch (dbError: any) {
        console.error('MongoDB connection error:', dbError)
        // MongoDB接続エラーの場合でも、GENIUS APIで歌詞を取得できるようにする
      }
    }

    // 楽曲情報がない場合、メタデータを取得してGENIUS APIで歌詞を取得
    let title = ''
    let artist = ''
    let lyrics: string | null = null
    let audioFeatures = null
    let metadataFromFile: any = null

        // 歌詞がDBにあるならGenius問い合わせを抑止
    const geniusAllowedBase = !(song && hasLyrics((song as any).lyrics))

    if (song) {
      title = song.title || song.fileName || song.name || ''
      artist = song.artist || ''
      
            // lyricsが空または存在しない場合、GENIUS APIで取得
            if (!hasLyrics(song.lyrics)) {
        if (geniusAllowedBase && title && fileId) {
          try {
            lyrics = await fetchLyricsFromGenius(title, artist)
            if (lyrics && song._id && mongoEnabled) {
              // MongoDBを更新
              try {
                const client = await clientPromise
                const db = client.db('my-music')
                const collection = db.collection('my-collection')
                await collection.updateOne(
                  { _id: song._id },
                  { $set: { lyrics } }
                )
                song.lyrics = lyrics
              } catch (updateError) {
                console.error('Failed to update MongoDB with lyrics:', updateError)
              }
            }
          } catch (error) {
            console.error('Failed to fetch lyrics from Genius:', error)
          }
        }
            } else {
        lyrics = typeof song.lyrics === 'object' && (song.lyrics as any).text ? (song.lyrics as any).text : song.lyrics
        console.log('[Lyrics] DBに有効な歌詞が存在するため、Geniusへの問い合わせをスキップします')
      }

      // 音響特徴量の取得（MongoDBに楽曲情報がある場合のみ）
      if ((!song.audioFeatures || Object.keys(song.audioFeatures).length === 0) && fileId) {
        try {
          metadataFromFile = await extractAudioMetadata(fileId)
          if (metadataFromFile) {
            audioFeatures = metadataFromFile.audioFeatures
                        if (audioFeatures && song._id && mongoEnabled) {
              // MongoDBを更新
              try {
                const client = await clientPromise
                const db = client.db('my-music')
                const collection = db.collection('my-collection')
                await collection.updateOne(
                  { _id: song._id },
                  { $set: { audioFeatures } }
                )
              } catch (updateError) {
                console.error('Failed to update MongoDB with audio features:', updateError)
              }
            }
          }
        } catch (error) {
          console.error('Failed to extract audio features:', error)
        }
      } else if (song.audioFeatures) {
        audioFeatures = song.audioFeatures
      }
    } else {
      // MongoDBに楽曲情報がない場合、メタデータを取得
      if (fileId) {
        try {
          metadataFromFile = await extractAudioMetadata(fileId)
          if (metadataFromFile) {
            // メタデータからタイトルとアーティストを取得
            title = metadataFromFile.title || ''
            artist = metadataFromFile.artist || ''
            audioFeatures = metadataFromFile.audioFeatures

            // メタデータからタイトルとアーティストが取得できた場合、GENIUS APIで歌詞を取得
                        if (geniusAllowedBase && title) {
              try {
                lyrics = await fetchLyricsFromGenius(title, artist || undefined)
                
                // メタデータと歌詞を取得できた場合、MongoDBに保存
                if (mongoEnabled && (lyrics || metadataFromFile)) {
                  try {
                    const client = await clientPromise
                    const db = client.db('my-music')
                    const collection = db.collection('my-collection')
                    
                    const songData: any = {
                      fileId: fileId,
                      fileName: fileName || null,
                      title: title || null,
                      artist: artist || null,
                      album: metadataFromFile.album || null,
                      year: metadataFromFile.year || null,
                      genre: metadataFromFile.genre || null,
                      track: metadataFromFile.track || null,
                      lyrics: lyrics || null,
                      audioFeatures: audioFeatures || null,
                      createdAt: new Date(),
                      updatedAt: new Date(),
                    }

                    // fileIdで既存のドキュメントを探す
                    const existingSong = await collection.findOne({
                      $or: [
                        { fileId: fileId },
                        { id: fileId },
                        { driveId: fileId },
                        { googleDriveId: fileId },
                      ],
                    })

                    if (existingSong) {
                      // 既存のドキュメントを更新
                      await collection.updateOne(
                        { _id: existingSong._id },
                        { 
                          $set: {
                            ...songData,
                            updatedAt: new Date(),
                          }
                        }
                      )
                      song = { ...existingSong, ...songData }
                    } else {
                      // 新しいドキュメントを作成
                      const result = await collection.insertOne(songData)
                      song = { ...songData, _id: result.insertedId }
                    }
                                    } catch (dbError) {
                    console.error('Failed to save to MongoDB:', dbError)
                  }
                }
              } catch (error) {
                console.error('Failed to fetch lyrics from Genius:', error)
              }
            }
          }
        } catch (error) {
          console.error('Failed to extract metadata:', error)
          // メタデータ取得に失敗した場合、ファイル名から情報を抽出してGENIUS APIで取得を試みる
          const nameToUse = fileName || ''
          if (nameToUse) {
            // ファイル名から拡張子を除去
            const nameWithoutExt = nameToUse.replace(/\.[^/.]+$/, '')
            // 簡易的なタイトル抽出（例: "01 - Artist - Title.mp3" や "Artist - Title.mp3"）
            const parts = nameWithoutExt.split(' - ')
            if (parts.length >= 2) {
              artist = parts[0].trim()
              title = parts.slice(1).join(' - ').trim()
            } else {
              title = nameWithoutExt.trim()
            }
            
            try {
              lyrics = await fetchLyricsFromGenius(title, artist || undefined)
            } catch (error) {
              console.error('Failed to fetch lyrics from Genius:', error)
            }
          }
        }
      }
    }

    // レスポンスを返す
    if (song) {
      return NextResponse.json({
        song: {
          fileId: song.fileId || song.id || song.driveId || song.googleDriveId || fileId,
          fileName: song.fileName || song.name || song.title || fileName,
          title: song.title || title || (metadataFromFile?.title || null),
          artist: song.artist || artist || (metadataFromFile?.artist || null),
          lyrics: lyrics || song.lyrics || null,
          audioFeatures: audioFeatures || song.audioFeatures || null,
          album: song.album || (metadataFromFile?.album || null),
          year: song.year || (metadataFromFile?.year || null),
          genre: song.genre || (metadataFromFile?.genre || null),
          track: song.track || (metadataFromFile?.track || null),
          // その他のフィールドも含める
          ...song,
        },
      })
    } else {
      // MongoDBに楽曲情報がない場合でも、メタデータとGENIUS APIで取得した歌詞を返す
      return NextResponse.json({
        song: {
          fileId: fileId || null,
          fileName: fileName || null,
          title: title || (metadataFromFile?.title || null),
          artist: artist || (metadataFromFile?.artist || null),
          lyrics: lyrics || null,
          audioFeatures: audioFeatures || (metadataFromFile?.audioFeatures || null),
          album: metadataFromFile?.album || null,
          year: metadataFromFile?.year || null,
          genre: metadataFromFile?.genre || null,
          track: metadataFromFile?.track || null,
        },
      })
    }
  } catch (error: any) {
    console.error('MongoDB song fetch error:', error)
    console.error('Error stack:', error.stack)
    return NextResponse.json(
      { 
        error: error.message || '楽曲情報の取得に失敗しました',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

