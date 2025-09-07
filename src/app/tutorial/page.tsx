'use client';

import { useState, useEffect } from 'react';
import GameBoard from '@/components/GameBoard';
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
  commitAttackersToPosition,
  commitDefendersToPosition,
  commitToCombat,
  checkGameOutcome
} from '@/lib/gameLogic';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function Tutorial() {
  const [selectedZodiac, setSelectedZodiac] = useState<ZodiacClass | undefined>(undefined);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [gameOutcome, setGameOutcome] = useState<'player1_wins' | 'player2_wins' | 'ongoing'>('ongoing');

  // Initialize cards and game when component mounts
  useEffect(() => {
    initializeCards();
    setGameState(createInitialGameState(selectedZodiac));
  }, [selectedZodiac]);
  const [message, setMessage] = useState<string>('Welcome! You have the attack token. Play units and attack!');

  useEffect(() => {
    if (!gameState) return;

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

    if (gameState.activePlayer !== 'player1' || gameState.phase !== 'main') {
      setMessage('⚠️ You can only play cards during your main phase!');
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

    const newState = declareAttackers(gameState, attackerIds);
    setGameState(newState);
    setMessage('⚔️ Attackers declared! Position them strategically, then commit to combat.');

    // The new system goes to position_attackers phase first
    if (newState.phase === 'position_attackers') {
      // For tutorial, we'll automatically commit the attack formation after a brief delay
      setTimeout(() => {
        const committedState = commitAttackersToPosition(newState);
        setGameState(committedState);
        setMessage('⚔️ Attack formation committed! AI is choosing defenders...');
      }, 2000);
    } else if (newState.phase === 'declare_defenders') {
      // If AI needs to defend, handle it automatically
      if (newState.player2.bench.length > 0) {
        setMessage('⚔️ Attack declared! AI is choosing defenders...');
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

          // Handle the new positioning phases for defenders
          if (defendedState.phase === 'position_defenders') {
            defendedState = commitDefendersToPosition(defendedState);
          }

          if (defendedState.phase === 'commit_combat') {
            defendedState = commitToCombat(defendedState);
          }

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

    // Handle the new positioning phases
    if (newState.phase === 'position_defenders') {
      newState = commitDefendersToPosition(newState);
    }

    if (newState.phase === 'commit_combat') {
      newState = commitToCombat(newState);
    }

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
    if (!gameState) return;

    const newState = commitAttackersToPosition(gameState);
    setGameState(newState);
    setMessage('⚔️ Attack formation committed! Waiting for defenders...');
  };

  const handleCommitDefenders = () => {
    if (!gameState) return;

    const newState = commitDefendersToPosition(gameState);
    setGameState(newState);
    setMessage('🛡️ Defense formation committed! Ready for combat!');
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

  const handleReset = () => {
    setGameState(createInitialGameState(selectedZodiac));
    setGameOutcome('ongoing');
    setMessage('🔄 New game started! You have the first attack token.');
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

      <div className="fixed top-0 left-0 right-0 z-10 bg-black/80 backdrop-blur p-4 border-b border-purple-600">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-2">
            <div>
              <h1 className="text-2xl font-bold text-white">Tutorial Mode</h1>
              <p className="text-sm text-gray-300">{message}</p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleReset}
                className="bg-red-600 hover:bg-red-700"
              >
                Reset Game
              </Button>
              <Button
                onClick={handleBackToMenu}
                className="bg-gray-600 hover:bg-gray-700"
              >
                Back to Menu
              </Button>
            </div>
          </div>

          {/* Zodiac Deck Selector */}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-white text-sm">Select Zodiac Deck:</span>
            <div className="flex gap-1">
              <Button
                onClick={() => setSelectedZodiac(undefined)}
                className={`text-xs px-2 py-1 ${!selectedZodiac ? 'bg-purple-600' : 'bg-gray-700'}`}
              >
                Random
              </Button>
              {zodiacSigns.map((sign) => (
                <Button
                  key={sign.name}
                  onClick={() => setSelectedZodiac(sign.name)}
                  className={`text-xs px-2 py-1 ${selectedZodiac === sign.name ? 'bg-purple-600' : 'bg-gray-700'}`}
                  title={`${sign.name} - ${sign.element}`}
                >
                  {sign.symbol}
                </Button>
              ))}
            </div>
            {selectedZodiac && (
              <Badge className="ml-2 bg-purple-600">
                Playing as {selectedZodiac.charAt(0).toUpperCase() + selectedZodiac.slice(1)}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="pt-20">
        <GameBoard
          gameState={gameState}
          onCardPlay={handleCardPlay}
          onAttack={handleAttack}
          onDefend={handleDefend}
          onRearrangeAttackers={handleRearrangeAttackers}
          onRearrangeDefenders={handleRearrangeDefenders}
          onCommitAttackers={handleCommitAttackers}
          onCommitDefenders={handleCommitDefenders}
          onCommitToCombat={handleCommitToCombat}
          onEndTurn={handleEndTurn}
        />
      </div>
    </div>
  );
}