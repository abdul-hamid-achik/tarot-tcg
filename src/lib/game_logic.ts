import { produce, enableMapSet } from 'immer'
import { createRandomDeck, createZodiacDeck, getAllCards } from '@/lib/card_loader'
import { declareAttack } from '@/services/combat_service'
import { GameLogger } from '@/lib/game_logger'
import type {
  Battlefield,
  Card,
  CardEffect,
  DirectAttack,
  EffectContext,
  GameState,
  Player,
  TriggeredAbility,
} from '@/schemas/schema'
import { cardEffectSystem } from '@/services/card_effect_system'
import { effectStackService } from '@/services/effect_stack_service'
import { createEventHelpers, eventManager } from '@/services/event_manager'
import { phaseManagerService } from '@/services/phase_manager_service'
import { winConditionService } from '@/services/win_condition_service'

// Enable Immer support for Map and Set
enableMapSet()

// Battlefield helper functions
function findFirstEmptySlot(battlefield: Battlefield, playerId: 'player1' | 'player2'): number {
  const units = playerId === 'player1' ? battlefield.playerUnits : battlefield.enemyUnits

  return units.indexOf(null)
}

function _placeUnitOnBattlefield(
  gameState: GameState,
  playerId: 'player1' | 'player2',
  unit: Card,
  targetSlot?: number,
): { success: boolean; slot: number | null } {
  const units =
    playerId === 'player1' ? gameState.battlefield.playerUnits : gameState.battlefield.enemyUnits

  const slot =
    targetSlot !== undefined ? targetSlot : findFirstEmptySlot(gameState.battlefield, playerId)

  if (slot === -1 || slot >= units.length || units[slot] !== null) {
    return { success: false, slot: null }
  }

  units[slot] = {
    ...unit,
    currentHealth: unit.health,
    owner: playerId,
    hasSummoningSickness: true,
    hasAttackedThisTurn: false,
  }

  return { success: true, slot }
}

function removeUnitFromBattlefield(
  gameState: GameState,
  playerId: 'player1' | 'player2',
  unitId: string,
): boolean {
  const units =
    playerId === 'player1' ? gameState.battlefield.playerUnits : gameState.battlefield.enemyUnits

  for (let i = 0; i < units.length; i++) {
    if (units[i]?.id === unitId) {
      units[i] = null
      return true
    }
  }
  return false
}

function getPlayerUnits(gameState: GameState, playerId: 'player1' | 'player2'): Card[] {
  const units =
    playerId === 'player1' ? gameState.battlefield.playerUnits : gameState.battlefield.enemyUnits
  return units.filter(u => u !== null) as Card[]
}

function _getUnitAt(
  battlefield: Battlefield,
  slot: number,
  playerId: 'player1' | 'player2',
): Card | null {
  const units = playerId === 'player1' ? battlefield.playerUnits : battlefield.enemyUnits
  return units[slot] || null
}

// Game Constants - Battlefield-only system
const GAME_CONFIG = {
  BATTLEFIELD_SLOTS: 7,
  MAX_UNITS_PER_PLAYER: 7,
  // Tarot-specific mechanics
  ORIENTATION_CHANCE: 0.5, // 50% reversed
  ZODIAC_BUFF_MULTIPLIER: 1.2,
  ELEMENTAL_SYNERGY_BONUS: 1,
  // Core game rules
  MAX_DECK_SIZE: 40,
  STARTING_DECK_SIZE: 40,
  MAX_SPELL_MANA: 3,
  MAX_MANA: 10,
  STARTING_HEALTH: 20,
  STARTING_HAND_SIZE: 4,
} as const

// Get real cards from contentlayer
let TAROT_CARDS: Card[] = []

// Initialize cards - this will be called when contentlayer is ready
export function initializeCards() {
  try {
    TAROT_CARDS = getAllCards()
  } catch {
    GameLogger.warn('Contentlayer not ready, using default cards')
    // Fallback cards if contentlayer isn't ready
    TAROT_CARDS = [
      {
        id: 'default-1',
        name: 'The Fool',
        cost: 1,
        attack: 1,
        health: 1,
        type: 'unit',
        tarotSymbol: '0',
        description: 'Beginning of journey',
        zodiacClass: 'aquarius',
        element: 'air',
        rarity: 'common',
      },
    ]
  }
  return TAROT_CARDS
}

