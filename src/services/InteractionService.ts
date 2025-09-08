import type { CellPosition } from '@/store/gameStore'
import type { Card as GameCard } from '@/types/game'
import { gridMathService } from './GridMathService'
import { animationService } from './AnimationService'

export type InteractionMode = 'click' | 'drag' | 'hybrid'

export interface DragState {
  isDragging: boolean
  draggedCard: GameCard | null
  dragStartPosition: { x: number; y: number } | null
  currentPosition: { x: number; y: number } | null
  dragElement: HTMLElement | null
  sourcePosition: CellPosition | 'hand' | null
}

export interface ClickState {
  selectedCard: GameCard | null
  selectedPosition: CellPosition | 'hand' | null
  targetMode: 'none' | 'move' | 'attack' | 'defend'
}

export interface InteractionCallbacks {
  onCardSelect?: (card: GameCard, position: CellPosition | 'hand') => void
  onCardMove?: (card: GameCard, from: CellPosition | 'hand', to: CellPosition) => void
  onCardAttack?: (card: GameCard, from: CellPosition, to?: CellPosition) => void
  onCellHighlight?: (positions: CellPosition[], type: 'valid' | 'invalid' | 'hover') => void
  onClearHighlights?: () => void
  onShowTooltip?: (message: string, position: { x: number; y: number }) => void
  onHideTooltip?: () => void
}

class InteractionService {
  private mode: InteractionMode = 'hybrid'
  private dragState: DragState = this.createEmptyDragState()
  private clickState: ClickState = this.createEmptyClickState()
  private callbacks: InteractionCallbacks = {}
  private dragThreshold = 5 // pixels to differentiate click from drag
  private longPressTimeout: number | null = null
  private longPressDelay = 500 // ms for long press on touch devices

  /**
   * Set the interaction mode
   */
  setMode(mode: InteractionMode): void {
    this.mode = mode
    this.resetStates()
  }

