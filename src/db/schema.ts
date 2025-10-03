import { pgTable, serial, text, timestamp, jsonb, varchar, integer, boolean } from 'drizzle-orm/pg-core';

/**
 * Database schema for Tarot TCG
 * 
 * Tables:
 * - game_states: Stores complete game state snapshots
 * - game_sessions: Tracks active/completed games
 * - player_profiles: User profiles and stats
 */

// Game Sessions - tracks metadata for each game
export const gameSessions = pgTable('game_sessions', {
    id: varchar('id', { length: 36 }).primaryKey(), // UUID
    player1Id: varchar('player1_id', { length: 36 }).notNull(),
    player2Id: varchar('player2_id', { length: 36 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('active'), // active, completed, abandoned
    winner: varchar('winner', { length: 36 }), // player ID of winner, null if no winner yet
    startedAt: timestamp('started_at').notNull().defaultNow(),
    completedAt: timestamp('completed_at'),
    turnCount: integer('turn_count').notNull().default(0),
    roundCount: integer('round_count').notNull().default(0),
});

// Game States - stores complete game state snapshots
export const gameStates = pgTable('game_states', {
    id: serial('id').primaryKey(),
    sessionId: varchar('session_id', { length: 36 }).notNull().references(() => gameSessions.id, { onDelete: 'cascade' }),
    state: jsonb('state').notNull(), // Complete GameState object
    turn: integer('turn').notNull(),
    round: integer('round').notNull(),
    phase: varchar('phase', { length: 30 }).notNull(),
    activePlayer: varchar('active_player', { length: 36 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Player Profiles - user stats and preferences
export const playerProfiles = pgTable('player_profiles', {
    id: varchar('id', { length: 36 }).primaryKey(), // UUID
    name: varchar('name', { length: 100 }).notNull(),
    email: varchar('email', { length: 255 }).unique(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    lastActive: timestamp('last_active').notNull().defaultNow(),

    // Stats
    gamesPlayed: integer('games_played').notNull().default(0),
    gamesWon: integer('games_won').notNull().default(0),
    gamesLost: integer('games_lost').notNull().default(0),

    // Preferences
    favoriteZodiacClass: varchar('favorite_zodiac_class', { length: 20 }),
    settings: jsonb('settings').default({}), // User preferences like theme, sound, etc.
});

// Type inference for TypeScript
export type GameSession = typeof gameSessions.$inferSelect;
export type NewGameSession = typeof gameSessions.$inferInsert;

export type GameState = typeof gameStates.$inferSelect;
export type NewGameState = typeof gameStates.$inferInsert;

export type PlayerProfile = typeof playerProfiles.$inferSelect;
export type NewPlayerProfile = typeof playerProfiles.$inferInsert;

