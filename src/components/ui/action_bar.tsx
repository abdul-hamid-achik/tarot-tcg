'use client'

import { Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getPlayerBench, isActionPhase } from '@/schemas/schema'
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
      <div className={`flex items-center justify-center gap-4 ${className}`}>
        <Badge className="bg-gray-200 px-4 py-2 text-black font-semibold text-sm border-gray-300 dark:border-gray-600">
          Loading...
        </Badge>
      </div>
    )
  }

  // Game state helpers with null checks
  const isPlayerTurn = gameState?.activePlayer === 'player1'
  const canPass = isPlayerTurn && gameState?.phase === 'action'
  const isInCombat = gameState?.phase === 'combat'
  const selectedAttackersCount = interaction.selectedAttackers.size
  const selectedDefendersCount = interaction.defenderAssignments.size
  const isDefendPhase = gameState?.phase === 'declare_defenders'

  // Phase display
  const getPhaseDisplay = () => {
    switch (gameState?.phase) {
      case 'mulligan':
        return { text: 'Mulligan Phase', color: 'bg-gray-300 text-black border border-gray-400' }
      case 'action':
        return { text: 'Action Phase', color: 'bg-gray-200 text-black border border-gray-400' }
      case 'declare_attackers':
        return { text: 'Declare Attackers', color: 'bg-gray-400 text-black border border-gray-500' }
      case 'declare_defenders':
        return { text: 'Declare Defenders', color: 'bg-gray-300 text-black border border-gray-400' }
      case 'combat':
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
    if (getPlayerBench(gameState, 'player1').length === 0) {
      return { enabled: false, tooltip: 'No units to attack with' }
    }
    if (selectedAttackersCount === 0) {
      return { enabled: false, tooltip: 'Select units to attack with' }
    }
    return { enabled: true, tooltip: `Attack with ${selectedAttackersCount} units` }
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

    const hasDefenders = getPlayerBench(gameState, 'player1').length > 0

    return {
      enabled: true, // Always enabled - player can always skip block
      tooltip: hasDefenders
        ? (selectedDefendersCount > 0
          ? `Commit ${selectedDefendersCount} defenders`
          : 'Assign defenders or skip to take damage')
        : 'No units to defend with - skip to take damage',
    }
  }

  const defendState = getDefendButtonState()

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Action Buttons Container */}
      <div className="flex flex-col gap-2">
        {/* Attack Button */}
        {isPlayerTurn && gameState?.phase === 'action' && (
          <>
            {gameState?.player1?.hasAttackToken && (gameState?.player1?.bench?.length || 0) > 0 && (
              <Button
                onClick={onAttack}
                disabled={!attackState.enabled}
                className={`
                  w-full justify-center text-lg px-6 py-4 min-h-[50px] font-bold uppercase tracking-wider touch-manipulation transition-all duration-200
                  ${
                    attackState.enabled
                      ? 'bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white shadow-lg border-2 border-orange-400'
                      : 'bg-gray-400 cursor-not-allowed opacity-50 text-gray-600 border-2 border-gray-300'
                  }
                `}
                title={attackState.tooltip}
              >
                {selectedAttackersCount > 0 ? 'ATTACK' : 'PASS'}
                {selectedAttackersCount > 0 && (
                  <span className="ml-2 bg-orange-800 px-2 py-1 rounded-full text-sm">
                    {selectedAttackersCount}
                  </span>
                )}
              </Button>
            )}

            {/* LoR-style Pass/End Turn Button */}
            <Button
              onClick={onPass}
              disabled={!canPass}
              className={`
                w-full justify-center text-lg px-6 py-4 min-h-[50px] font-bold uppercase tracking-wider touch-manipulation transition-all duration-200
                ${
                  canPass
                    ? 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-lg border-2 border-blue-400'
                    : 'bg-gray-400 cursor-not-allowed opacity-50 text-gray-600 border-2 border-gray-300'
                }
              `}
              title={canPass ? 'End your turn' : 'Cannot pass right now'}
            >
              PASS
            </Button>
          </>
        )}

        {/* Defend Button - During Defender Declaration Phase */}
        {isPlayerTurn && isDefendPhase && (
          <Button
            onClick={onDefend}
            disabled={!defendState.enabled}
            className={`
                w-full justify-center text-lg px-6 py-4 min-h-[50px] font-bold uppercase tracking-wider touch-manipulation transition-all duration-200
                ${
                  defendState.enabled
                    ? 'bg-green-600 hover:bg-green-700 active:bg-green-800 text-white shadow-lg border-2 border-green-400'
                    : 'bg-gray-400 cursor-not-allowed opacity-50 text-gray-600 border-2 border-gray-300'
                }
              `}
            title={defendState.tooltip}
          >
            {selectedDefendersCount > 0 ? 'DEFEND' : 'SKIP BLOCK'}
            {selectedDefendersCount > 0 && (
              <span className="ml-2 bg-green-800 px-2 py-1 rounded-full text-sm">
                {selectedDefendersCount}
              </span>
            )}
          </Button>
        )}

        {/* Combat Phase - LoR Style */}
        {isInCombat && (
          <Button
            disabled
            className="w-full justify-center text-lg px-6 py-4 min-h-[50px] font-bold uppercase tracking-wider bg-red-700 text-white border-2 border-red-500 opacity-90"
          >
            RESOLVING...
          </Button>
        )}

        {/* Opponent Turn Indicator - LoR Style */}
        {!isPlayerTurn && gameState?.phase === 'action' && (
          <Button
            disabled
            className="w-full justify-center text-lg px-6 py-4 min-h-[50px] font-bold uppercase tracking-wider bg-gray-600 text-white border-2 border-gray-400 opacity-75"
          >
            OPPONENT TURN
          </Button>
        )}

        {/* Mulligan Phase Indicator */}
        {gameState?.phase === 'mulligan' && (
          <div className="flex items-center gap-2 text-gray-700 text-sm px-4 py-2 bg-blue-100/80 rounded border border-blue-300">
            <Clock className="w-4 h-4 animate-pulse" />
            <span>Choose starting hand</span>
          </div>
        )}

        {/* End Round Button - LoR Style */}
        {gameState?.phase === 'end_round' && isPlayerTurn && (
          <Button
            onClick={onEndTurn}
            className="w-full justify-center text-lg px-6 py-4 min-h-[50px] font-bold uppercase tracking-wider bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white shadow-lg border-2 border-purple-400"
          >
            CONTINUE
          </Button>
        )}

        {/* Fallback for phases without specific buttons */}
        {!['action', 'declare_defenders', 'combat', 'end_round', 'mulligan'].includes(
          gameState?.phase || '',
        ) && (
          <div className="flex items-center gap-2 text-gray-600 text-sm px-4 py-2 bg-gray-100/80 rounded border border-gray-300">
            <Clock className="w-4 h-4 animate-pulse" />
            <span>Waiting...</span>
          </div>
        )}
      </div>
    </div>
  )
}
