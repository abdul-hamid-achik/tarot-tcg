'use client'

import { Heart, Moon, Sun, Sword, Zap } from 'lucide-react'
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

  // Position-specific styles - Hearthstone-style compact with proper visibility
  const positionStyles = {
    'top-left': 'fixed top-2 left-2 z-50',
    'bottom-right': 'fixed bottom-20 right-2 z-50', // Position above action bar
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

  return (
    <div className={`${positionStyles[position]} z-[60] w-36 ${className}`}>
      <div
        className={`
        relative p-2 rounded-lg shadow-md backdrop-blur-sm transition-all duration-300
        ${
          isCurrentPlayer
            ? 'bg-gray-800 border border-gray-600'
            : 'bg-gray-700 border border-gray-500'
        }
        ${isActive ? 'ring-1 ring-black' : ''}
      `}
      >
        {/* Active Turn Glow Effect */}
        {isActive && <div className="absolute inset-0 rounded-lg bg-gray-300/20 animate-pulse" />}

        {/* Compact Player Header */}
        <div className="flex items-center gap-1 mb-2 relative z-10">
          <div
            className={`relative w-6 h-6 rounded-full ${
              isCurrentPlayer ? 'bg-black' : 'bg-gray-600'
            } flex items-center justify-center`}
          >
            {isCurrentPlayer ? (
              <Sun className="w-3 h-3 text-white" />
            ) : (
              <Moon className="w-3 h-3 text-white" />
            )}

            {/* Attack Token Overlay */}
            {player?.hasAttackToken && (
              <div className="absolute -top-0.5 -right-0.5 bg-black rounded-full p-0.5">
                <Sword className="w-1.5 h-1.5 text-white" />
              </div>
            )}
          </div>

          <div className="flex-1">
            <h3 className={`font-bold text-xs ${isCurrentPlayer ? 'text-white' : 'text-white'}`}>
              {player.name}
            </h3>
            {isActive && <div className="text-xs text-gray-300 font-medium">Active</div>}
          </div>
        </div>

        {/* Ultra Compact Stats */}
        <div className="space-y-1 text-xs relative z-10">
          {/* Health & Mana */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Heart className="w-3 h-3 text-black" />
              <span className="font-bold text-white">{player.health}</span>
            </div>
            <div className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-gray-600" />
              <span className="font-bold text-white">
                {player.mana}/{player.maxMana}
              </span>
              {player.spellMana > 0 && <span className="text-gray-300">+{player.spellMana}</span>}
            </div>
          </div>

          {/* Hand & Units */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-gray-600 flex items-center justify-center">
                <span className="text-white text-xs font-bold">{player.hand.length}</span>
              </div>
              <span className="text-gray-300">Hand</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-black flex items-center justify-center">
                <span className="text-white text-xs font-bold">
                  {gameState
                    ? player.id === 'player1'
                      ? gameState.battlefield.playerUnits.filter(u => u !== null).length
                      : gameState.battlefield.enemyUnits.filter(u => u !== null).length
                    : 0}
                </span>
              </div>
              <span className="text-gray-300">Units</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
