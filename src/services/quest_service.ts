import type {
  QuestCategory,
  QuestDefinition,
  QuestProgress,
  QuestStorage,
} from '@/schemas/quest_schema'
import { QuestStorageSchema } from '@/schemas/quest_schema'

const STORAGE_KEY = 'tarot-tcg-quests'
const CURRENT_VERSION = 1
const MS_PER_DAY = 24 * 60 * 60 * 1000
const MS_PER_WEEK = 7 * MS_PER_DAY

// ================================
// QUEST DEFINITIONS
// ================================

const DAILY_QUEST_POOL: QuestDefinition[] = [
  {
    id: 'daily_win_1',
    name: 'Win 1 game',
    description: 'Win a single game against any opponent',
    icon: '\u{1F3C6}',
    type: 'daily',
    category: 'win',
    targetValue: 1,
    rewardXP: 50,
  },
  {
    id: 'daily_win_2',
    name: 'Win 2 games',
    description: 'Win two games against any opponent',
    icon: '\u{1F3C6}',
    type: 'daily',
    category: 'win',
    targetValue: 2,
    rewardXP: 100,
  },
  {
    id: 'daily_win_3',
    name: 'Win 3 games',
    description: 'Win three games against any opponent',
    icon: '\u{1F3C6}',
    type: 'daily',
    category: 'win',
    targetValue: 3,
    rewardXP: 150,
  },
  {
    id: 'daily_damage_20',
    name: 'Deal 20 nexus damage',
    description: 'Deal 20 damage to the enemy nexus across games',
    icon: '\u{1F525}',
    type: 'daily',
    category: 'damage',
    targetValue: 20,
    rewardXP: 75,
  },
  {
    id: 'daily_damage_40',
    name: 'Deal 40 nexus damage',
    description: 'Deal 40 damage to the enemy nexus across games',
    icon: '\u{1F525}',
    type: 'daily',
    category: 'damage',
    targetValue: 40,
    rewardXP: 125,
  },
  {
    id: 'daily_cards_10',
    name: 'Play 10 cards',
    description: 'Play 10 cards in total across games',
    icon: '\u{1F0CF}',
    type: 'daily',
    category: 'cards',
    targetValue: 10,
    rewardXP: 60,
  },
  {
    id: 'daily_cards_15',
    name: 'Play 15 cards',
    description: 'Play 15 cards in total across games',
    icon: '\u{1F0CF}',
    type: 'daily',
    category: 'cards',
    targetValue: 15,
    rewardXP: 90,
  },
  {
    id: 'daily_units_5',
    name: 'Destroy 5 units',
    description: 'Destroy 5 enemy units across games',
    icon: '\u{2694}\u{FE0F}',
    type: 'daily',
    category: 'units',
    targetValue: 5,
    rewardXP: 75,
  },
  {
    id: 'daily_units_10',
    name: 'Destroy 10 units',
    description: 'Destroy 10 enemy units across games',
    icon: '\u{2694}\u{FE0F}',
    type: 'daily',
    category: 'units',
    targetValue: 10,
    rewardXP: 125,
  },
  {
    id: 'daily_spells_3',
    name: 'Cast 3 spells',
    description: 'Cast 3 spells across games',
    icon: '\u{2728}',
    type: 'daily',
    category: 'spells',
    targetValue: 3,
    rewardXP: 60,
  },
  {
    id: 'daily_spells_5',
    name: 'Cast 5 spells',
    description: 'Cast 5 spells across games',
    icon: '\u{2728}',
    type: 'daily',
    category: 'spells',
    targetValue: 5,
    rewardXP: 100,
  },
  {
    id: 'daily_major_arcana',
    name: 'Play a Major Arcana card',
    description: 'Play at least one Major Arcana card in a game',
    icon: '\u{1F31F}',
    type: 'daily',
    category: 'zodiac',
    targetValue: 1,
    rewardXP: 50,
  },
]

const WEEKLY_QUEST_POOL: QuestDefinition[] = [
  {
    id: 'weekly_win_10',
    name: 'Win 10 games',
    description: 'Win 10 games this week',
    icon: '\u{1F451}',
    type: 'weekly',
    category: 'win',
    targetValue: 10,
    rewardXP: 500,
  },
  {
    id: 'weekly_damage_100',
    name: 'Deal 100 total damage',
    description: 'Deal 100 damage to enemy nexus this week',
    icon: '\u{1F4A5}',
    type: 'weekly',
    category: 'damage',
    targetValue: 100,
    rewardXP: 400,
  },
  {
    id: 'weekly_hard_win',
    name: 'Win on Hard or Expert difficulty',
    description: 'Win at least one game on Hard or Expert',
    icon: '\u{1F4AA}',
    type: 'weekly',
    category: 'difficulty',
    targetValue: 1,
    rewardXP: 300,
  },
  {
    id: 'weekly_unique_cards',
    name: 'Play 50 unique cards',
    description: 'Play 50 different cards this week',
    icon: '\u{1F4DA}',
    type: 'weekly',
    category: 'cards',
    targetValue: 50,
    rewardXP: 450,
  },
]

