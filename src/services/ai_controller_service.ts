import { GameLogger } from '@/lib/game_logger'
import { endTurn } from '@/lib/game_logic'
import type { Card, GameState } from '@/schemas/schema'
import { parseAbilityDescription } from '@/services/ability_parser'
import type { ActionType } from '@/services/ability_parser'
import { type AILevel, type AIPersonality, aiService } from './ai_service'
import { battlefieldService } from './battlefield_service'
import { eventManager } from './event_manager'

// Simple battlefield helper inlined
function getPlayerUnits(gameState: GameState, playerId: 'player1' | 'player2'): Card[] {
  const units =
    playerId === 'player1' ? gameState.battlefield.playerUnits : gameState.battlefield.enemyUnits
  return units.filter(u => u !== null) as Card[]
}

import { declareAttack } from '@/services/combat_service'

// AI Decision weights for different strategies
interface _DecisionWeights {
  playCard: number
  attack: number
  endTurn: number
  useAbility: number
}

interface CardPlayDecision {
  card: Card
  targetPosition?: { row: number; col: number }
  priority: number
  reasoning: string
}

interface _AttackDecision {
  attackerIds: string[]
  targetPriority: 'nexus' | 'units' | 'mixed' | 'none'
  confidence: number
}

// New direct attack evaluation interface
interface AttackEvaluation {
  attackerId: string
  targetType: 'unit' | 'player'
  targetId?: string
  value: number
  reasoning: string
}

// Removed DefenseDecision - using direct attacks only

// Base value scores for each parsed action type
const ACTION_BASE_VALUES: Record<ActionType, number> = {
  dealDamage: 1.5,
  drawCards: 2.0,
  gainHealth: 0.8,
  buffAllUnits: 1.5, // multiplied by stat total, then scales with board
  destroyUnit: 3.0,
  destroyAllUnits: 5.0,
  damageAllUnits: 1.0,
  summonUnit: 2.0,
  discardCards: -1.0, // negative - discard is a penalty
  gainMana: 1.5,
  addKeyword: 1.5,
  healAllUnits: 0.5,
  statBuff: 1.0,
}

/**
 * Get the oriented abilities for a card based on its isReversed state.
 * Falls back to generic abilities if orientation-specific ones are not available.
 */
function getOrientedAbilities(card: Card): { name?: string; description?: string }[] {
  const isReversed = card.isReversed || false

  if (isReversed) {
    if (card.reversedAbilities && card.reversedAbilities.length > 0) {
      return card.reversedAbilities
    }
  } else {
    if (card.uprightAbilities && card.uprightAbilities.length > 0) {
      return card.uprightAbilities
    }
  }

  // Fall back to generic abilities
  return card.abilities || []
}

/**
 * Evaluate the total value of a list of abilities by parsing their descriptions.
 * Returns a numeric score representing how valuable the abilities are.
 */
function evaluateAbilityValue(abilities: { name?: string; description?: string }[]): number {
  if (!abilities || abilities.length === 0) return 0

  let totalValue = 0

  for (const ability of abilities) {
    if (!ability.description) continue

    const parsed = parseAbilityDescription(ability.description)

    for (const action of parsed.actions) {
      const amount = action.amount ?? 1

      switch (action.type) {
        case 'dealDamage':
          totalValue += amount * ACTION_BASE_VALUES.dealDamage
          break
        case 'drawCards':
          totalValue += amount * ACTION_BASE_VALUES.drawCards
          break
        case 'gainHealth':
          totalValue += amount * ACTION_BASE_VALUES.gainHealth
          break
        case 'buffAllUnits': {
          const statTotal =
            (action.statModifiers?.attack || 0) + (action.statModifiers?.health || 0)
          totalValue += statTotal * ACTION_BASE_VALUES.buffAllUnits
          break
        }
        case 'destroyUnit':
          totalValue += ACTION_BASE_VALUES.destroyUnit
          break
        case 'destroyAllUnits':
          totalValue += ACTION_BASE_VALUES.destroyAllUnits
          break
        case 'damageAllUnits':
          totalValue += amount * ACTION_BASE_VALUES.damageAllUnits
          break
        case 'summonUnit':
          totalValue += ACTION_BASE_VALUES.summonUnit
          break
        case 'discardCards':
          // Negative value for discard
          totalValue += amount * ACTION_BASE_VALUES.discardCards
          break
        case 'gainMana':
          totalValue += amount * ACTION_BASE_VALUES.gainMana
          break
        case 'addKeyword':
          totalValue += ACTION_BASE_VALUES.addKeyword
          break
        case 'healAllUnits':
          totalValue += (amount || 1) * ACTION_BASE_VALUES.healAllUnits
          break
        case 'statBuff': {
          const buffTotal =
            (action.statModifiers?.attack || 0) + (action.statModifiers?.health || 0)
          totalValue += buffTotal * ACTION_BASE_VALUES.statBuff
          break
        }
      }
    }
  }

  return totalValue
}

