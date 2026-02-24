'use client'

import { GameLogger } from '@/lib/game_logger'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { ZodiacClass } from '@/schemas/schema'

interface MatchmakingMatchData {
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

interface MatchmakingProps {
  onMatchFound: (matchData: MatchmakingMatchData) => void
  onCancel: () => void
  className?: string
}

interface MatchmakingStatus {
  status: 'idle' | 'searching' | 'matched'
  position?: number
  estimatedWait?: string
  cosmicAdvice?: string
  matchData?: MatchmakingMatchData
}

export function MatchmakingInterface({ onMatchFound, onCancel, className }: MatchmakingProps) {
  const [playerName, setPlayerName] = useState('')
  const [favoriteZodiac, setFavoriteZodiac] = useState<ZodiacClass>('aries')
  const [gameMode, setGameMode] = useState('standard')
  const [matchStatus, setMatchStatus] = useState<MatchmakingStatus>({ status: 'idle' })
  const [searchStartTime, setSearchStartTime] = useState<number | null>(null)

  // Polling for matchmaking updates
  useEffect(() => {
    if (matchStatus.status !== 'searching') return

    const interval = setInterval(async () => {
      try {
        // Poll matchmaking endpoint
        const response = await fetch('/api/matchmaking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerId: `player_${Date.now()}`, // TODO: Use proper player ID
            gameMode,
            playerInfo: {
              name: playerName,
              favoriteZodiac,
            },
          }),
        })

        const result = await response.json()

        if (result.status === 'matched') {
          setMatchStatus({ status: 'matched', matchData: result })
          onMatchFound(result)
          clearInterval(interval)
        } else if (result.status === 'searching') {
          setMatchStatus({
            status: 'searching',
            position: result.position,
            estimatedWait: result.estimatedWait,
            cosmicAdvice: result.cosmicAdvice,
          })
        }
      } catch (error) {
        GameLogger.error('Matchmaking poll error:', error)
      }
    }, 2000) // Poll every 2 seconds

