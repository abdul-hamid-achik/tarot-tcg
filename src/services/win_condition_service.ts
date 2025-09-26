import { GameLogger } from '@/lib/game_logger'
import type {
  GameEvent,
  GameState,
  WinCondition,
  WinConditionEventData,
  WinConditionGameMode,
  WinConditionProgress,
  WinConditionResult,
  WinConditionState,
} from '@/schemas/schema'
import { GAME_MODES } from '@/schemas/schema'
import { eventManager } from '@/services/event_manager'

export class WinConditionService {
  private state: WinConditionState
  private registeredConditions: Map<string, WinCondition> = new Map()

  constructor() {
    this.state = {
      activeConditions: new Map(),
      playerProgress: new Map([
        ['player1', new Map()],
        ['player2', new Map()],
      ]),
      conditionHistory: new Map(),
      eventCounters: new Map(),
      gameMode: GAME_MODES.standard,
    }

    this.initializeDefaultConditions()
    this.setupEventListeners()
  }

  /**
   * Initialize default win conditions
   */
  private initializeDefaultConditions(): void {
    // Health Depletion (Traditional)
    this.registerWinCondition({
      id: 'health_depletion',
      name: 'Health Depletion',
      description: "Reduce opponent's health to 0",
      type: 'health_depletion',
      priority: 100,
      toggleable: false,
      checkCondition: (gameState: GameState, playerId: 'player1' | 'player2') => {
        const opponentHealth = playerId === 'player1'
          ? gameState.player2.health
          : gameState.player1.health

        return {
          achieved: opponentHealth <= 0,
          winner: opponentHealth <= 0 ? playerId : undefined,
          message:
            opponentHealth <= 0
              ? `${playerId} wins by reducing opponent's health to 0!`
              : `Opponent has ${opponentHealth} health remaining`,
          timestamp: Date.now(),
        }
      },
      config: { targetAmount: 0 },
    })

    // Deck Depletion (Mill)
    this.registerWinCondition({
      id: 'deck_depletion',
      name: 'Deck Depletion',
      description: 'Win when opponent cannot draw a card',
      type: 'deck_depletion',
      priority: 95,
      toggleable: true,
      checkCondition: (gameState: GameState, playerId: 'player1' | 'player2') => {
        const opponentDeck = playerId === 'player1'
          ? gameState.player2.deck
          : gameState.player1.deck

        return {
          achieved: opponentDeck.length === 0,
          winner: opponentDeck.length === 0 ? playerId : undefined,
          message:
            opponentDeck.length === 0
              ? `${playerId} wins by depleting opponent's deck!`
              : `Opponent has ${opponentDeck.length} cards remaining in deck`,
          timestamp: Date.now(),
        }
      },
      config: { targetAmount: 0 },
    })

    // Board Domination
    this.registerWinCondition({
      id: 'board_domination',
      name: 'Board Domination',
      description: 'Control 6 units for 3 consecutive turns',
      type: 'board_domination',
      priority: 80,
      toggleable: true,
      checkCondition: (gameState: GameState, playerId: 'player1' | 'player2') => {
        const player = gameState[playerId]
        const playerUnits = playerId === 'player1'
          ? gameState.battlefield.playerUnits
          : gameState.battlefield.enemyUnits
        const unitsControlled = playerUnits.filter(u => u !== null).length
        const turnsRequired = 3

        const historyKey = `board_domination_${playerId}`
        const history = this.state.conditionHistory.get(historyKey)

        if (unitsControlled >= 6) {
          if (!history) {
            // Start tracking
            this.state.conditionHistory.set(historyKey, {
              playerId,
              turnsActive: 1,
              firstAchievedTurn: gameState.turn,
              lastCheckedTurn: gameState.turn,
            })
            return {
              achieved: false,
              message: `${playerId} dominates the board! ${turnsRequired - 1} more turns needed`,
              timestamp: Date.now(),
            }
          } else {
            const turnsActive = gameState.turn - history.firstAchievedTurn + 1
            if (turnsActive >= turnsRequired) {
              return {
                achieved: true,
                winner: playerId,
                message: `${playerId} wins by board domination for ${turnsRequired} turns!`,
                timestamp: Date.now(),
              }
            } else {
              return {
                achieved: false,
                message: `${playerId} board domination: ${turnsActive}/${turnsRequired} turns`,
                timestamp: Date.now(),
              }
            }
          }
        } else {
          // Reset if condition not met
          if (history) {
            this.state.conditionHistory.delete(historyKey)
          }
          return {
            achieved: false,
            message: `Need ${6 - unitsControlled} more units for board domination`,
            timestamp: Date.now(),
          }
        }
      },
      config: {
        targetAmount: 6,
        duration: 3,
        consecutiveTurns: true,
      },
    })

    // Arcana Completion
    this.registerWinCondition({
      id: 'arcana_completion',
      name: 'Major Arcana Master',
      description: 'Play cards from at least 7 different Major Arcana',
      type: 'arcana_completion',
      priority: 85,
      toggleable: true,
      checkCondition: (gameState: GameState, playerId: 'player1' | 'player2') => {
        const player = gameState[playerId]
        const playedMajorArcana = new Set<string>()

        // Check all zones for Major Arcana cards
        const battlefieldCards = playerId === 'player1'
          ? gameState.battlefield.playerUnits.filter(u => u !== null)
          : gameState.battlefield.enemyUnits.filter(u => u !== null)
        const allPlayerCards = [...player.hand, ...battlefieldCards, ...player.deck]

        for (const card of allPlayerCards) {
          if (card.tarotSymbol && this.isMajorArcana(card.tarotSymbol)) {
            playedMajorArcana.add(card.tarotSymbol)
          }
        }

        const targetCount = 7
        const currentCount = playedMajorArcana.size

        return {
          achieved: currentCount >= targetCount,
          winner: currentCount >= targetCount ? playerId : undefined,
          message:
            currentCount >= targetCount
              ? `${playerId} wins by mastering ${currentCount} Major Arcana cards!`
              : `Major Arcana progress: ${currentCount}/${targetCount}`,
          timestamp: Date.now(),
          conditions_met: Array.from(playedMajorArcana),
          conditions_remaining: [`Need ${targetCount - currentCount} more Major Arcana`],
        }
      },
      config: { targetAmount: 7 },
    })

    // Zodiac Alignment
    this.registerWinCondition({
      id: 'zodiac_alignment',
      name: 'Zodiac Alignment',
      description: 'Have units representing all 4 elements on the field',
      type: 'zodiac_alignment',
      priority: 85,
      toggleable: true,
      checkCondition: (gameState: GameState, playerId: 'player1' | 'player2') => {
        const player = gameState[playerId]
        const elementsOnField = new Set<string>()

        // Check battlefield for different elements
        const playerBattlefieldCards = playerId === 'player1'
          ? gameState.battlefield.playerUnits.filter(u => u !== null)
          : gameState.battlefield.enemyUnits.filter(u => u !== null)
        for (const card of playerBattlefieldCards) {
          if (card.element) {
            elementsOnField.add(card.element)
          }
        }

        const allElements = ['fire', 'water', 'earth', 'air']
        const hasAllElements = allElements.every(element => elementsOnField.has(element))

        return {
          achieved: hasAllElements,
          winner: hasAllElements ? playerId : undefined,
          message: hasAllElements
            ? `${playerId} wins by aligning all four elements!`
            : `Elements aligned: ${Array.from(elementsOnField).join(', ')}`,
          timestamp: Date.now(),
          conditions_met: Array.from(elementsOnField),
          conditions_remaining: allElements.filter(e => !elementsOnField.has(e)),
        }
      },
      config: {
        requiredElements: ['fire', 'water', 'earth', 'air'],
        simultaneousCondition: true,
      },
    })

    // Turn Survival
    this.registerWinCondition({
      id: 'turn_survival',
      name: 'Endurance Victory',
      description: 'Survive until turn 15',
      type: 'turn_survival',
      priority: 70,
      toggleable: true,
      checkCondition: (gameState: GameState, playerId: 'player1' | 'player2') => {
        const targetTurn = 15
        const currentTurn = gameState.turn
        const playerHealth = gameState[playerId].health

        return {
          achieved: currentTurn >= targetTurn && playerHealth > 0,
          winner: currentTurn >= targetTurn && playerHealth > 0 ? playerId : undefined,
          message:
            currentTurn >= targetTurn
              ? `${playerId} wins by surviving to turn ${currentTurn}!`
              : `Survival progress: Turn ${currentTurn}/${targetTurn}`,
          timestamp: Date.now(),
        }
      },
      config: { targetAmount: 15 },
    })

    // Damage Accumulation
    this.registerWinCondition({
      id: 'damage_accumulation',
      name: 'Damage Master',
      description: 'Deal 50 total damage throughout the game',
      type: 'damage_accumulation',
      priority: 75,
      toggleable: true,
      checkCondition: (_gameState, playerId) => {
        const counterKey = `total_damage_${playerId}`
        const totalDamage = this.getEventCounter(counterKey, playerId)
        const targetDamage = 50

        return {
          achieved: totalDamage >= targetDamage,
          winner: totalDamage >= targetDamage ? playerId : undefined,
          message:
            totalDamage >= targetDamage
              ? `${playerId} wins by dealing ${totalDamage} total damage!`
              : `Damage dealt: ${totalDamage}/${targetDamage}`,
          timestamp: Date.now(),
        }
      },
      config: { targetAmount: 50 },
      eventHandlers: {
        player_loses_health: (event: GameEvent, playerId: 'player1' | 'player2') => {
          if (event.source?.type === 'card' && event.data && 'amount' in event.data) {
            const damage = Number(event.data.amount) || 0
            this.incrementEventCounter(`total_damage_${playerId}`, playerId, damage)
          }
        },
      },
    })
  }