// ================================
// HELPERS
// ================================

/**
 * Deterministic pseudo-random number generator seeded by a string.
 * Uses a simple hash -> linear congruential generator approach.
 */
function seededRandom(seed: string): () => number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  let state = Math.abs(hash) || 1
  return () => {
    state = (state * 1664525 + 1013904223) & 0x7fffffff
    return state / 0x7fffffff
  }
}

/**
 * Pick `count` items from `pool` using a seeded random function.
 * Returns a new array without modifying the pool.
 */
function pickRandom<T>(pool: T[], count: number, rng: () => number): T[] {
  const available = [...pool]
  const picked: T[] = []
  const n = Math.min(count, available.length)
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(rng() * available.length)
    picked.push(available[idx])
    available.splice(idx, 1)
  }
  return picked
}

/** Get the start of the current UTC day as a timestamp */
function getDayKey(timestamp: number): string {
  const d = new Date(timestamp)
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`
}

/** Get the start of the current UTC week (Monday-based) as a key */
function getWeekKey(timestamp: number): string {
  const d = new Date(timestamp)
  // Find the Monday of this week
  const day = d.getUTCDay()
  const diff = day === 0 ? 6 : day - 1 // Monday = 0, Sunday = 6
  const monday = new Date(timestamp)
  monday.setUTCDate(d.getUTCDate() - diff)
  return `${monday.getUTCFullYear()}-W${monday.getUTCMonth()}-${monday.getUTCDate()}`
}

function createDefaultStorage(): QuestStorage {
  return {
    version: CURRENT_VERSION,
    dailyQuests: [],
    weeklyQuests: [],
    lastDailyRefresh: 0,
    lastWeeklyRefresh: 0,
    totalXP: 0,
    level: 1,
  }
}

function createProgressFromDefinition(def: QuestDefinition): QuestProgress {
  return {
    questId: def.id,
    currentValue: 0,
    targetValue: def.targetValue,
    completed: false,
    completedAt: null,
    claimed: false,
  }
}

// ================================
// QUEST SERVICE
// ================================

class QuestService {
  private storage: QuestStorage | null = null

  /** Load quest storage from localStorage with Zod validation */
  loadStorage(): QuestStorage {
    if (this.storage) return this.storage

    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) {
        this.storage = createDefaultStorage()
        return this.storage
      }

      const parsed = JSON.parse(raw)
      const validated = QuestStorageSchema.safeParse(parsed)
      if (validated.success) {
        this.storage = validated.data
        return this.storage
      }

      console.warn('Quest data failed validation, resetting:', validated.error)
      this.storage = createDefaultStorage()
      return this.storage
    } catch {
      this.storage = createDefaultStorage()
      return this.storage
    }
  }

  /** Save current storage to localStorage */
  private saveStorage(): void {
    if (!this.storage) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.storage))
    } catch {
      console.warn('Failed to save quests to localStorage')
    }
  }

  /**
   * Refresh quests if enough time has elapsed.
   * Uses deterministic seeded random so the same player gets the same quests on the same day.
   */
  refreshQuests(now: number = Date.now()): void {
    const storage = this.loadStorage()

    const needsDailyRefresh =
      storage.lastDailyRefresh === 0 || now - storage.lastDailyRefresh >= MS_PER_DAY
    const needsWeeklyRefresh =
      storage.lastWeeklyRefresh === 0 || now - storage.lastWeeklyRefresh >= MS_PER_WEEK

    if (needsDailyRefresh) {
      const dayKey = getDayKey(now)
      const rng = seededRandom(`daily-${dayKey}`)
      const picked = pickRandom(DAILY_QUEST_POOL, 3, rng)
      storage.dailyQuests = picked.map(createProgressFromDefinition)
      storage.lastDailyRefresh = now
    }

    if (needsWeeklyRefresh) {
      const weekKey = getWeekKey(now)
      const rng = seededRandom(`weekly-${weekKey}`)
      const picked = pickRandom(WEEKLY_QUEST_POOL, 2, rng)
      storage.weeklyQuests = picked.map(createProgressFromDefinition)
      storage.lastWeeklyRefresh = now
    }

    if (needsDailyRefresh || needsWeeklyRefresh) {
      this.saveStorage()
    }
  }

  /**
   * Update progress for all active quests matching the given category.
   * @param category - The quest category to match
   * @param amount - The amount to increment by
   */
  updateProgress(category: QuestCategory, amount: number): void {
    const storage = this.loadStorage()
    const now = Date.now()

    const updateList = (quests: QuestProgress[]) => {
      for (const quest of quests) {
        if (quest.completed || quest.claimed) continue

        const def = this.getDefinition(quest.questId)
        if (!def || def.category !== category) continue

        quest.currentValue = Math.min(quest.currentValue + amount, quest.targetValue)
        if (quest.currentValue >= quest.targetValue) {
          quest.completed = true
          quest.completedAt = now
        }
      }
    }

    updateList(storage.dailyQuests)
    updateList(storage.weeklyQuests)
    this.saveStorage()
  }

  /** Get all active daily and weekly quests with their progress */
  getActiveQuests(): { daily: QuestProgress[]; weekly: QuestProgress[] } {
    const storage = this.loadStorage()
    return {
      daily: [...storage.dailyQuests],
      weekly: [...storage.weeklyQuests],
    }
  }

  /** Claim a completed quest and receive XP */
  claimQuest(questId: string): boolean {
    const storage = this.loadStorage()

    const allQuests = [...storage.dailyQuests, ...storage.weeklyQuests]
    const quest = allQuests.find(q => q.questId === questId)

    if (!quest || !quest.completed || quest.claimed) {
      return false
    }

    const def = this.getDefinition(questId)
    if (!def) return false

    quest.claimed = true
    storage.totalXP += def.rewardXP

    // Calculate level: level N requires N * 100 XP total
    // Level 1: 0 XP, Level 2: 100 XP, Level 3: 300 XP, Level 4: 600 XP...
    // Cumulative XP for level N = sum(1..N-1) * 100 = N*(N-1)/2 * 100
    storage.level = this.calculateLevel(storage.totalXP)

    this.saveStorage()
    return true
  }

  /** Calculate level from total XP. Level N requires cumulative N*(N-1)/2 * 100 XP. */
  calculateLevel(totalXP: number): number {
    let level = 1
    let xpNeeded = 0
    while (true) {
      xpNeeded += level * 100
      if (totalXP < xpNeeded) break
      level++
    }
    return level
  }

  /** Get XP required for the next level (just the increment, not cumulative) */
  getXPForNextLevel(level: number): number {
    return level * 100
  }

  /** Get cumulative XP needed to reach a given level */
  getCumulativeXPForLevel(level: number): number {
    // Sum of 1*100 + 2*100 + ... + (level-1)*100 = level*(level-1)/2 * 100
    return (level * (level - 1) * 100) / 2
  }

  /** Get XP progress within the current level */
  getCurrentLevelProgress(totalXP: number, level: number): { current: number; required: number } {
    const xpForCurrentLevel = this.getCumulativeXPForLevel(level)
    const xpForNextLevel = this.getXPForNextLevel(level)
    return {
      current: totalXP - xpForCurrentLevel,
      required: xpForNextLevel,
    }
  }

  /** Get current level */
  getLevel(): number {
    return this.loadStorage().level
  }

  /** Get current total XP */
  getXP(): number {
    return this.loadStorage().totalXP
  }

  /** Get a quest definition by ID */
  getDefinition(questId: string): QuestDefinition | undefined {
    return (
      DAILY_QUEST_POOL.find(d => d.id === questId) || WEEKLY_QUEST_POOL.find(d => d.id === questId)
    )
  }

  /** Get milliseconds remaining until daily quest refresh */
  getDailyTimeRemaining(now: number = Date.now()): number {
    const storage = this.loadStorage()
    if (storage.lastDailyRefresh === 0) return 0
    const nextRefresh = storage.lastDailyRefresh + MS_PER_DAY
    return Math.max(0, nextRefresh - now)
  }

  /** Get milliseconds remaining until weekly quest refresh */
  getWeeklyTimeRemaining(now: number = Date.now()): number {
    const storage = this.loadStorage()
    if (storage.lastWeeklyRefresh === 0) return 0
    const nextRefresh = storage.lastWeeklyRefresh + MS_PER_WEEK
    return Math.max(0, nextRefresh - now)
  }

  /** Reset all quest data (for testing or user reset) */
  resetQuests(): void {
    this.storage = createDefaultStorage()
    this.saveStorage()
  }

  /** Get all daily quest definitions (for testing) */
  getDailyQuestPool(): QuestDefinition[] {
    return [...DAILY_QUEST_POOL]
  }

  /** Get all weekly quest definitions (for testing) */
  getWeeklyQuestPool(): QuestDefinition[] {
    return [...WEEKLY_QUEST_POOL]
  }
}

export const questService = new QuestService()
