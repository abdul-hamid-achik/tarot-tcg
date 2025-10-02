import { GameLogger } from "@/lib/game_logger"
export const runtime = 'edge' // Vercel Edge Runtime

import { NextRequest, NextResponse } from 'next/server'
import { PlayerId, ZodiacClass } from '@/schemas/schema'

// Player profile interface
interface PlayerProfile {
    id: string
    name: string
    rating: number
    favoriteZodiac: ZodiacClass
    gamesPlayed: number
    gamesWon: number
    preferredGameMode: string
    lastActive: number
}

// Matchmaking pool
const matchmakingPools = new Map<string, Set<string>>() // gameMode -> Set of playerIds
const playerProfiles = new Map<string, PlayerProfile>()
const activeMatches = new Map<string, { player1: string; player2: string; startTime: number }>()

export async function POST(request: NextRequest) {
    try {
        const { playerId, deckId, gameMode = 'standard', playerInfo } = await request.json()

        if (!playerId) {
            return NextResponse.json({ error: 'Player ID required' }, { status: 400 })
        }

        // Get or create player profile
        let playerProfile = playerProfiles.get(playerId)
        if (!playerProfile) {
            playerProfile = {
                id: playerId,
                name: playerInfo?.name || `Player ${playerId.slice(-4)}`,
                rating: 1200, // Starting rating
                favoriteZodiac: playerInfo?.favoriteZodiac || 'aries',
                gamesPlayed: 0,
                gamesWon: 0,
                preferredGameMode: gameMode,
                lastActive: Date.now(),
            }
            playerProfiles.set(playerId, playerProfile)
        } else {
            // Update last active
            playerProfile.lastActive = Date.now()
        }

        // Get matchmaking pool for this game mode
        let pool = matchmakingPools.get(gameMode)
        if (!pool) {
            pool = new Set()
            matchmakingPools.set(gameMode, pool)
        }

        // Find suitable opponent
        const suitableOpponent = await findMatch(playerProfile, pool, gameMode)

        if (suitableOpponent) {
            // Create match
            const matchId = `match_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`

            activeMatches.set(matchId, {
                player1: playerId,
                player2: suitableOpponent.id,
                startTime: Date.now()
            })

            // Remove both players from pool
            pool.delete(playerId)
            pool.delete(suitableOpponent.id)

            GameLogger.system(`🎮 Match created: ${playerProfile.name} vs ${suitableOpponent.name}`)

            return NextResponse.json({
                status: 'matched',
                matchId,
                opponent: {
                    id: suitableOpponent.id,
                    name: suitableOpponent.name,
                    rating: suitableOpponent.rating,
                    zodiac: suitableOpponent.favoriteZodiac,
                },
                yourSide: 'player1',
                gameMode,
                zodiacCompatibility: getZodiacCompatibility(
                    playerProfile.favoriteZodiac,
                    suitableOpponent.favoriteZodiac
                ),
                cosmicBlessings: getCosmicBlessings(playerProfile, suitableOpponent),
            })
        } else {
            // Add to matchmaking pool
            pool.add(playerId)

            // Clean up old entries
            cleanupMatchmakingPool(pool)

            GameLogger.system(`🎲 ${playerProfile.name} added to ${gameMode} matchmaking pool`)

            return NextResponse.json({
                status: 'searching',
                position: pool.size,
                estimatedWait: estimateWaitTime(pool.size, gameMode),
                cosmicAdvice: getCosmicAdvice(playerProfile.favoriteZodiac),
            })
        }

    } catch (error) {
        GameLogger.error('Matchmaking error:', error)
        return NextResponse.json({ error: 'Matchmaking failed' }, { status: 500 })
    }
}

// Cancel matchmaking
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const playerId = searchParams.get('playerId')
        const gameMode = searchParams.get('gameMode') || 'standard'

        if (!playerId) {
            return NextResponse.json({ error: 'Player ID required' }, { status: 400 })
        }

        // Remove from all pools
        for (const [mode, pool] of matchmakingPools) {
            pool.delete(playerId)
        }

        GameLogger.system(`🚫 ${playerId} cancelled matchmaking`)

        return NextResponse.json({ status: 'cancelled' })

    } catch (error) {
        GameLogger.error('Matchmaking cancellation error:', error)
        return NextResponse.json({ error: 'Cancellation failed' }, { status: 500 })
    }
}

