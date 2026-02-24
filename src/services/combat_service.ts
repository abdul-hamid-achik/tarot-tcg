'use client'

import { produce } from 'immer'
import { GameLogger } from '@/lib/game_logger'
import type {
  DirectAttack,
  Card as GameCard,
  GameState,
  PlayerId,
  Battlefield as SchemaBattlefield,
} from '@/schemas/schema'
import type { Battlefield, BattlefieldPosition } from '@/services/battlefield_service'
import { battlefieldService } from '@/services/battlefield_service'
import { getSynergyAttackBonus, getSynergyHealthBonus } from '@/services/zodiac_synergy_service'
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
    _gameState: GameState,
  ): Promise<AttackResult> {
    GameLogger.combat(`Processing attack from ${JSON.stringify(attackerPosition)} to ${target}`)

    const attacker = battlefieldService.getUnit(
      battlefield,
      attackerPosition.player,
      attackerPosition.slot,
    )
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
        triggeredEffects,
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
        const opposingElements: Record<string, string> = {
          fire: 'water',
          water: 'fire',
          earth: 'air',
          air: 'earth',
        }
        const opposing = attacker.element ? opposingElements[attacker.element] : undefined
        if (opposing && opposing === targetUnit.element) {
          targetDamage *= 2
        }
      }

      // Handle solar radiance - damage adjacent enemies when attacking
      if (this.hasKeyword(attacker, 'solar_radiance') && targetDamage > 0) {
        const solarDamage = Math.ceil(targetDamage / 2) // Adjacent units take half damage
        const targetUnits =
          target.player === 'player1' ? battlefield.playerUnits : battlefield.enemyUnits

        // Damage units adjacent to the target (slots target.slot-1 and target.slot+1)
        for (const adjacentSlot of [target.slot - 1, target.slot + 1]) {
          if (adjacentSlot >= 0 && adjacentSlot < targetUnits.length) {
            const adjacentUnit = targetUnits[adjacentSlot]
            if (adjacentUnit) {
              const adjHealth = adjacentUnit.currentHealth || adjacentUnit.health
              adjacentUnit.currentHealth = adjHealth - solarDamage
              triggeredEffects.push(`solar_radiance:${adjacentUnit.name}:${solarDamage}`)
              GameLogger.combat(
                `Solar Radiance deals ${solarDamage} to adjacent ${adjacentUnit.name}`,
              )
            }
          }
        }
      }

      // Handle lifesteal
      let nexusDamage = 0
      if (this.hasKeyword(attacker, 'lifesteal') && targetDamage > 0) {
        // Heal attacking player
        nexusDamage = -targetDamage // Negative damage = healing
      }

      const attackerSurvived = (attacker.currentHealth ?? attacker.health) > attackerDamage
      const targetSurvived = (targetUnit.currentHealth ?? targetUnit.health) > targetDamage

      result = {
        attacker,
        target: targetUnit,
        attackerDamage,
        targetDamage,
        attackerSurvived: attackerSurvived || false,
        targetSurvived: targetSurvived || false,
        nexusDamage,
        triggeredEffects,
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
   * Get all modifiers affecting a card.
   * When gameState and playerId are provided, element synergy bonuses are included.
   */
  private getCardModifiers(
    card: GameCard,
    gameState?: GameState,
    playerId?: PlayerId,
  ): CombatModifiers {
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

    // Apply tarot-specific modifiers for reversed cards
    if (card.isReversed) {
      // Reversed cards have their energies inverted:
      // - Attack is weakened (chaotic energy misdirects force)
      // - Defense is slightly enhanced (inward focus provides protection)
      // Scale penalty with card cost for balance (higher cost = bigger impact)
      const reversalPenalty = Math.max(1, Math.ceil(card.cost / 3))
      modifiers.attackBonus = (modifiers.attackBonus || 0) - reversalPenalty
      modifiers.defenseBonus = (modifiers.defenseBonus || 0) + Math.ceil(reversalPenalty / 2)
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

    // Element synergy bonuses (when battlefield context is available)
    if (gameState && playerId && card.element) {
      const synergyAttack = getSynergyAttackBonus(gameState, playerId, card)
      const synergyHealth = getSynergyHealthBonus(gameState, playerId, card)
      modifiers.attackBonus = (modifiers.attackBonus || 0) + synergyAttack
      modifiers.defenseBonus = (modifiers.defenseBonus || 0) + synergyHealth
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
    attackerPosition: BattlefieldPosition,
  ): {
    units: BattlefieldPosition[]
    canAttackNexus: boolean
  } {
    const attacker = battlefieldService.getUnit(
      battlefield,
      attackerPosition.player,
      attackerPosition.slot,
    )
    if (!attacker) return { units: [], canAttackNexus: false }

    const opponentPlayer = attackerPosition.player === 'player1' ? 'player2' : 'player1'
    const opponentUnits =
      opponentPlayer === 'player2' ? battlefield.enemyUnits : battlefield.playerUnits

    const validUnits: BattlefieldPosition[] = []
    let hasTaunt = false
    let _hasVeilOfIllusion = false

    // Find all opponent units and check for special targeting rules
    for (let i = 0; i < opponentUnits.length; i++) {
      const unit = opponentUnits[i]
      if (unit) {
        // Check if unit can be targeted
        let canTarget = true

        // Veil of Illusion (enhanced stealth) - cannot be targeted until it attacks
        if (this.hasKeyword(unit, 'veil_of_illusion') && !unit.hasAttackedThisTurn) {
          canTarget = false
          _hasVeilOfIllusion = true
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
        canAttackNexus: false,
      }
    }

    // Can attack nexus if no taunt units and attacker doesn't have rush
    const canAttackNexus = !hasTaunt && !this.hasKeyword(attacker, 'rush')

    return {
      units: validUnits,
      canAttackNexus,
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
  async triggerEvent(event: GameEvent, context: Partial<GameEventContext>): Promise<GameState> {
    const fullContext: GameEventContext = {
      event,
      gameState: context.gameState!,
      ...context,
    }

    let updatedState = fullContext.gameState

    for (const ability of this.triggeredAbilities.values()) {
      if (ability.trigger === event && (!ability.condition || ability.condition(fullContext))) {
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

    toRemove.forEach(id => { this.removePersistentEffect(id) })
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

    toRemove.forEach(id => { this.removePersistentEffect(id) })
    GameLogger.action('Reset combat effects')
  }

  /**
   * Compatibility layer: Hearthstone-style direct attack
   * This wraps processAttack() to provide the same interface as combat_logic.ts
   */
  async declareAttack(state: GameState, attack: DirectAttack): Promise<GameState> {
    const attackingPlayer = state.activePlayer
    const player = state[attackingPlayer]

    // Validate attack token (Hearthstone-style combat)
    if (!player.hasAttackToken) {
      throw new Error('You do not have the attack token this round')
    }

    // Find attacker on battlefield
    const attackerPos = this.findUnitPosition(state.battlefield, attack.attackerId)
    if (!attackerPos) throw new Error('Attacker not found')

    const attacker = this.getUnitAt(state.battlefield, attackerPos.slot, attackerPos.player)
    if (!attacker) throw new Error('Invalid attacker')

    // Validate ownership - attacker must belong to active player
    if (attacker.owner !== attackingPlayer) {
      throw new Error(`Cannot attack with opponent's unit`)
    }

    // Validate can attack
    if (
      attacker.hasSummoningSickness &&
      !this.hasKeyword(attacker, 'charge') &&
      !this.hasKeyword(attacker, 'astral_projection')
    ) {
      throw new Error('Summoning sickness')
    }
    if (attacker.hasAttackedThisTurn && !this.hasKeyword(attacker, 'windfury')) {
      throw new Error('Already attacked')
    }

    // Check taunt
    const opponent = attackingPlayer === 'player1' ? 'player2' : 'player1'
    const tauntUnits = this.getUnitsWithKeyword(state.battlefield, opponent, 'taunt')

    if (tauntUnits.length > 0 && attack.targetType === 'player') {
      throw new Error('Must attack taunt first')
    }

    // Execute attack using Immer for immutability
    return produce(state, draft => {
      const draftAttacker = this.getUnitAtMutable(
        draft.battlefield,
        attackerPos.slot,
        attackerPos.player,
      )
      if (!draftAttacker) return

      if (attack.targetType === 'unit' && attack.targetId) {
        // Unit combat
        const targetPos = this.findUnitPosition(draft.battlefield, attack.targetId)
        if (!targetPos) throw new Error('Target not found')

        const target = this.getUnitAtMutable(draft.battlefield, targetPos.slot, targetPos.player)
        if (!target) throw new Error('Invalid target')

        // Get modifiers (pass state for element synergy calculations)
        const attackerModifiers = this.getCardModifiers(draftAttacker, state, attackingPlayer)
        const targetModifiers = this.getCardModifiers(target, state, opponent)

        // Calculate damage
        const attackerPower = draftAttacker.attack + (attackerModifiers.attackBonus || 0)
        const targetPower = target.attack + (targetModifiers.attackBonus || 0)

        let attackerDamage = Math.max(0, targetPower - (attackerModifiers.damageReduction || 0))
        let targetDamage = Math.max(0, attackerPower - (targetModifiers.damageReduction || 0))

        // Handle divine shield
        if (target.divineShield && targetDamage > 0) {
          targetDamage = 0
          target.divineShield = false
        }
        if (draftAttacker.divineShield && attackerDamage > 0) {
          attackerDamage = 0
          draftAttacker.divineShield = false
        }

        // Handle poisonous
        if (this.hasKeyword(target, 'poisonous') && attackerDamage > 0) {
          attackerDamage = draftAttacker.currentHealth || draftAttacker.health
        }
        if (this.hasKeyword(draftAttacker, 'poisonous') && targetDamage > 0) {
          targetDamage = target.currentHealth || target.health
        }

        // Handle elemental fury - double damage against opposing elements
        if (this.hasKeyword(draftAttacker, 'elemental_fury')) {
          const opposingElements: Record<string, string> = {
            fire: 'water',
            water: 'fire',
            earth: 'air',
            air: 'earth',
          }
          if (opposingElements[draftAttacker.element] === target.element) {
            targetDamage *= 2
          }
        }

        // Apply damage
        draftAttacker.currentHealth =
          (draftAttacker.currentHealth || draftAttacker.health) - attackerDamage
        target.currentHealth = (target.currentHealth || target.health) - targetDamage

        GameLogger.combat(
          `${draftAttacker.name} (${attackerPower}) vs ${target.name} (${targetPower})`,
        )

        // Handle solar radiance - damage units adjacent to the target
        if (this.hasKeyword(draftAttacker, 'solar_radiance') && targetDamage > 0) {
          const solarDamage = Math.ceil(targetDamage / 2)
          const targetSideUnits =
            targetPos.player === 'player1'
              ? draft.battlefield.playerUnits
              : draft.battlefield.enemyUnits

          for (const adjSlot of [targetPos.slot - 1, targetPos.slot + 1]) {
            if (adjSlot >= 0 && adjSlot < targetSideUnits.length) {
              const adjUnit = targetSideUnits[adjSlot]
              if (adjUnit) {
                adjUnit.currentHealth = (adjUnit.currentHealth || adjUnit.health) - solarDamage
                GameLogger.combat(`Solar Radiance deals ${solarDamage} to adjacent ${adjUnit.name}`)
                if (adjUnit.currentHealth <= 0) {
                  targetSideUnits[adjSlot] = null
                  GameLogger.combat(`${adjUnit.name} dies from Solar Radiance`)
                }
              }
            }
          }
        }

        // Handle lifesteal
        if (this.hasKeyword(draftAttacker, 'lifesteal') && targetDamage > 0) {
          draft[attackingPlayer].health += targetDamage
          GameLogger.combat(`${draftAttacker.name} heals for ${targetDamage} (lifesteal)`)
        }

        // Process deaths
        const draftUnitsAttacker =
          attackerPos.player === 'player1'
            ? draft.battlefield.playerUnits
            : draft.battlefield.enemyUnits
        const draftUnitsTarget =
          targetPos.player === 'player1'
            ? draft.battlefield.playerUnits
            : draft.battlefield.enemyUnits

        if (draftAttacker.currentHealth <= 0) {
          draftUnitsAttacker[attackerPos.slot] = null
          GameLogger.combat(`${draftAttacker.name} dies in combat`)
        }
        if (target.currentHealth <= 0) {
          draftUnitsTarget[targetPos.slot] = null
          GameLogger.combat(`${target.name} dies in combat`)
        }
      } else if (attack.targetType === 'player') {
        // Face damage
        const attackerModifiers = this.getCardModifiers(draftAttacker, state, attackingPlayer)
        const damage = draftAttacker.attack + (attackerModifiers.attackBonus || 0)
        draft[opponent].health -= damage
        GameLogger.combat(`${draftAttacker.name} deals ${damage} damage to ${opponent}`)

        // Handle lifesteal
        if (this.hasKeyword(draftAttacker, 'lifesteal') && damage > 0) {
          draft[attackingPlayer].health += damage
          GameLogger.combat(`${draftAttacker.name} heals for ${damage} (lifesteal)`)
        }
      }

      // Mark as attacked
      draftAttacker.hasAttackedThisTurn = true
    })
  }

  /**
   * Helper: Find unit position on battlefield
   */
  private findUnitPosition(
    battlefield: SchemaBattlefield,
    unitId: string,
  ): { player: 'player1' | 'player2'; slot: number } | null {
    for (let i = 0; i < battlefield.playerUnits.length; i++) {
      if (battlefield.playerUnits[i]?.id === unitId) {
        return { player: 'player1', slot: i }
      }
    }
    for (let i = 0; i < battlefield.enemyUnits.length; i++) {
      if (battlefield.enemyUnits[i]?.id === unitId) {
        return { player: 'player2', slot: i }
      }
    }
    return null
  }

  /**
   * Helper: Get unit at position (readonly)
   */
  private getUnitAt(
    battlefield: SchemaBattlefield,
    slot: number,
    playerId: 'player1' | 'player2',
  ): GameCard | null {
    const units = playerId === 'player1' ? battlefield.playerUnits : battlefield.enemyUnits
    return units[slot] || null
  }

  /**
   * Helper: Get unit at position (mutable for Immer draft)
   */
  private getUnitAtMutable(
    battlefield: SchemaBattlefield,
    slot: number,
    playerId: 'player1' | 'player2',
  ): GameCard | null {
    const units = playerId === 'player1' ? battlefield.playerUnits : battlefield.enemyUnits
    return units[slot] || null
  }

  /**
   * Helper: Get player units
   */
  private getPlayerUnits(
    battlefield: SchemaBattlefield,
    playerId: 'player1' | 'player2',
  ): GameCard[] {
    const units = playerId === 'player1' ? battlefield.playerUnits : battlefield.enemyUnits
    return units.filter(u => u !== null) as GameCard[]
  }

  /**
   * Helper: Get units with a specific keyword
   */
  private getUnitsWithKeyword(
    battlefield: SchemaBattlefield,
    playerId: 'player1' | 'player2',
    keyword: string,
  ): GameCard[] {
    const units = this.getPlayerUnits(battlefield, playerId)
    return units.filter(
      unit =>
        unit.keywords?.includes(keyword) ||
        unit.keywords?.includes(keyword.charAt(0).toUpperCase() + keyword.slice(1)),
    )
  }
}

export const combatService = new CombatService()

// ================================
// EXPORTED COMPATIBILITY FUNCTIONS
// ================================

/**
 * Declare an attack - compatibility wrapper for combat_logic.ts interface
 */
export async function declareAttack(state: GameState, attack: DirectAttack): Promise<GameState> {
  return combatService.declareAttack(state, attack)
}

/**
 * Check if a unit can attack
 */
export function canAttack(unit: GameCard): boolean {
  if (!unit) return false
  if (unit.hasSummoningSickness) {
    // Check for charge/astral_projection keywords
    if (!unit.keywords?.includes('charge') && !unit.keywords?.includes('astral_projection')) {
      return false
    }
  }
  if (unit.hasAttackedThisTurn) {
    // Check for windfury
    if (!unit.keywords?.includes('windfury')) {
      return false
    }
  }
  if ((unit.currentHealth || unit.health) <= 0) return false
  return true
}

/**
 * Get valid attack targets for a unit
 */
export function getValidAttackTargets(
  state: GameState,
  attackingPlayer: PlayerId,
): { units: GameCard[]; canTargetPlayer: boolean } {
  const opponent = attackingPlayer === 'player1' ? 'player2' : 'player1'
  const enemyUnits = (
    opponent === 'player1' ? state.battlefield.playerUnits : state.battlefield.enemyUnits
  ).filter(u => u !== null) as GameCard[]

  // Check for taunt units
  const tauntUnits = enemyUnits.filter(
    unit => unit.keywords?.includes('taunt') || unit.keywords?.includes('Taunt'),
  )

  // Filter out stealth units that haven't attacked
  const targetableUnits = (tauntUnits.length > 0 ? tauntUnits : enemyUnits).filter(unit => {
    if (unit.keywords?.includes('stealth') && !unit.hasAttackedThisTurn) return false
    if (unit.keywords?.includes('veil_of_illusion') && !unit.hasAttackedThisTurn) return false
    return true
  })

  return {
    units: targetableUnits,
    canTargetPlayer: tauntUnits.length === 0,
  }
}

/**
 * Calculate combat damage preview without executing
 */
export function previewCombat(
  attacker: GameCard,
  defender: GameCard,
): {
  attackerSurvives: boolean
  defenderSurvives: boolean
  attackerHealthRemaining: number
  defenderHealthRemaining: number
} {
  const attackerDamage = attacker.attack || 0
  const defenderDamage = defender.attack || 0

  const attackerHealthRemaining = (attacker.currentHealth || attacker.health) - defenderDamage
  const defenderHealthRemaining = (defender.currentHealth || defender.health) - attackerDamage

  return {
    attackerSurvives: attackerHealthRemaining > 0,
    defenderSurvives: defenderHealthRemaining > 0,
    attackerHealthRemaining: Math.max(0, attackerHealthRemaining),
    defenderHealthRemaining: Math.max(0, defenderHealthRemaining),
  }
}
