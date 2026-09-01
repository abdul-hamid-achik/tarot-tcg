'use client'

import { produce } from 'immer'
import { ArrowLeft, RotateCcw, Swords } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { GameBoardErrorBoundary } from '@/components/error_boundary'
import TarotGameBoard from '@/components/game_board'
import { GameSummary } from '@/components/game_summary'
import { AchievementToast } from '@/components/stats/achievement_toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAIController } from '@/hooks/use_ai_controller'
import { useGameTracker } from '@/hooks/use_game_tracker'
import { getAllCards } from '@/lib/card_loader'
import { GameLogger } from '@/lib/game_logger'
import { checkGameOutcome, createInitialGameState, initializeCards } from '@/lib/game_logic'
import type { Card, GameState } from '@/schemas/schema'
import type { AILevel } from '@/services/ai_service'
import { soundService } from '@/services/sound_service'
import { useGameStore } from '@/store/game_store'

type GameScreen = 'setup' | 'playing'

function PlayContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const deckParam = searchParams.get('deck')

  const [screen, setScreen] = useState<GameScreen>('setup')
  const [difficulty, setDifficulty] = useState<AILevel>('easy')
  const [selectedDeckName, setSelectedDeckName] = useState<string>(deckParam || '')
  const [seedState, setSeedState] = useState<GameState | null>(null)
  const [matchId, setMatchId] = useState(0)
  const [gameOutcome, setGameOutcome] = useState<'player1_wins' | 'player2_wins' | 'ongoing'>(
    'ongoing',
  )
  const [savedDecks, setSavedDecks] = useState<{ name: string; cards: string[] }[]>([])
  const liveState = useGameStore(state => state.gameState)

  useAIController({
    enabled: screen === 'playing' && gameOutcome === 'ongoing',
    autoPlay: true,
    difficulty,
  })

  const { newAchievements, clearAchievements, gameRecord } = useGameTracker(
    screen === 'playing' ? liveState : seedState,
    gameOutcome,
    difficulty,
    selectedDeckName || 'Random',
    matchId,
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

  useEffect(() => {
    if (screen !== 'playing' || !liveState) return
    const outcome = checkGameOutcome(liveState)
    if (outcome !== 'ongoing' && gameOutcome === 'ongoing') {
      soundService.play(outcome === 'player1_wins' ? 'game_win' : 'game_lose')
    }
    setGameOutcome(outcome)
  }, [screen, liveState, gameOutcome])

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

    setSeedState(initialState)
    setMatchId(id => id + 1)
    setGameOutcome('ongoing')
    setScreen('playing')
    GameLogger.state('Game started', { difficulty, deck: selectedDeckName || 'random' })
  }

  const resetGame = () => {
    setScreen('setup')
    setSeedState(null)
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
                  type="button"
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
                type="button"
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
                  type="button"
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

  if (gameOutcome !== 'ongoing') {
    return (
      <div className="relative flex h-dvh max-h-dvh w-full flex-col overflow-hidden bg-background text-foreground">
        <GameSummary
          outcome={gameOutcome}
          gameRecord={gameRecord}
          newAchievements={newAchievements}
          onPlayAgain={() => startGame()}
          onReturnHome={() => router.push('/')}
        />
      </div>
    )
  }

  return (
    <div className="relative flex h-dvh max-h-dvh w-full flex-col overflow-hidden bg-background text-foreground">
      <header className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
        <Button
          type="button"
          onClick={resetGame}
          variant="outline"
          size="sm"
          aria-label="Back to setup"
        >
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
          Setup
        </Button>
        <Button
          type="button"
          onClick={startGame}
          variant="outline"
          size="sm"
          aria-label="Restart match"
        >
          <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
          Restart
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden">
        {seedState && (
          <GameBoardErrorBoundary onReset={resetGame}>
            <TarotGameBoard key={matchId} gameState={seedState} />
          </GameBoardErrorBoundary>
        )}
      </div>

      {newAchievements.length > 0 && (
        <AchievementToast achievements={newAchievements} onDismiss={clearAchievements} />
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