// Find a suitable match
async function findMatch(
    player: PlayerProfile,
    pool: Set<string>,
    gameMode: string
): Promise<PlayerProfile | null> {
    const candidates: PlayerProfile[] = []

    // Get all candidates from pool (excluding current player)
    for (const candidateId of pool) {
        if (candidateId === player.id) continue

        const candidate = playerProfiles.get(candidateId)
        if (candidate && candidate.id !== player.id) {
            candidates.push(candidate)
        }
    }

    // Sort by match quality
    const rankedCandidates = candidates
        .map(candidate => ({
            player: candidate,
            score: calculateMatchScore(player, candidate)
        }))
        .sort((a, b) => b.score - a.score)

    // Return best match if score is acceptable
    if (rankedCandidates.length > 0 && rankedCandidates[0].score > 0.3) {
        return rankedCandidates[0].player
    }

    return null
}

// Calculate match compatibility score
function calculateMatchScore(player1: PlayerProfile, player2: PlayerProfile): number {
    let score = 0

    // Rating proximity (closer ratings = better match)
    const ratingDiff = Math.abs(player1.rating - player2.rating)
    const ratingScore = Math.max(0, 1 - (ratingDiff / 500)) * 0.4
    score += ratingScore

    // Zodiac compatibility
    const zodiacScore = getZodiacCompatibility(player1.favoriteZodiac, player2.favoriteZodiac) * 0.3
    score += zodiacScore

    // Experience level proximity
    const experienceDiff = Math.abs(player1.gamesPlayed - player2.gamesPlayed)
    const experienceScore = Math.max(0, 1 - (experienceDiff / 100)) * 0.2
    score += experienceScore

    // Recent activity (prefer active players)
    const timeSinceActive = Date.now() - player2.lastActive
    const activityScore = Math.max(0, 1 - (timeSinceActive / 60000)) * 0.1 // 1 minute decay
    score += activityScore

    return Math.min(1, score)
}

// Simplified tarot-themed zodiac compatibility
function getZodiacCompatibility(zodiac1: ZodiacClass, zodiac2: ZodiacClass): number {
    // Element-based compatibility
    const elements: Record<ZodiacClass, string> = {
        'aries': 'fire', 'leo': 'fire', 'sagittarius': 'fire',
        'taurus': 'earth', 'virgo': 'earth', 'capricorn': 'earth',
        'gemini': 'air', 'libra': 'air', 'aquarius': 'air',
        'cancer': 'water', 'scorpio': 'water', 'pisces': 'water',
    }

    const element1 = elements[zodiac1]
    const element2 = elements[zodiac2]

    // Same element = high compatibility
    if (element1 === element2) return 0.8

    // Compatible elements
    const compatible = [
        ['fire', 'air'], ['earth', 'water']
    ]

    for (const pair of compatible) {
        if ((pair.includes(element1) && pair.includes(element2))) {
            return 0.6
        }
    }

    // Same sign = neutral
    if (zodiac1 === zodiac2) return 0.5

    // Default compatibility
    return 0.4
}

// Generate cosmic blessings for matched players
function getCosmicBlessings(player1: PlayerProfile, player2: PlayerProfile): string[] {
    const blessings: string[] = []

    // Based on zodiac compatibility
    const compatibility = getZodiacCompatibility(player1.favoriteZodiac, player2.favoriteZodiac)

    if (compatibility >= 0.8) {
        blessings.push('⭐ Perfect Celestial Alignment')
        blessings.push('🌙 The Moon smiles upon this union')
    } else if (compatibility >= 0.6) {
        blessings.push('✨ Harmonious Energies Flow')
        blessings.push('🔮 The Cards Whisper of Balance')
    } else {
        blessings.push('⚡ Opposing Forces Create Growth')
        blessings.push('🌟 Challenge Breeds Strength')
    }

    // Based on rating proximity
    const ratingDiff = Math.abs(player1.rating - player2.rating)
    if (ratingDiff < 100) {
        blessings.push('⚖️ Perfectly Matched Souls')
    }

    // Time-based blessings
    const hour = new Date().getHours()
    if (hour >= 0 && hour < 6) {
        blessings.push('🌙 Night Magic Amplifies Power')
    } else if (hour >= 18) {
        blessings.push('🌅 Twilight Brings Mystic Insight')
    } else {
        blessings.push('☀️ Daylight Illuminates the Path')
    }

    return blessings
}

