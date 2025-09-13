'use client'

import { GameLogger } from '@/lib/game_logger'
import type { Card as GameCard, GameState, Lane } from '@/schemas/schema'
import { CellPositionSchema } from '@/schemas/schema'
import { animationService } from './animation_service'

// Event system for triggered abilities
export type GameEvent =
  | 'card_played'
  | 'card_enters_bench'
  | 'card_attacks'
  | 'card_defends'
  | 'card_takes_damage'
  | 'card_dies'
  | 'card_reversed' // When a card becomes reversed
  | 'card_uprighted' // When a card becomes upright
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
  laneIndex?: number
  [key: string]: unknown
}

export interface PersistentEffect {
  id: string
  sourceCardId: string
  type: 'stat_modifier' | 'keyword_grant' | 'cost_modifier' | 'rule_change'
  duration: 'permanent' | 'end_of_turn' | 'while_on_bench' | 'until_combat_ends'
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
  | 'first_strike' // Deals damage before normal combat
  | 'double_strike' // Deals damage twice
  | 'evasive' // Can't be blocked by units without flying
  | 'trample' // Excess damage goes to nexus
  | 'lifelink' // Damage dealt heals player
  | 'deathtouch' // Any damage kills the target
  | 'vigilant' // Doesn't exhaust when attacking
  | 'haste' // Can attack immediately when played
  | 'defender' // Must block if able
  | 'regenerate' // Can pay cost to prevent death
  | 'indestructible' // Cannot be destroyed

export interface CombatResult {
  attacker: GameCard
  defender: GameCard | null
  attackerDamage: number
  defenderDamage: number
  attackerSurvived: boolean
  defenderSurvived: boolean
  nexusDamage: number
  laneIndex: number
}

export interface CombatResolution {
  results: CombatResult[]
  totalNexusDamage: number
  survivingAttackers: GameCard[]
  survivingDefenders: GameCard[]
  deadUnits: GameCard[]
  gameEnded: boolean
  winner?: 'player1' | 'player2'
}

export interface CombatModifiers {
  attackBonus?: number
  defenseBonus?: number
  damageReduction?: number
  cannotBeBlocked?: boolean
  firstStrike?: boolean
  lifelink?: boolean
  deathtouch?: boolean
  trample?: boolean
}

class CombatService {
  private triggeredAbilities: Map<string, TriggeredAbility[]> = new Map() // cardId -> abilities
  private persistentEffects: Map<string, PersistentEffect[]> = new Map() // cardId -> effects
  private eventQueue: GameEventContext[] = []
  private reversalProbability: number = 0.15 // 15% chance for cards to be drawn reversed

  /**
   * Reverse a card (flip it upside down) - Core Tarot mechanic
   */
  reverseCard(gameState: GameState, cardId: string): GameState {
    const card = this.findCardInGame(gameState, cardId)
    if (!card) return gameState

    const wasReversed = card.isReversed
    card.isReversed = !wasReversed

    // Trigger appropriate event
    const eventType: GameEvent = card.isReversed ? 'card_reversed' : 'card_uprighted'

    const newGameState = this.triggerEvent({
      event: eventType,
      gameState: { ...gameState },
      triggerCard: card,
      player: this.getCardOwner(gameState, cardId),
    })

    GameLogger.action(`${card.name} ${card.isReversed ? 'reversed' : 'uprighted'}`, {
      wasReversed,
      isNowReversed: card.isReversed,
    })

    return newGameState
  }

  /**
   * Apply chance for cards to be drawn reversed (fundamental tarot mechanic)
   */
  applyDrawReversalChance(card: GameCard): GameCard {
    if (Math.random() < this.reversalProbability) {
      return { ...card, isReversed: true }
    }
    return { ...card, isReversed: false }
  }

  /**
   * Get effective card stats considering reversed state
   */
  getEffectiveCardStats(card: GameCard): { attack: number; health: number; description: string } {
    if (!card.isReversed) {
      return {
        attack: card.attack,
        health: card.health,
        description: card.description || '',
      }
    }

    // Reversed cards have altered effects
    return {
      attack: this.getReversedAttack(card),
      health: this.getReversedHealth(card),
      description: card.reversedDescription || this.generateReversedDescription(card),
    }
  }

  /**
   * Calculate reversed card attack (often reduced or inverted)
   */
  private getReversedAttack(card: GameCard): number {
    // Tarot reversal logic - attack becomes more defensive
    return Math.max(0, Math.floor(card.attack * 0.7))
  }

  /**
   * Calculate reversed card health (often different based on card type)
   */
  private getReversedHealth(card: GameCard): number {
    // Reversed cards might have more health but less attack
    return card.health + 1
  }

