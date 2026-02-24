'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { useGameStore } from '@/store/game_store'

/**
 * A prominent banner showing whose turn it is and the current phase.
 * Displayed at the top center of the game board for clear turn visibility.
 */
export default function TurnIndicator() {
  const gameState = useGameStore(state => state.gameState)
  const [animating, setAnimating] = React.useState(false)
  const prevActivePlayer = React.useRef(gameState?.activePlayer)

  // Trigger animation on turn change
  React.useEffect(() => {
    if (gameState?.activePlayer !== prevActivePlayer.current) {
      prevActivePlayer.current = gameState?.activePlayer
      setAnimating(true)
      const timer = setTimeout(() => setAnimating(false), 600)
      return () => clearTimeout(timer)
    }
  }, [gameState?.activePlayer])

  if (!gameState) return null

  const isPlayerTurn = gameState.activePlayer === 'player1'
  const round = gameState.round

  const getPhaseLabel = () => {
    switch (gameState.phase) {
      case 'mulligan':
        return 'Mulligan Phase'
      case 'round_start':
        return 'Round Starting'
      case 'action':
        return 'Action Phase'
      case 'combat_resolution':
        return 'Combat Resolution'
      case 'end_round':
        return 'End of Round'
      default:
        return gameState.phase
    }
  }

  return (
    <output
      className={cn(
        'fixed top-2 left-1/2 -translate-x-1/2 z-40',
        'px-6 py-2 rounded-xl backdrop-blur-md shadow-lg',
        'border transition-all duration-300',
        'flex flex-col items-center gap-0.5',
        animating && 'scale-110 opacity-90',
        !animating && 'scale-100 opacity-100',
        isPlayerTurn
          ? 'bg-green-950/80 border-green-500/50 shadow-green-500/20'
          : 'bg-amber-950/80 border-amber-500/50 shadow-amber-500/20',
      )}
      aria-live="polite"
      aria-label={`${isPlayerTurn ? 'Your turn' : "Opponent's turn"}, ${getPhaseLabel()}, Round ${round}`}
    >
      <span
        className={cn(
          'text-base md:text-lg font-bold uppercase tracking-wider leading-tight',
          isPlayerTurn ? 'text-green-400' : 'text-amber-400',
        )}
      >
        {isPlayerTurn ? 'Your Turn' : "Opponent's Turn"}
      </span>
      <div className="flex items-center gap-2">
        <span className="text-xs md:text-sm text-slate-300 font-medium">{getPhaseLabel()}</span>
        <span className="text-xs text-slate-500">|</span>
        <span className="text-xs md:text-sm text-slate-400 font-medium">Round {round}</span>
      </div>
    </output>
  )
}
