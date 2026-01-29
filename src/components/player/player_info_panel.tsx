'use client'

import { Heart, Moon, Sun, Sword, Zap, Layers } from 'lucide-react'
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

  // Position-specific styles - Clear separation between zones
  const positionStyles = {
    'top-left': 'fixed top-4 left-4 z-50',
    'bottom-right': 'fixed bottom-4 left-4 z-50', // Moved to left side to avoid overlap with action bar
  }

  // Player-specific styling
  const getPlayerStyles = () => {
    if (isCurrentPlayer) {
      return {
        avatar: 'bg-black',
        avatarIcon: 'text-white',
        health: 'text-black',
        healthIcon: 'text-black',
      }
    } else {
      return {
        avatar: 'bg-gray-600',
        avatarIcon: 'text-white',
        health: 'text-gray-800',
        healthIcon: 'text-gray-800',
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
          <Zap className="w-3 h-3 text-blue-600" />
          <span className="text-gray-900 dark:text-white font-semibold">
            {player.mana}/{player.maxMana}
          </span>
          {player.spellMana > 0 && <span className="text-blue-600">+{player.spellMana}</span>}
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
              className={`w-3 h-3 ${i < player.mana ? 'text-black' : 'text-gray-400'}`}
            />
          ))}
        </div>
        {player.spellMana > 0 && <span className="text-gray-600">+{player.spellMana}</span>}
      </div>
    )
  }

  const unitCount = gameState
    ? player.id === 'player1'
      ? gameState.battlefield.playerUnits.filter(u => u !== null).length
      : gameState.battlefield.enemyUnits.filter(u => u !== null).length
    : 0

  return (
    <div className={cn(positionStyles[position], 'z-[60]', className)}>
      <div
        className={cn(
          'relative p-3 rounded-2xl shadow-lg backdrop-blur-sm transition-all duration-300',
          'bg-white/95 border-2',
          isCurrentPlayer
            ? isActive
              ? 'border-emerald-400 shadow-emerald-200/50'
              : 'border-slate-300'
            : isActive
              ? 'border-amber-400 shadow-amber-200/50'
              : 'border-slate-300',
        )}
      >
        {/* Active Turn Indicator */}
        {isActive && (
          <div className={cn(
            'absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide',
            isCurrentPlayer
              ? 'bg-emerald-500 text-white'
              : 'bg-amber-500 text-white',
          )}>
            Active
          </div>
        )}

        {/* Player Header */}
        <div className="flex items-center gap-2 mb-2">
          <div
            className={cn(
              'relative w-8 h-8 rounded-full flex items-center justify-center',
              isCurrentPlayer ? 'bg-slate-900' : 'bg-slate-600',
            )}
          >
            {isCurrentPlayer ? (
              <Sun className="w-4 h-4 text-white" />
            ) : (
              <Moon className="w-4 h-4 text-white" />
            )}

            {/* Attack Token Overlay */}
            {player?.hasAttackToken && (
              <div className="absolute -top-1 -right-1 bg-amber-500 rounded-full p-0.5 ring-2 ring-white">
                <Sword className="w-2 h-2 text-white" />
              </div>
            )}
          </div>

          <div>
            <h3 className="font-bold text-sm text-slate-900">
              {isCurrentPlayer ? 'You' : 'Opponent'}
            </h3>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          {/* Health */}
          <div className={cn(
            'flex items-center gap-1.5 px-2 py-1.5 rounded-lg',
            player.health <= 5 ? 'bg-red-100' : 'bg-slate-100',
          )}>
            <Heart className={cn(
              'w-4 h-4',
              player.health <= 5 ? 'text-red-500 animate-pulse' : 'text-red-400',
            )} />
            <span className={cn(
              'font-bold',
              player.health <= 5 ? 'text-red-600' : 'text-slate-700',
            )}>
              {player.health}
            </span>
          </div>

          {/* Mana */}
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-blue-50">
            <Zap className="w-4 h-4 text-blue-500" />
            <span className="font-bold text-blue-700">
              {player.mana}
              <span className="text-blue-400">/{player.maxMana}</span>
            </span>
            {player.spellMana > 0 && (
              <span className="text-violet-500 font-semibold">+{player.spellMana}</span>
            )}
          </div>

          {/* Hand */}
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-100">
            <Layers className="w-4 h-4 text-slate-500" />
            <span className="font-bold text-slate-700">{player.hand.length}</span>
            <span className="text-slate-400">cards</span>
          </div>

          {/* Units */}
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-100">
            <Sword className="w-4 h-4 text-slate-500" />
            <span className="font-bold text-slate-700">{unitCount}</span>
            <span className="text-slate-400">units</span>
          </div>
        </div>
      </div>
    </div>
  )
}
