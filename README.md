# Tarot Trading Card Game

A turn-based card battler built with Next.js, React, and TypeScript. Inspired by games like Legends of Runeterra, featuring lane-based combat with mystical tarot-themed cards.

## 🎮 Game Features

- **Turn-based combat** with alternating attack tokens between players
- **Lane-based battlefield** with 6 combat lanes for strategic positioning
- **Mana system** with spell mana banking (unused mana converts to spell mana, max 3)
- **Unit cards** with attack/health stats and unique abilities
- **Combat phases**: Main → Declare Attackers → Declare Defenders → Combat Resolution
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

1. **Mana Management**: Players gain mana each turn, with unused mana converting to spell mana
2. **Lane Strategy**: Position units across 6 lanes to control the battlefield
3. **Combat Resolution**: Declare attackers and defenders before automatic combat resolution
4. **Victory Conditions**: Reduce opponent's Nexus health to 0

## 🤝 Contributing

This project follows standard React/TypeScript patterns with pure functions for game state management. Feel free to submit issues and pull requests!
