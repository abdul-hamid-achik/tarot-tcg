import { useCallback } from 'react'
import { GameLogger } from '@/lib/game_logger'
import type { Card } from '@/schemas/schema'
import { combatAnimationService } from '@/services/combat_animation_service'
import { canAttack, declareAttack } from '@/services/combat_service'
import { useGameStore } from '@/store/game_store'

function attackBlockReason(unit: Card, hasAttackToken: boolean): string | null {
  if (!hasAttackToken) return 'You do not have the attack token this round'
  if (!canAttack(unit)) {
    if (unit.hasSummoningSickness) return `${unit.name} cannot attack until next round`
    if (unit.hasAttackedThisTurn) return `${unit.name} already attacked`
    return `${unit.name} cannot attack`
  }
  return null
}

/**
 * Direct-attack interactions. Reads fresh store state inside handlers so
 * targeting is not resolved against a stale board.
 */
export function useCombatActions() {
  const interaction = useGameStore(state => state.interaction)
  const startAttack = useGameStore(state => state.startAttack)
  const cancelAttack = useGameStore(state => state.cancelAttack)
  const setGameState = useGameStore(state => state.setGameState)
  const showError = useGameStore(state => state.showError)

  const handleUnitClick = useCallback(
    (unit: Card) => {
      const { gameState } = useGameStore.getState()
      if (!gameState) return

      const owner = unit.owner ?? gameState.activePlayer
      if (owner !== gameState.activePlayer) {
        return
      }

      const attacker = gameState[gameState.activePlayer]
      const reason = attackBlockReason(unit, Boolean(attacker?.hasAttackToken))
      if (reason) {
        showError(reason)
        GameLogger.action(`${unit.name} cannot attack`, { reason })
        return
      }

      startAttack(unit.id)
      GameLogger.action(`Started attack with ${unit.name}`)
    },
    [startAttack, showError],
  )

  const handleTargetClick = useCallback(
    async (targetId: string, targetType: 'unit' | 'player') => {
      const store = useGameStore.getState()
      const { gameState, interaction: live } = store
      if (!live.attackSource || !gameState) {
        GameLogger.action('No attack source selected')
        return
      }

      try {
        const attackerSlot = gameState.battlefield.playerUnits.findIndex(
          u => u?.id === live.attackSource,
        )
        if (targetType === 'unit') {
          const targetSlot = gameState.battlefield.enemyUnits.findIndex(u => u?.id === targetId)
          if (attackerSlot >= 0 && targetSlot >= 0) {
            combatAnimationService.triggerAttack(attackerSlot, 'player2', targetSlot)
          }
        }

        const newState = await declareAttack(gameState, {
          attackerId: live.attackSource,
          targetType,
          targetId: targetType === 'unit' ? targetId : undefined,
        })

        if (targetType === 'unit') {
          const targetSlot = gameState.battlefield.enemyUnits.findIndex(u => u?.id === targetId)
          if (targetSlot >= 0) {
            const prevUnit = gameState.battlefield.enemyUnits[targetSlot]
            const currUnit = newState.battlefield.enemyUnits[targetSlot]
            const prevHp = prevUnit?.currentHealth ?? prevUnit?.health ?? 0
            const currHp = currUnit?.currentHealth ?? currUnit?.health ?? 0
            if (currUnit && currHp < prevHp) {
              combatAnimationService.triggerDamage('player2', targetSlot, prevHp - currHp)
            }
            if (!currUnit && prevUnit) {
              combatAnimationService.triggerDeath('player2', targetSlot)
            }
          }
          if (attackerSlot >= 0) {
            const prevAtk = gameState.battlefield.playerUnits[attackerSlot]
            const currAtk = newState.battlefield.playerUnits[attackerSlot]
            const prevHp = prevAtk?.currentHealth ?? prevAtk?.health ?? 0
            const currHp = currAtk?.currentHealth ?? currAtk?.health ?? 0
            if (currAtk && currHp < prevHp) {
              combatAnimationService.triggerDamage('player1', attackerSlot, prevHp - currHp)
            }
            if (!currAtk && prevAtk) {
              combatAnimationService.triggerDeath('player1', attackerSlot)
            }
          }
        } else {
          const prevHealth = gameState.player2.health
          const currHealth = newState.player2.health
          if (currHealth < prevHealth) {
            combatAnimationService.triggerNexusDamage('player2', prevHealth - currHealth)
          }
        }

        setGameState(newState)
        cancelAttack()
        GameLogger.action(`Attack executed against ${targetType === 'player' ? targetId : 'unit'}`)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Attack failed'
        showError(message)
        GameLogger.action(`Attack failed: ${message}`)
        cancelAttack()
      }
    },
    [cancelAttack, setGameState, showError],
  )

  const handleCancelAttack = useCallback(() => {
    if (interaction.attackSource) {
      GameLogger.action('Attack cancelled')
      cancelAttack()
    }
  }, [interaction.attackSource, cancelAttack])

  const isValidTarget = useCallback(
    (targetId: string): boolean => interaction.validAttackTargets.has(targetId),
    [interaction.validAttackTargets],
  )

  const isAttacking = useCallback(
    (unitId: string): boolean => interaction.attackSource === unitId,
    [interaction.attackSource],
  )

  const isInTargetingMode = useCallback(
    (): boolean => interaction.targetingMode === 'attack',
    [interaction.targetingMode],
  )

  return {
    handleUnitClick,
    handleTargetClick,
    handleCancelAttack,
    isValidTarget,
    isAttacking,
    isInTargetingMode,
    attackSource: interaction.attackSource,
    validTargets: interaction.validAttackTargets,
    targetingMode: interaction.targetingMode,
  }
}
