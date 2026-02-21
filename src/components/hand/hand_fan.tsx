'use client'

import { GameLogger } from '@/lib/game_logger'
import Image from 'next/image'
import type React from 'react'
import { useRef } from 'react'
import TarotCard from '@/components/tarot_card'
import { cn } from '@/lib/utils'
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

  // Check if we can play cards
  const isOurTurn = gameState?.activePlayer === 'player1'
  const isActionPhase = gameState?.phase === 'action'
  const totalMana = (gameState?.player1?.mana || 0) + (gameState?.player1?.spellMana || 0)

  // Position-specific styles - Improved Hearthstone-style (responsive)
  const positionStyles = {
    'bottom-left': {
      container: 'fixed bottom-4 md:bottom-8 left-1/2 transform -translate-x-1/2',
      transformOrigin: 'center bottom',
      fanDirection: 1, // Normal fan direction
    },
    'top-right': {
      container: 'absolute top-2 md:top-4 right-8 md:right-12',
      transformOrigin: 'center top',
      fanDirection: -1, // Reverse fan direction for enemy
    },
  }

  const positionConfig = positionStyles[position]

  // Calculate fan positioning for each card - Hearthstone-style curve
  const calculateCardPosition = (index: number, totalCards: number) => {
    if (totalCards <= 1) {
      return { angle: 0, translateY: 0, zIndex: 10, marginLeft: '0' }
    }

    // Hearthstone-style fan angles - more aggressive curve for player hand
    const maxAngle = isCurrentPlayer ? 25 : 15 // Degrees
    const angleStep = maxAngle / Math.max(1, totalCards - 1)
    const angle = (index - (totalCards - 1) / 2) * angleStep * positionConfig.fanDirection

    // Hearthstone-style curve - cards lift up towards center
    const curveIntensity = isCurrentPlayer ? 20 : 8 // Pixels
    const normalizedPosition = Math.abs(index - (totalCards - 1) / 2) / ((totalCards - 1) / 2)
    const translateY = curveIntensity * (1 - normalizedPosition) // Center cards higher

    // Z-index: center cards on top, edge cards below
    const centerDistance = Math.abs(index - (totalCards - 1) / 2)
    const zIndex = isCurrentPlayer ? 20 - centerDistance : 10 + index

    // Hearthstone-style card overlap - tighter spacing
    const baseOverlap = isCurrentPlayer ? -20 : -16
    const overlapAmount = totalCards > 6 ? baseOverlap - Math.min(8, totalCards - 6) : baseOverlap

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
      // Deselect if already selected (Hearthstone-style: click to cancel)
      clearSelection()
      GameLogger.debug(`Deselected ${card.name}`)
      return
    }

    // For action phase, select the card for placement (Hearthstone-style)
    const isOurTurn = gameState.activePlayer === 'player1'
    const isAction = gameState.phase === 'action'
    const totalMana = gameState.player1.mana + gameState.player1.spellMana
    const canAfford = card.cost <= totalMana

    if (isOurTurn && isAction && canAfford) {
      // Select the card for click-to-place (Hearthstone-style: click card, then click slot)
      selectCard(card)
      GameLogger.debug(`Selected ${card.name} for placement - click a slot to play`)
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
    const canAfford = card.cost <= totalMana
    const canPlay = isCurrentPlayer && isOurTurn && isActionPhase && canAfford
    const isDragging = interaction.draggedCard?.id === card.id

    return (
      <div
        key={card.id}
        className={cn(
          'flex-shrink-0 cursor-pointer transition-all duration-300 relative',
          position.includes('bottom') ? 'origin-bottom' : 'origin-top',
          // Mulligan selection
          isMulliganSelected && 'ring-2 ring-red-400 ring-opacity-60',
          // Placement selection - prominent highlight
          isPlacementSelected && [
            'ring-4 ring-emerald-400',
            'shadow-xl shadow-emerald-400/40',
            'scale-110',
          ],
          // Playable card indicator
          canPlay && !isPlacementSelected && 'ring-2 ring-emerald-300/50',
          // Can't afford indicator
          !canAfford && isCurrentPlayer && 'opacity-60',
        )}
        style={{
          transform: `rotate(${cardPosition.angle}deg) translateY(${position.includes('bottom') ? '-' : ''}${cardPosition.translateY}px)`,
          zIndex: isPlacementSelected ? 100 : cardPosition.zIndex,
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
        {/* Selection indicator badge */}
        {isPlacementSelected && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-white text-xs px-2 py-0.5 rounded-full font-semibold whitespace-nowrap animate-pulse">
            Click slot to play
          </div>
        )}

        {/* Can't afford indicator */}
        {!canAfford && isCurrentPlayer && (
          <div className="absolute -top-2 right-0 z-50 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
            {card.cost - totalMana}+
          </div>
        )}

        {/* Card Content */}
        {isCurrentPlayer ? (
          <TarotCard
            card={card}
            size="small"
            isSelected={isPlacementSelected}
            draggable={false} // We handle drag through PointerEvents
            className={cn(
              'transition-all duration-200',
              isDragging && 'opacity-40 scale-95',
            )}
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
    <div ref={fanRef} className={cn(positionConfig.container, 'z-20', className)}>
      {/* Hand container with subtle background */}
      <div className={cn(
        'relative flex items-end',
        isCurrentPlayer && 'pb-2',
      )}>
        {/* Card fan */}
        <div
          className="flex"
          style={{ transformOrigin: positionConfig.transformOrigin }}
        >
          {cards.map((card, index) => renderCard(card, index))}
        </div>
      </div>

      {/* Helper text for current player */}
      {isCurrentPlayer && isOurTurn && isActionPhase && !interaction.selectedCard && cards.length > 0 && (
        <div className="text-center mt-2 text-xs text-slate-500 font-medium">
          Click a card to select, then click a slot to play
        </div>
      )}

      {/* Drag preview placeholder */}
      {interaction.draggedCard && isCurrentPlayer && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 pointer-events-none z-50">
          <div className="bg-emerald-100 border-2 border-emerald-400 rounded-lg px-4 py-2 shadow-lg">
            <span className="text-emerald-700 text-sm font-medium">
              Drop on a slot to play
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
