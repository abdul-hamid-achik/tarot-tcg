import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCombatActions } from '../use_combat_actions'
import { createTestCard, createTestGameState } from '@/test_utils'
import type { GameState, Card } from '@/schemas/schema'

// Mock dependencies
vi.mock('@/store/game_store', () => ({
    useGameStore: vi.fn(),
}))

vi.mock('@/lib/combat_logic', () => ({
    canAttack: vi.fn(),
    declareAttack: vi.fn(),
}))

vi.mock('@/lib/game_logger', () => ({
    GameLogger: {
        action: vi.fn(),
        combat: vi.fn(),
        error: vi.fn(),
    },
}))

describe('useCombatActions', () => {
    let mockGameState: GameState
    let mockStartAttack: ReturnType<typeof vi.fn>
    let mockExecuteAttack: ReturnType<typeof vi.fn>
    let mockCancelAttack: ReturnType<typeof vi.fn>
    let mockSetGameState: ReturnType<typeof vi.fn>
    let mockInteraction: any
    let mockCanAttack: any
    let mockDeclareAttack: any

    beforeEach(async () => {
        vi.clearAllMocks()

        mockGameState = createTestGameState({
            activePlayer: 'player1',
        })

        mockStartAttack = vi.fn()
        mockExecuteAttack = vi.fn()
        mockCancelAttack = vi.fn()
        mockSetGameState = vi.fn()

        mockInteraction = {
            attackSource: null,
            validAttackTargets: new Set(),
            targetingMode: null,
        }

        const { useGameStore } = await import('@/store/game_store')
        vi.mocked(useGameStore).mockReturnValue({
            gameState: mockGameState,
            interaction: mockInteraction,
            startAttack: mockStartAttack,
            executeAttack: mockExecuteAttack,
            cancelAttack: mockCancelAttack,
            setGameState: mockSetGameState,
        } as any)

        const combatLogic = await import('@/lib/combat_logic')
        mockCanAttack = vi.mocked(combatLogic.canAttack)
        mockDeclareAttack = vi.mocked(combatLogic.declareAttack)
    })

    describe('handleUnitClick', () => {
        it('should start attack when unit can attack', () => {
            mockCanAttack.mockReturnValue(true)
            const unit = createTestCard({
                id: 'attacker-1',
                name: 'Warrior',
                owner: 'player1',
                hasSummoningSickness: false,
                hasAttackedThisTurn: false,
            })

            const { result } = renderHook(() => useCombatActions())

            act(() => {
                result.current.handleUnitClick(unit)
            })

            expect(mockStartAttack).toHaveBeenCalledWith('attacker-1')
        })

        it('should not start attack when unit cannot attack', () => {
            mockCanAttack.mockReturnValue(false)
            const unit = createTestCard({
                id: 'sick-1',
                name: 'Sick Unit',
                hasSummoningSickness: true,
            })

            const { result } = renderHook(() => useCombatActions())

            act(() => {
                result.current.handleUnitClick(unit)
            })

            expect(mockStartAttack).not.toHaveBeenCalled()
        })

        it('should not attack with opponent unit', () => {
            mockCanAttack.mockReturnValue(true)
            const unit = createTestCard({
                id: 'enemy-1',
                owner: 'player2', // Opponent's unit
            })

            const { result } = renderHook(() => useCombatActions())

            act(() => {
                result.current.handleUnitClick(unit)
            })

            expect(mockStartAttack).not.toHaveBeenCalled()
        })

        it('should check summoning sickness', () => {
            mockCanAttack.mockReturnValue(false)
            const unit = createTestCard({
                id: 'new-unit',
                hasSummoningSickness: true,
                hasAttackedThisTurn: false,
            })

            const { result } = renderHook(() => useCombatActions())

            act(() => {
                result.current.handleUnitClick(unit)
            })

            expect(mockCanAttack).toHaveBeenCalledWith(unit)
            expect(mockStartAttack).not.toHaveBeenCalled()
        })

        it('should check if unit already attacked', () => {
            mockCanAttack.mockReturnValue(false)
            const unit = createTestCard({
                id: 'tired-unit',
                hasAttackedThisTurn: true,
            })

            const { result } = renderHook(() => useCombatActions())

            act(() => {
                result.current.handleUnitClick(unit)
            })

            expect(mockStartAttack).not.toHaveBeenCalled()
        })
    })

    describe('handleTargetClick', () => {
        it('should execute attack on unit target', async () => {
            mockInteraction.attackSource = 'attacker-1'
            mockDeclareAttack.mockResolvedValue(mockGameState)

            const { result } = renderHook(() => useCombatActions())

            await act(async () => {
                await result.current.handleTargetClick('target-1', 'unit')
            })

            expect(mockDeclareAttack).toHaveBeenCalledWith(mockGameState, {
                attackerId: 'attacker-1',
                targetType: 'unit',
                targetId: 'target-1',
            })
            expect(mockSetGameState).toHaveBeenCalledWith(mockGameState)
            expect(mockExecuteAttack).toHaveBeenCalledWith('target-1', 'unit')
        })

        it('should execute attack on player target', async () => {
            mockInteraction.attackSource = 'attacker-1'
            mockDeclareAttack.mockResolvedValue(mockGameState)

            const { result } = renderHook(() => useCombatActions())

            await act(async () => {
                await result.current.handleTargetClick('player2', 'player')
            })

            expect(mockDeclareAttack).toHaveBeenCalledWith(mockGameState, {
                attackerId: 'attacker-1',
                targetType: 'player',
                targetId: undefined, // Player attacks don't need targetId
            })
            expect(mockExecuteAttack).toHaveBeenCalledWith('player2', 'player')
        })

        it('should not execute attack without attack source', async () => {
            mockInteraction.attackSource = null

            const { result } = renderHook(() => useCombatActions())

            await act(async () => {
                await result.current.handleTargetClick('target-1', 'unit')
            })

            expect(mockDeclareAttack).not.toHaveBeenCalled()
        })

        it('should handle attack failure and cancel', async () => {
            mockInteraction.attackSource = 'attacker-1'
            mockDeclareAttack.mockRejectedValue(new Error('Attack failed'))

            const { result } = renderHook(() => useCombatActions())

            await act(async () => {
                await result.current.handleTargetClick('target-1', 'unit')
            })

            expect(mockCancelAttack).toHaveBeenCalled()
            expect(mockSetGameState).not.toHaveBeenCalled()
        })

        it('should update game state after successful attack', async () => {
            const newGameState = createTestGameState()
            mockInteraction.attackSource = 'attacker-1'
            mockDeclareAttack.mockResolvedValue(newGameState)

            const { result } = renderHook(() => useCombatActions())

            await act(async () => {
                await result.current.handleTargetClick('target-1', 'unit')
            })

            expect(mockSetGameState).toHaveBeenCalledWith(newGameState)
        })
    })

    describe('handleCancelAttack', () => {
        it('should cancel attack when attack source exists', () => {
            mockInteraction.attackSource = 'attacker-1'

            const { result } = renderHook(() => useCombatActions())

            act(() => {
                result.current.handleCancelAttack()
            })

            expect(mockCancelAttack).toHaveBeenCalled()
        })

        it('should not cancel when no attack in progress', () => {
            mockInteraction.attackSource = null

            const { result } = renderHook(() => useCombatActions())

            act(() => {
                result.current.handleCancelAttack()
            })

            expect(mockCancelAttack).not.toHaveBeenCalled()
        })
    })

    describe('State Queries', () => {
        it('should check if target is valid', () => {
            mockInteraction.validAttackTargets = new Set(['target-1', 'target-2'])

            const { result } = renderHook(() => useCombatActions())

            expect(result.current.isValidTarget('target-1')).toBe(true)
            expect(result.current.isValidTarget('target-2')).toBe(true)
            expect(result.current.isValidTarget('target-3')).toBe(false)
        })

        it('should check if unit is attacking', () => {
            mockInteraction.attackSource = 'attacker-1'

            const { result } = renderHook(() => useCombatActions())

            expect(result.current.isAttacking('attacker-1')).toBe(true)
            expect(result.current.isAttacking('other-unit')).toBe(false)
        })

        it('should check if in targeting mode', () => {
            mockInteraction.targetingMode = 'attack'

            const { result } = renderHook(() => useCombatActions())

            expect(result.current.isInTargetingMode()).toBe(true)
        })

        it('should return false when not in targeting mode', () => {
            mockInteraction.targetingMode = null

            const { result } = renderHook(() => useCombatActions())

            expect(result.current.isInTargetingMode()).toBe(false)
        })
    })

    describe('Returned State', () => {
        it('should expose attack source', () => {
            mockInteraction.attackSource = 'attacker-1'

            const { result } = renderHook(() => useCombatActions())

            expect(result.current.attackSource).toBe('attacker-1')
        })

        it('should expose valid targets', () => {
            const targets = new Set(['t1', 't2'])
            mockInteraction.validAttackTargets = targets

            const { result } = renderHook(() => useCombatActions())

            expect(result.current.validTargets).toBe(targets)
        })

        it('should expose targeting mode', () => {
            mockInteraction.targetingMode = 'attack'

            const { result } = renderHook(() => useCombatActions())

            expect(result.current.targetingMode).toBe('attack')
        })
    })

    describe('Edge Cases', () => {
        it('should handle unit with no owner property', () => {
            mockCanAttack.mockReturnValue(true)
            const unit = createTestCard({ id: 'no-owner' })
            delete (unit as any).owner

            const { result } = renderHook(() => useCombatActions())

            act(() => {
                result.current.handleUnitClick(unit)
            })

            // Should not start attack without valid owner
            expect(mockStartAttack).not.toHaveBeenCalled()
        })

        it('should handle multiple valid targets', () => {
            mockInteraction.validAttackTargets = new Set(['t1', 't2', 't3', 't4'])

            const { result } = renderHook(() => useCombatActions())

            expect(result.current.isValidTarget('t1')).toBe(true)
            expect(result.current.isValidTarget('t4')).toBe(true)
            expect(result.current.isValidTarget('t5')).toBe(false)
        })

        it('should handle empty valid targets set', () => {
            mockInteraction.validAttackTargets = new Set()

            const { result } = renderHook(() => useCombatActions())

            expect(result.current.isValidTarget('any-id')).toBe(false)
        })

        it('should handle attack with currentHealth vs health', () => {
            mockCanAttack.mockReturnValue(false)
            const unit = createTestCard({
                id: 'damaged',
                health: 5,
                currentHealth: 2,
            })

            const { result } = renderHook(() => useCombatActions())

            act(() => {
                result.current.handleUnitClick(unit)
            })

            expect(mockCanAttack).toHaveBeenCalledWith(unit)
        })
    })
})

