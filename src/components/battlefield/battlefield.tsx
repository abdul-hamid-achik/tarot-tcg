'use client'

import { useGameStore } from '@/store/game_store'
import { BattlefieldRow } from './battlefield_row'

export function Battlefield() {
  const { gameState } = useGameStore()
  const battlefield = gameState.battlefield
  const isPlayerTurn = gameState.activePlayer === 'player1'

  return (
    <div className="w-full h-full flex flex-col justify-center items-center p-4 gap-6">
      {/* Enemy Row */}
      <div className="w-full flex flex-col gap-2">
        <div className="text-center text-sm font-semibold text-muted-foreground opacity-75">
          <span className="bg-gradient-to-r from-red-400 to-purple-400 bg-clip-text text-transparent animate-pulse">
            🌙 Adversary's Celestial Court 🌙
          </span>
        </div>
        <BattlefieldRow
          player="player2"
          units={battlefield.enemyUnits}
          isActive={!isPlayerTurn}
          canInteract={!isPlayerTurn && gameState.phase === 'action'}
        />
      </div>

      {/* Mystical Divider */}
      <div className="w-full h-[4px] bg-gradient-to-r from-transparent via-purple-500/60 to-transparent relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-background/90 backdrop-blur-sm px-8 py-2 rounded-full border border-purple-500/40 shadow-lg shadow-purple-500/25">
            <span className="text-sm text-transparent bg-gradient-to-r from-purple-400 via-blue-400 to-purple-400 bg-clip-text font-bold animate-pulse">
              ⚡ The Astral Divide ⚡
            </span>
          </div>
        </div>
      </div>

      {/* Player Row */}
      <div className="w-full flex flex-col gap-2">
        <BattlefieldRow
          player="player1"
          units={battlefield.playerUnits}
          isActive={isPlayerTurn}
          canInteract={isPlayerTurn && gameState.phase === 'action'}
        />
        <div className="text-center text-sm font-semibold text-muted-foreground opacity-75">
          <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent animate-pulse">
            ⭐ Your Sacred Constellation ⭐
          </span>
        </div>
      </div>
    </div>
  )
}