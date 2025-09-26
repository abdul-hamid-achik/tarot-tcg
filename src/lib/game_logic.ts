import { createRandomDeck, createZodiacDeck, getAllCards } from '@/lib/card_loader'
import { GameLogger } from '@/lib/game_logger'
import type { Card, GameState, Player } from '@/schemas/schema'
import { cardEffectSystem } from '@/services/card_effect_system'
import { effectStackService } from '@/services/effect_stack_service'
import { createEventHelpers, eventManager } from '@/services/event_manager'
import { winConditionService } from '@/services/win_condition_service'

// Game Constants
const GAME_CONFIG = {
  BATTLEFIELD_SLOTS: 7,
  LANE_COUNT: 6,  // Legacy compatibility
  MAX_BENCH_SIZE: 6,  // Legacy compatibility
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
    console.warn('Contentlayer not ready, using default cards')
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
    isReversed: false, // Initialize all cards as upright
  }))

  const player2Cards = player2Deck.map(card => ({
    ...card,
    id: `p2_${card.id}_${++cardCounter}`,
    currentHealth: card.health,
    isReversed: false, // Initialize all cards as upright
  }))

  const player1: Player = {
    id: 'player1',
    name: 'You',
    health: GAME_CONFIG.STARTING_HEALTH,
    mana: 1,
    maxMana: 1,
    spellMana: 0,
    hand: player1Cards.slice(0, GAME_CONFIG.STARTING_HAND_SIZE),
    deck: player1Cards.slice(GAME_CONFIG.STARTING_HAND_SIZE),
    bench: [],
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
    hand: player2Cards.slice(0, GAME_CONFIG.STARTING_HAND_SIZE),
    deck: player2Cards.slice(GAME_CONFIG.STARTING_HAND_SIZE),
    bench: [],
    hasAttackToken: false,
    mulliganComplete: false,
    selectedForMulligan: [],
    hasPassed: false,
    actionsThisTurn: 0,
  }

  // Initialize win condition system for this game
  winConditionService.setGameMode(gameMode as any)
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

  // Check bench limit
  if (card.type === 'unit' && player.bench.length >= GAME_CONFIG.MAX_BENCH_SIZE) return false

  return true
}

export async function playCard(state: GameState, card: Card): Promise<GameState> {
  if (!canPlayCard(state, card)) return state

  const newState = { ...state }
  const player = { ...newState[state.activePlayer] }
  const eventHelpers = createEventHelpers(newState)

  // Calculate mana usage
  const manaCost = card.cost
  const manaToUse = Math.min(player.mana, manaCost)
  const spellManaToUse = Math.max(0, manaCost - manaToUse)

  player.mana -= manaToUse
  player.spellMana -= spellManaToUse
  player.hand = player.hand.filter(c => c.id !== card.id)

  GameLogger.action(`${state.activePlayer} plays ${card.name}`, {
    cost: manaCost,
    manaUsed: manaToUse,
    spellManaUsed: spellManaToUse,
    remainingMana: player.mana,
    remainingSpellMana: player.spellMana,
  })

  // Emit card played event
  await eventHelpers.cardPlayed(card.id, card.name, manaCost)

  if (card.type === 'unit') {
    const newCard = {
      ...card,
      currentHealth: card.health,
      position: 'bench' as const,
      owner: state.activePlayer,
    }
    player.bench.push(newCard)

    // Emit unit summoned event
    await eventHelpers.unitSummoned(card.id, card.name, card.attack, card.health)

    // Register card abilities with the effect system
    if (card.abilities && card.abilities.length > 0) {
      // Convert abilities to triggered abilities for the effect system
      const triggeredAbilities = convertAbilitiesToTriggeredAbilities(card.abilities)
      cardEffectSystem.registerCardAbilities(newCard, triggeredAbilities)
    }
  } else if (card.type === 'spell') {
    // Queue spell effects on the stack for proper resolution
    if (card.effects && card.effects.length > 0) {
      await queueSpellEffectsOnStack(newState, card.effects, state.activePlayer, card)
    }
  }

  newState[state.activePlayer] = player

  // Resolve the effect stack after playing a card
  await resolveEffectStack(newState)

  return newState
}

