'use client'

import { Heart, Sword, X, Zap } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import TarotCard from '@/components/tarot_card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Card as GameCard } from '@/schemas/schema'

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
  canPlay = false,
}: CardDetailOverlayProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-gray-300 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-300">
          <h2 className="text-xl font-bold text-black">{card.name}</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-gray-600 hover:text-black"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-6">
          <div className="flex gap-6">
            {/* Card Image */}
            <div className="flex-shrink-0">
              <TarotCard card={card} size="large" isSelected={false} />
            </div>

            {/* Card Details */}
            <div className="flex-1 space-y-4">
              {/* Basic Stats */}
              <div className="flex items-center gap-4">
                <Badge className="bg-gray-800 text-white">
                  <Zap className="w-3 h-3 mr-1" />
                  Cost {card.cost}
                </Badge>

                {card.type === 'unit' && (
                  <>
                    <Badge className="bg-gray-700 text-white">
                      <Sword className="w-3 h-3 mr-1" />
                      {card.attack} Attack
                    </Badge>
                    <Badge className="bg-gray-600 text-white">
                      <Heart className="w-3 h-3 mr-1" />
                      {card.health} Health
                    </Badge>
                  </>
                )}

                {/* Rarity Badge */}
                <Badge
                  className={`${
                    card.rarity === 'legendary' || card.rarity === 'mythic'
                      ? 'bg-purple-500 text-white'
                      : card.rarity === 'rare'
                        ? 'bg-blue-500 text-white'
                        : card.rarity === 'uncommon'
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-500 text-white'
                  }`}
                >
                  {card.rarity.charAt(0).toUpperCase() + card.rarity.slice(1)}
                </Badge>
              </div>

              {/* Zodiac & Element */}
              <div className="flex items-center gap-2">
                <span className="text-2xl">{card.tarotSymbol}</span>
                <span className="text-gray-700">
                  {card.zodiacClass.charAt(0).toUpperCase() + card.zodiacClass.slice(1)} •{' '}
                  {card.element.charAt(0).toUpperCase() + card.element.slice(1)}
                </span>
              </div>

              {/* Keywords */}
              {card.keywords && card.keywords.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-gray-800">Keywords</h4>
                  <div className="flex flex-wrap gap-2">
                    {card.keywords.map(keyword => (
                      <Badge
                        key={keyword}
                        variant="secondary"
                        className="text-xs bg-gray-200 text-gray-800"
                      >
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Abilities */}
              {card.abilities && card.abilities.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-gray-800">Abilities</h4>
                  <div className="space-y-2">
                    {card.abilities.map(ability => (
                      <div
                        key={`${ability.name}-${ability.description}`}
                        className="bg-gray-100 border border-gray-300 rounded p-3"
                      >
                        <div className="font-semibold text-black text-sm mb-1">{ability.name}</div>
                        <div className="text-gray-700 text-sm">{ability.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  Description
                  {card.isReversed && (
                    <Badge className="bg-gray-200 text-gray-800 border border-gray-400 text-xs">
                      ⤊ Reversed
                    </Badge>
                  )}
                </h4>
                <div
                  className={`text-sm leading-relaxed prose prose-sm max-w-none ${card.isReversed ? 'text-gray-700 prose-gray' : 'text-gray-600 prose-gray'}`}
                >
                  <ReactMarkdown>
                    {card.isReversed && card.reversedDescription
                      ? card.reversedDescription
                      : card.description || 'A mystical card imbued with ancient tarot power.'}
                  </ReactMarkdown>
                </div>

                {/* Show both upright and reversed descriptions if available */}
                {card.isReversed && card.description && card.reversedDescription && (
                  <div className="mt-3 pt-3 border-t border-gray-300">
                    <h5 className="text-xs font-semibold text-gray-600 mb-1">Upright Effect:</h5>
                    <div className="text-gray-500 text-xs leading-relaxed prose prose-xs max-w-none">
                      <ReactMarkdown>{card.description}</ReactMarkdown>
                    </div>
                  </div>
                )}

                {!card.isReversed && card.reversedDescription && (
                  <div className="mt-3 pt-3 border-t border-gray-300">
                    <h5 className="text-xs font-semibold text-gray-600 mb-1">When Reversed:</h5>
                    <div className="text-gray-600 text-xs leading-relaxed opacity-70 prose prose-xs max-w-none">
                      <ReactMarkdown>{card.reversedDescription}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-300">
            <Button
              variant="outline"
              onClick={onClose}
              className="border-gray-400 text-gray-700 hover:text-black hover:border-gray-600"
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
                className="bg-black hover:bg-gray-900 text-white disabled:opacity-50"
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
