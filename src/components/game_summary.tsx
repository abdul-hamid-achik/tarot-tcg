'use client'

import {
  BarChart3,
  Clock,
  Flame,
  Heart,
  Home,
  Layers,
  RotateCcw,
  Sparkles,
  Swords,
  Trophy,
  Wand2,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AchievementProgress, GameRecord } from '@/schemas/stats_schema'
import { achievementService } from '@/services/achievement_service'

interface GameSummaryProps {
  outcome: 'player1_wins' | 'player2_wins'
  gameRecord: GameRecord | null
  newAchievements: AchievementProgress[]
  onPlayAgain: () => void
  onReturnHome: () => void
}

const DIFFICULTY_LABEL: Record<GameRecord['difficulty'], string> = {
  tutorial: 'Training',
  easy: 'Novice',
  normal: 'Apprentice',
  hard: 'Master',
  expert: 'Oracle',
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins === 0) return `${secs}s`
  return `${mins}m ${secs}s`
}

function getWinConditionText(
  outcome: 'player1_wins' | 'player2_wins',
  record: GameRecord | null,
): string {
  if (!record) {
    return outcome === 'player1_wins' ? 'You emerged victorious!' : 'Better luck next time.'
  }

  const isVictory = outcome === 'player1_wins'

  if (isVictory) {
    if (record.opponentHealthRemaining <= 0) {
      return "Opponent's nexus destroyed"
    }
    return 'Victory achieved'
  }

  if (record.playerHealthRemaining <= 0) {
    return 'Your nexus was destroyed'
  }
  return 'Defeated by the opponent'
}

function StatItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1.5">
      <div className="shrink-0 text-muted-foreground">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold tabular-nums text-foreground">{value}</div>
      </div>
    </div>
  )
}

export function GameSummary({
  outcome,
  gameRecord,
  newAchievements,
  onPlayAgain,
  onReturnHome,
}: GameSummaryProps) {
  const [visible, setVisible] = useState(false)
  const playAgainRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 50)
    playAgainRef.current?.focus()
    return () => clearTimeout(timer)
  }, [])

  const isVictory = outcome === 'player1_wins'
  const winConditionText = getWinConditionText(outcome, gameRecord)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-summary-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4"
    >
      <div
        className={cn(
          'flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl transition-transform duration-300 ease-out',
          visible ? 'scale-100 opacity-100' : 'scale-95 opacity-0',
        )}
      >
        <header
          className={cn(
            'shrink-0 px-5 pt-4 pb-2 text-center',
            isVictory ? 'bg-amber-500/10' : 'bg-red-500/10',
          )}
        >
          {isVictory ? (
            <Trophy className="mx-auto mb-1 h-7 w-7 text-amber-500" aria-hidden="true" />
          ) : (
            <Swords className="mx-auto mb-1 h-7 w-7 text-red-500" aria-hidden="true" />
          )}
          <h2
            id="game-summary-title"
            className={cn(
              'text-2xl font-black sm:text-3xl',
              isVictory ? 'text-amber-500' : 'text-red-500',
            )}
          >
            {isVictory ? 'VICTORY' : 'DEFEAT'}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{winConditionText}</p>
          {gameRecord && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {DIFFICULTY_LABEL[gameRecord.difficulty]} · {gameRecord.deckName}
            </p>
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {gameRecord && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">Game Stats</h3>
              <div className="grid grid-cols-2 gap-2">
                <StatItem
                  icon={<Layers className="h-4 w-4" />}
                  label="Rounds Played"
                  value={gameRecord.rounds}
                />
                <StatItem
                  icon={<Clock className="h-4 w-4" />}
                  label="Duration"
                  value={formatDuration(gameRecord.durationSeconds)}
                />
                <StatItem
                  icon={<Sparkles className="h-4 w-4" />}
                  label="Cards Played"
                  value={gameRecord.cardsPlayed}
                />
                <StatItem
                  icon={<Flame className="h-4 w-4" />}
                  label="Damage Dealt"
                  value={gameRecord.damageDealt}
                />
                <StatItem
                  icon={<Swords className="h-4 w-4" />}
                  label="Units Summoned"
                  value={gameRecord.unitsPlayed}
                />
                <StatItem
                  icon={<Wand2 className="h-4 w-4" />}
                  label="Spells Cast"
                  value={gameRecord.spellsPlayed}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center justify-between rounded-md border border-border px-2.5 py-1.5 text-sm">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Heart className="h-3.5 w-3.5 text-green-600" aria-hidden="true" />
                    You
                  </span>
                  <span className="font-semibold tabular-nums">
                    {Math.max(0, gameRecord.playerHealthRemaining)} HP
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-md border border-border px-2.5 py-1.5 text-sm">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Heart className="h-3.5 w-3.5 text-red-600" aria-hidden="true" />
                    Opponent
                  </span>
                  <span className="font-semibold tabular-nums">
                    {Math.max(0, gameRecord.opponentHealthRemaining)} HP
                  </span>
                </div>
              </div>
            </div>
          )}

          {newAchievements.length > 0 && (
            <div className={cn('space-y-2', gameRecord && 'mt-4 border-t border-border pt-3')}>
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                Achievements Earned
              </h3>
              <div className="space-y-2">
                {newAchievements.map(achievement => {
                  const def = achievementService.getDefinition(achievement.id)
                  if (!def) return null

                  return (
                    <div
                      key={achievement.id}
                      title={def.description}
                      className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1"
                    >
                      <div className="text-base" aria-hidden="true">
                        {def.icon}
                      </div>
                      <div className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                        {def.name}
                        <span className="sr-only">. {def.description}</span>
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        New
                      </Badge>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-border bg-card px-5 py-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button ref={playAgainRef} onClick={onPlayAgain} className="flex-1">
              <RotateCcw className="h-4 w-4" />
              Play Again
            </Button>
            <Button onClick={onReturnHome} variant="outline" className="flex-1">
              <Home className="h-4 w-4" />
              Return Home
            </Button>
            <Link href="/stats" className="flex-1">
              <Button variant="ghost" className="w-full">
                <BarChart3 className="h-4 w-4" />
                View Stats
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
