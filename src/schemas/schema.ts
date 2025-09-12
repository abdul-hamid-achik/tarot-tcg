import { z } from 'zod'

// ================================
// CORE GAME SCHEMAS
// ================================

// Enum schemas
export const ZodiacClassSchema = z.enum([
  'aries',
  'taurus',
  'gemini',
  'cancer',
  'leo',
  'virgo',
  'libra',
  'scorpio',
  'sagittarius',
  'capricorn',
  'aquarius',
  'pisces',
])

export const ElementSchema = z.enum(['fire', 'earth', 'air', 'water'])

export const RaritySchema = z.enum(['common', 'uncommon', 'rare', 'legendary', 'mythic'])

export const SpellTypeSchema = z.enum(['instant', 'ritual', 'enchantment'])

export const TargetTypeSchema = z.enum(['self', 'ally', 'enemy', 'any', 'all'])

export const CardTypeSchema = z.enum(['unit', 'spell'])

export const CardPositionSchema = z.enum(['bench', 'attacking', 'defending'])

export const PhaseSchema = z.enum([
  'mulligan',
  'action',
  'declare_attackers',
  'declare_defenders',
  'combat',
  'end_round',
])

export const PlayerIdSchema = z.enum(['player1', 'player2'])

// Grid position schemas
export const GridRowSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)])

export const GridColSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
])

export const CellPositionSchema = z.object({
  row: GridRowSchema,
  col: GridColSchema,
})

// Object schemas
export const AbilitySchema = z.object({
  name: z.string(),
  description: z.string(),
  cost: z.number().optional(),
  cooldown: z.number().optional(),
  active: z.boolean().optional(),
})

export const SpellEffectSchema = z.object({
  name: z.string(),
  description: z.string(),
  target: TargetTypeSchema.optional(),
  duration: z.number().optional(),
})

export const StatusEffectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  duration: z.number(),
  source: z.string().optional(),
  stackable: z.boolean().optional(),
  stacks: z.number().optional(),
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
  counters: z.record(z.string(), z.number()).optional(),
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
  effects: z.array(SpellEffectSchema).optional(),
})

export const CardDataSchema = z.object({
  metadata: CardMetadataSchema,
  content: z.string(),
  filepath: z.string(),
})

export const LaneSchema = z.object({
  id: z.number(),
  attacker: CardSchema.nullable(),
  defender: CardSchema.nullable(),
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
  actionsThisTurn: z.number(),
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
  combatResolved: z.boolean(),
})

// ================================
// GAME EVENTS SCHEMAS
// ================================

export const GameEventTypeSchema = z.enum([
  // Turn events
  'turn_start',
  'turn_end',
  'round_start',
  'round_end',
  // Card events
  'card_drawn',
  'card_played',
  'card_discarded',
  'card_destroyed',
  'card_returned_to_hand',
  'card_shuffled_into_deck',
  // Unit events
  'unit_summoned',
  'unit_enters_battlefield',
  'unit_leaves_battlefield',
  'unit_dies',
  'unit_attacks',
  'unit_defends',
  'unit_dealt_damage',
  'unit_healed',
  'unit_stat_changed',
  // Combat events
  'combat_declared',
  'attackers_declared',
  'defenders_declared',
  'combat_damage_calculated',
  'combat_damage_dealt',
  'combat_resolved',
  // Player events
  'player_loses_health',
  'player_gains_health',
  'player_gains_mana',
  'player_loses_mana',
  'mana_refilled',
  // Game state events
  'phase_changed',
  'game_started',
  'game_ended',
  'effect_triggered',
  'ability_activated',
])

export const EventSourceSchema = z.object({
  type: z.enum(['card', 'player', 'system']),
  id: z.string(),
  name: z.string().optional(),
})

export const EventTargetSchema = z.object({
  type: z.enum(['card', 'player', 'zone', 'lane']),
  id: z.string(),
  name: z.string().optional(),
})

export const CardEventDataSchema = z.object({
  cardId: z.string(),
  cardName: z.string(),
  cost: z.number().optional(),
  position: z.string().optional(),
  fromZone: z.string().optional(),
  toZone: z.string().optional(),
  stats: z
    .object({
      attack: z.number().optional(),
      health: z.number().optional(),
      currentHealth: z.number().optional(),
    })
    .optional(),
  previousStats: z
    .object({
      attack: z.number().optional(),
      health: z.number().optional(),
      currentHealth: z.number().optional(),
    })
    .optional(),
})

