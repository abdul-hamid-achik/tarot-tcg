import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock the card loader to provide consistent test cards
vi.mock('@/lib/card_loader', () => {
  const testCards = [
    {
      id: 'test-unit-1',
      name: 'Test Unit 1',
      cost: 1,
      attack: 2,
      health: 1,
      type: 'unit',
      zodiacClass: 'aries',
      element: 'fire',
      rarity: 'common',
      description: 'A test unit card',
    },
    {
      id: 'test-unit-2',
      name: 'Test Unit 2',
      cost: 2,
      attack: 3,
      health: 2,
      type: 'unit',
      zodiacClass: 'taurus',
      element: 'earth',
      rarity: 'common',
      description: 'Another test unit card',
    },
    {
      id: 'test-spell-1',
      name: 'Test Spell',
      cost: 1,
      attack: 0,
      health: 0,
      type: 'spell',
      zodiacClass: 'gemini',
      element: 'air',
      rarity: 'common',
      description: 'A test spell card',
      spellType: 'instant',
    },
  ]

  return {
    getAllCards: () => testCards,
    getCardById: (id: string) => testCards.find(c => c.id === id),
    getCardsByZodiacClass: (zodiacClass: string) => testCards.filter(c => c.zodiacClass === zodiacClass),
    getFilteredCards: () => testCards,
    createRandomDeck: (size: number) => {
      const baseCard = {
        id: 'random-card',
        name: 'Random Card',
        cost: 1,
        attack: 1,
        health: 1,
        type: 'unit' as const,
        zodiacClass: 'aries' as const,
        element: 'fire' as const,
        rarity: 'common' as const,
        description: 'A random card for testing',
      }
      return Array.from({ length: Math.min(size, 40) }, (_, i) => ({
        ...baseCard,
        id: `random-card-${i}`,
        name: `Random Card ${i}`,
      }))
    },
    createZodiacDeck: (zodiacClass: string, size: number) => {
      const baseCard = {
        id: `${zodiacClass}-card`,
        name: `${zodiacClass} Card`,
        cost: 1,
        attack: 1,
        health: 1,
        type: 'unit' as const,
        zodiacClass: zodiacClass as any,
        element: 'fire' as const,
        rarity: 'common' as const,
        description: `A ${zodiacClass} card for testing`,
      }
      return Array.from({ length: Math.min(size, 40) }, (_, i) => ({
        ...baseCard,
        id: `${zodiacClass}-card-${i}`,
        name: `${zodiacClass} Card ${i}`,
      }))
    },
    isValidDeck: (deck: any[]) => {
      const errors: string[] = []
      if (deck.length > 40) {
        errors.push(`Deck has ${deck.length} cards, maximum is 40`)
      }
      const cardCounts = new Map<string, number>()
      deck.forEach(card => {
        const count = cardCounts.get(card.id) || 0
        cardCounts.set(card.id, count + 1)
      })
      cardCounts.forEach((count, cardId) => {
        if (count > 3) {
          errors.push(`Too many copies of "${cardId}": ${count}/3`)
        }
      })
      return { valid: errors.length === 0, errors }
    },
  }
})

// Mock game logger to prevent console spam during tests
vi.mock('@/lib/game_logger', () => {
  const mockMethods = {
    action: vi.fn(),
    event: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    combat: vi.fn(),
    turn: vi.fn(),
    phase: vi.fn(),
    state: vi.fn(),
    turnStart: vi.fn(),
  }

  // Constructor that returns instance methods
  const GameLoggerConstructor = vi.fn().mockImplementation(() => mockMethods)

  // Add static methods to the constructor
  Object.assign(GameLoggerConstructor, mockMethods)

  return {
    GameLogger: GameLoggerConstructor,
  }
})

// Mock event manager for cleaner tests
vi.mock('@/services/event_manager', () => ({
  eventManager: {
    emitSystemEvent: vi.fn(),
    emitPlayerEvent: vi.fn(),
    emitCardEvent: vi.fn(),
    emitCombatEvent: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  },
  createEventHelpers: () => ({
    cardPlayed: vi.fn().mockResolvedValue(undefined),
    cardDrawn: vi.fn().mockResolvedValue(undefined),
    unitSummoned: vi.fn().mockResolvedValue(undefined),
    unitDies: vi.fn().mockResolvedValue(undefined), // Added missing method
    combatDamageDealt: vi.fn().mockResolvedValue(undefined),
    playerHealthChanged: vi.fn().mockResolvedValue(undefined),
    playerLosesHealth: vi.fn().mockResolvedValue(undefined),
    playerGainsMana: vi.fn().mockResolvedValue(undefined),
    turnStart: vi.fn().mockResolvedValue(undefined),
    turnEnd: vi.fn().mockResolvedValue(undefined),
    phaseChanged: vi.fn().mockResolvedValue(undefined),
  }),
}))

