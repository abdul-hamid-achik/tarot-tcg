import { GameLogger } from '@/lib/game_logger'
export const runtime = 'edge' // Enable Vercel Edge Runtime for WebSockets

import type { NextRequest } from 'next/server'
import type { GameState, PlayerId } from '@/schemas/schema'

// In-memory game sessions (would use Redis/database in production)
const gameSessions = new Map<
  string,
  {
    gameState: GameState
    players: Map<PlayerId, { socket: WebSocket; isConnected: boolean }>
    spectators: Set<WebSocket>
    lastUpdate: number
  }
>()

const playerSessions = new Map<
  string,
  {
    gameId: string
    playerId: PlayerId
    token: string
  }
>()

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const gameId = searchParams.get('gameId')
  const playerId = searchParams.get('playerId') as PlayerId
  const token = searchParams.get('token')

  // Validate parameters
  if (!gameId || !playerId || !token) {
    return new Response('Missing required parameters', { status: 400 })
  }

  // Validate session (simplified for demo - would use JWT/auth in production)
  const session = await validatePlayerSession(token)
  if (!session) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Upgrade to WebSocket
  const { socket, response } = upgradeWebSocket(request)

  // Register connection
  await registerConnection(gameId, playerId, socket)

  // Handle WebSocket events
  socket.onmessage = async event => {
    try {
      const message = JSON.parse(event.data)
      await handlePlayerAction(gameId, playerId, message, socket)
    } catch (error) {
      GameLogger.error(`WebSocket message error for ${playerId}:`, error)
      socket.send(
        JSON.stringify({
          type: 'error',
          message: 'Invalid message format',
        }),
      )
    }
  }

  socket.onclose = () => {
    handleDisconnection(gameId, playerId)
  }

  socket.onerror = error => {
    GameLogger.error(`WebSocket error for ${playerId}:`, error)
  }

  // Send initial state
  const gameState = await getGameState(gameId)
  const playerSide = getPlayerSide(gameId, playerId)

  socket.send(
    JSON.stringify({
      type: 'game_state',
      state: gameState,
      yourPlayer: playerSide,
      timestamp: Date.now(),
    }),
  )

  GameLogger.system(`🔌 Player ${playerId} connected to game ${gameId}`)

  return response
}

// WebSocket upgrade utility - requires proper WebSocket server implementation
function upgradeWebSocket(request: NextRequest): {
  socket: WebSocket
  response: Response
} {
  // For proper WebSocket implementation, you would need:
  // 1. Install 'ws' package: npm install ws @types/ws
  // 2. Create a custom server or use Socket.IO
  // 3. Handle the WebSocket upgrade properly

  if (request.headers.get('upgrade') !== 'websocket') {
    throw new Error('Expected websocket upgrade')
  }

  // Return an error response since WebSocket is not properly implemented
  const response = new Response(
    JSON.stringify({
      error: 'WebSocket not implemented',
      message: 'This demo uses mock WebSocket. For production, implement proper WebSocket server.',
    }),
    {
      status: 501,
      headers: {
        'Content-Type': 'application/json',
      },
    },
  )

  // Return a mock socket that will cause immediate failure
  const socket = {
    send: (data: string) => {
      GameLogger.error('WebSocket not implemented - attempted to send:', data)
    },
    onmessage: null as ((event: { data: string }) => void) | null,
    onclose: null as (() => void) | null,
    onerror: null as ((error: any) => void) | null,
    close: () => {
      GameLogger.system('Mock WebSocket closed')
    },
  } as any

  return { socket, response }
}

async function validatePlayerSession(token: string): Promise<boolean> {
  // Simplified validation - in production would verify JWT token
  return token.length > 10
}

async function registerConnection(
  gameId: string,
  playerId: PlayerId,
  socket: WebSocket,
): Promise<void> {
  let session = gameSessions.get(gameId)

  if (!session) {
    // Create new game session
    session = {
      gameState: await createNewGame(gameId, playerId),
      players: new Map(),
      spectators: new Set(),
      lastUpdate: Date.now(),
    }
    gameSessions.set(gameId, session)
  }

  // Register player
  session.players.set(playerId, { socket, isConnected: true })

  // Store player session
  playerSessions.set(`${gameId}-${playerId}`, {
    gameId,
    playerId,
    token: 'session-token', // Would generate proper token
  })

  GameLogger.system(`✅ Registered ${playerId} for game ${gameId}`)
}

