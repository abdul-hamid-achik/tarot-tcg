'use client'

import { Crown, Home, RotateCcw, Skull, Sparkles, Star, Trophy, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface GameOutcomeScreenProps {
  outcome: 'player1_wins' | 'player2_wins' | 'ongoing'
  playerHealth: number
  opponentHealth: number
  round: number
  turn: number
  onPlayAgain: () => void
  onBackToMenu: () => void
}

export default function GameOutcomeScreen({
  outcome,
  playerHealth,
  opponentHealth,
  round,
  turn,
  onPlayAgain,
  onBackToMenu,
}: GameOutcomeScreenProps) {
  if (outcome === 'ongoing') return null

  const isVictory = outcome === 'player1_wins'
  const title = isVictory ? '🎉 VICTORY!' : '💀 DEFEAT'
  const subtitle = isVictory
    ? 'The mystical forces bow to your mastery!'
    : 'The cosmos has claimed another soul...'

  const bgGradient = 'bg-white'
  const borderColor = 'border-gray-400'
  const textColor = 'text-black'
  const accentColor = isVictory ? 'text-gray-800' : 'text-gray-700'

  const MainIcon = isVictory ? Trophy : Skull

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      {/* Floating particles animation */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 20 }, (_, i) => i).map(i => (
          <div
            key={`particle-${i}`}
            className={`absolute animate-float text-gray-600`}
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${3 + Math.random() * 2}s`,
            }}
          >
            {isVictory ? (
              <Star className="w-4 h-4 animate-pulse" />
            ) : (
              <Sparkles className="w-3 h-3 animate-pulse" />
            )}
          </div>
        ))}
      </div>

      {/* Main outcome card */}
      <Card
        className={`
          max-w-md w-full mx-auto ${bgGradient} 
          border-2 ${borderColor} shadow-2xl
          animate-in zoom-in-50 duration-700 ease-out
        `}
      >
        <CardContent className="p-8 text-center space-y-6">
          {/* Main Icon with glow effect */}
          <div
            className={`
            mx-auto w-20 h-20 rounded-full flex items-center justify-center
            bg-gray-100 border-2 border-gray-300
            shadow-lg animate-pulse
          `}
          >
            <MainIcon className={`w-12 h-12 ${accentColor} animate-bounce`} />
          </div>

          {/* Title with animated text */}
          <div className="space-y-2">
            <h1
              className={`
              text-4xl font-bold ${textColor} 
              animate-in slide-in-from-top-4 duration-1000 delay-300
              tracking-wide
            `}
            >
              {title}
            </h1>
            <p
              className={`
              text-lg ${accentColor} 
              animate-in slide-in-from-top-4 duration-1000 delay-500
              font-medium
            `}
            >
              {subtitle}
            </p>
          </div>

          {/* Game stats */}
          <div
            className={`
            space-y-3 p-4 rounded-lg bg-gray-100 border border-gray-300
            animate-in slide-in-from-bottom-4 duration-1000 delay-700
          `}
          >
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-700">Final Health:</span>
              <div className="flex gap-4">
                <Badge
                  className={`text-xs ${isVictory ? 'bg-gray-800 text-white' : 'bg-gray-600 text-white'}`}
                >
                  You: {playerHealth}
                </Badge>
                <Badge
                  className={`text-xs ${isVictory ? 'bg-gray-600 text-white' : 'bg-gray-800 text-white'}`}
                >
                  AI: {opponentHealth}
                </Badge>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-700">Game Length:</span>
              <div className="flex items-center gap-1 text-xs text-gray-600">
                <Zap className="w-3 h-3" />
                Round {round} • Turn {turn}
              </div>
            </div>
          </div>

          {/* Victory rewards (only show on win) */}
          {isVictory && (
            <div
              className={`
              p-3 rounded-lg bg-gray-50 border border-gray-300
              animate-in slide-in-from-bottom-4 duration-1000 delay-900
            `}
            >
              <div className="flex items-center justify-center gap-2 text-gray-800 text-sm">
                <Crown className="w-4 h-4" />
                <span>+50 Essence • +1 Victory</span>
                <Crown className="w-4 h-4" />
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div
            className={`
            flex gap-3 pt-4
            animate-in slide-in-from-bottom-4 duration-1000 delay-1100
          `}
          >
            <Button
              onClick={onPlayAgain}
              className={`
                flex-1 gap-2 font-semibold
                bg-black hover:bg-gray-900 text-white
                transition-all duration-300 hover:scale-105
              `}
            >
              <RotateCcw className="w-4 h-4" />
              Play Again
            </Button>

            <Button
              onClick={onBackToMenu}
              variant="outline"
              className={`
                flex-1 gap-2 font-semibold
                border-gray-400 text-gray-700 hover:text-black
                hover:bg-gray-100 hover:border-gray-600
                transition-all duration-300 hover:scale-105
              `}
            >
              <Home className="w-4 h-4" />
              Menu
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* CSS for custom animations */}
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); opacity: 0.7; }
          50% { transform: translateY(-20px) rotate(180deg); opacity: 1; }
        }
        .animate-float {
          animation: float infinite ease-in-out;
        }
      `}</style>
    </div>
  )
}
