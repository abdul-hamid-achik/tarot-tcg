'use client'

import { Sparkles, X } from 'lucide-react'
import { useState } from 'react'
import TarotCard from '@/components/tarot_card'
import { Button } from '@/components/ui/button'
import type { Card as GameCard } from '@/schemas/schema'

interface MulliganOverlayProps {
  hand: GameCard[]
  isOpen: boolean
  onClose: () => void
  onMulligan: (selectedCards: string[]) => void
}

export default function MulliganOverlay({
  hand,
  isOpen,
  onClose,
  onMulligan,
}: MulliganOverlayProps) {
  const [selectedForDiscard, setSelectedForDiscard] = useState<string[]>([])
  const [draggedCard, setDraggedCard] = useState<string | null>(null)

  if (!isOpen) return null

  const handleDragStart = (cardId: string) => {
    setDraggedCard(cardId)
  }

  const handleDragEnd = () => {
    setDraggedCard(null)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDropOnDiscard = (e: React.DragEvent) => {
    e.preventDefault()
    if (draggedCard && !selectedForDiscard.includes(draggedCard)) {
      setSelectedForDiscard(prev => [...prev, draggedCard])
    }
    setDraggedCard(null)
  }

  const handleDropOnKeep = (e: React.DragEvent) => {
    e.preventDefault()
    if (draggedCard && selectedForDiscard.includes(draggedCard)) {
      setSelectedForDiscard(prev => prev.filter(id => id !== draggedCard))
    }
    setDraggedCard(null)
  }

  const handleMulligan = () => {
    onMulligan(selectedForDiscard)
    setSelectedForDiscard([])
  }

  const handleKeepAll = () => {
    onMulligan([])
    setSelectedForDiscard([])
  }

  const keptCards = hand.filter(card => !selectedForDiscard.includes(card.id))
  const discardedCards = hand.filter(card => selectedForDiscard.includes(card.id))

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl border border-border max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-muted-foreground" />
            Mulligan Phase
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {/* Instructions */}
          <div className="text-center text-muted-foreground">
            <p className="text-sm">Drag cards to the top row to discard them and draw new ones</p>
            <p className="text-xs text-muted-foreground/80 mt-1">
              You can discard any number of cards (0-4)
            </p>
          </div>

          {/* Discard Area - Top Row */}
          <div
            className="min-h-32 border-2 border-dashed border-muted-foreground/40 bg-muted rounded-lg p-4"
            onDragOver={handleDragOver}
            onDrop={handleDropOnDiscard}
          >
            <div className="text-center text-muted-foreground text-sm font-semibold mb-3">
              Cards to Discard ({discardedCards.length})
            </div>
            <div className="flex gap-3 justify-center flex-wrap">
              {discardedCards.map(card => (
                <div
                  key={card.id}
                  className="transform hover:scale-105 transition-transform cursor-pointer"
                  draggable
                  onDragStart={() => handleDragStart(card.id)}
                  onDragEnd={handleDragEnd}
                >
                  <TarotCard
                    card={card}
                    size="small"
                    isSelected={true}
                    className="ring-2 ring-foreground/60"
                  />
                </div>
              ))}
              {discardedCards.length === 0 && (
                <div className="text-muted-foreground/60 text-sm italic">
                  Drag cards here to discard them
                </div>
              )}
            </div>
          </div>

          {/* Keep Area - Bottom Row */}
          <div
            className="min-h-32 border-2 border-dashed border-muted-foreground/50 bg-muted/50 rounded-lg p-4"
            onDragOver={handleDragOver}
            onDrop={handleDropOnKeep}
          >
            <div className="text-center text-foreground text-sm font-semibold mb-3">
              Cards to Keep ({keptCards.length})
            </div>
            <div className="flex gap-3 justify-center flex-wrap">
              {keptCards.map(card => (
                <div
                  key={card.id}
                  className="transform hover:scale-105 transition-transform cursor-pointer"
                  draggable
                  onDragStart={() => handleDragStart(card.id)}
                  onDragEnd={handleDragEnd}
                >
                  <TarotCard card={card} size="small" isSelected={false} />
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center gap-4">
            <Button onClick={handleKeepAll} variant="secondary" className="px-6 py-2">
              Keep All Cards
            </Button>
            <Button
              onClick={handleMulligan}
              disabled={selectedForDiscard.length === 0}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Mulligan {selectedForDiscard.length > 0 && `(${selectedForDiscard.length})`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