  /**
   * Generate reversed description if not provided
   */
  private generateReversedDescription(card: GameCard): string {
    if (card.reversedDescription) {
      return card.reversedDescription
    }

    // Generate inverted effect based on original description
    const original = card.description || ''

    if (original.includes('gain')) {
      return original.replace('gain', 'lose')
    }
    if (original.includes('heal')) {
      return original.replace('heal', 'damage')
    }
    if (original.includes('draw')) {
      return original.replace('draw', 'discard')
    }
    if (original.includes('+')) {
      return original.replace(/\+(\d+)/g, '-$1')
    }

    return `Reversed: ${original} (inverted effect)`
  }

  /**
   * Register a triggered ability for a card
   */
  registerTriggeredAbility(ability: TriggeredAbility): void {
    const cardAbilities = this.triggeredAbilities.get(ability.cardId) || []
    cardAbilities.push(ability)
    this.triggeredAbilities.set(ability.cardId, cardAbilities)
  }

  /**
   * Add a persistent effect
   */
  addPersistentEffect(effect: PersistentEffect): void {
    const cardEffects = this.persistentEffects.get(effect.sourceCardId) || []
    cardEffects.push(effect)
    this.persistentEffects.set(effect.sourceCardId, cardEffects)
  }

  /**
   * Trigger game events and process triggered abilities
   */
  triggerEvent(context: GameEventContext): GameState {
    let gameState = context.gameState

    // Add to event queue for processing
    this.eventQueue.push(context)

    // Find and execute triggered abilities
    const triggeredAbilities = this.findTriggeredAbilities(context)

    for (const ability of triggeredAbilities) {
      if (!ability.condition || ability.condition(context)) {
        try {
          gameState = ability.effect({ ...context, gameState })
          GameLogger.action(`Triggered ability: ${ability.description}`)
        } catch (error) {
          console.error('Error executing triggered ability:', error)
        }
      }
    }

    // Process persistent effects
    gameState = this.applyPersistentEffects(gameState)

    return gameState
  }

  /**
   * Find abilities that trigger on this event
   */
  private findTriggeredAbilities(context: GameEventContext): TriggeredAbility[] {
    const triggered: TriggeredAbility[] = []

    // Check all registered abilities
    this.triggeredAbilities.forEach(abilities => {
      abilities.forEach(ability => {
        if (ability.trigger === context.event) {
          triggered.push(ability)
        }
      })
    })

    return triggered
  }

  /**
   * Apply all persistent effects to game state
   */
  private applyPersistentEffects(gameState: GameState): GameState {
    let modifiedState = { ...gameState }

    this.persistentEffects.forEach((effects, sourceCardId) => {
      effects.forEach(effect => {
        // Check if effect is still valid (source card still exists)
        const sourceExists = this.findCardInGame(modifiedState, sourceCardId)

        if (!sourceExists && effect.duration === 'while_on_bench') {
          // Remove effect if source card is gone
          this.removePersistentEffect(effect.id)
          return
        }

        // Apply effect based on targets
        modifiedState = this.applyEffectToTargets(modifiedState, effect)
      })
    })

    return modifiedState
  }

  /**
   * Apply effect to target cards
   */
  private applyEffectToTargets(gameState: GameState, effect: PersistentEffect): GameState {
    const newState = { ...gameState }

    const getTargetCards = (): GameCard[] => {
      switch (effect.targets) {
        case 'self': {
          const selfCard = this.findCardInGame(newState, effect.sourceCardId)
          return selfCard ? [selfCard] : []
        }

        case 'all_friendly': {
          const _sourceCard = this.findCardInGame(newState, effect.sourceCardId)
          const sourceOwner = this.getCardOwner(newState, effect.sourceCardId)
          return sourceOwner ? newState[sourceOwner].bench : []
        }

        case 'all_enemy': {
          const owner = this.getCardOwner(newState, effect.sourceCardId)
          const enemyPlayer = owner === 'player1' ? 'player2' : 'player1'
          return newState[enemyPlayer].bench
        }

        case 'all_cards':
          return [...newState.player1.bench, ...newState.player2.bench]

        case 'specific_card': {
          const target = this.findCardInGame(newState, effect.targetCardId!)
          return target ? [target] : []
        }

        default:
          return []
      }
    }

    const targetCards = getTargetCards()

    targetCards.forEach(card => {
      // Apply stat modifiers
      if (effect.effect.attackModifier) {
        card.attack = Math.max(0, card.attack + effect.effect.attackModifier)
      }

      if (effect.effect.healthModifier) {
        card.health = Math.max(1, card.health + effect.effect.healthModifier)
        if (card.currentHealth) {
          card.currentHealth = Math.max(1, card.currentHealth + effect.effect.healthModifier)
        }
      }

      // Apply keyword grants/removals
      if (effect.effect.grantsKeywords) {
        card.keywords = [...(card.keywords || []), ...effect.effect.grantsKeywords]
      }

      if (effect.effect.removesKeywords) {
        card.keywords = (card.keywords || []).filter(
          keyword => !effect.effect.removesKeywords?.includes(keyword as CardKeyword),
        )
      }
    })

    return newState
  }

