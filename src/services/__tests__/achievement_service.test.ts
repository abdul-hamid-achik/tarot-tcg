import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GameRecord, PlayerStats } from '@/schemas/stats_schema'
import { achievementService } from '@/services/achievement_service'
import { statsService } from '@/services/stats_service'

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

function createTestStats(overrides: Partial<PlayerStats> = {}): PlayerStats {
  return {
    totalGames: 0,
    wins: 0,
    losses: 0,
    currentStreak: 0,
    bestStreak: 0,
    totalDamageDealt: 0,
    totalUnitsDestroyed: 0,
    totalUnitsLost: 0,
    totalCardsPlayed: 0,
    totalManaSpent: 0,
    totalPlayTimeSeconds: 0,
    uniqueCardsEverPlayed: [],
    majorArcanaEverPlayed: [],
    zodiacClassWins: {},
    difficultyRecord: {},
    ...overrides,
  }
}

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
    uniqueCardsPlayed: [],
    majorArcanaPlayed: [],
    zodiacClassesUsed: [],
    playerHealthRemaining: 15,
    opponentHealthRemaining: 0,
    timestamp: Date.now(),
    ...overrides,
  }
}

describe('AchievementService', () => {
  beforeEach(() => {
    localStorageMock.clear()
    statsService.resetStats()
  })

  describe('checkAchievements', () => {
    it('unlocks first_win on first victory', () => {
      const stats = createTestStats({ wins: 1 })
      const record = createTestRecord({ result: 'win' })
      const unlocked = achievementService.checkAchievements(stats, record)

      expect(unlocked.length).toBeGreaterThanOrEqual(1)
      expect(unlocked.some(a => a.id === 'first_win')).toBe(true)
    })

    it('unlocks damage_100 when threshold reached', () => {
      const stats = createTestStats({ totalDamageDealt: 105 })
      const unlocked = achievementService.checkAchievements(stats, null)

      expect(unlocked.some(a => a.id === 'damage_100')).toBe(true)
    })

    it('unlocks perfect_game for full health win', () => {
      const stats = createTestStats({ wins: 1 })
      const record = createTestRecord({ result: 'win', playerHealthRemaining: 20 })
      const unlocked = achievementService.checkAchievements(stats, record)

      expect(unlocked.some(a => a.id === 'perfect_game')).toBe(true)
    })

    it('does not unlock perfect_game on loss', () => {
      const stats = createTestStats({ wins: 0, losses: 1 })
      const record = createTestRecord({ result: 'loss', playerHealthRemaining: 20 })
      const unlocked = achievementService.checkAchievements(stats, record)

      expect(unlocked.some(a => a.id === 'perfect_game')).toBe(false)
    })

    it('unlocks speed_run for quick win', () => {
      const stats = createTestStats({ wins: 1 })
      const record = createTestRecord({ result: 'win', rounds: 4 })
      const unlocked = achievementService.checkAchievements(stats, record)

      expect(unlocked.some(a => a.id === 'speed_run')).toBe(true)
    })

    it('does not unlock speed_run for slow win', () => {
      const stats = createTestStats({ wins: 1 })
      const record = createTestRecord({ result: 'win', rounds: 8 })
      const unlocked = achievementService.checkAchievements(stats, record)

      expect(unlocked.some(a => a.id === 'speed_run')).toBe(false)
    })

    it('unlocks streak_3 when best streak reaches 3', () => {
      const stats = createTestStats({ bestStreak: 3 })
      const unlocked = achievementService.checkAchievements(stats, null)

      expect(unlocked.some(a => a.id === 'streak_3')).toBe(true)
    })

    it('unlocks beat_hard when hard difficulty won', () => {
      const stats = createTestStats({
        difficultyRecord: { hard: { wins: 1, losses: 0 } },
      })
      const unlocked = achievementService.checkAchievements(stats, null)

      expect(unlocked.some(a => a.id === 'beat_hard')).toBe(true)
    })

    it('unlocks beat_expert when expert difficulty won', () => {
      const stats = createTestStats({
        difficultyRecord: { expert: { wins: 1, losses: 2 } },
      })
      const unlocked = achievementService.checkAchievements(stats, null)

      expect(unlocked.some(a => a.id === 'beat_expert')).toBe(true)
    })

    it('unlocks unit_slayer at 50 kills', () => {
      const stats = createTestStats({ totalUnitsDestroyed: 50 })
      const unlocked = achievementService.checkAchievements(stats, null)

      expect(unlocked.some(a => a.id === 'unit_slayer')).toBe(true)
    })

    it('does not re-unlock already unlocked achievements', () => {
      const stats = createTestStats({ wins: 1 })
      const record = createTestRecord({ result: 'win' })

      achievementService.checkAchievements(stats, record)
      const secondCheck = achievementService.checkAchievements(stats, record)

      expect(secondCheck.some(a => a.id === 'first_win')).toBe(false)
    })

    it('unlocks zodiac_master when all 12 zodiac classes have wins', () => {
      const zodiacClassWins: Record<string, number> = {}
      const zodiacs = [
        'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
        'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
      ]
      for (const z of zodiacs) {
        zodiacClassWins[z] = 1
      }
      const stats = createTestStats({ zodiacClassWins })
      const unlocked = achievementService.checkAchievements(stats, null)

      expect(unlocked.some(a => a.id === 'zodiac_master')).toBe(true)
    })
  })

  describe('getAll', () => {
    it('returns all 15 achievements with progress', () => {
      const all = achievementService.getAll()
      expect(all).toHaveLength(15)
      for (const achievement of all) {
        expect(achievement).toHaveProperty('id')
        expect(achievement).toHaveProperty('name')
        expect(achievement).toHaveProperty('description')
        expect(achievement).toHaveProperty('targetValue')
        expect(achievement).toHaveProperty('currentValue')
      }
    })
  })

  describe('getUnlocked', () => {
    it('returns only unlocked achievements', () => {
      const stats = createTestStats({ wins: 1 })
      achievementService.checkAchievements(stats, createTestRecord())

      const unlocked = achievementService.getUnlocked()
      expect(unlocked.length).toBeGreaterThanOrEqual(1)
      for (const a of unlocked) {
        expect(a.unlocked).toBe(true)
      }
    })
  })

  describe('markNotified', () => {
    it('marks achievement as notified', () => {
      const stats = createTestStats({ wins: 1 })
      achievementService.checkAchievements(stats, createTestRecord())
      achievementService.markNotified('first_win')

      const all = achievementService.getAll()
      const firstWin = all.find(a => a.id === 'first_win')
      expect(firstWin?.notified).toBe(true)
    })
  })
})
