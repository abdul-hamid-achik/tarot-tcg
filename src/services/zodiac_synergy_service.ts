import type { Card, Element, GameState, PlayerId } from '@/schemas/schema'

// ================================
// TYPES
// ================================

export interface ElementBonus {
  attack: number
  health: number
  description: string
}

export interface ElementSynergy {
  element: Element
  unitCount: number
  bonus: ElementBonus
}

export interface SpecialBonus {
  element: Element
  type: 'fire_burn' | 'water_heal' | 'earth_fortify' | 'air_draw'
  description: string
  value: number
}

export interface SynergyResult {
  synergies: ElementSynergy[]
  specialBonuses: SpecialBonus[]
}

// ================================
// CONSTANTS
// ================================

const ELEMENT_COLORS: Record<Element, string> = {
  fire: 'red',
  water: 'blue',
  earth: 'green',
  air: 'purple',
}

// ================================
// CORE SYNERGY CALCULATIONS
// ================================

/**
 * Get all units on a player's side of the battlefield.
 * Pure function - no side effects.
 */
function getPlayerBattlefieldUnits(gameState: GameState, playerId: PlayerId): Card[] {
  const units =
    playerId === 'player1' ? gameState.battlefield.playerUnits : gameState.battlefield.enemyUnits
  return units.filter((u): u is Card => u !== null)
}

/**
 * Count units by element on a player's battlefield.
 * Returns a map of element -> count.
 */
export function countUnitsByElement(
  gameState: GameState,
  playerId: PlayerId,
): Record<string, number> {
  const units = getPlayerBattlefieldUnits(gameState, playerId)
  const counts: Record<string, number> = {}

  for (const unit of units) {
    if (unit.element) {
      counts[unit.element] = (counts[unit.element] || 0) + 1
    }
  }

  return counts
}

/**
 * Calculate the element bonus for a given unit count.
 * - 2 units: +1 attack
 * - 3 units: +1/+1
 * - 4+ units: +2/+1 + special bonus
 */
export function getElementBonus(unitCount: number): ElementBonus | null {
  if (unitCount < 2) return null

  if (unitCount === 2) {
    return {
      attack: 1,
      health: 0,
      description: 'Minor synergy: +1 attack',
    }
  }

  if (unitCount === 3) {
    return {
      attack: 1,
      health: 1,
      description: 'Strong synergy: +1/+1',
    }
  }

  // 4+
  return {
    attack: 2,
    health: 1,
    description: 'Dominant synergy: +2/+1 + special bonus',
  }
}

/**
 * Get the special bonus for an element at 4+ units.
 */
export function getSpecialBonus(element: Element, unitCount: number): SpecialBonus | null {
  if (unitCount < 4) return null

  switch (element) {
    case 'fire':
      return {
        element: 'fire',
        type: 'fire_burn',
        description: 'Deal 1 damage to a random enemy unit at start of turn',
        value: 1,
      }
    case 'water':
      return {
        element: 'water',
        type: 'water_heal',
        description: 'Heal your nexus for 1 at start of turn',
        value: 1,
      }
    case 'earth':
      return {
        element: 'earth',
        type: 'earth_fortify',
        description: 'Earth units gain +0/+1 extra durability',
        value: 1,
      }
    case 'air':
      return {
        element: 'air',
        type: 'air_draw',
        description: 'Draw an extra card every other turn',
        value: 1,
      }
    default:
      return null
  }
}

/**
 * Calculate all active synergies for a player.
 * This is the main entry point for the synergy system.
 *
 * Returns an array of active ElementSynergy objects and any special bonuses.
 */
export function calculateActiveSynergies(gameState: GameState, playerId: PlayerId): SynergyResult {
  const elementCounts = countUnitsByElement(gameState, playerId)
  const synergies: ElementSynergy[] = []
  const specialBonuses: SpecialBonus[] = []

  for (const [element, count] of Object.entries(elementCounts)) {
    const bonus = getElementBonus(count)
    if (bonus) {
      synergies.push({
        element: element as Element,
        unitCount: count,
        bonus,
      })
    }

    const special = getSpecialBonus(element as Element, count)
    if (special) {
      specialBonuses.push(special)
    }
  }

  return { synergies, specialBonuses }
}

/**
 * Get the synergy attack bonus for a specific card based on its element.
 * Used by combat service to apply synergy modifiers.
 */
export function getSynergyAttackBonus(
  gameState: GameState,
  playerId: PlayerId,
  card: Card,
): number {
  if (!card.element) return 0

  const elementCounts = countUnitsByElement(gameState, playerId)
  const count = elementCounts[card.element] || 0
  const bonus = getElementBonus(count)

  if (!bonus) return 0

  const totalAttack = bonus.attack

  return totalAttack
}

/**
 * Get the synergy health bonus for a specific card based on its element.
 * Used by combat service to apply synergy modifiers.
 */
export function getSynergyHealthBonus(
  gameState: GameState,
  playerId: PlayerId,
  card: Card,
): number {
  if (!card.element) return 0

  const elementCounts = countUnitsByElement(gameState, playerId)
  const count = elementCounts[card.element] || 0
  const bonus = getElementBonus(count)

  if (!bonus) return 0

  let totalHealth = bonus.health

  // Earth special bonus at 4+ gives an extra +0/+1
  if (card.element === 'earth' && count >= 4) {
    totalHealth += 1
  }

  return totalHealth
}

/**
 * Get the element color for display purposes.
 */
export function getElementColor(element: Element): string {
  return ELEMENT_COLORS[element] || 'gray'
}

/**
 * Get synergy tier label for display.
 */
export function getSynergyTier(unitCount: number): string | null {
  if (unitCount < 2) return null
  if (unitCount === 2) return 'Minor'
  if (unitCount === 3) return 'Strong'
  return 'Dominant'
}
