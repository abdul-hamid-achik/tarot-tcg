import { useEffect } from 'react'
import { aiService } from '@/services/ai_service'
import { useGameActions } from '@/hooks/use_game_actions'
import { stateManager } from '@/services/state_manager'
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

  // AI defense will be handled by AI service

  // Initialize state manager
  useEffect(() => {
    if (gameState) {
      stateManager.initialize(gameState)
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
          // Use state manager to move card
          if (from !== 'hand') {
            stateManager.moveCard(card.id, { type: 'grid', position: to })
          }
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
        // Simple validation - allow empty positions for now
        const validPositions = []
        for (let row = 0; row < 4; row++) {
          for (let col = 0; col < 6; col++) {
            const position = { row, col }
            if (stateManager.isPositionEmpty(position)) {
              validPositions.push(position)
            }
          }
        }
        return validPositions
      },

      canDropOn: (to, card, from) => {
        if (!gameState) return false
        // Basic validation - check if position is empty
        return stateManager.isPositionEmpty(to)
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
      // Simple AI defense logic - block strongest attackers
      const defenderAssignments: { defenderId: string; laneId: number }[] = []
      gameState.lanes.forEach((lane, index) => {
        if (lane.attacker && gameState.player2.bench.length > defenderAssignments.length) {
          const availableDefenders = gameState.player2.bench.filter(
            u => !defenderAssignments.some(d => d.defenderId === u.id)
          )
          if (availableDefenders.length > 0) {
            const defender = availableDefenders[0]
            defenderAssignments.push({ defenderId: defender.id, laneId: index })
          }
        }
      })
      if (defenderAssignments.length > 0 || gameState.lanes.some(l => l.attacker)) {
        // Use a small delay for visual feedback
        setTimeout(() => {
          declareDefenders(defenderAssignments)
        }, 1000)
      }
    }
  }, [gameState, declareDefenders])

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
