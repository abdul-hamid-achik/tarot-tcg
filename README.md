# Tarot Trading Card Game

A **tactical turn-based card battler** built with Next.js, React, and TypeScript. Featuring **Hearthstone-style direct attack combat** on a 7-slot battlefield with mystical tarot-themed cards, zodiac mechanics, and card orientation system.

> 🔮 Harness the power of the 78 Tarot Arcana. Master zodiac synergies. Outmaneuver your opponent on the battlefield.

## 🎮 Game Features

### Core Gameplay
- **Direct attack combat** - Hearthstone-style immediate combat resolution
- **Turn-based gameplay** with alternating attack tokens between players
- **7-slot battlefield** for strategic unit positioning
- **Mana system** with spell mana banking (unused mana converts to spell mana, max 3)
- **Mulligan system** - Redraw cards at the start of each game

### Tarot Mechanics
- **Tarot orientation system** - 50% chance cards are reversed with different effects
- **Zodiac synergies** - Cards gain +1/+1 buffs during their zodiac season
- **78 tarot cards** - All Major and Minor Arcana with unique mechanics
- **MDX-based card content** - Dynamic card data with rich descriptions

### Game Modes
- **Single-player** - Play against AI with multiple difficulty levels
- **Multiplayer (PVP)** - Real-time matchmaking with zodiac compatibility system
- **Alternative win conditions** - Multiple paths to victory beyond health depletion

### Card System
- **Unit cards** - Attack/health stats with triggered abilities
- **Spell cards** - Instant, ritual, and enchantment types
- **Effect stack system** - Proper card interaction and response timing

## 🚀 Getting Started

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to play the game.

## 💾 Database Setup