/**
 * Context-aware ability valuation that adjusts scores based on the board state.
 * Used at hard+ difficulty for smarter card evaluation.
 */
function evaluateAbilityValueWithContext(
  abilities: { name?: string; description?: string }[],
  gameState: GameState,
): number {
  if (!abilities || abilities.length === 0) return 0

  const myUnits = getPlayerUnits(gameState, 'player2').length
  const oppUnits = getPlayerUnits(gameState, 'player1').length
  const handSize = gameState.player2.hand.length

  // Check how many friendly units are at full health
  const myUnitsList = getPlayerUnits(gameState, 'player2')
  const damagedUnits = myUnitsList.filter(
    u => (u.currentHealth ?? u.health) < u.health,
  ).length

  let totalValue = 0

  for (const ability of abilities) {
    if (!ability.description) continue

    const parsed = parseAbilityDescription(ability.description)

    for (const action of parsed.actions) {
      const amount = action.amount ?? 1

      switch (action.type) {
        case 'buffAllUnits': {
          const statTotal =
            (action.statModifiers?.attack || 0) + (action.statModifiers?.health || 0)
          let value = statTotal * ACTION_BASE_VALUES.buffAllUnits
          // Scale with board size: much better with 3+ units
          if (myUnits >= 3) {
            value *= 1.0 + (myUnits - 2) * 0.3
          } else if (myUnits <= 1) {
            value *= 0.5 // Not great with 0-1 units
          }
          totalValue += value
          break
        }
        case 'destroyAllUnits': {
          let value = ACTION_BASE_VALUES.destroyAllUnits
          // Better when opponent has more units than we do
          const unitDiff = oppUnits - myUnits
          if (unitDiff > 0) {
            value *= 1.0 + unitDiff * 0.3
          } else if (unitDiff < 0) {
            // We have more units - board wipe hurts us
            value *= Math.max(0.2, 1.0 + unitDiff * 0.3)
          }
          totalValue += value
          break
        }
        case 'drawCards': {
          let value = amount * ACTION_BASE_VALUES.drawCards
          // More valuable when hand is small
          if (handSize < 3) {
            value *= 1.5
          } else if (handSize >= 6) {
            value *= 0.6 // Less valuable with full hand
          }
          totalValue += value
          break
        }
        case 'healAllUnits': {
          let value = (amount || 1) * ACTION_BASE_VALUES.healAllUnits
          // Less valuable if units are at full health
          if (damagedUnits === 0) {
            value *= 0.1 // Nearly worthless at full health
          } else {
            value *= 1.0 + damagedUnits * 0.2
          }
          totalValue += value
          break
        }
        case 'damageAllUnits': {
          let value = amount * ACTION_BASE_VALUES.damageAllUnits
          // Better when opponent has many units
          if (oppUnits >= 3) {
            value *= 1.0 + (oppUnits - 2) * 0.2
          }
          // Worse if we also have many units (friendly fire)
          if (action.target === 'all_units' && myUnits >= 2) {
            value *= 0.7
          }
          totalValue += value
          break
        }
        case 'dealDamage':
          totalValue += amount * ACTION_BASE_VALUES.dealDamage
          break
        case 'gainHealth':
          totalValue += amount * ACTION_BASE_VALUES.gainHealth
          break
        case 'destroyUnit':
          totalValue += ACTION_BASE_VALUES.destroyUnit
          break
        case 'summonUnit':
          totalValue += ACTION_BASE_VALUES.summonUnit
          break
        case 'discardCards':
          totalValue += amount * ACTION_BASE_VALUES.discardCards
          break
        case 'gainMana':
          totalValue += amount * ACTION_BASE_VALUES.gainMana
          break
        case 'addKeyword':
          totalValue += ACTION_BASE_VALUES.addKeyword
          break
        case 'statBuff': {
          const buffTotal =
            (action.statModifiers?.attack || 0) + (action.statModifiers?.health || 0)
          totalValue += buffTotal * ACTION_BASE_VALUES.statBuff
          break
        }
      }
    }
  }

  return totalValue
}

