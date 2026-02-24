import { produce } from 'immer'
import { GameLogger } from '@/lib/game_logger'
import type {
  Card,
  CardEffect,
  EffectContext,
  EffectResult,
  GameEvent,
  GameState,
  TriggeredAbility,
} from '@/schemas/schema'
import { parseAbilityDescription } from '@/services/ability_parser'
import type { ParsedAction } from '@/services/ability_parser'
import { effectStackService } from '@/services/effect_stack_service'
import { eventManager } from '@/services/event_manager'
import { useGameStore } from '@/store/game_store'

// ================================
// ABILITY PRIORITY LEVELS
// ================================
export const ABILITY_PRIORITIES = {
  REPLACEMENT_EFFECT: 1000, // Effects that replace other effects
  TRIGGERED_ABILITY: 500, // Standard triggered abilities
  STATE_BASED_ACTION: 250, // Automatic game state checks
  PERSISTENT_EFFECT: 100, // Ongoing stat modifications
  UI_UPDATE: 0, // Lowest priority - UI updates
} as const

// ================================
// EFFECT EXECUTOR TYPES
// ================================
export type EffectExecutor = (
  effect: CardEffect,
  context: EffectContext,
  params: EffectParams,
) => EffectResult

export interface EffectParams {
  amount?: number
  targetType?: 'player' | 'unit' | 'all_units' | 'all_enemies' | 'all_allies'
  targetId?: string
  duration?: number
  statModifiers?: { attack?: number; health?: number }
  keyword?: string
}

