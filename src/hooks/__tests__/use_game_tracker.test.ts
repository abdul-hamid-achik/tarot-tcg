import { renderHook, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGameTracker } from '@/hooks/use_game_tracker'
import { createTestCard, createTestGameState } from '@/test_utils'

// ── Mock services ─────────────────────────────────────────────────────────────
vi.mock('@/services/stats_service', () => ({
  statsService: {
    recordGame: vi.fn().mockReturnValue({ totalGames: 1, wins: 1 }),
  },
  extractBaseCardId: vi.fn((id: string) => id),
}))

vi.mock('@/services/achievement_service', () => ({
  achievementService: {
    checkAchievements: vi.fn().mockReturnValue([]),
    markNotified: vi.fn(),
  },
}))

vi.mock('@/services/quest_service', () => ({
  questService: {
    refreshQuests: vi.fn(),
    updateProgress: vi.fn(),
  },
}))

// ── Imports after mocks ───────────────────────────────────────────────────────
import { statsService } from '@/services/stats_service'
import { achievementService } from '@/services/achievement_service'
import { questService } from '@/services/quest_service'

// ── Helpers ───────────────────────────────────────────────────────────────────
function renderTracker(
  gameState = createTestGameState(),
  outcome: 'player1_wins' | 'player2_wins' | 'ongoing' = 'ongoing',
  difficulty = 'normal',
  deckName = 'Test Deck',
) {
  return renderHook(
    ({ gs, out, diff, deck }) => useGameTracker(gs, out, diff, deck),
    {
      initialProps: {
        gs: gameState,
        out: outcome,
        diff: difficulty,
        deck: deckName,
      },
    },
  )
}

