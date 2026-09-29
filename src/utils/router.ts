import { useEffect, useState } from 'react'

// ライブラリを増やさないための、#/path?query 形式の簡易ルーター
export function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash)

  useEffect(() => {
    const onChange = () => {
      setHash(window.location.hash)
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const [path, query = ''] = (hash.replace(/^#/, '') || '/').split('?')
  return { segments: path.split('/').filter(Boolean), params: new URLSearchParams(query) }
}

export function navigate(to: string) {
  window.location.hash = to
}
