import { GameLogger } from '@/lib/game_logger'
import type { GameState } from '@/schemas/schema'

export type Phase =
  | 'mulligan'
  | 'round_start'
  | 'action'
  | 'attack_declaration'
  | 'defense_declaration'
  | 'combat_resolution'
  | 'end_round'

export interface PhaseTransition {
  from: Phase
  to: Phase
  validate: (state: GameState) => boolean
  execute: (state: GameState) => GameState
}

/**
 * Manages game phases and transitions following LoR-style flow
 */
export class PhaseManagerService {
  private transitions: Map<string, PhaseTransition> = new Map()

  constructor() {
    this.registerTransitions()
  }

  /**
   * Register all valid phase transitions
   */
  private registerTransitions(): void {
    // Mulligan → Round Start
    this.addTransition({
      from: 'mulligan',
      to: 'round_start',
      validate: (state) => {
        return state.player1.mulliganComplete && state.player2.mulliganComplete
      },
      execute: (state) => {
        const newState = { ...state }
        newState.phase = 'round_start'
        newState.priorityPlayer = 'player1' // Player 1 gets first priority
        newState.passCount = 0

        // State will be synced by StateManager

        GameLogger.state('Phase transition: Mulligan → Round Start')
        return newState
      }
    })

    // Round Start → Action
    this.addTransition({
      from: 'round_start',
      to: 'action',
      validate: () => true,
      execute: (state) => {
        const newState = { ...state }
        newState.phase = 'action'
        newState.passCount = 0

        // Draw cards for both players at round start
        if (newState.round > 1) {
          // Draw logic handled elsewhere
        }

        GameLogger.state('Phase transition: Round Start → Action')
        return newState
      }
    })

    // Action → Attack Declaration (when attack declared)
    this.addTransition({
      from: 'action',
      to: 'attack_declaration',
      validate: (state) => {
        const player = state[state.activePlayer]
        return player.hasAttackToken && player.bench.length > 0
      },
      execute: (state) => {
        const newState = { ...state }
        newState.phase = 'attack_declaration'
        newState.attackingPlayer = state.activePlayer
        newState.priorityPlayer = state.activePlayer
        newState.canRespond = false

        GameLogger.state('Phase transition: Action → Attack Declaration')
        return newState
      }
    })

    // Attack Declaration → Defense Declaration
    this.addTransition({
      from: 'attack_declaration',
      to: 'defense_declaration',
      validate: (state) => {
        // Must have at least one attacker declared
        return state.lanes.some(lane => lane.attacker !== null)
      },
      execute: (state) => {
        const newState = { ...state }
        newState.phase = 'defense_declaration'
        const defender = state.activePlayer === 'player1' ? 'player2' : 'player1'
        newState.priorityPlayer = defender
        newState.canRespond = true

        GameLogger.state('Phase transition: Attack Declaration → Defense Declaration')
        return newState
      }
    })

    // Defense Declaration → Combat Resolution
    this.addTransition({
      from: 'defense_declaration',
      to: 'combat_resolution',
      validate: () => true,
      execute: (state) => {
        const newState = { ...state }
        newState.phase = 'combat_resolution'
        newState.canRespond = false

        // Combat state ready

        GameLogger.state('Phase transition: Defense Declaration → Combat Resolution')
        return newState
      }
    })

    // Combat Resolution → Action
    this.addTransition({
      from: 'combat_resolution',
      to: 'action',
      validate: () => true,
      execute: (state) => {
        const newState = { ...state }
        newState.phase = 'action'
        newState.combatResolved = true
        newState.attackingPlayer = null
        newState.passCount = 0

        // Clear lanes after combat
        newState.lanes = newState.lanes.map(lane => ({
          ...lane,
          attacker: null,
          defender: null
        }))

        // Combat state cleared

        GameLogger.state('Phase transition: Combat Resolution → Action')
        return newState
      }
    })

    // Action → End Round (when both players pass)
    this.addTransition({
      from: 'action',
      to: 'end_round',
      validate: (state) => {
        return state.passCount >= 2 // Both players passed
      },
      execute: (state) => {
        const newState = { ...state }
        newState.phase = 'end_round'

        GameLogger.state('Phase transition: Action → End Round')
        return newState
      }
    })

    // End Round → Round Start
    this.addTransition({
      from: 'end_round',
      to: 'round_start',
      validate: () => true,
      execute: (state) => {
        const newState = { ...state }
        newState.phase = 'round_start'
        newState.round++
        newState.passCount = 0

        // Switch attack token
        newState.player1.hasAttackToken = !newState.player1.hasAttackToken
        newState.player2.hasAttackToken = !newState.player2.hasAttackToken

        // Reset turn actions
        newState.player1.actionsThisTurn = 0
        newState.player2.actionsThisTurn = 0

        GameLogger.state(`Phase transition: End Round → Round Start (Round ${newState.round})`)
        return newState
      }
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
  transitionTo(state: GameState, targetPhase: Phase): GameState | null {
    const key = `${state.phase}->${targetPhase}`
    const transition = this.transitions.get(key)

    if (!transition) {
      GameLogger.error(`Invalid phase transition: ${key}`)
      return null
    }

    if (!transition.validate(state)) {
      GameLogger.error(`Phase transition validation failed: ${key}`)
      return null
    }

    return transition.execute(state)
  }

  /**
   * Get valid transitions from current phase
   */
  getValidTransitions(state: GameState): Phase[] {
    const validPhases: Phase[] = []

    for (const [key, transition] of this.transitions) {
      if (key.startsWith(`${state.phase}->`) && transition.validate(state)) {
        validPhases.push(transition.to)
      }
    }

    return validPhases
  }

  /**
   * Handle priority passing (LoR-style)
   */
  passPriority(state: GameState): GameState {
    const newState = { ...state }

    // Increment pass count
    newState.passCount = (newState.passCount || 0) + 1

    // Switch priority to other player
    newState.priorityPlayer = newState.priorityPlayer === 'player1' ? 'player2' : 'player1'

    GameLogger.action(`${state.activePlayer} passes priority (${newState.passCount} passes)`)

    // Check if we should auto-transition
    if (newState.passCount >= 2 && state.phase === 'action') {
      // Both passed in action phase - try to end round
      const endRoundState = this.transitionTo(newState, 'end_round')
      if (endRoundState) {
        return endRoundState
      }
    }

    return newState
  }

  /**
   * Reset pass count when an action is taken
   */
  actionTaken(state: GameState): GameState {
    const newState = { ...state }
    newState.passCount = 0

    // Switch priority after action
    newState.priorityPlayer = newState.priorityPlayer === 'player1' ? 'player2' : 'player1'

    return newState
  }

  /**
   * Check if a player can take an action
   */
  canTakeAction(state: GameState, player: 'player1' | 'player2'): boolean {
    // During mulligan, always can act
    if (state.phase === 'mulligan') {
      return true
    }

    // During attack declaration, only attacker can act
    if (state.phase === 'attack_declaration') {
      return player === state.attackingPlayer
    }

    // During defense declaration, only defender can act
    if (state.phase === 'defense_declaration') {
      return player !== state.attackingPlayer
    }

    // During action phase, check priority
    if (state.phase === 'action') {
      return player === (state.priorityPlayer || state.activePlayer)
    }

    return false
  }

  /**
   * Get current phase description for UI
   */
  getPhaseDescription(state: GameState): string {
    switch (state.phase) {
      case 'mulligan':
        return 'Choose cards to mulligan'
      case 'round_start':
        return `Round ${state.round} starting...`
      case 'action':
        const tokenHolder = state.player1.hasAttackToken ? 'Player 1' : 'Player 2'
        return `Action Phase (${tokenHolder} has attack token)`
      case 'attack_declaration':
        return 'Declare your attackers'
      case 'defense_declaration':
        return 'Declare your blockers'
      case 'combat_resolution':
        return 'Resolving combat...'
      case 'end_round':
        return 'Round ending...'
      default:
        return state.phase
    }
  }
}

// Singleton instance
export const phaseManager = new PhaseManagerService()