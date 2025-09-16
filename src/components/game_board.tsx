'use client'

import React from 'react'
// Game Components
import BattlefieldGrid from '@/components/battlefield/battlefield_grid'
// Overlays
import CardDetailOverlay from '@/components/card_detail_overlay'
import BackgroundEffects from '@/components/effects/background_effects'
import HandFan from '@/components/hand/hand_fan'

// Layout Components
import GameLayout from '@/components/layout/game_layout'
import MulliganOverlay from '@/components/mulligan_overlay'
import PlayerInfoPanel from '@/components/player/player_info_panel'
// UI Components
import ActionBar from '@/components/ui/action_bar'
import { useGameActions } from '@/hooks/use_game_actions'
import { endTurn as endTurnGameLogic } from '@/lib/game_logic'
import { useGameClock } from '@/hooks/use_game_clock'
import { useGameEffects } from '@/hooks/use_game_effects'
// Types
import type { Card as GameCard, GameState } from '@/schemas/schema'
import {
  getPlayer,
  getPlayerHand,
  isDefendersPhase,
  isMulliganComplete,
  isMulliganPhase,
} from '@/schemas/schema'
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
  const { ui, interaction, hideCardDetail, showCardDetail, setGameState } = useGameStore()

  const { playCard, declareAttack, declareDefenders, completeMulligan, reverseCard } =
    useGameActions()

  // Use centralized game effects
  const { gameState } = useGameEffects()

  // Use game clock for timing
  const { isTimerExpired } = useGameClock({
    turnTimeLimit: 90,
    warningTime: 15,
    autoEndTurn: true,
  })

  // Initialize game state
  React.useEffect(() => {
    if (initialGameState) {
      setGameState(initialGameState)
    }
  }, [initialGameState, setGameState])

  // Auto-end turn when timer expires
  React.useEffect(() => {
    if (isTimerExpired && gameState?.activePlayer === 'player1') {
      handleEndTurn()
    }
  }, [isTimerExpired, gameState?.activePlayer])

  // Handle action bar events
  const handleAttack = async () => {
    const attackerIds = Array.from(interaction.selectedAttackers)
    await declareAttack(attackerIds)
    onAttack?.(attackerIds)
  }

  const handleDefend = async () => {
    const defenderAssignments = Array.from(interaction.defenderAssignments.entries()).map(
      ([laneId, defenderId]) => ({ defenderId, laneId }),
    )
    await declareDefenders(defenderAssignments)
  }

  const handleEndTurn = async () => {
    if (!gameState) return

    try {
      const newState = await endTurnGameLogic(gameState)
      setGameState(newState)
      onEndTurn?.()
    } catch (error) {
      console.error('Error ending turn:', error)
    }
  }

  const handlePass = async () => {
    if (isDefendersPhase(gameState)) {
      await declareDefenders([])
    } else {
      await handleEndTurn()
    }
  }

  const handleCardPlay = async (card: GameCard) => {
    await playCard(card)
    onCardPlay?.(card)
  }

  const handleMulligan = async (selectedCards: string[]) => {
    await completeMulligan(selectedCards)
    onMulligan?.(selectedCards)
  }

  // Calculate derived values
  const totalPlayerMana = (gameState?.player1?.mana || 0) + (gameState?.player1?.spellMana || 0)
  const isPlayerTurn = gameState?.activePlayer === 'player1'

  return (
    <GameLayout>
      {/* Background Effects */}
      <BackgroundEffects />

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

      {/* Main Game Area */}
      <div className="flex flex-col justify-between h-full pt-16 pb-20 px-4 sm:px-12 md:px-24 lg:px-48 xl:px-64 2xl:px-80 relative">
        {/* Battlefield Grid */}
        <div className="flex-1 flex flex-col justify-center">
          <BattlefieldGrid />
        </div>
      </div>

      {/* Action Bar */}
      {gameState?.phase !== 'mulligan' && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 pointer-events-none z-[100]">
          <div className="pointer-events-auto">
            <ActionBar
              onAttack={handleAttack}
              onDefend={handleDefend}
              onPass={handlePass}
              onEndTurn={handlePass}
              className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl p-3 min-w-[280px]"
            />
          </div>
        </div>
      )}

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
        onCardDetail={(card) => {
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
    </GameLayout>
  )
}
