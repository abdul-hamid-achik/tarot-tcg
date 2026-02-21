import { z } from 'zod'

// ================================
// QUEST SYSTEM SCHEMAS
// ================================

export const QuestCategorySchema = z.enum([
  'win',
  'damage',
  'cards',
  'units',
  'spells',
  'difficulty',
  'zodiac',
])

export type QuestCategory = z.infer<typeof QuestCategorySchema>

export const QuestTypeSchema = z.enum(['daily', 'weekly'])

export type QuestType = z.infer<typeof QuestTypeSchema>

export const QuestDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  icon: z.string(),
  type: QuestTypeSchema,
  category: QuestCategorySchema,
  targetValue: z.number(),
  rewardXP: z.number(),
})

export type QuestDefinition = z.infer<typeof QuestDefinitionSchema>

export const QuestProgressSchema = z.object({
  questId: z.string(),
  currentValue: z.number(),
  targetValue: z.number(),
  completed: z.boolean(),
  completedAt: z.number().nullable(),
  claimed: z.boolean(),
})

export type QuestProgress = z.infer<typeof QuestProgressSchema>

export const QuestStorageSchema = z.object({
  version: z.number(),
  dailyQuests: z.array(QuestProgressSchema),
  weeklyQuests: z.array(QuestProgressSchema),
  lastDailyRefresh: z.number(),
  lastWeeklyRefresh: z.number(),
  totalXP: z.number(),
  level: z.number(),
})

export type QuestStorage = z.infer<typeof QuestStorageSchema>
