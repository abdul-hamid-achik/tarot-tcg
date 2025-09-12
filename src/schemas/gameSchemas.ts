import { z } from 'zod'

// Enum schemas
export const ZodiacClassSchema = z.enum([
  'aries', 'taurus', 'gemini', 'cancer',
  'leo', 'virgo', 'libra', 'scorpio',
  'sagittarius', 'capricorn', 'aquarius', 'pisces'
])

export const ElementSchema = z.enum(['fire', 'earth', 'air', 'water'])

export const RaritySchema = z.enum(['common', 'uncommon', 'rare', 'legendary', 'mythic'])

export const SpellTypeSchema = z.enum(['instant', 'ritual', 'enchantment'])

export const TargetTypeSchema = z.enum(['self', 'ally', 'enemy', 'any', 'all'])

export const CardTypeSchema = z.enum(['unit', 'spell'])

export const CardPositionSchema = z.enum(['bench', 'attacking', 'defending'])

export const PhaseSchema = z.enum([
  'mulligan', 'action', 'declare_attackers', 
  'declare_defenders', 'combat', 'end_round'
])

export const PlayerIdSchema = z.enum(['player1', 'player2'])

// Grid position schemas
export const GridRowSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3)
])

export const GridColSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5)
])

export const CellPositionSchema = z.object({
  row: GridRowSchema,
  col: GridColSchema
})

// Object schemas
export const AbilitySchema = z.object({
  name: z.string(),
  description: z.string(),
  cost: z.number().optional(),
  cooldown: z.number().optional(),
  active: z.boolean().optional()
})

export const SpellEffectSchema = z.object({
  name: z.string(),
  description: z.string(),
  target: TargetTypeSchema.optional(),
  duration: z.number().optional()
})

export const StatusEffectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  duration: z.number(),
  source: z.string().optional(),
  stackable: z.boolean().optional(),
  stacks: z.number().optional()
})

export const CardSchema = z.object({
  id: z.string(),
  name: z.string(),
  cost: z.number(),
  attack: z.number(),
  health: z.number(),
  currentHealth: z.number().optional(),
  type: CardTypeSchema,
  description: z.string().optional(),
  reversedDescription: z.string().optional(), // Different effect when reversed
  tarotSymbol: z.string().optional(),
  position: CardPositionSchema.optional(),
  isReversed: z.boolean().optional(), // Critical tarot mechanic
  
  // Zodiac system properties
  zodiacClass: ZodiacClassSchema,
  element: ElementSchema,
  rarity: RaritySchema,
  keywords: z.array(z.string()).optional(),
  abilities: z.array(AbilitySchema).optional(),
  
  // Spell-specific properties
  spellType: SpellTypeSchema.optional(),
  effects: z.array(SpellEffectSchema).optional(),
  
  // Runtime state
  statusEffects: z.array(StatusEffectSchema).optional(),
  counters: z.record(z.string(), z.number()).optional()
})

export const CardMetadataSchema = z.object({
  id: z.string(),
  name: z.string(),
  zodiacClass: ZodiacClassSchema,
  element: ElementSchema,
  type: CardTypeSchema,
  cost: z.number(),
  attack: z.number().optional(),
  health: z.number().optional(),
  rarity: RaritySchema,
  tarotSymbol: z.string(),
  keywords: z.array(z.string()).optional(),
  abilities: z.array(AbilitySchema).optional(),
  spellType: SpellTypeSchema.optional(),
  effects: z.array(SpellEffectSchema).optional()
})

export const CardDataSchema = z.object({
  metadata: CardMetadataSchema,
  content: z.string(),
  filepath: z.string()
})

export const LaneSchema = z.object({
  id: z.number(),
  attacker: CardSchema.nullable(),
  defender: CardSchema.nullable()
})

export const PlayerSchema = z.object({
  id: z.string(),
  name: z.string(),
  health: z.number(),
  mana: z.number(),
  maxMana: z.number(),
  spellMana: z.number(),
  hand: z.array(CardSchema),
  deck: z.array(CardSchema),
  bench: z.array(CardSchema),
  hasAttackToken: z.boolean(),
  mulliganComplete: z.boolean(),
  selectedForMulligan: z.array(z.string()),
  hasPassed: z.boolean(),
  actionsThisTurn: z.number()
})

export const GameStateSchema = z.object({
  round: z.number(),
  turn: z.number(),
  activePlayer: PlayerIdSchema,
  attackingPlayer: PlayerIdSchema.nullable(),
  player1: PlayerSchema,
  player2: PlayerSchema,
  lanes: z.array(LaneSchema),
  phase: PhaseSchema,
  waitingForAction: z.boolean(),
  combatResolved: z.boolean()
})

