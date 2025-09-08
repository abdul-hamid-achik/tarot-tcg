"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sparkles, Zap, Shield, Sword, Heart, Star, Moon, Sun } from "lucide-react"
import { GameState, Card as GameCard } from '@/types/game'
import TarotCard from '@/components/TarotCard'
import CardDetailOverlay from '@/components/CardDetailOverlay'
import MulliganOverlay from '@/components/MulliganOverlay'

interface GameBoardProps {
  gameState: GameState
  onCardPlay?: (card: GameCard) => void
  onAttack?: (attackerIds: string[]) => void
  onDefend?: (assignments: { defenderId: string; laneId: number }[]) => void
  onRearrangeAttackers?: (arrangements: { attackerId: string; laneId: number }[]) => void
  onRearrangeDefenders?: (arrangements: { defenderId: string; laneId: number }[]) => void
  onCommitAttackers?: () => void
  onEndTurn?: () => void
  onMulligan?: (selectedCards: string[]) => void
}

export default function TarotGameBoard({
  gameState,
  onCardPlay,
  onAttack,
  onDefend,
  onRearrangeAttackers,
  onRearrangeDefenders,
  onCommitAttackers,
  onEndTurn,
  onMulligan
}: GameBoardProps) {
  const [selectedAttackers, setSelectedAttackers] = useState<string[]>([])
  const [defenderAssignments, setDefenderAssignments] = useState<{ defenderId: string; laneId: number }[]>([])
  const [cardDetailOverlay, setCardDetailOverlay] = useState<GameCard | null>(null)

  // Game state helpers
  const canAttack = gameState.activePlayer === 'player1' && gameState.player1.hasAttackToken && gameState.phase === 'action'
  const mustDefend = false // No longer using declare_defenders phase
  const isDeclaringAttackers = false // No longer using declare_attackers phase

  // Event handlers
  const handleBenchClick = (unit: GameCard) => {
    if (gameState.phase === 'action' && canAttack) {
      // Toggle attacker selection for lanes
      const existingIndex = selectedAttackers.findIndex((id: string) => id === unit.id)
      if (existingIndex !== -1) {
        setSelectedAttackers(prev => prev.filter((id: string) => id !== unit.id))
      } else if (selectedAttackers.length < 6) {
        setSelectedAttackers(prev => [...prev, unit.id])
      }
    }
  }

  const handleCommitAttack = () => {
    if (onAttack && selectedAttackers.length > 0) {
      onAttack(selectedAttackers)
      setSelectedAttackers([])
    }
  }

  const handleCommitDefense = () => {
    if (onDefend && defenderAssignments.length > 0) {
      onDefend(defenderAssignments)
      setDefenderAssignments([])
    }
  }

  const totalPlayerMana = gameState.player1.mana + gameState.player1.spellMana

  return (
    <div className="h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-2 overflow-hidden relative">
      {/* Celestial Background Pattern */}
      <div className="fixed inset-0 opacity-5 pointer-events-none">
        <div className="absolute top-10 left-10 animate-pulse">
          <Star className="w-6 h-6 text-purple-400" />
        </div>
        <div className="absolute top-32 right-20 animate-pulse delay-1000">
          <Moon className="w-8 h-8 text-indigo-400" />
        </div>
        <div className="absolute bottom-20 left-1/4 animate-pulse delay-500">
          <Sun className="w-7 h-7 text-amber-400" />
        </div>
        <div className="absolute top-1/2 right-10 animate-pulse delay-1500">
          <Sparkles className="w-5 h-5 text-violet-400" />
        </div>
      </div>

      {/* Player 2 (Opponent) Info - Top Left */}
      <div className="absolute top-4 left-4 z-20 w-64">
        <div className="space-y-3 p-3 bg-slate-800/80 rounded-lg border border-slate-600 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-red-900 flex items-center justify-center">
                <Moon className="w-5 h-5 text-red-200" />
              </div>
              {!gameState.player1.hasAttackToken && (
                <div className="absolute -top-1 -right-1 bg-orange-500 rounded-full p-1 animate-pulse">
                  <Sword className="w-2 h-2 text-white" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-sm text-slate-100">
                {gameState.player2.name}
              </h3>
              {!gameState.player1.hasAttackToken && (
                <span className="text-xs bg-orange-500/20 text-orange-300 px-2 py-1 rounded">
                  ⚔️ Attack Token
                </span>
              )}
            </div>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Health:</span>
              <div className="flex items-center gap-1">
                <Heart className="w-3 h-3 text-red-400" />
                <span className="text-red-300 font-semibold">{gameState.player2.health}</span>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Mana:</span>
              <div className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-blue-400" />
                <span className="text-blue-300 font-semibold">
                  {gameState.player2.mana}/{gameState.player2.maxMana}
                </span>
                {gameState.player2.spellMana > 0 && (
                  <span className="text-purple-400">+{gameState.player2.spellMana}</span>
                )}
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Hand:</span>
              <span className="text-slate-300 font-semibold">{gameState.player2.hand.length} cards</span>
            </div>
          </div>
        </div>
      </div>

      {/* Player 1 (You) Info - Bottom Right */}
      <div className="absolute bottom-4 right-4 z-20 w-64">
        <div className="space-y-3 p-3 bg-slate-800/80 rounded-lg border border-slate-600 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-amber-800 flex items-center justify-center">
                <Sun className="w-5 h-5 text-amber-200" />
              </div>
              {gameState.player1.hasAttackToken && (
                <div className="absolute -top-1 -right-1 bg-orange-500 rounded-full p-1 animate-pulse">
                  <Sword className="w-2 h-2 text-white" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-sm text-slate-100">
                {gameState.player1.name}
              </h3>
              {gameState.player1.hasAttackToken && (
                <span className="text-xs bg-orange-500/20 text-orange-300 px-2 py-1 rounded">
                  ⚔️ Attack Token
                </span>
              )}
            </div>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Health:</span>
              <div className="flex items-center gap-1">
                <Heart className="w-3 h-3 text-amber-400" />
                <span className="text-amber-300 font-semibold">{gameState.player1.health}</span>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Mana:</span>
              <div className="flex items-center gap-1">
                <div className="flex">
                  {Array.from({ length: gameState.player1.maxMana }, (_, i) => (
                    <Zap key={i} className={`w-3 h-3 ${i < gameState.player1.mana ? 'text-blue-400' : 'text-slate-600'
                      }`} />
                  ))}
                </div>
                {gameState.player1.spellMana > 0 && (
                  <span className="text-purple-400">+{gameState.player1.spellMana}</span>
                )}
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Hand:</span>
              <span className="text-slate-300 font-semibold">{gameState.player1.hand.length} cards</span>
            </div>
          </div>
        </div>

        {/* Game Controls - Now moved to center */}
        <div className="mt-3">
          <div className="text-xs text-center text-slate-400">
            Actions moved to battlefield center →
          </div>
        </div>
      </div>

      {/* Enemy Hand - Top Right in Fan Pattern */}
      <div className="absolute top-4 right-4 z-20">
        <div className="flex gap-1" style={{ transformOrigin: 'center top' }}>
          {gameState.player2.hand.map((_, index) => {
            const totalCards = gameState.player2.hand.length
            const angleStep = Math.min(10, 50 / Math.max(1, totalCards - 1)) // Max 10 degrees per card, spread over 50 degrees
            const angle = totalCards > 1 ? (index - (totalCards - 1) / 2) * angleStep : 0
            const translateY = Math.abs(angle) * 0.3 // Slight curve effect, less pronounced than player

            return (
              <div
                key={`enemy-hand-${index}`}
                className="flex-shrink-0 transition-all duration-200 origin-top"
                style={{
                  transform: `rotate(${angle}deg) translateY(${translateY}px)`,
                  zIndex: totalCards - index, // Reverse z-index for enemy (rightmost on top)
                  marginLeft: index > 0 ? '-8px' : '0' // Slight overlap
                }}
              >
                <div className="w-16 h-24 relative shadow-lg">
                  <img
                    src="/default/back/2x.png"
                    alt="Card Back"
                    className="w-full h-full object-cover rounded-lg border-2 border-slate-400"
                    style={{
                      boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Main Game Area - Centered */}
      <div className="flex flex-col justify-between h-full pt-16 pb-16 px-80">
        {/* Opponent Area */}
        <div className="space-y-2">
          {/* Opponent Bench */}
          <div className="flex gap-3 justify-center overflow-x-auto pb-2">
            {gameState.player2.bench.map((unit) => (
              <div key={unit.id} className="flex-shrink-0">
                <TarotCard
                  card={unit}
                  size="small"
                  isSelected={false}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Battlefield - 6x4 Grid */}
        <div className="flex-1 flex flex-col justify-center">
          <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-600">

            {/* Combat Phase Indicator & Actions */}
            <div className="flex items-center justify-center gap-4 mb-4">
              <Badge className="bg-orange-600/90 px-3 py-1">
                {gameState.phase === 'mulligan' && 'Mulligan Phase'}
                {gameState.phase === 'action' && 'Action Phase'}
                {gameState.phase === 'combat' && 'Combat!'}
                {gameState.phase === 'end_round' && 'Round Ending'}
              </Badge>

              {/* LoR-style Action Buttons */}
              <div className="flex gap-2">
                {gameState.activePlayer === 'player1' && gameState.phase === 'action' && (
                  <>
                    {/* Attack Button - Only if has attack token and units on bench */}
                    {gameState.player1.hasAttackToken && gameState.player1.bench.length > 0 && (
                      <Button
                        onClick={handleCommitAttack}
                        className="bg-red-600 hover:bg-red-700 text-sm px-4 py-2"
                      >
                        <Sword className="w-4 h-4 mr-2" />
                        Attack
                      </Button>
                    )}

                    {/* Pass Button - Always available during action phase */}
                    <Button
                      onClick={onEndTurn}
                      className="bg-slate-600 hover:bg-slate-700 text-sm px-4 py-2"
                    >
                      Pass
                    </Button>
                  </>
                )}

                {/* Combat Phase - No actions, just shows status */}
                {gameState.phase === 'combat' && (
                  <div className="text-white text-sm px-4 py-2">
                    ⚔️ Combat Resolving...
                  </div>
                )}
              </div>
            </div>

            {/* 6x4 Grid Battlefield */}
            <div className="grid grid-cols-6 gap-2">
              {/* Enemy Bench Row */}
              {Array.from({ length: 6 }, (_, colIndex) => {
                const benchUnit = gameState.player2.bench[colIndex]
                return (
                  <div key={`enemy-bench-${colIndex}`} className="space-y-1">
                    <div className="h-20 border-2 border-dashed border-slate-500 rounded bg-slate-700/20 flex items-center justify-center text-xs">
                      {benchUnit ? (
                        <TarotCard
                          card={benchUnit}
                          size="small"
                          isSelected={false}
                        />
                      ) : (
                        <span className="text-slate-500 text-xs">Bench</span>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Enemy Combat Row */}
              {gameState.lanes.map((lane, index) => (
                <div key={`enemy-combat-${index}`} className="space-y-1">
                  <div className="h-20 border-2 border-dashed border-red-500/50 rounded bg-red-900/10 flex items-center justify-center text-xs">
                    {lane.defender ? (
                      <TarotCard
                        card={lane.defender}
                        size="small"
                        isSelected={false}
                      />
                    ) : (
                      <span className="text-slate-500 text-xs">Attack</span>
                    )}
                  </div>
                </div>
              ))}

              {/* Player Combat Row */}
              {gameState.lanes.map((lane, index) => (
                <div key={`player-combat-${index}`} className="space-y-1">
                  <div className="h-20 border-2 border-dashed border-blue-500/50 rounded bg-blue-900/10 flex items-center justify-center text-xs">
                    {lane.attacker ? (
                      <TarotCard
                        card={lane.attacker}
                        size="small"
                        isSelected={selectedAttackers.includes(lane.attacker.id)}
                      />
                    ) : (
                      <span className="text-slate-500 text-xs">Attack</span>
                    )}
                  </div>
                </div>
              ))}

              {/* Player Bench Row */}
              {Array.from({ length: 6 }, (_, colIndex) => {
                const benchUnit = gameState.player1.bench[colIndex]
                return (
                  <div key={`player-bench-${colIndex}`} className="h-20 border-2 border-dashed border-slate-500 rounded bg-slate-700/20 flex items-center justify-center text-xs">
                    {benchUnit ? (
                      <div
                        className="cursor-pointer"
                        onClick={() => handleBenchClick(benchUnit)}
                      >
                        <TarotCard
                          card={benchUnit}
                          size="small"
                          isSelected={selectedAttackers.includes(benchUnit.id)}
                        />
                      </div>
                    ) : (
                      <span className="text-slate-500 text-xs">Bench</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Player Area - Now just spacing */}
        <div className="space-y-2">
          {/* Bench is now integrated into battlefield grid above */}
        </div>
      </div>

      {/* Player Hand - Bottom Left in Fan Pattern */}
      <div className="absolute bottom-4 left-4 z-20">
        <div className="flex gap-1" style={{ transformOrigin: 'center bottom' }}>
          {gameState.player1.hand.map((card, index) => {
            const totalCards = gameState.player1.hand.length
            const angleStep = Math.min(12, 60 / Math.max(1, totalCards - 1)) // Max 12 degrees per card, spread over 60 degrees
            const angle = totalCards > 1 ? (index - (totalCards - 1) / 2) * angleStep : 0
            const translateY = Math.abs(angle) * 0.8 // More pronounced curve effect
            const isSelectedForMulligan = false

            return (
              <div
                key={card.id}
                className={`flex-shrink-0 cursor-pointer transition-all duration-300 origin-bottom ${isSelectedForMulligan ? 'ring-2 ring-red-400 ring-opacity-60' : ''
                  }`}
                style={{
                  transform: `rotate(${angle}deg) translateY(-${translateY}px)`,
                  zIndex: index,
                  marginLeft: index > 0 ? '-12px' : '0' // More overlap for tighter fan
                }}
                onClick={() => onCardPlay?.(card)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setCardDetailOverlay(card)
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = `rotate(0deg) translateY(-${translateY + 30}px) scale(1.15)`
                  e.currentTarget.style.zIndex = '100'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = `rotate(${angle}deg) translateY(-${translateY}px)`
                  e.currentTarget.style.zIndex = String(index)
                }}
              >
                <TarotCard
                  card={card}
                  size="small"
                  isSelected={isSelectedForMulligan}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* Mulligan Overlay */}
      <MulliganOverlay
        hand={gameState.player1.hand}
        isOpen={gameState.phase === 'mulligan' && !gameState.player1.mulliganComplete}
        onClose={() => { }}
        onMulligan={(selectedCards) => onMulligan?.(selectedCards)}
      />

      {/* Card Detail Overlay */}
      <CardDetailOverlay
        card={cardDetailOverlay!}
        isOpen={cardDetailOverlay !== null}
        onClose={() => setCardDetailOverlay(null)}
        onPlay={() => cardDetailOverlay && onCardPlay?.(cardDetailOverlay)}
        canPlay={cardDetailOverlay ? (totalPlayerMana >= cardDetailOverlay.cost && gameState.activePlayer === 'player1') : false}
      />
    </div>
  )
}