'use client'

import { useState, useEffect } from 'react'
import MusicPlayer from '@/components/MusicPlayer'
import FileList from '@/components/FileList'
import SearchBar from '@/components/SearchBar'
import AuthButton from '@/components/AuthButton'
import { useGoogleDrive } from '@/hooks/useGoogleDrive'
import styles from './page.module.css'

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFile, setSelectedFile] = useState<any>(null)
  const { 
    files, 
    loading, 
    error, 
    isAuthenticated, 
    authenticate, 
    searchFiles,
    loadFiles 
  } = useGoogleDrive()

  useEffect(() => {
    if (isAuthenticated && searchQuery) {
      searchFiles(searchQuery)
    } else if (isAuthenticated && !searchQuery) {
      loadFiles()
    }
  }, [isAuthenticated, searchQuery])

  const handleSearch = (query: string) => {
    setSearchQuery(query)
  }

  const handleFileSelect = (file: any) => {
    setSelectedFile(file)
  }

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>🎵 Google Drive Music Player</h1>
          <AuthButton 
            isAuthenticated={isAuthenticated} 
            onAuthenticate={authenticate}
          />
        </header>

        {!isAuthenticated ? (
          <div className={styles.authPrompt}>
            <p>Google Driveにアクセスするには認証が必要です</p>
            <p>「Googleでログイン」ボタンをクリックしてください</p>
          </div>
        ) : (
          <>
            <SearchBar onSearch={handleSearch} />
            
            {error && (
              <div className={styles.error}>
                <p>エラー: {error}</p>
              </div>
            )}

            <FileList 
              files={files}
              loading={loading}
              onFileSelect={handleFileSelect}
              selectedFile={selectedFile}
            />

            {selectedFile && (
              <MusicPlayer file={selectedFile} />
            )}
          </>
        )}
      </div>
    </main>
  )
}

