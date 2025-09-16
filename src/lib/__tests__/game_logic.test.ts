import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createInitialGameState,
  canPlayCard,
  playCard,
  declareAttackers,
  declareDefenders,
  resolveCombat,
  endTurn,
  checkGameOutcome,
  completeMulligan,
  toggleMulliganCard
} from '@/lib/game_logic'
import type { GameState, Card } from '@/schemas/schema'

// Mock card loader
vi.mock('@/lib/card_loader', () => ({
  getAllCards: () => [
    {
      id: 'test-card-1',
      name: 'Test Fool',
      cost: 1,
      attack: 1,
      health: 1,
      type: 'unit',
      tarotSymbol: '0',
      description: 'Test card',
      zodiacClass: 'aquarius',
      element: 'air',
      rarity: 'common'
    },
    {
      id: 'test-card-2',
      name: 'Test Magician',
      cost: 2,
      attack: 2,
      health: 2,
      type: 'unit',
      tarotSymbol: '1',
      description: 'Test card 2',
      zodiacClass: 'aries',
      element: 'fire',
      rarity: 'common'
    }
  ],
  createRandomDeck: (size: number) => Array(size).fill(null).map((_, i) => ({
    id: `random-${i}`,
    name: `Random Card ${i}`,
    cost: Math.floor(i / 10) + 1,
    attack: 1,
    health: 1,
    type: 'unit',
    tarotSymbol: i.toString(),
    description: 'Random card',
    zodiacClass: 'aquarius',
    element: 'air',
    rarity: 'common'
  })),
  createZodiacDeck: (zodiac: string, size: number) => Array(size).fill(null).map((_, i) => ({
    id: `${zodiac}-${i}`,
    name: `${zodiac} Card ${i}`,
    cost: Math.floor(i / 10) + 1,
    attack: 1,
    health: 1,
    type: 'unit',
    tarotSymbol: i.toString(),
    description: `${zodiac} card`,
    zodiacClass: zodiac,
    element: 'fire',
    rarity: 'common'
  }))
}))

