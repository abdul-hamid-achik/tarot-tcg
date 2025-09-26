'use client'

import { GameLogger } from '@/lib/game_logger'
import type { Card as GameCard, GameState } from '@/schemas/schema'
import type { Battlefield, BattlefieldPosition } from '@/services/battlefield_service'
import { battlefieldService } from '@/services/battlefield_service'
import { animationService } from './animation_service'

// Event system for triggered abilities
export type GameEvent =
  | 'card_played'
  | 'card_summoned'
  | 'card_attacks'
  | 'card_defends'
  | 'card_takes_damage'
  | 'card_dies'
  | 'card_reversed'
  | 'card_uprighted'
  | 'combat_begins'
  | 'combat_ends'
  | 'turn_begins'
  | 'turn_ends'

export interface TriggeredAbility {
  id: string
  cardId: string
  trigger: GameEvent
  condition?: (context: GameEventContext) => boolean
  effect: (context: GameEventContext) => GameState
  description: string
}

export interface GameEventContext {
  event: GameEvent
  gameState: GameState
  triggerCard?: GameCard
  targetCard?: GameCard
  damage?: number
  player?: 'player1' | 'player2'
  position?: BattlefieldPosition
  [key: string]: unknown
}

export interface PersistentEffect {
  id: string
  sourceCardId: string
  type: 'stat_modifier' | 'keyword_grant' | 'cost_modifier' | 'rule_change'
  duration: 'permanent' | 'end_of_turn' | 'while_on_battlefield' | 'until_combat_ends'
  turnsRemaining?: number
  targets: 'self' | 'all_friendly' | 'all_enemy' | 'all_cards' | 'specific_card'
  targetCardId?: string
  effect: {
    attackModifier?: number
    healthModifier?: number
    costModifier?: number
    grantsKeywords?: CardKeyword[]
    removesKeywords?: CardKeyword[]
    customRule?: string
  }
  description: string
}

export type CardKeyword =
  | 'charge' // Can attack immediately (no summoning sickness)
  | 'taunt' // Must be attacked first
  | 'divine_shield' // Negates first damage
  | 'windfury' // Can attack twice
  | 'stealth' // Can't be targeted until it attacks
  | 'lifesteal' // Damage dealt heals player
  | 'poisonous' // Any damage kills the target
  | 'rush' // Can attack units immediately (not nexus)
  | 'ethereal' // Disappears at end of turn
  | 'spell_damage' // Increases spell damage
  | 'deathrattle' // Effect when card dies
  | 'battlecry' // Effect when card is played
  // Esoteric/Tarot-themed keywords
  | 'mystical_ward' // Cannot be targeted by spells
  | 'veil_of_illusion' // Cannot be targeted until it attacks (enhanced stealth)
  | 'cosmic_alignment' // Gains power based on zodiac matches on field
  | 'tarot_mastery' // Can be reversed for different effects
  | 'astral_projection' // Can attack regardless of summoning sickness
  | 'chakra_flow' // Gains energy each turn
  | 'sacred_geometry' // Power scales with board position
  | 'lunar_blessing' // Stronger during certain game phases
  | 'solar_radiance' // Damages adjacent enemies when attacking
  | 'elemental_fury' // Double damage against opposing elements

export interface AttackResult {
  attacker: GameCard
  target: GameCard | 'nexus'
  attackerDamage: number
  targetDamage: number
  attackerSurvived: boolean
  targetSurvived: boolean
  nexusDamage: number
  triggeredEffects: string[]
}

export interface CombatResolution {
  results: AttackResult[]
  totalNexusDamage: number
  survivingUnits: GameCard[]
  deadUnits: GameCard[]
  gameEnded: boolean
  winner?: 'player1' | 'player2'
}

export interface CombatModifiers {
  attackBonus?: number
  defenseBonus?: number
  damageReduction?: number
  cannotBeTargeted?: boolean
  mustBeTargeted?: boolean
}

class CombatService {
  private triggeredAbilities: Map<string, TriggeredAbility> = new Map()
  private persistentEffects: Map<string, PersistentEffect> = new Map()

