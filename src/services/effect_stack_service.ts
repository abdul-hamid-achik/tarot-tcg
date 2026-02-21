import { GameLogger } from '@/lib/game_logger'
import type { CardEffect, EffectContext, GameEvent, GameState } from '@/schemas/schema'
import { cardEffectSystem } from '@/services/card_effect_system'
import { eventManager } from '@/services/event_manager'

export type StackItemType =
  | 'spell'
  | 'ability'
  | 'triggered_ability'
  | 'state_based'
  | 'replacement_effect'

export type StackResolutionMode = 'lifo' | 'priority' | 'timestamp' | 'custom'

export interface StackItem {
  id: string
  type: StackItemType
  effect: CardEffect
  context: EffectContext

  // Stack positioning
  priority: number
  timestamp: number
  sequenceNumber: number

  // Source information
  sourceCardId?: string
  sourcePlayerId: 'player1' | 'player2'

  // Targeting and dependencies
  targets?: Array<{
    type: 'card' | 'player' | 'lane'
    id: string
    entity: any
  }>
  dependencies?: string[] // Other stack item IDs this depends on

  // Resolution control
  canBeCountered: boolean
  canRespond: boolean // Can players respond to this effect?
  resolveImmediately?: boolean // Skip stack, resolve right away

  // Timing and windows
  resolutionWindow?: 'immediate' | 'main_phase' | 'combat' | 'end_step'

  // Additional data
  metadata?: {
    triggeringEvent?: GameEvent
    layerEffects?: boolean // For replacement/prevention effects
    modalChoice?: any // For modal effects
    [key: string]: any
  }
}

export interface StackState {
  items: StackItem[]
  nextSequenceNumber: number
  resolutionMode: StackResolutionMode

  // Active resolution tracking
  currentlyResolving?: StackItem
  resolutionInProgress: boolean

  // Response windows
  responseWindow: {
    open: boolean
    playerId: 'player1' | 'player2' | null
    timer?: number
    allowedResponses: string[]
  }

  // Priority tracking
  priorityPlayer: 'player1' | 'player2'

  // Batch resolution for performance
  batchResolution: boolean
  batchItems: StackItem[]
}

export interface StackResolutionResult {
  resolved: StackItem[]
  failed: StackItem[]
  newGameState: GameState
  eventsGenerated: GameEvent[]
  responseWindowOpened?: boolean
}

export class EffectStackService {
  private state: StackState

  constructor() {
    this.state = {
      items: [],
      nextSequenceNumber: 1,
      resolutionMode: 'lifo', // Last In, First Out (traditional MTG-style)
      resolutionInProgress: false,
      responseWindow: {
        open: false,
        playerId: null,
        allowedResponses: [],
      },
      priorityPlayer: 'player1',
      batchResolution: false,
      batchItems: [],
    }

    this.setupEventListeners()
  }

  /**
   * Add an effect to the stack
   */
  addToStack(
    effect: CardEffect,
    context: EffectContext,
    options: {
      type?: StackItemType
      priority?: number
      sourcePlayerId: 'player1' | 'player2'
      sourceCardId?: string
      canBeCountered?: boolean
      resolveImmediately?: boolean
      triggeringEvent?: GameEvent
      targets?: StackItem['targets']
    },
  ): string {
    const stackItem: StackItem = {
      id: `stack_${this.state.nextSequenceNumber}`,
      type: options.type || 'ability',
      effect,
      context,
      priority: options.priority || this.calculatePriority(effect, options.type),
      timestamp: Date.now(),
      sequenceNumber: this.state.nextSequenceNumber++,
      sourcePlayerId: options.sourcePlayerId,
      sourceCardId: options.sourceCardId,
      targets: options.targets,
      canBeCountered: options.canBeCountered ?? true,
      canRespond: options.type !== 'state_based',
      resolveImmediately: options.resolveImmediately || false,
      metadata: {
        triggeringEvent: options.triggeringEvent,
      },
    }

    // Handle immediate resolution effects (like replacement effects)
    if (stackItem.resolveImmediately) {
      // Fire and forget async resolution
      this.resolveImmediately(stackItem).catch(error => {
        GameLogger.error('Immediate resolution failed:', error)
      })
      return stackItem.id
    }

    this.state.items.push(stackItem)
    this.sortStack()

    GameLogger.action(`Effect added to stack: ${effect.name}`, {
      stackSize: this.state.items.length,
      priority: stackItem.priority,
      type: stackItem.type,
      sourcePlayer: options.sourcePlayerId,
    })

    // Emit stack changed event
    this.emitStackEvent('effect_added_to_stack', stackItem)

    // Open response window if appropriate
    if (stackItem.canRespond && !this.state.resolutionInProgress) {
      this.openResponseWindow()
    }

    return stackItem.id
  }

