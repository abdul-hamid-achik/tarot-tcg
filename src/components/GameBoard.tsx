"use client"

import React, { useEffect } from 'react'
import { useGameStore } from '@/store/gameStore'
import { useGameActions } from '@/hooks/useGameActions'
import { gridManagerService } from '@/services/GridManagerService'
import { interactionService } from '@/services/InteractionService'

// Layout Components
import GameLayout from '@/components/layout/GameLayout'
import BackgroundEffects from '@/components/effects/BackgroundEffects'

// UI Components
import ActionBar from '@/components/ui/ActionBar'
import PlayerInfoPanel from '@/components/player/PlayerInfoPanel'

// Game Components  
import BattlefieldGrid from '@/components/battlefield/BattlefieldGrid'
import HandFan from '@/components/hand/HandFan'

// Overlays
import CardDetailOverlay from '@/components/CardDetailOverlay'
import MulliganOverlay from '@/components/MulliganOverlay'

// Types
import type { GameState, Card as GameCard } from '@/types/game'

interface GameBoardProps {
    gameState: GameState
    onCardPlay?: (card: GameCard) => void
    onAttack?: (attackerIds: string[]) => void
    onEndTurn?: () => void
    onMulligan?: (selectedCards: string[]) => void
}

export default function GameBoard({
    gameState,
    onCardPlay,
    onAttack,
    onEndTurn,
    onMulligan
}: GameBoardProps) {
    const {
        ui,
        interaction,
        hideCardDetail,
        setGameState,
        highlightCells,
        clearHighlights
    } = useGameStore()

    const {
        playCard,
        declareAttack,
        endTurn: handleEndTurn,
        resolveCombat,
        completeMulligan
    } = useGameActions()

    // Initialize game state and services
    useEffect(() => {
        if (gameState) {
            setGameState(gameState)
            gridManagerService.initializeFromGameState(gameState)
        }
    }, [gameState, setGameState])

    // Setup interaction service callbacks
    useEffect(() => {
        interactionService.setCallbacks({
            onCardSelect: (card, position) => {
                console.log('Card selected:', card.name, 'at', position)
            },

            onCardMove: async (card, from, to) => {
                console.log('Moving card:', card.name, 'from', from, 'to', to)

                // Handle different move types
                if (from === 'hand') {
                    await playCard(card, to)
                    onCardPlay?.(card)
                } else {
                    // Grid to grid movement
                    gridManagerService.executeMove({
                        card,
                        from,
                        to,
                        cost: 0
                    })
                }
            },

            onCardAttack: (card, from, to) => {
                console.log('Card attacking:', card.name, 'from', from, 'to', to)
            },

            onCellHighlight: (positions) => {
                highlightCells(positions)
            },

            onClearHighlights: () => {
                clearHighlights()
            },

            onShowTooltip: (message, position) => {
                // Could implement tooltip system here
                console.log('Tooltip:', message, 'at', position)
            },

            onHideTooltip: () => {
                // Hide tooltip
            }
        })
    }, [playCard, highlightCells, clearHighlights, onCardPlay])

    // Handle action bar events
    const handleAttack = async () => {
        const attackerIds = Array.from(interaction.selectedAttackers)
        await declareAttack(attackerIds)
        onAttack?.(attackerIds)
    }

    const handlePass = async () => {
        await handleEndTurn()
        onEndTurn?.()
    }

    const handleCardPlay = async (card: GameCard) => {
        await playCard(card)
        onCardPlay?.(card)
    }

    const handleCardDetail = () => {
        // Card detail is handled by the store
    }

    const handleMulligan = async (selectedCards: string[]) => {
        await completeMulligan(selectedCards)
        onMulligan?.(selectedCards)
    }

    // Auto-resolve combat when phase changes to combat
    useEffect(() => {
        if (gameState.phase === 'combat' && !gameState.combatResolved) {
            setTimeout(() => {
                resolveCombat()
            }, 1000) // Give time for combat animations
        }
    }, [gameState.phase, gameState.combatResolved, resolveCombat])

    // Calculate derived values
    const totalPlayerMana = gameState.player1.mana + gameState.player1.spellMana
    const isPlayerTurn = gameState.activePlayer === 'player1'

    return (
        <GameLayout>
            {/* Background Effects */}
            <BackgroundEffects />

            {/* Player Info Panels */}
            <PlayerInfoPanel
                player={gameState.player2}
                isCurrentPlayer={false}
                position="top-left"
            />

            <PlayerInfoPanel
                player={gameState.player1}
                isCurrentPlayer={true}
                position="bottom-right"
                onAttack={handleAttack}
                onEndTurn={handlePass}
            />

            {/* Main Game Area */}
            <div className="flex flex-col justify-between h-full pt-16 pb-16 px-80 relative">

                {/* Battlefield Grid */}
                <div className="flex-1 flex flex-col justify-center">
                    <BattlefieldGrid />
                </div>
            </div>
            
            {/* Action Bar - Fixed position in center of viewport */}
            <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
                <div className="pointer-events-auto">
                    <ActionBar
                        onAttack={handleAttack}
                        onPass={handlePass}
                        onEndTurn={handlePass}
                        className="bg-slate-900/95 backdrop-blur-sm border-2 border-slate-600 rounded-lg shadow-2xl p-4"
                    />
                </div>
            </div>

            {/* Hand Components */}
            <HandFan
                cards={gameState.player2.hand}
                position="top-right"
                isCurrentPlayer={false}
            />

            <HandFan
                cards={gameState.player1.hand}
                position="bottom-left"
                isCurrentPlayer={true}
                onCardPlay={handleCardPlay}
                onCardDetail={handleCardDetail}
            />

            {/* Overlays */}
            <MulliganOverlay
                hand={gameState.player1.hand}
                isOpen={gameState.phase === 'mulligan' && !gameState.player1.mulliganComplete}
                onClose={() => { }}
                onMulligan={handleMulligan}
            />

            <CardDetailOverlay
                card={ui.cardDetailOverlay!}
                isOpen={ui.activeOverlay === 'cardDetail' && ui.cardDetailOverlay !== null}
                onClose={hideCardDetail}
                onPlay={() => ui.cardDetailOverlay && handleCardPlay(ui.cardDetailOverlay)}
                canPlay={ui.cardDetailOverlay ? (totalPlayerMana >= ui.cardDetailOverlay.cost && isPlayerTurn) : false}
            />

            {/* Debug Info (Development Only) */}
            {process.env.NODE_ENV === 'development' && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-xs p-2 rounded">
                    <div>Phase: {gameState.phase}</div>
                    <div>Active: {gameState.activePlayer}</div>
                    <div>Round: {gameState.round}, Turn: {gameState.turn}</div>
                    <div>Selected Attackers: {interaction.selectedAttackers.size}</div>
                    <div>Animations: {ui.isAnimating ? 'Active' : 'Idle'}</div>
                </div>
            )}
        </GameLayout>
    )
}