export const CombatEventDataSchema = z.object({
  laneId: z.number().optional(),
  attackerId: z.string().optional(),
  defenderId: z.string().optional(),
  damage: z.number().optional(),
  isLethal: z.boolean().optional(),
  combatResults: z
    .object({
      attackerDied: z.boolean(),
      defenderDied: z.boolean(),
      damageToAttacker: z.number(),
      damageToDefender: z.number(),
      nexusDamage: z.number(),
    })
    .optional(),
})

export const PlayerEventDataSchema = z.object({
  playerId: PlayerIdSchema,
  amount: z.number().optional(),
  reason: z.string().optional(),
  previousValue: z.number().optional(),
  newValue: z.number().optional(),
  resourceType: z.enum(['health', 'mana', 'spellMana']).optional(),
})

export const PhaseEventDataSchema = z.object({
  fromPhase: z.string(),
  toPhase: z.string(),
  reason: z.string().optional(),
})

export const GenericEventDataSchema = z.record(z.string(), z.any())

export const EventDataSchema = z.union([
  CardEventDataSchema,
  CombatEventDataSchema,
  PlayerEventDataSchema,
  PhaseEventDataSchema,
  GenericEventDataSchema,
])

export const GameEventSchema = z.object({
  id: z.string(),
  type: GameEventTypeSchema,
  timestamp: z.number(),
  gameStateId: z.string(),

  // Event participants
  source: EventSourceSchema.optional(),
  target: EventTargetSchema.optional(),

  // Event data
  data: EventDataSchema,

  // Context
  phase: z.string(),
  activePlayer: PlayerIdSchema,
  turn: z.number(),
  round: z.number(),
})

export const EventFilterSchema = z.object({
  types: z.array(GameEventTypeSchema).optional(),
  source: z
    .object({
      type: z.enum(['card', 'player', 'system']).optional(),
      id: z.string().optional(),
    })
    .optional(),
  target: z
    .object({
      type: z.enum(['card', 'player', 'zone', 'lane']).optional(),
      id: z.string().optional(),
    })
    .optional(),
  condition: z.function().optional(),
})

export const EventListenerSchema = z.function()

export const EventSubscriptionSchema = z.object({
  id: z.string(),
  filter: EventFilterSchema,
  listener: EventListenerSchema,
  priority: z.number(),
  once: z.boolean().optional(),
})

export const TriggerConditionSchema = z.object({
  event: z.union([GameEventTypeSchema, z.array(GameEventTypeSchema)]),
  filter: z.function().optional(),
  source: z.enum(['self', 'any', 'ally', 'enemy']).optional(),
  target: z.enum(['self', 'any', 'ally', 'enemy']).optional(),
})

export const ResourceCostSchema = z.object({
  type: z.enum(['mana', 'spellMana', 'health', 'card', 'custom']),
  amount: z.number(),
  source: z.enum(['self', 'controller']).optional(),
})

export const TargetRequirementSchema = z.object({
  type: z.enum(['card', 'player', 'lane']),
  filter: z.function().optional(),
  required: z.boolean(),
  count: z.union([z.number(), z.literal('any'), z.literal('all')]),
})

export const EffectContextSchema = z.object({
  gameState: GameStateSchema,
  source: CardSchema,
  event: GameEventSchema.optional(),
  targets: z
    .array(
      z.object({
        type: z.enum(['card', 'player', 'lane']),
        id: z.string(),
        entity: z.any(),
      }),
    )
    .optional(),
})

export const EffectResultSchema = z.object({
  success: z.boolean(),
  newGameState: GameStateSchema.optional(),
  events: z.array(GameEventSchema).optional(),
  message: z.string().optional(),
  error: z.string().optional(),
})

export const CardEffectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  type: z.enum(['instant', 'persistent', 'triggered']),

  // Effect execution
  execute: z.function(),

  // Conditions
  canExecute: z.function().optional(),

  // Targeting
  targets: z.array(TargetRequirementSchema).optional(),

  // Timing
  timing: z.enum(['immediate', 'end_of_turn', 'start_of_turn']).optional(),

  // Duration for persistent effects
  duration: z
    .union([
      z.literal('permanent'),
      z.literal('end_of_turn'),
      z.literal('until_leaves_battlefield'),
      z.number(),
    ])
    .optional(),
})