  /**
   * Set callbacks for interaction events
   */
  setCallbacks(callbacks: InteractionCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks }
  }

  /**
   * Handle pointer down event (mouse/touch)
   */
  handlePointerDown(
    event: PointerEvent,
    card: GameCard,
    position: CellPosition | 'hand',
    element: HTMLElement
  ): void {
    event.preventDefault()
    
    const clientX = event.clientX
    const clientY = event.clientY

    if (this.mode === 'click') {
      this.handleClickInteraction(card, position)
      return
    }

    // For drag and hybrid modes, start tracking for potential drag
    this.dragState = {
      isDragging: false,
      draggedCard: card,
      dragStartPosition: { x: clientX, y: clientY },
      currentPosition: { x: clientX, y: clientY },
      dragElement: element,
      sourcePosition: position
    }

    // Set up long press for touch devices
    if (event.pointerType === 'touch') {
      this.longPressTimeout = window.setTimeout(() => {
        this.showCardTooltip(card, { x: clientX, y: clientY })
      }, this.longPressDelay)
    }

    // Add global listeners for drag tracking
    document.addEventListener('pointermove', this.handlePointerMove)
    document.addEventListener('pointerup', this.handlePointerUp)
    document.addEventListener('pointercancel', this.handlePointerCancel)
  }

  /**
   * Handle pointer move event
   */
  private handlePointerMove = (event: PointerEvent): void => {
    if (!this.dragState.dragStartPosition || this.mode === 'click') return

    const clientX = event.clientX
    const clientY = event.clientY
    
    this.dragState.currentPosition = { x: clientX, y: clientY }

    // Clear long press timeout on movement
    if (this.longPressTimeout) {
      clearTimeout(this.longPressTimeout)
      this.longPressTimeout = null
    }

    // Check if we've moved beyond the drag threshold
    const dx = clientX - this.dragState.dragStartPosition.x
    const dy = clientY - this.dragState.dragStartPosition.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (!this.dragState.isDragging && distance > this.dragThreshold) {
      this.startDrag()
    }

    if (this.dragState.isDragging) {
      this.updateDrag(clientX, clientY)
    }
  }

  /**
   * Handle pointer up event
   */
  private handlePointerUp = (event: PointerEvent): void => {
    this.clearEventListeners()

    if (this.longPressTimeout) {
      clearTimeout(this.longPressTimeout)
      this.longPressTimeout = null
    }

    if (this.dragState.isDragging) {
      this.completeDrag(event.clientX, event.clientY)
    } else if (this.mode === 'hybrid' && this.dragState.draggedCard) {
      // Treat as click if no drag occurred
      this.handleClickInteraction(this.dragState.draggedCard, this.dragState.sourcePosition!)
    }

    this.resetStates()
  }

  /**
   * Handle pointer cancel event
   */
  private handlePointerCancel = (): void => {
    this.clearEventListeners()
    this.cancelDrag()
    this.resetStates()
  }

  /**
   * Handle cell hover
   */
  handleCellHover(position: CellPosition | null): void {
    if (position && this.dragState.isDragging && this.dragState.draggedCard) {
      // Show valid/invalid drop zones
      const validPositions = this.getValidDropPositions(
        this.dragState.draggedCard,
        this.dragState.sourcePosition!
      )
      
      const isValid = validPositions.some(pos => 
        pos.row === position.row && pos.col === position.col
      )

      this.callbacks.onCellHighlight?.(
        [position],
        isValid ? 'valid' : 'invalid'
      )
    } else if (!position) {
      this.callbacks.onClearHighlights?.()
    }
  }

  /**
   * Handle keyboard navigation
   */
  handleKeyboardNavigation(key: string, currentPosition: CellPosition | null): CellPosition | null {
    if (!currentPosition) return null

    let newPosition: CellPosition | null = null

    switch (key) {
      case 'ArrowUp':
        if (currentPosition.row > 0) {
          newPosition = { ...currentPosition, row: (currentPosition.row - 1) as 0 | 1 | 2 | 3 }
        }
        break
      case 'ArrowDown':
        if (currentPosition.row < 3) {
          newPosition = { ...currentPosition, row: (currentPosition.row + 1) as 0 | 1 | 2 | 3 }
        }
        break
      case 'ArrowLeft':
        if (currentPosition.col > 0) {
          newPosition = { ...currentPosition, col: (currentPosition.col - 1) as 0 | 1 | 2 | 3 | 4 | 5 }
        }
        break
      case 'ArrowRight':
        if (currentPosition.col < 5) {
          newPosition = { ...currentPosition, col: (currentPosition.col + 1) as 0 | 1 | 2 | 3 | 4 | 5 }
        }
        break
      case 'Enter':
      case ' ':
        // Activate current cell
        if (this.clickState.selectedCard && this.clickState.selectedPosition) {
          this.callbacks.onCardMove?.(
            this.clickState.selectedCard,
            this.clickState.selectedPosition,
            currentPosition
          )
          this.resetClickState()
        }
        return currentPosition
    }

    return newPosition
  }

  /**
   * Get current drag state
   */
  getDragState(): DragState {
    return { ...this.dragState }
  }

  /**
   * Get current click state
   */
  getClickState(): ClickState {
    return { ...this.clickState }
  }

  /**
   * Check if currently dragging
   */
  isDragging(): boolean {
    return this.dragState.isDragging
  }

  /**
   * Force cancel any active drag
   */
  cancelDrag(): void {
    if (this.dragState.isDragging && this.dragState.dragElement) {
      // Reset drag element styles
      this.dragState.dragElement.style.transform = ''
      this.dragState.dragElement.style.zIndex = ''
      this.dragState.dragElement.style.pointerEvents = ''
    }

    this.callbacks.onClearHighlights?.()
    this.callbacks.onHideTooltip?.()
    this.clearEventListeners()
    this.resetStates()
  }

  /**
   * Start drag operation
   */
  private startDrag(): void {
    if (!this.dragState.draggedCard || !this.dragState.dragElement) return

    this.dragState.isDragging = true

    // Style the dragged element
    this.dragState.dragElement.style.zIndex = '1000'
    this.dragState.dragElement.style.pointerEvents = 'none'
    this.dragState.dragElement.style.transform += ' scale(1.05)'

    // Show valid drop zones
    const validPositions = this.getValidDropPositions(
      this.dragState.draggedCard,
      this.dragState.sourcePosition!
    )

    this.callbacks.onCellHighlight?.(validPositions, 'valid')

    // Start animation feedback
    animationService.animateCellHighlight(this.dragState.dragElement, 'selected')
  }

  /**
   * Update drag position
   */
  private updateDrag(x: number, y: number): void {
    if (!this.dragState.dragElement || !this.dragState.dragStartPosition) return

    const dx = x - this.dragState.dragStartPosition.x
    const dy = y - this.dragState.dragStartPosition.y

    this.dragState.dragElement.style.transform = 
      this.dragState.dragElement.style.transform.replace(/translate\([^)]*\)/, '') +
      ` translate(${dx}px, ${dy}px)`

    // Update hover feedback
    const gridPosition = gridMathService.screenToGridCoordinates(x, y)
    if (gridPosition) {
      this.handleCellHover(gridPosition)
    }
  }

  /**
   * Complete drag operation
   */
  private completeDrag(x: number, y: number): void {
    if (!this.dragState.draggedCard || !this.dragState.sourcePosition) return

    const targetPosition = gridMathService.screenToGridCoordinates(x, y)
    
    if (targetPosition) {
      const validPositions = this.getValidDropPositions(
        this.dragState.draggedCard,
        this.dragState.sourcePosition
      )

      const isValidDrop = validPositions.some(pos =>
        pos.row === targetPosition.row && pos.col === targetPosition.col
      )

      if (isValidDrop) {
        // Execute the move
        this.callbacks.onCardMove?.(
          this.dragState.draggedCard,
          this.dragState.sourcePosition,
          targetPosition
        )

        // Animate card to final position
        if (this.dragState.dragElement) {
          const targetCoords = gridMathService.gridToScreenCoordinates(targetPosition)
          animationService.animateCardMove(
            this.dragState.dragElement,
            { x, y },
            targetCoords
          )
        }
      } else {
        // Invalid drop - animate back to source
        this.animateCardBack()
      }
    } else {
      // Dropped outside grid - animate back
      this.animateCardBack()
    }

    this.callbacks.onClearHighlights?.()
  }

  /**
   * Handle click interaction
   */
  private handleClickInteraction(card: GameCard, position: CellPosition | 'hand'): void {
    if (this.clickState.selectedCard === card) {
      // Deselect if clicking the same card
      this.resetClickState()
      this.callbacks.onClearHighlights?.()
    } else {
      // Select new card
      this.clickState = {
        selectedCard: card,
        selectedPosition: position,
        targetMode: 'move'
      }

      this.callbacks.onCardSelect?.(card, position)

      // Show valid move positions
      const validPositions = this.getValidDropPositions(card, position)
      this.callbacks.onCellHighlight?.(validPositions, 'valid')
    }
  }

  /**
   * Get valid drop positions for a card
   */
  private getValidDropPositions(
    card: GameCard,
    from: CellPosition | 'hand'
  ): CellPosition[] {
    // This would integrate with the GridManagerService in the real implementation
    // For now, return sample valid positions based on basic rules
    const validPositions: CellPosition[] = []

    if (from === 'hand') {
      // Can play to player bench (row 3) or attack positions (row 2)
      for (let col = 0; col < 6; col++) {
        validPositions.push({ row: 3, col: col as 0 | 1 | 2 | 3 | 4 | 5 }) // Bench
        validPositions.push({ row: 2, col: col as 0 | 1 | 2 | 3 | 4 | 5 }) // Attack
      }
    } else {
      // Moving within grid - can move between player-controlled positions
      if (from.row === 3) {
        // From bench, can move to attack positions
        for (let col = 0; col < 6; col++) {
          validPositions.push({ row: 2, col: col as 0 | 1 | 2 | 3 | 4 | 5 })
        }
      } else if (from.row === 2) {
        // From attack, can move back to bench
        for (let col = 0; col < 6; col++) {
          validPositions.push({ row: 3, col: col as 0 | 1 | 2 | 3 | 4 | 5 })
        }
      }
    }

    return validPositions
  }

  /**
   * Animate card back to original position
   */
  private animateCardBack(): void {
    if (this.dragState.dragElement && this.dragState.sourcePosition && this.dragState.sourcePosition !== 'hand') {
      const sourceCoords = gridMathService.gridToScreenCoordinates(this.dragState.sourcePosition)
      animationService.animateCardMove(
        this.dragState.dragElement,
        this.dragState.currentPosition || { x: 0, y: 0 },
        sourceCoords
      )
    }

    // Reset drag element styles
    if (this.dragState.dragElement) {
      setTimeout(() => {
        if (this.dragState.dragElement) {
          this.dragState.dragElement.style.transform = ''
          this.dragState.dragElement.style.zIndex = ''
          this.dragState.dragElement.style.pointerEvents = ''
        }
      }, 300) // Wait for animation
    }
  }

  /**
   * Show card tooltip
   */
  private showCardTooltip(card: GameCard, position: { x: number; y: number }): void {
    const message = `${card.name} - Cost: ${card.cost}, Attack: ${card.attack}, Health: ${card.health}`
    this.callbacks.onShowTooltip?.(message, position)
  }

  /**
   * Clear event listeners
   */
  private clearEventListeners(): void {
    document.removeEventListener('pointermove', this.handlePointerMove)
    document.removeEventListener('pointerup', this.handlePointerUp)
    document.removeEventListener('pointercancel', this.handlePointerCancel)
  }

  /**
   * Reset all states
   */
  private resetStates(): void {
    this.dragState = this.createEmptyDragState()
    this.resetClickState()
  }

  /**
   * Reset click state
   */
  private resetClickState(): void {
    this.clickState = this.createEmptyClickState()
  }

  /**
   * Create empty drag state
   */
  private createEmptyDragState(): DragState {
    return {
      isDragging: false,
      draggedCard: null,
      dragStartPosition: null,
      currentPosition: null,
      dragElement: null,
      sourcePosition: null
    }
  }

  /**
   * Create empty click state
   */
  private createEmptyClickState(): ClickState {
    return {
      selectedCard: null,
      selectedPosition: null,
      targetMode: 'none'
    }
  }
}

// Singleton instance
export const interactionService = new InteractionService()
