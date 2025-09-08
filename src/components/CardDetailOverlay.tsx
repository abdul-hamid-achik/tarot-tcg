"use client"

import { X, Zap, Heart, Sword } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card as GameCard } from '@/types/game'
import TarotCard from '@/components/TarotCard'

interface CardDetailOverlayProps {
  card: GameCard
  isOpen: boolean
  onClose: () => void
  onPlay?: () => void
  canPlay?: boolean
}

export default function CardDetailOverlay({
  card,
  isOpen,
  onClose,
  onPlay,
  canPlay = false
}: CardDetailOverlayProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-xl border border-slate-600 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white">{card.name}</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-6">
          <div className="flex gap-6">
            {/* Card Image */}
            <div className="flex-shrink-0">
              <TarotCard
                card={card}
                size="large"
                isSelected={false}
              />
            </div>

            {/* Card Details */}
            <div className="flex-1 space-y-4">
              {/* Basic Stats */}
              <div className="flex items-center gap-4">
                <Badge className="bg-blue-600">
                  <Zap className="w-3 h-3 mr-1" />
                  Cost {card.cost}
                </Badge>

                {card.type === 'unit' && (
                  <>
                    <Badge className="bg-red-600">
                      <Sword className="w-3 h-3 mr-1" />
                      {card.attack} Attack
                    </Badge>
                    <Badge className="bg-green-600">
                      <Heart className="w-3 h-3 mr-1" />
                      {card.health} Health
                    </Badge>
                  </>
                )}

                <Badge className={`${card.rarity === 'legendary' ? 'bg-orange-600' :
                  card.rarity === 'rare' ? 'bg-purple-600' :
                    card.rarity === 'uncommon' ? 'bg-blue-600' : 'bg-gray-600'
                  }`}>
                  {card.rarity.charAt(0).toUpperCase() + card.rarity.slice(1)}
                </Badge>
              </div>

              {/* Zodiac & Element */}
              <div className="flex items-center gap-2">
                <span className="text-2xl">{card.tarotSymbol}</span>
                <span className="text-slate-300">
                  {card.zodiacClass.charAt(0).toUpperCase() + card.zodiacClass.slice(1)} • {card.element.charAt(0).toUpperCase() + card.element.slice(1)}
                </span>
              </div>

              {/* Keywords */}
              {card.keywords && card.keywords.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-slate-300">Keywords</h4>
                  <div className="flex flex-wrap gap-2">
                    {card.keywords.map((keyword) => (
                      <Badge key={keyword} variant="secondary" className="text-xs">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Abilities */}
              {card.abilities && card.abilities.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-slate-300">Abilities</h4>
                  <div className="space-y-2">
                    {card.abilities.map((ability, index) => (
                      <div key={index} className="bg-slate-800 rounded p-3">
                        <div className="font-semibold text-white text-sm mb-1">
                          {ability.name}
                        </div>
                        <div className="text-slate-300 text-sm">
                          {ability.description}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-slate-300">Description</h4>
                <div className="text-slate-400 text-sm leading-relaxed">
                  {card.description || "A mystical card imbued with ancient tarot power."}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-700">
            <Button
              variant="outline"
              onClick={onClose}
              className="border-slate-600 text-slate-300 hover:text-white"
            >
              Close
            </Button>
            {onPlay && (
              <Button
                onClick={() => {
                  onPlay()
                  onClose()
                }}
                disabled={!canPlay}
                className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
              >
                Play Card
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}