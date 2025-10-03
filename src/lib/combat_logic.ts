import { GameLogger } from '@/lib/game_logger'
import type { Card, GameState, PlayerId } from '@/schemas/schema'

// Simple battlefield helpers
function getPlayerUnits(gameState: GameState, playerId: 'player1' | 'player2'): Card[] {
  const units =
    playerId === 'player1' ? gameState.battlefield.playerUnits : gameState.battlefield.enemyUnits
  return units.filter(u => u !== null) as Card[]
}

function getUnitAt(battlefield: any, slot: number, playerId: 'player1' | 'player2'): Card | null {
  const units = playerId === 'player1' ? battlefield.playerUnits : battlefield.enemyUnits
  return units[slot] || null
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

/**
 * Direct Attack System for Hearthstone-style combat
 * No defenders phase - attacks are resolved immediately
 */

export interface DirectAttack {
  attackerId: string
  targetType: 'unit' | 'player'
  targetId?: string
}

export async function declareAttack(state: GameState, attack: DirectAttack): Promise<GameState> {
  const newState = { ...state }
  const attackingPlayer = state.activePlayer
  const player = state[attackingPlayer]

  // Validate attack token (Hearthstone-style combat)
  if (!player.hasAttackToken) {
    throw new Error('You do not have the attack token this round')
  }

  // Find attacker on battlefield
  const attackerPos = findUnitPosition(state.battlefield, attack.attackerId)
  if (!attackerPos) throw new Error('Attacker not found')

  const attacker = getUnitAt(state.battlefield, attackerPos.slot, attackerPos.player)
  if (!attacker) throw new Error('Invalid attacker')

  // Validate ownership - attacker must belong to active player
  if (attacker.owner !== attackingPlayer) {
    throw new Error(`Cannot attack with opponent's unit`)
  }

  // Validate can attack
  if (attacker.hasSummoningSickness) {
    throw new Error('Summoning sickness')
  }
  if (attacker.hasAttackedThisTurn) {
    throw new Error('Already attacked')
  }

  // Check taunt
  const opponent = state.activePlayer === 'player1' ? 'player2' : 'player1'
  const tauntUnits = getUnitsWithKeyword(state.battlefield, opponent, 'taunt')

  if (tauntUnits.length > 0 && attack.targetType === 'player') {
    throw new Error('Must attack taunt first')
  }

  // Execute attack
  if (attack.targetType === 'unit' && attack.targetId) {
    // Unit combat
    const targetPos = findUnitPosition(state.battlefield, attack.targetId)
    if (!targetPos) throw new Error('Target not found')

    const target = getUnitAt(state.battlefield, targetPos.slot, targetPos.player)
    if (!target) throw new Error('Invalid target')

    // Simultaneous damage (Hearthstone-style)
    const attackerDamage = attacker.attack || 0
    const defenderDamage = target.attack || 0

    // Apply damage
    attacker.currentHealth = (attacker.currentHealth || attacker.health) - defenderDamage
    target.currentHealth = (target.currentHealth || target.health) - attackerDamage

    GameLogger.combat(`${attacker.name} (${attackerDamage}) vs ${target.name} (${defenderDamage})`)

    // Process deaths
    if (attacker.currentHealth <= 0) {
      removeUnitFromBattlefield(newState, attackerPos.player, attacker.id)
      GameLogger.combat(`${attacker.name} dies in combat`)
    }
    if (target.currentHealth <= 0) {
      removeUnitFromBattlefield(newState, targetPos.player, target.id)
      GameLogger.combat(`${target.name} dies in combat`)
    }
  } else if (attack.targetType === 'player') {
    // Face damage
    const damage = attacker.attack || 0
    newState[opponent].health -= damage
    GameLogger.combat(`${attacker.name} deals ${damage} damage to ${opponent}`)
  }

  // Mark as attacked
  attacker.hasAttackedThisTurn = true

  return newState
}

// Helper functions
function findUnitPosition(
  battlefield: any,
  unitId: string,
): { player: 'player1' | 'player2'; slot: number } | null {
  // Check player1 units
  for (let i = 0; i < battlefield.playerUnits.length; i++) {
    if (battlefield.playerUnits[i]?.id === unitId) {
      return { player: 'player1', slot: i }
    }
  }

  // Check player2 units
  for (let i = 0; i < battlefield.enemyUnits.length; i++) {
    if (battlefield.enemyUnits[i]?.id === unitId) {
      return { player: 'player2', slot: i }
    }
  }

  return null
}

function getUnitsWithKeyword(
  battlefield: any,
  playerId: 'player1' | 'player2',
  keyword: string,
): any[] {
  const units = getPlayerUnits({ battlefield } as any, playerId)
  return units.filter(
    unit =>
      unit.keywords?.includes(keyword) ||
      unit.keywords?.includes(keyword.charAt(0).toUpperCase() + keyword.slice(1)),
  )
}

export function canAttack(unit: Card): boolean {
  if (!unit) return false

  // Basic attack validation
  if (unit.hasSummoningSickness) return false
  if (unit.hasAttackedThisTurn) return false
  if ((unit.currentHealth || unit.health) <= 0) return false

  return true
}

export function getValidAttackTargets(
  state: GameState,
  attackingPlayer: PlayerId,
): { units: Card[]; canTargetPlayer: boolean } {
  const opponent = attackingPlayer === 'player1' ? 'player2' : 'player1'
  const enemyUnits = getPlayerUnits(state, opponent)

  // Check for taunt units
  const tauntUnits = enemyUnits.filter(
    unit => unit.keywords?.includes('taunt') || unit.keywords?.includes('Taunt'),
  )

  return {
    units: tauntUnits.length > 0 ? tauntUnits : enemyUnits,
    canTargetPlayer: tauntUnits.length === 0, // Can only target player if no taunt units
  }
}

/**
 * Calculate combat damage preview without executing
 */
export function previewCombat(
  attacker: Card,
  defender: Card,
): {
  attackerSurvives: boolean
  defenderSurvives: boolean
  attackerHealthRemaining: number
  defenderHealthRemaining: number
} {
  const attackerDamage = attacker.attack || 0
  const defenderDamage = defender.attack || 0

  const attackerHealthRemaining = (attacker.currentHealth || attacker.health) - defenderDamage
  const defenderHealthRemaining = (defender.currentHealth || defender.health) - attackerDamage

  return {
    attackerSurvives: attackerHealthRemaining > 0,
    defenderSurvives: defenderHealthRemaining > 0,
    attackerHealthRemaining: Math.max(0, attackerHealthRemaining),
    defenderHealthRemaining: Math.max(0, defenderHealthRemaining),
  }
}
