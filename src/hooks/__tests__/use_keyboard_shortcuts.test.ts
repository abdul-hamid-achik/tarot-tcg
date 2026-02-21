import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useKeyboardShortcuts } from '@/hooks/use_keyboard_shortcuts'
import { createTestCard, createTestGameState, createMockGameStore } from '@/test_utils'

// ── Mock the game store ───────────────────────────────────────────────────────
const mockStore = createMockGameStore()

vi.mock('@/store/game_store', () => ({
  useGameStore: vi.fn((selector?: (s: typeof mockStore) => unknown) => {
    if (typeof selector === 'function') return selector(mockStore)
    return mockStore
  }),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────
function pressKey(key: string, target?: HTMLElement) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true })
  if (target) {
    target.dispatchEvent(event)
  } else {
    window.dispatchEvent(event)
  }
}

function renderShortcuts(
  overrides: Partial<Parameters<typeof useKeyboardShortcuts>[0]> = {},
) {
  const gameState = createTestGameState({
    activePlayer: 'player1',
    phase: 'action',
    player1: {
      ...createTestGameState().player1,
      hand: [
        createTestCard({ id: 'c1', name: 'Card 1' }),
        createTestCard({ id: 'c2', name: 'Card 2' }),
        createTestCard({ id: 'c3', name: 'Card 3' }),
      ],
    },
  })

  const defaults = {
    gameState,
    onEndTurn: vi.fn(),
    onCardPlay: vi.fn(),
    onShowHelp: vi.fn(),
    enabled: true,
  }

  return renderHook(() => useKeyboardShortcuts({ ...defaults, ...overrides }))
}

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset interaction state for each test
    mockStore.interaction.targetingMode = 'none'
    mockStore.interaction.selectedCard = null
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('enabled guard', () => {
    it('does not react to keys when disabled', () => {
      const onEndTurn = vi.fn()
      renderShortcuts({ enabled: false, onEndTurn })

      pressKey('E')

      expect(onEndTurn).not.toHaveBeenCalled()
    })

    it('does not capture keys when focused on an input', () => {
      const onEndTurn = vi.fn()
      renderShortcuts({ onEndTurn })

      const input = document.createElement('input')
      document.body.appendChild(input)
      input.focus()
      pressKey('E', input)
      document.body.removeChild(input)

      expect(onEndTurn).not.toHaveBeenCalled()
    })
  })

  describe('number keys 1-7 (select card)', () => {
    it('calls onCardPlay with the correct hand card for key "1"', () => {
      const onCardPlay = vi.fn()
      renderShortcuts({ onCardPlay })

      pressKey('1')

      expect(onCardPlay).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'c1' }),
      )
    })

    it('calls onCardPlay with card at index 2 for key "3"', () => {
      const onCardPlay = vi.fn()
      renderShortcuts({ onCardPlay })

      pressKey('3')

      expect(onCardPlay).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'c3' }),
      )
    })

    it('does nothing when key index exceeds hand size', () => {
      const onCardPlay = vi.fn()
      renderShortcuts({ onCardPlay })

      pressKey('7') // only 3 cards in hand

      expect(onCardPlay).not.toHaveBeenCalled()
    })

    it('shows card detail when onCardPlay is not provided', () => {
      renderShortcuts({ onCardPlay: undefined })

      pressKey('1')

      expect(mockStore.showCardDetail).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'c1' }),
      )
    })
  })

  describe('E key (end turn)', () => {
    it('calls onEndTurn when pressing E', () => {
      const onEndTurn = vi.fn()
      renderShortcuts({ onEndTurn })

      pressKey('E')

      expect(onEndTurn).toHaveBeenCalledTimes(1)
    })

    it('calls onEndTurn for lowercase e as well', () => {
      const onEndTurn = vi.fn()
      renderShortcuts({ onEndTurn })

      pressKey('e')

      expect(onEndTurn).toHaveBeenCalledTimes(1)
    })

    it('does not end turn when it is not the player\'s turn', () => {
      const onEndTurn = vi.fn()
      const gameState = createTestGameState({ activePlayer: 'player2' })
      renderShortcuts({ onEndTurn, gameState })

      pressKey('E')

      expect(onEndTurn).not.toHaveBeenCalled()
    })
  })

  describe('Escape key (cancel)', () => {
    it('calls cancelAttack when in attack targeting mode', () => {
      mockStore.interaction.targetingMode = 'attack'
      renderShortcuts({})

      pressKey('Escape')

      expect(mockStore.cancelAttack).toHaveBeenCalledTimes(1)
    })

    it('calls clearSelection when a card is selected (not attacking)', () => {
      mockStore.interaction.targetingMode = 'none'
      mockStore.interaction.selectedCard = createTestCard()
      renderShortcuts({})

      pressKey('Escape')

      expect(mockStore.clearSelection).toHaveBeenCalledTimes(1)
    })
  })

  describe('Space key (show detail)', () => {
    it('shows card detail for the selected card', () => {
      const selectedCard = createTestCard({ id: 'selected-1' })
      mockStore.interaction.selectedCard = selectedCard
      renderShortcuts({})

      pressKey(' ')

      expect(mockStore.showCardDetail).toHaveBeenCalledWith(selectedCard)
    })

    it('does nothing when no card is selected', () => {
      mockStore.interaction.selectedCard = null
      renderShortcuts({})

      pressKey(' ')

      expect(mockStore.showCardDetail).not.toHaveBeenCalled()
    })
  })

  describe('? key (show help)', () => {
    it('calls onShowHelp', () => {
      const onShowHelp = vi.fn()
      renderShortcuts({ onShowHelp })

      pressKey('?')

      expect(onShowHelp).toHaveBeenCalledTimes(1)
    })

    it('does not throw when onShowHelp is not provided', () => {
      renderShortcuts({ onShowHelp: undefined })

      expect(() => pressKey('?')).not.toThrow()
    })
  })

  describe('cleanup', () => {
    it('removes event listener on unmount', () => {
      const addSpy = vi.spyOn(window, 'addEventListener')
      const removeSpy = vi.spyOn(window, 'removeEventListener')

      const { unmount } = renderShortcuts({})

      expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
      unmount()
      expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
    })
  })
})
