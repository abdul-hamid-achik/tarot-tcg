import { describe, it, expect, beforeEach, vi } from 'vitest'
import { winConditionService } from '../win_condition_service'
import { createInitialGameState } from '@/lib/game_logic'
import type { GameState } from '@/schemas/schema'
import type { WinCondition } from '@/schemas/schema'

describe('WinConditionService', () => {
  let gameState: GameState

  beforeEach(() => {
    vi.clearAllMocks()
    gameState = createInitialGameState(undefined, 'standard')
  })

  describe('Game Mode Management', () => {
    it('should initialize with standard game mode', () => {
      const currentMode = winConditionService.getCurrentGameMode()
      expect(currentMode.name).toBe('Standard')
      expect(currentMode.enabledConditions).toContain('health_depletion')
    })

    it('should change game modes correctly', () => {
      winConditionService.setGameMode('arcana_master')
      const currentMode = winConditionService.getCurrentGameMode()
      
      expect(currentMode.name).toBe('Arcana Master')
      expect(currentMode.enabledConditions).toContain('health_depletion')
      expect(currentMode.enabledConditions).toContain('arcana_completion')
    })

    it('should activate corresponding win conditions when mode changes', () => {
      winConditionService.setGameMode('zodiac_mystic')
      const activeConditions = winConditionService.getActiveConditions()
      
      const conditionIds = activeConditions.map(c => c.id)
      expect(conditionIds).toContain('health_depletion')
      expect(conditionIds).toContain('zodiac_alignment')
    })
  })

  describe('Default Win Conditions', () => {
    it('should detect health depletion win condition', () => {
      const testState: GameState = {
        ...gameState,
        player2: { ...gameState.player2, health: 0 }
      }

      const result = winConditionService.checkWinConditions(testState)
      
      expect(result?.achieved).toBe(true)
      expect(result?.winner).toBe('player1')
      expect(result?.message).toContain('health to 0')
    })

    it('should detect deck depletion win condition', () => {
      winConditionService.setGameMode('mill_master')
      
      const testState: GameState = {
        ...gameState,
        player2: { ...gameState.player2, deck: [] }
      }

      const result = winConditionService.checkWinConditions(testState)
      
      expect(result?.achieved).toBe(true)
      expect(result?.winner).toBe('player1')
      expect(result?.message).toContain('depleting opponent\'s deck')
    })

    it('should not trigger win condition when requirements not met', () => {
      const testState: GameState = {
        ...gameState,
        player2: { ...gameState.player2, health: 5 }
      }

      const result = winConditionService.checkWinConditions(testState)
      expect(result?.achieved).toBeFalsy()
    })
  })

  describe('Board Domination Win Condition', () => {
    beforeEach(() => {
      winConditionService.setGameMode('domination')
    })

    it('should start tracking when player has 6 units', () => {
      const testState: GameState = {
        ...gameState,
        player1: {
          ...gameState.player1,
          bench: Array(6).fill(null).map((_, i) => ({
            id: `unit-${i}`,
            name: `Unit ${i}`,
            cost: 1,
            attack: 1,
            health: 1,
            type: 'unit' as const,
            tarotSymbol: '0',
            description: 'Test unit',
            zodiacClass: 'aries',
            element: 'fire',
            rarity: 'common',
            currentHealth: 1,
            position: 'bench' as const,
            isReversed: false
          }))
        }
      }

      const result = winConditionService.checkWinConditions(testState)
      expect(result?.achieved).toBe(false)
      expect(result?.message).toContain('dominates the board')
    })

    it('should win after maintaining domination for 3 turns', () => {
      const testState: GameState = {
        ...gameState,
        turn: 4, // 3 turns later
        player1: {
          ...gameState.player1,
          bench: Array(6).fill(null).map((_, i) => ({
            id: `unit-${i}`,
            name: `Unit ${i}`,
            cost: 1,
            attack: 1,
            health: 1,
            type: 'unit' as const,
            tarotSymbol: '0',
            description: 'Test unit',
            zodiacClass: 'aries',
            element: 'fire',
            rarity: 'common',
            currentHealth: 1,
            position: 'bench' as const,
            isReversed: false
          }))
        }
      }

      // Simulate tracking history
      winConditionService['state'].conditionHistory.set('board_domination_player1', {
        playerId: 'player1',
        turnsActive: 3,
        firstAchievedTurn: 1,
        lastCheckedTurn: 3
      })

      const result = winConditionService.checkWinConditions(testState)
      expect(result?.achieved).toBe(true)
      expect(result?.winner).toBe('player1')
    })
  })

  describe('Elemental Alignment Win Condition', () => {
    beforeEach(() => {
      winConditionService.setGameMode('elemental_sage')
    })

    it('should detect when all 4 elements are on field', () => {
      const testState: GameState = {
        ...gameState,
        player1: {
          ...gameState.player1,
          bench: [
            {
              id: 'fire-unit',
              name: 'Fire Unit',
              cost: 1, attack: 1, health: 1,
              type: 'unit' as const,
              tarotSymbol: '0',
              description: 'Fire element',
              zodiacClass: 'aries',
              element: 'fire',
              rarity: 'common',
              currentHealth: 1,
              position: 'bench' as const,
              isReversed: false
            },
            {
              id: 'water-unit',
              name: 'Water Unit',
              cost: 1, attack: 1, health: 1,
              type: 'unit' as const,
              tarotSymbol: '1',
              description: 'Water element',
              zodiacClass: 'cancer',
              element: 'water',
              rarity: 'common',
              currentHealth: 1,
              position: 'bench' as const,
              isReversed: false
            },
            {
              id: 'earth-unit',
              name: 'Earth Unit',
              cost: 1, attack: 1, health: 1,
              type: 'unit' as const,
              tarotSymbol: '2',
              description: 'Earth element',
              zodiacClass: 'taurus',
              element: 'earth',
              rarity: 'common',
              currentHealth: 1,
              position: 'bench' as const,
              isReversed: false
            },
            {
              id: 'air-unit',
              name: 'Air Unit',
              cost: 1, attack: 1, health: 1,
              type: 'unit' as const,
              tarotSymbol: '3',
              description: 'Air element',
              zodiacClass: 'gemini',
              element: 'air',
              rarity: 'common',
              currentHealth: 1,
              position: 'bench' as const,
              isReversed: false
            }
          ]
        }
      }

      const result = winConditionService.checkWinConditions(testState)
      expect(result?.achieved).toBe(true)
      expect(result?.winner).toBe('player1')
      expect(result?.message).toContain('aligning all four elements')
    })

    it('should not win with incomplete elements', () => {
      const testState: GameState = {
        ...gameState,
        player1: {
          ...gameState.player1,
          bench: [
            {
              id: 'fire-unit',
              name: 'Fire Unit',
              cost: 1, attack: 1, health: 1,
              type: 'unit' as const,
              tarotSymbol: '0',
              description: 'Fire element',
              zodiacClass: 'aries',
              element: 'fire',
              rarity: 'common',
              currentHealth: 1,
              position: 'bench' as const,
              isReversed: false
            },
            {
              id: 'water-unit',
              name: 'Water Unit',
              cost: 1, attack: 1, health: 1,
              type: 'unit' as const,
              tarotSymbol: '1',
              description: 'Water element',
              zodiacClass: 'cancer',
              element: 'water',
              rarity: 'common',
              currentHealth: 1,
              position: 'bench' as const,
              isReversed: false
            }
          ]
        }
      }

      const result = winConditionService.checkWinConditions(testState)
      expect(result?.achieved).toBe(false)
    })
  })

  describe('Turn Survival Win Condition', () => {
    beforeEach(() => {
      winConditionService.setGameMode('survival')
    })

    it('should win when reaching target turn with health', () => {
      const testState: GameState = {
        ...gameState,
        turn: 15,
        player1: { ...gameState.player1, health: 10 }
      }

      const result = winConditionService.checkWinConditions(testState)
      expect(result?.achieved).toBe(true)
      expect(result?.winner).toBe('player1')
      expect(result?.message).toContain('surviving to turn 15')
    })

    it('should not win if player is dead', () => {
      const testState: GameState = {
        ...gameState,
        turn: 15,
        player1: { ...gameState.player1, health: 0 }
      }

      const result = winConditionService.checkWinConditions(testState)
      expect(result?.achieved).toBe(false)
    })
  })

  describe('Win Condition Priority', () => {
    it('should prioritize higher priority win conditions', () => {
      winConditionService.setGameMode('chaos') // Multiple conditions active
      
      const testState: GameState = {
        ...gameState,
        player1: { ...gameState.player1, health: 25 },
        player2: { ...gameState.player2, health: 0 } // Health depletion (priority 100)
      }

      const result = winConditionService.checkWinConditions(testState)
      expect(result?.achieved).toBe(true)
      expect(result?.winner).toBe('player1')
      // Should use health depletion win condition due to higher priority
    })
  })

  describe('Custom Win Conditions', () => {
    it('should allow registering custom win conditions', () => {
      const customCondition: WinCondition = {
        id: 'custom_test',
        name: 'Custom Test',
        description: 'Custom win condition for testing',
        type: 'card_collection',
        priority: 60,
        toggleable: true,
        checkCondition: (gameState, playerId) => ({
          achieved: gameState.turn >= 5,
          winner: gameState.turn >= 5 ? playerId : undefined,
          message: 'Custom test win condition',
          timestamp: Date.now()
        }),
        config: { targetAmount: 5 }
      }

      winConditionService.registerWinCondition(customCondition)
      winConditionService.toggleWinCondition('custom_test', true)

      const activeConditions = winConditionService.getActiveConditions()
      expect(activeConditions.some(c => c.id === 'custom_test')).toBe(true)
    })
  })

  describe('Progress Tracking', () => {
    it('should track player progress correctly', () => {
      const progress = winConditionService.getPlayerProgress('player1')
      expect(progress).toBeInstanceOf(Map)
    })

    it('should reset state correctly', () => {
      // Add some progress
      winConditionService['state'].eventCounters.set('test', new Map([['player1', 5]]))
      
      winConditionService.resetState()
      
      const progress = winConditionService.getPlayerProgress('player1')
      expect(progress.size).toBe(0)
      expect(winConditionService['state'].eventCounters.size).toBe(0)
    })
  })

  describe('Game Mode Presets', () => {
    it('should have all required game mode presets', () => {
      const modes = ['standard', 'arcana_master', 'zodiac_mystic', 'elemental_sage', 'mill_master', 'domination', 'survival', 'chaos', 'puzzle']
      
      for (const mode of modes) {
        expect(() => winConditionService.setGameMode(mode as any)).not.toThrow()
      }
    })

    it('should disable default health win in puzzle mode', () => {
      winConditionService.setGameMode('puzzle')
      const mode = winConditionService.getCurrentGameMode()
      
      expect(mode.disabledConditions).toContain('health_depletion')
      expect(mode.enabledConditions).not.toContain('health_depletion')
    })
  })
})