export function createInitialGameState(
  useZodiacDeck?: string,
  gameMode: string = 'standard',
): GameState {
  // Initialize cards if not already done
  if (TAROT_CARDS.length === 0) {
    initializeCards()
  }

  // Create decks based on preference
  const player1Deck = useZodiacDeck
    ? createZodiacDeck(useZodiacDeck, GAME_CONFIG.STARTING_DECK_SIZE)
    : createRandomDeck(GAME_CONFIG.STARTING_DECK_SIZE)

  const player2Deck = createRandomDeck(GAME_CONFIG.STARTING_DECK_SIZE)

  // Ensure each card has a unique ID for the game instance
  let cardCounter = 0
  const player1Cards = player1Deck.map(card => ({
    ...card,
    id: `p1_${card.id}_${++cardCounter}`,
    currentHealth: card.health,
    isReversed: false, // Will be set when drawn
  }))

  const player2Cards = player2Deck.map(card => ({
    ...card,
    id: `p2_${card.id}_${++cardCounter}`,
    currentHealth: card.health,
    isReversed: false, // Will be set when drawn
  }))

  // Set orientation for starting hand cards
  const player1StartingHand = player1Cards.slice(0, GAME_CONFIG.STARTING_HAND_SIZE).map(card => ({
    ...card,
    isReversed: Math.random() < GAME_CONFIG.ORIENTATION_CHANCE,
  }))

  const player2StartingHand = player2Cards.slice(0, GAME_CONFIG.STARTING_HAND_SIZE).map(card => ({
    ...card,
    isReversed: Math.random() < GAME_CONFIG.ORIENTATION_CHANCE,
  }))

  const player1: Player = {
    id: 'player1',
    name: 'You',
    health: GAME_CONFIG.STARTING_HEALTH,
    mana: 1,
    maxMana: 1,
    spellMana: 0,
    hand: player1StartingHand,
    deck: player1Cards.slice(GAME_CONFIG.STARTING_HAND_SIZE),
    hasAttackToken: true, // Player 1 starts with attack token
    mulliganComplete: false,
    selectedForMulligan: [],
    hasPassed: false,
    actionsThisTurn: 0,
  }

  const player2: Player = {
    id: 'player2',
    name: 'Opponent',
    health: GAME_CONFIG.STARTING_HEALTH,
    mana: 1,
    maxMana: 1,
    spellMana: 0,
    hand: player2StartingHand,
    deck: player2Cards.slice(GAME_CONFIG.STARTING_HAND_SIZE),
    hasAttackToken: false,
    mulliganComplete: false,
    selectedForMulligan: [],
    hasPassed: false,
    actionsThisTurn: 0,
  }

  // Initialize win condition system for this game
  winConditionService.setGameMode(gameMode as 'standard')
  winConditionService.resetState()

  const gameState: GameState = {
    round: 1,
    turn: 1,
    activePlayer: 'player1',
    attackingPlayer: null,
    player1,
    player2,
    battlefield: {
      playerUnits: Array(7).fill(null),
      enemyUnits: Array(7).fill(null),
      maxSlots: 7,
    },
    phase: 'mulligan',
    waitingForAction: false,
    combatResolved: false,
    // New phase system fields
    priorityPlayer: 'player1',
    passCount: 0,
    canRespond: false,
    actionStack: [],
  }

  // Emit game start event for win condition tracking
  eventManager.emitSystemEvent('game_started', gameState, {
    gameMode,
    activeConditions: winConditionService.getActiveConditions().map(c => c.id),
  })

  return gameState
}

export function canPlayCard(state: GameState, card: Card): boolean {
  const player = state[state.activePlayer]
  const totalMana = player.mana + player.spellMana

  // Check mana
  if (card.cost > totalMana) return false

  // Check battlefield space for units
  if (card.type === 'unit') {
    const availableSlot = findFirstEmptySlot(state.battlefield, state.activePlayer)
    if (availableSlot === -1) return false
  }

  return true
}