describe('Game Logic', () => {
  let gameState: GameState
  let testCard: Card

  beforeEach(() => {
    gameState = createInitialGameState()
    testCard = {
      id: 'test-card',
      name: 'Test Card',
      cost: 2,
      attack: 2,
      health: 3,
      type: 'unit',
      tarotSymbol: 'X',
      description: 'A test card',
      zodiacClass: 'aries',
      element: 'fire',
      rarity: 'common',
      currentHealth: 3,
      isReversed: false
    }
  })

  describe('Initial Game State', () => {
    it('should create valid initial game state', () => {
      expect(gameState.round).toBe(1)
      expect(gameState.turn).toBe(1)
      expect(gameState.activePlayer).toBe('player1')
      expect(gameState.phase).toBe('mulligan')
      expect(gameState.player1.health).toBe(20)
      expect(gameState.player2.health).toBe(20)
      expect(gameState.player1.hasAttackToken).toBe(true)
      expect(gameState.player2.hasAttackToken).toBe(false)
      expect(gameState.lanes).toHaveLength(6)
    })

    it('should give players starting hands and decks', () => {
      expect(gameState.player1.hand).toHaveLength(4)
      expect(gameState.player2.hand).toHaveLength(4)
      expect(gameState.player1.deck).toHaveLength(36) // 40 - 4 starting hand
      expect(gameState.player2.deck).toHaveLength(36)
    })

    it('should start with proper mana values', () => {
      expect(gameState.player1.mana).toBe(1)
      expect(gameState.player1.maxMana).toBe(1)
      expect(gameState.player1.spellMana).toBe(0)
    })
  })

  describe('Card Playing', () => {
    beforeEach(() => {
      // Set up game for action phase
      gameState.phase = 'action'
      gameState.player1.mulliganComplete = true
      gameState.player2.mulliganComplete = true
    })

    it('should allow playing cards with sufficient mana', () => {
      gameState.player1.mana = 3
      const canPlay = canPlayCard(gameState, testCard)
      expect(canPlay).toBe(true)
    })

    it('should prevent playing cards with insufficient mana', () => {
      gameState.player1.mana = 1
      const canPlay = canPlayCard(gameState, testCard)
      expect(canPlay).toBe(false)
    })

    it('should prevent playing units when bench is full', () => {
      gameState.player1.mana = 5
      // Fill bench to capacity
      gameState.player1.bench = Array(6).fill(testCard)
      const canPlay = canPlayCard(gameState, testCard)
      expect(canPlay).toBe(false)
    })

    it('should correctly play a card', async () => {
      gameState.player1.mana = 3
      gameState.player1.hand = [testCard]

      const newState = await playCard(gameState, testCard)

      expect(newState.player1.mana).toBe(1) // 3 - 2 cost
      expect(newState.player1.hand).toHaveLength(0)
      expect(newState.player1.bench).toHaveLength(1)
      expect(newState.player1.bench[0].name).toBe('Test Card')
    })

    it('should use spell mana when regular mana is insufficient', async () => {
      gameState.player1.mana = 1
      gameState.player1.spellMana = 2
      gameState.player1.hand = [testCard]

      const newState = await playCard(gameState, testCard)

      expect(newState.player1.mana).toBe(0) // Used 1 regular mana
      expect(newState.player1.spellMana).toBe(1) // Used 1 spell mana (2-1)
      expect(newState.player1.bench).toHaveLength(1)
    })
  })

  describe('Combat System', () => {
    beforeEach(() => {
      gameState.phase = 'action'
      gameState.player1.hasAttackToken = true
      // Add some units to bench
      const attacker = { ...testCard, id: 'attacker-1' }
      const defender = { ...testCard, id: 'defender-1' }
      gameState.player1.bench = [attacker]
      gameState.player2.bench = [defender]
    })

    it('should declare attackers correctly', () => {
      const attackerArrangement = [{ attackerId: 'attacker-1', laneId: 0 }]
      const newState = declareAttackers(gameState, attackerArrangement)

      expect(newState.phase).toBe('combat')
      expect(newState.attackingPlayer).toBe('player1')
      expect(newState.lanes[0].attacker).toBeTruthy()
      expect(newState.lanes[0].attacker?.name).toBe('Test Card')
    })

    it('should prevent attacking without attack token', () => {
      gameState.player1.hasAttackToken = false
      const attackerArrangement = [{ attackerId: 'attacker-1', laneId: 0 }]
      const newState = declareAttackers(gameState, attackerArrangement)

      expect(newState).toEqual(gameState) // No changes
    })

    it('should declare defenders correctly', () => {
      // Set up attack first
      gameState.phase = 'combat'
      gameState.attackingPlayer = 'player1'
      gameState.lanes[0].attacker = { ...testCard, id: 'attacker-1', position: 'attacking' }

      const defenderAssignments = [{ defenderId: 'defender-1', laneId: 0 }]
      const newState = declareDefenders(gameState, defenderAssignments)

      expect(newState.lanes[0].defender).toBeTruthy()
      expect(newState.lanes[0].defender?.name).toBe('Test Card')
    })

    it('should resolve combat correctly', async () => {
      // Set up combat scenario
      gameState.phase = 'combat'
      gameState.attackingPlayer = 'player1'
      gameState.lanes[0].attacker = { ...testCard, id: 'attacker-1', position: 'attacking', attack: 2, health: 3, currentHealth: 3 }
      gameState.lanes[0].defender = { ...testCard, id: 'defender-1', position: 'defending', attack: 1, health: 2, currentHealth: 2 }

      const newState = await resolveCombat(gameState)

      expect(newState.phase).toBe('action')
      expect(newState.combatResolved).toBe(true)
      expect(newState.lanes[0].attacker).toBeNull()
      expect(newState.lanes[0].defender).toBeNull()
      // Defender should be dead (2 health - 2 attack = 0)
      // Attacker should survive (3 health - 1 attack = 2)
      expect(newState.player2.bench).toHaveLength(0) // Defender removed
      expect(newState.player1.bench[0].currentHealth).toBe(2)
    })

    it('should deal nexus damage when no defenders', async () => {
      gameState.phase = 'combat'
      gameState.attackingPlayer = 'player1'
      gameState.lanes[0].attacker = { ...testCard, id: 'attacker-1', position: 'attacking', attack: 3 }
      // No defender assigned

      const newState = await resolveCombat(gameState)

      expect(newState.player2.health).toBe(17) // 20 - 3 attack
    })
  })

  describe('Turn System', () => {
    beforeEach(() => {
      gameState.phase = 'action'
      gameState.activePlayer = 'player1'
      gameState.round = 2
      gameState.turn = 3
    })

    it('should end turn and switch players', async () => {
      gameState.player1.mana = 3 // Unspent mana

      const newState = await endTurn(gameState)

      expect(newState.activePlayer).toBe('player2')
      expect(newState.turn).toBe(4)
      expect(newState.player1.spellMana).toBe(3) // Unspent mana converted
      expect(newState.phase).toBe('action')
    })

    it('should increment round and switch attack tokens', async () => {
      gameState.turn = 4 // Next turn will be 5 (odd), so new round

      const newState = await endTurn(gameState)

      expect(newState.round).toBe(3)
      expect(newState.player1.hasAttackToken).toBe(false)
      expect(newState.player2.hasAttackToken).toBe(true)
    })

    it('should refill mana for next player', async () => {
      gameState.round = 5

      const newState = await endTurn(gameState)

      expect(newState.player2.maxMana).toBe(5)
      expect(newState.player2.mana).toBe(5)
    })

    it('should draw card for next player', async () => {
      const initialHandSize = gameState.player2.hand.length
      const initialDeckSize = gameState.player2.deck.length

      const newState = await endTurn(gameState)

      expect(newState.player2.hand.length).toBe(initialHandSize + 1)
      expect(newState.player2.deck.length).toBe(initialDeckSize - 1)
    })
  })

  describe('Game Outcome', () => {
    it('should detect player1 victory', () => {
      gameState.player2.health = 0
      const outcome = checkGameOutcome(gameState)
      expect(outcome).toBe('player1_wins')
    })

    it('should detect player2 victory', () => {
      gameState.player1.health = 0
      const outcome = checkGameOutcome(gameState)
      expect(outcome).toBe('player2_wins')
    })

    it('should detect ongoing game', () => {
      const outcome = checkGameOutcome(gameState)
      expect(outcome).toBe('ongoing')
    })
  })

  describe('Mulligan System', () => {
    beforeEach(() => {
      gameState.phase = 'mulligan'
      gameState.activePlayer = 'player1'
    })

    it('should toggle card selection for mulligan', () => {
      const cardId = gameState.player1.hand[0].id

      let newState = toggleMulliganCard(gameState, cardId)
      expect(newState.player1.selectedForMulligan).toContain(cardId)

      newState = toggleMulliganCard(newState, cardId)
      expect(newState.player1.selectedForMulligan).not.toContain(cardId)
    })

    it('should complete mulligan and replace cards', () => {
      const originalHand = [...gameState.player1.hand]
      const cardToMulligan = originalHand[0]
      gameState.player1.selectedForMulligan = [cardToMulligan.id]

      const newState = completeMulligan(gameState)

      expect(newState.player1.mulliganComplete).toBe(true)
      expect(newState.player1.selectedForMulligan).toHaveLength(0)
      expect(newState.player1.hand).toHaveLength(4) // Same size
      expect(newState.player1.hand.find(c => c.id === cardToMulligan.id)).toBeUndefined()
    })

    it('should complete mulligan with no cards selected (close overlay)', () => {
      const originalHand = [...gameState.player1.hand]
      gameState.player1.selectedForMulligan = [] // No cards selected

      const newState = completeMulligan(gameState)

      expect(newState.player1.mulliganComplete).toBe(true)
      expect(newState.player1.selectedForMulligan).toHaveLength(0)
      expect(newState.player1.hand).toHaveLength(4) // Same size - no cards replaced
      // All original cards should still be in hand
      originalHand.forEach(originalCard => {
        expect(newState.player1.hand.find(c => c.id === originalCard.id)).toBeDefined()
      })
    })

    it('should transition to action phase when both players complete mulligan', () => {
      gameState.player2.mulliganComplete = true

      const newState = completeMulligan(gameState)

      expect(newState.phase).toBe('action')
    })
  })
})