  /**
   * Process keyword abilities during combat
   */
  private processKeywordAbilities(
    attacker: GameCard,
    defender: GameCard | null,
    _laneIndex: number,
  ): CombatModifiers {
    const modifiers: CombatModifiers = {}
    const attackerKeywords = attacker.keywords || []

    // First Strike - attacker deals damage first
    if (attackerKeywords.includes('first_strike') || attackerKeywords.includes('double_strike')) {
      modifiers.firstStrike = true
    }

    // Double Strike - attacker deals damage twice
    if (attackerKeywords.includes('double_strike')) {
      modifiers.attackBonus = attacker.attack // Effectively double damage
    }

    // Evasive - can't be blocked by certain units
    if (attackerKeywords.includes('evasive') && defender) {
      const defenderKeywords = defender.keywords || []
      if (!defenderKeywords.includes('reach') && !defenderKeywords.includes('evasive')) {
        modifiers.cannotBeBlocked = true
      }
    }

    // Trample - excess damage goes to nexus
    if (attackerKeywords.includes('trample') && defender) {
      // This would be handled in damage calculation
    }

    // Lifelink - damage dealt heals player
    if (attackerKeywords.includes('lifelink')) {
      modifiers.lifelink = true
    }

    // Deathtouch - any damage kills
    if (attackerKeywords.includes('deathtouch')) {
      modifiers.deathtouch = true
    }

    // Trample - excess damage goes to nexus
    if (attackerKeywords.includes('trample')) {
      modifiers.trample = true
    }

    return modifiers
  }

  /**
   * Register card abilities when card is played (handles reversed effects)
   */
  registerCardAbilities(card: GameCard, gameState: GameState): GameState {
    // Get effective description based on reversed state
    const effectiveStats = this.getEffectiveCardStats(card)
    const description = effectiveStats.description.toLowerCase()

    // Parse abilities from appropriate description
    if (description.includes('when this enters the bench')) {
      this.registerTriggeredAbility({
        id: `${card.id}_enter_bench`,
        cardId: card.id,
        trigger: 'card_enters_bench',
        effect: this.parseEnterBenchEffect(card),
        description: effectiveStats.description,
      })
    }

    if (description.includes('when this dies')) {
      this.registerTriggeredAbility({
        id: `${card.id}_dies`,
        cardId: card.id,
        trigger: 'card_dies',
        effect: this.parseDeathEffect(card),
        description: effectiveStats.description,
      })
    }

    if (description.includes('while on bench')) {
      this.addPersistentEffect({
        id: `${card.id}_bench_aura`,
        sourceCardId: card.id,
        type: 'stat_modifier',
        duration: 'while_on_bench',
        targets: 'all_friendly',
        effect: this.parseBenchAuraEffect(card),
        description: effectiveStats.description,
      })
    }

    // Register reversed-specific abilities
    if (card.isReversed) {
      this.registerReversedAbilities(card, gameState)
    }

    // Trigger card_enters_bench event
    return this.triggerEvent({
      event: 'card_enters_bench',
      gameState,
      triggerCard: card,
      player: this.getCardOwner(gameState, card.id),
    })
  }

  /**
   * Register special abilities that only trigger when reversed
   */
  private registerReversedAbilities(card: GameCard, _gameState: GameState): void {
    // Reversed Death triggers negative effects on opponent
    this.registerTriggeredAbility({
      id: `${card.id}_reversed_death`,
      cardId: card.id,
      trigger: 'card_dies',
      effect: (context: GameEventContext): GameState => {
        const opponent = context.player === 'player1' ? 'player2' : 'player1'

        // Reversed Death causes opponent to lose mana
        if (context.gameState[opponent].spellMana > 0) {
          context.gameState[opponent].spellMana = Math.max(
            0,
            context.gameState[opponent].spellMana - 1,
          )
          GameLogger.action(`Reversed ${card.name} death drains enemy mana`)
        }

        return context.gameState
      },
      description: `When ${card.name} dies while reversed, enemy loses 1 spell mana`,
    })

    // Reversed cards cause self-harm when attacking
    if (card.type === 'unit') {
      this.registerTriggeredAbility({
        id: `${card.id}_reversed_attack_backlash`,
        cardId: card.id,
        trigger: 'card_attacks',
        effect: (context: GameEventContext): GameState => {
          // Reversed attackers take 1 damage when attacking
          const owner = context.player!
          const benchUnit = context.gameState[owner].bench.find(u => u.id === card.id)
          if (benchUnit) {
            const newHealth = (benchUnit.currentHealth || benchUnit.health) - 1
            if (newHealth <= 0) {
              // Card dies from backlash
              context.gameState[owner].bench = context.gameState[owner].bench.filter(
                u => u.id !== card.id,
              )
            } else {
              benchUnit.currentHealth = newHealth
            }
            GameLogger.action(`Reversed ${card.name} suffers backlash damage`)
          }
          return context.gameState
        },
        description: `${card.name} takes 1 damage when attacking while reversed`,
      })
    }
  }