export async function playCard(
  state: GameState,
  card: Card,
  targetSlot?: number,
): Promise<GameState> {
  const player = state[state.activePlayer]

  // Comprehensive validation
  // 1. Check if card is in player's hand (ownership validation)
  const cardInHand = player.hand.find(c => c.id === card.id)
  if (!cardInHand) {
    throw new Error(`Card ${card.name} is not in your hand`)
  }

  // 2. Check if it's the action phase
  if (state.phase !== 'action') {
    throw new Error(`Cannot play cards during ${state.phase} phase. Wait for action phase.`)
  }

  // 3. Check mana and battlefield space
  if (!canPlayCard(state, card)) {
    throw new Error('Cannot play card - insufficient resources or battlefield full')
  }

  // 4. Validate slot bounds for units
  if (card.type === 'unit' && targetSlot !== undefined) {
    if (targetSlot < 0 || targetSlot >= 7) {
      throw new Error(`Invalid slot number: ${targetSlot}. Must be between 0 and 6.`)
    }
  }

  // Use the card's existing isReversed property (set when drawn)
  const isReversed = card.isReversed || false

  // Check zodiac buff (simplified version)
  const currentMonth = new Date().getMonth() + 1
  const hasZodiacBuff = checkZodiacAlignment(card.zodiacClass, currentMonth)

  // Calculate mana usage
  const manaCost = payManaCost(player, card.cost)

  if (!manaCost) {
    throw new Error(
      `Not enough mana to play ${card.name}. Required: ${card.cost}, Available: ${player.mana + player.spellMana}`,
    )
  }

  const { manaUsed, spellManaUsed } = manaCost

  // For unit cards, determine slot before state mutation
  let finalTargetSlot = targetSlot
  if (card.type === 'unit' && finalTargetSlot === undefined) {
    finalTargetSlot = findFirstEmptySlot(state.battlefield, state.activePlayer)
    if (finalTargetSlot === -1) throw new Error('Battlefield full')
  }

  // Create unit data before state mutation (for units)
  const unit: Card | null = card.type === 'unit' ? {
    ...card,
    currentHealth: card.health,
    isReversed,
    hasSummoningSickness: true,
    hasAttackedThisTurn: false,
    owner: state.activePlayer,
    // Apply zodiac buff to stats
    attack: card.attack + (hasZodiacBuff ? 1 : 0),
    health: card.health + (hasZodiacBuff ? 1 : 0),
    astrologyBonus: hasZodiacBuff ? 1 : 0,
  } : null

  // Use Immer for deep immutable state updates - do all mutations inside produce
  let newState = produce(state, draft => {
    const draftPlayer = draft[state.activePlayer]

    // Pay mana and remove from hand
    draftPlayer.mana -= manaUsed
    draftPlayer.spellMana -= spellManaUsed
    draftPlayer.hand = draftPlayer.hand.filter(c => c.id !== card.id)

    if (unit && finalTargetSlot !== undefined) {
      // Place unit on battlefield
      const units = state.activePlayer === 'player1'
        ? draft.battlefield.playerUnits
        : draft.battlefield.enemyUnits
      units[finalTargetSlot] = unit
    }
  })

  const eventHelpers = createEventHelpers(newState)

  GameLogger.action(`${state.activePlayer} plays ${card.name}`, {
    cost: card.cost,
    manaUsed,
    spellManaUsed,
    isReversed,
    hasZodiacBuff,
    remainingMana: newState[state.activePlayer].mana,
    remainingSpellMana: newState[state.activePlayer].spellMana,
  })

  // Emit card played event
  await eventHelpers.cardPlayed(card.id, card.name, card.cost)

  if (card.type === 'unit' && unit) {
    // Emit unit summoned event
    await eventHelpers.unitSummoned(card.id, card.name, unit.attack, unit.health)

    // Select abilities based on orientation
    const orientedAbilities = isReversed
      ? (card.reversedAbilities && card.reversedAbilities.length > 0 ? card.reversedAbilities : card.abilities)
      : (card.uprightAbilities && card.uprightAbilities.length > 0 ? card.uprightAbilities : card.abilities)

    // Execute battlecry abilities (on_play triggers) through the effect system
    if (orientedAbilities && orientedAbilities.length > 0) {
      for (const ability of orientedAbilities) {
        if (ability.description) {
          const cardEffect: CardEffect = {
            id: `battlecry_${unit.id}_${ability.name || 'effect'}`,
            name: ability.name || 'Battlecry',
            description: ability.description,
            type: 'instant',
            execute: () => ({ success: false }),
          }
          const effectContext: EffectContext = {
            gameState: newState,
            source: { ...unit, owner: state.activePlayer },
          }
          const result = await cardEffectSystem.executeEffect(cardEffect, effectContext)
          if (result.success && result.newGameState) {
            newState = result.newGameState
          }
        }
      }

      // Register non-battlecry abilities (start_of_turn, on_attack, etc.) with the effect system
      const triggeredAbilities = convertAbilitiesToTriggeredAbilities(orientedAbilities)
      cardEffectSystem.registerCardAbilities(unit, triggeredAbilities)
    }
  } else if (card.type === 'spell') {
    // Select spell abilities based on orientation
    const spellAbilities = isReversed
      ? (card.reversedAbilities && card.reversedAbilities.length > 0 ? card.reversedAbilities : [])
      : (card.uprightAbilities && card.uprightAbilities.length > 0 ? card.uprightAbilities : [])

    // Execute spell abilities through the effect system
    if (spellAbilities.length > 0) {
      for (const ability of spellAbilities) {
        if (ability.description) {
          const cardEffect: CardEffect = {
            id: `spell_${card.id}_${ability.name || 'effect'}`,
            name: ability.name || card.name,
            description: ability.description,
            type: 'instant',
            execute: () => ({ success: false }),
          }
          const effectContext: EffectContext = {
            gameState: newState,
            source: { ...card, owner: state.activePlayer },
          }
          const result = await cardEffectSystem.executeEffect(cardEffect, effectContext)
          if (result.success && result.newGameState) {
            newState = result.newGameState
          }
        }
      }
    } else if (card.effects && card.effects.length > 0) {
      // Fallback to old effects array for cards without oriented abilities
      await queueSpellEffectsOnStack(newState, card.effects, state.activePlayer, card)
    }
  }

  // Resolve the effect stack after playing a card
  const stateAfterEffects = await resolveEffectStack(newState)

  return stateAfterEffects
}

// Helper functions for new playCard system
function payManaCost(
  player: Player,
  cost: number,
): { manaUsed: number; spellManaUsed: number } | null {
  const manaToUse = Math.min(player.mana, cost)
  const remainingCost = cost - manaToUse
  const spellManaToUse = Math.min(player.spellMana, remainingCost)

  // Validate we have enough total mana
  const totalAvailable = player.mana + player.spellMana
  if (totalAvailable < cost) {
    return null // Not enough mana
  }

  return { manaUsed: manaToUse, spellManaUsed: spellManaToUse }
}

