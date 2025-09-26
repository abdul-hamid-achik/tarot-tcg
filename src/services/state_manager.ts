import type { Card, GameState, PlayerId } from '@/schemas/schema'

// Simple battlefield helpers inlined
function getPlayerUnits(gameState: GameState, playerId: 'player1' | 'player2'): Card[] {
    const units = playerId === 'player1'
        ? gameState.battlefield.playerUnits
        : gameState.battlefield.enemyUnits
    return units.filter(u => u !== null) as Card[]
}

/**
 * Simple State Manager for Battlefield-Only System
 * Clean, focused implementation without legacy baggage
 */
export class StateManager {
    private gameState: GameState | null = null

    // Initialize the state manager
    initialize(gameState: GameState): void {
        this.gameState = { ...gameState }
    }

    // Get current game state
    getGameState(): GameState | null {
        return this.gameState
    }

    // Play a card from hand
    playCardFromHand(cardId: string, targetSlot?: number): boolean {
        if (!this.gameState) return false

        const player = this.gameState[this.gameState.activePlayer]
        const card = player.hand.find(c => c.id === cardId)

        if (!card) return false

        // Remove from hand
        player.hand = player.hand.filter(c => c.id !== cardId)

        // Place on battlefield if it's a unit
        if (card.type === 'unit') {
            const units = this.gameState.activePlayer === 'player1'
                ? this.gameState.battlefield.playerUnits
                : this.gameState.battlefield.enemyUnits

            // Find target slot
            const slot = targetSlot !== undefined
                ? targetSlot
                : units.findIndex(u => u === null)

            if (slot === -1 || slot >= units.length || units[slot] !== null) {
                return false
            }

            // Place unit with runtime properties
            units[slot] = {
                ...card,
                currentHealth: card.health,
                owner: this.gameState.activePlayer,
                hasSummoningSickness: true,
                hasAttackedThisTurn: false,
            }

            return true
        }

        // Handle spells (cast immediately)
        return true
    }

    // Draw a card for a player
    drawCard(playerId: PlayerId): Card | null {
        if (!this.gameState) return null

        const player = this.gameState[playerId]
        if (player.deck.length === 0) return null

        const drawnCard = player.deck.shift()!
        player.hand.push(drawnCard)

        return drawnCard
    }

    // Get card owner
    getCardOwner(cardId: string): PlayerId | null {
        if (!this.gameState) return null

        // Check player1
        const inPlayer1Hand = this.gameState.player1.hand.some(c => c.id === cardId)
        const inPlayer1Deck = this.gameState.player1.deck.some(c => c.id === cardId)
        const inPlayer1Battlefield = this.gameState.battlefield.playerUnits.some(u => u?.id === cardId)

        if (inPlayer1Hand || inPlayer1Deck || inPlayer1Battlefield) {
            return 'player1'
        }

        // Check player2  
        const inPlayer2Hand = this.gameState.player2.hand.some(c => c.id === cardId)
        const inPlayer2Deck = this.gameState.player2.deck.some(c => c.id === cardId)
        const inPlayer2Battlefield = this.gameState.battlefield.enemyUnits.some(u => u?.id === cardId)

        if (inPlayer2Hand || inPlayer2Deck || inPlayer2Battlefield) {
            return 'player2'
        }

        return null
    }

    // Reset state manager
    reset(): void {
        this.gameState = null
    }
}

// Export singleton instance
export const stateManager = new StateManager()