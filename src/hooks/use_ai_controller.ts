import { useCallback, useEffect, useRef } from 'react'
import { useGameActions } from '@/hooks/use_game_actions'
import { GameLogger } from '@/lib/game_logger'
import { aiController } from '@/services/ai_controller_service'
import type { AILevel } from '@/services/ai_service'
import { useGameStore } from '@/store/game_store'

interface UseAIControllerOptions {
  enabled?: boolean
  autoPlay?: boolean
  difficulty?: AILevel
}

export const useAIController = (options: UseAIControllerOptions = {}) => {
  const { enabled = true, autoPlay = true, difficulty = 'normal' } = options
  const { gameState, setGameState } = useGameStore()
  const _gameActions = useGameActions()
  const isExecutingRef = useRef(false)

  // AI difficulty configuration (simplified for now)
  useEffect(() => {
    if (difficulty) {
      GameLogger.debug(`Setting AI difficulty to: ${difficulty}`)
      // TODO: Integrate with AI service when class structure is fixed
    }
  }, [difficulty])

  // Main AI execution
  const executeAI = useCallback(async () => {
    if (!gameState || isExecutingRef.current) return

    // Prevent multiple executions
    isExecutingRef.current = true

    try {
      // Execute AI logic through the controller
      // The AI controller now properly ends the turn internally
      const newState = await aiController.executeAITurn(gameState)

      // Update game state once with the final result
      setGameState(newState)
    } catch (error) {
      GameLogger.error('AI execution error:', error)
    } finally {
      isExecutingRef.current = false
    }
  }, [gameState, setGameState])

  // Auto-play AI turns when enabled
  useEffect(() => {
    if (!enabled || !autoPlay || !gameState || isExecutingRef.current) return

    // Check if it's AI's turn and in action phase
    if (gameState.activePlayer === 'player2' && gameState.phase === 'action') {
      // Add a small delay for better UX
      const timeoutId = setTimeout(() => {
        executeAI()
      }, 500)

      return () => clearTimeout(timeoutId)
    }
  }, [enabled, autoPlay, gameState?.activePlayer, gameState?.phase, executeAI, gameState])

  // Manual AI trigger
  const triggerAI = useCallback(() => {
    if (gameState?.activePlayer === 'player2') {
      executeAI()
    }
  }, [gameState, executeAI])

  // Get current AI info (simplified for now)
  const getAIInfo = useCallback(() => {
    return {
      name: 'AI Opponent',
      difficulty,
      aggression: 0.5,
      icon: '🤖', // Add icon for tutorial compatibility
    }
  }, [difficulty])

  // Reset AI (simplified for now)
  const resetAI = useCallback(() => {
    GameLogger.debug('AI reset requested')
    // TODO: Integrate with AI service when class structure is fixed
  }, [])

  return {
    executeAI,
    triggerAI,
    getAIInfo,
    resetAI,
    isExecuting: isExecutingRef.current,
  }
}