  /**
   * Process a direct attack (unit attacking nexus or another unit)
   */
  async processAttack(
    battlefield: Battlefield,
    attackerPosition: BattlefieldPosition,
    target: BattlefieldPosition | 'nexus',
    gameState: GameState
  ): Promise<AttackResult> {
    GameLogger.combat(`Processing attack from ${JSON.stringify(attackerPosition)} to ${target}`)

    const attacker = battlefieldService.getUnit(battlefield, attackerPosition.player, attackerPosition.slot)
    if (!attacker) {
      throw new Error('No attacker found at position')
    }

    // Apply combat modifiers
    const attackerModifiers = this.getCardModifiers(attacker)
    const attackPower = attacker.attack + (attackerModifiers.attackBonus || 0)

    let result: AttackResult
    const triggeredEffects: string[] = []

    if (target === 'nexus') {
      // Direct nexus attack
      result = {
        attacker,
        target: 'nexus',
        attackerDamage: 0,
        targetDamage: 0,
        attackerSurvived: true,
        targetSurvived: true,
        nexusDamage: attackPower,
        triggeredEffects
      }

      // Animate attack
      await animationService.animateAttackToNexus(attackerPosition)
      await animationService.animateNexusDamage(attackPower)

    } else {
      // Unit vs Unit combat
      const targetUnit = battlefieldService.getUnit(battlefield, target.player, target.slot)
      if (!targetUnit) {
        throw new Error('No target unit found at position')
      }

      const targetModifiers = this.getCardModifiers(targetUnit)
      const targetPower = targetUnit.attack + (targetModifiers.attackBonus || 0)

      let attackerDamage = Math.max(0, targetPower - (attackerModifiers.damageReduction || 0))
      let targetDamage = Math.max(0, attackPower - (targetModifiers.damageReduction || 0))

      // Handle special keywords
      if (this.hasKeyword(targetUnit, 'divine_shield') && targetDamage > 0) {
        targetDamage = 0
        // Remove divine shield
        targetUnit.divineShield = false
      }

      if (this.hasKeyword(targetUnit, 'poisonous') && attackerDamage > 0) {
        attackerDamage = attacker.health // Instant kill
      }

      if (this.hasKeyword(attacker, 'poisonous') && targetDamage > 0) {
        targetDamage = targetUnit.health // Instant kill
      }

      // Handle elemental fury - double damage against opposing elements
      if (this.hasKeyword(attacker, 'elemental_fury')) {
        const opposingElements = {
          fire: 'water',
          water: 'fire',
          earth: 'air',
          air: 'earth'
        }
        if (opposingElements[attacker.element] === targetUnit.element) {
          targetDamage *= 2
        }
      }

      // Handle solar radiance - damage adjacent enemies
      if (this.hasKeyword(attacker, 'solar_radiance') && targetDamage > 0) {
        // This would require battlefield context to damage adjacent units
        // For now, just mark the effect occurred
        triggeredEffects.push('solar_radiance')
      }

      // Handle lifesteal
      let nexusDamage = 0
      if (this.hasKeyword(attacker, 'lifesteal') && targetDamage > 0) {
        // Heal attacking player
        nexusDamage = -targetDamage // Negative damage = healing
      }

      const attackerSurvived = attacker.currentHealth && attacker.currentHealth > attackerDamage
      const targetSurvived = targetUnit.currentHealth && targetUnit.currentHealth > targetDamage

      result = {
        attacker,
        target: targetUnit,
        attackerDamage,
        targetDamage,
        attackerSurvived: attackerSurvived || false,
        targetSurvived: targetSurvived || false,
        nexusDamage,
        triggeredEffects
      }

      // Animate combat
      await animationService.animateUnitCombat(attackerPosition, target)
      if (targetDamage > 0) {
        await animationService.animateUnitDamage(target, targetDamage)
      }
      if (attackerDamage > 0) {
        await animationService.animateUnitDamage(attackerPosition, attackerDamage)
      }
    }

    // Mark attacker as having attacked
    attacker.hasAttackedThisTurn = true

    return result
  }

