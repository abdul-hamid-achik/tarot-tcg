import { GameLogger } from '@/lib/game_logger'
import { RingBuffer } from '@/lib/ring_buffer'
import type {
  EventData,
  EventFilter,
  EventListener,
  EventSubscription,
  GameEvent,
  GameEventType,
  GameState,
} from '@/schemas/schema'

export class EventManager {
  private subscriptions: Map<string, EventSubscription> = new Map()
  private eventHistory: RingBuffer<GameEvent>
  private nextSubscriptionId = 1
  private isProcessingEvents = false
  private eventQueue: GameEvent[] = []

  constructor(maxHistorySize: number = 1000) {
    this.eventHistory = new RingBuffer(maxHistorySize)
  }

  /**
   * Subscribe to game events with optional filtering
   */
  subscribe(
    filter: EventFilter,
    listener: EventListener,
    options: { priority?: number; once?: boolean } = {},
  ): string {
    const subscription: EventSubscription = {
      id: `sub_${this.nextSubscriptionId++}`,
      filter,
      listener,
      priority: options.priority ?? 0,
      once: options.once ?? false,
    }

    this.subscriptions.set(subscription.id, subscription)
    return subscription.id
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(subscriptionId: string): boolean {
    return this.subscriptions.delete(subscriptionId)
  }

  /**
   * Emit a game event to all matching listeners
   */
  async emit(
    type: GameEventType,
    gameState: GameState,
    data: EventData,
    source?: GameEvent['source'],
    target?: GameEvent['target'],
  ): Promise<void> {
    const event: GameEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      timestamp: Date.now(),
      gameStateId: `${gameState.round}_${gameState.turn}`,
      source,
      target,
      data,
      phase: gameState.phase,
      activePlayer: gameState.activePlayer,
      turn: gameState.turn,
      round: gameState.round,
    }

    // Add to history
    this.addToHistory(event)

    // Queue event if we're currently processing events (prevents recursion issues)
    if (this.isProcessingEvents) {
      this.eventQueue.push(event)
      return
    }

    await this.processEvent(event)

    // Process any queued events
    while (this.eventQueue.length > 0) {
      const queuedEvent = this.eventQueue.shift()!
      await this.processEvent(queuedEvent)
    }
  }

  private async processEvent(event: GameEvent): Promise<void> {
    this.isProcessingEvents = true

    try {
      // Find all matching subscriptions
      const matchingSubscriptions = this.getMatchingSubscriptions(event)

      // Sort by priority (higher priority first)
      matchingSubscriptions.sort((a, b) => b.priority - a.priority)

      // Execute listeners
      for (const subscription of matchingSubscriptions) {
        try {
          await subscription.listener(event)

          // Remove one-time subscriptions
          if (subscription.once) {
            this.subscriptions.delete(subscription.id)
          }
        } catch (error) {
          GameLogger.error(`Error in event listener ${subscription.id}:`, error)
        }
      }
    } finally {
      this.isProcessingEvents = false
    }
  }

  private getMatchingSubscriptions(event: GameEvent): EventSubscription[] {
    const matching: EventSubscription[] = []

    for (const subscription of this.subscriptions.values()) {
      if (this.eventMatchesFilter(event, subscription.filter)) {
        matching.push(subscription)
      }
    }

    return matching
  }

  private eventMatchesFilter(event: GameEvent, filter: EventFilter): boolean {
    // Check event types
    if (filter.types && !filter.types.includes(event.type)) {
      return false
    }

    // Check source filter
    if (filter.source) {
      if (!event.source) return false

      if (filter.source.type && event.source.type !== filter.source.type) {
        return false
      }

      if (filter.source.id && event.source.id !== filter.source.id) {
        return false
      }
    }

    // Check target filter
    if (filter.target) {
      if (!event.target) return false

      if (filter.target.type && event.target.type !== filter.target.type) {
        return false
      }

      if (filter.target.id && event.target.id !== filter.target.id) {
        return false
      }
    }

    // Check custom condition
    if (filter.condition && !filter.condition(event)) {
      return false
    }

    return true
  }

  private addToHistory(event: GameEvent): void {
    // Ring buffer automatically handles max size - O(1) operation
    this.eventHistory.push(event)
  }

  /**
   * Get event history with optional filtering
   */
  getHistory(filter?: Partial<EventFilter>): GameEvent[] {
    if (!filter) {
      return this.eventHistory.toArray()
    }

    return this.eventHistory.filter(event => {
      if (filter.types && !filter.types.includes(event.type)) {
        return false
      }

      if (filter.condition && !filter.condition(event)) {
        return false
      }

      return true
    })
  }

  /**
   * Get the last N events (most recent first)
   * Optionally filter by event type
   */
  getRecentEvents(count: number, type?: GameEventType): GameEvent[] {
    if (type) {
      return this.eventHistory.filter(event => event.type === type).slice(-count)
    }
    return this.eventHistory.getLastN(count)
  }

