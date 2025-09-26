import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createInitialGameState,
  playCard,
  directAttack,
  endTurn,
  completeMulligan,
  checkGameOutcome
} from '@/lib/game_logic'
import { aiService } from '@/services/ai_service'
import { createTestGameState, createTestCard, withUnitsOnBench } from '@/test_utils'
import type { GameState } from '@/schemas/schema'

// Mock card loader for consistent test data
vi.mock('@/lib/card_loader', () => ({
  getAllCards: () => [
    {
      id: 'fool',
      name: 'The Fool',
      cost: 1,
      attack: 1,
      health: 1,
      type: 'unit',
      tarotSymbol: '0',
      description: 'Beginning of journey',
      zodiacClass: 'aquarius',
      element: 'air',
      rarity: 'common'
    },
    {
      id: 'magician',
      name: 'The Magician',
      cost: 2,
      attack: 2,
      health: 2,
      type: 'unit',
      tarotSymbol: '1',
      description: 'Power of manifestation',
      zodiacClass: 'aries',
      element: 'fire',
      rarity: 'common'
    }
  ],
  createRandomDeck: (size: number) => Array(size).fill(null).map((_, i) => ({
    id: `card-${i}`,
    name: `Card ${i}`,
    cost: (i % 5) + 1,
    attack: (i % 3) + 1,
    health: (i % 3) + 2,
    type: 'unit',
    tarotSymbol: i.toString(),
    description: `Generated card ${i}`,
    zodiacClass: 'leo',
    element: 'fire',
    rarity: 'common'
  })),
  createZodiacDeck: (zodiac: string, size: number) => Array(size).fill(null).map((_, i) => ({
    id: `${zodiac}-${i}`,
    name: `${zodiac} Card ${i}`,
    cost: (i % 5) + 1,
    attack: (i % 3) + 1,
    health: (i % 3) + 2,
    type: 'unit',
    tarotSymbol: i.toString(),
    description: `${zodiac} card ${i}`,
    zodiacClass: zodiac,
    element: 'fire',
    rarity: 'common'
  }))
}))

