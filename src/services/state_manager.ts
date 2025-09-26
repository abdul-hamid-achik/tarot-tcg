import { GameLogger } from '@/lib/game_logger'
import type { Card as GameCard, GameState } from '@/schemas/schema'
import type { BattlefieldPosition } from '@/services/battlefield_service'

export type CardLocation =
  | { type: 'hand'; player: 'player1' | 'player2'; index: number }
  | { type: 'deck'; player: 'player1' | 'player2'; index: number }
  | { type: 'bench'; player: 'player1' | 'player2'; index: number }
  | { type: 'battlefield'; player: 'player1' | 'player2'; slot: number }
  | { type: 'void' } // Card removed from game

/**
 * Single source of truth for all card positions and game state
 * Manages all card locations and ensures state consistency
 */
export class StateManager {
  private cardLocations: Map<string, CardLocation> = new Map()
  private gameState: GameState | null = null

  /**
   * Initialize from a game state
   */
  initialize(state: GameState): void {
    this.gameState = state
    this.cardLocations.clear()

    // Map all cards to their locations
    this.mapPlayerCards('player1', state.player1)
    this.mapPlayerCards('player2', state.player2)
    this.mapBattlefieldCards(state)

    // Initialize grid representation

    GameLogger.state('StateManager initialized', {
      totalCards: this.cardLocations.size,
    })
  }

  /**
   * Map player cards to locations
   */
  private mapPlayerCards(playerId: 'player1' | 'player2', player: any): void {
    // Hand cards
    player.hand?.forEach((card: GameCard, index: number) => {
      this.cardLocations.set(card.id, {
        type: 'hand',
        player: playerId,
        index,
      })
    })

    // Deck cards
    player.deck?.forEach((card: GameCard, index: number) => {
      this.cardLocations.set(card.id, {
        type: 'deck',
        player: playerId,
        index,
      })
    })

    // Bench cards - these are also on the grid
    player.bench?.forEach((card: GameCard, index: number) => {
      // Bench cards exist in both bench array AND battlefield
      if (index < 7) { // Battlefield has 7 slots per player
        this.cardLocations.set(card.id, {
          type: 'battlefield',
          player: playerId,
          slot: index,
        })
      }
    })

  }

  /**
   * Map battlefield cards
   */
  private mapBattlefieldCards(state: GameState): void {
    // Map player1 units
    state.battlefield.playerUnits.forEach((unit, slot) => {
      if (unit) {
        this.cardLocations.set(unit.id, {
          type: 'battlefield',
          player: 'player1',
          slot,
        })
      }
    })

    // Map player2 units
    state.battlefield.enemyUnits.forEach((unit, slot) => {
      if (unit) {
        this.cardLocations.set(unit.id, {
          type: 'battlefield',
          player: 'player2',
          slot,
        })
      }
    })
  }

  /**
   * Get card at specific grid position
   */
  getCardAtPosition(position: BattlefieldPosition): GameCard | null {
    for (const [cardId, location] of this.cardLocations) {
      if (
        location.type === 'battlefield' &&
        location.player === position.player &&
        location.slot === position.slot
      ) {
        return this.findCard(cardId)
      }
    }
    return null
  }

  /**
   * Check if a grid position is empty
   */
  isPositionEmpty(position: BattlefieldPosition): boolean {
    return this.getCardAtPosition(position) === null
  }

  /**
   * Move a card to a new location
   */
  moveCard(cardId: string, newLocation: CardLocation): boolean {
    const currentLocation = this.cardLocations.get(cardId)
    if (!currentLocation) {
      GameLogger.error(`Card ${cardId} not found in state`)
      return false
    }

    const card = this.findCard(cardId)
    if (!card) {
      GameLogger.error(`Card data for ${cardId} not found`)
      return false
    }

    // Remove from current location
    this.removeFromLocation(cardId, currentLocation)

    // Add to new location
    this.addToLocation(cardId, card, newLocation)

    // Update location map
    this.cardLocations.set(cardId, newLocation)

    // State is now synchronized

    GameLogger.action(`Card ${card.name} moved`, {
      from: currentLocation,
      to: newLocation,
    })

    return true
  }

  /**
   * Remove card from its current location in game state
   */
  private removeFromLocation(cardId: string, location: CardLocation): void {
    if (!this.gameState) return

    switch (location.type) {
      case 'hand': {
        const player = this.gameState[location.player]
        player.hand = player.hand.filter(c => c.id !== cardId)
        break
      }
      case 'deck': {
        const player = this.gameState[location.player]
        player.deck = player.deck.filter(c => c.id !== cardId)
        break
      }
      case 'bench': {
        const player = this.gameState[location.player]
        player.bench = player.bench.filter(c => c.id !== cardId)
        break
      }
      case 'battlefield': {
        // Remove from bench if it's there
        const owner = this.getCardOwner(cardId)
        if (owner) {
          this.gameState[owner].bench = this.gameState[owner].bench.filter(c => c.id !== cardId)
        }
        break
      }
    }
  }

