'use client'

import { useEffect, useState } from 'react'
import TarotGameBoard from '@/components/game_board'
import { Button } from '@/components/ui/button'
import { useAIController } from '@/hooks/use_ai_controller'
import { GameLogger } from '@/lib/game_logger'
import {
  aiMulligan,
  checkGameOutcome,
  createInitialGameState,
  completeMulligan,
  endTurn,
  initializeCards,
  playCard,
} from '@/lib/game_logic'
import { declareAttack } from '@/lib/combat_logic'
import type { Card, GameState, ZodiacClass } from '@/schemas/schema'

export default function Tutorial() {
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [message, setMessage] = useState('🎴 Welcome to the Tarot TCG!')
  const [gameOutcome, setGameOutcome] = useState<'player1_wins' | 'player2_wins' | 'ongoing'>('ongoing')

  const { executeAI } = useAIController({
    enabled: true,
    autoPlay: true,
    difficulty: 'easy'
  })

  // Initialize tutorial game
  useEffect(() => {
    initializeCards()
    const initialState = createInitialGameState()
    setGameState(initialState)
    setMessage('🃏 Tutorial started! Complete your mulligan or click "Keep All" to begin.')
    GameLogger.state('Tutorial initialized')
  }, [])

  // Check for game outcome
  useEffect(() => {
    if (gameState) {
      const outcome = checkGameOutcome(gameState)
      setGameOutcome(outcome)

      if (outcome !== 'ongoing') {
        const winner = outcome === 'player1_wins' ? 'You' : 'AI'
        setMessage(`🎊 Game Over! ${winner} wins!`)
      }
    }
  }, [gameState])

  // Auto-execute AI turn
  useEffect(() => {
    if (gameState?.activePlayer === 'player2' && gameOutcome === 'ongoing') {
      const timer = setTimeout(() => {
        executeAI()
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [gameState?.activePlayer, gameOutcome, executeAI])

  const handleCardPlay = async (card: Card) => {
    if (!gameState) return

    // Basic validation
    const totalMana = gameState.player1.mana + gameState.player1.spellMana
    if (card.cost > totalMana) {
      setMessage(`⚠️ Not enough mana! Need ${card.cost}, have ${totalMana}`)
      return
    }

    if (card.type === 'unit') {
      const playerUnits = gameState.battlefield.playerUnits.filter(u => u !== null)
      if (playerUnits.length >= 7) {
        setMessage('⚠️ Battlefield is full! Maximum 7 units allowed.')
        return
      }
    }

    try {
      const newState = await playCard(gameState, card)
      setGameState(newState)
      setMessage(
        `✅ Played ${card.name} (${newState.battlefield.playerUnits.filter(u => u !== null).length}/7 units on battlefield)`,
      )
    } catch (error) {
      console.error('Error playing card:', error)
      setMessage('❌ Failed to play card. Please try again.')
    }
  }

  const handleMulligan = async (selectedCards: string[]) => {
    if (!gameState) return

    try {
      // Set selected cards for mulligan
      const newState = { ...gameState }
      newState.player1.selectedForMulligan = selectedCards

      const mulliganedState = completeMulligan(newState)
      setGameState(mulliganedState)

      if (selectedCards.length === 0) {
        setMessage('✨ All cards kept! Game begins.')
      } else {
        setMessage(`🔄 Replaced ${selectedCards.length} cards. Game begins!`)
      }
    } catch (error) {
      console.error('Error in mulligan:', error)
      setMessage('❌ Mulligan failed. Please try again.')
    }
  }

  const handleEndTurn = async () => {
    if (!gameState) return

    try {
      const newState = await endTurn(gameState)
      setGameState(newState)
      setMessage(`🔄 Turn passed to ${newState.activePlayer === 'player1' ? 'you' : 'AI'}`)
    } catch (error) {
      console.error('Error ending turn:', error)
      setMessage('❌ Failed to end turn. Please try again.')
    }
  }

  const resetGame = () => {
    const newState = createInitialGameState()
    setGameState(newState)
    setGameOutcome('ongoing')
    setMessage('🔄 Game reset! Complete your mulligan to begin.')
    GameLogger.state('Tutorial reset')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-indigo-950 to-purple-950">
      {/* Tutorial Header */}
      <div className="fixed top-4 left-4 right-4 z-50 flex justify-between items-center">
        <div className="bg-gray-900/90 backdrop-blur-sm border border-purple-600/50 rounded-lg px-4 py-2">
          <h1 className="text-lg font-bold text-purple-400">🎴 Tarot TCG Tutorial</h1>
          <p className="text-sm text-gray-300">{message}</p>
        </div>

        <Button
          onClick={resetGame}
          className="bg-purple-600 hover:bg-purple-700 text-white"
        >
          🔄 Reset Game
        </Button>
      </div>

      {/* Game Board */}
      {gameState && (
        <TarotGameBoard
          gameState={gameState}
          onCardPlay={handleCardPlay}
          onEndTurn={handleEndTurn}
          onMulligan={handleMulligan}
        />
      )}

      {/* Game Outcome */}
      {gameOutcome !== 'ongoing' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-purple-600 rounded-xl p-8 text-center">
            <h2 className="text-2xl font-bold text-purple-400 mb-4">
              {gameOutcome === 'player1_wins' ? '🎉 You Win!' : '💀 AI Wins!'}
            </h2>
            <div className="flex gap-4">
              <Button onClick={resetGame} className="bg-purple-600 hover:bg-purple-700">
                🔄 Play Again
              </Button>
              <Button onClick={() => window.location.href = '/'} variant="outline">
                🏠 Main Menu
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tutorial Tips */}
      <div className="fixed bottom-4 left-4 max-w-sm">
        <div className="bg-indigo-900/90 backdrop-blur-sm border border-indigo-600/50 rounded-lg p-4">
          <h3 className="text-sm font-bold text-indigo-400 mb-2">💡 Tutorial Tips</h3>
          <ul className="text-xs text-indigo-200 space-y-1">
            <li>• Click cards in hand to play them</li>
            <li>• Click your units to attack with them</li>
            <li>• Click enemy units or player to target</li>
            <li>• Watch for reversed cards (🔄) - they have different effects!</li>
            <li>• Pay attention to zodiac buffs (seasonal bonuses)</li>
          </ul>
        </div>
      </div>
    </div>
  )
}