export const TriggeredAbilitySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  trigger: TriggerConditionSchema,
  effect: CardEffectSchema,
  optional: z.boolean().optional(),
  cost: z.array(ResourceCostSchema).optional(),
})

// ================================
// WIN CONDITIONS SCHEMAS
// ================================

export const WinConditionTypeSchema = z.enum([
  'health_depletion', // Traditional: opponent reaches 0 health
  'deck_depletion', // Mill: opponent cannot draw a card
  'card_collection', // Collect specific cards or card types
  'board_domination', // Control X units for Y turns
  'damage_accumulation', // Deal X total damage
  'mana_mastery', // Reach maximum mana with specific conditions
  'arcana_completion', // Complete a Major Arcana sequence
  'zodiac_alignment', // Have all 12 zodiac signs in play
  'elemental_balance', // Balance all 4 elements
  'card_sacrifice', // Sacrifice specific number/type of cards
  'turn_survival', // Survive until turn X
  'combo_execution', // Execute specific card combinations
  'life_gain', // Gain X total health above starting amount
  'spell_mastery', // Cast X spells in a single turn
  'reverse_dominance', // Have X reversed cards in play simultaneously
])

export const WinConditionConfigSchema = z.object({
  // Numeric thresholds
  targetAmount: z.number().optional(),
  threshold: z.number().optional(),
  duration: z.number().optional(), // turns to maintain condition

  // Card-specific requirements
  requiredCards: z.array(z.string()).optional(),
  requiredTypes: z.array(z.string()).optional(),
  requiredElements: z.array(ElementSchema).optional(),
  requiredZodiacs: z.array(z.string()).optional(),

  // Zone requirements
  targetZones: z.array(z.enum(['hand', 'bench', 'deck', 'lanes'])).optional(),

  // State requirements
  consecutiveTurns: z.boolean().optional(),
  simultaneousCondition: z.boolean().optional(),

  // Custom properties
  custom: z.record(z.string(), z.any()).optional(),
})

export const WinConditionResultSchema = z.object({
  achieved: z.boolean(),
  winner: PlayerIdSchema.optional(),
  message: z.string(),
  timestamp: z.number(),
  conditions_met: z.array(z.string()).optional(),
  conditions_remaining: z.array(z.string()).optional(),
})

export const WinConditionProgressSchema = z.object({
  current: z.number(),
  target: z.number(),
  percentage: z.number(),
  description: z.string(),
  milestones: z
    .array(
      z.object({
        value: z.number(),
        description: z.string(),
        achieved: z.boolean(),
      }),
    )
    .optional(),
})

export const WinConditionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  type: WinConditionTypeSchema,

  // Core win condition logic
  checkCondition: z.function(),

  // Progress tracking
  getProgress: z.function().optional(),

  // Event handlers for real-time updates
  eventHandlers: z.record(z.string(), z.function()).optional(),

  // Requirements
  requirements: z
    .object({
      minTurn: z.number().optional(),
      maxTurn: z.number().optional(),
      specificCards: z.array(z.string()).optional(),
      cardTypes: z.array(z.string()).optional(),
      zones: z.array(z.enum(['hand', 'bench', 'deck'])).optional(),
    })
    .optional(),

  // Configuration
  config: WinConditionConfigSchema,

  // Priority for multiple win conditions
  priority: z.number(),

  // Can this win condition be enabled/disabled during game
  toggleable: z.boolean(),

  // Does this win condition replace the default health-based win?
  replaces_default: z.boolean().optional(),
})

export const WinConditionStateSchema = z.object({
  // Active win conditions for current game
  activeConditions: z.map(z.string(), WinConditionSchema),

  // Player progress tracking
  playerProgress: z.map(PlayerIdSchema, z.map(z.string(), WinConditionProgressSchema)),

  // Historical tracking for conditions requiring duration
  conditionHistory: z.map(
    z.string(),
    z.object({
      playerId: PlayerIdSchema,
      turnsActive: z.number(),
      firstAchievedTurn: z.number(),
      lastCheckedTurn: z.number(),
    }),
  ),

  // Event counters for accumulation-based conditions
  eventCounters: z.map(z.string(), z.map(PlayerIdSchema, z.number())),

  // Game mode settings
  gameMode: z.lazy(() => WinConditionGameModeSchema),
})

