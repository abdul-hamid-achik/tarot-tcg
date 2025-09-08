import type { CellPosition, CellType } from '@/store/gameStore'
import type { Card as GameCard, GameState } from '@/types/game'
import { gridMathService } from './GridMathService'

export interface MoveValidationResult {
  valid: boolean
  reason?: string
  cost?: number // Mana or other resources required
}

export interface GridMovement {
  card: GameCard
  from: CellPosition | 'hand'
  to: CellPosition
  cost: number
}

export class GridManagerService {
  private gridState = new Map<string, GameCard>()

  /**
   * Initialize grid from game state
   */
  initializeFromGameState(gameState: GameState): void {
    this.gridState.clear()

    // Map player1 bench to player bench positions (row 3)
    gameState.player1.bench.forEach((unit, index) => {
      if (index < 6) {
        const position: CellPosition = { row: 3, col: index as 0 | 1 | 2 | 3 | 4 | 5 }
        this.gridState.set(this.createCellKey(position), unit)
      }
    })

    // Map player2 bench to enemy bench positions (row 0)
    gameState.player2.bench.forEach((unit, index) => {
      if (index < 6) {
        const position: CellPosition = { row: 0, col: index as 0 | 1 | 2 | 3 | 4 | 5 }
        this.gridState.set(this.createCellKey(position), unit)
      }
    })

    // Map attack lanes to grid positions
    gameState.lanes.forEach((lane, index) => {
      if (index < 6) {
        // Player attacks in row 2
        if (lane.attacker) {
          const playerAttackPos: CellPosition = { row: 2, col: index as 0 | 1 | 2 | 3 | 4 | 5 }
          this.gridState.set(this.createCellKey(playerAttackPos), lane.attacker)
        }

        // Enemy attacks in row 1 
        if (lane.defender) {
          const enemyAttackPos: CellPosition = { row: 1, col: index as 0 | 1 | 2 | 3 | 4 | 5 }
          this.gridState.set(this.createCellKey(enemyAttackPos), lane.defender)
        }
      }
    })
  }

  /**
   * Get card at specific position
   */
  getCellContent(position: CellPosition): GameCard | null {
    return this.gridState.get(this.createCellKey(position)) || null
  }

  /**
   * Set card at specific position
   */
  setCellContent(position: CellPosition, card: GameCard | null): void {
    const key = this.createCellKey(position)
    if (card === null) {
      this.gridState.delete(key)
    } else {
      this.gridState.set(key, card)
    }
  }

  /**
   * Check if a move is valid
   */
  validateMove(card: GameCard, from: CellPosition | 'hand', to: CellPosition, gameState: GameState): MoveValidationResult {
    // Check if target cell is occupied
    if (this.getCellContent(to) !== null) {
      return { valid: false, reason: 'Target cell is occupied' }
    }

    // Check if position is valid
    if (!gridMathService.isValidPosition(to)) {
      return { valid: false, reason: 'Invalid position' }
    }

    const toType = gridMathService.getCellType(to)
    
    // From hand validations
    if (from === 'hand') {
      return this.validateHandToGridMove(card, to, toType, gameState)
    }

    // From grid to grid validations
    const fromType = gridMathService.getCellType(from)
    return this.validateGridToGridMove(card, fromType, toType, gameState)
  }

