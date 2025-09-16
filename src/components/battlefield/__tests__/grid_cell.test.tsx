import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import GridCell from '@/components/battlefield/grid_cell'
import { createTestCard, createTestGameState } from '@/test_utils'
import type { CellPosition, CellType } from '@/store/game_store'

// Mock dependencies
vi.mock('@/store/game_store')
vi.mock('@/services/state_manager')
vi.mock('@/services/animation_service')
vi.mock('@/services/interaction_service')
vi.mock('@/components/tarot_card', () => ({
    default: ({ card, size, isSelected, isDamaged }: any) => (
        <div
            data-testid="tarot-card"
            data-card-id={card.id}
            data-size={size}
            data-selected={isSelected}
            data-damaged={isDamaged}
            className="tarot-card"
        >
            {card.name}
        </div>
    )
}))

import { useGameStore } from '@/store/game_store'
import { stateManager } from '@/services/state_manager'
import { animationService } from '@/services/animation_service'
import { interactionService } from '@/services/interaction_service'

describe('GridCell Card Detail Functionality', () => {
    const mockShowCardDetail = vi.fn()
    const mockSelectCard = vi.fn()
    const mockUnselectCard = vi.fn()
    const mockClearSelection = vi.fn()
    const mockAssignDefender = vi.fn()
    const mockRemoveDefenderAssignment = vi.fn()
    const mockSetHoveredCell = vi.fn()

    const defaultPosition: CellPosition = { row: 3, col: 2 }
    const defaultCellType: CellType = 'player_bench'

    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    beforeEach(() => {
        // Mock state manager
        vi.mocked(stateManager.getCardAtPosition).mockReturnValue(null)

        // Mock animation service
        vi.mocked(animationService.animateCellHighlight).mockImplementation(() => { })

        // Mock interaction service
        vi.mocked(interactionService.isDragging).mockReturnValue(false)
        vi.mocked(interactionService.handlePointerDown).mockImplementation(() => { })
        vi.mocked(interactionService.handleCellHover).mockImplementation(() => { })
        vi.mocked(interactionService.getDragState).mockReturnValue({
            draggedCard: null,
            sourcePosition: null,
            isValidTarget: false
        })

        // Mock useGameStore
        vi.mocked(useGameStore).mockReturnValue({
            gameState: createTestGameState(),
            grid: {
                highlightedCells: new Set(),
                validDropZones: new Set()
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
            setHoveredCell: mockSetHoveredCell,
            assignDefender: mockAssignDefender,
            removeDefenderAssignment: mockRemoveDefenderAssignment
        })

        // Mock useGameStore.getState for direct calls
        vi.mocked(useGameStore.getState).mockReturnValue({
            selectCard: mockSelectCard,
            unselectCard: mockUnselectCard,
            clearSelection: mockClearSelection,
            showCardDetail: mockShowCardDetail,
            gameState: createTestGameState(),
            grid: {
                highlightedCells: new Set(),
                validDropZones: new Set()
            },
            interaction: {
                mode: 'hybrid' as const,
                selectedCards: new Set(),
                draggedCard: null,
                dragStartPosition: null,
                hoveredCell: null,
                selectedAttackers: new Set(),
                defenderAssignments: new Map()
            }
        } as any)
    })

    describe('Double-Click Card Detail', () => {
        it('should show card detail on double-click', () => {
            const testCard = createTestCard({
                id: 'test-card',
                name: 'Test Card',
                position: 'bench'
            })

            vi.mocked(stateManager.getCardAtPosition).mockReturnValue(testCard)

            const gameState = createTestGameState()
            gameState.activePlayer = 'player1'
            gameState.phase = 'action'

            vi.mocked(useGameStore).mockReturnValue({
                gameState,
                grid: {
                    highlightedCells: new Set(),
                    validDropZones: new Set()
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
                setHoveredCell: mockSetHoveredCell,
                assignDefender: mockAssignDefender,
                removeDefenderAssignment: mockRemoveDefenderAssignment
            })

            vi.mocked(useGameStore.getState).mockReturnValue({
                selectCard: mockSelectCard,
                unselectCard: mockUnselectCard,
                clearSelection: mockClearSelection,
                showCardDetail: mockShowCardDetail,
                gameState,
                grid: {
                    highlightedCells: new Set(),
                    validDropZones: new Set()
                },
                interaction: {
                    mode: 'hybrid' as const,
                    selectedCards: new Set(),
                    draggedCard: null,
                    dragStartPosition: null,
                    hoveredCell: null,
                    selectedAttackers: new Set(),
                    defenderAssignments: new Map()
                }
            } as any)

            render(
                <GridCell
                    position={defaultPosition}
                    cellType={defaultCellType}
                />
            )

            const cell = screen.getByRole('button')

            // First click
            fireEvent.click(cell)
            expect(mockShowCardDetail).not.toHaveBeenCalled()

            // Second click within 300ms (double-click)
            fireEvent.click(cell)
            expect(mockShowCardDetail).toHaveBeenCalledWith(testCard)
        })

        it('should not show card detail on single click', () => {
            const testCard = createTestCard({
                id: 'test-card',
                name: 'Test Card',
                position: 'bench'
            })

            vi.mocked(stateManager.getCardAtPosition).mockReturnValue(testCard)

            const gameState = createTestGameState()
            gameState.activePlayer = 'player1'
            gameState.phase = 'action'

            vi.mocked(useGameStore).mockReturnValue({
                gameState,
                grid: {
                    highlightedCells: new Set(),
                    validDropZones: new Set()
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
                setHoveredCell: mockSetHoveredCell,
                assignDefender: mockAssignDefender,
                removeDefenderAssignment: mockRemoveDefenderAssignment
            })

            vi.mocked(useGameStore.getState).mockReturnValue({
                selectCard: mockSelectCard,
                unselectCard: mockUnselectCard,
                clearSelection: mockClearSelection,
                showCardDetail: mockShowCardDetail,
                gameState,
                grid: {
                    highlightedCells: new Set(),
                    validDropZones: new Set()
                },
                interaction: {
                    mode: 'hybrid' as const,
                    selectedCards: new Set(),
                    draggedCard: null,
                    dragStartPosition: null,
                    hoveredCell: null,
                    selectedAttackers: new Set(),
                    defenderAssignments: new Map()
                }
            } as any)

            render(
                <GridCell
                    position={defaultPosition}
                    cellType={defaultCellType}
                />
            )

            const cell = screen.getByRole('button')
            fireEvent.click(cell)

            expect(mockShowCardDetail).not.toHaveBeenCalled()
        })

        it('should not show card detail for non-player controlled cells', () => {
            const testCard = createTestCard({
                id: 'test-card',
                name: 'Test Card',
                position: 'bench'
            })

            vi.mocked(stateManager.getCardAtPosition).mockReturnValue(testCard)

            const gameState = createTestGameState()
            gameState.activePlayer = 'player1'
            gameState.phase = 'action'

            vi.mocked(useGameStore).mockReturnValue({
                gameState,
                grid: {
                    highlightedCells: new Set(),
                    validDropZones: new Set()
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
                setHoveredCell: mockSetHoveredCell,
                assignDefender: mockAssignDefender,
                removeDefenderAssignment: mockRemoveDefenderAssignment
            })

            vi.mocked(useGameStore.getState).mockReturnValue({
                selectCard: mockSelectCard,
                unselectCard: mockUnselectCard,
                clearSelection: mockClearSelection,
                showCardDetail: mockShowCardDetail,
                gameState,
                grid: {
                    highlightedCells: new Set(),
                    validDropZones: new Set()
                },
                interaction: {
                    mode: 'hybrid' as const,
                    selectedCards: new Set(),
                    draggedCard: null,
                    dragStartPosition: null,
                    hoveredCell: null,
                    selectedAttackers: new Set(),
                    defenderAssignments: new Map()
                }
            } as any)

            // Test with enemy bench cell
            render(
                <GridCell
                    position={{ row: 0, col: 2 }}
                    cellType="enemy_bench"
                />
            )

            const cell = screen.getByRole('button')

            // Double-click
            fireEvent.click(cell)
            fireEvent.click(cell)

            expect(mockShowCardDetail).not.toHaveBeenCalled()
        })

        it('should not show card detail when no card is present', () => {
            vi.mocked(stateManager.getCardAtPosition).mockReturnValue(null)

            const gameState = createTestGameState()
            gameState.activePlayer = 'player1'
            gameState.phase = 'action'

            vi.mocked(useGameStore).mockReturnValue({
                gameState,
                grid: {
                    highlightedCells: new Set(),
                    validDropZones: new Set()
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
                setHoveredCell: mockSetHoveredCell,
                assignDefender: mockAssignDefender,
                removeDefenderAssignment: mockRemoveDefenderAssignment
            })

            vi.mocked(useGameStore.getState).mockReturnValue({
                selectCard: mockSelectCard,
                unselectCard: mockUnselectCard,
                clearSelection: mockClearSelection,
                showCardDetail: mockShowCardDetail,
                gameState,
                grid: {
                    highlightedCells: new Set(),
                    validDropZones: new Set()
                },
                interaction: {
                    mode: 'hybrid' as const,
                    selectedCards: new Set(),
                    draggedCard: null,
                    dragStartPosition: null,
                    hoveredCell: null,
                    selectedAttackers: new Set(),
                    defenderAssignments: new Map()
                }
            } as any)

            render(
                <GridCell
                    position={defaultPosition}
                    cellType={defaultCellType}
                />
            )

            const cell = screen.getByRole('button')

            // Double-click
            fireEvent.click(cell)
            fireEvent.click(cell)

            expect(mockShowCardDetail).not.toHaveBeenCalled()
        })

        it('should reset double-click timer after timeout', () => {
            const testCard = createTestCard({
                id: 'test-card',
                name: 'Test Card',
                position: 'bench'
            })

            vi.mocked(stateManager.getCardAtPosition).mockReturnValue(testCard)

            const gameState = createTestGameState()
            gameState.activePlayer = 'player1'
            gameState.phase = 'action'

            vi.mocked(useGameStore).mockReturnValue({
                gameState,
                grid: {
                    highlightedCells: new Set(),
                    validDropZones: new Set()
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
                setHoveredCell: mockSetHoveredCell,
                assignDefender: mockAssignDefender,
                removeDefenderAssignment: mockRemoveDefenderAssignment
            })

            vi.mocked(useGameStore.getState).mockReturnValue({
                selectCard: mockSelectCard,
                unselectCard: mockUnselectCard,
                clearSelection: mockClearSelection,
                showCardDetail: mockShowCardDetail,
                gameState,
                grid: {
                    highlightedCells: new Set(),
                    validDropZones: new Set()
                },
                interaction: {
                    mode: 'hybrid' as const,
                    selectedCards: new Set(),
                    draggedCard: null,
                    dragStartPosition: null,
                    hoveredCell: null,
                    selectedAttackers: new Set(),
                    defenderAssignments: new Map()
                }
            } as any)

            render(
                <GridCell
                    position={defaultPosition}
                    cellType={defaultCellType}
                />
            )

            const cell = screen.getByRole('button')

            // First click
            fireEvent.click(cell)

            // Wait for timeout (simulate 400ms delay)
            vi.advanceTimersByTime(400)

            // Second click after timeout
            fireEvent.click(cell)

            expect(mockShowCardDetail).not.toHaveBeenCalled()
        })
    })

    describe('Card Selection vs Detail Display', () => {
        it('should select card for movement when in action phase and single-clicked', () => {
            const testCard = createTestCard({
                id: 'test-card',
                name: 'Test Card',
                type: 'unit',
                position: 'bench'
            })

            vi.mocked(stateManager.getCardAtPosition).mockReturnValue(testCard)

            const gameState = createTestGameState()
            gameState.activePlayer = 'player1'
            gameState.phase = 'action'

            vi.mocked(useGameStore).mockReturnValue({
                gameState,
                grid: {
                    highlightedCells: new Set(),
                    validDropZones: new Set()
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
                setHoveredCell: mockSetHoveredCell,
                assignDefender: mockAssignDefender,
                removeDefenderAssignment: mockRemoveDefenderAssignment
            })

            vi.mocked(useGameStore.getState).mockReturnValue({
                selectCard: mockSelectCard,
                unselectCard: mockUnselectCard,
                clearSelection: mockClearSelection,
                showCardDetail: mockShowCardDetail,
                gameState,
                grid: {
                    highlightedCells: new Set(),
                    validDropZones: new Set()
                },
                interaction: {
                    mode: 'hybrid' as const,
                    selectedCards: new Set(),
                    draggedCard: null,
                    dragStartPosition: null,
                    hoveredCell: null,
                    selectedAttackers: new Set(),
                    defenderAssignments: new Map()
                }
            } as any)

            render(
                <GridCell
                    position={defaultPosition}
                    cellType={defaultCellType}
                />
            )

            const cell = screen.getByRole('button')
            fireEvent.click(cell)

            expect(mockClearSelection).toHaveBeenCalled()
            expect(mockSelectCard).toHaveBeenCalledWith('test-card')
            expect(mockShowCardDetail).not.toHaveBeenCalled()
        })

        it('should deselect card if already selected', () => {
            const testCard = createTestCard({
                id: 'test-card',
                name: 'Test Card',
                type: 'unit',
                position: 'bench'
            })

            vi.mocked(stateManager.getCardAtPosition).mockReturnValue(testCard)

            const gameState = createTestGameState()
            gameState.activePlayer = 'player1'
            gameState.phase = 'action'

            vi.mocked(useGameStore).mockReturnValue({
                gameState,
                grid: {
                    highlightedCells: new Set(),
                    validDropZones: new Set()
                },
                interaction: {
                    mode: 'hybrid' as const,
                    selectedCards: new Set(['test-card']), // Already selected
                    draggedCard: null,
                    dragStartPosition: null,
                    hoveredCell: null,
                    selectedAttackers: new Set(),
                    defenderAssignments: new Map()
                },
                setHoveredCell: mockSetHoveredCell,
                assignDefender: mockAssignDefender,
                removeDefenderAssignment: mockRemoveDefenderAssignment
            })

            vi.mocked(useGameStore.getState).mockReturnValue({
                selectCard: mockSelectCard,
                unselectCard: mockUnselectCard,
                deselectCard: mockUnselectCard, // Add this alias
                clearSelection: mockClearSelection,
                showCardDetail: mockShowCardDetail,
                gameState,
                grid: {
                    highlightedCells: new Set(),
                    validDropZones: new Set()
                },
                interaction: {
                    mode: 'hybrid' as const,
                    selectedCards: new Set(['test-card']),
                    draggedCard: null,
                    dragStartPosition: null,
                    hoveredCell: null,
                    selectedAttackers: new Set(),
                    defenderAssignments: new Map()
                }
            } as any)

            render(
                <GridCell
                    position={defaultPosition}
                    cellType={defaultCellType}
                />
            )

            const cell = screen.getByRole('button')
            fireEvent.click(cell)

            expect(mockUnselectCard).toHaveBeenCalledWith('test-card')
            expect(mockShowCardDetail).not.toHaveBeenCalled()
        })
    })

    describe('Visual States', () => {
        it('should show selected state for selected cards', () => {
            const testCard = createTestCard({
                id: 'test-card',
                name: 'Test Card',
                position: 'bench'
            })

            vi.mocked(stateManager.getCardAtPosition).mockReturnValue(testCard)

            vi.mocked(useGameStore).mockReturnValue({
                gameState: createTestGameState(),
                grid: {
                    highlightedCells: new Set(),
                    validDropZones: new Set()
                },
                interaction: {
                    mode: 'hybrid' as const,
                    selectedCards: new Set(['test-card']),
                    draggedCard: null,
                    dragStartPosition: null,
                    hoveredCell: null,
                    selectedAttackers: new Set(),
                    defenderAssignments: new Map()
                },
                setHoveredCell: mockSetHoveredCell,
                assignDefender: mockAssignDefender,
                removeDefenderAssignment: mockRemoveDefenderAssignment
            })

            render(
                <GridCell
                    position={defaultPosition}
                    cellType={defaultCellType}
                />
            )

            const cardElement = screen.getByTestId('tarot-card')
            expect(cardElement.getAttribute('data-selected')).toBe('true')
        })

        it('should show damaged state for damaged cards', () => {
            const testCard = createTestCard({
                id: 'test-card',
                name: 'Test Card',
                health: 5,
                currentHealth: 3, // Damaged
                position: 'bench'
            })

            vi.mocked(stateManager.getCardAtPosition).mockReturnValue(testCard)

            vi.mocked(useGameStore).mockReturnValue({
                gameState: createTestGameState(),
                grid: {
                    highlightedCells: new Set(),
                    validDropZones: new Set()
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
                setHoveredCell: mockSetHoveredCell,
                assignDefender: mockAssignDefender,
                removeDefenderAssignment: mockRemoveDefenderAssignment
            })

            render(
                <GridCell
                    position={defaultPosition}
                    cellType={defaultCellType}
                />
            )

            const cardElement = screen.getByTestId('tarot-card')
            expect(cardElement.getAttribute('data-damaged')).toBe('true')
        })
    })

    describe('Cell Types and Positions', () => {
        it('should render correctly for different cell types', () => {
            const testCard = createTestCard({
                id: 'test-card',
                name: 'Test Card',
                position: 'attacking'
            })

            vi.mocked(stateManager.getCardAtPosition).mockReturnValue(testCard)

            const cellTypes: CellType[] = ['enemy_bench', 'enemy_attack', 'player_attack', 'player_bench']

            cellTypes.forEach(cellType => {
                const { unmount } = render(
                    <GridCell
                        position={defaultPosition}
                        cellType={cellType}
                    />
                )

                expect(screen.getByTestId('tarot-card')).toBeInTheDocument()
                unmount()
            })
        })

        it('should render placeholder text for empty cells', () => {
            vi.mocked(stateManager.getCardAtPosition).mockReturnValue(null)

            const cellTypes: CellType[] = ['enemy_bench', 'enemy_attack', 'player_attack', 'player_bench']
            const expectedTexts = ['Enemy', 'Attack', 'Attack', 'Bench']

            cellTypes.forEach((cellType, index) => {
                const { unmount } = render(
                    <GridCell
                        position={defaultPosition}
                        cellType={cellType}
                    />
                )

                expect(screen.getByText(expectedTexts[index])).toBeInTheDocument()
                unmount()
            })
        })
    })
})
