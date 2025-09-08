"use client"

import React, { useRef } from 'react'
import { useGameStore } from '@/store/gameStore'
import { interactionService } from '@/services/InteractionService'
import TarotCard from '@/components/TarotCard'
import type { Card as GameCard } from '@/types/game'

interface HandFanProps {
    cards: GameCard[]
    position: 'bottom-left' | 'top-right'
    isCurrentPlayer?: boolean
    onCardPlay?: (card: GameCard) => void
    onCardDetail?: (card: GameCard) => void
    className?: string
}

export default function HandFan({
    cards,
    position,
    isCurrentPlayer = false,
    onCardPlay,
    onCardDetail,
    className = ''
}: HandFanProps) {
    const fanRef = useRef<HTMLDivElement>(null)
    const { interaction, showCardDetail } = useGameStore()

    // Position-specific styles
    const positionStyles = {
        'bottom-left': {
            container: 'absolute bottom-4 left-4',
            transformOrigin: 'center bottom',
            fanDirection: 1 // Normal fan direction
        },
        'top-right': {
            container: 'absolute top-4 right-4',
            transformOrigin: 'center top',
            fanDirection: -1 // Reverse fan direction for enemy
        }
    }

    const positionConfig = positionStyles[position]

    // Calculate fan positioning for each card
    const calculateCardPosition = (index: number, totalCards: number) => {
        const maxAngle = totalCards > 1 ? Math.min(isCurrentPlayer ? 60 : 50, totalCards * 12) : 0
        const angleStep = totalCards > 1 ? maxAngle / Math.max(1, totalCards - 1) : 0
        const angle = totalCards > 1 ? (index - (totalCards - 1) / 2) * angleStep * positionConfig.fanDirection : 0

        // More pronounced curve for current player, subtle for opponent
        const curveIntensity = isCurrentPlayer ? 0.8 : 0.3
        const translateY = Math.abs(angle) * curveIntensity

        // Z-index management - current player increases with index, enemy decreases
        const zIndex = isCurrentPlayer ? index : totalCards - index

        // Overlap amount
        const overlapAmount = isCurrentPlayer ? -12 : -8

        return {
            angle,
            translateY,
            zIndex,
            marginLeft: index > 0 ? `${overlapAmount}px` : '0'
        }
    }

    // Handle card interactions
    const handleCardClick = (card: GameCard) => {
        if (isCurrentPlayer) {
            onCardPlay?.(card)
        }
    }

    const handleCardRightClick = (card: GameCard, event: React.MouseEvent) => {
        event.preventDefault()
        if (isCurrentPlayer) {
            onCardDetail?.(card)
            showCardDetail(card)
        }
    }

    const handleCardPointerDown = (
        card: GameCard,
        index: number,
        cardElement: HTMLElement,
        event: React.PointerEvent
    ) => {
        if (!isCurrentPlayer) return

        // Convert React PointerEvent to native PointerEvent for InteractionService
        const nativeEvent = new PointerEvent('pointerdown', {
            clientX: event.clientX,
            clientY: event.clientY,
            pointerId: event.pointerId,
            pointerType: event.pointerType as "mouse" | "pen" | "touch"
        })

        // Handle drag initiation through InteractionService
        interactionService.handlePointerDown(nativeEvent, card, 'hand', cardElement)
    }

    // Handle card hover effects
    const handleCardMouseEnter = (cardElement: HTMLElement, cardPosition: { angle: number; translateY: number; zIndex: number }) => {
        if (!isCurrentPlayer) return

        const { translateY } = cardPosition

        // Animate to hover state
        cardElement.style.transform = `rotate(0deg) translateY(-${translateY + 30}px) scale(1.15)`
        cardElement.style.zIndex = '100'
        cardElement.style.transition = 'transform 0.2s ease-out'
    }

    const handleCardMouseLeave = (cardElement: HTMLElement, cardPosition: { angle: number; translateY: number; zIndex: number }) => {
        if (!isCurrentPlayer) return

        const { angle, translateY } = cardPosition

        // Return to original position
        cardElement.style.transform = `rotate(${angle}deg) translateY(-${translateY}px) scale(1)`
        cardElement.style.zIndex = String(cardPosition.zIndex)
        cardElement.style.transition = 'transform 0.2s ease-out'
    }

    // Check if card is selected for mulligan
    const isSelectedForMulligan = (): boolean => {
        // This would integrate with mulligan state from the store
        return false
    }

    // Render individual card
    const renderCard = (card: GameCard, index: number) => {
        const totalCards = cards.length
        const cardPosition = calculateCardPosition(index, totalCards)
        const isSelected = isSelectedForMulligan()

        return (
            <div
                key={card.id}
                className={`flex-shrink-0 cursor-pointer transition-all duration-300 origin-${position.includes('bottom') ? 'bottom' : 'top'} ${isSelected ? 'ring-2 ring-red-400 ring-opacity-60' : ''
                    }`}
                style={{
                    transform: `rotate(${cardPosition.angle}deg) translateY(${position.includes('bottom') ? '-' : ''}${cardPosition.translateY}px)`,
                    zIndex: cardPosition.zIndex,
                    marginLeft: cardPosition.marginLeft
                }}
                onClick={() => handleCardClick(card)}
                onContextMenu={(e) => handleCardRightClick(card, e)}
                onPointerDown={(e) => {
                    const cardElement = e.currentTarget as HTMLElement
                    handleCardPointerDown(card, index, cardElement, e)
                }}
                onMouseEnter={(e) => {
                    const cardElement = e.currentTarget as HTMLElement
                    handleCardMouseEnter(cardElement, cardPosition)
                }}
                onMouseLeave={(e) => {
                    const cardElement = e.currentTarget as HTMLElement
                    handleCardMouseLeave(cardElement, cardPosition)
                }}
            >
                {/* Card Content */}
                {isCurrentPlayer ? (
                    <TarotCard
                        card={card}
                        size="small"
                        isSelected={isSelected}
                        draggable={false} // We handle drag through PointerEvents
                    />
                ) : (
                    /* Enemy card back */
                    <div className="w-16 h-24 relative shadow-lg">
                        <img
                            src="/default/back/2x.png"
                            alt="Card Back"
                            className="w-full h-full object-cover rounded-lg border-2 border-slate-400"
                            style={{
                                boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
                            }}
                        />
                    </div>
                )}
            </div>
        )
    }

    // Don't render if no cards
    if (cards.length === 0) {
        return null
    }

    return (
        <div
            ref={fanRef}
            className={`${positionConfig.container} z-20 ${className}`}
        >
            <div
                className="flex gap-1"
                style={{ transformOrigin: positionConfig.transformOrigin }}
            >
                {cards.map((card, index) => renderCard(card, index))}
            </div>

            {/* Hand count indicator for current player */}
            {isCurrentPlayer && cards.length > 0 && (
                <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-slate-700/90 text-slate-300 text-xs px-2 py-1 rounded">
                    {cards.length} cards
                </div>
            )}

            {/* Drag preview placeholder */}
            {interaction.draggedCard && isCurrentPlayer && (
                <div className="absolute inset-0 pointer-events-none">
                    <div className="w-20 h-32 border-2 border-dashed border-blue-400 rounded-lg bg-blue-900/10 flex items-center justify-center">
                        <span className="text-blue-400 text-xs">Dragging...</span>
                    </div>
                </div>
            )}

            {/* Development helper - show hand position */}
            {process.env.NODE_ENV === 'development' && (
                <div className="absolute top-0 left-0 text-xs text-slate-500 opacity-50">
                    {position} ({cards.length})
                </div>
            )}
        </div>
    )
}
