'use client'

import { useState } from 'react'
import styles from './SearchBar.module.css'

interface SearchBarProps {
  onSearch: (query: string) => void
}

export default function SearchBar({ onSearch }: SearchBarProps) {
  const [query, setQuery] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSearch(query)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    if (e.target.value === '') {
      onSearch('')
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.searchForm}>
      <input
        type="text"
        value={query}
        onChange={handleChange}
        placeholder="曲名、アーティスト名で検索..."
        className={styles.searchInput}
      />
      <button type="submit" className={styles.searchButton}>
        🔍 検索
      </button>
    </form>
  )
}

