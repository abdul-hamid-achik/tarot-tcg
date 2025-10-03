# Tarot Trading Card Game

A turn-based card battler built with Next.js, React, and TypeScript. Featuring **Hearthstone-style direct attack combat** with mystical tarot-themed cards and zodiac mechanics.

## 🎮 Game Features

- **Direct attack combat** - Hearthstone-style immediate combat resolution
- **Turn-based gameplay** with alternating attack tokens between players
- **7-slot battlefield** for strategic unit positioning
- **Mana system** with spell mana banking (unused mana converts to spell mana, max 3)
- **Tarot orientation system** - 50% chance cards are reversed with different effects
- **Zodiac synergies** - Cards gain buffs during their zodiac season
- **Unit cards** with attack/health stats and unique abilities
- **AI opponent** for single-player gameplay

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
npm run db:push       # Push schema changes
npm run db:studio     # Open Drizzle Studio
npm run db:logs       # View database logs
```

## 🛠️ Development Commands

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

## 🏗️ Tech Stack

- **Framework**: Next.js 15.5.2 with App Router
- **UI Library**: React 19.1.0
- **Styling**: Tailwind CSS v4 with shadcn/ui components
- **Type Safety**: TypeScript with strict mode
- **Icons**: Lucide React

## 📁 Project Structure

```
src/
├── app/           # Next.js app router pages
├── components/    # React components (GameBoard, GameCard, ui/)
├── lib/           # Utilities and game logic
└── types/         # TypeScript type definitions
```

## 🎯 Game Mechanics

The game implements a sophisticated turn-based combat system:

1. **Mana Management**: Players gain mana each turn, with unused mana converting to spell mana (max 3)
2. **Direct Attack System**: Units attack enemy units or the player directly (Hearthstone-style)
3. **Tarot Orientation**: Each card played has a 50% chance to be reversed, altering its effects
4. **Zodiac Buffs**: Units gain +1/+1 when played during their zodiac sign's season
5. **Attack Tokens**: Players alternate who can attack each round
6. **Victory Conditions**: Reduce opponent's health to 0

## 🤝 Contributing

This project follows standard React/TypeScript patterns with pure functions for game state management. Feel free to submit issues and pull requests!
