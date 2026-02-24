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
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { AchievementProgress, GameRecord } from '@/schemas/stats_schema'
import { achievementService } from '@/services/achievement_service'

interface GameSummaryProps {
  outcome: 'player1_wins' | 'player2_wins'
  gameRecord: GameRecord | null
  newAchievements: AchievementProgress[]
  onPlayAgain: () => void
  onReturnHome: () => void
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

interface StatItemProps {
  icon: React.ReactNode
  label: string
  value: string | number
}

function StatItem({ icon, label, value }: StatItemProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
      <div className="text-muted-foreground shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold text-foreground">{value}</div>
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

  useEffect(() => {
    // Trigger entrance animation
    const timer = setTimeout(() => setVisible(true), 50)
    return () => clearTimeout(timer)
  }, [])

  const isVictory = outcome === 'player1_wins'
  const winConditionText = getWinConditionText(outcome, gameRecord)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-summary-title"
      className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
    >
      <div
        className={`bg-card/95 border border-border rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto transition-all duration-500 ease-out ${
          visible ? 'scale-100 opacity-100' : 'scale-90 opacity-0'
        }`}
      >
        {/* Result Banner */}
        <div
          className={`px-6 pt-8 pb-4 text-center ${
            isVictory
              ? 'bg-gradient-to-b from-amber-500/20 to-transparent'
              : 'bg-gradient-to-b from-red-500/20 to-transparent'
          }`}
        >
          <div className="mb-2">
            {isVictory ? (
              <Trophy className="w-12 h-12 mx-auto text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.5)]" />
            ) : (
              <Swords className="w-12 h-12 mx-auto text-red-400 drop-shadow-[0_0_12px_rgba(239,68,68,0.5)]" />
            )}
          </div>
          <h2
            id="game-summary-title"
            className={`text-4xl font-black tracking-tight ${
              isVictory
                ? 'text-amber-400 drop-shadow-[0_0_20px_rgba(251,191,36,0.4)]'
                : 'text-red-400 drop-shadow-[0_0_20px_rgba(239,68,68,0.4)]'
            }`}
          >
            {isVictory ? 'VICTORY' : 'DEFEAT'}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">{winConditionText}</p>
        </div>

        {/* Game Stats */}
        {gameRecord && (
          <div className="px-6 py-4 space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Game Stats
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <StatItem
                icon={<Layers className="w-4 h-4" />}
                label="Rounds Played"
                value={gameRecord.rounds}
              />
              <StatItem
                icon={<Clock className="w-4 h-4" />}
                label="Duration"
                value={formatDuration(gameRecord.durationSeconds)}
              />
              <StatItem
                icon={<Sparkles className="w-4 h-4" />}
                label="Cards Played"
                value={gameRecord.cardsPlayed}
              />
              <StatItem
                icon={<Flame className="w-4 h-4" />}
                label="Damage Dealt"
                value={gameRecord.damageDealt}
              />
              <StatItem
                icon={<Swords className="w-4 h-4" />}
                label="Units Summoned"
                value={gameRecord.unitsPlayed}
              />
              <StatItem
                icon={<Wand2 className="w-4 h-4" />}
                label="Spells Cast"
                value={gameRecord.spellsPlayed}
              />
            </div>

            {/* Health Summary */}
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-green-400" />
                <span className="text-muted-foreground">Your Nexus</span>
              </div>
              <span className="font-semibold text-foreground">
                {Math.max(0, gameRecord.playerHealthRemaining)} HP
              </span>
            </div>
          </div>
        )}

        {/* Achievements Earned */}
        {newAchievements.length > 0 && (
          <div className="px-6 py-4 space-y-3 border-t border-border">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Achievements Earned
            </h3>
            <div className="space-y-2">
              {newAchievements.map(achievement => {
                const def = achievementService.getDefinition(achievement.id)
                if (!def) return null

                return (
                  <div
                    key={achievement.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20"
                  >
                    <div className="text-2xl">{def.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-foreground">{def.name}</div>
                      <div className="text-xs text-muted-foreground">{def.description}</div>
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

        {/* Action Buttons */}
        <div className="px-6 pt-2 pb-6">
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={onPlayAgain} className="flex-1" size="lg">
              <RotateCcw className="w-4 h-4" />
              Play Again
            </Button>
            <Button onClick={onReturnHome} variant="outline" className="flex-1" size="lg">
              <Home className="w-4 h-4" />
              Return Home
            </Button>
            <Link href="/stats" className="flex-1">
              <Button variant="ghost" className="w-full" size="lg">
                <BarChart3 className="w-4 h-4" />
                View Stats
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
