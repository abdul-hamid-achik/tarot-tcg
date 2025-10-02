import { GameLogger } from "@/lib/game_logger"
'use client'

import type React from 'react'
import { useCallback } from 'react'
import { useGameStore } from '@/store/game_store'
import { useGameActions } from '@/hooks/use_game_actions'
import { useCombatActions } from '@/hooks/use_combat_actions'
import TarotCard from '@/components/tarot_card'
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
  const {
    handleUnitClick,
    handleTargetClick,
    isValidTarget,
    isAttacking,
    isInTargetingMode
  } = useCombatActions()

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
      GameLogger.debug('🎮 [Drag&Drop] Dropping card at slot:', position)
      try {
        await playCard(interaction.draggedCard, position)
        GameLogger.debug('🎮 [Drag&Drop] Successfully played card via drag&drop')
      } catch (error) {
        GameLogger.error('🎮 [Drag&Drop] Failed to play card:', error)
      }
    }
    setHoveredSlot(null)
    endCardDrag()
  }, [isValidDropZone, interaction.draggedCard, isEmpty, position, setHoveredSlot, endCardDrag, playCard])

  const handleSlotClick = useCallback(async () => {
    if (isEmpty && interaction.selectedCard) {
      // Playing a card from hand via click-then-click
      GameLogger.debug('🎮 [Click-to-Play] Playing card to slot:', position)
      try {
        await playCard(interaction.selectedCard, position)
        GameLogger.debug('🎮 [Click-to-Play] Successfully played card')
      } catch (error) {
        GameLogger.error('🎮 [Click-to-Play] Failed to play card:', error)
      }
    } else if (card && canInteract) {
      if (isInTargetingMode() && isValidTarget(card.id)) {
        // Being targeted in attack mode
        handleTargetClick(card.id, 'unit')
      } else if (!isInTargetingMode()) {
        // Start attack with this unit
        handleUnitClick(card)
      }
    }
  }, [
    isEmpty,
    card,
    canInteract,
    position,
    interaction.selectedCard,
    isInTargetingMode,
    isValidTarget,
    handleTargetClick,
    handleUnitClick,
    playCard
  ])

  return (
    <div
      className={cn(
        'relative w-20 h-28 rounded-lg border-2 transition-all duration-200 cursor-pointer',
        'flex items-center justify-center group',
        // Base styling by player
        position.player === 'player1' ? (
          isEmpty
            ? 'border-dashed border-gray-400 hover:border-gray-600 bg-white'
            : 'border-solid border-gray-600 bg-gray-100'
        ) : (
          isEmpty
            ? 'border-dashed border-gray-500 hover:border-gray-700 bg-gray-50'
            : 'border-solid border-gray-700 bg-gray-200'
        ),
        // Special states
        isHighlighted && 'ring-2 ring-black shadow-black/30',
        isValidDropZone && 'border-black bg-gray-300 scale-105 ring-1 ring-black/40',
        isHovered && 'scale-105 shadow-lg',
        card && isValidTarget(card.id) && 'border-black bg-gray-300 scale-105 animate-pulse',
        card && isAttacking(card.id) && 'border-black bg-gray-400 scale-105'
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleSlotClick}
      data-player={position.player}
      data-slot={position.slot}
    >

      {/* Card or Empty State */}
      {card ? (
        <div className="w-full h-full">
          <TarotCard
            card={card}
            size="battlefield"
            onClick={canInteract ? () => {/* Handle card click */ } : undefined}
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
          {isAttacking(card.id) && (
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"
              title="Ready to attack" />
          )}
          {isInTargetingMode() && isValidTarget(card.id) && (
            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce"
              title="Valid attack target" />
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