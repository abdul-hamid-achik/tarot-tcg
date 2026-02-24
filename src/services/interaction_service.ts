'use client'

import type { Card as GameCard } from '@/schemas/schema'
import type { BattlefieldPosition } from '@/services/battlefield_service'
import { animationService } from './animation_service'

export type InteractionMode = 'click' | 'drag' | 'hybrid'

export interface DragState {
  isDragging: boolean
  draggedCard: GameCard | null
  dragStartPosition: { x: number; y: number } | null
  currentPosition: { x: number; y: number } | null
  dragElement: HTMLElement | null
  sourcePosition: BattlefieldPosition | 'hand' | null
  capturedPointerId: number | null
}

export interface ClickState {
  selectedCard: GameCard | null
  selectedPosition: BattlefieldPosition | 'hand' | null
  targetMode: 'none' | 'move' | 'attack' | 'defend'
}

export interface InteractionCallbacks {
  onCardSelect?: (card: GameCard, position: BattlefieldPosition | 'hand') => void
  onCardMove?: (card: GameCard, from: BattlefieldPosition | 'hand', to: BattlefieldPosition) => void
  onCardAttack?: (card: GameCard, from: BattlefieldPosition, to?: BattlefieldPosition) => void
  onSlotHighlight?: (positions: BattlefieldPosition[], type: 'valid' | 'invalid' | 'hover') => void
  onClearHighlights?: () => void
  onShowTooltip?: (message: string, position: { x: number; y: number }) => void
  onHideTooltip?: () => void
  getValidDropZones?: (card: GameCard, from: BattlefieldPosition | 'hand') => BattlefieldPosition[]
  canDragCard?: (card: GameCard, from: BattlefieldPosition | 'hand') => boolean
  canDropOn?: (
    to: BattlefieldPosition,
    card: GameCard,
    from: BattlefieldPosition | 'hand',
  ) => boolean
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
    position: BattlefieldPosition | 'hand',
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
      capturedPointerId: event.pointerId,
    }

    // Start long press timer for touch devices
    if (event.pointerType === 'touch') {
      this.longPressTimeout = window.setTimeout(() => {
        this.startDrag()
      }, this.longPressDelay)
    }

    // Show valid drop zones when drag is ready
    const validZones = this.callbacks.getValidDropZones?.(card, position) || []
    if (validZones.length > 0) {
      this.callbacks.onSlotHighlight?.(validZones, 'valid')
    }
  }

  /**
   * Handle pointer move event
   */
  handlePointerMove(event: PointerEvent): void {
    if (!this.dragState.draggedCard || !this.dragState.dragStartPosition) return

    const clientX = event.clientX
    const clientY = event.clientY
    this.dragState.currentPosition = { x: clientX, y: clientY }

    // Check if we've moved enough to start dragging
    if (!this.dragState.isDragging) {
      const dx = clientX - this.dragState.dragStartPosition.x
      const dy = clientY - this.dragState.dragStartPosition.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance > this.dragThreshold) {
        this.startDrag()
      }
    }

    // Update drag visual
    if (this.dragState.isDragging && this.dragState.dragElement) {
      this.updateDragVisual(clientX, clientY)

      // Check what lane we're hovering over
      const hoveredSlot = this.getSlotFromPosition(clientX, clientY)
      if (hoveredSlot) {
        const canDrop = this.callbacks.canDropOn?.(
          hoveredSlot,
          this.dragState.draggedCard,
          this.dragState.sourcePosition!,
        )
        if (canDrop) {
          this.callbacks.onSlotHighlight?.([hoveredSlot], 'hover')
        }
      }
    }
  }

  /**
   * Handle pointer up event
   */
  handlePointerUp(event: PointerEvent): void {
    if (this.longPressTimeout) {
      clearTimeout(this.longPressTimeout)
      this.longPressTimeout = null
    }

    // Release pointer capture
    if (this.dragState.dragElement && this.dragState.capturedPointerId !== null) {
      try {
        this.dragState.dragElement.releasePointerCapture(this.dragState.capturedPointerId)
      } catch {
        // Ignore if already released
      }
    }

    if (!this.dragState.draggedCard) return

    const clientX = event.clientX
    const clientY = event.clientY

    if (this.dragState.isDragging) {
      // Handle drop
      const dropLane = this.getSlotFromPosition(clientX, clientY)
      if (dropLane && this.dragState.sourcePosition) {
        const canDrop = this.callbacks.canDropOn?.(
          dropLane,
          this.dragState.draggedCard,
          this.dragState.sourcePosition,
        )

        if (canDrop) {
          // Determine if this is a move or attack based on source and target
          const isFromHand = this.dragState.sourcePosition === 'hand'
          const _isTargetOccupied = !canDrop || dropLane.player !== 'player1' // Assumes attacking enemy

          if (isFromHand) {
            // Playing a card from hand to battlefield
            animationService.animateCardMove(
              this.dragState.draggedCard,
              this.dragState.sourcePosition,
              dropLane,
            )
            this.callbacks.onCardMove?.(
              this.dragState.draggedCard,
              this.dragState.sourcePosition,
              dropLane,
            )
          } else if (this.dragState.sourcePosition !== 'hand') {
            // Dragging from battlefield - check if attacking or moving
            const fromPos = this.dragState.sourcePosition as BattlefieldPosition

            // If dropping on enemy slot, it's an attack
            if (dropLane.player !== fromPos.player) {
              this.callbacks.onCardAttack?.(this.dragState.draggedCard, fromPos, dropLane)
            } else {
              // Moving on own battlefield (if allowed)
              animationService.animateCardMove(
                this.dragState.draggedCard,
                this.dragState.sourcePosition,
                dropLane,
              )
              this.callbacks.onCardMove?.(
                this.dragState.draggedCard,
                this.dragState.sourcePosition,
                dropLane,
              )
            }
          }
        }
      }

      this.endDrag()
    } else if (this.mode === 'hybrid') {
      // In hybrid mode, a quick release is treated as a click
      this.handleClickInteraction(this.dragState.draggedCard, this.dragState.sourcePosition!)
    }

    this.resetDragState()
    this.callbacks.onClearHighlights?.()
  }

  /**
   * Handle click interaction
   */
  private handleClickInteraction(card: GameCard, position: BattlefieldPosition | 'hand'): void {
    if (this.clickState.selectedCard) {
      // We have a selected card, try to move/attack
      if (position !== 'hand' && this.clickState.selectedPosition !== 'hand') {
        const fromPos = this.clickState.selectedPosition as BattlefieldPosition
        const toPos = position as BattlefieldPosition

        if (this.clickState.targetMode === 'move') {
          this.callbacks.onCardMove?.(this.clickState.selectedCard, fromPos, toPos)
        } else if (this.clickState.targetMode === 'attack') {
          this.callbacks.onCardAttack?.(this.clickState.selectedCard, fromPos, toPos)
        }
      }

      this.resetClickState()
      this.callbacks.onClearHighlights?.()
    } else {
      // Select the card
      this.clickState.selectedCard = card
      this.clickState.selectedPosition = position
      this.clickState.targetMode = position === 'hand' ? 'move' : 'attack'

      this.callbacks.onCardSelect?.(card, position)

      // Show valid targets
      if (position !== 'hand') {
        const validZones = this.callbacks.getValidDropZones?.(card, position) || []
        if (validZones.length > 0) {
          this.callbacks.onSlotHighlight?.(validZones, 'valid')
        }
      }
    }
  }

  /**
   * Start the drag operation
   */
  private startDrag(): void {
    if (!this.dragState.draggedCard || !this.dragState.dragElement) return

    this.dragState.isDragging = true

    // Make original card semi-transparent to show it's being dragged
    this.dragState.dragElement.classList.add('dragging')
    this.dragState.dragElement.style.opacity = '0.4'

    // Create a drag preview element (clone of the card)
    const dragPreview = this.dragState.dragElement.cloneNode(true) as HTMLElement
    dragPreview.id = 'drag-preview'
    dragPreview.classList.remove('dragging')
    dragPreview.classList.add('card-drag-preview')
    dragPreview.style.position = 'fixed'
    dragPreview.style.zIndex = '9999'
    dragPreview.style.pointerEvents = 'none'
    dragPreview.style.opacity = '0.9'
    dragPreview.style.transform = 'scale(1.05) rotate(2deg)'
    dragPreview.style.transition = 'transform 0.1s ease-out'
    dragPreview.style.filter = 'drop-shadow(0 8px 16px rgba(0, 0, 0, 0.4))'

    // Store the preview element
    this.dragState.dragElement.dataset.previewId = 'drag-preview'

    // Add to document body
    document.body.appendChild(dragPreview)

    // Store a reference to the preview for cleanup
    if (!this.dragState.dragElement.dataset.hasPreview) {
      this.dragState.dragElement.dataset.hasPreview = 'true'
    }
  }

  /**
   * End the drag operation
   */
  private endDrag(): void {
    // Remove drag preview if it exists
    const dragPreview = document.getElementById('drag-preview')
    if (dragPreview) {
      dragPreview.remove()
    }

    // Restore original element opacity
    if (this.dragState.dragElement) {
      this.dragState.dragElement.classList.remove('dragging')
      this.dragState.dragElement.style.opacity = ''
      delete this.dragState.dragElement.dataset.hasPreview
      delete this.dragState.dragElement.dataset.previewId
    }

    this.callbacks.onHideTooltip?.()
  }

  /**
   * Update the visual position of the dragged element
   */
  private updateDragVisual(x: number, y: number): void {
    // Update the drag preview position (not the original element)
    const dragPreview = document.getElementById('drag-preview')
    if (!dragPreview) return

    // Position the preview at the cursor position, centered on the cursor
    const offsetX = x - dragPreview.offsetWidth / 2
    const offsetY = y - dragPreview.offsetHeight / 2

    dragPreview.style.left = `${offsetX}px`
    dragPreview.style.top = `${offsetY}px`
  }

  /**
   * Get lane position from screen coordinates
   */
  private getSlotFromPosition(x: number, y: number): BattlefieldPosition | null {
    // This would need to be implemented based on your UI layout
    // For now, returning a placeholder
    const element = document.elementFromPoint(x, y)
    if (element?.hasAttribute('data-player') && element?.hasAttribute('data-slot')) {
      return {
        player: element.getAttribute('data-player') as 'player1' | 'player2',
        slot: Number(element.getAttribute('data-slot')),
      }
    }
    return null
  }

  /**
   * Reset all states
   */
  private resetStates(): void {
    this.resetDragState()
    this.resetClickState()
  }

  /**
   * Reset drag state
   */
  private resetDragState(): void {
    this.dragState = this.createEmptyDragState()
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
      capturedPointerId: null,
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

  /**
   * Handle lane click for empty lanes
   */
  handleSlotClick(position: BattlefieldPosition): void {
    if (this.clickState.selectedCard && this.clickState.selectedPosition === 'hand') {
      // Playing a card from hand to lane
      const canDrop = this.callbacks.canDropOn?.(position, this.clickState.selectedCard, 'hand')

      if (canDrop) {
        this.callbacks.onCardMove?.(this.clickState.selectedCard, 'hand', position)
        this.resetClickState()
        this.callbacks.onClearHighlights?.()
      }
    }
  }

  /**
   * Cancel any ongoing interaction
   */
  cancelInteraction(): void {
    this.endDrag()
    this.resetStates()
    this.callbacks.onClearHighlights?.()
    this.callbacks.onHideTooltip?.()
  }

  /**
   * Get current interaction mode
   */
  getMode(): InteractionMode {
    return this.mode
  }

  /**
   * Check if currently dragging
   */
  isDragging(): boolean {
    return this.dragState.isDragging
  }

  /**
   * Check if a card is selected
   */
  hasSelectedCard(): boolean {
    return this.clickState.selectedCard !== null
  }

  /**
   * Reset the service state (for testing)
   */
  reset(): void {
    this.endDrag()
    this.resetDragState()
    this.resetClickState()
    this.callbacks = {}
  }
}

// Export singleton instance
export const interactionService = new InteractionService()