function checkZodiacAlignment(zodiacClass: string, currentMonth: number): boolean {
  // Simplified zodiac alignment check
  const zodiacMonths: Record<string, number[]> = {
    aries: [3, 4],
    taurus: [4, 5],
    gemini: [5, 6],
    cancer: [6, 7],
    leo: [7, 8],
    virgo: [8, 9],
    libra: [9, 10],
    scorpio: [10, 11],
    sagittarius: [11, 12],
    capricorn: [12, 1],
    aquarius: [1, 2],
    pisces: [2, 3],
  }

  const months = zodiacMonths[zodiacClass]
  return months ? months.includes(currentMonth) : false
}

async function _applyReversedEffect(state: GameState, unit: Card): Promise<void> {
  // Apply reversed tarot effects - simplified implementation
  if (unit.reversedDescription?.toLowerCase().includes('draw')) {
    // Reversed effect: draw a card
    const player = state[unit.owner!]
    if (player.deck.length > 0) {
      const drawnCard = player.deck.shift()!
      const cardWithOrientation = {
        ...drawnCard,
        isReversed: Math.random() < GAME_CONFIG.ORIENTATION_CHANCE,
      }
      player.hand.push(cardWithOrientation)
      GameLogger.action(`${unit.name} reversed effect: draw card${cardWithOrientation.isReversed ? ' (reversed)' : ''}`)
    }
  }
}

async function _applyReversedEffectImmutable(state: GameState, unit: Card): Promise<GameState> {
  // Apply reversed tarot effects - simplified implementation with immutable state
  if (unit.reversedDescription?.toLowerCase().includes('draw')) {
    const playerId = unit.owner!
    const player = state[playerId]
    if (player.deck.length > 0) {
      const isReversed = Math.random() < GAME_CONFIG.ORIENTATION_CHANCE
      return produce(state, draft => {
        const draftPlayer = draft[playerId]
        const drawnCard = draftPlayer.deck.shift()!
        const cardWithOrientation = {
          ...drawnCard,
          isReversed,
        }
        draftPlayer.hand.push(cardWithOrientation)
        GameLogger.action(`${unit.name} reversed effect: draw card${isReversed ? ' (reversed)' : ''}`)
      })
    }
  }
  return state
}

async function _applyUprightEffect(state: GameState, unit: Card): Promise<void> {
  // Apply upright tarot effects - simplified implementation
  if (unit.description?.toLowerCase().includes('damage')) {
    // Upright effect might deal damage
    const opponent = unit.owner === 'player1' ? 'player2' : 'player1'
    state[opponent].health -= 1
    GameLogger.action(`${unit.name} upright effect: deal 1 damage`)
  }
}

async function _applyUprightEffectImmutable(state: GameState, unit: Card): Promise<GameState> {
  // Apply upright tarot effects - simplified implementation with immutable state
  if (unit.description?.toLowerCase().includes('damage')) {
    const opponent = unit.owner === 'player1' ? 'player2' : 'player1'
    return produce(state, draft => {
      draft[opponent].health -= 1
      GameLogger.action(`${unit.name} upright effect: deal 1 damage`)
    })
  }
  return state
}

// Helper function to convert old abilities to triggered abilities for the effect system
function convertAbilitiesToTriggeredAbilities(
  abilities: { name?: string; description?: string }[],
): TriggeredAbility[] {
  return abilities.map((ability, index) => ({
    id: `ability_${index}`,
    name: ability.name || `Ability ${index + 1}`,
    description: ability.description || '',
    trigger: {
      event: 'unit_enters_battlefield' as const,
      source: 'self' as const,
    },
    effect: {
      id: `ability_effect_${index}`,
      name: ability.name || `Ability Effect ${index + 1}`,
      description: ability.description || '',
      type: 'instant' as const,
      execute: (context: EffectContext) => {
        // Convert old ability logic to new effect system
        const gameState = context.gameState
        executeAbilities(
          gameState,
          [ability],
          context.source.id.startsWith('p1_') ? 'player1' : 'player2',
        )
        return { success: true, newGameState: gameState }
      },
    },
    optional: false,
  }))
}

// Helper function to queue spell effects on the stack
async function queueSpellEffectsOnStack(
  state: GameState,
  effects: { name?: string; description?: string }[],
  castingPlayer: 'player1' | 'player2',
  card: Card,
): Promise<void> {
  for (const effect of effects) {
    const cardEffect: CardEffect = {
      id: `spell_effect_${card.id}`,
      name: effect.name || 'Spell Effect',
      description: effect.description || '',
      type: 'instant',
      execute: (context: EffectContext) => {
        executeSpellEffects(context.gameState, [effect], castingPlayer)
        return { success: true, newGameState: context.gameState }
      },
    }

    const effectContext: EffectContext = {
      gameState: state,
      source: card,
    }

    // Add to effect stack instead of executing immediately
    effectStackService.addToStack(cardEffect, effectContext, {
      type: 'spell',
      sourcePlayerId: castingPlayer,
      sourceCardId: card.id,
      priority: 1000, // Standard spell priority
      canBeCountered: true,
    })
  }
}

