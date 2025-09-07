"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Trophy, 
  Skull, 
  Star, 
  Sparkles, 
  RotateCcw, 
  Home,
  Crown,
  Zap
} from "lucide-react"

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
  onBackToMenu 
}: GameOutcomeScreenProps) {
  if (outcome === 'ongoing') return null

  const isVictory = outcome === 'player1_wins'
  const title = isVictory ? "🎉 VICTORY!" : "💀 DEFEAT"
  const subtitle = isVictory 
    ? "The mystical forces bow to your mastery!" 
    : "The cosmos has claimed another soul..."

  const bgGradient = isVictory 
    ? "from-amber-900/95 via-yellow-900/95 to-amber-900/95"
    : "from-red-900/95 via-black/95 to-purple-900/95"

  const borderColor = isVictory ? "border-amber-500/50" : "border-red-500/50"
  const textColor = isVictory ? "text-amber-100" : "text-red-100"
  const accentColor = isVictory ? "text-amber-400" : "text-red-400"

  const MainIcon = isVictory ? Trophy : Skull

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      {/* Floating particles animation */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className={`absolute animate-float ${isVictory ? 'text-amber-400' : 'text-red-400'}`}
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${3 + Math.random() * 2}s`
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
          max-w-md w-full mx-auto bg-gradient-to-br ${bgGradient} 
          border-2 ${borderColor} shadow-2xl
          animate-in zoom-in-50 duration-700 ease-out
        `}
      >
        <CardContent className="p-8 text-center space-y-6">
          {/* Main Icon with glow effect */}
          <div className={`
            mx-auto w-20 h-20 rounded-full flex items-center justify-center
            bg-gradient-to-br from-black/20 to-transparent
            shadow-2xl animate-pulse
            ${isVictory ? 'shadow-amber-500/50' : 'shadow-red-500/50'}
          `}>
            <MainIcon className={`w-12 h-12 ${accentColor} animate-bounce`} />
          </div>

          {/* Title with animated text */}
          <div className="space-y-2">
            <h1 className={`
              text-4xl font-bold ${textColor} 
              animate-in slide-in-from-top-4 duration-1000 delay-300
              tracking-wide
            `}>
              {title}
            </h1>
            <p className={`
              text-lg ${accentColor} 
              animate-in slide-in-from-top-4 duration-1000 delay-500
              font-medium
            `}>
              {subtitle}
            </p>
          </div>

          {/* Game stats */}
          <div className={`
            space-y-3 p-4 rounded-lg bg-black/30 border border-white/10
            animate-in slide-in-from-bottom-4 duration-1000 delay-700
          `}>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-300">Final Health:</span>
              <div className="flex gap-4">
                <Badge variant={isVictory ? "default" : "destructive"} className="text-xs">
                  You: {playerHealth}
                </Badge>
                <Badge variant={isVictory ? "destructive" : "default"} className="text-xs">
                  AI: {opponentHealth}
                </Badge>
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-300">Game Length:</span>
              <div className="flex items-center gap-1 text-xs text-slate-200">
                <Zap className="w-3 h-3" />
                Round {round} • Turn {turn}
              </div>
            </div>
          </div>

          {/* Victory rewards (only show on win) */}
          {isVictory && (
            <div className={`
              p-3 rounded-lg bg-amber-900/30 border border-amber-500/30
              animate-in slide-in-from-bottom-4 duration-1000 delay-900
            `}>
              <div className="flex items-center justify-center gap-2 text-amber-300 text-sm">
                <Crown className="w-4 h-4" />
                <span>+50 Essence • +1 Victory</span>
                <Crown className="w-4 h-4" />
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className={`
            flex gap-3 pt-4
            animate-in slide-in-from-bottom-4 duration-1000 delay-1100
          `}>
            <Button
              onClick={onPlayAgain}
              className={`
                flex-1 gap-2 font-semibold
                ${isVictory 
                  ? 'bg-amber-700 hover:bg-amber-600 text-amber-100' 
                  : 'bg-red-700 hover:bg-red-600 text-red-100'
                }
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
                border-slate-600 text-slate-200 hover:text-slate-100
                hover:bg-slate-800 hover:border-slate-500
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