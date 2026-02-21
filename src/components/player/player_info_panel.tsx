'use client'

import { Heart, Layers, Moon, Sun, Sword, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Player } from '@/schemas/schema'
import { useGameStore } from '@/store/game_store'

interface PlayerInfoPanelProps {
  player: Player
  isCurrentPlayer?: boolean
  position: 'top-left' | 'bottom-right'
  onAttack?: () => void
  onDefend?: () => void
  onEndTurn?: () => void
  className?: string
}

export default function PlayerInfoPanel({
  player,
  isCurrentPlayer = false,
  position,
  onAttack: _onAttack,
  onDefend: _onDefend,
  onEndTurn: _onEndTurn,
  className = '',
}: PlayerInfoPanelProps) {
  const { gameState, interaction } = useGameStore()

  const isActive = gameState?.activePlayer === player?.id
  const isInAttackMode = interaction.targetingMode === 'attack'
  const _hasValidTargets = interaction.validAttackTargets.size > 0

  // Position-specific styles - responsive: compact on mobile, expanded on desktop
  const positionStyles = {
    'top-left': 'fixed top-2 left-2 md:top-4 md:left-4 z-50',
    'bottom-right': 'fixed bottom-2 left-2 md:bottom-4 md:left-4 z-50',
  }

  // Player-specific styling
  const getPlayerStyles = () => {
    if (isCurrentPlayer) {
      return {
        avatar: 'bg-foreground',
        avatarIcon: 'text-background',
        health: 'text-foreground',
        healthIcon: 'text-foreground',
      }
    } else {
      return {
        avatar: 'bg-muted-foreground',
        avatarIcon: 'text-background',
        health: 'text-foreground',
        healthIcon: 'text-foreground',
      }
    }
  }

  const _playerStyles = getPlayerStyles()

  // Check if can attack
  const _canAttack =
    isCurrentPlayer && player?.hasAttackToken && gameState?.phase === 'action' && isInAttackMode

  // Check if must defend (simplified - combat phase)
  // Note: In Hearthstone-style, there's no separate combat phase
  const _mustDefend = false

  // Render mana crystals for current player
  const _renderManaDisplay = () => {
    if (!isCurrentPlayer) {
      return (
        <div className="flex items-center gap-1">
          <Zap className="w-3 h-3 text-blue-500" />
          <span className="text-foreground font-semibold">
            {player.mana}/{player.maxMana}
          </span>
          {player.spellMana > 0 && <span className="text-blue-500">+{player.spellMana}</span>}
        </div>
      )
    }

    // Visual mana crystals for current player
    return (
      <div className="flex items-center gap-1">
        <div className="flex">
          {Array.from({ length: player.maxMana }, (_, i) => (
            <Zap
              key={`mana-${i}`}
              className={`w-3 h-3 ${i < player.mana ? 'text-foreground' : 'text-muted-foreground/40'}`}
            />
          ))}
        </div>
        {player.spellMana > 0 && <span className="text-muted-foreground">+{player.spellMana}</span>}
      </div>
    )
  }

  const unitCount = gameState
    ? player.id === 'player1'
      ? gameState.battlefield.playerUnits.filter(u => u !== null).length
      : gameState.battlefield.enemyUnits.filter(u => u !== null).length
    : 0

  return (
    <div className={cn(positionStyles[position], 'z-[60]', className)} data-player-panel={player.id}>
      <div
        className={cn(
          'relative p-3 rounded-2xl shadow-lg backdrop-blur-sm transition-all duration-300',
          'bg-card/95 border-2',
          isCurrentPlayer
            ? isActive
              ? 'border-emerald-400 shadow-emerald-200/50 dark:shadow-emerald-900/30'
              : 'border-border'
            : isActive
              ? 'border-amber-400 shadow-amber-200/50 dark:shadow-amber-900/30'
              : 'border-border',
        )}
      >
        {/* Active Turn Indicator */}
        {isActive && (
          <div
            className={cn(
              'absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide',
              isCurrentPlayer ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white',
            )}
          >
            Active
          </div>
        )}

        {/* Player Header */}
        <div className="flex items-center gap-2 mb-2">
          <div
            className={cn(
              'relative w-8 h-8 rounded-full flex items-center justify-center',
              isCurrentPlayer ? 'bg-foreground' : 'bg-muted-foreground',
            )}
          >
            {isCurrentPlayer ? (
              <Sun className="w-4 h-4 text-background" />
            ) : (
              <Moon className="w-4 h-4 text-background" />
            )}

            {/* Attack Token Overlay */}
            {player?.hasAttackToken && (
              <div className="absolute -top-1 -right-1 bg-amber-500 rounded-full p-0.5 ring-2 ring-card">
                <Sword className="w-2 h-2 text-white" />
              </div>
            )}
          </div>

          <div>
            <h3 className="font-bold text-sm text-foreground">
              {isCurrentPlayer ? 'You' : 'Opponent'}
            </h3>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          {/* Health */}
          <div
            className={cn(
              'flex items-center gap-1.5 px-2 py-1.5 rounded-lg',
              player.health <= 5 ? 'bg-red-100 dark:bg-red-950/50' : 'bg-muted',
            )}
          >
            <Heart
              className={cn(
                'w-4 h-4',
                player.health <= 5 ? 'text-red-500 animate-pulse' : 'text-red-400',
              )}
            />
            <span
              className={cn(
                'font-bold',
                player.health <= 5 ? 'text-red-600 dark:text-red-400' : 'text-foreground/70',
              )}
            >
              {player.health}
            </span>
          </div>

          {/* Mana */}
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/30">
            <Zap className="w-4 h-4 text-blue-500" />
            <span className="font-bold text-blue-700 dark:text-blue-400">
              {player.mana}
              <span className="text-blue-400 dark:text-blue-600">/{player.maxMana}</span>
            </span>
            {player.spellMana > 0 && (
              <span className="text-violet-500 font-semibold">+{player.spellMana}</span>
            )}
          </div>

          {/* Hand */}
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-muted">
            <Layers className="w-4 h-4 text-muted-foreground" />
            <span className="font-bold text-foreground/70">{player.hand.length}</span>
            <span className="text-muted-foreground">cards</span>
          </div>

          {/* Units */}
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-muted">
            <Sword className="w-4 h-4 text-muted-foreground" />
            <span className="font-bold text-foreground/70">{unitCount}</span>
            <span className="text-muted-foreground">units</span>
          </div>
        </div>
      </div>
    </div>
  )
}
