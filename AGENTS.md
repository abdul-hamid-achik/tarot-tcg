<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any Next.js code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# tarot-tcg — Agent Guide

Tarot Trading Card Game. Turn-based card battler (Hearthstone-style direct-attack, 7 slots per player) built with **Next.js 16 (App Router) + React 19 + TypeScript + Zustand + Content Collections**.

## Commands (use `bun`, not npm)

```bash
bun run dev              # next dev (Content Collections hot-reloads)
bun run build            # next build (withContentCollections wrapper)
bun run start            # next start
bun run lint             # biome check .
bun run lint:fix         # biome check --write .
bun run format           # biome format --write .
bun run test             # vitest run (happy-dom, globals)
bun run test:watch       # vitest --watch
bun run test:ui          # vitest --ui
bun run test:coverage    # vitest run --coverage (v8)
bunx tsc --noEmit        # typecheck
npx playwright test      # e2e (e2e/*.spec.ts, excluded from vitest)

# DB (Neon Postgres + Drizzle)
bun run db:start         # docker compose up -d
bun run db:push          # drizzle-kit push
bun run db:generate      # drizzle-kit generate
bun run db:migrate       # drizzle-kit migrate
bun run db:studio        # drizzle-kit studio
bun run db:setup         # db:start + db:push
```

Requires `DATABASE_URL` (and for Neon Local: `NEON_API_KEY`, `NEON_PROJECT_ID`, `BRANCH_ID`). See `README.md`.

## Stack

- **Framework:** Next.js 16 with `withContentCollections(nextConfig)` — see `next.config.ts`, security headers.
- **State:** Zustand 5 (`src/store/game_store.ts`) + Immer (`enableMapSet()`, `produce()`). Slices: `GameState`, `GridState`, `AnimationState`, `InteractionState`, `UIState`. All mutations via store actions; services export pure functions.
- **Styling:** Tailwind CSS v4 + shadcn/ui (Radix primitives in `src/components/ui`) + `lucide-react`. No inline styles.
- **Content:** `@content-collections/core` + `@content-collections/mdx`. No Contentlayer. Generated types in `.content-collections/generated` (gitignored).
- **Validation:** Zod 4.5 — `src/schemas/schema.ts` is single source of truth (ZodiacClass, Element, Rarity, SpellType, Card, GameState, Battlefield, etc.). Infer types from schemas.
- **Testing:** Vitest 4 + React Testing Library + happy-dom, setup `src/test-setup.ts`, alias `@ -> src` and `content-collections -> .content-collections/generated`.
- **Lint/Format:** Biome 2.5 (replaces ESLint/Prettier), `biome.json` — 2 spaces, 100 cols, `organizeImports` on. `bunx tsc --noEmit` is separate from Biome.
- **DB:** Drizzle ORM 0.45 + Neon serverless, config `drizzle.config.ts`, schema `src/db/schema.ts`.

## Project Structure

```
src/
  app/               # Next.js App Router (play, deck-builder, cards/[...slug], classes, tutorial)
  components/        # battlefield/, hand/, player/, effects/, layout/, ui/ (shadcn)
  hooks/             # use_game_actions, use_ai_turn, use_game_clock, use_game_effects, use_game_engine
  lib/               # card_loader.ts, card_orientation.ts, game_logic.ts (produce), ring_buffer.ts, state_utils.ts, game_logger.ts
  services/          # combat_service.ts, card_effect_system.ts, effect_stack_service.ts, game_engine.ts, event_manager.ts, etc.
  store/             # game_store.ts + middleware
  schemas/           # schema.ts (canonical), challenge/quest/stats schemas
  contexts/          # theme
  styles/            # global + animations
  __tests__/         # integration tests
content/
  cards/             # 78 MDX total: major-arcana/ (22) + minor-arcana/{cups,pentacles,swords,wands} (56)
  classes/           # zodiac class guides
```

`@/` → `src/` (see `tsconfig.json` + `vitest.config.ts`).

## Content Collections — Critical

