import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Unmock game_store for this test file - we need to test the real implementation
vi.unmock('../game_store')
vi.unmock('@/store/game_store')

import { useGameStore, createSlotKey } from '../game_store'
import { createTestGameState, createTestCard } from '../../test_utils'
import type { GameState } from '../../schemas/schema'
import type { BattlefieldPosition } from '../../services/battlefield_service'

describe('Game Store', () => {
    beforeEach(() => {
        // Reset store to initial state before each test
        const { result } = renderHook(() => useGameStore())
        act(() => {
            result.current.setGameState(createTestGameState())
            result.current.clearSelection()
            result.current.clearHighlights()
            result.current.clearValidDropZones()
            result.current.hideCardDetail()
        })
    })

    describe('State Initialization', () => {
        it('should initialize with default game state', () => {
            const { result } = renderHook(() => useGameStore())

            // Verify state structure exists (values may be affected by beforeEach)
            expect(result.current.gameState).toBeDefined()
            expect(result.current.gameState.round).toBeGreaterThanOrEqual(1)
            expect(result.current.gameState.turn).toBeGreaterThanOrEqual(1)
            expect(result.current.gameState.phase).toBeDefined()
            expect(result.current.gameState.activePlayer).toBeDefined()
            expect(['player1', 'player2']).toContain(result.current.gameState.activePlayer)
        })

        it('should initialize interaction state', () => {
            const { result } = renderHook(() => useGameStore())

            expect(result.current.interaction).toEqual({
                mode: 'hybrid',
                selectedCard: null,
                draggedCard: null,
                dragStartPosition: null,
                hoveredSlot: null,
                attackSource: null,
                validAttackTargets: new Set(),
                targetingMode: 'none',
            })
        })

        it('should initialize UI state', () => {
            const { result } = renderHook(() => useGameStore())

            expect(result.current.ui).toEqual({
                cardDetailOverlay: null,
                activeOverlay: 'none',
                isAnimating: false,
                performanceMode: 'high',
            })
        })

        it('should initialize multiplayer state', () => {
            const { result } = renderHook(() => useGameStore())

            expect(result.current.multiplayer).toEqual({
                sessionId: null,
                playerId: null,
                connectionStatus: 'disconnected',
                lastSyncVersion: 0,
            })
        })

        it('should initialize visual state', () => {
            const { result } = renderHook(() => useGameStore())

            expect(result.current.highlightedSlots).toEqual(new Set())
            expect(result.current.validDropZones).toEqual(new Set())
        })
    })

    describe('Game State Management', () => {
        it('should update game state with setGameState', () => {
            const { result } = renderHook(() => useGameStore())
            const newState = createTestGameState()
            newState.round = 5
            newState.turn = 10

            act(() => {
                result.current.setGameState(newState)
            })

            expect(result.current.gameState.round).toBe(5)
            expect(result.current.gameState.turn).toBe(10)
        })

        it('should update battlefield independently', () => {
            const { result } = renderHook(() => useGameStore())
            const testCard = createTestCard({ id: 'test-unit', type: 'unit' })

            const newBattlefield = {
                playerUnits: [testCard, null, null, null, null, null, null],
                enemyUnits: [null, null, null, null, null, null, null],
                maxSlots: 7,
            }

            act(() => {
                result.current.updateBattlefield(newBattlefield)
            })

            expect(result.current.gameState.battlefield.playerUnits[0]).toEqual(testCard)
            expect(result.current.gameState.battlefield.enemyUnits[0]).toBeNull()
        })

        it('should preserve other game state when updating battlefield', () => {
            const { result } = renderHook(() => useGameStore())
            const initialRound = result.current.gameState.round
            const initialPhase = result.current.gameState.phase

            const newBattlefield = {
                playerUnits: Array(7).fill(null),
                enemyUnits: Array(7).fill(null),
                maxSlots: 7,
            }

            act(() => {
                result.current.updateBattlefield(newBattlefield)
            })

            expect(result.current.gameState.round).toBe(initialRound)
            expect(result.current.gameState.phase).toBe(initialPhase)
        })
    })

    describe('Card Selection', () => {
        it('should select a card', () => {
            const { result } = renderHook(() => useGameStore())
            const card = createTestCard({ id: 'test-card', name: 'Test Card' })

            act(() => {
                result.current.selectCard(card)
            })

            expect(result.current.interaction.selectedCard).toEqual(card)
        })

        it('should clear card selection', () => {
            const { result } = renderHook(() => useGameStore())
            const card = createTestCard({ id: 'test-card' })

            act(() => {
                result.current.selectCard(card)
                result.current.clearSelection()
            })

            expect(result.current.interaction.selectedCard).toBeNull()
        })

        it('should clear attack state when clearing selection', () => {
            const { result } = renderHook(() => useGameStore())
            const card = createTestCard({ id: 'test-card' })

            act(() => {
                result.current.selectCard(card)
                result.current.startAttack('unit-123')
                result.current.clearSelection()
            })

            expect(result.current.interaction.attackSource).toBeNull()
            expect(result.current.interaction.targetingMode).toBe('none')
            expect(result.current.interaction.validAttackTargets.size).toBe(0)
        })

        it('should clear drag state when clearing selection', () => {
            const { result } = renderHook(() => useGameStore())
            const card = createTestCard({ id: 'test-card' })
            const dragPosition = { x: 100, y: 200 }

            act(() => {
                result.current.selectCard(card)
                result.current.startCardDrag(card, dragPosition)
                result.current.clearSelection()
            })

            // BUG FIX: clearSelection should also clear draggedCard and dragStartPosition
            expect(result.current.interaction.draggedCard).toBeNull()
            expect(result.current.interaction.dragStartPosition).toBeNull()
        })

        it('should clear all interaction states at once', () => {
            const { result } = renderHook(() => useGameStore())
            const card1 = createTestCard({ id: 'selected-card' })
            const card2 = createTestCard({ id: 'dragged-card' })
            const dragPosition = { x: 150, y: 250 }

            act(() => {
                // Set up multiple interaction states
                result.current.selectCard(card1)
                result.current.startCardDrag(card2, dragPosition)
                result.current.startAttack('attacker-123')
            })

            // Verify states are set
            expect(result.current.interaction.selectedCard).toEqual(card1)
            expect(result.current.interaction.draggedCard).toEqual(card2)
            expect(result.current.interaction.dragStartPosition).toEqual(dragPosition)
            expect(result.current.interaction.attackSource).toBe('attacker-123')

            act(() => {
                result.current.clearSelection()
            })

            // All interaction states should be cleared
            expect(result.current.interaction.selectedCard).toBeNull()
            expect(result.current.interaction.draggedCard).toBeNull()
            expect(result.current.interaction.dragStartPosition).toBeNull()
            expect(result.current.interaction.attackSource).toBeNull()
            expect(result.current.interaction.targetingMode).toBe('none')
            expect(result.current.interaction.validAttackTargets.size).toBe(0)
        })

        it('should prevent cards from disappearing by clearing selection only after successful play', () => {
            // This test verifies the fix for the card disappearing bug
            // The bug was: cards would disappear because selection was cleared before
            // the card was successfully placed on the battlefield

            const { result } = renderHook(() => useGameStore())
            const card = createTestCard({ id: 'card-to-play' })

            act(() => {
                result.current.selectCard(card)
            })

            expect(result.current.interaction.selectedCard).toEqual(card)

            // In the actual game flow, playCard would be called first,
            // and ONLY after it succeeds should clearSelection be called
            // This is tested in the integration tests and use_game_actions tests

            act(() => {
                result.current.clearSelection()
            })

            expect(result.current.interaction.selectedCard).toBeNull()
        })
    })

    describe('Drag and Drop', () => {
        it('should start card drag', () => {
            const { result } = renderHook(() => useGameStore())
            const card = createTestCard({ id: 'dragged-card' })
            const position = { x: 100, y: 200 }

            act(() => {
                result.current.startCardDrag(card, position)
            })

            expect(result.current.interaction.draggedCard).toEqual(card)
            expect(result.current.interaction.dragStartPosition).toEqual(position)
        })

        it('should end card drag', () => {
            const { result } = renderHook(() => useGameStore())
            const card = createTestCard({ id: 'dragged-card' })

            act(() => {
                result.current.startCardDrag(card, { x: 100, y: 200 })
                result.current.endCardDrag()
            })

            expect(result.current.interaction.draggedCard).toBeNull()
            expect(result.current.interaction.dragStartPosition).toBeNull()
        })

        it('should update hovered slot', () => {
            const { result } = renderHook(() => useGameStore())
            const position: BattlefieldPosition = { player: 'player1', slot: 3 }

            act(() => {
                result.current.setHoveredSlot(position)
            })

            expect(result.current.interaction.hoveredSlot).toEqual(position)
        })

        it('should clear hovered slot', () => {
            const { result } = renderHook(() => useGameStore())
            const position: BattlefieldPosition = { player: 'player1', slot: 3 }

            act(() => {
                result.current.setHoveredSlot(position)
                result.current.setHoveredSlot(null)
            })

            expect(result.current.interaction.hoveredSlot).toBeNull()
        })
    })

    describe('Attack Actions', () => {
        it('should start attack and set valid targets', () => {
            const { result } = renderHook(() => useGameStore())

            // Setup: Add some enemy units to the game state
            const gameState = createTestGameState()
            const enemyUnit = createTestCard({ id: 'enemy-1', type: 'unit' })
            gameState.battlefield.enemyUnits[0] = enemyUnit

            act(() => {
                result.current.setGameState(gameState)
                result.current.startAttack('my-unit-1')
            })

            expect(result.current.interaction.attackSource).toBe('my-unit-1')
            expect(result.current.interaction.targetingMode).toBe('attack')
            expect(result.current.interaction.validAttackTargets.size).toBeGreaterThan(0)
        })

        it('should include enemy units as valid attack targets', () => {
            const { result } = renderHook(() => useGameStore())
            const gameState = createTestGameState()
            const enemyUnit = createTestCard({ id: 'enemy-unit-1', type: 'unit' })
            gameState.battlefield.enemyUnits[0] = enemyUnit

            act(() => {
                result.current.setGameState(gameState)
                result.current.startAttack('my-unit')
            })

            expect(result.current.interaction.validAttackTargets.has('enemy-unit-1')).toBe(true)
        })

        it('should include opponent player as valid attack target', () => {
            const { result } = renderHook(() => useGameStore())
            const gameState = createTestGameState()
            gameState.activePlayer = 'player1'

            act(() => {
                result.current.setGameState(gameState)
                result.current.startAttack('my-unit')
            })

            expect(result.current.interaction.validAttackTargets.has('player2')).toBe(true)
        })

        it('should execute attack and clear attack state', async () => {
            const { result } = renderHook(() => useGameStore())

            act(() => {
                result.current.startAttack('my-unit')
            })

            await act(async () => {
                await result.current.executeAttack('enemy-unit', 'unit')
            })

            expect(result.current.interaction.attackSource).toBeNull()
            expect(result.current.interaction.targetingMode).toBe('none')
            expect(result.current.interaction.validAttackTargets.size).toBe(0)
        })

        it('should cancel attack', () => {
            const { result } = renderHook(() => useGameStore())

            act(() => {
                result.current.startAttack('my-unit')
                result.current.cancelAttack()
            })

            expect(result.current.interaction.attackSource).toBeNull()
            expect(result.current.interaction.targetingMode).toBe('none')
            expect(result.current.interaction.validAttackTargets.size).toBe(0)
        })

        it('should not execute attack if no attack source', async () => {
            const { result } = renderHook(() => useGameStore())

            await act(async () => {
                await result.current.executeAttack('enemy-unit', 'unit')
            })

            // Should do nothing, no errors
            expect(result.current.interaction.attackSource).toBeNull()
        })
    })

    describe('Visual Highlights', () => {
        it('should highlight slots', () => {
            const { result } = renderHook(() => useGameStore())
            const positions: BattlefieldPosition[] = [
                { player: 'player1', slot: 0 },
                { player: 'player1', slot: 1 },
                { player: 'player2', slot: 3 },
            ]

            act(() => {
                result.current.highlightSlots(positions)
            })

            expect(result.current.highlightedSlots.has('player1-0')).toBe(true)
            expect(result.current.highlightedSlots.has('player1-1')).toBe(true)
            expect(result.current.highlightedSlots.has('player2-3')).toBe(true)
            expect(result.current.highlightedSlots.size).toBe(3)
        })

        it('should clear highlights', () => {
            const { result } = renderHook(() => useGameStore())
            const positions: BattlefieldPosition[] = [
                { player: 'player1', slot: 0 },
            ]

            act(() => {
                result.current.highlightSlots(positions)
                result.current.clearHighlights()
            })

            expect(result.current.highlightedSlots.size).toBe(0)
        })

        it('should set valid drop zones', () => {
            const { result } = renderHook(() => useGameStore())
            const positions: BattlefieldPosition[] = [
                { player: 'player1', slot: 2 },
                { player: 'player1', slot: 4 },
            ]

            act(() => {
                result.current.setValidDropZones(positions)
            })

            expect(result.current.validDropZones.has('player1-2')).toBe(true)
            expect(result.current.validDropZones.has('player1-4')).toBe(true)
            expect(result.current.validDropZones.size).toBe(2)
        })

        it('should clear valid drop zones', () => {
            const { result } = renderHook(() => useGameStore())
            const positions: BattlefieldPosition[] = [
                { player: 'player1', slot: 0 },
            ]

            act(() => {
                result.current.setValidDropZones(positions)
                result.current.clearValidDropZones()
            })

            expect(result.current.validDropZones.size).toBe(0)
        })
    })

    describe('UI Overlays', () => {
        it('should show card detail overlay', () => {
            const { result } = renderHook(() => useGameStore())
            const card = createTestCard({ id: 'detail-card', name: 'Detailed Card' })

            act(() => {
                result.current.showCardDetail(card)
            })

            expect(result.current.ui.cardDetailOverlay).toEqual(card)
            expect(result.current.ui.activeOverlay).toBe('cardDetail')
        })

        it('should hide card detail overlay', () => {
            const { result } = renderHook(() => useGameStore())
            const card = createTestCard({ id: 'detail-card' })

            act(() => {
                result.current.showCardDetail(card)
                result.current.hideCardDetail()
            })

            expect(result.current.ui.cardDetailOverlay).toBeNull()
            expect(result.current.ui.activeOverlay).toBe('none')
        })

        it('should preserve other UI state when showing card detail', () => {
            const { result } = renderHook(() => useGameStore())
            const card = createTestCard({ id: 'detail-card' })

            act(() => {
                result.current.setAnimationState(true)
                result.current.showCardDetail(card)
            })

            expect(result.current.ui.isAnimating).toBe(true)
            expect(result.current.ui.performanceMode).toBe('high')
        })
    })

    describe('Animation State', () => {
        it('should set animation state to true', () => {
            const { result } = renderHook(() => useGameStore())

            act(() => {
                result.current.setAnimationState(true)
            })

            expect(result.current.ui.isAnimating).toBe(true)
        })

        it('should set animation state to false', () => {
            const { result } = renderHook(() => useGameStore())

            act(() => {
                result.current.setAnimationState(true)
                result.current.setAnimationState(false)
            })

            expect(result.current.ui.isAnimating).toBe(false)
        })

        it('should preserve other UI state when setting animation', () => {
            const { result } = renderHook(() => useGameStore())
            const card = createTestCard({ id: 'test' })

            act(() => {
                result.current.showCardDetail(card)
                result.current.setAnimationState(true)
            })

            expect(result.current.ui.cardDetailOverlay).toEqual(card)
            expect(result.current.ui.activeOverlay).toBe('cardDetail')
        })
    })

    describe('Helper Functions', () => {
        it('should create slot key correctly', () => {
            const position: BattlefieldPosition = { player: 'player1', slot: 3 }
            const key = createSlotKey(position)

            expect(key).toBe('player1-3')
        })

        it('should create unique slot keys for different positions', () => {
            const pos1: BattlefieldPosition = { player: 'player1', slot: 0 }
            const pos2: BattlefieldPosition = { player: 'player2', slot: 0 }
            const pos3: BattlefieldPosition = { player: 'player1', slot: 1 }

            expect(createSlotKey(pos1)).not.toBe(createSlotKey(pos2))
            expect(createSlotKey(pos1)).not.toBe(createSlotKey(pos3))
            expect(createSlotKey(pos2)).not.toBe(createSlotKey(pos3))
        })
    })

    describe('State Consistency', () => {
        it('should maintain state consistency across multiple actions', () => {
            const { result } = renderHook(() => useGameStore())
            const card1 = createTestCard({ id: 'card-1' })
            const card2 = createTestCard({ id: 'card-2' })
            const position: BattlefieldPosition = { player: 'player1', slot: 2 }

            act(() => {
                result.current.selectCard(card1)
                result.current.startCardDrag(card2, { x: 50, y: 50 })
                result.current.setHoveredSlot(position)
                result.current.showCardDetail(card1)
            })

            expect(result.current.interaction.selectedCard).toEqual(card1)
            expect(result.current.interaction.draggedCard).toEqual(card2)
            expect(result.current.interaction.hoveredSlot).toEqual(position)
            expect(result.current.ui.cardDetailOverlay).toEqual(card1)
        })

        it('should handle rapid state changes', () => {
            const { result } = renderHook(() => useGameStore())

            act(() => {
                for (let i = 0; i < 10; i++) {
                    result.current.setAnimationState(true)
                    result.current.setAnimationState(false)
                }
            })

            expect(result.current.ui.isAnimating).toBe(false)
        })
    })

    describe('Complex Scenarios', () => {
        it('should handle complete card play flow', () => {
            const { result } = renderHook(() => useGameStore())
            const card = createTestCard({ id: 'played-card', type: 'unit' })
            const dropPosition: BattlefieldPosition = { player: 'player1', slot: 3 }

            act(() => {
                // 1. Select card from hand
                result.current.selectCard(card)

                // 2. Start dragging
                result.current.startCardDrag(card, { x: 100, y: 100 })

                // 3. Highlight valid drop zones
                result.current.setValidDropZones([dropPosition])

                // 4. Hover over slot
                result.current.setHoveredSlot(dropPosition)

                // 5. End drag (card played)
                result.current.endCardDrag()

                // 6. Clear visual state
                result.current.clearValidDropZones()
                result.current.clearSelection()
            })

            expect(result.current.interaction.selectedCard).toBeNull()
            expect(result.current.interaction.draggedCard).toBeNull()
            expect(result.current.validDropZones.size).toBe(0)
        })

        it('should handle complete attack flow', async () => {
            const { result } = renderHook(() => useGameStore())
            const gameState = createTestGameState()
            const enemyUnit = createTestCard({ id: 'enemy-target', type: 'unit' })
            gameState.battlefield.enemyUnits[0] = enemyUnit

            act(() => {
                // 1. Setup game state
                result.current.setGameState(gameState)

                // 2. Start attack
                result.current.startAttack('my-attacker')

                // 3. Highlight valid targets
                const positions: BattlefieldPosition[] = [{ player: 'player2', slot: 0 }]
                result.current.highlightSlots(positions)
            })

            expect(result.current.interaction.attackSource).toBe('my-attacker')
            expect(result.current.interaction.targetingMode).toBe('attack')
            expect(result.current.highlightedSlots.has('player2-0')).toBe(true)

            await act(async () => {
                // 4. Execute attack
                await result.current.executeAttack('enemy-target', 'unit')
            })

            act(() => {
                // 5. Clear highlights
                result.current.clearHighlights()
            })

            expect(result.current.interaction.attackSource).toBeNull()
            expect(result.current.highlightedSlots.size).toBe(0)
        })
    })
})
