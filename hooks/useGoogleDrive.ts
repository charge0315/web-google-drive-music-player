'use client'

import { useState, useCallback } from 'react'

interface File {
  id: string
  name: string
  mimeType: string
  size?: string
  modifiedTime?: string
}

export function useGoogleDrive() {
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  const authenticate = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/drive/auth')
      if (!response.ok) {
        throw new Error('認証に失敗しました')
      }
      
      const data = await response.json()
      if (data.authUrl) {
        // 新しいウィンドウで認証を開く
        const authWindow = window.open(
          data.authUrl,
          'Google認証',
          'width=500,height=600'
        )
        
        // 認証完了を待つ（実際の実装では、ポーリングやメッセージングを使用）
        const checkAuth = setInterval(async () => {
          try {
            const statusResponse = await fetch('/api/drive/auth/status')
            const statusData = await statusResponse.json()
            
            if (statusData.authenticated) {
              clearInterval(checkAuth)
              if (authWindow) authWindow.close()
              setIsAuthenticated(true)
              setLoading(false)
              await loadFiles()
            }
          } catch (err) {
            // エラーは無視（認証がまだ完了していない可能性）
          }
        }, 1000)
        
        // 10分後にタイムアウト
        setTimeout(() => {
          clearInterval(checkAuth)
          if (authWindow) authWindow.close()
          if (!isAuthenticated) {
            setError('認証がタイムアウトしました')
            setLoading(false)
          }
        }, 600000)
      } else {
        setIsAuthenticated(true)
        setLoading(false)
        await loadFiles()
      }
    } catch (err: any) {
      setError(err.message || '認証エラーが発生しました')
      setLoading(false)
    }
  }, [])

  const loadFiles = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/drive/files')
      if (!response.ok) {
        throw new Error('ファイルの取得に失敗しました')
      }
      
      const data = await response.json()
      setFiles(data.files || [])
    } catch (err: any) {
      setError(err.message || 'ファイルの読み込みエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }, [])

  const searchFiles = useCallback(async (query: string) => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/drive/search?q=${encodeURIComponent(query)}`)
      if (!response.ok) {
        throw new Error('検索に失敗しました')
      }
      
      const data = await response.json()
      setFiles(data.files || [])
    } catch (err: any) {
      setError(err.message || '検索エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    files,
    loading,
    error,
    isAuthenticated,
    authenticate,
    loadFiles,
    searchFiles,
  }
}

