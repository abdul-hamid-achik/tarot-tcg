import { useCallback, useEffect, useRef } from 'react'
import { FEATURE_FLAGS } from '@/config/feature_flags'
import { GameLogger } from '@/lib/game_logger'
import type { Card, PlayerId } from '@/schemas/schema'
import {
  createOptimisticAttack,
  createOptimisticPlayCard,
  optimisticUpdateService,
} from '@/services/optimistic_updates'
import { webSocketService } from '@/services/websocket_service'
import { useGameStore } from '@/store/game_store'

// Generate unique action IDs for optimistic updates
let actionIdCounter = 0
const generateActionId = () => `action_${Date.now()}_${++actionIdCounter}`

export function useMultiplayerActions() {
  const { gameState, setGameState } = useGameStore()
  const optimisticUpdatesRef = useRef<Map<string, unknown>>(new Map())
  const confirmationTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // Initialize WebSocket connection if needed
  useEffect(() => {
    if (!FEATURE_FLAGS.ENABLE_WEBSOCKETS) return

    return () => {
      // Cleanup timeouts on unmount
      for (const timeout of confirmationTimeoutRef.current.values()) {
        clearTimeout(timeout)
      }
    }
  }, [])

  // Connect to game session
  const connectToGame = useCallback(
    async (gameId: string, playerId: PlayerId, token: string): Promise<boolean> => {
      if (!FEATURE_FLAGS.ENABLE_WEBSOCKETS) {
        GameLogger.state('WebSocket disabled, using local mode')
        return false
      }

      try {
        const connected = await webSocketService.connect(gameId, playerId, token)
        if (connected) {
          GameLogger.state(`Connected to multiplayer game ${gameId} as ${playerId}`)
        }
        return connected
      } catch (error) {
        GameLogger.error('Failed to connect to multiplayer game:', error)
        return false
      }
    },
    [],
  )

  // Disconnect from game
  const disconnectFromGame = useCallback(() => {
    webSocketService.disconnect()

    // Clear any pending optimistic updates
    optimisticUpdatesRef.current.clear()
    for (const timeout of confirmationTimeoutRef.current.values()) {
      clearTimeout(timeout)
    }
    confirmationTimeoutRef.current.clear()

    GameLogger.state('Disconnected from multiplayer game')
  }, [])

  // Play card with enhanced optimistic updates
  const playCard = useCallback(
    async (card: Card, targetSlot?: number) => {
      const actionId = generateActionId()

      if (!FEATURE_FLAGS.ENABLE_MULTIPLAYER_SYNC || !webSocketService.isConnected) {
        // Fallback to local game logic
        const { playCard: localPlayCard } = await import('@/lib/game_logic')
        const newState = await localPlayCard(gameState, card, targetSlot)
        setGameState(newState)
        return
      }

      // Create optimistic update
      const optimisticState = createOptimisticPlayCard(gameState, card, targetSlot)

      // Apply through optimistic update service
      optimisticUpdateService.applyOptimistic(
        actionId,
        'play_card',
        gameState.activePlayer,
        gameState,
        optimisticState,
      )

      setGameState(optimisticState)
      GameLogger.action(`Optimistically played ${card.name}`)

      try {
        // Send to server via HTTP for reliability
        const response = await fetch('/api/game/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gameId: 'current-game', // TODO: Get from game store
            playerId: gameState.activePlayer,
            action: {
              type: 'play_card',
              cardId: card.id,
              targetSlot,
              actionId,
            },
          }),
        })

        const result = await response.json()

        if (result.success) {
          // Confirm optimistic update
          const confirmResult = optimisticUpdateService.confirmAction(actionId, result.state)

          // Use server state if provided (handles server-side randomness)
          if (confirmResult.serverState) {
            setGameState(confirmResult.serverState)
            GameLogger.action(`Server confirmed ${card.name} with server-side randomness`)
          }
        } else {
          // Revert optimistic update
          const revertResult = optimisticUpdateService.revertAction(actionId, 'rejected')
          if (revertResult.serverState) {
            setGameState(revertResult.serverState)
          }
          GameLogger.action(`Server rejected ${card.name}: ${result.error}`)
        }
      } catch (error) {
        // Network error - revert optimistic update
        const revertResult = optimisticUpdateService.revertAction(actionId, 'rejected')
        if (revertResult.serverState) {
          setGameState(revertResult.serverState)
        }
        GameLogger.action(`Network error playing ${card.name}: ${error}`)
      }
    },
    [gameState, setGameState],
  )

  // Declare attack with enhanced optimistic updates
  const declareAttack = useCallback(
    async (attackerId: string, targetType: 'unit' | 'player', targetId?: string) => {
      const actionId = generateActionId()

      if (!FEATURE_FLAGS.ENABLE_MULTIPLAYER_SYNC || !webSocketService.isConnected) {
        // Fallback to local game logic
        const { declareAttack: localDeclareAttack } = await import('@/services/combat_service')
        const newState = await localDeclareAttack(gameState, {
          attackerId,
          targetType,
          targetId,
        })
        setGameState(newState)
        return
      }

      // Create optimistic update
      const optimisticState = createOptimisticAttack(gameState, attackerId, targetType, targetId)

      // Apply through optimistic update service
      optimisticUpdateService.applyOptimistic(
        actionId,
        'declare_attack',
        gameState.activePlayer,
        gameState,
        optimisticState,
      )

      setGameState(optimisticState)
      GameLogger.combat(`Optimistically attacking with ${attackerId}`)

      try {
        // Send to server via HTTP
        const response = await fetch('/api/game/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gameId: 'current-game',
            playerId: gameState.activePlayer,
            action: {
              type: 'declare_attack',
              attackerId,
              targetType,
              targetId,
              actionId,
            },
          }),
        })

        const result = await response.json()

        if (result.success) {
          // Confirm optimistic update
          const confirmResult = optimisticUpdateService.confirmAction(actionId, result.state)
          if (confirmResult.serverState) {
            setGameState(confirmResult.serverState)
          }
          GameLogger.combat(`Attack confirmed by server`)
        } else {
          // Revert optimistic update
          const revertResult = optimisticUpdateService.revertAction(actionId, 'rejected')
          if (revertResult.serverState) {
            setGameState(revertResult.serverState)
          }
          GameLogger.combat(`Attack rejected: ${result.error}`)
        }
      } catch (error) {
        // Network error - revert optimistic update
        const revertResult = optimisticUpdateService.revertAction(actionId, 'rejected')
        if (revertResult.serverState) {
          setGameState(revertResult.serverState)
        }
        GameLogger.combat(`Network error during attack: ${error}`)
      }
    },
    [gameState, setGameState],
  )

  // End turn with optimistic updates
  const endTurn = useCallback(async () => {
    const actionId = generateActionId()

    if (!FEATURE_FLAGS.ENABLE_MULTIPLAYER_SYNC || !webSocketService.isConnected) {
      // Fallback to local game logic
      const { endTurn: localEndTurn } = await import('@/lib/game_logic')
      const newState = await localEndTurn(gameState)
      setGameState(newState)
      return
    }

    try {
      // Send to server (end turn usually not optimistic due to complexity)
      const response = await fetch('/api/game/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: 'current-game',
          playerId: gameState.activePlayer,
          action: {
            type: 'end_turn',
            actionId,
          },
        }),
      })

      const result = await response.json()

      if (result.success && result.state) {
        setGameState(result.state)
        GameLogger.action('Turn ended - received server state')
      } else {
        GameLogger.action(`End turn failed: ${result.error}`)
      }
    } catch (error) {
      GameLogger.action(`Network error ending turn: ${error}`)
    }
  }, [gameState, setGameState])

  // Get connection info with optimistic update status
  const connectionInfo = {
    isConnected: webSocketService.isConnected,
    connectionState: webSocketService.connectionState,
    queuedMessages: webSocketService.queuedMessages,
    pendingActions: optimisticUpdateService.getPendingCount(),
  }

  return {
    // Connection management
    connectToGame,
    disconnectFromGame,

    // Game actions
    playCard,
    declareAttack,
    endTurn,

    // Connection info
    ...connectionInfo,

    // Helper flags
    isMultiplayer: FEATURE_FLAGS.ENABLE_WEBSOCKETS && webSocketService.isConnected,
    isLocal: !FEATURE_FLAGS.ENABLE_WEBSOCKETS || !webSocketService.isConnected,

    // Optimistic update service access
    optimisticService: optimisticUpdateService,
  }
}

// Old optimistic helpers removed - now using OptimisticUpdateService
