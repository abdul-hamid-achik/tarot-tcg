import { useEffect } from 'react'
import { useAITurn } from '@/hooks/use_ai_turn'
import { useGameActions } from '@/hooks/use_game_actions'
import { gridManagerService } from '@/services/grid_manager_service'
import { interactionService } from '@/services/interaction_service'
import { useGameStore } from '@/store/game_store'

// This hook centralizes all game side effects and logic
export const useGameEffects = () => {
  const {
    gameState,
    setGameState,
    highlightCells,
    clearHighlights,
    setValidDropZones,
    clearValidDropZones,
  } = useGameStore()

  const { playCard, declareDefenders, resolveCombat } = useGameActions()

  const { executeAIDefense } = useAITurn()

  // Initialize game state and services
  useEffect(() => {
    if (gameState) {
      gridManagerService.initializeFromGameState(gameState)
    }
  }, [gameState])

  // Setup interaction service callbacks
  useEffect(() => {
    interactionService.setCallbacks({
      onCardSelect: (card, position) => {
        if (card?.name) {
          console.log('Card selected:', card.name, 'at', position)
        }
      },

      onCardMove: async (card, from, to) => {
        if (card?.name) {
          console.log('Moving card:', card.name, 'from', from, 'to', to)
        }

        if (from === 'hand') {
          await playCard(card, to)
        } else {
          gridManagerService.executeMove({
            card,
            from,
            to,
            cost: 0,
          })
        }
      },

      onCardAttack: (card, from, to) => {
        if (card?.name) {
          console.log('Card attacking:', card.name, 'from', from, 'to', to)
        }
      },

      onCellHighlight: (positions, type) => {
        highlightCells(positions)
        if (type === 'valid') {
          setValidDropZones(positions)
        }
      },

      onClearHighlights: () => {
        clearHighlights()
        clearValidDropZones()
      },

      onShowTooltip: (message, position) => {
        console.log('Tooltip:', message, 'at', position)
      },

      onHideTooltip: () => {
        // Hide tooltip
      },

      canDragCard: (_card, _from) => {
        return !!gameState && gameState.activePlayer === 'player1' && gameState.phase === 'action'
      },

      getValidDropZones: (card, from) => {
        if (!gameState) return []
        return gridManagerService.getValidDropZones(card, from, gameState)
      },

      canDropOn: (to, card, from) => {
        if (!gameState) return false
        const validation = gridManagerService.validateMove(card, from, to, gameState)
        return validation.valid
      },
    })
  }, [gameState, playCard, highlightCells, clearHighlights, setValidDropZones, clearValidDropZones])

  // Handle AI defender phase
  useEffect(() => {
    if (!gameState) return

    if (
      gameState.phase === 'declare_defenders' &&
      gameState.activePlayer === 'player2' &&
      gameState.attackingPlayer === 'player1'
    ) {
      const defenderAssignments = executeAIDefense(gameState)
      if (defenderAssignments.length > 0 || gameState.lanes.some(l => l.attacker)) {
        // Use a small delay for visual feedback
        setTimeout(() => {
          declareDefenders(defenderAssignments)
        }, 1000)
      }
    }
  }, [gameState, executeAIDefense, declareDefenders])

  // Auto-resolve combat
  useEffect(() => {
    if (gameState?.phase === 'combat' && !gameState?.combatResolved) {
      setTimeout(() => {
        resolveCombat()
      }, 1500)
    }
  }, [gameState, resolveCombat])

  return {
    gameState,
  }
}
