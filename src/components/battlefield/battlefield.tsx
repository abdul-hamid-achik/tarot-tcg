'use client'

import { cn } from '@/lib/utils'
import { useGameStore } from '@/store/game_store'
import { BattlefieldRow } from './battlefield_row'

export function Battlefield() {
  const { gameState, interaction } = useGameStore()
  const battlefield = gameState.battlefield
  const isPlayerTurn = gameState.activePlayer === 'player1'
  const isInTargetingMode = interaction.targetingMode === 'attack'

  return (
    <div className="w-full max-w-5xl flex flex-col justify-center items-center gap-4 px-4">
      {/* Opponent Zone */}
      <div className="w-full space-y-2">
        <div className="flex items-center justify-between px-2">
          <span className={cn(
            'text-xs font-semibold uppercase tracking-wider',
            !isPlayerTurn ? 'text-amber-600' : 'text-slate-400',
          )}>
            Opponent's Field {!isPlayerTurn && '(Active)'}
          </span>
          <span className="text-xs text-slate-400">
            {battlefield.enemyUnits.filter(u => u !== null).length}/7 units
          </span>
        </div>
        <BattlefieldRow
          player="player2"
          units={battlefield.enemyUnits}
          isActive={!isPlayerTurn}
          canInteract={isPlayerTurn && gameState.phase === 'action'}
        />
      </div>

      {/* Center Divider with Phase Indicator */}
      <div className="w-full flex items-center gap-4 py-2">
        <div className="flex-1 h-[2px] bg-gradient-to-r from-transparent via-slate-300 to-slate-300" />
        <div className={cn(
          'px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider',
          'border-2 transition-all duration-300',
          isInTargetingMode
            ? 'bg-amber-100 border-amber-400 text-amber-700'
            : isPlayerTurn
              ? 'bg-emerald-100 border-emerald-400 text-emerald-700'
              : 'bg-slate-100 border-slate-300 text-slate-500',
        )}>
          {isInTargetingMode ? 'Select Target' : gameState.phase === 'action' ? 'Action Phase' : gameState.phase}
        </div>
        <div className="flex-1 h-[2px] bg-gradient-to-l from-transparent via-slate-300 to-slate-300" />
      </div>

      {/* Player Zone */}
      <div className="w-full space-y-2">
        <BattlefieldRow
          player="player1"
          units={battlefield.playerUnits}
          isActive={isPlayerTurn}
          canInteract={isPlayerTurn && gameState.phase === 'action'}
        />
        <div className="flex items-center justify-between px-2">
          <span className={cn(
            'text-xs font-semibold uppercase tracking-wider',
            isPlayerTurn ? 'text-emerald-600' : 'text-slate-400',
          )}>
            Your Field {isPlayerTurn && '(Your Turn)'}
          </span>
          <span className="text-xs text-slate-400">
            {battlefield.playerUnits.filter(u => u !== null).length}/7 units
          </span>
        </div>
      </div>
    </div>
  )
}
