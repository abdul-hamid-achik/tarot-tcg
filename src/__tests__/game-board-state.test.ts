import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import GameBoard from '@/components/game_board'
import { createInitialGameState } from '@/lib/game_logic'
import type { GameState, GameCard } from '@/schemas/schema'

// Mock the game store
const mockSetGameState = vi.fn()
const mockClearAttackers = vi.fn()
const mockClearDefenderAssignments = vi.fn()
const mockSetAnimationState = vi.fn()

vi.mock('@/store/game_store', () => ({
    useGameStore: vi.fn(() => ({
        gameState: null,
        setGameState: mockSetGameState,
        clearAttackers: mockClearAttackers,
        clearDefenderAssignments: mockClearDefenderAssignments,
        setAnimationState: mockSetAnimationState,
        ui: {
            activeOverlay: null,
            cardDetailOverlay: null,
            showCardDetail: vi.fn(),
            hideCardDetail: vi.fn(),
        },
        interaction: {
            selectedCards: new Set(),
            selectedAttackers: new Set(),
            defenderAssignments: new Map(),
        },
    }))
}))

// Mock the game actions
vi.mock('@/hooks/use_game_actions', () => ({
    useGameActions: vi.fn(() => ({
        playCard: vi.fn(),
        declareAttack: vi.fn(),
        declareDefenders: vi.fn(),
        completeMulligan: vi.fn(),
        reverseCard: vi.fn(),
    }))
}))

// Mock the AI controller
vi.mock('@/hooks/use_ai_controller', () => ({
    useAIController: vi.fn(() => ({
        executeAITurn: vi.fn(),
    }))
}))

