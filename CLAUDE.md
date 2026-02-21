# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands
```bash
# Start development server
bun run dev

# Build for production
bun run build

# Start production server
bun run start

# Run linting (Biome)
bun run lint              # Runs Biome linter/formatter

# Run tests
bun run test              # Runs tests once and reports results
bun run test:ui           # Opens Vitest UI for interactive testing
bun run test:run          # Runs tests once (CI mode)
bun run test:coverage     # Runs tests with coverage report
bun run test:watch        # Runs tests in watch mode
```

## Architecture Overview

This is a **Tarot Trading Card Game** built with Next.js 15 (App Router), React 19, and TypeScript. The game implements a turn-based card battler with Hearthstone-style direct attack combat, featuring unique tarot card mechanics.

### Core Game Mechanics
- **Hearthstone-style battlefield**: 7 slots per player for direct unit placement
- **Direct attack combat**: Units can attack enemy units or the player's nexus directly
- **Attack token system**: Players alternate having the attack token each round
- **Mana system** with spell mana banking (unused mana converts to spell mana, max 3)
- **Card types**: Units (with attack/health) and Spells (instant, ritual, enchantment)
- **Tarot mechanics**: Cards can be played reversed for different effects
- **Zodiac system**: 12 zodiac classes with elemental affinities (fire, earth, air, water)
- **Game phases**: Mulligan → Round Start → Action → Combat Resolution → End Round
- **Win conditions**: Reduce opponent's nexus health to 0, deck-out, or alternative win conditions (zodiac, arcana, etc.)

### Key Architecture Components

**State Management**
- **Zustand Store** (`src/store/game_store.ts`): Central state management using Zustand with devtools
  - `GameState`: Core game data (players, cards, phases, etc.)
  - `GridState`: Battlefield grid management with cell positioning
  - `AnimationState`: Animation queue and progress tracking
  - `InteractionState`: User interaction modes (click/drag/hybrid)
  - `UIState`: Overlay management and performance settings

**Service Layer** (`src/services/`)
- `ai_service.ts`: AI opponent logic with difficulty levels
- `combat_service.ts`: Combat resolution and damage calculation
- `grid_manager_service.ts`: Grid operations and card placement
- `effect_stack_service.ts`: Card effect resolution and stack management
- `card_effect_system.ts`: Effect parsing and execution
- `animation_service.ts`: Animation orchestration
- `win_condition_service.ts`: Victory/defeat condition checking
- `event_manager.ts`: Event system for game actions
- `interaction_service.ts`: User input handling

**Hooks** (`src/hooks/`)
- `use_game_actions.ts`: Game action dispatching
- `use_ai_turn.ts`: AI turn management
- `use_game_clock.ts`: Turn timer and time management
- `use_game_effects.ts`: Effect processing hooks

**Component Structure**
- `game_board.tsx`: Main game interface with grid layout
- `game_card.tsx`: Card display with drag-and-drop support
- `battlefield/`: Grid components and cell management
- `hand/`: Hand fan layout and card management
- `player/`: Player status and nexus display
- `effect_stack_panel.tsx`: Active effects visualization
- `win_condition_panel.tsx`: Win condition tracking UI

### Content Management with Contentlayer

**What is Contentlayer?**
Contentlayer is a content SDK that transforms MDX/Markdown files into type-safe JSON data. In this project, it's used to manage all card definitions and game content, providing:
- Type-safe content schemas with full TypeScript support
- Build-time validation of card properties
- Hot-reloading during development
- Automatic generation of TypeScript types from content

**How we use Contentlayer:**
1. **Card Definitions** (`content/cards/`):
   - Major Arcana: 22 cards (0-21) in `major-arcana/`
   - Minor Arcana: 56 cards organized by suit in `minor-arcana/`
   - Each card is an MDX file with frontmatter for game properties

2. **Content Schema** (`contentlayer.config.ts`):
   - Defines `Card` document type with required fields (id, name, zodiacClass, element, cost, etc.)
   - Defines `ZodiacClass` for class buff descriptions
   - Validates all content at build time
   - Generates computed fields like URL paths

3. **Loading System** (`src/lib/card_loader.ts`):
   - Dynamically imports card data from Contentlayer's generated files
   - Provides type-safe access to all card properties
   - Supports filtering by arcana type, suit, or other properties

**Example Card MDX:**
```mdx
---
id: "major_00"
name: "The Fool"
zodiacClass: "aries"
element: "fire"
cardType: "unit"
cost: 0
attack: 1
health: 1
rarity: "legendary"
tarotSymbol: "0"
description: "Beginning: Draw 1 card when played"
reversedDescription: "Recklessness: Discard 1 card when played"
keywords: ["draw", "beginning"]
---

# The Fool

The Fool represents new beginnings and untapped potential...
```

