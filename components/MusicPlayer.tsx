'use client'

import { useState, useRef, useEffect } from 'react'
import styles from './MusicPlayer.module.css'

interface MusicPlayerProps {
  file: {
    id: string
    name: string
  }
}

export default function MusicPlayer({ file }: MusicPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    loadAudioFile()
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
      }
    }
  }, [file.id])

  const loadAudioFile = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Google Drive APIからファイルのダウンロードURLを取得
      const response = await fetch(`/api/drive/file/${file.id}`)
      if (!response.ok) {
        throw new Error('ファイルの読み込みに失敗しました')
      }
      
      const data = await response.json()
      if (audioRef.current) {
        audioRef.current.src = data.downloadUrl
        audioRef.current.load()
      }
    } catch (err: any) {
      setError(err.message || 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      setIsPlaying(!isPlaying)
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
            onError={() => {
              setError('再生エラーが発生しました')
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
          </div>
        </>
      )}
    </div>
  )
}

