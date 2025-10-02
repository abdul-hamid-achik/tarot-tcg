import { GameLogger } from "@/lib/game_logger"
import type { Card, GameState, PlayerId } from '@/schemas/schema'

export interface BattlefieldPosition {
  player: PlayerId
  slot: number // 0-6 slots per player like Hearthstone
}

export interface Battlefield {
  playerUnits: (Card | null)[] // Player 1's units
  enemyUnits: (Card | null)[] // Player 2's units
  maxSlots: number // Usually 7 like Hearthstone
}

export class BattlefieldService {
  private readonly MAX_UNITS = 7

  /**
   * Initialize empty battlefield
   */
  initializeBattlefield(): Battlefield {
    return {
      playerUnits: Array(this.MAX_UNITS).fill(null),
      enemyUnits: Array(this.MAX_UNITS).fill(null),
      maxSlots: this.MAX_UNITS,
    }
  }

  /**
   * Check if a slot is empty
   */
  isSlotEmpty(battlefield: Battlefield, player: PlayerId, slot: number): boolean {
    if (slot < 0 || slot >= this.MAX_UNITS) return false

    const units = player === 'player1' ? battlefield.playerUnits : battlefield.enemyUnits
    return units[slot] === null
  }

  /**
   * Place a unit on the battlefield
   */
  placeUnit(battlefield: Battlefield, card: Card, player: PlayerId, slot: number): Battlefield {
    GameLogger.system(`🎯 [BattlefieldService] Attempting to place ${card.name} for ${player} at slot ${slot}`)
    GameLogger.system(`🎯 [BattlefieldService] Current battlefield state:`, {
      playerUnits: battlefield.playerUnits.filter(u => u !== null).map(u => u?.name),
      enemyUnits: battlefield.enemyUnits.filter(u => u !== null).map(u => u?.name)
    })

    if (!this.isSlotEmpty(battlefield, player, slot)) {
      GameLogger.error(`🎯 [BattlefieldService] Slot ${slot} is occupied for ${player}`)
      throw new Error('Slot is occupied')
    }

    const newBattlefield = {
      ...battlefield,
      playerUnits: [...battlefield.playerUnits],
      enemyUnits: [...battlefield.enemyUnits],
    }

    const units = player === 'player1' ? newBattlefield.playerUnits : newBattlefield.enemyUnits
    units[slot] = card

    GameLogger.system(`🎯 [BattlefieldService] Successfully placed ${card.name} for ${player} at slot ${slot}`)
    GameLogger.system(`🎯 [BattlefieldService] New battlefield state:`, {
      playerUnits: newBattlefield.playerUnits.filter(u => u !== null).map(u => u?.name),
      enemyUnits: newBattlefield.enemyUnits.filter(u => u !== null).map(u => u?.name)
    })

    return newBattlefield
  }

  /**
   * Remove a unit from the battlefield
   */
  removeUnit(battlefield: Battlefield, player: PlayerId, slot: number): Battlefield {
    if (slot < 0 || slot >= this.MAX_UNITS) return battlefield

    const newBattlefield = {
      ...battlefield,
      playerUnits: [...battlefield.playerUnits],
      enemyUnits: [...battlefield.enemyUnits],
    }

    const units = player === 'player1' ? newBattlefield.playerUnits : newBattlefield.enemyUnits
    units[slot] = null

    return newBattlefield
  }

  /**
   * Get unit at specific position
   */
  getUnit(battlefield: Battlefield, player: PlayerId, slot: number): Card | null {
    if (slot < 0 || slot >= this.MAX_UNITS) return null

    const units = player === 'player1' ? battlefield.playerUnits : battlefield.enemyUnits
    return units[slot]
  }

  /**
   * Get all units for a player
   */
  getPlayerUnits(battlefield: Battlefield, player: PlayerId): Card[] {
    const units = player === 'player1' ? battlefield.playerUnits : battlefield.enemyUnits
    return units.filter(unit => unit !== null) as Card[]
  }

  /**
   * Find unit position by card ID
   */
  findUnitPosition(battlefield: Battlefield, cardId: string): BattlefieldPosition | null {
    // Check player units
    for (let i = 0; i < battlefield.playerUnits.length; i++) {
      if (battlefield.playerUnits[i]?.id === cardId) {
        return { player: 'player1', slot: i }
      }
    }

    // Check enemy units
    for (let i = 0; i < battlefield.enemyUnits.length; i++) {
      if (battlefield.enemyUnits[i]?.id === cardId) {
        return { player: 'player2', slot: i }
      }
    }

    return null
  }

