'use client'

import { RotateCcw, Settings, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface GameHeaderProps {
  onResetGame?: () => void
  onSettings?: () => void
  onHelp?: () => void
  showEndTurnButton?: boolean
  onEndTurn?: () => void
  currentPlayer?: string
  gamePhase?: string
}

export default function GameHeader({
  onResetGame,
  onSettings,
  onHelp,
  showEndTurnButton = false,
  onEndTurn,
  currentPlayer,
  gamePhase
}: GameHeaderProps) {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-300 px-4 py-2">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        {/* Left Side - Game Info */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-black text-white rounded flex items-center justify-center font-bold text-sm">
              ⚡
            </div>
            <div>
              <h1 className="font-bold text-lg text-black">Tarot TCG</h1>
              <p className="text-xs text-gray-600">Strategic Card Game</p>
            </div>
          </div>
          
          {/* Game State Info */}
          {currentPlayer && gamePhase && (
            <div className="hidden sm:flex items-center gap-2 text-sm text-gray-700">
              <span className="capitalize">{gamePhase} Phase</span>
              <span>•</span>
              <span>{currentPlayer === 'player1' ? 'Your Turn' : 'Opponent\'s Turn'}</span>
            </div>
          )}
        </div>

        {/* Center - End Turn Button (when visible) */}
        {showEndTurnButton && (
          <div className="flex-1 flex justify-center">
            <Button
              onClick={onEndTurn}
              className="bg-black hover:bg-gray-800 text-white px-8 py-2 text-lg font-bold rounded-lg shadow-lg transform hover:scale-105 transition-all duration-200"
            >
              End Turn
            </Button>
          </div>
        )}

        {/* Right Side - Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onHelp}
            className="border-gray-300 text-gray-700 hover:bg-gray-100"
            title="Help"
          >
            <HelpCircle className="w-4 h-4" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={onSettings}
            className="border-gray-300 text-gray-700 hover:bg-gray-100"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={onResetGame}
            className="border-gray-300 text-gray-700 hover:bg-gray-100"
            title="Reset Game"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="ml-1 hidden sm:inline">Reset</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