// Helper function to execute spell effects through the event system
async function _executeSpellEffectsThroughEventSystem(
  state: GameState,
  effects: { name?: string; description?: string }[],
  castingPlayer: 'player1' | 'player2',
  card: Card,
): Promise<void> {
  for (const effect of effects) {
    const cardEffect: CardEffect = {
      id: `spell_effect_${card.id}`,
      name: effect.name || 'Spell Effect',
      description: effect.description || '',
      type: 'instant',
      execute: (context: EffectContext) => {
        executeSpellEffects(context.gameState, [effect], castingPlayer)
        return { success: true, newGameState: context.gameState }
      },
    }

    const effectContext: EffectContext = {
      gameState: state,
      source: card,
    }

    await cardEffectSystem.executeEffect(cardEffect, effectContext)
  }
}

// Execute spell effects system
function executeSpellEffects(
  state: GameState,
  effects: { name?: string; description?: string }[],
  castingPlayer: 'player1' | 'player2',
): void {
  const opponent = castingPlayer === 'player1' ? 'player2' : 'player1'

  effects.forEach(effect => {
    const description = effect.description?.toLowerCase() || ''
    const _effectName = effect.name?.toLowerCase() || ''

    // Simple pattern matching for common effects
    if (description.includes('deal') && description.includes('damage')) {
      // Extract damage amount (look for numbers)
      const damageMatch = description.match(/(\d+)\s*damage/)
      const damage = damageMatch ? parseInt(damageMatch[1], 10) : 1

      if (description.includes('any target') || description.includes('enemy')) {
        // For simplicity, deal damage to opponent's health
        state[opponent].health -= damage
      }
    }

    if (description.includes('draw') && description.includes('card')) {
      // Draw a card
      const player = state[castingPlayer]
      if (player.deck.length > 0) {
        const drawnCard = player.deck.shift()!
        const cardWithOrientation = {
          ...drawnCard,
          isReversed: Math.random() < GAME_CONFIG.ORIENTATION_CHANCE,
        }
        player.hand.push(cardWithOrientation)
      }
    }

    if (description.includes('gain') && description.includes('mana')) {
      const manaMatch = description.match(/(\d+)\s*mana/)
      const mana = manaMatch ? parseInt(manaMatch[1], 10) : 1
      state[castingPlayer].mana += mana
    }

    // Spell effects that could affect combat (future enhancement)
  })
}

// Execute unit abilities system
function executeAbilities(
  state: GameState,
  abilities: { name?: string; description?: string }[],
  owningPlayer: 'player1' | 'player2',
): void {
  const opponent = owningPlayer === 'player1' ? 'player2' : 'player1'

  abilities.forEach(ability => {
    const description = ability.description?.toLowerCase() || ''

    // Pattern matching for common abilities
    if (description.includes('destroy') && description.includes('health')) {
      const healthMatch = description.match(/(\d+)\s*or\s*less\s*health/)
      const maxHealth = healthMatch ? parseInt(healthMatch[1], 10) : 3

      // Remove enemy units with health <= maxHealth (using compatibility layer)
      const enemyUnits = getPlayerUnits(state, opponent)
      enemyUnits.forEach(unit => {
        if ((unit.currentHealth || unit.health) <= maxHealth) {
          removeUnitFromBattlefield(state, opponent, unit.id)
        }
      })
    }

    if (description.includes('cost') && description.includes('less')) {
      // This would need more complex implementation for ongoing effects
      // For now, just acknowledge the ability exists
      GameLogger.debug(`${ability.name || 'Unknown ability'} activated`)
    }
  })
}

// Combat logic is now centralized in combat_logic.ts
// declareAttack is imported above - no duplicate implementation needed

// Game outcome detection with win conditions
export function checkGameOutcome(state: GameState): 'player1_wins' | 'player2_wins' | 'ongoing' {
  // Check alternative win conditions first
  const winConditionResult = winConditionService.checkWinConditions(state)

  if (winConditionResult?.achieved && winConditionResult.winner) {
    GameLogger.state(`Game won by ${winConditionResult.winner}`, {
      winCondition: winConditionResult.message,
      method: 'alternative_win_condition',
    })
    return winConditionResult.winner === 'player1' ? 'player1_wins' : 'player2_wins'
  }

  // Fallback to traditional health-based win condition
  if (state.player1.health <= 0) {
    GameLogger.state('Game won by player2', { method: 'health_depletion' })
    return 'player2_wins'
  }
  if (state.player2.health <= 0) {
    GameLogger.state('Game won by player1', { method: 'health_depletion' })
    return 'player1_wins'
  }

  return 'ongoing'
}

