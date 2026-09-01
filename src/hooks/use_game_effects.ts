import { useEffect } from 'react'
import { useGameActions } from '@/hooks/use_game_actions'
import { GameLogger } from '@/lib/game_logger'
import { battlefieldService } from '@/services/battlefield_service'
import { useGameStore } from '@/store/game_store'

// Simple game effects hook for Hearthstone-style gameplay
export const useGameEffects = () => {
  const { gameState, setValidDropZones, clearValidDropZones } = useGameStore()

  const _gameActions = useGameActions()

  useEffect(() => {
    if (!gameState || gameState.activePlayer !== 'player1' || gameState.phase !== 'action') {
      clearValidDropZones()
    }
  }, [gameState, clearValidDropZones])

  return {
    gameState,
  }
}
