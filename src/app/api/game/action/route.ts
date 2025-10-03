import { GameLogger } from '@/lib/game_logger'
export const runtime = 'edge' // Vercel Edge Runtime for low latency

import { type NextRequest, NextResponse } from 'next/server'
import type { Card, GameState, PlayerId } from '@/schemas/schema'

// In-memory storage (would use Redis/KV in production)
const gameStates = new Map<string, GameState>()
const gameLocks = new Map<string, boolean>()

export async function POST(request: NextRequest) {
  try {
    const { gameId, playerId, action } = await request.json()

    if (!gameId || !playerId || !action) {
      return NextResponse.json(
        {
          error: 'Missing required parameters',
        },
        { status: 400 },
      )
    }

    // Acquire lock for game to prevent race conditions
    const lock = await acquireLock(`game:${gameId}`)

    try {
      // Get current state
      const currentState = gameStates.get(gameId)
      if (!currentState) {
        return NextResponse.json(
          {
            error: 'Game not found',
          },
          { status: 404 },
        )
      }

      // Validate action
      const validation = validateAction(currentState, playerId, action)
      if (!validation.valid) {
        return NextResponse.json(
          {
            error: validation.error,
          },
          { status: 400 },
        )
      }

      // Apply action server-side
      const newState = await applyAction(currentState, action, playerId)

      // Handle server-side randomness for consistency
      if (action.type === 'play_card') {
        // Ensure orientation is determined server-side for consistency
        const placedUnit = findLastPlacedUnit(newState, playerId)
        if (placedUnit) {
          placedUnit.isReversed = Math.random() < 0.5 // 50% chance
          GameLogger.system(
            `Server determined ${placedUnit.name} orientation: ${placedUnit.isReversed ? 'Reversed' : 'Upright'}`,
          )
        }
      }

      // Save state
      gameStates.set(gameId, newState)

      // Response with success
      const response = {
        success: true,
        state: newState,
        actionId: action.actionId,
        timestamp: Date.now(),
        serverOrientation:
          action.type === 'play_card'
            ? findLastPlacedUnit(newState, playerId)?.isReversed
            : undefined,
      }

      // Broadcast to other players (simplified - would use WebSocket in full implementation)
      broadcastToGame(
        gameId,
        {
          type: 'opponent_action',
          action,
          newState,
          timestamp: Date.now(),
        },
        playerId,
      )

      return NextResponse.json(response)
    } finally {
      await releaseLock(lock)
    }
  } catch (error) {
    GameLogger.error('Action processing error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
      },
      { status: 500 },
    )
  }
}

// Action validation
interface ActionValidation {
  valid: boolean
  error?: string
}

function validateAction(gameState: GameState, playerId: PlayerId, action: any): ActionValidation {
  // Basic validation
  if (gameState.activePlayer !== playerId) {
    return { valid: false, error: 'Not your turn' }
  }

  switch (action.type) {
    case 'play_card':
      return validatePlayCard(gameState, playerId, action)
    case 'declare_attack':
      return validateAttack(gameState, playerId, action)
    case 'end_turn':
      return validateEndTurn(gameState, playerId, action)
    default:
      return { valid: false, error: `Unknown action type: ${action.type}` }
  }
}

function validatePlayCard(gameState: GameState, playerId: PlayerId, action: any): ActionValidation {
  const player = gameState[playerId]

  // Find card in hand
  const card = player.hand.find(c => c.id === action.cardId)
  if (!card) {
    return { valid: false, error: 'Card not found in hand' }
  }

  // Check mana
  const totalMana = player.mana + player.spellMana
  if (card.cost > totalMana) {
    return { valid: false, error: 'Insufficient mana' }
  }

  // Check battlefield space for units
  if (card.type === 'unit') {
    const units =
      playerId === 'player1' ? gameState.battlefield.playerUnits : gameState.battlefield.enemyUnits

    const targetSlot = action.targetSlot
    if (targetSlot !== undefined) {
      if (targetSlot < 0 || targetSlot >= 7 || units[targetSlot] !== null) {
        return { valid: false, error: 'Invalid battlefield slot' }
      }
    } else {
      // Check if there's any empty slot
      const hasEmptySlot = units.some(u => u === null)
      if (!hasEmptySlot) {
        return { valid: false, error: 'Battlefield is full' }
      }
    }
  }

  return { valid: true }
}

