import { GameLogger } from '@/lib/game_logger'
// Feature flags for safe incremental refactoring
// These flags allow us to gradually transition from dual-state to single-state architecture

export const FEATURE_FLAGS = {
  // Core refactor flags
  USE_BATTLEFIELD_ONLY: true,
  ENABLE_DEFENSE_PHASE: false,
  USE_DIRECT_ATTACKS: true,

  // Multiplayer flags
  ENABLE_WEBSOCKETS: true,
  ENABLE_MULTIPLAYER_SYNC: true,

  // Game mode flags
  ENABLE_ROGUELITE_MODE: false,

  // Development flags
  DEBUG_STATE_TRANSITIONS: true,
  LOG_COMPATIBILITY_WARNINGS: true,

  // Performance flags
  ENABLE_OPTIMISTIC_UPDATES: false, // For multiplayer
  USE_STATE_MIGRATION: true,
} as const

// Type safety for feature flags
export type FeatureFlag = keyof typeof FEATURE_FLAGS

// Helper to check if a feature is enabled
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURE_FLAGS[flag]
}

// Helper to warn about deprecated features
export function warnDeprecated(featureName: string, replacement?: string): void {
  if (FEATURE_FLAGS.LOG_COMPATIBILITY_WARNINGS) {
    GameLogger.warn(
      `[DEPRECATED] ${featureName} is deprecated.${replacement ? ` Use ${replacement} instead.` : ''}`,
    )
  }
}

// Configuration validation
export function validateFeatureFlags(): void {
  // Ensure direct attacks are enabled if defense phase is disabled
  if (!FEATURE_FLAGS.ENABLE_DEFENSE_PHASE && !FEATURE_FLAGS.USE_DIRECT_ATTACKS) {
    throw new Error('Direct attacks must be enabled if defense phase is disabled')
  }

  // Ensure battlefield-only mode is compatible with other settings
  if (FEATURE_FLAGS.USE_BATTLEFIELD_ONLY && FEATURE_FLAGS.ENABLE_DEFENSE_PHASE) {
    GameLogger.warn('[WARNING] Battlefield-only mode with defense phase may cause conflicts')
  }
}

// Initialize feature flags (call at startup)
validateFeatureFlags()
