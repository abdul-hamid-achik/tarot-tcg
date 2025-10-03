import { beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MulliganOverlay from '@/components/mulligan_overlay'
import type { Card as GameCard } from '@/schemas/schema'

// Mock the TarotCard component
vi.mock('@/components/tarot_card', () => ({
    default: ({ card, size, isSelected, className }: any) => (
        <div
            data-testid={`tarot-card-${card.id}`}
            data-selected={isSelected}
            className={className}
        >
            {card.name}
        </div>
    )
}))

// Mock the Button component
vi.mock('@/components/ui/button', () => ({
    Button: ({ children, onClick, disabled, className, variant, size }: any) => (
        <button
            onClick={onClick}
            disabled={disabled}
            className={className}
            data-variant={variant}
            data-size={size}
        >
            {children}
        </button>
    )
}))

const createTestCard = (id: string, name: string): GameCard => ({
    id,
    name,
    cost: 2,
    attack: 2,
    health: 3,
    type: 'unit',
    tarotSymbol: '1',
    description: 'Test card',
    zodiacClass: 'aries',
    element: 'fire',
    rarity: 'common'
})

const mockHand: GameCard[] = [
    createTestCard('card-1', 'Test Card 1'),
    createTestCard('card-2', 'Test Card 2'),
    createTestCard('card-3', 'Test Card 3'),
    createTestCard('card-4', 'Test Card 4')
]

describe('MulliganOverlay', () => {
    const mockOnClose = vi.fn()
    const mockOnMulligan = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should not render when isOpen is false', () => {
        render(
            <MulliganOverlay
                hand={mockHand}
                isOpen={false}
                onClose={mockOnClose}
                onMulligan={mockOnMulligan}
            />
        )

        expect(screen.queryByText('Mulligan Phase')).not.toBeInTheDocument()
    })

    it('should render when isOpen is true', () => {
        render(
            <MulliganOverlay
                hand={mockHand}
                isOpen={true}
                onClose={mockOnClose}
                onMulligan={mockOnMulligan}
            />
        )

        expect(screen.getByText('Mulligan Phase')).toBeInTheDocument()
        expect(screen.getByText('Cards to Discard (0)')).toBeInTheDocument()
        expect(screen.getByText('Cards to Keep (4)')).toBeInTheDocument()
    })

    it('should call onClose when close button is clicked', () => {
        render(
            <MulliganOverlay
                hand={mockHand}
                isOpen={true}
                onClose={mockOnClose}
                onMulligan={mockOnMulligan}
            />
        )

        const closeButton = screen.getByRole('button', { name: '' }) // X button
        fireEvent.click(closeButton)

        expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('should call onMulligan with empty array when Keep All Cards is clicked', () => {
        render(
            <MulliganOverlay
                hand={mockHand}
                isOpen={true}
                onClose={mockOnClose}
                onMulligan={mockOnMulligan}
            />
        )

        const keepAllButton = screen.getByText('Keep All Cards')
        fireEvent.click(keepAllButton)

        expect(mockOnMulligan).toHaveBeenCalledWith([])
    })

    it('should display all cards in keep area initially', () => {
        render(
            <MulliganOverlay
                hand={mockHand}
                isOpen={true}
                onClose={mockOnClose}
                onMulligan={mockOnMulligan}
            />
        )

        // All cards should be in the keep area initially
        mockHand.forEach(card => {
            const cardElement = screen.getByTestId(`tarot-card-${card.id}`)
            expect(cardElement).toBeInTheDocument()
            expect(cardElement).toHaveAttribute('data-selected', 'false')
        })
    })

    it('should handle drag and drop to discard area', () => {
        render(
            <MulliganOverlay
                hand={mockHand}
                isOpen={true}
                onClose={mockOnClose}
                onMulligan={mockOnMulligan}
            />
        )

        const cardElement = screen.getByTestId('tarot-card-card-1')
        const discardArea = screen.getByText('Cards to Discard (0)').closest('div')

        // Simulate drag and drop
        fireEvent.dragStart(cardElement)
        fireEvent.dragOver(discardArea!)
        fireEvent.drop(discardArea!)

        // Card should now be in discard area
        expect(screen.getByText('Cards to Discard (1)')).toBeInTheDocument()
        expect(screen.getByText('Cards to Keep (3)')).toBeInTheDocument()
    })

    it('should call onMulligan with selected cards when Mulligan button is clicked', () => {
        render(
            <MulliganOverlay
                hand={mockHand}
                isOpen={true}
                onClose={mockOnClose}
                onMulligan={mockOnMulligan}
            />
        )

        // First, select a card for discard
        const cardElement = screen.getByTestId('tarot-card-card-1')
        const discardArea = screen.getByText('Cards to Discard (0)').closest('div')

        fireEvent.dragStart(cardElement)
        fireEvent.dragOver(discardArea!)
        fireEvent.drop(discardArea!)

        // Now click the Mulligan button
        const mulliganButton = screen.getByText('Mulligan (1)')
        fireEvent.click(mulliganButton)

        expect(mockOnMulligan).toHaveBeenCalledWith(['card-1'])
    })

    it('should disable Mulligan button when no cards are selected', () => {
        render(
            <MulliganOverlay
                hand={mockHand}
                isOpen={true}
                onClose={mockOnClose}
                onMulligan={mockOnMulligan}
            />
        )

        const mulliganButton = screen.getByText('Mulligan')
        expect(mulliganButton).toBeDisabled()
    })

    it('should enable Mulligan button when cards are selected', () => {
        render(
            <MulliganOverlay
                hand={mockHand}
                isOpen={true}
                onClose={mockOnClose}
                onMulligan={mockOnMulligan}
            />
        )

        // Select a card for discard
        const cardElement = screen.getByTestId('tarot-card-card-1')
        const discardArea = screen.getByText('Cards to Discard (0)').closest('div')

        fireEvent.dragStart(cardElement)
        fireEvent.dragOver(discardArea!)
        fireEvent.drop(discardArea!)

        const mulliganButton = screen.getByText('Mulligan (1)')
        expect(mulliganButton).not.toBeDisabled()
    })

    it('should reset selection after mulligan', () => {
        render(
            <MulliganOverlay
                hand={mockHand}
                isOpen={true}
                onClose={mockOnClose}
                onMulligan={mockOnMulligan}
            />
        )

        // Select a card for discard
        const cardElement = screen.getByTestId('tarot-card-card-1')
        const discardArea = screen.getByText('Cards to Discard (0)').closest('div')

        fireEvent.dragStart(cardElement)
        fireEvent.dragOver(discardArea!)
        fireEvent.drop(discardArea!)

        // Click mulligan
        const mulliganButton = screen.getByText('Mulligan (1)')
        fireEvent.click(mulliganButton)

        // Selection should be reset
        expect(screen.getByText('Cards to Discard (0)')).toBeInTheDocument()
        expect(screen.getByText('Cards to Keep (4)')).toBeInTheDocument()
    })
})
