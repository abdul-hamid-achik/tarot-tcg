import { produce, type Draft } from 'immer'
import type { GameState, Card, Battlefield, Player } from '@/schemas/schema'

/**
 * Creates a deep clone of a GameState using Immer
 * This ensures complete immutability without manual spreading
 */
export function cloneGameState(state: GameState): GameState {
  return produce(state, () => { /* no-op clone */ })
}

/**
 * Updates a GameState immutably using Immer's produce
 * The recipe function receives a mutable draft that can be modified directly
 */
export function updateGameState(
  state: GameState,
  recipe: (draft: Draft<GameState>) => void
): GameState {
  return produce(state, recipe)
}

/**
 * Creates a deep clone of a Card using Immer
 */
export function cloneCard(card: Card): Card {
  return produce(card, () => { /* no-op clone */ })
}

/**
 * Creates a deep clone of a Battlefield using Immer
 */
export function cloneBattlefield(battlefield: Battlefield): Battlefield {
  return produce(battlefield, () => { /* no-op clone */ })
}

/**
 * Creates a deep clone of a Player using Immer
 */
export function clonePlayer(player: Player): Player {
  return produce(player, () => { /* no-op clone */ })
}

/**
 * Updates a Player immutably using Immer's produce
 */
export function updatePlayer(
  player: Player,
  recipe: (draft: Draft<Player>) => void
): Player {
  return produce(player, recipe)
}

/**
 * Updates a Card immutably using Immer's produce
 */
export function updateCard(
  card: Card,
  recipe: (draft: Draft<Card>) => void
): Card {
  return produce(card, recipe)
}

/**
 * Updates a Battlefield immutably using Immer's produce
 */
export function updateBattlefield(
  battlefield: Battlefield,
  recipe: (draft: Draft<Battlefield>) => void
): Battlefield {
  return produce(battlefield, recipe)
}

/**
 * Batch update multiple cards in an array immutably
 */
export function updateCards(
  cards: Card[],
  predicate: (card: Card) => boolean,
  recipe: (draft: Draft<Card>) => void
): Card[] {
  return cards.map(card => predicate(card) ? produce(card, recipe) : card)
}

/**
 * Helper to safely get a player from game state
 */
export function getPlayerFromState(
  state: GameState,
  playerId: 'player1' | 'player2'
): Player {
  return state[playerId]
}

/**
 * Helper to get the opponent player ID
 */
export function getOpponentId(playerId: 'player1' | 'player2'): 'player1' | 'player2' {
  return playerId === 'player1' ? 'player2' : 'player1'
}

/**
 * Helper to get units on the battlefield for a specific player
 */
export function getPlayerUnits(battlefield: Battlefield, playerId: 'player1' | 'player2'): (Card | null)[] {
  return playerId === 'player1' ? battlefield.playerUnits : battlefield.enemyUnits
}

/**
 * Helper to find a card by ID in the battlefield
 */
export function findCardOnBattlefield(
  battlefield: Battlefield,
  cardId: string
): { card: Card; playerId: 'player1' | 'player2'; slot: number } | null {
  for (let i = 0; i < battlefield.playerUnits.length; i++) {
    const card = battlefield.playerUnits[i]
    if (card?.id === cardId) {
      return { card, playerId: 'player1', slot: i }
    }
  }
  for (let i = 0; i < battlefield.enemyUnits.length; i++) {
    const card = battlefield.enemyUnits[i]
    if (card?.id === cardId) {
      return { card, playerId: 'player2', slot: i }
    }
  }
  return null
}

/**
 * Helper to find a card by ID in a player's hand
 */
export function findCardInHand(
  state: GameState,
  cardId: string
): { card: Card; playerId: 'player1' | 'player2'; index: number } | null {
  const player1Index = state.player1.hand.findIndex(c => c.id === cardId)
  if (player1Index !== -1) {
    return { card: state.player1.hand[player1Index], playerId: 'player1', index: player1Index }
  }
  const player2Index = state.player2.hand.findIndex(c => c.id === cardId)
  if (player2Index !== -1) {
    return { card: state.player2.hand[player2Index], playerId: 'player2', index: player2Index }
  }
  return null
}
