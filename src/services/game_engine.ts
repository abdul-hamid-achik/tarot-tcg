'use client'

import { produce } from 'immer'
import type {
  Card,
  CardEffect,
  DirectAttack,
  EffectContext,
  GameState,
  Phase,
  PlayerId,
} from '@/schemas/schema'
import { animationQueue } from './animation_queue'
import { cardEffectSystem } from './card_effect_system'
import { declareAttack, canAttack, getValidAttackTargets, previewCombat } from './combat_service'
import { transactionManager } from './transaction_manager'
import { winConditionService } from './win_condition_service'

// ================================
// GAME ENGINE RESULT TYPES
// ================================

export interface GameEngineResult {
  success: boolean
  newState?: GameState
  error?: string
  animations?: string[]
  events?: string[]
}

export interface GameEngineConfig {
  enableAnimations: boolean
  enableTransactions: boolean
  animationSpeed: 'slow' | 'normal' | 'fast' | 'instant'
}

const DEFAULT_CONFIG: GameEngineConfig = {
  enableAnimations: true,
  enableTransactions: true,
  animationSpeed: 'normal',
}

const ANIMATION_DURATIONS = {
  slow: { card_played: 800, unit_attack: 600, unit_damage: 400, unit_death: 500 },
  normal: { card_played: 400, unit_attack: 300, unit_damage: 200, unit_death: 250 },
  fast: { card_played: 200, unit_attack: 150, unit_damage: 100, unit_death: 125 },
  instant: { card_played: 0, unit_attack: 0, unit_damage: 0, unit_death: 0 },
}

// ================================
// GAME ENGINE CLASS
// ================================

export class GameEngine {
  private config: GameEngineConfig

  constructor(config: Partial<GameEngineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }

