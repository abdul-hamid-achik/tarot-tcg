import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock the card loader to provide consistent test cards
vi.mock('@/lib/card_loader', () => ({
  getAllCards: () => [
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
  ],
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
    return Array.from({ length: size }, (_, i) => ({
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
    return Array.from({ length: size }, (_, i) => ({
      ...baseCard,
      id: `${zodiacClass}-card-${i}`,
      name: `${zodiacClass} Card ${i}`,
    }))
  },
}))

// Mock game logger to prevent console spam during tests
vi.mock('@/lib/game_logger', () => ({
  GameLogger: {
    action: vi.fn(),
    event: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    combat: vi.fn(), // Added missing combat method
    turn: vi.fn(),
    phase: vi.fn(),
    state: vi.fn(), // Added missing state method
    turnStart: vi.fn(), // Added missing turnStart method
  },
}))

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
    combatDamageDealt: vi.fn().mockResolvedValue(undefined),
    playerHealthChanged: vi.fn().mockResolvedValue(undefined),
    playerLosesHealth: vi.fn().mockResolvedValue(undefined), // Added missing method
    turnStart: vi.fn().mockResolvedValue(undefined), // Added missing method
    turnEnd: vi.fn().mockResolvedValue(undefined), // Added missing method
    phaseChanged: vi.fn().mockResolvedValue(undefined), // Added missing method
    playerGainsMana: vi.fn().mockResolvedValue(undefined), // Added missing method
  }),
}))

// Mock win condition service for cleaner tests
vi.mock('@/services/win_condition_service', () => ({
  winConditionService: {
    setGameMode: vi.fn(),
    resetState: vi.fn(),
    getActiveConditions: vi.fn(() => []),
    checkConditions: vi.fn(() => ({ achieved: false, winner: null, message: '' })),
  },
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

export {}