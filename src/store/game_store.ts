import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import {
  CellPositionSchema,
  type Card as GameCard,
  type GameState,
  GameStateSchema,
  type CellPosition as ZodCellPosition,
} from '@/schemas/schema'

// Grid positioning types
export const GRID_ROWS = {
  ENEMY_BENCH: 0,
  ENEMY_ATTACK: 1,
  PLAYER_ATTACK: 2,
  PLAYER_BENCH: 3,
} as const

export const GRID_COLS = {
  COL_0: 0,
  COL_1: 1,
  COL_2: 2,
  COL_3: 3,
  COL_4: 4,
  COL_5: 5,
} as const

export type CellPosition = ZodCellPosition

export type CellType = 'enemy_bench' | 'enemy_attack' | 'player_attack' | 'player_bench'

export interface GridState {
  cells: Map<string, GameCard | null> // cellKey -> card
  highlightedCells: Set<string>
  validDropZones: Set<string>
}

export interface AnimationState {
  id: string
  type: 'move' | 'attack' | 'damage' | 'death' | 'draw'
  card?: GameCard
  from?: CellPosition | 'hand' | 'deck'
  to?: CellPosition | 'hand' | 'graveyard' | 'nexus'
  progress: number // 0-1
  duration: number // ms
  startTime: number
}

export interface InteractionState {
  mode: 'click' | 'drag' | 'hybrid'
  selectedCards: Set<string>
  draggedCard: GameCard | null
  dragStartPosition: { x: number; y: number } | null
  hoveredCell: CellPosition | null
  selectedAttackers: Set<string>
  defenderAssignments: Map<number, string> // laneId -> defenderId
}

export interface UIState {
  cardDetailOverlay: GameCard | null
  activeOverlay: 'none' | 'cardDetail' | 'mulligan' | 'gameOutcome'
  overlayData: unknown
  isAnimating: boolean
  performanceMode: 'high' | 'medium' | 'low'
}

export interface GameStore {
  // Core game state
  gameState: GameState

  // Grid battlefield state
  grid: GridState

  // Animation system state
  animations: Map<string, AnimationState>
  animationQueue: string[]

  // Interaction state
  interaction: InteractionState

  // UI state
  ui: UIState

  // Actions
  setGameState: (gameState: GameState) => void

  // Grid actions
  setCellContent: (position: CellPosition, card: GameCard | null) => void
  getCellContent: (position: CellPosition) => GameCard | null
  highlightCells: (positions: CellPosition[]) => void
  clearHighlights: () => void
  setValidDropZones: (positions: CellPosition[]) => void
  clearValidDropZones: () => void

  // Animation actions
  startAnimation: (animation: Omit<AnimationState, 'id' | 'progress' | 'startTime'>) => string
  updateAnimation: (id: string, progress: number) => void
  completeAnimation: (id: string) => void
  clearAnimations: () => void

  // Interaction actions
  setInteractionMode: (mode: 'click' | 'drag' | 'hybrid') => void
  selectCard: (cardId: string) => void
  unselectCard: (cardId: string) => void
  clearSelection: () => void
  startCardDrag: (card: GameCard, position: { x: number; y: number }) => void
  updateDragPosition: (position: { x: number; y: number }) => void
  endCardDrag: () => void
  setHoveredCell: (position: CellPosition | null) => void
  addAttacker: (cardId: string) => void
  removeAttacker: (cardId: string) => void
  clearAttackers: () => void
  assignDefender: (laneId: number, defenderId: string) => void
  removeDefenderAssignment: (laneId: number) => void
  clearDefenderAssignments: () => void

  // UI actions
  showCardDetail: (card: GameCard) => void
  hideCardDetail: () => void
  setOverlay: (overlay: 'none' | 'cardDetail' | 'mulligan' | 'gameOutcome', data?: unknown) => void
  setAnimationState: (isAnimating: boolean) => void
  setPerformanceMode: (mode: 'high' | 'medium' | 'low') => void
}

// Helper to create cell key
export const createCellKey = (position: CellPosition): string => `${position.row}-${position.col}`

// Helper to parse cell key
export const parseCellKey = (cellKey: string): CellPosition => {
  const [row, col] = cellKey.split('-').map(Number)
  const result = CellPositionSchema.safeParse({ row, col })
  if (result.success) {
    return result.data
  }
  // Fallback for invalid positions (should not happen in practice)
  throw new Error(`Invalid cell key: ${cellKey}`)
}

// Helper to get cell type from position
export const getCellType = (position: CellPosition): CellType => {
  switch (position.row) {
    case GRID_ROWS.ENEMY_BENCH:
      return 'enemy_bench'
    case GRID_ROWS.ENEMY_ATTACK:
      return 'enemy_attack'
    case GRID_ROWS.PLAYER_ATTACK:
      return 'player_attack'
    case GRID_ROWS.PLAYER_BENCH:
      return 'player_bench'
  }
}

