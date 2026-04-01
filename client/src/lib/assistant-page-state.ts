"use client"

import { useEffect } from "react"

export const ASSISTANT_PAGE_STATE_EVENT = "tib:assistant-page-state"

declare global {
  interface Window {
    __TIB_ASSISTANT_PAGE_STATE__?: Record<string, unknown> | null
  }
}

export function readAssistantPageState() {
  if (typeof window === "undefined") {
    return null
  }

  return window.__TIB_ASSISTANT_PAGE_STATE__ ?? null
}

export function useAssistantPageState(state: Record<string, unknown> | null) {
  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    window.__TIB_ASSISTANT_PAGE_STATE__ = state
    window.dispatchEvent(new CustomEvent(ASSISTANT_PAGE_STATE_EVENT, { detail: state }))

    return () => {
      window.__TIB_ASSISTANT_PAGE_STATE__ = null
      window.dispatchEvent(new CustomEvent(ASSISTANT_PAGE_STATE_EVENT, { detail: null }))
    }
  }, [state])
}
