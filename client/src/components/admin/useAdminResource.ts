"use client"

import { startTransition, useCallback, useEffect, useRef, useState } from "react"

export function useAdminResource<T>(
  loader: () => Promise<T>,
  deps: unknown[] = [],
  options?: {
    refreshIntervalMs?: number
  },
) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastLoadedAt, setLastLoadedAt] = useState<number | null>(null)
  const hasDataRef = useRef(false)

  useEffect(() => {
    hasDataRef.current = data !== null
  }, [data])

  const executeLoad = useCallback(async (mode: "initial" | "background" = "initial") => {
    const hasData = hasDataRef.current

    if (mode === "background" && hasData) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }

    setError(null)

    try {
      const result = await loader()
      startTransition(() => {
        setData(result)
        setLastLoadedAt(Date.now())
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data.")
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps

  const reload = useCallback(async (mode: "manual" | "background" = "manual") => {
    await executeLoad(mode === "background" ? "background" : "initial")
  }, [executeLoad])

  useEffect(() => {
    void executeLoad(hasDataRef.current ? "background" : "initial")
  }, [executeLoad])

  useEffect(() => {
    if (!options?.refreshIntervalMs) {
      return
    }

    const intervalId = window.setInterval(() => {
      void executeLoad("background")
    }, options.refreshIntervalMs)

    return () => window.clearInterval(intervalId)
  }, [executeLoad, options?.refreshIntervalMs])

  return {
    data,
    error,
    isLoading,
    isRefreshing,
    lastLoadedAt,
    reload,
  }
}
