'use client'

import type React from 'react'
import { useCallback } from 'react'
import { useGameActions } from '@/hooks/use_game_actions'
import { GameLogger } from '@/lib/game_logger'
import { cn } from '@/lib/utils'
import type { Card, PlayerId } from '@/schemas/schema'
import type { BattlefieldPosition } from '@/services/battlefield_service'
import { createSlotKey, useGameStore } from '@/store/game_store'
import { BattlefieldSlot } from './battlefield_slot'

interface BattlefieldRowProps {
  player: PlayerId
  units: (Card | null)[]
  isActive: boolean
  canInteract: boolean
}

export function BattlefieldRow({
  player,
  units,
  isActive: _isActive,
  canInteract,
}: BattlefieldRowProps) {
  const { highlightedSlots, validDropZones, interaction, setHoveredSlot, endCardDrag } =
    useGameStore()
  const { playCard } = useGameActions()

  const handleRowDragOver = useCallback(
    (e: React.DragEvent) => {
      if (interaction.draggedCard && canInteract) {
        e.preventDefault()
      }
    },
    [interaction.draggedCard, canInteract],
  )

  const handleRowDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      if (interaction.draggedCard && canInteract) {
        const emptySlotIndex = units.indexOf(null)
        if (emptySlotIndex !== -1) {
          const position: BattlefieldPosition = { player, slot: emptySlotIndex }
          try {
            await playCard(interaction.draggedCard, position)
          } catch (error) {
            GameLogger.error('Auto-place failed:', error)
          }
        }
      }
      setHoveredSlot(null)
      endCardDrag()
    },
    [interaction.draggedCard, canInteract, units, player, setHoveredSlot, endCardDrag, playCard],
  )

  const isPlayerRow = player === 'player1'
  const hasSelectedCard = interaction.selectedCard !== null || interaction.draggedCard !== null

  return (
    <ul
      className={cn(
        'grid w-full list-none grid-cols-7 gap-1 rounded-lg border p-1',
        isPlayerRow ? 'border-border bg-card' : 'border-border/70 bg-muted/40',
        hasSelectedCard && isPlayerRow && 'border-foreground',
      )}
      aria-label={isPlayerRow ? 'Your battlefield' : "Opponent's battlefield"}
      onDragOver={handleRowDragOver}
      onDrop={handleRowDrop}
    >
      {units.map((unit, index) => {
        const position: BattlefieldPosition = { player, slot: index }
        const slotKey = createSlotKey(position)
        const isHighlighted = highlightedSlots.has(slotKey)
        const isValidDropZone = validDropZones.has(slotKey)
        const isHovered =
          interaction.hoveredSlot?.player === player && interaction.hoveredSlot?.slot === index

        return (
          <BattlefieldSlot
            key={`${player}-slot-${index}`}
            position={position}
            card={unit}
            isHighlighted={isHighlighted}
            isValidDropZone={isValidDropZone}
            isHovered={isHovered}
            canInteract={canInteract}
            isEmpty={unit === null}
          />
        )
      })}
    </ul>
  )
}