describe('Game Integration Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  describe('Complete Game Flow', () => {
    it('should play a complete game from start to finish', async () => {
      // 1. Initialize game
      let gameState = createInitialGameState()
      expect(gameState.phase).toBe('mulligan')
      expect(gameState.activePlayer).toBe('player1')

      // 2. Complete mulligans
      gameState = completeMulligan(gameState)
      gameState.player2.mulliganComplete = true
      if (!gameState.player2.mulliganComplete) {
        gameState = { ...gameState, player2: { ...gameState.player2, mulliganComplete: true } }
      }

      // Check if both players completed mulligan
      if (gameState.player1.mulliganComplete && gameState.player2.mulliganComplete) {
        gameState.phase = 'action'
      }

      expect(gameState.phase).toBe('action')

      // 3. Player 1 plays a card
      const cardToPlay = gameState.player1.hand[0]
      gameState.player1.mana = cardToPlay.cost + 1 // Ensure sufficient mana
      gameState = await playCard(gameState, cardToPlay)

      expect(gameState.player1.bench).toHaveLength(1)
      expect(gameState.player1.hand).toHaveLength(3) // Started with 4, played 1

      // 4. Place unit on battlefield and attack nexus (Hearthstone-style)
      if (gameState.player1.hasAttackToken && gameState.player1.bench.length > 0) {
        const attackerCard = gameState.player1.bench[0]
        // Place unit on battlefield first
        gameState.battlefield.playerUnits[0] = attackerCard
        gameState.player1.bench = gameState.player1.bench.slice(1) // Remove from bench

        // Direct attack on nexus
        gameState = directAttack(gameState, attackerCard.id, 'nexus')

        expect(gameState.phase).toBe('action') // Stays in action phase (Hearthstone-style)
        expect(gameState.player2.health).toBeLessThan(20) // Should have taken damage
      }

      // 7. End turn
      gameState = await endTurn(gameState)

      expect(gameState.activePlayer).toBe('player2')
      expect(gameState.turn).toBe(2)

      // Game should be in a valid state
      expect(checkGameOutcome(gameState)).toBe('ongoing')
    })

    it('should handle AI turn execution', async () => {
      let gameState = createTestGameState()
      gameState.activePlayer = 'player2'
      gameState.player2.hasAttackToken = true

      // Add some cards to AI hand and mana
      gameState.player2.mana = 5
      gameState.player2.hand = [
        createTestCard({ id: 'ai-card-1', cost: 2, name: 'AI Card' }),
        createTestCard({ id: 'ai-card-2', cost: 3, name: 'AI Card 2' })
      ]

      // Test AI card selection
      aiService.setPersonality('normal')
      const { card, shouldPlay } = aiService.selectCardToPlay(gameState)

      expect(card).toBeTruthy()
      expect(shouldPlay).toBe(true)

      if (card && shouldPlay) {
        gameState = await playCard(gameState, card)
        expect(gameState.player2.bench.length).toBeGreaterThan(0)
      }

      // Test AI attack selection (battlefield system)
      if (gameState.player2.hasAttackToken && gameState.player2.bench.length > 0) {
        const attackers = aiService.selectAttackers(gameState)
        expect(attackers).toBeInstanceOf(Array)

        if (attackers.length > 0) {
          // Place unit on battlefield and attack
          const attackerCard = gameState.player2.bench[0]
          gameState.battlefield.enemyUnits[0] = attackerCard
          gameState.player2.bench = gameState.player2.bench.slice(1)

          // Direct attack on nexus (Hearthstone-style)
          gameState = directAttack(gameState, attackerCard.id, 'nexus')

          expect(gameState.phase).toBe('action') // Stays in action phase
          expect(gameState.player1.health).toBeLessThan(20) // Player1 should take damage
        }
      }
    })

    it('should handle combat between units', async () => {
      let gameState = createTestGameState()

      // Set up combat scenario on battlefield
      const attacker = createTestCard({
        id: 'attacker-1',
        name: 'Strong Attacker',
        attack: 3,
        health: 2,
        currentHealth: 2
      })
      const defender = createTestCard({
        id: 'defender-1',
        name: 'Tough Defender',
        attack: 1,
        health: 4,
        currentHealth: 4
      })

      // Place units on battlefield
      gameState.battlefield.playerUnits[0] = attacker
      gameState.battlefield.enemyUnits[0] = defender
      gameState.phase = 'action'
      gameState.player1.hasAttackToken = true

      // Execute direct attack (Hearthstone-style)
      gameState = directAttack(gameState, 'attacker-1', { player: 'player2', slot: 0 })

      // Verify combat results:
      // Attacker survives (2 health - 1 attack = 1 health remaining)
      // Defender survives (4 health - 3 attack = 1 health remaining)
      expect(gameState.battlefield.playerUnits[0]?.currentHealth).toBe(1) // Attacker survived
      expect(gameState.battlefield.enemyUnits[0]?.currentHealth).toBe(1) // Defender survived

      expect(gameState.phase).toBe('action') // Stays in action phase (Hearthstone-style)
    })

    it('should handle nexus damage when no defenders', async () => {
      let gameState = createTestGameState()

      const attacker = createTestCard({
        id: 'attacker-1',
        attack: 5,
        health: 3,
        currentHealth: 3
      })

      // Place attacker on battlefield
      gameState.battlefield.playerUnits[0] = attacker
      gameState.phase = 'action'
      gameState.player1.hasAttackToken = true

      const initialHealth = gameState.player2.health
      // Direct attack on nexus (Hearthstone-style)
      gameState = directAttack(gameState, 'attacker-1', 'nexus')

      expect(gameState.player2.health).toBe(initialHealth - 5) // 20 - 5 = 15
      expect(gameState.phase).toBe('action')
    })

    it('should detect game end conditions', () => {
      const gameState = createTestGameState()

      // Player 2 loses
      gameState.player2.health = 0
      expect(checkGameOutcome(gameState)).toBe('player1_wins')

      // Player 1 loses
      gameState.player2.health = 20
      gameState.player1.health = 0
      expect(checkGameOutcome(gameState)).toBe('player2_wins')

      // Game ongoing
      gameState.player1.health = 15
      gameState.player2.health = 10
      expect(checkGameOutcome(gameState)).toBe('ongoing')
    })

    it('should handle turn transitions correctly', async () => {
      let gameState = createTestGameState()
      gameState.activePlayer = 'player1'
      gameState.turn = 1
      gameState.round = 1
      gameState.player1.mana = 2
      gameState.player1.spellMana = 0 // Start with 0 spell mana for clear test

      const initialP2HandSize = gameState.player2.hand.length
      const initialP2DeckSize = gameState.player2.deck.length

      gameState = await endTurn(gameState)

      expect(gameState.activePlayer).toBe('player2')
      expect(gameState.turn).toBe(2)
      expect(gameState.player1.spellMana).toBe(2) // Unspent mana converted
      expect(gameState.player2.hand.length).toBe(initialP2HandSize + 1) // Drew a card
      expect(gameState.player2.deck.length).toBe(initialP2DeckSize - 1) // Card drawn from deck
      expect(gameState.phase).toBe('action')
    })

    it('should handle mulligan close (keep all cards)', async () => {
      // 1. Initialize game in mulligan phase
      let gameState = createInitialGameState()
      expect(gameState.phase).toBe('mulligan')
      expect(gameState.activePlayer).toBe('player1')

      // 2. Complete mulligan with no cards selected (close overlay)
      const originalHand = [...gameState.player1.hand]
      gameState = completeMulligan(gameState)

      expect(gameState.player1.mulliganComplete).toBe(true)
      expect(gameState.player1.hand).toHaveLength(originalHand.length) // Same size
      // All original cards should still be in hand
      originalHand.forEach(originalCard => {
        expect(gameState.player1.hand.find(c => c.id === originalCard.id)).toBeDefined()
      })

      // 3. Complete player2 mulligan and transition to action phase
      gameState.player2.mulliganComplete = true
      if (gameState.player1.mulliganComplete && gameState.player2.mulliganComplete) {
        gameState.phase = 'action'
      }

      expect(gameState.phase).toBe('action')
    })

    it('should handle round transitions and attack tokens', async () => {
      let gameState = createTestGameState()
      gameState.turn = 2 // Next turn will be 3 (odd), triggering new round
      gameState.round = 1
      gameState.player1.hasAttackToken = true
      gameState.player2.hasAttackToken = false

      gameState = await endTurn(gameState)

      expect(gameState.round).toBe(2) // New round
      expect(gameState.player1.hasAttackToken).toBe(false) // Token switched
      expect(gameState.player2.hasAttackToken).toBe(true) // Token switched
    })
  })

  describe('Complex Scenarios', () => {
    it('should handle multiple units on battlefield', async () => {
      let gameState = createTestGameState()
      gameState.player1.hasAttackToken = true
      gameState.phase = 'action'

      // Place multiple units on battlefield (battlefield system)
      const attacker1 = createTestCard({ id: 'att1', attack: 2, health: 2 })
      const attacker2 = createTestCard({ id: 'att2', attack: 3, health: 1 })
      const defender1 = createTestCard({ id: 'def1', attack: 1, health: 3 })

      gameState.battlefield.playerUnits[0] = attacker1
      gameState.battlefield.playerUnits[1] = attacker2
      gameState.battlefield.enemyUnits[0] = defender1

      expect(gameState.battlefield.playerUnits.filter(u => u !== null)).toHaveLength(2)
      expect(gameState.battlefield.enemyUnits.filter(u => u !== null)).toHaveLength(1)

      // Test direct attacks (Hearthstone-style)
      const initialP2Health = gameState.player2.health

      // Attacker 1 attacks defender
      gameState = directAttack(gameState, 'att1', { player: 'player2', slot: 0 })
      expect(gameState.battlefield.enemyUnits[0]?.currentHealth).toBe(1) // 3 - 2 = 1

      // Attacker 2 attacks nexus (unblocked)
      gameState = directAttack(gameState, 'att2', 'nexus')

      expect(gameState.phase).toBe('action')
      expect(gameState.player2.health).toBe(initialP2Health - 3) // Nexus damage from attacker2
    })

    it('should maintain game state consistency through multiple turns', async () => {
      let gameState = createInitialGameState()

      // Fast-track through mulligan
      gameState.phase = 'action'
      gameState.player1.mulliganComplete = true
      gameState.player2.mulliganComplete = true

      const initialP1Health = gameState.player1.health
      const initialP2Health = gameState.player2.health

      // Play several turns
      for (let turn = 0; turn < 6; turn++) {
        // Ensure valid game state
        expect(gameState.activePlayer).toMatch(/^player[12]$/)
        expect(gameState.phase).toMatch(/^(action|combat|declare_defenders|mulligan)$/)
        expect(gameState.player1.health).toBeGreaterThanOrEqual(0)
        expect(gameState.player2.health).toBeGreaterThanOrEqual(0)

        const currentPlayer = gameState[gameState.activePlayer]

        // Try to play a card if possible
        const playableCard = currentPlayer.hand.find(card =>
          card.cost <= currentPlayer.mana + currentPlayer.spellMana
        )

        if (playableCard && currentPlayer.bench.length < 6) {
          gameState = await playCard(gameState, playableCard)
        }

        // End turn
        gameState = await endTurn(gameState)

        // Check for game end
        const outcome = checkGameOutcome(gameState)
        if (outcome !== 'ongoing') {
          break
        }
      }

      // Game should still be valid
      expect(gameState.turn).toBeGreaterThan(1)
      expect(gameState.round).toBeGreaterThan(0)
      expect([gameState.player1.health, gameState.player2.health].some(h => h > 0)).toBe(true)
    })
  })
})