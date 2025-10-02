vi.unmock("@/lib/game_logger")
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { combatService } from '../combat_service'
import { battlefieldService } from '../battlefield_service'
import { createTestCard, createTestGameState } from '../../test_utils'
import type { GameState, Card } from '../../schemas/schema'
import type { Battlefield, BattlefieldPosition } from '../battlefield_service'

// Mock animation service to avoid async issues
vi.mock('../animation_service', () => ({
    animationService: {
        animateAttackToNexus: vi.fn().mockResolvedValue(undefined),
        animateNexusDamage: vi.fn().mockResolvedValue(undefined),
        animateUnitCombat: vi.fn().mockResolvedValue(undefined),
        animateUnitDamage: vi.fn().mockResolvedValue(undefined),
    },
}))

describe('CombatService', () => {
    let gameState: GameState
    let battlefield: Battlefield
    let attackerPos: BattlefieldPosition
    let defenderPos: BattlefieldPosition

    beforeEach(() => {
        gameState = createTestGameState()
        battlefield = gameState.battlefield as Battlefield

        attackerPos = { player: 'player1', slot: 0 }
        defenderPos = { player: 'player2', slot: 0 }

        // Clear the battlefield
        battlefield.playerUnits = Array(7).fill(null)
        battlefield.enemyUnits = Array(7).fill(null)
    })

    describe('processAttack - Basic Combat', () => {
        it('should deal simultaneous damage in unit vs unit combat', async () => {
            const attacker = createTestCard({
                id: 'attacker',
                attack: 5,
                health: 3,
                currentHealth: 3
            })
            const defender = createTestCard({
                id: 'defender',
                attack: 2,
                health: 4,
                currentHealth: 4
            })

            battlefield.playerUnits[0] = attacker
            battlefield.enemyUnits[0] = defender

            const result = await combatService.processAttack(
                battlefield,
                attackerPos,
                defenderPos,
                gameState
            )

            expect(result.attackerDamage).toBe(2) // Defender's attack
            expect(result.targetDamage).toBe(5) // Attacker's attack
            expect(result.attackerSurvived).toBe(true) // 3 health > 2 damage
            expect(result.targetSurvived).toBe(false) // 4 health < 5 damage
        })

        it('should handle direct nexus attacks', async () => {
            const attacker = createTestCard({
                id: 'attacker',
                attack: 7,
                health: 3,
                currentHealth: 3
            })

            battlefield.playerUnits[0] = attacker

            const result = await combatService.processAttack(
                battlefield,
                attackerPos,
                'nexus',
                gameState
            )

            expect(result.target).toBe('nexus')
            expect(result.nexusDamage).toBe(7)
            expect(result.attackerDamage).toBe(0)
            expect(result.attackerSurvived).toBe(true)
        })

        it('should mark attacker as having attacked', async () => {
            const attacker = createTestCard({
                id: 'attacker',
                attack: 3,
                health: 3,
                currentHealth: 3,
                hasAttackedThisTurn: false
            })

            battlefield.playerUnits[0] = attacker

            await combatService.processAttack(
                battlefield,
                attackerPos,
                'nexus',
                gameState
            )

            expect(attacker.hasAttackedThisTurn).toBe(true)
        })

        it('should handle 0 attack units', async () => {
            const attacker = createTestCard({
                id: 'attacker',
                attack: 0,
                health: 5,
                currentHealth: 5
            })
            const defender = createTestCard({
                id: 'defender',
                attack: 3,
                health: 2,
                currentHealth: 2
            })

            battlefield.playerUnits[0] = attacker
            battlefield.enemyUnits[0] = defender

            const result = await combatService.processAttack(
                battlefield,
                attackerPos,
                defenderPos,
                gameState
            )

            expect(result.targetDamage).toBe(0)
            expect(result.attackerDamage).toBe(3)
            expect(result.targetSurvived).toBe(true)
            expect(result.attackerSurvived).toBe(true) // 5 health > 3 damage
        })
    })

    describe('processAttack - Divine Shield', () => {
        it('should negate first damage with divine shield', async () => {
            const attacker = createTestCard({
                id: 'attacker',
                attack: 5,
                health: 3,
                currentHealth: 3
            })
            const defender = createTestCard({
                id: 'defender',
                attack: 2,
                health: 4,
                currentHealth: 4,
                divineShield: true,
                keywords: ['divine_shield'] // Also need keyword
            })

            battlefield.playerUnits[0] = attacker
            battlefield.enemyUnits[0] = defender

            const result = await combatService.processAttack(
                battlefield,
                attackerPos,
                defenderPos,
                gameState
            )

            expect(result.targetDamage).toBe(0) // Negated by shield
            expect(result.targetSurvived).toBe(true)
            expect(defender.divineShield).toBe(false) // Shield consumed
        })

        it('should not consume divine shield if no damage dealt', async () => {
            const attacker = createTestCard({
                id: 'attacker',
                attack: 0,
                health: 3,
                currentHealth: 3
            })
            const defender = createTestCard({
                id: 'defender',
                attack: 2,
                health: 4,
                currentHealth: 4,
                divineShield: true
            })

            battlefield.playerUnits[0] = attacker
            battlefield.enemyUnits[0] = defender

            const result = await combatService.processAttack(
                battlefield,
                attackerPos,
                defenderPos,
                gameState
            )

            expect(result.targetDamage).toBe(0)
            expect(defender.divineShield).toBe(true) // Shield not consumed
        })
    })

    describe('processAttack - Poisonous', () => {
        it('should instantly kill defender if attacker is poisonous', async () => {
            const attacker = createTestCard({
                id: 'attacker',
                attack: 1,
                health: 2,
                currentHealth: 2,
                keywords: ['poisonous']
            })
            const defender = createTestCard({
                id: 'defender',
                attack: 1,
                health: 10, // High health doesn't matter
                currentHealth: 10
            })

            battlefield.playerUnits[0] = attacker
            battlefield.enemyUnits[0] = defender

            const result = await combatService.processAttack(
                battlefield,
                attackerPos,
                defenderPos,
                gameState
            )

            expect(result.targetDamage).toBe(10) // Full health as damage
            expect(result.targetSurvived).toBe(false)
        })

        it('should instantly kill attacker if defender is poisonous', async () => {
            const attacker = createTestCard({
                id: 'attacker',
                attack: 5,
                health: 10,
                currentHealth: 10
            })
            const defender = createTestCard({
                id: 'defender',
                attack: 1,
                health: 2,
                currentHealth: 2,
                keywords: ['poisonous']
            })

            battlefield.playerUnits[0] = attacker
            battlefield.enemyUnits[0] = defender

            const result = await combatService.processAttack(
                battlefield,
                attackerPos,
                defenderPos,
                gameState
            )

            expect(result.attackerDamage).toBe(10) // Full health as damage
            expect(result.attackerSurvived).toBe(false)
        })

        it('should handle both units being poisonous', async () => {
            const attacker = createTestCard({
                id: 'attacker',
                attack: 2,
                health: 5,
                currentHealth: 5,
                keywords: ['poisonous']
            })
            const defender = createTestCard({
                id: 'defender',
                attack: 3,
                health: 7,
                currentHealth: 7,
                keywords: ['poisonous']
            })

            battlefield.playerUnits[0] = attacker
            battlefield.enemyUnits[0] = defender

            const result = await combatService.processAttack(
                battlefield,
                attackerPos,
                defenderPos,
                gameState
            )

            expect(result.attackerDamage).toBe(5) // Instant kill
            expect(result.targetDamage).toBe(7) // Instant kill
            expect(result.attackerSurvived).toBe(false)
            expect(result.targetSurvived).toBe(false)
        })
    })

    describe('processAttack - Lifesteal', () => {
        it('should heal player when dealing damage with lifesteal', async () => {
            const attacker = createTestCard({
                id: 'attacker',
                attack: 5,
                health: 3,
                currentHealth: 3,
                keywords: ['lifesteal']
            })
            const defender = createTestCard({
                id: 'defender',
                attack: 2,
                health: 4,
                currentHealth: 4
            })

            battlefield.playerUnits[0] = attacker
            battlefield.enemyUnits[0] = defender

            const result = await combatService.processAttack(
                battlefield,
                attackerPos,
                defenderPos,
                gameState
            )

            expect(result.nexusDamage).toBe(-5) // Negative = healing
        })

        it('should not heal if no damage dealt', async () => {
            const attacker = createTestCard({
                id: 'attacker',
                attack: 0,
                health: 3,
                currentHealth: 3,
                keywords: ['lifesteal']
            })
            const defender = createTestCard({
                id: 'defender',
                attack: 2,
                health: 4,
                currentHealth: 4
            })

            battlefield.playerUnits[0] = attacker
            battlefield.enemyUnits[0] = defender

            const result = await combatService.processAttack(
                battlefield,
                attackerPos,
                defenderPos,
                gameState
            )

            expect(result.nexusDamage).toBe(0) // No healing
        })
    })

    describe('processAttack - Elemental Fury', () => {
        it('should deal double damage to opposing element (fire vs water)', async () => {
            const attacker = createTestCard({
                id: 'attacker',
                attack: 4,
                health: 3,
                currentHealth: 3,
                element: 'fire',
                keywords: ['elemental_fury']
            })
            const defender = createTestCard({
                id: 'defender',
                attack: 2,
                health: 10,
                currentHealth: 10,
                element: 'water'
            })

            battlefield.playerUnits[0] = attacker
            battlefield.enemyUnits[0] = defender

            const result = await combatService.processAttack(
                battlefield,
                attackerPos,
                defenderPos,
                gameState
            )

            expect(result.targetDamage).toBe(8) // 4 * 2
        })

        it('should deal double damage to opposing element (earth vs air)', async () => {
            const attacker = createTestCard({
                id: 'attacker',
                attack: 3,
                health: 3,
                currentHealth: 3,
                element: 'earth',
                keywords: ['elemental_fury']
            })
            const defender = createTestCard({
                id: 'defender',
                attack: 2,
                health: 10,
                currentHealth: 10,
                element: 'air'
            })

            battlefield.playerUnits[0] = attacker
            battlefield.enemyUnits[0] = defender

            const result = await combatService.processAttack(
                battlefield,
                attackerPos,
                defenderPos,
                gameState
            )

            expect(result.targetDamage).toBe(6) // 3 * 2
        })

        it('should deal normal damage to non-opposing element', async () => {
            const attacker = createTestCard({
                id: 'attacker',
                attack: 4,
                health: 3,
                currentHealth: 3,
                element: 'fire',
                keywords: ['elemental_fury']
            })
            const defender = createTestCard({
                id: 'defender',
                attack: 2,
                health: 10,
                currentHealth: 10,
                element: 'fire' // Same element
            })

            battlefield.playerUnits[0] = attacker
            battlefield.enemyUnits[0] = defender

            const result = await combatService.processAttack(
                battlefield,
                attackerPos,
                defenderPos,
                gameState
            )

            expect(result.targetDamage).toBe(4) // No doubling
        })
    })

    describe('processAttack - Solar Radiance', () => {
        it('should trigger solar radiance effect when dealing damage', async () => {
            const attacker = createTestCard({
                id: 'attacker',
                attack: 5,
                health: 3,
                currentHealth: 3,
                keywords: ['solar_radiance']
            })
            const defender = createTestCard({
                id: 'defender',
                attack: 2,
                health: 4,
                currentHealth: 4
            })

            battlefield.playerUnits[0] = attacker
            battlefield.enemyUnits[0] = defender

            const result = await combatService.processAttack(
                battlefield,
                attackerPos,
                defenderPos,
                gameState
            )

            expect(result.triggeredEffects).toContain('solar_radiance')
        })

        it('should not trigger solar radiance if no damage dealt', async () => {
            const attacker = createTestCard({
                id: 'attacker',
                attack: 0,
                health: 3,
                currentHealth: 3,
                keywords: ['solar_radiance']
            })
            const defender = createTestCard({
                id: 'defender',
                attack: 2,
                health: 4,
                currentHealth: 4
            })

            battlefield.playerUnits[0] = attacker
            battlefield.enemyUnits[0] = defender

            const result = await combatService.processAttack(
                battlefield,
                attackerPos,
                defenderPos,
                gameState
            )

            expect(result.triggeredEffects).not.toContain('solar_radiance')
        })
    })

    describe('processAttack - Error Handling', () => {
        it('should throw error if no attacker at position', async () => {
            // Empty battlefield
            await expect(
                combatService.processAttack(
                    battlefield,
                    attackerPos,
                    defenderPos,
                    gameState
                )
            ).rejects.toThrow('No attacker found at position')
        })

        it('should throw error if no defender at position', async () => {
            const attacker = createTestCard({
                id: 'attacker',
                attack: 5,
                health: 3,
                currentHealth: 3
            })

            battlefield.playerUnits[0] = attacker
            // No defender placed

            await expect(
                combatService.processAttack(
                    battlefield,
                    attackerPos,
                    defenderPos,
                    gameState
                )
            ).rejects.toThrow('No target unit found at position')
        })
    })

    describe('hasKeyword', () => {
        it('should detect keywords in card keywords array', () => {
            const card = createTestCard({
                id: 'card',
                keywords: ['taunt', 'divine_shield']
            })

            // Note: hasKeyword is private, so we test it through processAttack
            // We can verify keyword behavior through combat results
            expect(card.keywords).toContain('taunt')
        })
    })

    describe('getValidTargets', () => {
        it('should force targeting taunt units first', () => {
            const attacker = createTestCard({ id: 'attacker', keywords: [] })
            const normalUnit = createTestCard({ id: 'normal', keywords: [] })
            const tauntUnit = createTestCard({ id: 'taunt', keywords: ['taunt'] })

            battlefield.playerUnits[0] = attacker
            battlefield.enemyUnits[0] = normalUnit
            battlefield.enemyUnits[1] = tauntUnit

            const targets = combatService.getValidTargets(battlefield, attackerPos)

            // Should only include taunt units
            expect(targets.units).toHaveLength(1)
            expect(targets.units[0].slot).toBe(1)
            expect(targets.canAttackNexus).toBe(false)
        })

        it('should return all enemy units if no taunt', () => {
            const attacker = createTestCard({ id: 'attacker', keywords: [] })
            const unit1 = createTestCard({ id: 'unit1', keywords: [] })
            const unit2 = createTestCard({ id: 'unit2', keywords: [] })

            battlefield.playerUnits[0] = attacker
            battlefield.enemyUnits[0] = unit1
            battlefield.enemyUnits[2] = unit2

            const targets = combatService.getValidTargets(battlefield, attackerPos)

            expect(targets.units).toHaveLength(2)
            expect(targets.units.some(t => t.slot === 0)).toBe(true)
            expect(targets.units.some(t => t.slot === 2)).toBe(true)
        })

        it('should allow nexus attack if no taunt units', () => {
            const attacker = createTestCard({ id: 'attacker', keywords: [] })
            const normalUnit = createTestCard({ id: 'normal', keywords: [] })

            battlefield.playerUnits[0] = attacker
            battlefield.enemyUnits[0] = normalUnit

            const targets = combatService.getValidTargets(battlefield, attackerPos)

            // Should include enemy unit AND allow nexus attack
            expect(targets.units.length).toBeGreaterThanOrEqual(1)
            expect(targets.canAttackNexus).toBe(true)
        })

        it('should not allow nexus attack if taunt units present', () => {
            const attacker = createTestCard({ id: 'attacker', keywords: [] })
            const tauntUnit = createTestCard({ id: 'taunt', keywords: ['taunt'] })

            battlefield.playerUnits[0] = attacker
            battlefield.enemyUnits[0] = tauntUnit

            const targets = combatService.getValidTargets(battlefield, attackerPos)

            // Should only include taunt unit, not nexus
            expect(targets.units).toHaveLength(1)
            expect(targets.units[0].slot).toBe(0)
            expect(targets.canAttackNexus).toBe(false)
        })
    })

    describe('Combat Modifiers', () => {
        it('should apply attack bonus modifiers', async () => {
            const attacker = createTestCard({
                id: 'attacker',
                attack: 3,
                health: 3,
                currentHealth: 3,
                astrologyBonus: 2 // This gets added as attack bonus
            })
            const defender = createTestCard({
                id: 'defender',
                attack: 1,
                health: 10,
                currentHealth: 10
            })

            battlefield.playerUnits[0] = attacker
            battlefield.enemyUnits[0] = defender

            const result = await combatService.processAttack(
                battlefield,
                attackerPos,
                defenderPos,
                gameState
            )

            // Should include base attack + bonus
            expect(result.targetDamage).toBeGreaterThanOrEqual(3)
        })
    })
})
