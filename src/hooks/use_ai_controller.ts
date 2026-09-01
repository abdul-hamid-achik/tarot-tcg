import { useCallback, useEffect, useRef } from 'react'
import { GameLogger } from '@/lib/game_logger'
import { aiController } from '@/services/ai_controller_service'
import { AI_PERSONALITIES, type AILevel } from '@/services/ai_service'
import { useGameStore } from '@/store/game_store'

interface UseAIControllerOptions {
  enabled?: boolean
  autoPlay?: boolean
  difficulty?: AILevel
}

export const useAIController = (options: UseAIControllerOptions = {}) => {
  const { enabled = true, autoPlay = true, difficulty = 'normal' } = options
  const { gameState, setGameState } = useGameStore()
  const isExecutingRef = useRef(false)

  useEffect(() => {
    aiController.setDifficulty(difficulty)
  }, [difficulty])

  const executeAI = useCallback(async () => {
    if (!gameState || isExecutingRef.current) return

    isExecutingRef.current = true

    try {
      const newState = await aiController.executeAITurn(gameState)
      setGameState(newState)
    } catch (error) {
      GameLogger.error('AI execution error:', error)
    } finally {
      isExecutingRef.current = false
    }
  }, [gameState, setGameState])

  useEffect(() => {
    if (!enabled || !autoPlay || !gameState || isExecutingRef.current) return

    if (gameState.activePlayer === 'player2' && gameState.phase === 'action') {
      const timeoutId = setTimeout(() => {
        void executeAI()
      }, 500)

      return () => clearTimeout(timeoutId)
    }
  }, [enabled, autoPlay, gameState?.activePlayer, gameState?.phase, executeAI, gameState])

  const triggerAI = useCallback(() => {
    if (gameState?.activePlayer === 'player2') {
      void executeAI()
    }
  }, [gameState, executeAI])

  const getAIInfo = useCallback(() => {
    const personality = AI_PERSONALITIES[difficulty]
    return {
      name: personality.name,
      difficulty: personality.level,
      aggression: 1 - personality.mistakeChance,
      icon: personality.icon,
    }
  }, [difficulty])

  const resetAI = useCallback(() => {
    aiController.reset()
    aiController.setDifficulty(difficulty)
  }, [difficulty])

  return {
    executeAI,
    triggerAI,
    getAIInfo,
    resetAI,
    isExecuting: isExecutingRef.current,
  }
}