  /**
   * Trigger reversal events during combat (critical moments)
   */
  triggerCombatReversals(gameState: GameState): GameState {
    let newState = { ...gameState }

    // Cards can become reversed when taking critical damage
    newState.lanes.forEach(lane => {
      if (lane.defender && !lane.defender.isReversed) {
        const defenderHealth = lane.defender.currentHealth || lane.defender.health
        const incomingDamage = lane.attacker?.attack || 0

        // If damage would kill the defender, chance to reverse instead
        if (incomingDamage >= defenderHealth && Math.random() < 0.3) {
          lane.defender.isReversed = true
          GameLogger.action(`${lane.defender.name} becomes reversed at critical moment!`)

          // Trigger reversal event
          newState = this.triggerEvent({
            event: 'card_reversed',
            gameState: newState,
            triggerCard: lane.defender,
            player: this.getCardOwner(newState, lane.defender.id),
          })
        }
      }
    })

    return newState
  }

  /**
   * Clean up effects when card leaves play
   */
  cleanupCardEffects(cardId: string): void {
    this.triggeredAbilities.delete(cardId)
    this.persistentEffects.delete(cardId)
  }

  /**
   * Clean up expired effects at end of turn
   */
  processEndOfTurnEffects(gameState: GameState): GameState {
    let newState = { ...gameState }

    this.persistentEffects.forEach((effects, cardId) => {
      const updatedEffects = effects.filter(effect => {
        if (effect.duration === 'end_of_turn') {
          return false // Remove effect
        }
        if (effect.duration === 'permanent' || effect.duration === 'while_on_bench') {
          return true // Keep effect
        }
        if (effect.turnsRemaining !== undefined) {
          effect.turnsRemaining--
          return effect.turnsRemaining > 0
        }
        return true
      })

      if (updatedEffects.length === 0) {
        this.persistentEffects.delete(cardId)
      } else {
        this.persistentEffects.set(cardId, updatedEffects)
      }
    })

    // Trigger turn_ends event
    newState = this.triggerEvent({
      event: 'turn_ends',
      gameState: newState,
      player: gameState.activePlayer,
    })

    return newState
  }

  /**
   * Parse enter bench effects (considers reversed state)
   */
  private parseEnterBenchEffect(card: GameCard) {
    return (context: GameEventContext): GameState => {
      // Get effective description based on reversed state
      const effectiveStats = this.getEffectiveCardStats(card)
      const description = effectiveStats.description.toLowerCase()

      if (description.includes('draw a card')) {
        const player = context.gameState[context.player!]
        if (player.deck.length > 0) {
          const drawnCard = player.deck.shift()!
          // Apply reversal chance to drawn card
          const processedCard = this.applyDrawReversalChance(drawnCard)
          player.hand.push(processedCard)
        }
      } else if (description.includes('discard')) {
        // Reversed effect - discard instead of draw
        const player = context.gameState[context.player!]
        if (player.hand.length > 0) {
          const randomIndex = Math.floor(Math.random() * player.hand.length)
          player.hand.splice(randomIndex, 1)
        }
      }

      if (description.includes('gain') && description.includes('mana')) {
        const manaMatch = description.match(/(\d+)\s*mana/)
        const mana = manaMatch ? parseInt(manaMatch[1], 10) : 1
        context.gameState[context.player!].spellMana = Math.min(
          3,
          context.gameState[context.player!].spellMana + mana,
        )
      } else if (description.includes('lose') && description.includes('mana')) {
        // Reversed effect - lose mana instead of gain
        const manaMatch = description.match(/(\d+)\s*mana/)
        const mana = manaMatch ? parseInt(manaMatch[1], 10) : 1
        context.gameState[context.player!].spellMana = Math.max(
          0,
          context.gameState[context.player!].spellMana - mana,
        )
      }

      return context.gameState
    }
  }

  private parseDeathEffect(card: GameCard) {
    return (context: GameEventContext): GameState => {
      const description = (card.description || '').toLowerCase()

      if (description.includes('when this dies, deal') && description.includes('damage')) {
        const damageMatch = description.match(/(\d+)\s*damage/)
        const damage = damageMatch ? parseInt(damageMatch[1], 10) : 1
        const opponent = context.player === 'player1' ? 'player2' : 'player1'

        if (description.includes('to any target')) {
          // For simplicity, deal to opponent nexus
          context.gameState[opponent].health -= damage
        }
      }

      return context.gameState
    }
  }

  private parseBenchAuraEffect(card: GameCard): PersistentEffect['effect'] {
    const description = (card.description || '').toLowerCase()
    const effect: PersistentEffect['effect'] = {}

    if (description.includes('other units get +')) {
      const statMatch = description.match(/\+(\d+)\/\+(\d+)/)
      if (statMatch) {
        effect.attackModifier = parseInt(statMatch[1], 10)
        effect.healthModifier = parseInt(statMatch[2], 10)
      }
    }

    if (description.includes('grants') || description.includes('have')) {
      if (description.includes('first strike')) {
        effect.grantsKeywords = ['first_strike']
      }
      if (description.includes('lifelink')) {
        effect.grantsKeywords = [...(effect.grantsKeywords || []), 'lifelink']
      }
    }

    return effect
  }

