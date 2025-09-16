import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import HandFan from '@/components/hand/hand_fan'
import { createTestCard, createTestGameState } from '@/test_utils'
import type { Card as GameCard } from '@/schemas/schema'

// Mock dependencies
vi.mock('@/store/game_store')
vi.mock('@/services/interaction_service')
vi.mock('@/components/tarot_card', () => ({
    default: ({ card, size, isSelected, draggable, className }: any) => (
        <div
            data-testid="tarot-card"
            data-card-id={card.id}
            data-size={size}
            data-selected={isSelected}
            data-draggable={draggable}
            className={className}
        >
            {card.name}
        </div>
    )
}))

import { useGameStore } from '@/store/game_store'
import { interactionService } from '@/services/interaction_service'

describe('HandFan Card Detail Functionality', () => {
    const mockShowCardDetail = vi.fn()
    const mockSelectCard = vi.fn()
    const mockUnselectCard = vi.fn()
    const mockOnCardDetail = vi.fn()
    const mockOnCardPlay = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()

        // Mock interaction service
        vi.mocked(interactionService.isDragging).mockReturnValue(false)
        vi.mocked(interactionService.handlePointerDown).mockImplementation(() => { })
        vi.mocked(interactionService.handleCellHover).mockImplementation(() => { })

        // Mock useGameStore
        vi.mocked(useGameStore).mockReturnValue({
            interaction: {
                mode: 'hybrid' as const,
                selectedCards: new Set(),
                draggedCard: null,
                dragStartPosition: null,
                hoveredCell: null,
                selectedAttackers: new Set(),
                defenderAssignments: new Map()
            },
            showCardDetail: mockShowCardDetail,
            gameState: createTestGameState()
        })

        // Mock useGameStore.getState for direct calls
        vi.mocked(useGameStore.getState).mockReturnValue({
            selectCard: mockSelectCard,
            unselectCard: mockUnselectCard,
            clearSelection: vi.fn(),
            interaction: {
                mode: 'hybrid' as const,
                selectedCards: new Set(),
                draggedCard: null,
                dragStartPosition: null,
                hoveredCell: null,
                selectedAttackers: new Set(),
                defenderAssignments: new Map()
            },
            showCardDetail: mockShowCardDetail,
            gameState: createTestGameState()
        } as any)
    })

    describe('Card Detail Display', () => {
        it('should call onCardDetail and showCardDetail when card is clicked for detail', () => {
            const cards = [
                createTestCard({ id: 'card-1', name: 'Card 1', cost: 5 }),
                createTestCard({ id: 'card-2', name: 'Card 2', cost: 2 })
            ]

            const gameState = createTestGameState()
            gameState.player1.mana = 1 // Insufficient mana for card-1
            gameState.activePlayer = 'player1'
            gameState.phase = 'action'

            vi.mocked(useGameStore).mockReturnValue({
                interaction: {
                    mode: 'hybrid' as const,
                    selectedCards: new Set(),
                    draggedCard: null,
                    dragStartPosition: null,
                    hoveredCell: null,
                    selectedAttackers: new Set(),
                    defenderAssignments: new Map()
                },
                showCardDetail: mockShowCardDetail,
                gameState
            })

            vi.mocked(useGameStore.getState).mockReturnValue({
                selectCard: mockSelectCard,
                unselectCard: mockUnselectCard,
                clearSelection: vi.fn(),
                interaction: {
                    mode: 'hybrid' as const,
                    selectedCards: new Set(),
                    draggedCard: null,
                    dragStartPosition: null,
                    hoveredCell: null,
                    selectedAttackers: new Set(),
                    defenderAssignments: new Map()
                },
                showCardDetail: mockShowCardDetail,
                gameState
            } as any)

            render(
                <HandFan
                    cards={cards}
                    position="bottom-left"
                    isCurrentPlayer={true}
                    onCardPlay={mockOnCardPlay}
                    onCardDetail={mockOnCardDetail}
                />
            )

            const cardElements = screen.getAllByTestId('tarot-card')
            const expensiveCard = cardElements.find(el => el.getAttribute('data-card-id') === 'card-1')

            if (expensiveCard) {
                fireEvent.click(expensiveCard)
                expect(mockOnCardDetail).toHaveBeenCalledWith(cards[0])
                expect(mockShowCardDetail).toHaveBeenCalledWith(cards[0])
            }
        })

        it('should call onCardDetail and showCardDetail on right click', () => {
            const cards = [createTestCard({ id: 'card-1', name: 'Card 1' })]
            const gameState = createTestGameState()

            vi.mocked(useGameStore).mockReturnValue({
                interaction: {
                    mode: 'hybrid' as const,
                    selectedCards: new Set(),
                    draggedCard: null,
                    dragStartPosition: null,
                    hoveredCell: null,
                    selectedAttackers: new Set(),
                    defenderAssignments: new Map()
                },
                showCardDetail: mockShowCardDetail,
                gameState
            })

            render(
                <HandFan
                    cards={cards}
                    position="bottom-left"
                    isCurrentPlayer={true}
                    onCardPlay={mockOnCardPlay}
                    onCardDetail={mockOnCardDetail}
                />
            )

            const cardElement = screen.getByTestId('tarot-card')
            fireEvent.contextMenu(cardElement)

            expect(mockOnCardDetail).toHaveBeenCalledWith(cards[0])
            expect(mockShowCardDetail).toHaveBeenCalledWith(cards[0])
        })

        it('should not call card detail functions for non-current player', () => {
            const cards = [createTestCard({ id: 'card-1', name: 'Card 1' })]
            const gameState = createTestGameState()

            vi.mocked(useGameStore).mockReturnValue({
                interaction: {
                    mode: 'hybrid' as const,
                    selectedCards: new Set(),
                    draggedCard: null,
                    dragStartPosition: null,
                    hoveredCell: null,
                    selectedAttackers: new Set(),
                    defenderAssignments: new Map()
                },
                showCardDetail: mockShowCardDetail,
                gameState
            })

            render(
                <HandFan
                    cards={cards}
                    position="top-right"
                    isCurrentPlayer={false}
                    onCardPlay={mockOnCardPlay}
                    onCardDetail={mockOnCardDetail}
                />
            )

            // For non-current player, cards are not rendered as interactive elements
            // They are shown as card backs only
            expect(screen.queryByTestId('tarot-card')).not.toBeInTheDocument()

            // Try to find the card back image instead
            const cardBack = screen.getByAltText('Card Back')
            fireEvent.click(cardBack)

            expect(mockOnCardDetail).not.toHaveBeenCalled()
            expect(mockShowCardDetail).not.toHaveBeenCalled()
        })
    })

    describe('Card Selection vs Detail Display', () => {
        it('should select card for placement when affordable and in action phase', () => {
            const cards = [createTestCard({ id: 'card-1', name: 'Card 1', cost: 2 })]
            const gameState = createTestGameState()
            gameState.player1.mana = 5 // Sufficient mana
            gameState.activePlayer = 'player1'
            gameState.phase = 'action'

            vi.mocked(useGameStore).mockReturnValue({
                interaction: {
                    mode: 'hybrid' as const,
                    selectedCards: new Set(),
                    draggedCard: null,
                    dragStartPosition: null,
                    hoveredCell: null,
                    selectedAttackers: new Set(),
                    defenderAssignments: new Map()
                },
                showCardDetail: mockShowCardDetail,
                gameState
            })

            vi.mocked(useGameStore.getState).mockReturnValue({
                selectCard: mockSelectCard,
                unselectCard: mockUnselectCard,
                clearSelection: vi.fn(),
                interaction: {
                    mode: 'hybrid' as const,
                    selectedCards: new Set(),
                    draggedCard: null,
                    dragStartPosition: null,
                    hoveredCell: null,
                    selectedAttackers: new Set(),
                    defenderAssignments: new Map()
                },
                showCardDetail: mockShowCardDetail,
                gameState
            } as any)

            render(
                <HandFan
                    cards={cards}
                    position="bottom-left"
                    isCurrentPlayer={true}
                    onCardPlay={mockOnCardPlay}
                    onCardDetail={mockOnCardDetail}
                />
            )

            const cardElement = screen.getByTestId('tarot-card')
            fireEvent.click(cardElement)

            expect(mockSelectCard).toHaveBeenCalledWith('card-1')
            expect(mockOnCardDetail).not.toHaveBeenCalled()
            expect(mockShowCardDetail).not.toHaveBeenCalled()
        })

        it('should deselect card if already selected', () => {
            const cards = [createTestCard({ id: 'card-1', name: 'Card 1', cost: 2 })]
            const gameState = createTestGameState()
            gameState.player1.mana = 5
            gameState.activePlayer = 'player1'
            gameState.phase = 'action'

            vi.mocked(useGameStore).mockReturnValue({
                interaction: {
                    mode: 'hybrid' as const,
                    selectedCards: new Set(['card-1']), // Already selected
                    draggedCard: null,
                    dragStartPosition: null,
                    hoveredCell: null,
                    selectedAttackers: new Set(),
                    defenderAssignments: new Map()
                },
                showCardDetail: mockShowCardDetail,
                gameState
            })

            vi.mocked(useGameStore.getState).mockReturnValue({
                selectCard: mockSelectCard,
                unselectCard: mockUnselectCard,
                clearSelection: vi.fn(),
                interaction: {
                    mode: 'hybrid' as const,
                    selectedCards: new Set(['card-1']),
                    draggedCard: null,
                    dragStartPosition: null,
                    hoveredCell: null,
                    selectedAttackers: new Set(),
                    defenderAssignments: new Map()
                },
                showCardDetail: mockShowCardDetail,
                gameState
            } as any)

            render(
                <HandFan
                    cards={cards}
                    position="bottom-left"
                    isCurrentPlayer={true}
                    onCardPlay={mockOnCardPlay}
                    onCardDetail={mockOnCardDetail}
                />
            )

            const cardElement = screen.getByTestId('tarot-card')
            fireEvent.click(cardElement)

            expect(mockUnselectCard).toHaveBeenCalledWith('card-1')
            expect(mockOnCardDetail).not.toHaveBeenCalled()
            expect(mockShowCardDetail).not.toHaveBeenCalled()
        })

        it('should show card detail when card is not affordable', () => {
            const cards = [createTestCard({ id: 'card-1', name: 'Card 1', cost: 10 })]
            const gameState = createTestGameState()
            gameState.player1.mana = 2 // Insufficient mana
            gameState.activePlayer = 'player1'
            gameState.phase = 'action'

            vi.mocked(useGameStore).mockReturnValue({
                interaction: {
                    mode: 'hybrid' as const,
                    selectedCards: new Set(),
                    draggedCard: null,
                    dragStartPosition: null,
                    hoveredCell: null,
                    selectedAttackers: new Set(),
                    defenderAssignments: new Map()
                },
                showCardDetail: mockShowCardDetail,
                gameState
            })

            vi.mocked(useGameStore.getState).mockReturnValue({
                selectCard: mockSelectCard,
                unselectCard: mockUnselectCard,
                clearSelection: vi.fn(),
                interaction: {
                    mode: 'hybrid' as const,
                    selectedCards: new Set(),
                    draggedCard: null,
                    dragStartPosition: null,
                    hoveredCell: null,
                    selectedAttackers: new Set(),
                    defenderAssignments: new Map()
                },
                showCardDetail: mockShowCardDetail,
                gameState
            } as any)

            render(
                <HandFan
                    cards={cards}
                    position="bottom-left"
                    isCurrentPlayer={true}
                    onCardPlay={mockOnCardPlay}
                    onCardDetail={mockOnCardDetail}
                />
            )

            const cardElement = screen.getByTestId('tarot-card')
            fireEvent.click(cardElement)

            expect(mockOnCardDetail).toHaveBeenCalledWith(cards[0])
            expect(mockShowCardDetail).toHaveBeenCalledWith(cards[0])
            expect(mockSelectCard).not.toHaveBeenCalled()
        })

        it('should show card detail when not in action phase', () => {
            const cards = [createTestCard({ id: 'card-1', name: 'Card 1', cost: 2 })]
            const gameState = createTestGameState()
            gameState.player1.mana = 5
            gameState.activePlayer = 'player1'
            gameState.phase = 'combat' // Wrong phase

            vi.mocked(useGameStore).mockReturnValue({
                interaction: {
                    mode: 'hybrid' as const,
                    selectedCards: new Set(),
                    draggedCard: null,
                    dragStartPosition: null,
                    hoveredCell: null,
                    selectedAttackers: new Set(),
                    defenderAssignments: new Map()
                },
                showCardDetail: mockShowCardDetail,
                gameState
            })

            vi.mocked(useGameStore.getState).mockReturnValue({
                selectCard: mockSelectCard,
                unselectCard: mockUnselectCard,
                clearSelection: vi.fn(),
                interaction: {
                    mode: 'hybrid' as const,
                    selectedCards: new Set(),
                    draggedCard: null,
                    dragStartPosition: null,
                    hoveredCell: null,
                    selectedAttackers: new Set(),
                    defenderAssignments: new Map()
                },
                showCardDetail: mockShowCardDetail,
                gameState
            } as any)

            render(
                <HandFan
                    cards={cards}
                    position="bottom-left"
                    isCurrentPlayer={true}
                    onCardPlay={mockOnCardPlay}
                    onCardDetail={mockOnCardDetail}
                />
            )

            const cardElement = screen.getByTestId('tarot-card')
            fireEvent.click(cardElement)

            expect(mockOnCardDetail).toHaveBeenCalledWith(cards[0])
            expect(mockShowCardDetail).toHaveBeenCalledWith(cards[0])
            expect(mockSelectCard).not.toHaveBeenCalled()
        })

        it('should show card detail when not player turn', () => {
            const cards = [createTestCard({ id: 'card-1', name: 'Card 1', cost: 2 })]
            const gameState = createTestGameState()
            gameState.player1.mana = 5
            gameState.activePlayer = 'player2' // Not player1's turn
            gameState.phase = 'action'

            vi.mocked(useGameStore).mockReturnValue({
                interaction: {
                    mode: 'hybrid' as const,
                    selectedCards: new Set(),
                    draggedCard: null,
                    dragStartPosition: null,
                    hoveredCell: null,
                    selectedAttackers: new Set(),
                    defenderAssignments: new Map()
                },
                showCardDetail: mockShowCardDetail,
                gameState
            })

            vi.mocked(useGameStore.getState).mockReturnValue({
                selectCard: mockSelectCard,
                unselectCard: mockUnselectCard,
                clearSelection: vi.fn(),
                interaction: {
                    mode: 'hybrid' as const,
                    selectedCards: new Set(),
                    draggedCard: null,
                    dragStartPosition: null,
                    hoveredCell: null,
                    selectedAttackers: new Set(),
                    defenderAssignments: new Map()
                },
                showCardDetail: mockShowCardDetail,
                gameState
            } as any)

            render(
                <HandFan
                    cards={cards}
                    position="bottom-left"
                    isCurrentPlayer={true}
                    onCardPlay={mockOnCardPlay}
                    onCardDetail={mockOnCardDetail}
                />
            )

            const cardElement = screen.getByTestId('tarot-card')
            fireEvent.click(cardElement)

            expect(mockOnCardDetail).toHaveBeenCalledWith(cards[0])
            expect(mockShowCardDetail).toHaveBeenCalledWith(cards[0])
            expect(mockSelectCard).not.toHaveBeenCalled()
        })
    })

    describe('Visual States', () => {
        it('should show selected state for selected cards', () => {
            const cards = [createTestCard({ id: 'card-1', name: 'Card 1' })]
            const gameState = createTestGameState()

            vi.mocked(useGameStore).mockReturnValue({
                interaction: {
                    mode: 'hybrid' as const,
                    selectedCards: new Set(['card-1']),
                    draggedCard: null,
                    dragStartPosition: null,
                    hoveredCell: null,
                    selectedAttackers: new Set(),
                    defenderAssignments: new Map()
                },
                showCardDetail: mockShowCardDetail,
                gameState
            })

            render(
                <HandFan
                    cards={cards}
                    position="bottom-left"
                    isCurrentPlayer={true}
                    onCardPlay={mockOnCardPlay}
                    onCardDetail={mockOnCardDetail}
                />
            )

            const cardElement = screen.getByTestId('tarot-card')
            expect(cardElement.getAttribute('data-selected')).toBe('true')
        })

        it('should show unselected state for unselected cards', () => {
            const cards = [createTestCard({ id: 'card-1', name: 'Card 1' })]
            const gameState = createTestGameState()

            vi.mocked(useGameStore).mockReturnValue({
                interaction: {
                    mode: 'hybrid' as const,
                    selectedCards: new Set(),
                    draggedCard: null,
                    dragStartPosition: null,
                    hoveredCell: null,
                    selectedAttackers: new Set(),
                    defenderAssignments: new Map()
                },
                showCardDetail: mockShowCardDetail,
                gameState
            })

            render(
                <HandFan
                    cards={cards}
                    position="bottom-left"
                    isCurrentPlayer={true}
                    onCardPlay={mockOnCardPlay}
                    onCardDetail={mockOnCardDetail}
                />
            )

            const cardElement = screen.getByTestId('tarot-card')
            expect(cardElement.getAttribute('data-selected')).toBe('false')
        })
    })

    describe('Position and Layout', () => {
        it('should render cards in correct positions', () => {
            const cards = [
                createTestCard({ id: 'card-1', name: 'Card 1' }),
                createTestCard({ id: 'card-2', name: 'Card 2' }),
                createTestCard({ id: 'card-3', name: 'Card 3' })
            ]
            const gameState = createTestGameState()

            vi.mocked(useGameStore).mockReturnValue({
                interaction: {
                    mode: 'hybrid' as const,
                    selectedCards: new Set(),
                    draggedCard: null,
                    dragStartPosition: null,
                    hoveredCell: null,
                    selectedAttackers: new Set(),
                    defenderAssignments: new Map()
                },
                showCardDetail: mockShowCardDetail,
                gameState
            })

            render(
                <HandFan
                    cards={cards}
                    position="bottom-left"
                    isCurrentPlayer={true}
                    onCardPlay={mockOnCardPlay}
                    onCardDetail={mockOnCardDetail}
                />
            )

            const cardElements = screen.getAllByTestId('tarot-card')
            expect(cardElements).toHaveLength(3)
            expect(cardElements[0].getAttribute('data-card-id')).toBe('card-1')
            expect(cardElements[1].getAttribute('data-card-id')).toBe('card-2')
            expect(cardElements[2].getAttribute('data-card-id')).toBe('card-3')
        })

        it('should not render when no cards provided', () => {
            const gameState = createTestGameState()

            vi.mocked(useGameStore).mockReturnValue({
                interaction: {
                    mode: 'hybrid' as const,
                    selectedCards: new Set(),
                    draggedCard: null,
                    dragStartPosition: null,
                    hoveredCell: null,
                    selectedAttackers: new Set(),
                    defenderAssignments: new Map()
                },
                showCardDetail: mockShowCardDetail,
                gameState
            })

            const { container } = render(
                <HandFan
                    cards={[]}
                    position="bottom-left"
                    isCurrentPlayer={true}
                    onCardPlay={mockOnCardPlay}
                    onCardDetail={mockOnCardDetail}
                />
            )

            expect(container.firstChild).toBeNull()
        })
    })
})
