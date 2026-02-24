'use client'

import { useMemo, useCallback } from 'react'
import type { Card, DirectAttack } from '@/schemas/schema'
import { gameEngine, type GameEngineConfig, type GameEngineResult } from '@/services/game_engine'
import { useGameStore } from '@/store/game_store'

/**
 * React hook for using the GameEngine with automatic state management
 */
export function useGameEngine(config?: Partial<GameEngineConfig>) {
  // Apply config if provided
  useMemo(() => {
    if (config) {
      gameEngine.configure(config)
    }
  }, [config])

  const { gameState, setGameState, showError } = useGameStore()

  /**
   * Handle engine result - update store and show errors
   */
  const handleResult = useCallback(
    (result: GameEngineResult): boolean => {
      if (result.success && result.newState) {
        setGameState(result.newState)
      } else if (!result.success && result.error) {
        showError(result.error)
      }
      return result.success
    },
    [setGameState, showError]
  )

  /**
   * Play a card from hand
   */
  const playCard = useCallback(
    async (card: Card, targetSlot?: number): Promise<boolean> => {
      const result = await gameEngine.playCard(gameState, card, targetSlot)
      return handleResult(result)
    },
    [gameState, handleResult]
  )

  /**
   * Declare an attack
   */
  const attack = useCallback(
    async (attackData: DirectAttack): Promise<boolean> => {
      const result = await gameEngine.attack(gameState, attackData)
      return handleResult(result)
    },
    [gameState, handleResult]
  )

  /**
   * End the current turn
   */
  const endTurn = useCallback(async (): Promise<boolean> => {
    const result = await gameEngine.endTurn(gameState)
    return handleResult(result)
  }, [gameState, handleResult])

  /**
   * Complete mulligan phase
   */
  const completeMulligan = useCallback(async (): Promise<boolean> => {
    const result = await gameEngine.completeMulligan(gameState)
    return handleResult(result)
  }, [gameState, handleResult])

  /**
   * Toggle a card for mulligan
   */
  const toggleMulliganCard = useCallback(
    (cardId: string): boolean => {
      const result = gameEngine.toggleMulliganCard(gameState, cardId)
      return handleResult(result)
    },
    [gameState, handleResult]
  )

  /**
   * Check if a unit can attack
   */
  const canUnitAttack = useCallback((unit: Card): boolean => {
    return gameEngine.canUnitAttack(unit)
  }, [])

  /**
   * Get valid attack targets
   */
  const getValidTargets = useCallback(() => {
    return gameEngine.getValidTargets(gameState, gameState.activePlayer)
  }, [gameState])

  /**
   * Preview combat outcome
   */
  const previewCombat = useCallback((attacker: Card, defender: Card) => {
    return gameEngine.previewCombat(attacker, defender)
  }, [])

  /**
   * Wait for animations to complete
   */
  const waitForAnimations = useCallback(async () => {
    await gameEngine.waitForAnimations()
  }, [])

  /**
   * Get current animation status
   */
  const getAnimationStatus = useCallback(() => {
    return gameEngine.getAnimationStatus()
  }, [])

  return {
    // Actions
    playCard,
    attack,
    endTurn,
    completeMulligan,
    toggleMulliganCard,

    // Combat helpers
    canUnitAttack,
    getValidTargets,
    previewCombat,

    // Animation control
    waitForAnimations,
    getAnimationStatus,

    // Direct access to engine for advanced usage
    engine: gameEngine,
  }
}
