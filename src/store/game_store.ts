import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { type Card as GameCard, type GameState, GameStateSchema } from '@/schemas/schema'
import type { Battlefield, BattlefieldPosition } from '@/services/battlefield_service'

export interface InteractionState {
  mode: 'click' | 'drag' | 'hybrid'
  selectedCards: Set<string>
  draggedCard: GameCard | null
  dragStartPosition: { x: number; y: number } | null
  hoveredSlot: BattlefieldPosition | null
  selectedAttackers: Set<string>
  defenderAssignments: Map<string, string>  // Legacy for compatibility
  targetingMode: boolean
  validTargets: Set<string>
}

export interface UIState {
  cardDetailOverlay: GameCard | null
  activeOverlay: 'none' | 'cardDetail' | 'mulligan' | 'gameOutcome'
  isAnimating: boolean
  performanceMode: 'high' | 'medium' | 'low'
}

export interface GameStore {
  // Core game state - single source of truth
  gameState: GameState

  // UI interaction state
  interaction: InteractionState
  ui: UIState

  // Battlefield visual state
  highlightedSlots: Set<string>
  validDropZones: Set<string>

  // Core actions
  setGameState: (gameState: GameState) => void
  updateBattlefield: (battlefield: Battlefield) => void

  // Interaction actions
  selectCard: (cardId: string) => void
  unselectCard: (cardId: string) => void
  clearSelection: () => void
  startCardDrag: (card: GameCard, position: { x: number; y: number }) => void
  endCardDrag: () => void
  setHoveredSlot: (position: BattlefieldPosition | null) => void
  addAttacker: (cardId: string) => void
  clearAttackers: () => void

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
          bench: [],
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
          bench: [],
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
        selectedCards: new Set(),
        draggedCard: null,
        dragStartPosition: null,
        hoveredSlot: null,
        selectedAttackers: new Set(),
        defenderAssignments: new Map(),
        targetingMode: false,
        validTargets: new Set(),
      },

      ui: {
        cardDetailOverlay: null,
        activeOverlay: 'none',
        isAnimating: false,
        performanceMode: 'high',
      },

      highlightedSlots: new Set(),
      validDropZones: new Set(),

      // Actions
      setGameState: gameState => {
        console.log(`🏪 [GameStore] setGameState called`)
        console.log(`🏪 [GameStore] Player units:`, gameState.battlefield.playerUnits.filter(u => u !== null).map(u => u?.name))
        console.log(`🏪 [GameStore] Enemy units:`, gameState.battlefield.enemyUnits.filter(u => u !== null).map(u => u?.name))
        set({ gameState })
      },

      updateBattlefield: battlefield => {
        console.log(`🏪 [GameStore] updateBattlefield called`)
        console.log(`🏪 [GameStore] Player units:`, battlefield.playerUnits.filter(u => u !== null).map(u => u?.name))
        console.log(`🏪 [GameStore] Enemy units:`, battlefield.enemyUnits.filter(u => u !== null).map(u => u?.name))
        set(state => ({
          gameState: { ...state.gameState, battlefield }
        }))
      },

      selectCard: cardId =>
        set(state => ({
          interaction: {
            ...state.interaction,
            selectedCards: new Set([...state.interaction.selectedCards, cardId]),
          },
        })),

      unselectCard: cardId =>
        set(state => {
          const newSelectedCards = new Set(state.interaction.selectedCards)
          newSelectedCards.delete(cardId)
          return {
            interaction: {
              ...state.interaction,
              selectedCards: newSelectedCards,
            },
          }
        }),

      clearSelection: () =>
        set(state => ({
          interaction: {
            ...state.interaction,
            selectedCards: new Set(),
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

      addAttacker: cardId =>
        set(state => ({
          interaction: {
            ...state.interaction,
            selectedAttackers: new Set([...state.interaction.selectedAttackers, cardId]),
          },
        })),

      clearAttackers: () =>
        set(state => ({
          interaction: {
            ...state.interaction,
            selectedAttackers: new Set(),
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
    }
  )
)