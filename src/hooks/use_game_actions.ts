import { useCallback } from 'react'
import { useMultiplayerActions } from '@/hooks/use_multiplayer_actions'
import { GameLogger } from '@/lib/game_logger'
import type { Card as GameCard } from '@/schemas/schema'
import type { BattlefieldPosition } from '@/services/battlefield_service'
import { useGameStore } from '@/store/game_store'

/**
 * Unified game actions hook for Tarot TCG
 * Supports both local and multiplayer gameplay with direct attack system
 */
export const useGameActions = () => {
  const { gameState, setGameState, interaction, clearSelection, setAnimationState } = useGameStore()

  // Get multiplayer actions for WebSocket-enabled games
  const multiplayer = useMultiplayerActions()

  /**
   * Play a card to the battlefield or cast a spell
   * Supports both local and multiplayer modes
   */
  const playCard = useCallback(
    async (card: GameCard, targetPosition?: BattlefieldPosition) => {
      // Get the latest state directly from the store to avoid stale closure issues
      const currentState = useGameStore.getState().gameState
      if (!currentState) return

      // Use multiplayer action if connected
      if (multiplayer.isMultiplayer) {
        await multiplayer.playCard(card, targetPosition?.slot)
        clearSelection() // Clear selection after successful play
        return
      }

      // Local game logic
      try {
        setAnimationState(true)

        // Import game logic dynamically to avoid circular deps
        const { playCard: localPlayCard } = await import('@/lib/game_logic')
        const newGameState = await localPlayCard(currentState, card, targetPosition?.slot)

        // Only update state and clear selection if successful
        setGameState(newGameState)
        clearSelection()

        GameLogger.action(`Played ${card.name}`)
      } catch (error) {
        GameLogger.error('Error playing card:', error)
        GameLogger.action(`Failed to play ${card.name}: ${error}`)
        // Don't clear selection on error so user can see what went wrong
      } finally {
        setAnimationState(false)
      }
    },
    [setGameState, clearSelection, setAnimationState, multiplayer],
  )

  /**
   * Declare attack using direct attack system (Hearthstone-style)
   */
  const declareAttack = useCallback(
    async (attackerId: string, targetType: 'unit' | 'player', targetId?: string) => {
      // Get the latest state directly from the store to avoid stale closure issues
      const currentState = useGameStore.getState().gameState
      if (!currentState) return

      // Use multiplayer action if connected
      if (multiplayer.isMultiplayer) {
        await multiplayer.declareAttack(attackerId, targetType, targetId)
        return
      }

      // Local game logic
      try {
        setAnimationState(true)

        const { declareAttack: localDeclareAttack } = await import('@/lib/combat_logic')
        const newGameState = await localDeclareAttack(currentState, {
          attackerId,
          targetType,
          targetId,
        })

        setGameState(newGameState)
        clearSelection()

        GameLogger.combat(`Attack executed: ${attackerId} -> ${targetType}`)
      } catch (error) {
        GameLogger.error('Error declaring attack:', error)
        GameLogger.combat(`Attack failed: ${error}`)
      } finally {
        setAnimationState(false)
      }
    },
    [setGameState, clearSelection, setAnimationState, multiplayer],
  )

  // Legacy declareAttack completely removed

  /**
   * Direct attack targeting (Hearthstone-style)
   */
  const attackTarget = useCallback(
    async (attackerId: string, target: BattlefieldPosition | 'nexus') => {
      if (target === 'nexus') {
        await declareAttack(attackerId, 'player')
      } else {
        // Get the latest state directly from the store to avoid stale closure issues
        const currentState = useGameStore.getState().gameState
        
        // Find the target unit ID
        const targetUnits =
          target.player === 'player1'
            ? currentState?.battlefield.playerUnits
            : currentState?.battlefield.enemyUnits

        const targetUnit = targetUnits?.[target.slot]
        if (targetUnit) {
          await declareAttack(attackerId, 'unit', targetUnit.id)
        }
      }
    },
    [declareAttack],
  )

  /**
   * Complete mulligan phase
   */
  const completeMulligan = useCallback(
    async (selectedCardIds: string[]) => {
      // Get the latest state directly from the store to avoid stale closure issues
      const currentState = useGameStore.getState().gameState
      if (!currentState) return

      try {
        setAnimationState(true)

        const { completeMulligan: localCompleteMulligan } = await import('@/lib/game_logic')

        // Apply mulligan selections to game state
        let newGameState = { ...currentState }
        newGameState.player1.selectedForMulligan = selectedCardIds

        newGameState = localCompleteMulligan(newGameState)
        setGameState(newGameState)

        GameLogger.action(`Mulligan completed: ${selectedCardIds.length} cards replaced`)
      } catch (error) {
        GameLogger.error('Error completing mulligan:', error)
      } finally {
        setAnimationState(false)
      }
    },
    [setGameState, setAnimationState],
  )

  /**
   * End turn
   */
  const endTurn = useCallback(async () => {
    // Get the latest state directly from the store to avoid stale closure issues
    const currentState = useGameStore.getState().gameState
    if (!currentState) return

    // Use multiplayer action if connected
    if (multiplayer.isMultiplayer) {
      await multiplayer.endTurn()
      return
    }

    // Local game logic
    try {
      const { endTurn: localEndTurn } = await import('@/lib/game_logic')
      const newGameState = await localEndTurn(currentState)
      setGameState(newGameState)

      GameLogger.action('Turn ended')
    } catch (error) {
      GameLogger.error('Error ending turn:', error)
    }
  }, [setGameState, multiplayer])

  /**
   * Reverse a card on the battlefield (Tarot mechanic)
   */
  const reverseCard = useCallback(
    async (cardId: string) => {
      // Get the latest state directly from the store to avoid stale closure issues
      const currentState = useGameStore.getState().gameState
      if (!currentState) return

      // Find the card on battlefield directly
      const playerUnits = currentState.battlefield.playerUnits
      const enemyUnits = currentState.battlefield.enemyUnits

      // Find and reverse card on battlefield
      let found = false
      const newGameState = { ...currentState }

      // Check player1 units
      for (let i = 0; i < playerUnits.length; i++) {
        if (playerUnits[i]?.id === cardId) {
          const card = playerUnits[i]!
          newGameState.battlefield.playerUnits[i] = {
            ...card,
            isReversed: !card.isReversed,
          }
          found = true
          GameLogger.action(
            `${card.name} orientation changed to ${!card.isReversed ? 'reversed' : 'upright'}`,
          )
          break
        }
      }

      // Check player2 units if not found
      if (!found) {
        for (let i = 0; i < enemyUnits.length; i++) {
          if (enemyUnits[i]?.id === cardId) {
            const card = enemyUnits[i]!
            newGameState.battlefield.enemyUnits[i] = {
              ...card,
              isReversed: !card.isReversed,
            }
            found = true
            GameLogger.action(
              `${card.name} orientation changed to ${!card.isReversed ? 'reversed' : 'upright'}`,
            )
            break
          }
        }
      }

      if (!found) {
        GameLogger.warn('Card not found on battlefield for reversal')
        return
      }

      setGameState(newGameState)
    },
    [setGameState],
  )

  /**
   * Pass priority/turn
   */
  const passPriority = useCallback(() => {
    // Get the latest state directly from the store to avoid stale closure issues
    const currentState = useGameStore.getState().gameState
    if (!currentState) return

    GameLogger.debug('Pass priority')
    // In direct attack system, this usually means end turn
    endTurn()
  }, [endTurn])

  // Deprecated functions completely removed

  /**
   * Get current game phase information
   */
  const getPhaseInfo = useCallback(() => {
    // Get the latest state directly from the store to avoid stale closure issues
    const currentState = useGameStore.getState().gameState
    if (!currentState) return null

    return {
      phase: currentState.phase,
      description: getPhaseDescription(currentState.phase),
      canAct: currentState.activePlayer === 'player1' && currentState.phase === 'action',
      isPlayerTurn: currentState.activePlayer === 'player1',
      waitingForAction: currentState.waitingForAction,
      priorityPlayer: currentState.priorityPlayer || currentState.activePlayer,
      passCount: currentState.passCount || 0,
      validTransitions: ['action', 'combat_resolution', 'end_round'], // Simplified
    }
  }, [])

  return {
    // Core actions
    playCard,
    declareAttack,
    attackTarget,
    endTurn,
    completeMulligan,
    reverseCard,
    passPriority,

    // Legacy functions completely removed

    // Info getters
    getPhaseInfo,

    // Multiplayer info
    isMultiplayer: multiplayer.isMultiplayer,
    isConnected: multiplayer.isConnected,
    connectionState: multiplayer.connectionState,
  }
}

// Helper function for phase descriptions
function getPhaseDescription(phase: string): string {
  switch (phase) {
    case 'mulligan':
      return 'Choose cards to mulligan'
    case 'round_start':
      return 'Starting new round...'
    case 'action':
      return 'Action Phase - Play cards and attack'
    case 'combat_resolution':
      return 'Resolving combat...'
    case 'end_round':
      return 'Ending round...'
    default:
      return `Unknown phase: ${phase}`
  }
}
