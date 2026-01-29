import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { GameLogger } from '@/lib/game_logger'
import { type Card as GameCard, type GameState, GameStateSchema } from '@/schemas/schema'
import type { Battlefield, BattlefieldPosition } from '@/services/battlefield_service'
import { declareAttack } from '@/services/combat_service'

export interface InteractionState {
  mode: 'click' | 'drag' | 'hybrid'
  selectedCard: GameCard | null // Single selection for direct attacks
  draggedCard: GameCard | null
  dragStartPosition: { x: number; y: number } | null
  hoveredSlot: BattlefieldPosition | null
  attackSource: string | null // Unit starting attack
  validAttackTargets: Set<string> // Valid targets for current attack
  targetingMode: 'none' | 'attack' | 'spell'
}

export interface UIState {
  cardDetailOverlay: GameCard | null
  activeOverlay: 'none' | 'cardDetail' | 'mulligan' | 'gameOutcome'
  isAnimating: boolean
  performanceMode: 'high' | 'medium' | 'low'
  errorMessage: string | null
}

// Multiplayer state for future PVP implementation
export interface MultiplayerState {
  sessionId: string | null
  playerId: 'player1' | 'player2' | null
  connectionStatus: 'disconnected' | 'connecting' | 'connected'
  lastSyncVersion: number
}

export interface GameStore {
  // Core game state - single source of truth
  gameState: GameState

  // UI interaction state
  interaction: InteractionState
  ui: UIState

  // Multiplayer state (for future PVP)
  multiplayer: MultiplayerState

  // Battlefield visual state
  highlightedSlots: Set<string>
  validDropZones: Set<string>

  // Core actions
  setGameState: (gameState: GameState) => void
  updateBattlefield: (battlefield: Battlefield) => void
  updateMultiplayerState: (update: Partial<MultiplayerState>) => void

  // Interaction actions
  selectCard: (card: GameCard) => void
  clearSelection: () => void
  startCardDrag: (card: GameCard, position: { x: number; y: number }) => void
  endCardDrag: () => void
  setHoveredSlot: (position: BattlefieldPosition | null) => void

  // Direct attack actions
  startAttack: (unitId: string) => void
  executeAttack: (targetId: string, targetType: 'unit' | 'player') => Promise<void>
  cancelAttack: () => void

  // Visual feedback
  highlightSlots: (positions: BattlefieldPosition[]) => void
  clearHighlights: () => void
  setValidDropZones: (positions: BattlefieldPosition[]) => void
  clearValidDropZones: () => void

  // UI actions
  showCardDetail: (card: GameCard) => void
  hideCardDetail: () => void
  setAnimationState: (isAnimating: boolean) => void
  showError: (message: string) => void
  clearError: () => void
}

// Helper to create slot key
export const createSlotKey = (position: BattlefieldPosition): string =>
  `${position.player}-${position.slot}`

// Helper to calculate valid attack targets with taunt awareness
function calculateValidTargets(gameState: GameState, _attackerId: string): Set<string> {
  const validTargets = new Set<string>()

  // Determine opponent
  const opponent = gameState.activePlayer === 'player1' ? 'player2' : 'player1'
  const enemyUnits =
    opponent === 'player1' ? gameState.battlefield.playerUnits : gameState.battlefield.enemyUnits

  // Check for taunt units
  const tauntUnits = enemyUnits.filter(
    unit => unit?.keywords?.includes('taunt') || unit?.keywords?.includes('Taunt'),
  )

  if (tauntUnits.length > 0) {
    // Only taunt units can be targeted
    tauntUnits.forEach(unit => {
      if (unit) validTargets.add(unit.id)
    })
  } else {
    // All enemy units and player can be targeted
    enemyUnits.forEach(unit => {
      if (unit) validTargets.add(unit.id)
    })
    validTargets.add(opponent)
  }

  return validTargets
}