  /**
   * Find card in game state
   */
  private findCardInGame(gameState: GameState, cardId: string): GameCard | null {
    // Check both players' hands, decks, and benches
    const allCards = [
      ...gameState.player1.hand,
      ...gameState.player1.deck,
      ...gameState.player1.bench,
      ...gameState.player2.hand,
      ...gameState.player2.deck,
      ...gameState.player2.bench,
      ...gameState.lanes.flatMap(lane => [lane.attacker, lane.defender].filter(Boolean)),
    ] as GameCard[]

    return allCards.find(card => card.id === cardId) || null
  }

  /**
   * Get the owner of a card
   */
  private getCardOwner(gameState: GameState, cardId: string): 'player1' | 'player2' | null {
    const player1Cards = [
      ...gameState.player1.hand,
      ...gameState.player1.deck,
      ...gameState.player1.bench,
    ]

    if (player1Cards.some(card => card.id === cardId)) {
      return 'player1'
    }

    const player2Cards = [
      ...gameState.player2.hand,
      ...gameState.player2.deck,
      ...gameState.player2.bench,
    ]

    if (player2Cards.some(card => card.id === cardId)) {
      return 'player2'
    }

    return null
  }

  /**
   * Remove a persistent effect by ID
   */
  private removePersistentEffect(effectId: string): void {
    this.persistentEffects.forEach((effects, cardId) => {
      const filtered = effects.filter(effect => effect.id !== effectId)
      if (filtered.length === 0) {
        this.persistentEffects.delete(cardId)
      } else {
        this.persistentEffects.set(cardId, filtered)
      }
    })
  }
  /**
   * Resolve an entire combat phase with animations
   */
  async resolveCombatPhase(gameState: GameState): Promise<GameState> {
    if (gameState?.phase !== 'combat') {
      console.warn('CombatService: Cannot resolve combat outside of combat phase')
      return gameState
    }

    let newGameState = { ...gameState }
    const attackingPlayer = newGameState.attackingPlayer!
    const _defendingPlayer = attackingPlayer === 'player1' ? 'player2' : 'player1'

    try {
      // Step 0: Trigger combat begins event
      newGameState = this.triggerEvent({
        event: 'combat_begins',
        gameState: newGameState,
        player: attackingPlayer,
      })

      // Step 0.5: Check for combat reversals (critical tarot mechanic)
      newGameState = this.triggerCombatReversals(newGameState)

      // Step 1: Calculate combat results with effective stats
      const resolution = this.calculateCombatResolution(newGameState)

      // Step 2: Animate attacks
      await this.animateCombatAttacks(newGameState, resolution)

      // Step 3: Apply damage and show damage numbers
      await this.applyDamageWithAnimations(newGameState, resolution)

      // Step 4: Handle unit deaths (with reversal triggered effects)
      this.applyUnitDeaths(newGameState, resolution)

      // Step 5: Apply nexus damage
      this.applyNexusDamage(newGameState, resolution)

      // Step 6: Animate survivors returning to bench
      await this.animateUnitsReturning(newGameState, resolution)

      // Step 7: Clean up combat state
      this.cleanupCombatState(newGameState)

      // Step 8: Trigger combat ends event
      newGameState = this.triggerEvent({
        event: 'combat_ends',
        gameState: newGameState,
        player: attackingPlayer,
      })

      // Step 8: Check for game end
      const outcome = this.checkGameOutcome(newGameState)
      if (outcome !== 'ongoing') {
        // Handle game end
        newGameState.phase = 'end_round'
      }

      // Step 9: Log combat results
      this.logCombatResults(resolution)

      return newGameState
    } catch (error) {
      console.error('CombatService: Error during combat resolution', error)
      return gameState
    }
  }

  /**
   * Calculate damage and survival for all combat interactions
   */
  private calculateCombatResolution(gameState: GameState): CombatResolution {
    const results: CombatResult[] = []
    const attackingPlayer = gameState.attackingPlayer!
    const defendingPlayer = attackingPlayer === 'player1' ? 'player2' : 'player1'
    let totalNexusDamage = 0

    gameState.lanes.forEach((lane, laneIndex) => {
      if (lane.attacker) {
        const result = this.resolveLaneCombat(lane, laneIndex)
        results.push(result)
        totalNexusDamage += result.nexusDamage
      }
    })

    const survivingAttackers = results.filter(r => r.attackerSurvived).map(r => r.attacker)

    const survivingDefenders = results
      .filter(r => r.defender && r.defenderSurvived)
      .map(r => r.defender!)

    const deadUnits = results
      .flatMap(r => [
        !r.attackerSurvived ? r.attacker : null,
        r.defender && !r.defenderSurvived ? r.defender : null,
      ])
      .filter((unit): unit is GameCard => unit !== null)

    const newDefenderHealth = gameState[defendingPlayer].health - totalNexusDamage
    const gameEnded = newDefenderHealth <= 0
    const winner = gameEnded ? attackingPlayer : undefined

    return {
      results,
      totalNexusDamage,
      survivingAttackers,
      survivingDefenders,
      deadUnits,
      gameEnded,
      winner,
    }
  }