    // Configure animation queue
    animationQueue.setEnabled(this.config.enableAnimations)
  }

  /**
   * Update configuration
   */
  configure(config: Partial<GameEngineConfig>): void {
    this.config = { ...this.config, ...config }
    animationQueue.setEnabled(this.config.enableAnimations)
  }

  // ================================
  // MAIN GAME ACTIONS
  // ================================

  /**
   * Play a card from hand
   */
  async playCard(
    state: GameState,
    card: Card,
    targetSlot?: number
  ): Promise<GameEngineResult> {
    // Validate phase
    const phaseValidation = this.validatePhase(state, ['action'])
    if (!phaseValidation.success) {
      return phaseValidation
    }

    // Start transaction if enabled
    if (this.config.enableTransactions) {
      transactionManager.begin(state)
    }

    try {
      const player = state[state.activePlayer]

      // Validate card is in hand
      const cardInHand = player.hand.find(c => c.id === card.id)
      if (!cardInHand) {
        throw new Error(`Card ${card.name} is not in your hand`)
      }

      // Validate mana
      const totalMana = player.mana + player.spellMana
      if (card.cost > totalMana) {
        throw new Error(`Not enough mana to play ${card.name}`)
      }

      // Validate battlefield space for units
      if (card.type === 'unit') {
        const units = state.activePlayer === 'player1'
          ? state.battlefield.playerUnits
          : state.battlefield.enemyUnits
        const slot = targetSlot ?? units.indexOf(null)
        if (slot === -1) {
          throw new Error('Battlefield is full')
        }
      }

      transactionManager.addOperation(`Play card: ${card.name}`)

      // Import and use the game_logic playCard function
      const { playCard: playCardLogic } = await import('@/lib/game_logic')
      const newState = await playCardLogic(state, card, targetSlot)

      // Queue animation
      if (this.config.enableAnimations) {
        const duration = ANIMATION_DURATIONS[this.config.animationSpeed].card_played
        animationQueue.enqueue({
          type: 'card_played',
          data: { cardId: card.id, cardName: card.name, slot: targetSlot },
          duration,
          priority: 100,
          blocking: true,
        })
      }

      // Commit transaction
      if (this.config.enableTransactions) {
        transactionManager.commit()
      }

      // Check win conditions
      const winResult = this.checkWinConditions(newState)
      if (winResult) {
        return { ...winResult, newState }
      }

      return { success: true, newState }
    } catch (error) {
      // Rollback on error
      if (this.config.enableTransactions) {
        const rollbackState = transactionManager.rollback()
        if (rollbackState) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            newState: rollbackState,
          }
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Declare an attack
   */
  async attack(
    state: GameState,
    attack: DirectAttack
  ): Promise<GameEngineResult> {
    // Validate phase
    const phaseValidation = this.validatePhase(state, ['action'])
    if (!phaseValidation.success) {
      return phaseValidation
    }

    // Validate attack token
    const player = state[state.activePlayer]
    if (!player.hasAttackToken) {
      return { success: false, error: 'You do not have the attack token' }
    }

    // Start transaction
    if (this.config.enableTransactions) {
      transactionManager.begin(state)
    }

    try {
      transactionManager.addOperation(`Attack: ${attack.attackerId} -> ${attack.targetType}`)

      const newState = await declareAttack(state, attack)

      // Queue attack animation
      if (this.config.enableAnimations) {
        const duration = ANIMATION_DURATIONS[this.config.animationSpeed].unit_attack
        animationQueue.enqueue({
          type: 'unit_attack',
          data: { ...attack },
          duration,
          priority: 90,
          blocking: true,
        })
      }

      // Commit transaction
      if (this.config.enableTransactions) {
        transactionManager.commit()
      }

      // Check win conditions
      const winResult = this.checkWinConditions(newState)
      if (winResult) {
        return { ...winResult, newState }
      }

      return { success: true, newState }
    } catch (error) {
      if (this.config.enableTransactions) {
        const rollbackState = transactionManager.rollback()
        if (rollbackState) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            newState: rollbackState,
          }
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * End the current turn
   */
  async endTurn(state: GameState): Promise<GameEngineResult> {
    // Validate phase
    const phaseValidation = this.validatePhase(state, ['action'])
    if (!phaseValidation.success) {
      return phaseValidation
    }

    if (this.config.enableTransactions) {
      transactionManager.begin(state)
    }

    try {
      transactionManager.addOperation('End turn')

      const { endTurn: endTurnLogic } = await import('@/lib/game_logic')
      const newState = await endTurnLogic(state)

      if (this.config.enableTransactions) {
        transactionManager.commit()
      }

      // Check win conditions
      const winResult = this.checkWinConditions(newState)
      if (winResult) {
        return { ...winResult, newState }
      }

      return { success: true, newState }
    } catch (error) {
      if (this.config.enableTransactions) {
        const rollbackState = transactionManager.rollback()
        if (rollbackState) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            newState: rollbackState,
          }
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Complete mulligan phase
   */
  async completeMulligan(state: GameState): Promise<GameEngineResult> {
    const phaseValidation = this.validatePhase(state, ['mulligan'])
    if (!phaseValidation.success) {
      return phaseValidation
    }

    try {
      const { completeMulligan: completeMulliganLogic } = await import('@/lib/game_logic')
      const newState = completeMulliganLogic(state)
      return { success: true, newState }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Toggle a card for mulligan
   */
  toggleMulliganCard(state: GameState, cardId: string): GameEngineResult {
    const phaseValidation = this.validatePhase(state, ['mulligan'])
    if (!phaseValidation.success) {
      return phaseValidation
    }

    const newState = produce(state, draft => {
      const player = draft[state.activePlayer]
      if (player.selectedForMulligan.includes(cardId)) {
        player.selectedForMulligan = player.selectedForMulligan.filter(id => id !== cardId)
      } else {
        player.selectedForMulligan.push(cardId)
      }
    })

    return { success: true, newState }
  }

  // ================================
  // VALIDATION HELPERS
  // ================================

  /**
   * Validate the current game phase
   */
  private validatePhase(state: GameState, requiredPhases: Phase[]): GameEngineResult {
    if (!requiredPhases.includes(state.phase)) {
      return {
        success: false,
        error: `Cannot perform action during ${state.phase} phase. Required: ${requiredPhases.join(' or ')}`,
      }
    }
    return { success: true }
  }

  /**
   * Check win conditions and return result if game ended
   */
  private checkWinConditions(state: GameState): GameEngineResult | null {
    const result = winConditionService.checkWinConditions(state)
    if (result?.achieved) {
      return {
        success: true,
        newState: state,
        events: [`Game Over: ${result.message}`],
      }
    }

    // Traditional health check
    if (state.player1.health <= 0) {
      return {
        success: true,
        newState: state,
        events: ['Game Over: Player 2 wins by health depletion'],
      }
    }
    if (state.player2.health <= 0) {
      return {
        success: true,
        newState: state,
        events: ['Game Over: Player 1 wins by health depletion'],
      }
    }

    return null
  }

  // ================================
  // HELPER METHODS
  // ================================

  /**
   * Check if a unit can attack
   */
  canUnitAttack(unit: Card): boolean {
    return canAttack(unit)
  }

  /**
   * Get valid attack targets
   */
  getValidTargets(state: GameState, attackingPlayer: PlayerId) {
    return getValidAttackTargets(state, attackingPlayer)
  }

  /**
   * Preview combat outcome
   */
  previewCombat(attacker: Card, defender: Card) {
    return previewCombat(attacker, defender)
  }

  /**
   * Execute an effect directly
   */
  async executeEffect(
    effect: CardEffect,
    context: EffectContext
  ): Promise<GameEngineResult> {
    const result = await cardEffectSystem.executeEffect(effect, context)
    return {
      success: result.success,
      newState: result.newGameState,
      error: result.error,
    }
  }

  /**
   * Wait for all animations to complete
   */
  async waitForAnimations(): Promise<void> {
    await animationQueue.waitForIdle()
  }

  /**
   * Get animation queue status
   */
  getAnimationStatus() {
    return animationQueue.getStatus()
  }

  /**
   * Get transaction status
   */
  getTransactionStatus() {
    return transactionManager.getStatus()
  }
}

// Singleton instance with default config
export const gameEngine = new GameEngine()

// Factory function for custom configs
export function createGameEngine(config?: Partial<GameEngineConfig>): GameEngine {
  return new GameEngine(config)
}
