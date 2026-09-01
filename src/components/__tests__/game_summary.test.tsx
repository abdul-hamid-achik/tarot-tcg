import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GameSummary } from '@/components/game_summary'
import type { GameRecord } from '@/schemas/stats_schema'

vi.mock('@/services/achievement_service', () => ({
  achievementService: {
    getDefinition: vi.fn(),
  },
}))

const record: GameRecord = {
  id: 'game_test',
  result: 'win',
  difficulty: 'tutorial',
  deckName: 'Random',
  rounds: 7,
  durationSeconds: 95,
  cardsPlayed: 6,
  unitsPlayed: 5,
  spellsPlayed: 1,
  damageDealt: 22,
  unitsDestroyed: 2,
  unitsLost: 0,
  manaSpent: 18,
  uniqueCardsPlayed: [],
  majorArcanaPlayed: [],
  zodiacClassesUsed: [],
  playerHealthRemaining: 15,
  opponentHealthRemaining: -2,
  timestamp: Date.now(),
}

describe('GameSummary', () => {
  it('shows victory copy without stats when no record is present', () => {
    render(
      <GameSummary
        outcome="player1_wins"
        gameRecord={null}
        newAchievements={[]}
        onPlayAgain={vi.fn()}
        onReturnHome={vi.fn()}
      />,
    )

    expect(screen.getByRole('heading', { name: 'VICTORY' })).toBeTruthy()
    expect(screen.getByText('You emerged victorious!')).toBeTruthy()
    expect(screen.queryByText('Game Stats')).toBeNull()
  })

  it('renders match stats and clamped nexus health from the game record', () => {
    render(
      <GameSummary
        outcome="player1_wins"
        gameRecord={record}
        newAchievements={[]}
        onPlayAgain={vi.fn()}
        onReturnHome={vi.fn()}
      />,
    )

    expect(screen.getByText("Opponent's nexus destroyed")).toBeTruthy()
    expect(screen.getByText('Training · Random')).toBeTruthy()
    expect(screen.getByText('Game Stats')).toBeTruthy()
    expect(screen.getByText('7')).toBeTruthy()
    expect(screen.getByText('1m 35s')).toBeTruthy()
    expect(screen.getByText('22')).toBeTruthy()
    expect(screen.getByText('15 HP')).toBeTruthy()
    expect(screen.getByText('0 HP')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Play Again' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Return Home' })).toBeTruthy()
  })
})
