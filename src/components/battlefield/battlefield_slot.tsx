'use client'

import { GameLogger } from '@/lib/game_logger'
import type React from 'react'
import { useCallback } from 'react'
import TarotCard from '@/components/tarot_card'
import { useCombatActions } from '@/hooks/use_combat_actions'
import { useGameActions } from '@/hooks/use_game_actions'
import { cn } from '@/lib/utils'
import type { Card } from '@/schemas/schema'
import type { BattlefieldPosition } from '@/services/battlefield_service'
import { useGameStore } from '@/store/game_store'

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
  const { interaction, setHoveredSlot, endCardDrag } = useGameStore()
  const { playCard } = useGameActions()
  const { handleUnitClick, handleTargetClick, isValidTarget, isAttacking, isInTargetingMode } =
    useCombatActions()

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      // Allow drops on empty slots (for playing cards) or enemy slots (for attacks)
      const isEnemySlot = position.player === 'player2' && card !== null
      const isValidDrop = isValidDropZone && (isEmpty || isEnemySlot)

      if (isValidDrop) {
        e.preventDefault()
        setHoveredSlot(position)
      }
    },
    [isValidDropZone, isEmpty, position, setHoveredSlot, card],
  )

  const handleDragLeave = useCallback(() => {
    setHoveredSlot(null)
  }, [setHoveredSlot])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      setHoveredSlot(null)

      if (!interaction.draggedCard) {
        endCardDrag()
        return
      }

      const isEnemySlot = position.player === 'player2' && card !== null

      // Handle different drop scenarios
      if (isEmpty && isValidDropZone) {
        // Playing a card from hand to empty battlefield slot
        GameLogger.debug('🎮 [Drag&Drop] Dropping card at empty slot:', position)
        try {
          await playCard(interaction.draggedCard, position)
          GameLogger.debug('🎮 [Drag&Drop] Successfully played card via drag&drop')
          // Note: clearSelection (which includes endCardDrag) is handled in playCard
        } catch (error) {
          GameLogger.error('🎮 [Drag&Drop] Failed to play card:', error)
          endCardDrag()
        }
      } else if (isEnemySlot && card) {
        // Attacking an enemy unit
        GameLogger.debug('🎮 [Drag&Drop] Attacking enemy unit:', card.name)
        try {
          // Trigger attack via combat actions
          if (isInTargetingMode()) {
            handleTargetClick(card.id, 'unit')
          } else {
            // If we're dragging from battlefield, start attack
            handleUnitClick(interaction.draggedCard)
            // Then immediately target this enemy
            setTimeout(() => handleTargetClick(card.id, 'unit'), 50)
          }
          endCardDrag()
        } catch (error) {
          GameLogger.error('🎮 [Drag&Drop] Failed to attack:', error)
          endCardDrag()
        }
      } else {
        // Invalid drop
        endCardDrag()
      }
    },
    [
      isValidDropZone,
      interaction.draggedCard,
      isEmpty,
      position,
      card,
      setHoveredSlot,
      endCardDrag,
      playCard,
      isInTargetingMode,
      handleTargetClick,
      handleUnitClick,
    ],
  )

  const handleSlotClick = useCallback(async () => {
    if (isEmpty && interaction.selectedCard) {
      // Playing a card from hand via click-then-click (Hearthstone-style)
      GameLogger.debug('🎮 [Click-to-Play] Playing card to slot:', position)
      try {
        await playCard(interaction.selectedCard, position)
        GameLogger.debug('🎮 [Click-to-Play] Successfully played card')
        // Note: clearSelection is handled in playCard
      } catch (error) {
        GameLogger.error('🎮 [Click-to-Play] Failed to play card:', error)
      }
    } else if (card && canInteract) {
      // Hearthstone-style attack: click attacker, then click target
      if (isInTargetingMode() && isValidTarget(card.id)) {
        // This card is being targeted for attack
        handleTargetClick(card.id, 'unit')
      } else if (!isInTargetingMode()) {
        // Start attack targeting with this unit
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
    playCard,
  ])

  // Determine if this is the player's zone or opponent's zone
  const isPlayerZone = position.player === 'player1'
  const hasSelectedCard = interaction.selectedCard !== null

  return (
    <div
      className={cn(
        'relative w-24 h-32 rounded-xl border-2 transition-all duration-300 cursor-pointer',
        'flex items-center justify-center group',
        // Base styling - distinct zones with clear ownership
        isPlayerZone
          ? isEmpty
            ? 'border-dashed border-slate-300 bg-slate-50/80 hover:border-slate-400 hover:bg-slate-100'
            : 'border-solid border-slate-400 bg-white shadow-sm'
          : isEmpty
            ? 'border-dashed border-slate-400 bg-slate-100/80 hover:border-slate-500 hover:bg-slate-200'
            : 'border-solid border-slate-500 bg-slate-50 shadow-sm',
        // Valid drop zone - glowing effect when a card is selected for placement
        isValidDropZone && hasSelectedCard && [
          'border-emerald-500 border-solid bg-emerald-50',
          'ring-2 ring-emerald-400/50 ring-offset-2',
          'scale-105 shadow-lg shadow-emerald-500/20',
        ],
        // Hover state during drag
        isHovered && 'scale-110 shadow-xl border-emerald-600 bg-emerald-100',
        // Highlighted slot
        isHighlighted && 'ring-2 ring-amber-400 shadow-amber-400/30',
        // Attack targeting states
        card && isValidTarget(card.id) && [
          'border-red-500 border-solid bg-red-50',
          'ring-2 ring-red-400/60 ring-offset-1',
          'scale-105 shadow-lg shadow-red-500/30',
          'animate-pulse',
        ],
        card && isAttacking(card.id) && [
          'border-amber-500 border-solid bg-amber-50',
          'ring-2 ring-amber-400 ring-offset-1',
          'scale-105 shadow-xl shadow-amber-500/40',
        ],
        // Interaction affordance
        canInteract && !isEmpty && !isAttacking(card?.id || '') && 'hover:scale-105 hover:shadow-md',
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
        <div className="w-full h-full relative">
          <TarotCard
            card={card}
            size="battlefield"
            rotateIfReversed={false}
            onClick={
              canInteract
                ? () => {
                  /* Handle card click */
                }
                : undefined
            }
          />
          {/* Attack ready indicator */}
          {isAttacking(card.id) && (
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full font-semibold animate-bounce">
              Attacking
            </div>
          )}
        </div>
      ) : (
        <div className={cn(
          'flex flex-col items-center gap-2 transition-all duration-300',
          isValidDropZone && hasSelectedCard ? 'opacity-100 scale-110' : 'opacity-30 group-hover:opacity-50',
        )}>
          {/* Tarot-themed empty slot indicator */}
          <div className={cn(
            'w-10 h-10 rounded-full border-2 border-dashed flex items-center justify-center',
            'transition-all duration-300',
            isValidDropZone && hasSelectedCard
              ? 'border-emerald-500 bg-emerald-100 text-emerald-600'
              : 'border-current',
          )}>
            <span className="text-xl">{isValidDropZone && hasSelectedCard ? '↓' : '☆'}</span>
          </div>
          <span className={cn(
            'text-xs font-medium',
            isValidDropZone && hasSelectedCard ? 'text-emerald-600' : 'text-slate-400',
          )}>
            {isValidDropZone && hasSelectedCard ? 'Drop here' : `Slot ${position.slot + 1}`}
          </span>
        </div>
      )}

      {/* Attack/Status Indicators with Esoteric Effects */}
      {card && (
        <div className="absolute bottom-1 right-1 flex flex-col gap-1">
          {card.hasAttackedThisTurn && (
            <div
              className="w-2 h-2 bg-orange-500 rounded-full opacity-75"
              title="Has attacked this turn"
            />
          )}
          {isAttacking(card.id) && (
            <div
              className="w-2 h-2 bg-red-500 rounded-full animate-pulse"
              title="Ready to attack"
            />
          )}
          {isInTargetingMode() && isValidTarget(card.id) && (
            <div
              className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce"
              title="Valid attack target"
            />
          )}
          {card.divineShield && (
            <span className="text-xs animate-pulse" title="Divine Shield">
              🛡️
            </span>
          )}
          {card.isReversed && (
            <span className="text-xs filter hue-rotate-180" title="Reversed Card">
              🔄
            </span>
          )}
          {card.mysticWard && (
            <span className="text-xs text-purple-400" title="Mystic Ward">
              🔮
            </span>
          )}
          {card.veilOfIllusion && (
            <span className="text-xs opacity-60 animate-pulse" title="Veil of Illusion">
              👁️
            </span>
          )}
          {card.ethereal && (
            <span className="text-xs text-cyan-400 animate-bounce" title="Ethereal">
              ✨
            </span>
          )}
          {card.chakraResonance && card.chakraResonance.length > 0 && (
            <span
              className="text-xs text-gradient-to-r from-violet-400 to-purple-400"
              title={`Active Chakras: ${card.chakraResonance.join(', ')}`}
            >
              🕉️
            </span>
          )}
        </div>
      )}

      {/* Zodiac/Element Indicators with Esoteric Theming */}
      {card && (
        <div className="absolute top-1 right-1 flex flex-col gap-1">
          {/* Element Indicator */}
          <div
            className={cn(
              'w-3 h-3 rounded-full border shadow-sm',
              card.element === 'fire' && 'bg-red-500/30 border-red-400 shadow-red-500/50',
              card.element === 'water' && 'bg-blue-500/30 border-blue-400 shadow-blue-500/50',
              card.element === 'earth' && 'bg-green-500/30 border-green-400 shadow-green-500/50',
              card.element === 'air' && 'bg-yellow-500/30 border-yellow-400 shadow-yellow-500/50',
            )}
          />

          {/* Cosmic Resonance Indicator */}
          {card.cosmicResonance && card.cosmicResonance > 0 && (
            <div
              className="w-3 h-3 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 border border-purple-300 animate-pulse"
              title={`Cosmic Resonance: ${card.cosmicResonance}`}
            />
          )}

          {/* Tarot Power Indicator */}
          {card.tarotPower && card.tarotPower > 0 && (
            <div
              className="w-3 h-3 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 border border-amber-300"
              title={`Tarot Power: ${card.tarotPower}`}
            />
          )}
        </div>
      )}
    </div>
  )
}