  /**
   * Calculate damage dealt by an attacker to a target
   */
  private calculateDamage(
    attacker: GameCard,
    target: GameCard | null,
    modifiers?: CombatModifiers,
  ): number {
    // Get effective attack considering reversed state
    const effectiveStats = this.getEffectiveCardStats(attacker)
    let damage = effectiveStats.attack

    // Apply modifiers
    if (modifiers) {
      if (modifiers.attackBonus) {
        damage += modifiers.attackBonus
      }
      if (modifiers.damageReduction) {
        damage = Math.max(0, damage - modifiers.damageReduction)
      }
    }

    // Deathtouch - any damage kills
    if (target && modifiers?.deathtouch && damage > 0) {
      return target.currentHealth || target.health
    }

    return Math.max(0, damage)
  }

  /**
   * Resolve combat for a single lane with keyword abilities
   */
  private resolveLaneCombat(lane: Lane, laneIndex: number): CombatResult {
    const attacker = lane.attacker!
    const defender = lane.defender

    if (!defender) {
      // Unblocked attacker - hits nexus
      const nexusDamage = this.calculateDamage(attacker, null)
      return {
        attacker,
        defender: null,
        attackerDamage: 0,
        defenderDamage: 0,
        attackerSurvived: true,
        defenderSurvived: false,
        nexusDamage,
        laneIndex,
      }
    }

    // Process keyword abilities
    const attackerModifiers = this.processKeywordAbilities(attacker, defender, laneIndex)
    const defenderModifiers = this.processKeywordAbilities(defender, attacker, laneIndex)

    // Check for evasive/unblockable abilities
    if (attackerModifiers.cannotBeBlocked) {
      // Defender can't block this attacker
      return {
        attacker,
        defender,
        attackerDamage: 0,
        defenderDamage: 0,
        attackerSurvived: true,
        defenderSurvived: true, // Defender survives because combat doesn't happen
        nexusDamage: this.calculateDamage(attacker, null, attackerModifiers),
        laneIndex,
      }
    }

    // Calculate damage with modifiers
    let attackerDamage = this.calculateDamage(defender, attacker, defenderModifiers)
    let defenderDamage = this.calculateDamage(attacker, defender, attackerModifiers)

    const attackerCurrentHealth = attacker.currentHealth || attacker.health
    const defenderCurrentHealth = defender.currentHealth || defender.health

    // Handle first strike
    let attackerSurvived = true
    let defenderSurvived = true

    if (attackerModifiers.firstStrike && !defenderModifiers.firstStrike) {
      // Attacker deals damage first
      defenderSurvived = defenderCurrentHealth - defenderDamage > 0
      if (!defenderSurvived) {
        // Defender dies, can't deal damage back
        attackerDamage = 0
      }
    } else if (defenderModifiers.firstStrike && !attackerModifiers.firstStrike) {
      // Defender deals damage first
      attackerSurvived = attackerCurrentHealth - attackerDamage > 0
      if (!attackerSurvived) {
        // Attacker dies, can't deal damage
        defenderDamage = 0
      }
    }

    // Final survival calculation
    if (attackerDamage > 0) {
      attackerSurvived = attackerCurrentHealth - attackerDamage > 0
    }
    if (defenderDamage > 0) {
      defenderSurvived = defenderCurrentHealth - defenderDamage > 0
    }

    // Handle trample - excess damage to nexus
    let nexusDamage = 0
    if (attacker.keywords?.includes('trample') && !defenderSurvived) {
      const excessDamage = defenderDamage - defenderCurrentHealth
      nexusDamage = Math.max(0, excessDamage)
    }

    return {
      attacker,
      defender,
      attackerDamage,
      defenderDamage,
      attackerSurvived,
      defenderSurvived,
      nexusDamage,
      laneIndex,
    }
  }