// ================================
// EFFECT EXECUTORS REGISTRY
// ================================
const effectExecutors: Record<string, EffectExecutor> = {
  dealDamage: (effect, context, params) => {
    const { amount = 1, targetType = 'player', targetId } = params
    const gameState = context.gameState
    const sourceOwner = context.source.owner || gameState.activePlayer

    const newState = produce(gameState, draft => {
      if (targetType === 'player') {
        const targetPlayer = sourceOwner === 'player1' ? 'player2' : 'player1'
        draft[targetPlayer].health -= amount
        GameLogger.action(`${effect.name}: Dealt ${amount} damage to ${targetPlayer}`)
      } else if (targetType === 'unit' && targetId) {
        // Find and damage the unit
        for (let i = 0; i < 7; i++) {
          if (draft.battlefield.playerUnits[i]?.id === targetId) {
            const unit = draft.battlefield.playerUnits[i]!
            unit.currentHealth = (unit.currentHealth || unit.health) - amount
            if (unit.currentHealth <= 0) {
              draft.battlefield.playerUnits[i] = null
            }
            GameLogger.action(`${effect.name}: Dealt ${amount} damage to ${unit.name}`)
            break
          }
          if (draft.battlefield.enemyUnits[i]?.id === targetId) {
            const unit = draft.battlefield.enemyUnits[i]!
            unit.currentHealth = (unit.currentHealth || unit.health) - amount
            if (unit.currentHealth <= 0) {
              draft.battlefield.enemyUnits[i] = null
            }
            GameLogger.action(`${effect.name}: Dealt ${amount} damage to ${unit.name}`)
            break
          }
        }
      } else if (targetType === 'all_enemies') {
        const enemyUnits =
          sourceOwner === 'player1' ? draft.battlefield.enemyUnits : draft.battlefield.playerUnits
        for (let i = 0; i < enemyUnits.length; i++) {
          const unit = enemyUnits[i]
          if (unit) {
            unit.currentHealth = (unit.currentHealth || unit.health) - amount
            if (unit.currentHealth <= 0) {
              enemyUnits[i] = null
            }
          }
        }
        GameLogger.action(`${effect.name}: Dealt ${amount} damage to all enemy units`)
      }
    })

    return { success: true, newGameState: newState }
  },

  gainHealth: (effect, context, params) => {
    const { amount = 1, targetType = 'player' } = params
    const gameState = context.gameState
    const sourceOwner = context.source.owner || gameState.activePlayer

    const newState = produce(gameState, draft => {
      if (targetType === 'player') {
        draft[sourceOwner].health += amount
        GameLogger.action(`${effect.name}: ${sourceOwner} gained ${amount} health`)
      } else if (targetType === 'unit') {
        // Heal the source unit
        const units =
          sourceOwner === 'player1' ? draft.battlefield.playerUnits : draft.battlefield.enemyUnits
        for (const unit of units) {
          if (unit?.id === context.source.id) {
            unit.currentHealth = Math.min((unit.currentHealth || unit.health) + amount, unit.health)
            GameLogger.action(`${effect.name}: ${unit.name} healed for ${amount}`)
            break
          }
        }
      }
    })

    return { success: true, newGameState: newState }
  },

  drawCards: (effect, context, params) => {
    const { amount = 1 } = params
    const gameState = context.gameState
    const sourceOwner = context.source.owner || gameState.activePlayer

    const newState = produce(gameState, draft => {
      const player = draft[sourceOwner]
      const cardsToDraw = Math.min(amount, player.deck.length)

      for (let i = 0; i < cardsToDraw; i++) {
        const drawnCard = player.deck.shift()
        if (drawnCard) {
          // Set random orientation
          drawnCard.isReversed = Math.random() < 0.5
          player.hand.push(drawnCard)
        }
      }

      GameLogger.action(`${effect.name}: ${sourceOwner} drew ${cardsToDraw} card(s)`)
    })

    return { success: true, newGameState: newState }
  },

  statBuff: (effect, context, params) => {
    const { statModifiers = {}, targetId } = params
    const { attack = 0, health = 0 } = statModifiers
    const gameState = context.gameState

    const newState = produce(gameState, draft => {
      const targetCardId = targetId || context.source.id

      // Find and buff the unit
      for (let i = 0; i < 7; i++) {
        if (draft.battlefield.playerUnits[i]?.id === targetCardId) {
          const unit = draft.battlefield.playerUnits[i]!
          unit.attack += attack
          unit.health += health
          unit.currentHealth = (unit.currentHealth || unit.health) + health
          GameLogger.action(`${effect.name}: ${unit.name} gained +${attack}/+${health}`)
          break
        }
        if (draft.battlefield.enemyUnits[i]?.id === targetCardId) {
          const unit = draft.battlefield.enemyUnits[i]!
          unit.attack += attack
          unit.health += health
          unit.currentHealth = (unit.currentHealth || unit.health) + health
          GameLogger.action(`${effect.name}: ${unit.name} gained +${attack}/+${health}`)
          break
        }
      }
    })

    return { success: true, newGameState: newState }
  },

  discardCards: (effect, context, params) => {
    const { amount = 1 } = params
    const gameState = context.gameState
    const sourceOwner = context.source.owner || gameState.activePlayer

    const newState = produce(gameState, draft => {
      const player = draft[sourceOwner]
      const cardsToDiscard = Math.min(amount, player.hand.length)

      // Discard from end of hand (random selection would need UI)
      for (let i = 0; i < cardsToDiscard; i++) {
        player.hand.pop()
      }

      GameLogger.action(`${effect.name}: ${sourceOwner} discarded ${cardsToDiscard} card(s)`)
    })

    return { success: true, newGameState: newState }
  },

  summonUnit: (effect, context, params) => {
    // Summon a token unit - simplified implementation
    const gameState = context.gameState
    const sourceOwner = context.source.owner || gameState.activePlayer

    const newState = produce(gameState, draft => {
      const units =
        sourceOwner === 'player1' ? draft.battlefield.playerUnits : draft.battlefield.enemyUnits

      // Find empty slot
      const emptySlot = units.indexOf(null)
      if (emptySlot !== -1) {
        // Create a basic token
        units[emptySlot] = {
          id: `token_${Date.now()}`,
          name: 'Token',
          cost: 0,
          attack: params.statModifiers?.attack || 1,
          health: params.statModifiers?.health || 1,
          currentHealth: params.statModifiers?.health || 1,
          type: 'unit',
          zodiacClass: 'aries',
          element: 'fire',
          rarity: 'common',
          owner: sourceOwner,
          hasSummoningSickness: true,
          hasAttackedThisTurn: false,
        }
        GameLogger.action(`${effect.name}: Summoned a token`)
      }
    })

    return { success: true, newGameState: newState }
  },

  destroyUnit: (effect, context, params) => {
    const { targetId } = params
    const gameState = context.gameState

    if (!targetId) {
      return { success: false, error: 'No target specified' }
    }

    const newState = produce(gameState, draft => {
      for (let i = 0; i < 7; i++) {
        if (draft.battlefield.playerUnits[i]?.id === targetId) {
          const unit = draft.battlefield.playerUnits[i]!
          GameLogger.action(`${effect.name}: Destroyed ${unit.name}`)
          draft.battlefield.playerUnits[i] = null
          break
        }
        if (draft.battlefield.enemyUnits[i]?.id === targetId) {
          const unit = draft.battlefield.enemyUnits[i]!
          GameLogger.action(`${effect.name}: Destroyed ${unit.name}`)
          draft.battlefield.enemyUnits[i] = null
          break
        }
      }
    })

    return { success: true, newGameState: newState }
  },

  gainMana: (effect, context, params) => {
    const { amount = 1 } = params
    const gameState = context.gameState
    const sourceOwner = context.source.owner || gameState.activePlayer

    const newState = produce(gameState, draft => {
      draft[sourceOwner].mana = Math.min(10, draft[sourceOwner].mana + amount)
      GameLogger.action(`${effect.name}: ${sourceOwner} gained ${amount} mana`)
    })

    return { success: true, newGameState: newState }
  },

  healAllUnits: (effect, context, params) => {
    const { amount = 1, targetType = 'all_allies' } = params
    const gameState = context.gameState
    const sourceOwner = context.source.owner || gameState.activePlayer

    const newState = produce(gameState, draft => {
      const friendlyUnits =
        sourceOwner === 'player1' ? draft.battlefield.playerUnits : draft.battlefield.enemyUnits
      const enemyUnits =
        sourceOwner === 'player1' ? draft.battlefield.enemyUnits : draft.battlefield.playerUnits

      const unitsToHeal =
        targetType === 'all_units'
          ? [...friendlyUnits, ...enemyUnits]
          : targetType === 'all_enemies'
            ? [...enemyUnits]
            : [...friendlyUnits]

      for (const unit of unitsToHeal) {
        if (unit) {
          unit.currentHealth = Math.min((unit.currentHealth || unit.health) + amount, unit.health)
        }
      }

      GameLogger.action(`${effect.name}: Healed ${targetType} for ${amount}`)
    })

    return { success: true, newGameState: newState }
  },

  damageAllUnits: (effect, context, params) => {
    const { amount = 1, targetType = 'all_units' } = params
    const gameState = context.gameState
    const sourceOwner = context.source.owner || gameState.activePlayer

    const newState = produce(gameState, draft => {
      const friendlyUnits =
        sourceOwner === 'player1' ? draft.battlefield.playerUnits : draft.battlefield.enemyUnits
      const enemyUnits =
        sourceOwner === 'player1' ? draft.battlefield.enemyUnits : draft.battlefield.playerUnits

      const applyDamage = (units: (Card | null)[]) => {
        for (let i = 0; i < units.length; i++) {
          const unit = units[i]
          if (unit) {
            unit.currentHealth = (unit.currentHealth || unit.health) - amount
            if (unit.currentHealth <= 0) {
              units[i] = null
            }
          }
        }
      }

      if (targetType === 'all_units') {
        applyDamage(friendlyUnits)
        applyDamage(enemyUnits)
        draft.player1.health -= amount
        draft.player2.health -= amount
      } else if (targetType === 'all_enemies') {
        applyDamage(enemyUnits)
      } else if (targetType === 'all_allies') {
        applyDamage(friendlyUnits)
      }

      GameLogger.action(`${effect.name}: Dealt ${amount} damage to ${targetType}`)
    })

    return { success: true, newGameState: newState }
  },

  buffAllUnits: (effect, context, params) => {
    const { statModifiers = {}, targetType = 'all_allies' } = params
    const { attack = 0, health = 0 } = statModifiers
    const gameState = context.gameState
    const sourceOwner = context.source.owner || gameState.activePlayer

    const newState = produce(gameState, draft => {
      const friendlyUnits =
        sourceOwner === 'player1' ? draft.battlefield.playerUnits : draft.battlefield.enemyUnits
      const enemyUnits =
        sourceOwner === 'player1' ? draft.battlefield.enemyUnits : draft.battlefield.playerUnits

      const applyBuff = (units: (Card | null)[]) => {
        for (const unit of units) {
          if (unit) {
            unit.attack += attack
            unit.health += health
            unit.currentHealth = (unit.currentHealth || unit.health) + health
          }
        }
      }

      if (targetType === 'all_units') {
        applyBuff(friendlyUnits)
        applyBuff(enemyUnits)
      } else if (targetType === 'all_enemies') {
        applyBuff(enemyUnits)
      } else {
        applyBuff(friendlyUnits)
      }

      GameLogger.action(`${effect.name}: Buffed ${targetType} by +${attack}/+${health}`)
    })

    return { success: true, newGameState: newState }
  },

  destroyAllUnits: (effect, context, params) => {
    const { targetType = 'all_units' } = params
    const gameState = context.gameState
    const sourceOwner = context.source.owner || gameState.activePlayer

    const newState = produce(gameState, draft => {
      if (targetType === 'all_units') {
        draft.battlefield.playerUnits = Array(7).fill(null)
        draft.battlefield.enemyUnits = Array(7).fill(null)
      } else if (targetType === 'all_enemies') {
        const enemyField = sourceOwner === 'player1' ? 'enemyUnits' : 'playerUnits'
        draft.battlefield[enemyField] = Array(7).fill(null)
      } else if (targetType === 'all_allies') {
        const allyField = sourceOwner === 'player1' ? 'playerUnits' : 'enemyUnits'
        draft.battlefield[allyField] = Array(7).fill(null)
      }

      GameLogger.action(`${effect.name}: Destroyed ${targetType}`)
    })

    return { success: true, newGameState: newState }
  },

  addKeyword: (effect, context, params) => {
    const gameState = context.gameState
    const sourceOwner = context.source.owner || gameState.activePlayer
    const keyword = params.keyword || ''

    const newState = produce(gameState, draft => {
      const units =
        sourceOwner === 'player1' ? draft.battlefield.playerUnits : draft.battlefield.enemyUnits

      for (const unit of units) {
        if (unit?.id === context.source.id) {
          if (!unit.keywords) {
            unit.keywords = []
          }
          if (!unit.keywords.includes(keyword)) {
            unit.keywords.push(keyword)
          }
          if (keyword === 'divine shield') {
            unit.divineShield = true
          } else if (keyword === 'ethereal') {
            unit.ethereal = true
          } else if (keyword === 'mystic ward') {
            unit.mysticWard = true
          }
          GameLogger.action(`${effect.name}: ${unit.name} gained ${keyword}`)
          break
        }
      }
    })

    return { success: true, newGameState: newState }
  },
}

