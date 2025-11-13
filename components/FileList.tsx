'use client'

import styles from './FileList.module.css'

interface File {
  id: string
  name: string
  mimeType: string
  size?: string
  modifiedTime?: string
}

interface FileListProps {
  files: File[]
  loading: boolean
  onFileSelect: (file: File) => void
  selectedFile: File | null
}

export default function FileList({ files, loading, onFileSelect, selectedFile }: FileListProps) {
  const audioExtensions = ['.mp3', '.m4a', '.wav', '.ogg', '.flac', '.aac', '.wma']
  
  const isAudioFile = (fileName: string) => {
    return audioExtensions.some(ext => fileName.toLowerCase().endsWith(ext))
  }

  const formatFileSize = (bytes?: string) => {
    if (!bytes) return '不明'
    const size = parseInt(bytes)
    if (size < 1024) return size + ' B'
    if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB'
    return (size / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '不明'
    return new Date(dateString).toLocaleDateString('ja-JP')
  }

  if (loading) {
    return (
      <div className={styles.loading}>
        <p>読み込み中...</p>
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div className={styles.empty}>
        <p>音楽ファイルが見つかりませんでした</p>
      </div>
    )
  }

  const audioFiles = files.filter(file => isAudioFile(file.name))

  if (audioFiles.length === 0) {
    return (
      <div className={styles.empty}>
        <p>音楽ファイルが見つかりませんでした</p>
        <p className={styles.hint}>対応形式: MP3, M4A, WAV, OGG, FLAC, AAC, WMA</p>
      </div>
    )
  }

  return (
    <div className={styles.fileList}>
      <h2 className={styles.sectionTitle}>音楽ファイル ({audioFiles.length}件)</h2>
      <div className={styles.list}>
        {audioFiles.map((file) => (
          <div
            key={file.id}
            className={`${styles.fileItem} ${selectedFile?.id === file.id ? styles.selected : ''}`}
            onClick={() => onFileSelect(file)}
          >
            <div className={styles.fileIcon}>🎵</div>
            <div className={styles.fileInfo}>
              <div className={styles.fileName}>{file.name}</div>
              <div className={styles.fileMeta}>
                <span>{formatFileSize(file.size)}</span>
                <span>•</span>
                <span>{formatDate(file.modifiedTime)}</span>
              </div>
            </div>
            {selectedFile?.id === file.id && (
              <div className={styles.playingIndicator}>▶ 再生中</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

