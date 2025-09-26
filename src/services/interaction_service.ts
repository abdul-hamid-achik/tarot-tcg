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
  canDropOn?: (to: BattlefieldPosition, card: GameCard, from: BattlefieldPosition | 'hand') => boolean
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
          // Animate the drop
          animationService.animateCardMove(
            this.dragState.draggedCard,
            this.dragState.sourcePosition,
            dropLane,
          )

          // Trigger the move callback
          this.callbacks.onCardMove?.(
            this.dragState.draggedCard,
            this.dragState.sourcePosition,
            dropLane,
          )
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
    if (!this.dragState.draggedCard) return

    this.dragState.isDragging = true

    // Add drag visual class to element
    if (this.dragState.dragElement) {
      this.dragState.dragElement.classList.add('dragging')
      this.dragState.dragElement.style.position = 'fixed'
      this.dragState.dragElement.style.zIndex = '9999'
      this.dragState.dragElement.style.pointerEvents = 'none'
    }
  }

  /**
   * End the drag operation
   */
  private endDrag(): void {
    // Remove drag visual class
    if (this.dragState.dragElement) {
      this.dragState.dragElement.classList.remove('dragging')
      this.dragState.dragElement.style.position = ''
      this.dragState.dragElement.style.zIndex = ''
      this.dragState.dragElement.style.pointerEvents = ''
      this.dragState.dragElement.style.transform = ''
    }

    this.callbacks.onHideTooltip?.()
  }

  /**
   * Update the visual position of the dragged element
   */
  private updateDragVisual(x: number, y: number): void {
    if (!this.dragState.dragElement) return

    const rect = this.dragState.dragElement.getBoundingClientRect()
    const offsetX = x - rect.width / 2
    const offsetY = y - rect.height / 2

    this.dragState.dragElement.style.transform = `translate(${offsetX}px, ${offsetY}px)`
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
}

// Export singleton instance
export const interactionService = new InteractionService()