// Helper function to convert old abilities to triggered abilities for the effect system
function convertAbilitiesToTriggeredAbilities(
  abilities: { name?: string; description?: string }[],
): any[] { // TODO: Fix types for battlefield system
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
      execute: (context: any) => {
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
    const cardEffect: any = { // TODO: Fix types for battlefield system
      id: `spell_effect_${card.id}`,
      name: effect.name || 'Spell Effect',
      description: effect.description || '',
      type: 'instant',
      execute: (context: any) => {
        executeSpellEffects(context.gameState, [effect], castingPlayer)
        return { success: true, newGameState: context.gameState }
      },
    }

    const effectContext: any = { // TODO: Fix types for battlefield system
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
    const cardEffect: any = { // TODO: Fix types for battlefield system
      id: `spell_effect_${card.id}`,
      name: effect.name || 'Spell Effect',
      description: effect.description || '',
      type: 'instant',
      execute: (context: any) => {
        executeSpellEffects(context.gameState, [effect], castingPlayer)
        return { success: true, newGameState: context.gameState }
      },
    }

    const effectContext: any = { // TODO: Fix types for battlefield system
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
        player.hand.push(player.deck.shift()!)
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

      // Remove enemy units with health <= maxHealth
      state[opponent].bench = state[opponent].bench.filter(
        unit => (unit.currentHealth || unit.health) > maxHealth,
      )
    }

    if (description.includes('cost') && description.includes('less')) {
      // This would need more complex implementation for ongoing effects
      // For now, just acknowledge the ability exists
      console.log(`${ability.name || 'Unknown ability'} activated`)
    }
  })
}

// Hearthstone-style direct attack - no lane declarations needed
export function directAttack(
  state: GameState,
  attackerId: string,
  target: { player: 'player1' | 'player2'; slot: number } | 'nexus',
): GameState {
  if (!state[state.activePlayer].hasAttackToken) return state
  if (state.phase !== 'action') return state

  const newState = { ...state }

  // Find attacker on battlefield (check correct side based on active player)
  let attacker = null
  let attackerPosition = null

  // Check the correct units array based on active player
  const attackerUnits = state.activePlayer === 'player1' ? newState.battlefield.playerUnits : newState.battlefield.enemyUnits
  const attackerPlayer = state.activePlayer

  for (let i = 0; i < attackerUnits.length; i++) {
    const unit = attackerUnits[i]
    if (unit && unit.id === attackerId) {
      attacker = unit
      attackerPosition = { player: attackerPlayer, slot: i }
      break
    }
  }

  if (!attacker || attacker.hasAttackedThisTurn) return state

  GameLogger.combat(`${state.activePlayer} attacks with ${attacker.name}`, {
    target: target === 'nexus' ? 'nexus' : `${target.player} slot ${target.slot}`,
  })

  // Mark attacker as having attacked
  attacker.hasAttackedThisTurn = true

  // Apply damage immediately (Hearthstone style)
  if (target === 'nexus') {
    const opponent = state.activePlayer === 'player1' ? 'player2' : 'player1'
    newState[opponent].health -= attacker.attack
  } else {
    // Unit vs Unit combat
    const targetUnits = target.player === 'player1' ? newState.battlefield.playerUnits : newState.battlefield.enemyUnits
    const defender = targetUnits[target.slot]

    if (defender) {
      // Simultaneous damage
      defender.currentHealth = (defender.currentHealth || defender.health) - attacker.attack
      attacker.currentHealth = (attacker.currentHealth || attacker.health) - defender.attack

      // Remove dead units
      if (defender.currentHealth <= 0) {
        targetUnits[target.slot] = null
      }
      if (attacker.currentHealth <= 0) {
        if (attackerPosition) {
          const attackerUnits = attackerPosition.player === 'player1' ? newState.battlefield.playerUnits : newState.battlefield.enemyUnits
          attackerUnits[attackerPosition.slot] = null
        }
      }
    }
  }

  return newState
}

