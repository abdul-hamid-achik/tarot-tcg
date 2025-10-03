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
import { effectStackService } from '@/services/effect_stack_service'
import { eventManager } from '@/services/event_manager'
import { useGameStore } from '@/store/game_store'

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
    _effect: CardEffect,
    context: EffectContext,
    _triggeringEvent?: GameEvent,
  ): Promise<EffectResult> {
    // TODO: Complete effect system integration for battlefield system
    GameLogger.warn('Card effect system temporarily disabled during battlefield conversion')
    return {
      success: true,
      newGameState: context.gameState,
    }
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
    // TODO: Complete persistent effects integration for battlefield system
    GameLogger.warn('Persistent effects temporarily disabled during battlefield conversion')
    return gameState
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
        if ((event as any).source?.type === 'card') {
          this.unregisterCardAbilities((event as any).source.id)
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
        if (!(ability.trigger.filter as (event: any) => boolean)(event)) {
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
  dealDamage: (amount: number, target: 'player' | 'unit' = 'player'): CardEffect => ({
    id: `deal_damage_${amount}`,
    name: `Deal ${amount} Damage`,
    description: `Deal ${amount} damage to target ${target}`,
    type: 'instant',
    execute: (context: EffectContext) => {
      // Implementation would go here
      return { success: true, newGameState: context.gameState }
    },
  }),

  gainHealth: (amount: number): CardEffect => ({
    id: `gain_health_${amount}`,
    name: `Gain ${amount} Health`,
    description: `Gain ${amount} health`,
    type: 'instant',
    execute: (context: EffectContext) => {
      // Implementation would go here
      return { success: true, newGameState: context.gameState }
    },
  }),

  drawCards: (amount: number): CardEffect => ({
    id: `draw_${amount}`,
    name: `Draw ${amount} Cards`,
    description: `Draw ${amount} card${amount > 1 ? 's' : ''}`,
    type: 'instant',
    execute: (context: EffectContext) => {
      // Implementation would go here
      return { success: true, newGameState: context.gameState }
    },
  }),

  statBuff: (
    attack: number,
    health: number,
    duration: CardEffect['duration'] = 'permanent',
  ): CardEffect => ({
    id: `buff_${attack}_${health}`,
    name: `+${attack}/+${health}`,
    description: `Give +${attack}/+${health}`,
    type: 'persistent',
    duration,
    execute: (context: EffectContext) => {
      // Implementation would go here
      return { success: true, newGameState: context.gameState }
    },
  }),
}
