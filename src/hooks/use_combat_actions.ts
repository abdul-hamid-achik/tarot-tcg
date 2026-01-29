import { useCallback } from 'react'
import { canAttack, declareAttack } from '@/services/combat_service'
import { GameLogger } from '@/lib/game_logger'
import type { Card } from '@/schemas/schema'
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
        // Execute the attack using the combat system
        const newState = await declareAttack(gameState, {
          attackerId: interaction.attackSource,
          targetType,
          targetId: targetType === 'unit' ? targetId : undefined,
        })

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