export interface ActiveEffect {
  id: string
  sourceCardId: string
  effect: CardEffect
  context: EffectContext
  remainingDuration?: number
  endCondition?: (gameState: GameState) => boolean
}

export interface QueuedEffect {
  id: string
  effect: CardEffect
  context: EffectContext
  priority: number
  triggeringEvent?: GameEvent
}

export class CardEffectSystem {
  private activeEffects: Map<string, ActiveEffect> = new Map()
  private effectQueue: QueuedEffect[] = []
  private cardAbilities: Map<string, TriggeredAbility[]> = new Map()
  private nextEffectId = 1

  constructor() {
    this.setupEventListeners()
  }

  /**
   * Register abilities for a card
   */
  registerCardAbilities(card: Card, abilities: TriggeredAbility[]): void {
    this.cardAbilities.set(card.id, abilities)

    // Subscribe to events for each ability
    for (const ability of abilities) {
      this.subscribeToTrigger(card.id, ability)
    }
  }

  /**
   * Unregister abilities when a card leaves play
   */
  unregisterCardAbilities(cardId: string): void {
    this.cardAbilities.delete(cardId)
    // Event subscriptions will be cleaned up automatically by the EventManager
    // when the card is no longer in play
  }

  /**
   * Execute a card effect immediately
   */
  async executeEffect(
    effect: CardEffect,
    context: EffectContext,
    _triggeringEvent?: GameEvent,
  ): Promise<EffectResult> {
    try {
      // Check if effect can execute
      if (effect.canExecute) {
        // Cast to function type since schema allows any function
        const canExecuteFn = effect.canExecute as (ctx: EffectContext) => boolean
        const canExecuteResult = canExecuteFn(context)
        if (!canExecuteResult) {
          return { success: false, error: 'Effect cannot execute - condition not met' }
        }
      }

      // Try to use the effect's own execute function first
      if (effect.execute) {
        // Cast to function type since schema allows any function
        const executeFn = effect.execute as (ctx: EffectContext) => EffectResult
        const result = executeFn(context)
        if (result.success) {
          // Emit effect triggered event
          eventManager.emitSystemEvent(
            'effect_triggered',
            result.newGameState || context.gameState,
            {
              effectId: effect.id,
              effectName: effect.name,
              sourceCardId: context.source.id,
            },
          )
          return result
        }
      }

      // Try structured ability parser for description-based effects
      const parsedResult = this.executeFromParsedAbility(effect, context)
      if (parsedResult) {
        if (parsedResult.success) {
          eventManager.emitSystemEvent(
            'effect_triggered',
            parsedResult.newGameState || context.gameState,
            {
              effectId: effect.id,
              effectName: effect.name,
              sourceCardId: context.source.id,
            },
          )
        }
        return parsedResult
      }

      // Legacy fallback: match to a registered executor by parsing the effect name/id
      const executorKey = this.matchEffectToExecutor(effect)
      if (executorKey && effectExecutors[executorKey]) {
        const params = this.extractEffectParams(effect)
        const result = effectExecutors[executorKey](effect, context, params)

        // Emit effect triggered event
        if (result.success) {
          eventManager.emitSystemEvent(
            'effect_triggered',
            result.newGameState || context.gameState,
            {
              effectId: effect.id,
              effectName: effect.name,
              sourceCardId: context.source.id,
            },
          )
        }

        return result
      }

      // Fallback: effect executes but does nothing
      GameLogger.debug(`Effect ${effect.name} has no implementation, treating as success`)
      return { success: true, newGameState: context.gameState }
    } catch (error) {
      GameLogger.error(`Error executing effect ${effect.name}:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Execute an effect by parsing its description into structured actions
   * using the ability parser. Returns null if parsing yields no actions.
   */
  private executeFromParsedAbility(
    effect: CardEffect,
    context: EffectContext,
  ): EffectResult | null {
    try {
      const parsed = parseAbilityDescription(effect.description || '')
      if (parsed.actions.length === 0) return null

      let currentState = context.gameState
      for (const action of parsed.actions) {
        const executorName = action.type
        if (effectExecutors[executorName]) {
          const params = this.parsedActionToParams(action)
          const result = effectExecutors[executorName](
            effect,
            { ...context, gameState: currentState },
            params,
          )
          if (result.newGameState) currentState = result.newGameState
        }
      }
      return { success: true, newGameState: currentState }
    } catch {
      return null
    }
  }

  /**
   * Convert a ParsedAction into EffectParams compatible with existing executors.
   */
  private parsedActionToParams(action: ParsedAction): EffectParams {
    const params: EffectParams = {}

    if (action.amount !== undefined) {
      params.amount = action.amount
    }

    // Map ParsedAction target to executor targetType
    if (action.target) {
      switch (action.target) {
        case 'player':
          params.targetType = 'player'
          break
        case 'opponent':
          params.targetType = 'player'
          break
        case 'all_friendly':
          params.targetType = 'all_allies'
          break
        case 'all_enemy':
          params.targetType = 'all_enemies'
          break
        case 'all_units':
          params.targetType = 'all_units'
          break
        case 'any_target':
          params.targetType = 'unit'
          break
        case 'self':
          params.targetType = 'unit'
          break
      }
    }

    if (action.statModifiers) {
      params.statModifiers = action.statModifiers
    }

    // Pass keyword through for addKeyword executor
    if (action.keyword) {
      params.keyword = action.keyword
    }

    return params
  }

  /**
   * Match an effect to an executor based on name/description
   */
  private matchEffectToExecutor(effect: CardEffect): string | null {
    const name = effect.name.toLowerCase()
    const description = effect.description?.toLowerCase() || ''

    if (
      name.includes('damage') ||
      (description.includes('deal') && description.includes('damage'))
    ) {
      return 'dealDamage'
    }
    if (name.includes('heal') || (description.includes('gain') && description.includes('health'))) {
      return 'gainHealth'
    }
    if (name.includes('draw') || description.includes('draw')) {
      return 'drawCards'
    }
    if (
      name.includes('buff') ||
      (description.includes('+') &&
        (description.includes('attack') || description.includes('health')))
    ) {
      return 'statBuff'
    }
    if (name.includes('discard') || description.includes('discard')) {
      return 'discardCards'
    }
    if (name.includes('summon') || description.includes('summon')) {
      return 'summonUnit'
    }
    if (name.includes('destroy') || description.includes('destroy')) {
      return 'destroyUnit'
    }
    if (name.includes('mana') || (description.includes('gain') && description.includes('mana'))) {
      return 'gainMana'
    }

    return null
  }

  /**
   * Extract effect parameters from effect definition
   */
  private extractEffectParams(effect: CardEffect): EffectParams {
    const params: EffectParams = {}
    const description = effect.description?.toLowerCase() || ''

    // Extract number for amount
    const numberMatch = description.match(/(\d+)/)
    if (numberMatch) {
      params.amount = parseInt(numberMatch[1], 10)
    }

    // Extract target type
    if (description.includes('enemy') || description.includes('opponent')) {
      params.targetType = description.includes('all') ? 'all_enemies' : 'unit'
    } else if (description.includes('ally') || description.includes('friendly')) {
      params.targetType = description.includes('all') ? 'all_allies' : 'unit'
    } else if (description.includes('player') || description.includes('face')) {
      params.targetType = 'player'
    }

    // Extract stat modifiers for buffs
    const attackMatch = description.match(/\+(\d+)\s*attack|\+(\d+)\//)
    const healthMatch = description.match(/\+(\d+)\s*health|\/\+(\d+)/)
    if (attackMatch || healthMatch) {
      params.statModifiers = {
        attack: attackMatch ? parseInt(attackMatch[1] || attackMatch[2], 10) : 0,
        health: healthMatch ? parseInt(healthMatch[1] || healthMatch[2], 10) : 0,
      }
    }

    return params
  }

  /**
   * Queue an effect for later resolution (for stack-based resolution)
   */
  queueEffect(
    effect: CardEffect,
    context: EffectContext,
    priority: number = 0,
    triggeringEvent?: GameEvent,
  ): string {
    const queuedEffect: QueuedEffect = {
      id: `queued_${this.nextEffectId++}`,
      effect,
      context,
      priority,
      triggeringEvent,
    }

    this.effectQueue.push(queuedEffect)
    this.sortEffectQueue()

    return queuedEffect.id
  }

  /**
   * Queue an effect on the effect stack (uses EffectStackService if available)
   */
  queueEffectOnStack(
    effect: CardEffect,
    context: EffectContext,
    options: {
      priority?: number
      sourcePlayerId: 'player1' | 'player2'
      sourceCardId?: string
      canBeCountered?: boolean
      triggeringEvent?: GameEvent
    },
  ): string {
    // Use EffectStackService for proper stack resolution
    return effectStackService.addToStack(effect, context, {
      type: 'ability',
      ...options,
    })
  }

  /**
   * Resolve all queued effects (stack resolution)
   */
  async resolveEffectStack(): Promise<EffectResult[]> {
    const results: EffectResult[] = []

    while (this.effectQueue.length > 0) {
      const queuedEffect = this.effectQueue.shift()!
      const result = await this.executeEffect(
        queuedEffect.effect,
        queuedEffect.context,
        queuedEffect.triggeringEvent,
      )
      results.push(result)

      // If an effect modified the game state, update contexts of remaining effects
      if (result.newGameState) {
        this.updateQueuedEffectContexts(result.newGameState)
      }
    }

    return results
  }

  /**
   * Process triggered abilities for an event
   */
  async processTriggeredAbilities(event: GameEvent): Promise<void> {
    const triggeredAbilities: Array<{
      cardId: string
      ability: TriggeredAbility
      context: EffectContext
    }> = []

    // Find all abilities that trigger on this event
    for (const [cardId, abilities] of this.cardAbilities.entries()) {
      for (const ability of abilities) {
        if (this.shouldTriggerAbility(ability, event)) {
          // Get the card from the game state
          const card = this.findCardInGameState(cardId, event)
          if (card) {
            const context: EffectContext = {
              gameState: this.getGameStateFromEvent(event),
              source: card,
              event,
            }

            triggeredAbilities.push({
              cardId,
              ability,
              context,
            })
          }
        }
      }
    }

    // Sort by priority and execute
    triggeredAbilities.sort(
      (a, b) =>
        (b.ability.effect.type === 'instant' ? 1 : 0) -
        (a.ability.effect.type === 'instant' ? 1 : 0),
    )

    for (const triggered of triggeredAbilities) {
      if (triggered.ability.optional) {
        // For optional abilities, we'd need UI interaction
        // For now, always trigger non-optional abilities
        continue
      }

      await this.executeEffect(triggered.ability.effect, triggered.context, event)
    }
  }

  /**
   * Update persistent effects (called each turn/phase)
   */
  updatePersistentEffects(gameState: GameState): GameState {
    const expiredEffects: string[] = []

    // Check each active effect
    for (const [effectId, activeEffect] of this.activeEffects.entries()) {
      // Decrement duration counters
      if (activeEffect.remainingDuration !== undefined) {
        activeEffect.remainingDuration--
        if (activeEffect.remainingDuration <= 0) {
          expiredEffects.push(effectId)
          continue
        }
      }

      // Check end conditions
      if (activeEffect.endCondition?.(gameState)) {
        expiredEffects.push(effectId)
        continue
      }

      // Check effect duration type
      const effect = activeEffect.effect
      if (effect.duration === 'end_of_turn') {
        expiredEffects.push(effectId)
      } else if (effect.duration === 'until_leaves_battlefield') {
        // Check if source card is still on battlefield
        const sourceOnField = this.isCardOnBattlefield(activeEffect.sourceCardId, gameState)
        if (!sourceOnField) {
          expiredEffects.push(effectId)
        }
      }
    }

    // Remove expired effects
    for (const effectId of expiredEffects) {
      const effect = this.activeEffects.get(effectId)
      if (effect) {
        GameLogger.action(`Persistent effect expired: ${effect.effect.name}`)
        this.activeEffects.delete(effectId)
      }
    }

    // Apply ongoing stat modifications from persistent effects
    return produce(gameState, _draft => {
      for (const _activeEffect of this.activeEffects.values()) {
        // Re-apply persistent stat buffs (this ensures they stay applied)
        // The actual stat application would be done when calculating combat
      }
    })
  }

  /**
   * Check if a card is on the battlefield
   */
  private isCardOnBattlefield(cardId: string, gameState: GameState): boolean {
    const allUnits = [
      ...gameState.battlefield.playerUnits,
      ...gameState.battlefield.enemyUnits,
    ].filter(Boolean) as Card[]

    return allUnits.some(unit => unit.id === cardId)
  }

  /**
   * Add a persistent effect
   */
  addPersistentEffect(
    sourceCardId: string,
    effect: CardEffect,
    context: EffectContext,
    duration?: number,
  ): string {
    const effectId = `persistent_${this.nextEffectId++}`

    this.activeEffects.set(effectId, {
      id: effectId,
      sourceCardId,
      effect,
      context,
      remainingDuration: duration,
    })

    GameLogger.action(`Added persistent effect: ${effect.name} (${effectId})`)
    return effectId
  }

  /**
   * Remove a persistent effect by ID
   */
  removePersistentEffect(effectId: string): boolean {
    const hadEffect = this.activeEffects.has(effectId)
    this.activeEffects.delete(effectId)
    return hadEffect
  }

  /**
   * Get all active effects for debugging
   */
  getActiveEffects(): ActiveEffect[] {
    return Array.from(this.activeEffects.values())
  }

  /**
   * Clear all effects (used when game ends or resets)
   */
  clearAllEffects(): void {
    this.activeEffects.clear()
    this.effectQueue = []
    this.cardAbilities.clear()
  }

  // Private methods

  private setupEventListeners(): void {
    // Listen for turn/phase changes to update persistent effects
    eventManager.subscribe(
      { types: ['turn_start', 'turn_end', 'phase_changed'] },
      async event => {
        const gameState = this.getGameStateFromEvent(event)
        this.updatePersistentEffects(gameState)
      },
      { priority: 100 },
    )

    // Listen for card removal events to clean up abilities
    eventManager.subscribe(
      { types: ['card_destroyed', 'unit_dies', 'card_returned_to_hand'] },
      async event => {
        if ((event as unknown as { source?: { type: string; id: string } }).source?.type === 'card') {
          this.unregisterCardAbilities((event as unknown as { source: { id: string } }).source.id)
        }
      },
    )
  }

  private subscribeToTrigger(cardId: string, ability: TriggeredAbility): void {
    const eventTypes = Array.isArray(ability.trigger.event)
      ? ability.trigger.event
      : [ability.trigger.event]

    eventManager.subscribe(
      {
        types: eventTypes,
        condition: event => this.shouldTriggerAbility(ability, event, cardId),
      },
      async event => {
        await this.processTriggeredAbilities(event)
      },
    )
  }

  private shouldTriggerAbility(
    ability: TriggeredAbility,
    event: GameEvent,
    cardId?: string,
  ): boolean {
    const eventTypes = Array.isArray(ability.trigger.event)
      ? ability.trigger.event
      : [ability.trigger.event]

    // Check event type
    if (!eventTypes.includes(event.type)) {
      return false
    }

    // Check filter condition
    if (ability.trigger.filter) {
      try {
        if (!(ability.trigger.filter as (event: GameEvent) => boolean)(event)) {
          return false
        }
      } catch {
        return false
      }
    }

    // Check source/target conditions
    if (ability.trigger.source === 'self' && event.source?.id !== cardId) {
      return false
    }

    if (ability.trigger.target === 'self' && event.target?.id !== cardId) {
      return false
    }

    return true
  }

  private sortEffectQueue(): void {
    this.effectQueue.sort((a, b) => b.priority - a.priority)
  }

  private updateQueuedEffectContexts(newGameState: GameState): void {
    for (const queuedEffect of this.effectQueue) {
      queuedEffect.context.gameState = newGameState
    }
  }

  private findCardInGameState(cardId: string, event: GameEvent): Card | null {
    const gameState = this.getGameStateFromEvent(event)

    // Search in all zones (battlefield-only system)
    const allCards = [
      ...gameState.player1.hand,
      ...gameState.player1.deck,
      ...gameState.player2.hand,
      ...gameState.player2.deck,
      ...gameState.battlefield.playerUnits.filter(Boolean),
      ...gameState.battlefield.enemyUnits.filter(Boolean),
    ].filter(Boolean) as Card[]

    return allCards.find(card => card.id === cardId) || null
  }

  private getGameStateFromEvent(event: GameEvent): GameState {
    // First try to extract game state from event data
    if (event.data && 'gameState' in event.data) {
      return event.data.gameState as GameState
    }

    // Get current game state from the store
    const { gameState } = useGameStore.getState()
    if (gameState) {
      return gameState
    }

    // Final fallback: create a minimal game state for processing
    // This should rarely be needed now
    GameLogger.warn('getGameStateFromEvent: No game state available, using minimal fallback')
    return {
      round: 1,
      turn: 1,
      activePlayer: 'player1' as const,
      attackingPlayer: null,
      phase: 'action' as const,
      waitingForAction: false,
      combatResolved: false,
      passCount: 0,
      canRespond: false,
      player1: {
        id: 'player1',
        name: 'Player 1',
        health: 20,
        mana: 1,
        maxMana: 1,
        spellMana: 0,
        hand: [],
        deck: [],
        hasAttackToken: false,
        mulliganComplete: true,
        selectedForMulligan: [],
        hasPassed: false,
        actionsThisTurn: 0,
      },
      player2: {
        id: 'player2',
        name: 'Player 2',
        health: 20,
        mana: 1,
        maxMana: 1,
        spellMana: 0,
        hand: [],
        deck: [],
        hasAttackToken: false,
        mulliganComplete: true,
        selectedForMulligan: [],
        hasPassed: false,
        actionsThisTurn: 0,
      },
      battlefield: {
        playerUnits: Array(7).fill(null),
        enemyUnits: Array(7).fill(null),
        maxSlots: 7,
      },
    }
  }
}

// Singleton instance
export const cardEffectSystem = new CardEffectSystem()

// Helper functions for creating common effects
export const createEffect = {
  dealDamage: (
    amount: number,
    targetType: 'player' | 'unit' | 'all_enemies' = 'player',
  ): CardEffect => ({
    id: `deal_damage_${amount}_${targetType}`,
    name: `Deal ${amount} Damage`,
    description: `Deal ${amount} damage to ${targetType === 'all_enemies' ? 'all enemy units' : `target ${targetType}`}`,
    type: 'instant',
    execute: (context: EffectContext) => {
      return effectExecutors.dealDamage(
        {
          id: `deal_damage_${amount}`,
          name: `Deal ${amount} Damage`,
          description: '',
          type: 'instant',
          execute: () => ({ success: true }),
        },
        context,
        { amount, targetType },
      )
    },
  }),

  gainHealth: (amount: number, targetType: 'player' | 'unit' = 'player'): CardEffect => ({
    id: `gain_health_${amount}`,
    name: `Gain ${amount} Health`,
    description: `Gain ${amount} health`,
    type: 'instant',
    execute: (context: EffectContext) => {
      return effectExecutors.gainHealth(
        {
          id: `gain_health_${amount}`,
          name: `Gain ${amount} Health`,
          description: '',
          type: 'instant',
          execute: () => ({ success: true }),
        },
        context,
        { amount, targetType },
      )
    },
  }),

  drawCards: (amount: number): CardEffect => ({
    id: `draw_${amount}`,
    name: `Draw ${amount} Cards`,
    description: `Draw ${amount} card${amount > 1 ? 's' : ''}`,
    type: 'instant',
    execute: (context: EffectContext) => {
      return effectExecutors.drawCards(
        {
          id: `draw_${amount}`,
          name: `Draw Cards`,
          description: '',
          type: 'instant',
          execute: () => ({ success: true }),
        },
        context,
        { amount },
      )
    },
  }),

  statBuff: (
    attack: number,
    health: number,
    duration: CardEffect['duration'] = 'permanent',
  ): CardEffect => ({
    id: `buff_${attack}_${health}`,
    name: `+${attack}/+${health}`,
    description: `Give +${attack} attack and +${health} health`,
    type: 'persistent',
    duration,
    execute: (context: EffectContext) => {
      return effectExecutors.statBuff(
        {
          id: `buff_${attack}_${health}`,
          name: `+${attack}/+${health}`,
          description: '',
          type: 'persistent',
          execute: () => ({ success: true }),
        },
        context,
        { statModifiers: { attack, health } },
      )
    },
  }),

  discardCards: (amount: number): CardEffect => ({
    id: `discard_${amount}`,
    name: `Discard ${amount} Cards`,
    description: `Discard ${amount} card${amount > 1 ? 's' : ''}`,
    type: 'instant',
    execute: (context: EffectContext) => {
      return effectExecutors.discardCards(
        {
          id: `discard_${amount}`,
          name: `Discard Cards`,
          description: '',
          type: 'instant',
          execute: () => ({ success: true }),
        },
        context,
        { amount },
      )
    },
  }),

  summonToken: (attack: number, health: number): CardEffect => ({
    id: `summon_${attack}_${health}`,
    name: `Summon ${attack}/${health} Token`,
    description: `Summon a ${attack}/${health} token`,
    type: 'instant',
    execute: (context: EffectContext) => {
      return effectExecutors.summonUnit(
        {
          id: `summon_${attack}_${health}`,
          name: `Summon Token`,
          description: '',
          type: 'instant',
          execute: () => ({ success: true }),
        },
        context,
        { statModifiers: { attack, health } },
      )
    },
  }),

  destroyUnit: (targetId?: string): CardEffect => ({
    id: `destroy_unit`,
    name: 'Destroy Unit',
    description: 'Destroy target unit',
    type: 'instant',
    execute: (context: EffectContext) => {
      return effectExecutors.destroyUnit(
        {
          id: 'destroy_unit',
          name: 'Destroy Unit',
          description: '',
          type: 'instant',
          execute: () => ({ success: true }),
        },
        context,
        { targetId },
      )
    },
  }),

  gainMana: (amount: number): CardEffect => ({
    id: `gain_mana_${amount}`,
    name: `Gain ${amount} Mana`,
    description: `Gain ${amount} mana`,
    type: 'instant',
    execute: (context: EffectContext) => {
      return effectExecutors.gainMana(
        {
          id: `gain_mana_${amount}`,
          name: `Gain Mana`,
          description: '',
          type: 'instant',
          execute: () => ({ success: true }),
        },
        context,
        { amount },
      )
    },
  }),
}
