import { z } from 'zod'

// ================================
// CHALLENGE / ARCADE MODE SCHEMAS
// ================================

export const ChallengeDifficultySchema = z.enum(['easy', 'medium', 'hard'])

export type ChallengeDifficulty = z.infer<typeof ChallengeDifficultySchema>

export const ChallengeRulesSchema = z.object({
  deckRestriction: z.string().nullable(),
  maxRounds: z.number().nullable(),
  requiredElements: z.array(z.string()).nullable(),
  requiredZodiacs: z.array(z.string()).nullable(),
  majorArcanaOnly: z.boolean(),
  startingHealth: z.number(),
  startingMana: z.number(),
  aiDifficulty: z.enum(['easy', 'normal', 'hard', 'expert']),
})

export type ChallengeRules = z.infer<typeof ChallengeRulesSchema>

export const ChallengeDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  icon: z.string(),
  difficulty: ChallengeDifficultySchema,
  rules: ChallengeRulesSchema,
  rewardDescription: z.string(),
})

export type ChallengeDefinition = z.infer<typeof ChallengeDefinitionSchema>

export const ChallengeProgressSchema = z.object({
  challengeId: z.string(),
  completed: z.boolean(),
  completedAt: z.number().nullable(),
  bestRounds: z.number().nullable(),
  bestTime: z.number().nullable(),
  attempts: z.number(),
})

export type ChallengeProgress = z.infer<typeof ChallengeProgressSchema>

export const ChallengeStorageSchema = z.object({
  version: z.number(),
  progress: z.array(ChallengeProgressSchema),
})

export type ChallengeStorage = z.infer<typeof ChallengeStorageSchema>
