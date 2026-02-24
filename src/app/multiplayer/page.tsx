'use client'

import { useEffect, useState } from 'react'
import GameBoard from '@/components/game_board'
import { MatchmakingInterface } from '@/components/multiplayer/matchmaking'
import { useMultiplayerActions } from '@/hooks/use_multiplayer_actions'
import { GameLogger } from '@/lib/game_logger'
import { createInitialGameState } from '@/lib/game_logic'
import type { GameState } from '@/schemas/schema'

type MultiplayerState = 'setup' | 'matchmaking' | 'matched' | 'playing' | 'ended'

interface MatchData {
  matchId: string
  yourSide: 'player1' | 'player2'
  opponent: {
    id: string
    name: string
    rating: number
    zodiac: string
  }
  gameMode: string
  zodiacCompatibility: number
  cosmicBlessings: string[]
}

export default function MultiplayerPage() {
  const [state, setState] = useState<MultiplayerState>('setup')
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [matchData, setMatchData] = useState<MatchData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const multiplayer = useMultiplayerActions()

  // Initialize game when match is found
  useEffect(() => {
    if (state === 'matched' && matchData) {
      const initializeGame = async () => {
        try {
          // Create initial game state
          const initialState = createInitialGameState()
          setGameState(initialState)

          // Try to connect to multiplayer session (will fail with current WebSocket implementation)
          const connected = await multiplayer.connectToGame(
            matchData.matchId,
            matchData.yourSide,
            `token_${Date.now()}`, // TODO: Use proper authentication
          )

          if (connected) {
            setState('playing')
            GameLogger.state(`Connected to multiplayer game: ${matchData.matchId}`)
          } else {
            // For demo purposes, show a demo mode message
            setError('WebSocket not implemented - Running in demo mode')
            setState('playing') // Still allow playing in demo mode
            GameLogger.state(`Demo mode - WebSocket not available`)
          }
        } catch (error) {
          console.error('Game initialization error:', error)
          setError('Failed to initialize game - Running in demo mode')
          setState('playing') // Still allow playing in demo mode
        }
      }

      // Small delay to show match found screen
      const timer = setTimeout(initializeGame, 3000)
      return () => clearTimeout(timer)
    }
  }, [state, matchData, multiplayer])

  // Handle match found
  const handleMatchFound = (matchInfo: MatchData) => {
    console.log('🎮 Match found:', matchInfo)
    setMatchData(matchInfo)
    setState('matched')

    GameLogger.state('Match found', {
      opponent: matchInfo.opponent.name,
      compatibility: matchInfo.zodiacCompatibility,
      blessings: matchInfo.cosmicBlessings.length,
    })
  }

  // Handle matchmaking cancel
  const handleCancelMatchmaking = () => {
    setState('setup')
    setMatchData(null)
    setError(null)
    GameLogger.state('Matchmaking cancelled')
  }

  // Handle game end
  const handleGameEnd = () => {
    setState('ended')
    multiplayer.disconnectFromGame()
    GameLogger.state('Multiplayer game ended')
  }

  // Handle return to setup
  const handleReturnToSetup = () => {
    setState('setup')
    setGameState(null)
    setMatchData(null)
    setError(null)
    multiplayer.disconnectFromGame()
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors">
      {/* Setup Phase */}
      {state === 'setup' && (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <div className="max-w-md w-full">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-black dark:text-white mb-2">🎴 Tarot TCG</h1>
              <p className="text-gray-800 dark:text-gray-200">
                Mystical battles await in the cosmic arena
              </p>
            </div>

            {error && (
              <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 mb-4">
                <p className="text-yellow-800 dark:text-yellow-200 text-sm">⚠️ {error}</p>
                {error.includes('WebSocket not implemented') && (
                  <p className="text-yellow-700 dark:text-yellow-300 text-xs mt-1">
                    💡 This is expected in the demo - WebSocket functionality requires a proper
                    backend implementation.
                  </p>
                )}
              </div>
            )}

            <MatchmakingInterface
              onMatchFound={handleMatchFound}
              onCancel={handleCancelMatchmaking}
            />
          </div>
        </div>
      )}

      {/* Matchmaking Phase */}
      {state === 'matchmaking' && (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <div className="max-w-md w-full">
            <MatchmakingInterface
              onMatchFound={handleMatchFound}
              onCancel={handleCancelMatchmaking}
            />
          </div>
        </div>
      )}

      {/* Match Found Phase */}
      {state === 'matched' && matchData && (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <div className="max-w-lg w-full bg-white dark:bg-gray-800 rounded-xl border border-gray-300 dark:border-gray-600 p-8 text-center shadow-lg">
            <div className="text-6xl mb-4 animate-bounce">🎉</div>
            <h2 className="text-2xl font-bold text-black dark:text-white mb-2">
              🌟 Worthy Opponent Found!
            </h2>
            <p className="text-xl text-black dark:text-white mb-4">{matchData.opponent.name}</p>
            <div className="flex flex-col gap-2 mb-6">
              <p className="text-sm text-gray-800 dark:text-gray-200">
                {matchData.opponent.zodiac} ♦ Rating: {matchData.opponent.rating}
              </p>
              <p className="text-sm text-blue-600 dark:text-blue-400">
                Compatibility: {Math.round(matchData.zodiacCompatibility * 100)}%
              </p>
            </div>

            {matchData.cosmicBlessings && (
              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-6">
                <h3 className="text-sm font-bold text-blue-800 dark:text-blue-200 mb-2">
                  🌟 Cosmic Blessings:
                </h3>
                {matchData.cosmicBlessings.map((blessing: string, index: number) => (
                  <p key={index} className="text-xs text-blue-700 dark:text-blue-300 mb-1">
                    {blessing}
                  </p>
                ))}
              </div>
            )}

            <div className="animate-pulse text-gray-600 dark:text-gray-400">
              🔮 Preparing the mystical battlefield...
            </div>
          </div>
        </div>
      )}

      {/* Playing Phase */}
      {state === 'playing' && gameState && (
        <GameBoard gameState={gameState} onEndTurn={handleGameEnd} />
      )}

      {/* Game Ended Phase */}
      {state === 'ended' && (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl border border-gray-300 dark:border-gray-600 p-8 text-center shadow-lg">
            <div className="text-6xl mb-4">🎴</div>
            <h2 className="text-2xl font-bold text-black dark:text-white mb-4">Game Complete</h2>
            <p className="text-gray-800 dark:text-gray-200 mb-6">
              The cards have spoken their wisdom
            </p>
            <button
              onClick={handleReturnToSetup}
              className="w-full bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-100 font-bold py-3 rounded-lg transition-colors"
            >
              ✨ Seek Another Battle
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
