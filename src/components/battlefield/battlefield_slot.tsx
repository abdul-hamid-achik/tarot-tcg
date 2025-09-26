'use client'

import type React from 'react'
import { useCallback } from 'react'
import { useGameStore } from '@/store/game_store'
import { useGameActions } from '@/hooks/use_game_actions'
import { GameCard } from '@/components/game_card'
import type { Card } from '@/schemas/schema'
import type { BattlefieldPosition } from '@/services/battlefield_service'
import { cn } from '@/lib/utils'

interface BattlefieldSlotProps {
  position: BattlefieldPosition
  card: Card | null
  isHighlighted: boolean
  isValidDropZone: boolean
  isHovered: boolean
  canInteract: boolean
  isEmpty: boolean
}

export function BattlefieldSlot({
  position,
  card,
  isHighlighted,
  isValidDropZone,
  isHovered,
  canInteract,
  isEmpty,
}: BattlefieldSlotProps) {
  const {
    interaction,
    setHoveredSlot,
    endCardDrag,
  } = useGameStore()
  const { playCard } = useGameActions()

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (isValidDropZone && isEmpty) {
      e.preventDefault()
      setHoveredSlot(position)
    }
  }, [isValidDropZone, isEmpty, position, setHoveredSlot])

  const handleDragLeave = useCallback(() => {
    setHoveredSlot(null)
  }, [setHoveredSlot])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    if (isValidDropZone && interaction.draggedCard && isEmpty) {
      console.log('🎮 [Drag&Drop] Dropping card at slot:', position)
      try {
        await playCard(interaction.draggedCard, position)
        console.log('🎮 [Drag&Drop] Successfully played card via drag&drop')
      } catch (error) {
        console.error('🎮 [Drag&Drop] Failed to play card:', error)
      }
    }
    setHoveredSlot(null)
    endCardDrag()
  }, [isValidDropZone, interaction.draggedCard, isEmpty, position, setHoveredSlot, endCardDrag, playCard])

  const handleSlotClick = useCallback(async () => {
    if (isEmpty && interaction.selectedCards.size > 0) {
      // Playing a card from hand via click-then-click
      console.log('🎮 [Click-to-Play] Playing card to slot:', position)
      const selectedCardIds = Array.from(interaction.selectedCards)
      if (selectedCardIds.length > 0) {
        // Get the selected card from the game state
        // For now, we need to find the card in the player's hand
        // This would need to be improved to get the actual card object
        console.log('🎮 [Click-to-Play] Selected card ID:', selectedCardIds[0])
        // TODO: Implement click-to-place logic when we have access to the full card object
      }
    } else if (card && canInteract) {
      // Selecting/targeting a card
      console.log('Selected card:', card.name)
    }
  }, [isEmpty, card, canInteract, position, interaction.selectedCards])

  return (
    <div
      className={cn(
        'relative w-24 h-32 rounded-xl border-2 transition-all duration-300 cursor-pointer shadow-md',
        'flex items-center justify-center backdrop-blur-sm',
        isEmpty && 'border-dashed border-gray-400/40 hover:border-purple-400/60 bg-gray-900/10',
        !isEmpty && 'border-solid border-gray-600/40 bg-gray-800/20',
        isHighlighted && 'ring-2 ring-yellow-400 ring-offset-2 shadow-yellow-400/30',
        isValidDropZone && 'border-green-500 bg-green-500/15 scale-105 shadow-green-500/30',
        isHovered && 'scale-110 shadow-xl shadow-purple-500/40',
        position.player === 'player2' && 'border-red-800/40 hover:border-red-600/60',
        position.player === 'player1' && 'border-blue-800/40 hover:border-blue-600/60'
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleSlotClick}
      data-slot={`${position.player}-${position.slot}`}
    >
      {/* Slot Number (for debugging) */}
      <div className="absolute top-1 left-1 text-xs text-muted-foreground/50">
        {position.slot}
      </div>

      {/* Card or Empty State */}
      {card ? (
        <div className="w-full h-full">
          <GameCard
            card={card}
            size="medium"
            onClick={canInteract ? () => {/* Handle card click */} : undefined}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1 opacity-40">
          <div className="w-8 h-8 rounded-full border-2 border-dashed border-current flex items-center justify-center">
            <span className="text-lg">✦</span>
          </div>
          <span className="text-xs text-center">Empty</span>
        </div>
      )}

      {/* Attack/Status Indicators with Esoteric Effects */}
      {card && (
        <div className="absolute bottom-1 right-1 flex flex-col gap-1">
          {card.hasAttackedThisTurn && (
            <div className="w-2 h-2 bg-orange-500 rounded-full opacity-75"
                 title="Has attacked this turn" />
          )}
          {interaction.selectedAttackers.has(card.id) && (
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"
                 title="Selected for attack" />
          )}
          {card.divineShield && (
            <span className="text-xs animate-pulse" title="Divine Shield">🛡️</span>
          )}
          {card.isReversed && (
            <span className="text-xs filter hue-rotate-180" title="Reversed Card">🔄</span>
          )}
          {card.mysticWard && (
            <span className="text-xs text-purple-400" title="Mystic Ward">🔮</span>
          )}
          {card.veilOfIllusion && (
            <span className="text-xs opacity-60 animate-pulse" title="Veil of Illusion">👁️</span>
          )}
          {card.ethereal && (
            <span className="text-xs text-cyan-400 animate-bounce" title="Ethereal">✨</span>
          )}
          {card.chakraResonance && card.chakraResonance.length > 0 && (
            <span className="text-xs text-gradient-to-r from-violet-400 to-purple-400"
                  title={`Active Chakras: ${card.chakraResonance.join(', ')}`}>🕉️</span>
          )}
        </div>
      )}

      {/* Zodiac/Element Indicators with Esoteric Theming */}
      {card && (
        <div className="absolute top-1 right-1 flex flex-col gap-1">
          {/* Element Indicator */}
          <div className={cn(
            'w-3 h-3 rounded-full border shadow-sm',
            card.element === 'fire' && 'bg-red-500/30 border-red-400 shadow-red-500/50',
            card.element === 'water' && 'bg-blue-500/30 border-blue-400 shadow-blue-500/50',
            card.element === 'earth' && 'bg-green-500/30 border-green-400 shadow-green-500/50',
            card.element === 'air' && 'bg-yellow-500/30 border-yellow-400 shadow-yellow-500/50'
          )} />

          {/* Cosmic Resonance Indicator */}
          {card.cosmicResonance && card.cosmicResonance > 0 && (
            <div className="w-3 h-3 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 border border-purple-300 animate-pulse"
                 title={`Cosmic Resonance: ${card.cosmicResonance}`} />
          )}

          {/* Tarot Power Indicator */}
          {card.tarotPower && card.tarotPower > 0 && (
            <div className="w-3 h-3 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 border border-amber-300"
                 title={`Tarot Power: ${card.tarotPower}`} />
          )}
        </div>
      )}
    </div>
  )
}