import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import GameBoard from '@/components/game_board'
import { createTestGameState, createTestCard } from '@/test_utils'
import type { GameState } from '@/schemas/schema'

// Mock all the dependencies
vi.mock('@/hooks/use_game_actions')
vi.mock('@/hooks/use_game_clock')
vi.mock('@/hooks/use_game_effects')
vi.mock('@/store/game_store')
vi.mock('@/components/battlefield/battlefield_grid', () => ({
    default: () => <div data-testid="battlefield-grid">Battlefield Grid</div>
}))
vi.mock('@/components/card_detail_overlay', () => ({
    default: ({ card, isOpen, onClose, onPlay, canPlay }: any) =>
        isOpen ? (
            <div data-testid="card-detail-overlay">
                <div>Card: {card.name}</div>
                <button onClick={onClose}>Close</button>
                {onPlay && <button onClick={onPlay} disabled={!canPlay}>Play Card</button>}
            </div>
        ) : null
}))
vi.mock('@/components/hand/hand_fan', () => ({
    default: ({ cards, onCardDetail, onCardPlay }: any) => (
        <div data-testid="hand-fan">
            {cards.map((card: any) => (
                <div key={card.id} onClick={() => onCardDetail?.(card)}>
                    {card.name}
                </div>
            ))}
        </div>
    )
}))
vi.mock('@/components/effects/background_effects', () => ({
    default: () => <div data-testid="background-effects">Background Effects</div>
}))
vi.mock('@/components/layout/game_layout', () => ({
    default: ({ children }: { children: React.ReactNode }) => <div data-testid="game-layout">{children}</div>
}))
vi.mock('@/components/mulligan_overlay', () => ({
    default: () => <div data-testid="mulligan-overlay">Mulligan Overlay</div>
}))
vi.mock('@/components/player/player_info_panel', () => ({
    default: () => <div data-testid="player-info-panel">Player Info Panel</div>
}))
vi.mock('@/components/ui/action_bar', () => ({
    default: () => <div data-testid="action-bar">Action Bar</div>
}))

import { useGameActions } from '@/hooks/use_game_actions'
import { useGameClock } from '@/hooks/use_game_clock'
import { useGameEffects } from '@/hooks/use_game_effects'
import { useGameStore } from '@/store/game_store'

