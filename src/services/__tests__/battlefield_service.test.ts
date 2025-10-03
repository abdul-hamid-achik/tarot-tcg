vi.unmock('@/lib/game_logger')

import { describe, it, expect, beforeEach } from 'vitest'
import { BattlefieldService } from '../battlefield_service'
import type { Battlefield, PlayerId } from '@/schemas/schema'
import { createTestCard } from '@/test_utils'

describe('BattlefieldService', () => {
    let service: BattlefieldService
    let battlefield: Battlefield

    beforeEach(() => {
        service = new BattlefieldService()
        battlefield = service.initializeBattlefield()
    })

    describe('Initialization', () => {
        it('should initialize empty battlefield with correct slots', () => {
            const bf = service.initializeBattlefield()

            expect(bf.playerUnits).toHaveLength(7)
            expect(bf.enemyUnits).toHaveLength(7)
            expect(bf.maxSlots).toBe(7)
            expect(bf.playerUnits.every(u => u === null)).toBe(true)
            expect(bf.enemyUnits.every(u => u === null)).toBe(true)
        })
    })

    describe('Slot Operations', () => {
        it('should check if slot is empty', () => {
            expect(service.isSlotEmpty(battlefield, 'player1', 0)).toBe(true)
            expect(service.isSlotEmpty(battlefield, 'player2', 3)).toBe(true)
        })

        it('should return false for invalid slot numbers', () => {
            expect(service.isSlotEmpty(battlefield, 'player1', -1)).toBe(false)
            expect(service.isSlotEmpty(battlefield, 'player1', 7)).toBe(false)
            expect(service.isSlotEmpty(battlefield, 'player1', 100)).toBe(false)
        })

        it('should detect occupied slots', () => {
            const card = createTestCard({ id: 'test-1', name: 'Test Unit' })
            battlefield = service.placeUnit(battlefield, card, 'player1', 2)

            expect(service.isSlotEmpty(battlefield, 'player1', 2)).toBe(false)
            expect(service.isSlotEmpty(battlefield, 'player1', 3)).toBe(true)
        })

        it('should place unit in empty slot', () => {
            const card = createTestCard({ id: 'unit-1', name: 'Warrior' })

            const newBf = service.placeUnit(battlefield, card, 'player1', 0)

            expect(newBf.playerUnits[0]).toEqual(card)
            expect(newBf.playerUnits[1]).toBeNull()
        })

        it('should place multiple units in different slots', () => {
            const card1 = createTestCard({ id: 'unit-1', name: 'Warrior' })
            const card2 = createTestCard({ id: 'unit-2', name: 'Mage' })
            const card3 = createTestCard({ id: 'unit-3', name: 'Rogue' })

            battlefield = service.placeUnit(battlefield, card1, 'player1', 0)
            battlefield = service.placeUnit(battlefield, card2, 'player1', 3)
            battlefield = service.placeUnit(battlefield, card3, 'player2', 1)

            expect(battlefield.playerUnits[0]?.name).toBe('Warrior')
            expect(battlefield.playerUnits[3]?.name).toBe('Mage')
            expect(battlefield.enemyUnits[1]?.name).toBe('Rogue')
        })

        it('should throw error when placing unit in occupied slot', () => {
            const card1 = createTestCard({ id: 'unit-1' })
            const card2 = createTestCard({ id: 'unit-2' })

            battlefield = service.placeUnit(battlefield, card1, 'player1', 0)

            expect(() => {
                service.placeUnit(battlefield, card2, 'player1', 0)
            }).toThrow('Slot is occupied')
        })

        it('should remove unit from battlefield', () => {
            const card = createTestCard({ id: 'unit-1' })
            battlefield = service.placeUnit(battlefield, card, 'player1', 2)

            const newBf = service.removeUnit(battlefield, 'player1', 2)

            expect(newBf.playerUnits[2]).toBeNull()
        })

        it('should handle removing from empty slot gracefully', () => {
            const newBf = service.removeUnit(battlefield, 'player1', 3)

            expect(newBf.playerUnits[3]).toBeNull()
        })

        it('should handle removing from invalid slot', () => {
            const newBf1 = service.removeUnit(battlefield, 'player1', -1)
            const newBf2 = service.removeUnit(battlefield, 'player1', 10)

            expect(newBf1).toEqual(battlefield)
            expect(newBf2).toEqual(battlefield)
        })
    })

    describe('Unit Queries', () => {
        it('should get unit at specific position', () => {
            const card = createTestCard({ id: 'unit-1', name: 'Warrior' })
            battlefield = service.placeUnit(battlefield, card, 'player1', 3)

            const unit = service.getUnit(battlefield, 'player1', 3)

            expect(unit).toEqual(card)
            expect(unit?.name).toBe('Warrior')
        })

        it('should return null for empty slot', () => {
            const unit = service.getUnit(battlefield, 'player1', 0)

            expect(unit).toBeNull()
        })

        it('should return null for invalid slot', () => {
            expect(service.getUnit(battlefield, 'player1', -1)).toBeNull()
            expect(service.getUnit(battlefield, 'player1', 10)).toBeNull()
        })

        it('should get all units for a player', () => {
            const card1 = createTestCard({ id: 'unit-1' })
            const card2 = createTestCard({ id: 'unit-2' })
            const card3 = createTestCard({ id: 'unit-3' })

            battlefield = service.placeUnit(battlefield, card1, 'player1', 0)
            battlefield = service.placeUnit(battlefield, card2, 'player1', 3)
            battlefield = service.placeUnit(battlefield, card3, 'player1', 6)

            const units = service.getPlayerUnits(battlefield, 'player1')

            expect(units).toHaveLength(3)
            expect(units[0].id).toBe('unit-1')
            expect(units[1].id).toBe('unit-2')
            expect(units[2].id).toBe('unit-3')
        })

        it('should return empty array when player has no units', () => {
            const units = service.getPlayerUnits(battlefield, 'player1')

            expect(units).toHaveLength(0)
        })

        it('should find unit position by card ID', () => {
            const card = createTestCard({ id: 'findme-123' })
            battlefield = service.placeUnit(battlefield, card, 'player2', 4)

            const position = service.findUnitPosition(battlefield, 'findme-123')

            expect(position).toEqual({ player: 'player2', slot: 4 })
        })

        it('should return null when unit not found', () => {
            const position = service.findUnitPosition(battlefield, 'non-existent')

            expect(position).toBeNull()
        })

        it('should find unit in player1 slots', () => {
            const card = createTestCard({ id: 'p1-unit' })
            battlefield = service.placeUnit(battlefield, card, 'player1', 2)

            const position = service.findUnitPosition(battlefield, 'p1-unit')

            expect(position?.player).toBe('player1')
            expect(position?.slot).toBe(2)
        })
    })

    describe('Available Slots', () => {
        it('should get available slots for empty battlefield', () => {
            const slots = service.getAvailableSlots(battlefield, 'player1')

            expect(slots).toEqual([0, 1, 2, 3, 4, 5, 6])
        })

        it('should get available slots with some units placed', () => {
            const card1 = createTestCard({ id: 'unit-1' })
            const card2 = createTestCard({ id: 'unit-2' })

            battlefield = service.placeUnit(battlefield, card1, 'player1', 0)
            battlefield = service.placeUnit(battlefield, card2, 'player1', 3)

            const slots = service.getAvailableSlots(battlefield, 'player1')

            expect(slots).toEqual([1, 2, 4, 5, 6])
        })

        it('should return empty array when battlefield is full', () => {
            for (let i = 0; i < 7; i++) {
                const card = createTestCard({ id: `unit-${i}` })
                battlefield = service.placeUnit(battlefield, card, 'player1', i)
            }

            const slots = service.getAvailableSlots(battlefield, 'player1')

            expect(slots).toHaveLength(0)
        })

        it('should check if battlefield is full', () => {
            expect(service.isBattlefieldFull(battlefield, 'player1')).toBe(false)

            // Fill the battlefield
            for (let i = 0; i < 7; i++) {
                const card = createTestCard({ id: `unit-${i}` })
                battlefield = service.placeUnit(battlefield, card, 'player1', i)
            }

            expect(service.isBattlefieldFull(battlefield, 'player1')).toBe(true)
        })

        it('should check battlefield full status per player', () => {
            // Fill only player1's battlefield
            for (let i = 0; i < 7; i++) {
                const card = createTestCard({ id: `p1-unit-${i}` })
                battlefield = service.placeUnit(battlefield, card, 'player1', i)
            }

            expect(service.isBattlefieldFull(battlefield, 'player1')).toBe(true)
            expect(service.isBattlefieldFull(battlefield, 'player2')).toBe(false)
        })
    })

    describe('Combat Mechanics', () => {
        it('should get attackable units with attack > 0', () => {
            const attacker = createTestCard({
                id: 'attacker-1',
                attack: 3,
                hasAttackedThisTurn: false,
                hasSummoningSickness: false,
            })
            const weak = createTestCard({
                id: 'weak-1',
                attack: 0,
                hasAttackedThisTurn: false,
                hasSummoningSickness: false,
            })

            battlefield = service.placeUnit(battlefield, attacker, 'player1', 0)
            battlefield = service.placeUnit(battlefield, weak, 'player1', 1)

            const attackable = service.getAttackableUnits(battlefield, 'player1')

            expect(attackable).toHaveLength(1)
            expect(attackable[0].id).toBe('attacker-1')
        })

        it('should exclude units with summoning sickness', () => {
            const sickUnit = createTestCard({
                id: 'sick-1',
                attack: 3,
                hasAttackedThisTurn: false,
                hasSummoningSickness: true,
            })

            battlefield = service.placeUnit(battlefield, sickUnit, 'player1', 0)

            const attackable = service.getAttackableUnits(battlefield, 'player1')

            expect(attackable).toHaveLength(0)
        })

        it('should exclude units that already attacked', () => {
            const tired = createTestCard({
                id: 'tired-1',
                attack: 3,
                hasAttackedThisTurn: true,
                hasSummoningSickness: false,
            })

            battlefield = service.placeUnit(battlefield, tired, 'player1', 0)

            const attackable = service.getAttackableUnits(battlefield, 'player1')

            expect(attackable).toHaveLength(0)
        })

        it('should get valid attack targets', () => {
            const enemy1 = createTestCard({ id: 'enemy-1' })
            const enemy2 = createTestCard({ id: 'enemy-2' })

            battlefield = service.placeUnit(battlefield, enemy1, 'player2', 0)
            battlefield = service.placeUnit(battlefield, enemy2, 'player2', 3)

            const targets = service.getValidTargets(battlefield, 'player1')

            expect(targets.units).toHaveLength(2)
            expect(targets.canAttackNexus).toBe(true)
        })

        it('should prevent nexus attack when taunt present', () => {
            const taunt = createTestCard({
                id: 'taunt-1',
                keywords: ['taunt'],
            })

            battlefield = service.placeUnit(battlefield, taunt, 'player2', 2)

            const targets = service.getValidTargets(battlefield, 'player1')

            expect(targets.units).toHaveLength(1)
            expect(targets.canAttackNexus).toBe(false)
        })

        it('should allow nexus attack when no enemies present', () => {
            const targets = service.getValidTargets(battlefield, 'player1')

            expect(targets.units).toHaveLength(0)
            expect(targets.canAttackNexus).toBe(true)
        })
    })

    describe('Unit Management', () => {
        it('should compact units to remove gaps', () => {
            const card1 = createTestCard({ id: 'unit-1' })
            const card2 = createTestCard({ id: 'unit-2' })
            const card3 = createTestCard({ id: 'unit-3' })

            battlefield = service.placeUnit(battlefield, card1, 'player1', 0)
            battlefield = service.placeUnit(battlefield, card2, 'player1', 3)
            battlefield = service.placeUnit(battlefield, card3, 'player1', 6)

            const compacted = service.compactUnits(battlefield, 'player1')

            expect(compacted.playerUnits[0]?.id).toBe('unit-1')
            expect(compacted.playerUnits[1]?.id).toBe('unit-2')
            expect(compacted.playerUnits[2]?.id).toBe('unit-3')
            expect(compacted.playerUnits[3]).toBeNull()
        })

        it('should maintain 7 slots after compacting', () => {
            const card = createTestCard({ id: 'unit-1' })
            battlefield = service.placeUnit(battlefield, card, 'player1', 5)

            const compacted = service.compactUnits(battlefield, 'player1')

            expect(compacted.playerUnits).toHaveLength(7)
            expect(compacted.playerUnits[0]?.id).toBe('unit-1')
        })

        it('should clear summoning sickness', () => {
            const card = createTestCard({
                id: 'unit-1',
                hasSummoningSickness: true,
                hasAttackedThisTurn: true,
            })

            battlefield = service.placeUnit(battlefield, card, 'player1', 0)
            const cleared = service.clearSummoningSickness(battlefield, 'player1')

            const unit = service.getUnit(cleared, 'player1', 0)
            expect(unit?.hasSummoningSickness).toBe(false)
            expect(unit?.hasAttackedThisTurn).toBe(false)
        })

        it('should not affect other player when clearing sickness', () => {
            const p1Card = createTestCard({
                id: 'p1-unit',
                hasSummoningSickness: true,
            })
            const p2Card = createTestCard({
                id: 'p2-unit',
                hasSummoningSickness: true,
            })

            battlefield = service.placeUnit(battlefield, p1Card, 'player1', 0)
            battlefield = service.placeUnit(battlefield, p2Card, 'player2', 0)

            const cleared = service.clearSummoningSickness(battlefield, 'player1')

            const p1Unit = service.getUnit(cleared, 'player1', 0)
            const p2Unit = service.getUnit(cleared, 'player2', 0)

            expect(p1Unit?.hasSummoningSickness).toBe(false)
            expect(p2Unit?.hasSummoningSickness).toBe(true)
        })

        it('should apply end of turn effects', () => {
            const card = createTestCard({
                id: 'unit-1',
                hasAttackedThisTurn: true,
            })

            battlefield = service.placeUnit(battlefield, card, 'player1', 0)
            const updated = service.applyEndOfTurnEffects(battlefield, 'player1')

            const unit = service.getUnit(updated, 'player1', 0)
            expect(unit?.hasAttackedThisTurn).toBe(false)
        })

        it('should reset attack flags for all units', () => {
            const card1 = createTestCard({ id: 'u1', hasAttackedThisTurn: true })
            const card2 = createTestCard({ id: 'u2', hasAttackedThisTurn: true })

            battlefield = service.placeUnit(battlefield, card1, 'player1', 0)
            battlefield = service.placeUnit(battlefield, card2, 'player1', 3)

            const updated = service.applyEndOfTurnEffects(battlefield, 'player1')

            expect(service.getUnit(updated, 'player1', 0)?.hasAttackedThisTurn).toBe(false)
            expect(service.getUnit(updated, 'player1', 3)?.hasAttackedThisTurn).toBe(false)
        })
    })

    describe('Edge Cases', () => {
        it('should handle placing unit for both players', () => {
            const p1Card = createTestCard({ id: 'p1' })
            const p2Card = createTestCard({ id: 'p2' })

            battlefield = service.placeUnit(battlefield, p1Card, 'player1', 0)
            battlefield = service.placeUnit(battlefield, p2Card, 'player2', 0)

            expect(battlefield.playerUnits[0]?.id).toBe('p1')
            expect(battlefield.enemyUnits[0]?.id).toBe('p2')
        })

        it('should handle multiple operations in sequence', () => {
            const card1 = createTestCard({ id: 'u1' })
            const card2 = createTestCard({ id: 'u2' })

            battlefield = service.placeUnit(battlefield, card1, 'player1', 2)
            battlefield = service.placeUnit(battlefield, card2, 'player1', 4)
            battlefield = service.removeUnit(battlefield, 'player1', 2)

            expect(service.getUnit(battlefield, 'player1', 2)).toBeNull()
            expect(service.getUnit(battlefield, 'player1', 4)?.id).toBe('u2')
        })

        it('should not mutate original battlefield when placing', () => {
            const original = service.initializeBattlefield()
            const card = createTestCard({ id: 'unit-1' })

            service.placeUnit(original, card, 'player1', 0)

            expect(original.playerUnits[0]).toBeNull() // Original unchanged
        })

        it('should handle empty battlefield operations', () => {
            expect(service.getPlayerUnits(battlefield, 'player1')).toHaveLength(0)
            expect(service.getAvailableSlots(battlefield, 'player1')).toHaveLength(7)
            expect(service.isBattlefieldFull(battlefield, 'player1')).toBe(false)
            expect(service.findUnitPosition(battlefield, 'any-id')).toBeNull()
        })

        it('should handle all slots filled', () => {
            for (let i = 0; i < 7; i++) {
                const card = createTestCard({ id: `unit-${i}` })
                battlefield = service.placeUnit(battlefield, card, 'player1', i)
            }

            expect(service.isBattlefieldFull(battlefield, 'player1')).toBe(true)
            expect(service.getAvailableSlots(battlefield, 'player1')).toHaveLength(0)
            expect(service.getPlayerUnits(battlefield, 'player1')).toHaveLength(7)
        })

        it('should handle mixed attackable states', () => {
            const ready = createTestCard({
                id: 'ready',
                attack: 5,
                hasAttackedThisTurn: false,
                hasSummoningSickness: false,
            })
            const sick = createTestCard({
                id: 'sick',
                attack: 3,
                hasSummoningSickness: true,
            })
            const tired = createTestCard({
                id: 'tired',
                attack: 4,
                hasAttackedThisTurn: true,
            })

            battlefield = service.placeUnit(battlefield, ready, 'player1', 0)
            battlefield = service.placeUnit(battlefield, sick, 'player1', 1)
            battlefield = service.placeUnit(battlefield, tired, 'player1', 2)

            const attackable = service.getAttackableUnits(battlefield, 'player1')

            expect(attackable).toHaveLength(1)
            expect(attackable[0].id).toBe('ready')
        })
    })
})

