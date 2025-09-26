'use client'

import { Heart, Moon, Sun, Sword, Zap } from 'lucide-react'
import type { Player } from '@/schemas/schema'
import { isActionPhase, isCombatPhase } from '@/schemas/schema'
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
  const selectedAttackersCount = interaction.selectedAttackers.size
  const _defenderAssignmentsCount = interaction.defenderAssignments.size

  // Position-specific styles
  const positionStyles = {
    'top-left': 'absolute top-4 left-4',
    'bottom-right': 'absolute bottom-4 right-4',
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

  const playerStyles = getPlayerStyles()

  // Check if can attack
  const _canAttack =
    isCurrentPlayer &&
    player?.hasAttackToken &&
    gameState?.phase === 'action' &&
    selectedAttackersCount > 0

  // Check if must defend (simplified - combat phase)
  // Note: In Hearthstone-style, there's no separate combat phase
  const _mustDefend = false

  // Render mana crystals for current player
  const renderManaDisplay = () => {
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

  return (
    <div className={`${positionStyles[position]} z-[60] w-64 ${className}`}>
      <div className="space-y-3 p-3 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-400 shadow-2xl">
        {/* Player Header */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div
              className={`w-10 h-10 rounded-full ${playerStyles.avatar} flex items-center justify-center`}
            >
              {isCurrentPlayer ? (
                <Sun className={`w-5 h-5 ${playerStyles.avatarIcon}`} />
              ) : (
                <Moon className={`w-5 h-5 ${playerStyles.avatarIcon}`} />
              )}
            </div>

            {/* Attack Token Indicator */}
            {player?.hasAttackToken && (
              <div className="absolute -top-1 -right-1 bg-orange-500 rounded-full p-1 animate-pulse">
                <Sword className="w-2 h-2 text-white" />
              </div>
            )}
          </div>

          <div className="flex-1">
            <h3 className="font-bold text-sm text-gray-900 dark:text-white">{player.name}</h3>
            {player?.hasAttackToken && (
              <span className="text-xs bg-orange-500/20 text-orange-300 px-2 py-1 rounded">
                ⚔️ Attack Token
              </span>
            )}
          </div>
        </div>

        {/* Player Stats */}
        <div className="space-y-2 text-xs">
          {/* Health */}
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-300">Health:</span>
            <div className="flex items-center gap-1">
              <Heart className={`w-3 h-3 ${playerStyles.healthIcon}`} />
              <span className={`${playerStyles.health} font-semibold`}>{player.health}</span>
            </div>
          </div>

          {/* Mana */}
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-300">Mana:</span>
            {renderManaDisplay()}
          </div>

          {/* Hand Size */}
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-300">Hand:</span>
            <span className="text-gray-900 dark:text-white font-semibold">
              {player.hand.length} cards
            </span>
          </div>

          {/* Bench Size */}
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-300">Bench:</span>
            <span className="text-gray-900 dark:text-white font-semibold">
              {player.bench.length}/6 units
            </span>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="text-xs text-slate-400">
          {isActive && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span>Active Turn</span>
            </div>
          )}

          {!isActive && isActionPhase(gameState) && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-slate-400 rounded-full" />
              <span>Waiting</span>
            </div>
          )}

          {isCombatPhase(gameState) && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
              <span>Combat</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