export const useGameStore = create<GameStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      gameState: null as unknown as GameState, // Will be set by game initialization

      grid: {
        cells: new Map(),
        highlightedCells: new Set(),
        validDropZones: new Set(),
      },

      animations: new Map(),
      animationQueue: [],

      interaction: {
        mode: 'hybrid',
        selectedCards: new Set(),
        draggedCard: null,
        dragStartPosition: null,
        hoveredCell: null,
        selectedAttackers: new Set(),
        defenderAssignments: new Map(),
      },

      ui: {
        cardDetailOverlay: null,
        activeOverlay: 'none',
        overlayData: null,
        isAnimating: false,
        performanceMode: 'high',
      },

      // Core actions
      setGameState: (gameState: GameState) => {
        // Validate gameState with Zod before setting
        const result = GameStateSchema.safeParse(gameState)
        if (result.success) {
          set({ gameState: result.data }, false, 'setGameState')
        } else {
          console.warn('GameState validation warnings:', result.error.errors)
          // In development, allow invalid states but warn about them
          set({ gameState }, false, 'setGameState')
        }
      },

      // Grid actions
      setCellContent: (position: CellPosition, card: GameCard | null) => {
        // Validate position
        const validatedPosition = CellPositionSchema.safeParse(position)
        if (!validatedPosition.success) {
          console.error('Invalid cell position:', position)
          return
        }

        const cellKey = createCellKey(validatedPosition.data)
        set(
          (state: GameStore) => {
            const newCells = new Map(state.grid.cells)
            newCells.set(cellKey, card)
            return {
              grid: { ...state.grid, cells: newCells },
            }
          },
          false,
          'setCellContent',
        )
      },

      getCellContent: (position: CellPosition) => {
        const cellKey = createCellKey(position)
        return get().grid.cells.get(cellKey) || null
      },

      highlightCells: (positions: CellPosition[]) => {
        set(
          (state: GameStore) => ({
            grid: {
              ...state.grid,
              highlightedCells: new Set(positions.map(createCellKey)),
            },
          }),
          false,
          'highlightCells',
        )
      },

      clearHighlights: () => {
        set(
          (state: GameStore) => ({
            grid: { ...state.grid, highlightedCells: new Set() },
          }),
          false,
          'clearHighlights',
        )
      },

      setValidDropZones: (positions: CellPosition[]) => {
        set(
          (state: GameStore) => ({
            grid: {
              ...state.grid,
              validDropZones: new Set(positions.map(createCellKey)),
            },
          }),
          false,
          'setValidDropZones',
        )
      },

      clearValidDropZones: () => {
        set(
          (state: GameStore) => ({
            grid: { ...state.grid, validDropZones: new Set() },
          }),
          false,
          'clearValidDropZones',
        )
      },

      // Animation actions
      startAnimation: (animationData: Omit<AnimationState, 'id' | 'progress' | 'startTime'>) => {
        const id = `anim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const animation: AnimationState = {
          ...animationData,
          id,
          progress: 0,
          startTime: performance.now(),
        }

        set(
          (state: GameStore) => ({
            animations: new Map(state.animations).set(id, animation),
            animationQueue: [...state.animationQueue, id],
          }),
          false,
          'startAnimation',
        )

        return id
      },

      updateAnimation: (id: string, progress: number) => {
        set(
          (state: GameStore) => {
            const newAnimations = new Map(state.animations)
            const animation = newAnimations.get(id)
            if (animation) {
              newAnimations.set(id, { ...animation, progress })
            }
            return { animations: newAnimations }
          },
          false,
          'updateAnimation',
        )
      },

      completeAnimation: (id: string) => {
        set(
          (state: GameStore) => {
            const newAnimations = new Map(state.animations)
            newAnimations.delete(id)
            const newQueue = state.animationQueue.filter((animId: string) => animId !== id)
            return {
              animations: newAnimations,
              animationQueue: newQueue,
            }
          },
          false,
          'completeAnimation',
        )
      },

      clearAnimations: () => {
        set(
          {
            animations: new Map(),
            animationQueue: [],
          },
          false,
          'clearAnimations',
        )
      },

      // Interaction actions
      setInteractionMode: (mode: 'click' | 'drag' | 'hybrid') => {
        set(
          (state: GameStore) => ({
            interaction: { ...state.interaction, mode },
          }),
          false,
          'setInteractionMode',
        )
      },

      selectCard: (cardId: string) => {
        set(
          (state: GameStore) => ({
            interaction: {
              ...state.interaction,
              selectedCards: new Set(state.interaction.selectedCards).add(cardId),
            },
          }),
          false,
          'selectCard',
        )
      },

      unselectCard: (cardId: string) => {
        set(
          (state: GameStore) => {
            const newSelected = new Set(state.interaction.selectedCards)
            newSelected.delete(cardId)
            return {
              interaction: { ...state.interaction, selectedCards: newSelected },
            }
          },
          false,
          'unselectCard',
        )
      },

      clearSelection: () => {
        set(
          (state: GameStore) => ({
            interaction: { ...state.interaction, selectedCards: new Set() },
          }),
          false,
          'clearSelection',
        )
      },

      startCardDrag: (card: GameCard, position: { x: number; y: number }) => {
        set(
          (state: GameStore) => ({
            interaction: {
              ...state.interaction,
              draggedCard: card,
              dragStartPosition: position,
            },
          }),
          false,
          'startCardDrag',
        )
      },

      updateDragPosition: (position: { x: number; y: number }) => {
        set(
          (state: GameStore) => ({
            interaction: {
              ...state.interaction,
              dragStartPosition: position,
            },
          }),
          false,
          'updateDragPosition',
        )
      },

      endCardDrag: () => {
        set(
          (state: GameStore) => ({
            interaction: {
              ...state.interaction,
              draggedCard: null,
              dragStartPosition: null,
            },
          }),
          false,
          'endCardDrag',
        )
      },

      setHoveredCell: (position: CellPosition | null) => {
        set(
          (state: GameStore) => ({
            interaction: { ...state.interaction, hoveredCell: position },
          }),
          false,
          'setHoveredCell',
        )
      },

      addAttacker: (cardId: string) => {
        set(
          (state: GameStore) => ({
            interaction: {
              ...state.interaction,
              selectedAttackers: new Set(state.interaction.selectedAttackers).add(cardId),
            },
          }),
          false,
          'addAttacker',
        )
      },

      removeAttacker: (cardId: string) => {
        set(
          (state: GameStore) => {
            const newAttackers = new Set(state.interaction.selectedAttackers)
            newAttackers.delete(cardId)
            return {
              interaction: { ...state.interaction, selectedAttackers: newAttackers },
            }
          },
          false,
          'removeAttacker',
        )
      },

      clearAttackers: () => {
        set(
          (state: GameStore) => ({
            interaction: { ...state.interaction, selectedAttackers: new Set() },
          }),
          false,
          'clearAttackers',
        )
      },

      assignDefender: (laneId: number, defenderId: string) => {
        set(
          (state: GameStore) => ({
            interaction: {
              ...state.interaction,
              defenderAssignments: new Map(state.interaction.defenderAssignments).set(
                laneId,
                defenderId,
              ),
            },
          }),
          false,
          'assignDefender',
        )
      },

      removeDefenderAssignment: (laneId: number) => {
        set(
          (state: GameStore) => {
            const newAssignments = new Map(state.interaction.defenderAssignments)
            newAssignments.delete(laneId)
            return {
              interaction: { ...state.interaction, defenderAssignments: newAssignments },
            }
          },
          false,
          'removeDefenderAssignment',
        )
      },

      clearDefenderAssignments: () => {
        set(
          (state: GameStore) => ({
            interaction: { ...state.interaction, defenderAssignments: new Map() },
          }),
          false,
          'clearDefenderAssignments',
        )
      },

      // UI actions
      showCardDetail: (card: GameCard) => {
        set(
          {
            ui: { ...get().ui, cardDetailOverlay: card, activeOverlay: 'cardDetail' },
          },
          false,
          'showCardDetail',
        )
      },

      hideCardDetail: () => {
        set(
          (state: GameStore) => ({
            ui: { ...state.ui, cardDetailOverlay: null, activeOverlay: 'none' },
          }),
          false,
          'hideCardDetail',
        )
      },

      setOverlay: (
        overlay: 'none' | 'cardDetail' | 'mulligan' | 'gameOutcome',
        data: unknown = null,
      ) => {
        set(
          (state: GameStore) => ({
            ui: { ...state.ui, activeOverlay: overlay, overlayData: data },
          }),
          false,
          'setOverlay',
        )
      },

      setAnimationState: (isAnimating: boolean) => {
        set(
          (state: GameStore) => ({
            ui: { ...state.ui, isAnimating },
          }),
          false,
          'setAnimationState',
        )
      },

      setPerformanceMode: (mode: 'high' | 'medium' | 'low') => {
        set(
          (state: GameStore) => ({
            ui: { ...state.ui, performanceMode: mode },
          }),
          false,
          'setPerformanceMode',
        )
      },
    }),
    {
      name: 'tarot-game-store',
      partialize: (state: GameStore) => ({
        // Only persist UI preferences, not game state
        ui: {
          performanceMode: state.ui.performanceMode,
        },
        interaction: {
          mode: state.interaction.mode,
        },
      }),
    },
  ),
)
