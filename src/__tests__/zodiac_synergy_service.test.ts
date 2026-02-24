import { describe, it, expect, beforeEach } from 'vitest'
import type { GameState } from '@/schemas/schema'
import {
  calculateActiveSynergies,
  countUnitsByElement,
  getElementBonus,
  getSpecialBonus,
  getSynergyAttackBonus,
  getSynergyHealthBonus,
  getSynergyTier,
  getElementColor,
} from '@/services/zodiac_synergy_service'
import { createTestGameState, createTestCard, placeUnitsOnBattlefield } from '@/test_utils'

describe('ZodiacSynergyService', () => {
  let gameState: GameState

  beforeEach(() => {
    gameState = createTestGameState({
      phase: 'action',
      activePlayer: 'player1',
    })
  })

  // ================================
  // No synergy (0-1 units)
  // ================================

  describe('No synergy with 0-1 units', () => {
    it('should return null bonus for 0 units', () => {
      const bonus = getElementBonus(0)
      expect(bonus).toBeNull()
    })

    it('should return null bonus for 1 unit', () => {
      const bonus = getElementBonus(1)
      expect(bonus).toBeNull()
    })

    it('should return empty synergies when no units on battlefield', () => {
      const result = calculateActiveSynergies(gameState, 'player1')
      expect(result.synergies).toHaveLength(0)
      expect(result.specialBonuses).toHaveLength(0)
    })

    it('should return empty synergies with only 1 unit of each element', () => {
      gameState = placeUnitsOnBattlefield(gameState, 'player1', [
        { id: 'fire-1', element: 'fire', zodiacClass: 'aries' },
        { id: 'water-1', element: 'water', zodiacClass: 'cancer' },
        { id: 'earth-1', element: 'earth', zodiacClass: 'taurus' },
        { id: 'air-1', element: 'air', zodiacClass: 'gemini' },
      ])

      const result = calculateActiveSynergies(gameState, 'player1')
      expect(result.synergies).toHaveLength(0)
      expect(result.specialBonuses).toHaveLength(0)
    })

    it('should return 0 attack bonus for a card with no synergy', () => {
      gameState = placeUnitsOnBattlefield(gameState, 'player1', [
        { id: 'fire-1', element: 'fire', zodiacClass: 'aries' },
      ])
      const card = createTestCard({ element: 'fire' })
      const bonus = getSynergyAttackBonus(gameState, 'player1', card)
      expect(bonus).toBe(0)
    })

    it('should return 0 health bonus for a card with no synergy', () => {
      gameState = placeUnitsOnBattlefield(gameState, 'player1', [
        { id: 'fire-1', element: 'fire', zodiacClass: 'aries' },
      ])
      const card = createTestCard({ element: 'fire' })
      const bonus = getSynergyHealthBonus(gameState, 'player1', card)
      expect(bonus).toBe(0)
    })
  })

  // ================================
  // 2-unit synergy
  // ================================

  describe('2-unit synergy', () => {
    it('should give +1 attack for 2 units of same element', () => {
      const bonus = getElementBonus(2)
      expect(bonus).not.toBeNull()
      expect(bonus!.attack).toBe(1)
      expect(bonus!.health).toBe(0)
    })

    it('should detect 2-unit fire synergy on battlefield', () => {
      gameState = placeUnitsOnBattlefield(gameState, 'player1', [
        { id: 'fire-1', element: 'fire', zodiacClass: 'aries' },
        { id: 'fire-2', element: 'fire', zodiacClass: 'leo' },
      ])

      const result = calculateActiveSynergies(gameState, 'player1')
      expect(result.synergies).toHaveLength(1)
      expect(result.synergies[0].element).toBe('fire')
      expect(result.synergies[0].unitCount).toBe(2)
      expect(result.synergies[0].bonus.attack).toBe(1)
      expect(result.synergies[0].bonus.health).toBe(0)
    })

    it('should give +1 attack bonus through getSynergyAttackBonus', () => {
      gameState = placeUnitsOnBattlefield(gameState, 'player1', [
        { id: 'fire-1', element: 'fire', zodiacClass: 'aries' },
        { id: 'fire-2', element: 'fire', zodiacClass: 'leo' },
      ])

      const card = createTestCard({ element: 'fire' })
      const attackBonus = getSynergyAttackBonus(gameState, 'player1', card)
      expect(attackBonus).toBe(1)
    })

    it('should give 0 health bonus for 2-unit synergy', () => {
      gameState = placeUnitsOnBattlefield(gameState, 'player1', [
        { id: 'water-1', element: 'water', zodiacClass: 'cancer' },
        { id: 'water-2', element: 'water', zodiacClass: 'pisces' },
      ])

      const card = createTestCard({ element: 'water' })
      const healthBonus = getSynergyHealthBonus(gameState, 'player1', card)
      expect(healthBonus).toBe(0)
    })

    it('should not give synergy bonus to a different element', () => {
      gameState = placeUnitsOnBattlefield(gameState, 'player1', [
        { id: 'fire-1', element: 'fire', zodiacClass: 'aries' },
        { id: 'fire-2', element: 'fire', zodiacClass: 'leo' },
      ])

      const waterCard = createTestCard({ element: 'water' })
      const attackBonus = getSynergyAttackBonus(gameState, 'player1', waterCard)
      expect(attackBonus).toBe(0)
    })
  })

  // ================================
  // 3-unit synergy
  // ================================

  describe('3-unit synergy', () => {
    it('should give +1/+1 for 3 units of same element', () => {
      const bonus = getElementBonus(3)
      expect(bonus).not.toBeNull()
      expect(bonus!.attack).toBe(1)
      expect(bonus!.health).toBe(1)
    })

    it('should detect 3-unit earth synergy on battlefield', () => {
      gameState = placeUnitsOnBattlefield(gameState, 'player1', [
        { id: 'earth-1', element: 'earth', zodiacClass: 'taurus' },
        { id: 'earth-2', element: 'earth', zodiacClass: 'virgo' },
        { id: 'earth-3', element: 'earth', zodiacClass: 'capricorn' },
      ])

      const result = calculateActiveSynergies(gameState, 'player1')
      expect(result.synergies).toHaveLength(1)
      expect(result.synergies[0].element).toBe('earth')
      expect(result.synergies[0].unitCount).toBe(3)
      expect(result.synergies[0].bonus.attack).toBe(1)
      expect(result.synergies[0].bonus.health).toBe(1)
    })

    it('should give +1 health bonus for 3-unit synergy', () => {
      gameState = placeUnitsOnBattlefield(gameState, 'player1', [
        { id: 'air-1', element: 'air', zodiacClass: 'gemini' },
        { id: 'air-2', element: 'air', zodiacClass: 'libra' },
        { id: 'air-3', element: 'air', zodiacClass: 'aquarius' },
      ])

      const card = createTestCard({ element: 'air' })
      const healthBonus = getSynergyHealthBonus(gameState, 'player1', card)
      expect(healthBonus).toBe(1)
    })

    it('should not produce special bonuses at 3 units', () => {
      gameState = placeUnitsOnBattlefield(gameState, 'player1', [
        { id: 'fire-1', element: 'fire', zodiacClass: 'aries' },
        { id: 'fire-2', element: 'fire', zodiacClass: 'leo' },
        { id: 'fire-3', element: 'fire', zodiacClass: 'sagittarius' },
      ])

      const result = calculateActiveSynergies(gameState, 'player1')
      expect(result.specialBonuses).toHaveLength(0)
    })
  })

  // ================================
  // 4+ unit synergy
  // ================================

  describe('4+ unit synergy', () => {
    it('should give +2/+1 for 4+ units of same element', () => {
      const bonus = getElementBonus(4)
      expect(bonus).not.toBeNull()
      expect(bonus!.attack).toBe(2)
      expect(bonus!.health).toBe(1)
    })

    it('should give same bonus for 5 units as 4', () => {
      const bonus4 = getElementBonus(4)
      const bonus5 = getElementBonus(5)
      expect(bonus4).toEqual(bonus5)
    })

    it('should detect 4-unit fire synergy with special bonus', () => {
      gameState = placeUnitsOnBattlefield(gameState, 'player1', [
        { id: 'fire-1', element: 'fire', zodiacClass: 'aries' },
        { id: 'fire-2', element: 'fire', zodiacClass: 'leo' },
        { id: 'fire-3', element: 'fire', zodiacClass: 'sagittarius' },
        { id: 'fire-4', element: 'fire', zodiacClass: 'aries' },
      ])

      const result = calculateActiveSynergies(gameState, 'player1')
      expect(result.synergies).toHaveLength(1)
      expect(result.synergies[0].bonus.attack).toBe(2)
      expect(result.synergies[0].bonus.health).toBe(1)
      expect(result.specialBonuses).toHaveLength(1)
      expect(result.specialBonuses[0].type).toBe('fire_burn')
    })

    it('should give +2 attack bonus through getSynergyAttackBonus at 4+ units', () => {
      gameState = placeUnitsOnBattlefield(gameState, 'player1', [
        { id: 'water-1', element: 'water', zodiacClass: 'cancer' },
        { id: 'water-2', element: 'water', zodiacClass: 'scorpio' },
        { id: 'water-3', element: 'water', zodiacClass: 'pisces' },
        { id: 'water-4', element: 'water', zodiacClass: 'cancer' },
      ])

      const card = createTestCard({ element: 'water' })
      const attackBonus = getSynergyAttackBonus(gameState, 'player1', card)
      expect(attackBonus).toBe(2)
    })
  })

  // ================================
  // Mixed elements
  // ================================

  describe('Mixed elements', () => {
    it('should track multiple element synergies independently', () => {
      gameState = placeUnitsOnBattlefield(gameState, 'player1', [
        { id: 'fire-1', element: 'fire', zodiacClass: 'aries' },
        { id: 'fire-2', element: 'fire', zodiacClass: 'leo' },
        { id: 'water-1', element: 'water', zodiacClass: 'cancer' },
        { id: 'water-2', element: 'water', zodiacClass: 'pisces' },
        { id: 'water-3', element: 'water', zodiacClass: 'scorpio' },
      ])

      const result = calculateActiveSynergies(gameState, 'player1')
      expect(result.synergies).toHaveLength(2)

      const fireSynergy = result.synergies.find(s => s.element === 'fire')
      const waterSynergy = result.synergies.find(s => s.element === 'water')

      expect(fireSynergy).toBeDefined()
      expect(fireSynergy!.unitCount).toBe(2)
      expect(fireSynergy!.bonus.attack).toBe(1)

      expect(waterSynergy).toBeDefined()
      expect(waterSynergy!.unitCount).toBe(3)
      expect(waterSynergy!.bonus.attack).toBe(1)
      expect(waterSynergy!.bonus.health).toBe(1)
    })

    it('should correctly count units by element', () => {
      gameState = placeUnitsOnBattlefield(gameState, 'player1', [
        { id: 'fire-1', element: 'fire', zodiacClass: 'aries' },
        { id: 'earth-1', element: 'earth', zodiacClass: 'taurus' },
        { id: 'fire-2', element: 'fire', zodiacClass: 'leo' },
        { id: 'air-1', element: 'air', zodiacClass: 'gemini' },
        { id: 'fire-3', element: 'fire', zodiacClass: 'sagittarius' },
      ])

      const counts = countUnitsByElement(gameState, 'player1')
      expect(counts.fire).toBe(3)
      expect(counts.earth).toBe(1)
      expect(counts.air).toBe(1)
      expect(counts.water).toBeUndefined()
    })

    it('should only apply synergy bonus to matching element cards', () => {
      gameState = placeUnitsOnBattlefield(gameState, 'player1', [
        { id: 'fire-1', element: 'fire', zodiacClass: 'aries' },
        { id: 'fire-2', element: 'fire', zodiacClass: 'leo' },
        { id: 'fire-3', element: 'fire', zodiacClass: 'sagittarius' },
        { id: 'earth-1', element: 'earth', zodiacClass: 'taurus' },
      ])

      const fireCard = createTestCard({ element: 'fire' })
      const earthCard = createTestCard({ element: 'earth' })

      expect(getSynergyAttackBonus(gameState, 'player1', fireCard)).toBe(1)
      expect(getSynergyAttackBonus(gameState, 'player1', earthCard)).toBe(0)
    })

    it('should handle player2 synergies separately from player1', () => {
      // Player1 has 3 fire units
      gameState = placeUnitsOnBattlefield(gameState, 'player1', [
        { id: 'p1-fire-1', element: 'fire', zodiacClass: 'aries' },
        { id: 'p1-fire-2', element: 'fire', zodiacClass: 'leo' },
        { id: 'p1-fire-3', element: 'fire', zodiacClass: 'sagittarius' },
      ])
      // Player2 has 2 water units
      gameState = placeUnitsOnBattlefield(gameState, 'player2', [
        { id: 'p2-water-1', element: 'water', zodiacClass: 'cancer' },
        { id: 'p2-water-2', element: 'water', zodiacClass: 'pisces' },
      ])

      const p1Result = calculateActiveSynergies(gameState, 'player1')
      const p2Result = calculateActiveSynergies(gameState, 'player2')

      expect(p1Result.synergies).toHaveLength(1)
      expect(p1Result.synergies[0].element).toBe('fire')

      expect(p2Result.synergies).toHaveLength(1)
      expect(p2Result.synergies[0].element).toBe('water')
    })
  })

  // ================================
  // Element-specific special bonuses
  // ================================

  describe('Element-specific special bonuses', () => {
    it('should return fire burn special at 4+ fire units', () => {
      const special = getSpecialBonus('fire', 4)
      expect(special).not.toBeNull()
      expect(special!.type).toBe('fire_burn')
      expect(special!.value).toBe(1)
      expect(special!.description).toContain('damage')
    })

    it('should return water heal special at 4+ water units', () => {
      const special = getSpecialBonus('water', 4)
      expect(special).not.toBeNull()
      expect(special!.type).toBe('water_heal')
      expect(special!.value).toBe(1)
      expect(special!.description).toContain('Heal')
    })

    it('should return earth fortify special at 4+ earth units', () => {
      const special = getSpecialBonus('earth', 4)
      expect(special).not.toBeNull()
      expect(special!.type).toBe('earth_fortify')
      expect(special!.value).toBe(1)
      expect(special!.description).toContain('durability')
    })

    it('should return air draw special at 4+ air units', () => {
      const special = getSpecialBonus('air', 4)
      expect(special).not.toBeNull()
      expect(special!.type).toBe('air_draw')
      expect(special!.value).toBe(1)
      expect(special!.description).toContain('Draw')
    })

    it('should not return special bonus at 3 units', () => {
      expect(getSpecialBonus('fire', 3)).toBeNull()
      expect(getSpecialBonus('water', 3)).toBeNull()
      expect(getSpecialBonus('earth', 3)).toBeNull()
      expect(getSpecialBonus('air', 3)).toBeNull()
    })

    it('should give earth units extra health at 4+ earth units', () => {
      gameState = placeUnitsOnBattlefield(gameState, 'player1', [
        { id: 'earth-1', element: 'earth', zodiacClass: 'taurus' },
        { id: 'earth-2', element: 'earth', zodiacClass: 'virgo' },
        { id: 'earth-3', element: 'earth', zodiacClass: 'capricorn' },
        { id: 'earth-4', element: 'earth', zodiacClass: 'taurus' },
      ])

      const earthCard = createTestCard({ element: 'earth' })
      const healthBonus = getSynergyHealthBonus(gameState, 'player1', earthCard)
      // Base 4+ bonus (+1 health) + earth special (+1 health) = +2
      expect(healthBonus).toBe(2)
    })
  })

  // ================================
  // Utility functions
  // ================================

  describe('Utility functions', () => {
    it('should return correct synergy tier labels', () => {
      expect(getSynergyTier(0)).toBeNull()
      expect(getSynergyTier(1)).toBeNull()
      expect(getSynergyTier(2)).toBe('Minor')
      expect(getSynergyTier(3)).toBe('Strong')
      expect(getSynergyTier(4)).toBe('Dominant')
      expect(getSynergyTier(7)).toBe('Dominant')
    })

    it('should return correct element colors', () => {
      expect(getElementColor('fire')).toBe('red')
      expect(getElementColor('water')).toBe('blue')
      expect(getElementColor('earth')).toBe('green')
      expect(getElementColor('air')).toBe('purple')
    })
  })
})
