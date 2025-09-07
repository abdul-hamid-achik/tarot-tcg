"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Sparkles, Zap, Shield, Sword, Heart, Star, Moon, Sun } from "lucide-react"
import { GameState, Card as GameCard } from '@/types/game'
import TarotCard from '@/components/TarotCard'

interface GameBoardProps {
  gameState: GameState
  onCardPlay?: (card: GameCard) => void
  onAttack?: (attackerIds: string[]) => void
  onDefend?: (assignments: { defenderId: string; laneId: number }[]) => void
  onRearrangeAttackers?: (arrangements: { attackerId: string; laneId: number }[]) => void
  onRearrangeDefenders?: (arrangements: { defenderId: string; laneId: number }[]) => void
  onCommitAttackers?: () => void
  onCommitDefenders?: () => void
  onCommitToCombat?: () => void
  onEndTurn?: () => void
}

export default function TarotGameBoard({
  gameState,
  onCardPlay,
  onAttack,
  onDefend,
  onRearrangeAttackers,
  onRearrangeDefenders,
  onCommitAttackers,
  onCommitDefenders,
  onCommitToCombat,
  onEndTurn
}: GameBoardProps) {
  const [selectedCard, setSelectedCard] = useState<string | null>(null)
  const [selectedAttackers, setSelectedAttackers] = useState<string[]>([])
  const [defenderAssignments, setDefenderAssignments] = useState<{ defenderId: string; laneId: number }[]>([])
  const [selectedDefender, setSelectedDefender] = useState<GameCard | null>(null)
  const [draggedCard, setDraggedCard] = useState<string | null>(null)
  const [dragOverZone, setDragOverZone] = useState<string | null>(null)
  const [draggedFromLane, setDraggedFromLane] = useState<number | null>(null)
  const [dragOverLane, setDragOverLane] = useState<number | null>(null)

  const isPlayerTurn = gameState.activePlayer === 'player1'
  const canAttack = isPlayerTurn && gameState.player1.hasAttackToken && gameState.phase === 'main'
  const mustDefend = !isPlayerTurn && gameState.phase === 'declare_defenders'
  const isPositioningAttackers = gameState.phase === 'position_attackers' && gameState.attackingPlayer === 'player1'
  const isPositioningDefenders = gameState.phase === 'position_defenders' && gameState.attackingPlayer !== 'player1'
  const canCommitToCombat = gameState.phase === 'commit_combat' && isPlayerTurn

  // Event handlers
  const handleBenchClick = (unit: GameCard) => {
    if (gameState.phase === 'main' && canAttack) {
      // Toggle attacker selection
      if (selectedAttackers.includes(unit.id)) {
        setSelectedAttackers(prev => prev.filter(id => id !== unit.id))
      } else if (selectedAttackers.length < 6) {
        setSelectedAttackers(prev => [...prev, unit.id])
      }
    } else if (mustDefend) {
      setSelectedDefender(unit)
    }
  }

  const handleCommitAttack = () => {
    if (onAttack && selectedAttackers.length > 0) {
      onAttack(selectedAttackers)
      setSelectedAttackers([])
    }
  }

  const handleCommitDefense = () => {
    if (onDefend) {
      onDefend(defenderAssignments)
      setDefenderAssignments([])
    }
  }

  const handleDragStart = (e: React.DragEvent, cardId: string, source: "hand" | "field") => {
    setDraggedCard(cardId)
    e.dataTransfer.setData("cardId", cardId)
    e.dataTransfer.setData("source", source)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  const handleDragEnter = (e: React.DragEvent, zone: string) => {
    e.preventDefault()
    setDragOverZone(zone)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOverZone(null)
  }

  const handleDrop = (e: React.DragEvent, targetZone: "player-field" | "opponent-field") => {
    e.preventDefault()
    const cardId = e.dataTransfer.getData("cardId")
    const source = e.dataTransfer.getData("source")

    setDraggedCard(null)
    setDragOverZone(null)

    if (source === "hand" && targetZone === "player-field" && onCardPlay) {
      // Find the card in player's hand
      const cardToPlay = gameState.player1.hand.find((card) => card.id === cardId)
      if (cardToPlay) {
        onCardPlay(cardToPlay)
      }
    }
  }

  // New handlers for lane-based drag and drop
  const handleLaneDragStart = (e: React.DragEvent, cardId: string, fromLane: number, cardType: 'attacker' | 'defender') => {
    e.preventDefault()
    e.stopPropagation()
    setDraggedCard(cardId)
    setDraggedFromLane(fromLane)
    e.dataTransfer.setData("cardId", cardId)
    e.dataTransfer.setData("fromLane", fromLane.toString())
    e.dataTransfer.setData("cardType", cardType)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleLaneDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = "move"
  }

  const handleLaneDragEnter = (e: React.DragEvent, laneId: number) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverLane(laneId)
  }

  const handleLaneDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Only clear if we're actually leaving the lane area
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverLane(null)
    }
  }

  const handleLaneDrop = (e: React.DragEvent, toLaneId: number) => {
    e.preventDefault()
    e.stopPropagation()

    const cardId = e.dataTransfer.getData("cardId")
    const fromLane = parseInt(e.dataTransfer.getData("fromLane"))
    const cardType = e.dataTransfer.getData("cardType")

    setDraggedCard(null)
    setDraggedFromLane(null)
    setDragOverLane(null)

    // Handle rearranging attackers
    if (cardType === 'attacker' && isPositioningAttackers && onRearrangeAttackers && gameState.canRearrangeCards) {
      const currentArrangements: { attackerId: string; laneId: number }[] = []

      // Build current arrangements, swapping the dragged card
      gameState.lanes.forEach((lane, index) => {
        if (lane.attacker) {
          if (lane.attacker.id === cardId) {
            // This is the card being moved - put it in new position
            currentArrangements.push({ attackerId: cardId, laneId: toLaneId })
          } else if (index === toLaneId && lane.attacker.id !== cardId) {
            // If there's a card in target lane, move it to source lane
            currentArrangements.push({ attackerId: lane.attacker.id, laneId: fromLane })
          } else {
            // Keep other cards in their current positions
            currentArrangements.push({ attackerId: lane.attacker.id, laneId: index })
          }
        }
      })

      onRearrangeAttackers(currentArrangements)
    }

    // Handle rearranging defenders
    if (cardType === 'defender' && isPositioningDefenders && onRearrangeDefenders && gameState.canRearrangeCards) {
      const currentArrangements: { defenderId: string; laneId: number }[] = []

      // Build current arrangements, swapping the dragged card
      gameState.lanes.forEach((lane, index) => {
        if (lane.defender) {
          if (lane.defender.id === cardId) {
            // This is the card being moved - put it in new position if target lane has attacker
            if (gameState.lanes[toLaneId].attacker) {
              currentArrangements.push({ defenderId: cardId, laneId: toLaneId })
            }
          } else if (index === toLaneId && lane.defender.id !== cardId) {
            // If there's a defender in target lane, move it to source lane if source has attacker
            if (gameState.lanes[fromLane].attacker) {
              currentArrangements.push({ defenderId: lane.defender.id, laneId: fromLane })
            }
          } else {
            // Keep other defenders in their current positions
            currentArrangements.push({ defenderId: lane.defender.id, laneId: index })
          }
        }
      })

      onRearrangeDefenders(currentArrangements)
    }
  }

  const totalPlayerMana = gameState.player1.mana + gameState.player1.spellMana

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4">
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

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Opponent Area */}
        <div className="space-y-4">
          {/* Opponent Info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-red-900 flex items-center justify-center">
                <Moon className="w-6 h-6 text-red-200" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-100">{gameState.player2.name}</h3>
                <div className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-red-400" />
                  <span className="text-sm font-medium text-slate-200">{gameState.player2.health}</span>
                  <Separator orientation="vertical" className="h-4 bg-slate-600" />
                  <Zap className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-medium text-slate-200">
                    {gameState.player2.mana}/{gameState.player2.maxMana}
                  </span>
                  {gameState.player2.spellMana > 0 && (
                    <span className="text-xs text-purple-400">+{gameState.player2.spellMana}</span>
                  )}
                </div>
              </div>
            </div>
            <Badge variant="outline" className="text-sm border-slate-600 text-slate-300">
              {gameState.player2.hand.length} cards
            </Badge>
          </div>

          {/* Opponent Hand (Hidden) */}
          <div className="flex gap-2 justify-center">
            {gameState.player2.hand.map((_, index) => (
              <TarotCard
                key={index}
                isHidden={true}
                size="small"
                className="hover:scale-102"
              />
            ))}
          </div>

          {/* Opponent Field */}
          <div
            className={`min-h-32 border-2 border-dashed rounded-lg p-4 transition-colors ${dragOverZone === "opponent-field" ? "border-red-500 bg-red-950/20" : "border-slate-700 bg-slate-900/30"
              }`}
            onDragOver={handleDragOver}
            onDragEnter={(e) => handleDragEnter(e, "opponent-field")}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, "opponent-field")}
          >
            <div className="flex gap-4 justify-center">
              {gameState.player2.bench.map((card) => (
                <TarotCard
                  key={card.id}
                  card={card}
                  isDamaged={(card.currentHealth || card.health) < card.health}
                  size="medium"
                  className="border-red-800/40 hover:border-red-600/60"
                />
              ))}
            </div>
          </div>
        </div>

        {/* Combat Lanes Visualization */}
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-600">
          <div className="text-center text-sm text-slate-300 mb-3">
            Combat Lanes
            {(isPositioningAttackers || isPositioningDefenders) && gameState.canRearrangeCards && (
              <span className="ml-2 text-xs text-yellow-400">Drag to rearrange</span>
            )}
            {!gameState.canRearrangeCards && (
              <span className="ml-2 text-xs text-red-400">Positioning locked by spell</span>
            )}
          </div>
          <div className="grid grid-cols-6 gap-2">
            {gameState.lanes.map((lane, index) => (
              <div
                key={lane.id}
                className={`relative transition-colors ${dragOverLane === index ? 'bg-yellow-400/20' : ''}`}
                onDragOver={handleLaneDragOver}
                onDragEnter={(e) => handleLaneDragEnter(e, index)}
                onDragLeave={handleLaneDragLeave}
                onDrop={(e) => handleLaneDrop(e, index)}
              >
                <div className="bg-slate-900 border border-slate-600 rounded-lg p-3 min-h-24 flex flex-col items-center justify-center">
                  <div className="text-xs text-slate-400 mb-1">Lane {index + 1}</div>

                  {/* Defender (Top) */}
                  {lane.defender && (
                    <div
                      className={`bg-red-800/30 border border-red-600 rounded px-2 py-1 mb-1 text-xs text-red-200 text-center cursor-pointer transition-transform ${isPositioningDefenders && gameState.canRearrangeCards ? 'hover:scale-105 draggable' : ''
                        } ${draggedCard === lane.defender.id ? 'opacity-50' : ''}`}
                      draggable={isPositioningDefenders && gameState.canRearrangeCards}
                      onDragStart={(e) => handleLaneDragStart(e, lane.defender!.id, index, 'defender')}
                    >
                      <div className="font-semibold">{lane.defender.name}</div>
                      <div className="text-xs">{lane.defender.attack}⚔️{lane.defender.currentHealth || lane.defender.health}❤️</div>
                    </div>
                  )}

                  {/* Combat Arrow with animation */}
                  {lane.attacker && (
                    <div className="text-purple-400 text-lg animate-bounce">
                      {lane.defender ? "⚔️" : "↑"}
                    </div>
                  )}

                  {/* Attacker (Bottom) */}
                  {lane.attacker && (
                    <div
                      className={`bg-purple-800/30 border border-purple-600 rounded px-2 py-1 mt-1 text-xs text-purple-200 text-center cursor-pointer transition-transform ${isPositioningAttackers && gameState.canRearrangeCards ? 'hover:scale-105 draggable' : ''
                        } ${draggedCard === lane.attacker.id ? 'opacity-50' : ''}`}
                      draggable={isPositioningAttackers && gameState.canRearrangeCards}
                      onDragStart={(e) => handleLaneDragStart(e, lane.attacker!.id, index, 'attacker')}
                    >
                      <div className="font-semibold">{lane.attacker.name}</div>
                      <div className="text-xs">{lane.attacker.attack}⚔️{lane.attacker.currentHealth || lane.attacker.health}❤️</div>
                    </div>
                  )}

                  {/* Empty Lane */}
                  {!lane.attacker && !lane.defender && (
                    <div className="text-slate-500 text-xs">Empty</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Phase Indicator */}
          <div className="text-center mt-3">
            <Badge
              variant={gameState.phase === 'combat' ? 'destructive' : 'secondary'}
              className={`text-xs ${gameState.phase === 'combat' ? 'animate-pulse' : ''}`}
            >
              {gameState.phase === 'main' && 'Main Phase'}
              {gameState.phase === 'position_attackers' && '⚔️ Position Attackers'}
              {gameState.phase === 'declare_defenders' && 'Declare Defenders'}
              {gameState.phase === 'position_defenders' && '🛡️ Position Defenders'}
              {gameState.phase === 'commit_combat' && '⚡ Ready for Combat!'}
              {gameState.phase === 'combat' && '⚔️ Combat! ⚔️'}
            </Badge>
          </div>
        </div>

        {/* Player Area */}
        <div className="space-y-4">
          {/* Player Field */}
          <div
            className={`min-h-32 border-2 border-dashed rounded-lg p-4 transition-colors ${dragOverZone === "player-field"
              ? "border-purple-500 bg-purple-950/20"
              : "border-slate-700 bg-slate-900/30"
              }`}
            onDragOver={handleDragOver}
            onDragEnter={(e) => handleDragEnter(e, "player-field")}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, "player-field")}
          >
            <div className="flex gap-4 justify-center">
              {gameState.player1.bench.map((card) => (
                <TarotCard
                  key={card.id}
                  card={card}
                  isSelected={selectedAttackers.includes(card.id) || selectedDefender?.id === card.id}
                  isDamaged={(card.currentHealth || card.health) < card.health}
                  size="medium"
                  className={selectedAttackers.includes(card.id) || selectedDefender?.id === card.id
                    ? "ring-2 ring-purple-500 shadow-lg shadow-purple-500/20"
                    : "border-purple-800/40 hover:border-purple-600/60"
                  }
                  onClick={() => handleBenchClick(card)}
                />
              ))}
            </div>
          </div>

          {/* Player Hand */}
          <div className="flex gap-3 justify-center">
            {gameState.player1.hand.map((card) => (
              <TarotCard
                key={card.id}
                card={card}
                isSelected={selectedCard === card.id}
                size="large"
                draggable={card.cost <= totalPlayerMana}
                className={`
                  transition-all hover:scale-105 hover:-translate-y-2
                  ${selectedCard === card.id
                    ? "ring-2 ring-amber-400 shadow-lg shadow-amber-400/20"
                    : "border-amber-800/40 hover:border-amber-600/60"
                  } 
                  ${card.cost > totalPlayerMana ? "opacity-50 cursor-not-allowed" : "cursor-move"} 
                  ${draggedCard === card.id ? "opacity-50 scale-95" : ""}
                `}
                onClick={() => {
                  if (isPlayerTurn && gameState.phase === 'main') {
                    setSelectedCard(selectedCard === card.id ? null : card.id)
                    if (onCardPlay && card.cost <= totalPlayerMana) onCardPlay(card)
                  }
                }}
                onDragStart={(e) => handleDragStart(e, card.id, "hand")}
              />
            ))}
          </div>

          {/* Player Info & Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-800 flex items-center justify-center">
                <Sun className="w-6 h-6 text-amber-200" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-100">{gameState.player1.name}</h3>
                <div className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-medium text-slate-200">{gameState.player1.health}</span>
                  <Separator orientation="vertical" className="h-4 bg-slate-600" />
                  <Zap className="w-4 h-4 text-purple-400" />
                  <div className="flex gap-1">
                    {Array.from({ length: gameState.player1.maxMana }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-3 h-3 rounded-full border ${i < gameState.player1.mana ? "bg-purple-500 border-purple-400" : "bg-transparent border-slate-600"
                          }`}
                      />
                    ))}
                  </div>
                  {gameState.player1.spellMana > 0 && (
                    <span className="text-xs text-purple-400">+{gameState.player1.spellMana}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {canAttack && selectedAttackers.length > 0 && (
                <Button
                  onClick={handleCommitAttack}
                  className="bg-orange-600 hover:bg-orange-700 text-xs px-3 py-1"
                >
                  <Sword className="w-4 h-4 mr-2" />
                  Attack ({selectedAttackers.length})
                </Button>
              )}

              {isPositioningAttackers && onCommitAttackers && (
                <Button
                  onClick={onCommitAttackers}
                  className="bg-yellow-600 hover:bg-yellow-700 text-xs px-3 py-1 animate-pulse"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Commit Attack Formation
                </Button>
              )}

              {mustDefend && (
                <Button
                  onClick={handleCommitDefense}
                  className="bg-green-600 hover:bg-green-700 text-xs px-3 py-1"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Defend
                </Button>
              )}

              {isPositioningDefenders && onCommitDefenders && (
                <Button
                  onClick={onCommitDefenders}
                  className="bg-cyan-600 hover:bg-cyan-700 text-xs px-3 py-1 animate-pulse"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Commit Defense Formation
                </Button>
              )}

              {canCommitToCombat && onCommitToCombat && (
                <Button
                  onClick={onCommitToCombat}
                  className="bg-red-600 hover:bg-red-700 text-xs px-3 py-1 animate-pulse border border-red-400"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  COMMIT TO COMBAT!
                </Button>
              )}

              {isPlayerTurn && gameState.phase === 'main' && (
                <Button
                  onClick={onEndTurn}
                  className="bg-purple-700 hover:bg-purple-600 text-purple-100"
                >
                  End Turn
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}