export class AIControllerService {
  private currentPersonality: AIPersonality = aiService.getCurrentPersonality()

  // Main entry point for AI turn execution
  async executeAITurn(gameState: GameState): Promise<GameState> {
    GameLogger.ai('🤖 AI executeAITurn called with:', {
      activePlayer: gameState.activePlayer,
      phase: gameState.phase,
      aiHand: gameState.player2.hand.map(c => ({ name: c.name, cost: c.cost, type: c.type })),
      aiMana: gameState.player2.mana,
      battlefield: {
        playerUnits: gameState.battlefield.playerUnits.filter(u => u !== null).length,
        enemyUnits: gameState.battlefield.enemyUnits.filter(u => u !== null).length,
      },
    })

    if (gameState.activePlayer !== 'player2') {
      GameLogger.warn('executeAITurn called when not AI turn')
      return gameState
    }

    // this.turnStartTime = Date.now() // TODO: Add performance tracking
    this.currentPersonality = aiService.getCurrentPersonality()
    let currentState = { ...gameState }

    // Log AI thinking
    GameLogger.ai(
      `🤖 ${this.currentPersonality.icon} ${this.currentPersonality.name} is analyzing...`,
    )

    // Phase 1: Mulligan (if needed)
    if (currentState.phase === 'mulligan' && !currentState.player2.mulliganComplete) {
      currentState = this.performMulligan(currentState)
      return currentState
    }

    // Phase 2: Action phase
    if (currentState.phase === 'action') {
      GameLogger.ai('🤖 AI in action phase, executing turn...')

      // Simulate thinking time
      await this.simulateThinking()

      // Make card play decisions
      currentState = await this.executeCardPlays(currentState)
      GameLogger.ai('🤖 AI card plays completed')

      // Small delay between actions for visual clarity
      await new Promise(resolve => setTimeout(resolve, 300))

      // Execute attacks using new evaluation system
      if (currentState[currentState.activePlayer].hasAttackToken) {
        currentState = await this.makeSmartAttackDecision(currentState)
      }
      // The AI will attack via direct unit interactions in future implementation

      // End turn if nothing else to do
      GameLogger.ai(`🤖 ${this.currentPersonality.name} ends turn`)
      eventManager.emitAIAction('ai_end_turn', {
        playerId: 'player2',
        reason: 'No more actions available',
      })

      // Actually end the turn using game logic
      currentState = await endTurn(currentState)
      GameLogger.ai('🤖 AI turn ended')
      return currentState
    }

    // No defense phase in direct attack system - combat resolves immediately

    return currentState
  }