  /**
   * Resolve the top item on the stack
   */
  async resolveNext(): Promise<StackResolutionResult> {
    if (this.state.items.length === 0) {
      return {
        resolved: [],
        failed: [],
        newGameState: this.getCurrentGameState(),
        eventsGenerated: [],
      }
    }

    const itemToResolve = this.getNextItemToResolve()
    if (!itemToResolve) {
      return {
        resolved: [],
        failed: [],
        newGameState: this.getCurrentGameState(),
        eventsGenerated: [],
      }
    }

    return await this.resolveSingleItem(itemToResolve)
  }

  /**
   * Resolve all items on the stack
   */
  async resolveStack(): Promise<StackResolutionResult> {
    const allResolved: StackItem[] = []
    const allFailed: StackItem[] = []
    const allEvents: GameEvent[] = []
    let currentGameState = this.getCurrentGameState()

    this.state.resolutionInProgress = true

    try {
      const MAX_RESOLUTION_DEPTH = 100
      let resolutionDepth = 0

      while (this.state.items.length > 0 && resolutionDepth < MAX_RESOLUTION_DEPTH) {
        resolutionDepth++
        const result = await this.resolveNext()

        allResolved.push(...result.resolved)
        allFailed.push(...result.failed)
        allEvents.push(...result.eventsGenerated)
        currentGameState = result.newGameState

        // Check for new effects added during resolution
        if (result.eventsGenerated.length > 0) {
          // Process any triggered abilities that might have been added
          await this.processTriggerredAbilitiesFromEvents(result.eventsGenerated)
        }

        // Yield control occasionally to prevent blocking
        if (allResolved.length % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 0))
        }
      }

      if (resolutionDepth >= MAX_RESOLUTION_DEPTH) {
        GameLogger.warn('Effect stack resolution exceeded max depth, clearing remaining items')
        this.state.items = []
      }

      GameLogger.combat(`Stack resolution complete`, {
        resolved: allResolved.length,
        failed: allFailed.length,
        events: allEvents.length,
      })

