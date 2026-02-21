import type {
  ChallengeDefinition,
  ChallengeProgress,
  ChallengeStorage,
} from '@/schemas/challenge_schema'
import { ChallengeStorageSchema } from '@/schemas/challenge_schema'
import type { GameRecord } from '@/schemas/stats_schema'

const STORAGE_KEY = 'tarot-tcg-challenges'
const CURRENT_VERSION = 1

/** Extended game record with optional challenge-specific tracking fields */
export interface ChallengeGameRecord extends GameRecord {
  elementsPlayed?: string[]
}

/** A challenge definition merged with its progress data */
export interface ChallengeWithProgress extends ChallengeDefinition {
  progress: ChallengeProgress
}

const CHALLENGE_DEFINITIONS: ChallengeDefinition[] = [
  {
    id: 'fools-journey',
    name: "The Fool's Journey",
    description:
      'Win using only the Major Arcana. Your deck is built entirely from the 22 Major Arcana cards.',
    icon: '\u{1F0CF}',
    difficulty: 'medium',
    rules: {
      deckRestriction: 'major-arcana-only',
      maxRounds: null,
      requiredElements: null,
      requiredZodiacs: null,
      majorArcanaOnly: true,
      startingHealth: 20,
      startingMana: 1,
      aiDifficulty: 'normal',
    },
    rewardDescription: 'Win using only the Major Arcana',
  },
  {
    id: 'elemental-balance',
    name: 'Elemental Balance',
    description:
      'Play at least 1 card of each element (fire, earth, air, water) before winning the game.',
    icon: '\u{1F30D}',
    difficulty: 'hard',
    rules: {
      deckRestriction: null,
      maxRounds: null,
      requiredElements: ['fire', 'earth', 'air', 'water'],
      requiredZodiacs: null,
      majorArcanaOnly: false,
      startingHealth: 20,
      startingMana: 1,
      aiDifficulty: 'hard',
    },
    rewardDescription: 'Play all 4 elements in a single game',
  },
  {
    id: 'speed-reader',
    name: 'Speed Reader',
    description:
      'Win the game in 5 rounds or fewer. You start with 3 mana to give you a head start.',
    icon: '\u{26A1}',
    difficulty: 'hard',
    rules: {
      deckRestriction: null,
      maxRounds: 5,
      requiredElements: null,
      requiredZodiacs: null,
      majorArcanaOnly: false,
      startingHealth: 20,
      startingMana: 3,
      aiDifficulty: 'normal',
    },
    rewardDescription: 'Win in 5 rounds or less',
  },
  {
    id: 'cursed-deck',
    name: 'Cursed Deck',
    description:
      'Start with only 15 health instead of 20. All your cards cost 1 more mana. Survive and win despite the curse.',
    icon: '\u{1F480}',
    difficulty: 'medium',
    rules: {
      deckRestriction: 'cursed',
      maxRounds: null,
      requiredElements: null,
      requiredZodiacs: null,
      majorArcanaOnly: false,
      startingHealth: 15,
      startingMana: 1,
      aiDifficulty: 'easy',
    },
    rewardDescription: 'Win with a cursed disadvantage',
  },
  {
    id: 'zodiac-mastery',
    name: 'Zodiac Mastery',
    description:
      'Play cards from at least 6 different zodiac classes in a single game to prove your astrological versatility.',
    icon: '\u{2648}',
    difficulty: 'hard',
    rules: {
      deckRestriction: null,
      maxRounds: null,
      requiredElements: null,
      requiredZodiacs: null,
      majorArcanaOnly: false,
      startingHealth: 20,
      startingMana: 1,
      aiDifficulty: 'hard',
    },
    rewardDescription: 'Play 6+ zodiac classes in one game',
  },
]

function createDefaultProgress(challengeId: string): ChallengeProgress {
  return {
    challengeId,
    completed: false,
    completedAt: null,
    bestRounds: null,
    bestTime: null,
    attempts: 0,
  }
}

