"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react"

type ToastTone = "default" | "success" | "error"

type ToastInput = {
  title: string
  description?: string
  tone?: ToastTone
  durationMs?: number
  actionLabel?: string
  onAction?: () => void | Promise<void>
}

type ToastRecord = ToastInput & {
  id: string
}

const ToastContext = createContext<{
  pushToast: (input: ToastInput) => void
} | null>(null)

const toneClassName: Record<ToastTone, string> = {
  default: "border-white/12 bg-[rgba(10,15,27,0.88)] text-white",
  success: "border-emerald-400/20 bg-[rgba(3,32,24,0.92)] text-emerald-50",
  error: "border-rose-400/20 bg-[rgba(46,12,19,0.92)] text-rose-50",
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([])

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const pushToast = useCallback(
    (input: ToastInput) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const durationMs = input.durationMs ?? 4200

      setToasts((current) => [...current, { ...input, id }])

      window.setTimeout(() => {
        dismissToast(id)
      }, durationMs)
    },
    [dismissToast],
  )

  const value = useMemo(() => ({ pushToast }), [pushToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[120] flex w-full max-w-sm flex-col gap-3 sm:right-6 sm:top-6">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto overflow-hidden rounded-[22px] border p-4 shadow-[0_24px_80px_rgba(0,0,0,0.36)] backdrop-blur-2xl transition ${toneClassName[toast.tone ?? "default"]}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold tracking-[-0.02em]">
                  {toast.title}
                </p>
                {toast.description ? (
                  <p className="mt-1 text-sm leading-6 opacity-80">
                    {toast.description}
                  </p>
                ) : null}
                {toast.actionLabel && toast.onAction ? (
                  <button
                    type="button"
                    className="mt-3 rounded-full border border-white/12 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/82 transition hover:border-white/20 hover:text-white"
                    onClick={() => {
                      void toast.onAction?.()
                      dismissToast(toast.id)
                    }}
                  >
                    {toast.actionLabel}
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="Dismiss notification"
                className="rounded-full border border-white/12 px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-white/70 transition hover:border-white/20 hover:text-white"
                onClick={() => dismissToast(toast.id)}
              >
                Close
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)

  if (!context) {
    throw new Error("useToast must be used within ToastProvider.")
  }

  return context
}
