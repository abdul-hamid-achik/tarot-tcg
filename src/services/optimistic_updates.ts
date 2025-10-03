import { GameLogger } from '@/lib/game_logger'
import type { Card, GameState, PlayerId } from '@/schemas/schema'

export interface OptimisticAction {
  id: string
  type: 'play_card' | 'declare_attack' | 'end_turn'
  playerId: PlayerId
  originalState: GameState
  optimisticState: GameState
  timestamp: number
  confirmed: boolean
  reverted: boolean
}

export interface ActionResult {
  success: boolean
  actionId: string
  serverState?: GameState
  error?: string
}

/**
 * Manages optimistic updates for smooth multiplayer experience
 * Tracks pending actions and reconciles with server state
 */
export class OptimisticUpdateService {
  private pendingActions = new Map<string, OptimisticAction>()
  private confirmationTimeouts = new Map<string, NodeJS.Timeout>()
  private readonly CONFIRMATION_TIMEOUT = 5000 // 5 seconds

  /**
   * Apply an optimistic update
   */
  applyOptimistic(
    actionId: string,
    actionType: OptimisticAction['type'],
    playerId: PlayerId,
    originalState: GameState,
    optimisticState: GameState,
  ): void {
    const action: OptimisticAction = {
      id: actionId,
      type: actionType,
      playerId,
      originalState: { ...originalState },
      optimisticState: { ...optimisticState },
      timestamp: Date.now(),
      confirmed: false,
      reverted: false,
    }

    this.pendingActions.set(actionId, action)

    // Set timeout for automatic revert if not confirmed
    const timeout = setTimeout(() => {
      this.revertAction(actionId, 'timeout')
    }, this.CONFIRMATION_TIMEOUT)

    this.confirmationTimeouts.set(actionId, timeout)

    GameLogger.action(`Applied optimistic ${actionType} (${actionId})`)
  }

  /**
   * Confirm an action when server responds
   */
  confirmAction(actionId: string, serverState?: GameState): ActionResult {
    const action = this.pendingActions.get(actionId)
    if (!action) {
      return { success: false, actionId, error: 'Action not found' }
    }

    // Clear timeout
    const timeout = this.confirmationTimeouts.get(actionId)
    if (timeout) {
      clearTimeout(timeout)
      this.confirmationTimeouts.delete(actionId)
    }

    // Mark as confirmed
    action.confirmed = true
    this.pendingActions.delete(actionId)

    GameLogger.action(`Confirmed ${action.type} (${actionId})`)

    return {
      success: true,
      actionId,
      serverState,
    }
  }

  /**
   * Revert an action (due to server rejection or timeout)
   */
  revertAction(actionId: string, reason: 'timeout' | 'rejected' | 'manual'): ActionResult {
    const action = this.pendingActions.get(actionId)
    if (!action) {
      return { success: false, actionId, error: 'Action not found' }
    }

    // Clear timeout
    const timeout = this.confirmationTimeouts.get(actionId)
    if (timeout) {
      clearTimeout(timeout)
      this.confirmationTimeouts.delete(actionId)
    }

    // Mark as reverted
    action.reverted = true
    this.pendingActions.delete(actionId)

    GameLogger.action(`Reverted ${action.type} (${actionId}) - ${reason}`)

    return {
      success: true,
      actionId,
      serverState: action.originalState,
    }
  }

  /**
   * Reconcile optimistic state with authoritative server state
   */
  reconcileWithServer(serverState: GameState): GameState {
    let reconciledState = { ...serverState }

    // Apply any unconfirmed optimistic updates that don't conflict
    for (const [actionId, action] of this.pendingActions) {
      if (!action.confirmed && !action.reverted) {
        // Check if optimistic update conflicts with server state
        const hasConflict = this.detectConflict(action, serverState)

        if (hasConflict) {
          GameLogger.action(`Conflict detected for ${actionId}, reverting`)
          this.revertAction(actionId, 'rejected')
        } else {
          // Re-apply non-conflicting optimistic changes
          reconciledState = this.reapplyOptimistic(action, reconciledState)
          GameLogger.action(`Re-applied optimistic ${action.type} (${actionId})`)
        }
      }
    }

    return reconciledState
  }

  /**
   * Get pending actions count
   */
  getPendingCount(): number {
    return this.pendingActions.size
  }

  /**
   * Get all pending actions
   */
  getPendingActions(): OptimisticAction[] {
    return Array.from(this.pendingActions.values())
  }

