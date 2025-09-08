"use client"

import React from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sword, Shield, SkipForward, Clock } from 'lucide-react'
import { useGameStore } from '@/store/gameStore'

interface ActionBarProps {
    onAttack?: () => void
    onPass?: () => void
    onEndTurn?: () => void
    className?: string
}

export default function ActionBar({
    onAttack,
    onPass,
    onEndTurn,
    className = ''
}: ActionBarProps) {
    const { gameState, interaction } = useGameStore()

    // Game state helpers
    const isPlayerTurn = gameState.activePlayer === 'player1'
    const canPass = isPlayerTurn && gameState.phase === 'action'
    const isInCombat = gameState.phase === 'combat'
    const selectedAttackersCount = interaction.selectedAttackers.size

    // Phase display
    const getPhaseDisplay = () => {
        switch (gameState.phase) {
            case 'mulligan':
                return { text: 'Mulligan Phase', color: 'bg-amber-600/90' }
            case 'action':
                return { text: 'Action Phase', color: 'bg-blue-600/90' }
            case 'combat':
                return { text: 'Combat!', color: 'bg-red-600/90' }
            case 'end_round':
                return { text: 'Round Ending', color: 'bg-purple-600/90' }
            default:
                return { text: 'Unknown Phase', color: 'bg-slate-600/90' }
        }
    }

    const phaseInfo = getPhaseDisplay()

    // Get attack button state and tooltip
    const getAttackButtonState = () => {
        if (!isPlayerTurn) {
            return { enabled: false, tooltip: "Not your turn" }
        }
        if (!gameState.player1.hasAttackToken) {
            return { enabled: false, tooltip: "Need attack token" }
        }
        if (gameState.phase !== 'action') {
            return { enabled: false, tooltip: "Can only attack during action phase" }
        }
        if (gameState.player1.bench.length === 0) {
            return { enabled: false, tooltip: "No units to attack with" }
        }
        if (selectedAttackersCount === 0) {
            return { enabled: false, tooltip: "Select units to attack with" }
        }
        return { enabled: true, tooltip: `Attack with ${selectedAttackersCount} units` }
    }

    const attackState = getAttackButtonState()

    return (
        <div className={`flex items-center justify-center gap-4 ${className}`}>
            {/* Phase Indicator */}
            <Badge className={`${phaseInfo.color} px-3 py-1 text-white font-semibold`}>
                {phaseInfo.text}
            </Badge>

            {/* Action Buttons Container */}
            <div className="flex gap-2">
                {/* Attack Button */}
                {isPlayerTurn && gameState.phase === 'action' && (
                    <>
                        {gameState.player1.hasAttackToken && gameState.player1.bench.length > 0 && (
                            <Button
                                onClick={onAttack}
                                disabled={!attackState.enabled}
                                className={`
                  text-sm px-4 py-2 min-w-[100px] transition-all duration-200
                  ${attackState.enabled
                                        ? 'bg-red-600 hover:bg-red-700 shadow-lg hover:shadow-red-500/25'
                                        : 'bg-slate-600 cursor-not-allowed opacity-50'
                                    }
                `}
                                title={attackState.tooltip}
                            >
                                <Sword className="w-4 h-4 mr-2" />
                                Attack
                                {selectedAttackersCount > 0 && (
                                    <span className="ml-2 bg-red-800 px-2 py-0.5 rounded-full text-xs">
                                        {selectedAttackersCount}
                                    </span>
                                )}
                            </Button>
                        )}

                        {/* Pass Button */}
                        <Button
                            onClick={onPass}
                            disabled={!canPass}
                            className={`
                text-sm px-4 py-2 min-w-[80px] transition-all duration-200
                ${canPass
                                    ? 'bg-slate-600 hover:bg-slate-700 shadow-lg hover:shadow-slate-500/25'
                                    : 'bg-slate-700 cursor-not-allowed opacity-50'
                                }
              `}
                            title={canPass ? "End your turn" : "Cannot pass right now"}
                        >
                            <SkipForward className="w-4 h-4 mr-2" />
                            Pass
                        </Button>
                    </>
                )}

                {/* Combat Phase - No actions, just status */}
                {isInCombat && (
                    <div className="flex items-center gap-2 text-white text-sm px-4 py-2 bg-red-700/80 rounded">
                        <Shield className="w-4 h-4 animate-spin" />
                        <span>Combat Resolving...</span>
                    </div>
                )}

                {/* Opponent Turn Indicator */}
                {!isPlayerTurn && gameState.phase === 'action' && (
                    <div className="flex items-center gap-2 text-slate-300 text-sm px-4 py-2 bg-slate-700/80 rounded">
                        <Clock className="w-4 h-4 animate-pulse" />
                        <span>Opponent&apos;s Turn</span>
                    </div>
                )}

                {/* End Round Button (when phase is end_round) */}
                {gameState.phase === 'end_round' && isPlayerTurn && (
                    <Button
                        onClick={onEndTurn}
                        className="text-sm px-4 py-2 bg-purple-600 hover:bg-purple-700 shadow-lg hover:shadow-purple-500/25"
                    >
                        Continue
                    </Button>
                )}
            </div>

            {/* Turn/Round Info */}
            <div className="text-xs text-slate-400 px-2">
                <div>Round {gameState.round}</div>
                <div>Turn {gameState.turn}</div>
            </div>

            {/* Attack Token Indicator */}
            <div className="flex items-center gap-2 text-xs">
                <div className="text-slate-400">Attack Token:</div>
                <div className={`px-2 py-1 rounded font-semibold ${gameState.player1.hasAttackToken
                        ? 'bg-orange-500/20 text-orange-300'
                        : 'bg-slate-600/20 text-slate-400'
                    }`}>
                    {gameState.player1.hasAttackToken ? '⚔️ You' : '🛡️ Opponent'}
                </div>
            </div>
        </div>
    )
}