  /**
   * Check if a card has a specific keyword
   */
  private hasKeyword(card: GameCard, keyword: CardKeyword): boolean {
    // Check base keywords
    if (card.keywords?.includes(keyword)) return true

    // Check granted keywords from effects
    for (const effect of this.persistentEffects.values()) {
      if (
        effect.effect.grantsKeywords?.includes(keyword) &&
        this.isEffectApplicable(effect, card.id)
      ) {
        return true
      }
    }

    return false
  }

  /**
   * Get all modifiers affecting a card
   */
  private getCardModifiers(card: GameCard): CombatModifiers {
    const modifiers: CombatModifiers = {
      attackBonus: 0,
      defenseBonus: 0,
      damageReduction: 0,
    }

    // Apply persistent effects
    for (const effect of this.persistentEffects.values()) {
      if (this.isEffectApplicable(effect, card.id)) {
        modifiers.attackBonus = (modifiers.attackBonus || 0) + (effect.effect.attackModifier || 0)
        modifiers.defenseBonus = (modifiers.defenseBonus || 0) + (effect.effect.healthModifier || 0)
      }
    }

    // Apply tarot-specific modifiers
    if (card.isReversed) {
      // Reversed cards might have different effects
      modifiers.attackBonus = (modifiers.attackBonus || 0) - 1
      modifiers.defenseBonus = (modifiers.defenseBonus || 0) + 1
    }

    // Cosmic resonance bonus
    if (card.cosmicResonance && card.cosmicResonance > 0) {
      modifiers.attackBonus = (modifiers.attackBonus || 0) + Math.floor(card.cosmicResonance / 2)
    }

    // Astrology bonus based on zodiac alignment
    if (card.astrologyBonus && card.astrologyBonus > 0) {
      modifiers.attackBonus = (modifiers.attackBonus || 0) + card.astrologyBonus
    }

    // Tarot power amplification
    if (card.tarotPower && card.tarotPower >= 3) {
      const powerMultiplier = Math.floor(card.tarotPower / 3)
      modifiers.attackBonus = (modifiers.attackBonus || 0) + powerMultiplier
      modifiers.defenseBonus = (modifiers.defenseBonus || 0) + powerMultiplier
    }

    // Sacred geometry bonus
    if (card.sacredGeometry && card.sacredGeometry > 1) {
      const geometryBonus = Math.floor(card.attack * (card.sacredGeometry - 1))
      modifiers.attackBonus = (modifiers.attackBonus || 0) + geometryBonus
    }

    // Chakra resonance effects
    if (card.chakraResonance && card.chakraResonance.length > 0) {
      // Each active chakra provides small bonuses
      const chakraBonus = card.chakraResonance.length
      modifiers.attackBonus = (modifiers.attackBonus || 0) + Math.floor(chakraBonus / 2)
      modifiers.defenseBonus = (modifiers.defenseBonus || 0) + Math.floor(chakraBonus / 3)
    }

    return modifiers
  }

  /**
   * Check if an effect applies to a specific card
   */
  private isEffectApplicable(effect: PersistentEffect, cardId: string): boolean {
    switch (effect.targets) {
      case 'self':
        return effect.sourceCardId === cardId
      case 'specific_card':
        return effect.targetCardId === cardId
      case 'all_cards':
        return true
      // Add more targeting logic as needed
      default:
        return false
    }
  }