// Mock the game clock
vi.mock('@/hooks/use_game_clock', () => ({
    useGameClock: vi.fn(() => ({
        timeRemaining: 90,
        isWarning: false,
        isTimerExpired: false,
        formatTime: vi.fn((seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`),
        resetTurnTimer: vi.fn(),
    }))
}))

// Mock other components
vi.mock('@/components/ui/action_bar', () => ({
    ActionBar: ({ onAttack, onEndTurn }: any) => (
        <div data - testid= "action-bar" >
        <button onClick={ onAttack } data - testid="attack-button" > Attack </button>
< button onClick = { onEndTurn } data - testid="end-turn-button" > End Turn </button>
</div>
)
}))

vi.mock('@/components/hand/hand_fan', () => ({
    HandFan: ({ cards, onCardPlay }: any) => (
        <div data - testid= "hand-fan" >
        {
            cards.map((card: GameCard) => (
                <button
          key= { card.id }
          onClick = {() => onCardPlay(card)}
          data- testid= {`card-${card.id}`}
        >
    { card.name }
    </button>
))}
</div>
  )
}))

vi.mock('@/components/battlefield/battlefield', () => ({
    Battlefield: () => <div data - testid="battlefield"> Battlefield </div>
}))

vi.mock('@/components/ui/mulligan_overlay', () => ({
    MulliganOverlay: ({ isOpen, onMulligan }: any) =>
        isOpen ? (
            <div data - testid= "mulligan-overlay" >
            <button onClick={() => onMulligan([])} data - testid="mulligan-complete" >
Complete Mulligan
</button>
</div>
) : null
})

vi.mock('@/components/ui/card_detail_overlay', () => ({
    CardDetailOverlay: ({ isOpen, onPlay }: any) =>
        isOpen ? (
            <div data - testid= "card-detail-overlay" >
            <button onClick={ onPlay } data - testid="play-card-from-detail" >
Play Card
</button>
</div>
) : null
}))

vi.mock('@/components/ui/player_info_panel', () => ({
    PlayerInfoPanel: ({ player, onAttack, onEndTurn }: any) => (
        <div data - testid= {`player-info-${player.id}`
} >
    <span>{ player.name } </span>
    < button onClick = { onAttack } data - testid={`${player.id}-attack`}> Attack </button>
< button onClick = { onEndTurn } data - testid={`${player.id}-end-turn`}> End Turn </button>
</div>
)
}))

vi.mock('@/components/ui/background_effects', () => ({
    BackgroundEffects: () => <div data - testid="background-effects"> Background </div>
}))

vi.mock('@/components/layout/game_layout', () => ({
    GameLayout: ({ children }: any) => <div data - testid="game-layout"> { children } </div>
}))

describe('Game Board State Management Tests', () => {
    let gameState: GameState
    let mockUseGameStore: ReturnType<typeof vi.fn>

    beforeEach(() => {
        gameState = createInitialGameState()

        // Reset all mocks
        vi.clearAllMocks()

        // Set up the mock
        const { useGameStore } = require('@/store/game_store')
        mockUseGameStore = useGameStore
        mockUseGameStore.mockReturnValue({
            gameState,
            setGameState: mockSetGameState,
            clearAttackers: mockClearAttackers,
            clearDefenderAssignments: mockClearDefenderAssignments,
            setAnimationState: mockSetAnimationState,
            ui: {
                activeOverlay: null,
                cardDetailOverlay: null,
                showCardDetail: vi.fn(),
                hideCardDetail: vi.fn(),
            },
            interaction: {
                selectedCards: new Set(),
                selectedAttackers: new Set(),
                defenderAssignments: new Map(),
            },
        })
    })

    describe('Bench Card Persistence', () => {
        it('should maintain bench cards when ending turns', async () => {
            // Add a card to the bench
            const benchCard: GameCard = {
                id: 'bench-card-1',
                name: 'Bench Card',
                cost: 2,
                attack: 2,
                health: 3,
                type: 'unit',
                zodiacClass: 'aries',
                element: 'fire',
                rarity: 'common',
                description: 'A bench card',
                currentHealth: 3,
                position: 'bench',
                owner: 'player1',
            }
            gameState.player1.bench.push(benchCard)

            // Mock the endTurn function to return a new state
            const { useGameActions } = require('@/hooks/use_game_actions')
            const mockEndTurn = vi.fn()
            useGameActions.mockReturnValue({
                playCard: vi.fn(),
                declareAttack: vi.fn(),
                declareDefenders: vi.fn(),
                completeMulligan: vi.fn(),
                reverseCard: vi.fn(),
                endTurn: mockEndTurn,
            })

            // Mock endTurn to return a state that preserves bench cards
            mockEndTurn.mockResolvedValue({
                ...gameState,
                activePlayer: 'player2',
                turn: gameState.turn + 1,
                player1: {
                    ...gameState.player1,
                    bench: [...gameState.player1.bench], // Preserve bench cards
                }
            })

            render(<GameBoard />)

            // Click end turn button
            const endTurnButton = screen.getByTestId('player1-end-turn')
            fireEvent.click(endTurnButton)

            // Wait for the async operation
            await waitFor(() => {
                expect(mockEndTurn).toHaveBeenCalled()
            })

            // Check that setGameState was called with a state that preserves bench cards
            expect(mockSetGameState).toHaveBeenCalledWith(
                expect.objectContaining({
                    player1: expect.objectContaining({
                        bench: expect.arrayContaining([
                            expect.objectContaining({ id: 'bench-card-1' })
                        ])
                    })
                })
            )
        })

        it('should not lose bench cards during multiple turn transitions', async () => {
            // Add multiple cards to the bench
            const benchCards: GameCard[] = [
                {
                    id: 'bench-card-1',
                    name: 'Bench Card 1',
                    cost: 2,
                    attack: 2,
                    health: 3,
                    type: 'unit',
                    zodiacClass: 'aries',
                    element: 'fire',
                    rarity: 'common',
                    description: 'A bench card',
                    currentHealth: 3,
                    position: 'bench',
                    owner: 'player1',
                },
                {
                    id: 'bench-card-2',
                    name: 'Bench Card 2',
                    cost: 3,
                    attack: 3,
                    health: 4,
                    type: 'unit',
                    zodiacClass: 'taurus',
                    element: 'earth',
                    rarity: 'common',
                    description: 'Another bench card',
                    currentHealth: 4,
                    position: 'bench',
                    owner: 'player1',
                }
            ]
            gameState.player1.bench.push(...benchCards)

            // Mock the endTurn function
            const { useGameActions } = require('@/hooks/use_game_actions')
            const mockEndTurn = vi.fn()
            useGameActions.mockReturnValue({
                playCard: vi.fn(),
                declareAttack: vi.fn(),
                declareDefenders: vi.fn(),
                completeMulligan: vi.fn(),
                reverseCard: vi.fn(),
                endTurn: mockEndTurn,
            })

            // Mock endTurn to preserve bench cards
            mockEndTurn.mockResolvedValue({
                ...gameState,
                activePlayer: 'player2',
                turn: gameState.turn + 1,
                player1: {
                    ...gameState.player1,
                    bench: [...gameState.player1.bench],
                }
            })

            render(<GameBoard />)

            // Click end turn button multiple times
            const endTurnButton = screen.getByTestId('player1-end-turn')

            fireEvent.click(endTurnButton)
            await waitFor(() => expect(mockEndTurn).toHaveBeenCalledTimes(1))

            // Update the mock to return to player1
            mockEndTurn.mockResolvedValue({
                ...gameState,
                activePlayer: 'player1',
                turn: gameState.turn + 2,
                player1: {
                    ...gameState.player1,
                    bench: [...gameState.player1.bench],
                }
            })

            fireEvent.click(endTurnButton)
            await waitFor(() => expect(mockEndTurn).toHaveBeenCalledTimes(2))

            // Check that bench cards are preserved in all calls
            const setGameStateCalls = mockSetGameState.mock.calls
            for (const call of setGameStateCalls) {
                const state = call[0]
                expect(state.player1.bench).toHaveLength(2)
                expect(state.player1.bench).toContainEqual(
                    expect.objectContaining({ id: 'bench-card-1' })
                )
                expect(state.player1.bench).toContainEqual(
                    expect.objectContaining({ id: 'bench-card-2' })
                )
            }
        })
    })

    describe('State Update Frequency', () => {
        it('should not call setGameState excessively during normal gameplay', async () => {
            // Mock the game actions
            const { useGameActions } = require('@/hooks/use_game_actions')
            const mockPlayCard = vi.fn()
            const mockEndTurn = vi.fn()

            useGameActions.mockReturnValue({
                playCard: mockPlayCard,
                declareAttack: vi.fn(),
                declareDefenders: vi.fn(),
                completeMulligan: vi.fn(),
                reverseCard: vi.fn(),
                endTurn: mockEndTurn,
            })

            // Mock playCard to return a new state
            mockPlayCard.mockResolvedValue({
                ...gameState,
                player1: {
                    ...gameState.player1,
                    hand: gameState.player1.hand.slice(1), // Remove one card
                    bench: [...gameState.player1.bench, { id: 'new-card', name: 'New Card' }], // Add one card
                }
            })

            // Mock endTurn to return a new state
            mockEndTurn.mockResolvedValue({
                ...gameState,
                activePlayer: 'player2',
                turn: gameState.turn + 1,
            })

            render(<GameBoard />)

            // Add a card to hand for testing
            const testCard: GameCard = {
                id: 'test-card',
                name: 'Test Card',
                cost: 2,
                attack: 2,
                health: 3,
                type: 'unit',
                zodiacClass: 'aries',
                element: 'fire',
                rarity: 'common',
                description: 'A test card',
                currentHealth: 3,
                position: 'hand',
                owner: 'player1',
            }
            gameState.player1.hand.push(testCard)
            gameState.player1.mana = 3

            // Update the mock to return the new state
            mockUseGameStore.mockReturnValue({
                gameState,
                setGameState: mockSetGameState,
                clearAttackers: mockClearAttackers,
                clearDefenderAssignments: mockClearDefenderAssignments,
                setAnimationState: mockSetAnimationState,
                ui: {
                    activeOverlay: null,
                    cardDetailOverlay: null,
                    showCardDetail: vi.fn(),
                    hideCardDetail: vi.fn(),
                },
                interaction: {
                    selectedCards: new Set(),
                    selectedAttackers: new Set(),
                    defenderAssignments: new Map(),
                },
            })

            // Play a card
            const cardButton = screen.getByTestId('card-test-card')
            fireEvent.click(cardButton)

            await waitFor(() => {
                expect(mockPlayCard).toHaveBeenCalled()
            })

            // End turn
            const endTurnButton = screen.getByTestId('player1-end-turn')
            fireEvent.click(endTurnButton)

            await waitFor(() => {
                expect(mockEndTurn).toHaveBeenCalled()
            })

            // Should not call setGameState excessively
            expect(mockSetGameState).toHaveBeenCalledTimes(2) // Once for playCard, once for endTurn
        })
    })

    describe('Card State Consistency', () => {
        it('should maintain card properties during state updates', async () => {
            // Add a card to the bench
            const benchCard: GameCard = {
                id: 'bench-card-1',
                name: 'Bench Card',
                cost: 2,
                attack: 2,
                health: 3,
                type: 'unit',
                zodiacClass: 'aries',
                element: 'fire',
                rarity: 'common',
                description: 'A bench card',
                currentHealth: 3,
                position: 'bench',
                owner: 'player1',
            }
            gameState.player1.bench.push(benchCard)

            // Mock the endTurn function
            const { useGameActions } = require('@/hooks/use_game_actions')
            const mockEndTurn = vi.fn()
            useGameActions.mockReturnValue({
                playCard: vi.fn(),
                declareAttack: vi.fn(),
                declareDefenders: vi.fn(),
                completeMulligan: vi.fn(),
                reverseCard: vi.fn(),
                endTurn: mockEndTurn,
            })

            // Mock endTurn to preserve the exact card properties
            mockEndTurn.mockResolvedValue({
                ...gameState,
                activePlayer: 'player2',
                turn: gameState.turn + 1,
                player1: {
                    ...gameState.player1,
                    bench: [...gameState.player1.bench], // Preserve exact card objects
                }
            })

            render(<GameBoard />)

            // Click end turn button
            const endTurnButton = screen.getByTestId('player1-end-turn')
            fireEvent.click(endTurnButton)

            await waitFor(() => {
                expect(mockEndTurn).toHaveBeenCalled()
            })

            // Check that the card properties are preserved
            const setGameStateCalls = mockSetGameState.mock.calls
            const lastCall = setGameStateCalls[setGameStateCalls.length - 1][0]
            const preservedCard = lastCall.player1.bench[0]

            expect(preservedCard.id).toBe(benchCard.id)
            expect(preservedCard.name).toBe(benchCard.name)
            expect(preservedCard.attack).toBe(benchCard.attack)
            expect(preservedCard.health).toBe(benchCard.health)
            expect(preservedCard.currentHealth).toBe(benchCard.currentHealth)
            expect(preservedCard.position).toBe(benchCard.position)
            expect(preservedCard.owner).toBe(benchCard.owner)
        })
    })
})
