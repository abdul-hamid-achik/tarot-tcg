import React from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { expect, vi } from 'vitest'
import type { GameState, Card, Player } from '@/schemas/schema'

// Mock providers if needed
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <div data-testid="test-wrapper">
      {children}
    </div>
  )
}

const customRender = (ui: React.ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
  render(ui, { wrapper: AllTheProviders, ...options })

// Test data factories
export const createTestCard = (overrides: Partial<Card> = {}): Card => ({
  id: 'test-card-1',
  name: 'Test Card',
  cost: 2,
  attack: 2,
  health: 3,
  type: 'unit',
  tarotSymbol: '1',
  description: 'A test card for unit tests',
  zodiacClass: 'aries',
  element: 'fire',
  rarity: 'common',
  currentHealth: 3,
  isReversed: false,
  ...overrides
})

export const createTestPlayer = (id: 'player1' | 'player2', overrides: Partial<Player> = {}): Player => ({
  id,
  name: id === 'player1' ? 'Human Player' : 'AI Player',
  health: 20,
  mana: 3,
  maxMana: 3,
  spellMana: 1,
  hand: [
    createTestCard({ id: `${id}-hand-1`, name: 'Hand Card 1' }),
    createTestCard({ id: `${id}-hand-2`, name: 'Hand Card 2' }),
  ],
  deck: Array(30).fill(null).map((_, i) =>
    createTestCard({
      id: `${id}-deck-${i}`,
      name: `Deck Card ${i}`,
      cost: Math.floor(i / 10) + 1
    })
  ),
  hasAttackToken: id === 'player1',
  mulliganComplete: true,
  selectedForMulligan: [],
  hasPassed: false,
  actionsThisTurn: 0,
  ...overrides
})

export const createTestGameState = (overrides: Partial<GameState> = {}): GameState => ({
  round: 2,
  turn: 3,
  activePlayer: 'player1',
  attackingPlayer: null,
  player1: createTestPlayer('player1'),
  player2: createTestPlayer('player2', { hasAttackToken: false }),
  battlefield: {
    playerUnits: Array(7).fill(null),
    enemyUnits: Array(7).fill(null),
    maxSlots: 7,
  },
  phase: 'action',
  waitingForAction: false,
  combatResolved: false,
  passCount: 0,
  canRespond: false,
  ...overrides
})

// Test utilities for game scenarios
export const withCombatSetup = (gameState: GameState): GameState => {
  const attacker = createTestCard({ id: 'attacker-1', name: 'Attacker' })
  const defender = createTestCard({ id: 'defender-1', name: 'Defender' })

  return {
    ...gameState,
    phase: 'action', // Hearthstone-style keeps action phase
    attackingPlayer: 'player1',
    activePlayer: 'player1',
    battlefield: {
      ...gameState.battlefield,
      playerUnits: [attacker, ...gameState.battlefield.playerUnits.slice(1)],
      enemyUnits: [defender, ...gameState.battlefield.enemyUnits.slice(1)],
    },
    player1: {
      ...gameState.player1,
    },
    player2: {
      ...gameState.player2,
    }
  }
}

export const withMulliganSetup = (gameState: GameState): GameState => ({
  ...gameState,
  phase: 'mulligan',
  player1: {
    ...gameState.player1,
    mulliganComplete: false,
    selectedForMulligan: []
  },
  player2: {
    ...gameState.player2,
    mulliganComplete: false,
    selectedForMulligan: []
  }
})

// NEW: Battlefield helpers for single-state system
export const placeUnitsOnBattlefield = (
  state: GameState,
  player: 'player1' | 'player2',
  units: Partial<Card>[]
): GameState => {
  const newState = { ...state }
  const battlefield = player === 'player1'
    ? newState.battlefield.playerUnits
    : newState.battlefield.enemyUnits

  units.forEach((unit, i) => {
    if (i < 7) {
      battlefield[i] = createTestCard({
        ...unit,
        id: unit.id || `${player}-unit-${i}`,
        owner: player,
        hasSummoningSickness: false, // Test units ready to act
        hasAttackedThisTurn: false,
        currentHealth: unit.health || unit.currentHealth || 3,
      })
    }
  })

  return newState
}

export const withUnitsOnBattlefield = (
  gameState: GameState,
  playerId: 'player1' | 'player2',
  count: number = 2
): GameState => {
  const units = Array(count).fill(null).map((_, i) => ({
    id: `${playerId}-battlefield-${i}`,
    name: `Battlefield Unit ${i}`,
    attack: 2 + i,
    health: 3 + i,
  }))

  return placeUnitsOnBattlefield(gameState, playerId, units)
}

// Mock timer utilities
export const advanceTimers = (ms: number) => {
  vi.advanceTimersByTime(ms)
}

export const fastForwardTime = (seconds: number) => {
  advanceTimers(seconds * 1000)
}

// Mock game store for new direct attack system
export const createMockGameStore = (gameState: GameState = createTestGameState()) => ({
  gameState,
  setGameState: vi.fn(),
  clearSelection: vi.fn(),
  setAnimationState: vi.fn(),
  startAttack: vi.fn(),
  executeAttack: vi.fn(),
  cancelAttack: vi.fn(),
  ui: {
    activeOverlay: 'none',
    cardDetailOverlay: null,
    isAnimating: false,
    performanceMode: 'high',
  },
  interaction: {
    mode: 'hybrid',
    selectedCard: null,
    draggedCard: null,
    dragStartPosition: null,
    hoveredSlot: null,
    attackSource: null,
    validAttackTargets: new Set<string>(),
    targetingMode: 'none',
  },
  multiplayer: {
    sessionId: null,
    playerId: null,
    connectionStatus: 'disconnected',
    lastSyncVersion: 0,
  },
  highlightedSlots: new Set<string>(),
  validDropZones: new Set<string>(),
  highlightSlots: vi.fn(),
  clearHighlights: vi.fn(),
  setValidDropZones: vi.fn(),
  clearValidDropZones: vi.fn(),
  showCardDetail: vi.fn(),
  hideCardDetail: vi.fn(),
})
// Assert helpers for battlefield-only system
export const expectPlayerHasCard = (gameState: GameState, playerId: 'player1' | 'player2', cardId: string) => {
  const player = gameState[playerId]
  const battlefieldUnits = playerId === 'player1'
    ? gameState.battlefield.playerUnits.filter(u => u !== null)
    : gameState.battlefield.enemyUnits.filter(u => u !== null)
  const hasCard = [...player.hand, ...player.deck, ...battlefieldUnits].some(card => card?.id === cardId)
  expect(hasCard).toBe(true)
}

export const expectBattlefieldHasUnit = (gameState: GameState, player: 'player1' | 'player2', slot: number, cardId?: string) => {
  const units = player === 'player1' ? gameState.battlefield.playerUnits : gameState.battlefield.enemyUnits
  const unit = units[slot]
  expect(unit).toBeTruthy()
  if (cardId) {
    expect(unit?.id).toBe(cardId)
  }
}

export const expectBattlefieldSlotEmpty = (gameState: GameState, player: 'player1' | 'player2', slot: number) => {
  const units = player === 'player1' ? gameState.battlefield.playerUnits : gameState.battlefield.enemyUnits
  expect(units[slot]).toBeNull()
}

export const expectPhase = (gameState: GameState, expectedPhase: GameState['phase']) => {
  expect(gameState.phase).toBe(expectedPhase)
}

export const expectActivePlayer = (gameState: GameState, expectedPlayer: 'player1' | 'player2') => {
  expect(gameState.activePlayer).toBe(expectedPlayer)
}

// Re-export everything from react-testing-library
export * from '@testing-library/react'
export { customRender as render }