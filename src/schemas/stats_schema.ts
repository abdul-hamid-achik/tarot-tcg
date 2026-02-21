import { z } from 'zod'

// ================================
// GAME STATISTICS SCHEMAS
// ================================

export const GameRecordSchema = z.object({
  id: z.string(),
  result: z.enum(['win', 'loss']),
  difficulty: z.enum(['tutorial', 'easy', 'normal', 'hard', 'expert']),
  deckName: z.string(),
  rounds: z.number(),
  durationSeconds: z.number(),
  cardsPlayed: z.number(),
  unitsPlayed: z.number(),
  spellsPlayed: z.number(),
  damageDealt: z.number(),
  unitsDestroyed: z.number(),
  unitsLost: z.number(),
  manaSpent: z.number(),
  uniqueCardsPlayed: z.array(z.string()),
  majorArcanaPlayed: z.array(z.string()),
  zodiacClassesUsed: z.array(z.string()),
  playerHealthRemaining: z.number(),
  opponentHealthRemaining: z.number(),
  timestamp: z.number(),
})

export type GameRecord = z.infer<typeof GameRecordSchema>

export const DifficultyRecordSchema = z.object({
  wins: z.number(),
  losses: z.number(),
})

export type DifficultyRecord = z.infer<typeof DifficultyRecordSchema>

export const PlayerStatsSchema = z.object({
  totalGames: z.number(),
  wins: z.number(),
  losses: z.number(),
  currentStreak: z.number(),
  bestStreak: z.number(),
  totalDamageDealt: z.number(),
  totalUnitsDestroyed: z.number(),
  totalUnitsLost: z.number(),
  totalCardsPlayed: z.number(),
  totalManaSpent: z.number(),
  totalPlayTimeSeconds: z.number(),
  uniqueCardsEverPlayed: z.array(z.string()),
  majorArcanaEverPlayed: z.array(z.string()),
  zodiacClassWins: z.record(z.string(), z.number()),
  difficultyRecord: z.record(z.string(), DifficultyRecordSchema),
})

export type PlayerStats = z.infer<typeof PlayerStatsSchema>

export const AchievementProgressSchema = z.object({
  id: z.string(),
  unlocked: z.boolean(),
  unlockedAt: z.number().nullable(),
  currentValue: z.number(),
  targetValue: z.number(),
  notified: z.boolean(),
})

export type AchievementProgress = z.infer<typeof AchievementProgressSchema>

export const StatsStorageSchema = z.object({
  version: z.number(),
  stats: PlayerStatsSchema,
  recentGames: z.array(GameRecordSchema),
  achievements: z.array(AchievementProgressSchema),
})

export type StatsStorage = z.infer<typeof StatsStorageSchema>
