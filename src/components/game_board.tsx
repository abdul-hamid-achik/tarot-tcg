'use client'

import { Volume2, VolumeX } from 'lucide-react'
import React from 'react'
import { Battlefield } from '@/components/battlefield/battlefield'
import CardDetailOverlay from '@/components/card_detail_overlay'
import { AttackArrow } from '@/components/combat/attack_arrow'
import HandFan from '@/components/hand/hand_fan'
import GameLayout from '@/components/layout/game_layout'
import MulliganOverlay from '@/components/mulligan_overlay'
import { useEmotes } from '@/components/multiplayer/emotes'
import PlayerInfoPanel from '@/components/player/player_info_panel'
import { ReadingSpread } from '@/components/reading_spread'
import { useGameActions } from '@/hooks/use_game_actions'
import { useGameClock } from '@/hooks/use_game_clock'
import { useGameEffects } from '@/hooks/use_game_effects'
import { useKeyboardShortcuts } from '@/hooks/use_keyboard_shortcuts'
import { GameLogger } from '@/lib/game_logger'
import { endTurn as endTurnGameLogic } from '@/lib/game_logic'
// Types
import type { Card as GameCard, GameState } from '@/schemas/schema'
import { getPlayer, getPlayerHand, isMulliganComplete, isMulliganPhase } from '@/schemas/schema'
import type { BattlefieldPosition } from '@/services/battlefield_service'
import { interactionService } from '@/services/interaction_service'
import { soundService } from '@/services/sound_service'
import { useGameStore } from '@/store/game_store'

interface GameBoardProps {
  gameState: GameState
  onCardPlay?: (card: GameCard) => void
  onAttack?: (attackerIds: string[]) => void
  onEndTurn?: () => void
  onMulligan?: (selectedCards: string[]) => void
}

