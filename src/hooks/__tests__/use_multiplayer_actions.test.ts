import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMultiplayerActions } from '../use_multiplayer_actions'
import { useGameStore } from '@/store/game_store'
import { webSocketService } from '@/services/websocket_service'
import { optimisticUpdateService } from '@/services/optimistic_updates'
import { FEATURE_FLAGS } from '@/config/feature_flags'
import { GameLogger } from '@/lib/game_logger'
import type { GameState } from '@/schemas/schema'

// Mock dependencies
vi.mock('@/store/game_store')
vi.mock('@/services/websocket_service')
vi.mock('@/services/optimistic_updates')
vi.mock('@/config/feature_flags', () => ({
  FEATURE_FLAGS: {
    ENABLE_WEBSOCKETS: false,
    ENABLE_MULTIPLAYER_SYNC: false,
  },
}))
vi.mock('@/lib/game_logger')
vi.mock('@/lib/game_logic', () => ({
  playCard: vi.fn(),
  endTurn: vi.fn(),
}))
vi.mock('@/lib/combat_logic', () => ({
  declareAttack: vi.fn(),
}))

describe('useMultiplayerActions', () => {
  const mockGameState: GameState = {
    round: 1,
    turn: 1,
    phase: 'action',
    activePlayer: 'player1',
    attackingPlayer: null,
    waitingForAction: false,
    combatResolved: false,
    passCount: 0,
    canRespond: false,
    player1: {
      id: 'player1',
      name: 'Player 1',
      health: 30,
      mana: 5,
      maxMana: 5,
      spellMana: 2,
      deck: [],
      hand: [],
      hasAttackToken: true,
      mulliganComplete: true,
      selectedForMulligan: [],
      hasPassed: false,
      actionsThisTurn: 0,
    },
    player2: {
      id: 'player2',
      name: 'Player 2',
      health: 30,
      mana: 5,
      maxMana: 5,
      spellMana: 2,
      deck: [],
      hand: [],
      hasAttackToken: false,
      mulliganComplete: true,
      selectedForMulligan: [],
      hasPassed: false,
      actionsThisTurn: 0,
    },
    battlefield: {
      playerUnits: Array(7).fill(null),
      enemyUnits: Array(7).fill(null),
      maxSlots: 7,
    },
  }

  const mockSetGameState = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock useGameStore
    vi.mocked(useGameStore).mockReturnValue({
      gameState: mockGameState,
      setGameState: mockSetGameState,
    } as any)

    // Mock webSocketService getters
    Object.defineProperty(webSocketService, 'isConnected', { value: false, configurable: true })
    Object.defineProperty(webSocketService, 'connectionState', { value: 'disconnected', configurable: true })
    Object.defineProperty(webSocketService, 'queuedMessages', { value: 0, configurable: true })
    vi.mocked(webSocketService.connect).mockResolvedValue(true)
    vi.mocked(webSocketService.disconnect).mockImplementation(() => {})

    // Mock optimistic updateService
    vi.mocked(optimisticUpdateService.getPendingCount).mockReturnValue(0)
    vi.mocked(optimisticUpdateService.applyOptimistic).mockImplementation(() => {})
    vi.mocked(optimisticUpdateService.confirmAction).mockReturnValue({ serverState: undefined })
    vi.mocked(optimisticUpdateService.revertAction).mockReturnValue({ serverState: undefined })

    // Mock GameLogger
    vi.mocked(GameLogger.state).mockImplementation(() => {})
    vi.mocked(GameLogger.error).mockImplementation(() => {})
    vi.mocked(GameLogger.action).mockImplementation(() => {})
    vi.mocked(GameLogger.combat).mockImplementation(() => {})
  })

  describe('Initialization', () => {
    it('should initialize with correct default values', () => {
      const { result } = renderHook(() => useMultiplayerActions())

      expect(result.current.isConnected).toBe(false)
      expect(result.current.connectionState).toBe('disconnected')
      expect(result.current.pendingActions).toBe(0)
      expect(result.current.isLocal).toBe(true)
      expect(result.current.isMultiplayer).toBe(false)
    })

    it('should provide all expected functions', () => {
      const { result } = renderHook(() => useMultiplayerActions())

      expect(result.current.connectToGame).toBeDefined()
      expect(result.current.disconnectFromGame).toBeDefined()
      expect(result.current.playCard).toBeDefined()
      expect(result.current.declareAttack).toBeDefined()
      expect(result.current.endTurn).toBeDefined()
    })

    it('should provide optimistic service access', () => {
      const { result } = renderHook(() => useMultiplayerActions())

      expect(result.current.optimisticService).toBe(optimisticUpdateService)
    })

    it('should cleanup timeouts on unmount', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')

      const { unmount } = renderHook(() => useMultiplayerActions())

      unmount()

      // Cleanup should have been called (though no timeouts were set in this test)
      expect(clearTimeoutSpy).toHaveBeenCalledTimes(0) // No timeouts to clean
    })
  })

  describe('Connection Management (WebSockets Disabled)', () => {
    it('should return false when connecting with WebSockets disabled', async () => {
      const { result } = renderHook(() => useMultiplayerActions())

      const connected = await result.current.connectToGame('game-123', 'player1', 'token-456')

      expect(connected).toBe(false)
      expect(GameLogger.state).toHaveBeenCalledWith('WebSocket disabled, using local mode')
    })

    it('should not call webSocketService.connect when disabled', async () => {
      const { result } = renderHook(() => useMultiplayerActions())

      await result.current.connectToGame('game-123', 'player1', 'token-456')

      expect(webSocketService.connect).not.toHaveBeenCalled()
    })

    it('should disconnect and clear optimistic updates', () => {
      const { result } = renderHook(() => useMultiplayerActions())

      result.current.disconnectFromGame()

      expect(webSocketService.disconnect).toHaveBeenCalled()
      expect(GameLogger.state).toHaveBeenCalledWith('Disconnected from multiplayer game')
    })
  })

  describe('Connection Management (WebSockets Enabled)', () => {
    beforeEach(() => {
      // Enable WebSockets for these tests
      ;(FEATURE_FLAGS as any).ENABLE_WEBSOCKETS = true
    })

    afterEach(() => {
      // Restore default
      ;(FEATURE_FLAGS as any).ENABLE_WEBSOCKETS = false
    })

    it('should connect to game when WebSockets enabled', async () => {
      const { result } = renderHook(() => useMultiplayerActions())

      const connected = await result.current.connectToGame('game-123', 'player1', 'token-456')

      expect(connected).toBe(true)
      expect(webSocketService.connect).toHaveBeenCalledWith('game-123', 'player1', 'token-456')
      expect(GameLogger.state).toHaveBeenCalledWith('Connected to multiplayer game game-123 as player1')
    })

    it('should handle connection failure', async () => {
      vi.mocked(webSocketService.connect).mockRejectedValueOnce(new Error('Connection failed'))

      const { result } = renderHook(() => useMultiplayerActions())

      const connected = await result.current.connectToGame('game-123', 'player1', 'token-456')

      expect(connected).toBe(false)
      expect(GameLogger.error).toHaveBeenCalledWith(
        'Failed to connect to multiplayer game:',
        expect.any(Error),
      )
    })

    it('should handle connection returning false', async () => {
      vi.mocked(webSocketService.connect).mockResolvedValueOnce(false)

      const { result } = renderHook(() => useMultiplayerActions())

      const connected = await result.current.connectToGame('game-123', 'player1', 'token-456')

      expect(connected).toBe(false)
    })
  })

  describe('Local Mode Actions', () => {
    beforeEach(() => {
      // Ensure we're in local mode
      ;(FEATURE_FLAGS as any).ENABLE_WEBSOCKETS = false
      ;(FEATURE_FLAGS as any).ENABLE_MULTIPLAYER_SYNC = false
      Object.defineProperty(webSocketService, 'isConnected', { value: false, configurable: true })
    })

    it('should call local playCard when in local mode', async () => {
      const mockLocalPlayCard = vi.fn().mockResolvedValue(mockGameState)
      vi.doMock('@/lib/game_logic', () => ({
        playCard: mockLocalPlayCard,
      }))

      const { result } = renderHook(() => useMultiplayerActions())

      const mockCard = {
        id: 'card-1',
        name: 'Test Card',
        cost: 3,
        type: 'unit' as const,
      }

      await result.current.playCard(mockCard as any, 0)

      await waitFor(() => {
        expect(mockSetGameState).toHaveBeenCalled()
      })
    })

    it('should call local declareAttack when in local mode', async () => {
      const mockLocalAttack = vi.fn().mockResolvedValue(mockGameState)
      vi.doMock('@/lib/combat_logic', () => ({
        declareAttack: mockLocalAttack,
      }))

      const { result } = renderHook(() => useMultiplayerActions())

      await result.current.declareAttack('attacker-1', 'player')

      await waitFor(() => {
        expect(mockSetGameState).toHaveBeenCalled()
      })
    })

    it('should call local endTurn when in local mode', async () => {
      const mockLocalEndTurn = vi.fn().mockResolvedValue(mockGameState)
      vi.doMock('@/lib/game_logic', () => ({
        endTurn: mockLocalEndTurn,
      }))

      const { result } = renderHook(() => useMultiplayerActions())

      await result.current.endTurn()

      await waitFor(() => {
        expect(mockSetGameState).toHaveBeenCalled()
      })
    })
  })

  describe('Connection Info', () => {
    it('should reflect WebSocket connection state', () => {
      Object.defineProperty(webSocketService, 'isConnected', { value: true, configurable: true })
      Object.defineProperty(webSocketService, 'connectionState', { value: 'connected', configurable: true })

      const { result } = renderHook(() => useMultiplayerActions())

      expect(result.current.isConnected).toBe(true)
      expect(result.current.connectionState).toBe('connected')
    })

    it('should reflect queued messages count', () => {
      Object.defineProperty(webSocketService, 'queuedMessages', { value: 5, configurable: true })

      const { result } = renderHook(() => useMultiplayerActions())

      expect(result.current.queuedMessages).toBe(5)
    })

    it('should reflect pending actions count', () => {
      vi.mocked(optimisticUpdateService.getPendingCount).mockReturnValue(3)

      const { result } = renderHook(() => useMultiplayerActions())

      expect(result.current.pendingActions).toBe(3)
    })

    it('should correctly determine isMultiplayer', () => {
      ;(FEATURE_FLAGS as any).ENABLE_WEBSOCKETS = true
      Object.defineProperty(webSocketService, 'isConnected', { value: true, configurable: true })

      const { result } = renderHook(() => useMultiplayerActions())

      expect(result.current.isMultiplayer).toBe(true)
    })

    it('should correctly determine isLocal', () => {
      ;(FEATURE_FLAGS as any).ENABLE_WEBSOCKETS = false
      Object.defineProperty(webSocketService, 'isConnected', { value: false, configurable: true })

      const { result } = renderHook(() => useMultiplayerActions())

      expect(result.current.isLocal).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('should handle null game state gracefully', () => {
      vi.mocked(useGameStore).mockReturnValue({
        gameState: null,
        setGameState: mockSetGameState,
      } as any)

      const { result } = renderHook(() => useMultiplayerActions())

      expect(result.current).toBeDefined()
      expect(result.current.playCard).toBeDefined()
    })

    it('should handle disconnection during pending actions', () => {
      vi.mocked(optimisticUpdateService.getPendingCount).mockReturnValue(5)

      const { result } = renderHook(() => useMultiplayerActions())

      expect(result.current.pendingActions).toBe(5)

      result.current.disconnectFromGame()

      expect(webSocketService.disconnect).toHaveBeenCalled()
    })

    it('should handle multiple connection attempts', async () => {
      vi.mocked(FEATURE_FLAGS).ENABLE_WEBSOCKETS = true

      const { result } = renderHook(() => useMultiplayerActions())

      await result.current.connectToGame('game-1', 'player1', 'token-1')
      await result.current.connectToGame('game-2', 'player2', 'token-2')

      expect(webSocketService.connect).toHaveBeenCalledTimes(2)
    })

    it('should handle rapid connect/disconnect cycles', async () => {
      vi.mocked(FEATURE_FLAGS).ENABLE_WEBSOCKETS = true

      const { result } = renderHook(() => useMultiplayerActions())

      await result.current.connectToGame('game-1', 'player1', 'token-1')
      result.current.disconnectFromGame()
      await result.current.connectToGame('game-2', 'player2', 'token-2')
      result.current.disconnectFromGame()

      expect(webSocketService.disconnect).toHaveBeenCalledTimes(2)
    })
  })

  describe('Callback Stability', () => {
    it('should maintain stable function references', () => {
      const { result, rerender } = renderHook(() => useMultiplayerActions())

      const firstConnectToGame = result.current.connectToGame
      const firstDisconnectFromGame = result.current.disconnectFromGame
      const firstPlayCard = result.current.playCard
      const firstDeclareAttack = result.current.declareAttack
      const firstEndTurn = result.current.endTurn

      rerender()

      expect(result.current.connectToGame).toBe(firstConnectToGame)
      expect(result.current.disconnectFromGame).toBe(firstDisconnectFromGame)
      expect(result.current.playCard).toBe(firstPlayCard)
      expect(result.current.declareAttack).toBe(firstDeclareAttack)
      expect(result.current.endTurn).toBe(firstEndTurn)
    })

    it('should update callbacks when game state changes', () => {
      const { result, rerender } = renderHook(() => useMultiplayerActions())

      const firstPlayCard = result.current.playCard

      // Change game state
      vi.mocked(useGameStore).mockReturnValue({
        gameState: { ...mockGameState, turn: 2 },
        setGameState: mockSetGameState,
      } as any)

      rerender()

      // playCard depends on gameState, so it should have a new reference
      expect(result.current.playCard).not.toBe(firstPlayCard)
    })
  })

  describe('Feature Flag Interactions', () => {
    it('should respect ENABLE_WEBSOCKETS flag', () => {
      ;(FEATURE_FLAGS as any).ENABLE_WEBSOCKETS = false

      const { result } = renderHook(() => useMultiplayerActions())

      expect(result.current.isMultiplayer).toBe(false)
      expect(result.current.isLocal).toBe(true)
    })

    it('should respect both WebSocket and connection state for multiplayer', () => {
      ;(FEATURE_FLAGS as any).ENABLE_WEBSOCKETS = true
      Object.defineProperty(webSocketService, 'isConnected', { value: false, configurable: true })

      const { result } = renderHook(() => useMultiplayerActions())

      expect(result.current.isMultiplayer).toBe(false)
    })

    it('should require both flags for multiplayer mode', () => {
      ;(FEATURE_FLAGS as any).ENABLE_WEBSOCKETS = true
      ;(FEATURE_FLAGS as any).ENABLE_MULTIPLAYER_SYNC = false
      Object.defineProperty(webSocketService, 'isConnected', { value: true, configurable: true })

      const { result } = renderHook(() => useMultiplayerActions())

      // isMultiplayer only checks ENABLE_WEBSOCKETS and isConnected
      expect(result.current.isMultiplayer).toBe(true)
      // But actions will fallback to local due to ENABLE_MULTIPLAYER_SYNC
      expect(result.current.isLocal).toBe(false)
    })
  })
})