  /**
   * Get available slots for a player
   */
  getAvailableSlots(battlefield: Battlefield, player: PlayerId): number[] {
    const units = player === 'player1' ? battlefield.playerUnits : battlefield.enemyUnits
    const available: number[] = []

    for (let i = 0; i < units.length; i++) {
      if (units[i] === null) {
        available.push(i)
      }
    }

    return available
  }

  /**
   * Check if battlefield is full for a player
   */
  isBattlefieldFull(battlefield: Battlefield, player: PlayerId): boolean {
    return this.getAvailableSlots(battlefield, player).length === 0
  }

  /**
   * Get units that can attack (like Hearthstone - summoning sickness, etc.)
   */
  getAttackableUnits(battlefield: Battlefield, player: PlayerId): Card[] {
    return this.getPlayerUnits(battlefield, player).filter(unit =>
      unit.attack > 0 &&
      !unit.hasAttackedThisTurn &&
      !unit.hasSummoningSickness // Units can't attack the turn they're played
    )
  }

  /**
   * Get valid targets for an attack (opponent units + nexus)
   */
  getValidTargets(battlefield: Battlefield, attackingPlayer: PlayerId): {
    units: { card: Card, slot: number }[],
    canAttackNexus: boolean
  } {
    const opponentPlayer = attackingPlayer === 'player1' ? 'player2' : 'player1'
    const opponentUnits = attackingPlayer === 'player1' ? battlefield.enemyUnits : battlefield.playerUnits

    const validUnits: { card: Card, slot: number }[] = []
    for (let i = 0; i < opponentUnits.length; i++) {
      const unit = opponentUnits[i]
      if (unit) {
        validUnits.push({ card: unit, slot: i })
      }
    }

    // In most card games, you can attack nexus directly if no taunts
    const hasTaunt = validUnits.some(({ card }) => card.keywords?.includes('taunt'))

    return {
      units: validUnits,
      canAttackNexus: !hasTaunt || validUnits.length === 0
    }
  }

  /**
   * Compact units (remove gaps) - like when units die in Hearthstone
   */
  compactUnits(battlefield: Battlefield, player: PlayerId): Battlefield {
    const units = player === 'player1' ? battlefield.playerUnits : battlefield.enemyUnits
    const compacted = units.filter(unit => unit !== null)

    // Fill remaining slots with null
    while (compacted.length < this.MAX_UNITS) {
      compacted.push(null as any) // Type assertion for nullable Card
    }

    const newBattlefield = {
      ...battlefield,
      playerUnits: [...battlefield.playerUnits],
      enemyUnits: [...battlefield.enemyUnits],
    }

    if (player === 'player1') {
      newBattlefield.playerUnits = compacted
    } else {
      newBattlefield.enemyUnits = compacted
    }

    return newBattlefield
  }

  /**
   * Clear summoning sickness at start of turn
   */
  clearSummoningSickness(battlefield: Battlefield, player: PlayerId): Battlefield {
    const newBattlefield = {
      ...battlefield,
      playerUnits: [...battlefield.playerUnits],
      enemyUnits: [...battlefield.enemyUnits],
    }

    const units = player === 'player1' ? newBattlefield.playerUnits : newBattlefield.enemyUnits

    for (let i = 0; i < units.length; i++) {
      if (units[i]) {
        units[i] = {
          ...units[i]!,
          hasSummoningSickness: false,
          hasAttackedThisTurn: false
        }
      }
    }

    return newBattlefield
  }

  /**
   * Apply end of turn effects
   */
  applyEndOfTurnEffects(battlefield: Battlefield, player: PlayerId): Battlefield {
    // Reset attack flags, apply ongoing effects, etc.
    const newBattlefield = {
      ...battlefield,
      playerUnits: [...battlefield.playerUnits],
      enemyUnits: [...battlefield.enemyUnits],
    }

    const units = player === 'player1' ? newBattlefield.playerUnits : newBattlefield.enemyUnits

    for (let i = 0; i < units.length; i++) {
      if (units[i]) {
        units[i] = {
          ...units[i]!,
          hasAttackedThisTurn: false
        }
      }
    }

    return newBattlefield
  }
}

export const battlefieldService = new BattlefieldService()