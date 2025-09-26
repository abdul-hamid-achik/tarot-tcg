'use client'

import type { Card as GameCard } from '@/schemas/schema'
import type { BattlefieldPosition, Battlefield } from '@/services/battlefield_service'
import { GameLogger } from '@/lib/game_logger'

export type ZodiacElement = 'fire' | 'earth' | 'air' | 'water'
export type ZodiacClass = 'aries' | 'taurus' | 'gemini' | 'cancer' | 'leo' | 'virgo' |
                         'libra' | 'scorpio' | 'sagittarius' | 'capricorn' | 'aquarius' | 'pisces'

export interface CosmicAlignment {
  dominantElement: ZodiacElement
  alignedSigns: ZodiacClass[]
  resonanceStrength: number
  activePhase: 'new_moon' | 'waxing' | 'full_moon' | 'waning'
}

export interface AstrologyBonus {
  cardId: string
  bonusType: 'attack' | 'health' | 'cost_reduction' | 'special_ability'
  value: number
  source: 'cosmic_alignment' | 'zodiac_synergy' | 'elemental_dominance'
}

class AstrologyService {
  // Use static GameLogger methods instead of instance
  private currentAlignment: CosmicAlignment = {
    dominantElement: 'fire',
    alignedSigns: [],
    resonanceStrength: 0,
    activePhase: 'new_moon'
  }

  // Zodiac sign to element mapping
  private readonly zodiacElements: Record<ZodiacClass, ZodiacElement> = {
    aries: 'fire',
    leo: 'fire',
    sagittarius: 'fire',
    taurus: 'earth',
    virgo: 'earth',
    capricorn: 'earth',
    gemini: 'air',
    libra: 'air',
    aquarius: 'air',
    cancer: 'water',
    scorpio: 'water',
    pisces: 'water'
  }

  // Element oppositions for conflicts
  private readonly elementOpposites: Record<ZodiacElement, ZodiacElement> = {
    fire: 'water',
    water: 'fire',
    earth: 'air',
    air: 'earth'
  }

  /**
   * Calculate cosmic alignment based on cards on battlefield
   */
  calculateCosmicAlignment(battlefield: Battlefield): CosmicAlignment {
    const allCards: GameCard[] = []

    // Collect all cards from battlefield
    for (const unit of battlefield.playerUnits) {
      if (unit) allCards.push(unit)
    }
    for (const unit of battlefield.enemyUnits) {
      if (unit) allCards.push(unit)
    }

    // Count zodiac signs and elements
    const signCounts: Record<ZodiacClass, number> = {} as Record<ZodiacClass, number>
    const elementCounts: Record<ZodiacElement, number> = {} as Record<ZodiacElement, number>

    for (const card of allCards) {
      signCounts[card.zodiacClass] = (signCounts[card.zodiacClass] || 0) + 1
      elementCounts[card.element] = (elementCounts[card.element] || 0) + 1
    }

    // Find dominant element
    let dominantElement: ZodiacElement = 'fire'
    let maxCount = 0
    for (const [element, count] of Object.entries(elementCounts)) {
      if (count > maxCount) {
        maxCount = count
        dominantElement = element as ZodiacElement
      }
    }

    // Find aligned signs (signs with 2+ cards)
    const alignedSigns = Object.entries(signCounts)
      .filter(([_, count]) => count >= 2)
      .map(([sign, _]) => sign as ZodiacClass)

    // Calculate resonance strength
    const resonanceStrength = alignedSigns.length + Math.floor(maxCount / 2)

    this.currentAlignment = {
      dominantElement,
      alignedSigns,
      resonanceStrength,
      activePhase: this.calculateLunarPhase()
    }

    GameLogger.state('Cosmic alignment calculated:', this.currentAlignment)
    return this.currentAlignment
  }

  /**
   * Get astrology bonuses for a specific card
   */
  getAstrologyBonuses(card: GameCard, battlefield: Battlefield): AstrologyBonus[] {
    const bonuses: AstrologyBonus[] = []
    const alignment = this.calculateCosmicAlignment(battlefield)

    // Zodiac synergy bonus
    if (alignment.alignedSigns.includes(card.zodiacClass)) {
      bonuses.push({
        cardId: card.id,
        bonusType: 'attack',
        value: 1,
        source: 'zodiac_synergy'
      })
    }

    // Elemental dominance bonus
    if (alignment.dominantElement === card.element) {
      bonuses.push({
        cardId: card.id,
        bonusType: 'health',
        value: 1,
        source: 'elemental_dominance'
      })
    }

    // Cosmic alignment bonus for high resonance
    if (alignment.resonanceStrength >= 3 && alignment.alignedSigns.includes(card.zodiacClass)) {
      bonuses.push({
        cardId: card.id,
        bonusType: 'special_ability',
        value: 1,
        source: 'cosmic_alignment'
      })
    }

    // Lunar phase bonuses
    if (alignment.activePhase === 'full_moon') {
      // All cards get small bonus during full moon
      bonuses.push({
        cardId: card.id,
        bonusType: 'attack',
        value: 1,
        source: 'cosmic_alignment'
      })
    }

    return bonuses
  }