// Validate GameState before setting it
function validateAndLogState(gameState: GameState, action: string): boolean {
  const result = GameStateSchema.safeParse(gameState)
  if (!result.success) {
    GameLogger.error(`Invalid GameState in ${action}:`, {
      errors: result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`),
    })
    return false
  }
  return true
}

export const useGameStore = create<GameStore>()(
  devtools(
    immer((set, get) => ({
      // Initial state
      gameState: GameStateSchema.parse({
        round: 1,
        turn: 1,
        activePlayer: 'player1',
        attackingPlayer: null,
        player1: {
          id: 'player1',
          name: 'Player 1',
          health: 20,
          mana: 1,
          maxMana: 1,
          spellMana: 0,
          hand: [],
          deck: [],
          hasAttackToken: true,
          mulliganComplete: false,
          selectedForMulligan: [],
          hasPassed: false,
          actionsThisTurn: 0,
        },
        player2: {
          id: 'player2',
          name: 'Player 2',
          health: 20,
          mana: 1,
          maxMana: 1,
          spellMana: 0,
          hand: [],
          deck: [],
          hasAttackToken: false,
          mulliganComplete: false,
          selectedForMulligan: [],
          hasPassed: false,
          actionsThisTurn: 0,
        },
        battlefield: {
          playerUnits: Array(7).fill(null),
          enemyUnits: Array(7).fill(null),
          maxSlots: 7,
        },
        phase: 'mulligan',
        waitingForAction: false,
        combatResolved: false,
        passCount: 0,
      }),

      interaction: {
        mode: 'hybrid',
        selectedCard: null,
        draggedCard: null,
        dragStartPosition: null,
        hoveredSlot: null,
        attackSource: null,
        validAttackTargets: new Set(),
        targetingMode: 'none',
      },

      ui: {
        cardDetailOverlay: null,
        activeOverlay: 'none',
        isAnimating: false,
        performanceMode: 'high',
        errorMessage: null,
      },

      multiplayer: {
        sessionId: null,
        playerId: null,
        connectionStatus: 'disconnected',
        lastSyncVersion: 0,
      },

      highlightedSlots: new Set(),
      validDropZones: new Set(),

      // Actions
      setGameState: gameState => {
        // Validate before setting
        if (!validateAndLogState(gameState, 'setGameState')) {
          return
        }

        GameLogger.debug(`🏪 [GameStore] setGameState called`)
        GameLogger.debug(
          `🏪 [GameStore] Player units:`,
          gameState.battlefield.playerUnits.filter(u => u !== null).map(u => u?.name),
        )
        GameLogger.debug(
          `🏪 [GameStore] Enemy units:`,
          gameState.battlefield.enemyUnits.filter(u => u !== null).map(u => u?.name),
        )
        set(state => {
          state.gameState = gameState
        })
      },

      updateBattlefield: battlefield => {
        GameLogger.debug(`🏪 [GameStore] updateBattlefield called`)
        GameLogger.debug(
          `🏪 [GameStore] Player units:`,
          battlefield.playerUnits.filter(u => u !== null).map(u => u?.name),
        )
        GameLogger.debug(
          `🏪 [GameStore] Enemy units:`,
          battlefield.enemyUnits.filter(u => u !== null).map(u => u?.name),
        )
        set(state => {
          state.gameState.battlefield = battlefield
        })
      },

      updateMultiplayerState: update => {
        set(state => {
          Object.assign(state.multiplayer, update)
        })
      },

      selectCard: card =>
        set(state => {
          state.interaction.selectedCard = card
        }),

      clearSelection: () =>
        set(state => {
          state.interaction.selectedCard = null
          state.interaction.draggedCard = null
          state.interaction.dragStartPosition = null
          state.interaction.attackSource = null
          state.interaction.targetingMode = 'none'
          state.interaction.validAttackTargets = new Set()
        }),

      startCardDrag: (card, position) =>
        set(state => {
          state.interaction.draggedCard = card
          state.interaction.dragStartPosition = position
        }),

      endCardDrag: () =>
        set(state => {
          state.interaction.draggedCard = null
          state.interaction.dragStartPosition = null
        }),

      setHoveredSlot: position =>
        set(state => {
          state.interaction.hoveredSlot = position
        }),

      // Direct attack actions
      startAttack: (unitId: string) =>
        set(state => {
          state.interaction.attackSource = unitId
          state.interaction.targetingMode = 'attack'
          state.interaction.validAttackTargets = calculateValidTargets(state.gameState, unitId)
        }),

      executeAttack: async (targetId: string, targetType: 'unit' | 'player') => {
        const { gameState, interaction } = get()
        if (!interaction.attackSource) return

        try {
          // Call the combat logic to process the attack
          const newState = await declareAttack(gameState, {
            attackerId: interaction.attackSource,
            targetType,
            targetId: targetType === 'unit' ? targetId : undefined,
          })

          // Update both game state and clear interaction state
          set(state => {
            state.gameState = newState
            state.interaction.attackSource = null
            state.interaction.targetingMode = 'none'
            state.interaction.validAttackTargets = new Set()
          })
        } catch (error) {
          GameLogger.error('Attack failed:', error)
          // Show error to user
          get().showError(error instanceof Error ? error.message : 'Attack failed')

          // Clear attack state even on error
          set(state => {
            state.interaction.attackSource = null
            state.interaction.targetingMode = 'none'
            state.interaction.validAttackTargets = new Set()
          })
        }
      },

      cancelAttack: () =>
        set(state => {
          state.interaction.attackSource = null
          state.interaction.targetingMode = 'none'
          state.interaction.validAttackTargets = new Set()
        }),

      highlightSlots: positions =>
        set(state => {
          state.highlightedSlots = new Set(positions.map(createSlotKey))
        }),

      clearHighlights: () =>
        set(state => {
          state.highlightedSlots = new Set()
        }),

      setValidDropZones: positions =>
        set(state => {
          state.validDropZones = new Set(positions.map(createSlotKey))
        }),

      clearValidDropZones: () =>
        set(state => {
          state.validDropZones = new Set()
        }),

      showCardDetail: card =>
        set(state => {
          state.ui.cardDetailOverlay = card
          state.ui.activeOverlay = 'cardDetail'
        }),

      hideCardDetail: () =>
        set(state => {
          state.ui.cardDetailOverlay = null
          state.ui.activeOverlay = 'none'
        }),

      setAnimationState: isAnimating =>
        set(state => {
          state.ui.isAnimating = isAnimating
        }),

      showError: message => {
        set(state => {
          state.ui.errorMessage = message
        })
        // Auto-clear error after 3 seconds
        setTimeout(() => {
          set(state => {
            state.ui.errorMessage = null
          })
        }, 3000)
      },

      clearError: () =>
        set(state => {
          state.ui.errorMessage = null
        }),
    })),
    {
      name: 'tarot-tcg-store',
    },
  ),
)
