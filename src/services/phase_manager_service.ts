import { GameLogger } from '@/lib/game_logger'
import type { GameState } from '@/schemas/schema'

export type Phase = 'mulligan' | 'round_start' | 'action' | 'combat_resolution' | 'end_round'

export interface PhaseTransition {
  from: Phase
  to: Phase
  validate: (state: GameState) => boolean
  execute: (state: GameState) => GameState
}

/**
 * Manages game phases and transitions for direct attack system
 * No separate attack/defense declarations - combat resolves immediately
 */
export class PhaseManagerService {
  private transitions: Map<string, PhaseTransition> = new Map()

  constructor() {
    this.registerTransitions()
  }

  /**
   * Register all valid phase transitions for direct attack system
   */
  private registerTransitions(): void {
    // Mulligan → Round Start
    this.addTransition({
      from: 'mulligan',
      to: 'round_start',
      validate: state => {
        return state.player1.mulliganComplete && state.player2.mulliganComplete
      },
      execute: state => {
        const newState = { ...state }
        newState.phase = 'round_start'
        newState.priorityPlayer = 'player1'
        newState.canRespond = false

        GameLogger.state('Phase transition: Mulligan → Round Start')
        return newState
      },
    })

    // Round Start → Action
    this.addTransition({
      from: 'round_start',
      to: 'action',
      validate: () => true,
      execute: state => {
        const newState = { ...state }
        newState.phase = 'action'
        newState.priorityPlayer = state.activePlayer
        newState.canRespond = false
        newState.waitingForAction = true

        GameLogger.state('Phase transition: Round Start → Action')
        return newState
      },
    })

    // Action → Combat Resolution (when attacks are declared)
    this.addTransition({
      from: 'action',
      to: 'combat_resolution',
      validate: () => true, // Attacks are resolved immediately
      execute: state => {
        const newState = { ...state }
        newState.phase = 'combat_resolution'
        newState.priorityPlayer = state.activePlayer
        newState.canRespond = false

        GameLogger.state('Phase transition: Action → Combat Resolution')
        return newState
      },
    })

    // Combat Resolution → Action (back to action for more plays)
    this.addTransition({
      from: 'combat_resolution',
      to: 'action',
      validate: () => true,
      execute: state => {
        const newState = { ...state }
        newState.phase = 'action'
        newState.combatResolved = true
        newState.priorityPlayer = state.activePlayer

        GameLogger.state('Phase transition: Combat Resolution → Action')
        return newState
      },
    })

    // Action → End Round (when player passes or time expires)
    this.addTransition({
      from: 'action',
      to: 'end_round',
      validate: state => {
        const player = state[state.activePlayer]
        return player.hasPassed || state.passCount >= 2
      },
      execute: state => {
        const newState = { ...state }
        newState.phase = 'end_round'
        newState.waitingForAction = false

        GameLogger.state('Phase transition: Action → End Round')
        return newState
      },
    })

    // End Round → Round Start (new round)
    this.addTransition({
      from: 'end_round',
      to: 'round_start',
      validate: () => true,
      execute: state => {
        const newState = { ...state }
        newState.phase = 'round_start'
        newState.combatResolved = false
        newState.passCount = 0

        // Switch active player and update round/turn
        newState.activePlayer = state.activePlayer === 'player1' ? 'player2' : 'player1'
        newState.turn++

        if (newState.turn % 2 === 1) {
          newState.round++
        }

        GameLogger.state('Phase transition: End Round → Round Start')
        return newState
      },
    })
  }

  /**
   * Add a phase transition
   */
  private addTransition(transition: PhaseTransition): void {
    const key = `${transition.from}->${transition.to}`
    this.transitions.set(key, transition)
  }

  /**
   * Attempt to transition to a new phase
   */
  public tryTransition(state: GameState, targetPhase: Phase): GameState {
    const key = `${state.phase}->${targetPhase}`
    const transition = this.transitions.get(key)

    if (!transition) {
      GameLogger.state(`Invalid phase transition: ${state.phase} → ${targetPhase}`)
      return state
    }

    if (!transition.validate(state)) {
      GameLogger.state(`Phase transition validation failed: ${state.phase} → ${targetPhase}`)
      return state
    }

    return transition.execute(state)
  }

  /**
   * Get all valid transitions from current phase
   */
  public getValidTransitions(currentPhase: Phase): Phase[] {
    const validTransitions: Phase[] = []

    for (const [_key, transition] of this.transitions) {
      if (transition.from === currentPhase) {
        validTransitions.push(transition.to)
      }
    }

    return validTransitions
  }

  /**
   * Auto-advance phases when conditions are met
   */
  public autoAdvancePhase(state: GameState): GameState {
    let currentState = state
    let changed = false

    // Try to auto-advance through valid transitions
    const validTransitions = this.getValidTransitions(currentState.phase)

    for (const targetPhase of validTransitions) {
      const key = `${currentState.phase}->${targetPhase}`
      const transition = this.transitions.get(key)

      if (transition?.validate(currentState)) {
        currentState = transition.execute(currentState)
        changed = true
        break // Only advance one phase at a time
      }
    }

    return changed ? currentState : state
  }

  /**
   * Check if a player can act in the current phase
   */
  public canPlayerAct(state: GameState, playerId: 'player1' | 'player2'): boolean {
    // In most phases, only the active player can act
    if (state.activePlayer !== playerId) {
      return false
    }

    switch (state.phase) {
      case 'mulligan':
        return !state[playerId].mulliganComplete
      case 'action':
        return !state[playerId].hasPassed
      case 'round_start':
      case 'combat_resolution':
      case 'end_round':
        return false // System-controlled phases
      default:
        return false
    }
  }

  /**
   * Get human-readable phase description
   */
  public getPhaseDescription(state: GameState): string {
    switch (state.phase) {
      case 'mulligan':
        return 'Choose cards to mulligan'
      case 'round_start':
        return 'Starting new round...'
      case 'action': {
        const tokenHolder = state.player1.hasAttackToken ? 'Player 1' : 'Player 2'
        return `Action Phase (${tokenHolder} has attack token)`
      }
      case 'combat_resolution':
        return 'Resolving combat...'
      case 'end_round':
        return 'Ending round...'
      default:
        return `Unknown phase: ${state.phase}`
    }
  }

  /**
   * Reset phase manager (for new games)
   */
  public reset(): void {
    // Phase manager is stateless, no reset needed
    GameLogger.state('Phase manager reset')
  }
}

// Export singleton instance
export const phaseManagerService = new PhaseManagerService()