// Mock win condition service for cleaner tests
vi.mock('@/services/win_condition_service', () => {
  // Create a more realistic mock that behaves like the actual service
  const mockService = {
    state: {
      gameMode: {
        name: 'Standard',
        enabledConditions: ['health_depletion'],
        disabledConditions: [],
      },
      activeConditions: [
        { id: 'health_depletion', name: 'Health Depletion', priority: 1, enabled: true },
      ],
      eventCounters: new Map(),
      playerProgress: new Map(),
      conditionHistory: new Map(),
    },

    setGameMode: vi.fn((modeId) => {
      if (modeId === 'arcana_master') {
        mockService.state.gameMode = {
          name: 'Arcana Master',
          enabledConditions: ['health_depletion', 'arcana_completion', 'zodiac_alignment'],
          disabledConditions: [],
        }
        mockService.state.activeConditions = [
          { id: 'health_depletion', name: 'Health Depletion', priority: 1, enabled: true },
          { id: 'arcana_completion', name: 'Arcana Completion', priority: 2, enabled: true },
          { id: 'zodiac_alignment', name: 'Zodiac Alignment', priority: 3, enabled: true },
        ]
      } else if (modeId === 'puzzle') {
        mockService.state.gameMode = {
          name: 'Puzzle',
          enabledConditions: ['deck_depletion'],
          disabledConditions: ['health_depletion'] as any,
        }
        mockService.state.activeConditions = [
          { id: 'deck_depletion', name: 'Deck Depletion', priority: 1, enabled: true },
        ]
      }
    }),

    resetState: vi.fn(() => {
      mockService.state.eventCounters.clear()
      mockService.state.playerProgress.clear()
    }),

    getActiveConditions: vi.fn(() => mockService.state.activeConditions),

    checkWinConditions: vi.fn((gameState) => {
      // Check for health depletion
      if (gameState.player1.health <= 0) {
        return { achieved: true, winner: 'player2', message: 'player2 wins by reducing opponent\'s health to 0!' }
      }
      if (gameState.player2.health <= 0) {
        return { achieved: true, winner: 'player1', message: 'player1 wins by reducing opponent\'s health to 0!' }
      }

      // Check for deck depletion
      if (gameState.player1.deck.length === 0) {
        return { achieved: true, winner: 'player2', message: 'player2 wins by depleting opponent\'s deck!' }
      }
      if (gameState.player2.deck.length === 0) {
        return { achieved: true, winner: 'player1', message: 'player1 wins by depleting opponent\'s deck!' }
      }

      // Check for board domination (battlefield system)
      const player1Units = gameState.battlefield.playerUnits.filter((unit: any) => unit !== null).length
      const player2Units = gameState.battlefield.enemyUnits.filter((unit: any) => unit !== null).length

      if (player1Units >= 6) {
        return { achieved: false, winner: null, message: 'Player 1 dominates the board' }
      }
      if (player2Units >= 6) {
        return { achieved: false, winner: null, message: 'Player 2 dominates the board' }
      }

      // Check for elemental alignment (battlefield system)
      const elements = new Set()
      gameState.battlefield.playerUnits.forEach((unit: any) => {
        if (unit && unit.element) {
          elements.add(unit.element)
        }
      })
      gameState.battlefield.enemyUnits.forEach((unit: any) => {
        if (unit && unit.element) {
          elements.add(unit.element)
        }
      })

      if (elements.size === 4) {
        return { achieved: true, winner: 'player1', message: 'Player 1 wins by aligning all four elements' }
      }

      // Check for turn survival
      if (gameState.round >= 15 && gameState.player1.health > 0) {
        return { achieved: true, winner: 'player1', message: 'Player 1 wins by surviving to turn 15' }
      }

      return { achieved: false, winner: null, message: '' }
    }),

    getCurrentGameMode: vi.fn(() => mockService.state.gameMode),
    getPlayerProgress: vi.fn((playerId) => mockService.state.playerProgress.get(playerId) || new Map()),
    registerWinCondition: vi.fn((condition) => {
      mockService.state.activeConditions.push(condition)
    }),
    toggleWinCondition: vi.fn((conditionId) => {
      const condition = mockService.state.activeConditions.find(c => c.id === conditionId)
      if (condition) {
        condition.enabled = !condition.enabled
      }
    }),
  }

  return { winConditionService: mockService }
})

// Mock game store for cleaner tests
vi.mock('@/store/game_store', () => ({
  useGameStore: vi.fn(() => ({
    gameState: null,
    setGameState: vi.fn(),
    ui: {
      showCardDetail: vi.fn(),
      hideCardDetail: vi.fn(),
    },
    interaction: {
      selectedCard: null,
      setSelectedCard: vi.fn(),
    },
  })),
}))

// Global test utilities
declare global {
  interface Window {
    __TEST_MODE__: boolean
  }
}

if (typeof window !== 'undefined') {
  window.__TEST_MODE__ = true
}

export { }