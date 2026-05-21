import { useCallback } from 'react'
import { useForceSyncPat } from './useForceSyncPat'

export interface GithubApiOptions extends RequestInit {
  expect?: 'json' | 'text' | 'none'
}

export interface GithubApiResult<T> {
  ok: boolean
  status: number
  data: T | null
  rateLimitRemaining: number | null
  rateLimitReset: number | null
  errorMessage: string | null
}

export function useGithubApi() {
  const { token, clear } = useForceSyncPat()

  const call = useCallback(async <T = unknown>(
    pathOrUrl: string,
    opts: GithubApiOptions = {}
  ): Promise<GithubApiResult<T>> => {
    const { expect = 'json', headers, ...rest } = opts
    const url = pathOrUrl.startsWith('http') ? pathOrUrl : `https://api.github.com${pathOrUrl}`
    const finalHeaders: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      ...(headers as Record<string, string> | undefined),
    }
    if (token) finalHeaders.Authorization = `Bearer ${token}`

    let res: Response
    try {
      res = await fetch(url, { ...rest, headers: finalHeaders })
    } catch (e) {
      return {
        ok: false, status: 0, data: null,
        rateLimitRemaining: null, rateLimitReset: null,
        errorMessage: e instanceof Error ? e.message : 'network error',
      }
    }

    const rateLimitRemaining = res.headers.get('X-RateLimit-Remaining')
    const rateLimitReset = res.headers.get('X-RateLimit-Reset')

    if (res.status === 401 && token) {
      clear()
    }

    let data: T | null = null
    if (res.ok && expect === 'json') {
      data = await res.json() as T
    } else if (res.ok && expect === 'text') {
      data = (await res.text()) as unknown as T
    }

    return {
      ok: res.ok, status: res.status, data,
      rateLimitRemaining: rateLimitRemaining ? Number(rateLimitRemaining) : null,
      rateLimitReset: rateLimitReset ? Number(rateLimitReset) : null,
      errorMessage: res.ok ? null : `HTTP ${res.status}`,
    }
  }, [token, clear])

  return { call, hasToken: !!token }
}