// Resolve the effect stack until empty
async function resolveEffectStack(gameState: GameState): Promise<GameState> {
  try {
    // Get current stack state
    const stackState = effectStackService.getStackState()

    if (stackState.items.length === 0) {
      return gameState
    }

    GameLogger.state(`Resolving effect stack with ${stackState.items.length} items`)

    // Resolve all items on the stack
    // Note: The service needs game state, so we pass it through context
    const results = await effectStackService.resolveStack()

    if (results.resolved.length > 0) {
      GameLogger.state(`Resolved ${results.resolved.length} effects from stack`)
    }

    if (results.failed.length > 0) {
      GameLogger.state(`Failed to resolve ${results.failed.length} effects`, {
        failed: results.failed.map(f => f.effect.name),
      })
    }

    // Return the updated game state from the resolution
    return results.newGameState || gameState
  } catch (error) {
    GameLogger.error('Error resolving effect stack:', error)
    // Fallback: clear the stack to prevent infinite loops
    effectStackService.clearStack()
    return gameState
  }
}

// Get effect stack state for UI display
export function getEffectStackState() {
  // TODO: Update for battlefield system
  return {
    items: [], // effectStackService.getStackItems(),
    canRespond: false, // effectStackService.canCurrentPlayerRespond(),
    resolutionMode: false, // effectStackService.getResolutionMode(),
  }
}

// Player response to effect on stack
export async function respondToStackEffect(
  gameState: GameState,
  stackItemId: string,
  responseType: 'counter' | 'respond',
  responseCard?: Card,
): Promise<GameState> {
  try {
    if (responseType === 'counter' && responseCard) {
      // Add counter spell to stack
      const counterEffect: CardEffect = {
        id: `counter_${responseCard.id}`,
        name: responseCard.name,
        description: `Counter target spell or ability`,
        type: 'instant',
        execute: (context: EffectContext) => {
          // Counter the targeted effect from stack
          const success = effectStackService.counterEffect(stackItemId, 'player1')
          if (success) {
            GameLogger.action(`${responseCard.name} counters effect ${stackItemId}`)
          }
          return { success, newGameState: context.gameState }
        },
      }

      const effectContext: EffectContext = {
        gameState,
        source: responseCard,
      }

      effectStackService.addToStack(counterEffect, effectContext, {
        type: 'spell',
        sourcePlayerId: gameState.activePlayer,
        sourceCardId: responseCard.id,
        priority: 2000, // Higher priority than normal spells
        canBeCountered: false,
      })
    }

    return gameState
  } catch (error) {
    GameLogger.error('Error responding to stack effect:', error)
    return gameState
  }
}

// Pass priority on effect stack
export function passStackPriority(gameState: GameState): GameState {
  try {
    effectStackService.passPriority()
    GameLogger.action(`${gameState.activePlayer} passes priority`)
    return gameState
  } catch (error) {
    GameLogger.error('Error passing priority:', error)
    return gameState
  }
}

// Get win condition progress for UI display
export function getWinConditionProgress(playerId: 'player1' | 'player2') {
  return {
    progress: winConditionService.getPlayerProgress(playerId),
    activeConditions: winConditionService.getActiveConditions(),
    gameMode: winConditionService.getCurrentGameMode(),
  }
}

