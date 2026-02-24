import { db, schema } from '@/db';
import type { GameState as AppGameState } from '@/schemas/schema';
import { eq, desc } from 'drizzle-orm';
import { GameLogger } from '@/lib/game_logger';

/**
 * Persistence Service - P3-1 Implementation
 * 
 * Handles saving and loading game states to/from the database.
 * Provides game session management and player profile tracking.
 */
export class PersistenceService {
    /**
     * Create a new game session
     */
    async createGameSession(player1Id: string, player2Id: string): Promise<string> {
        try {
            const sessionId = crypto.randomUUID();

            await db.insert(schema.gameSessions).values({
                id: sessionId,
                player1Id,
                player2Id,
                status: 'active',
                turnCount: 0,
                roundCount: 0,
            });

            GameLogger.system(`Created game session: ${sessionId}`);
            return sessionId;
        } catch (error) {
            GameLogger.error('Failed to create game session:', error);
            throw error;
        }
    }

    /**
     * Save game state snapshot
     */
    async saveGameState(sessionId: string, gameState: AppGameState): Promise<void> {
        try {
            await db.insert(schema.gameStates).values({
                sessionId,
                state: gameState as unknown as Record<string, unknown>, // Store complete game state as JSONB
                turn: gameState.turn,
                round: gameState.round,
                phase: gameState.phase,
                activePlayer: gameState.activePlayer,
            });

            GameLogger.debug(`Saved game state for session ${sessionId} (Turn ${gameState.turn}, Round ${gameState.round})`);
        } catch (error) {
            GameLogger.error('Failed to save game state:', error);
            throw error;
        }
    }

    /**
     * Load most recent game state for a session
     */
    async loadGameState(sessionId: string): Promise<AppGameState | null> {
        try {
            const [latestState] = await db
                .select()
                .from(schema.gameStates)
                .where(eq(schema.gameStates.sessionId, sessionId))
                .orderBy(desc(schema.gameStates.createdAt))
                .limit(1);

            if (!latestState) {
                GameLogger.warn(`No game state found for session ${sessionId}`);
                return null;
            }

            GameLogger.debug(`Loaded game state for session ${sessionId} (Turn ${latestState.turn}, Round ${latestState.round})`);
            return latestState.state as AppGameState;
        } catch (error) {
            GameLogger.error('Failed to load game state:', error);
            throw error;
        }
    }

    /**
     * Complete a game session and update stats
     */
    async completeGameSession(
        sessionId: string,
        winnerId: string | null,
        finalState: AppGameState
    ): Promise<void> {
        try {
            // Update session status
            await db
                .update(schema.gameSessions)
                .set({
                    status: 'completed',
                    winner: winnerId,
                    completedAt: new Date(),
                    turnCount: finalState.turn,
                    roundCount: finalState.round,
                })
                .where(eq(schema.gameSessions.id, sessionId));

            // Update player stats if there's a winner
            if (winnerId) {
                await this.updatePlayerStats(sessionId, winnerId);
            }

            GameLogger.system(`Completed game session: ${sessionId}, Winner: ${winnerId || 'None'}`);
        } catch (error) {
            GameLogger.error('Failed to complete game session:', error);
            throw error;
        }
    }

    /**
     * Update player statistics after a game
     */
    private async updatePlayerStats(sessionId: string, winnerId: string): Promise<void> {
        try {
            // Get session details
            const [session] = await db
                .select()
                .from(schema.gameSessions)
                .where(eq(schema.gameSessions.id, sessionId))
                .limit(1);

            if (!session) return;

      // Get current stats for winner
      const [winner] = await db
        .select()
        .from(schema.playerProfiles)
        .where(eq(schema.playerProfiles.id, winnerId))
        .limit(1);

      // Update winner stats
      if (winner) {
        await db
          .update(schema.playerProfiles)
          .set({
            gamesPlayed: winner.gamesPlayed + 1,
            gamesWon: winner.gamesWon + 1,
            lastActive: new Date(),
          })
          .where(eq(schema.playerProfiles.id, winnerId));
      }

      // Get and update loser stats
      const loserId = winnerId === session.player1Id ? session.player2Id : session.player1Id;
      const [loser] = await db
        .select()
        .from(schema.playerProfiles)
        .where(eq(schema.playerProfiles.id, loserId))
        .limit(1);

      if (loser) {
        await db
          .update(schema.playerProfiles)
          .set({
            gamesPlayed: loser.gamesPlayed + 1,
            gamesLost: loser.gamesLost + 1,
            lastActive: new Date(),
          })
          .where(eq(schema.playerProfiles.id, loserId));
      }

            GameLogger.debug(`Updated player stats for session ${sessionId}`);
        } catch (error) {
            GameLogger.error('Failed to update player stats:', error);
            // Don't throw - stats update failure shouldn't block game completion
        }
    }

    /**
     * Get or create player profile
     */
    async getOrCreatePlayer(id: string, name: string, email?: string): Promise<schema.PlayerProfile> {
        try {
            // Try to find existing player
            const [existingPlayer] = await db
                .select()
                .from(schema.playerProfiles)
                .where(eq(schema.playerProfiles.id, id))
                .limit(1);

            if (existingPlayer) {
                return existingPlayer;
            }

            // Create new player
            const [newPlayer] = await db
                .insert(schema.playerProfiles)
                .values({
                    id,
                    name,
                    email: email || null,
                })
                .returning();

            GameLogger.system(`Created player profile: ${name} (${id})`);
            return newPlayer;
        } catch (error) {
            GameLogger.error('Failed to get/create player:', error);
            throw error;
        }
    }

  /**
   * Get game history for a player
   */
  async getPlayerGameHistory(playerId: string, limit: number = 10) {
    try {
      const games = await db
        .select()
        .from(schema.gameSessions)
        .where(
          // @ts-expect-error - Drizzle SQL operator
          db.or(
            eq(schema.gameSessions.player1Id, playerId),
            eq(schema.gameSessions.player2Id, playerId)
          )
        )
        .orderBy(desc(schema.gameSessions.startedAt))
        .limit(limit);

      // Map to include calculated fields
      return games.map(game => ({
        ...game,
        won: game.winner === playerId,
        opponentId: game.player1Id === playerId ? game.player2Id : game.player1Id,
      }));
    } catch (error) {
      GameLogger.error('Failed to load game history:', error);
      throw error;
    }
  }
}

// Singleton instance
export const persistenceService = new PersistenceService();

