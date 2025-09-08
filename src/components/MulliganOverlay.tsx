"use client"

import { useState } from 'react'
import { X, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card as GameCard } from '@/types/game'
import TarotCard from '@/components/TarotCard'

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
  onMulligan
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
      <div className="bg-slate-900 rounded-xl border border-slate-600 max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            Mulligan Phase
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {/* Instructions */}
          <div className="text-center text-slate-300">
            <p className="text-sm">Drag cards to the top row to discard them and draw new ones</p>
            <p className="text-xs text-slate-400 mt-1">You can discard any number of cards (0-4)</p>
          </div>

          {/* Discard Area - Top Row */}
          <div 
            className="min-h-32 border-2 border-dashed border-red-500/50 bg-red-900/10 rounded-lg p-4"
            onDragOver={handleDragOver}
            onDrop={handleDropOnDiscard}
          >
            <div className="text-center text-red-300 text-sm font-semibold mb-3">
              Cards to Discard ({discardedCards.length})
            </div>
            <div className="flex gap-3 justify-center flex-wrap">
              {discardedCards.map((card) => (
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
                    className="ring-2 ring-red-400"
                  />
                </div>
              ))}
              {discardedCards.length === 0 && (
                <div className="text-slate-500 text-sm italic">
                  Drag cards here to discard them
                </div>
              )}
            </div>
          </div>

          {/* Keep Area - Bottom Row */}
          <div 
            className="min-h-32 border-2 border-dashed border-green-500/50 bg-green-900/10 rounded-lg p-4"
            onDragOver={handleDragOver}
            onDrop={handleDropOnKeep}
          >
            <div className="text-center text-green-300 text-sm font-semibold mb-3">
              Cards to Keep ({keptCards.length})
            </div>
            <div className="flex gap-3 justify-center flex-wrap">
              {keptCards.map((card) => (
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
                    isSelected={false}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center gap-4">
            <Button
              onClick={handleKeepAll}
              className="bg-green-600 hover:bg-green-700 px-6 py-2"
            >
              Keep All Cards
            </Button>
            <Button
              onClick={handleMulligan}
              disabled={selectedForDiscard.length === 0}
              className="bg-purple-600 hover:bg-purple-700 px-6 py-2 disabled:opacity-50"
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