function createDefaultStorage(): ChallengeStorage {
  return {
    version: CURRENT_VERSION,
    progress: [],
  }
}

class ChallengeService {
  private storage: ChallengeStorage | null = null

  loadStorage(): ChallengeStorage {
    if (this.storage) return this.storage

    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) {
        this.storage = createDefaultStorage()
        return this.storage
      }

      const parsed = JSON.parse(raw)
      const validated = ChallengeStorageSchema.safeParse(parsed)
      if (validated.success) {
        this.storage = validated.data
        return this.storage
      }

      console.warn('Challenge data failed validation, resetting:', validated.error)
      this.storage = createDefaultStorage()
      return this.storage
    } catch {
      this.storage = createDefaultStorage()
      return this.storage
    }
  }

  saveStorage(): void {
    if (!this.storage) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.storage))
    } catch {
      console.warn('Failed to save challenge data to localStorage')
    }
  }

  private getProgress(challengeId: string): ChallengeProgress {
    const storage = this.loadStorage()
    const existing = storage.progress.find(p => p.challengeId === challengeId)
    if (existing) return existing

    const defaultProgress = createDefaultProgress(challengeId)
    storage.progress.push(defaultProgress)
    return defaultProgress
  }

  getAllChallenges(): ChallengeWithProgress[] {
    return CHALLENGE_DEFINITIONS.map(def => ({
      ...def,
      progress: this.getProgress(def.id),
    }))
  }

  getChallenge(id: string): ChallengeWithProgress | null {
    const def = CHALLENGE_DEFINITIONS.find(d => d.id === id)
    if (!def) return null
    return {
      ...def,
      progress: this.getProgress(def.id),
    }
  }

  recordAttempt(
    id: string,
    won: boolean,
    rounds: number,
    durationSeconds: number,
  ): ChallengeProgress {
    const storage = this.loadStorage()
    let progress = storage.progress.find(p => p.challengeId === id)
    if (!progress) {
      progress = createDefaultProgress(id)
      storage.progress.push(progress)
    }

    progress.attempts++

    if (won) {
      if (!progress.completed) {
        progress.completed = true
        progress.completedAt = Date.now()
      }

      if (progress.bestRounds === null || rounds < progress.bestRounds) {
        progress.bestRounds = rounds
      }

      if (progress.bestTime === null || durationSeconds < progress.bestTime) {
        progress.bestTime = durationSeconds
      }
    }

    this.saveStorage()
    return { ...progress }
  }

  validateChallengeCompletion(id: string, gameRecord: ChallengeGameRecord): boolean {
    const def = CHALLENGE_DEFINITIONS.find(d => d.id === id)
    if (!def) return false

    // Must have won the game
    if (gameRecord.result !== 'win') return false

    switch (id) {
      case 'fools-journey': {
        // Must win using only Major Arcana cards
        // All played cards should be major arcana
        return gameRecord.uniqueCardsPlayed.every(cardId => cardId.startsWith('major'))
      }

      case 'elemental-balance': {
        // Must play at least 1 card of each element
        const requiredElements = def.rules.requiredElements
        if (!requiredElements) return true
        const playedElements = new Set(gameRecord.elementsPlayed ?? [])
        return requiredElements.every(el => playedElements.has(el))
      }

      case 'speed-reader': {
        // Must win in 5 rounds or fewer
        const maxRounds = def.rules.maxRounds
        if (maxRounds === null) return true
        return gameRecord.rounds <= maxRounds
      }

      case 'cursed-deck': {
        // Just needs to win (the curse is applied at game setup)
        return true
      }

      case 'zodiac-mastery': {
        // Must play cards from at least 6 different zodiac classes
        return gameRecord.zodiacClassesUsed.length >= 6
      }

      default:
        return false
    }
  }

  /** Reset cached storage (useful for testing) */
  resetCache(): void {
    this.storage = null
  }
}

export const challengeService = new ChallengeService()