- Defined in `content-collections.ts`: collections `cards`, `zodiacClasses`, `metaGuides`. Reuses Zod enums from `src/schemas/schema.ts`.
- Card frontmatter (`content/cards/**/*.mdx`): `id, name, zodiacClass, element, cardType, cost, attack?, health?, rarity, tarotSymbol, keywords?, description?, reversedDescription?, abilities?, effects?, spellType?` where `abilities/effects` is either `Array<{name,description}>` or `{ upright?: [], reversed?: [] }`. Legacy `spellType: sorcery` maps to `ritual`.
- Transform adds `slug, url, isUnit, isSpell, category, mdx`. `onSuccess` **fails build if card count != 78**.
- Loading: `src/lib/card_loader.ts` imports `allCards` from `content-collections`, maps to `Card` (`uprightAbilities`/`reversedAbilities` via `src/lib/card_orientation.ts`). `GET /api/validate-content` reports schema + reversed-face coverage.
- Commands that touch content must handle MDX regeneration (`.content-collections` is gitignored).

## Architecture Conventions

- **Game mechanics:** 7-slot battlefield (`Battlefield.playerUnits/enemyUnits: (Card|null)[7]`), Hearthstone direct-attack (`DirectAttack` targetType `unit|player`), alternating attack token, spell-mana banking (max 3), phases `mulligan → round_start → action → combat_resolution → end_round`, win = nexus 0 / deck-out / alternative (zodiac/arcana).
- **State mutations:** Always via Zustand store + Immer `produce()`. Services (`src/services/*`) are pure; `src/lib/game_logic.ts` orchestrates with `eventManager` + `phaseManagerService` + `cardEffectSystem`. `GameEngine` (`src/services/game_engine.ts`) is the facade.
- **Battlefield helpers:** `findFirstEmptySlot`, `getPlayerUnits`, etc. in `game_logic.ts` / `battlefield_service.ts` / `combat_service.ts`. `declareAttack` is the combat entry point (with keyword support: divine_shield, lifesteal, poisonous, elemental_fury).
- **Effects:** `effect_stack_service` + `card_effect_system` (registry `effectExecutors`: dealDamage, gainHealth, drawCards, statBuff, … + `ABILITY_PRIORITIES`). `effectExecutors` + `executeEffect`/`updatePersistentEffects` must stay in sync with `TriggeredAbility` schema.
- **Events/History:** `event_manager.ts` + `ring_buffer.ts` (O(1) event history, replaces array). `transaction_manager.ts` / `animation_queue.ts` for rollback + animation sync.
- **Schemas-first:** Never duplicate types — `z.infer<typeof Schema>` from `src/schemas/schema.ts`. Add new enums/variants there and handle exhaustive dispatch in services (sync + async wrappers if needed).
- **File naming:** `snake_case` for files (e.g., `game_logic.ts`, `card_loader.ts`). Do not create a `scripts/` folder.
- **Components:** shadcn/ui + Tailwind, drag-and-drop via `interaction_service.ts` (supports click/drag/hybrid). Keep `src/components/ui` untouched unless extending design system.

## Testing & Quality Gates

- Run `bunx tsc --noEmit` and `bun run lint` before opening a PR. Biome ignores `**/__tests__/**`, `**/*.test.*`, `.content-collections`, `.next`, `node_modules`, `*.d.ts`.
- Vitest excludes `e2e`, `.next`, `coverage`. Coverage `include: src/**/*.{ts,tsx}` excludes `src/app/**`, `src/test-setup.ts`, `src/test_utils.tsx`. Goals: >80% services, >60% components.
- E2E via Playwright (`playwright.config.ts`, `e2e/`). Keep e2e separate from Vitest.

## Gotchas

- `next dev` regenerates the `<!-- BEGIN:nextjs-agent-rules -->` block in this file — do not delete it in a diff; commit it with changes to avoid a lingering unstaged hunk.
- Engine requires Node `26.7.0` (`package.json#engines`). Use `bun` for all installs/runs (repo has `bun.lock`); `npm install` rewrites the lockfile.
- Next.js docs are not at the repo root in monorepos — resolve via `node_modules/next/dist/docs/` from this file's directory.
- `.content-collections` and `.next` are generated — never edit or commit.
- Security headers in `next.config.ts` (`X-Frame-Options`, `X-Content-Type-Options`, etc.) — preserve when editing config.
