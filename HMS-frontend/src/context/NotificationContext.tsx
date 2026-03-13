import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

type NotificationType = 'success' | 'error' | 'warning' | 'info'

interface Notification {
    id: string
    type: NotificationType
    message: string
}

interface NotificationContextValue {
    notifications: Notification[]
    notify: (message: string, type?: NotificationType) => void
    dismiss: (id: string) => void
}

// ── Context ──────────────────────────────────────────────────────────────────

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined)

// ── Provider ─────────────────────────────────────────────────────────────────

export function NotificationProvider({ children }: { children: ReactNode }) {
    const [notifications, setNotifications] = useState<Notification[]>([])

    const dismiss = useCallback((id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id))
    }, [])

    const notify = useCallback((message: string, type: NotificationType = 'info') => {
        const id = crypto.randomUUID()
        setNotifications(prev => [...prev, { id, type, message }])
        // Auto-dismiss after 4 seconds
        setTimeout(() => dismiss(id), 4000)
    }, [dismiss])

    return (
        <NotificationContext.Provider value={{ notifications, notify, dismiss }}>
            {children}
            {/* Toast container */}
            <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-80">
                {notifications.map(n => (
                    <div
                        key={n.id}
                        className={`flex items-start gap-3 p-3 rounded-lg shadow-lg text-sm font-medium
              ${n.type === 'success' ? 'bg-emerald-500 text-white' : ''}
              ${n.type === 'error' ? 'bg-red-500 text-white' : ''}
              ${n.type === 'warning' ? 'bg-amber-500 text-white' : ''}
              ${n.type === 'info' ? 'bg-blue-500 text-white' : ''}
              animate-in slide-in-from-right-4 duration-200`}
                    >
                        <span className="flex-1">{n.message}</span>
                        <button onClick={() => dismiss(n.id)} className="ml-auto opacity-75 hover:opacity-100">✕</button>
                    </div>
                ))}
            </div>
        </NotificationContext.Provider>
    )
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useNotification() {
    const ctx = useContext(NotificationContext)
    if (!ctx) throw new Error('useNotification must be used inside <NotificationProvider>')
    return ctx
}
