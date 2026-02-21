import type { GameRecord, PlayerStats, StatsStorage } from '@/schemas/stats_schema'
import { StatsStorageSchema } from '@/schemas/stats_schema'

const STORAGE_KEY = 'tarot-tcg-stats'
const CURRENT_VERSION = 1
const MAX_RECENT_GAMES = 50

function createDefaultStats(): PlayerStats {
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
  }
}

function createDefaultStorage(): StatsStorage {
  return {
    version: CURRENT_VERSION,
    stats: createDefaultStats(),
    recentGames: [],
    achievements: [],
  }
}

/** Extract base card id from instance id (strips p1_/p2_ prefix and _N suffix) */
export function extractBaseCardId(instanceId: string): string {
  // Instance IDs look like "p1_major_00_1" or "p2_minor_wands_01_2"
  // Base card IDs look like "major_00" or "minor_wands_01"
  let id = instanceId
  // Strip player prefix
  if (id.startsWith('p1_') || id.startsWith('p2_')) {
    id = id.slice(3)
  }
  // Strip trailing _N counter suffix (last underscore + digits)
  const lastUnderscore = id.lastIndexOf('_')
  if (lastUnderscore > 0) {
    const suffix = id.slice(lastUnderscore + 1)
    if (/^\d+$/.test(suffix)) {
      id = id.slice(0, lastUnderscore)
    }
  }
  return id
}

class StatsService {
  private storage: StatsStorage | null = null

  loadStorage(): StatsStorage {
    if (this.storage) return this.storage

    if (typeof window === 'undefined') {
      return createDefaultStorage()
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) {
        this.storage = createDefaultStorage()
        return this.storage
      }

      const parsed = JSON.parse(raw)
      const validated = StatsStorageSchema.safeParse(parsed)
      if (validated.success) {
        this.storage = validated.data
        return this.storage
      }

      // Invalid data - start fresh
      console.warn('Stats data failed validation, resetting:', validated.error)
      this.storage = createDefaultStorage()
      return this.storage
    } catch {
      this.storage = createDefaultStorage()
      return this.storage
    }
  }

  private saveStorage(): void {
    if (!this.storage) return
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.storage))
    } catch {
      console.warn('Failed to save stats to localStorage')
    }
  }

  recordGame(record: GameRecord): PlayerStats {
    const storage = this.loadStorage()
    const { stats } = storage

    // Update aggregate stats
    stats.totalGames++
    if (record.result === 'win') {
      stats.wins++
      stats.currentStreak++
      if (stats.currentStreak > stats.bestStreak) {
        stats.bestStreak = stats.currentStreak
      }
    } else {
      stats.losses++
      stats.currentStreak = 0
    }

    stats.totalDamageDealt += record.damageDealt
    stats.totalUnitsDestroyed += record.unitsDestroyed
    stats.totalUnitsLost += record.unitsLost
    stats.totalCardsPlayed += record.cardsPlayed
    stats.totalManaSpent += record.manaSpent
    stats.totalPlayTimeSeconds += record.durationSeconds

    // Merge unique cards
    for (const cardId of record.uniqueCardsPlayed) {
      if (!stats.uniqueCardsEverPlayed.includes(cardId)) {
        stats.uniqueCardsEverPlayed.push(cardId)
      }
    }

    // Merge major arcana
    for (const cardId of record.majorArcanaPlayed) {
      if (!stats.majorArcanaEverPlayed.includes(cardId)) {
        stats.majorArcanaEverPlayed.push(cardId)
      }
    }

    // Track zodiac class wins
    if (record.result === 'win') {
      for (const zodiac of record.zodiacClassesUsed) {
        stats.zodiacClassWins[zodiac] = (stats.zodiacClassWins[zodiac] || 0) + 1
      }
    }

    // Track difficulty record
    if (!stats.difficultyRecord[record.difficulty]) {
      stats.difficultyRecord[record.difficulty] = { wins: 0, losses: 0 }
    }
    if (record.result === 'win') {
      stats.difficultyRecord[record.difficulty].wins++
    } else {
      stats.difficultyRecord[record.difficulty].losses++
    }

    // Add to recent games (keep last N)
    storage.recentGames.unshift(record)
    if (storage.recentGames.length > MAX_RECENT_GAMES) {
      storage.recentGames = storage.recentGames.slice(0, MAX_RECENT_GAMES)
    }

    this.saveStorage()
    return stats
  }

  getStats(): PlayerStats {
    return this.loadStorage().stats
  }

  getRecentGames(limit = 20): GameRecord[] {
    return this.loadStorage().recentGames.slice(0, limit)
  }

  getStorage(): StatsStorage {
    return this.loadStorage()
  }

  resetStats(): void {
    this.storage = createDefaultStorage()
    this.saveStorage()
  }

  /** Update achievement progress in storage */
  saveAchievements(achievements: StatsStorage['achievements']): void {
    const storage = this.loadStorage()
    storage.achievements = achievements
    this.saveStorage()
  }
}

export const statsService = new StatsService()
