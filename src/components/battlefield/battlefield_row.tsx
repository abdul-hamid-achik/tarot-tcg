'use client'

import type React from 'react'
import { useCallback } from 'react'
import { useGameStore, createSlotKey } from '@/store/game_store'
import { BattlefieldSlot } from './battlefield_slot'
import type { Card, PlayerId } from '@/schemas/schema'
import type { BattlefieldPosition } from '@/services/battlefield_service'

interface BattlefieldRowProps {
  player: PlayerId
  units: (Card | null)[]
  isActive: boolean
  canInteract: boolean
}

export function BattlefieldRow({
  player,
  units,
  isActive,
  canInteract,
}: BattlefieldRowProps) {
  const {
    highlightedSlots,
    validDropZones,
    interaction,
    setHoveredSlot,
    endCardDrag,
  } = useGameStore()

  const handleRowDragOver = useCallback((e: React.DragEvent) => {
    if (interaction.draggedCard && canInteract) {
      e.preventDefault()
    }
  }, [interaction.draggedCard, canInteract])

  const handleRowDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (interaction.draggedCard && canInteract) {
      // Find first empty slot for auto-placement
      const emptySlotIndex = units.indexOf(null)
      if (emptySlotIndex !== -1) {
        const position: BattlefieldPosition = {
          player,
          slot: emptySlotIndex,
        }
        // Trigger card placement logic here
        console.log('Auto-placing card in slot:', position)
      }
    }
    setHoveredSlot(null)
    endCardDrag()
  }, [interaction.draggedCard, canInteract, units, player, setHoveredSlot, endCardDrag])

  return (
    <div
      className="flex justify-center gap-3 min-h-[140px] p-3 rounded-xl bg-gradient-to-r from-purple-900/10 via-indigo-900/5 to-blue-900/10 border border-purple-500/20 backdrop-blur-sm"
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
            key={`${player}-${index}`}
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