'use client'

import type { Card as GameCard } from '@/schemas/schema'
import { CellPositionSchema } from '@/schemas/schema'
import type { CellPosition } from '@/store/game_store'
import { animationService } from './animation_service'
import { gridMathService } from './grid_math_service'

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
  /** Provide dynamic, rules-validated drop zones given current game state */
  getValidDropZones?: (card: GameCard, from: CellPosition | 'hand') => CellPosition[]
  /** Optional guard to control whether a drag can begin */
  canDragCard?: (card: GameCard, from: CellPosition | 'hand') => boolean
  /** Optional validator for whether a target position is allowed */
  canDropOn?: (to: CellPosition, card: GameCard, from: CellPosition | 'hand') => boolean
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
    element: HTMLElement,
  ): void {
    event.preventDefault()
    event.stopPropagation()

    const clientX = event.clientX
    const clientY = event.clientY

    if (this.mode === 'click') {
      this.handleClickInteraction(card, position)
      return
    }

    // External gating (e.g., phase/turn checks)
    if (this.callbacks.canDragCard && !this.callbacks.canDragCard(card, position)) {
      this.callbacks.onShowTooltip?.('Cannot drag right now', { x: clientX, y: clientY })
      return
    }

    // Capture pointer to prevent interference with other elements
    element.setPointerCapture(event.pointerId)

    // For drag and hybrid modes, start tracking for potential drag
    this.dragState = {
      isDragging: false,
      draggedCard: card,
      dragStartPosition: { x: clientX, y: clientY },
      currentPosition: { x: clientX, y: clientY },
      dragElement: element,
      sourcePosition: position,
    }

    // Store original element styles for restoration
    this.storeOriginalStyles(element)

    // Set up long press for touch devices
    if (event.pointerType === 'touch') {
      this.longPressTimeout = window.setTimeout(() => {
        this.showCardTooltip(card, { x: clientX, y: clientY })
      }, this.longPressDelay)
    }

    // Add global listeners for drag tracking
    document.addEventListener('pointermove', this.handlePointerMove, { passive: false })
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
        this.dragState.sourcePosition!,
      )

      const isValid = validPositions.some(
        pos => pos.row === position.row && pos.col === position.col,
      )

      this.callbacks.onCellHighlight?.([position], isValid ? 'valid' : 'invalid')
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
          const parsed = CellPositionSchema.safeParse({
            ...currentPosition,
            row: currentPosition.row - 1,
          })
          if (parsed.success) newPosition = parsed.data
        }
        break
      case 'ArrowDown':
        if (currentPosition.row < 3) {
          const parsed = CellPositionSchema.safeParse({
            ...currentPosition,
            row: currentPosition.row + 1,
          })
          if (parsed.success) newPosition = parsed.data
        }
        break
      case 'ArrowLeft':
        if (currentPosition.col > 0) {
          const parsed = CellPositionSchema.safeParse({
            ...currentPosition,
            col: currentPosition.col - 1,
          })
          if (parsed.success) newPosition = parsed.data
        }
        break
      case 'ArrowRight':
        if (currentPosition.col < 5) {
          const parsed = CellPositionSchema.safeParse({
            ...currentPosition,
            col: currentPosition.col + 1,
          })
          if (parsed.success) newPosition = parsed.data
        }
        break
      case 'Enter':
      case ' ':
        // Activate current cell
        if (this.clickState.selectedCard && this.clickState.selectedPosition) {
          this.callbacks.onCardMove?.(
            this.clickState.selectedCard,
            this.clickState.selectedPosition,
            currentPosition,
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

    // Style the dragged element with proper transitions
    const element = this.dragState.dragElement
    element.style.zIndex = '1000'
    element.style.pointerEvents = 'none'
    element.style.transition = 'transform 0.15s ease-out, filter 0.15s ease-out'
    element.style.transform = 'scale(1.1) rotate(3deg)'
    element.style.filter = 'brightness(1.1) drop-shadow(0 8px 16px rgba(0,0,0,0.3))'
    element.style.cursor = 'grabbing'

    // Create drag preview if needed
    this.createDragPreview()

    // Show valid drop zones
    const validPositions = this.getValidDropPositions(
      this.dragState.draggedCard,
      this.dragState.sourcePosition!,
    )

    this.callbacks.onCellHighlight?.(validPositions, 'valid')

    // Start animation feedback
    animationService.animateCellHighlight(element, 'selected')

    // Add body class to prevent text selection during drag
    document.body.classList.add('dragging-card')
    document.body.style.userSelect = 'none'
  }

  /**
   * Update drag position
   */
  private updateDrag(x: number, y: number): void {
    if (!this.dragState.dragElement || !this.dragState.dragStartPosition) return

    const dx = x - this.dragState.dragStartPosition.x
    const dy = y - this.dragState.dragStartPosition.y

    // Calculate tilt effect based on drag velocity for more natural feel
    const tiltX = Math.max(-5, Math.min(5, dx * 0.02))
    const tiltY = Math.max(-5, Math.min(5, dy * 0.02))

    // Apply smooth transform with tilt effect
    this.dragState.dragElement.style.transform = `translate(${dx}px, ${dy}px) scale(1.1) rotateX(${tiltY}deg) rotateY(${tiltX}deg)`

    // Update hover feedback with debouncing for performance
    this.throttledUpdateHover(x, y)
  }

  /**
   * Complete drag operation
   */
  private completeDrag(x: number, y: number): void {
    if (!this.dragState.draggedCard || !this.dragState.sourcePosition) return

    // Capture card and position before cleanup to avoid race conditions
    const draggedCard = this.dragState.draggedCard
    const sourcePosition = this.dragState.sourcePosition
    const targetPosition = gridMathService.screenToGridCoordinates(x, y)

    if (targetPosition) {
      const validPositions = this.getValidDropPositions(draggedCard, sourcePosition)

      let isValidDrop = validPositions.some(
        pos => pos.row === targetPosition.row && pos.col === targetPosition.col,
      )

      if (isValidDrop && this.callbacks.canDropOn) {
        isValidDrop = this.callbacks.canDropOn(targetPosition, draggedCard, sourcePosition)
      }

      if (isValidDrop) {
        // Valid drop - execute the move with success animation
        this.animateSuccessfulDrop(targetPosition, () => {
          this.callbacks.onCardMove?.(draggedCard, sourcePosition, targetPosition)
        })
      } else {
        // Invalid drop - show rejection feedback
        this.animateInvalidDrop()
      }
    } else {
      // Dropped outside grid - animate back with bounce
      this.animateCardBack()
    }

    // Clean up highlights and reset drag state
    this.callbacks.onClearHighlights?.()
    this.cleanupDragState()
    this.dragState = this.createEmptyDragState()
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
        targetMode: 'move',
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
  private getValidDropPositions(card: GameCard, from: CellPosition | 'hand'): CellPosition[] {
    // Delegate to host if available
    if (this.callbacks.getValidDropZones) {
      return this.callbacks.getValidDropZones(card, from)
    }

    // Fallback: allow only bench from hand
    const validPositions: CellPosition[] = []
    if (from === 'hand') {
      for (let col = 0; col < 6; col++) {
        const benchPos = CellPositionSchema.safeParse({ row: 3, col })
        if (benchPos.success) validPositions.push(benchPos.data)
      }
    }
    return validPositions
  }

  /**
   * Animate card back to original position
   */
  private animateCardBack(): void {
    if (!this.dragState.dragElement) return

    const element = this.dragState.dragElement

    // Animate back with bounce effect
    element.style.transition =
      'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), filter 0.3s ease-out'
    element.style.transform = this.originalStyles?.transform || ''
    element.style.filter = 'none'

    // Reset other styles after animation
    setTimeout(() => {
      this.restoreOriginalStyles()
    }, 400)
  }

  /**
   * Animate successful drop
   */
  private animateSuccessfulDrop(targetPosition: CellPosition, onComplete: () => void): void {
    if (!this.dragState.dragElement) return

    const element = this.dragState.dragElement
    const targetCoords = gridMathService.gridToScreenCoordinates(targetPosition)

    // Calculate relative position to target
    const rect = element.getBoundingClientRect()
    const dx = targetCoords.x - rect.left
    const dy = targetCoords.y - rect.top

    // Animate to target with satisfying ease
    element.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
    element.style.transform = `translate(${dx}px, ${dy}px) scale(1)`

    setTimeout(() => {
      onComplete()
      this.restoreOriginalStyles()
    }, 300)
  }

  /**
   * Animate invalid drop with shake effect
   */
  private animateInvalidDrop(): void {
    if (!this.dragState.dragElement) return

    const element = this.dragState.dragElement

    // Shake animation for invalid drop
    element.style.transition = 'transform 0.1s ease-in-out'
    element.style.filter = 'brightness(1.2) hue-rotate(340deg)' // Red tint

    // Shake sequence
    const shakeSequence = [
      'translateX(-10px)',
      'translateX(10px)',
      'translateX(-5px)',
      'translateX(5px)',
      'translateX(0px)',
    ]
    let shakeIndex = 0

    const doShake = () => {
      if (shakeIndex < shakeSequence.length) {
        element.style.transform = `${shakeSequence[shakeIndex]} scale(1.1)`
        shakeIndex++
        setTimeout(doShake, 50)
      } else {
        // Return to original position
        this.animateCardBack()
      }
    }

    doShake()
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
      sourcePosition: null,
    }
  }

  /**
   * Create empty click state
   */
  private createEmptyClickState(): ClickState {
    return {
      selectedCard: null,
      selectedPosition: null,
      targetMode: 'none',
    }
  }

  // Additional helper methods for improved drag and drop
  private originalStyles: Record<string, string> = {}
  private throttledUpdateHover: (x: number, y: number) => void = this.throttle(
    (x: number, y: number) => {
      const gridPosition = gridMathService.screenToGridCoordinates(x, y)
      if (gridPosition) {
        this.handleCellHover(gridPosition)
      }
    },
    16,
  ) // ~60fps

  /**
   * Store original element styles for restoration
   */
  private storeOriginalStyles(element: HTMLElement): void {
    this.originalStyles = {
      transform: element.style.transform,
      zIndex: element.style.zIndex,
      pointerEvents: element.style.pointerEvents,
      transition: element.style.transition,
      filter: element.style.filter,
      cursor: element.style.cursor,
    }
  }

  /**
   * Restore original element styles
   */
  private restoreOriginalStyles(): void {
    if (this.dragState.dragElement && this.originalStyles) {
      const element = this.dragState.dragElement
      Object.assign(element.style, this.originalStyles)
    }
    this.originalStyles = {}
  }

  /**
   * Clean up drag state and global effects
   */
  private cleanupDragState(): void {
    document.body.classList.remove('dragging-card')
    document.body.style.userSelect = ''
    this.removeDragPreview()
  }

  /**
   * Create visual drag preview
   */
  private createDragPreview(): void {
    // Implementation for creating a ghost image during drag
    // This would create a semi-transparent copy following the cursor
  }

  /**
   * Remove drag preview
   */
  private removeDragPreview(): void {
    // Clean up any drag preview elements
    const preview = document.querySelector('.drag-preview')
    if (preview) {
      preview.remove()
    }
  }

  /**
   * Throttle function for performance
   */
  private throttle<T extends (...args: unknown[]) => unknown>(func: T, limit: number): T {
    let inThrottle: boolean
    return ((...args: unknown[]) => {
      if (!inThrottle) {
        func.apply(this, args)
        inThrottle = true
        setTimeout(() => (inThrottle = false), limit)
      }
    }) as T
  }
}

// Singleton instance
export const interactionService = new InteractionService()