describe('useGameTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  describe('game record on outcome change', () => {
    it('does not record while game is ongoing', () => {
      renderTracker(createTestGameState(), 'ongoing')

      expect(statsService.recordGame).not.toHaveBeenCalled()
    })

    it('records a win when outcome changes to player1_wins', () => {
      const { rerender } = renderTracker(createTestGameState(), 'ongoing')

      act(() => {
        rerender({
          gs: createTestGameState(),
          out: 'player1_wins',
          diff: 'normal',
          deck: 'Test Deck',
        })
      })

      expect(statsService.recordGame).toHaveBeenCalledTimes(1)
      expect(statsService.recordGame).toHaveBeenCalledWith(
        expect.objectContaining({ result: 'win' }),
      )
    })

    it('records a loss when outcome changes to player2_wins', () => {
      const { rerender } = renderTracker(createTestGameState(), 'ongoing')

      act(() => {
        rerender({
          gs: createTestGameState(),
          out: 'player2_wins',
          diff: 'normal',
          deck: 'Test Deck',
        })
      })

      expect(statsService.recordGame).toHaveBeenCalledWith(
        expect.objectContaining({ result: 'loss' }),
      )
    })

    it('only records the game once even when rerendered multiple times', () => {
      const { rerender } = renderTracker(createTestGameState(), 'ongoing')

      act(() => {
        rerender({ gs: createTestGameState(), out: 'player1_wins', diff: 'normal', deck: 'Deck' })
      })
      act(() => {
        rerender({ gs: createTestGameState(), out: 'player1_wins', diff: 'normal', deck: 'Deck' })
      })

      expect(statsService.recordGame).toHaveBeenCalledTimes(1)
    })

    it('includes difficulty and deckName in the game record', () => {
      const { rerender } = renderTracker(createTestGameState(), 'ongoing', 'hard', 'My Deck')

      act(() => {
        rerender({ gs: createTestGameState(), out: 'player1_wins', diff: 'hard', deck: 'My Deck' })
      })

      expect(statsService.recordGame).toHaveBeenCalledWith(
        expect.objectContaining({ difficulty: 'hard', deckName: 'My Deck' }),
      )
    })
  })

  describe('achievement checking', () => {
    it('checks achievements after recording a game', () => {
      const { rerender } = renderTracker(createTestGameState(), 'ongoing')

      act(() => {
        rerender({ gs: createTestGameState(), out: 'player1_wins', diff: 'normal', deck: 'Deck' })
      })

      expect(achievementService.checkAchievements).toHaveBeenCalledTimes(1)
    })

    it('calls checkAchievements with updated stats after a win', () => {
      const mockStats = { totalGames: 1, wins: 1 }
      vi.mocked(statsService.recordGame).mockReturnValueOnce(mockStats as any)

      const { rerender } = renderTracker(createTestGameState(), 'ongoing')

      act(() => {
        rerender({ gs: createTestGameState(), out: 'player1_wins', diff: 'normal', deck: 'Deck' })
      })

      expect(achievementService.checkAchievements).toHaveBeenCalledWith(
        mockStats,
        expect.objectContaining({ result: 'win' }),
      )
    })

    it('clearAchievements marks them as notified and empties the list', () => {
      const newAchievement = { id: 'first_win', name: 'First Win', notified: false }
      vi.mocked(achievementService.checkAchievements).mockReturnValueOnce([newAchievement] as any)

      const { result, rerender } = renderTracker(createTestGameState(), 'ongoing')

      act(() => {
        rerender({ gs: createTestGameState(), out: 'player1_wins', diff: 'normal', deck: 'Deck' })
      })

      act(() => {
        result.current.clearAchievements()
      })

      expect(achievementService.markNotified).toHaveBeenCalledWith('first_win')
    })
  })

  describe('quest progress updates on win', () => {
    it('updates win quest progress when player wins', () => {
      const { rerender } = renderTracker(createTestGameState(), 'ongoing')

      act(() => {
        rerender({ gs: createTestGameState(), out: 'player1_wins', diff: 'normal', deck: 'Deck' })
      })

      expect(questService.updateProgress).toHaveBeenCalledWith('win', 1)
    })

    it('updates difficulty quest for hard wins', () => {
      const { rerender } = renderTracker(createTestGameState(), 'ongoing', 'hard')

      act(() => {
        rerender({ gs: createTestGameState(), out: 'player1_wins', diff: 'hard', deck: 'Deck' })
      })

      expect(questService.updateProgress).toHaveBeenCalledWith('difficulty', 1)
    })

    it('does not update win quest on a loss', () => {
      const { rerender } = renderTracker(createTestGameState(), 'ongoing')

      act(() => {
        rerender({ gs: createTestGameState(), out: 'player2_wins', diff: 'normal', deck: 'Deck' })
      })

      expect(questService.updateProgress).not.toHaveBeenCalledWith('win', 1)
    })

    it('refreshes quests after recording', () => {
      const { rerender } = renderTracker(createTestGameState(), 'ongoing')

      act(() => {
        rerender({ gs: createTestGameState(), out: 'player1_wins', diff: 'normal', deck: 'Deck' })
      })

      expect(questService.refreshQuests).toHaveBeenCalled()
    })
  })

  describe('game state diffing (counters)', () => {
    it('counts damage dealt when enemy health decreases', () => {
      const initialState = createTestGameState()
      initialState.player2.health = 20

      const { rerender } = renderTracker(initialState, 'ongoing')

      const nextState = createTestGameState()
      nextState.player2.health = 15 // 5 damage dealt

      act(() => {
        rerender({ gs: nextState, out: 'ongoing', diff: 'normal', deck: 'Deck' })
      })

      // Now record the game to see the counter
      act(() => {
        rerender({ gs: nextState, out: 'player1_wins', diff: 'normal', deck: 'Deck' })
      })

      expect(statsService.recordGame).toHaveBeenCalledWith(
        expect.objectContaining({ damageDealt: 5 }),
      )
    })

    it('counts cards played when hand shrinks', () => {
      const card = createTestCard({ id: 'play-me', zodiacClass: 'aries', type: 'unit' })
      const initialState = createTestGameState()
      initialState.player1.hand = [card]
      initialState.activePlayer = 'player1'

      const { rerender } = renderTracker(initialState, 'ongoing')

      const nextState = createTestGameState()
      nextState.player1.hand = [] // card played

      act(() => {
        rerender({ gs: nextState, out: 'ongoing', diff: 'normal', deck: 'Deck' })
      })
      act(() => {
        rerender({ gs: nextState, out: 'player1_wins', diff: 'normal', deck: 'Deck' })
      })

      expect(statsService.recordGame).toHaveBeenCalledWith(
        expect.objectContaining({ cardsPlayed: 1 }),
      )
    })

    it('counts units destroyed when enemy battlefield shrinks', () => {
      const unit = createTestCard({ id: 'enemy-unit', type: 'unit' })
      const initialState = createTestGameState()
      initialState.battlefield.enemyUnits = [unit, null, null, null, null, null, null]

      const { rerender } = renderTracker(initialState, 'ongoing')

      const nextState = createTestGameState()
      nextState.battlefield.enemyUnits = [null, null, null, null, null, null, null]

      act(() => {
        rerender({ gs: nextState, out: 'ongoing', diff: 'normal', deck: 'Deck' })
      })
      act(() => {
        rerender({ gs: nextState, out: 'player1_wins', diff: 'normal', deck: 'Deck' })
      })

      expect(statsService.recordGame).toHaveBeenCalledWith(
        expect.objectContaining({ unitsDestroyed: 1 }),
      )
    })
  })
})
