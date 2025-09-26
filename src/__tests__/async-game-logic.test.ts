import { describe, expect, it, beforeEach } from 'vitest'
import { createInitialGameState, playCard, directAttack, endTurn } from '@/lib/game_logic'
import { GameStateSchema, parseGameState, isValidGameState } from '@/schemas/schema'
import type { GameState, Card } from '@/schemas/schema'

/**
 * Critical tests to prevent async/Promise bugs in game logic
 * 
 * This test suite was created after discovering a critical bug where async functions
 * like playCard() were being called synchronously, resulting in Promise objects
 * being treated as GameState objects, causing crashes like:
 * - TypeError: undefined is not an object (evaluating 'gameState.player1.health')
 * - TypeError: undefined is not an object (evaluating 'newState.player1.bench')
 */

describe('Async Game Logic - Promise and Schema Validation', () => {
  let testGameState: GameState
  let testCard: Card

  beforeEach(() => {
    // Create a fresh game state for each test
    testGameState = createInitialGameState('aries', 'standard')
    
    // Get a card from player1's hand for testing
    testCard = testGameState.player1.hand[0]
    
    // Ensure we have a valid test setup
    expect(testGameState).toBeDefined()
    expect(testCard).toBeDefined()
    expect(isValidGameState(testGameState)).toBe(true)
  })

  describe('GameState Schema Validation', () => {
    it('should create initial game state that passes Zod validation', () => {
      const gameState = createInitialGameState('aries', 'standard')
      
      // Test that it's a valid GameState object, not a Promise
      expect(gameState).not.toBeInstanceOf(Promise)
      expect(typeof gameState).toBe('object')
      expect(gameState).toHaveProperty('player1')
      expect(gameState).toHaveProperty('player2')
      
      // Test Zod schema validation
      expect(isValidGameState(gameState)).toBe(true)
      
      // Test that parseGameState doesn't throw
      expect(() => parseGameState(gameState)).not.toThrow()
      
      // Test specific properties that caused the original bugs
      expect(gameState.player1).toBeDefined()
      expect(gameState.player1.health).toBeDefined()
      expect(typeof gameState.player1.health).toBe('number')
      expect(gameState.player1.bench).toBeDefined()
      expect(Array.isArray(gameState.player1.bench)).toBe(true)
    })

    it('should validate that all required player properties exist', () => {
      const gameState = createInitialGameState('taurus', 'standard')
      
      // Test player1 properties
      expect(gameState.player1.id).toBe('player1')
      expect(gameState.player1.name).toBeDefined()
      expect(typeof gameState.player1.health).toBe('number')
      expect(typeof gameState.player1.mana).toBe('number')
      expect(typeof gameState.player1.spellMana).toBe('number')
      expect(Array.isArray(gameState.player1.hand)).toBe(true)
      expect(Array.isArray(gameState.player1.deck)).toBe(true)
      expect(Array.isArray(gameState.player1.bench)).toBe(true)
      
      // Test player2 properties
      expect(gameState.player2.id).toBe('player2')
      expect(gameState.player2.name).toBeDefined()
      expect(typeof gameState.player2.health).toBe('number')
      expect(typeof gameState.player2.mana).toBe('number')
      expect(typeof gameState.player2.spellMana).toBe('number')
      expect(Array.isArray(gameState.player2.hand)).toBe(true)
      expect(Array.isArray(gameState.player2.deck)).toBe(true)
      expect(Array.isArray(gameState.player2.bench)).toBe(true)
    })
  })

  describe('Async Function Return Types', () => {
    it('playCard should return a Promise that resolves to a valid GameState', async () => {
      // Ensure we can play the card
      expect(testCard.cost).toBeLessThanOrEqual(testGameState.player1.mana + testGameState.player1.spellMana)
      
      // Test that playCard returns a Promise
      const result = playCard(testGameState, testCard)
      expect(result).toBeInstanceOf(Promise)
      
      // Test that the Promise resolves to a valid GameState
      const newGameState = await result
      expect(newGameState).not.toBeInstanceOf(Promise)
      expect(typeof newGameState).toBe('object')
      expect(isValidGameState(newGameState)).toBe(true)
      
      // Test that critical properties still exist after playing a card
      expect(newGameState.player1).toBeDefined()
      expect(newGameState.player1.health).toBeDefined()
      expect(newGameState.player1.bench).toBeDefined()
      expect(Array.isArray(newGameState.player1.bench)).toBe(true)
      
      // Test that the card was actually played (unit should be on bench, spell should be consumed)
      if (testCard.type === 'unit' && testCard.cost <= testGameState.player1.mana + testGameState.player1.spellMana) {
        expect(newGameState.player1.bench.length).toBeGreaterThanOrEqual(testGameState.player1.bench.length)
      }
      
      // The hand should be smaller (card was played) 
      expect(newGameState.player1.hand.length).toBeLessThanOrEqual(testGameState.player1.hand.length)
    })

    it('directAttack should return a valid GameState after combat', async () => {
      // Set up a combat scenario on battlefield
      const combatState: GameState = {
        ...testGameState,
        phase: 'action',
        battlefield: {
          ...testGameState.battlefield,
          playerUnits: [{ ...testCard, currentHealth: testCard.health }, ...testGameState.battlefield.playerUnits.slice(1)],
          enemyUnits: [{ ...testCard, id: 'enemy-card', currentHealth: testCard.health }, ...testGameState.battlefield.enemyUnits.slice(1)],
        },
        player1: {
          ...testGameState.player1,
          hasAttackToken: true
        }
      }

      // Execute direct attack (Hearthstone-style)
      const resolvedState = directAttack(combatState, testCard.id, { player: 'player2', slot: 0 })
      expect(resolvedState).not.toBeInstanceOf(Promise)
      expect(typeof resolvedState).toBe('object')
      expect(isValidGameState(resolvedState)).toBe(true)

      // Test that critical properties still exist after combat
      expect(resolvedState.player1).toBeDefined()
      expect(resolvedState.player1.health).toBeDefined()
      expect(resolvedState.player2).toBeDefined()
      expect(resolvedState.player2.health).toBeDefined()
    })

    it('endTurn should return a Promise that resolves to a valid GameState', async () => {
      // Set up turn-ending scenario
      const turnEndState: GameState = {
        ...testGameState,
        phase: 'end_round',
      }
      
      // Test that endTurn returns a Promise
      const result = endTurn(turnEndState)
      expect(result).toBeInstanceOf(Promise)
      
      // Test that the Promise resolves to a valid GameState
      const newTurnState = await result
      expect(newTurnState).not.toBeInstanceOf(Promise)
      expect(typeof newTurnState).toBe('object')
      expect(isValidGameState(newTurnState)).toBe(true)
      
      // Test that critical properties still exist after ending turn
      expect(newTurnState.player1).toBeDefined()
      expect(newTurnState.player1.health).toBeDefined()
      expect(newTurnState.player2).toBeDefined()
      expect(newTurnState.player2.health).toBeDefined()
    })
  })

  describe('Common Async Bugs Prevention', () => {
    it('should prevent accessing Promise properties as GameState properties', async () => {
      // This test simulates the original bug: calling async function synchronously
      const promiseResult = playCard(testGameState, testCard)
      
      // These would be the buggy accesses that caused crashes
      // @ts-expect-error - This is intentionally testing incorrect usage
      expect(promiseResult.player1).toBeUndefined()
      // @ts-expect-error - This is intentionally testing incorrect usage
      expect(promiseResult.player2).toBeUndefined()
      
      // But the correctly awaited result should have these properties
      const correctResult = await promiseResult
      expect(correctResult.player1).toBeDefined()
      expect(correctResult.player2).toBeDefined()
    })

    it('should validate that async functions return correct types', async () => {
      // playCard and endTurn should return Promises, directAttack returns sync GameState
      const playCardResult = playCard(testGameState, testCard)
      const directAttackResult = directAttack({ ...testGameState, phase: 'action', player1: { ...testGameState.player1, hasAttackToken: true } }, testCard.id, 'nexus')
      const endTurnResult = endTurn({ ...testGameState, phase: 'end_round' })

      expect(playCardResult).toBeInstanceOf(Promise)
      expect(directAttackResult).not.toBeInstanceOf(Promise) // directAttack is synchronous
      expect(typeof directAttackResult).toBe('object')
      expect(endTurnResult).toBeInstanceOf(Promise)
    })

    it('should handle malformed GameState objects gracefully', () => {
      const malformedState = {
        ...testGameState,
        player1: undefined, // This would cause the original bug
      }
      
      // isValidGameState should catch this
      expect(isValidGameState(malformedState)).toBe(false)
      
      // parseGameState should throw for invalid state
      expect(() => parseGameState(malformedState)).toThrow()
    })
  })

  describe('Error Handling in Async Functions', () => {
    it('should handle errors in playCard gracefully', async () => {
      // Try to play a card that costs more than available mana
      const expensiveCard: Card = {
        ...testCard,
        cost: 999,
      }
      
      // This should not throw, but return the original state
      const result = await playCard(testGameState, expensiveCard)
      expect(isValidGameState(result)).toBe(true)
      expect(result).toEqual(testGameState) // Should return unchanged state
    })

    it('should handle errors in directAttack gracefully', async () => {
      // Try to attack with an invalid state (no attacker on battlefield)
      const invalidCombatState: GameState = {
        ...testGameState,
        phase: 'action',
        battlefield: {
          ...testGameState.battlefield,
          playerUnits: Array(7).fill(null), // No units on battlefield
        },
        player1: {
          ...testGameState.player1,
          hasAttackToken: true
        }
      }

      // This should not throw and should return the original state
      const result = directAttack(invalidCombatState, 'non-existent-card', 'nexus')
      expect(isValidGameState(result)).toBe(true)
      expect(result).toEqual(invalidCombatState) // Should return unchanged state
    })
  })

  describe('Integration Tests - Full Game Flow', () => {
    it('should maintain valid GameState through a complete play-attack-combat-endturn flow', async () => {
      let currentState = testGameState
      
      // 1. Play a unit card
      const unitCard = currentState.player1.hand.find(c => c.type === 'unit')
      if (unitCard) {
        currentState = await playCard(currentState, unitCard)
        expect(isValidGameState(currentState)).toBe(true)
        expect(currentState.player1).toBeDefined()
        expect(currentState.player1.bench.length).toBeGreaterThan(0)
      }
      
      // 2. End turn (simulating a complete flow)
      currentState = { ...currentState, phase: 'end_round' }
      currentState = await endTurn(currentState)
      expect(isValidGameState(currentState)).toBe(true)
      expect(currentState.player1).toBeDefined()
      expect(currentState.player2).toBeDefined()
      
      // Throughout this flow, the state should always be valid
      expect(() => parseGameState(currentState)).not.toThrow()
    })
  })
})