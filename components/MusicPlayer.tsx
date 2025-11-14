'use client'

import { useState, useRef, useEffect } from 'react'
import styles from './MusicPlayer.module.css'

interface MusicPlayerProps {
  file: {
    id: string
    name: string
  }
}

interface LyricsLine {
  text: string
  time?: number
}

export default function MusicPlayer({ file }: MusicPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lyrics, setLyrics] = useState<string | null>(null)
  const [lyricsLoading, setLyricsLoading] = useState(false)
  const [lyricsError, setLyricsError] = useState<string | null>(null)
  const [showLyrics, setShowLyrics] = useState(false)
    const [currentLyricsLine, setCurrentLyricsLine] = useState<number>(0)
  const [lyricsOffset, setLyricsOffset] = useState<number>(0) // 歌詞ハイライトの時間オフセット（秒）
  const lyricsContainerRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

      useEffect(() => {
    // 曲切り替え時は再生位置を初期化
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setCurrentLyricsLine(0)
    setLyricsOffset(0)
    if (audioRef.current) {
      try {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      } catch {}
    }

    loadAudioFile()
    loadLyrics()
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.id])

  // 再生位置に基づいて歌詞のハイライトを更新
    useEffect(() => {
    if (!lyrics || !showLyrics || !duration || duration <= 0) return

    // 描画している行配列と同じ分割（空行も含める）
    const lines = lyrics.split('\n')

    // オフセットを適用して行番号を計算
    const effTime = Math.max(0, Math.min(duration, currentTime + lyricsOffset))
    let estimatedLine = Math.floor((effTime / duration) * lines.length)
    if (estimatedLine < 0) estimatedLine = 0
    if (estimatedLine >= lines.length) estimatedLine = lines.length - 1

    setCurrentLyricsLine(estimatedLine)

    // 現在の行までスクロール
    if (lyricsContainerRef.current) {
      const lineElement = lyricsContainerRef.current.children[estimatedLine] as HTMLElement
      if (lineElement) {
        lineElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [currentTime, duration, lyrics, showLyrics, lyricsOffset])

  const loadAudioFile = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Google Drive APIからファイルのダウンロードURLを取得
      const response = await fetch(`/api/drive/file/${file.id}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'ファイルの読み込みに失敗しました' }))
        throw new Error(errorData.error || 'ファイルの読み込みに失敗しました')
      }
      
      const data = await response.json()
      if (audioRef.current) {
        // ストリーミングエンドポイントを使用
        audioRef.current.src = data.downloadUrl
        audioRef.current.crossOrigin = 'anonymous'
        audioRef.current.preload = 'metadata'
        
        // ロードイベントを待つ
        await new Promise<void>((resolve, reject) => {
          if (!audioRef.current) {
            reject(new Error('Audio element not available'))
            return
          }
          
          const handleLoadedMetadata = () => {
            audioRef.current?.removeEventListener('loadedmetadata', handleLoadedMetadata)
            audioRef.current?.removeEventListener('error', handleError)
            resolve()
          }
          
          const handleError = () => {
            audioRef.current?.removeEventListener('loadedmetadata', handleLoadedMetadata)
            audioRef.current?.removeEventListener('error', handleError)
            reject(new Error('オーディオファイルの読み込みに失敗しました'))
          }
          
          audioRef.current.addEventListener('loadedmetadata', handleLoadedMetadata)
          audioRef.current.addEventListener('error', handleError)
          audioRef.current.load()
        })
      }
    } catch (err: any) {
      console.error('Load audio error:', err)
      setError(err.message || 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const togglePlay = async () => {
    if (audioRef.current) {
      try {
        if (isPlaying) {
          audioRef.current.pause()
          setIsPlaying(false)
        } else {
          await audioRef.current.play()
          setIsPlaying(true)
        }
      } catch (err: any) {
        console.error('Play error:', err)
        setError('再生に失敗しました: ' + err.message)
        setIsPlaying(false)
      }
    }
  }

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
      setDuration(audioRef.current.duration || 0)
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value)
    if (audioRef.current) {
      audioRef.current.currentTime = newTime
      setCurrentTime(newTime)
    }
  }

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // ファイル名から曲名とアーティスト名を抽出
  const extractSongInfo = (fileName: string) => {
    // 拡張子を除去
    const nameWithoutExt = fileName.replace(/\.(mp3|m4a|wav|ogg|flac|aac|wma)$/i, '')
    
    // 一般的なパターン: "アーティスト名 - 曲名" または "曲名 - アーティスト名"
    const patterns = [
      /^(.+?)\s*-\s*(.+)$/,  // "Artist - Song"
      /^(.+?)\s*–\s*(.+)$/,  // "Artist – Song" (en dash)
      /^(.+?)\s*—\s*(.+)$/,  // "Artist — Song" (em dash)
    ]

    for (const pattern of patterns) {
      const match = nameWithoutExt.match(pattern)
      if (match) {
        return {
          artist: match[1].trim(),
          title: match[2].trim(),
        }
      }
    }

    // パターンに一致しない場合は、ファイル名全体を曲名として使用
    return {
      artist: null,
      title: nameWithoutExt.trim(),
    }
  }

  const loadLyrics = async () => {
    try {
      setLyricsLoading(true)
      setLyricsError(null)
      setLyrics(null)

      // MongoDBから楽曲情報を取得（lyricsが空の場合は自動的にGENIUS APIで取得）
      const songResponse = await fetch(
        `/api/mongodb/song?fileId=${encodeURIComponent(file.id)}`
      )
      
      if (!songResponse.ok) {
        // MongoDBにない場合は、ファイル名でも検索を試みる
        const fallbackResponse = await fetch(
          `/api/mongodb/song?fileName=${encodeURIComponent(file.name)}`
        )
        
        if (!fallbackResponse.ok) {
          throw new Error('楽曲情報が見つかりませんでした')
        }

        const fallbackData = await fallbackResponse.json()
        const song = fallbackData.song

                if (song.lyrics && song.lyrics.trim().length > 0) {
          setLyrics(song.lyrics)
          setShowLyrics(true)
          try { console.log('[Lyrics] 取得（fallback: fileName）', file.name, (song.lyrics || '').slice(0, 120) + '...') } catch {}
        } else {
          setLyricsError('歌詞が登録されていません')
        }
        return
      }

      const songData = await songResponse.json()
      const song = songData.song

            if (song.lyrics && song.lyrics.trim().length > 0) {
        setLyrics(song.lyrics)
        setShowLyrics(true)
        try { console.log('[Lyrics] 取得', file.name, (song.lyrics || '').slice(0, 120) + '...') } catch {}
      } else {
        setLyricsError('歌詞が登録されていません')
      }
    } catch (err: any) {
      console.error('Load lyrics error:', err)
      setLyricsError(err.message || '歌詞の読み込みに失敗しました')
    } finally {
      setLyricsLoading(false)
    }
  }

  return (
    <div className={styles.player}>
      <h3 className={styles.playerTitle}>🎵 {file.name}</h3>
      
      {loading && (
        <div className={styles.status}>読み込み中...</div>
      )}
      
      {error && (
        <div className={styles.error}>エラー: {error}</div>
      )}

      {!loading && !error && (
        <>
          <audio
            ref={audioRef}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleTimeUpdate}
            onEnded={() => setIsPlaying(false)}
            onError={(e) => {
              console.error('Audio error:', e)
              const error = audioRef.current?.error
              let errorMessage = '再生エラーが発生しました'
              if (error) {
                switch (error.code) {
                  case error.MEDIA_ERR_ABORTED:
                    errorMessage = '再生が中断されました'
                    break
                  case error.MEDIA_ERR_NETWORK:
                    errorMessage = 'ネットワークエラーが発生しました'
                    break
                  case error.MEDIA_ERR_DECODE:
                    errorMessage = 'デコードエラーが発生しました'
                    break
                  case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                    errorMessage = 'この形式はサポートされていません'
                    break
                }
              }
              setError(errorMessage)
              setIsPlaying(false)
            }}
          />

          <div className={styles.controls}>
            <button 
              onClick={togglePlay}
              className={styles.playButton}
              disabled={loading}
            >
              {isPlaying ? '⏸ 一時停止' : '▶ 再生'}
            </button>

            <div className={styles.progressContainer}>
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={handleSeek}
                className={styles.progressBar}
              />
              <div className={styles.timeDisplay}>
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

                        {/* 歌詞表示トグルボタン */}
            <button
              onClick={() => setShowLyrics(!showLyrics)}
              className={styles.lyricsToggle}
              disabled={lyricsLoading || !lyrics}
            >
              {showLyrics ? '📝 歌詞を隠す' : '📝 歌詞を表示'}
            </button>

            {/* 歌詞同期オフセット（簡易補正） */}
            {lyrics && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 8 }}>
                <button
                  onClick={() => setLyricsOffset(o => +((o - 0.5)).toFixed(2))}
                  disabled={lyricsLoading}
                >
                  -0.5s
                </button>
                <span style={{ fontSize: 12 }}>オフセット: {lyricsOffset.toFixed(1)}s</span>
                <button
                  onClick={() => setLyricsOffset(o => +((o + 0.5)).toFixed(2))}
                  disabled={lyricsLoading}
                >
                  +0.5s
                </button>
              </div>
            )}
          </div>

          {/* 歌詞表示エリア */}
          {showLyrics && (
            <div className={styles.lyricsContainer}>
              {lyricsLoading && (
                <div className={styles.status}>歌詞を読み込み中...</div>
              )}
              {lyricsError && (
                <div className={styles.error}>歌詞エラー: {lyricsError}</div>
              )}
              {lyrics && !lyricsLoading && (
                <div ref={lyricsContainerRef} className={styles.lyricsContent}>
                  {lyrics.split('\n').map((line, index) => (
                    <div
                      key={index}
                      className={`${styles.lyricsLine} ${
                        index === currentLyricsLine ? styles.lyricsLineActive : ''
                      }`}
                    >
                      {line.trim() || '\u00A0'}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

