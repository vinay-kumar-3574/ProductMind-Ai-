import React from 'react'
import { useApp } from '../../context/AppContext'
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X, RotateCcw } from 'lucide-react'

export function ToastContainer() {
  const { toasts, removeToast } = useApp()

  if (!toasts || toasts.length === 0) return null

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />,
    info: <Info className="w-5 h-5 text-electric-500 shrink-0" />,
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-center justify-between p-3.5 bg-white dark:bg-navy-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl transition-all duration-200 transform translate-y-0"
        >
          <div className="flex items-center gap-3">
            {icons[toast.type] || icons.info}
            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{toast.message}</span>
          </div>
          <div className="flex items-center gap-2 ml-4">
            {toast.undoAction && (
              <button
                onClick={() => {
                  toast.undoAction()
                  removeToast(toast.id)
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline px-2 py-1 rounded bg-brand-50 dark:bg-brand-950/50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Undo
              </button>
            )}
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-md"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
