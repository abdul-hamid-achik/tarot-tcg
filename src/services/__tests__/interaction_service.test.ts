import { describe, it, expect, beforeEach, vi } from 'vitest'
import { interactionService } from '../interaction_service'
import type { Card as GameCard } from '@/schemas/schema'
import type { BattlefieldPosition } from '../battlefield_service'

describe('InteractionService - Drag and Drop', () => {
    let mockCard: GameCard
    let mockElement: HTMLElement
    let mockCallbacks: any

    beforeEach(() => {
        // Reset the service
        interactionService.reset()

        // Clear any drag previews from previous tests
        document.getElementById('drag-preview')?.remove()

        // Mock card
        mockCard = {
            id: 'test-card-1',
            name: 'Test Card',
            type: 'unit',
            cost: 3,
            attack: 2,
            health: 3,
            description: 'Test card',
            reversedDescription: 'Reversed test card',
            keywords: [],
            element: 'fire',
            zodiacSign: 'aries',
        } as GameCard

        // Mock element
        mockElement = document.createElement('div')
        mockElement.style.width = '100px'
        mockElement.style.height = '140px'

        // Mock setPointerCapture and releasePointerCapture
        mockElement.setPointerCapture = vi.fn()
        mockElement.releasePointerCapture = vi.fn()

        document.body.appendChild(mockElement)

        // Mock callbacks
        mockCallbacks = {
            onCardMove: vi.fn(),
            onCardAttack: vi.fn(),
            onSlotHighlight: vi.fn(),
            onClearHighlights: vi.fn(),
            canDropOn: vi.fn().mockReturnValue(true),
            getValidDropZones: vi.fn().mockReturnValue([]),
        }

        interactionService.setCallbacks(mockCallbacks)
    })

    describe('Drag Preview Creation', () => {
        it('should create a drag preview element on drag start', () => {
            const pointerDownEvent = new PointerEvent('pointerdown', {
                clientX: 100,
                clientY: 100,
                bubbles: true,
            })

            interactionService.handlePointerDown(
                pointerDownEvent,
                mockCard,
                'hand',
                mockElement,
            )

            // Move enough to trigger drag
            const pointerMoveEvent = new PointerEvent('pointermove', {
                clientX: 110,
                clientY: 110,
                bubbles: true,
            })
            interactionService.handlePointerMove(pointerMoveEvent)

            // Check that drag preview was created
            const dragPreview = document.getElementById('drag-preview')
            expect(dragPreview).toBeTruthy()
            expect(dragPreview?.style.position).toBe('fixed')
            expect(dragPreview?.style.zIndex).toBe('9999')
        })

        it('should make original element semi-transparent during drag', () => {
            const pointerDownEvent = new PointerEvent('pointerdown', {
                clientX: 100,
                clientY: 100,
                bubbles: true,
            })

            interactionService.handlePointerDown(
                pointerDownEvent,
                mockCard,
                'hand',
                mockElement,
            )

            // Move to trigger drag
            const pointerMoveEvent = new PointerEvent('pointermove', {
                clientX: 110,
                clientY: 110,
                bubbles: true,
            })
            interactionService.handlePointerMove(pointerMoveEvent)

            // Original element should be semi-transparent
            expect(mockElement.style.opacity).toBe('0.4')
            expect(mockElement.classList.contains('dragging')).toBe(true)
        })

        it('should update drag preview position as cursor moves', () => {
            const pointerDownEvent = new PointerEvent('pointerdown', {
                clientX: 100,
                clientY: 100,
                bubbles: true,
            })

            interactionService.handlePointerDown(
                pointerDownEvent,
                mockCard,
                'hand',
                mockElement,
            )

            // Start drag
            interactionService.handlePointerMove(
                new PointerEvent('pointermove', { clientX: 110, clientY: 110 }),
            )

            // Move to new position
            interactionService.handlePointerMove(
                new PointerEvent('pointermove', { clientX: 200, clientY: 300 }),
            )

            const dragPreview = document.getElementById('drag-preview')
            expect(dragPreview).toBeTruthy()

            // Preview should follow cursor (centered)
            const expectedLeft = 200 - (dragPreview?.offsetWidth || 0) / 2
            const expectedTop = 300 - (dragPreview?.offsetHeight || 0) / 2

            expect(dragPreview?.style.left).toBe(`${expectedLeft}px`)
            expect(dragPreview?.style.top).toBe(`${expectedTop}px`)
        })

        it('should remove drag preview and restore element on drag end', () => {
            const pointerDownEvent = new PointerEvent('pointerdown', {
                clientX: 100,
                clientY: 100,
                bubbles: true,
            })

            interactionService.handlePointerDown(
                pointerDownEvent,
                mockCard,
                'hand',
                mockElement,
            )

            // Start and end drag
            interactionService.handlePointerMove(
                new PointerEvent('pointermove', { clientX: 110, clientY: 110 }),
            )
            interactionService.handlePointerUp(
                new PointerEvent('pointerup', { clientX: 110, clientY: 110 }),
            )

            // Preview should be removed
            const dragPreview = document.getElementById('drag-preview')
            expect(dragPreview).toBeNull()

            // Original element should be restored
            expect(mockElement.style.opacity).toBe('')
            expect(mockElement.classList.contains('dragging')).toBe(false)
        })
    })

    describe('Drop Behavior', () => {
        it('should trigger onCardMove when dropping on empty battlefield slot', () => {
            mockCallbacks.getValidDropZones.mockReturnValue([
                { player: 'player1', slot: 0 },
            ])

            const pointerDownEvent = new PointerEvent('pointerdown', {
                clientX: 100,
                clientY: 100,
                bubbles: true,
            })

            interactionService.handlePointerDown(
                pointerDownEvent,
                mockCard,
                'hand',
                mockElement,
            )

            // Start drag
            interactionService.handlePointerMove(
                new PointerEvent('pointermove', { clientX: 110, clientY: 110 }),
            )

            // Mock getSlotFromPosition to return a valid drop zone
            const mockGetSlot = vi
                .spyOn(interactionService as any, 'getSlotFromPosition')
                .mockReturnValue({ player: 'player1', slot: 0 } as BattlefieldPosition)

            // End drag (drop)
            interactionService.handlePointerUp(
                new PointerEvent('pointerup', { clientX: 200, clientY: 300 }),
            )

            expect(mockCallbacks.onCardMove).toHaveBeenCalledWith(
                mockCard,
                'hand',
                { player: 'player1', slot: 0 },
            )

            mockGetSlot.mockRestore()
        })

        it('should trigger onCardAttack when dropping on enemy unit', () => {
            const fromPosition: BattlefieldPosition = { player: 'player1', slot: 0 }
            const toPosition: BattlefieldPosition = { player: 'player2', slot: 1 }

            const pointerDownEvent = new PointerEvent('pointerdown', {
                clientX: 100,
                clientY: 100,
                bubbles: true,
            })

            interactionService.handlePointerDown(
                pointerDownEvent,
                mockCard,
                fromPosition,
                mockElement,
            )

            // Start drag
            interactionService.handlePointerMove(
                new PointerEvent('pointermove', { clientX: 110, clientY: 110 }),
            )

            // Mock getSlotFromPosition
            const mockGetSlot = vi
                .spyOn(interactionService as any, 'getSlotFromPosition')
                .mockReturnValue(toPosition)

            // End drag on enemy slot
            interactionService.handlePointerUp(
                new PointerEvent('pointerup', { clientX: 200, clientY: 300 }),
            )

            expect(mockCallbacks.onCardAttack).toHaveBeenCalledWith(
                mockCard,
                fromPosition,
                toPosition,
            )

            mockGetSlot.mockRestore()
        })

        it('should not trigger callbacks when dropping on invalid zone', () => {
            mockCallbacks.canDropOn.mockReturnValue(false)

            const pointerDownEvent = new PointerEvent('pointerdown', {
                clientX: 100,
                clientY: 100,
                bubbles: true,
            })

            interactionService.handlePointerDown(
                pointerDownEvent,
                mockCard,
                'hand',
                mockElement,
            )

            // Start and end drag
            interactionService.handlePointerMove(
                new PointerEvent('pointermove', { clientX: 110, clientY: 110 }),
            )

            const mockGetSlot = vi
                .spyOn(interactionService as any, 'getSlotFromPosition')
                .mockReturnValue({ player: 'player1', slot: 0 })

            interactionService.handlePointerUp(
                new PointerEvent('pointerup', { clientX: 200, clientY: 300 }),
            )

            expect(mockCallbacks.onCardMove).not.toHaveBeenCalled()
            expect(mockCallbacks.onCardAttack).not.toHaveBeenCalled()

            mockGetSlot.mockRestore()
        })
    })

    describe('Drag Threshold', () => {
        it('should not start drag until threshold is exceeded', () => {
            const pointerDownEvent = new PointerEvent('pointerdown', {
                clientX: 100,
                clientY: 100,
                bubbles: true,
            })

            interactionService.handlePointerDown(
                pointerDownEvent,
                mockCard,
                'hand',
                mockElement,
            )

            // Move less than threshold (default 5px)
            interactionService.handlePointerMove(
                new PointerEvent('pointermove', { clientX: 102, clientY: 102 }),
            )

            // Drag should not have started yet
            expect(document.getElementById('drag-preview')).toBeNull()
            expect(interactionService.isDragging()).toBe(false)

            // Move beyond threshold
            interactionService.handlePointerMove(
                new PointerEvent('pointermove', { clientX: 110, clientY: 110 }),
            )

            // Now drag should be active
            expect(document.getElementById('drag-preview')).toBeTruthy()
            expect(interactionService.isDragging()).toBe(true)
        })
    })

    describe('Edge Cases', () => {
        it('should handle multiple rapid drags without memory leaks', () => {
            for (let i = 0; i < 10; i++) {
                interactionService.handlePointerDown(
                    new PointerEvent('pointerdown', { clientX: 100, clientY: 100 }),
                    mockCard,
                    'hand',
                    mockElement,
                )

                interactionService.handlePointerMove(
                    new PointerEvent('pointermove', { clientX: 110, clientY: 110 }),
                )

                interactionService.handlePointerUp(
                    new PointerEvent('pointerup', { clientX: 110, clientY: 110 }),
                )
            }

            // Should only have at most one drag preview
            const dragPreviews = document.querySelectorAll('#drag-preview')
            expect(dragPreviews.length).toBeLessThanOrEqual(1)
        })

        it('should handle drag cancellation (pointer leaving window)', () => {
            interactionService.handlePointerDown(
                new PointerEvent('pointerdown', { clientX: 100, clientY: 100 }),
                mockCard,
                'hand',
                mockElement,
            )

            interactionService.handlePointerMove(
                new PointerEvent('pointermove', { clientX: 110, clientY: 110 }),
            )

            // Simulate pointer leaving
            interactionService.reset()

            expect(document.getElementById('drag-preview')).toBeNull()
            expect(mockElement.style.opacity).toBe('')
        })
    })
})