export async function endTurn(state: GameState): Promise<GameState> {
  const activePlayer = state.activePlayer
  const nextPlayer = activePlayer === 'player1' ? 'player2' : 'player1'
  const unspentMana = state[activePlayer].mana
  const currentTurn = state.turn + 1
  const isNewRound = currentTurn % 2 === 1
  const newRound = isNewRound ? state.round + 1 : state.round

  // Pre-calculate values needed for events
  const nextPlayerDeck = state[nextPlayer].deck
  const willDrawCard = nextPlayerDeck.length > 0
  const cardToDraw = willDrawCard ? nextPlayerDeck[0] : null
  const isReversed = willDrawCard ? Math.random() < GAME_CONFIG.ORIENTATION_CHANCE : false

  // Update persistent effects at end of turn (may return same state or new state)
  const updatedState = cardEffectSystem.updatePersistentEffects(state)

  // Use Immer for all state mutations
  const newState = produce(updatedState, draft => {
    // Reset attack flags for current player's units (they're ending their turn)
    const currentPlayerUnits = activePlayer === 'player1'
      ? draft.battlefield.playerUnits
      : draft.battlefield.enemyUnits

    for (const unit of currentPlayerUnits) {
      if (unit) {
        unit.hasAttackedThisTurn = false
      }
    }

    // CRITICAL: Clear summoning sickness for the NEXT player's units
    // This allows units to attack after their first full turn cycle
    const nextPlayerUnits = nextPlayer === 'player1'
      ? draft.battlefield.playerUnits
      : draft.battlefield.enemyUnits

    for (const unit of nextPlayerUnits) {
      if (unit) {
        unit.hasSummoningSickness = false
      }
    }

    // Store unspent mana as spell mana
    draft[activePlayer].spellMana = Math.min(
      GAME_CONFIG.MAX_SPELL_MANA,
      draft[activePlayer].spellMana + unspentMana,
    )

    // Switch active player
    draft.activePlayer = nextPlayer
    draft.turn = currentTurn

    // Handle new round
    if (isNewRound) {
      draft.round = newRound
      draft.player1.hasAttackToken = !draft.player1.hasAttackToken
      draft.player2.hasAttackToken = !draft.player2.hasAttackToken
    }

    // Refill mana for next player
    const nextPlayerRef = draft[nextPlayer]
    nextPlayerRef.maxMana = Math.min(GAME_CONFIG.MAX_MANA, draft.round)
    nextPlayerRef.mana = nextPlayerRef.maxMana

    // Draw a card
    if (willDrawCard && cardToDraw && draft[nextPlayer].deck.length > 0) {
      const drawnCard = draft[nextPlayer].deck.shift()
      if (drawnCard) {
        const cardWithOrientation = {
          ...drawnCard,
          isReversed,
        }
        draft[nextPlayer].hand.push(cardWithOrientation)
      }
    }

    // Set phase to action for the new player's turn
    draft.phase = 'action'
    draft.combatResolved = false
    draft.waitingForAction = true
  })

  // Create event helpers for the new state
  const eventHelpers = createEventHelpers(newState)

  // Log and emit events (these don't modify state)
  GameLogger.state(`${activePlayer} ends turn`, {
    unspentMana,
    newSpellMana: newState[activePlayer].spellMana,
  })

  // Emit turn end event
  await eventHelpers.turnStart(activePlayer)

  if (isNewRound) {
    // Emit round start event
    await eventManager.emitSystemEvent('round_start', newState, {
      round: newRound,
    })
  }

  // Emit mana refilled event
  await eventHelpers.playerGainsMana(nextPlayer, newState[nextPlayer].mana)

  // Emit card drawn event
  if (willDrawCard && cardToDraw) {
    await eventHelpers.cardDrawn(cardToDraw.id, cardToDraw.name)
    GameLogger.action(`${nextPlayer} draws ${cardToDraw.name}${isReversed ? ' (reversed)' : ''}`)
  }

  // Emit turn start event for new player
  await eventManager.emitSystemEvent('turn_start', newState, {
    playerId: nextPlayer,
    turn: currentTurn,
    round: newRound,
    hasAttackToken: newState[nextPlayer].hasAttackToken,
  })

  GameLogger.turnStart(nextPlayer, currentTurn, newRound, newState[nextPlayer].hasAttackToken)

  return newState
}

// Enhanced AI Strategy
export async function aiTurn(state: GameState): Promise<GameState> {
  let newState = { ...state }

  if (newState.activePlayer !== 'player2') return newState

  GameLogger.ai('AI turn started')

  const ai = newState.player2
  const _opponent = newState.player1

  // Phase 1: Play cards strategically
  const playableCards = ai.hand
    .filter(card => canPlayCard(newState, card))
    .sort((a, b) => {
      // Prioritize by value (attack + health) / cost ratio
      const aValue = (a.attack + a.health) / Math.max(1, a.cost)
      const bValue = (b.attack + b.health) / Math.max(1, b.cost)
      return bValue - aValue
    })

  // Play units until battlefield is full or mana is depleted
  const cardsPlayed: string[] = []
  for (const card of playableCards) {
    const emptySlot = findFirstEmptySlot(newState.battlefield, 'player2')
    if (card.type === 'unit' && emptySlot === -1) break // Battlefield full
    if (canPlayCard(newState, card)) {
      newState = await playCard(newState, card)
      cardsPlayed.push(card.name)
    }
  }

  if (cardsPlayed.length > 0) {
    GameLogger.ai('AI played cards', cardsPlayed)
  }

  // Phase 2: Attack if has attack token (Hearthstone style)
  if (ai.hasAttackToken) {
    const aiUnits = getPlayerUnits(newState, 'player2')

    // Simple AI strategy: attack with all units that can attack
    for (const unit of aiUnits) {
      if (!unit.hasAttackedThisTurn && !unit.hasSummoningSickness) {
        try {
          // AI targets player directly (simple strategy)
          // In a more advanced AI, we could add logic to target enemy units with taunt or make tactical decisions
          const attack: DirectAttack = {
            attackerId: unit.id,
            targetType: 'player',
          }
          newState = await declareAttack(newState, attack)
          GameLogger.ai(`AI attacks player with ${unit.name}`)
        } catch (error) {
          // Attack failed (e.g., taunt units present), skip
          GameLogger.debug(`AI attack failed: ${error}`)
        }
      }
    }
  }

  // End turn
  return await endTurn(newState)
}

// Mulligan Functions
export function toggleMulliganCard(state: GameState, cardId: string): GameState {
  if (state.phase !== 'mulligan') return state

  return produce(state, draft => {
    const player = draft[state.activePlayer]

    if (player.selectedForMulligan.includes(cardId)) {
      // Remove from selection
      player.selectedForMulligan = player.selectedForMulligan.filter(id => id !== cardId)
    } else {
      // Add to selection
      player.selectedForMulligan.push(cardId)
    }
  })
}

