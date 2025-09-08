import type { CellPosition, CellType } from '@/store/gameStore'

export interface GridDimensions {
    cellWidth: number
    cellHeight: number
    gridTop: number
    gridLeft: number
    gap: number
}

export class GridMathService {
    private dimensions: GridDimensions = {
        cellWidth: 80,
        cellHeight: 80,
        gridTop: 0,
        gridLeft: 0,
        gap: 8
    }

    /**
     * Update grid dimensions based on current viewport
     */
    updateDimensions(containerElement: HTMLElement): void {
        const rect = containerElement.getBoundingClientRect()
        const availableWidth = rect.width - (5 * this.dimensions.gap) // 6 columns, 5 gaps
        const availableHeight = rect.height - (3 * this.dimensions.gap) // 4 rows, 3 gaps

        this.dimensions = {
            cellWidth: Math.floor(availableWidth / 6),
            cellHeight: Math.floor(availableHeight / 4),
            gridTop: rect.top,
            gridLeft: rect.left,
            gap: this.dimensions.gap
        }
    }

    /**
     * Convert screen coordinates to grid position
     */
    screenToGridCoordinates(x: number, y: number): CellPosition | null {
        const relativeX = x - this.dimensions.gridLeft
        const relativeY = y - this.dimensions.gridTop

        if (relativeX < 0 || relativeY < 0) return null

        const col = Math.floor(relativeX / (this.dimensions.cellWidth + this.dimensions.gap))
        const row = Math.floor(relativeY / (this.dimensions.cellHeight + this.dimensions.gap))

        // Validate bounds
        if (col < 0 || col > 5 || row < 0 || row > 3) return null

        return { row: row as 0 | 1 | 2 | 3, col: col as 0 | 1 | 2 | 3 | 4 | 5 }
    }

    /**
     * Convert grid position to screen coordinates (center of cell)
     */
    gridToScreenCoordinates(position: CellPosition): { x: number; y: number } {
        const x = this.dimensions.gridLeft +
            (position.col * (this.dimensions.cellWidth + this.dimensions.gap)) +
            (this.dimensions.cellWidth / 2)

        const y = this.dimensions.gridTop +
            (position.row * (this.dimensions.cellHeight + this.dimensions.gap)) +
            (this.dimensions.cellHeight / 2)

        return { x, y }
    }

    /**
     * Get cell bounds for drop zone detection
     */
    getCellBounds(position: CellPosition): DOMRect {
        const x = this.dimensions.gridLeft + (position.col * (this.dimensions.cellWidth + this.dimensions.gap))
        const y = this.dimensions.gridTop + (position.row * (this.dimensions.cellHeight + this.dimensions.gap))

        return new DOMRect(x, y, this.dimensions.cellWidth, this.dimensions.cellHeight)
    }

    /**
     * Get adjacent cells (for synergy effects, movement validation)
     */
    getAdjacentCells(position: CellPosition): CellPosition[] {
        const adjacent: CellPosition[] = []

        // Horizontal adjacent
        if (position.col > 0) {
            adjacent.push({ row: position.row, col: (position.col - 1) as 0 | 1 | 2 | 3 | 4 | 5 })
        }
        if (position.col < 5) {
            adjacent.push({ row: position.row, col: (position.col + 1) as 0 | 1 | 2 | 3 | 4 | 5 })
        }

        // Vertical adjacent
        if (position.row > 0) {
            adjacent.push({ row: (position.row - 1) as 0 | 1 | 2 | 3, col: position.col })
        }
        if (position.row < 3) {
            adjacent.push({ row: (position.row + 1) as 0 | 1 | 2 | 3, col: position.col })
        }

        return adjacent
    }

    /**
     * Get cells in the same column (for column-based strategies)
     */
    getColumnCells(col: number): CellPosition[] {
        return [
            { row: 0, col: col as 0 | 1 | 2 | 3 | 4 | 5 },
            { row: 1, col: col as 0 | 1 | 2 | 3 | 4 | 5 },
            { row: 2, col: col as 0 | 1 | 2 | 3 | 4 | 5 },
            { row: 3, col: col as 0 | 1 | 2 | 3 | 4 | 5 }
        ]
    }

    /**
     * Get all cells of a specific type
     */
    getCellsOfType(type: CellType): CellPosition[] {
        const cells: CellPosition[] = []
        const row = this.getCellTypeRow(type)

        for (let col = 0; col < 6; col++) {
            cells.push({ row, col: col as 0 | 1 | 2 | 3 | 4 | 5 })
        }

        return cells
    }

    /**
     * Calculate optimal movement path between two positions
     */
    calculateMovementPath(from: CellPosition, to: CellPosition): CellPosition[] {
        // For grid movement, we typically want direct paths
        // This is useful for animations
        const path: CellPosition[] = []

        let currentRow = from.row
        let currentCol = from.col

        // Move row first, then column (could be customized)
        while (currentRow !== to.row) {
            currentRow += currentRow < to.row ? 1 : -1
            path.push({ row: currentRow as 0 | 1 | 2 | 3, col: currentCol })
        }

        while (currentCol !== to.col) {
            currentCol += currentCol < to.col ? 1 : -1
            path.push({ row: currentRow, col: currentCol as 0 | 1 | 2 | 3 | 4 | 5 })
        }

        return path
    }

    /**
     * Calculate distance between two grid positions
     */
    getDistance(pos1: CellPosition, pos2: CellPosition): number {
        return Math.abs(pos1.row - pos2.row) + Math.abs(pos1.col - pos2.col)
    }

    /**
     * Check if two positions are in the same column
     */
    isSameColumn(pos1: CellPosition, pos2: CellPosition): boolean {
        return pos1.col === pos2.col
    }

    /**
     * Check if two positions are in the same row
     */
    isSameRow(pos1: CellPosition, pos2: CellPosition): boolean {
        return pos1.row === pos2.row
    }

    /**
     * Get cell type from position
     */
    getCellType(position: CellPosition): CellType {
        switch (position.row) {
            case 0: return 'enemy_bench'
            case 1: return 'enemy_attack'
            case 2: return 'player_attack'
            case 3: return 'player_bench'
        }
    }

    /**
     * Get row number for cell type
     */
    private getCellTypeRow(type: CellType): 0 | 1 | 2 | 3 {
        switch (type) {
            case 'enemy_bench': return 0
            case 'enemy_attack': return 1
            case 'player_attack': return 2
            case 'player_bench': return 3
        }
    }

    /**
     * Check if position is valid for the grid
     */
    isValidPosition(position: CellPosition): boolean {
        return position.row >= 0 && position.row <= 3 &&
            position.col >= 0 && position.col <= 5
    }

    /**
     * Get all positions in a rectangular area
     */
    getPositionsInArea(topLeft: CellPosition, bottomRight: CellPosition): CellPosition[] {
        const positions: CellPosition[] = []

        for (let row = topLeft.row; row <= bottomRight.row; row++) {
            for (let col = topLeft.col; col <= bottomRight.col; col++) {
                positions.push({ row: row as 0 | 1 | 2 | 3, col: col as 0 | 1 | 2 | 3 | 4 | 5 })
            }
        }

        return positions
    }

    /**
     * Get current grid dimensions
     */
    getDimensions(): GridDimensions {
        return { ...this.dimensions }
    }
}

// Singleton instance
export const gridMathService = new GridMathService()
