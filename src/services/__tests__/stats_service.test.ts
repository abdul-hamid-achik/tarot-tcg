import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GameRecord } from '@/schemas/stats_schema'
import { extractBaseCardId, statsService } from '@/services/stats_service'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
  }
})()

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

function createTestRecord(overrides: Partial<GameRecord> = {}): GameRecord {
  return {
    id: `game_${Date.now()}`,
    result: 'win',
    difficulty: 'normal',
    deckName: 'Test Deck',
    rounds: 10,
    durationSeconds: 120,
    cardsPlayed: 8,
    unitsPlayed: 5,
    spellsPlayed: 3,
    damageDealt: 15,
    unitsDestroyed: 4,
    unitsLost: 2,
    manaSpent: 25,
    uniqueCardsPlayed: ['major-00-fool', 'major-01-magician'],
    majorArcanaPlayed: ['major-00-fool', 'major-01-magician'],
    zodiacClassesUsed: ['aries', 'leo'],
    playerHealthRemaining: 15,
    opponentHealthRemaining: 0,
    timestamp: Date.now(),
    ...overrides,
  }
}

describe('StatsService', () => {
  beforeEach(() => {
    localStorageMock.clear()
    statsService.resetStats()
  })

  describe('extractBaseCardId', () => {
    it('strips player prefix and counter suffix', () => {
      expect(extractBaseCardId('p1_major-00-fool_1')).toBe('major-00-fool')
      expect(extractBaseCardId('p2_minor-wands-01_3')).toBe('minor-wands-01')
    })

    it('handles IDs without prefix', () => {
      expect(extractBaseCardId('major-00-fool_1')).toBe('major-00-fool')
    })

    it('handles IDs without suffix', () => {
      expect(extractBaseCardId('p1_major-00-fool')).toBe('major-00-fool')
    })

    it('handles plain IDs', () => {
      expect(extractBaseCardId('major-00-fool')).toBe('major-00-fool')
    })
  })

  describe('recordGame', () => {
    it('records a win and updates stats', () => {
      const record = createTestRecord({ result: 'win' })
      const stats = statsService.recordGame(record)

      expect(stats.totalGames).toBe(1)
      expect(stats.wins).toBe(1)
      expect(stats.losses).toBe(0)
      expect(stats.currentStreak).toBe(1)
      expect(stats.totalDamageDealt).toBe(15)
      expect(stats.totalUnitsDestroyed).toBe(4)
    })

    it('records a loss and resets streak', () => {
      statsService.recordGame(createTestRecord({ result: 'win' }))
      statsService.recordGame(createTestRecord({ result: 'win' }))
      const stats = statsService.recordGame(createTestRecord({ result: 'loss' }))

      expect(stats.wins).toBe(2)
      expect(stats.losses).toBe(1)
      expect(stats.currentStreak).toBe(0)
      expect(stats.bestStreak).toBe(2)
    })

    it('tracks best streak correctly', () => {
      statsService.recordGame(createTestRecord({ result: 'win' }))
      statsService.recordGame(createTestRecord({ result: 'win' }))
      statsService.recordGame(createTestRecord({ result: 'win' }))
      statsService.recordGame(createTestRecord({ result: 'loss' }))
      statsService.recordGame(createTestRecord({ result: 'win' }))
      const stats = statsService.recordGame(createTestRecord({ result: 'win' }))

      expect(stats.bestStreak).toBe(3)
      expect(stats.currentStreak).toBe(2)
    })

    it('aggregates unique cards', () => {
      statsService.recordGame(
        createTestRecord({ uniqueCardsPlayed: ['major-00-fool', 'major-01-magician'] }),
      )
      const stats = statsService.recordGame(
        createTestRecord({ uniqueCardsPlayed: ['major-01-magician', 'major-02-high-priestess'] }),
      )

      expect(stats.uniqueCardsEverPlayed).toHaveLength(3)
      expect(stats.uniqueCardsEverPlayed).toContain('major-00-fool')
      expect(stats.uniqueCardsEverPlayed).toContain('major-02-high-priestess')
    })

    it('tracks difficulty records', () => {
      statsService.recordGame(createTestRecord({ difficulty: 'hard', result: 'win' }))
      statsService.recordGame(createTestRecord({ difficulty: 'hard', result: 'loss' }))
      const stats = statsService.recordGame(
        createTestRecord({ difficulty: 'hard', result: 'win' }),
      )

      expect(stats.difficultyRecord.hard).toEqual({ wins: 2, losses: 1 })
    })

    it('tracks zodiac class wins', () => {
      statsService.recordGame(
        createTestRecord({ result: 'win', zodiacClassesUsed: ['aries', 'leo'] }),
      )
      const stats = statsService.recordGame(
        createTestRecord({ result: 'win', zodiacClassesUsed: ['aries', 'virgo'] }),
      )

      expect(stats.zodiacClassWins.aries).toBe(2)
      expect(stats.zodiacClassWins.leo).toBe(1)
      expect(stats.zodiacClassWins.virgo).toBe(1)
    })

    it('does not track zodiac class on losses', () => {
      const stats = statsService.recordGame(
        createTestRecord({ result: 'loss', zodiacClassesUsed: ['aries'] }),
      )

      expect(stats.zodiacClassWins.aries).toBeUndefined()
    })

    it('limits recent games to 50', () => {
      for (let i = 0; i < 55; i++) {
        statsService.recordGame(createTestRecord({ id: `game_${i}` }))
      }

      const recent = statsService.getRecentGames(50)
      expect(recent).toHaveLength(50)
    })
  })

  describe('getRecentGames', () => {
    it('returns limited recent games', () => {
      for (let i = 0; i < 30; i++) {
        statsService.recordGame(createTestRecord({ id: `game_${i}` }))
      }

      const recent = statsService.getRecentGames(10)
      expect(recent).toHaveLength(10)
    })

    it('returns most recent games first', () => {
      statsService.recordGame(createTestRecord({ id: 'game_first', rounds: 5 }))
      statsService.recordGame(createTestRecord({ id: 'game_second', rounds: 10 }))

      const recent = statsService.getRecentGames()
      expect(recent[0].id).toBe('game_second')
      expect(recent[1].id).toBe('game_first')
    })
  })

  describe('resetStats', () => {
    it('resets all stats to defaults', () => {
      statsService.recordGame(createTestRecord())
      statsService.resetStats()

      const stats = statsService.getStats()
      expect(stats.totalGames).toBe(0)
      expect(stats.wins).toBe(0)
      expect(stats.currentStreak).toBe(0)
    })
  })

  describe('localStorage persistence', () => {
    it('saves to localStorage on record', () => {
      statsService.recordGame(createTestRecord())
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'tarot-tcg-stats',
        expect.any(String),
      )
    })

    it('handles corrupted localStorage gracefully', () => {
      localStorageMock.getItem.mockReturnValueOnce('not valid json{{{')
      statsService.resetStats()

      const stats = statsService.getStats()
      expect(stats.totalGames).toBe(0)
    })
  })
})