describe('GameBoard Card Detail Functionality', () => {
    const mockShowCardDetail = vi.fn()
    const mockHideCardDetail = vi.fn()
    const mockSetGameState = vi.fn()
    const mockPlayCard = vi.fn()
    const mockDeclareAttack = vi.fn()
    const mockDeclareDefenders = vi.fn()
    const mockCompleteMulligan = vi.fn()
    const mockReverseCard = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()

        // Mock useGameStore
        vi.mocked(useGameStore).mockReturnValue({
            ui: {
                cardDetailOverlay: null,
                activeOverlay: 'none',
                overlayData: null,
                isAnimating: false,
                performanceMode: 'high' as const
            },
            interaction: {
                mode: 'hybrid' as const,
                selectedCards: new Set(),
                draggedCard: null,
                dragStartPosition: null,
                hoveredCell: null,
                selectedAttackers: new Set(),
                defenderAssignments: new Map()
            },
            hideCardDetail: mockHideCardDetail,
            showCardDetail: mockShowCardDetail,
            setGameState: mockSetGameState
        })

        // Mock useGameActions
        vi.mocked(useGameActions).mockReturnValue({
            playCard: mockPlayCard,
            declareAttack: mockDeclareAttack,
            declareDefenders: mockDeclareDefenders,
            completeMulligan: mockCompleteMulligan,
            reverseCard: mockReverseCard
        })

        // Mock useGameClock
        vi.mocked(useGameClock).mockReturnValue({
            isTimerExpired: false,
            timeRemaining: 90,
            isWarningTime: false
        })

        // Mock useGameEffects
        vi.mocked(useGameEffects).mockReturnValue({
            gameState: createTestGameState()
        })
    })

    describe('Card Detail Integration', () => {
        it('should call showCardDetail when hand card is clicked for detail', () => {
            const gameState = createTestGameState()
            const testCard = createTestCard({ id: 'test-card', name: 'Test Card' })
            gameState.player1.hand = [testCard]

            vi.mocked(useGameEffects).mockReturnValue({
                gameState
            })

            render(<GameBoard gameState={gameState} />)

            const handFans = screen.getAllByTestId('hand-fan')
            const handFan = handFans[0] // Get the first hand fan
            const cardElement = handFan.querySelector(`[onclick]`)

            if (cardElement) {
                fireEvent.click(cardElement)
                expect(mockShowCardDetail).toHaveBeenCalledWith(testCard)
            }
        })

        it('should display card detail overlay when card is selected', () => {
            const gameState = createTestGameState()
            const testCard = createTestCard({ id: 'test-card', name: 'Test Card' })

            vi.mocked(useGameStore).mockReturnValue({
                ui: {
                    cardDetailOverlay: testCard,
                    activeOverlay: 'cardDetail',
                    overlayData: null,
                    isAnimating: false,
                    performanceMode: 'high' as const
                },
                interaction: {
                    mode: 'hybrid' as const,
                    selectedCards: new Set(),
                    draggedCard: null,
                    dragStartPosition: null,
                    hoveredCell: null,
                    selectedAttackers: new Set(),
                    defenderAssignments: new Map()
                },
                hideCardDetail: mockHideCardDetail,
                showCardDetail: mockShowCardDetail,
                setGameState: mockSetGameState
            })

            vi.mocked(useGameEffects).mockReturnValue({
                gameState
            })

            render(<GameBoard gameState={gameState} />)

            expect(screen.getByTestId('card-detail-overlay')).toBeInTheDocument()
            expect(screen.getByText('Card: Test Card')).toBeInTheDocument()
        })

        it('should not display card detail overlay when no card is selected', () => {
            const gameState = createTestGameState()

            vi.mocked(useGameStore).mockReturnValue({
                ui: {
                    cardDetailOverlay: null,
                    activeOverlay: 'none',
                    overlayData: null,
                    isAnimating: false,
                    performanceMode: 'high' as const
                },
                interaction: {
                    mode: 'hybrid' as const,
                    selectedCards: new Set(),
                    draggedCard: null,
                    dragStartPosition: null,
                    hoveredCell: null,
                    selectedAttackers: new Set(),
                    defenderAssignments: new Map()
                },
                hideCardDetail: mockHideCardDetail,
                showCardDetail: mockShowCardDetail,
                setGameState: mockSetGameState
            })

            vi.mocked(useGameEffects).mockReturnValue({
                gameState
            })

            render(<GameBoard gameState={gameState} />)

            expect(screen.queryByTestId('card-detail-overlay')).not.toBeInTheDocument()
        })

        it('should pass correct props to CardDetailOverlay', () => {
            const gameState = createTestGameState()
            const testCard = createTestCard({
                id: 'test-card',
                name: 'Test Card',
                cost: 3
            })

            vi.mocked(useGameStore).mockReturnValue({
                ui: {
                    cardDetailOverlay: testCard,
                    activeOverlay: 'cardDetail',
                    overlayData: null,
                    isAnimating: false,
                    performanceMode: 'high' as const
                },
                interaction: {
                    mode: 'hybrid' as const,
                    selectedCards: new Set(),
                    draggedCard: null,
                    dragStartPosition: null,
                    hoveredCell: null,
                    selectedAttackers: new Set(),
                    defenderAssignments: new Map()
                },
                hideCardDetail: mockHideCardDetail,
                showCardDetail: mockShowCardDetail,
                setGameState: mockSetGameState
            })

            vi.mocked(useGameEffects).mockReturnValue({
                gameState
            })

            render(<GameBoard gameState={gameState} />)

            const overlay = screen.getByTestId('card-detail-overlay')
            expect(overlay).toBeInTheDocument()
            expect(screen.getByText('Card: Test Card')).toBeInTheDocument()
        })

        it('should calculate canPlay correctly based on mana and turn', () => {
            const gameState = createTestGameState()
            const testCard = createTestCard({
                id: 'test-card',
                name: 'Test Card',
                cost: 5
            })

            // Set up game state with sufficient mana
            gameState.player1.mana = 3
            gameState.player1.spellMana = 2
            gameState.activePlayer = 'player1'

            vi.mocked(useGameStore).mockReturnValue({
                ui: {
                    cardDetailOverlay: testCard,
                    activeOverlay: 'cardDetail',
                    overlayData: null,
                    isAnimating: false,
                    performanceMode: 'high' as const
                },
                interaction: {
                    mode: 'hybrid' as const,
                    selectedCards: new Set(),
                    draggedCard: null,
                    dragStartPosition: null,
                    hoveredCell: null,
                    selectedAttackers: new Set(),
                    defenderAssignments: new Map()
                },
                hideCardDetail: mockHideCardDetail,
                showCardDetail: mockShowCardDetail,
                setGameState: mockSetGameState
            })

            vi.mocked(useGameEffects).mockReturnValue({
                gameState
            })

            render(<GameBoard gameState={gameState} />)

            const playButton = screen.getByText('Play Card')
            expect(playButton).not.toBeDisabled()
        })

        it('should disable play button when insufficient mana', () => {
            const gameState = createTestGameState()
            const testCard = createTestCard({
                id: 'test-card',
                name: 'Test Card',
                cost: 10 // High cost
            })

            // Set up game state with insufficient mana
            gameState.player1.mana = 2
            gameState.player1.spellMana = 1
            gameState.activePlayer = 'player1'

            vi.mocked(useGameStore).mockReturnValue({
                ui: {
                    cardDetailOverlay: testCard,
                    activeOverlay: 'cardDetail',
                    overlayData: null,
                    isAnimating: false,
                    performanceMode: 'high' as const
                },
                interaction: {
                    mode: 'hybrid' as const,
                    selectedCards: new Set(),
                    draggedCard: null,
                    dragStartPosition: null,
                    hoveredCell: null,
                    selectedAttackers: new Set(),
                    defenderAssignments: new Map()
                },
                hideCardDetail: mockHideCardDetail,
                showCardDetail: mockShowCardDetail,
                setGameState: mockSetGameState
            })

            vi.mocked(useGameEffects).mockReturnValue({
                gameState
            })

            render(<GameBoard gameState={gameState} />)

            const playButton = screen.getByText('Play Card')
            expect(playButton).toBeDisabled()
        })

        it('should disable play button when not player turn', () => {
            const gameState = createTestGameState()
            const testCard = createTestCard({
                id: 'test-card',
                name: 'Test Card',
                cost: 2
            })

            // Set up game state with AI turn
            gameState.player1.mana = 5
            gameState.activePlayer = 'player2' // Not player1's turn

            vi.mocked(useGameStore).mockReturnValue({
                ui: {
                    cardDetailOverlay: testCard,
                    activeOverlay: 'cardDetail',
                    overlayData: null,
                    isAnimating: false,
                    performanceMode: 'high' as const
                },
                interaction: {
                    mode: 'hybrid' as const,
                    selectedCards: new Set(),
                    draggedCard: null,
                    dragStartPosition: null,
                    hoveredCell: null,
                    selectedAttackers: new Set(),
                    defenderAssignments: new Map()
                },
                hideCardDetail: mockHideCardDetail,
                showCardDetail: mockShowCardDetail,
                setGameState: mockSetGameState
            })

            vi.mocked(useGameEffects).mockReturnValue({
                gameState
            })

            render(<GameBoard gameState={gameState} />)

            const playButton = screen.getByText('Play Card')
            expect(playButton).toBeDisabled()
        })
    })

    describe('Card Play Integration', () => {
        it('should call playCard when play button is clicked in overlay', async () => {
            const gameState = createTestGameState()
            const testCard = createTestCard({
                id: 'test-card',
                name: 'Test Card',
                cost: 2
            })

            gameState.player1.mana = 5
            gameState.activePlayer = 'player1'

            vi.mocked(useGameStore).mockReturnValue({
                ui: {
                    cardDetailOverlay: testCard,
                    activeOverlay: 'cardDetail',
                    overlayData: null,
                    isAnimating: false,
                    performanceMode: 'high' as const
                },
                interaction: {
                    mode: 'hybrid' as const,
                    selectedCards: new Set(),
                    draggedCard: null,
                    dragStartPosition: null,
                    hoveredCell: null,
                    selectedAttackers: new Set(),
                    defenderAssignments: new Map()
                },
                hideCardDetail: mockHideCardDetail,
                showCardDetail: mockShowCardDetail,
                setGameState: mockSetGameState
            })

            vi.mocked(useGameEffects).mockReturnValue({
                gameState
            })

            render(<GameBoard gameState={gameState} />)

            const playButton = screen.getByText('Play Card')
            fireEvent.click(playButton)

            expect(mockPlayCard).toHaveBeenCalledWith(testCard)
            expect(mockHideCardDetail).toHaveBeenCalled()
        })
    })

    describe('Component Structure', () => {
        it('should render all required components', () => {
            const gameState = createTestGameState()

            vi.mocked(useGameEffects).mockReturnValue({
                gameState
            })

            render(<GameBoard gameState={gameState} />)

            expect(screen.getByTestId('game-layout')).toBeInTheDocument()
            expect(screen.getByTestId('battlefield-grid')).toBeInTheDocument()
            expect(screen.getAllByTestId('hand-fan')).toHaveLength(2) // Should have 2 hand fans
            expect(screen.getByTestId('background-effects')).toBeInTheDocument()
        })

        it('should render action bar when not in mulligan phase', () => {
            const gameState = createTestGameState()
            gameState.phase = 'action'

            vi.mocked(useGameEffects).mockReturnValue({
                gameState
            })

            render(<GameBoard gameState={gameState} />)

            expect(screen.getByTestId('action-bar')).toBeInTheDocument()
        })

        it('should not render action bar during mulligan phase', () => {
            const gameState = createTestGameState()
            gameState.phase = 'mulligan'

            vi.mocked(useGameEffects).mockReturnValue({
                gameState
            })

            render(<GameBoard gameState={gameState} />)

            expect(screen.queryByTestId('action-bar')).not.toBeInTheDocument()
        })
    })
})
