'use client'

import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import TarotCard from '@/components/tarot_card'
import { animationService } from '@/services/animation_service'
import { stateManager } from '@/services/state_manager'
import { interactionService } from '@/services/interaction_service'
import { type CellPosition, type CellType, createCellKey, useGameStore } from '@/store/game_store'

interface GridCellProps {
  position: CellPosition
  cellType: CellType
  className?: string
}

export default function GridCell({ position, cellType, className = '' }: GridCellProps) {
  const cellRef = useRef<HTMLDivElement>(null)
  const [isHovered, setIsHovered] = useState(false)
  const [isHighlighted, setIsHighlighted] = useState(false)
  const [highlightType, setHighlightType] = useState<'valid' | 'invalid' | 'selected' | 'hover'>(
    'valid',
  )

  // Track click timestamps for double-click detection
  const cardClickTimestamps = useRef<Map<string, number>>(new Map())

  const { gameState, grid, interaction, setHoveredCell, assignDefender, removeDefenderAssignment } =
    useGameStore()

  const cellKey = createCellKey(position)
  // Re-read card content whenever gameState changes to ensure visual updates
  const card = gameState ? stateManager.getCardAtPosition(position) || null : null
  const isValidDropZone = grid.validDropZones.has(cellKey)
  const isHighlightedCell = grid.highlightedCells.has(cellKey)

  // Handle hover states with improved drag awareness
  const handleMouseEnter = () => {
    setIsHovered(true)
    setHoveredCell(position)

    if (interactionService.isDragging()) {
      interactionService.handleCellHover(position)
      // Add visual feedback for valid/invalid drop zones
      if (cellRef.current) {
        const validPositions = getValidDropPositions()
        const isValidDrop = validPositions.includes(cellKey)
        if (isValidDrop) {
          cellRef.current.classList.add('valid-drop-target')
        } else {
          cellRef.current.classList.add('invalid-drop-target')
        }
      }
    } else if (card) {
      // Show hover effect for cards when not dragging
      if (cellRef.current) {
        animationService.animateCellHighlight(cellRef.current, 'hover')
      }
    }
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    setHoveredCell(null)

    // Clean up hover classes
    if (cellRef.current) {
      cellRef.current.classList.remove('valid-drop-target', 'invalid-drop-target')
    }

    if (!interactionService.isDragging()) {
      interactionService.handleCellHover(null)
    }
  }

  // Helper to get valid drop positions
  const getValidDropPositions = () => {
    if (!interactionService.isDragging()) return []
    const dragState = interactionService.getDragState()
    if (!dragState.draggedCard || !dragState.sourcePosition) return []
    // Let InteractionService/host provide the actual valid targets
    return Array.from(grid.validDropZones)
  }

  // Handle clicks
  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault()

    if (gameState?.phase === 'declare_defenders' && gameState?.activePlayer === 'player1') {
      // Handle defender assignment
      if (cellType === 'player_bench' && card) {
        // Clicking on player's bench unit during defend phase - assign as defender
        const attackingLanes = (gameState?.lanes || [])
          .map((lane, index) => ({ lane, index }))
          .filter(({ lane }) => lane.attacker && !lane.defender)

        if (attackingLanes.length > 0) {
          // Assign to first available lane (or let player click on lane to specify)
          const laneIndex = attackingLanes[0].index
          assignDefender(laneIndex, card.id)
          console.log(`Assigned ${card.name} to defend lane ${laneIndex}`)
        }
      } else if (cellType === 'enemy_attack' || cellType === 'player_attack') {
        // Clicking on attack lane with an attacker - assign defender if we have one selected
        const laneIndex = position.col
        const lane = gameState?.lanes?.[laneIndex]

        if (lane?.attacker) {
          if (lane.defender) {
            // Remove existing defender assignment
            removeDefenderAssignment(laneIndex)
          } else {
            // Could trigger defender selection UI here
            console.log(`Lane ${laneIndex} needs a defender`)
          }
        }
      }
      return
    }

    if (card && isPlayerControlled()) {
      // Handle double-click for card detail overlay
      const now = Date.now()
      const lastClick = cardClickTimestamps.current.get(card.id) || 0

      if (now - lastClick < 300) { // Double-click detected (300ms window)
        console.log(`Double-clicked on card ${card.name} - showing detail overlay`)
        const { showCardDetail } = useGameStore.getState()
        showCardDetail(card)
        return
      }

      // Store click timestamp for double-click detection
      cardClickTimestamps.current.set(card.id, now)

      // Check if we're in action phase and this is a bench unit that can be selected
      if (gameState?.phase === 'action' && cellType === 'player_bench' && card.type === 'unit') {
        // Select/deselect bench unit for movement to attack row
        const { selectCard, deselectCard, interaction } = useGameStore.getState()
        const isSelected = interaction.selectedCards.has(card.id)
        
        if (isSelected) {
          deselectCard(card.id)
          console.log(`Deselected bench unit ${card.name}`)
        } else {
          // Clear any other selections and select this card
          const { clearSelection } = useGameStore.getState()
          clearSelection()
          selectCard(card.id)
          console.log(`Selected bench unit ${card.name} for attack positioning`)
        }
        return
      }

      // Handle clicking cards in attack/defense lanes to move them back to bench
      if ((cellType === 'player_attack') &&
          (gameState?.phase === 'declare_attackers' || gameState?.phase === 'action')) {
        console.log(`Clicked on attack lane unit ${card.name} - moving back to bench`)
        // This would need a function to move units from lanes back to bench
        // For now, just select/deselect
        const { selectCard, deselectCard, interaction } = useGameStore.getState()
        const isSelected = interaction.selectedCards.has(card.id)

        if (isSelected) {
          deselectCard(card.id)
        } else {
          selectCard(card.id)
        }
        return
      }

      // Normal drag interaction for other cases
      const element = cellRef.current?.querySelector('.tarot-card') as HTMLElement
      if (element) {
        interactionService.handlePointerDown(
          new PointerEvent('pointerdown', {
            clientX: event.clientX,
            clientY: event.clientY,
            pointerId: 1,
            pointerType: 'mouse',
          }),
          card,
          position,
          element,
        )
      }
    } else if (!card && interaction.selectedCards.size > 0) {
      // Click on empty cell with selected cards - attempt to place the first one
      const selectedCardId = Array.from(interaction.selectedCards)[0]
      const selectedCard = gameState?.player1.hand.find(c => c.id === selectedCardId) ||
                          gameState?.player1.bench.find(c => c.id === selectedCardId)
      
      if (selectedCard) {
        console.log(`Attempting to place selected card ${selectedCard.name} at ${position.row},${position.col}`)
        
        // Check if card is from hand
        const isFromHand = gameState?.player1.hand.some(c => c.id === selectedCard.id)

        if (selectedCard.type === 'unit') {
          // For bench placement (player bench only) - any bench cell works
          if (cellType === 'player_bench' && isFromHand) {
            // Play unit from hand to bench using interaction service
            if (interactionService.callbacks.onCardMove) {
              interactionService.callbacks.onCardMove(selectedCard, 'hand', { row: 3, col: 2 })
              console.log(`Playing ${selectedCard.name} from hand to bench via interaction service`)
            } else {
              console.error('No onCardMove callback available')
            }

            // Clear selection after action
            const { clearSelection } = useGameStore.getState()
            clearSelection()
          }
        } else if (selectedCard.type === 'spell' && isFromHand) {
          // For spells, clicking anywhere plays the spell immediately
          if (interactionService.callbacks.onCardMove) {
            interactionService.callbacks.onCardMove(selectedCard, 'hand', position)
            console.log(`Playing spell ${selectedCard.name}`)
          }

          // Clear selection after action
          const { clearSelection } = useGameStore.getState()
          clearSelection()
        }

        // For attack row placement during attack phase (for units from bench)
        if (selectedCard.type === 'unit' && cellType === 'player_attack' && gameState?.phase === 'action') {
          // Check if the selected card is from the bench
          const benchCard = gameState?.player1.bench.find(c => c.id === selectedCard.id)
          if (benchCard) {
            // Move unit from bench to attack position
            console.log(`Moving ${selectedCard.name} from bench to attack position`)
            // This would require a new game logic function to move units within the field
            // For now, log the intent
            const { clearSelection } = useGameStore.getState()
            clearSelection()
          }
        }
      }
    }
  }

  // Handle drag and drop with better feedback
  const handleDragOver = (event: React.DragEvent) => {
    if (isValidDropZone || canAcceptDrop()) {
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
    } else {
      event.dataTransfer.dropEffect = 'none'
    }
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()

    if ((isValidDropZone || canAcceptDrop()) && interaction.draggedCard) {
      // Let InteractionService finish the drag; visuals only here
      // Add visual feedback for successful drop
      if (cellRef.current) {
        cellRef.current.classList.add('successful-drop')
        setTimeout(() => {
          cellRef.current?.classList.remove('successful-drop')
        }, 300)
      }
    }
  }

  // Handle pointer events for card dragging
  const handlePointerDown = (event: React.PointerEvent) => {
    if (card && isPlayerControlled()) {
      const cardElement = cellRef.current?.querySelector('.tarot-card') as HTMLElement
      if (cardElement) {
        // Convert to native PointerEvent
        const nativeEvent = new PointerEvent('pointerdown', {
          clientX: event.clientX,
          clientY: event.clientY,
          pointerId: event.pointerId,
          pointerType: event.pointerType as 'mouse' | 'pen' | 'touch',
          bubbles: true,
          cancelable: true,
        })

        interactionService.handlePointerDown(nativeEvent, card, position, cardElement)
      }
    }
  }

  // Update highlight state based on store
  useEffect(() => {
    setIsHighlighted(isHighlightedCell)

    if (isValidDropZone) {
      setHighlightType('valid')
    } else if (
      interaction.hoveredCell &&
      interaction.hoveredCell.row === position.row &&
      interaction.hoveredCell.col === position.col
    ) {
      setHighlightType('hover')
    }
  }, [isHighlightedCell, isValidDropZone, interaction.hoveredCell, position])

  // Force re-render when game state changes to update card content
  useEffect(() => {
    // This effect will trigger when gameState changes, causing the component to re-render
    // and fetch the updated card content from stateManager
  }, [])

  // Check if this cell is player-controlled
  const isPlayerControlled = (): boolean => {
    return cellType === 'player_bench' || cellType === 'player_attack'
  }

  // Check if cell is empty and can accept drops
  const canAcceptDrop = (): boolean => {
    return !card && isValidDropZone && isPlayerControlled()
  }

  // Get cell styling based on type and state
  const getCellStyles = (): string => {
    let baseStyles =
      'h-[120px] rounded-lg flex items-center justify-center text-xs transition-all duration-200 cursor-pointer relative'

    // Cell type specific styles
    switch (cellType) {
      case 'enemy_bench':
        // Hide bench cell borders - just background
        baseStyles += ' bg-transparent'
        break
      case 'enemy_attack':
        baseStyles += ' border-2 border-dashed border-gray-500/50 bg-gray-200/10 hover:scale-[1.02]'
        break
      case 'player_attack':
        baseStyles += ' border-2 border-dashed border-gray-600/50 bg-gray-200/10 hover:scale-[1.02]'
        break
      case 'player_bench':
        // Hide bench cell borders - just background
        baseStyles += ' bg-transparent'
        break
    }

    // State-specific styles
    if (isHighlighted || isHovered) {
      switch (highlightType) {
        case 'valid':
          baseStyles += ' border-gray-800 bg-gray-200/20 shadow-lg shadow-gray-500/20'
          break
        case 'invalid':
          baseStyles += ' border-gray-700 bg-gray-300/20 shadow-lg shadow-gray-500/20'
          break
        case 'selected':
          baseStyles += ' border-black bg-gray-200/20 shadow-lg shadow-gray-600/20'
          break
        case 'hover':
          baseStyles += ' border-gray-600/60 bg-gray-100/10 shadow-md shadow-gray-400/10'
          break
      }
    }

    if (canAcceptDrop()) {
      baseStyles += ' hover:scale-105'
    }

    return baseStyles
  }

  // Get placeholder text for empty cells
  const getPlaceholderText = (): string => {
    if (card) return ''

    switch (cellType) {
      case 'enemy_bench':
        return 'Enemy'
      case 'enemy_attack':
        return 'Attack'
      case 'player_attack':
        return 'Attack'
      case 'player_bench':
        return 'Bench'
      default:
        return 'Empty'
    }
  }

  return (
    <div
      ref={cellRef}
      role="button"
      tabIndex={0}
      className={`${getCellStyles()} ${className}`}
      data-grid-cell={cellKey}
      data-cell-type={cellType}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleClick(e as unknown as React.MouseEvent)
        }
      }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onPointerDown={handlePointerDown}
    >
      {card ? (
        <div
          className="tarot-card w-full h-full flex items-center justify-center p-2"
          data-card-id={card.id}
        >
          <TarotCard
            card={card}
            size="battlefield"
            isSelected={interaction.selectedCards.has(card.id)}
            isDamaged={card.currentHealth !== undefined && card.currentHealth < card.health}
          />
        </div>
      ) : (
        <span className="text-gray-600 text-xs select-none">{getPlaceholderText()}</span>
      )}

      {/* Drop zone indicator with improved styling */}
      {canAcceptDrop() && (
        <div className="absolute inset-0 border-2 border-dashed border-green-400 rounded opacity-50 animate-pulse bg-green-50/10" />
      )}

      {/* Drag hover effects */}
      {interactionService.isDragging() && isHovered && (
        <div className="absolute inset-0 rounded transition-all duration-150">
          {getValidDropPositions().includes(cellKey) ? (
            <div className="w-full h-full border-2 border-green-400 rounded bg-green-400/20 animate-pulse" />
          ) : (
            <div className="w-full h-full border-2 border-red-400 rounded bg-red-400/20 animate-pulse" />
          )}
        </div>
      )}

      {/* Selection indicator */}
      {card && interaction.selectedCards.has(card.id) && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
      )}

      {/* Position debug info (remove in production) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-0 left-0 text-xs text-slate-400 opacity-50">
          {position.row}-{position.col}
        </div>
      )}
    </div>
  )
}
