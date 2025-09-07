import { GameState, Card, Player } from '@/types/game';
import { getAllCards, createRandomDeck, createZodiacDeck } from '@/lib/cardLoader';

// Game Constants
const GAME_CONFIG = {
  LANE_COUNT: 6,
  MAX_BENCH_SIZE: 6,
  MAX_DECK_SIZE: 40,
  STARTING_DECK_SIZE: 40,
  MAX_SPELL_MANA: 3,
  MAX_MANA: 10,
  STARTING_HEALTH: 20,
  STARTING_HAND_SIZE: 4,
} as const;

// Get real cards from contentlayer
let TAROT_CARDS: Card[] = [];

// Initialize cards - this will be called when contentlayer is ready
export function initializeCards() {
  try {
    TAROT_CARDS = getAllCards();
  } catch {
    console.warn('Contentlayer not ready, using default cards');
    // Fallback cards if contentlayer isn't ready
    TAROT_CARDS = [
      {
        id: 'default-1',
        name: 'The Fool',
        cost: 1,
        attack: 1,
        health: 1,
        type: 'unit',
        tarotSymbol: '0',
        description: 'Beginning of journey',
        zodiacClass: 'aquarius',
        element: 'air',
        rarity: 'common'
      },
    ];
  }
  return TAROT_CARDS;
}

export function createInitialGameState(useZodiacDeck?: string): GameState {
  // Initialize cards if not already done
  if (TAROT_CARDS.length === 0) {
    initializeCards();
  }

  // Create decks based on preference
  const player1Deck = useZodiacDeck
    ? createZodiacDeck(useZodiacDeck, GAME_CONFIG.STARTING_DECK_SIZE)
    : createRandomDeck(GAME_CONFIG.STARTING_DECK_SIZE);

  const player2Deck = createRandomDeck(GAME_CONFIG.STARTING_DECK_SIZE);

  // Ensure each card has a unique ID for the game instance
  let cardCounter = 0;
  const player1Cards = player1Deck.map(card => ({
    ...card,
    id: `p1_${card.id}_${++cardCounter}`,
    currentHealth: card.health
  }));

  const player2Cards = player2Deck.map(card => ({
    ...card,
    id: `p2_${card.id}_${++cardCounter}`,
    currentHealth: card.health
  }));

  const player1: Player = {
    id: 'player1',
    name: 'You',
    health: GAME_CONFIG.STARTING_HEALTH,
    mana: 1,
    maxMana: 1,
    spellMana: 0,
    hand: player1Cards.slice(0, GAME_CONFIG.STARTING_HAND_SIZE),
    deck: player1Cards.slice(GAME_CONFIG.STARTING_HAND_SIZE),
    bench: [],
    hasAttackToken: true, // Player 1 starts with attack token
  };

  const player2: Player = {
    id: 'player2',
    name: 'Opponent',
    health: GAME_CONFIG.STARTING_HEALTH,
    mana: 1,
    maxMana: 1,
    spellMana: 0,
    hand: player2Cards.slice(0, GAME_CONFIG.STARTING_HAND_SIZE),
    deck: player2Cards.slice(GAME_CONFIG.STARTING_HAND_SIZE),
    bench: [],
    hasAttackToken: false,
  };

  return {
    round: 1,
    turn: 1,
    activePlayer: 'player1',
    attackingPlayer: null,
    player1,
    player2,
    lanes: Array.from({ length: GAME_CONFIG.LANE_COUNT }, (_, id) => ({ id, attacker: null, defender: null })),
    phase: 'main',
    combatResolved: false,
    canRearrangeCards: true,
  };
}

export function canPlayCard(state: GameState, card: Card): boolean {
  const player = state[state.activePlayer];
  const totalMana = player.mana + player.spellMana;

  // Check mana
  if (card.cost > totalMana) return false;

  // Check bench limit
  if (card.type === 'unit' && player.bench.length >= GAME_CONFIG.MAX_BENCH_SIZE) return false;

  return true;
}

export function playCard(state: GameState, card: Card): GameState {
  if (!canPlayCard(state, card)) return state;

  const newState = { ...state };
  const player = { ...newState[state.activePlayer] };

  // Calculate mana usage
  const manaCost = card.cost;
  const manaToUse = Math.min(player.mana, manaCost);
  const spellManaToUse = Math.max(0, manaCost - manaToUse);

  player.mana -= manaToUse;
  player.spellMana -= spellManaToUse;
  player.hand = player.hand.filter(c => c.id !== card.id);

  if (card.type === 'unit') {
    const newCard = { ...card, currentHealth: card.health, position: 'bench' as const };
    player.bench.push(newCard);

    // Execute unit abilities on play (if any)
    if (card.abilities && card.abilities.length > 0) {
      executeAbilities(newState, card.abilities, state.activePlayer);
    }
  } else if (card.type === 'spell') {
    // Execute spell effects
    if (card.effects && card.effects.length > 0) {
      executeSpellEffects(newState, card.effects, state.activePlayer);
    }
  }

  newState[state.activePlayer] = player;
  return newState;
}

