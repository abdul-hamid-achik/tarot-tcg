# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Run linting
npm run lint
```

## Architecture Overview

This is a **Tarot Trading Card Game** built with Next.js 15 (App Router), React 19, and TypeScript. The game implements a turn-based card battler inspired by games like Legends of Runeterra.

### Core Game Mechanics
- **Turn-based combat** with alternating attack tokens between players
- **Lane-based battlefield** with 6 combat lanes
- **Mana system** with spell mana banking (unused mana converts to spell mana, max 3)
- **Card types**: Units with attack/health stats
- **Combat phases**: Main → Declare Attackers → Declare Defenders → Combat Resolution

### Key Components

**Game State Management** (`src/types/game.ts`, `src/lib/gameLogic.ts`)
- Central `GameState` interface manages all game data
- Pure functions handle state transitions (playCard, declareAttackers, declareDefenders, resolveCombat)
- AI logic included for single-player mode

**UI Components**
- `GameBoard` (`src/components/GameBoard.tsx`): Main game interface with lanes, benches, and hands
- `GameCard` (`src/components/GameCard.tsx`): Card display component with stats and interactions
- Uses shadcn/ui components (Button, Card) with Tailwind CSS styling

### Tech Stack
- **Framework**: Next.js 15.5.2 with App Router
- **UI Library**: React 19.1.0
- **Styling**: Tailwind CSS v4 with shadcn/ui components
- **Type Safety**: TypeScript with strict mode enabled
- **Icons**: Lucide React for UI icons
- **Path Aliases**: `@/` maps to `./src/`

### Project Structure
```
src/
├── app/           # Next.js app router pages
├── components/    # React components (GameBoard, GameCard, ui/)
├── lib/           # Utilities and game logic
└── types/         # TypeScript type definitions
```

When making changes:
- Follow existing patterns for state management (pure functions, immutable updates)
- Use shadcn/ui components and Tailwind for consistent styling
- Maintain TypeScript strict mode compliance