export const WinConditionGameModeSchema = z.object({
  name: z.string(),
  description: z.string(),
  enabledConditions: z.array(z.string()),
  disabledConditions: z.array(z.string()),
  allowMultipleWins: z.boolean(),
  requireAllConditions: z.boolean().optional(), // Must meet ALL enabled conditions
  customRules: z.record(z.string(), z.any()).optional(),
})

// Pre-defined game modes schema
export const GameModesSchema = z.record(z.string(), WinConditionGameModeSchema)

// Win condition event types
export const WinConditionEventTypeSchema = z.enum([
  'win_condition_progress',
  'win_condition_achieved',
  'win_condition_milestone',
  'win_condition_enabled',
  'win_condition_disabled',
  'game_mode_changed',
])

export const WinConditionEventDataSchema = z.object({
  conditionId: z.string(),
  playerId: PlayerIdSchema,
  progress: WinConditionProgressSchema.optional(),
  result: WinConditionResultSchema.optional(),
  milestone: z.string().optional(),
})

// ================================
// TYPE INFERENCE
// ================================

// Core game types
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

// Game events types
export type GameEventType = z.infer<typeof GameEventTypeSchema>
export type EventSource = z.infer<typeof EventSourceSchema>
export type EventTarget = z.infer<typeof EventTargetSchema>
export type CardEventData = z.infer<typeof CardEventDataSchema>
export type CombatEventData = z.infer<typeof CombatEventDataSchema>
export type PlayerEventData = z.infer<typeof PlayerEventDataSchema>
export type PhaseEventData = z.infer<typeof PhaseEventDataSchema>
export type GenericEventData = z.infer<typeof GenericEventDataSchema>
export type EventData = z.infer<typeof EventDataSchema>
export type GameEvent = z.infer<typeof GameEventSchema>
export type EventFilter = z.infer<typeof EventFilterSchema>
export type EventListener = z.infer<typeof EventListenerSchema>
export type EventSubscription = z.infer<typeof EventSubscriptionSchema>
export type TriggerCondition = z.infer<typeof TriggerConditionSchema>
export type ResourceCost = z.infer<typeof ResourceCostSchema>
export type TargetRequirement = z.infer<typeof TargetRequirementSchema>
export type EffectContext = z.infer<typeof EffectContextSchema>
export type EffectResult = z.infer<typeof EffectResultSchema>
export type CardEffect = z.infer<typeof CardEffectSchema>
export type TriggeredAbility = z.infer<typeof TriggeredAbilitySchema>

// Win conditions types
export type WinConditionType = z.infer<typeof WinConditionTypeSchema>
export type WinConditionConfig = z.infer<typeof WinConditionConfigSchema>
export type WinConditionResult = z.infer<typeof WinConditionResultSchema>
export type WinConditionProgress = z.infer<typeof WinConditionProgressSchema>
export type WinCondition = z.infer<typeof WinConditionSchema>
export type WinConditionState = z.infer<typeof WinConditionStateSchema>
export type WinConditionGameMode = z.infer<typeof WinConditionGameModeSchema>
export type GameModes = z.infer<typeof GameModesSchema>
export type WinConditionEventType = z.infer<typeof WinConditionEventTypeSchema>
export type WinConditionEventData = z.infer<typeof WinConditionEventDataSchema>

// ================================
// PARSE HELPER FUNCTIONS
// ================================

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

export const parseGameEvent = (data: unknown): GameEvent => {
  return GameEventSchema.parse(data)
}

export const parseWinCondition = (data: unknown): WinCondition => {
  return WinConditionSchema.parse(data)
}

export const parseWinConditionResult = (data: unknown): WinConditionResult => {
  return WinConditionResultSchema.parse(data)
}

// ================================
// SAFE PARSE HELPER FUNCTIONS
// ================================

export const safeParseGridPosition = (row: number, col: number) => {
  return CellPositionSchema.safeParse({ row, col })
}

export const safeParseCard = (data: unknown) => {
  return CardSchema.safeParse(data)
}

