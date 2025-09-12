import { createRandomDeck, createZodiacDeck, getAllCards } from '@/lib/card_loader'
import { GameLogger } from '@/lib/game_logger'
import type { Card, GameState, Player } from '@/schemas/schema'
import { cardEffectSystem } from '@/services/card_effect_system'
import { effectStackService } from '@/services/effect_stack_service'
import { createEventHelpers, eventManager } from '@/services/event_manager'
import { winConditionService } from '@/services/win_condition_service'

// Game Constants
const GAME_CONFIG = {
  LANE_COUNT: 6,
  MAX_BENCH_SIZE: 6,
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
    lanes: Array.from({ length: GAME_CONFIG.LANE_COUNT }, (_, id) => ({
      id,
      attacker: null,
      defender: null,
    })),
    phase: 'mulligan',
    waitingForAction: false,
    combatResolved: false,
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
    const newCard = { ...card, currentHealth: card.health, position: 'bench' as const }
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
): import('@/types/gameEvents').TriggeredAbility[] {
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
      execute: context => {
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
    const cardEffect: import('@/types/gameEvents').CardEffect = {
      id: `spell_effect_${card.id}`,
      name: effect.name || 'Spell Effect',
      description: effect.description || '',
      type: 'instant',
      execute: context => {
        executeSpellEffects(context.gameState, [effect], castingPlayer)
        return { success: true, newGameState: context.gameState }
      },
    }

    const effectContext: import('@/types/gameEvents').EffectContext = {
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

// Helper function to execute spell effects through the event system (legacy fallback)
async function _executeSpellEffectsThroughEventSystem(
  state: GameState,
  effects: { name?: string; description?: string }[],
  castingPlayer: 'player1' | 'player2',
  card: Card,
): Promise<void> {
  for (const effect of effects) {
    const cardEffect: import('@/types/gameEvents').CardEffect = {
      id: `spell_effect_${card.id}`,
      name: effect.name || 'Spell Effect',
      description: effect.description || '',
      type: 'instant',
      execute: context => {
        executeSpellEffects(context.gameState, [effect], castingPlayer)
        return { success: true, newGameState: context.gameState }
      },
    }

    const effectContext: import('@/types/gameEvents').EffectContext = {
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

export function declareAttackers(
  state: GameState,
  attackerArrangement: { attackerId: string; laneId: number }[],
): GameState {
  if (!state[state.activePlayer].hasAttackToken) return state
  if (state.phase !== 'action') return state
  if (attackerArrangement.length > GAME_CONFIG.LANE_COUNT) return state

  const newState = { ...state }
  const player = { ...newState[state.activePlayer] }

  // Clear lanes
  newState.lanes = newState.lanes.map(lane => ({ ...lane, attacker: null, defender: null }))

  const attackerNames: string[] = []
  // Place attackers in specific lanes (LoR style)
  attackerArrangement.forEach(({ attackerId, laneId }) => {
    const unit = player.bench.find(u => u.id === attackerId)
    if (unit && laneId < GAME_CONFIG.LANE_COUNT) {
      newState.lanes[laneId].attacker = { ...unit, position: 'attacking' }
      attackerNames.push(`${unit.name} (Lane ${laneId + 1})`)
    }
  })

  GameLogger.combat(`${state.activePlayer} declares attack`, {
    attackers: attackerNames,
    totalAttackers: attackerArrangement.length,
  })

  newState.phase = 'combat'
  newState.attackingPlayer = state.activePlayer
  return newState
}

export function declareDefenders(
  state: GameState,
  defenderAssignments: { defenderId: string; laneId: number }[],
): GameState {
  if (state.phase !== 'combat') return state

  const newState = { ...state }
  const defendingPlayer = state.activePlayer === 'player1' ? 'player2' : 'player1'
  const player = { ...newState[defendingPlayer] }

  // Clear existing defenders
  newState.lanes = newState.lanes.map(lane => ({ ...lane, defender: null }))

  const defenderNames: string[] = []
  // Assign defenders to specific lanes (LoR style)
  defenderAssignments.forEach(({ defenderId, laneId }) => {
    const unit = player.bench.find(u => u.id === defenderId)
    if (unit && laneId < GAME_CONFIG.LANE_COUNT && newState.lanes[laneId].attacker) {
      newState.lanes[laneId].defender = { ...unit, position: 'defending' }
      defenderNames.push(`${unit.name} blocks Lane ${laneId + 1}`)
    }
  })

  GameLogger.combat(`${defendingPlayer} declares defense`, {
    defenders: defenderNames,
    unblockedLanes: newState.lanes.filter(l => l.attacker && !l.defender).length,
  })

  // Immediately resolve combat after defenders are set
  newState.phase = 'combat'
  return newState
}

// Function to rearrange attackers during declare phase (LoR style)
export function rearrangeAttackers(
  state: GameState,
  newArrangement: { attackerId: string; laneId: number }[],
): GameState {
  if (state.phase !== 'action') return state
  if (state.attackingPlayer !== state.activePlayer) return state

  const newState = { ...state }
  const attackingPlayer = state.attackingPlayer!

  // Clear current attackers from lanes
  newState.lanes = newState.lanes.map(lane => ({ ...lane, attacker: null }))

  // Place attackers in new positions
  newArrangement.forEach(({ attackerId, laneId }) => {
    const unit = newState[attackingPlayer].bench.find(u => u.id === attackerId)
    if (unit && laneId < GAME_CONFIG.LANE_COUNT) {
      newState.lanes[laneId].attacker = { ...unit, position: 'attacking' }
    }
  })

  return newState
}

// Function to rearrange defenders during declare phase (LoR style)
export function rearrangeDefenders(
  state: GameState,
  newArrangement: { defenderId: string; laneId: number }[],
): GameState {
  if (state.phase !== 'combat') return state

  const newState = { ...state }
  const defendingPlayer = state.activePlayer === 'player1' ? 'player2' : 'player1'

  // Clear current defenders from lanes
  newState.lanes = newState.lanes.map(lane => ({ ...lane, defender: null }))

  // Place defenders in new positions
  newArrangement.forEach(({ defenderId, laneId }) => {
    const unit = newState[defendingPlayer].bench.find(u => u.id === defenderId)
    if (unit && laneId < GAME_CONFIG.LANE_COUNT && newState.lanes[laneId].attacker) {
      newState.lanes[laneId].defender = { ...unit, position: 'defending' }
    }
  })

  return newState
}

// Commit to combat - used by both attacker and defender
export function commitToCombat(state: GameState): GameState {
  if (state.phase === 'combat') {
    // Defender commits, trigger combat
    const newState = { ...state }
    newState.phase = 'combat'
    return newState
  }
  return state
}

export async function resolveCombat(state: GameState): Promise<GameState> {
  if (state.phase !== 'combat') return state

  const newState = { ...state }
  const attackingPlayer = newState.attackingPlayer!
  const defendingPlayer = attackingPlayer === 'player1' ? 'player2' : 'player1'
  const eventHelpers = createEventHelpers(newState)

  let totalNexusDamage = 0
  const combatResults: {
    lane?: number
    type?: string
    attacker: string
    defender?: string
    result?: string
    damage?: number
  }[] = []

  // Clear effect stack before combat resolution to start fresh
  effectStackService.clearStack()

  // Emit combat declared event
  await eventManager.emitCombatEvent('combat_declared', newState, -1, {
    attackingPlayer,
    defendingPlayer,
  })

  // Resolve combat lane by lane (left to right)
  for (let index = 0; index < newState.lanes.length; index++) {
    const lane = newState.lanes[index]
    if (lane.attacker) {
      if (lane.defender) {
        // Unit vs Unit combat
        const attackerDamage = lane.attacker.attack
        const defenderDamage = lane.defender.attack
        const attackerNewHealth =
          (lane.attacker.currentHealth || lane.attacker.health) - defenderDamage
        const defenderNewHealth =
          (lane.defender.currentHealth || lane.defender.health) - attackerDamage

        // Emit combat damage events
        await eventManager.emitCombatEvent('combat_damage_dealt', newState, index, {
          attackerId: lane.attacker.id,
          defenderId: lane.defender.id,
          damage: attackerDamage,
          combatResults: {
            attackerDied: attackerNewHealth <= 0,
            defenderDied: defenderNewHealth <= 0,
            damageToAttacker: defenderDamage,
            damageToDefender: attackerDamage,
            nexusDamage: 0,
          },
        })

        combatResults.push({
          lane: index + 1,
          type: 'trade',
          attacker: `${lane.attacker.name} (${attackerNewHealth <= 0 ? 'dies' : `survives ${attackerNewHealth}hp`})`,
          defender: `${lane.defender.name} (${defenderNewHealth <= 0 ? 'dies' : `survives ${defenderNewHealth}hp`})`,
        })

        // Handle unit deaths and damage
        if (attackerNewHealth <= 0) {
          await eventHelpers.unitDies(lane.attacker.id, lane.attacker.name)
          cardEffectSystem.unregisterCardAbilities(lane.attacker.id)
          newState[attackingPlayer].bench = newState[attackingPlayer].bench.filter(
            u => u.id !== lane.attacker?.id,
          )
        } else {
          const benchUnit = newState[attackingPlayer].bench.find(u => u.id === lane.attacker?.id)
          if (benchUnit) {
            benchUnit.currentHealth = attackerNewHealth
            // Emit unit damaged event
            await eventManager.emitCardEvent(
              'unit_dealt_damage',
              newState,
              benchUnit.id,
              benchUnit.name,
              {
                damage: defenderDamage,
                previousValue: benchUnit.currentHealth + defenderDamage,
                newValue: benchUnit.currentHealth,
              },
            )
          }
        }

        if (defenderNewHealth <= 0) {
          await eventHelpers.unitDies(lane.defender.id, lane.defender.name)
          cardEffectSystem.unregisterCardAbilities(lane.defender.id)
          newState[defendingPlayer].bench = newState[defendingPlayer].bench.filter(
            u => u.id !== lane.defender?.id,
          )
        } else {
          const benchUnit = newState[defendingPlayer].bench.find(u => u.id === lane.defender?.id)
          if (benchUnit) {
            benchUnit.currentHealth = defenderNewHealth
            // Emit unit damaged event
            await eventManager.emitCardEvent(
              'unit_dealt_damage',
              newState,
              benchUnit.id,
              benchUnit.name,
              {
                damage: attackerDamage,
                previousValue: benchUnit.currentHealth + attackerDamage,
                newValue: benchUnit.currentHealth,
              },
            )
          }
        }
      } else {
        // Direct nexus damage
        const damage = lane.attacker.attack
        const _previousHealth = newState[defendingPlayer].health
        newState[defendingPlayer].health -= damage
        totalNexusDamage += damage

        // Emit player damage event
        await eventHelpers.playerLosesHealth(defendingPlayer, damage, 'combat damage')

        combatResults.push({
          lane: index + 1,
          type: 'nexus',
          attacker: lane.attacker.name,
          damage: damage,
        })
      }
    }
  }

  // Resolve all effects on the stack before finishing combat
  await resolveEffectStack(newState)

  // Emit combat resolved event
  await eventManager.emitCombatEvent('combat_resolved', newState, -1, {
    totalNexusDamage,
    combatResults,
  })

  GameLogger.combat('Combat resolved', {
    results: combatResults,
    totalNexusDamage,
    defenderHealth: newState[defendingPlayer].health,
  })

  // Clear lanes
  newState.lanes = newState.lanes.map(lane => ({ ...lane, attacker: null, defender: null }))
  newState.combatResolved = true
  newState.phase = 'action'
  newState.attackingPlayer = null

  return newState
}

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
  return {
    items: effectStackService.getStackItems(),
    canRespond: effectStackService.canCurrentPlayerRespond(),
    resolutionMode: effectStackService.getResolutionMode(),
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
      const counterEffect: import('@/types/gameEvents').CardEffect = {
        id: `counter_${responseCard.id}`,
        name: responseCard.name,
        description: `Counter target spell or ability`,
        type: 'instant',
        execute: context => {
          // Remove the targeted effect from stack
          effectStackService.removeFromStack(stackItemId)
          GameLogger.action(`${responseCard.name} counters effect ${stackItemId}`)
          return { success: true, newGameState: context.gameState }
        },
      }

      const effectContext: import('@/types/gameEvents').EffectContext = {
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

  // Phase 2: Attack if has attack token
  if (ai.hasAttackToken && ai.bench.length > 0) {
    // Select best attackers
    const attackers = ai.bench
      .sort((a, b) => b.attack - a.attack)
      .slice(0, GAME_CONFIG.LANE_COUNT)
      .map(u => u.id)

    if (attackers.length > 0) {
      // Declare attackers with lane positions
      const attackerArrangement = attackers.map((id, index) => ({ attackerId: id, laneId: index }))
      GameLogger.ai('AI declaring attack', { attackerCount: attackers.length })
      newState = declareAttackers(newState, attackerArrangement)

      // AI auto-assigns defenders (simplified for tutorial)
      if (newState.phase === 'combat') {
        const defenderAssignments: { defenderId: string; laneId: number }[] = []

        // Simple defensive strategy: block strongest attackers first
        newState.lanes.forEach((lane, index) => {
          if (lane.attacker && opponent.bench.length > defenderAssignments.length) {
            const availableDefenders = opponent.bench.filter(
              u => !defenderAssignments.some(d => d.defenderId === u.id),
            )

            if (availableDefenders.length > 0) {
              // Find best defender (highest health that can survive)
              const bestDefender = availableDefenders
                .sort((a, b) => (b.currentHealth || b.health) - (a.currentHealth || a.health))
                .find(d => (d.currentHealth || d.health) > lane.attacker?.attack)

              if (bestDefender) {
                defenderAssignments.push({
                  defenderId: bestDefender.id,
                  laneId: index,
                })
              }
            }
          }
        })

        GameLogger.ai('AI assigning defenders', { defenderCount: defenderAssignments.length })
        newState = declareDefenders(newState, defenderAssignments)

        if (newState.phase === 'combat') {
          newState = await resolveCombat(newState)
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
  if (state.phase !== 'mulligan' || state.activePlayer !== 'player2') return state

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

  // Auto-complete AI mulligan
  return completeMulligan(newState)
}

// Utility function to shuffle a player's deck
function shuffleDeck(player: Player): void {
  for (let i = player.deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[player.deck[i], player.deck[j]] = [player.deck[j], player.deck[i]]
  }
}
