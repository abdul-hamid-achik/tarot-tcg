import { useCallback, useEffect, useRef, useState } from 'react'
import { useGameStore } from '@/store/game_store'

interface GameClockConfig {
  turnTimeLimit: number // seconds per turn
  warningTime: number // seconds before warning
  autoEndTurn: boolean // auto-end turn when timer expires
}

const DEFAULT_CONFIG: GameClockConfig = {
  turnTimeLimit: 90, // 90 seconds per turn
  warningTime: 15, // warn at 15 seconds
  autoEndTurn: true,
}

export const useGameClock = (config: Partial<GameClockConfig> = {}) => {
  const { gameState } = useGameStore()
  const [timeRemaining, setTimeRemaining] = useState(
    config.turnTimeLimit || DEFAULT_CONFIG.turnTimeLimit,
  )
  const [matchTime, setMatchTime] = useState(0)
  const [isWarning, setIsWarning] = useState(false)

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const matchIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const turnStartTimeRef = useRef<number>(Date.now())
  const matchStartTimeRef = useRef<number>(Date.now())

  const mergedConfig = { ...DEFAULT_CONFIG, ...config }

  // Match timer - always running
  useEffect(() => {
    matchIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - matchStartTimeRef.current) / 1000)
      setMatchTime(elapsed)
    }, 1000)

    return () => {
      if (matchIntervalRef.current) {
        clearInterval(matchIntervalRef.current)
      }
    }
  }, [])

  // Turn timer - resets on turn change
  useEffect(() => {
    if (!gameState) return

    // Reset turn timer when turn changes
    turnStartTimeRef.current = Date.now()
    setTimeRemaining(mergedConfig.turnTimeLimit)
    setIsWarning(false)

    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    // Only run timer for player1's turn
    if (gameState.activePlayer === 'player1' && gameState.phase === 'action') {
      intervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - turnStartTimeRef.current) / 1000)
        const remaining = Math.max(0, mergedConfig.turnTimeLimit - elapsed)

        setTimeRemaining(remaining)
        setIsWarning(remaining <= mergedConfig.warningTime && remaining > 0)

        // Auto-end turn if timer expires
        if (remaining === 0 && mergedConfig.autoEndTurn) {
          console.log('Turn timer expired, auto-ending turn')
          // This should trigger the endTurn action
          // We'll connect this in the GameBoard component
        }
      }, 1000)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [gameState?.turn, gameState?.activePlayer, gameState?.phase, mergedConfig, gameState])

  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }, [])

  const getMatchTime = useCallback((): string => {
    return formatTime(matchTime)
  }, [matchTime, formatTime])

  const getTurnTime = useCallback((): string => {
    return formatTime(timeRemaining)
  }, [timeRemaining, formatTime])

  const resetTurnTimer = useCallback(() => {
    turnStartTimeRef.current = Date.now()
    setTimeRemaining(mergedConfig.turnTimeLimit)
    setIsWarning(false)
  }, [mergedConfig.turnTimeLimit])

  return {
    timeRemaining,
    matchTime,
    isWarning,
    getTurnTime,
    getMatchTime,
    resetTurnTimer,
    isTimerExpired: timeRemaining === 0,
  }
}
