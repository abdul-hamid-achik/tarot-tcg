"use client"

import React, { useEffect, useRef, useState } from 'react'
import { useGameStore, type CellPosition, type CellType, createCellKey } from '@/store/gameStore'
import { interactionService } from '@/services/InteractionService'
import { animationService } from '@/services/AnimationService'
import TarotCard from '@/components/TarotCard'

interface GridCellProps {
    position: CellPosition
    cellType: CellType
    className?: string
}

export default function GridCell({ position, cellType, className = '' }: GridCellProps) {
    const cellRef = useRef<HTMLDivElement>(null)
    const [isHovered, setIsHovered] = useState(false)
    const [isHighlighted, setIsHighlighted] = useState(false)
    const [highlightType, setHighlightType] = useState<'valid' | 'invalid' | 'selected' | 'hover'>('valid')

    const {
        grid,
        interaction,
        setHoveredCell
    } = useGameStore()

    const cellKey = createCellKey(position)
    const card = grid.cells.get(cellKey) || null
    const isValidDropZone = grid.validDropZones.has(cellKey)
    const isHighlightedCell = grid.highlightedCells.has(cellKey)

    // Handle hover states
    const handleMouseEnter = () => {
        setIsHovered(true)
        setHoveredCell(position)

        if (interaction.draggedCard) {
            interactionService.handleCellHover(position)
        } else if (card) {
            // Show hover effect for cards
            if (cellRef.current) {
                animationService.animateCellHighlight(cellRef.current, 'hover')
            }
        }
    }

    const handleMouseLeave = () => {
        setIsHovered(false)
        setHoveredCell(null)

        if (!interaction.draggedCard) {
            interactionService.handleCellHover(null)
        }
    }

    // Handle clicks
    const handleClick = (event: React.MouseEvent) => {
        event.preventDefault()

        if (card && isPlayerControlled()) {
            // Click on player's card
            const element = cellRef.current?.querySelector('.tarot-card') as HTMLElement
            if (element) {
                interactionService.handlePointerDown(
                    new PointerEvent('pointerdown', {
                        clientX: event.clientX,
                        clientY: event.clientY,
                        pointerId: 1,
                        pointerType: 'mouse'
                    }),
                    card,
                    position,
                    element
                )
            }
        } else if (!card && isValidDropZone && interaction.selectedCards.size > 0) {
            // Click on valid drop zone with selected card  
            const selectedCardId = Array.from(interaction.selectedCards)[0]
            // Handle card move via click interface
            console.log('Move card via click:', selectedCardId, 'to', position)
        }
    }

    // Handle drag and drop
    const handleDragOver = (event: React.DragEvent) => {
        if (isValidDropZone) {
            event.preventDefault()
        }
    }

    const handleDrop = (event: React.DragEvent) => {
        event.preventDefault()
        if (isValidDropZone && interaction.draggedCard) {
            // Handle drop operation
            console.log('Drop card:', interaction.draggedCard, 'at', position)
        }
    }

    // Update highlight state based on store
    useEffect(() => {
        setIsHighlighted(isHighlightedCell)

        if (isValidDropZone) {
            setHighlightType('valid')
        } else if (interaction.hoveredCell &&
            interaction.hoveredCell.row === position.row &&
            interaction.hoveredCell.col === position.col) {
            setHighlightType('hover')
        }
    }, [isHighlightedCell, isValidDropZone, interaction.hoveredCell, position])

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
        let baseStyles = 'h-[100px] border-2 border-dashed rounded-lg flex items-center justify-center text-xs transition-all duration-200 cursor-pointer relative'

        // Cell type specific styles
        switch (cellType) {
            case 'enemy_bench':
                baseStyles += ' border-slate-500 bg-slate-700/20'
                break
            case 'enemy_attack':
                baseStyles += ' border-red-500/50 bg-red-900/10'
                break
            case 'player_attack':
                baseStyles += ' border-blue-500/50 bg-blue-900/10'
                break
            case 'player_bench':
                baseStyles += ' border-slate-500 bg-slate-700/20'
                break
        }

        // State-specific styles
        if (isHighlighted || isHovered) {
            switch (highlightType) {
                case 'valid':
                    baseStyles += ' border-green-400 bg-green-900/20 shadow-lg shadow-green-400/20'
                    break
                case 'invalid':
                    baseStyles += ' border-red-400 bg-red-900/20 shadow-lg shadow-red-400/20'
                    break
                case 'selected':
                    baseStyles += ' border-blue-400 bg-blue-900/20 shadow-lg shadow-blue-400/20'
                    break
                case 'hover':
                    baseStyles += ' border-purple-400/60 bg-purple-900/10 shadow-md shadow-purple-400/10'
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
            className={`${getCellStyles()} ${className}`}
            data-grid-cell={cellKey}
            data-cell-type={cellType}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {card ? (
                <div className="tarot-card w-full h-full flex items-center justify-center p-1">
                    <TarotCard
                        card={card}
                        size="small"
                        isSelected={interaction.selectedCards.has(card.id)}
                        isDamaged={card.currentHealth !== undefined && card.currentHealth < card.health}
                    />
                </div>
            ) : (
                <span className="text-slate-500 text-xs select-none">
                    {getPlaceholderText()}
                </span>
            )}

            {/* Drop zone indicator */}
            {canAcceptDrop() && (
                <div className="absolute inset-0 border-2 border-dashed border-green-400 rounded opacity-50 animate-pulse" />
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