      return {
        resolved: allResolved,
        failed: allFailed,
        newGameState: currentGameState,
        eventsGenerated: allEvents,
      }
    } finally {
      this.state.resolutionInProgress = false
      this.closeResponseWindow()
    }
  }

  /**
   * Add a response to the stack (like a counter-spell or triggered ability)
   */
  addResponse(
    effect: CardEffect,
    context: EffectContext,
    playerId: 'player1' | 'player2',
    targetStackItemId?: string,
  ): string | null {
    if (!this.state.responseWindow.open) {
      GameLogger.action(`Response rejected: No response window open`)
      return null
    }

    if (this.state.responseWindow.playerId && this.state.responseWindow.playerId !== playerId) {
      GameLogger.action(`Response rejected: Not player's turn to respond`)
      return null
    }

    const responseId = this.addToStack(effect, context, {
      type: 'ability',
      priority: 1000, // Responses get high priority
      sourcePlayerId: playerId,
      canBeCountered: true,
    })

    // If this response targets a specific stack item, add dependency
    if (targetStackItemId) {
      const responseItem = this.state.items.find(item => item.id === responseId)
      if (responseItem) {
        responseItem.dependencies = [targetStackItemId]
        responseItem.metadata = {
          ...responseItem.metadata,
          targetStackItemId,
        }
      }
    }

    // Pass priority to opponent
    this.passPriority()

    return responseId
  }

  /**
   * Pass priority to the opponent
   */
  passPriority(): void {
    this.state.priorityPlayer = this.state.priorityPlayer === 'player1' ? 'player2' : 'player1'

    // If both players pass in succession, resolve stack
    if (!this.state.responseWindow.open) {
      this.scheduleResolution()
    } else {
      this.state.responseWindow.playerId = this.state.priorityPlayer
    }
  }

  /**
   * Counter or remove an effect from the stack
   */
  counterEffect(stackItemId: string, counteringPlayerId: 'player1' | 'player2'): boolean {
    const itemIndex = this.state.items.findIndex(item => item.id === stackItemId)
    if (itemIndex === -1) {
      return false
    }

    const item = this.state.items[itemIndex]
    if (!item.canBeCountered) {
      GameLogger.action(`Cannot counter uncounterable effect: ${item.effect.name}`)
      return false
    }

    // Remove from stack
    this.state.items.splice(itemIndex, 1)

    GameLogger.action(`Effect countered by ${counteringPlayerId}: ${item.effect.name}`)

    // Emit counter event
    this.emitStackEvent('effect_countered', item, { counteringPlayerId })

    return true
  }

  /**
   * Get current stack state for UI display
   */
  getStackState(): {
    items: StackItem[]
    canRespond: boolean
    activePlayer: 'player1' | 'player2' | null
    resolutionInProgress: boolean
  } {
    return {
      items: [...this.state.items],
      canRespond: this.state.responseWindow.open,
      activePlayer: this.state.responseWindow.playerId,
      resolutionInProgress: this.state.resolutionInProgress,
    }
  }

  /**
   * Clear the entire stack (for game reset or special effects)
   */
  clearStack(): void {
    const clearedItems = [...this.state.items]
    this.state.items = []
    this.closeResponseWindow()

    GameLogger.action(`Stack cleared`, { itemsCleared: clearedItems.length })

    for (const item of clearedItems) {
      this.emitStackEvent('effect_removed_from_stack', item)
    }
  }

  // Private helper methods

  private calculatePriority(_effect: CardEffect, type?: StackItemType): number {
    // Higher numbers resolve first
    switch (type) {
      case 'state_based':
        return 10000 // State-based effects always resolve first
      case 'replacement_effect':
        return 9000
      case 'triggered_ability':
        return 5000
      case 'ability':
        return 3000
      case 'spell':
        return 1000
      default:
        return 1000
    }
  }

  private sortStack(): void {
    switch (this.state.resolutionMode) {
      case 'lifo':
        // Last In, First Out - reverse sequence order
        this.state.items.sort((a, b) => b.sequenceNumber - a.sequenceNumber)
        break

      case 'priority':
        // Priority-based resolution
        this.state.items.sort((a, b) => {
          if (a.priority !== b.priority) return b.priority - a.priority
          return b.timestamp - a.timestamp // Tie-break by timestamp
        })
        break

      case 'timestamp':
        // First In, First Out by timestamp
        this.state.items.sort((a, b) => a.timestamp - b.timestamp)
        break

      case 'custom':
        // Custom sorting would be implemented here
        break
    }
  }

  private getNextItemToResolve(): StackItem | null {
    if (this.state.items.length === 0) return null

    // Always resolve from the top of the sorted stack
    return this.state.items[0]
  }

  private async resolveSingleItem(item: StackItem): Promise<StackResolutionResult> {
    this.state.currentlyResolving = item

    try {
      GameLogger.action(`Resolving effect: ${item.effect.name}`, {
        type: item.type,
        priority: item.priority,
        sourcePlayer: item.sourcePlayerId,
      })

      // Check if effect is still valid
      if (!this.isEffectStillValid(item)) {
        this.removeFromStack(item.id)
        return {
          resolved: [],
          failed: [item],
          newGameState: this.getCurrentGameState(),
          eventsGenerated: [],
        }
      }

      // Execute the effect
      const result = await cardEffectSystem.executeEffect(
        item.effect,
        item.context,
        item.metadata?.triggeringEvent,
      )

      this.removeFromStack(item.id)

      if (result.success) {
        this.emitStackEvent('effect_resolved', item, { result })

        return {
          resolved: [item],
          failed: [],
          newGameState: result.newGameState || this.getCurrentGameState(),
          eventsGenerated: result.events || [],
        }
      } else {
        this.emitStackEvent('effect_failed', item, { error: result.error })

        return {
          resolved: [],
          failed: [item],
          newGameState: this.getCurrentGameState(),
          eventsGenerated: [],
        }
      }
    } catch (error) {
      GameLogger.action(`Effect resolution failed: ${item.effect.name}`, { error })
      this.removeFromStack(item.id)

      return {
        resolved: [],
        failed: [item],
        newGameState: this.getCurrentGameState(),
        eventsGenerated: [],
      }
    } finally {
      this.state.currentlyResolving = undefined
    }
  }

  private async resolveImmediately(item: StackItem): Promise<string> {
    try {
      const result = await cardEffectSystem.executeEffect(
        item.effect,
        item.context,
        item.metadata?.triggeringEvent,
      )

      if (result.success) {
        GameLogger.action(`Immediate effect resolved: ${item.effect.name}`)
        this.emitStackEvent('effect_resolved', item, { result, immediate: true })
      } else {
        GameLogger.action(`Immediate effect failed: ${item.effect.name}`, { error: result.error })
        this.emitStackEvent('effect_failed', item, { error: result.error, immediate: true })
      }
    } catch (error) {
      GameLogger.action(`Immediate effect error: ${item.effect.name}`, { error })
    }

    return item.id
  }

  private removeFromStack(itemId: string): boolean {
    const index = this.state.items.findIndex(item => item.id === itemId)
    if (index === -1) return false

    const item = this.state.items[index]
    this.state.items.splice(index, 1)

    this.emitStackEvent('effect_removed_from_stack', item)
    return true
  }

  private isEffectStillValid(item: StackItem): boolean {
    try {
      const gameState = this.getCurrentGameState()

      // Check if source card still exists in a valid zone
      if (item.sourceCardId) {
        const allCards = [
          ...gameState.battlefield.playerUnits,
          ...gameState.battlefield.enemyUnits,
          ...gameState.player1.hand,
          ...gameState.player2.hand,
        ].filter(Boolean)

        const sourceExists = allCards.some(card => card?.id === item.sourceCardId)

        // For abilities that require the source to be on battlefield
        if (!sourceExists && (item.type === 'triggered_ability' || item.type === 'ability')) {
          GameLogger.action(
            `Effect ${item.effect.name} invalid: source card ${item.sourceCardId} no longer exists`,
          )
          return false
        }
      }

      // Check if targets still exist and are valid
      if (item.targets) {
        for (const target of item.targets) {
          if (!this.isTargetValid(target, gameState)) {
            GameLogger.action(
              `Effect ${item.effect.name} invalid: target ${target.id} no longer valid`,
            )
            return false
          }
        }
      }

      return true
    } catch {
      // If we can't get game state, assume valid to avoid blocking resolution
      return true
    }
  }

  private isTargetValid(
    target: NonNullable<StackItem['targets']>[0],
    gameState?: ReturnType<typeof this.getCurrentGameState>,
  ): boolean {
    if (!gameState) {
      try {
        gameState = this.getCurrentGameState()
      } catch {
        return true // Can't validate without game state
      }
    }

    if (target.type === 'card') {
      // Check if the targeted card still exists on the battlefield
      const allUnits = [
        ...gameState.battlefield.playerUnits,
        ...gameState.battlefield.enemyUnits,
      ].filter(Boolean)

      return allUnits.some(unit => unit?.id === target.id)
    }

    if (target.type === 'player') {
      // Players are always valid targets (player1 or player2)
      return target.id === 'player1' || target.id === 'player2'
    }

    // Lane targets are always valid
    return true
  }

  private openResponseWindow(): void {
    this.state.responseWindow = {
      open: true,
      playerId: this.getOpponent(this.state.priorityPlayer),
      allowedResponses: this.getAllowedResponses(),
    }

    GameLogger.action(`Response window opened for ${this.state.responseWindow.playerId}`)
    this.emitStackEvent('response_window_opened', null, {
      playerId: this.state.responseWindow.playerId,
    })
  }

  private closeResponseWindow(): void {
    if (this.state.responseWindow.open) {
      const previousPlayer = this.state.responseWindow.playerId
      this.state.responseWindow = {
        open: false,
        playerId: null,
        allowedResponses: [],
      }

      GameLogger.action(`Response window closed`)
      this.emitStackEvent('response_window_closed', null, {
        previousPlayer,
      })
    }
  }

  private getAllowedResponses(): string[] {
    // Return list of response types that are currently legal
    return ['counter_spell', 'instant_ability', 'triggered_ability']
  }

  private scheduleResolution(): void {
    // Schedule stack resolution on next tick to allow for any final responses
    setTimeout(() => {
      if (this.state.items.length > 0 && !this.state.resolutionInProgress) {
        this.resolveStack()
      }
    }, 100)
  }

  private async processTriggerredAbilitiesFromEvents(events: GameEvent[]): Promise<void> {
    for (const event of events) {
      // Let the card effect system handle triggered abilities
      await cardEffectSystem.processTriggeredAbilities(event)
    }
  }

  private getOpponent(playerId: 'player1' | 'player2'): 'player1' | 'player2' {
    return playerId === 'player1' ? 'player2' : 'player1'
  }

  private getCurrentGameState(): GameState {
    // Get game state from the most recent context
    // If we're currently resolving, use that context's game state
    if (this.state.currentlyResolving?.context.gameState) {
      return this.state.currentlyResolving.context.gameState
    }

    // Otherwise, get from the most recent item on stack
    if (this.state.items.length > 0 && this.state.items[0].context.gameState) {
      return this.state.items[0].context.gameState
    }

    // If no game state available, throw error
    throw new Error('No game state available in effect stack context')
  }

  private setupEventListeners(): void {
    // Listen for game events that might trigger stack effects
    eventManager.subscribe(
      { types: ['turn_start', 'turn_end', 'combat_resolved'] },
      async _event => {
        // Check for any delayed trigger abilities
        if (this.state.items.length > 0) {
          await this.resolveStack()
        }
      },
      { priority: 200 }, // High priority to resolve before other effects
    )
  }

  private emitStackEvent(
    eventType: string,
    item: StackItem | null,
    additionalData: any = {},
  ): void {
    eventManager.emit(
      eventType as any,
      this.getCurrentGameState(),
      {
        stackItem: item,
        stackSize: this.state.items.length,
        ...additionalData,
      },
      { type: 'system', id: 'effect_stack' },
    )
  }

  /**
   * Set the resolution mode for the stack
   */
  setResolutionMode(mode: StackResolutionMode): void {
    this.state.resolutionMode = mode
    this.sortStack()

    GameLogger.action(`Stack resolution mode changed to: ${mode}`)
  }

  /**
   * Get stack statistics for debugging/analysis
   */
  getStackStatistics(): {
    totalItems: number
    itemsByType: Record<string, number>
    itemsByPlayer: Record<string, number>
    averagePriority: number
    oldestItem: StackItem | null
    newestItem: StackItem | null
  } {
    const itemsByType: Record<string, number> = {}
    const itemsByPlayer: Record<string, number> = {}
    let totalPriority = 0

    for (const item of this.state.items) {
      itemsByType[item.type] = (itemsByType[item.type] || 0) + 1
      itemsByPlayer[item.sourcePlayerId] = (itemsByPlayer[item.sourcePlayerId] || 0) + 1
      totalPriority += item.priority
    }

    return {
      totalItems: this.state.items.length,
      itemsByType,
      itemsByPlayer,
      averagePriority: this.state.items.length > 0 ? totalPriority / this.state.items.length : 0,
      oldestItem: this.state.items.reduce(
        (oldest, item) => (!oldest || item.timestamp < oldest.timestamp ? item : oldest),
        null as StackItem | null,
      ),
      newestItem: this.state.items.reduce(
        (newest, item) => (!newest || item.timestamp > newest.timestamp ? item : newest),
        null as StackItem | null,
      ),
    }
  }
}

// Singleton instance
export const effectStackService = new EffectStackService()