  /**
   * Clear all pending actions (emergency reset)
   */
  clearPending(): void {
    // Clear all timeouts
    for (const timeout of this.confirmationTimeouts.values()) {
      clearTimeout(timeout)
    }

    this.confirmationTimeouts.clear()
    this.pendingActions.clear()

    GameLogger.action('Cleared all pending optimistic actions')
  }

  // Private helper methods
  private detectConflict(action: OptimisticAction, serverState: GameState): boolean {
    switch (action.type) {
      case 'play_card':
        return this.detectPlayCardConflict(action, serverState)
      case 'declare_attack':
        return this.detectAttackConflict(action, serverState)
      case 'end_turn':
        return this.detectTurnConflict(action, serverState)
      default:
        return false
    }
  }

  private detectPlayCardConflict(action: OptimisticAction, serverState: GameState): boolean {
    // Check if the card was played differently on server
    const player = serverState[action.playerId]
    const optimisticPlayer = action.optimisticState[action.playerId]

    // Simple conflict detection: hand size changed differently than expected
    return Math.abs(player.hand.length - optimisticPlayer.hand.length) > 1
  }

  private detectAttackConflict(action: OptimisticAction, serverState: GameState): boolean {
    // Check if units involved in attack have different states
    const _playerUnits =
      action.playerId === 'player1'
        ? serverState.battlefield.playerUnits
        : serverState.battlefield.enemyUnits

    // Look for major differences in unit states
    return false // Simplified for now
  }

  private detectTurnConflict(action: OptimisticAction, serverState: GameState): boolean {
    // Check if turn state conflicts
    return serverState.activePlayer !== action.optimisticState.activePlayer
  }

  private reapplyOptimistic(action: OptimisticAction, _baseState: GameState): GameState {
    // Re-apply the optimistic changes on top of server state
    // This is simplified - in production would need more sophisticated merging
    return action.optimisticState
  }
}

// Singleton instance
export const optimisticUpdateService = new OptimisticUpdateService()

// Specific optimistic update functions
export function createOptimisticPlayCard(
  gameState: GameState,
  card: Card,
  targetSlot?: number,
): GameState {
  const newState = { ...gameState }
  const player = { ...newState[newState.activePlayer] }

  // Remove card from hand
  player.hand = player.hand.filter(c => c.id !== card.id)

  // Pay mana
  const manaToUse = Math.min(player.mana, card.cost)
  const spellManaToUse = card.cost - manaToUse

  player.mana -= manaToUse
  player.spellMana -= spellManaToUse

  // Place unit on battlefield if applicable
  if (card.type === 'unit' && targetSlot !== undefined) {
    const units =
      newState.activePlayer === 'player1'
        ? newState.battlefield.playerUnits
        : newState.battlefield.enemyUnits

    if (units[targetSlot] === null) {
      units[targetSlot] = {
        ...card,
        currentHealth: card.health,
        owner: newState.activePlayer,
        hasSummoningSickness: true,
        hasAttackedThisTurn: false,
        // Note: Orientation will be determined by server
        isReversed: false, // Placeholder - server will determine
      }
    }
  }

  newState[newState.activePlayer] = player
  return newState
}

export function createOptimisticAttack(
  gameState: GameState,
  attackerId: string,
  targetType: 'unit' | 'player',
  _targetId?: string,
): GameState {
  const newState = { ...gameState }

  // Mark attacker as having attacked
  const playerUnits =
    newState.activePlayer === 'player1'
      ? newState.battlefield.playerUnits
      : newState.battlefield.enemyUnits

  for (let i = 0; i < playerUnits.length; i++) {
    if (playerUnits[i]?.id === attackerId) {
      playerUnits[i] = {
        ...playerUnits[i]!,
        hasAttackedThisTurn: true,
      }
      break
    }
  }

  // If attacking player, optimistically reduce health
  if (targetType === 'player') {
    const attacker = playerUnits.find(u => u?.id === attackerId)
    if (attacker) {
      const opponent = newState.activePlayer === 'player1' ? 'player2' : 'player1'
      newState[opponent].health -= attacker.attack || 0
    }
  }

  return newState
}

export function createOptimisticEndTurn(gameState: GameState): GameState {
  const newState = { ...gameState }

  // Switch active player
  newState.activePlayer = newState.activePlayer === 'player1' ? 'player2' : 'player1'
  newState.turn += 1

  // Every 2 turns = new round
  if (newState.turn % 2 === 1) {
    newState.round += 1
  }

  return newState
}
