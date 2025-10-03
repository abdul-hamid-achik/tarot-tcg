import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { GameLogger } from '@/lib/game_logger'
import { type Card as GameCard, type GameState, GameStateSchema } from '@/schemas/schema'
import type { Battlefield, BattlefieldPosition } from '@/services/battlefield_service'

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

  // Interaction actions
  selectCard: (card: GameCard) => void
  clearSelection: () => void
  startCardDrag: (card: GameCard, position: { x: number; y: number }) => void
  endCardDrag: () => void
  setHoveredSlot: (position: BattlefieldPosition | null) => void

  // Direct attack actions
  startAttack: (unitId: string) => void
  executeAttack: (targetId: string, targetType: 'unit' | 'player') => void
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
}

// Helper to create slot key
export const createSlotKey = (position: BattlefieldPosition): string =>
  `${position.player}-${position.slot}`

// Helper to calculate valid attack targets
function calculateValidTargets(gameState: GameState, _attackerId: string): Set<string> {
  // Simple implementation - would be expanded for real game logic
  const validTargets = new Set<string>()

  // Add enemy units as valid targets
  const opponent = gameState.activePlayer === 'player1' ? 'player2' : 'player1'
  const enemyUnits =
    opponent === 'player1' ? gameState.battlefield.playerUnits : gameState.battlefield.enemyUnits

  enemyUnits.forEach(unit => {
    if (unit) {
      validTargets.add(unit.id)
    }
  })

  // Add player as valid target (unless taunt units present)
  validTargets.add(opponent)

  return validTargets
}

export const useGameStore = create<GameStore>()(
  devtools(
    (set, get) => ({
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
        GameLogger.debug(`🏪 [GameStore] setGameState called`)
        GameLogger.debug(
          `🏪 [GameStore] Player units:`,
          gameState.battlefield.playerUnits.filter(u => u !== null).map(u => u?.name),
        )
        GameLogger.debug(
          `🏪 [GameStore] Enemy units:`,
          gameState.battlefield.enemyUnits.filter(u => u !== null).map(u => u?.name),
        )
        set({ gameState })
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
        set(state => ({
          gameState: { ...state.gameState, battlefield },
        }))
      },

      selectCard: card =>
        set(state => ({
          interaction: {
            ...state.interaction,
            selectedCard: card,
          },
        })),

      clearSelection: () =>
        set(state => ({
          interaction: {
            ...state.interaction,
            selectedCard: null,
            attackSource: null,
            targetingMode: 'none',
            validAttackTargets: new Set(),
          },
        })),

      startCardDrag: (card, position) =>
        set(state => ({
          interaction: {
            ...state.interaction,
            draggedCard: card,
            dragStartPosition: position,
          },
        })),

      endCardDrag: () =>
        set(state => ({
          interaction: {
            ...state.interaction,
            draggedCard: null,
            dragStartPosition: null,
          },
        })),

      setHoveredSlot: position =>
        set(state => ({
          interaction: {
            ...state.interaction,
            hoveredSlot: position,
          },
        })),

      // Direct attack actions
      startAttack: (unitId: string) =>
        set(state => ({
          interaction: {
            ...state.interaction,
            attackSource: unitId,
            targetingMode: 'attack',
            validAttackTargets: calculateValidTargets(state.gameState, unitId),
          },
        })),

      executeAttack: async (_targetId: string, _targetType: 'unit' | 'player') => {
        const { gameState, interaction } = get()
        if (!interaction.attackSource) return

        // This would integrate with the game logic
        // const newState = await declareAttack(gameState, {
        //   attackerId: interaction.attackSource,
        //   targetType,
        //   targetId
        // })

        set(state => ({
          interaction: {
            ...state.interaction,
            attackSource: null,
            targetingMode: 'none',
            validAttackTargets: new Set(),
          },
        }))
      },

      cancelAttack: () =>
        set(state => ({
          interaction: {
            ...state.interaction,
            attackSource: null,
            targetingMode: 'none',
            validAttackTargets: new Set(),
          },
        })),

      highlightSlots: positions =>
        set({
          highlightedSlots: new Set(positions.map(createSlotKey)),
        }),

      clearHighlights: () =>
        set({
          highlightedSlots: new Set(),
        }),

      setValidDropZones: positions =>
        set({
          validDropZones: new Set(positions.map(createSlotKey)),
        }),

      clearValidDropZones: () =>
        set({
          validDropZones: new Set(),
        }),

      showCardDetail: card =>
        set(state => ({
          ui: { ...state.ui, cardDetailOverlay: card, activeOverlay: 'cardDetail' },
        })),

      hideCardDetail: () =>
        set(state => ({
          ui: { ...state.ui, cardDetailOverlay: null, activeOverlay: 'none' },
        })),

      setAnimationState: isAnimating =>
        set(state => ({
          ui: { ...state.ui, isAnimating },
        })),
    }),
    {
      name: 'tarot-tcg-store',
    },
  ),
)
