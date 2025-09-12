import '@testing-library/jest-dom'
import { beforeEach, afterEach, vi } from 'vitest'

// Mock zustand store - must be at top level for proper hoisting
vi.mock('@/store/game_store', () => {
  const mockGameState = {
    round: 1,
    turn: 1,
    activePlayer: 'player1',
    attackingPlayer: null,
    phase: 'action',
    waitingForAction: false,
    combatResolved: false,
    player1: {
      id: 'player1',
      name: 'Player 1', 
      health: 20,
      mana: 1,
      maxMana: 1,
      spellMana: 0,
      hand: [],
      deck: [],
      bench: [],
      hasAttackToken: false,
      mulliganComplete: true,
      selectedForMulligan: [],
      hasPassed: false,
      actionsThisTurn: 0,
    },
    player2: {
      id: 'player2',
      name: 'Player 2',
      health: 20,
      mana: 1, 
      maxMana: 1,
      spellMana: 0,
      hand: [],
      deck: [],
      bench: [],
      hasAttackToken: false,
      mulliganComplete: true,
      selectedForMulligan: [],
      hasPassed: false,
      actionsThisTurn: 0,
    },
    lanes: Array(6).fill(null).map((_, id) => ({ id, attacker: null, defender: null }))
  }

  return {
    useGameStore: vi.fn(() => ({
      gameState: mockGameState,
      setGameState: vi.fn(),
      animationState: false,
      setAnimationState: vi.fn(),
      selectedCard: null,
      setSelectedCard: vi.fn(),
      attackers: [],
      setAttackers: vi.fn(),
      clearAttackers: vi.fn(),
      defenderAssignments: {},
      setDefenderAssignments: vi.fn(),
      clearDefenderAssignments: vi.fn()
    })),
    GRID_ROWS: {
      ENEMY_BENCH: 0,
      ENEMY_ATTACK: 1,
      PLAYER_ATTACK: 2,
      PLAYER_BENCH: 3
    },
    GRID_COLS: {
      COL_0: 0,
      COL_1: 1,
      COL_2: 2,
      COL_3: 3,
      COL_4: 4,
      COL_5: 5
    }
  }
})

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}))

// Mock Next.js Image component
vi.mock('next/image', () => ({
  default: vi.fn().mockReturnValue(null)
}))

// Mock localStorage
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(() => null),
    removeItem: vi.fn(() => null),
    clear: vi.fn(() => null),
  },
  writable: true,
})

// Mock useGameStore hook at top level for proper hoisting

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
})

// Set up fake timers before each test
beforeEach(() => {
  vi.useFakeTimers()
})