import { useCallback, useEffect } from 'react'
import type { Card, GameState } from '@/schemas/schema'
import { useGameStore } from '@/store/game_store'

interface KeyboardShortcutOptions {
  gameState: GameState
  onEndTurn?: () => void
  onCardPlay?: (card: Card) => void
  onShowHelp?: () => void
  enabled: boolean
}

/**
 * Keyboard shortcuts for the game board:
 * - 1-7: Select card from hand (by position)
 * - Escape: Cancel current selection/attack
 * - E: End turn
 * - Space: Show detail of selected card
 * - ?: Show help overlay (future)
 */
export function useKeyboardShortcuts({
  gameState,
  onEndTurn,
  onCardPlay,
  onShowHelp,
  enabled,
}: KeyboardShortcutOptions) {
  const { interaction, showCardDetail, clearSelection, cancelAttack } = useGameStore()

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return

      // Don't capture when typing in inputs
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      const isPlayerTurn = gameState.activePlayer === 'player1'
      const isActionPhase = gameState.phase === 'action'
      const hand = gameState.player1.hand

      switch (e.key) {
        // Number keys 1-7: select card from hand
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7': {
          const index = Number.parseInt(e.key, 10) - 1
          if (index < hand.length && isPlayerTurn && isActionPhase) {
            const card = hand[index]
            if (onCardPlay) {
              onCardPlay(card)
            } else {
              showCardDetail(card)
            }
          }
          e.preventDefault()
          break
        }

        // Escape: cancel selection or attack
        case 'Escape': {
          if (interaction.targetingMode === 'attack') {
            cancelAttack()
          } else if (interaction.selectedCard) {
            clearSelection()
          }
          e.preventDefault()
          break
        }

        // E: end turn
        case 'e':
        case 'E': {
          if (isPlayerTurn && isActionPhase && onEndTurn) {
            onEndTurn()
          }
          e.preventDefault()
          break
        }

        // Space: show detail of hovered/selected card
        case ' ': {
          if (interaction.selectedCard) {
            showCardDetail(interaction.selectedCard)
          }
          e.preventDefault()
          break
        }

        // ?: Show keyboard shortcuts help
        case '?': {
          onShowHelp?.()
          e.preventDefault()
          break
        }
      }
    },
    [
      enabled,
      gameState,
      interaction.targetingMode,
      interaction.selectedCard,
      onEndTurn,
      onCardPlay,
      onShowHelp,
      showCardDetail,
      clearSelection,
      cancelAttack,
    ],
  )

  useEffect(() => {
    if (!enabled) return
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, handleKeyDown])
}