function validateAttack(gameState: GameState, playerId: PlayerId, action: any): ActionValidation {
  // Find attacker
  const units =
    playerId === 'player1' ? gameState.battlefield.playerUnits : gameState.battlefield.enemyUnits

  const attacker = units.find(u => u?.id === action.attackerId)
  if (!attacker) {
    return { valid: false, error: 'Attacker not found' }
  }

  // Check if can attack
  if (attacker.hasSummoningSickness) {
    return { valid: false, error: 'Unit has summoning sickness' }
  }

  if (attacker.hasAttackedThisTurn) {
    return { valid: false, error: 'Unit already attacked this turn' }
  }

  // Validate target
  if (action.targetType === 'unit' && action.targetId) {
    const opponent = playerId === 'player1' ? 'player2' : 'player1'
    const enemyUnits =
      opponent === 'player1' ? gameState.battlefield.playerUnits : gameState.battlefield.enemyUnits

    const target = enemyUnits.find(u => u?.id === action.targetId)
    if (!target) {
      return { valid: false, error: 'Target not found' }
    }
  }

  return { valid: true }
}

function validateEndTurn(
  gameState: GameState,
  _playerId: PlayerId,
  _action: any,
): ActionValidation {
  if (gameState.phase !== 'action') {
    return { valid: false, error: 'Cannot end turn in current phase' }
  }

  return { valid: true }
}

// Action application
async function applyAction(
  gameState: GameState,
  action: any,
  playerId: PlayerId,
): Promise<GameState> {
  let newState = { ...gameState }

  switch (action.type) {
    case 'play_card':
      newState = await applyPlayCard(newState, action, playerId)
      break
    case 'declare_attack':
      newState = await applyAttack(newState, action, playerId)
      break
    case 'end_turn':
      newState = await applyEndTurn(newState, playerId)
      break
  }

  return newState
}

async function applyPlayCard(
  gameState: GameState,
  action: any,
  playerId: PlayerId,
): Promise<GameState> {
  // Import game logic dynamically
  const { playCard } = await import('@/lib/game_logic')

  const player = gameState[playerId]
  const card = player.hand.find(c => c.id === action.cardId)

  if (!card) throw new Error('Card not found')

  return await playCard(gameState, card, action.targetSlot)
}

async function applyAttack(
  gameState: GameState,
  action: any,
  _playerId: PlayerId,
): Promise<GameState> {
  const { declareAttack } = await import('@/lib/combat_logic')

  return await declareAttack(gameState, {
    attackerId: action.attackerId,
    targetType: action.targetType,
    targetId: action.targetId,
  })
}

async function applyEndTurn(gameState: GameState, _playerId: PlayerId): Promise<GameState> {
  const { endTurn } = await import('@/lib/game_logic')
  return await endTurn(gameState)
}

// Utility functions
async function acquireLock(lockKey: string): Promise<string> {
  // Simple in-memory locking (would use Redis in production)
  let attempts = 0
  const maxAttempts = 50 // 5 seconds max wait

  while (gameLocks.get(lockKey) && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 100))
    attempts++
  }

  if (attempts >= maxAttempts) {
    throw new Error('Failed to acquire lock')
  }

  gameLocks.set(lockKey, true)
  return lockKey
}

async function releaseLock(lockKey: string): Promise<void> {
  gameLocks.delete(lockKey)
}

function findLastPlacedUnit(gameState: GameState, playerId: PlayerId): Card | null {
  const units =
    playerId === 'player1' ? gameState.battlefield.playerUnits : gameState.battlefield.enemyUnits

  // Find the most recently placed unit (would need better tracking in production)
  for (let i = 0; i < units.length; i++) {
    if (units[i]?.owner === playerId) {
      return units[i]
    }
  }

  return null
}

function broadcastToGame(gameId: string, message: any, _excludePlayerId: PlayerId): void {
  // Simplified broadcast (would use WebSocket connections in full implementation)
  GameLogger.system(`Broadcasting to game ${gameId}:`, message.type)
  // TODO: Integrate with WebSocket service when available
}