// Execute spell effects system
function executeSpellEffects(state: GameState, effects: { name?: string; description?: string }[], castingPlayer: 'player1' | 'player2'): void {
  const opponent = castingPlayer === 'player1' ? 'player2' : 'player1';

  effects.forEach(effect => {
    const description = effect.description?.toLowerCase() || '';
    const effectName = effect.name?.toLowerCase() || '';

    // Simple pattern matching for common effects
    if (description.includes('deal') && description.includes('damage')) {
      // Extract damage amount (look for numbers)
      const damageMatch = description.match(/(\d+)\s*damage/);
      const damage = damageMatch ? parseInt(damageMatch[1]) : 1;

      if (description.includes('any target') || description.includes('enemy')) {
        // For simplicity, deal damage to opponent's health
        state[opponent].health -= damage;
      }
    }

    if (description.includes('draw') && description.includes('card')) {
      // Draw a card
      const player = state[castingPlayer];
      if (player.deck.length > 0) {
        player.hand.push(player.deck.shift()!);
      }
    }

    if (description.includes('gain') && description.includes('mana')) {
      const manaMatch = description.match(/(\d+)\s*mana/);
      const mana = manaMatch ? parseInt(manaMatch[1]) : 1;
      state[castingPlayer].mana += mana;
    }

    // Check for positioning-prevention effects
    if (description.includes('lock') && description.includes('position') ||
      description.includes('prevent') && description.includes('rearrange') ||
      description.includes('freeze') && description.includes('formation') ||
      effectName.includes('binding') || effectName.includes('paralyze') ||
      effectName.includes('stun')) {
      // Prevent card rearrangement for the current combat
      state.canRearrangeCards = false;
    }
  });
}

// Execute unit abilities system
function executeAbilities(state: GameState, abilities: { name?: string; description?: string }[], owningPlayer: 'player1' | 'player2'): void {
  const opponent = owningPlayer === 'player1' ? 'player2' : 'player1';

  abilities.forEach(ability => {
    const description = ability.description?.toLowerCase() || '';

    // Pattern matching for common abilities
    if (description.includes('destroy') && description.includes('health')) {
      const healthMatch = description.match(/(\d+)\s*or\s*less\s*health/);
      const maxHealth = healthMatch ? parseInt(healthMatch[1]) : 3;

      // Remove enemy units with health <= maxHealth
      state[opponent].bench = state[opponent].bench.filter(unit =>
        (unit.currentHealth || unit.health) > maxHealth
      );
    }

    if (description.includes('cost') && description.includes('less')) {
      // This would need more complex implementation for ongoing effects
      // For now, just acknowledge the ability exists
      console.log(`${ability.name || 'Unknown ability'} activated`);
    }
  });
}

export function declareAttackers(state: GameState, attackerIds: string[]): GameState {
  if (!state[state.activePlayer].hasAttackToken) return state;
  if (state.phase !== 'main') return state;
  if (attackerIds.length > GAME_CONFIG.LANE_COUNT) return state; // Max attackers (one per lane)

  const newState = { ...state };
  const player = { ...newState[state.activePlayer] };

  // Clear lanes
  newState.lanes = newState.lanes.map(lane => ({ ...lane, attacker: null, defender: null }));

  // Place attackers in lanes
  attackerIds.forEach((id, index) => {
    const unit = player.bench.find(u => u.id === id);
    if (unit && index < GAME_CONFIG.LANE_COUNT) {
      newState.lanes[index].attacker = { ...unit, position: 'attacking' };
    }
  });

  newState.phase = 'position_attackers';
  newState.attackingPlayer = state.activePlayer;
  return newState;
}

export function declareDefenders(state: GameState, defenderAssignments: { defenderId: string; laneId: number }[]): GameState {
  if (state.phase !== 'position_defenders') return state;

  const newState = { ...state };
  const defendingPlayer = state.activePlayer === 'player1' ? 'player2' : 'player1';
  const player = { ...newState[defendingPlayer] };

  // Assign defenders to lanes
  defenderAssignments.forEach(({ defenderId, laneId }) => {
    const unit = player.bench.find(u => u.id === defenderId);
    if (unit && laneId < 6 && newState.lanes[laneId].attacker) {
      newState.lanes[laneId].defender = { ...unit, position: 'defending' };
    }
  });

  newState.phase = 'position_defenders';
  return newState;
}

