'use client'

import Image from 'next/image'
import type React from 'react'
import { useRef } from 'react'
import TarotCard from '@/components/tarot_card'
import type { Card as GameCard } from '@/schemas/schema'
import { interactionService } from '@/services/interaction_service'
import { useGameStore } from '@/store/game_store'

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
  className = '',
}: HandFanProps) {
  const fanRef = useRef<HTMLDivElement>(null)
  const { interaction, showCardDetail, gameState } = useGameStore()

  // Position-specific styles
  const positionStyles = {
    'bottom-left': {
      container: 'absolute bottom-4 left-4',
      transformOrigin: 'center bottom',
      fanDirection: 1, // Normal fan direction
    },
    'top-right': {
      container: 'absolute top-4 right-4',
      transformOrigin: 'center top',
      fanDirection: -1, // Reverse fan direction for enemy
    },
  }

  const positionConfig = positionStyles[position]

  // Calculate fan positioning for each card - Improved for better UX
  const calculateCardPosition = (index: number, totalCards: number) => {
    // Adaptive angle calculation based on card count for optimal readability
    const maxAngle =
      totalCards > 1 ? Math.min(isCurrentPlayer ? 80 : 60, Math.max(40, totalCards * 8)) : 0
    const angleStep = totalCards > 1 ? maxAngle / Math.max(1, totalCards - 1) : 0
    const angle =
      totalCards > 1 ? (index - (totalCards - 1) / 2) * angleStep * positionConfig.fanDirection : 0

    // Responsive curve intensity based on screen size and card count
    const baseCurveIntensity = isCurrentPlayer ? 1.0 : 0.4
    const cardCountAdjustment = Math.min(1.0, totalCards / 8) // Reduce curve for many cards
    const curveIntensity = baseCurveIntensity * cardCountAdjustment
    const translateY = Math.abs(angle) * curveIntensity

    // Smart z-index for better card visibility
    const zIndex = isCurrentPlayer ? index + 10 : totalCards - index + 10

    // Dynamic overlap based on card count - less overlap with more cards
    const baseOverlap = isCurrentPlayer ? -16 : -12
    const overlapAdjustment = Math.min(0, Math.max(-8, (8 - totalCards) * 2))
    const overlapAmount = baseOverlap + overlapAdjustment

    return {
      angle,
      translateY,
      zIndex,
      marginLeft: index > 0 ? `${overlapAmount}px` : '0',
    }
  }

  // Handle card interactions
  const handleCardClick = (card: GameCard) => {
    if (!isCurrentPlayer) return
    if (!gameState) return

    const { selectCard, clearSelection, interaction } = useGameStore.getState()

    // Check if card is already selected
    const isSelected = interaction.selectedCard?.id === card.id

    if (isSelected) {
      // Deselect if already selected
      clearSelection()
      return
    }

    // For action phase, select the card for placement (all card types)
    const isOurTurn = gameState.activePlayer === 'player1'
    const isAction = gameState.phase === 'action'
    const totalMana = gameState.player1.mana + gameState.player1.spellMana
    const canAfford = card.cost <= totalMana

    if (isOurTurn && isAction && canAfford) {
      // Select the card for click-to-place (works for all card types)
      selectCard(card)
      console.log(`Selected ${card.name} for placement`)
      return
    }

    // If can't afford or wrong phase/turn, show card details
    onCardDetail?.(card)
    showCardDetail(card)
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
    _index: number,
    cardElement: HTMLElement,
    event: React.PointerEvent,
  ) => {
    if (!isCurrentPlayer) return

    event.preventDefault()
    event.stopPropagation()

    // Convert React PointerEvent to native PointerEvent for InteractionService
    const nativeEvent = new PointerEvent('pointerdown', {
      clientX: event.clientX,
      clientY: event.clientY,
      pointerId: event.pointerId,
      pointerType: event.pointerType as 'mouse' | 'pen' | 'touch',
      bubbles: true,
      cancelable: true,
    })

    // Handle drag initiation through InteractionService (it will gate by phase/turn)
    interactionService.handlePointerDown(nativeEvent, card, 'hand', cardElement)
  }

  // Handle card hover effects - Enhanced for better UX with drag awareness
  const handleCardMouseEnter = (
    cardElement: HTMLElement,
    cardPosition: { angle: number; translateY: number; zIndex: number },
  ) => {
    if (!isCurrentPlayer || interactionService.isDragging()) return

    const { translateY } = cardPosition

    // Store original values for restoration
    cardElement.dataset.originalTransform = cardElement.style.transform
    cardElement.dataset.originalZIndex = cardElement.style.zIndex
    cardElement.dataset.originalFilter = cardElement.style.filter
    cardElement.dataset.originalBoxShadow = cardElement.style.boxShadow

    // Enhanced hover state with better visibility and smooth animation
    cardElement.style.transform = `rotate(0deg) translateY(-${translateY + 40}px) scale(1.2)`
    cardElement.style.zIndex = '1000' // Ensure it's above everything
    cardElement.style.transition =
      'transform 0.25s cubic-bezier(0.4, 0.0, 0.2, 1), filter 0.15s ease-out, box-shadow 0.15s ease-out'
    cardElement.style.filter =
      'brightness(1.1) saturate(1.1) drop-shadow(0 4px 8px rgba(255,255,255,0.1))' // Subtle highlight
    cardElement.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)' // Enhanced shadow
    cardElement.style.cursor = 'grab'
  }

  const handleCardMouseLeave = (
    cardElement: HTMLElement,
    cardPosition: { angle: number; translateY: number; zIndex: number },
  ) => {
    if (!isCurrentPlayer || interactionService.isDragging()) return

    const { angle, translateY } = cardPosition

    // Smooth return to original position using stored values
    const originalTransform =
      cardElement.dataset.originalTransform ||
      `rotate(${angle}deg) translateY(-${translateY}px) scale(1)`
    const originalZIndex = cardElement.dataset.originalZIndex || String(cardPosition.zIndex)
    const originalFilter = cardElement.dataset.originalFilter || 'none'
    const originalBoxShadow = cardElement.dataset.originalBoxShadow || '0 4px 8px rgba(0,0,0,0.3)'

    cardElement.style.transform = originalTransform
    cardElement.style.zIndex = originalZIndex
    cardElement.style.transition =
      'transform 0.25s cubic-bezier(0.4, 0.0, 0.2, 1), filter 0.15s ease-out, box-shadow 0.15s ease-out'
    cardElement.style.filter = originalFilter
    cardElement.style.boxShadow = originalBoxShadow
    cardElement.style.cursor = 'pointer'

    // Clean up stored values
    delete cardElement.dataset.originalTransform
    delete cardElement.dataset.originalZIndex
    delete cardElement.dataset.originalFilter
    delete cardElement.dataset.originalBoxShadow
  }

  // Check if card is selected for mulligan
  const isSelectedForMulligan = (): boolean => {
    // This would integrate with mulligan state from the store
    return false
  }

  // Check if card is selected for placement
  const isSelectedForPlacement = (cardId: string): boolean => {
    return interaction.selectedCard?.id === cardId
  }

  // Render individual card
  const renderCard = (card: GameCard, index: number) => {
    const totalCards = cards.length
    const cardPosition = calculateCardPosition(index, totalCards)
    const isMulliganSelected = isSelectedForMulligan()
    const isPlacementSelected = isSelectedForPlacement(card.id)

    return (
      <div
        key={card.id}
        className={`flex-shrink-0 cursor-pointer transition-all duration-300 origin-${position.includes('bottom') ? 'bottom' : 'top'} ${isMulliganSelected ? 'ring-2 ring-red-400 ring-opacity-60' : ''
          } ${isPlacementSelected
            ? 'ring-2 ring-blue-400 ring-opacity-80 shadow-lg shadow-blue-400/30'
            : ''
          }`}
        style={{
          transform: `rotate(${cardPosition.angle}deg) translateY(${position.includes('bottom') ? '-' : ''}${cardPosition.translateY}px)`,
          zIndex: cardPosition.zIndex,
          marginLeft: cardPosition.marginLeft,
        }}
        onClick={() => handleCardClick(card)}
        onContextMenu={e => handleCardRightClick(card, e)}
        onPointerDown={e => {
          const cardElement = e.currentTarget as HTMLElement
          handleCardPointerDown(card, index, cardElement, e)
        }}
        onPointerMove={e => {
          // Prevent default to avoid triggering drag on other elements
          if (interactionService.isDragging()) {
            e.preventDefault()
          }
        }}
        onPointerUp={e => {
          // Clean up any hover states when pointer is released
          if (!interactionService.isDragging()) {
            const cardElement = e.currentTarget as HTMLElement
            handleCardMouseLeave(cardElement, cardPosition)
          }
        }}
        onMouseEnter={e => {
          const cardElement = e.currentTarget as HTMLElement
          handleCardMouseEnter(cardElement, cardPosition)
        }}
        onMouseLeave={e => {
          const cardElement = e.currentTarget as HTMLElement
          handleCardMouseLeave(cardElement, cardPosition)
        }}
      >
        {/* Card Content */}
        {isCurrentPlayer ? (
          <TarotCard
            card={card}
            size="small"
            isSelected={isPlacementSelected}
            draggable={false} // We handle drag through PointerEvents
            className={`transition-all duration-200 ${interaction.draggedCard?.id === card.id ? 'opacity-50' : ''}`}
          />
        ) : (
          /* Enemy card back */
          <div className="w-16 h-24 relative shadow-lg">
            <Image
              src="/default/back/2x.png"
              width={32}
              height={48}
              alt="Card Back"
              className="w-full h-full object-cover rounded-lg border-2 border-slate-400"
              style={{
                boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
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
    <div ref={fanRef} className={`${positionConfig.container} z-20 ${className}`}>
      <div className="flex gap-1" style={{ transformOrigin: positionConfig.transformOrigin }}>
        {cards.map((card, index) => renderCard(card, index))}
      </div>

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
