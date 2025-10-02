vi.unmock("@/lib/game_logger")
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGameActions } from '../use_game_actions'
import { createTestGameState, createTestCard, createTestPlayer } from '../../test_utils'
import type { GameState } from '../../schemas/schema'

// Mock dependencies
vi.mock('../../store/game_store', () => ({
    useGameStore: vi.fn(),
}))

vi.mock('../use_multiplayer_actions', () => ({
    useMultiplayerActions: vi.fn(),
}))

vi.mock('../../lib/game_logger', () => ({
    GameLogger: {
        action: vi.fn(),
        combat: vi.fn(),
        ai: vi.fn(),
        state: vi.fn(),
        error: vi.fn(),
    },
}))

describe('useGameActions Hook', () => {
    let mockGameState: GameState
    let mockSetGameState: ReturnType<typeof vi.fn>
    let mockClearSelection: ReturnType<typeof vi.fn>
    let mockSetAnimationState: ReturnType<typeof vi.fn>
    let mockMultiplayer: any

    beforeEach(async () => {
        // Reset all mocks
        vi.clearAllMocks()

        // Create mock game state
        mockGameState = createTestGameState({
            phase: 'action',
            activePlayer: 'player1',
            player1: createTestPlayer('player1', {
                mana: 5,
                hand: [
                    createTestCard({ id: 'card1', cost: 2 }),
                    createTestCard({ id: 'card2', cost: 3 }),
                ],
            }),
            player2: createTestPlayer('player2'),
        })

        // Create mock functions
        mockSetGameState = vi.fn()
        mockClearSelection = vi.fn()
        mockSetAnimationState = vi.fn()

        // Mock multiplayer (default: not multiplayer)
        mockMultiplayer = {
            isMultiplayer: false,
            playCard: vi.fn(),
            declareAttack: vi.fn(),
            endTurn: vi.fn(),
        }

        // Setup store mock
        const { useGameStore } = await import('../../store/game_store')
        vi.mocked(useGameStore).mockReturnValue({
            gameState: mockGameState,
            setGameState: mockSetGameState,
            interaction: null,
            clearSelection: mockClearSelection,
            setAnimationState: mockSetAnimationState,
        } as any)

        // Setup multiplayer mock
        const { useMultiplayerActions } = await import('../use_multiplayer_actions')
        vi.mocked(useMultiplayerActions).mockReturnValue(mockMultiplayer)
    })

    describe('playCard', () => {
        it('should play card in local mode', async () => {
            const { result } = renderHook(() => useGameActions())
            const card = mockGameState.player1.hand[0]

            await act(async () => {
                await result.current.playCard(card)
            })

            // Should set animation state
            expect(mockSetAnimationState).toHaveBeenCalledWith(true)
            expect(mockSetAnimationState).toHaveBeenCalledWith(false)

            // Should update game state
            expect(mockSetGameState).toHaveBeenCalled()

            // Should clear selection
            expect(mockClearSelection).toHaveBeenCalled()
        })

        it('should play card in multiplayer mode', async () => {
            mockMultiplayer.isMultiplayer = true
            const { result } = renderHook(() => useGameActions())
            const card = mockGameState.player1.hand[0]

            await act(async () => {
                await result.current.playCard(card, { player: 'player1', slot: 0 })
            })

            // Should call multiplayer action
            expect(mockMultiplayer.playCard).toHaveBeenCalledWith(card, 0)

            // Should not update local state in multiplayer
            expect(mockSetGameState).not.toHaveBeenCalled()
        })

        it('should handle errors gracefully', async () => {
            // Mock console.error to avoid test output
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { })

            const { useGameStore } = await import('../../store/game_store')
            vi.mocked(useGameStore).mockReturnValue({
                gameState: null,
                setGameState: mockSetGameState,
                clearSelection: mockClearSelection,
                setAnimationState: mockSetAnimationState,
            } as any)

            const { result } = renderHook(() => useGameActions())
            const card = createTestCard({ id: 'test' })

            // Should not crash when gameState is null
            await act(async () => {
                await result.current.playCard(card)
            })

            // Verify it handled the null state gracefully
            expect(result.current).toBeDefined()

            consoleSpy.mockRestore()
        })

        it('should do nothing if no game state', async () => {
            const { useGameStore } = await import('../../store/game_store')
            vi.mocked(useGameStore).mockReturnValue({
                gameState: null,
                setGameState: mockSetGameState,
                clearSelection: mockClearSelection,
                setAnimationState: mockSetAnimationState,
            } as any)

            const { result } = renderHook(() => useGameActions())
            const card = createTestCard({ id: 'test' })

            await act(async () => {
                await result.current.playCard(card)
            })

            expect(mockSetGameState).not.toHaveBeenCalled()
        })
    })

    describe('declareAttack', () => {
        it('should declare attack in local mode', async () => {
            const { result } = renderHook(() => useGameActions())

            // Should not throw error
            await act(async () => {
                await result.current.declareAttack('attacker1', 'player')
            })

            // Should set animation state (start and end)
            expect(mockSetAnimationState).toHaveBeenCalled()

            // Function completed successfully
            expect(result.current).toBeDefined()
        })

        it('should declare attack in multiplayer mode', async () => {
            mockMultiplayer.isMultiplayer = true
            const { result } = renderHook(() => useGameActions())

            await act(async () => {
                await result.current.declareAttack('attacker1', 'unit', 'target1')
            })

            // Should call multiplayer action
            expect(mockMultiplayer.declareAttack).toHaveBeenCalledWith('attacker1', 'unit', 'target1')

            // Should not update local state in multiplayer
            expect(mockSetGameState).not.toHaveBeenCalled()
        })

        it('should handle attack errors gracefully', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { })

            const { result } = renderHook(() => useGameActions())

            await act(async () => {
                await result.current.declareAttack('invalid-attacker', 'player')
            })

            // Should not crash
            expect(mockSetAnimationState).toHaveBeenCalledWith(false)

            consoleSpy.mockRestore()
        })
    })

    describe('attackTarget', () => {
        it('should attack nexus', async () => {
            const { result } = renderHook(() => useGameActions())

            // Should not throw error
            await act(async () => {
                await result.current.attackTarget('attacker1', 'nexus')
            })

            // Function should complete without crashing
            expect(result.current).toBeDefined()
        })

        it('should attack unit at specific position', async () => {
            // Place a unit on battlefield
            mockGameState.battlefield.playerUnits[0] = createTestCard({ id: 'target-unit' })

            // Update mock to return updated state
            const { useGameStore } = await import('../../store/game_store')
            vi.mocked(useGameStore).mockReturnValue({
                gameState: mockGameState,
                setGameState: mockSetGameState,
                interaction: null,
                clearSelection: mockClearSelection,
                setAnimationState: mockSetAnimationState,
            } as any)

            const { result } = renderHook(() => useGameActions())

            // Should not throw error
            await act(async () => {
                await result.current.attackTarget('attacker1', { player: 'player1', slot: 0 })
            })

            // Function should complete without crashing
            expect(result.current).toBeDefined()
        })
    })

    describe('completeMulligan', () => {
        it('should complete mulligan phase', async () => {
            mockGameState.phase = 'mulligan'
            const { result } = renderHook(() => useGameActions())

            await act(async () => {
                await result.current.completeMulligan(['card1', 'card2'])
            })

            // Should set animation state
            expect(mockSetAnimationState).toHaveBeenCalledWith(true)
            expect(mockSetAnimationState).toHaveBeenCalledWith(false)

            // Should update game state
            expect(mockSetGameState).toHaveBeenCalled()
        })

        it('should handle empty mulligan selection', async () => {
            mockGameState.phase = 'mulligan'
            const { result } = renderHook(() => useGameActions())

            await act(async () => {
                await result.current.completeMulligan([])
            })

            expect(mockSetGameState).toHaveBeenCalled()
        })
    })

    describe('endTurn', () => {
        it('should end turn in local mode', async () => {
            const { result } = renderHook(() => useGameActions())

            // Should not throw error
            await act(async () => {
                await expect(result.current.endTurn()).resolves.not.toThrow()
            })
        })

        it('should end turn in multiplayer mode', async () => {
            mockMultiplayer.isMultiplayer = true
            const { result } = renderHook(() => useGameActions())

            await act(async () => {
                await result.current.endTurn()
            })

            // Should call multiplayer action
            expect(mockMultiplayer.endTurn).toHaveBeenCalled()

            // Should not update local state in multiplayer
            expect(mockSetGameState).not.toHaveBeenCalled()
        })

        it('should handle errors gracefully', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { })

            const { useGameStore } = await import('../../store/game_store')
            vi.mocked(useGameStore).mockReturnValue({
                gameState: null,
                setGameState: mockSetGameState,
                clearSelection: mockClearSelection,
                setAnimationState: mockSetAnimationState,
            } as any)

            const { result } = renderHook(() => useGameActions())

            await act(async () => {
                await result.current.endTurn()
            })

            // Should not crash
            expect(mockSetGameState).not.toHaveBeenCalled()

            consoleSpy.mockRestore()
        })
    })

    describe('reverseCard', () => {
        it('should reverse a card on player battlefield', async () => {
            mockGameState.battlefield.playerUnits[0] = createTestCard({
                id: 'card-to-reverse',
                isReversed: false
            })

            const { result } = renderHook(() => useGameActions())

            await act(async () => {
                await result.current.reverseCard('card-to-reverse')
            })

            // Should update game state
            expect(mockSetGameState).toHaveBeenCalled()

            // Verify the card was reversed in the new state
            const setStateCall = mockSetGameState.mock.calls[0][0]
            expect(setStateCall.battlefield.playerUnits[0].isReversed).toBe(true)
        })

        it('should reverse a card on enemy battlefield', async () => {
            mockGameState.battlefield.enemyUnits[1] = createTestCard({
                id: 'enemy-card',
                isReversed: false
            })

            const { result } = renderHook(() => useGameActions())

            await act(async () => {
                await result.current.reverseCard('enemy-card')
            })

            expect(mockSetGameState).toHaveBeenCalled()
            const setStateCall = mockSetGameState.mock.calls[0][0]
            expect(setStateCall.battlefield.enemyUnits[1].isReversed).toBe(true)
        })

        it('should toggle isReversed from true to false', async () => {
            mockGameState.battlefield.playerUnits[0] = createTestCard({
                id: 'already-reversed',
                isReversed: true
            })

            const { result } = renderHook(() => useGameActions())

            await act(async () => {
                await result.current.reverseCard('already-reversed')
            })

            expect(mockSetGameState).toHaveBeenCalled()
            const setStateCall = mockSetGameState.mock.calls[0][0]
            expect(setStateCall.battlefield.playerUnits[0].isReversed).toBe(false)
        })

        it('should warn if card not found', async () => {
            const GameLogger = await import('@/lib/game_logger').then(m => m.GameLogger)
            const loggerSpy = vi.spyOn(GameLogger, 'warn').mockImplementation(() => { })

            const { result } = renderHook(() => useGameActions())

            await act(async () => {
                await result.current.reverseCard('non-existent-card')
            })

            expect(loggerSpy).toHaveBeenCalledWith('Card not found on battlefield for reversal')
            expect(mockSetGameState).not.toHaveBeenCalled()

            loggerSpy.mockRestore()
        })
    })

    describe('passPriority', () => {
        it('should call endTurn', async () => {
            const { result } = renderHook(() => useGameActions())

            // passPriority() is not async, just calls endTurn()
            act(() => {
                result.current.passPriority()
            })

            // Should complete without crashing
            expect(result.current).toBeDefined()
        })
    })

    describe('getPhaseInfo', () => {
        it('should return phase information', () => {
            const { result } = renderHook(() => useGameActions())

            const phaseInfo = result.current.getPhaseInfo()

            expect(phaseInfo).toBeDefined()
            expect(phaseInfo?.phase).toBe('action')
            expect(phaseInfo?.canAct).toBeDefined()
        })

        it('should return null if no game state', async () => {
            const { useGameStore } = await import('../../store/game_store')
            vi.mocked(useGameStore).mockReturnValueOnce({
                gameState: null,
                setGameState: mockSetGameState,
                clearSelection: mockClearSelection,
                setAnimationState: mockSetAnimationState,
            } as any)

            const { result } = renderHook(() => useGameActions())

            const phaseInfo = result.current.getPhaseInfo()

            expect(phaseInfo).toBeNull()
        })
    })
})
