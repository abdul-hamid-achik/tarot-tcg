import { useCallback } from 'react'
import type { Card as GameCard, GameState, PlayerId } from '@/schemas/schema'
import { useGameStore } from '@/store/game_store'
import { useMultiplayerActions } from '@/hooks/use_multiplayer_actions'
import { FEATURE_FLAGS } from '@/config/feature_flags'
import { GameLogger } from '@/lib/game_logger'
import type { BattlefieldPosition } from '@/services/battlefield_service'

/**
 * Unified game actions hook for Tarot TCG
 * Supports both local and multiplayer gameplay with direct attack system
 */
export const useGameActions = () => {
  const {
    gameState,
    setGameState,
    interaction,
    clearSelection,
    setAnimationState,
  } = useGameStore()

  // Get multiplayer actions for WebSocket-enabled games
  const multiplayer = useMultiplayerActions()

  /**
   * Play a card to the battlefield or cast a spell
   * Supports both local and multiplayer modes
   */
  const playCard = useCallback(
    async (card: GameCard, targetPosition?: BattlefieldPosition) => {
      if (!gameState) return

      // Use multiplayer action if connected
      if (multiplayer.isMultiplayer) {
        await multiplayer.playCard(card, targetPosition?.slot)
        return
      }

      // Local game logic
      try {
        setAnimationState(true)

        // Import game logic dynamically to avoid circular deps
        const { playCard: localPlayCard } = await import('@/lib/game_logic')
        const newGameState = await localPlayCard(gameState, card, targetPosition?.slot)

        setGameState(newGameState)
        clearSelection()

        GameLogger.action(`Played ${card.name}`)
      } catch (error) {
        console.error('Error playing card:', error)
        GameLogger.action(`Failed to play ${card.name}: ${error}`)
      } finally {
        setAnimationState(false)
      }
    },
    [gameState, setGameState, clearSelection, setAnimationState, multiplayer]
  )

  /**
   * Declare attack using direct attack system (Hearthstone-style)
   */
  const declareAttack = useCallback(
    async (attackerId: string, targetType: 'unit' | 'player', targetId?: string) => {
      if (!gameState) return

      // Use multiplayer action if connected
      if (multiplayer.isMultiplayer) {
        await multiplayer.declareAttack(attackerId, targetType, targetId)
        return
      }

      // Local game logic
      try {
        setAnimationState(true)

        const { declareAttack: localDeclareAttack } = await import('@/lib/combat_logic')
        const newGameState = await localDeclareAttack(gameState, {
          attackerId,
          targetType,
          targetId
        })

        setGameState(newGameState)
        clearSelection()

        GameLogger.combat(`Attack executed: ${attackerId} -> ${targetType}`)
      } catch (error) {
        console.error('Error declaring attack:', error)
        GameLogger.combat(`Attack failed: ${error}`)
      } finally {
        setAnimationState(false)
      }
    },
    [gameState, setGameState, clearSelection, setAnimationState, multiplayer]
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
        // Find the target unit ID
        const targetUnits = target.player === 'player1'
          ? gameState?.battlefield.playerUnits
          : gameState?.battlefield.enemyUnits

        const targetUnit = targetUnits?.[target.slot]
        if (targetUnit) {
          await declareAttack(attackerId, 'unit', targetUnit.id)
        }
      }
    },
    [gameState, declareAttack]
  )

  /**
   * Complete mulligan phase
   */
  const completeMulligan = useCallback(
    async (selectedCardIds: string[]) => {
      if (!gameState) return

      try {
        setAnimationState(true)

        const { completeMulligan: localCompleteMulligan } = await import('@/lib/game_logic')

        // Apply mulligan selections to game state
        let newGameState = { ...gameState }
        newGameState.player1.selectedForMulligan = selectedCardIds

        newGameState = localCompleteMulligan(newGameState)
        setGameState(newGameState)

        GameLogger.action(`Mulligan completed: ${selectedCardIds.length} cards replaced`)
      } catch (error) {
        console.error('Error completing mulligan:', error)
      } finally {
        setAnimationState(false)
      }
    },
    [gameState, setGameState, setAnimationState]
  )

  /**
   * End turn
   */
  const endTurn = useCallback(async () => {
    if (!gameState) return

    // Use multiplayer action if connected
    if (multiplayer.isMultiplayer) {
      await multiplayer.endTurn()
      return
    }

    // Local game logic
    try {
      const { endTurn: localEndTurn } = await import('@/lib/game_logic')
      const newGameState = await localEndTurn(gameState)
      setGameState(newGameState)

      GameLogger.action('Turn ended')
    } catch (error) {
      console.error('Error ending turn:', error)
    }
  }, [gameState, setGameState, multiplayer])

  /**
   * Reverse a card on the battlefield (Tarot mechanic)
   */
  const reverseCard = useCallback(
    async (cardId: string) => {
      if (!gameState) return

      // Find the card on battlefield directly
      const playerUnits = gameState.battlefield.playerUnits
      const enemyUnits = gameState.battlefield.enemyUnits

      // Find and reverse card on battlefield
      let found = false
      const newGameState = { ...gameState }

      // Check player1 units
      for (let i = 0; i < playerUnits.length; i++) {
        if (playerUnits[i]?.id === cardId) {
          const card = playerUnits[i]!
          newGameState.battlefield.playerUnits[i] = {
            ...card,
            isReversed: !card.isReversed,
          }
          found = true
          GameLogger.action(`${card.name} orientation changed to ${!card.isReversed ? 'reversed' : 'upright'}`)
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
            GameLogger.action(`${card.name} orientation changed to ${!card.isReversed ? 'reversed' : 'upright'}`)
            break
          }
        }
      }

      if (!found) {
        console.warn('Card not found on battlefield for reversal')
        return
      }

      setGameState(newGameState)
    },
    [gameState, setGameState]
  )

  /**
   * Pass priority/turn
   */
  const passPriority = useCallback(() => {
    if (!gameState) return

    console.log('Pass priority')
    // In direct attack system, this usually means end turn
    endTurn()
  }, [gameState, endTurn])

  // Deprecated functions completely removed

  /**
   * Get current game phase information
   */
  const getPhaseInfo = useCallback(() => {
    if (!gameState) return null

    return {
      phase: gameState.phase,
      description: getPhaseDescription(gameState.phase),
      canAct: gameState.activePlayer === 'player1' && gameState.phase === 'action',
      isPlayerTurn: gameState.activePlayer === 'player1',
      waitingForAction: gameState.waitingForAction,
      priorityPlayer: gameState.priorityPlayer || gameState.activePlayer,
      passCount: gameState.passCount || 0,
      validTransitions: ['action', 'combat_resolution', 'end_round'], // Simplified
    }
  }, [gameState])

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