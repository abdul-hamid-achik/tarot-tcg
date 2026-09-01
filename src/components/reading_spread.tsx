'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Card } from '@/schemas/schema'
import { useGameStore } from '@/store/game_store'

function Slot({ label, card, onClick }: { label: string; card: Card | null; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-16 min-w-0 flex-1 flex-col items-center justify-center rounded-md border px-2 text-center',
        card ? 'border-foreground bg-card' : 'border-dashed border-border bg-muted/40',
      )}
      aria-label={card ? `${label}: ${card.name}` : `${label}, empty`}
    >
      <span className="text-[10px] uppercase text-muted-foreground">{label}</span>
      <span className="truncate text-xs font-semibold">{card ? card.name : '—'}</span>
    </button>
  )
}

export function ReadingSpread() {
  const gameState = useGameStore(state => state.gameState)
  const reading = useGameStore(state => state.interaction.reading)
  const selectedCard = useGameStore(state => state.interaction.selectedCard)
  const setReadingSlot = useGameStore(state => state.setReadingSlot)
  const clearReading = useGameStore(state => state.clearReading)
  const commitReading = useGameStore(state => state.commitReading)

  const isOurTurn = gameState.activePlayer === 'player1' && gameState.phase === 'action'
  const alreadyRead = Boolean(gameState.player1.hasReadThisTurn)

  const find = (id: string | null): Card | null => {
    if (!id) return null
    return (
      gameState.player1.hand.find(card => card.id === id) ??
      gameState.battlefield.playerUnits.find(unit => unit?.id === id) ??
      null
    )
  }

  const assign = (slot: 'past' | 'present' | 'future') => {
    if (!isOurTurn || alreadyRead) return
    if (selectedCard) {
      setReadingSlot(slot, selectedCard.id)
      return
    }
  }

  const canRead = isOurTurn && !alreadyRead && Boolean(reading.futureId)

  if (!isOurTurn && !reading.futureId && !reading.presentId && !reading.pastId) {
    return null
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-1">
      <div className="flex gap-1">
        <Slot label="Past" card={find(reading.pastId)} onClick={() => assign('past')} />
        <Slot label="Present" card={find(reading.presentId)} onClick={() => assign('present')} />
        <Slot label="Future" card={find(reading.futureId)} onClick={() => assign('future')} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {alreadyRead
            ? 'Reading complete'
            : selectedCard
              ? `Place ${selectedCard.name} in the spread, or click it again to seat Future → Present → Past`
              : 'Click a card, then a position. Future is required.'}
        </p>
        <div className="flex gap-1">
          <Button type="button" size="sm" variant="outline" className="h-7" onClick={clearReading}>
            Clear
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-7"
            disabled={!canRead}
            onClick={() => void commitReading()}
          >
            Read
          </Button>
        </div>
      </div>
    </div>
  )
}
