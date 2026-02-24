// ================================
// STRUCTURED ABILITY PARSER
// ================================
// Replaces fragile regex matching in card_effect_system.ts
// Parses ability description text into structured ParsedAction objects

// ================================
// TYPES
// ================================

export type ActionType =
  | 'dealDamage'
  | 'gainHealth'
  | 'drawCards'
  | 'statBuff'
  | 'discardCards'
  | 'summonUnit'
  | 'destroyUnit'
  | 'gainMana'
  | 'healAllUnits'
  | 'damageAllUnits'
  | 'buffAllUnits'
  | 'destroyAllUnits'
  | 'addKeyword'

export type TargetType =
  | 'self'
  | 'player'
  | 'opponent'
  | 'all_friendly'
  | 'all_enemy'
  | 'all_units'
  | 'any_target'

export type DurationType = 'permanent' | 'this_turn' | 'end_of_turn' | number

export type TriggerType =
  | 'on_play'
  | 'start_of_turn'
  | 'end_of_turn'
  | 'on_attack'
  | 'on_death'
  | 'passive'

export interface ParsedAction {
  type: ActionType
  amount?: number
  target?: TargetType
  statModifiers?: { attack?: number; health?: number }
  keyword?: string
  condition?: string
  duration?: DurationType
}

export interface ParsedAbility {
  trigger: TriggerType
  actions: ParsedAction[]
  isCompound: boolean
}

// ================================
// WORD-TO-NUMBER MAP
// ================================

const WORD_NUMBERS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
}

// ================================
// TRIGGER PARSING
// ================================

interface TriggerParseResult {
  trigger: TriggerType
  remainingText: string
}

