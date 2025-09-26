'use client'

import { useCallback } from 'react'
import type React from 'react'
import { useGameActions } from '@/hooks/use_game_actions'
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
  const {
    highlightedSlots,
    validDropZones,
    interaction,
    setHoveredSlot,
    endCardDrag,
  } = useGameStore()
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
          console.log('Auto-placing card in slot:', position)
          try {
            await playCard(interaction.draggedCard, position)
          } catch (error) {
            console.error('Auto-place failed:', error)
          }
        }
      }
      setHoveredSlot(null)
      endCardDrag()
    },
    [interaction.draggedCard, canInteract, units, player, setHoveredSlot, endCardDrag, playCard],
  )

  return (
    <div
      className={`flex justify-center gap-2 min-h-[100px] p-2 rounded-lg transition-all duration-300 ${player === 'player1'
        ? 'bg-gray-100 hover:bg-gray-200'
        : 'bg-gray-200 hover:bg-gray-300'
        }`}
      role="list"
      aria-label={player === 'player1' ? 'Player battlefield row' : 'Opponent battlefield row'}
      onDragOver={handleRowDragOver}
      onDrop={handleRowDrop}
    >
      {units.map((unit, index) => {
        const position: BattlefieldPosition = { player, slot: index }
        const slotKey = createSlotKey(position)
        const isHighlighted = highlightedSlots.has(slotKey)
        const isValidDropZone = validDropZones.has(slotKey)
        const isHovered = interaction.hoveredSlot?.player === player &&
          interaction.hoveredSlot?.slot === index

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