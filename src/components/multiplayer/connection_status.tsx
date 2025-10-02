import { GameLogger } from "@/lib/game_logger"
'use client'

import React from 'react'
import { useGameStore } from '@/store/game_store'
import { useMultiplayerActions } from '@/hooks/use_multiplayer_actions'
import { cn } from '@/lib/utils'

interface ConnectionStatusProps {
    className?: string
    showDetails?: boolean
}

export function ConnectionStatus({ className, showDetails = false }: ConnectionStatusProps) {
    const { multiplayer } = useGameStore()
    const { connectionState, queuedMessages, pendingActions } = useMultiplayerActions()

    const getStatusColor = () => {
        switch (multiplayer.connectionStatus) {
            case 'connected': return 'text-green-500'
            case 'connecting': return 'text-yellow-500'
            case 'disconnected': return 'text-red-500'
            default: return 'text-gray-500'
        }
    }

    const getStatusIcon = () => {
        switch (multiplayer.connectionStatus) {
            case 'connected': return '🟢'
            case 'connecting': return '🟡'
            case 'disconnected': return '🔴'
            default: return '⚫'
        }
    }

    const getStatusText = () => {
        switch (multiplayer.connectionStatus) {
            case 'connected': return 'Connected'
            case 'connecting': return 'Connecting...'
            case 'disconnected': return 'Offline'
            default: return 'Unknown'
        }
    }

    if (!multiplayer.playerId) {
        return (
            <div className={cn('flex items-center gap-2 text-sm text-gray-500', className)}>
                <span>⚫</span>
                <span>Local Game</span>
            </div>
        )
    }

    return (
        <div className={cn('flex flex-col gap-1', className)}>
            <div className={cn('flex items-center gap-2 text-sm', getStatusColor())}>
                <span className="animate-pulse">{getStatusIcon()}</span>
                <span className="font-medium">{getStatusText()}</span>
                {multiplayer.playerId && (
                    <span className="text-xs text-gray-400">
                        (Player {multiplayer.playerId === 'player1' ? '1' : '2'})
                    </span>
                )}
            </div>

            {showDetails && (
                <div className="flex gap-4 text-xs text-gray-400">
                    {queuedMessages > 0 && (
                        <span>📦 {queuedMessages} queued</span>
                    )}
                    {pendingActions > 0 && (
                        <span>⏳ {pendingActions} pending</span>
                    )}
                    {multiplayer.connectionStatus === 'connected' && (
                        <span>🌐 Real-time</span>
                    )}
                </div>
            )}
        </div>
    )
}

interface GameJoinProps {
    onJoin: (gameId: string) => void
    onCreateGame: () => void
    className?: string
}

export function GameJoinInterface({ onJoin, onCreateGame, className }: GameJoinProps) {
    const [gameId, setGameId] = React.useState('')
    const [isJoining, setIsJoining] = React.useState(false)
    const { connectToGame } = useMultiplayerActions()

    const handleJoinGame = async () => {
        if (!gameId.trim()) return

        setIsJoining(true)
        try {
            // Generate temporary token (would use proper auth in production)
            const token = `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

            const connected = await connectToGame(gameId, 'player2', token)
            if (connected) {
                onJoin(gameId)
            } else {
                GameLogger.error('Failed to connect to game')
            }
        } catch (error) {
            GameLogger.error('Error joining game:', error)
        } finally {
            setIsJoining(false)
        }
    }

    const handleCreateGame = () => {
        const newGameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
        onCreateGame()

        // Auto-connect as player1
        const token = `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        connectToGame(newGameId, 'player1', token)
    }

    return (
        <div className={cn('flex flex-col gap-4 p-4 bg-gray-900/50 rounded-lg border border-gray-700', className)}>
            <h3 className="text-lg font-bold text-center">🎴 Multiplayer Tarot TCG</h3>

            <div className="flex flex-col gap-2">
                <label className="text-sm text-gray-300">Join Existing Game</label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={gameId}
                        onChange={(e) => setGameId(e.target.value)}
                        placeholder="Enter Game ID"
                        className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-400"
                    />
                    <button
                        onClick={handleJoinGame}
                        disabled={!gameId.trim() || isJoining}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded transition-colors"
                    >
                        {isJoining ? '⏳' : '🚪 Join'}
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-gray-600"></div>
                <span className="text-xs text-gray-400">OR</span>
                <div className="flex-1 h-px bg-gray-600"></div>
            </div>

            <button
                onClick={handleCreateGame}
                className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium"
            >
                ✨ Create New Game
            </button>

            <div className="text-xs text-gray-400 text-center">
                🔮 Challenge friends to mystical battles with 78 tarot cards
            </div>
        </div>
    )
}