The game uses [Neon Postgres](https://neon.tech) with Drizzle ORM for persistence.

### Local Development (Neon Local)

1. Create `.env.local` with your Neon credentials:
```bash
DATABASE_URL="postgresql://neon:npg@localhost:5432/tarot_tcg"
NEON_API_KEY=your_api_key
NEON_PROJECT_ID=your_project_id
BRANCH_ID=your_branch_id
```

2. Start the database and push schema:
```bash
npm run db:setup
```

### Production (Vercel + Neon)

Set `DATABASE_URL` in Vercel environment variables with your Neon connection string.

### Database Commands

```bash
npm run db:start      # Start Neon Local (Docker)
npm run db:stop       # Stop database
npm run db:setup      # Start database & push schema (quick setup)
npm run db:push       # Push schema changes
npm run db:generate   # Generate Drizzle migrations
npm run db:migrate    # Run migrations
npm run db:studio     # Open Drizzle Studio (visual editor)
npm run db:logs       # View database logs
```

## 🛠️ Development Commands

```bash
# Development
npm run dev              # Start dev server with debugger
npm run dev:no-debug     # Start dev server without debugger
npm run build            # Build for production
npm run start            # Start production server

# Code Quality
npm run lint             # Check code with Biome
npm run lint:fix         # Auto-fix linting issues
npm run format           # Format code with Biome

# Testing
npm run test             # Run all tests once
npm run test:watch       # Run tests in watch mode
npm run test:ui          # Open Vitest UI for interactive testing
npm run test:coverage    # Generate test coverage report
```

## 🏗️ Tech Stack

### Core
- **Framework**: Next.js 15.5.2 with App Router
- **UI Library**: React 19.1.0
- **Language**: TypeScript 5 with strict mode
- **State Management**: Zustand 5.0 with devtools

### Styling & Components
- **Styling**: Tailwind CSS v4
- **Component Library**: Radix UI (Dialog, Progress, Select, Tabs, etc.)
- **UI Utilities**: shadcn/ui components
- **Icons**: Lucide React

### Content & Data
- **Content Management**: Contentlayer2 for MDX-based cards
- **Database**: Neon Postgres with Drizzle ORM
- **Schema Validation**: Zod 4.1

### Development Tools
- **Testing**: Vitest 3.2 with React Testing Library
- **Linting & Formatting**: Biome 2.2
- **Test Runner**: happy-dom environment

## 📁 Project Structure

```
src/
├── app/                  # Next.js app router
│   ├── api/              # API routes (game actions, matchmaking, WebSocket)
│   ├── cards/            # Card catalog pages
│   ├── multiplayer/      # Multiplayer game interface
│   └── tutorial/         # Tutorial page
├── components/           # React components
│   ├── battlefield/      # Battlefield grid and slot components
│   ├── combat/           # Combat visualization (attack arrows)
│   ├── multiplayer/      # Matchmaking and lobby components
│   ├── ui/               # Reusable UI components (shadcn/ui)
│   └── __tests__/        # Component tests
├── services/             # Game logic services
│   ├── ai_service.ts         # AI decision making
│   ├── combat_service.ts     # Combat resolution
│   ├── card_effect_system.ts # Card effects & abilities
│   ├── battlefield_service.ts # Battlefield management
│   ├── phase_manager_service.ts # Game phase transitions
│   └── __tests__/        # Service tests
├── hooks/                # Custom React hooks
│   ├── use_game_actions.ts      # Game state mutations
│   ├── use_combat_actions.ts    # Combat interactions
│   ├── use_multiplayer_actions.ts # PVP actions
│   └── __tests__/        # Hook tests
├── lib/                  # Core utilities
│   ├── game_logic.ts     # Core game state management
│   ├── combat_logic.ts   # Combat calculations
│   ├── card_loader.ts    # Card data loading
│   └── game_logger.ts    # Debug logging
├── store/                # Zustand state management
│   └── game_store.ts     # Central game state store
├── schemas/              # Zod validation schemas
│   └── schema.ts         # Game state & card schemas
├── db/                   # Database setup
│   ├── index.ts          # Neon connection
│   └── schema.ts         # Drizzle schema
└── __tests__/            # Integration tests

content/
├── cards/                # MDX card definitions
│   ├── major-arcana/     # 22 Major Arcana cards
│   └── minor-arcana/     # 56 Minor Arcana cards (4 suits)
└── classes/              # Zodiac class guides
```

## 🎯 Game Mechanics

The game implements a sophisticated turn-based combat system with unique tarot-themed mechanics:

### Turn Structure
1. **Mulligan Phase** - Both players can redraw unwanted cards once
2. **Round Start** - Refill mana, draw a card, reset attack tokens
3. **Action Phase** - Play cards, activate abilities, declare attacks
4. **Combat Resolution** - Resolve all attacks and damage
5. **End Round** - Unused mana converts to spell mana (max 3)

### Combat System
- **Direct Attack** - Hearthstone-style: units can attack enemy units or the player's health directly
- **Attack Tokens** - Players alternate who has attack initiative each round
- **Summoning Sickness** - Units cannot attack the turn they're played
- **Combat Math** - Simultaneous damage resolution for unit-vs-unit combat

### Tarot Mechanics
- **Card Orientation** - Each card drawn has a 50% chance to be reversed
- **Upright Effects** - Standard card text and abilities
- **Reversed Effects** - Alternate abilities, often with a twist or downside
- **Zodiac Buffs** - Cards gain +1/+1 when played during their zodiac season

### Win Conditions
- **Health Depletion** - Reduce opponent's health to 0 (default)
- **Deck Out** - Opponent cannot draw when deck is empty
- **Alternative Conditions** - Special win conditions based on game mode (zodiac dominance, arcana mastery, etc.)

## 🧪 Testing

The project uses **Vitest** with comprehensive test coverage across services, hooks, and components.

### Running Tests

```bash
npm run test              # Run all tests once
npm run test:watch        # Watch mode for development
npm run test:ui           # Interactive Vitest UI
npm run test:coverage     # Generate coverage report
```

### Test Coverage

- **Integration Tests** (`src/__tests__/`) - Full game flow scenarios
- **Service Tests** (`src/services/__tests__/`) - Game logic and combat
- **Hook Tests** (`src/hooks/__tests__/`) - Custom React hooks
- **Component Tests** (`src/components/__tests__/`) - UI interactions

Coverage goals: >80% for services, >60% for components.

## 🤝 Contributing

This project follows standard React/TypeScript patterns with **service-based architecture** for game logic separation:

- **Services** handle core game logic (combat, effects, AI)
- **Hooks** provide React integration layer
- **Zustand store** manages global game state
- **Pure functions** for predictable state updates

We prioritize comprehensive testing and clean architecture. Check `CLAUDE.md` for detailed development guidelines.

Feel free to submit issues and pull requests!