### Tech Stack
- **Framework**: Next.js 15.5.2 with App Router
- **UI Library**: React 19.1.0
- **State Management**: Zustand 5.0.8 with TypeScript
- **Styling**: Tailwind CSS v4 with shadcn/ui components
- **Type Safety**: TypeScript with Zod schemas for validation
- **Content**: Contentlayer2 for MDX content management
- **Testing**: Vitest with React Testing Library
- **Linting/Formatting**: Biome (replaces ESLint + Prettier)
- **Icons**: Lucide React for UI icons
- **Path Aliases**: `@/` maps to `./src/`

### Project Structure
```
src/
├── app/              # Next.js app router pages
├── components/       # React components
│   ├── battlefield/  # Grid and cell components
│   ├── hand/        # Hand management
│   ├── player/      # Player status components
│   ├── effects/     # Visual effects
│   ├── layout/      # Layout components
│   └── ui/          # shadcn/ui components
├── contexts/        # React contexts (theme)
├── hooks/           # Custom React hooks
├── lib/             # Utilities and helpers
├── schemas/         # Zod schemas (single source of truth)
├── services/        # Game logic services
├── store/           # Zustand store
├── styles/          # Global styles and animations
└── __tests__/       # Test files

content/
├── cards/           # Card definitions in MDX
│   ├── major-arcana/
│   └── minor-arcana/
└── classes/         # Zodiac class definitions
```

### Development Guidelines

**Code Style**
- Use snake_case for file names
- Use Zod schemas as the single source of truth (avoid separate type definitions)
- Prefer schema inference over manual type creation
- Do NOT create a scripts folder with scripts

**State Management**
- All game state modifications go through the Zustand store
- Services provide pure functions for game logic
- Use store actions for state mutations
- Maintain immutability in state updates

**Component Guidelines**
- Use shadcn/ui components for consistent styling
- Implement drag-and-drop interactions through the interaction service
- Support both click and drag modes for card placement
- Use Tailwind CSS for styling (avoid inline styles)

**Linting with Biome**
- Biome is configured for both linting and formatting
- Replaces ESLint and Prettier with a single, faster tool
- Configuration in `biome.json` with strict rules
- Formats with 2-space indentation, 100-character line width
- Run `bun run lint` to check and auto-fix issues

### Testing Philosophy

**We prioritize comprehensive testing** - The game logic is complex with many edge cases. Tests ensure game mechanics work correctly and prevent regressions.

**Testing Stack:**
- **Vitest**: Fast unit test runner with excellent DX
- **React Testing Library**: For component testing
- **happy-dom**: Lightweight DOM implementation for tests
- **Test Utils** (`src/test_utils.tsx`): Custom helpers for game state mocking

**What to Test:**
1. **Services** (Critical):
   - All game logic services should have comprehensive tests
   - Combat calculations, effect resolution, win conditions
   - AI decision making at different difficulty levels
   - Grid operations and card placement rules

2. **Hooks**:
   - Custom hooks with complex logic
   - Timer-based hooks (use fake timers)
   - State management hooks

3. **Components**:
   - User interactions (clicks, drags)
   - Conditional rendering based on game state
   - Error states and edge cases

**Testing Patterns:**
```typescript
// Service test example
describe('CombatService', () => {
  it('should calculate damage correctly with modifiers', () => {
    const result = combatService.calculateDamage(attacker, defender, modifiers)
    expect(result.damage).toBe(3)
    expect(result.overkill).toBe(1)
  })
})

// Component test example
describe('GameCard', () => {
  it('should be draggable only during action phase', () => {
    const { getByTestId } = renderWithGameState(<GameCard {...props} />, {
      gameState: { currentPhase: 'action' }
    })
    // Test drag behavior
  })
})
```

**Running Tests:**
- `bun run test` - Run all tests once
- `bun run test:watch` - Watch mode for development
- `bun run test:coverage` - Generate coverage report
- Coverage goals: >80% for services, >60% for components

**Performance**
- Use animation service for smooth transitions
- Implement performance modes (high/medium/low)
- Batch animations when possible
- Optimize grid operations for 24-cell battlefield

## Browser Automation

Use `agent-browser` for web automation. Run `agent-browser --help` for all commands.

Core workflow:
1. `agent-browser open <url>` - Navigate to page
2. `agent-browser snapshot -i` - Get interactive elements with refs (@e1, @e2)
3. `agent-browser click @e1` / `fill @e2 "text"` - Interact using refs
4. Re-snapshot after page changes