  /**
   * Register a new win condition
   */
  registerWinCondition(condition: WinCondition): void {
    this.registeredConditions.set(condition.id, condition)

    // Set up event handlers if defined
    if (condition.eventHandlers) {
      for (const [eventType, handler] of Object.entries(condition.eventHandlers)) {
        eventManager.subscribe(
          { types: [eventType as any] },
          async (event: GameEvent) => {
            const playerId = this.extractPlayerIdFromEvent(event)
            if (playerId) {
              (handler as any)(event, playerId)
            }
          },
          { priority: 50 },
        )
      }
    }
  }

  /**
   * Set game mode and activate corresponding win conditions
   */
  setGameMode(modeId: keyof typeof GAME_MODES): void {
    const mode = GAME_MODES[modeId]
    if (!mode) {
      throw new Error(`Unknown game mode: ${modeId}`)
    }

    this.state.gameMode = mode
    this.state.activeConditions.clear()

    // Activate enabled conditions
    for (const conditionId of mode.enabledConditions) {
      const condition = this.registeredConditions.get(conditionId)
      if (condition) {
        this.state.activeConditions.set(conditionId, condition)
      }
    }

    GameLogger.state(`Game mode set to: ${mode.name}`, {
      enabledConditions: mode.enabledConditions,
      disabledConditions: mode.disabledConditions,
    })
  }

