'use client'

import { useGameStore } from '@/store/game_store'
import { BattlefieldRow } from './battlefield_row'

export function Battlefield() {
  const { gameState, interaction } = useGameStore()
  const battlefield = gameState.battlefield
  const isPlayerTurn = gameState.activePlayer === 'player1'
  const isInTargetingMode = interaction.targetingMode === 'attack'

  const phaseLabel = isInTargetingMode
    ? 'Choose a target'
    : gameState.phase === 'action'
      ? isPlayerTurn
        ? 'Your action'
        : 'Opponent action'
      : gameState.phase.replaceAll('_', ' ')

  return (
    <div className="flex w-full max-w-3xl flex-col items-stretch gap-1">
      <BattlefieldRow
        player="player2"
        units={battlefield.enemyUnits}
        isActive={!isPlayerTurn}
        canInteract={isPlayerTurn && gameState.phase === 'action'}
      />
      <p className="py-0.5 text-center text-xs text-muted-foreground">
        {phaseLabel} · Round {gameState.round}
      </p>
      <BattlefieldRow
        player="player1"
        units={battlefield.playerUnits}
        isActive={isPlayerTurn}
        canInteract={isPlayerTurn && gameState.phase === 'action'}
      />
    </div>
  )
}