  /**
   * Get event history length
   */
  getHistoryLength(): number {
    return this.eventHistory.length
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory.clear()
  }

  /**
   * Check if an event occurred recently
   */
  hasRecentEvent(type: GameEventType, withinTurns: number = 1, currentTurn: number): boolean {
    return this.eventHistory.some(
      event => event.type === type && currentTurn - event.turn <= withinTurns,
    )
  }

  /**
   * Get all active subscriptions (for debugging)
   */
  getActiveSubscriptions(): EventSubscription[] {
    return Array.from(this.subscriptions.values())
  }

  /**
   * Clear all subscriptions
   */
  clearSubscriptions(): void {
    this.subscriptions.clear()
  }

  /**
   * Create a helper for subscribing to specific card events
   */
  subscribeToCard(
    cardId: string,
    eventTypes: GameEventType[],
    listener: EventListener,
    options?: { priority?: number; once?: boolean },
  ): string {
    return this.subscribe(
      {
        types: eventTypes,
        source: { type: 'card', id: cardId },
      },
      listener,
      options,
    )
  }

  /**
   * Create a helper for subscribing to player events
   */
  subscribeToPlayer(
    playerId: 'player1' | 'player2',
    eventTypes: GameEventType[],
    listener: EventListener,
    options?: { priority?: number; once?: boolean },
  ): string {
    return this.subscribe(
      {
        types: eventTypes,
        source: { type: 'player', id: playerId },
      },
      listener,
      options,
    )
  }

  /**
   * Emit a card-related event
   */
  async emitCardEvent(
    type: GameEventType,
    gameState: GameState,
    cardId: string,
    cardName: string,
    additionalData: Partial<EventData> = {},
  ): Promise<void> {
    await this.emit(
      type,
      gameState,
      {
        cardId,
        cardName,
        ...additionalData,
      },
      { type: 'card', id: cardId, name: cardName },
    )
  }

  /**
   * Emit a player-related event
   */
  async emitPlayerEvent(
    type: GameEventType,
    gameState: GameState,
    playerId: 'player1' | 'player2',
    additionalData: Partial<EventData> = {},
  ): Promise<void> {
    await this.emit(
      type,
      gameState,
      {
        playerId,
        ...additionalData,
      },
      { type: 'player', id: playerId, name: gameState[playerId].name },
    )
  }

  /**
   * Emit a combat-related event
   */
  async emitCombatEvent(
    type: GameEventType,
    gameState: GameState,
    laneId: number,
    additionalData: Partial<EventData> = {},
  ): Promise<void> {
    await this.emit(
      type,
      gameState,
      {
        laneId,
        ...additionalData,
      },
      { type: 'system', id: 'combat' },
    )
  }

  /**
   * Emit a system event (phase changes, game start/end, etc.)
   */
  async emitSystemEvent(
    type: GameEventType,
    gameState: GameState,
    additionalData: Partial<EventData> = {},
  ): Promise<void> {
    await this.emit(type, gameState, additionalData, { type: 'system', id: 'game' })
  }

  /**
   * Emit an AI action event
   */
  emitAIAction(action: string, data: Record<string, any> = {}): void {
    GameLogger.system(`🤖 AI Action: ${action}`, data)
    // This is just for logging AI actions - no actual event emission needed for now
  }
}

// Singleton instance
export const eventManager = new EventManager()

// Helper functions for common event patterns
export const createEventHelpers = (gameState: GameState) => ({
  // Card events
  cardPlayed: (cardId: string, cardName: string, cost: number) =>
    eventManager.emitCardEvent('card_played', gameState, cardId, cardName, { cost }),

  cardDrawn: (cardId: string, cardName: string) =>
    eventManager.emitCardEvent('card_drawn', gameState, cardId, cardName),

  unitSummoned: (cardId: string, cardName: string, attack: number, health: number) =>
    eventManager.emitCardEvent('unit_summoned', gameState, cardId, cardName, {
      stats: { attack, health, currentHealth: health },
    }),

  unitDies: (cardId: string, cardName: string) =>
    eventManager.emitCardEvent('unit_dies', gameState, cardId, cardName),

  // Player events
  playerLosesHealth: (playerId: 'player1' | 'player2', amount: number, reason: string) =>
    eventManager.emitPlayerEvent('player_loses_health', gameState, playerId, {
      amount,
      reason,
      previousValue: gameState[playerId].health,
      newValue: gameState[playerId].health - amount,
    }),

  playerGainsMana: (playerId: 'player1' | 'player2', amount: number) =>
    eventManager.emitPlayerEvent('player_gains_mana', gameState, playerId, {
      amount,
      resourceType: 'mana' as const,
    }),

  // Turn/phase events
  turnStart: (playerId: 'player1' | 'player2') =>
    eventManager.emitSystemEvent('turn_start', gameState, { playerId }),

  phaseChanged: (fromPhase: string, toPhase: string) =>
    eventManager.emitSystemEvent('phase_changed', gameState, { fromPhase, toPhase }),
})
