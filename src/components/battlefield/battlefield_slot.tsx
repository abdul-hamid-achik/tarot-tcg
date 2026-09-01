'use client'

import type React from 'react'
import { useCallback } from 'react'
import TarotCard from '@/components/tarot_card'
import { useCombatActions } from '@/hooks/use_combat_actions'
import { useGameActions } from '@/hooks/use_game_actions'
import { GameLogger } from '@/lib/game_logger'
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
  const { interaction, setHoveredSlot, endCardDrag, placeInReading } = useGameStore()
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
    if (isEmpty && interaction.selectedCard && position.player === 'player1') {
      try {
        await playCard(interaction.selectedCard, position)
      } catch (error) {
        GameLogger.error('Click-to-play failed:', error)
      }
      return
    }

    if (!card || !canInteract) return

    if (isInTargetingMode()) {
      if (isValidTarget(card.id)) {
        await handleTargetClick(card.id, 'unit')
      }
      return
    }

    if (position.player === 'player1') {
      placeInReading(card)
      return
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
    playCard,
    placeInReading,
  ])

  const isPlayerZone = position.player === 'player1'
  const hasSelectedCard = interaction.selectedCard !== null
  const ownerLabel = isPlayerZone ? 'Your' : "Opponent's"
  const slotNumber = position.slot + 1
  const isLegalTarget = Boolean(card && isValidTarget(card.id))
  const isAttacker = Boolean(card && isAttacking(card.id))
  const isInteractive =
    (isEmpty && hasSelectedCard && isPlayerZone) || (Boolean(card) && canInteract) || isLegalTarget

  const ariaLabel = (() => {
    if (isEmpty && hasSelectedCard && isPlayerZone) {
      return `${ownerLabel} slot ${slotNumber}, play ${interaction.selectedCard?.name ?? 'selected card'} here`
    }
    if (isEmpty) {
      return `${ownerLabel} slot ${slotNumber}, empty`
    }
    if (isLegalTarget) {
      return `Attack ${card?.name}`
    }
    if (isAttacker) {
      return `${card?.name}, attacking — choose a target`
    }
    if (card?.hasAttackedThisTurn) {
      return `${ownerLabel} slot ${slotNumber}, ${card.name}, already attacked`
    }
    return `${ownerLabel} slot ${slotNumber}, ${card?.name}`
  })()

  return (
    <li
      id={card ? `unit-${card.id}` : undefined}
      tabIndex={isInteractive ? 0 : -1}
      aria-label={ariaLabel}
      aria-disabled={!isInteractive}
      className={cn(
        'relative aspect-[5/7] w-full cursor-pointer overflow-hidden rounded-md border',
        'flex items-center justify-center',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground',
        isEmpty ? 'border-dashed border-border bg-muted/30' : 'border-border bg-card',
        isValidDropZone && hasSelectedCard && 'border-foreground bg-muted',
        isHovered && 'border-foreground',
        isHighlighted && 'ring-2 ring-foreground',
        isLegalTarget && 'border-red-700 ring-2 ring-red-600',
        isAttacker && 'border-foreground ring-2 ring-foreground',
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleSlotClick}
      onKeyDown={event => {
        if (!isInteractive) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          void handleSlotClick()
        }
      }}
      data-player={position.player}
      data-slot={position.slot}
    >
      {card ? (
        <div className="relative h-full w-full">
          <TarotCard card={card} size="battlefield" rotateIfReversed={false} />
          {isAttacking(card.id) && (
            <span className="absolute top-0.5 left-1/2 z-10 -translate-x-1/2 rounded bg-foreground px-1 text-[10px] font-semibold text-background">
              Attacking
            </span>
          )}
        </div>
      ) : (
        <span
          className={cn(
            'px-1 text-center text-[10px] leading-tight text-muted-foreground',
            isValidDropZone && hasSelectedCard && 'font-semibold text-foreground',
          )}
        >
          {isValidDropZone && hasSelectedCard ? 'Drop here' : `${slotNumber}`}
        </span>
      )}

      {card && (
        <div className="absolute right-0.5 bottom-0.5 z-10 flex flex-col items-end gap-0.5">
          {card.hasSummoningSickness && (
            <span className="rounded bg-muted px-1 text-[9px] font-semibold text-foreground">
              Sick
            </span>
          )}
          {card.hasAttackedThisTurn && (
            <span className="rounded bg-foreground px-1 text-[9px] font-semibold text-background">
              Spent
            </span>
          )}
          {card.isReversed && (
            <span className="rounded border border-border bg-card px-1 text-[9px]">Rev</span>
          )}
        </div>
      )}
    </li>
  )
}
