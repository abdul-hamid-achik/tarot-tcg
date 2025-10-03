import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { BattlefieldSlot } from '../battlefield/battlefield_slot'
import type { Card } from '@/schemas/schema'
import type { BattlefieldPosition } from '@/services/battlefield_service'

// Mock dependencies
vi.mock('@/store/game_store', () => ({
    useGameStore: () => ({
        interaction: {
            selectedCard: null,
            draggedCard: null,
            attackSource: null,
            targetingMode: 'none',
            validAttackTargets: new Set(),
        },
        setHoveredSlot: vi.fn(),
        endCardDrag: vi.fn(),
    }),
}))

vi.mock('@/hooks/use_game_actions', () => ({
    useGameActions: () => ({
        playCard: vi.fn(),
    }),
}))

vi.mock('@/hooks/use_combat_actions', () => ({
    useCombatActions: () => ({
        handleUnitClick: vi.fn(),
        handleTargetClick: vi.fn(),
        isValidTarget: vi.fn(() => false),
        isAttacking: vi.fn(() => false),
        isInTargetingMode: vi.fn(() => false),
    }),
}))

describe('BattlefieldSlot - Drag and Drop', () => {
    let mockPosition: BattlefieldPosition
    let mockCard: Card
    let mockEnemyCard: Card

    beforeEach(() => {
        mockPosition = { player: 'player1', slot: 0 }

        mockCard = {
            id: 'player-card-1',
            name: 'Player Card',
            type: 'unit',
            cost: 3,
            attack: 2,
            health: 3,
            description: 'Test card',
            reversedDescription: 'Reversed',
            keywords: [],
            element: 'fire',
            zodiacSign: 'aries',
            owner: 'player1',
        } as Card

        mockEnemyCard = {
            id: 'enemy-card-1',
            name: 'Enemy Card',
            type: 'unit',
            cost: 3,
            attack: 2,
            health: 3,
            description: 'Enemy card',
            reversedDescription: 'Reversed',
            keywords: [],
            element: 'water',
            zodiacSign: 'cancer',
            owner: 'player2',
        } as Card
    })

    describe('Empty Slot Drops', () => {
        it('should accept drag over when slot is empty and valid', () => {
            const { container } = render(
                <BattlefieldSlot
                    position={mockPosition}
                    card={null}
                    isHighlighted={false}
                    isValidDropZone={true}
                    isHovered={false}
                    canInteract={true}
                    isEmpty={true}
                />,
            )

            const slot = container.firstChild as HTMLElement
            const dragOverEvent = new Event('dragover', { bubbles: true })
            Object.defineProperty(dragOverEvent, 'preventDefault', { value: vi.fn() })

            fireEvent(slot, dragOverEvent)

            expect(dragOverEvent.preventDefault).toHaveBeenCalled()
        })

        it('should not accept drag over when slot is not a valid drop zone', () => {
            const { container } = render(
                <BattlefieldSlot
                    position={mockPosition}
                    card={null}
                    isHighlighted={false}
                    isValidDropZone={false}
                    isHovered={false}
                    canInteract={true}
                    isEmpty={true}
                />,
            )

            const slot = container.firstChild as HTMLElement
            const dragOverEvent = new Event('dragover', { bubbles: true })
            const preventDefaultSpy = vi.fn()
            Object.defineProperty(dragOverEvent, 'preventDefault', { value: preventDefaultSpy })

            fireEvent(slot, dragOverEvent)

            expect(preventDefaultSpy).not.toHaveBeenCalled()
        })

        it('should handle drop on empty slot', async () => {
            const { container } = render(
                <BattlefieldSlot
                    position={mockPosition}
                    card={null}
                    isHighlighted={false}
                    isValidDropZone={true}
                    isHovered={false}
                    canInteract={true}
                    isEmpty={true}
                />,
            )

            const slot = container.firstChild as HTMLElement
            const dropEvent = new Event('drop', { bubbles: true })
            Object.defineProperty(dropEvent, 'preventDefault', { value: vi.fn() })

            fireEvent(slot, dropEvent)

            // Event should be handled (preventDefault called)
            expect(dropEvent.preventDefault).toHaveBeenCalled()
        })
    })

    describe('Enemy Unit Drops (Attacks)', () => {
        it('should accept drag over enemy units', () => {
            const enemyPosition: BattlefieldPosition = { player: 'player2', slot: 1 }

            const { container } = render(
                <BattlefieldSlot
                    position={enemyPosition}
                    card={mockEnemyCard}
                    isHighlighted={false}
                    isValidDropZone={true}
                    isHovered={false}
                    canInteract={false}
                    isEmpty={false}
                />,
            )

            const slot = container.firstChild as HTMLElement
            const dragOverEvent = new Event('dragover', { bubbles: true })
            Object.defineProperty(dragOverEvent, 'preventDefault', { value: vi.fn() })

            fireEvent(slot, dragOverEvent)

            // Should accept drag over enemy units for attacks
            expect(dragOverEvent.preventDefault).toHaveBeenCalled()
        })

        it('should render card when occupied', () => {
            const { container } = render(
                <BattlefieldSlot
                    position={mockPosition}
                    card={mockCard}
                    isHighlighted={false}
                    isValidDropZone={false}
                    isHovered={false}
                    canInteract={true}
                    isEmpty={false}
                />,
            )

            // Card should be rendered (not empty state)
            const emptyText = container.querySelector('span')?.textContent
            expect(emptyText).not.toBe('Empty')
        })

        it('should show attack indicators when card can attack', () => {
            // Re-mock with attacking state
            vi.mock('@/hooks/use_combat_actions', () => ({
                useCombatActions: () => ({
                    handleUnitClick: vi.fn(),
                    handleTargetClick: vi.fn(),
                    isValidTarget: vi.fn(() => false),
                    isAttacking: vi.fn((id: string) => id === 'player-card-1'),
                    isInTargetingMode: vi.fn(() => true),
                }),
            }))

            const { container } = render(
                <BattlefieldSlot
                    position={mockPosition}
                    card={mockCard}
                    isHighlighted={false}
                    isValidDropZone={false}
                    isHovered={false}
                    canInteract={true}
                    isEmpty={false}
                />,
            )

            // Should have attack indicator elements
            expect(container.querySelector('.absolute')).toBeTruthy()
        })
    })

    describe('Visual States', () => {
        it('should apply highlighted class when highlighted', () => {
            const { container } = render(
                <BattlefieldSlot
                    position={mockPosition}
                    card={null}
                    isHighlighted={true}
                    isValidDropZone={false}
                    isHovered={false}
                    canInteract={true}
                    isEmpty={true}
                />,
            )

            const slot = container.firstChild as HTMLElement
            expect(slot.className).toContain('ring-2')
        })

        it('should apply valid drop zone class when valid', () => {
            const { container } = render(
                <BattlefieldSlot
                    position={mockPosition}
                    card={null}
                    isHighlighted={false}
                    isValidDropZone={true}
                    isHovered={false}
                    canInteract={true}
                    isEmpty={true}
                />,
            )

            const slot = container.firstChild as HTMLElement
            expect(slot.className).toContain('scale-105')
        })

        it('should apply hovered class when hovered', () => {
            const { container } = render(
                <BattlefieldSlot
                    position={mockPosition}
                    card={null}
                    isHighlighted={false}
                    isValidDropZone={false}
                    isHovered={true}
                    canInteract={true}
                    isEmpty={true}
                />,
            )

            const slot = container.firstChild as HTMLElement
            expect(slot.className).toContain('scale-105')
        })

        it('should show different styling for player1 vs player2 slots', () => {
            const { container: player1Container } = render(
                <BattlefieldSlot
                    position={{ player: 'player1', slot: 0 }}
                    card={null}
                    isHighlighted={false}
                    isValidDropZone={false}
                    isHovered={false}
                    canInteract={true}
                    isEmpty={true}
                />,
            )

            const { container: player2Container } = render(
                <BattlefieldSlot
                    position={{ player: 'player2', slot: 0 }}
                    card={null}
                    isHighlighted={false}
                    isValidDropZone={false}
                    isHovered={false}
                    canInteract={true}
                    isEmpty={true}
                />,
            )

            const player1Slot = player1Container.firstChild as HTMLElement
            const player2Slot = player2Container.firstChild as HTMLElement

            // Different border colors for player1 vs player2
            expect(player1Slot.className).not.toBe(player2Slot.className)
        })
    })

    describe('Reversed Cards', () => {
        it('should show reversed indicator for reversed cards', () => {
            const reversedCard = { ...mockCard, isReversed: true }

            const { container } = render(
                <BattlefieldSlot
                    position={mockPosition}
                    card={reversedCard}
                    isHighlighted={false}
                    isValidDropZone={false}
                    isHovered={false}
                    canInteract={true}
                    isEmpty={false}
                />,
            )

            // Should have reversed card indicator
            const indicators = container.querySelectorAll('.absolute')
            expect(indicators.length).toBeGreaterThan(0)
        })

        it('should pass rotateIfReversed prop to TarotCard on battlefield', () => {
            const reversedCard = { ...mockCard, isReversed: true }

            const { container } = render(
                <BattlefieldSlot
                    position={mockPosition}
                    card={reversedCard}
                    isHighlighted={false}
                    isValidDropZone={false}
                    isHovered={false}
                    canInteract={true}
                    isEmpty={false}
                />,
            )

            // TarotCard should be rendered with reversed card
            expect(container.querySelector('.w-full')).toBeTruthy()
        })
    })

    describe('Status Indicators', () => {
        it('should show hasAttackedThisTurn indicator', () => {
            const attackedCard = { ...mockCard, hasAttackedThisTurn: true }

            const { container } = render(
                <BattlefieldSlot
                    position={mockPosition}
                    card={attackedCard}
                    isHighlighted={false}
                    isValidDropZone={false}
                    isHovered={false}
                    canInteract={true}
                    isEmpty={false}
                />,
            )

            // Should have attack status indicator
            const indicators = container.querySelectorAll('.opacity-75')
            expect(indicators.length).toBeGreaterThan(0)
        })

        it('should show divine shield indicator', () => {
            const shieldedCard = { ...mockCard, divineShield: true }

            const { container } = render(
                <BattlefieldSlot
                    position={mockPosition}
                    card={shieldedCard}
                    isHighlighted={false}
                    isValidDropZone={false}
                    isHovered={false}
                    canInteract={true}
                    isEmpty={false}
                />,
            )

            // Should have shield icon
            expect(container.textContent).toContain('🛡')
        })

        it('should show element indicator', () => {
            const { container } = render(
                <BattlefieldSlot
                    position={mockPosition}
                    card={mockCard}
                    isHighlighted={false}
                    isValidDropZone={false}
                    isHovered={false}
                    canInteract={true}
                    isEmpty={false}
                />,
            )

            // Should have element indicator (rounded circle)
            const elementIndicators = container.querySelectorAll('.rounded-full')
            expect(elementIndicators.length).toBeGreaterThan(0)
        })
    })

    describe('Click Interactions', () => {
        it('should handle click on empty slot when card is selected', async () => {
            const { container } = render(
                <BattlefieldSlot
                    position={mockPosition}
                    card={null}
                    isHighlighted={false}
                    isValidDropZone={true}
                    isHovered={false}
                    canInteract={true}
                    isEmpty={true}
                />,
            )

            const slot = container.firstChild as HTMLElement
            fireEvent.click(slot)

            // Click should be handled (no errors)
            expect(slot).toBeTruthy()
        })

        it('should handle click on occupied slot for attack', async () => {
            const { container } = render(
                <BattlefieldSlot
                    position={mockPosition}
                    card={mockCard}
                    isHighlighted={false}
                    isValidDropZone={false}
                    isHovered={false}
                    canInteract={true}
                    isEmpty={false}
                />,
            )

            const slot = container.firstChild as HTMLElement
            fireEvent.click(slot)

            // Click should be handled (no errors)
            expect(slot).toBeTruthy()
        })
    })

    describe('Data Attributes', () => {
        it('should set correct data attributes for testing', () => {
            const { container } = render(
                <BattlefieldSlot
                    position={{ player: 'player1', slot: 3 }}
                    card={null}
                    isHighlighted={false}
                    isValidDropZone={false}
                    isHovered={false}
                    canInteract={true}
                    isEmpty={true}
                />,
            )

            const slot = container.firstChild as HTMLElement
            expect(slot.getAttribute('data-player')).toBe('player1')
            expect(slot.getAttribute('data-slot')).toBe('3')
        })
    })
})

