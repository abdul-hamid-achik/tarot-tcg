'use client'

import { produce } from 'immer'
import { ArrowLeft, BarChart3, RotateCcw, Swords, Trophy } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { GameBoardErrorBoundary } from '@/components/error_boundary'
import TarotGameBoard from '@/components/game_board'
import { AchievementToast } from '@/components/stats/achievement_toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAIController } from '@/hooks/use_ai_controller'
import { useGameTracker } from '@/hooks/use_game_tracker'
import { getAllCards } from '@/lib/card_loader'
import { GameLogger } from '@/lib/game_logger'
import {
  checkGameOutcome,
  completeMulligan,
  createInitialGameState,
  endTurn,
  initializeCards,
  playCard,
} from '@/lib/game_logic'
import type { Card, GameState } from '@/schemas/schema'
import type { AILevel } from '@/services/ai_service'
import { soundService } from '@/services/sound_service'

type GameScreen = 'setup' | 'playing'

function PlayContent() {
  const searchParams = useSearchParams()
  const deckParam = searchParams.get('deck')

  const [screen, setScreen] = useState<GameScreen>('setup')
  const [difficulty, setDifficulty] = useState<AILevel>('easy')
  const [selectedDeckName, setSelectedDeckName] = useState<string>(deckParam || '')
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [gameOutcome, setGameOutcome] = useState<'player1_wins' | 'player2_wins' | 'ongoing'>(
    'ongoing',
  )
  const [savedDecks, setSavedDecks] = useState<{ name: string; cards: string[] }[]>([])

  const { executeAI } = useAIController({
    enabled: screen === 'playing',
    autoPlay: true,
    difficulty,
  })

  const { newAchievements, clearAchievements } = useGameTracker(
    gameState,
    gameOutcome,
    difficulty,
    selectedDeckName,
  )

  // Load saved decks
  useEffect(() => {
    try {
      const saved = localStorage.getItem('tarot-tcg-decks')
      if (saved) {
        setSavedDecks(JSON.parse(saved))
      }
    } catch {
      // Corrupted localStorage data - ignore
    }
  }, [])

  // Check for game outcome
  useEffect(() => {
    if (gameState) {
      const outcome = checkGameOutcome(gameState)
      if (outcome !== 'ongoing' && gameOutcome === 'ongoing') {
        soundService.play(outcome === 'player1_wins' ? 'game_win' : 'game_lose')
      }
      setGameOutcome(outcome)
    }
  }, [gameState, gameOutcome])

  // Auto-execute AI turn
  useEffect(() => {
    if (
      gameState?.activePlayer === 'player2' &&
      gameState?.phase === 'action' &&
      gameOutcome === 'ongoing'
    ) {
      const timer = setTimeout(() => {
        executeAI()
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [
    gameState?.activePlayer,
    gameState?.phase,
    gameOutcome,
    executeAI,
    gameState?.player2?.hand?.length,
    gameState?.player2?.mana,
    gameState?.player1?.mulliganComplete,
    gameState?.player2?.mulliganComplete,
  ])

  const startGame = () => {
    initializeCards()

    let initialState: GameState

    // Check if using a custom deck
    if (selectedDeckName) {
      const savedDeck = savedDecks.find(d => d.name === selectedDeckName)
      if (savedDeck) {
        const allCards = getAllCards()
        const deckCards = savedDeck.cards
          .map(id => allCards.find(c => c.id === id))
          .filter(Boolean) as Card[]

        if (deckCards.length >= 30) {
          // Create game state with custom deck
          initialState = createInitialGameState()
          initialState = produce(initialState, draft => {
            // Shuffle the custom deck
            const shuffled = [...deckCards].sort(() => Math.random() - 0.5)
            draft.player1.deck = shuffled.slice(5) // Rest goes to deck
            draft.player1.hand = shuffled.slice(0, 5) // Draw 5 cards
          })
        } else {
          initialState = createInitialGameState()
        }
      } else {
        initialState = createInitialGameState()
      }
    } else {
      initialState = createInitialGameState()
    }

    setGameState(initialState)
    setGameOutcome('ongoing')
    setScreen('playing')
    GameLogger.state('Game started', { difficulty, deck: selectedDeckName || 'random' })
  }

  const handleCardPlay = async (card: Card) => {
    if (!gameState) return

    const totalMana = gameState.player1.mana + gameState.player1.spellMana
    if (card.cost > totalMana) return

    if (card.type === 'unit') {
      const playerUnits = gameState.battlefield.playerUnits.filter(u => u !== null)
      if (playerUnits.length >= 7) return
    }

    try {
      const newState = await playCard(gameState, card)
      setGameState(newState)
    } catch (error) {
      console.error('Error playing card:', error)
    }
  }

  const handleMulligan = async (selectedCards: string[]) => {
    if (!gameState) return

    try {
      const preparedState = produce(gameState, draft => {
        draft.player1.selectedForMulligan = selectedCards
        draft.player2.mulliganComplete = true
        draft.player2.selectedForMulligan = []
      })

      let mulliganedState = completeMulligan(preparedState)

      if (
        mulliganedState.player1.mulliganComplete &&
        mulliganedState.player2.mulliganComplete &&
        mulliganedState.phase !== 'action'
      ) {
        mulliganedState = produce(mulliganedState, draft => {
          draft.phase = 'action'
          draft.waitingForAction = true
        })
      }

      setGameState(mulliganedState)
    } catch (error) {
      console.error('Error in mulligan:', error)
    }
  }

  const handleEndTurn = async () => {
    if (!gameState) return
    try {
      const newState = await endTurn(gameState)
      setGameState(newState)
    } catch (error) {
      console.error('Error ending turn:', error)
    }
  }

  const resetGame = () => {
    setScreen('setup')
    setGameState(null)
    setGameOutcome('ongoing')
  }

  const difficulties: { level: AILevel; name: string; desc: string; icon: string }[] = [
    { level: 'tutorial', name: 'Training', desc: 'Learn the basics', icon: '🎯' },
    { level: 'easy', name: 'Novice', desc: 'Relaxed gameplay', icon: '🌟' },
    { level: 'normal', name: 'Apprentice', desc: 'Balanced challenge', icon: '🔮' },
    { level: 'hard', name: 'Master', desc: 'Strategic play', icon: '⭐' },
    { level: 'expert', name: 'Oracle', desc: 'Maximum challenge', icon: '👑' },
  ]

  if (screen === 'setup') {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <div className="max-w-2xl w-full space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold">New Game</h1>
            <p className="text-muted-foreground">Choose your difficulty and deck</p>
          </div>

          {/* Difficulty Selection */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Difficulty</h2>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
              {difficulties.map(d => (
                <button
                  key={d.level}
                  onClick={() => setDifficulty(d.level)}
                  className={`p-3 rounded-lg border-2 transition-all text-center ${
                    difficulty === d.level
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="text-2xl">{d.icon}</div>
                  <div className="font-semibold text-sm">{d.name}</div>
                  <div className="text-xs text-muted-foreground">{d.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Deck Selection */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Deck</h2>
            <div className="space-y-2">
              <button
                onClick={() => setSelectedDeckName('')}
                className={`w-full p-3 rounded-lg border-2 transition-all text-left flex items-center gap-3 ${
                  !selectedDeckName
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <span className="text-2xl">🎲</span>
                <div>
                  <div className="font-semibold">Random Deck</div>
                  <div className="text-xs text-muted-foreground">30 randomly selected cards</div>
                </div>
              </button>

              {savedDecks.map(d => (
                <button
                  key={d.name}
                  onClick={() => setSelectedDeckName(d.name)}
                  className={`w-full p-3 rounded-lg border-2 transition-all text-left flex items-center justify-between ${
                    selectedDeckName === d.name
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📋</span>
                    <div>
                      <div className="font-semibold">{d.name}</div>
                      <div className="text-xs text-muted-foreground">{d.cards.length} cards</div>
                    </div>
                  </div>
                  {selectedDeckName === d.name && (
                    <Badge className="bg-primary text-primary-foreground">Selected</Badge>
                  )}
                </button>
              ))}

              {savedDecks.length === 0 && (
                <Link href="/deck-builder">
                  <div className="w-full p-3 rounded-lg border-2 border-dashed border-border hover:border-primary/50 text-center text-sm text-muted-foreground cursor-pointer transition-colors">
                    No saved decks yet. Build one in the Deck Builder.
                  </div>
                </Link>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-center">
            <Link href="/">
              <Button variant="outline" size="lg">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <Button
              size="lg"
              onClick={startGame}
              className="bg-primary text-primary-foreground px-8"
            >
              <Swords className="w-4 h-4 mr-2" />
              Start Game
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Playing screen
  return (
    <div className="h-screen w-screen bg-background text-foreground overflow-hidden relative transition-colors">
      {/* Back button */}
      <div className="fixed top-2 left-2 md:top-4 md:left-4 z-50">
        <Button
          onClick={resetGame}
          variant="outline"
          className="rounded-full w-8 h-8 md:w-10 md:h-10 p-0 shadow-lg"
          title="Back to setup"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
      </div>

      {/* Reset button */}
      <div className="fixed top-2 right-2 md:top-4 md:right-4 z-50">
        <Button
          onClick={() => {
            startGame()
          }}
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full w-10 h-10 md:w-12 md:h-12 p-0 shadow-lg"
          title="Restart Game"
        >
          <RotateCcw className="w-5 h-5" />
        </Button>
      </div>

      {/* Game Board */}
      {gameState && (
        <GameBoardErrorBoundary onReset={resetGame}>
          <TarotGameBoard
            gameState={gameState}
            onCardPlay={handleCardPlay}
            onEndTurn={handleEndTurn}
            onMulligan={handleMulligan}
          />
        </GameBoardErrorBoundary>
      )}

      {/* Achievement Toast */}
      {newAchievements.length > 0 && (
        <AchievementToast achievements={newAchievements} onDismiss={clearAchievements} />
      )}

      {/* Game Outcome */}
      {gameOutcome !== 'ongoing' && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl p-8 text-center shadow-2xl max-w-md mx-4 space-y-4">
            <div className="text-5xl">{gameOutcome === 'player1_wins' ? '🎉' : '💀'}</div>
            <h2 className="text-3xl font-bold">
              {gameOutcome === 'player1_wins' ? 'Victory!' : 'Defeat'}
            </h2>
            <p className="text-muted-foreground">
              {gameOutcome === 'player1_wins'
                ? 'Your mastery of the tarot prevails!'
                : 'The cards were not in your favor this time.'}
            </p>

            <div className="flex gap-3 justify-center pt-2">
              <Button onClick={() => startGame()} variant="outline">
                <RotateCcw className="w-4 h-4 mr-2" />
                Play Again
              </Button>
              <Button onClick={resetGame}>
                <Trophy className="w-4 h-4 mr-2" />
                Change Settings
              </Button>
              <Link href="/stats">
                <Button variant="ghost">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  View Stats
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function PlayPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <PlayContent />
    </Suspense>
  )
}
