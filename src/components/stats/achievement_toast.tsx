'use client'

import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { AchievementProgress } from '@/schemas/stats_schema'
import { achievementService } from '@/services/achievement_service'

interface AchievementToastProps {
  achievements: AchievementProgress[]
  onDismiss: () => void
}

interface ToastItem {
  achievement: AchievementProgress
  visible: boolean
}

export function AchievementToast({ achievements, onDismiss }: AchievementToastProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    if (achievements.length === 0) return

    const items = achievements.map(a => ({ achievement: a, visible: false }))
    setToasts(items)

    // Stagger entry animations
    for (let i = 0; i < items.length; i++) {
      setTimeout(() => {
        setToasts(prev => prev.map((t, idx) => (idx === i ? { ...t, visible: true } : t)))
      }, i * 200)
    }

    // Auto-dismiss after 4 seconds
    const timer = setTimeout(() => {
      setToasts(prev => prev.map(t => ({ ...t, visible: false })))
      setTimeout(onDismiss, 300)
    }, 4000)

    return () => clearTimeout(timer)
  }, [achievements, onDismiss])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
      {toasts.map(toast => {
        const def = achievementService.getDefinition(toast.achievement.id)
        if (!def) return null

        return (
          <div
            key={toast.achievement.id}
            className={`bg-card border border-border rounded-lg p-4 shadow-lg flex items-center gap-3 min-w-[280px] transition-all duration-300 ${
              toast.visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
            }`}
          >
            <div className="text-2xl">{def.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-primary uppercase tracking-wide">
                Achievement Unlocked
              </div>
              <div className="font-semibold text-foreground text-sm">{def.name}</div>
              <div className="text-xs text-muted-foreground">{def.description}</div>
            </div>
            <button
              type="button"
              onClick={() => {
                setToasts(prev => prev.filter(t => t.achievement.id !== toast.achievement.id))
                if (toasts.length <= 1) onDismiss()
              }}
              className="text-muted-foreground hover:text-foreground p-1"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
