"use client"

import React from 'react'
import { Button } from '@/components/ui/button'
import { Heart, Zap, Sword, Shield, Moon, Sun } from 'lucide-react'
import { useGameStore } from '@/store/gameStore'
import type { Player } from '@/types/game'

interface PlayerInfoPanelProps {
    player: Player
    isCurrentPlayer?: boolean
    position: 'top-left' | 'bottom-right'
    onAttack?: () => void
    onDefend?: () => void
    onEndTurn?: () => void
    className?: string
}

export default function PlayerInfoPanel({
    player,
    isCurrentPlayer = false,
    position,
    onAttack,
    onDefend,
    onEndTurn,
    className = ''
}: PlayerInfoPanelProps) {
    const { gameState, interaction } = useGameStore()

    const isActive = gameState.activePlayer === player.id
    const selectedAttackersCount = interaction.selectedAttackers.size
    const defenderAssignmentsCount = interaction.defenderAssignments.size

    // Position-specific styles
    const positionStyles = {
        'top-left': 'absolute top-4 left-4',
        'bottom-right': 'absolute bottom-4 right-4'
    }

    // Player-specific styling
    const getPlayerStyles = () => {
        if (isCurrentPlayer) {
            return {
                avatar: 'bg-amber-800',
                avatarIcon: 'text-amber-200',
                health: 'text-amber-300',
                healthIcon: 'text-amber-400'
            }
        } else {
            return {
                avatar: 'bg-red-900',
                avatarIcon: 'text-red-200',
                health: 'text-red-300',
                healthIcon: 'text-red-400'
            }
        }
    }

    const playerStyles = getPlayerStyles()

    // Check if can attack
    const canAttack = isCurrentPlayer &&
        player.hasAttackToken &&
        gameState.phase === 'action' &&
        selectedAttackersCount > 0

    // Check if must defend (simplified - combat phase)
    const mustDefend = gameState.phase === 'combat' &&
        gameState.activePlayer === player.id

    // Render mana crystals for current player
    const renderManaDisplay = () => {
        if (!isCurrentPlayer) {
            return (
                <div className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-blue-400" />
                    <span className="text-blue-300 font-semibold">
                        {player.mana}/{player.maxMana}
                    </span>
                    {player.spellMana > 0 && (
                        <span className="text-purple-400">+{player.spellMana}</span>
                    )}
                </div>
            )
        }

        // Visual mana crystals for current player
        return (
            <div className="flex items-center gap-1">
                <div className="flex">
                    {Array.from({ length: player.maxMana }, (_, i) => (
                        <Zap
                            key={i}
                            className={`w-3 h-3 ${i < player.mana ? 'text-blue-400' : 'text-slate-600'
                                }`}
                        />
                    ))}
                </div>
                {player.spellMana > 0 && (
                    <span className="text-purple-400">+{player.spellMana}</span>
                )}
            </div>
        )
    }

    return (
        <div className={`${positionStyles[position]} z-20 w-64 ${className}`}>
            <div className="space-y-3 p-3 bg-slate-800/80 rounded-lg border border-slate-600 backdrop-blur-sm">
                {/* Player Header */}
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className={`w-10 h-10 rounded-full ${playerStyles.avatar} flex items-center justify-center`}>
                            {isCurrentPlayer ? (
                                <Sun className={`w-5 h-5 ${playerStyles.avatarIcon}`} />
                            ) : (
                                <Moon className={`w-5 h-5 ${playerStyles.avatarIcon}`} />
                            )}
                        </div>

                        {/* Attack Token Indicator */}
                        {player.hasAttackToken && (
                            <div className="absolute -top-1 -right-1 bg-orange-500 rounded-full p-1 animate-pulse">
                                <Sword className="w-2 h-2 text-white" />
                            </div>
                        )}
                    </div>

                    <div className="flex-1">
                        <h3 className="font-bold text-sm text-slate-100">
                            {player.name}
                        </h3>
                        {player.hasAttackToken && (
                            <span className="text-xs bg-orange-500/20 text-orange-300 px-2 py-1 rounded">
                                ⚔️ Attack Token
                            </span>
                        )}
                    </div>
                </div>

                {/* Player Stats */}
                <div className="space-y-2 text-xs">
                    {/* Health */}
                    <div className="flex justify-between">
                        <span className="text-slate-400">Health:</span>
                        <div className="flex items-center gap-1">
                            <Heart className={`w-3 h-3 ${playerStyles.healthIcon}`} />
                            <span className={`${playerStyles.health} font-semibold`}>
                                {player.health}
                            </span>
                        </div>
                    </div>

                    {/* Mana */}
                    <div className="flex justify-between">
                        <span className="text-slate-400">Mana:</span>
                        {renderManaDisplay()}
                    </div>

                    {/* Hand Size */}
                    <div className="flex justify-between">
                        <span className="text-slate-400">Hand:</span>
                        <span className="text-slate-300 font-semibold">
                            {player.hand.length} cards
                        </span>
                    </div>

                    {/* Bench Size */}
                    <div className="flex justify-between">
                        <span className="text-slate-400">Bench:</span>
                        <span className="text-slate-300 font-semibold">
                            {player.bench.length}/6 units
                        </span>
                    </div>
                </div>

                {/* Game Controls for Current Player */}
                {isCurrentPlayer && (
                    <div className="mt-3 space-y-2">
                        {/* Attack Button */}
                        {canAttack && (
                            <Button
                                onClick={onAttack}
                                className="w-full bg-orange-600 hover:bg-orange-700 text-xs py-2"
                            >
                                <Sword className="w-3 h-3 mr-2" />
                                Attack ({selectedAttackersCount})
                            </Button>
                        )}

                        {/* Defend Button */}
                        {mustDefend && defenderAssignmentsCount > 0 && (
                            <Button
                                onClick={onDefend}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-xs py-2"
                            >
                                <Shield className="w-3 h-3 mr-2" />
                                Defend ({defenderAssignmentsCount})
                            </Button>
                        )}

                        {/* End Turn Button */}
                        {isActive && gameState.phase === 'action' && !canAttack && (
                            <Button
                                onClick={onEndTurn}
                                className="w-full bg-purple-600 hover:bg-purple-700 text-xs py-2"
                            >
                                End Turn
                            </Button>
                        )}
                    </div>
                )}

                {/* Status Indicators */}
                <div className="text-xs text-slate-400">
                    {isActive && (
                        <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                            <span>Active Turn</span>
                        </div>
                    )}

                    {!isActive && gameState.phase === 'action' && (
                        <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-slate-400 rounded-full" />
                            <span>Waiting</span>
                        </div>
                    )}

                    {gameState.phase === 'combat' && (
                        <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
                            <span>Combat</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