  /**
   * Calculate cosmic resonance for a card based on battlefield state
   */
  calculateCosmicResonance(card: GameCard, battlefield: Battlefield): number {
    let resonance = 0
    const allUnits = [...battlefield.playerUnits, ...battlefield.enemyUnits].filter(Boolean) as GameCard[]

    // Count cards of same zodiac class
    const sameZodiacCount = allUnits.filter(unit =>
      unit.id !== card.id && unit.zodiacClass === card.zodiacClass
    ).length

    // Count cards of same element
    const sameElementCount = allUnits.filter(unit =>
      unit.id !== card.id && unit.element === card.element
    ).length

    // Base resonance from zodiac matches
    resonance += sameZodiacCount * 2

    // Bonus from elemental matches
    resonance += sameElementCount

    // Bonus if this card completes a zodiac trinity (3 cards of same class)
    if (sameZodiacCount >= 2) {
      resonance += 3
    }

    // Penalty from opposing elements
    const opposingElementCount = allUnits.filter(unit =>
      this.elementOpposites[card.element] === unit.element
    ).length
    resonance -= opposingElementCount

    return Math.max(0, resonance)
  }

  /**
   * Apply chakra resonance effects to a card
   */
  applyChakraResonance(card: GameCard): string[] {
    const activeChakras: string[] = []

    // Determine active chakras based on card properties
    if (card.attack >= 3) activeChakras.push('solar_plexus') // Power chakra
    if (card.health >= 3) activeChakras.push('heart') // Vitality chakra
    if (card.cost >= 4) activeChakras.push('crown') // Wisdom chakra
    if (card.cosmicResonance && card.cosmicResonance > 0) activeChakras.push('third_eye') // Intuition chakra

    // Element-based chakras
    switch (card.element) {
      case 'fire':
        activeChakras.push('sacral')
        break
      case 'earth':
        activeChakras.push('root')
        break
      case 'air':
        activeChakras.push('throat')
        break
      case 'water':
        activeChakras.push('heart')
        break
    }

    return activeChakras
  }

  /**
   * Calculate sacred geometry bonus based on battlefield position
   */
  calculateSacredGeometry(card: GameCard, position: BattlefieldPosition, battlefield: Battlefield): number {
    let geometryBonus = 1.0

    // Golden ratio positioning (slots 2 and 4 are "golden" positions)
    const goldenSlots = [2, 4]
    if (goldenSlots.includes(position.slot)) {
      geometryBonus += 0.3
    }

    // Center positioning bonus (slot 3)
    if (position.slot === 3) {
      geometryBonus += 0.2
    }

    // Symmetry bonus - if cards are mirrored
    const oppositeSlot = 6 - position.slot
    const units = position.player === 'player1' ? battlefield.playerUnits : battlefield.enemyUnits
    const oppositeCard = units[oppositeSlot]

    if (oppositeCard && oppositeCard.zodiacClass === card.zodiacClass) {
      geometryBonus += 0.5 // Symmetry creates harmony
    }

    // Fibonacci sequence bonus for adjacent cards
    const adjacentSlots = [position.slot - 1, position.slot + 1].filter(slot => slot >= 0 && slot < 7)
    const adjacentCards = adjacentSlots
      .map(slot => units[slot])
      .filter(Boolean) as GameCard[]

    for (const adjacentCard of adjacentCards) {
      if (this.isFibonacciPair(card.cost, adjacentCard.cost)) {
        geometryBonus += 0.2
      }
    }

    return geometryBonus
  }

  /**
   * Check if two numbers form a Fibonacci pair
   */
  private isFibonacciPair(a: number, b: number): boolean {
    const fibSequence = [0, 1, 1, 2, 3, 5, 8, 13]
    const sum = a + b
    return fibSequence.includes(sum)
  }

  /**
   * Calculate current lunar phase (simplified)
   */
  private calculateLunarPhase(): 'new_moon' | 'waxing' | 'full_moon' | 'waning' {
    // Simple cycle based on game turn or time
    const cycle = Math.floor(Date.now() / (1000 * 60 * 2)) % 4 // 2-minute cycles
    const phases: ('new_moon' | 'waxing' | 'full_moon' | 'waning')[] = ['new_moon', 'waxing', 'full_moon', 'waning']
    return phases[cycle]
  }

  /**
   * Get current cosmic alignment
   */
  getCurrentAlignment(): CosmicAlignment {
    return this.currentAlignment
  }

  /**
   * Check if two zodiac signs are compatible
   */
  areSignsCompatible(sign1: ZodiacClass, sign2: ZodiacClass): boolean {
    // Signs of the same element are compatible
    return this.zodiacElements[sign1] === this.zodiacElements[sign2]
  }

  /**
   * Get elemental strength against another element
   */
  getElementalAdvantage(attacker: ZodiacElement, defender: ZodiacElement): number {
    if (this.elementOpposites[attacker] === defender) {
      return 1.5 // 50% bonus damage
    }
    if (attacker === defender) {
      return 0.8 // 20% reduced damage (resistance)
    }
    return 1.0 // Normal damage
  }
}

export const astrologyService = new AstrologyService()