export const safeParseGameState = (data: unknown) => {
  return GameStateSchema.safeParse(data)
}

export const safeParseGameEvent = (data: unknown) => {
  return GameEventSchema.safeParse(data)
}

export const safeParseWinCondition = (data: unknown) => {
  return WinConditionSchema.safeParse(data)
}

// ================================
// TYPE GUARD HELPERS USING ZOD
// ================================

export const isValidGameState = (gameState: unknown): gameState is GameState => {
  return GameStateSchema.safeParse(gameState).success
}

export const isValidCard = (card: unknown): card is Card => {
  return CardSchema.safeParse(card).success
}

export const isValidPlayer = (player: unknown): player is Player => {
  return PlayerSchema.safeParse(player).success
}

export const isValidGameEvent = (event: unknown): event is GameEvent => {
  return GameEventSchema.safeParse(event).success
}

export const isValidWinCondition = (condition: unknown): condition is WinCondition => {
  return WinConditionSchema.safeParse(condition).success
}

// ================================
// NULL-SAFE ACCESSOR HELPERS WITH ZOD VALIDATION
// ================================

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

// ================================
// PHASE CHECKING HELPERS
// ================================

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

// ================================
// PLAYER STATE HELPERS
// ================================

export const isPlayerActive = (gameState: unknown, playerId: 'player1' | 'player2'): boolean => {
  if (!isValidGameState(gameState)) return false
  return gameState.activePlayer === playerId
}

export const hasAttackToken = (gameState: unknown, playerId: 'player1' | 'player2'): boolean => {
  const player = getPlayer(gameState, playerId)
  return player?.hasAttackToken || false
}

export const isMulliganComplete = (
  gameState: unknown,
  playerId: 'player1' | 'player2',
): boolean => {
  const player = getPlayer(gameState, playerId)
  return player?.mulliganComplete || false
}

// ================================
// PRE-DEFINED GAME MODES
// ================================

export const GAME_MODES: GameModes = {
  standard: {
    name: 'Standard',
    description: 'Traditional health-based victory',
    enabledConditions: ['health_depletion'],
    disabledConditions: [],
    allowMultipleWins: false,
  },

  arcana_master: {
    name: 'Arcana Master',
    description: 'Win by completing Major Arcana sequence or traditional victory',
    enabledConditions: ['health_depletion', 'arcana_completion'],
    disabledConditions: [],
    allowMultipleWins: true,
  },

  zodiac_mystic: {
    name: 'Zodiac Mystic',
    description: 'Align all zodiac signs or defeat opponent traditionally',
    enabledConditions: ['health_depletion', 'zodiac_alignment'],
    disabledConditions: [],
    allowMultipleWins: true,
  },

  elemental_sage: {
    name: 'Elemental Sage',
    description: 'Master all four elements to achieve victory',
    enabledConditions: ['health_depletion', 'elemental_balance'],
    disabledConditions: [],
    allowMultipleWins: true,
  },

  mill_master: {
    name: 'Mill Master',
    description: "Win by depleting opponent's deck or health",
    enabledConditions: ['health_depletion', 'deck_depletion'],
    disabledConditions: [],
    allowMultipleWins: true,
  },

  domination: {
    name: 'Board Domination',
    description: 'Control the battlefield for sustained victory',
    enabledConditions: ['health_depletion', 'board_domination'],
    disabledConditions: [],
    allowMultipleWins: true,
  },

  survival: {
    name: 'Endurance Challenge',
    description: 'Survive until the late game while avoiding traditional defeat',
    enabledConditions: ['health_depletion', 'turn_survival'],
    disabledConditions: [],
    allowMultipleWins: true,
  },

  chaos: {
    name: 'Chaos Mode',
    description: 'Multiple win conditions active simultaneously',
    enabledConditions: [
      'health_depletion',
      'deck_depletion',
      'board_domination',
      'arcana_completion',
      'zodiac_alignment',
      'elemental_balance',
    ],
    disabledConditions: [],
    allowMultipleWins: true,
  },

  puzzle: {
    name: 'Puzzle Mode',
    description: 'Must achieve specific alternative win condition - no health victory',
    enabledConditions: ['arcana_completion', 'zodiac_alignment', 'elemental_balance'],
    disabledConditions: ['health_depletion'],
    allowMultipleWins: false,
  },
}
