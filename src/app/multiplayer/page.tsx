'use client'

import React, { useState, useEffect } from 'react'
import GameBoard from '@/components/game_board'
import { MatchmakingInterface } from '@/components/multiplayer/matchmaking'
import { useMultiplayerActions } from '@/hooks/use_multiplayer_actions'
import { createInitialGameState } from '@/lib/game_logic'
import { GameLogger } from '@/lib/game_logger'
import type { GameState } from '@/schemas/schema'

type MultiplayerState = 'setup' | 'matchmaking' | 'matched' | 'playing' | 'ended'

export default function MultiplayerPage() {
    const [state, setState] = useState<MultiplayerState>('setup')
    const [gameState, setGameState] = useState<GameState | null>(null)
    const [matchData, setMatchData] = useState<any>(null)
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

                    // Connect to multiplayer session
                    const connected = await multiplayer.connectToGame(
                        matchData.matchId,
                        matchData.yourSide,
                        `token_${Date.now()}` // TODO: Use proper authentication
                    )

                    if (connected) {
                        setState('playing')
                        GameLogger.state(`Connected to multiplayer game: ${matchData.matchId}`)
                    } else {
                        setError('Failed to connect to game session')
                        setState('setup')
                    }
                } catch (error) {
                    console.error('Game initialization error:', error)
                    setError('Failed to initialize game')
                    setState('setup')
                }
            }

            // Small delay to show match found screen
            const timer = setTimeout(initializeGame, 3000)
            return () => clearTimeout(timer)
        }
    }, [state, matchData, multiplayer])

    // Handle match found
    const handleMatchFound = (matchInfo: any) => {
        console.log('🎮 Match found:', matchInfo)
        setMatchData(matchInfo)
        setState('matched')

        GameLogger.state('Match found', {
            opponent: matchInfo.opponent.name,
            compatibility: matchInfo.zodiacCompatibility,
            blessings: matchInfo.cosmicBlessings.length
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
        <div className="min-h-screen bg-gradient-to-br from-purple-950 via-indigo-950 to-purple-950">
            {/* Setup Phase */}
            {state === 'setup' && (
                <div className="flex flex-col items-center justify-center min-h-screen p-4">
                    <div className="max-w-md w-full">
                        <div className="text-center mb-8">
                            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
                                🎴 Tarot TCG
                            </h1>
                            <p className="text-gray-300">
                                Mystical battles await in the cosmic arena
                            </p>
                        </div>

                        {error && (
                            <div className="bg-red-900/30 border border-red-600/50 rounded-lg p-4 mb-4">
                                <p className="text-red-300 text-sm">
                                    ⚠️ {error}
                                </p>
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
                    <div className="max-w-lg w-full bg-gray-900/50 rounded-xl border border-purple-600/30 p-8 text-center">
                        <div className="text-6xl mb-4 animate-bounce">🎉</div>
                        <h2 className="text-2xl font-bold text-yellow-400 mb-2">
                            🌟 Worthy Opponent Found!
                        </h2>
                        <p className="text-xl text-white mb-4">
                            {matchData.opponent.name}
                        </p>
                        <div className="flex flex-col gap-2 mb-6">
                            <p className="text-sm text-gray-300">
                                {matchData.opponent.zodiac} ♦ Rating: {matchData.opponent.rating}
                            </p>
                            <p className="text-sm text-purple-300">
                                Compatibility: {Math.round(matchData.zodiacCompatibility * 100)}%
                            </p>
                        </div>

                        {matchData.cosmicBlessings && (
                            <div className="bg-indigo-900/30 border border-indigo-600/30 rounded-lg p-4 mb-6">
                                <h3 className="text-sm font-bold text-indigo-300 mb-2">🌟 Cosmic Blessings:</h3>
                                {matchData.cosmicBlessings.map((blessing: string, index: number) => (
                                    <p key={index} className="text-xs text-indigo-200 mb-1">
                                        {blessing}
                                    </p>
                                ))}
                            </div>
                        )}

                        <div className="animate-pulse text-purple-300">
                            🔮 Preparing the mystical battlefield...
                        </div>
                    </div>
                </div>
            )}

            {/* Playing Phase */}
            {state === 'playing' && gameState && (
                <GameBoard
                    gameState={gameState}
                    onEndTurn={handleGameEnd}
                />
            )}

            {/* Game Ended Phase */}
            {state === 'ended' && (
                <div className="flex flex-col items-center justify-center min-h-screen p-4">
                    <div className="max-w-md w-full bg-gray-900/50 rounded-xl border border-purple-600/30 p-8 text-center">
                        <div className="text-6xl mb-4">🎴</div>
                        <h2 className="text-2xl font-bold text-purple-400 mb-4">
                            Game Complete
                        </h2>
                        <p className="text-gray-300 mb-6">
                            The cards have spoken their wisdom
                        </p>
                        <button
                            onClick={handleReturnToSetup}
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg transition-colors"
                        >
                            ✨ Seek Another Battle
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