  /**
   * Check all active win conditions
   */
  checkWinConditions(gameState: GameState): WinConditionResult | null {
    const results: WinConditionResult[] = []

    for (const [conditionId, condition] of this.state.activeConditions) {
      // Check for both players
      for (const playerId of ['player1', 'player2'] as const) {
        const result = (condition.checkCondition as any)(gameState, playerId)

        if (result.achieved) {
          results.push({
            ...result,
            winner: playerId,
            conditions_met: [`${condition.name} by ${playerId}`],
          })

          // Emit win condition achieved event
          this.emitWinConditionEvent('win_condition_achieved', {
            conditionId,
            playerId,
            result,
          })
        } else {
          // Update progress tracking
          const progress = (condition.getProgress as any)?.(gameState, playerId)
          if (progress) {
            this.updatePlayerProgress(playerId, conditionId, progress)
          }
        }
      }
    }

    // Return highest priority win condition
    if (results.length > 0) {
      const _winCondition = this.state.activeConditions.get(
        Array.from(this.state.activeConditions.keys())[0],
      )

      results.sort((a, b) => {
        const conditionA = this.findConditionByResult(a)
        const conditionB = this.findConditionByResult(b)
        return (conditionB?.priority || 0) - (conditionA?.priority || 0)
      })

      return results[0]
    }

    return null
  }

  /**
   * Get progress for all active win conditions for a player
   */
  getPlayerProgress(playerId: 'player1' | 'player2'): Map<string, WinConditionProgress> {
    return this.state.playerProgress.get(playerId) || new Map()
  }

  /**
   * Get all active win conditions
   */
  getActiveConditions(): WinCondition[] {
    return Array.from(this.state.activeConditions.values())
  }