// Type inference
export type ZodiacClass = z.infer<typeof ZodiacClassSchema>
export type Element = z.infer<typeof ElementSchema>
export type Rarity = z.infer<typeof RaritySchema>
export type SpellType = z.infer<typeof SpellTypeSchema>
export type TargetType = z.infer<typeof TargetTypeSchema>
export type CardType = z.infer<typeof CardTypeSchema>
export type CardPosition = z.infer<typeof CardPositionSchema>
export type Phase = z.infer<typeof PhaseSchema>
export type PlayerId = z.infer<typeof PlayerIdSchema>
export type GridRow = z.infer<typeof GridRowSchema>
export type GridCol = z.infer<typeof GridColSchema>
export type CellPosition = z.infer<typeof CellPositionSchema>
export type Ability = z.infer<typeof AbilitySchema>
export type SpellEffect = z.infer<typeof SpellEffectSchema>
export type StatusEffect = z.infer<typeof StatusEffectSchema>
export type Card = z.infer<typeof CardSchema>
export type CardMetadata = z.infer<typeof CardMetadataSchema>
export type CardData = z.infer<typeof CardDataSchema>
export type Lane = z.infer<typeof LaneSchema>
export type Player = z.infer<typeof PlayerSchema>
export type GameState = z.infer<typeof GameStateSchema>

// Parse helper functions
export const parseGridPosition = (row: number, col: number): CellPosition => {
  return CellPositionSchema.parse({ row, col })
}

export const parseCard = (data: unknown): Card => {
  return CardSchema.parse(data)
}

export const parseGameState = (data: unknown): GameState => {
  return GameStateSchema.parse(data)
}

export const parseCardMetadata = (data: unknown): CardMetadata => {
  return CardMetadataSchema.parse(data)
}

// Safe parse helper functions
export const safeParseGridPosition = (row: number, col: number) => {
  return CellPositionSchema.safeParse({ row, col })
}

export const safeParseCard = (data: unknown) => {
  return CardSchema.safeParse(data)
}

export const safeParseGameState = (data: unknown) => {
  return GameStateSchema.safeParse(data)
}

// Type guard helpers using Zod
export const isValidGameState = (gameState: unknown): gameState is GameState => {
  return GameStateSchema.safeParse(gameState).success
}

export const isValidCard = (card: unknown): card is Card => {
  return CardSchema.safeParse(card).success
}

export const isValidPlayer = (player: unknown): player is Player => {
  return PlayerSchema.safeParse(player).success
}

// Null-safe accessor helpers with Zod validation
export const getGameStatePhase = (gameState: unknown): Phase | null => {
  if (!isValidGameState(gameState)) return null
  return gameState.phase
}

export const getPlayer = (gameState: unknown, playerId: 'player1' | 'player2'): Player | null => {
  if (!isValidGameState(gameState)) return null
  return gameState[playerId]
}

export const getPlayerHand = (gameState: unknown, playerId: 'player1' | 'player2'): Card[] => {
  const player = getPlayer(gameState, playerId)
  return player?.hand || []
}

export const getPlayerBench = (gameState: unknown, playerId: 'player1' | 'player2'): Card[] => {
  const player = getPlayer(gameState, playerId)
  return player?.bench || []
}

// Phase checking helpers
export const isPhase = (gameState: unknown, phase: Phase): boolean => {
  return getGameStatePhase(gameState) === phase
}

export const isActionPhase = (gameState: unknown): boolean => {
  return isPhase(gameState, 'action')
}

export const isMulliganPhase = (gameState: unknown): boolean => {
  return isPhase(gameState, 'mulligan')
}

export const isCombatPhase = (gameState: unknown): boolean => {
  return isPhase(gameState, 'combat')
}

export const isDefendersPhase = (gameState: unknown): boolean => {
  return isPhase(gameState, 'declare_defenders')
}

// Player state helpers
export const isPlayerActive = (gameState: unknown, playerId: 'player1' | 'player2'): boolean => {
  if (!isValidGameState(gameState)) return false
  return gameState.activePlayer === playerId
}

export const hasAttackToken = (gameState: unknown, playerId: 'player1' | 'player2'): boolean => {
  const player = getPlayer(gameState, playerId)
  return player?.hasAttackToken || false
}

export const isMulliganComplete = (gameState: unknown, playerId: 'player1' | 'player2'): boolean => {
  const player = getPlayer(gameState, playerId)
  return player?.mulliganComplete || false
}