  /**
   * Add card to new location in game state
   */
  private addToLocation(cardId: string, card: GameCard, location: CardLocation): void {
    if (!this.gameState) return

    switch (location.type) {
      case 'hand': {
        const player = this.gameState[location.player]
        player.hand.push(card)
        break
      }
      case 'deck': {
        const player = this.gameState[location.player]
        player.deck.push(card)
        break
      }
      case 'bench': {
        const player = this.gameState[location.player]
        player.bench.push(card)
        break
      }
      case 'battlefield': {
        // Add to bench array for state consistency
        const owner = this.getCardOwner(cardId)
        if (owner && !this.gameState[owner].bench.find(c => c.id === cardId)) {
          this.gameState[owner].bench.push(card)
        }
        break
      }
    }
  }

  /**
   * Find a card in the game state
   */
  private findCard(cardId: string): GameCard | null {
    if (!this.gameState) return null

    // Check all possible locations
    for (const player of [this.gameState.player1, this.gameState.player2]) {
      // Check hand
      const handCard = player.hand.find(c => c.id === cardId)
      if (handCard) return handCard

      // Check deck
      const deckCard = player.deck.find(c => c.id === cardId)
      if (deckCard) return deckCard

      // Check bench
      const benchCard = player.bench.find(c => c.id === cardId)
      if (benchCard) return benchCard

    }

    // Check battlefield
    const allBattlefieldUnits = [
      ...this.gameState.battlefield.playerUnits,
      ...this.gameState.battlefield.enemyUnits,
    ].filter(Boolean)

    for (const unit of allBattlefieldUnits) {
      if (unit && unit.id === cardId) return unit
    }

    return null
  }

  /**
   * Get card owner
   */
  private getCardOwner(cardId: string): 'player1' | 'player2' | null {
    // Check by card ID prefix
    if (cardId.startsWith('p1_')) return 'player1'
    if (cardId.startsWith('p2_')) return 'player2'

    // Fallback: search game state
    if (!this.gameState) return null

    const inPlayer1 =
      this.gameState.player1.hand.some(c => c.id === cardId) ||
      this.gameState.player1.deck.some(c => c.id === cardId) ||
      this.gameState.player1.bench.some(c => c.id === cardId)

    return inPlayer1 ? 'player1' : 'player2'
  }

  /**
   * Get current game state (synchronized)
   */
  getGameState(): GameState | null {
    return this.gameState
  }

  /**
   * Get card location
   */
  getCardLocation(cardId: string): CardLocation | null {
    return this.cardLocations.get(cardId) || null
  }

  /**
   * Play a card from hand
   */
  playCardFromHand(cardId: string, targetPosition?: BattlefieldPosition): boolean {
    const location = this.cardLocations.get(cardId)
    if (!location || location.type !== 'hand') {
      GameLogger.error(`Card ${cardId} is not in hand`)
      return false
    }

    if (targetPosition) {
      // Play directly to grid position
      return this.moveCard(cardId, { type: 'battlefield', player: targetPosition.player, slot: targetPosition.slot })
    } else {
      // Play to bench (find first empty slot)
      const player = location.player
      const benchRow = player === 'player1' ? 3 : 0

      for (let slot = 0; slot < 7; slot++) {
        const position = { player, slot }
        if (this.isPositionEmpty(position)) {
          return this.moveCard(cardId, { type: 'battlefield', player, slot })
        }
      }

      GameLogger.error('No space on bench')
      return false
    }
  }

  /**
   * Draw a card from deck to hand
   */
  drawCard(player: 'player1' | 'player2'): GameCard | null {
    if (!this.gameState) return null

    const deck = this.gameState[player].deck
    if (deck.length === 0) return null

    const card = deck[0]
    const success = this.moveCard(card.id, {
      type: 'hand',
      player,
      index: this.gameState[player].hand.length,
    })

    return success ? card : null
  }

  /**
   * Validate state consistency
   */
  validateState(): boolean {
    if (!this.gameState) return false

    let valid = true
    const foundCards = new Set<string>()

    // Check all player cards
    for (const player of [this.gameState.player1, this.gameState.player2]) {
      ;[...player.hand, ...player.deck, ...player.bench].forEach(
        card => {
          if (foundCards.has(card.id)) {
            GameLogger.error(`Duplicate card found: ${card.id}`)
            valid = false
          }
          foundCards.add(card.id)
        },
      )
    }

    // Check battlefield cards
    for (const unit of this.gameState.battlefield.playerUnits) {
      if (unit) foundCards.add(unit.id)
    }
    for (const unit of this.gameState.battlefield.enemyUnits) {
      if (unit) foundCards.add(unit.id)
    }

    // Check all tracked cards exist
    for (const cardId of this.cardLocations.keys()) {
      if (!foundCards.has(cardId)) {
        GameLogger.error(`Tracked card not in state: ${cardId}`)
        valid = false
      }
    }

    return valid
  }
}

// Singleton instance
export const stateManager = new StateManager()
