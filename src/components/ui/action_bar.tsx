'use client'

import { Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { isActionPhase } from '@/schemas/schema'
import { useGameStore } from '@/store/game_store'

interface ActionBarProps {
  onAttack?: () => void
  onDefend?: () => void
  onPass?: () => void
  onEndTurn?: () => void
  className?: string
}

export default function ActionBar({
  onAttack,
  onDefend,
  onPass,
  onEndTurn,
  className = '',
}: ActionBarProps) {
  const { gameState, interaction } = useGameStore()

  // Early return if gameState is not available
  if (!gameState) {
    return (
      <div className={`flex items-center justify-center gap-3 ${className}`}>
        <Badge className="bg-gray-200 px-6 py-3 text-black font-semibold text-sm border border-gray-300 dark:border-gray-600 min-h-[44px] flex items-center justify-center">
          Loading...
        </Badge>
      </div>
    )
  }

  // Game state helpers with null checks
  const isPlayerTurn = gameState?.activePlayer === 'player1'
  const canPass = isPlayerTurn && gameState?.phase === 'action'
  const isInCombat = gameState?.phase === 'combat_resolution'
  const isInAttackMode = interaction.targetingMode === 'attack'
  const hasValidTargets = interaction.validAttackTargets.size > 0
  const isDefendPhase = false // No defense phase in direct attack system

  // Phase display
  const getPhaseDisplay = () => {
    switch (gameState?.phase) {
      case 'mulligan':
        return { text: 'Mulligan Phase', color: 'bg-gray-300 text-black border border-gray-400' }
      case 'action':
        return { text: 'Action Phase', color: 'bg-gray-200 text-black border border-gray-400' }
      // Removed attack_declaration and defense_declaration phases
      case 'combat_resolution':
        return { text: 'Combat!', color: 'bg-black text-white border border-gray-800' }
      case 'end_round':
        return { text: 'Round Ending', color: 'bg-gray-300 text-black border border-gray-400' }
      default:
        return { text: 'Unknown Phase', color: 'bg-gray-200 text-black border border-gray-300' }
    }
  }

  const _phaseInfo = getPhaseDisplay()

  // Get attack button state and tooltip
  const getAttackButtonState = () => {
    if (!isPlayerTurn) {
      return { enabled: false, tooltip: 'Not your turn' }
    }
    if (!gameState?.player1?.hasAttackToken) {
      return { enabled: false, tooltip: 'Need attack token' }
    }
    if (!isActionPhase(gameState)) {
      return { enabled: false, tooltip: 'Can only attack during action phase' }
    }
    // Check if there are any units that can attack (battlefield units)
    // Check battlefield units for attack capability
    const battlefieldUnits = gameState?.battlefield.playerUnits.filter(u => u !== null).length || 0
    if (battlefieldUnits === 0) {
      return { enabled: true, tooltip: 'Pass priority (no units to attack with)' }
    }
    if (!isInAttackMode) {
      return { enabled: true, tooltip: 'Pass priority or click units to attack' }
    }
    return { enabled: hasValidTargets, tooltip: 'Choose attack targets' }
  }

  const attackState = getAttackButtonState()

  // Get defend button state and tooltip
  const getDefendButtonState = () => {
    if (!isPlayerTurn) {
      return { enabled: false, tooltip: 'Not your turn' }
    }
    if (!isDefendPhase) {
      return { enabled: false, tooltip: 'Can only defend during defender declaration' }
    }

    // No defense phase in direct attack system
    const hasDefenders = false

    return {
      enabled: true, // Always enabled - player can always skip block
      tooltip: hasDefenders
        ? false // No defense phase in direct attack system
          ? 'No defense needed'
          : 'Assign defenders or skip to take damage'
        : 'No units to defend with - skip to take damage',
    }
  }

  const defendState = getDefendButtonState()

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Action Buttons Container */}
      <div className="flex flex-col gap-3">

        {/* Defend Button - During Defender Declaration Phase */}
        {isPlayerTurn && isDefendPhase && (
          <Button
            onClick={onDefend}
            disabled={!defendState.enabled}
            className={`
                w-full justify-center text-sm px-6 py-3 min-h-[44px] font-semibold uppercase tracking-wide touch-manipulation transition-all duration-300 transform hover:scale-105 active:scale-95
                ${defendState.enabled
                ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg border border-green-400'
                : 'bg-gray-400 cursor-not-allowed opacity-50 text-gray-600 border border-gray-300'
              }
              `}
            title={defendState.tooltip}
          >
            {'NO DEFENSE NEEDED'}
            {false && (
              <span className="ml-2 bg-green-800 px-2 py-1 rounded-full text-xs">
                🛡️
              </span>
            )}
          </Button>
        )}

        {/* Combat Phase - LoR Style */}
        {isInCombat && (
          <Button
            disabled
            className="w-full justify-center text-sm px-6 py-3 min-h-[44px] font-semibold uppercase tracking-wide bg-red-700 text-white border border-red-500 opacity-90"
          >
            RESOLVING...
          </Button>
        )}

        {/* Opponent Turn Indicator - LoR Style */}
        {!isPlayerTurn && gameState?.phase === 'action' && (
          <Button
            disabled
            className="w-full justify-center text-sm px-6 py-3 min-h-[44px] font-semibold uppercase tracking-wide bg-gray-600 text-white border border-gray-400 opacity-75"
          >
            OPPONENT TURN
          </Button>
        )}

        {/* End Round Button - LoR Style */}
        {gameState?.phase === 'end_round' && isPlayerTurn && (
          <Button
            onClick={onEndTurn}
            className="w-full justify-center text-sm px-6 py-3 min-h-[44px] font-semibold uppercase tracking-wide bg-purple-600 hover:bg-purple-700 text-white shadow-lg border border-purple-400"
          >
            CONTINUE
          </Button>
        )}

        {/* Fallback for phases without specific buttons */}
        {!['action', 'defense_declaration', 'combat_resolution', 'end_round', 'mulligan'].includes(
          gameState?.phase || '',
        ) && (
            <div className="flex items-center justify-center gap-2 text-gray-600 text-sm px-6 py-3 bg-gray-100/80 rounded border border-gray-300 min-h-[44px]">
              <Clock className="w-4 h-4 animate-pulse" />
              <span>Waiting...</span>
            </div>
          )}

        {/* Show End Turn button when it's player's turn in action phase - Always visible in tutorial/sandbox */}
        {isPlayerTurn && gameState?.phase === 'action' && (
          <Button
            onClick={onPass}
            className="w-full justify-center text-sm px-6 py-3 min-h-[44px] font-semibold uppercase tracking-wide touch-manipulation transition-all duration-300 transform hover:scale-105 active:scale-95 bg-black hover:bg-gray-800 text-white shadow-lg border border-gray-600 hover:shadow-xl"
            title="End your turn"
          >
            END TURN
          </Button>
        )}
      </div>
    </div>
  )
}
