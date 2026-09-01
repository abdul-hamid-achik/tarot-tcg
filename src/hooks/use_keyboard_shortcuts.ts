import { useCallback, useEffect } from 'react'
import type { GameState } from '@/schemas/schema'
import { useGameStore } from '@/store/game_store'

interface KeyboardShortcutOptions {
  gameState: GameState
  onEndTurn?: () => void
  onShowHelp?: () => void
  helpOpen?: boolean
  onCloseHelp?: () => void
  enabled: boolean
}

/**
 * Keyboard shortcuts for the game board:
 * - 1-7: Select card from hand (same as click — then click a slot to play)
 * - Escape: Close help, cancel attack, or clear selection
 * - E: End turn
 * - Space: Show detail of selected card
 * - ?: Toggle keyboard shortcuts help
 */
export function useKeyboardShortcuts({
  gameState,
  onEndTurn,
  onShowHelp,
  helpOpen = false,
  onCloseHelp,
  enabled,
}: KeyboardShortcutOptions) {
  const {
    interaction,
    ui,
    showCardDetail,
    hideCardDetail,
    clearSelection,
    cancelAttack,
    selectCard,
    clearError,
    clearReading,
  } = useGameStore()

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return

      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      if (helpOpen) {
        if (e.key === 'Escape' || e.key === '?') {
          onCloseHelp?.()
          e.preventDefault()
        }
        return
      }

      const isPlayerTurn = gameState.activePlayer === 'player1'
      const isActionPhase = gameState.phase === 'action'
      const hand = gameState.player1.hand
      const totalMana = gameState.player1.mana + gameState.player1.spellMana

      switch (e.key) {
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7': {
          const index = Number.parseInt(e.key, 10) - 1
          const card = hand[index]
          if (!card || !isPlayerTurn || !isActionPhase) {
            e.preventDefault()
            break
          }

          const isSelected = interaction.selectedCard?.id === card.id
          if (isSelected) {
            clearSelection()
          } else if (card.cost <= totalMana) {
            selectCard(card)
          } else {
            showCardDetail(card)
          }
          e.preventDefault()
          break
        }

        case 'Escape': {
          if (ui.activeOverlay === 'cardDetail') {
            hideCardDetail()
          } else if (interaction.targetingMode === 'attack') {
            cancelAttack()
          } else if (
            interaction.reading.futureId ||
            interaction.reading.presentId ||
            interaction.reading.pastId
          ) {
            clearReading()
          } else if (interaction.selectedCard) {
            clearSelection()
          }
          if (ui.errorMessage) {
            clearError()
          }
          e.preventDefault()
          break
        }

        case 'e':
        case 'E': {
          if (isPlayerTurn && isActionPhase && onEndTurn) {
            onEndTurn()
          }
          e.preventDefault()
          break
        }

        case ' ': {
          if (interaction.selectedCard) {
            showCardDetail(interaction.selectedCard)
          }
          e.preventDefault()
          break
        }

        case '?': {
          onShowHelp?.()
          e.preventDefault()
          break
        }
      }
    },
    [
      enabled,
      helpOpen,
      onCloseHelp,
      gameState,
      interaction.targetingMode,
      interaction.selectedCard,
      interaction.reading,
      ui.activeOverlay,
      ui.errorMessage,
      onEndTurn,
      onShowHelp,
      showCardDetail,
      hideCardDetail,
      clearSelection,
      cancelAttack,
      selectCard,
      clearError,
      clearReading,
    ],
  )

  useEffect(() => {
    if (!enabled) return
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, handleKeyDown])
}
