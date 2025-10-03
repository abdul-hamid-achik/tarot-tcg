import { GameLogger, GameLogger } from "@/lib/game_logger"
import type { Card, GameState, PlayerId } from '@/schemas/schema'
import { useGameStore } from '@/store/game_store'

export interface GameMessage {
    type: 'play_card' | 'declare_attack' | 'end_turn' | 'heartbeat'
    actionId?: string
    cardId?: string
    targetSlot?: number
    attackerId?: string
    targetType?: 'unit' | 'player'
    targetId?: string
    timestamp?: number
}

export interface ServerMessage {
    type: 'game_state' | 'game_state_update' | 'opponent_action' | 'error' | 'player_disconnected'
    state?: GameState
    yourPlayer?: PlayerId
    playerId?: PlayerId
    message?: string
    error?: string
    timestamp?: number
}

export class WebSocketService {
    private ws: WebSocket | null = null
    private messageQueue: GameMessage[] = []
    private reconnectAttempts = 0
    private maxReconnectAttempts = 5
    private reconnectDelay = 1000
    private heartbeatInterval: number | null = null
    private gameId: string | null = null
    private playerId: PlayerId | null = null
    private token: string | null = null

    // Connection management
    async connect(gameId: string, playerId: PlayerId, token: string): Promise<boolean> {
        this.gameId = gameId
        this.playerId = playerId
        this.token = token

        const wsUrl = this.buildWebSocketUrl(gameId, playerId, token)

        try {
            this.ws = new WebSocket(wsUrl)

            this.ws.onopen = () => {
                GameLogger.system('🔌 WebSocket connected')
                this.reconnectAttempts = 0
                this.flushQueue()
                this.startHeartbeat()
                this.updateConnectionStatus('connected')
            }

            this.ws.onmessage = (event) => {
                try {
                    const message: ServerMessage = JSON.parse(event.data)
                    this.handleServerMessage(message)
                } catch (error) {
                    GameLogger.error('Failed to parse WebSocket message:', error)
                }
            }

            this.ws.onclose = (event) => {
                GameLogger.system('🔌 WebSocket closed:', event.reason)
                this.stopHeartbeat()
                this.updateConnectionStatus('disconnected')

                if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.scheduleReconnect()
                }
            }

            this.ws.onerror = (error) => {
                GameLogger.error('🔌 WebSocket error:', error)
                this.updateConnectionStatus('disconnected')
            }

            return true
        } catch (error) {
            GameLogger.error('Failed to connect WebSocket:', error)
            this.updateConnectionStatus('disconnected')
            return false
        }
    }

    disconnect(): void {
        this.stopHeartbeat()

        if (this.ws) {
            this.ws.close(1000, 'Client disconnecting')
            this.ws = null
        }

        this.updateConnectionStatus('disconnected')
        this.messageQueue = []
        GameLogger.state('WebSocket disconnected by client')
    }

    // Message sending
    send(message: GameMessage): void {
        const messageWithTimestamp = {
            ...message,
            timestamp: Date.now()
        }

        if (this.ws?.readyState === WebSocket.OPEN) {
            try {
                this.ws.send(JSON.stringify(messageWithTimestamp))
                GameLogger.action(`Sent WebSocket message: ${message.type}`)
            } catch (error) {
                GameLogger.error('Failed to send WebSocket message:', error)
                this.messageQueue.push(messageWithTimestamp)
            }
        } else {
            GameLogger.system('WebSocket not ready, queueing message:', message.type)
            this.messageQueue.push(messageWithTimestamp)

            if (this.ws?.readyState === WebSocket.CLOSED) {
                this.scheduleReconnect()
            }
        }
    }

    // Game actions
    playCard(card: Card, targetSlot?: number, actionId?: string): void {
        this.send({
            type: 'play_card',
            cardId: card.id,
            targetSlot,
            actionId
        })
    }

    declareAttack(attackerId: string, targetType: 'unit' | 'player', targetId?: string, actionId?: string): void {
        this.send({
            type: 'declare_attack',
            attackerId,
            targetType,
            targetId,
            actionId
        })
    }

    endTurn(actionId?: string): void {
        this.send({
            type: 'end_turn',
            actionId
        })
    }

    // Private methods
    private buildWebSocketUrl(gameId: string, playerId: PlayerId, token: string): string {
        const baseUrl = process.env.NODE_ENV === 'production'
            ? 'wss://your-app.vercel.app'
            : 'ws://localhost:3000'

        const params = new URLSearchParams({
            gameId,
            playerId,
            token
        })

        return `${baseUrl}/api/game/ws?${params.toString()}`
    }

    private flushQueue(): void {
        if (this.ws?.readyState === WebSocket.OPEN && this.messageQueue.length > 0) {
            GameLogger.system(`Flushing ${this.messageQueue.length} queued messages`)

            while (this.messageQueue.length > 0) {
                const message = this.messageQueue.shift()
                if (message) {
                    try {
                        this.ws.send(JSON.stringify(message))
                    } catch (error) {
                        GameLogger.error('Failed to flush queued message:', error)
                        break
                    }
                }
            }
        }
    }

    private handleServerMessage(message: ServerMessage): void {
        GameLogger.system('📨 Received server message:', message.type)

        switch (message.type) {
            case 'game_state':
                this.handleInitialGameState(message)
                break

            case 'game_state_update':
                this.handleGameStateUpdate(message)
                break

            case 'opponent_action':
                this.handleOpponentAction(message)
                break

            case 'error':
                this.handleError(message)
                break

            case 'player_disconnected':
                this.handlePlayerDisconnected(message)
                break

            default:
                GameLogger.warn('Unknown server message type:', message.type)
        }
    }

    private handleInitialGameState(message: ServerMessage): void {
        if (!message.state || !message.yourPlayer) return

        const gameStore = useGameStore.getState()

        // Set player side for UI
        gameStore.multiplayer.playerId = message.yourPlayer

        // Apply state with proper reconciliation
        this.reconcileState(message.state)

        GameLogger.state(`Received initial game state as ${message.yourPlayer}`)
    }

    private handleGameStateUpdate(message: ServerMessage): void {
        if (!message.state) return

        // Reconcile with any optimistic updates
        this.reconcileState(message.state)
    }

    private handleOpponentAction(message: ServerMessage): void {
        // Handle opponent's action - could show animations or notifications
        GameLogger.action('Opponent performed action')

        // Update state if provided
        if (message.state) {
            this.reconcileState(message.state)
        }
    }

    private handleError(message: ServerMessage): void {
        GameLogger.error('Server error:', message.error || message.message)

        // Show error to user (could integrate with toast system)
        // toast.error(message.error || 'Game action failed')

        // Revert any optimistic updates if needed
        this.revertOptimisticUpdates()
    }

    private handlePlayerDisconnected(message: ServerMessage): void {
        GameLogger.system(`Player ${message.playerId} disconnected`)

        // Show reconnection UI or pause game
        // Could implement reconnection grace period
    }

    private reconcileState(serverState: GameState): void {
        const gameStore = useGameStore.getState()

        // Simple state reconciliation - in production might need more sophisticated merging
        // to handle optimistic updates properly
        gameStore.setGameState(serverState)

        GameLogger.state('Game state reconciled with server')
    }

    private revertOptimisticUpdates(): void {
        // Implementation would depend on how optimistic updates are tracked
        // For now, just log the event
        GameLogger.state('Reverting optimistic updates')
    }

    private scheduleReconnect(): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            GameLogger.error('Max reconnection attempts reached')
            this.updateConnectionStatus('disconnected')
            return
        }

        this.reconnectAttempts++
        const delay = this.reconnectDelay * 2 ** (this.reconnectAttempts - 1) // Exponential backoff

        GameLogger.system(`Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`)
        this.updateConnectionStatus('connecting')

        setTimeout(() => {
            if (this.gameId && this.playerId && this.token) {
                this.connect(this.gameId, this.playerId, this.token)
            }
        }, delay)
    }

    private startHeartbeat(): void {
        this.heartbeatInterval = window.setInterval(() => {
            this.send({ type: 'heartbeat' })
        }, 30000) // Send heartbeat every 30 seconds
    }

    private stopHeartbeat(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval)
            this.heartbeatInterval = null
        }
    }

    private updateConnectionStatus(status: 'connected' | 'connecting' | 'disconnected'): void {
        const gameStore = useGameStore.getState()
        gameStore.multiplayer.connectionStatus = status

        GameLogger.state(`Connection status: ${status}`)
    }

    // Public getters
    get isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN
    }

    get connectionState(): string {
        if (!this.ws) return 'disconnected'

        switch (this.ws.readyState) {
            case WebSocket.CONNECTING: return 'connecting'
            case WebSocket.OPEN: return 'connected'
            case WebSocket.CLOSING: return 'disconnecting'
            case WebSocket.CLOSED: return 'disconnected'
            default: return 'unknown'
        }
    }

    get queuedMessages(): number {
        return this.messageQueue.length
    }
}

// Singleton instance
export const webSocketService = new WebSocketService()

// Helper functions for React components
export function useWebSocket() {
    return {
        connect: (gameId: string, playerId: PlayerId, token: string) =>
            webSocketService.connect(gameId, playerId, token),
        disconnect: () => webSocketService.disconnect(),
        playCard: (card: Card, targetSlot?: number) =>
            webSocketService.playCard(card, targetSlot),
        declareAttack: (attackerId: string, targetType: 'unit' | 'player', targetId?: string) =>
            webSocketService.declareAttack(attackerId, targetType, targetId),
        endTurn: () => webSocketService.endTurn(),
        isConnected: webSocketService.isConnected,
        connectionState: webSocketService.connectionState,
        queuedMessages: webSocketService.queuedMessages,
    }
}
