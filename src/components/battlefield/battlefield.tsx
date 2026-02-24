'use client'

import { cn } from '@/lib/utils'
import { useGameStore } from '@/store/game_store'
import { BattlefieldRow } from './battlefield_row'

export function Battlefield() {
  const { gameState, interaction } = useGameStore()
  const battlefield = gameState.battlefield
  const isPlayerTurn = gameState.activePlayer === 'player1'
  const isInTargetingMode = interaction.targetingMode === 'attack'

  // Phase-specific color styles
  const getPhaseStyles = () => {
    if (isInTargetingMode) {
      return {
        pill: 'bg-amber-100 dark:bg-amber-950/60 border-amber-400 dark:border-amber-500 text-amber-700 dark:text-amber-300',
        line: 'via-amber-300 dark:via-amber-600',
        label: 'Select Target',
      }
    }
    switch (gameState.phase) {
      case 'mulligan':
        return {
          pill: 'bg-purple-100 dark:bg-purple-950/60 border-purple-400 dark:border-purple-500 text-purple-700 dark:text-purple-300',
          line: 'via-purple-300 dark:via-purple-600',
          label: 'Mulligan',
        }
      case 'action':
        return {
          pill: isPlayerTurn
            ? 'bg-emerald-100 dark:bg-emerald-950/60 border-emerald-400 dark:border-emerald-500 text-emerald-700 dark:text-emerald-300'
            : 'bg-slate-100 dark:bg-slate-800/60 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300',
          line: isPlayerTurn
            ? 'via-emerald-300 dark:via-emerald-600'
            : 'via-slate-300 dark:via-slate-600',
          label: 'Action Phase',
        }
      case 'combat_resolution':
        return {
          pill: 'bg-red-100 dark:bg-red-950/60 border-red-400 dark:border-red-500 text-red-700 dark:text-red-300',
          line: 'via-red-300 dark:via-red-600',
          label: 'Combat',
        }
      case 'round_start':
        return {
          pill: 'bg-sky-100 dark:bg-sky-950/60 border-sky-400 dark:border-sky-500 text-sky-700 dark:text-sky-300',
          line: 'via-sky-300 dark:via-sky-600',
          label: 'Round Start',
        }
      case 'end_round':
        return {
          pill: 'bg-slate-100 dark:bg-slate-800/60 border-slate-400 dark:border-slate-500 text-slate-600 dark:text-slate-300',
          line: 'via-slate-300 dark:via-slate-500',
          label: 'End Round',
        }
      default:
        return {
          pill: 'bg-slate-100 dark:bg-slate-800/60 border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400',
          line: 'via-slate-300 dark:via-slate-600',
          label: gameState.phase,
        }
    }
  }

  const phaseStyles = getPhaseStyles()

  return (
    <div className="w-full max-w-5xl flex flex-col justify-center items-center gap-4 px-4">
      {/* Opponent Zone */}
      <div className="w-full space-y-2">
        <div className="flex items-center justify-between px-2">
          <span
            className={cn(
              'text-xs font-semibold uppercase tracking-wider',
              !isPlayerTurn ? 'text-amber-600' : 'text-slate-400',
            )}
          >
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
        <div className={cn('flex-1 h-[2px] bg-gradient-to-r from-transparent', phaseStyles.line)} />
        <div
          className={cn(
            'flex items-center gap-2 px-5 py-2 rounded-full text-base font-bold uppercase tracking-wider',
            'border-2 transition-all duration-500 shadow-sm',
            phaseStyles.pill,
          )}
        >
          <span>{phaseStyles.label}</span>
          <span className="text-xs font-semibold opacity-60">R{gameState.round}</span>
        </div>
        <div className={cn('flex-1 h-[2px] bg-gradient-to-l from-transparent', phaseStyles.line)} />
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
          <span
            className={cn(
              'text-xs font-semibold uppercase tracking-wider',
              isPlayerTurn ? 'text-emerald-600' : 'text-slate-400',
            )}
          >
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