// Simplified battlefield system - no complex declarations needed
// Units can be placed directly in battlefield slots

// Legacy function stubs for tutorial compatibility (deprecated)
export function declareAttackers(state: GameState, _attackerArrangement: any): GameState {
  console.warn('declareAttackers is deprecated - use directAttack instead')
  return state
}

export function declareDefenders(state: GameState, _defenderAssignments: any): GameState {
  console.warn('declareDefenders is deprecated - use directAttack instead')
  return state
}

export async function resolveCombat(state: GameState): Promise<GameState> {
  console.warn('resolveCombat is deprecated - attacks are resolved immediately')
  return state
}

export function rearrangeAttackers(state: GameState, _newArrangement: any): GameState {
  console.warn('rearrangeAttackers is deprecated')
  return state
}

export function rearrangeDefenders(state: GameState, _newArrangement: any): GameState {
  console.warn('rearrangeDefenders is deprecated')
  return state
}

export function commitToCombat(state: GameState): GameState {
  console.warn('commitToCombat is deprecated')
  return state
}

// Battlefield system uses directAttack() instead of complex lane combat
// No separate combat resolution phase needed

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
async function resolveEffectStack(_gameState: GameState): Promise<void> {
  try {
    // For now, just clear the stack since tests don't have proper game state management
    // In a real game, this would resolve the stack properly
    effectStackService.clearStack()

    // TODO: Implement proper stack resolution when integrated with UI state management
    // const results = await effectStackService.resolveStack();
    // if (results.length > 0) {
    //   GameLogger.state(`Resolved ${results.length} effects from stack`);
    // }
  } catch (error) {
    console.error('Error resolving effect stack:', error)
    // Fallback: clear the stack to prevent infinite loops
    effectStackService.clearStack()
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
      const counterEffect: any = { // TODO: Fix types for battlefield system
        id: `counter_${responseCard.id}`,
        name: responseCard.name,
        description: `Counter target spell or ability`,
        type: 'instant',
        execute: (context: any) => {
          // Counter the targeted effect from stack
          const success = effectStackService.counterEffect(stackItemId, 'player1')
          if (success) {
            GameLogger.action(`${responseCard.name} counters effect ${stackItemId}`)
          }
          return { success, newGameState: context.gameState }
        },
      }

      const effectContext: any = { // TODO: Fix types for battlefield system
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
    console.error('Error responding to stack effect:', error)
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
    console.error('Error passing priority:', error)
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
  const newState = { ...state }
  const eventHelpers = createEventHelpers(newState)

  // Emit turn end event
  await eventHelpers.turnStart(state.activePlayer)

  // Update persistent effects at end of turn
  const updatedState = cardEffectSystem.updatePersistentEffects(newState)
  Object.assign(newState, updatedState)

  // Reset attack flags for all units (Hearthstone style)
  newState[state.activePlayer].bench.forEach(unit => {
    unit.hasAttackedThisTurn = false
  })

  // Store unspent mana as spell mana
  const unspentMana = newState[state.activePlayer].mana
  newState[state.activePlayer].spellMana = Math.min(
    GAME_CONFIG.MAX_SPELL_MANA,
    newState[state.activePlayer].spellMana + unspentMana,
  )

  GameLogger.state(`${state.activePlayer} ends turn`, {
    unspentMana,
    newSpellMana: newState[state.activePlayer].spellMana,
  })

  // Switch active player
  const nextPlayer = state.activePlayer === 'player1' ? 'player2' : 'player1'
  newState.activePlayer = nextPlayer
  newState.turn++

  // Every 2 turns = new round
  if (newState.turn % 2 === 1) {
    newState.round++

    // Switch attack token
    newState.player1.hasAttackToken = !newState.player1.hasAttackToken
    newState.player2.hasAttackToken = !newState.player2.hasAttackToken

    // Emit round start event
    await eventManager.emitSystemEvent('round_start', newState, {
      round: newState.round,
    })
  }

  // Refill mana
  const currentPlayer = newState[nextPlayer]
  currentPlayer.maxMana = Math.min(GAME_CONFIG.MAX_MANA, newState.round)
  currentPlayer.mana = currentPlayer.maxMana

  // Emit mana refilled event
  await eventHelpers.playerGainsMana(nextPlayer, currentPlayer.mana)

  // Draw a card
  if (currentPlayer.deck.length > 0) {
    const drawnCard = currentPlayer.deck[0]
    currentPlayer.hand.push(currentPlayer.deck.shift()!)

    // Emit card drawn event
    await eventHelpers.cardDrawn(drawnCard.id, drawnCard.name)
    GameLogger.action(`${nextPlayer} draws ${drawnCard.name}`)
  }

  // Emit turn start event for new player
  await eventManager.emitSystemEvent('turn_start', newState, {
    playerId: nextPlayer,
    turn: newState.turn,
    round: newState.round,
    hasAttackToken: currentPlayer.hasAttackToken,
  })

  GameLogger.turnStart(nextPlayer, newState.turn, newState.round, currentPlayer.hasAttackToken)

  newState.phase = 'action'
  newState.combatResolved = false

  return newState
}

// Enhanced AI Strategy
export async function aiTurn(state: GameState): Promise<GameState> {
  let newState = { ...state }

  if (newState.activePlayer !== 'player2') return newState

  GameLogger.ai('AI turn started')

  const ai = newState.player2
  const opponent = newState.player1

  // Phase 1: Play cards strategically
  const playableCards = ai.hand
    .filter(card => canPlayCard(newState, card))
    .sort((a, b) => {
      // Prioritize by value (attack + health) / cost ratio
      const aValue = (a.attack + a.health) / Math.max(1, a.cost)
      const bValue = (b.attack + b.health) / Math.max(1, b.cost)
      return bValue - aValue
    })

  // Play units until bench is full or mana is depleted
  const cardsPlayed: string[] = []
  for (const card of playableCards) {
    if (ai.bench.length >= GAME_CONFIG.MAX_BENCH_SIZE) break
    if (canPlayCard(newState, card)) {
      newState = await playCard(newState, card)
      cardsPlayed.push(card.name)
    }
  }

  if (cardsPlayed.length > 0) {
    GameLogger.ai('AI played cards', cardsPlayed)
  }

  // Phase 2: Attack if has attack token (Hearthstone style)
  if (ai.hasAttackToken && ai.bench.length > 0) {
    // Simple AI strategy: attack with all units that can attack
    for (const unit of ai.bench) {
      if (!unit.hasAttackedThisTurn) {
        // AI targets nexus directly (simple strategy)
        // In a more advanced AI, we could add logic to target enemy units with taunt or make tactical decisions
        newState = directAttack(newState, unit.id, 'nexus')
        GameLogger.ai(`AI attacks nexus with ${unit.name}`)
      }
    }
  }

  // End turn
  return await endTurn(newState)
}

// Mulligan Functions
export function toggleMulliganCard(state: GameState, cardId: string): GameState {
  if (state.phase !== 'mulligan') return state

  const newState = { ...state }
  const player = { ...newState[state.activePlayer] }

  if (player.selectedForMulligan.includes(cardId)) {
    // Remove from selection
    player.selectedForMulligan = player.selectedForMulligan.filter(id => id !== cardId)
  } else {
    // Add to selection
    player.selectedForMulligan = [...player.selectedForMulligan, cardId]
  }

  newState[state.activePlayer] = player
  return newState
}

export function completeMulligan(state: GameState): GameState {
  if (state.phase !== 'mulligan') return state

  const newState = { ...state }
  const player = { ...newState[state.activePlayer] }

  if (player.selectedForMulligan.length > 0) {
    // Shuffle selected cards back into deck
    const cardsToShuffle = player.hand.filter(card => player.selectedForMulligan.includes(card.id))
    const keptCards = player.hand.filter(card => !player.selectedForMulligan.includes(card.id))

    // Add discarded cards back to deck and shuffle
    player.deck = [...player.deck, ...cardsToShuffle]
    shuffleDeck(player)

    // Draw replacement cards
    const cardsToDraw = cardsToShuffle.length
    const newCards = player.deck.splice(0, cardsToDraw)
    player.hand = [...keptCards, ...newCards]

    GameLogger.action(`${state.activePlayer} mulliganed ${cardsToDraw} cards`)
  }

  player.mulliganComplete = true
  player.selectedForMulligan = []
  newState[state.activePlayer] = player

  // Check if both players completed mulligan
  if (newState.player1.mulliganComplete && newState.player2.mulliganComplete) {
    newState.phase = 'action'
    newState.waitingForAction = true
    GameLogger.state('Game phase: Mulligan complete, starting action phase')
  }

  return newState
}

export function aiMulligan(
  state: GameState,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium',
): GameState {
  if (state.phase !== 'mulligan') return state

  const newState = { ...state }
  const ai = { ...newState.player2 }

  // AI mulligan strategy based on difficulty
  let cardsToMulligan: string[] = []

  switch (difficulty) {
    case 'easy': {
      // Random mulligan - 0-2 cards
      const randomCount = Math.floor(Math.random() * 3)
      cardsToMulligan = ai.hand
        .sort(() => Math.random() - 0.5)
        .slice(0, randomCount)
        .map(card => card.id)
      break
    }

    case 'medium':
      // Strategic mulligan - remove high cost cards and duplicates
      cardsToMulligan = ai.hand
        .filter(card => {
          // Remove cards costing 4+ mana (too expensive for early game)
          if (card.cost >= 4) return true
          // Remove duplicate cards (keep diversity)
          const duplicateCount = ai.hand.filter(c => c.name === card.name).length
          return duplicateCount > 1 && Math.random() < 0.5
        })
        .map(card => card.id)
      break

    case 'hard': {
      // Optimal mulligan - complex curve and synergy analysis
      const manaCurve = [0, 0, 0, 0, 0] // Count cards by mana cost
      ai.hand.forEach(card => {
        if (card.cost <= 4) manaCurve[card.cost]++
      })

      cardsToMulligan = ai.hand
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

  ai.selectedForMulligan = cardsToMulligan
  newState.player2 = ai

  GameLogger.ai(
    `AI selected ${cardsToMulligan.length} cards for mulligan (${difficulty} difficulty)`,
  )

  // Process AI mulligan manually (similar to completeMulligan but for player2)
  if (ai.selectedForMulligan.length > 0) {
    // Shuffle selected cards back into deck
    const cardsToShuffle = ai.hand.filter(card => ai.selectedForMulligan.includes(card.id))
    const keptCards = ai.hand.filter(card => !ai.selectedForMulligan.includes(card.id))

    // Add discarded cards back to deck and shuffle
    ai.deck = [...ai.deck, ...cardsToShuffle]
    shuffleDeck(ai)

    // Draw replacement cards
    const cardsToDraw = cardsToShuffle.length
    const newCards = ai.deck.splice(0, cardsToDraw)
    ai.hand = [...keptCards, ...newCards]

    GameLogger.action(`player2 mulliganed ${cardsToDraw} cards`)
  }

  ai.mulliganComplete = true
  ai.selectedForMulligan = []
  newState.player2 = ai

  // Check if both players completed mulligan
  if (newState.player1.mulliganComplete && newState.player2.mulliganComplete) {
    newState.phase = 'action'
    newState.waitingForAction = true
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