  // Card play logic with strategic evaluation
  private async executeCardPlays(gameState: GameState): Promise<GameState> {
    GameLogger.ai('🤖 AI executeCardPlays starting...')
    let currentState = { ...gameState }
    const decisions = this.evaluateCardPlays(currentState)

    GameLogger.ai(`🤖 AI found ${decisions.length} potential card plays`)

    // Sort by priority and play cards based on personality
    const sortedDecisions = decisions.sort((a, b) => b.priority - a.priority)
    const maxPlays = this.getMaxCardPlays()
    let playsThisTurn = 0

    for (const decision of sortedDecisions) {
      GameLogger.ai(`🤖 AI considering ${decision.card.name} with priority ${decision.priority}`)

      if (playsThisTurn >= maxPlays) {
        GameLogger.ai(`🤖 AI reached max plays (${maxPlays})`)
        break
      }

      // Check if we should play this card based on priority threshold
      if (!this.shouldPlayCard(decision, currentState)) {
        GameLogger.ai(`🤖 AI skipping ${decision.card.name} - priority too low`)
        continue
      }

      // Check mana availability
      const totalMana = currentState.player2.mana + currentState.player2.spellMana
      if (decision.card.cost > totalMana) {
        GameLogger.ai(
          `🤖 AI skipping ${decision.card.name} - insufficient mana (${decision.card.cost} > ${totalMana})`,
        )
        continue
      }

      // Play the card
      GameLogger.ai(`🤖 AI playing ${decision.card.name}`)
      currentState = this.playCard(currentState, decision)
      playsThisTurn++

      GameLogger.ai(`🎴 AI plays ${decision.card.name} - ${decision.reasoning}`)

      // Small delay between card plays
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    if (playsThisTurn > 0) {
      eventManager.emitAIAction('ai_cards_played', {
        playerId: 'player2',
        cardsPlayed: playsThisTurn,
      })
    } else {
      GameLogger.ai('🤖 AI played no cards this turn')
    }

    return currentState
  }

  // Evaluate all playable cards and assign priorities
  private evaluateCardPlays(gameState: GameState): CardPlayDecision[] {
    const player = gameState.player2
    const decisions: CardPlayDecision[] = []

    GameLogger.ai(
      '🤖 AI evaluating cards:',
      player.hand.map(c => ({ name: c.name, cost: c.cost, type: c.type })),
    )
    GameLogger.ai(`🤖 AI mana: ${player.mana}, spell mana: ${player.spellMana}`)
    GameLogger.ai(
      '🤖 AI battlefield slots available:',
      gameState.battlefield.enemyUnits.filter(u => u === null).length,
    )

    for (const card of player.hand) {
      GameLogger.ai(`🤖 AI card properties:`, {
        name: card.name,
        cost: card.cost,
        type: card.type,
        hasType: !!card.type,
        allProps: Object.keys(card),
      })

      const totalMana = player.mana + player.spellMana
      GameLogger.ai(`🤖 AI checking ${card.name}: cost ${card.cost}, available mana ${totalMana}`)

      if (card.cost > totalMana) {
        GameLogger.ai(`🤖 AI skipping ${card.name} - insufficient mana`)
        continue
      }

      // Check if unit cards can be placed (battlefield not full)
      if (card.type === 'unit') {
        const availableSlots = gameState.battlefield.enemyUnits.filter(u => u === null).length
        GameLogger.ai(
          `🤖 AI checking unit placement for ${card.name}, available slots: ${availableSlots}`,
        )
        if (availableSlots === 0) {
          GameLogger.ai(`🤖 AI skipping ${card.name} - no empty battlefield slots`)
          continue
        }
      }

      const priority = this.calculateCardPriority(card, gameState)
      const reasoning = this.getCardPlayReasoning(card, gameState)

      GameLogger.ai(`🤖 AI card ${card.name} priority: ${priority}`)

      decisions.push({
        card,
        priority,
        reasoning,
      })
    }

    GameLogger.ai(`🤖 AI found ${decisions.length} playable cards`)
    return decisions
  }

  // Calculate priority score for a card (0-100)
  private calculateCardPriority(card: Card, gameState: GameState): number {
    let priority = 50 // Base priority

    const _player = gameState.player2
    const _opponent = gameState.player1
    const round = gameState.round

    // Card type considerations
    if (card.type === 'unit') {
      // Board presence evaluation
      const myUnits = getPlayerUnits(gameState, 'player2').length
      const oppUnits = getPlayerUnits(gameState, 'player1').length

      if (myUnits < oppUnits) {
        priority += 20 // Need board presence
      }

      // Unit quality evaluation
      const unitValue = this.evaluateUnitValue(card, gameState)
      priority += unitValue * 20

      // Curve considerations
      if (card.cost === round || card.cost === round + 1) {
        priority += 15 // On curve
      }
    } else if (card.type === 'spell') {
      // Spell evaluation based on board state
      priority += this.evaluateSpellValue(card, gameState) * 25
    }

    // Personality adjustments
    priority = this.applyPersonalityModifier(priority, card, gameState)

    // Add controlled randomness for variety
    priority += (Math.random() - 0.5) * 10 * (1 - this.currentPersonality.mistakeChance)

    return Math.max(0, Math.min(100, priority))
  }

  // Evaluate unit value based on stats, abilities, and board state
  private evaluateUnitValue(card: Card, gameState: GameState): number {
    if (!card.attack && !card.health) {
      // Even a 0/0 unit might have valuable abilities
      const orientedAbilities = getOrientedAbilities(card)
      if (orientedAbilities.length === 0) return 0
    }

    const orientedAbilities = getOrientedAbilities(card)

    // Calculate ability value based on difficulty level
    const useContextAware =
      this.currentPersonality.level === 'hard' || this.currentPersonality.level === 'expert'
    const abilityValue = useContextAware
      ? evaluateAbilityValueWithContext(orientedAbilities, gameState)
      : evaluateAbilityValue(orientedAbilities)

    const stats = (card.attack || 0) + (card.health || 0)
    const totalValue = stats + abilityValue
    const efficiency = totalValue / Math.max(1, card.cost)

    // Check for favorable trades
    let tradeValue = 0

    for (const enemyUnit of getPlayerUnits(gameState, 'player1')) {
      // Skip units that are already dead (currentHealth <= 0)
      const unitHealth = enemyUnit.currentHealth ?? enemyUnit.health ?? 0
      if (unitHealth <= 0) continue
      if ((card.attack || 0) >= unitHealth) {
        tradeValue += 0.2 // Can kill enemy unit
      }
      if ((card.health || 0) > (enemyUnit.attack || 0)) {
        tradeValue += 0.1 // Survives enemy attack
      }
    }

    return Math.min(1, efficiency / 2 + tradeValue)
  }

  // Evaluate spell value based on parsed abilities and board state
  private evaluateSpellValue(card: Card, gameState: GameState): number {
    const orientedAbilities = getOrientedAbilities(card)

    // If the card has parseable abilities, evaluate them
    if (orientedAbilities.length > 0) {
      const useContextAware =
        this.currentPersonality.level === 'hard' || this.currentPersonality.level === 'expert'
      const abilityValue = useContextAware
        ? evaluateAbilityValueWithContext(orientedAbilities, gameState)
        : evaluateAbilityValue(orientedAbilities)

      // Normalize to 0-1 range: a value of 6+ is near max
      const normalizedValue = Math.min(1, Math.max(0, abilityValue / 6))

      // Bonus for removal spells when opponent has dangerous units
      const enemyUnits = getPlayerUnits(gameState, 'player1')
      const needsRemoval = enemyUnits.some(u => (u.attack || 0) >= 4)
      if (needsRemoval && normalizedValue >= 0.4) {
        return Math.min(1, normalizedValue + 0.15)
      }

      return normalizedValue
    }

    // Fallback: no parseable abilities, use old heuristic
    const enemyUnits = getPlayerUnits(gameState, 'player1')
    const hasTargets = enemyUnits.length > 0
    const needsRemoval = enemyUnits.some(u => (u.attack || 0) >= 4)

    if (needsRemoval && card.name.toLowerCase().includes('destroy')) {
      return 0.9
    }

    if (hasTargets && card.name.toLowerCase().includes('damage')) {
      return 0.7
    }

    // Default spell value based on cost
    return Math.min(1, card.cost / 6)
  }

  // Apply personality-specific modifiers to priority
  private applyPersonalityModifier(priority: number, card: Card, gameState: GameState): number {
    switch (this.currentPersonality.playStrategy) {
      case 'aggressive':
        if (card.type === 'unit' && (card.attack || 0) > (card.health || 0)) {
          priority *= 1.3 // Prefer high attack units
        }
        break

      case 'defensive':
        if (card.type === 'unit' && (card.health || 0) > (card.attack || 0)) {
          priority *= 1.3 // Prefer high health units
        }
        break

      case 'tempo':
        if (card.cost <= gameState.round) {
          priority *= 1.2 // Prefer playing on curve
        }
        break

      case 'control':
        if (card.type === 'spell' || card.cost >= 5) {
          priority *= 1.2 // Prefer big cards and spells
        }
        break

      case 'random':
        priority = 50 + Math.random() * 50 // Randomize priority
        break
    }

    // Apply mistake chance
    if (Math.random() < this.currentPersonality.mistakeChance) {
      priority = 100 - priority // Invert priority (play bad cards)
    }

    return priority
  }

  // Determine if we should play a card based on its priority
  private shouldPlayCard(decision: CardPlayDecision, gameState: GameState): boolean {
    const threshold = this.getPlayThreshold()

    // Always play if it's our only option or very high priority
    if (decision.priority >= 80 || gameState.player2.hand.length <= 2) {
      return true
    }

    // Check against personality threshold
    return decision.priority >= threshold
  }

  // Get priority threshold based on personality
  private getPlayThreshold(): number {
    switch (this.currentPersonality.playStrategy) {
      case 'aggressive':
        return 40 // Play more cards
      case 'defensive':
        return 60 // Be selective
      case 'tempo':
        return 45 // Balanced
      case 'control':
        return 55 // Save resources
      case 'random':
        return Math.random() * 100 // Random threshold
      default:
        return 50
    }
  }

  // Get maximum cards to play per turn based on personality
  private getMaxCardPlays(): number {
    switch (this.currentPersonality.level) {
      case 'tutorial':
        return 1
      case 'easy':
        return 2
      case 'normal':
        return 3
      case 'hard':
        return 4
      case 'expert':
        return 5
      default:
        return 3
    }
  }

  // Generate reasoning for card play (for logging/UI)
  private getCardPlayReasoning(card: Card, gameState: GameState): string {
    const reasons: string[] = []

    if (card.type === 'unit') {
      const myUnits = getPlayerUnits(gameState, 'player2').length
      const oppUnits = getPlayerUnits(gameState, 'player1').length

      if (myUnits < oppUnits) {
        reasons.push('need board presence')
      }
      if (card.cost === gameState.round) {
        reasons.push('on curve')
      }
      if ((card.attack || 0) >= 4) {
        reasons.push('strong attacker')
      }
    } else {
      reasons.push('spell value')
    }

    // Add ability reasoning
    const orientedAbilities = getOrientedAbilities(card)
    const abilityScore = evaluateAbilityValue(orientedAbilities)
    if (abilityScore >= 3) {
      reasons.push('strong abilities')
    } else if (abilityScore >= 1.5) {
      reasons.push('useful abilities')
    }

    if (card.isReversed) {
      reasons.push('reversed')
    }

    return reasons.join(', ')
  }

  // Execute card play and update game state
  private playCard(gameState: GameState, decision: CardPlayDecision): GameState {
    GameLogger.ai(`🤖 AI playCard: attempting to play ${decision.card.name}`)
    const newState = { ...gameState }
    const player = {
      ...newState.player2,
      hand: [...newState.player2.hand],
      deck: [...newState.player2.deck],
    }
    const card = decision.card

    // Find first empty slot on the battlefield for AI (player2 uses enemyUnits)
    let targetSlot = -1
    if (card.type === 'unit') {
      GameLogger.ai(`🤖 AI looking for empty slot for unit ${card.name}`)
      for (let i = 0; i < newState.battlefield.enemyUnits.length; i++) {
        if (newState.battlefield.enemyUnits[i] === null) {
          targetSlot = i
          GameLogger.ai(`🤖 AI found empty slot at index ${i}`)
          break
        }
      }

      if (targetSlot === -1) {
        GameLogger.warn(`AI cannot play ${card.name} - battlefield is full`)
        GameLogger.ai('🤖 AI battlefield state:', newState.battlefield.enemyUnits)
        return newState // Return unchanged state
      }
    }

    // Calculate mana payment
    const manaToUse = Math.min(player.mana, card.cost)
    const spellManaToUse = Math.max(0, card.cost - manaToUse)

    // Validate mana availability
    const totalMana = player.mana + player.spellMana
    if (card.cost > totalMana) {
      GameLogger.warn(`AI cannot play ${card.name} - insufficient mana`)
      return newState // Return unchanged state
    }

    // Pay mana
    player.mana -= manaToUse
    player.spellMana -= spellManaToUse

    // Remove from hand
    player.hand = player.hand.filter(c => c.id !== card.id)

    // Add to appropriate zone
    if (card.type === 'unit') {
      // Create the unit with proper properties for battlefield placement
      const unitToPlace: Card = {
        ...card,
        owner: 'player2',
        currentHealth: card.health,
        hasSummoningSickness: true,
        hasAttackedThisTurn: false,
      }

      // Use battlefield service to place unit on battlefield
      const newBattlefield = battlefieldService.placeUnit(
        newState.battlefield,
        unitToPlace,
        'player2',
        targetSlot,
      )
      newState.battlefield = newBattlefield

      // Update state
      newState.player2 = player
      return newState
    } else {
      // Handle spell - effects are resolved immediately
      newState.player2 = player
      return newState
    }
  }

  // NEW: Smart attack decision using evaluation system
  private async makeSmartAttackDecision(gameState: GameState): Promise<GameState> {
    const evaluations = this.evaluateAttacks(gameState)
    let currentState = gameState

    // Execute the best attacks first
    const bestAttacks = evaluations.filter(evaluation => evaluation.value > 0).slice(0, 3) // Top 3 attacks

    for (const attack of bestAttacks) {
      try {
        currentState = await declareAttack(currentState, {
          attackerId: attack.attackerId,
          targetType: attack.targetType,
          targetId: attack.targetId,
        })

        GameLogger.ai(`AI executes attack: ${attack.reasoning} (value: ${attack.value})`)
      } catch (error) {
        GameLogger.ai(`AI attack failed: ${error}`)
      }
    }

    return currentState
  }

  // Direct Attack Evaluation System with ability-aware targeting
  private evaluateAttacks(state: GameState): AttackEvaluation[] {
    const evaluations: AttackEvaluation[] = []
    const myUnits = getPlayerUnits(state, 'player2')
    const enemyUnits = getPlayerUnits(state, 'player1')

    // Check for taunt units - if present, we must attack them
    const tauntUnits = enemyUnits.filter(
      u =>
        u.keywords?.some(k => k.toLowerCase() === 'taunt') &&
        (u.currentHealth ?? u.health) > 0,
    )
    const hasTaunt = tauntUnits.length > 0

    for (const attacker of myUnits) {
      if (!this.canAttack(attacker)) continue

      // Evaluate each enemy unit as target
      for (const target of enemyUnits) {
        const targetHealth = target.currentHealth ?? target.health ?? 0
        if (targetHealth <= 0) continue

        const isTauntTarget = target.keywords?.some(k => k.toLowerCase() === 'taunt') || false
        let value = this.evaluateTrade(attacker, target, state)

        // If there are taunt units, heavily penalize non-taunt targets
        if (hasTaunt && !isTauntTarget) {
          value -= 1000
        }

        evaluations.push({
          attackerId: attacker.id,
          targetType: 'unit',
          targetId: target.id,
          value,
          reasoning: `Trade ${attacker.name} into ${target.name}${isTauntTarget ? ' (taunt)' : ''}`,
        })
      }

      // Evaluate face damage - blocked if taunt is on the field
      let faceValue = this.evaluateFaceDamage(attacker.attack || 0, state.player1.health)
      if (hasTaunt) {
        faceValue -= 1000 // Cannot go face when taunt is present
      }
      evaluations.push({
        attackerId: attacker.id,
        targetType: 'player',
        value: faceValue,
        reasoning: `Deal ${attacker.attack} to face`,
      })
    }

    return evaluations.sort((a, b) => b.value - a.value)
  }

  private evaluateTrade(attacker: Card, target: Card, state: GameState): number {
    const attackerDamage = attacker.attack || 0
    const attackerHealth = attacker.currentHealth ?? attacker.health ?? 0
    const targetHealth = target.currentHealth ?? target.health ?? 0
    const targetDamage = target.attack || 0

    // 1. Does attacker kill target?
    const attackerKillsTarget = attackerDamage >= targetHealth

    // 2. Does target kill attacker?
    const targetKillsAttacker = targetDamage >= attackerHealth

    // 3. Stat values (base)
    const attackerStatValue = (attacker.attack || 0) + (attacker.health || 0)
    const targetStatValue = (target.attack || 0) + (target.health || 0)

    // 4. Include ability value in unit worth assessment at normal+ difficulty
    let attackerTotalValue = attackerStatValue
    let targetTotalValue = targetStatValue

    if (this.currentPersonality.level !== 'tutorial' && this.currentPersonality.level !== 'easy') {
      const attackerAbilities = getOrientedAbilities(attacker)
      const targetAbilities = getOrientedAbilities(target)
      attackerTotalValue += evaluateAbilityValue(attackerAbilities) * 0.5
      targetTotalValue += evaluateAbilityValue(targetAbilities) * 0.5
    }

    let tradeValue = 0

    if (attackerKillsTarget && !targetKillsAttacker) {
      // Favorable trade - attacker survives and kills target
      tradeValue = targetTotalValue * 2
    } else if (attackerKillsTarget && targetKillsAttacker) {
      // Equal trade - both die
      tradeValue = targetTotalValue - attackerTotalValue + 5 // Slight bias towards trading
    } else if (!attackerKillsTarget && targetKillsAttacker) {
      // Bad trade - attacker dies without killing target
      tradeValue = -attackerTotalValue
    } else {
      // Neither dies - evaluate damage dealt vs taken
      const damageDealt = Math.min(attackerDamage, targetHealth)
      const damageTaken = Math.min(targetDamage, attackerHealth)
      tradeValue = damageDealt - damageTaken
    }

    // Priority bonus: low-health high-attack enemy units are priority kill targets
    if (attackerKillsTarget && targetDamage >= 3 && targetHealth <= 3) {
      tradeValue += targetDamage * 1.5 // High-attack threats are priority
    }

    // If attacker has way more attack than needed, consider whether face is better
    // (Only at hard+ difficulty)
    if (
      (this.currentPersonality.level === 'hard' || this.currentPersonality.level === 'expert') &&
      attackerKillsTarget
    ) {
      const overkill = attackerDamage - targetHealth
      if (overkill >= 3 && state.player1.health <= 10) {
        // Significant overkill and opponent is low - face might be better
        // Reduce trade value slightly so face damage can compete
        tradeValue *= 0.8
      }
    }

    // Apply personality modifiers
    if (this.currentPersonality.attackStrategy === 'aggressive') {
      tradeValue *= 1.2
    }

    // Random difficulty uses random attack decisions
    if (this.currentPersonality.attackStrategy === 'random') {
      tradeValue = Math.random() * 20
    }

    return tradeValue
  }

  private evaluateFaceDamage(damage: number, opponentHealth: number): number {
    // Base value is the damage amount
    let value = damage

    // Bonus for potentially lethal damage
    if (damage >= opponentHealth) {
      value += 100 // Winning is priority
    }

    // Bonus for bringing opponent close to death
    if (opponentHealth - damage <= 5) {
      value += 20
    }

    // Apply personality modifiers
    if (this.currentPersonality.attackStrategy === 'aggressive') {
      value *= 1.5 // Aggressive AI prioritizes face damage
    } else if (this.currentPersonality.playStrategy === 'control') {
      value *= 0.8 // Control AI prefers board control
    }

    // Random/cautious AI is less likely to go face strategically
    if (this.currentPersonality.attackStrategy === 'cautious') {
      value *= 0.6 // Cautious AI rarely goes face
    } else if (this.currentPersonality.attackStrategy === 'random') {
      value = Math.random() * damage * 2 // Randomize face damage value
    }

    return value
  }

  // Helper function to check if unit can attack (imported from combat_logic)
  private canAttack(unit: Card): boolean {
    if (!unit) return false
    if (unit.hasSummoningSickness && !unit.keywords?.some(k => k.toLowerCase() === 'charge'))
      return false
    if (unit.hasAttackedThisTurn) return false
    if ((unit.currentHealth ?? unit.health) <= 0) return false
    return true
  }

  // Mulligan logic
  private performMulligan(gameState: GameState): GameState {
    return aiService.performMulligan(gameState)
  }

  // Simulate thinking delay
  private async simulateThinking(): Promise<void> {
    const delay = this.currentPersonality.thinkingTime
    const variation = (Math.random() - 0.5) * 500 // ±250ms variation
    await new Promise(resolve => setTimeout(resolve, Math.max(300, delay + variation)))
  }

  // Set AI difficulty
  setDifficulty(level: AILevel): void {
    aiService.setPersonality(level)
    this.currentPersonality = aiService.getCurrentPersonality()
    GameLogger.ai(`🎮 AI difficulty set to: ${level} - ${this.currentPersonality.name}`)
  }

  // Get current AI info
  getCurrentAI(): AIPersonality {
    return this.currentPersonality
  }

  // Reset AI state
  reset(): void {
    // this.decisionHistory = [] // TODO: Add decision history tracking
    // this.turnStartTime = 0 // TODO: Add performance tracking
    GameLogger.ai('🔄 AI controller reset')
  }
}

// Export singleton instance
export const aiController = new AIControllerService()