  /**
   * Animate all combat attacks
   */
  private async animateCombatAttacks(
    gameState: GameState,
    resolution: CombatResolution,
  ): Promise<void> {
    const attackingPlayer = gameState.attackingPlayer!
    const combatAnimations: Promise<void>[] = []

    resolution.results.forEach(result => {
      const attackerElement = document.querySelector(`[data-card-id="${result.attacker.id}"]`)
      if (attackerElement instanceof HTMLElement) {
        if (result.defender) {
          // Attack against defender
          const targetPosition = CellPositionSchema.parse({
            row: attackingPlayer === 'player1' ? 1 : 2,
            col: result.laneIndex,
          })
          const attackerPosition = CellPositionSchema.parse({
            row: attackingPlayer === 'player1' ? 2 : 1,
            col: result.laneIndex,
          })
          combatAnimations.push(
            animationService.animateCombatAttack(attackerElement, attackerPosition, targetPosition),
          )
        } else {
          // Attack to nexus
          const attackerPosition = CellPositionSchema.parse({
            row: attackingPlayer === 'player1' ? 2 : 1,
            col: result.laneIndex,
          })
          combatAnimations.push(
            animationService.animateCombatAttack(attackerElement, attackerPosition),
          )
        }
      }
    })

    if (combatAnimations.length > 0) {
      await Promise.all(combatAnimations)
    }
  }

  /**
   * Apply damage and show damage numbers
   */
  private async applyDamageWithAnimations(
    gameState: GameState,
    resolution: CombatResolution,
  ): Promise<void> {
    const attackingPlayer = gameState.attackingPlayer!
    const defendingPlayer = attackingPlayer === 'player1' ? 'player2' : 'player1'
    const damageAnimations: Promise<void>[] = []

    resolution.results.forEach(result => {
      // Show attacker taking damage
      if (result.attackerDamage > 0) {
        const attackerPosition = CellPositionSchema.parse({
          row: attackingPlayer === 'player1' ? 2 : 1,
          col: result.laneIndex,
        })
        damageAnimations.push(
          animationService.animateDamage(attackerPosition, result.attackerDamage, 'damage'),
        )
      }

      // Show defender taking damage
      if (result.defender && result.defenderDamage > 0) {
        const defenderPosition = CellPositionSchema.parse({
          row: defendingPlayer === 'player1' ? 2 : 1,
          col: result.laneIndex,
        })
        damageAnimations.push(
          animationService.animateDamage(defenderPosition, result.defenderDamage, 'damage'),
        )
      }

      // Show nexus damage
      if (result.nexusDamage > 0) {
        const nexusPosition = CellPositionSchema.parse({
          row: defendingPlayer === 'player1' ? 3 : 0,
          col: 3,
        })
        damageAnimations.push(
          animationService.animateDamage(nexusPosition, result.nexusDamage, 'damage'),
        )
      }
    })

    if (damageAnimations.length > 0) {
      await Promise.all(damageAnimations)
    }
  }

  /**
   * Apply unit deaths to game state and trigger death events
   */
  private applyUnitDeaths(gameState: GameState, resolution: CombatResolution): void {
    const attackingPlayer = gameState.attackingPlayer!
    const defendingPlayer = attackingPlayer === 'player1' ? 'player2' : 'player1'

    resolution.results.forEach(result => {
      // Handle attacker damage and death
      if (!result.attackerSurvived) {
        gameState[attackingPlayer].bench = gameState[attackingPlayer].bench.filter(
          u => u.id !== result.attacker.id,
        )

        // Trigger death event
        gameState = this.triggerEvent({
          event: 'card_dies',
          gameState,
          triggerCard: result.attacker,
          player: attackingPlayer,
          laneIndex: result.laneIndex,
        })

        // Clean up card effects
        this.cleanupCardEffects(result.attacker.id)
      } else if (result.attackerDamage > 0) {
        // Update attacker health and trigger damage event
        const benchUnit = gameState[attackingPlayer].bench.find(u => u.id === result.attacker.id)
        if (benchUnit) {
          benchUnit.currentHealth =
            (benchUnit.currentHealth || benchUnit.health) - result.attackerDamage

          // Trigger damage event
          gameState = this.triggerEvent({
            event: 'card_takes_damage',
            gameState,
            triggerCard: benchUnit,
            damage: result.attackerDamage,
            player: attackingPlayer,
          })
        }
      }

      // Handle defender damage and death
      if (result.defender) {
        if (!result.defenderSurvived) {
          gameState[defendingPlayer].bench = gameState[defendingPlayer].bench.filter(
            u => u.id !== result.defender?.id,
          )

          // Trigger death event
          gameState = this.triggerEvent({
            event: 'card_dies',
            gameState,
            triggerCard: result.defender,
            player: defendingPlayer,
            laneIndex: result.laneIndex,
          })

          // Clean up card effects
          this.cleanupCardEffects(result.defender.id)
        } else if (result.defenderDamage > 0) {
          // Update defender health and trigger damage event
          const benchUnit = gameState[defendingPlayer].bench.find(u => u.id === result.defender?.id)
          if (benchUnit) {
            benchUnit.currentHealth =
              (benchUnit.currentHealth || benchUnit.health) - result.defenderDamage

            // Trigger damage event
            gameState = this.triggerEvent({
              event: 'card_takes_damage',
              gameState,
              triggerCard: benchUnit,
              damage: result.defenderDamage,
              player: defendingPlayer,
            })
          }
        }
      }

      // Handle lifelink healing
      if (result.defenderDamage > 0) {
        this.handleLifelinkHealing(
          gameState,
          result.attacker,
          result.defenderDamage,
          attackingPlayer,
        )
      }
    })
  }

