'use client'

import { Heart, SkipForward, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { isActionPhase, type Player } from '@/schemas/schema'
import { useGameStore } from '@/store/game_store'

interface PlayerInfoPanelProps {
  player: Player
  isCurrentPlayer?: boolean
  onEndTurn?: () => void
  className?: string
}

export default function PlayerInfoPanel({
  player,
  isCurrentPlayer = false,
  onEndTurn,
  className = '',
}: PlayerInfoPanelProps) {
  const { gameState } = useGameStore()

  const isActive = gameState?.activePlayer === player?.id

  const canEndTurn =
    isCurrentPlayer &&
    isActive &&
    Boolean(onEndTurn) &&
    gameState != null &&
    isActionPhase(gameState)

  const name = isCurrentPlayer ? 'You' : 'Opponent'
  const healthLabel = `${player.health} life`

  return (
    <div
      className={cn('w-full max-w-3xl shrink-0', className)}
      data-player-panel={player.id}
      id={`nexus-${player.id}`}
    >
      <div
        className={cn(
          'flex h-10 items-center gap-2 overflow-hidden rounded-md border bg-card px-2 text-sm',
          isActive ? 'border-foreground' : 'border-border',
        )}
      >
        <h3 className="shrink-0 font-semibold">{name}</h3>
        {isActive && (
          <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
            {isCurrentPlayer ? 'Your turn' : 'Acting'}
          </span>
        )}

        <span className="inline-flex items-center gap-1 tabular-nums">
          <Heart className="h-3.5 w-3.5 text-red-600" aria-hidden="true" />
          {healthLabel}
        </span>
        <span className="inline-flex items-center gap-1 tabular-nums">
          <Zap className="h-3.5 w-3.5" aria-hidden="true" />
          {player.mana}/{player.maxMana}
          {player.spellMana > 0 ? `+${player.spellMana}` : ''}
        </span>
        <span className="hidden text-xs text-muted-foreground sm:inline">
          {player.hand.length} in hand
        </span>

        {isCurrentPlayer && isActive && gameState?.phase === 'action' && (
          <span className="text-xs text-muted-foreground">
            {player.hasReadThisTurn ? 'Reading done' : 'Lay a reading'}
          </span>
        )}

        {canEndTurn && (
          <Button type="button" size="sm" className="ml-auto h-7 px-2" onClick={onEndTurn}>
            <SkipForward className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            End Turn
          </Button>
        )}

        {isCurrentPlayer && !isActive && gameState?.phase === 'action' && (
          <span className="ml-auto text-xs text-muted-foreground">Opponent acting</span>
        )}
      </div>
    </div>
  )
}