async function handlePlayerAction(
  gameId: string,
  playerId: PlayerId,
  message: any,
  socket: WebSocket,
): Promise<void> {
  const session = gameSessions.get(gameId)
  if (!session) {
    socket.send(JSON.stringify({ type: 'error', message: 'Game not found' }))
    return
  }

  const { gameState } = session

  // Validate it's the player's turn
  if (gameState.activePlayer !== playerId) {
    socket.send(
      JSON.stringify({
        type: 'error',
        message: 'Not your turn',
      }),
    )
    return
  }

  try {
    let newGameState: GameState

    switch (message.type) {
      case 'play_card':
        newGameState = await handlePlayCard(gameState, message, playerId)
        break

      case 'declare_attack':
        newGameState = await handleDeclareAttack(gameState, message, playerId)
        break

      case 'end_turn':
        newGameState = await handleEndTurn(gameState, playerId)
        break

      default:
        socket.send(
          JSON.stringify({
            type: 'error',
            message: `Unknown action: ${message.type}`,
          }),
        )
        return
    }

    // Update game state
    session.gameState = newGameState
    session.lastUpdate = Date.now()

    // Broadcast to all players
    await broadcastGameState(gameId, newGameState)

    GameLogger.system(`🎮 Action processed: ${message.type} by ${playerId}`)
  } catch (error) {
    GameLogger.error(`Action failed for ${playerId}:`, error)
    socket.send(
      JSON.stringify({
        type: 'action_failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    )
  }
}

function handleDisconnection(gameId: string, playerId: PlayerId): void {
  const session = gameSessions.get(gameId)
  if (!session) return

  const playerConnection = session.players.get(playerId)
  if (playerConnection) {
    playerConnection.isConnected = false
    GameLogger.system(`🔌 Player ${playerId} disconnected from game ${gameId}`)

    // Notify other players
    broadcastToOthers(gameId, playerId, {
      type: 'player_disconnected',
      playerId,
      timestamp: Date.now(),
    })
  }

  // Clean up empty games after timeout
  setTimeout(() => {
    const currentSession = gameSessions.get(gameId)
    if (currentSession && Array.from(currentSession.players.values()).every(p => !p.isConnected)) {
      gameSessions.delete(gameId)
      GameLogger.system(`🧹 Cleaned up empty game ${gameId}`)
    }
  }, 30000) // 30 second cleanup delay
}

async function getGameState(gameId: string): Promise<GameState | null> {
  const session = gameSessions.get(gameId)
  return session?.gameState || null
}

function getPlayerSide(_gameId: string, playerId: PlayerId): PlayerId {
  // For now, just return the provided playerId
  // In a real matchmaking system, this would determine which side they're on
  return playerId
}

async function createNewGame(gameId: string, firstPlayerId: PlayerId): Promise<GameState> {
  // Import game logic to create initial state
  const { createInitialGameState } = await import('@/lib/game_logic')

  const gameState = createInitialGameState()
  gameState.activePlayer = 'player1' // First player always starts

  GameLogger.system(`🆕 Created new game ${gameId} with player ${firstPlayerId}`)

  return gameState
}

async function handlePlayCard(
  gameState: GameState,
  message: any,
  playerId: PlayerId,
): Promise<GameState> {
  const { playCard } = await import('@/lib/game_logic')

  // Find the card in player's hand
  const player = gameState[playerId]
  const card = player.hand.find(c => c.id === message.cardId)

  if (!card) {
    throw new Error('Card not found in hand')
  }

  // Apply tarot mechanics on server side (ensures consistency)
  const isReversed = Math.random() < 0.5
  const cardWithOrientation = { ...card, isReversed }

  return await playCard(gameState, cardWithOrientation, message.targetSlot)
}

async function handleDeclareAttack(
  gameState: GameState,
  message: any,
  _playerId: PlayerId,
): Promise<GameState> {
  const { declareAttack } = await import('@/services/combat_service')

  return await declareAttack(gameState, {
    attackerId: message.attackerId,
    targetType: message.targetType,
    targetId: message.targetId,
  })
}

async function handleEndTurn(gameState: GameState, _playerId: PlayerId): Promise<GameState> {
  const { endTurn } = await import('@/lib/game_logic')
  return await endTurn(gameState)
}

async function broadcastGameState(gameId: string, gameState: GameState): Promise<void> {
  const session = gameSessions.get(gameId)
  if (!session) return

  const message = JSON.stringify({
    type: 'game_state_update',
    state: gameState,
    timestamp: Date.now(),
  })

  // Send to all connected players
  for (const [playerId, connection] of session.players) {
    if (connection.isConnected) {
      try {
        connection.socket.send(message)
      } catch (error) {
        GameLogger.error(`Failed to send to ${playerId}:`, error)
        connection.isConnected = false
      }
    }
  }

  // Send to spectators
  for (const spectatorSocket of session.spectators) {
    try {
      spectatorSocket.send(message)
    } catch (error) {
      GameLogger.error('Failed to send to spectator:', error)
      session.spectators.delete(spectatorSocket)
    }
  }
}

async function broadcastToOthers(
  gameId: string,
  excludePlayerId: PlayerId,
  message: any,
): Promise<void> {
  const session = gameSessions.get(gameId)
  if (!session) return

  const messageString = JSON.stringify(message)

  for (const [playerId, connection] of session.players) {
    if (playerId !== excludePlayerId && connection.isConnected) {
      try {
        connection.socket.send(messageString)
      } catch (error) {
        GameLogger.error(`Failed to send to ${playerId}:`, error)
        connection.isConnected = false
      }
    }
  }
}
