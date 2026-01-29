'use client'

import { GameLogger } from '@/lib/game_logger'
import type React from 'react'
import { useCallback } from 'react'
import { useGameActions } from '@/hooks/use_game_actions'
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
          const position: BattlefieldPosition = {
            player,
            slot: emptySlotIndex,
          }
          GameLogger.debug('Auto-placing card in slot:', position)
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
    <div
      className={cn(
        'flex justify-center gap-3 min-h-[140px] p-4 rounded-2xl transition-all duration-300',
        'border-2',
        // Distinct visual zones for player vs opponent
        isPlayerRow
          ? [
              'bg-gradient-to-t from-slate-100 to-white',
              'border-slate-200',
              hasSelectedCard && 'border-emerald-300 bg-gradient-to-t from-emerald-50 to-white',
            ]
          : [
              'bg-gradient-to-b from-slate-200 to-slate-100',
              'border-slate-300',
            ],
      )}
      role="list"
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
    </div>
  )
}