export function completeMulligan(state: GameState): GameState {
  if (state.phase !== 'mulligan') return state

  let newState = produce(state, draft => {
    const player = draft[state.activePlayer]

    if (player.selectedForMulligan.length > 0) {
      // Shuffle selected cards back into deck
      const cardsToShuffle = player.hand.filter(card => player.selectedForMulligan.includes(card.id))
      const keptCards = player.hand.filter(card => !player.selectedForMulligan.includes(card.id))

      // Add discarded cards back to deck and shuffle
      player.deck.push(...cardsToShuffle)
      shuffleDeck(player)

      // Draw replacement cards with orientation
      const cardsToDraw = cardsToShuffle.length
      const newCards = player.deck.splice(0, cardsToDraw).map(card => ({
        ...card,
        isReversed: Math.random() < GAME_CONFIG.ORIENTATION_CHANCE,
      }))
      player.hand = [...keptCards, ...newCards]

      GameLogger.action(`${state.activePlayer} mulliganed ${cardsToDraw} cards`)
    }

    player.mulliganComplete = true
    player.selectedForMulligan = []
  })

  // Check if both players completed mulligan
  if (newState.player1.mulliganComplete && newState.player2.mulliganComplete) {
    // Use phase manager for proper state machine transitions
    newState = phaseManagerService.tryTransition(newState, 'round_start')
    newState = phaseManagerService.tryTransition(newState, 'action')
    GameLogger.state('Game phase: Mulligan complete, starting action phase')
  }

  return newState
}

export function aiMulligan(
  state: GameState,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium',
): GameState {
  if (state.phase !== 'mulligan') return state

  // AI mulligan strategy based on difficulty
  let cardsToMulligan: string[] = []
  const aiHand = state.player2.hand

  switch (difficulty) {
    case 'easy': {
      // Random mulligan - 0-2 cards
      const randomCount = Math.floor(Math.random() * 3)
      cardsToMulligan = [...aiHand]
        .sort(() => Math.random() - 0.5)
        .slice(0, randomCount)
        .map(card => card.id)
      break
    }

    case 'medium':
      // Strategic mulligan - remove high cost cards and duplicates
      cardsToMulligan = aiHand
        .filter(card => {
          // Remove cards costing 4+ mana (too expensive for early game)
          if (card.cost >= 4) return true
          // Remove duplicate cards (keep diversity)
          const duplicateCount = aiHand.filter(c => c.name === card.name).length
          return duplicateCount > 1 && Math.random() < 0.5
        })
        .map(card => card.id)
      break

    case 'hard': {
      // Optimal mulligan - complex curve and synergy analysis
      const manaCurve = [0, 0, 0, 0, 0] // Count cards by mana cost
      aiHand.forEach(card => {
        if (card.cost <= 4) manaCurve[card.cost]++
      })

      cardsToMulligan = aiHand
        .filter(card => {
          // Keep 1-2 cost cards for early game
          if (card.cost <= 2) return false
          // Remove expensive cards without good early game
          if (card.cost >= 4) return true
          // Remove cards that break curve
          if (card.cost === 3 && manaCurve[3] > 1) return Math.random() < 0.6
          return false
        })
        .map(card => card.id)
      break
    }
  }

  GameLogger.ai(
    `AI selected ${cardsToMulligan.length} cards for mulligan (${difficulty} difficulty)`,
  )

  let newState = produce(state, draft => {
    const ai = draft.player2

    // Process AI mulligan
    if (cardsToMulligan.length > 0) {
      // Shuffle selected cards back into deck
      const cardsToShuffle = ai.hand.filter(card => cardsToMulligan.includes(card.id))
      const keptCards = ai.hand.filter(card => !cardsToMulligan.includes(card.id))

      // Add discarded cards back to deck and shuffle
      ai.deck.push(...cardsToShuffle)
      shuffleDeck(ai)

      // Draw replacement cards with orientation
      const cardsToDraw = cardsToShuffle.length
      const newCards = ai.deck.splice(0, cardsToDraw).map(card => ({
        ...card,
        isReversed: Math.random() < GAME_CONFIG.ORIENTATION_CHANCE,
      }))
      ai.hand = [...keptCards, ...newCards]

      GameLogger.action(`player2 mulliganed ${cardsToDraw} cards`)
    }

    ai.mulliganComplete = true
    ai.selectedForMulligan = []
  })

  // Check if both players completed mulligan
  if (newState.player1.mulliganComplete && newState.player2.mulliganComplete) {
    // Use phase manager for proper state machine transitions
    newState = phaseManagerService.tryTransition(newState, 'round_start')
    newState = phaseManagerService.tryTransition(newState, 'action')
    GameLogger.state('Game phase: Mulligan complete, starting action phase')
  }

  return newState
}

// Utility function to shuffle a player's deck
function shuffleDeck(player: Player): void {
  for (let i = player.deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
      ;[player.deck[i], player.deck[j]] = [player.deck[j], player.deck[i]]
  }
}