  /**
   * Get valid drop zones for a card being dragged
   */
  getValidDropZones(card: GameCard, from: CellPosition | 'hand', gameState: GameState): CellPosition[] {
    const validPositions: CellPosition[] = []

    // Check all grid positions
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 6; col++) {
        const position: CellPosition = { row: row as 0 | 1 | 2 | 3, col: col as 0 | 1 | 2 | 3 | 4 | 5 }
        const validation = this.validateMove(card, from, position, gameState)
        if (validation.valid) {
          validPositions.push(position)
        }
      }
    }

    return validPositions
  }

  /**
   * Execute a move
   */
  executeMove(movement: GridMovement): void {
    // Remove from source
    if (movement.from !== 'hand') {
      this.setCellContent(movement.from, null)
    }

    // Place at destination
    this.setCellContent(movement.to, movement.card)
  }

  /**
   * Get all units in a specific row
   */
  getRowUnits(row: 0 | 1 | 2 | 3): { position: CellPosition; card: GameCard }[] {
    const units: { position: CellPosition; card: GameCard }[] = []

    for (let col = 0; col < 6; col++) {
      const position: CellPosition = { row, col: col as 0 | 1 | 2 | 3 | 4 | 5 }
      const card = this.getCellContent(position)
      if (card) {
        units.push({ position, card })
      }
    }

    return units
  }

  /**
   * Get all units in a specific column
   */
  getColumnUnits(col: number): { position: CellPosition; card: GameCard }[] {
    const units: { position: CellPosition; card: GameCard }[] = []

    for (let row = 0; row < 4; row++) {
      const position: CellPosition = { row: row as 0 | 1 | 2 | 3, col: col as 0 | 1 | 2 | 3 | 4 | 5 }
      const card = this.getCellContent(position)
      if (card) {
        units.push({ position, card })
      }
    }

    return units
  }

  /**
   * Get attacking units (player row 2, enemy row 1)
   */
  getAttackingUnits(player: 'player1' | 'player2'): { position: CellPosition; card: GameCard }[] {
    const attackRow = player === 'player1' ? 2 : 1
    return this.getRowUnits(attackRow as 0 | 1 | 2 | 3)
  }

  /**
   * Get bench units (player row 3, enemy row 0)
   */
  getBenchUnits(player: 'player1' | 'player2'): { position: CellPosition; card: GameCard }[] {
    const benchRow = player === 'player1' ? 3 : 0
    return this.getRowUnits(benchRow as 0 | 1 | 2 | 3)
  }

  /**
   * Clear all attack positions
   */
  clearAttackPositions(): void {
    // Clear player attack row (2)
    for (let col = 0; col < 6; col++) {
      this.setCellContent({ row: 2, col: col as 0 | 1 | 2 | 3 | 4 | 5 }, null)
    }

    // Clear enemy attack row (1)
    for (let col = 0; col < 6; col++) {
      this.setCellContent({ row: 1, col: col as 0 | 1 | 2 | 3 | 4 | 5 }, null)
    }
  }

  /**
   * Get occupied positions
   */
  getOccupiedPositions(): Set<string> {
    return new Set(this.gridState.keys())
  }

  /**
   * Get empty positions of specific type
   */
  getEmptyPositions(cellType?: CellType): CellPosition[] {
    const emptyPositions: CellPosition[] = []

    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 6; col++) {
        const position: CellPosition = { row: row as 0 | 1 | 2 | 3, col: col as 0 | 1 | 2 | 3 | 4 | 5 }
        
        if (cellType && gridMathService.getCellType(position) !== cellType) {
          continue
        }

        if (!this.getCellContent(position)) {
          emptyPositions.push(position)
        }
      }
    }

    return emptyPositions
  }

  /**
   * Check if row has space
   */
  hasSpaceInRow(row: 0 | 1 | 2 | 3): boolean {
    return this.getEmptyPositions().some(pos => pos.row === row)
  }

  /**
   * Get current grid state as Map
   */
  getGridState(): Map<string, GameCard> {
    return new Map(this.gridState)
  }

  /**
   * Create cell key from position
   */
  private createCellKey(position: CellPosition): string {
    return `${position.row}-${position.col}`
  }

  /**
   * Validate move from hand to grid
   */
  private validateHandToGridMove(card: GameCard, to: CellPosition, toType: CellType, gameState: GameState): MoveValidationResult {
    // Check if it's player's turn
    if (gameState.activePlayer !== 'player1') {
      return { valid: false, reason: 'Not your turn' }
    }

    // Check phase
    if (gameState.phase !== 'action') {
      return { valid: false, reason: 'Can only play cards during action phase' }
    }

    // Only allow playing to player-controlled areas
    if (toType !== 'player_bench' && toType !== 'player_attack') {
      return { valid: false, reason: 'Can only play to your bench or attack positions' }
    }

    // Check mana cost
    const totalMana = gameState.player1.mana + gameState.player1.spellMana
    if (card.cost > totalMana) {
      return { valid: false, reason: 'Insufficient mana', cost: card.cost }
    }

    // Units can only be played to bench unless attacking
    if (card.type === 'unit' && toType === 'player_attack') {
      // Can play directly to attack if has attack token and it's an attack action
      if (!gameState.player1.hasAttackToken) {
        return { valid: false, reason: 'Need attack token to play to attack position' }
      }
    }

    return { valid: true, cost: card.cost }
  }

  /**
   * Validate move from grid to grid
   */
  private validateGridToGridMove(card: GameCard, fromType: CellType, toType: CellType, gameState: GameState): MoveValidationResult {
    // Check if it's player's turn
    if (gameState.activePlayer !== 'player1') {
      return { valid: false, reason: 'Not your turn' }
    }

    // Check phase
    if (gameState.phase !== 'action') {
      return { valid: false, reason: 'Can only move during action phase' }
    }

    // Only allow moving player's units
    if (fromType !== 'player_bench' && fromType !== 'player_attack') {
      return { valid: false, reason: 'Can only move your own units' }
    }

    // Only allow moving to player-controlled areas
    if (toType !== 'player_bench' && toType !== 'player_attack') {
      return { valid: false, reason: 'Can only move to your bench or attack positions' }
    }

    // Movement from bench to attack requires attack token
    if (fromType === 'player_bench' && toType === 'player_attack') {
      if (!gameState.player1.hasAttackToken) {
        return { valid: false, reason: 'Need attack token to move to attack position' }
      }
    }

    return { valid: true, cost: 0 }
  }
}

// Singleton instance
export const gridManagerService = new GridManagerService()
