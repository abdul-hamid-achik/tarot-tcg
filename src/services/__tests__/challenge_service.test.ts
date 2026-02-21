import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChallengeGameRecord } from '../challenge_service'
import { challengeService } from '../challenge_service'

const STORAGE_KEY = 'tarot-tcg-challenges'

function createMockGameRecord(overrides: Partial<ChallengeGameRecord> = {}): ChallengeGameRecord {
  return {
    id: 'game-1',
    result: 'win',
    difficulty: 'normal',
    deckName: 'Test Deck',
    rounds: 8,
    durationSeconds: 300,
    cardsPlayed: 15,
    unitsPlayed: 10,
    spellsPlayed: 5,
    damageDealt: 25,
    unitsDestroyed: 6,
    unitsLost: 3,
    manaSpent: 40,
    uniqueCardsPlayed: ['major_00', 'minor_wands_01', 'minor_cups_03'],
    majorArcanaPlayed: ['major_00'],
    zodiacClassesUsed: ['aries', 'taurus', 'gemini'],
    playerHealthRemaining: 12,
    opponentHealthRemaining: 0,
    timestamp: Date.now(),
    ...overrides,
  }
}

describe('ChallengeService', () => {
  beforeEach(() => {
    localStorage.clear()
    challengeService.resetCache()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getAllChallenges', () => {
    it('should return 5 challenges with merged progress', () => {
      const challenges = challengeService.getAllChallenges()

      expect(challenges).toHaveLength(5)
      for (const challenge of challenges) {
        expect(challenge.progress).toBeDefined()
        expect(challenge.progress.challengeId).toBe(challenge.id)
        expect(challenge.progress.completed).toBe(false)
        expect(challenge.progress.attempts).toBe(0)
      }
    })

    it('should return challenges with correct IDs', () => {
      const challenges = challengeService.getAllChallenges()
      const ids = challenges.map(c => c.id)

      expect(ids).toContain('fools-journey')
      expect(ids).toContain('elemental-balance')
      expect(ids).toContain('speed-reader')
      expect(ids).toContain('cursed-deck')
      expect(ids).toContain('zodiac-mastery')
    })

    it('should merge saved progress with definitions', () => {
      // Pre-populate storage with progress
      const storage = {
        version: 1,
        progress: [
          {
            challengeId: 'fools-journey',
            completed: true,
            completedAt: 1000,
            bestRounds: 7,
            bestTime: 180,
            attempts: 3,
          },
        ],
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storage))
      challengeService.resetCache()

      const challenges = challengeService.getAllChallenges()
      const foolsJourney = challenges.find(c => c.id === 'fools-journey')

      expect(foolsJourney).toBeDefined()
      expect(foolsJourney?.progress.completed).toBe(true)
      expect(foolsJourney?.progress.bestRounds).toBe(7)
      expect(foolsJourney?.progress.bestTime).toBe(180)
      expect(foolsJourney?.progress.attempts).toBe(3)
    })
  })

  describe('getChallenge', () => {
    it('should return a single challenge with progress', () => {
      const challenge = challengeService.getChallenge('speed-reader')

      expect(challenge).not.toBeNull()
      expect(challenge?.id).toBe('speed-reader')
      expect(challenge?.name).toBe('Speed Reader')
      expect(challenge?.progress.completed).toBe(false)
    })

    it('should return null for unknown challenge ID', () => {
      const challenge = challengeService.getChallenge('nonexistent')
      expect(challenge).toBeNull()
    })
  })

  describe('recordAttempt', () => {
    it('should increment attempts count', () => {
      challengeService.recordAttempt('fools-journey', false, 10, 400)
      challengeService.recordAttempt('fools-journey', false, 8, 350)

      const challenge = challengeService.getChallenge('fools-journey')
      expect(challenge?.progress.attempts).toBe(2)
    })

    it('should set completed on win', () => {
      const progress = challengeService.recordAttempt('cursed-deck', true, 6, 200)

      expect(progress.completed).toBe(true)
      expect(progress.completedAt).toBeTypeOf('number')
      expect(progress.completedAt).toBeGreaterThan(0)
    })

    it('should not set completed on loss', () => {
      const progress = challengeService.recordAttempt('cursed-deck', false, 10, 400)

      expect(progress.completed).toBe(false)
      expect(progress.completedAt).toBeNull()
    })

    it('should track best rounds on win', () => {
      challengeService.recordAttempt('speed-reader', true, 8, 300)
      challengeService.recordAttempt('speed-reader', true, 5, 250)
      challengeService.recordAttempt('speed-reader', true, 7, 280)

      const challenge = challengeService.getChallenge('speed-reader')
      expect(challenge?.progress.bestRounds).toBe(5)
    })

    it('should track best time on win', () => {
      challengeService.recordAttempt('cursed-deck', true, 10, 400)
      challengeService.recordAttempt('cursed-deck', true, 8, 200)
      challengeService.recordAttempt('cursed-deck', true, 9, 350)

      const challenge = challengeService.getChallenge('cursed-deck')
      expect(challenge?.progress.bestTime).toBe(200)
    })

    it('should not update best rounds on loss', () => {
      challengeService.recordAttempt('speed-reader', true, 8, 300)
      challengeService.recordAttempt('speed-reader', false, 3, 100)

      const challenge = challengeService.getChallenge('speed-reader')
      expect(challenge?.progress.bestRounds).toBe(8)
    })

    it('should keep best scores when recording attempt on already completed challenge', () => {
      challengeService.recordAttempt('fools-journey', true, 5, 150)
      const firstCompletedAt = challengeService.getChallenge('fools-journey')?.progress.completedAt

      challengeService.recordAttempt('fools-journey', true, 7, 200)

      const challenge = challengeService.getChallenge('fools-journey')
      expect(challenge?.progress.completed).toBe(true)
      expect(challenge?.progress.completedAt).toBe(firstCompletedAt)
      expect(challenge?.progress.bestRounds).toBe(5)
      expect(challenge?.progress.bestTime).toBe(150)
      expect(challenge?.progress.attempts).toBe(2)
    })
  })

  describe('validateChallengeCompletion', () => {
    it('should fail validation if game was lost', () => {
      const record = createMockGameRecord({ result: 'loss' })
      expect(challengeService.validateChallengeCompletion('fools-journey', record)).toBe(false)
    })

    it('should return false for unknown challenge ID', () => {
      const record = createMockGameRecord()
      expect(challengeService.validateChallengeCompletion('nonexistent', record)).toBe(false)
    })

    describe("The Fool's Journey", () => {
      it('should pass when all played cards are major arcana', () => {
        const record = createMockGameRecord({
          uniqueCardsPlayed: ['major_00', 'major_01', 'major_02', 'major_06'],
          majorArcanaPlayed: ['major_00', 'major_01', 'major_02', 'major_06'],
        })
        expect(challengeService.validateChallengeCompletion('fools-journey', record)).toBe(true)
      })

      it('should fail when non-major arcana cards were played', () => {
        const record = createMockGameRecord({
          uniqueCardsPlayed: ['major_00', 'minor_wands_01'],
        })
        expect(challengeService.validateChallengeCompletion('fools-journey', record)).toBe(false)
      })
    })

    describe('Elemental Balance', () => {
      it('should pass when all 4 elements were played', () => {
        const record = createMockGameRecord({
          elementsPlayed: ['fire', 'earth', 'air', 'water'],
        })
        expect(challengeService.validateChallengeCompletion('elemental-balance', record)).toBe(true)
      })

      it('should fail when not all elements were played', () => {
        const record = createMockGameRecord({
          elementsPlayed: ['fire', 'earth', 'air'],
        })
        expect(challengeService.validateChallengeCompletion('elemental-balance', record)).toBe(
          false,
        )
      })

      it('should fail when elementsPlayed is not provided', () => {
        const record = createMockGameRecord()
        delete record.elementsPlayed
        expect(challengeService.validateChallengeCompletion('elemental-balance', record)).toBe(
          false,
        )
      })
    })

    describe('Speed Reader', () => {
      it('should pass when won in 5 or fewer rounds', () => {
        const record = createMockGameRecord({ rounds: 4 })
        expect(challengeService.validateChallengeCompletion('speed-reader', record)).toBe(true)
      })

      it('should pass when won in exactly 5 rounds', () => {
        const record = createMockGameRecord({ rounds: 5 })
        expect(challengeService.validateChallengeCompletion('speed-reader', record)).toBe(true)
      })

      it('should fail when won in more than 5 rounds', () => {
        const record = createMockGameRecord({ rounds: 6 })
        expect(challengeService.validateChallengeCompletion('speed-reader', record)).toBe(false)
      })
    })

    describe('Cursed Deck', () => {
      it('should pass when game is won (curse is applied at setup)', () => {
        const record = createMockGameRecord()
        expect(challengeService.validateChallengeCompletion('cursed-deck', record)).toBe(true)
      })
    })

    describe('Zodiac Mastery', () => {
      it('should pass when 6 or more zodiac classes were used', () => {
        const record = createMockGameRecord({
          zodiacClassesUsed: ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo'],
        })
        expect(challengeService.validateChallengeCompletion('zodiac-mastery', record)).toBe(true)
      })

      it('should pass when more than 6 zodiac classes were used', () => {
        const record = createMockGameRecord({
          zodiacClassesUsed: [
            'aries',
            'taurus',
            'gemini',
            'cancer',
            'leo',
            'virgo',
            'libra',
            'scorpio',
          ],
        })
        expect(challengeService.validateChallengeCompletion('zodiac-mastery', record)).toBe(true)
      })

      it('should fail when fewer than 6 zodiac classes were used', () => {
        const record = createMockGameRecord({
          zodiacClassesUsed: ['aries', 'taurus', 'gemini', 'cancer', 'leo'],
        })
        expect(challengeService.validateChallengeCompletion('zodiac-mastery', record)).toBe(false)
      })
    })
  })

  describe('storage persistence', () => {
    it('should persist progress to localStorage', () => {
      challengeService.recordAttempt('speed-reader', true, 4, 180)

      const raw = localStorage.getItem(STORAGE_KEY)
      expect(raw).not.toBeNull()

      const parsed = JSON.parse(raw as string)
      expect(parsed.version).toBe(1)
      expect(parsed.progress).toBeInstanceOf(Array)

      const speedReaderProgress = parsed.progress.find(
        (p: { challengeId: string }) => p.challengeId === 'speed-reader',
      )
      expect(speedReaderProgress).toBeDefined()
      expect(speedReaderProgress.completed).toBe(true)
      expect(speedReaderProgress.bestRounds).toBe(4)
    })

    it('should load progress from localStorage', () => {
      const storage = {
        version: 1,
        progress: [
          {
            challengeId: 'zodiac-mastery',
            completed: true,
            completedAt: 5000,
            bestRounds: 10,
            bestTime: 500,
            attempts: 5,
          },
        ],
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storage))
      challengeService.resetCache()

      const challenge = challengeService.getChallenge('zodiac-mastery')
      expect(challenge?.progress.completed).toBe(true)
      expect(challenge?.progress.bestRounds).toBe(10)
      expect(challenge?.progress.attempts).toBe(5)
    })

    it('should handle corrupted localStorage gracefully', () => {
      localStorage.setItem(STORAGE_KEY, 'not valid json{{{')
      challengeService.resetCache()

      const challenges = challengeService.getAllChallenges()
      expect(challenges).toHaveLength(5)
      for (const challenge of challenges) {
        expect(challenge.progress.completed).toBe(false)
        expect(challenge.progress.attempts).toBe(0)
      }
    })

    it('should handle invalid schema in localStorage gracefully', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 'bad', progress: 'not-array' }))
      challengeService.resetCache()

      const challenges = challengeService.getAllChallenges()
      expect(challenges).toHaveLength(5)
      for (const challenge of challenges) {
        expect(challenge.progress.completed).toBe(false)
      }
    })

    it('should return default storage when localStorage is empty', () => {
      const challenges = challengeService.getAllChallenges()
      expect(challenges).toHaveLength(5)
      for (const challenge of challenges) {
        expect(challenge.progress.attempts).toBe(0)
        expect(challenge.progress.completed).toBe(false)
      }
    })
  })
})
