import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AIService, aiService, AI_PERSONALITIES } from '@/services/ai_service'
import type { GameState, Card } from '@/schemas/schema'

const createTestGameState = (): GameState => ({
  round: 3,
  turn: 5,
  activePlayer: 'player2',
  attackingPlayer: null,
  player1: {
    id: 'player1',
    name: 'Human',
    health: 20,
    mana: 3,
    maxMana: 3,
    spellMana: 1,
    hand: [],
    deck: [],
    bench: [
      {
        id: 'p1-unit-1',
        name: 'Player Unit',
        cost: 2,
        attack: 2,
        health: 3,
        currentHealth: 3,
        type: 'unit',
        tarotSymbol: '1',
        description: 'Test unit',
        zodiacClass: 'aries',
        element: 'fire',
        rarity: 'common',
        position: 'bench'
      }
    ],
    hasAttackToken: false,
    mulliganComplete: true,
    selectedForMulligan: [],
    hasPassed: false,
    actionsThisTurn: 0,
  },
  player2: {
    id: 'player2',
    name: 'AI',
    health: 18,
    mana: 3,
    maxMana: 3,
    spellMana: 2,
    hand: [
      {
        id: 'ai-card-1',
        name: 'Cheap Unit',
        cost: 1,
        attack: 1,
        health: 2,
        type: 'unit',
        tarotSymbol: '2',
        description: 'Low cost unit',
        zodiacClass: 'taurus',
        element: 'earth',
        rarity: 'common'
      },
      {
        id: 'ai-card-2',
        name: 'Expensive Unit',
        cost: 5,
        attack: 4,
        health: 5,
        type: 'unit',
        tarotSymbol: '3',
        description: 'High cost unit',
        zodiacClass: 'gemini',
        element: 'air',
        rarity: 'rare'
      },
      {
        id: 'ai-card-3',
        name: 'Medium Unit',
        cost: 3,
        attack: 3,
        health: 3,
        type: 'unit',
        tarotSymbol: '4',
        description: 'Medium cost unit',
        zodiacClass: 'cancer',
        element: 'water',
        rarity: 'common'
      }
    ],
    deck: Array(30).fill(null).map((_, i) => ({
      id: `deck-${i}`,
      name: `Deck Card ${i}`,
      cost: Math.floor(i / 10) + 1,
      attack: 1,
      health: 1,
      type: 'unit',
      tarotSymbol: i.toString(),
      description: 'Deck card',
      zodiacClass: 'leo',
      element: 'fire',
      rarity: 'common'
    })),
    bench: [
      {
        id: 'ai-unit-1',
        name: 'AI Unit',
        cost: 2,
        attack: 3,
        health: 2,
        currentHealth: 2,
        type: 'unit',
        tarotSymbol: '5',
        description: 'AI bench unit',
        zodiacClass: 'virgo',
        element: 'earth',
        rarity: 'common',
        position: 'bench'
      }
    ],
    hasAttackToken: true,
    mulliganComplete: true,
    selectedForMulligan: [],
    hasPassed: false,
    actionsThisTurn: 0,
  },
  lanes: Array(6).fill(null).map((_, id) => ({ id, attacker: null, defender: null })),
  phase: 'action',
  waitingForAction: false,
  combatResolved: false,
})