    return () => clearInterval(interval)
  }, [matchStatus.status, gameMode, playerName, favoriteZodiac, onMatchFound])

  const handleStartMatchmaking = async () => {
    if (!playerName.trim()) {
      alert('Please enter your name')
      return
    }

    setMatchStatus({ status: 'searching' })
    setSearchStartTime(Date.now())

    try {
      const response = await fetch('/api/matchmaking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: `player_${Date.now()}`,
          gameMode,
          playerInfo: {
            name: playerName,
            favoriteZodiac,
          },
        }),
      })

      const result = await response.json()

      if (result.status === 'matched') {
        setMatchStatus({ status: 'matched', matchData: result })
        onMatchFound(result)
      } else {
        setMatchStatus({
          status: 'searching',
          position: result.position,
          estimatedWait: result.estimatedWait,
          cosmicAdvice: result.cosmicAdvice,
        })
      }
    } catch (error) {
      GameLogger.error('Matchmaking error:', error)
      setMatchStatus({ status: 'idle' })
    }
  }

  const handleCancelMatchmaking = async () => {
    try {
      await fetch(`/api/matchmaking?playerId=player_${Date.now()}&gameMode=${gameMode}`, {
        method: 'DELETE',
      })
    } catch (error) {
      GameLogger.error('Cancel matchmaking error:', error)
    }

    setMatchStatus({ status: 'idle' })
    setSearchStartTime(null)
    onCancel()
  }

  const getSearchDuration = (): string => {
    if (!searchStartTime) return '0s'
    const duration = Math.floor((Date.now() - searchStartTime) / 1000)
    return `${duration}s`
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-6 p-6 bg-white dark:bg-gray-800',
        'border border-gray-300 dark:border-gray-600 rounded-xl shadow-2xl',
        className,
      )}
    >
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-black dark:text-white">🔮 Mystical Matchmaking</h2>
        <p className="text-gray-800 dark:text-gray-200 text-sm mt-1">
          Find a worthy opponent in the cosmic arena
        </p>
      </div>

      {matchStatus.status === 'idle' && (
        <>
          {/* Player Setup */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-800 dark:text-gray-200">
                Your Name
              </label>
              <Input
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                placeholder="Enter your mystical name..."
                className="bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-black dark:text-white"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-800 dark:text-gray-200">
                Zodiac Sign
              </label>
              <Select
                value={favoriteZodiac}
                onValueChange={value => setFavoriteZodiac(value as ZodiacClass)}
              >
                <option value="aries">♈ Aries - The Ram</option>
                <option value="taurus">♉ Taurus - The Bull</option>
                <option value="gemini">♊ Gemini - The Twins</option>
                <option value="cancer">♋ Cancer - The Crab</option>
                <option value="leo">♌ Leo - The Lion</option>
                <option value="virgo">♍ Virgo - The Maiden</option>
                <option value="libra">♎ Libra - The Scales</option>
                <option value="scorpio">♏ Scorpio - The Scorpion</option>
                <option value="sagittarius">♐ Sagittarius - The Archer</option>
                <option value="capricorn">♑ Capricorn - The Goat</option>
                <option value="aquarius">♒ Aquarius - The Water Bearer</option>
                <option value="pisces">♓ Pisces - The Fish</option>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-800 dark:text-gray-200">
                Game Mode
              </label>
              <Select value={gameMode} onValueChange={setGameMode}>
                <option value="standard">🎴 Standard - Classic gameplay</option>
                <option value="arcana_master">🃏 Arcana Master - Complete Major Arcana</option>
                <option value="zodiac_mystic">♈ Zodiac Mystic - Align all signs</option>
                <option value="elemental_sage">🌊 Elemental Sage - Master all elements</option>
                <option value="chaos">⚡ Chaos Mode - Multiple win conditions</option>
              </Select>
            </div>
          </div>

          {/* Start Matchmaking Button */}
          <Button
            onClick={handleStartMatchmaking}
            disabled={!playerName.trim()}
            className="w-full bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-100 font-bold py-3"
          >
            ✨ Seek Opponent in the Cosmic Realm
          </Button>
        </>
      )}

      {matchStatus.status === 'searching' && (
        <div className="flex flex-col gap-4 text-center">
          {/* Searching Animation */}
          <div className="relative">
            <div className="w-16 h-16 mx-auto">
              <div className="absolute inset-0 border-2 border-gray-300 dark:border-gray-600 rounded-full animate-pulse"></div>
              <div className="absolute inset-0 border-2 border-black dark:border-white rounded-full animate-spin opacity-75"></div>
              <div
                className="absolute inset-0 border-2 border-blue-500 dark:border-blue-400 rounded-full animate-spin opacity-50"
                style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}
              ></div>
              <div className="absolute inset-2 flex items-center justify-center text-2xl">🔮</div>
            </div>
          </div>

          {/* Status Info */}
          <div className="flex flex-col gap-2">
            <h3 className="text-xl font-bold text-black dark:text-white">
              Consulting the Oracle...
            </h3>
            <p className="text-gray-800 dark:text-gray-200">
              {matchStatus.estimatedWait || 'Searching for a worthy opponent'}
            </p>

            {matchStatus.position && (
              <Badge variant="outline" className="mx-auto">
                Position {matchStatus.position} in queue
              </Badge>
            )}

            <div className="text-sm text-gray-400 mt-2">Searching for: {getSearchDuration()}</div>
          </div>

          {/* Cosmic Advice */}
          {matchStatus.cosmicAdvice && (
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
              <p className="text-blue-800 dark:text-blue-200 text-sm font-medium">
                {matchStatus.cosmicAdvice}
              </p>
            </div>
          )}

          {/* Cancel Button */}
          <Button
            onClick={handleCancelMatchmaking}
            variant="outline"
            className="border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
          >
            Cancel Search
          </Button>
        </div>
      )}

      {matchStatus.status === 'matched' && matchStatus.matchData && (
        <div className="flex flex-col gap-4 text-center">
          {/* Match Found */}
          <div className="relative">
            <div className="text-6xl animate-bounce">🎉</div>
            <div className="absolute inset-0 animate-ping">
              <div className="w-16 h-16 mx-auto bg-yellow-500/20 rounded-full"></div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-xl font-bold text-green-600 dark:text-green-400">
              🌟 Match Found!
            </h3>
            <p className="text-lg text-black dark:text-white">
              vs {matchStatus.matchData.opponent.name}
            </p>
            <p className="text-sm text-gray-800 dark:text-gray-200">
              {matchStatus.matchData.opponent.zodiac} ♦ Rating:{' '}
              {matchStatus.matchData.opponent.rating}
            </p>
          </div>

          {/* Zodiac Compatibility */}
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-3">
            <p className="text-green-800 dark:text-green-200 text-sm font-medium">
              Zodiac Compatibility: {Math.round(matchStatus.matchData.zodiacCompatibility * 100)}%
            </p>
          </div>

          {/* Cosmic Blessings */}
          {matchStatus.matchData.cosmicBlessings && (
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                Cosmic Blessings:
              </p>
              {matchStatus.matchData.cosmicBlessings.map((blessing: string, index: number) => (
                <p key={index} className="text-xs text-gray-600 dark:text-gray-400">
                  {blessing}
                </p>
              ))}
            </div>
          )}

          <p className="text-xs text-gray-400">Entering battle in 3 seconds...</p>
        </div>
      )}
    </div>
  )
}
