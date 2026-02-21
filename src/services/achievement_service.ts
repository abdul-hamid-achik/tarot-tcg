import type { AchievementProgress, GameRecord, PlayerStats } from '@/schemas/stats_schema'
import { statsService } from '@/services/stats_service'

interface AchievementDefinition {
  id: string
  name: string
  description: string
  icon: string
  targetValue: number
  getValue: (stats: PlayerStats, latestGame: GameRecord | null) => number
}

const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  {
    id: 'first_win',
    name: 'First Reading',
    description: 'Win your first game',
    icon: '🌱',
    targetValue: 1,
    getValue: stats => stats.wins,
  },
  {
    id: 'win_10',
    name: 'Apprentice',
    description: 'Win 10 games',
    icon: '📖',
    targetValue: 10,
    getValue: stats => stats.wins,
  },
  {
    id: 'win_50',
    name: 'Master Reader',
    description: 'Win 50 games',
    icon: '🏆',
    targetValue: 50,
    getValue: stats => stats.wins,
  },
  {
    id: 'perfect_game',
    name: 'Untouched Nexus',
    description: 'Win without taking any damage',
    icon: '🛡️',
    targetValue: 1,
    getValue: (_stats, game) => {
      if (!game || game.result !== 'win') return 0
      return game.playerHealthRemaining >= 20 ? 1 : 0
    },
  },
  {
    id: 'speed_run',
    name: 'Speed Reader',
    description: 'Win in 5 rounds or fewer',
    icon: '⚡',
    targetValue: 1,
    getValue: (_stats, game) => {
      if (!game || game.result !== 'win') return 0
      return game.rounds <= 5 ? 1 : 0
    },
  },
  {
    id: 'zodiac_master',
    name: 'Master of All Signs',
    description: 'Win with all 12 zodiac classes',
    icon: '♈',
    targetValue: 12,
    getValue: stats => Object.keys(stats.zodiacClassWins).length,
  },
  {
    id: 'fools_journey',
    name: "The Fool's Journey",
    description: 'Play all 22 Major Arcana across your games',
    icon: '🃏',
    targetValue: 22,
    getValue: stats => stats.majorArcanaEverPlayed.length,
  },
  {
    id: 'damage_100',
    name: 'Damage Dealer',
    description: 'Deal 100 total nexus damage',
    icon: '🔥',
    targetValue: 100,
    getValue: stats => stats.totalDamageDealt,
  },
  {
    id: 'damage_500',
    name: 'Annihilator',
    description: 'Deal 500 total nexus damage',
    icon: '💥',
    targetValue: 500,
    getValue: stats => stats.totalDamageDealt,
  },
  {
    id: 'unit_slayer',
    name: 'Unit Slayer',
    description: 'Destroy 50 enemy units',
    icon: '⚔️',
    targetValue: 50,
    getValue: stats => stats.totalUnitsDestroyed,
  },
  {
    id: 'streak_3',
    name: 'On a Roll',
    description: 'Win 3 games in a row',
    icon: '🎯',
    targetValue: 3,
    getValue: stats => stats.bestStreak,
  },
  {
    id: 'streak_7',
    name: 'Unstoppable',
    description: 'Win 7 games in a row',
    icon: '🌟',
    targetValue: 7,
    getValue: stats => stats.bestStreak,
  },
  {
    id: 'beat_hard',
    name: 'Apprentice Defeated',
    description: 'Win on Hard difficulty',
    icon: '⭐',
    targetValue: 1,
    getValue: stats => stats.difficultyRecord.hard?.wins || 0,
  },
  {
    id: 'beat_expert',
    name: 'Oracle Conquered',
    description: 'Win on Expert difficulty',
    icon: '👑',
    targetValue: 1,
    getValue: stats => stats.difficultyRecord.expert?.wins || 0,
  },
  {
    id: 'cards_50',
    name: 'Card Scholar',
    description: 'Play 50 unique cards across all games',
    icon: '📚',
    targetValue: 50,
    getValue: stats => stats.uniqueCardsEverPlayed.length,
  },
]

class AchievementService {
  private definitions = ACHIEVEMENT_DEFINITIONS

  /** Initialize default progress for all achievements */
  private initializeProgress(): AchievementProgress[] {
    return this.definitions.map(def => ({
      id: def.id,
      unlocked: false,
      unlockedAt: null,
      currentValue: 0,
      targetValue: def.targetValue,
      notified: false,
    }))
  }

  /** Get or initialize achievement progress from storage */
  private getProgress(): AchievementProgress[] {
    const storage = statsService.getStorage()
    if (storage.achievements.length === 0) {
      const progress = this.initializeProgress()
      statsService.saveAchievements(progress)
      return progress
    }

    // Ensure any new achievements are added
    const existing = storage.achievements
    const existingIds = new Set(existing.map(a => a.id))
    let updated = false

    for (const def of this.definitions) {
      if (!existingIds.has(def.id)) {
        existing.push({
          id: def.id,
          unlocked: false,
          unlockedAt: null,
          currentValue: 0,
          targetValue: def.targetValue,
          notified: false,
        })
        updated = true
      }
    }

    if (updated) {
      statsService.saveAchievements(existing)
    }

    return existing
  }

  /** Check all achievements and return newly unlocked ones */
  checkAchievements(stats: PlayerStats, latestGame: GameRecord | null): AchievementProgress[] {
    const progress = this.getProgress()
    const newlyUnlocked: AchievementProgress[] = []

    for (const achievement of progress) {
      if (achievement.unlocked) continue

      const def = this.definitions.find(d => d.id === achievement.id)
      if (!def) continue

      const value = def.getValue(stats, latestGame)
      achievement.currentValue = value

      if (value >= def.targetValue) {
        achievement.unlocked = true
        achievement.unlockedAt = Date.now()
        achievement.notified = false
        newlyUnlocked.push(achievement)
      }
    }

    statsService.saveAchievements(progress)
    return newlyUnlocked
  }

  /** Get all achievements with their definitions */
  getAll(): (AchievementDefinition & AchievementProgress)[] {
    const progress = this.getProgress()
    return this.definitions.map(def => {
      const p = progress.find(a => a.id === def.id)
      return {
        ...def,
        ...(p || {
          id: def.id,
          unlocked: false,
          unlockedAt: null,
          currentValue: 0,
          targetValue: def.targetValue,
          notified: false,
        }),
      }
    })
  }

  /** Get only unlocked achievements */
  getUnlocked(): AchievementProgress[] {
    return this.getProgress().filter(a => a.unlocked)
  }

  /** Mark an achievement as notified (toast shown) */
  markNotified(id: string): void {
    const progress = this.getProgress()
    const achievement = progress.find(a => a.id === id)
    if (achievement) {
      achievement.notified = true
      statsService.saveAchievements(progress)
    }
  }

  /** Get achievement definition by ID */
  getDefinition(id: string): AchievementDefinition | undefined {
    return this.definitions.find(d => d.id === id)
  }
}

export const achievementService = new AchievementService()
