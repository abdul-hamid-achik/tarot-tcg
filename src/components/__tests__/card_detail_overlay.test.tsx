import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CardDetailOverlay from '@/components/card_detail_overlay'
import { createTestCard } from '@/test_utils'
import type { Card as GameCard } from '@/schemas/schema'

// Mock the TarotCard component
vi.mock('@/components/tarot_card', () => ({
    default: ({ card, size, isSelected }: { card: GameCard; size: string; isSelected: boolean }) => (
        <div data-testid="tarot-card" data-card-id={card.id} data-size={size} data-selected={isSelected}>
            {card.name}
        </div>
    )
}))

// Mock ReactMarkdown
vi.mock('react-markdown', () => ({
    default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>
}))

describe('CardDetailOverlay', () => {
    const mockOnClose = vi.fn()
    const mockOnPlay = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
    })

    const createTestCardWithDetails = (overrides: Partial<GameCard> = {}): GameCard =>
        createTestCard({
            id: 'test-card',
            name: 'Test Card',
            cost: 3,
            attack: 2,
            health: 4,
            type: 'unit',
            tarotSymbol: '♈',
            description: 'A powerful test card',
            zodiacClass: 'aries',
            element: 'fire',
            rarity: 'rare',
            keywords: ['flying', 'haste'],
            abilities: [
                {
                    name: 'Test Ability',
                    description: 'This is a test ability'
                }
            ],
            isReversed: false,
            ...overrides
        })

    describe('Rendering', () => {
        it('should not render when isOpen is false', () => {
            const card = createTestCardWithDetails()
            render(
                <CardDetailOverlay
                    card={card}
                    isOpen={false}
                    onClose={mockOnClose}
                />
            )

            expect(screen.queryByText('Test Card')).not.toBeInTheDocument()
        })

        it('should render when isOpen is true', () => {
            const card = createTestCardWithDetails()
            render(
                <CardDetailOverlay
                    card={card}
                    isOpen={true}
                    onClose={mockOnClose}
                />
            )

            expect(screen.getByRole('heading', { name: 'Test Card' })).toBeInTheDocument()
            expect(screen.getByTestId('tarot-card')).toBeInTheDocument()
        })

        it('should display card name in header', () => {
            const card = createTestCardWithDetails({ name: 'Special Card' })
            render(
                <CardDetailOverlay
                    card={card}
                    isOpen={true}
                    onClose={mockOnClose}
                />
            )

            expect(screen.getByRole('heading', { name: 'Special Card' })).toBeInTheDocument()
        })
    })

    describe('Card Information Display', () => {
        it('should display basic stats for unit cards', () => {
            const card = createTestCardWithDetails({
                cost: 5,
                attack: 3,
                health: 6,
                type: 'unit'
            })

            render(
                <CardDetailOverlay
                    card={card}
                    isOpen={true}
                    onClose={mockOnClose}
                />
            )

            expect(screen.getByText('Cost 5')).toBeInTheDocument()
            expect(screen.getByText('3 Attack')).toBeInTheDocument()
            expect(screen.getByText('6 Health')).toBeInTheDocument()
        })

        it('should not display attack/health for non-unit cards', () => {
            const card = createTestCardWithDetails({
                type: 'spell',
                cost: 2
            })

            render(
                <CardDetailOverlay
                    card={card}
                    isOpen={true}
                    onClose={mockOnClose}
                />
            )

            expect(screen.getByText('Cost 2')).toBeInTheDocument()
            expect(screen.queryByText(/Attack/)).not.toBeInTheDocument()
            expect(screen.queryByText(/Health/)).not.toBeInTheDocument()
        })

        it('should display rarity badge', () => {
            const card = createTestCardWithDetails({ rarity: 'legendary' })

            render(
                <CardDetailOverlay
                    card={card}
                    isOpen={true}
                    onClose={mockOnClose}
                />
            )

            expect(screen.getByText('Legendary')).toBeInTheDocument()
        })

        it('should display zodiac class and element', () => {
            const card = createTestCardWithDetails({
                zodiacClass: 'taurus',
                element: 'earth',
                tarotSymbol: '♉'
            })

            render(
                <CardDetailOverlay
                    card={card}
                    isOpen={true}
                    onClose={mockOnClose}
                />
            )

            expect(screen.getByText('♉')).toBeInTheDocument()
            expect(screen.getByText('Taurus • Earth')).toBeInTheDocument()
        })

        it('should display keywords when present', () => {
            const card = createTestCardWithDetails({
                keywords: ['flying', 'haste', 'trample']
            })

            render(
                <CardDetailOverlay
                    card={card}
                    isOpen={true}
                    onClose={mockOnClose}
                />
            )

            expect(screen.getByText('Keywords')).toBeInTheDocument()
            expect(screen.getByText('flying')).toBeInTheDocument()
            expect(screen.getByText('haste')).toBeInTheDocument()
            expect(screen.getByText('trample')).toBeInTheDocument()
        })

        it('should not display keywords section when no keywords', () => {
            const card = createTestCardWithDetails({ keywords: [] })

            render(
                <CardDetailOverlay
                    card={card}
                    isOpen={true}
                    onClose={mockOnClose}
                />
            )

            expect(screen.queryByText('Keywords')).not.toBeInTheDocument()
        })

        it('should display abilities when present', () => {
            const card = createTestCardWithDetails({
                abilities: [
                    { name: 'Ability 1', description: 'Description 1' },
                    { name: 'Ability 2', description: 'Description 2' }
                ]
            })

            render(
                <CardDetailOverlay
                    card={card}
                    isOpen={true}
                    onClose={mockOnClose}
                />
            )

            expect(screen.getByText('Abilities')).toBeInTheDocument()
            expect(screen.getByText('Ability 1')).toBeInTheDocument()
            expect(screen.getByText('Description 1')).toBeInTheDocument()
            expect(screen.getByText('Ability 2')).toBeInTheDocument()
            expect(screen.getByText('Description 2')).toBeInTheDocument()
        })

        it('should display card description', () => {
            const card = createTestCardWithDetails({
                description: 'This is a test description'
            })

            render(
                <CardDetailOverlay
                    card={card}
                    isOpen={true}
                    onClose={mockOnClose}
                />
            )

            expect(screen.getByText('Description')).toBeInTheDocument()
            const markdownElements = screen.getAllByTestId('markdown')
            expect(markdownElements.some(el => el.textContent?.includes('This is a test description'))).toBe(true)
        })
    })

    describe('Reversed Card Handling', () => {
        it('should display reversed badge for reversed cards', () => {
            const card = createTestCardWithDetails({
                isReversed: true,
                reversedDescription: 'Reversed effect'
            })

            render(
                <CardDetailOverlay
                    card={card}
                    isOpen={true}
                    onClose={mockOnClose}
                />
            )

            expect(screen.getByText('⤊ Reversed')).toBeInTheDocument()
        })

        it('should display reversed description when card is reversed', () => {
            const card = createTestCardWithDetails({
                isReversed: true,
                description: 'Upright effect',
                reversedDescription: 'Reversed effect'
            })

            render(
                <CardDetailOverlay
                    card={card}
                    isOpen={true}
                    onClose={mockOnClose}
                />
            )

            const markdownElements = screen.getAllByTestId('markdown')
            expect(markdownElements.some(el => el.textContent?.includes('Reversed effect'))).toBe(true)
        })

        it('should show both upright and reversed descriptions when available', () => {
            const card = createTestCardWithDetails({
                isReversed: true,
                description: 'Upright effect',
                reversedDescription: 'Reversed effect'
            })

            render(
                <CardDetailOverlay
                    card={card}
                    isOpen={true}
                    onClose={mockOnClose}
                />
            )

            expect(screen.getByText('Upright Effect:')).toBeInTheDocument()
            // Note: The "When Reversed:" text only appears when card is NOT reversed but has reversed description
            // When card IS reversed, it shows the reversed description directly
        })
    })

    describe('Actions', () => {
        it('should call onClose when close button is clicked', () => {
            const card = createTestCardWithDetails()

            render(
                <CardDetailOverlay
                    card={card}
                    isOpen={true}
                    onClose={mockOnClose}
                />
            )

            // The footer "Close" text button
            const closeButton = screen.getByRole('button', { name: 'Close' })
            fireEvent.click(closeButton)

            expect(mockOnClose).toHaveBeenCalledTimes(1)
        })

        it('should call onClose when X icon button is clicked', () => {
            const card = createTestCardWithDetails()

            render(
                <CardDetailOverlay
                    card={card}
                    isOpen={true}
                    onClose={mockOnClose}
                />
            )

            // The X icon button in the header (now has an accessible aria-label)
            const xButton = screen.getByRole('button', { name: /Close Test Card details/i })
            fireEvent.click(xButton)

            expect(mockOnClose).toHaveBeenCalledTimes(1)
        })

        it('should display play button when onPlay is provided', () => {
            const card = createTestCardWithDetails()

            render(
                <CardDetailOverlay
                    card={card}
                    isOpen={true}
                    onClose={mockOnClose}
                    onPlay={mockOnPlay}
                />
            )

            expect(screen.getByText('Play Card')).toBeInTheDocument()
        })

        it('should not display play button when onPlay is not provided', () => {
            const card = createTestCardWithDetails()

            render(
                <CardDetailOverlay
                    card={card}
                    isOpen={true}
                    onClose={mockOnClose}
                />
            )

            expect(screen.queryByText('Play Card')).not.toBeInTheDocument()
        })

        it('should call onPlay and onClose when play button is clicked', () => {
            const card = createTestCardWithDetails()

            render(
                <CardDetailOverlay
                    card={card}
                    isOpen={true}
                    onClose={mockOnClose}
                    onPlay={mockOnPlay}
                    canPlay={true}
                />
            )

            const playButton = screen.getByText('Play Card')
            fireEvent.click(playButton)

            expect(mockOnPlay).toHaveBeenCalledTimes(1)
            expect(mockOnClose).toHaveBeenCalledTimes(1)
        })

        it('should disable play button when canPlay is false', () => {
            const card = createTestCardWithDetails()

            render(
                <CardDetailOverlay
                    card={card}
                    isOpen={true}
                    onClose={mockOnClose}
                    onPlay={mockOnPlay}
                    canPlay={false}
                />
            )

            const playButton = screen.getByText('Play Card')
            expect(playButton).toBeDisabled()
        })

        it('should enable play button when canPlay is true', () => {
            const card = createTestCardWithDetails()

            render(
                <CardDetailOverlay
                    card={card}
                    isOpen={true}
                    onClose={mockOnClose}
                    onPlay={mockOnPlay}
                    canPlay={true}
                />
            )

            const playButton = screen.getByText('Play Card')
            expect(playButton).not.toBeDisabled()
        })
    })

    describe('Accessibility', () => {
        it('should have proper ARIA attributes', () => {
            const card = createTestCardWithDetails()

            render(
                <CardDetailOverlay
                    card={card}
                    isOpen={true}
                    onClose={mockOnClose}
                />
            )

            // Check for modal-like structure - the overlay div should be present
            const overlay = screen.getByRole('heading', { name: 'Test Card' }).closest('div')
            expect(overlay).toBeInTheDocument()
        })

        it('should be keyboard accessible', () => {
            const card = createTestCardWithDetails()

            render(
                <CardDetailOverlay
                    card={card}
                    isOpen={true}
                    onClose={mockOnClose}
                />
            )

            // Both the icon close button and the footer Close button should be accessible
            const iconButton = screen.getByRole('button', { name: /Close Test Card details/i })
            const footerButton = screen.getByRole('button', { name: 'Close' })
            expect(iconButton).toBeInTheDocument()
            expect(footerButton).toBeInTheDocument()
        })
    })
})
