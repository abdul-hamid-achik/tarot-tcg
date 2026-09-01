import { useEffect } from 'react'
import { battlefieldService } from '@/services/battlefield_service'
import { useGameStore } from '@/store/game_store'

export const useGameEffects = () => {
  const { gameState, setValidDropZones, clearValidDropZones } = useGameStore()

  useEffect(() => {
    if (!gameState?.battlefield) return

    if (gameState.activePlayer === 'player1' && gameState.phase === 'action') {
      const slotCount = gameState.battlefield.maxSlots ?? 7
      const validSlots = []
      for (let slot = 0; slot < slotCount; slot++) {
        if (battlefieldService.isSlotEmpty(gameState.battlefield, 'player1', slot)) {
          validSlots.push({ player: 'player1' as const, slot })
        }
      }
      setValidDropZones(validSlots)
    } else {
      clearValidDropZones()
    }
  }, [gameState, setValidDropZones, clearValidDropZones])

  return {
    gameState,
  }
}
