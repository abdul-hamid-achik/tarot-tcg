'use client'

import { produce } from 'immer'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { GameBoardErrorBoundary } from '@/components/error_boundary'
import TarotGameBoard from '@/components/game_board'
import { GameSummary } from '@/components/game_summary'
import { Button } from '@/components/ui/button'
import { useAIController } from '@/hooks/use_ai_controller'
import { useGameTracker } from '@/hooks/use_game_tracker'
import { GameLogger } from '@/lib/game_logger'
import { checkGameOutcome, createInitialGameState, initializeCards } from '@/lib/game_logic'
import type { GameState } from '@/schemas/schema'
import { soundService } from '@/services/sound_service'
import { useGameStore } from '@/store/game_store'

function createTutorialSeed(): GameState {
  initializeCards()
  return produce(createInitialGameState(), draft => {
    draft.player1.mana = 3
    draft.player1.maxMana = 3
    draft.player2.mana = 3
    draft.player2.maxMana = 3
  })
}

export default function Tutorial() {
  const router = useRouter()
  const [seedState, setSeedState] = useState<GameState | null>(() => createTutorialSeed())
  const [matchId, setMatchId] = useState(1)
  const [gameOutcome, setGameOutcome] = useState<'player1_wins' | 'player2_wins' | 'ongoing'>(
    'ongoing',
  )
  const liveState = useGameStore(state => state.gameState)

  useAIController({
    enabled: seedState !== null && gameOutcome === 'ongoing',
    autoPlay: true,
    difficulty: 'tutorial',
  })

  const { newAchievements, gameRecord } = useGameTracker(
    liveState,
    gameOutcome,
    'tutorial',
    'Tutorial',
    matchId,
  )

  const startMatch = () => {
    setSeedState(createTutorialSeed())
    setMatchId(id => id + 1)
    setGameOutcome('ongoing')
    GameLogger.state('Tutorial initialized')
  }

  useEffect(() => {
    if (!liveState) return
    const outcome = checkGameOutcome(liveState)
    if (outcome !== 'ongoing' && gameOutcome === 'ongoing') {
      soundService.play(outcome === 'player1_wins' ? 'game_win' : 'game_lose')
    }
    setGameOutcome(outcome)
  }, [liveState, gameOutcome])

  if (gameOutcome !== 'ongoing') {
    return (
      <div className="relative flex h-dvh max-h-dvh w-full flex-col overflow-hidden bg-background text-foreground">
        <GameSummary
          outcome={gameOutcome}
          gameRecord={gameRecord}
          newAchievements={newAchievements}
          onPlayAgain={startMatch}
          onReturnHome={() => router.push('/')}
        />
      </div>
    )
  }

  return (
    <div className="relative flex h-dvh max-h-dvh w-full flex-col overflow-hidden bg-background text-foreground">
      <header className="flex shrink-0 items-center justify-end border-b border-border px-3 py-2">
        <Button
          type="button"
          onClick={startMatch}
          variant="outline"
          size="sm"
          title="Reset"
          aria-label="Reset tutorial"
        >
          Reset
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden">
        {seedState && (
          <GameBoardErrorBoundary onReset={startMatch}>
            <TarotGameBoard key={matchId} gameState={seedState} />
          </GameBoardErrorBoundary>
        )}
      </div>
    </div>
  )
}
