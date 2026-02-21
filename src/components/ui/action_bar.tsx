'use client'

import { Clock, SkipForward, Swords } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
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
      <div className={cn('flex items-center justify-center', className)}>
        <Badge className="bg-muted px-6 py-3 text-muted-foreground font-medium text-sm border border-border min-h-[44px] flex items-center justify-center">
          <Clock className="w-4 h-4 animate-spin mr-2" />
          Loading...
        </Badge>
      </div>
    )
  }

  // Game state helpers with null checks
  const isPlayerTurn = gameState?.activePlayer === 'player1'
  const _canPass = isPlayerTurn && gameState?.phase === 'action'
  const isInCombat = gameState?.phase === 'combat_resolution'
  const isInAttackMode = interaction.targetingMode === 'attack'
  const hasValidTargets = interaction.validAttackTargets.size > 0
  const isDefendPhase = false // No defense phase in direct attack system

  // Phase display
  const getPhaseDisplay = () => {
    switch (gameState?.phase) {
      case 'mulligan':
        return { text: 'Mulligan Phase', color: 'bg-muted text-foreground border border-border' }
      case 'action':
        return { text: 'Action Phase', color: 'bg-muted text-foreground border border-border' }
      // Removed attack_declaration and defense_declaration phases
      case 'combat_resolution':
        return {
          text: 'Combat!',
          color: 'bg-foreground text-background border border-foreground',
        }
      case 'end_round':
        return { text: 'Round Ending', color: 'bg-muted text-foreground border border-border' }
      default:
        return { text: 'Unknown Phase', color: 'bg-muted text-foreground border border-border' }
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
    <div
      className={cn(
        'bg-card/95 backdrop-blur-sm rounded-2xl shadow-lg border border-border p-3',
        'transition-all duration-300',
        className,
      )}
    >
      {/* Action Buttons Container */}
      <div className="flex flex-col gap-2 min-w-[140px]">
        {/* Defend Button - During Defender Declaration Phase */}
        {isPlayerTurn && isDefendPhase && (
          <Button
            onClick={onDefend}
            disabled={!defendState.enabled}
            className={cn(
              'w-full justify-center text-sm px-4 py-2.5 font-semibold uppercase tracking-wide',
              'transition-all duration-200 rounded-xl',
              defendState.enabled
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md'
                : 'bg-muted cursor-not-allowed text-muted-foreground',
            )}
            title={defendState.tooltip}
          >
            Skip Block
          </Button>
        )}

        {/* Combat Resolution */}
        {isInCombat && (
          <div className="flex items-center justify-center gap-2 text-amber-700 dark:text-amber-400 text-sm px-4 py-2.5 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800">
            <Swords className="w-4 h-4 animate-pulse" />
            <span className="font-semibold">Combat...</span>
          </div>
        )}

        {/* Opponent Turn Indicator */}
        {!isPlayerTurn && gameState?.phase === 'action' && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm px-4 py-2.5 bg-muted rounded-xl border border-border">
            <Clock className="w-4 h-4 animate-spin" />
            <span className="font-medium">Opponent</span>
          </div>
        )}

        {/* End Round Button */}
        {gameState?.phase === 'end_round' && isPlayerTurn && (
          <Button
            onClick={onEndTurn}
            className="w-full justify-center text-sm px-4 py-2.5 font-semibold uppercase tracking-wide bg-violet-600 hover:bg-violet-700 text-white shadow-md rounded-xl transition-all duration-200"
          >
            Continue
          </Button>
        )}

        {/* Fallback for phases without specific buttons */}
        {!['action', 'defense_declaration', 'combat_resolution', 'end_round', 'mulligan'].includes(
          gameState?.phase || '',
        ) && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm px-4 py-2.5 bg-muted/50 rounded-xl border border-border">
            <Clock className="w-4 h-4 animate-pulse" />
            <span>Waiting...</span>
          </div>
        )}

        {/* Show End Turn button when it's player's turn in action phase */}
        {isPlayerTurn && gameState?.phase === 'action' && (
          <Button
            onClick={onPass}
            className={cn(
              'w-full justify-center text-sm px-4 py-3 font-bold uppercase tracking-wider',
              'bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-md',
              'transition-all duration-200 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]',
            )}
            title="End your turn"
          >
            <SkipForward className="w-4 h-4 mr-2" />
            End Turn
          </Button>
        )}
      </div>
    </div>
  )
}
