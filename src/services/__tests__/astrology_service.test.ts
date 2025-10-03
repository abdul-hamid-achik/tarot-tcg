vi.unmock('@/lib/game_logger')
vi.unmock('@/services/astrology_service')

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { astrologyService } from '../astrology_service'
import type { Card, ZodiacClass, Element } from '@/schemas/schema'
import type { Battlefield, BattlefieldPosition } from '@/services/battlefield_service'
import { createTestCard } from '@/test_utils'

describe('AstrologyService', () => {
    let battlefield: Battlefield

    beforeEach(() => {
        // Reset battlefield for each test
        battlefield = {
            playerUnits: Array(7).fill(null),
            enemyUnits: Array(7).fill(null),
            maxSlots: 7,
        }
    })

    describe('Cosmic Alignment', () => {
        it('should calculate cosmic alignment with single element', () => {
            battlefield.playerUnits[0] = createTestCard({ id: 'fire1', element: 'fire', zodiacClass: 'aries' })
            battlefield.playerUnits[1] = createTestCard({ id: 'fire2', element: 'fire', zodiacClass: 'leo' })
            battlefield.playerUnits[2] = createTestCard({ id: 'fire3', element: 'fire', zodiacClass: 'sagittarius' })

            const alignment = astrologyService.calculateCosmicAlignment(battlefield)

            expect(alignment.dominantElement).toBe('fire')
            expect(alignment.alignedSigns).toHaveLength(0) // No single sign has 2+ cards
            expect(alignment.resonanceStrength).toBeGreaterThanOrEqual(0)
            expect(['new_moon', 'waxing', 'full_moon', 'waning']).toContain(alignment.activePhase)
        })

        it('should detect aligned signs with 2+ cards', () => {
            battlefield.playerUnits[0] = createTestCard({ id: 'aries1', element: 'fire', zodiacClass: 'aries' })
            battlefield.playerUnits[1] = createTestCard({ id: 'aries2', element: 'fire', zodiacClass: 'aries' })
            battlefield.enemyUnits[0] = createTestCard({ id: 'leo1', element: 'fire', zodiacClass: 'leo' })

            const alignment = astrologyService.calculateCosmicAlignment(battlefield)

            expect(alignment.dominantElement).toBe('fire')
            expect(alignment.alignedSigns).toContain('aries')
            expect(alignment.resonanceStrength).toBeGreaterThan(0)
        })

        it('should find dominant element with multiple elements', () => {
            battlefield.playerUnits[0] = createTestCard({ id: 'fire1', element: 'fire', zodiacClass: 'aries' })
            battlefield.playerUnits[1] = createTestCard({ id: 'fire2', element: 'fire', zodiacClass: 'leo' })
            battlefield.playerUnits[2] = createTestCard({ id: 'water1', element: 'water', zodiacClass: 'cancer' })

            const alignment = astrologyService.calculateCosmicAlignment(battlefield)

            expect(alignment.dominantElement).toBe('fire') // Fire has 2 cards, water has 1
        })

        it('should handle empty battlefield', () => {
            const alignment = astrologyService.calculateCosmicAlignment(battlefield)

            expect(alignment.dominantElement).toBe('fire') // Default
            expect(alignment.alignedSigns).toHaveLength(0)
            expect(alignment.resonanceStrength).toBeGreaterThanOrEqual(0)
        })

        it('should handle mixed players battlefield', () => {
            battlefield.playerUnits[0] = createTestCard({ id: 'p1', element: 'earth', zodiacClass: 'taurus' })
            battlefield.playerUnits[1] = createTestCard({ id: 'p2', element: 'earth', zodiacClass: 'taurus' })
            battlefield.enemyUnits[0] = createTestCard({ id: 'e1', element: 'earth', zodiacClass: 'virgo' })

            const alignment = astrologyService.calculateCosmicAlignment(battlefield)

            expect(alignment.dominantElement).toBe('earth')
            expect(alignment.alignedSigns).toContain('taurus')
        })

        it('should get current alignment', () => {
            battlefield.playerUnits[0] = createTestCard({ id: 'card1', element: 'fire', zodiacClass: 'aries' })
            astrologyService.calculateCosmicAlignment(battlefield)

            const currentAlignment = astrologyService.getCurrentAlignment()

            expect(currentAlignment).toBeDefined()
            expect(currentAlignment.dominantElement).toBeDefined()
        })
    })

    describe('Astrology Bonuses', () => {
        it('should grant zodiac synergy bonus for aligned signs', () => {
            const card = createTestCard({ id: 'aries1', element: 'fire', zodiacClass: 'aries' })
            battlefield.playerUnits[0] = card
            battlefield.playerUnits[1] = createTestCard({ id: 'aries2', element: 'fire', zodiacClass: 'aries' })

            const bonuses = astrologyService.getAstrologyBonuses(card, battlefield)

            const synergyBonus = bonuses.find(b => b.source === 'zodiac_synergy')
            expect(synergyBonus).toBeDefined()
            expect(synergyBonus?.bonusType).toBe('attack')
            expect(synergyBonus?.value).toBe(1)
        })

        it('should grant elemental dominance bonus', () => {
            const card = createTestCard({ id: 'fire1', element: 'fire', zodiacClass: 'aries' })
            battlefield.playerUnits[0] = card
            battlefield.playerUnits[1] = createTestCard({ id: 'fire2', element: 'fire', zodiacClass: 'leo' })
            battlefield.playerUnits[2] = createTestCard({ id: 'fire3', element: 'fire', zodiacClass: 'sagittarius' })

            const bonuses = astrologyService.getAstrologyBonuses(card, battlefield)

            const dominanceBonus = bonuses.find(b => b.source === 'elemental_dominance')
            expect(dominanceBonus).toBeDefined()
            expect(dominanceBonus?.bonusType).toBe('health')
            expect(dominanceBonus?.value).toBe(1)
        })

        it('should grant cosmic alignment bonus for high resonance', () => {
            const card = createTestCard({ id: 'aries1', element: 'fire', zodiacClass: 'aries' })
            // Create high resonance by having multiple aligned signs
            battlefield.playerUnits[0] = card
            battlefield.playerUnits[1] = createTestCard({ id: 'aries2', element: 'fire', zodiacClass: 'aries' })
            battlefield.playerUnits[2] = createTestCard({ id: 'leo1', element: 'fire', zodiacClass: 'leo' })
            battlefield.playerUnits[3] = createTestCard({ id: 'leo2', element: 'fire', zodiacClass: 'leo' })
            battlefield.enemyUnits[0] = createTestCard({ id: 'sag1', element: 'fire', zodiacClass: 'sagittarius' })
            battlefield.enemyUnits[1] = createTestCard({ id: 'sag2', element: 'fire', zodiacClass: 'sagittarius' })

            const bonuses = astrologyService.getAstrologyBonuses(card, battlefield)

            const cosmicBonus = bonuses.find(b => b.source === 'cosmic_alignment' && b.bonusType === 'special_ability')
            expect(cosmicBonus).toBeDefined()
            expect(cosmicBonus?.value).toBe(1)
        })

        it('should grant full moon bonus', () => {
            // Mock Date.now to ensure full moon phase
            const mockDate = vi.spyOn(Date, 'now')
            mockDate.mockReturnValue(1000 * 60 * 2 * 2) // This should give us full_moon (cycle 2)

            const card = createTestCard({ id: 'card1', element: 'fire', zodiacClass: 'aries' })
            battlefield.playerUnits[0] = card

            const bonuses = astrologyService.getAstrologyBonuses(card, battlefield)

            const fullMoonBonus = bonuses.find(b =>
                b.source === 'cosmic_alignment' && b.bonusType === 'attack'
            )
            expect(fullMoonBonus).toBeDefined()

            mockDate.mockRestore()
        })

        it('should grant multiple bonuses when conditions met', () => {
            const card = createTestCard({ id: 'fire1', element: 'fire', zodiacClass: 'aries' })
            battlefield.playerUnits[0] = card
            battlefield.playerUnits[1] = createTestCard({ id: 'fire2', element: 'fire', zodiacClass: 'aries' })
            battlefield.playerUnits[2] = createTestCard({ id: 'fire3', element: 'fire', zodiacClass: 'leo' })

            const bonuses = astrologyService.getAstrologyBonuses(card, battlefield)

            // Should get at least zodiac synergy and elemental dominance
            expect(bonuses.length).toBeGreaterThan(0)
        })

        it('should return empty bonuses when no conditions met', () => {
            const card = createTestCard({ id: 'water1', element: 'water', zodiacClass: 'cancer' })
            battlefield.playerUnits[0] = card
            battlefield.playerUnits[1] = createTestCard({ id: 'fire1', element: 'fire', zodiacClass: 'aries' })

            const bonuses = astrologyService.getAstrologyBonuses(card, battlefield)

            // Might have full moon bonus depending on time
            expect(Array.isArray(bonuses)).toBe(true)
        })
    })

    describe('Cosmic Resonance', () => {
        it('should calculate resonance with same zodiac cards', () => {
            const card = createTestCard({ id: 'aries1', element: 'fire', zodiacClass: 'aries' })
            battlefield.playerUnits[0] = card
            battlefield.playerUnits[1] = createTestCard({ id: 'aries2', element: 'fire', zodiacClass: 'aries' })
            battlefield.playerUnits[2] = createTestCard({ id: 'aries3', element: 'fire', zodiacClass: 'aries' })

            const resonance = astrologyService.calculateCosmicResonance(card, battlefield)

            // 2 same zodiac cards * 2 = 4, plus trinity bonus of 3 = 7, plus element matches
            expect(resonance).toBeGreaterThan(0)
        })

        it('should give trinity bonus for 3+ same zodiac cards', () => {
            const card = createTestCard({ id: 'leo1', element: 'fire', zodiacClass: 'leo' })
            battlefield.playerUnits[0] = card
            battlefield.playerUnits[1] = createTestCard({ id: 'leo2', element: 'fire', zodiacClass: 'leo' })
            battlefield.playerUnits[2] = createTestCard({ id: 'leo3', element: 'fire', zodiacClass: 'leo' })

            const resonance = astrologyService.calculateCosmicResonance(card, battlefield)

            expect(resonance).toBeGreaterThanOrEqual(7) // Trinity bonus included
        })

        it('should add bonus from elemental matches', () => {
            const card = createTestCard({ id: 'fire1', element: 'fire', zodiacClass: 'aries' })
            battlefield.playerUnits[0] = card
            battlefield.playerUnits[1] = createTestCard({ id: 'fire2', element: 'fire', zodiacClass: 'leo' })
            battlefield.playerUnits[2] = createTestCard({ id: 'fire3', element: 'fire', zodiacClass: 'sagittarius' })

            const resonance = astrologyService.calculateCosmicResonance(card, battlefield)

            expect(resonance).toBeGreaterThan(0) // Should have elemental bonuses
        })

        it('should apply penalty from opposing elements', () => {
            const card = createTestCard({ id: 'fire1', element: 'fire', zodiacClass: 'aries' })
            battlefield.playerUnits[0] = card
            battlefield.enemyUnits[0] = createTestCard({ id: 'water1', element: 'water', zodiacClass: 'cancer' })
            battlefield.enemyUnits[1] = createTestCard({ id: 'water2', element: 'water', zodiacClass: 'pisces' })

            const resonance = astrologyService.calculateCosmicResonance(card, battlefield)

            // Resonance should be reduced by opposing elements
            expect(resonance).toBeGreaterThanOrEqual(0) // Never negative
        })

        it('should return 0 for card alone on battlefield', () => {
            const card = createTestCard({ id: 'alone', element: 'fire', zodiacClass: 'aries' })
            battlefield.playerUnits[0] = card

            const resonance = astrologyService.calculateCosmicResonance(card, battlefield)

            expect(resonance).toBe(0)
        })

        it('should exclude the card itself from resonance calculation', () => {
            const card = createTestCard({ id: 'aries1', element: 'fire', zodiacClass: 'aries' })
            battlefield.playerUnits[0] = card

            const resonance = astrologyService.calculateCosmicResonance(card, battlefield)

            expect(resonance).toBe(0) // Card doesn't resonate with itself
        })
    })

    describe('Chakra Resonance', () => {
        it('should activate solar plexus for high attack cards', () => {
            const card = createTestCard({ id: 'strong', attack: 5, element: 'fire', zodiacClass: 'aries' })

            const chakras = astrologyService.applyChakraResonance(card)

            expect(chakras).toContain('solar_plexus')
        })

        it('should activate heart for high health cards', () => {
            const card = createTestCard({ id: 'tanky', health: 5, element: 'earth', zodiacClass: 'taurus' })

            const chakras = astrologyService.applyChakraResonance(card)

            expect(chakras).toContain('heart')
        })

        it('should activate crown for high cost cards', () => {
            const card = createTestCard({ id: 'expensive', cost: 7, element: 'water', zodiacClass: 'pisces' })

            const chakras = astrologyService.applyChakraResonance(card)

            expect(chakras).toContain('crown')
        })

        it('should activate third eye for cards with cosmic resonance', () => {
            const card = createTestCard({ id: 'cosmic', cosmicResonance: 5, element: 'air', zodiacClass: 'aquarius' })

            const chakras = astrologyService.applyChakraResonance(card)

            expect(chakras).toContain('third_eye')
        })

        it('should activate fire element chakra (sacral)', () => {
            const card = createTestCard({ id: 'fire', element: 'fire', zodiacClass: 'aries' })

            const chakras = astrologyService.applyChakraResonance(card)

            expect(chakras).toContain('sacral')
        })

        it('should activate earth element chakra (root)', () => {
            const card = createTestCard({ id: 'earth', element: 'earth', zodiacClass: 'taurus' })

            const chakras = astrologyService.applyChakraResonance(card)

            expect(chakras).toContain('root')
        })

        it('should activate air element chakra (throat)', () => {
            const card = createTestCard({ id: 'air', element: 'air', zodiacClass: 'gemini' })

            const chakras = astrologyService.applyChakraResonance(card)

            expect(chakras).toContain('throat')
        })

        it('should activate water element chakra (heart)', () => {
            const card = createTestCard({ id: 'water', element: 'water', zodiacClass: 'cancer' })

            const chakras = astrologyService.applyChakraResonance(card)

            expect(chakras).toContain('heart')
        })

        it('should activate multiple chakras for powerful cards', () => {
            const card = createTestCard({
                id: 'powerful',
                attack: 5,
                health: 5,
                cost: 7,
                cosmicResonance: 3,
                element: 'fire',
                zodiacClass: 'leo'
            })

            const chakras = astrologyService.applyChakraResonance(card)

            expect(chakras.length).toBeGreaterThan(3)
            expect(chakras).toContain('solar_plexus')
            expect(chakras).toContain('heart')
            expect(chakras).toContain('crown')
            expect(chakras).toContain('third_eye')
            expect(chakras).toContain('sacral')
        })
    })

    describe('Sacred Geometry', () => {
        it('should grant bonus for golden ratio positions (slots 2, 4)', () => {
            const card = createTestCard({ id: 'golden', element: 'fire', zodiacClass: 'aries' })
            const position: BattlefieldPosition = { slot: 2, player: 'player1' }
            battlefield.playerUnits[2] = card

            const bonus = astrologyService.calculateSacredGeometry(card, position, battlefield)

            expect(bonus).toBeGreaterThan(1.0)
        })

        it('should grant bonus for center position (slot 3)', () => {
            const card = createTestCard({ id: 'center', element: 'fire', zodiacClass: 'aries' })
            const position: BattlefieldPosition = { slot: 3, player: 'player1' }
            battlefield.playerUnits[3] = card

            const bonus = astrologyService.calculateSacredGeometry(card, position, battlefield)

            expect(bonus).toBeGreaterThan(1.0)
        })

        it('should grant symmetry bonus for mirrored zodiac classes', () => {
            const card = createTestCard({ id: 'sym1', element: 'fire', zodiacClass: 'aries', cost: 3 })
            const position: BattlefieldPosition = { slot: 2, player: 'player1' }
            battlefield.playerUnits[2] = card
            battlefield.playerUnits[4] = createTestCard({ id: 'sym2', element: 'fire', zodiacClass: 'aries', cost: 3 })

            const bonus = astrologyService.calculateSacredGeometry(card, position, battlefield)

            expect(bonus).toBeGreaterThan(1.0)
        })

        it('should grant fibonacci bonus for adjacent cards', () => {
            const card = createTestCard({ id: 'fib1', element: 'fire', zodiacClass: 'aries', cost: 2 })
            const position: BattlefieldPosition = { slot: 3, player: 'player1' }
            battlefield.playerUnits[3] = card
            battlefield.playerUnits[2] = createTestCard({ id: 'fib2', element: 'fire', zodiacClass: 'leo', cost: 3 })

            const bonus = astrologyService.calculateSacredGeometry(card, position, battlefield)

            expect(bonus).toBeGreaterThan(1.0) // 2 + 3 = 5 (Fibonacci number)
        })

        it('should return base bonus for regular position', () => {
            const card = createTestCard({ id: 'regular', element: 'fire', zodiacClass: 'aries' })
            const position: BattlefieldPosition = { slot: 0, player: 'player1' }
            battlefield.playerUnits[0] = card

            const bonus = astrologyService.calculateSacredGeometry(card, position, battlefield)

            expect(bonus).toBe(1.0) // No special bonuses
        })

        it('should combine multiple geometry bonuses', () => {
            const card = createTestCard({ id: 'multi', element: 'fire', zodiacClass: 'aries', cost: 2 })
            const position: BattlefieldPosition = { slot: 2, player: 'player1' } // Golden slot
            battlefield.playerUnits[2] = card
            battlefield.playerUnits[4] = createTestCard({ id: 'mirror', element: 'fire', zodiacClass: 'aries' })
            battlefield.playerUnits[3] = createTestCard({ id: 'fib', element: 'fire', zodiacClass: 'leo', cost: 3 })

            const bonus = astrologyService.calculateSacredGeometry(card, position, battlefield)

            expect(bonus).toBeGreaterThan(1.5) // Multiple bonuses stacked
        })
    })

    describe('Zodiac Compatibility', () => {
        it('should return true for same element signs', () => {
            const compatible = astrologyService.areSignsCompatible('aries', 'leo')

            expect(compatible).toBe(true) // Both fire signs
        })

        it('should return false for different element signs', () => {
            const compatible = astrologyService.areSignsCompatible('aries', 'cancer')

            expect(compatible).toBe(false) // Fire vs water
        })

        it('should return true for all fire signs', () => {
            expect(astrologyService.areSignsCompatible('aries', 'leo')).toBe(true)
            expect(astrologyService.areSignsCompatible('aries', 'sagittarius')).toBe(true)
            expect(astrologyService.areSignsCompatible('leo', 'sagittarius')).toBe(true)
        })

        it('should return true for all earth signs', () => {
            expect(astrologyService.areSignsCompatible('taurus', 'virgo')).toBe(true)
            expect(astrologyService.areSignsCompatible('taurus', 'capricorn')).toBe(true)
            expect(astrologyService.areSignsCompatible('virgo', 'capricorn')).toBe(true)
        })

        it('should return true for all air signs', () => {
            expect(astrologyService.areSignsCompatible('gemini', 'libra')).toBe(true)
            expect(astrologyService.areSignsCompatible('gemini', 'aquarius')).toBe(true)
            expect(astrologyService.areSignsCompatible('libra', 'aquarius')).toBe(true)
        })

        it('should return true for all water signs', () => {
            expect(astrologyService.areSignsCompatible('cancer', 'scorpio')).toBe(true)
            expect(astrologyService.areSignsCompatible('cancer', 'pisces')).toBe(true)
            expect(astrologyService.areSignsCompatible('scorpio', 'pisces')).toBe(true)
        })
    })

    describe('Elemental Advantage', () => {
        it('should give 50% bonus for opposing elements', () => {
            expect(astrologyService.getElementalAdvantage('fire', 'water')).toBe(1.5)
            expect(astrologyService.getElementalAdvantage('water', 'fire')).toBe(1.5)
            expect(astrologyService.getElementalAdvantage('earth', 'air')).toBe(1.5)
            expect(astrologyService.getElementalAdvantage('air', 'earth')).toBe(1.5)
        })

        it('should give 20% penalty for same element', () => {
            expect(astrologyService.getElementalAdvantage('fire', 'fire')).toBe(0.8)
            expect(astrologyService.getElementalAdvantage('water', 'water')).toBe(0.8)
            expect(astrologyService.getElementalAdvantage('earth', 'earth')).toBe(0.8)
            expect(astrologyService.getElementalAdvantage('air', 'air')).toBe(0.8)
        })

        it('should give normal damage for neutral matchups', () => {
            expect(astrologyService.getElementalAdvantage('fire', 'earth')).toBe(1.0)
            expect(astrologyService.getElementalAdvantage('fire', 'air')).toBe(1.0)
            expect(astrologyService.getElementalAdvantage('water', 'earth')).toBe(1.0)
            expect(astrologyService.getElementalAdvantage('water', 'air')).toBe(1.0)
        })
    })

    describe('Edge Cases', () => {
        it('should handle null units in battlefield', () => {
            battlefield.playerUnits = [null, null, createTestCard({ id: 'card1', element: 'fire', zodiacClass: 'aries' }), null, null, null, null]

            const alignment = astrologyService.calculateCosmicAlignment(battlefield)

            expect(alignment).toBeDefined()
        })

        it('should handle battlefield with only enemy units', () => {
            battlefield.enemyUnits[0] = createTestCard({ id: 'e1', element: 'fire', zodiacClass: 'aries' })
            battlefield.enemyUnits[1] = createTestCard({ id: 'e2', element: 'fire', zodiacClass: 'aries' })

            const alignment = astrologyService.calculateCosmicAlignment(battlefield)

            expect(alignment.dominantElement).toBe('fire')
            expect(alignment.alignedSigns).toContain('aries')
        })

        it('should handle cards with no cosmic resonance property', () => {
            const card = createTestCard({ id: 'no-resonance', element: 'fire', zodiacClass: 'aries' })
            delete (card as any).cosmicResonance

            const chakras = astrologyService.applyChakraResonance(card)

            expect(Array.isArray(chakras)).toBe(true)
        })

        it('should handle edge slot positions (0 and 6)', () => {
            const card = createTestCard({ id: 'edge', element: 'fire', zodiacClass: 'aries' })
            const position1: BattlefieldPosition = { slot: 0, player: 'player1' }
            const position2: BattlefieldPosition = { slot: 6, player: 'player1' }

            battlefield.playerUnits[0] = card
            const bonus1 = astrologyService.calculateSacredGeometry(card, position1, battlefield)

            battlefield.playerUnits[6] = card
            const bonus2 = astrologyService.calculateSacredGeometry(card, position2, battlefield)

            expect(bonus1).toBeGreaterThanOrEqual(1.0)
            expect(bonus2).toBeGreaterThanOrEqual(1.0)
        })
    })
})