const TRIGGER_PATTERNS: Array<{ pattern: RegExp; trigger: TriggerType }> = [
  { pattern: /^when (?:this )?(?:is )?played,?\s*/i, trigger: 'on_play' },
  { pattern: /^when (?:this )?(?:is )?summoned,?\s*/i, trigger: 'on_play' },
  { pattern: /^battlecry:?\s*/i, trigger: 'on_play' },
  { pattern: /^on play:?\s*/i, trigger: 'on_play' },
  // end_of_turn MUST come before start_of_turn to avoid "end" being swallowed by generic pattern
  { pattern: /^at the end of (?:your|each(?: player's)?)\s+turn,?\s*/i, trigger: 'end_of_turn' },
  {
    pattern: /^at the start of (?:your|each(?: player's)?)\s+turn,?\s*/i,
    trigger: 'start_of_turn',
  },
  { pattern: /^when this (?:unit )?attacks?,?\s*/i, trigger: 'on_attack' },
  { pattern: /^when attacking,?\s*/i, trigger: 'on_attack' },
  { pattern: /^on attack:?\s*/i, trigger: 'on_attack' },
  { pattern: /^when this (?:unit )?dies?,?\s*/i, trigger: 'on_death' },
  { pattern: /^deathrattle:?\s*/i, trigger: 'on_death' },
  { pattern: /^on death:?\s*/i, trigger: 'on_death' },
]

function parseTrigger(description: string): TriggerParseResult {
  const text = description.trim()

  for (const { pattern, trigger } of TRIGGER_PATTERNS) {
    const match = text.match(pattern)
    if (match) {
      return {
        trigger,
        remainingText: text.slice(match[0].length).trim(),
      }
    }
  }

  // No trigger found - default to on_play
  return {
    trigger: 'on_play',
    remainingText: text,
  }
}

// ================================
// TARGET PARSING
// ================================

function parseTarget(text: string): TargetType | undefined {
  const lower = text.toLowerCase()

  // Check compound/broadest targets first (most specific patterns first)
  if (/all (?:units|characters|minions) and players/i.test(lower)) return 'all_units'
  // "all units including friendly" means all_units, not all_friendly
  if (/all (?:units|characters|minions) including/i.test(lower)) return 'all_units'
  if (/all (?:friendly|allied|your) (?:units|characters|minions)/i.test(lower))
    return 'all_friendly'
  if (/(?:your|friendly|allied) (?:other )?(?:units|characters|minions)/i.test(lower))
    return 'all_friendly'
  if (/all enem(?:y|ies) (?:units|characters|minions)/i.test(lower)) return 'all_enemy'
  if (/(?:enemy|opponent'?s?) (?:units|characters|minions)/i.test(lower)) return 'all_enemy'
  if (/all (?:units|characters|minions)/i.test(lower)) return 'all_units'
  if (/any target/i.test(lower)) return 'any_target'
  if (/(?:your|the) hero/i.test(lower)) return 'player'
  if (/yourself/i.test(lower)) return 'player'
  if (/your player/i.test(lower)) return 'player'
  if (/this unit/i.test(lower)) return 'self'
  if (/enemy hero/i.test(lower)) return 'opponent'
  if (/(?:target )?opponent/i.test(lower)) return 'opponent'
  if (/(?:each|all) players?/i.test(lower)) return 'all_units'
  if (/(?:target )?(?:enemy )?(?:unit|character|minion)\b/i.test(lower)) return 'any_target'

  return undefined
}

// ================================
// DURATION PARSING
// ================================

function parseDuration(text: string): DurationType | undefined {
  const lower = text.toLowerCase()

  if (/this turn/i.test(lower)) return 'this_turn'
  if (/until end of turn/i.test(lower)) return 'end_of_turn'

  const turnsMatch = lower.match(/for (?:the next )?(\d+|one|two|three|four|five) turns?/i)
  if (turnsMatch) {
    const num = Number.parseInt(turnsMatch[1], 10)
    return Number.isNaN(num) ? WORD_NUMBERS[turnsMatch[1].toLowerCase()] || 1 : num
  }

  if (/permanently/i.test(lower)) return 'permanent'

  return undefined
}

// ================================
// NUMBER EXTRACTION
// ================================

function extractNumber(text: string): number | undefined {
  // Try digit first
  const digitMatch = text.match(/(\d+)/)
  if (digitMatch) {
    return Number.parseInt(digitMatch[1], 10)
  }

  // Try word numbers
  const lower = text.toLowerCase()
  for (const [word, num] of Object.entries(WORD_NUMBERS)) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(lower)) {
      return num
    }
  }

  return undefined
}

// ================================
// STAT MODIFIER PARSING (+X/+Y patterns)
// ================================

function parseStatModifiers(text: string): { attack?: number; health?: number } | undefined {
  // Match +X/+Y pattern
  const slashMatch = text.match(/\+(\d+)\/\+(\d+)/i)
  if (slashMatch) {
    return {
      attack: Number.parseInt(slashMatch[1], 10),
      health: Number.parseInt(slashMatch[2], 10),
    }
  }

  // Match "+X attack and +Y health" pattern
  const verboseMatch = text.match(/\+(\d+)\s*attack\s*(?:and)?\s*\+(\d+)\s*health/i)
  if (verboseMatch) {
    return {
      attack: Number.parseInt(verboseMatch[1], 10),
      health: Number.parseInt(verboseMatch[2], 10),
    }
  }

  // Match "+0/+Y" pattern (health only)
  const healthOnlySlash = text.match(/\+0\/\+(\d+)/i)
  if (healthOnlySlash) {
    return {
      attack: 0,
      health: Number.parseInt(healthOnlySlash[1], 10),
    }
  }

  // Match lone "+X attack" pattern
  const attackOnly = text.match(/\+(\d+)\s*(?:\/\+0|attack)/i)
  if (attackOnly) {
    return {
      attack: Number.parseInt(attackOnly[1], 10),
      health: 0,
    }
  }

  // Match lone "+Y health" pattern
  const healthOnly = text.match(/\+(\d+)\s*health/i)
  if (healthOnly) {
    return {
      attack: 0,
      health: Number.parseInt(healthOnly[1], 10),
    }
  }

  return undefined
}

// ================================
// KEYWORD PARSING
// ================================

const KNOWN_KEYWORDS = [
  'taunt',
  'lifesteal',
  'divine shield',
  'ethereal',
  'rush',
  'charge',
  'stealth',
  'elusive',
  'eternal',
  'rally',
  'mystic ward',
  'veil of illusion',
]

function parseKeyword(text: string): string | undefined {
  const lower = text.toLowerCase()
  for (const keyword of KNOWN_KEYWORDS) {
    if (lower.includes(keyword)) {
      return keyword
    }
  }
  // Match "gain 'X'" pattern for quoted keywords
  const quotedMatch = text.match(/gain\s+['"]([^'"]+)['"]/i)
  if (quotedMatch) {
    return quotedMatch[1].toLowerCase()
  }
  return undefined
}

// ================================
// ACTION PATTERN MATCHING
// ================================

interface ActionPattern {
  /** Test if this pattern matches the text fragment */
  test: (text: string) => boolean
  /** Parse the text fragment into a ParsedAction */
  parse: (text: string) => ParsedAction | null
}

const ACTION_PATTERNS: ActionPattern[] = [
  // --- DESTROY ALL UNITS ---
  {
    test: text => /destroy all (?:units|characters|minions)/i.test(text),
    parse: text => ({
      type: 'destroyAllUnits',
      target: 'all_units',
      duration: parseDuration(text),
    }),
  },

  // --- DESTROY TARGET UNIT ---
  {
    test: text =>
      /destroy (?:target|a|an) (?:unit|character|minion)/i.test(text) && !/destroy all/i.test(text),
    parse: text => ({
      type: 'destroyUnit',
      target: parseTarget(text) || 'any_target',
      duration: parseDuration(text),
    }),
  },

  // --- DEAL X DAMAGE TO ALL UNITS (+ possibly players) ---
  {
    test: text =>
      /deal \d+ damage to all/i.test(text) ||
      /deal \d+ damage to (?:all )?(?:units|characters|minions)/i.test(text),
    parse: text => {
      const amount = extractNumber(text.match(/deal (\d+) damage/i)?.[0] || text)
      const target = parseTarget(text) || 'all_units'
      return {
        type: 'damageAllUnits',
        amount: amount || 1,
        target,
        duration: parseDuration(text),
      }
    },
  },

  // --- DEAL X DAMAGE TO [target] ---
  {
    test: text => /deal \d+ damage/i.test(text) && !/deal \d+ damage to all/i.test(text),
    parse: text => {
      const amountMatch = text.match(/deal (\d+) damage/i)
      const amount = amountMatch ? Number.parseInt(amountMatch[1], 10) : 1
      const target = parseTarget(text) || 'opponent'
      return {
        type: 'dealDamage',
        amount,
        target,
        duration: parseDuration(text),
      }
    },
  },

  // --- TAKE X DAMAGE (self-damage) ---
  {
    test: text => /take (\d+) damage/i.test(text),
    parse: text => {
      const amountMatch = text.match(/take (\d+) damage/i)
      const amount = amountMatch ? Number.parseInt(amountMatch[1], 10) : 1
      return {
        type: 'dealDamage',
        amount,
        target: 'self',
      }
    },
  },

  // --- FRIENDLY/ALL UNITS LOSE X HEALTH (must come before generic "lose X health") ---
  {
    test: text =>
      /(?:all )?(?:friendly|your|allied) (?:units|characters|minions) lose (\d+) health/i.test(
        text,
      ),
    parse: text => {
      const match = text.match(/lose (\d+) health/i)
      return {
        type: 'damageAllUnits',
        amount: match ? Number.parseInt(match[1], 10) : 1,
        target: 'all_friendly',
      }
    },
  },

  // --- LOSE X HEALTH (self-damage, only when NOT preceded by units) ---
  {
    test: text =>
      /(?:you )?lose (\d+) health/i.test(text) && !/(?:units|characters|minions) lose/i.test(text),
    parse: text => {
      const amountMatch = text.match(/lose (\d+) health/i)
      const amount = amountMatch ? Number.parseInt(amountMatch[1], 10) : 1
      return {
        type: 'dealDamage',
        amount,
        target: 'player',
      }
    },
  },

  // --- HEAL ALL FRIENDLY UNITS ---
  {
    test: text =>
      /heal all (?:friendly|allied|your) (?:units|characters|minions)/i.test(text) ||
      /heal all friendly/i.test(text),
    parse: text => {
      const amount = extractNumber(text)
      return {
        type: 'healAllUnits',
        amount,
        target: 'all_friendly',
        duration: parseDuration(text),
      }
    },
  },

  // --- RESTORE/HEAL/GAIN X HEALTH ---
  {
    test: text =>
      /(?:restore|heal|gain) (\d+) health/i.test(text) || /heal (?:.*?)(?:for )?(\d+)/i.test(text),
    parse: text => {
      const match =
        text.match(/(?:restore|heal|gain) (\d+) health/i) ||
        text.match(/heal (?:.*?)(?:for )?(\d+)/i)
      const amount = match ? Number.parseInt(match[1], 10) : 1
      const target = parseTarget(text)
      return {
        type: 'gainHealth',
        amount,
        target: target || 'player',
        duration: parseDuration(text),
      }
    },
  },

  // --- BUFF ALL FRIENDLY UNITS +X/+Y ---
  {
    test: text => {
      const hasStats = /\+\d+\/\+\d+/i.test(text) || /\+\d+\s*attack/i.test(text)
      const hasFriendly =
        /(?:all )?(?:friendly|allied|your|other) (?:units|characters|minions)/i.test(text)
      return hasStats && hasFriendly
    },
    parse: text => {
      const stats = parseStatModifiers(text)
      return {
        type: 'buffAllUnits',
        target: 'all_friendly',
        statModifiers: stats || { attack: 0, health: 0 },
        duration: parseDuration(text) || 'permanent',
      }
    },
  },

  // --- BUFF ALL ENEMY UNITS +X/+Y ---
  {
    test: text => {
      const hasStats = /\+\d+\/\+\d+/i.test(text)
      const hasEnemy = /(?:all )?enem(?:y|ies) (?:units|characters|minions)/i.test(text)
      return hasStats && hasEnemy
    },
    parse: text => {
      const stats = parseStatModifiers(text)
      return {
        type: 'buffAllUnits',
        target: 'all_enemy',
        statModifiers: stats || { attack: 0, health: 0 },
        duration: parseDuration(text) || 'permanent',
      }
    },
  },

  // --- GIVE/GAIN +X/+Y (single target stat buff) ---
  {
    test: text => {
      const hasStats = /\+\d+\/\+\d+/i.test(text) || /gain \+\d+\/\+\d+/i.test(text)
      // Exclude if it mentions "all friendly" or "all enemy" (handled above)
      const hasAllTarget =
        /(?:all )?(?:friendly|allied|your other|enem(?:y|ies)) (?:units|characters|minions)/i.test(
          text,
        )
      return hasStats && !hasAllTarget
    },
    parse: text => {
      const stats = parseStatModifiers(text)
      return {
        type: 'statBuff',
        target: parseTarget(text) || 'self',
        statModifiers: stats || { attack: 0, health: 0 },
        duration: parseDuration(text) || 'permanent',
      }
    },
  },

  // --- STAT BUFF with "+X attack" or "+X health" only ---
  {
    test: text => {
      const hasPartialStat = /\+\d+\s*(?:attack|health)/i.test(text)
      const hasFullStat = /\+\d+\/\+\d+/i.test(text)
      const hasAllTarget =
        /(?:all )?(?:friendly|allied|your other|enem(?:y|ies)) (?:units|characters|minions)/i.test(
          text,
        )
      return hasPartialStat && !hasFullStat && !hasAllTarget
    },
    parse: text => {
      const stats = parseStatModifiers(text)
      if (!stats) return null
      return {
        type: 'statBuff',
        target: parseTarget(text) || 'self',
        statModifiers: stats,
        duration: parseDuration(text) || 'permanent',
      }
    },
  },

  // --- DRAW X CARD(S) ---
  {
    test: text => /draws? (\d+|a|an|one|two|three|four|five) cards?/i.test(text),
    parse: text => {
      const digitMatch = text.match(/draws? (\d+) cards?/i)
      if (digitMatch) {
        return {
          type: 'drawCards',
          amount: Number.parseInt(digitMatch[1], 10),
        }
      }
      const wordMatch = text.match(/draws? (a|an|one|two|three|four|five) cards?/i)
      if (wordMatch) {
        return {
          type: 'drawCards',
          amount: WORD_NUMBERS[wordMatch[1].toLowerCase()] || 1,
        }
      }
      return { type: 'drawCards', amount: 1 }
    },
  },

  // --- DRAW CARDS UNTIL ---
  {
    test: text => /draws? cards? until/i.test(text),
    parse: text => {
      const amountMatch = text.match(/until (?:you|they) ha(?:ve|s) (\d+) cards?/i)
      return {
        type: 'drawCards',
        amount: amountMatch ? Number.parseInt(amountMatch[1], 10) : 5,
        condition: 'draw_until_hand_size',
      }
    },
  },

  // --- DISCARD YOUR HAND ---
  {
    test: text => /discards? (?:your|their) hand/i.test(text),
    parse: _text => ({
      type: 'discardCards',
      amount: -1, // sentinel: discard entire hand
      target: 'player',
    }),
  },

  // --- DISCARD X CARD(S) ---
  {
    test: text =>
      /discards? (\d+|a|an|one|two|three|four|five) cards?/i.test(text) &&
      !/discards? (?:your|their) hand/i.test(text),
    parse: text => {
      const digitMatch = text.match(/discards? (\d+) cards?/i)
      if (digitMatch) {
        return {
          type: 'discardCards',
          amount: Number.parseInt(digitMatch[1], 10),
        }
      }
      const wordMatch = text.match(/discards? (a|an|one|two|three|four|five) cards?/i)
      if (wordMatch) {
        return {
          type: 'discardCards',
          amount: WORD_NUMBERS[wordMatch[1].toLowerCase()] || 1,
        }
      }
      return { type: 'discardCards', amount: 1 }
    },
  },

  // --- SUMMON A X/Y TOKEN ---
  {
    test: text => /(?:summon|create) (?:a|an) (\d+)\/(\d+)/i.test(text),
    parse: text => {
      const match = text.match(/(?:summon|create) (?:a|an) (\d+)\/(\d+)/i)
      if (match) {
        return {
          type: 'summonUnit',
          statModifiers: {
            attack: Number.parseInt(match[1], 10),
            health: Number.parseInt(match[2], 10),
          },
        }
      }
      return { type: 'summonUnit' }
    },
  },

  // --- GAIN X MANA / GAIN X SPELL MANA ---
  {
    test: text => /gain (\d+) (?:spell )?mana/i.test(text),
    parse: text => {
      const match = text.match(/gain (\d+) (?:spell )?mana/i)
      return {
        type: 'gainMana',
        amount: match ? Number.parseInt(match[1], 10) : 1,
      }
    },
  },

  // --- ADD KEYWORD (gain Lifesteal/Taunt/etc.) ---
  {
    test: text => {
      const lower = text.toLowerCase()
      // "gain Lifesteal" or "they gain Lifesteal" or card has "Taunt." at the start
      if (
        /(?:gain|have|grants?) ['"]?(?:lifesteal|taunt|divine shield|ethereal|rush|charge|stealth|elusive|eternal|rally|mystic ward|veil of illusion)/i.test(
          lower,
        )
      ) {
        return true
      }
      // Starts with a keyword (like "Taunt.")
      if (
        /^(?:taunt|lifesteal|divine shield|ethereal|rush|charge|stealth|elusive|eternal|rally)\.?$/i.test(
          lower.split(/[.,]/)[0].trim(),
        )
      ) {
        return true
      }
      // Gain 'Quoted keyword'
      if (/gain\s+['"][^'"]+['"]/i.test(lower)) {
        return true
      }
      return false
    },
    parse: text => {
      const keyword = parseKeyword(text)
      if (!keyword) return null
      return {
        type: 'addKeyword',
        keyword,
        target: parseTarget(text) || 'self',
        duration: parseDuration(text),
      }
    },
  },

  // --- ALL UNITS GAIN keyword ---
  {
    test: text =>
      /all (?:units|characters|minions) gain/i.test(text) && parseKeyword(text) !== undefined,
    parse: text => {
      const keyword = parseKeyword(text)
      if (!keyword) return null
      return {
        type: 'addKeyword',
        keyword,
        target: 'all_units',
        duration: parseDuration(text),
      }
    },
  },

  // --- DEAL X DAMAGE TO ALL UNITS INCLUDING FRIENDLY ---
  {
    test: text => /deal \d+ damage to all (?:units|characters|minions) including/i.test(text),
    parse: text => {
      const match = text.match(/deal (\d+) damage/i)
      return {
        type: 'damageAllUnits',
        amount: match ? Number.parseInt(match[1], 10) : 1,
        target: 'all_units',
      }
    },
  },
]

// ================================
// SENTENCE SPLITTING
// ================================

/**
 * Split compound ability text into individual action fragments.
 * Splits on ". " (period+space), "and" connecting different actions,
 * and ", " for lists that contain distinct action clauses.
 */
function splitIntoFragments(text: string): string[] {
  // First, split on ". " (period followed by space)
  const periodSplit = text.split(/\.\s+/).filter(s => s.trim().length > 0)

  const fragments: string[] = []

  for (const segment of periodSplit) {
    // Split on ", then " first (e.g., "discards a card, then draws a card")
    const thenParts = segment.split(/,\s*then\s+/i).filter(s => s.trim().length > 0)

    for (const part of thenParts) {
      // Try splitting on " and " but only when both sides look like action clauses
      // We do NOT split when "and" is part of "+X/+Y and they gain" (same action context)
      const andParts = trySplitOnAnd(part)
      fragments.push(...andParts)
    }
  }

  return fragments.map(f => f.trim().replace(/\.$/, '').trim()).filter(f => f.length > 0)
}

/**
 * Smartly split on " and " only when both sides are recognizable action clauses.
 */
function trySplitOnAnd(text: string): string[] {
  // Don't split on "and" inside "+X/+Y and" patterns (e.g., "+2/+2 and they gain Lifesteal")
  // Instead, only split when "and" separates two clearly distinct action verbs.
  const andRegex = /\band\b/gi
  let match: RegExpExecArray | null = null
  const candidates: number[] = []

  match = andRegex.exec(text)
  while (match !== null) {
    candidates.push(match.index)
    match = andRegex.exec(text)
  }

  if (candidates.length === 0) return [text]

  // For each "and" position, check if both sides start with action verbs
  const actionVerbs =
    /^(?:deals?|draws?|gains?|gives?|heals?|restores?|destroys?|discards?|summons?|creates?|takes?|loses?|they|all|your|each|returns?)/i

  for (const idx of candidates) {
    const before = text.slice(0, idx).trim()
    const after = text.slice(idx + 3).trim()

    // Skip if "and" is part of "units and players" target phrase
    if (/(?:units|characters|minions)\s*$/i.test(before) && /^(?:players?|heroes?)/i.test(after)) {
      continue
    }

    // Skip if "and" links stat parts like "+2 attack and +2 health"
    if (/\+\d+\s*(?:attack|health)?\s*$/i.test(before) && /^\+?\d+/i.test(after)) {
      continue
    }

    // Check if the after-part starts with an action verb
    if (actionVerbs.test(after)) {
      return [before, after]
    }
  }

  return [text]
}

// ================================
// MAIN PARSE FUNCTION
// ================================

/**
 * Parse an ability description string into a structured ParsedAbility.
 *
 * @param description - The raw ability description text from card MDX
 * @returns ParsedAbility with trigger, actions, and compound flag
 */
export function parseAbilityDescription(description: string): ParsedAbility {
  if (!description || typeof description !== 'string' || description.trim().length === 0) {
    return {
      trigger: 'on_play',
      actions: [],
      isCompound: false,
    }
  }

  // Step 1: Parse trigger from beginning of text
  const { trigger, remainingText } = parseTrigger(description)

  if (remainingText.length === 0) {
    return {
      trigger,
      actions: [],
      isCompound: false,
    }
  }

  // Step 2: Split remaining text into action fragments
  const fragments = splitIntoFragments(remainingText)

  // Step 3: Parse each fragment into actions
  const actions: ParsedAction[] = []

  for (const fragment of fragments) {
    const action = parseFragment(fragment)
    if (action) {
      actions.push(action)
    }
  }

  return {
    trigger,
    actions,
    isCompound: actions.length > 1,
  }
}

/**
 * Parse a single text fragment into a ParsedAction by testing against known patterns.
 */
function parseFragment(text: string): ParsedAction | null {
  for (const pattern of ACTION_PATTERNS) {
    if (pattern.test(text)) {
      const result = pattern.parse(text)
      if (result) return result
    }
  }
  return null
}