export default function GameBoard({
  gameState: initialGameState,
  onCardPlay: _onCardPlay,
  onAttack: _onAttack,
  onEndTurn,
  onMulligan,
}: GameBoardProps) {
  const ui = useGameStore(state => state.ui)
  const _interaction = useGameStore(state => state.interaction)
  const hideCardDetail = useGameStore(state => state.hideCardDetail)
  const showCardDetail = useGameStore(state => state.showCardDetail)
  const setGameState = useGameStore(state => state.setGameState)
  const highlightSlots = useGameStore(state => state.highlightSlots)
  const clearHighlights = useGameStore(state => state.clearHighlights)
  const setValidDropZones = useGameStore(state => state.setValidDropZones)
  const clearValidDropZones = useGameStore(state => state.clearValidDropZones)
  const startCardDrag = useGameStore(state => state.startCardDrag)
  const endCardDrag = useGameStore(state => state.endCardDrag)

  const { playCard, completeMulligan } = useGameActions()

  // Use centralized game effects
  const { gameState } = useGameEffects()

  // Use game clock for timing
  const { isTimerExpired } = useGameClock({
    turnTimeLimit: 90,
    warningTime: 15,
    autoEndTurn: true,
  })

  // Use emote system
  const _emotes = useEmotes()

  // Initialize game state and sound system
  const initializedRef = React.useRef(false)
  React.useEffect(() => {
    if (initialGameState && !initializedRef.current) {
      setGameState(initialGameState)
      soundService.init()
      initializedRef.current = true
    }
    return () => {
      soundService.destroy()
    }
  }, [initialGameState, setGameState])

  // Set up interaction service callbacks
  React.useEffect(() => {
    const callbacks = {
      canDragCard: (card: GameCard, from: BattlefieldPosition | 'hand'): boolean => {
        // Get fresh state to avoid stale closures
        const currentState = useGameStore.getState().gameState
        if (!currentState) return false
        if (currentState.activePlayer !== 'player1') return false
        if (currentState.phase !== 'action') return false

        if (from === 'hand') {
          const totalMana = currentState.player1.mana + currentState.player1.spellMana
          return card.cost <= totalMana
        }
        return true
      },
      getValidDropZones: (
        card: GameCard,
        from: BattlefieldPosition | 'hand',
      ): BattlefieldPosition[] => {
        // Get fresh state to avoid stale closures
        const battlefield = useGameStore.getState().gameState?.battlefield
        if (from === 'hand' && card.type === 'unit') {
          // Find all empty slots on player's battlefield
          const validSlots: BattlefieldPosition[] = []
          if (battlefield) {
            battlefield.playerUnits.forEach((unit, index) => {
              if (unit === null) {
                validSlots.push({ player: 'player1', slot: index })
              }
            })
          }
          return validSlots
        }
        return []
      },
      canDropOn: (
        position: BattlefieldPosition,
        _card: GameCard,
        from: BattlefieldPosition | 'hand',
      ): boolean => {
        // Get fresh state to avoid stale closures
        const battlefield = useGameStore.getState().gameState?.battlefield
        if (from === 'hand' && position.player === 'player1') {
          if (battlefield) {
            return battlefield.playerUnits[position.slot] === null
          }
        }
        return false
      },
      onCardMove: async (
        card: GameCard,
        from: BattlefieldPosition | 'hand',
        to: BattlefieldPosition,
      ) => {
        if (from === 'hand') {
          // Use the current playCard from hook - it already uses getState() internally
          await playCard(card, to)
        }
      },
      onSlotHighlight: (positions: BattlefieldPosition[], type: 'valid' | 'invalid' | 'hover') => {
        if (type === 'valid') {
          setValidDropZones(positions)
        } else if (type === 'hover') {
          highlightSlots(positions)
        }
      },
      onClearHighlights: () => {
        clearHighlights()
        clearValidDropZones()
      },
      onDragStart: (card: GameCard) => {
        startCardDrag(card, { x: 0, y: 0 })
      },
      onDragEnd: () => {
        endCardDrag()
      },
    }

    interactionService.setCallbacks(callbacks)

    // Set up global pointer event listeners for drag and drop
    const handlePointerMove = (event: PointerEvent) => {
      interactionService.handlePointerMove(event)
    }

    const handlePointerUp = (event: PointerEvent) => {
      interactionService.handlePointerUp(event)
    }

    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp)

    return () => {
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)
    }
    // Only stable store actions in deps - callbacks use getState() for fresh state
  }, [
    playCard,
    clearHighlights,
    clearValidDropZones,
    highlightSlots,
    setValidDropZones,
    startCardDrag,
    endCardDrag,
  ])

  const handleEndTurn = React.useCallback(async () => {
    if (!gameState) return

    try {
      soundService.play('turn_end')
      const newState = await endTurnGameLogic(gameState)
      setGameState(newState)
      onEndTurn?.()
    } catch (error) {
      GameLogger.error('Error ending turn:', error)
    }
  }, [gameState, setGameState, onEndTurn])

  const handlePass = async () => {
    await handleEndTurn()
  }

  // Auto-end turn when timer expires
  React.useEffect(() => {
    if (isTimerExpired && gameState?.activePlayer === 'player1') {
      handleEndTurn()
    }
  }, [isTimerExpired, gameState?.activePlayer, handleEndTurn])

  const handleCardPlay = async (card: GameCard) => {
    if (card.type === 'unit') {
      // Find first empty slot for unit cards
      const battlefield = gameState?.battlefield
      if (battlefield) {
        const playerUnits = battlefield.playerUnits
        const firstEmptySlot = playerUnits.indexOf(null)

        if (firstEmptySlot !== -1) {
          GameLogger.debug(`Playing card to slot: {player: "player1", slot: ${firstEmptySlot}}`)
          soundService.play('card_play')
          await playCard(card, { player: 'player1', slot: firstEmptySlot })
        } else {
          GameLogger.warn('No empty slots available on battlefield')
          return
        }
      }
    } else {
      // Spell cards don't need target position
      soundService.play('spell_cast')
      await playCard(card)
    }
    // Remove the onCardPlay callback to prevent double playing
    // onCardPlay?.(card)
  }

  const handleMulligan = async (selectedCards: string[]) => {
    soundService.play('mulligan')
    await completeMulligan(selectedCards)
    onMulligan?.(selectedCards)
  }

  const [showHelp, setShowHelp] = React.useState(false)

  useKeyboardShortcuts({
    gameState: gameState ?? initialGameState,
    onEndTurn: handleEndTurn,
    onShowHelp: () => setShowHelp(true),
    helpOpen: showHelp,
    onCloseHelp: () => setShowHelp(false),
    enabled:
      showHelp ||
      (!!gameState && gameState.phase === 'action' && gameState.activePlayer === 'player1'),
  })

  // Sound toggle
  const [isMuted, setIsMuted] = React.useState(() => soundService.isMuted())
  const toggleSound = React.useCallback(() => {
    const muted = soundService.toggleMute()
    setIsMuted(muted)
    if (!muted) soundService.play('button_click')
  }, [])

  // Calculate derived values
  const totalPlayerMana = (gameState?.player1?.mana || 0) + (gameState?.player1?.spellMana || 0)
  const isPlayerTurn = gameState?.activePlayer === 'player1'

  const player1 = getPlayer(gameState, 'player1')
  const player2 = getPlayer(gameState, 'player2')

  return (
    <GameLayout>
      <AttackArrow />

      <div className="relative flex min-h-0 flex-1 flex-col">
        <button
          type="button"
          onClick={toggleSound}
          className="absolute top-1 right-2 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card"
          aria-label={isMuted ? 'Unmute sounds' : 'Mute sounds'}
          title={isMuted ? 'Unmute sounds' : 'Mute sounds'}
        >
          {isMuted ? (
            <VolumeX className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          ) : (
            <Volume2 className="h-4 w-4 text-foreground" aria-hidden="true" />
          )}
        </button>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-end gap-1 overflow-hidden px-2 py-1">
          {player2 ? <PlayerInfoPanel player={player2} isCurrentPlayer={false} /> : null}

          <div className="flex w-full justify-center">
            <Battlefield />
          </div>

          {player1 ? (
            <PlayerInfoPanel player={player1} isCurrentPlayer onEndTurn={handlePass} />
          ) : null}

          <ReadingSpread />

          <div className="w-full max-w-3xl shrink-0 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
            <HandFan
              cards={getPlayerHand(gameState, 'player1')}
              position="bottom-left"
              isCurrentPlayer
              embedded
              onCardPlay={handleCardPlay}
              onCardDetail={card => {
                showCardDetail(card)
              }}
            />
          </div>
        </div>
      </div>

      {/* Overlays */}
      <MulliganOverlay
        hand={getPlayerHand(gameState, 'player1')}
        isOpen={isMulliganPhase(gameState) && !isMulliganComplete(gameState, 'player1')}
        onClose={() => {
          // Close mulligan overlay by keeping all cards (no changes)
          handleMulligan([])
        }}
        onMulligan={handleMulligan}
      />

      <CardDetailOverlay
        card={ui.cardDetailOverlay as GameCard}
        isOpen={ui.activeOverlay === 'cardDetail' && ui.cardDetailOverlay !== null}
        onClose={hideCardDetail}
        onPlay={() => ui.cardDetailOverlay && handleCardPlay(ui.cardDetailOverlay)}
        canPlay={
          ui.cardDetailOverlay
            ? totalPlayerMana >= ui.cardDetailOverlay.cost && isPlayerTurn
            : false
        }
      />

      {showHelp && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="shortcuts-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close keyboard shortcuts help"
            onClick={() => setShowHelp(false)}
          />
          <div className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-2xl">
            <h2 id="shortcuts-title" className="text-lg font-bold text-foreground mb-4">
              Keyboard Shortcuts
            </h2>
            <dl className="space-y-2 text-sm">
              {[
                { key: '1–7', desc: 'Select a card from hand, then click a slot' },
                { key: 'E', desc: 'End turn' },
                { key: 'Space', desc: 'Show selected card detail' },
                { key: 'Escape', desc: 'Cancel selection, attack, or this help' },
                { key: '?', desc: 'Toggle this help' },
              ].map(({ key, desc }) => (
                <div key={key} className="flex justify-between items-center gap-4">
                  <kbd className="px-2 py-0.5 bg-muted border border-border rounded text-xs font-mono">
                    {key}
                  </kbd>
                  <dd className="text-muted-foreground text-right flex-1">{desc}</dd>
                </div>
              ))}
            </dl>
            <button
              type="button"
              onClick={() => setShowHelp(false)}
              className="mt-5 w-full text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Press Escape or click outside to close
            </button>
          </div>
        </div>
      )}

      {/* Error Message Toast */}
      {ui.errorMessage && (
        <div
          role="alert"
          className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-red-700 px-4 py-2 text-white shadow-lg"
        >
          {ui.errorMessage}. Press Escape to cancel, or choose another action.
        </div>
      )}
    </GameLayout>
  )
}
