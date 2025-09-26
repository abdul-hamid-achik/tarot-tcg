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
  const [showTutorialTips, setShowTutorialTips] = useState(false)

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
    <div className="h-screen w-screen bg-white overflow-hidden relative">
      {/* Floating Settings Cog */}
      <div className="fixed top-4 right-4 z-50">
        <Button
          onClick={resetGame}
          className="bg-black hover:bg-gray-800 text-white rounded-full w-12 h-12 p-0 shadow-lg"
          title="Game Settings & Reset"
        >
          ⚙️
        </Button>
      </div>

      {/* Floating End Turn Button */}
      {gameState?.activePlayer === 'player1' && gameState?.phase === 'action' && (
        <div className="fixed bottom-4 right-4 z-50">
          <Button
            onClick={handleEndTurn}
            className="bg-black hover:bg-gray-800 text-white px-6 py-3 text-lg font-bold rounded-lg shadow-lg"
          >
            End Turn
          </Button>
        </div>
      )}

      {/* Game Board - Full Screen */}
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

    </div>
  )
}