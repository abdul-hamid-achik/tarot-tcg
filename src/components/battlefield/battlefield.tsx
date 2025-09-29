'use client'

import { useGameStore } from '@/store/game_store'
import { BattlefieldRow } from './battlefield_row'

export function Battlefield() {
  const { gameState } = useGameStore()
  const battlefield = gameState.battlefield
  const isPlayerTurn = gameState.activePlayer === 'player1'

  return (
    <div className="w-full max-w-5xl flex flex-col justify-center items-center gap-3">
      {/* Enemy Row - Compact */}
      <div className="w-full">
        <BattlefieldRow
          player="player2"
          units={battlefield.enemyUnits}
          isActive={!isPlayerTurn}
          canInteract={!isPlayerTurn && gameState.phase === 'action'}
        />
      </div>

      {/* Minimal Divider */}
      <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-gray-400 to-transparent my-2" />

      {/* Player Row - Compact */}
      <div className="w-full">
        <BattlefieldRow
          player="player1"
          units={battlefield.playerUnits}
          isActive={isPlayerTurn}
          canInteract={isPlayerTurn && gameState.phase === 'action'}
        />
      </div>
    </div>
  )
}