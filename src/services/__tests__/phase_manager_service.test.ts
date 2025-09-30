import { describe, it, expect, beforeEach, vi } from 'vitest'

// Unmock phase_manager_service for this test file
vi.unmock('../phase_manager_service')
vi.unmock('@/services/phase_manager_service')

import { PhaseManagerService, type Phase } from '../phase_manager_service'
import { createTestGameState } from '../../test_utils'
import type { GameState } from '../../schemas/schema'

// Mock GameLogger
vi.mock('@/lib/game_logger', () => ({
    GameLogger: {
        state: vi.fn(),
        action: vi.fn(),
        error: vi.fn(),
    },
}))

describe('PhaseManagerService', () => {
    let phaseManager: PhaseManagerService
    let gameState: GameState

    beforeEach(() => {
        phaseManager = new PhaseManagerService()
        gameState = createTestGameState()
    })

    describe('Phase Transitions', () => {
        describe('Mulligan → Round Start', () => {
            it('should transition when both players complete mulligan', () => {
                gameState.phase = 'mulligan'
                gameState.player1.mulliganComplete = true
                gameState.player2.mulliganComplete = true

                const newState = phaseManager.tryTransition(gameState, 'round_start')

                expect(newState.phase).toBe('round_start')
                expect(newState.priorityPlayer).toBe('player1')
                expect(newState.canRespond).toBe(false)
            })

            it('should not transition if player1 mulligan incomplete', () => {
                gameState.phase = 'mulligan'
                gameState.player1.mulliganComplete = false
                gameState.player2.mulliganComplete = true

                const newState = phaseManager.tryTransition(gameState, 'round_start')

                expect(newState.phase).toBe('mulligan')
            })

            it('should not transition if player2 mulligan incomplete', () => {
                gameState.phase = 'mulligan'
                gameState.player1.mulliganComplete = true
                gameState.player2.mulliganComplete = false

                const newState = phaseManager.tryTransition(gameState, 'round_start')

                expect(newState.phase).toBe('mulligan')
            })
        })

        describe('Round Start → Action', () => {
            it('should transition to action phase', () => {
                gameState.phase = 'round_start'
                gameState.activePlayer = 'player1'

                const newState = phaseManager.tryTransition(gameState, 'action')

                expect(newState.phase).toBe('action')
                expect(newState.priorityPlayer).toBe('player1')
                expect(newState.canRespond).toBe(false)
                expect(newState.waitingForAction).toBe(true)
            })

            it('should set priority to active player', () => {
                gameState.phase = 'round_start'
                gameState.activePlayer = 'player2'

                const newState = phaseManager.tryTransition(gameState, 'action')

                expect(newState.priorityPlayer).toBe('player2')
            })
        })

        describe('Action → Combat Resolution', () => {
            it('should transition to combat resolution', () => {
                gameState.phase = 'action'
                gameState.activePlayer = 'player1'

                const newState = phaseManager.tryTransition(gameState, 'combat_resolution')

                expect(newState.phase).toBe('combat_resolution')
                expect(newState.priorityPlayer).toBe('player1')
                expect(newState.canRespond).toBe(false)
            })
        })

        describe('Combat Resolution → Action', () => {
            it('should transition back to action phase', () => {
                gameState.phase = 'combat_resolution'
                gameState.activePlayer = 'player1'

                const newState = phaseManager.tryTransition(gameState, 'action')

                expect(newState.phase).toBe('action')
                expect(newState.combatResolved).toBe(true)
                expect(newState.priorityPlayer).toBe('player1')
            })
        })

        describe('Action → End Round', () => {
            it('should transition when active player has passed', () => {
                gameState.phase = 'action'
                gameState.activePlayer = 'player1'
                gameState.player1.hasPassed = true

                const newState = phaseManager.tryTransition(gameState, 'end_round')

                expect(newState.phase).toBe('end_round')
                expect(newState.waitingForAction).toBe(false)
            })

            it('should transition when pass count reaches 2', () => {
                gameState.phase = 'action'
                gameState.activePlayer = 'player1'
                gameState.passCount = 2

                const newState = phaseManager.tryTransition(gameState, 'end_round')

                expect(newState.phase).toBe('end_round')
            })

            it('should not transition if player has not passed', () => {
                gameState.phase = 'action'
                gameState.activePlayer = 'player1'
                gameState.player1.hasPassed = false
                gameState.passCount = 0

                const newState = phaseManager.tryTransition(gameState, 'end_round')

                expect(newState.phase).toBe('action')
            })
        })

        describe('End Round → Round Start', () => {
            it('should switch active player', () => {
                gameState.phase = 'end_round'
                gameState.activePlayer = 'player1'
                gameState.turn = 1

                const newState = phaseManager.tryTransition(gameState, 'round_start')

                expect(newState.activePlayer).toBe('player2')
            })

            it('should increment turn', () => {
                gameState.phase = 'end_round'
                gameState.turn = 1

                const newState = phaseManager.tryTransition(gameState, 'round_start')

                expect(newState.turn).toBe(2)
            })

            it('should increment round on odd turns', () => {
                gameState.phase = 'end_round'
                gameState.round = 1
                gameState.turn = 2 // After increment, becomes 3 (odd)

                const newState = phaseManager.tryTransition(gameState, 'round_start')

                expect(newState.round).toBe(2)
            })

            it('should not increment round on even turns', () => {
                gameState.phase = 'end_round'
                gameState.round = 1
                gameState.turn = 1 // After increment, becomes 2 (even)

                const newState = phaseManager.tryTransition(gameState, 'round_start')

                expect(newState.round).toBe(1)
            })

            it('should reset combat and pass state', () => {
                gameState.phase = 'end_round'
                gameState.combatResolved = true
                gameState.passCount = 2

                const newState = phaseManager.tryTransition(gameState, 'round_start')

                expect(newState.combatResolved).toBe(false)
                expect(newState.passCount).toBe(0)
            })
        })
    })

    describe('Invalid Transitions', () => {
        it('should reject invalid phase transition', () => {
            gameState.phase = 'mulligan'

            const newState = phaseManager.tryTransition(gameState, 'combat_resolution')

            expect(newState.phase).toBe('mulligan')
        })

        it('should reject skipping phases', () => {
            gameState.phase = 'action'

            const newState = phaseManager.tryTransition(gameState, 'round_start')

            expect(newState.phase).toBe('action')
        })

        it('should reject backward invalid transitions', () => {
            gameState.phase = 'combat_resolution'

            const newState = phaseManager.tryTransition(gameState, 'mulligan')

            expect(newState.phase).toBe('combat_resolution')
        })
    })

    describe('Valid Transitions Query', () => {
        it('should return valid transitions from mulligan', () => {
            const validTransitions = phaseManager.getValidTransitions('mulligan')

            expect(validTransitions).toEqual(['round_start'])
        })

        it('should return valid transitions from round_start', () => {
            const validTransitions = phaseManager.getValidTransitions('round_start')

            expect(validTransitions).toEqual(['action'])
        })

        it('should return valid transitions from action', () => {
            const validTransitions = phaseManager.getValidTransitions('action')

            expect(validTransitions).toContain('combat_resolution')
            expect(validTransitions).toContain('end_round')
            expect(validTransitions.length).toBe(2)
        })

        it('should return valid transitions from combat_resolution', () => {
            const validTransitions = phaseManager.getValidTransitions('combat_resolution')

            expect(validTransitions).toEqual(['action'])
        })

        it('should return valid transitions from end_round', () => {
            const validTransitions = phaseManager.getValidTransitions('end_round')

            expect(validTransitions).toEqual(['round_start'])
        })
    })

    describe('Auto-advance Phase', () => {
        it('should auto-advance from mulligan when both players complete', () => {
            gameState.phase = 'mulligan'
            gameState.player1.mulliganComplete = true
            gameState.player2.mulliganComplete = true

            const newState = phaseManager.autoAdvancePhase(gameState)

            expect(newState.phase).toBe('round_start')
        })

        it('should auto-advance from round_start to action', () => {
            gameState.phase = 'round_start'

            const newState = phaseManager.autoAdvancePhase(gameState)

            expect(newState.phase).toBe('action')
        })

        it('should auto-advance from combat_resolution to action', () => {
            gameState.phase = 'combat_resolution'

            const newState = phaseManager.autoAdvancePhase(gameState)

            expect(newState.phase).toBe('action')
        })

        it('should auto-advance from action to combat_resolution first', () => {
            gameState.phase = 'action'
            gameState.activePlayer = 'player1'
            gameState.player1.hasPassed = true // Even if passed, combat_resolution comes first

            const newState = phaseManager.autoAdvancePhase(gameState)

            // Auto-advance picks first valid transition, which is combat_resolution
            expect(newState.phase).toBe('combat_resolution')
        })

        it('should auto-advance from action to combat_resolution by default', () => {
            gameState.phase = 'action'
            gameState.activePlayer = 'player1'
            gameState.player1.hasPassed = false
            gameState.passCount = 0

            const newState = phaseManager.autoAdvancePhase(gameState)

            // combat_resolution has no validation, so it always auto-advances
            expect(newState.phase).toBe('combat_resolution')
        })

        it('should only advance one phase at a time', () => {
            gameState.phase = 'mulligan'
            gameState.player1.mulliganComplete = true
            gameState.player2.mulliganComplete = true

            const newState = phaseManager.autoAdvancePhase(gameState)

            // Should stop at round_start, not continue to action
            expect(newState.phase).toBe('round_start')
        })
    })

    describe('Player Action Permissions', () => {
        describe('Mulligan Phase', () => {
            it('should allow player to act if mulligan incomplete', () => {
                gameState.phase = 'mulligan'
                gameState.activePlayer = 'player1'
                gameState.player1.mulliganComplete = false

                expect(phaseManager.canPlayerAct(gameState, 'player1')).toBe(true)
            })

            it('should not allow player to act if mulligan complete', () => {
                gameState.phase = 'mulligan'
                gameState.activePlayer = 'player1'
                gameState.player1.mulliganComplete = true

                expect(phaseManager.canPlayerAct(gameState, 'player1')).toBe(false)
            })

            it('should not allow inactive player to act', () => {
                gameState.phase = 'mulligan'
                gameState.activePlayer = 'player1'
                gameState.player2.mulliganComplete = false

                expect(phaseManager.canPlayerAct(gameState, 'player2')).toBe(false)
            })
        })

        describe('Action Phase', () => {
            it('should allow active player to act if not passed', () => {
                gameState.phase = 'action'
                gameState.activePlayer = 'player1'
                gameState.player1.hasPassed = false

                expect(phaseManager.canPlayerAct(gameState, 'player1')).toBe(true)
            })

            it('should not allow player to act if passed', () => {
                gameState.phase = 'action'
                gameState.activePlayer = 'player1'
                gameState.player1.hasPassed = true

                expect(phaseManager.canPlayerAct(gameState, 'player1')).toBe(false)
            })

            it('should not allow inactive player to act', () => {
                gameState.phase = 'action'
                gameState.activePlayer = 'player1'
                gameState.player2.hasPassed = false

                expect(phaseManager.canPlayerAct(gameState, 'player2')).toBe(false)
            })
        })

        describe('System-controlled Phases', () => {
            it('should not allow actions in round_start', () => {
                gameState.phase = 'round_start'
                gameState.activePlayer = 'player1'

                expect(phaseManager.canPlayerAct(gameState, 'player1')).toBe(false)
            })

            it('should not allow actions in combat_resolution', () => {
                gameState.phase = 'combat_resolution'
                gameState.activePlayer = 'player1'

                expect(phaseManager.canPlayerAct(gameState, 'player1')).toBe(false)
            })

            it('should not allow actions in end_round', () => {
                gameState.phase = 'end_round'
                gameState.activePlayer = 'player1'

                expect(phaseManager.canPlayerAct(gameState, 'player1')).toBe(false)
            })
        })
    })

    describe('Phase Descriptions', () => {
        it('should return mulligan description', () => {
            gameState.phase = 'mulligan'

            const desc = phaseManager.getPhaseDescription(gameState)

            expect(desc).toBe('Choose cards to mulligan')
        })

        it('should return round_start description', () => {
            gameState.phase = 'round_start'

            const desc = phaseManager.getPhaseDescription(gameState)

            expect(desc).toBe('Starting new round...')
        })

        it('should return action description with attack token holder', () => {
            gameState.phase = 'action'
            gameState.player1.hasAttackToken = true

            const desc = phaseManager.getPhaseDescription(gameState)

            expect(desc).toBe('Action Phase (Player 1 has attack token)')
        })

        it('should return action description for player 2 with token', () => {
            gameState.phase = 'action'
            gameState.player1.hasAttackToken = false

            const desc = phaseManager.getPhaseDescription(gameState)

            expect(desc).toBe('Action Phase (Player 2 has attack token)')
        })

        it('should return combat_resolution description', () => {
            gameState.phase = 'combat_resolution'

            const desc = phaseManager.getPhaseDescription(gameState)

            expect(desc).toBe('Resolving combat...')
        })

        it('should return end_round description', () => {
            gameState.phase = 'end_round'

            const desc = phaseManager.getPhaseDescription(gameState)

            expect(desc).toBe('Ending round...')
        })
    })

    describe('Phase Manager Lifecycle', () => {
        it('should reset successfully', () => {
            phaseManager.reset()

            // Phase manager is stateless, should not throw
            expect(phaseManager).toBeDefined()
        })

        it('should handle multiple transitions in sequence', () => {
            gameState.phase = 'mulligan'
            gameState.player1.mulliganComplete = true
            gameState.player2.mulliganComplete = true

            // Mulligan → Round Start
            let newState = phaseManager.tryTransition(gameState, 'round_start')
            expect(newState.phase).toBe('round_start')

            // Round Start → Action
            newState = phaseManager.tryTransition(newState, 'action')
            expect(newState.phase).toBe('action')

            // Action → Combat Resolution
            newState = phaseManager.tryTransition(newState, 'combat_resolution')
            expect(newState.phase).toBe('combat_resolution')

            // Combat Resolution → Action
            newState = phaseManager.tryTransition(newState, 'action')
            expect(newState.phase).toBe('action')

            // Action → End Round
            newState.player1.hasPassed = true
            newState = phaseManager.tryTransition(newState, 'end_round')
            expect(newState.phase).toBe('end_round')

            // End Round → Round Start
            newState = phaseManager.tryTransition(newState, 'round_start')
            expect(newState.phase).toBe('round_start')
        })
    })
})