  /**
   * Enable/disable a specific win condition
   */
  toggleWinCondition(conditionId: string, enabled: boolean): void {
    const condition = this.registeredConditions.get(conditionId)
    if (!condition) {
      throw new Error(`Win condition not found: ${conditionId}`)
    }

    if (!condition.toggleable) {
      throw new Error(`Win condition cannot be toggled: ${conditionId}`)
    }

    if (enabled) {
      this.state.activeConditions.set(conditionId, condition)
      this.emitWinConditionEvent('win_condition_enabled', {
        conditionId,
        playerId: 'player1', // System event
      })
    } else {
      this.state.activeConditions.delete(conditionId)
      this.emitWinConditionEvent('win_condition_disabled', {
        conditionId,
        playerId: 'player1', // System event
      })
    }
  }

  // Private helper methods

  private setupEventListeners(): void {
    // Listen for turn changes to update progress
    eventManager.subscribe(
      { types: ['turn_start'] },
      async event => {
        const gameState = this.getGameStateFromEvent(event)
        if (gameState) {
          this.updateAllProgress(gameState)
        }
      },
      { priority: 90 },
    )
  }

  private updateAllProgress(gameState: GameState): void {
    for (const [conditionId, condition] of this.state.activeConditions) {
      for (const playerId of ['player1', 'player2'] as const) {
        const progress = (condition.getProgress as any)?.(gameState, playerId)
        if (progress) {
          this.updatePlayerProgress(playerId, conditionId, progress)
        }
      }
    }
  }

  private updatePlayerProgress(
    playerId: 'player1' | 'player2',
    conditionId: string,
    progress: WinConditionProgress,
  ): void {
    const playerProgress = this.state.playerProgress.get(playerId)!
    const previousProgress = playerProgress.get(conditionId)

    playerProgress.set(conditionId, progress)

    // Emit progress event if progress changed
    if (!previousProgress || previousProgress.current !== progress.current) {
      this.emitWinConditionEvent('win_condition_progress', {
        conditionId,
        playerId,
        progress,
      })
    }

    // Check for milestones
    if (progress.milestones) {
      for (const milestone of progress.milestones) {
        if (
          milestone.achieved &&
          !previousProgress?.milestones?.find(m => m.value === milestone.value)?.achieved
        ) {
          this.emitWinConditionEvent('win_condition_milestone', {
            conditionId,
            playerId,
            milestone: milestone.description,
          })
        }
      }
    }
  }

  private getEventCounter(key: string, playerId: 'player1' | 'player2'): number {
    return this.state.eventCounters.get(key)?.get(playerId) || 0
  }

  private incrementEventCounter(
    key: string,
    playerId: 'player1' | 'player2',
    amount: number = 1,
  ): void {
    if (!this.state.eventCounters.has(key)) {
      this.state.eventCounters.set(
        key,
        new Map([
          ['player1', 0],
          ['player2', 0],
        ]),
      )
    }
    const counter = this.state.eventCounters.get(key)!
    counter.set(playerId, (counter.get(playerId) || 0) + amount)
  }

  private isMajorArcana(tarotSymbol: string): boolean {
    // Major Arcana are numbered 0-21
    const num = parseInt(tarotSymbol, 10)
    return !Number.isNaN(num) && num >= 0 && num <= 21
  }

  private extractPlayerIdFromEvent(event: GameEvent): 'player1' | 'player2' | null {
    if (event.source?.type === 'player') {
      return event.source.id as 'player1' | 'player2'
    }
    if (event.data && 'playerId' in event.data) {
      return event.data.playerId as 'player1' | 'player2'
    }
    return event.activePlayer
  }

  private findConditionByResult(_result: WinConditionResult): WinCondition | undefined {
    // This is a simplified lookup - in practice you'd want better tracking
    return Array.from(this.state.activeConditions.values())[0]
  }

  private getGameStateFromEvent(_event: GameEvent): GameState | null {
    // This would need to be implemented based on how game state is accessible
    // For now, return null - in real implementation, this would get the current game state
    return null
  }

  private emitWinConditionEvent(eventType: string, data: WinConditionEventData): void {
    // Emit custom win condition events
    eventManager.emit(
      eventType as any,
      {} as GameState, // Would need actual game state
      data,
      { type: 'system', id: 'win_conditions' },
    )
  }

  /**
   * Reset all win condition tracking (for new game)
   */
  resetState(): void {
    this.state.playerProgress.clear()
    this.state.playerProgress.set('player1', new Map())
    this.state.playerProgress.set('player2', new Map())
    this.state.conditionHistory.clear()
    this.state.eventCounters.clear()
  }

  /**
   * Get current game mode
   */
  getCurrentGameMode(): WinConditionGameMode {
    return this.state.gameMode
  }
}

// Singleton instance
export const winConditionService = new WinConditionService()
