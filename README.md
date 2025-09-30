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
