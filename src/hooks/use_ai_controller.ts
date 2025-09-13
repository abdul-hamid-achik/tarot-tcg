import { useCallback, useEffect, useRef } from 'react'
import type { GameState } from '@/schemas/schema'
import { aiController } from '@/services/ai_controller_service'
import type { AILevel } from '@/services/ai_service'
import { useGameStore } from '@/store/game_store'
import { useGameActions } from '@/hooks/use_game_actions'

interface UseAIControllerOptions {
  enabled?: boolean
  autoPlay?: boolean
  difficulty?: AILevel
}

export const useAIController = (options: UseAIControllerOptions = {}) => {
  const { enabled = true, autoPlay = true, difficulty = 'normal' } = options
  const { gameState, setGameState } = useGameStore()
  const { endTurn, declareDefenders, resolveCombat } = useGameActions()
  const isExecutingRef = useRef(false)

  // Set AI difficulty
  useEffect(() => {
    if (difficulty) {
      aiController.setDifficulty(difficulty)
    }
  }, [difficulty])

  // Main AI execution
  const executeAI = useCallback(async () => {
    if (!gameState || isExecutingRef.current) return

    // Prevent multiple executions
    isExecutingRef.current = true

    try {
      // Execute AI logic through the controller
      const newState = await aiController.executeAITurn(gameState)

      // Update game state
      setGameState(newState)

      // Handle phase transitions
      if (newState.phase === 'declare_defenders' && newState.activePlayer === 'player1') {
        // AI has attacked, player needs to defend
        return
      }

      if (newState.phase === 'combat') {
        // Move to combat resolution
        setTimeout(() => resolveCombat(), 1000)
        return
      }

      // If AI is still active and in action phase, end turn
      if (newState.activePlayer === 'player2' && newState.phase === 'action') {
        setTimeout(() => endTurn(), 500)
      }
    } catch (error) {
      console.error('AI execution error:', error)
    } finally {
      isExecutingRef.current = false
    }
  }, [gameState, setGameState, endTurn, resolveCombat])

  // Auto-play AI turns when enabled
  useEffect(() => {
    if (!enabled || !autoPlay || !gameState) return

    // Check if it's AI's turn
    if (gameState.activePlayer === 'player2') {
      // Add a small delay for better UX
      const timeoutId = setTimeout(() => {
        executeAI()
      }, 500)

      return () => clearTimeout(timeoutId)
    }
  }, [enabled, autoPlay, gameState?.activePlayer, gameState?.phase, executeAI])

  // Handle AI defense when attacked by player
  useEffect(() => {
    if (!enabled || !gameState) return

    // Only auto-execute AI defense when AI is the defending player
    if (
      gameState.phase === 'declare_defenders' &&
      gameState.activePlayer === 'player2' &&
      gameState.attackingPlayer === 'player1'
    ) {
      const timeoutId = setTimeout(async () => {
        const newState = await aiController.executeAITurn(gameState)
        setGameState(newState)

        // Resolve combat after defenders are declared
        setTimeout(() => resolveCombat(), 1000)
      }, 1000)

      return () => clearTimeout(timeoutId)
    }
  }, [enabled, gameState, setGameState, resolveCombat])

  // Manual AI trigger
  const triggerAI = useCallback(() => {
    if (gameState?.activePlayer === 'player2') {
      executeAI()
    }
  }, [gameState, executeAI])

  // Get current AI info
  const getAIInfo = useCallback(() => {
    return aiController.getCurrentAI()
  }, [])

  // Reset AI
  const resetAI = useCallback(() => {
    aiController.reset()
  }, [])

  return {
    executeAI,
    triggerAI,
    getAIInfo,
    resetAI,
    isExecuting: isExecutingRef.current,
  }
}