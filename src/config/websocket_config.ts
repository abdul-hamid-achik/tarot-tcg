// WebSocket configuration for Tarot TCG multiplayer
export const WEBSOCKET_CONFIG = {
    // Connection URLs
    WS_URL: process.env.NODE_ENV === 'production'
        ? 'wss://your-tarot-tcg-app.vercel.app'
        : 'ws://localhost:3000',

    // Connection settings
    HEARTBEAT_INTERVAL: 30000, // 30 seconds
    MAX_RECONNECT_ATTEMPTS: 5,
    RECONNECT_BASE_DELAY: 1000, // 1 second, with exponential backoff
    CONNECTION_TIMEOUT: 10000, // 10 seconds

    // Rate limiting
    MESSAGE_RATE_LIMIT: 10, // messages per second per client

    // Session management
    SESSION_TIMEOUT: 3600000, // 1 hour
    CLEANUP_INTERVAL: 30000, // 30 seconds

    // Game settings
    TURN_TIME_LIMIT: 90000, // 90 seconds per turn
    GRACE_PERIOD: 15000, // 15 seconds grace period for disconnections

    // Development settings
    ENABLE_LOGGING: process.env.NODE_ENV === 'development',
    ENABLE_DEBUG_MESSAGES: process.env.NODE_ENV === 'development',
} as const

// Helper to get WebSocket URL with query parameters
export function buildWebSocketUrl(gameId: string, playerId: string, token: string): string {
    const params = new URLSearchParams({
        gameId,
        playerId,
        token,
        version: '1.0',
        protocol: 'tarot-tcg',
    })

    return `${WEBSOCKET_CONFIG.WS_URL}/api/game/ws?${params.toString()}`
}

// Validate WebSocket configuration
export function validateWebSocketConfig(): void {
    if (WEBSOCKET_CONFIG.HEARTBEAT_INTERVAL < 1000) {
        console.warn('WebSocket heartbeat interval is very short, may cause performance issues')
    }

    if (WEBSOCKET_CONFIG.MAX_RECONNECT_ATTEMPTS > 10) {
        console.warn('WebSocket max reconnect attempts is very high')
    }

    if (process.env.NODE_ENV === 'production' && WEBSOCKET_CONFIG.WS_URL.includes('localhost')) {
        console.error('Production build is using localhost WebSocket URL')
    }
}

// Initialize configuration validation
if (typeof window === 'undefined') {
    // Server-side validation
    validateWebSocketConfig()
}
