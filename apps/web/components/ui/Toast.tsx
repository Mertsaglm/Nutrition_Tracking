'use client'

import { createContext, useCallback, useContext, useState } from 'react'
import { CheckCircle2, AlertCircle, Info, XCircle } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface ToastItem {
  id: number
  type: ToastType
  message: string
}

const ToastContext = createContext<{ toast: (type: ToastType, message: string) => void }>({
  toast: () => {},
})

export function useToast() {
  return useContext(ToastContext)
}

const STYLES: Record<ToastType, { bar: string; icon: typeof Info }> = {
  success: { bar: 'border-l-brand-500', icon: CheckCircle2 },
  error: { bar: 'border-l-danger', icon: XCircle },
  warning: { bar: 'border-l-accent-500', icon: AlertCircle },
  info: { bar: 'border-l-info', icon: Info },
}

const ICON_COLOR: Record<ToastType, string> = {
  success: 'text-brand-600',
  error: 'text-danger',
  warning: 'text-accent-500',
  info: 'text-info',
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const toast = useCallback((type: ToastType, message: string) => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, type, message }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => {
          const { bar, icon: Icon } = STYLES[t.type]
          return (
            <div
              key={t.id}
              className={`flex items-start gap-3 rounded-xl border border-neutral-200 border-l-4 bg-white p-4 shadow-lg animate-slide-up ${bar}`}
              role="status"
            >
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${ICON_COLOR[t.type]}`} />
              <p className="text-sm text-neutral-700">{t.message}</p>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
