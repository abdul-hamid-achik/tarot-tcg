'use client'

import { Volume2, VolumeX } from 'lucide-react'
import React from 'react'
// Game Components
import { Battlefield } from '@/components/battlefield/battlefield'
// Overlays
import CardDetailOverlay from '@/components/card_detail_overlay'
import { AttackArrow } from '@/components/combat/attack_arrow'
import HandFan from '@/components/hand/hand_fan'
// Layout Components
import GameLayout from '@/components/layout/game_layout'
import MulliganOverlay from '@/components/mulligan_overlay'
import { useEmotes } from '@/components/multiplayer/emotes'
import PlayerInfoPanel from '@/components/player/player_info_panel'
// UI Components
import ActionBar from '@/components/ui/action_bar'
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
  onCardPlay,
  onAttack,
  onEndTurn,
  onMulligan,
}: GameBoardProps) {
  const {
    ui,
    interaction,
    hideCardDetail,
    showCardDetail,
    setGameState,
    highlightSlots,
    clearHighlights,
    setValidDropZones,
    clearValidDropZones,
  } = useGameStore()

  const { playCard, declareAttack, attackTarget, completeMulligan, reverseCard } = useGameActions()

  // Use centralized game effects
  const { gameState } = useGameEffects()

  // Use game clock for timing
  const { isTimerExpired } = useGameClock({
    turnTimeLimit: 90,
    warningTime: 15,
    autoEndTurn: true,
  })

  // Use emote system
  const { currentEmote, sendEmote, clearEmote } = useEmotes()

  // Initialize game state and sound system
  const initializedRef = React.useRef(false)
  React.useEffect(() => {
    if (initialGameState && !initializedRef.current) {
      setGameState(initialGameState)
      soundService.init()
      initializedRef.current = true
    }
  }, [initialGameState]) // setGameState is stable, don't include in deps

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
  }, [playCard, clearHighlights, clearValidDropZones, highlightSlots, setValidDropZones])

  // Handle action bar events (simplified for direct attack system)
  const handleAttack = async () => {
    // In direct attack system, attacks are initiated by clicking units
    // This method kept for compatibility but simplified
    GameLogger.debug('Attack mode - click units to attack')
    onAttack?.([])
  }

  const _handleDirectAttack = async (attackerId: string, target: 'nexus') => {
    await attackTarget(attackerId, target)
  }

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

  // Keyboard shortcuts
  useKeyboardShortcuts({
    gameState: gameState ?? initialGameState,
    onEndTurn: handleEndTurn,
    onCardPlay: handleCardPlay,
    enabled: !!gameState && gameState.phase === 'action' && gameState.activePlayer === 'player1',
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

  return (
    <GameLayout>
      {/* Attack Arrow for Direct Combat */}
      <AttackArrow />

      {/* Player Info Panels */}
      {(() => {
        const player2 = getPlayer(gameState, 'player2')
        return player2 ? (
          <PlayerInfoPanel player={player2} isCurrentPlayer={false} position="top-left" />
        ) : null
      })()}

      {(() => {
        const player1 = getPlayer(gameState, 'player1')
        return player1 ? (
          <PlayerInfoPanel
            player={player1}
            isCurrentPlayer={true}
            position="bottom-right"
            onAttack={handleAttack}
            onEndTurn={handlePass}
          />
        ) : null
      })()}

      {/* Action Bar - Positioned on the right side */}
      <ActionBar
        onAttack={handleAttack}
        onPass={handlePass}
        onEndTurn={handleEndTurn}
        className="fixed bottom-1/2 translate-y-1/2 right-1 md:right-4 z-40"
      />

      {/* Main Game Area */}
      <div className="h-full w-full flex items-center justify-center relative p-1 md:p-4">
        <div className="flex flex-col items-center justify-center w-full max-w-6xl">
          <Battlefield />
        </div>
      </div>

      {/* Hand Components */}
      <HandFan
        cards={getPlayerHand(gameState, 'player2')}
        position="top-right"
        isCurrentPlayer={false}
      />

      <HandFan
        cards={getPlayerHand(gameState, 'player1')}
        position="bottom-left"
        isCurrentPlayer={true}
        onCardPlay={handleCardPlay}
        onCardDetail={card => {
          // Show card detail overlay
          showCardDetail(card)
        }}
      />

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

      {/* Sound Toggle */}
      <button
        onClick={toggleSound}
        className="fixed top-2 right-14 md:top-4 md:right-16 z-50 w-8 h-8 md:w-10 md:h-10 rounded-full bg-card/90 border border-border shadow-md flex items-center justify-center hover:bg-card transition-colors"
        title={isMuted ? 'Unmute sounds' : 'Mute sounds'}
      >
        {isMuted ? (
          <VolumeX className="w-4 h-4 text-muted-foreground" />
        ) : (
          <Volume2 className="w-4 h-4 text-foreground" />
        )}
      </button>

      {/* Error Message Toast */}
      {ui.errorMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded-lg z-50 shadow-lg animate-in fade-in slide-in-from-bottom-4">
          {ui.errorMessage}
        </div>
      )}
    </GameLayout>
  )
}
