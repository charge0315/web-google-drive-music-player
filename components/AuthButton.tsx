'use client'

import styles from './AuthButton.module.css'

interface AuthButtonProps {
  isAuthenticated: boolean
  onAuthenticate: () => void
}

export default function AuthButton({ isAuthenticated, onAuthenticate }: AuthButtonProps) {
  return (
    <button 
      onClick={onAuthenticate}
      className={styles.button}
      disabled={isAuthenticated}
    >
      {isAuthenticated ? '✓ 認証済み' : 'Googleでログイン'}
    </button>
  )
}