  /**
   * Check valid attack targets for a unit
   */
  getValidTargets(
    battlefield: Battlefield,
    attackerPosition: BattlefieldPosition
  ): {
    units: BattlefieldPosition[]
    canAttackNexus: boolean
  } {
    const attacker = battlefieldService.getUnit(battlefield, attackerPosition.player, attackerPosition.slot)
    if (!attacker) return { units: [], canAttackNexus: false }

    const opponentPlayer = attackerPosition.player === 'player1' ? 'player2' : 'player1'
    const opponentUnits = opponentPlayer === 'player2' ? battlefield.enemyUnits : battlefield.playerUnits

    const validUnits: BattlefieldPosition[] = []
    let hasTaunt = false
    let hasVeilOfIllusion = false

    // Find all opponent units and check for special targeting rules
    for (let i = 0; i < opponentUnits.length; i++) {
      const unit = opponentUnits[i]
      if (unit) {
        // Check if unit can be targeted
        let canTarget = true

        // Veil of Illusion (enhanced stealth) - cannot be targeted until it attacks
        if (this.hasKeyword(unit, 'veil_of_illusion') && !unit.hasAttackedThisTurn) {
          canTarget = false
          hasVeilOfIllusion = true
        }

        // Regular stealth - cannot be targeted until it attacks
        if (this.hasKeyword(unit, 'stealth') && !unit.hasAttackedThisTurn) {
          canTarget = false
        }

        if (canTarget) {
          validUnits.push({ player: opponentPlayer, slot: i })

          if (this.hasKeyword(unit, 'taunt')) {
            hasTaunt = true
          }
        }
      }
    }

    // If there are taunt units, only they can be targeted
    if (hasTaunt) {
      const tauntUnits = validUnits.filter(pos => {
        const unit = battlefieldService.getUnit(battlefield, pos.player, pos.slot)
        return unit && this.hasKeyword(unit, 'taunt')
      })
      return {
        units: tauntUnits,
        canAttackNexus: false
      }
    }

    // Can attack nexus if no taunt units and attacker doesn't have rush
    const canAttackNexus = !hasTaunt && !this.hasKeyword(attacker, 'rush')

    return {
      units: validUnits,
      canAttackNexus
    }
  }

  /**
   * Register a triggered ability
   */
  registerTriggeredAbility(ability: TriggeredAbility): void {
    this.triggeredAbilities.set(ability.id, ability)
    GameLogger.action(`Registered triggered ability: ${ability.id}`)
  }

  /**
   * Register a persistent effect
   */
  registerPersistentEffect(effect: PersistentEffect): void {
    this.persistentEffects.set(effect.id, effect)
    GameLogger.action(`Registered persistent effect: ${effect.id}`)
  }

  /**
   * Remove a persistent effect
   */
  removePersistentEffect(effectId: string): void {
    this.persistentEffects.delete(effectId)
    GameLogger.action(`Removed persistent effect: ${effectId}`)
  }

  /**
   * Trigger all abilities for a game event
   */
  async triggerEvent(
    event: GameEvent,
    context: Partial<GameEventContext>
  ): Promise<GameState> {
    const fullContext: GameEventContext = {
      event,
      gameState: context.gameState!,
      ...context,
    }

    let updatedState = fullContext.gameState

    for (const ability of this.triggeredAbilities.values()) {
      if (
        ability.trigger === event &&
        (!ability.condition || ability.condition(fullContext))
      ) {
        GameLogger.action(`Triggering ability: ${ability.id}`)
        updatedState = ability.effect({ ...fullContext, gameState: updatedState })
      }
    }

    return updatedState
  }

  /**
   * Clean up effects at end of turn
   */
  cleanupEndOfTurn(): void {
    const toRemove: string[] = []

    for (const [id, effect] of this.persistentEffects.entries()) {
      if (effect.duration === 'end_of_turn') {
        toRemove.push(id)
      } else if (effect.turnsRemaining !== undefined) {
        effect.turnsRemaining--
        if (effect.turnsRemaining <= 0) {
          toRemove.push(id)
        }
      }
    }

    toRemove.forEach(id => this.removePersistentEffect(id))
    GameLogger.action(`Cleaned up end-of-turn effects: ${toRemove.length}`)
  }

  /**
   * Reset all combat-related effects
   */
  resetCombat(): void {
    const toRemove: string[] = []

    for (const [id, effect] of this.persistentEffects.entries()) {
      if (effect.duration === 'until_combat_ends') {
        toRemove.push(id)
      }
    }

    toRemove.forEach(id => this.removePersistentEffect(id))
    GameLogger.action('Reset combat effects')
  }
}

export const combatService = new CombatService()