  /**
   * Apply nexus damage
   */
  private applyNexusDamage(gameState: GameState, resolution: CombatResolution): void {
    if (resolution.totalNexusDamage > 0) {
      const attackingPlayer = gameState.attackingPlayer!
      const defendingPlayer = attackingPlayer === 'player1' ? 'player2' : 'player1'
      gameState[defendingPlayer].health -= resolution.totalNexusDamage
    }
  }

  /**
   * Animate surviving units returning to bench
   */
  private async animateUnitsReturning(
    gameState: GameState,
    resolution: CombatResolution,
  ): Promise<void> {
    const attackingPlayer = gameState.attackingPlayer!
    const defendingPlayer = attackingPlayer === 'player1' ? 'player2' : 'player1'
    const returnAnimations: Promise<void>[] = []

    resolution.results.forEach(result => {
      // Return surviving attackers
      if (result.attackerSurvived) {
        const cardElement = document.querySelector(`[data-card-id="${result.attacker.id}"]`)
        if (cardElement instanceof HTMLElement) {
          const fromPosition = CellPositionSchema.parse({
            row: attackingPlayer === 'player1' ? 2 : 1,
            col: result.laneIndex,
          })
          const toPosition = CellPositionSchema.parse({
            row: attackingPlayer === 'player1' ? 3 : 0,
            col: result.laneIndex,
          })
          returnAnimations.push(
            animationService.animateCardMove(cardElement, fromPosition, toPosition),
          )
        }
      }

      // Return surviving defenders
      if (result.defender && result.defenderSurvived) {
        const cardElement = document.querySelector(`[data-card-id="${result.defender.id}"]`)
        if (cardElement instanceof HTMLElement) {
          const fromPosition = CellPositionSchema.parse({
            row: defendingPlayer === 'player1' ? 2 : 1,
            col: result.laneIndex,
          })
          const toPosition = CellPositionSchema.parse({
            row: defendingPlayer === 'player1' ? 3 : 0,
            col: result.laneIndex,
          })
          returnAnimations.push(
            animationService.animateCardMove(cardElement, fromPosition, toPosition),
          )
        }
      }
    })

    if (returnAnimations.length > 0) {
      await Promise.all(returnAnimations)
    }
  }

  /**
   * Clean up combat state
   */
  private cleanupCombatState(gameState: GameState): void {
    // Clear lanes
    gameState.lanes = gameState.lanes.map(lane => ({
      ...lane,
      attacker: null,
      defender: null,
    }))

    gameState.combatResolved = true
    gameState.phase = 'action'
    gameState.activePlayer = gameState.attackingPlayer! // Return turn to attacker
    gameState.attackingPlayer = null
  }

  /**
   * Check for game end conditions
   */
  private checkGameOutcome(gameState: GameState): 'player1_wins' | 'player2_wins' | 'ongoing' {
    if (gameState.player1.health <= 0) return 'player2_wins'
    if (gameState.player2.health <= 0) return 'player1_wins'
    return 'ongoing'
  }

  /**
   * Log combat results for debugging and analytics
   */
  private logCombatResults(resolution: CombatResolution): void {
    const combatResultsForLogging = resolution.results.map(result => ({
      lane: result.laneIndex + 1,
      type: result.defender ? 'unit_combat' : 'nexus_attack',
      attacker: `${result.attacker.name} (${result.attackerSurvived ? 'survived' : 'died'})`,
      defender: result.defender
        ? `${result.defender.name} (${result.defenderSurvived ? 'survived' : 'died'})`
        : null,
      nexusDamage: result.nexusDamage,
    }))

    GameLogger.combat('Combat resolved by CombatService', {
      results: combatResultsForLogging,
      totalNexusDamage: resolution.totalNexusDamage,
      deadUnits: resolution.deadUnits.length,
      gameEnded: resolution.gameEnded,
    })
  }

  /**
   * Check if a card has specific keywords for blocking rules
   */
  canBlockFlying(defender: GameCard): boolean {
    const keywords = defender.keywords || []
    return keywords.includes('evasive') || keywords.includes('reach')
  }

  /**
   * Check if a card can be forced to block
   */
  mustBlock(defender: GameCard): boolean {
    const keywords = defender.keywords || []
    return keywords.includes('defender')
  }

  /**
   * Handle lifelink healing
   */
  private handleLifelinkHealing(
    gameState: GameState,
    attacker: GameCard,
    damageDealt: number,
    attackingPlayer: 'player1' | 'player2',
  ): void {
    if ((attacker.keywords || []).includes('lifelink') && damageDealt > 0) {
      gameState[attackingPlayer].health += damageDealt
      GameLogger.action(`${attacker.name} lifelink heals for ${damageDealt}`)
    }
  }
}

// Singleton instance
export const combatService = new CombatService()
