import { useCallback } from 'react'
import { GameLogger } from '@/lib/game_logger'
import type { Card } from '@/schemas/schema'
import { combatAnimationService } from '@/services/combat_animation_service'
import { canAttack, declareAttack } from '@/services/combat_service'
import { useGameStore } from '@/store/game_store'

/**
 * Hook for managing direct attack interactions
 * Provides Hearthstone-style combat actions
 */
export function useCombatActions() {
  const { gameState, interaction, startAttack, executeAttack, cancelAttack, setGameState } =
    useGameStore()

  const handleUnitClick = useCallback(
    (unit: Card) => {
      // Check if unit can attack
      if (!canAttack(unit)) {
        GameLogger.action(`${unit.name} cannot attack`, {
          hasSummoningSickness: unit.hasSummoningSickness,
          hasAttackedThisTurn: unit.hasAttackedThisTurn,
          health: unit.currentHealth || unit.health,
        })
        return
      }

      // Check if it's the unit's owner's turn
      if (unit.owner !== gameState.activePlayer) {
        GameLogger.action(`Cannot attack with opponent's unit: ${unit.name}`)
        return
      }

      // Start attack targeting mode
      startAttack(unit.id)
      GameLogger.action(`Started attack with ${unit.name}`)
    },
    [startAttack, gameState.activePlayer],
  )

  const handleTargetClick = useCallback(
    async (targetId: string, targetType: 'unit' | 'player') => {
      if (!interaction.attackSource) {
        GameLogger.action('No attack source selected')
        return
      }

      try {
        // Trigger attack animation before state update
        const attackerSlot = gameState.battlefield.playerUnits.findIndex(
          u => u?.id === interaction.attackSource,
        )
        if (targetType === 'unit') {
          const targetSlot = gameState.battlefield.enemyUnits.findIndex(u => u?.id === targetId)
          if (attackerSlot >= 0 && targetSlot >= 0) {
            combatAnimationService.triggerAttack(attackerSlot, 'player2', targetSlot)
          }
        }

        // Execute the attack using the combat system
        const newState = await declareAttack(gameState, {
          attackerId: interaction.attackSource,
          targetType,
          targetId: targetType === 'unit' ? targetId : undefined,
        })

        // Trigger damage/death animations by diffing states
        if (targetType === 'unit') {
          const targetSlot = gameState.battlefield.enemyUnits.findIndex(u => u?.id === targetId)
          if (targetSlot >= 0) {
            const prevUnit = gameState.battlefield.enemyUnits[targetSlot]
            const currUnit = newState.battlefield.enemyUnits[targetSlot]
            const prevHp = prevUnit?.currentHealth ?? prevUnit?.health ?? 0
            const currHp = currUnit?.currentHealth ?? currUnit?.health ?? 0
            if (currUnit && currHp < prevHp) {
              setTimeout(
                () => combatAnimationService.triggerDamage('player2', targetSlot, prevHp - currHp),
                300,
              )
            }
            if (!currUnit && prevUnit) {
              setTimeout(() => combatAnimationService.triggerDeath('player2', targetSlot), 300)
            }
          }
          // Check if attacker took damage (from retaliation)
          if (attackerSlot >= 0) {
            const prevAtk = gameState.battlefield.playerUnits[attackerSlot]
            const currAtk = newState.battlefield.playerUnits[attackerSlot]
            const prevHp = prevAtk?.currentHealth ?? prevAtk?.health ?? 0
            const currHp = currAtk?.currentHealth ?? currAtk?.health ?? 0
            if (currAtk && currHp < prevHp) {
              setTimeout(
                () =>
                  combatAnimationService.triggerDamage('player1', attackerSlot, prevHp - currHp),
                300,
              )
            }
            if (!currAtk && prevAtk) {
              setTimeout(() => combatAnimationService.triggerDeath('player1', attackerSlot), 300)
            }
          }
        } else {
          // Nexus damage
          const prevHealth = gameState.player2.health
          const currHealth = newState.player2.health
          if (currHealth < prevHealth) {
            setTimeout(
              () => combatAnimationService.triggerNexusDamage('player2', prevHealth - currHealth),
              300,
            )
          }
        }

        // Update game state
        setGameState(newState)

        // Clear attack state
        executeAttack(targetId, targetType)

        GameLogger.action(`Attack executed against ${targetType === 'player' ? targetId : 'unit'}`)
      } catch (error) {
        GameLogger.action(`Attack failed: ${error}`)
        cancelAttack()
      }
    },
    [interaction.attackSource, gameState, setGameState, executeAttack, cancelAttack],
  )

  const handleCancelAttack = useCallback(() => {
    if (interaction.attackSource) {
      GameLogger.action('Attack cancelled')
      cancelAttack()
    }
  }, [interaction.attackSource, cancelAttack])

  const isValidTarget = useCallback(
    (targetId: string): boolean => {
      return interaction.validAttackTargets.has(targetId)
    },
    [interaction.validAttackTargets],
  )

  const isAttacking = useCallback(
    (unitId: string): boolean => {
      return interaction.attackSource === unitId
    },
    [interaction.attackSource],
  )

  const isInTargetingMode = useCallback((): boolean => {
    return interaction.targetingMode === 'attack'
  }, [interaction.targetingMode])

  return {
    // Action handlers
    handleUnitClick,
    handleTargetClick,
    handleCancelAttack,

    // State queries
    isValidTarget,
    isAttacking,
    isInTargetingMode,

    // Current state
    attackSource: interaction.attackSource,
    validTargets: interaction.validAttackTargets,
    targetingMode: interaction.targetingMode,
  }
}
