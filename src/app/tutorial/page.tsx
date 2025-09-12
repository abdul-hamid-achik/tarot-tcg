'use client'

import { Menu } from 'lucide-react'
import { useEffect, useState } from 'react'
import TarotGameBoard from '@/components/game_board'
import GameOutcomeScreen from '@/components/game_outcome_screen'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { GameLogger } from '@/lib/game_logger'
import {
  aiMulligan,
  checkGameOutcome,
  commitToCombat,
  completeMulligan,
  createInitialGameState,
  declareAttackers,
  declareDefenders,
  endTurn,
  initializeCards,
  playCard,
  rearrangeAttackers,
  rearrangeDefenders,
  resolveCombat,
} from '@/lib/game_logic'
import type { Card, GameState, ZodiacClass } from '@/schemas/schema'
import { AI_PERSONALITIES, type AILevel, aiService } from '@/services/ai_service'

export default function Tutorial() {
  const [selectedZodiac, setSelectedZodiac] = useState<ZodiacClass | undefined>(undefined)
  const [selectedAILevel, setSelectedAILevel] = useState<AILevel>('normal')
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [gameOutcome, setGameOutcome] = useState<'player1_wins' | 'player2_wins' | 'ongoing'>(
    'ongoing',
  )
  const [sheetOpen, setSheetOpen] = useState(false)

  // Initialize cards and game when component mounts
  useEffect(() => {
    initializeCards()
    aiService.setPersonality(selectedAILevel)
    const newGame = createInitialGameState(selectedZodiac)
    setGameState(newGame)
    GameLogger.gameStart('You', AI_PERSONALITIES[selectedAILevel].name)
    GameLogger.turnStart('player1', 1, 1, true)
  }, [selectedZodiac, selectedAILevel])
  const [message, setMessage] = useState<string>(
    'Welcome! Choose your starting hand - drag cards to discard them for new ones, or keep all cards.',
  )
  const [timeRemaining, setTimeRemaining] = useState<number>(180) // 3 minutes in seconds

  // Timer countdown effect
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          // Reset timer when it reaches 0 (simulating new turn)
          return 180
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Enhanced AI turn using AI service - moved here to avoid circular dependency
  const performEnhancedAITurn = async (currentState: GameState): Promise<GameState> => {
    let newState = { ...currentState }

    // AI card play phase
    const maxPlays = 3 // Limit AI plays per turn to avoid infinite loops
    let playsThisTurn = 0

    while (playsThisTurn < maxPlays) {
      const { card, shouldPlay } = aiService.selectCardToPlay(newState)

      if (!card || !shouldPlay) break

      try {
        // Play the selected card
        newState = await playCard(newState, card)
        playsThisTurn++
      } catch (error) {
        console.error('Error in AI card play:', error)
        break
      }
    }

    // AI attack phase (if has attack token)
    if (newState.player2.hasAttackToken && newState.player2.bench.length > 0) {
      const attackers = aiService.selectAttackers(newState)

      if (attackers.length > 0) {
        // Convert to arrangement format
        const attackerArrangement = attackers.map((id, index) => ({
          attackerId: id,
          laneId: index,
        }))

        newState = declareAttackers(newState, attackerArrangement)

        // Simple auto-defend for the player
        if (newState.phase === 'combat' && newState.player1.bench.length > 0) {
          const defenderAssignments: { defenderId: string; laneId: number }[] = []
          newState.lanes.forEach((lane, index) => {
            if (lane.attacker) {
              const availableDefender = newState.player1.bench.find(
                u => !defenderAssignments.some(d => d.defenderId === u.id),
              )
              if (availableDefender) {
                defenderAssignments.push({ defenderId: availableDefender.id, laneId: index })
              }
            }
          })

          newState = declareDefenders(newState, defenderAssignments)

          if (newState.phase === 'combat') {
            try {
              newState = await resolveCombat(newState)
            } catch (error) {
              console.error('Error in AI combat resolution:', error)
            }
          }
        }
      }
    }

    try {
      // End AI turn
      newState = await endTurn(newState)
    } catch (error) {
      console.error('Error ending AI turn:', error)
    }

    return newState
  }

  useEffect(() => {
    if (!gameState) return

    // Handle AI mulligan phase
    if (
      gameState.phase === 'mulligan' &&
      !gameState.player2.mulliganComplete &&
      gameState.player1.mulliganComplete
    ) {
      const personality = aiService.getCurrentPersonality()
      setTimeout(() => {
        setMessage(`${personality.icon} ${personality.name} is choosing cards...`)
        const newState = aiService.performMulligan(gameState)
        setGameState(newState)
        setMessage('✅ Both players ready! Game starting...')
      }, personality.thinkingTime)
      return
    }

    // Check game outcome
    const outcome = checkGameOutcome(gameState)
    setGameOutcome(outcome)

    if (outcome === 'player2_wins') {
      setMessage('❌ Defeat! The mystical forces have overcome you.')
      return // Don't continue with AI turn if game is over
    } else if (outcome === 'player1_wins') {
      setMessage('🎉 Victory! You have mastered the tarot powers!')
      return // Don't continue with AI turn if game is over
    } else if (gameState.activePlayer === 'player2' && gameState.phase === 'action') {
      // Enhanced AI Turn with personality
      const personality = aiService.getCurrentPersonality()
      setTimeout(async () => {
        setMessage(`${personality.icon} ${personality.name} is thinking...`)
        try {
          const newState = await performEnhancedAITurn(gameState)
          setGameState(newState)

          if (newState.player1?.hasAttackToken) {
            setMessage('⚔️ Your turn! You have the attack token - summon units and attack!')
          } else {
            setMessage('🛡️ Your turn! Prepare your defenses.')
          }
        } catch (error) {
          console.error('Error in AI turn:', error)
          setMessage('❌ AI turn failed. Please reset the game.')
        }
      }, personality.thinkingTime)
    }
  }, [gameState, performEnhancedAITurn])

  const handleCardPlay = async (card: Card) => {
    if (!gameState) return

    if (gameState.activePlayer !== 'player1' || gameState.phase !== 'action') {
      setMessage('⚠️ You can only play cards during your action phase!')
      return
    }

    const totalMana = gameState.player1.mana + gameState.player1.spellMana
    if (card.cost > totalMana) {
      setMessage(`⚠️ Not enough mana! Need ${card.cost}, have ${totalMana}`)
      return
    }

    if (card.type === 'unit' && gameState.player1.bench.length >= 6) {
      setMessage('⚠️ Bench is full! Maximum 6 units allowed.')
      return
    }

    try {
      const newState = await playCard(gameState, card)
      setGameState(newState)
      setMessage(`✅ Played ${card.name} (${newState.player1?.bench?.length || 0}/6 units on bench)`)
    } catch (error) {
      console.error('Error playing card:', error)
      setMessage('❌ Failed to play card. Please try again.')
    }
  }

  const handleAttack = async (attackerIds: string[]) => {
    if (!gameState) return

    if (!gameState.player1.hasAttackToken) {
      setMessage('⚠️ You need the attack token to declare attacks!')
      return
    }

    // Convert simple attacker IDs to arrangement with lanes
    const attackerArrangement = attackerIds.map((id, index) => ({
      attackerId: id,
      laneId: index,
    }))

    const newState = declareAttackers(gameState, attackerArrangement)
    setGameState(newState)
    setMessage('⚔️ Attackers declared! AI is choosing defenders...')

    // New simplified flow - goes straight to combat
    if (newState.phase === 'combat') {
      // If AI needs to defend, handle it automatically
      if (newState.player2.bench.length > 0) {
        setTimeout(async () => {
          try {
            // Simple AI defense logic
            const defenderAssignments: { defenderId: string; laneId: number }[] = []
            newState.lanes.forEach((lane, index) => {
              if (lane.attacker) {
                const availableDefender = newState.player2.bench.find(
                  u => !defenderAssignments.some(d => d.defenderId === u.id),
                )
                if (availableDefender) {
                  defenderAssignments.push({ defenderId: availableDefender.id, laneId: index })
                }
              }
            })

            setMessage('🛡️ AI is positioning defenders...')
            let defendedState = declareDefenders(newState, defenderAssignments)

            // Pause before combat for visual feedback
            setTimeout(async () => {
              // Combat should trigger automatically after defenders are declared
              if (defendedState.phase === 'combat') {
                setMessage('⚔️ Combat beginning...')
                defendedState = await resolveCombat(defendedState)
              }

              setGameState(defendedState)
              setMessage('💥 Combat resolved! Continue your turn.')
            }, 1500) // Additional delay for combat resolution
          } catch (error) {
            console.error('Error in combat resolution:', error)
            setMessage('❌ Combat failed. Please try again.')
          }
        }, 2000) // Increased delay for defender positioning
      } else {
        try {
          // No defenders available, go straight to combat
          const combatState = await resolveCombat({ ...newState, phase: 'combat' })
          setGameState(combatState)
          setMessage('💥 Direct attack! No defenders available.')
        } catch (error) {
          console.error('Error in direct combat:', error)
          setMessage('❌ Combat failed. Please try again.')
        }
      }
    }
  }

  const _handleDefend = async (assignments: { defenderId: string; laneId: number }[]) => {
    if (!gameState) return

    let newState = declareDefenders(gameState, assignments)

    try {
      // Combat resolves immediately after declaring defenders
      if (newState.phase === 'combat') {
        newState = await resolveCombat(newState)
      }

      setGameState(newState)
      setMessage('🛡️ Defense set! Combat resolved.')
    } catch (error) {
      console.error('Error in defense combat:', error)
      setMessage('❌ Defense failed. Please try again.')
    }
  }

  // New handlers for the enhanced combat system
  const _handleRearrangeAttackers = (arrangements: { attackerId: string; laneId: number }[]) => {
    if (!gameState) return

    const newState = rearrangeAttackers(gameState, arrangements)
    setGameState(newState)
    setMessage('⚔️ Attack formation updated! Commit when ready.')
  }

  const _handleRearrangeDefenders = (arrangements: { defenderId: string; laneId: number }[]) => {
    if (!gameState) return

    const newState = rearrangeDefenders(gameState, arrangements)
    setGameState(newState)
    setMessage('🛡️ Defense formation updated! Commit when ready.')
  }

  const _handleCommitAttackers = () => {
    if (!gameState || gameState.phase !== 'action') return
    // In the simplified system, this confirms the attack arrangement
    setMessage('⚔️ Attack confirmed! Waiting for defenders...')
  }

  const _handleCommitDefenders = async () => {
    if (!gameState || gameState.phase !== 'combat') return

    try {
      let newState = commitToCombat(gameState)
      if (newState.phase === 'combat') {
        newState = await resolveCombat(newState)
      }
      setGameState(newState)
      setMessage('🛡️ Defense confirmed! Combat resolved!')
    } catch (error) {
      console.error('Error committing defenders:', error)
      setMessage('❌ Defense commit failed. Please try again.')
    }
  }

  const _handleCommitToCombat = async () => {
    if (!gameState) return

    try {
      let newState = commitToCombat(gameState)
      if (newState.phase === 'combat') {
        newState = await resolveCombat(newState)
      }
      setGameState(newState)
      setMessage('💥 Combat initiated and resolved!')
    } catch (error) {
      console.error('Error committing to combat:', error)
      setMessage('❌ Combat commit failed. Please try again.')
    }
  }

  const handleEndTurn = async () => {
    if (!gameState || gameState.activePlayer !== 'player1') return

    try {
      const newState = await endTurn(gameState)
      setGameState(newState)
      setMessage('Turn ended. AI is taking their turn...')
    } catch (error) {
      console.error('Error ending turn:', error)
      setMessage('❌ Failed to end turn. Please try again.')
    }
  }

  const handleMulligan = (selectedCards: string[]) => {
    if (!gameState) return

    let newState = completeMulligan({
      ...gameState,
      player1: { ...gameState.player1, selectedForMulligan: selectedCards },
    })

    // Check if we need to run AI mulligan
    if (!newState.player2.mulliganComplete) {
      newState = aiMulligan(newState)
    }

    setGameState(newState)

    if (selectedCards.length > 0) {
      setMessage(`✨ Mulliganed ${selectedCards.length} cards. Game starting!`)
    } else {
      setMessage('✅ Kept starting hand. Game starting!')
    }
  }

  const handleReset = () => {
    setGameState(createInitialGameState(selectedZodiac))
    setGameOutcome('ongoing')
    setMessage('🔄 New game started! Choose your starting hand.')
  }

  const handleBackToMenu = () => {
    window.location.href = '/'
  }

  const zodiacSigns: Array<{ name: ZodiacClass; symbol: string; element: string }> = [
    { name: 'aries', symbol: '♈', element: 'fire' },
    { name: 'taurus', symbol: '♉', element: 'earth' },
    { name: 'gemini', symbol: '♊', element: 'air' },
    { name: 'cancer', symbol: '♋', element: 'water' },
    { name: 'leo', symbol: '♌', element: 'fire' },
    { name: 'virgo', symbol: '♍', element: 'earth' },
    { name: 'libra', symbol: '♎', element: 'air' },
    { name: 'scorpio', symbol: '♏', element: 'water' },
    { name: 'sagittarius', symbol: '♐', element: 'fire' },
    { name: 'capricorn', symbol: '♑', element: 'earth' },
    { name: 'aquarius', symbol: '♒', element: 'air' },
    { name: 'pisces', symbol: '♓', element: 'water' },
  ]

  if (!gameState) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading cards...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Game Outcome Screen Overlay */}
      <GameOutcomeScreen
        outcome={gameOutcome}
        playerHealth={gameState?.player1?.health || 0}
        opponentHealth={gameState?.player2?.health || 0}
        round={gameState?.round || 1}
        turn={gameState?.turn || 1}
        onPlayAgain={handleReset}
        onBackToMenu={handleBackToMenu}
      />

      {/* Floating Tutorial Controls */}
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[50] flex items-start gap-2">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              className="bg-red-600 border-2 border-yellow-400 hover:bg-red-700 shadow-2xl px-4 py-2 text-white font-bold"
            >
              <Menu className="h-4 w-4 mr-2" />
              Help
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-[400px] bg-slate-900 border-purple-600 text-white overflow-y-auto"
          >
            <SheetHeader>
              <SheetTitle className="text-2xl text-white">Tutorial Mode</SheetTitle>
              <SheetDescription className="text-gray-300">{message}</SheetDescription>
            </SheetHeader>

            <div className="space-y-6 mt-6">
              {/* Game Controls */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-purple-300">Game Controls</h3>
                <div className="flex gap-2">
                  <Button onClick={handleReset} className="bg-red-600 hover:bg-red-700 flex-1">
                    Reset Game
                  </Button>
                  <Button
                    onClick={handleBackToMenu}
                    className="bg-gray-600 hover:bg-gray-700 flex-1"
                  >
                    Back to Menu
                  </Button>
                </div>
              </div>

              {/* AI Opponent Selector */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-purple-300">AI Opponent</h3>
                <div className="grid grid-cols-1 gap-2">
                  {(Object.keys(AI_PERSONALITIES) as AILevel[]).map(level => {
                    const personality = AI_PERSONALITIES[level]
                    return (
                      <Button
                        key={level}
                        onClick={() => setSelectedAILevel(level)}
                        className={`text-left px-3 py-2 h-auto ${
                          selectedAILevel === level ? 'bg-purple-600' : 'bg-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{personality.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold">{personality.name}</div>
                            <div className="text-xs text-gray-300 truncate">
                              {personality.description}
                            </div>
                          </div>
                        </div>
                      </Button>
                    )
                  })}
                </div>
                {selectedAILevel && (
                  <Badge className="bg-purple-600 w-full justify-center py-2">
                    Fighting {AI_PERSONALITIES[selectedAILevel].name}{' '}
                    {AI_PERSONALITIES[selectedAILevel].icon}
                  </Badge>
                )}
              </div>

              {/* Zodiac Deck Selector */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-purple-300">Select Zodiac Deck</h3>
                <div className="grid grid-cols-4 gap-2">
                  <Button
                    onClick={() => setSelectedZodiac(undefined)}
                    className={`text-xs px-2 py-2 ${!selectedZodiac ? 'bg-purple-600' : 'bg-gray-700'}`}
                  >
                    Random
                  </Button>
                  {zodiacSigns.map(sign => (
                    <Button
                      key={sign.name}
                      onClick={() => setSelectedZodiac(sign.name)}
                      className={`text-xs px-2 py-2 ${selectedZodiac === sign.name ? 'bg-purple-600' : 'bg-gray-700'}`}
                      title={`${sign.name} - ${sign.element}`}
                    >
                      {sign.symbol}
                    </Button>
                  ))}
                </div>
                {selectedZodiac && (
                  <Badge className="bg-purple-600 w-full justify-center py-2">
                    Playing as {selectedZodiac.charAt(0).toUpperCase() + selectedZodiac.slice(1)}
                  </Badge>
                )}
              </div>

              {/* Game Info */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-purple-300">Game Info</h3>
                <div className="space-y-2 text-sm text-gray-300">
                  <div className="flex justify-between">
                    <span>Round:</span>
                    <span className="text-white font-semibold">{gameState?.round || 1}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Turn:</span>
                    <span className="text-white font-semibold">{gameState?.turn || 1}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Active Player:</span>
                    <span className="text-white font-semibold">
                      {gameState?.activePlayer === 'player1' ? 'You' : 'AI'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Attack Token:</span>
                    <span className="text-white font-semibold">
                      {gameState?.player1.hasAttackToken ? 'You ⚔️' : 'AI ⚔️'}
                    </span>
                  </div>
                </div>
              </div>

              {/* How to Play */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-purple-300">How to Play</h3>
                <div className="space-y-2 text-sm text-gray-300">
                  <p>• Play cards by dragging them to the field</p>
                  <p>• Click units to select them for attack</p>
                  <p>• Attack token alternates each round</p>
                  <p>• Defeat the opponent by reducing their health to 0</p>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <Badge
            className={`border-2 border-white px-4 py-2 text-lg font-bold shadow-lg ${
              timeRemaining <= 30
                ? 'bg-red-600 animate-pulse'
                : timeRemaining <= 60
                  ? 'bg-orange-600'
                  : 'bg-blue-600'
            }`}
          >
            ⏱️ {formatTime(timeRemaining)}
          </Badge>

          {/* Game Info - Always Visible */}
          <Badge className="bg-gray-800 border border-gray-600 px-3 py-1 text-xs text-white">
            R{gameState?.round || 1} • T{gameState?.turn || 1} •{' '}
            {gameState?.activePlayer === 'player1' ? 'You' : 'AI'}
          </Badge>

          {/* Mulligan Quick Actions */}
          {gameState?.phase === 'mulligan' && !gameState?.player1.mulliganComplete && (
            <div className="flex gap-1">
              <Button
                onClick={() => handleMulligan([])}
                size="lg"
                className="bg-green-600 hover:bg-green-700 border-2 border-white text-sm px-4 py-2 shadow-lg font-bold"
              >
                Keep All
              </Button>
              <Button
                onClick={() => handleMulligan(gameState?.player1.hand.map(c => c.id) || [])}
                size="lg"
                className="bg-orange-600 hover:bg-orange-700 border-2 border-white text-sm px-4 py-2 shadow-lg font-bold"
              >
                Mulligan All
              </Button>
            </div>
          )}
        </div>
      </div>

      <div>
        <TarotGameBoard
          gameState={gameState}
          onCardPlay={handleCardPlay}
          onAttack={handleAttack}
          onEndTurn={handleEndTurn}
          onMulligan={handleMulligan}
        />
      </div>
    </div>
  )
}
