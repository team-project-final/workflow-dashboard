import { useState, useCallback } from 'react'

const LS_KEY = 'forceSync.pat'
const LS_OWNER_KEY = 'forceSync.patOwner'

export interface PatState {
  token: string | null
  owner: string | null
}

export function useForceSyncPat() {
  const [state, setState] = useState<PatState>(() => ({
    token: localStorage.getItem(LS_KEY),
    owner: localStorage.getItem(LS_OWNER_KEY),
  }))
  const [validating, setValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = useCallback(async (token: string): Promise<boolean> => {
    setValidating(true)
    setError(null)
    try {
      const res = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
      })
      if (!res.ok) {
        setError(res.status === 401 ? '토큰이 유효하지 않습니다 (401)' : `검증 실패: HTTP ${res.status}`)
        return false
      }
      const body = await res.json() as { login: string }
      localStorage.setItem(LS_KEY, token)
      localStorage.setItem(LS_OWNER_KEY, body.login)
      setState({ token, owner: body.login })
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : '네트워크 오류')
      return false
    } finally {
      setValidating(false)
    }
  }, [])

  const clear = useCallback(() => {
    localStorage.removeItem(LS_KEY)
    localStorage.removeItem(LS_OWNER_KEY)
    setState({ token: null, owner: null })
    setError(null)
  }, [])

  return { ...state, validating, error, save, clear }
}
