import { useState, useEffect, useCallback } from 'react'
import type { DashboardConfig } from '../types/config'

const LS_CONFIG_KEY = 'dashboard-config'

function loadLocalConfig(): DashboardConfig | null {
  try {
    const raw = localStorage.getItem(LS_CONFIG_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveLocalConfig(config: DashboardConfig): void {
  localStorage.setItem(LS_CONFIG_KEY, JSON.stringify(config))
}

function clearLocalConfig(): void {
  localStorage.removeItem(LS_CONFIG_KEY)
}

export function useConfig() {
  const [config, setConfig] = useState<DashboardConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [isOverridden, setIsOverridden] = useState(false)

  useEffect(() => {
    let cancelled = false
    const localConfig = loadLocalConfig()
    if (localConfig) {
      // Defer to avoid sync setState in effect
      Promise.resolve().then(() => {
        if (cancelled) return
        setConfig(localConfig)
        setIsOverridden(true)
        setLoading(false)
      })
      return () => { cancelled = true }
    }

    fetch(`${import.meta.env.BASE_URL}data/config.json`)
      .then(r => r.ok ? r.json() : null)
      .then((data: DashboardConfig | null) => {
        if (cancelled) return
        setConfig(data)
        setLoading(false)
      })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const updateConfig = useCallback((newConfig: DashboardConfig) => {
    saveLocalConfig(newConfig)
    setConfig(newConfig)
    setIsOverridden(true)
  }, [])

  const resetConfig = useCallback(() => {
    clearLocalConfig()
    setIsOverridden(false)
    fetch(`${import.meta.env.BASE_URL}data/config.json`)
      .then(r => r.ok ? r.json() : null)
      .then((data: DashboardConfig | null) => setConfig(data))
      .catch(() => {})
  }, [])

  return { config, loading, isOverridden, updateConfig, resetConfig }
}