// Get cosmic advice while waiting
function getCosmicAdvice(zodiac: ZodiacClass): string {
    const advice: Record<ZodiacClass, string[]> = {
        'aries': ['⚔️ Channel your warrior spirit', '🔥 Let passion guide your strategy'],
        'taurus': ['🌱 Patience builds powerful foundations', '💎 Steady progress wins'],
        'gemini': ['🦋 Adapt and flow like mercury', '💨 Quick thinking prevails'],
        'cancer': ['🌙 Trust your intuitive wisdom', '🛡️ Protect what matters most'],
        'leo': ['☀️ Shine with confident brilliance', '👑 Lead with generous heart'],
        'virgo': ['📊 Analyze and perfect your approach', '🔍 Details reveal victory'],
        'libra': ['⚖️ Seek balance in all things', '🕊️ Harmony conquers chaos'],
        'scorpio': ['🦂 Strike with precise intensity', '🔮 Hidden depths hold power'],
        'sagittarius': ['🏹 Aim for distant horizons', '🌟 Adventure awaits the bold'],
        'capricorn': ['🏔️ Climb steadily toward triumph', '🐐 Ambition shapes destiny'],
        'aquarius': ['💧 Flow beyond conventional limits', '🌊 Innovation opens new paths'],
        'pisces': ['🐟 Swim in streams of possibility', '✨ Dreams manifest into reality'],
    }

    const zodiacAdvice = advice[zodiac] || ['🎴 The cards hold your answer']
    return zodiacAdvice[Math.floor(Math.random() * zodiacAdvice.length)]
}

// Estimate wait time based on pool size
function estimateWaitTime(poolSize: number, gameMode: string): string {
    if (poolSize === 1) return '⏳ Seeking a worthy opponent...'
    if (poolSize <= 3) return '🌟 Match likely within 30 seconds'
    if (poolSize <= 6) return '⭐ Match expected within 1 minute'
    if (poolSize <= 10) return '✨ High activity - matching soon'
    return '🔮 The cards are aligning...'
}

// Cleanup inactive players from pools
function cleanupMatchmakingPool(pool: Set<string>): void {
    const cutoffTime = Date.now() - 300000 // 5 minutes

    for (const playerId of pool) {
        const profile = playerProfiles.get(playerId)
        if (!profile || profile.lastActive < cutoffTime) {
            pool.delete(playerId)
            GameLogger.system(`🧹 Removed inactive player ${playerId} from pool`)
        }
    }
}

// Get current matchmaking statistics
export async function GET(request: NextRequest) {
    try {
        const stats = {
            totalPools: matchmakingPools.size,
            totalPlayers: Array.from(matchmakingPools.values()).reduce((sum, pool) => sum + pool.size, 0),
            activeMatches: activeMatches.size,
            poolsByMode: Object.fromEntries(
                Array.from(matchmakingPools.entries()).map(([mode, pool]) => [mode, pool.size])
            ),
            cosmicAlignment: getCurrentCosmicAlignment(),
        }

        return NextResponse.json(stats)
    } catch (error) {
        GameLogger.error('Error getting matchmaking stats:', error)
        return NextResponse.json({ error: 'Failed to get stats' }, { status: 500 })
    }
}

// Get current cosmic alignment for fun
function getCurrentCosmicAlignment(): { phase: string; blessing: string } {
    const phases = [
        { phase: 'New Moon', blessing: 'New beginnings await' },
        { phase: 'Waxing Moon', blessing: 'Power grows stronger' },
        { phase: 'Full Moon', blessing: 'Maximum mystical energy' },
        { phase: 'Waning Moon', blessing: 'Release and renewal' },
    ]

    const currentPhase = phases[Math.floor(Date.now() / 86400000) % 4] // Daily rotation
    return currentPhase
}