// New function to rearrange attackers in lanes
export function rearrangeAttackers(state: GameState, newArrangement: { attackerId: string; laneId: number }[]): GameState {
  if (state.phase !== 'position_attackers') return state;
  if (!state.canRearrangeCards) return state;

  const newState = { ...state };
  const attackingPlayer = state.attackingPlayer!;

  // Clear current attackers from lanes
  newState.lanes = newState.lanes.map(lane => ({ ...lane, attacker: null }));

  // Place attackers in new positions
  newArrangement.forEach(({ attackerId, laneId }) => {
    const unit = newState[attackingPlayer].bench.find(u => u.id === attackerId);
    if (unit && laneId < GAME_CONFIG.LANE_COUNT) {
      newState.lanes[laneId].attacker = { ...unit, position: 'attacking' };
    }
  });

  return newState;
}

// New function to rearrange defenders in lanes  
export function rearrangeDefenders(state: GameState, newArrangement: { defenderId: string; laneId: number }[]): GameState {
  if (state.phase !== 'position_defenders') return state;
  if (!state.canRearrangeCards) return state;

  const newState = { ...state };
  const defendingPlayer = state.activePlayer === 'player1' ? 'player2' : 'player1';

  // Clear current defenders from lanes
  newState.lanes = newState.lanes.map(lane => ({ ...lane, defender: null }));

  // Place defenders in new positions
  newArrangement.forEach(({ defenderId, laneId }) => {
    const unit = newState[defendingPlayer].bench.find(u => u.id === defenderId);
    if (unit && laneId < GAME_CONFIG.LANE_COUNT && newState.lanes[laneId].attacker) {
      newState.lanes[laneId].defender = { ...unit, position: 'defending' };
    }
  });

  return newState;
}

// Commit to combat from attacker positioning
export function commitAttackersToPosition(state: GameState): GameState {
  if (state.phase !== 'position_attackers') return state;

  const newState = { ...state };
  newState.phase = 'declare_defenders';
  return newState;
}

// Commit to combat from defender positioning  
export function commitDefendersToPosition(state: GameState): GameState {
  if (state.phase !== 'position_defenders') return state;

  const newState = { ...state };
  newState.phase = 'commit_combat';
  return newState;
}

// Final commit to combat - triggers combat resolution
export function commitToCombat(state: GameState): GameState {
  if (state.phase !== 'commit_combat') return state;

  const newState = { ...state };
  newState.phase = 'combat';
  return newState;
}

export function resolveCombat(state: GameState): GameState {
  if (state.phase !== 'combat') return state;

  const newState = { ...state };
  const attackingPlayer = newState.attackingPlayer!;
  const defendingPlayer = attackingPlayer === 'player1' ? 'player2' : 'player1';

  // Resolve combat lane by lane (left to right)
  newState.lanes.forEach((lane) => {
    if (lane.attacker) {
      if (lane.defender) {
        // Unit vs Unit combat
        const attackerNewHealth = (lane.attacker.currentHealth || lane.attacker.health) - lane.defender.attack;
        const defenderNewHealth = (lane.defender.currentHealth || lane.defender.health) - lane.attacker.attack;

        // Remove dead units
        if (attackerNewHealth <= 0) {
          newState[attackingPlayer].bench = newState[attackingPlayer].bench.filter(
            u => u.id !== lane.attacker!.id
          );
        } else {
          const benchUnit = newState[attackingPlayer].bench.find(u => u.id === lane.attacker!.id);
          if (benchUnit) benchUnit.currentHealth = attackerNewHealth;
        }

        if (defenderNewHealth <= 0) {
          newState[defendingPlayer].bench = newState[defendingPlayer].bench.filter(
            u => u.id !== lane.defender!.id
          );
        } else {
          const benchUnit = newState[defendingPlayer].bench.find(u => u.id === lane.defender!.id);
          if (benchUnit) benchUnit.currentHealth = defenderNewHealth;
        }
      } else {
        // Direct nexus damage
        newState[defendingPlayer].health -= lane.attacker.attack;
      }
    }
  });

  // Clear lanes
  newState.lanes = newState.lanes.map(lane => ({ ...lane, attacker: null, defender: null }));
  newState.combatResolved = true;
  newState.phase = 'main';
  newState.attackingPlayer = null;

  return newState;
}

