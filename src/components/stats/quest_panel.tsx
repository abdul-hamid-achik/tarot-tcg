'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { QuestDefinition, QuestProgress } from '@/schemas/quest_schema'
import { questService } from '@/services/quest_service'

interface QuestPanelProps {
  variant: 'page' | 'compact'
}

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return 'Refreshing...'
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }
  return `${seconds}s`
}

function QuestItem({
  quest,
  definition,
  onClaim,
  compact,
}: {
  quest: QuestProgress
  definition: QuestDefinition | undefined
  onClaim: (questId: string) => void
  compact: boolean
}) {
  if (!definition) return null

  const progressPercent = Math.min((quest.currentValue / quest.targetValue) * 100, 100)
  const canClaim = quest.completed && !quest.claimed

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border border-border bg-card p-3',
        canClaim && 'border-primary/50 bg-primary/5',
        quest.claimed && 'opacity-60',
      )}
    >
      <div className={cn('text-xl', compact ? 'text-lg' : 'text-2xl')}>{definition.icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn('truncate font-medium text-foreground', compact ? 'text-xs' : 'text-sm')}
          >
            {definition.name}
          </span>
          {!compact && (
            <span className="shrink-0 text-xs text-muted-foreground">
              +{definition.rewardXP} XP
            </span>
          )}
        </div>
        {!compact && (
          <p className="mt-0.5 text-xs text-muted-foreground">{definition.description}</p>
        )}
        <div className="mt-1.5 flex items-center gap-2">
          <Progress value={progressPercent} className={cn('h-1.5 flex-1', compact && 'h-1')} />
          <span
            className={cn(
              'shrink-0 tabular-nums text-muted-foreground',
              compact ? 'text-[10px]' : 'text-xs',
            )}
          >
            {quest.currentValue}/{quest.targetValue}
          </span>
        </div>
        {canClaim && (
          <Button size="sm" className="mt-2 h-7 text-xs" onClick={() => onClaim(quest.questId)}>
            Claim +{definition.rewardXP} XP
          </Button>
        )}
        {quest.claimed && (
          <span className="mt-1 inline-block text-xs text-muted-foreground">Claimed</span>
        )}
      </div>
    </div>
  )
}

export function QuestPanel({ variant }: QuestPanelProps) {
  const compact = variant === 'compact'
  const [quests, setQuests] = useState<{ daily: QuestProgress[]; weekly: QuestProgress[] }>({
    daily: [],
    weekly: [],
  })
  const [dailyTimeLeft, setDailyTimeLeft] = useState(0)
  const [weeklyTimeLeft, setWeeklyTimeLeft] = useState(0)
  const [level, setLevel] = useState(1)
  const [totalXP, setTotalXP] = useState(0)

  const refreshState = useCallback(() => {
    questService.refreshQuests()
    setQuests(questService.getActiveQuests())
    setDailyTimeLeft(questService.getDailyTimeRemaining())
    setWeeklyTimeLeft(questService.getWeeklyTimeRemaining())
    setLevel(questService.getLevel())
    setTotalXP(questService.getXP())
  }, [])

  useEffect(() => {
    refreshState()
  }, [refreshState])

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      setDailyTimeLeft(questService.getDailyTimeRemaining(now))
      setWeeklyTimeLeft(questService.getWeeklyTimeRemaining(now))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const handleClaim = useCallback(
    (questId: string) => {
      questService.claimQuest(questId)
      refreshState()
    },
    [refreshState],
  )

  const levelProgress = questService.getCurrentLevelProgress(totalXP, level)
  const levelPercent = Math.min((levelProgress.current / levelProgress.required) * 100, 100)

  return (
    <div className={cn('flex flex-col gap-4', compact ? 'w-full max-w-xs' : 'w-full')}>
      {/* Level & XP Display */}
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex items-center justify-between">
          <span className={cn('font-semibold text-foreground', compact ? 'text-sm' : 'text-base')}>
            Level {level}
          </span>
          <span className="text-xs text-muted-foreground">{totalXP} XP total</span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Progress value={levelPercent} className="h-2 flex-1" />
          <span className="text-xs tabular-nums text-muted-foreground">
            {levelProgress.current}/{levelProgress.required}
          </span>
        </div>
      </div>

      {/* Daily Quests */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3
            className={cn(
              'font-semibold text-foreground',
              compact ? 'text-xs uppercase tracking-wide' : 'text-sm',
            )}
          >
            Daily Quests
          </h3>
          <span className="text-xs text-muted-foreground">
            {formatTimeRemaining(dailyTimeLeft)}
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {quests.daily.map(quest => (
            <QuestItem
              key={quest.questId}
              quest={quest}
              definition={questService.getDefinition(quest.questId)}
              onClaim={handleClaim}
              compact={compact}
            />
          ))}
          {quests.daily.length === 0 && (
            <p className="text-center text-xs text-muted-foreground">No daily quests available</p>
          )}
        </div>
      </div>

      {/* Weekly Quests */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3
            className={cn(
              'font-semibold text-foreground',
              compact ? 'text-xs uppercase tracking-wide' : 'text-sm',
            )}
          >
            Weekly Quests
          </h3>
          <span className="text-xs text-muted-foreground">
            {formatTimeRemaining(weeklyTimeLeft)}
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {quests.weekly.map(quest => (
            <QuestItem
              key={quest.questId}
              quest={quest}
              definition={questService.getDefinition(quest.questId)}
              onClaim={handleClaim}
              compact={compact}
            />
          ))}
          {quests.weekly.length === 0 && (
            <p className="text-center text-xs text-muted-foreground">No weekly quests available</p>
          )}
        </div>
      </div>
    </div>
  )
}
