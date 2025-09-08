'use client';

import { useState, useEffect } from 'react';
import TarotGameBoard from '@/components/GameBoard.legacy';
import GameOutcomeScreen from '@/components/GameOutcomeScreen';
import { GameState, Card, ZodiacClass } from '@/types/game';
import {
  createInitialGameState,
  initializeCards,
  playCard,
  endTurn,
  resolveCombat,
  aiTurn,
  declareAttackers,
  declareDefenders,
  rearrangeAttackers,
  rearrangeDefenders,
  commitToCombat,
  checkGameOutcome,
  completeMulligan,
  aiMulligan
} from '@/lib/gameLogic';
import { GameLogger } from '@/lib/gameLogger';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Menu } from 'lucide-react';

export default function Tutorial() {
  const [selectedZodiac, setSelectedZodiac] = useState<ZodiacClass | undefined>(undefined);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [gameOutcome, setGameOutcome] = useState<'player1_wins' | 'player2_wins' | 'ongoing'>('ongoing');
  const [sheetOpen, setSheetOpen] = useState(false);

  // Initialize cards and game when component mounts
  useEffect(() => {
    initializeCards();
    const newGame = createInitialGameState(selectedZodiac);
    setGameState(newGame);
    GameLogger.gameStart('You', 'AI Opponent');
    GameLogger.turnStart('player1', 1, 1, true);
  }, [selectedZodiac]);
  const [message, setMessage] = useState<string>('Welcome! Choose your starting hand - drag cards to discard them for new ones, or keep all cards.');

  useEffect(() => {
    if (!gameState) return;

    // Handle AI mulligan phase
    if (gameState.phase === 'mulligan' && !gameState.player2.mulliganComplete && gameState.player1.mulliganComplete) {
      setTimeout(() => {
        setMessage('🤖 AI is choosing cards...');
        const newState = aiMulligan(gameState);
        setGameState(newState);
        setMessage('✅ Both players ready! Game starting...');
      }, 1000);
      return;
    }

    // Check game outcome
    const outcome = checkGameOutcome(gameState);
    setGameOutcome(outcome);

    if (outcome === 'player2_wins') {
      setMessage('❌ Defeat! The mystical forces have overcome you.');
      return; // Don't continue with AI turn if game is over
    } else if (outcome === 'player1_wins') {
      setMessage('🎉 Victory! You have mastered the tarot powers!');
      return; // Don't continue with AI turn if game is over
    } else if (gameState.activePlayer === 'player2') {
      // AI Turn
      setTimeout(() => {
        setMessage('🤖 AI is thinking...');
        const newState = aiTurn(gameState);
        setGameState(newState);

        if (newState.player1.hasAttackToken) {
          setMessage('⚔️ Your turn! You have the attack token - summon units and attack!');
        } else {
          setMessage('🛡️ Your turn! Prepare your defenses.');
        }
      }, 1000);
    }
  }, [gameState]);

  const handleCardPlay = (card: Card) => {
    if (!gameState) return;

    if (gameState.activePlayer !== 'player1' || gameState.phase !== 'action') {
      setMessage('⚠️ You can only play cards during your action phase!');
      return;
    }

    const totalMana = gameState.player1.mana + gameState.player1.spellMana;
    if (card.cost > totalMana) {
      setMessage(`⚠️ Not enough mana! Need ${card.cost}, have ${totalMana}`);
      return;
    }

    if (card.type === 'unit' && gameState.player1.bench.length >= 6) {
      setMessage('⚠️ Bench is full! Maximum 6 units allowed.');
      return;
    }

    const newState = playCard(gameState, card);
    setGameState(newState);
    setMessage(`✅ Played ${card.name} (${newState.player1.bench.length}/6 units on bench)`);
  };

  const handleAttack = (attackerIds: string[]) => {
    if (!gameState) return;

    if (!gameState.player1.hasAttackToken) {
      setMessage('⚠️ You need the attack token to declare attacks!');
      return;
    }

    // Convert simple attacker IDs to arrangement with lanes
    const attackerArrangement = attackerIds.map((id, index) => ({
      attackerId: id,
      laneId: index
    }));

    const newState = declareAttackers(gameState, attackerArrangement);
    setGameState(newState);
    setMessage('⚔️ Attackers declared! AI is choosing defenders...');

    // New simplified flow - goes straight to combat
    if (newState.phase === 'combat') {
      // If AI needs to defend, handle it automatically
      if (newState.player2.bench.length > 0) {
        setTimeout(() => {
          // Simple AI defense logic
          const defenderAssignments: { defenderId: string; laneId: number }[] = [];
          newState.lanes.forEach((lane, index) => {
            if (lane.attacker) {
              const availableDefender = newState.player2.bench.find(
                u => !defenderAssignments.some(d => d.defenderId === u.id)
              );
              if (availableDefender) {
                defenderAssignments.push({ defenderId: availableDefender.id, laneId: index });
              }
            }
          });

          let defendedState = declareDefenders(newState, defenderAssignments);

          // Combat should trigger automatically after defenders are declared
          if (defendedState.phase === 'combat') {
            defendedState = resolveCombat(defendedState);
          }

          setGameState(defendedState);
          setMessage('💥 Combat resolved! Continue your turn.');
        }, 1000);
      } else {
        // No defenders available, go straight to combat
        const combatState = resolveCombat({ ...newState, phase: 'combat' });
        setGameState(combatState);
        setMessage('💥 Direct attack! No defenders available.');
      }
    }
  };

  const handleDefend = (assignments: { defenderId: string; laneId: number }[]) => {
    if (!gameState) return;

    let newState = declareDefenders(gameState, assignments);

    // Combat resolves immediately after declaring defenders
    if (newState.phase === 'combat') {
      newState = resolveCombat(newState);
    }

    setGameState(newState);
    setMessage('🛡️ Defense set! Combat resolved.');
  };

  // New handlers for the enhanced combat system
  const handleRearrangeAttackers = (arrangements: { attackerId: string; laneId: number }[]) => {
    if (!gameState) return;

    const newState = rearrangeAttackers(gameState, arrangements);
    setGameState(newState);
    setMessage('⚔️ Attack formation updated! Commit when ready.');
  };

  const handleRearrangeDefenders = (arrangements: { defenderId: string; laneId: number }[]) => {
    if (!gameState) return;

    const newState = rearrangeDefenders(gameState, arrangements);
    setGameState(newState);
    setMessage('🛡️ Defense formation updated! Commit when ready.');
  };

  const handleCommitAttackers = () => {
    if (!gameState || gameState.phase !== 'action') return;
    // In the simplified system, this confirms the attack arrangement
    setMessage('⚔️ Attack confirmed! Waiting for defenders...');
  };

  const handleCommitDefenders = () => {
    if (!gameState || gameState.phase !== 'combat') return;

    let newState = commitToCombat(gameState);
    if (newState.phase === 'combat') {
      newState = resolveCombat(newState);
    }
    setGameState(newState);
    setMessage('🛡️ Defense confirmed! Combat resolved!');
  };

  const handleCommitToCombat = () => {
    if (!gameState) return;

    let newState = commitToCombat(gameState);
    if (newState.phase === 'combat') {
      newState = resolveCombat(newState);
    }
    setGameState(newState);
    setMessage('💥 Combat initiated and resolved!');
  };

  const handleEndTurn = () => {
    if (!gameState || gameState.activePlayer !== 'player1') return;

    const newState = endTurn(gameState);
    setGameState(newState);
    setMessage('Turn ended. AI is taking their turn...');
  };

  const handleMulligan = (selectedCards: string[]) => {
    if (!gameState) return;

    let newState = completeMulligan({ ...gameState, player1: { ...gameState.player1, selectedForMulligan: selectedCards } });

    // Check if we need to run AI mulligan
    if (!newState.player2.mulliganComplete) {
      newState = aiMulligan(newState);
    }

    setGameState(newState);

    if (selectedCards.length > 0) {
      setMessage(`✨ Mulliganed ${selectedCards.length} cards. Game starting!`);
    } else {
      setMessage('✅ Kept starting hand. Game starting!');
    }
  };

  const handleReset = () => {
    setGameState(createInitialGameState(selectedZodiac));
    setGameOutcome('ongoing');
    setMessage('🔄 New game started! Choose your starting hand.');
  };

  const handleBackToMenu = () => {
    window.location.href = '/';
  };

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
    { name: 'pisces', symbol: '♓', element: 'water' }
  ];

  if (!gameState) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading cards...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Game Outcome Screen Overlay */}
      <GameOutcomeScreen
        outcome={gameOutcome}
        playerHealth={gameState?.player1.health || 0}
        opponentHealth={gameState?.player2.health || 0}
        round={gameState?.round || 1}
        turn={gameState?.turn || 1}
        onPlayAgain={handleReset}
        onBackToMenu={handleBackToMenu}
      />

      {/* Floating Tutorial Controls */}
      <div className="fixed top-4 left-4 z-20 flex items-start gap-2">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="bg-black/80 border-purple-600 hover:bg-purple-900/50"
            >
              <Menu className="h-4 w-4 text-white" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[400px] bg-slate-900 border-purple-600 text-white overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="text-2xl text-white">Tutorial Mode</SheetTitle>
              <SheetDescription className="text-gray-300">
                {message}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-6 mt-6">
              {/* Game Controls */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-purple-300">Game Controls</h3>
                <div className="flex gap-2">
                  <Button
                    onClick={handleReset}
                    className="bg-red-600 hover:bg-red-700 flex-1"
                  >
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
                  {zodiacSigns.map((sign) => (
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
          <Badge className="bg-purple-600/90 px-3 py-1">
            {gameState?.phase === 'mulligan' && 'Mulligan Phase'}
            {gameState?.phase === 'action' && 'Action Phase'}
            {gameState?.phase === 'combat' && 'Combat!'}
            {gameState?.phase === 'end_round' && 'Round Ending'}
          </Badge>

          {/* Mulligan Quick Actions */}
          {gameState?.phase === 'mulligan' && !gameState?.player1.mulliganComplete && (
            <div className="flex gap-1">
              <Button
                onClick={() => handleMulligan([])}
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-xs px-2 py-1"
              >
                Keep All
              </Button>
              <Button
                onClick={() => handleMulligan(gameState?.player1.hand.map(c => c.id) || [])}
                size="sm"
                className="bg-orange-600 hover:bg-orange-700 text-xs px-2 py-1"
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
  );
}