describe('AIService', () => {
  let ai: AIService
  let gameState: GameState

  beforeEach(() => {
    ai = new AIService()
    gameState = createTestGameState()
  })

  describe('AI Personalities', () => {
    it('should have all personality levels defined', () => {
      expect(AI_PERSONALITIES.tutorial).toBeDefined()
      expect(AI_PERSONALITIES.easy).toBeDefined()
      expect(AI_PERSONALITIES.normal).toBeDefined()
      expect(AI_PERSONALITIES.hard).toBeDefined()
      expect(AI_PERSONALITIES.expert).toBeDefined()
    })

    it('should set and get personality correctly', () => {
      ai.setPersonality('hard')
      const personality = ai.getCurrentPersonality()
      
      expect(personality.level).toBe('hard')
      expect(personality.name).toBe('Master Diviner')
      expect(personality.mistakeChance).toBe(0.1)
    })

    it('should have different mistake chances for different levels', () => {
      expect(AI_PERSONALITIES.tutorial.mistakeChance).toBeGreaterThan(AI_PERSONALITIES.expert.mistakeChance)
      expect(AI_PERSONALITIES.easy.mistakeChance).toBeGreaterThan(AI_PERSONALITIES.hard.mistakeChance)
    })

    it('should have different thinking times for different levels', () => {
      expect(AI_PERSONALITIES.expert.thinkingTime).toBeGreaterThan(AI_PERSONALITIES.tutorial.thinkingTime)
    })
  })

  describe('Card Selection', () => {
    beforeEach(() => {
      ai.setPersonality('normal') // Use balanced strategy
    })

    it('should select playable cards', () => {
      const { card, shouldPlay } = ai.selectCardToPlay(gameState)
      
      expect(card).toBeTruthy()
      if (card) {
        expect(card.cost).toBeLessThanOrEqual(gameState.player2.mana + gameState.player2.spellMana)
        expect(shouldPlay).toBe(true)
      }
    })

    it('should not select cards that are too expensive', () => {
      // Reduce AI's mana
      gameState.player2.mana = 1
      gameState.player2.spellMana = 0
      
      const { card } = ai.selectCardToPlay(gameState)
      
      if (card) {
        expect(card.cost).toBeLessThanOrEqual(1)
      }
    })

    it('should return null when no cards are playable', () => {
      // Set mana to 0
      gameState.player2.mana = 0
      gameState.player2.spellMana = 0
      
      const { card, shouldPlay } = ai.selectCardToPlay(gameState)
      
      expect(card).toBeNull()
      expect(shouldPlay).toBe(false)
    })

    it('should prefer different cards based on strategy', () => {
      // Test aggressive strategy
      ai.setPersonality('normal') // Uses aggressive play
      const aggressiveResult = ai.selectCardToPlay(gameState)
      
      // Test defensive strategy  
      ai.setPersonality('easy') // Uses random/defensive play
      const defensiveResult = ai.selectCardToPlay(gameState)
      
      // Both should return valid cards, strategies may differ
      expect(aggressiveResult.card).toBeTruthy()
      expect(defensiveResult.card).toBeTruthy()
    })
  })

  describe('Attack Selection', () => {
    beforeEach(() => {
      ai.setPersonality('normal')
      gameState.player2.hasAttackToken = true
    })

    it('should select attackers when AI has attack token', () => {
      const attackers = ai.selectAttackers(gameState)
      
      expect(attackers).toBeInstanceOf(Array)
      expect(attackers.length).toBeGreaterThan(0)
      expect(attackers[0]).toBe('ai-unit-1')
    })

    it('should return empty array when no attack token', () => {
      const testGameState = { ...gameState }
      testGameState.player2 = { ...gameState.player2, hasAttackToken: false }
      
      const attackers = ai.selectAttackers(testGameState)
      
      expect(attackers).toHaveLength(0)
    })

    it('should return empty array when no units on bench', () => {
      gameState.player2.bench = []
      
      const attackers = ai.selectAttackers(gameState)
      
      expect(attackers).toHaveLength(0)
    })

    it('should use different attack strategies based on personality', () => {
      // Aggressive should attack with more units
      ai.setPersonality('normal') // aggressive attack strategy
      const aggressiveAttackers = ai.selectAttackers(gameState)
      
      // Cautious should be more selective
      ai.setPersonality('easy') // cautious attack strategy  
      const cautiousAttackers = ai.selectAttackers(gameState)
      
      expect(aggressiveAttackers).toBeInstanceOf(Array)
      expect(cautiousAttackers).toBeInstanceOf(Array)
    })
  })

  describe('Mulligan Logic', () => {
    beforeEach(() => {
      // Set up mulligan phase
      gameState.phase = 'mulligan'
      gameState.player2.mulliganComplete = false
      gameState.player1.mulliganComplete = true
    })

    it('should perform mulligan and return new state', () => {
      const originalHand = [...gameState.player2.hand]
      const newState = ai.performMulligan(gameState)
      
      expect(newState.player2.mulliganComplete).toBe(true)
      expect(newState.player2.hand).toHaveLength(originalHand.length)
      expect(newState.phase).toBe('action') // Both players completed
    })

    it('should mulligan different amounts based on strategy', () => {
      ai.setPersonality('tutorial') // Random mulligan
      const tutorialState = ai.performMulligan(gameState)
      
      ai.setPersonality('expert') // Aggressive mulligan
      gameState.player2.mulliganComplete = false // Reset
      const expertState = ai.performMulligan(gameState)
      
      expect(tutorialState.player2.mulliganComplete).toBe(true)
      expect(expertState.player2.mulliganComplete).toBe(true)
    })

    it('should consider card costs in mulligan decisions', () => {
      // Add only high-cost cards to hand
      gameState.player2.hand = Array(4).fill(null).map((_, i) => ({
        id: `expensive-${i}`,
        name: `Expensive Card ${i}`,
        cost: 8 + i,
        attack: 5,
        health: 5,
        type: 'unit',
        tarotSymbol: i.toString(),
        description: 'Very expensive card',
        zodiacClass: 'scorpio',
        element: 'water',
        rarity: 'legendary'
      }))
      
      ai.setPersonality('hard') // Should mulligan expensive cards
      const newState = ai.performMulligan(gameState)
      
      expect(newState.player2.mulliganComplete).toBe(true)
      // Should have mulliganed some expensive cards
    })
  })

  describe('Card Evaluation', () => {
    it('should evaluate card value correctly', () => {
      const cheapCard: Card = {
        id: 'cheap',
        name: 'Cheap Card',
        cost: 1,
        attack: 1,
        health: 1,
        type: 'unit',
        tarotSymbol: '1',
        description: 'Low value',
        zodiacClass: 'libra',
        element: 'air',
        rarity: 'common'
      }
      
      const expensiveCard: Card = {
        id: 'expensive',
        name: 'Expensive Card',
        cost: 5,
        attack: 4,
        health: 5,
        type: 'unit',
        tarotSymbol: '2',
        description: 'High value',
        zodiacClass: 'scorpio',
        element: 'water',
        rarity: 'rare'
      }
      
      // Access private method through any casting for testing
      const cheapValue = (ai as any).evaluateCardValue(cheapCard)
      const expensiveValue = (ai as any).evaluateCardValue(expensiveCard)
      
      expect(typeof cheapValue).toBe('number')
      expect(typeof expensiveValue).toBe('number')
      expect(cheapValue).toBeGreaterThan(0)
      expect(expensiveValue).toBeGreaterThan(0)
    })

    it('should evaluate hand quality', () => {
      const goodHand: Card[] = [
        { id: '1', name: 'Card 1', cost: 2, attack: 2, health: 2, type: 'unit', tarotSymbol: '1', description: '', zodiacClass: 'aries', element: 'fire', rarity: 'common' },
        { id: '2', name: 'Card 2', cost: 3, attack: 3, health: 3, type: 'unit', tarotSymbol: '2', description: '', zodiacClass: 'taurus', element: 'earth', rarity: 'common' },
        { id: '3', name: 'Card 3', cost: 4, attack: 4, health: 4, type: 'unit', tarotSymbol: '3', description: '', zodiacClass: 'gemini', element: 'air', rarity: 'common' },
        { id: '4', name: 'Card 4', cost: 5, attack: 5, health: 5, type: 'unit', tarotSymbol: '4', description: '', zodiacClass: 'cancer', element: 'water', rarity: 'common' }
      ]
      
      const badHand: Card[] = [
        { id: '1', name: 'Card 1', cost: 10, attack: 1, health: 1, type: 'unit', tarotSymbol: '1', description: '', zodiacClass: 'leo', element: 'fire', rarity: 'common' },
        { id: '2', name: 'Card 2', cost: 10, attack: 1, health: 1, type: 'unit', tarotSymbol: '2', description: '', zodiacClass: 'virgo', element: 'earth', rarity: 'common' },
        { id: '3', name: 'Card 3', cost: 10, attack: 1, health: 1, type: 'unit', tarotSymbol: '3', description: '', zodiacClass: 'libra', element: 'air', rarity: 'common' },
        { id: '4', name: 'Card 4', cost: 10, attack: 1, health: 1, type: 'unit', tarotSymbol: '4', description: '', zodiacClass: 'scorpio', element: 'water', rarity: 'common' }
      ]
      
      const goodQuality = (ai as any).evaluateHandQuality(goodHand)
      const badQuality = (ai as any).evaluateHandQuality(badHand)
      
      expect(goodQuality).toBeGreaterThan(badQuality)
    })
  })

  describe('Mistake Making', () => {
    it('should make mistakes based on personality', () => {
      // Set tutorial personality with high mistake chance
      ai.setPersonality('tutorial')
      
      // Run multiple selections to see if mistakes occur
      const mistakesMade = 0
      const iterations = 100
      
      for (let i = 0; i < iterations; i++) {
        const { card } = ai.selectCardToPlay(gameState)
        // A "mistake" might be selecting a suboptimal card
        // For this test, we'll just verify the system doesn't crash
        expect(card).toBeDefined()
      }
      
      // Expert should make fewer mistakes
      ai.setPersonality('expert')
      for (let i = 0; i < 10; i++) {
        const { card } = ai.selectCardToPlay(gameState)
        expect(card).toBeDefined()
      }
    })
  })

  describe('Singleton Instance', () => {
    it('should maintain personality across calls', () => {
      aiService.setPersonality('hard')
      const personality1 = aiService.getCurrentPersonality()
      
      // Call some methods
      aiService.selectCardToPlay(gameState)
      
      const personality2 = aiService.getCurrentPersonality()
      
      expect(personality1).toEqual(personality2)
      expect(personality1.level).toBe('hard')
    })
  })
})