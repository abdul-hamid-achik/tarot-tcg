export type ZodiacClass =
  | 'aries' | 'taurus' | 'gemini' | 'cancer'
  | 'leo' | 'virgo' | 'libra' | 'scorpio'
  | 'sagittarius' | 'capricorn' | 'aquarius' | 'pisces';

export type Element = 'fire' | 'earth' | 'air' | 'water';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export type SpellType = 'instant' | 'ritual' | 'enchantment';

export interface Ability {
  name: string;
  description: string;
  cost?: number;
  cooldown?: number;
  active?: boolean;
}

export interface SpellEffect {
  name: string;
  description: string;
  target?: 'self' | 'ally' | 'enemy' | 'any' | 'all';
  duration?: number;
}

export interface Card {
  id: string;
  name: string;
  cost: number;
  attack: number;
  health: number;
  currentHealth?: number;
  type: 'unit' | 'spell';
  description?: string;
  tarotSymbol?: string;
  position?: 'bench' | 'attacking' | 'defending';

  // Zodiac system properties
  zodiacClass: ZodiacClass;
  element: Element;
  rarity: Rarity;
  keywords?: string[];
  abilities?: Ability[];

  // Spell-specific properties
  spellType?: SpellType;
  effects?: SpellEffect[];

  // Runtime state
  statusEffects?: StatusEffect[];
  counters?: { [key: string]: number };
}

export interface StatusEffect {
  id: string;
  name: string;
  description: string;
  duration: number;
  source?: string;
  stackable?: boolean;
  stacks?: number;
}

// Interface for MDX frontmatter parsing
export interface CardMetadata {
  id: string;
  name: string;
  zodiacClass: ZodiacClass;
  element: Element;
  type: 'unit' | 'spell';
  cost: number;
  attack?: number;
  health?: number;
  rarity: Rarity;
  tarotSymbol: string;
  keywords?: string[];
  abilities?: Ability[];
  spellType?: SpellType;
  effects?: SpellEffect[];
}

// Interface for complete card data with content
export interface CardData {
  metadata: CardMetadata;
  content: string;
  filepath: string;
}

export interface Lane {
  id: number;
  attacker: Card | null;
  defender: Card | null;
}

export interface Player {
  id: string;
  name: string;
  health: number;
  mana: number;
  maxMana: number;
  spellMana: number;
  hand: Card[];
  deck: Card[];
  bench: Card[]; // Units on field but not in combat (max 6)
  hasAttackToken: boolean;
}

export interface GameState {
  round: number; // Each round has 2 turns
  turn: number; // Total turns
  activePlayer: 'player1' | 'player2';
  attackingPlayer: 'player1' | 'player2' | null;
  player1: Player;
  player2: Player;
  lanes: Lane[];
  phase: 'main' | 'declare_attackers' | 'declare_defenders' | 'position_attackers' | 'position_defenders' | 'commit_combat' | 'combat' | 'end';
  combatResolved: boolean;
  canRearrangeCards: boolean; // Can be disabled by spell effects
}