// Game outcome detection
export function checkGameOutcome(state: GameState): 'player1_wins' | 'player2_wins' | 'ongoing' {
  if (state.player1.health <= 0) return 'player2_wins';
  if (state.player2.health <= 0) return 'player1_wins';
  return 'ongoing';
}

export function endTurn(state: GameState): GameState {
  const newState = { ...state };

  // Store unspent mana as spell mana
  const unspentMana = newState[state.activePlayer].mana;
  newState[state.activePlayer].spellMana = Math.min(GAME_CONFIG.MAX_SPELL_MANA,
    newState[state.activePlayer].spellMana + unspentMana
  );

  // Switch active player
  const nextPlayer = state.activePlayer === 'player1' ? 'player2' : 'player1';
  newState.activePlayer = nextPlayer;
  newState.turn++;

  // Every 2 turns = new round
  if (newState.turn % 2 === 1) {
    newState.round++;

    // Switch attack token
    newState.player1.hasAttackToken = !newState.player1.hasAttackToken;
    newState.player2.hasAttackToken = !newState.player2.hasAttackToken;
  }

  // Refill mana
  const currentPlayer = newState[nextPlayer];
  currentPlayer.maxMana = Math.min(GAME_CONFIG.MAX_MANA, newState.round);
  currentPlayer.mana = currentPlayer.maxMana;

  // Draw a card
  if (currentPlayer.deck.length > 0) {
    currentPlayer.hand.push(currentPlayer.deck.shift()!);
  }

  newState.phase = 'main';
  newState.combatResolved = false;

  // Reset card rearrangement ability at the start of each turn
  newState.canRearrangeCards = true;

  return newState;
}

// Enhanced AI Strategy
export function aiTurn(state: GameState): GameState {
  let newState = { ...state };

  if (newState.activePlayer !== 'player2') return newState;

  const ai = newState.player2;
  const opponent = newState.player1;

  // Phase 1: Play cards strategically
  const playableCards = ai.hand
    .filter(card => canPlayCard(newState, card))
    .sort((a, b) => {
      // Prioritize by value (attack + health) / cost ratio
      const aValue = (a.attack + a.health) / Math.max(1, a.cost);
      const bValue = (b.attack + b.health) / Math.max(1, b.cost);
      return bValue - aValue;
    });

  // Play units until bench is full or mana is depleted
  for (const card of playableCards) {
    if (ai.bench.length >= GAME_CONFIG.MAX_BENCH_SIZE) break;
    if (canPlayCard(newState, card)) {
      newState = playCard(newState, card);
    }
  }

  // Phase 2: Attack if has attack token
  if (ai.hasAttackToken && ai.bench.length > 0) {
    // Select best attackers
    const attackers = ai.bench
      .sort((a, b) => b.attack - a.attack)
      .slice(0, GAME_CONFIG.LANE_COUNT)
      .map(u => u.id);

    if (attackers.length > 0) {
      newState = declareAttackers(newState, attackers);

      // AI auto-commits attackers to position and moves to defender phase
      if (newState.phase === 'position_attackers') {
        newState = commitAttackersToPosition(newState);
      }

      // AI auto-assigns defenders (simplified for tutorial)
      if (newState.phase === 'declare_defenders') {
        const defenderAssignments: { defenderId: string; laneId: number }[] = [];

        // Simple defensive strategy: block strongest attackers first
        newState.lanes.forEach((lane, index) => {
          if (lane.attacker && opponent.bench.length > defenderAssignments.length) {
            const availableDefenders = opponent.bench.filter(
              u => !defenderAssignments.some(d => d.defenderId === u.id)
            );

            if (availableDefenders.length > 0) {
              // Find best defender (highest health that can survive)
              const bestDefender = availableDefenders
                .sort((a, b) => (b.currentHealth || b.health) - (a.currentHealth || a.health))
                .find(d => (d.currentHealth || d.health) > lane.attacker!.attack);

              if (bestDefender) {
                defenderAssignments.push({
                  defenderId: bestDefender.id,
                  laneId: index
                });
              }
            }
          }
        });

        newState = declareDefenders(newState, defenderAssignments);

        // AI auto-commits defenders and moves to combat
        if (newState.phase === 'position_defenders') {
          newState = commitDefendersToPosition(newState);
        }

        if (newState.phase === 'commit_combat') {
          newState = commitToCombat(newState);
        }

        if (newState.phase === 'combat') {
          newState = resolveCombat(newState);
        }
      }
    }
  }

  // End turn
  return endTurn(newState);
}