'use client'

import { Heart, Sword, X, Zap } from 'lucide-react'
import { useEffect, useRef } from 'react'
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
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus()
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="card-detail-title"
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <div className="bg-card rounded-xl border border-border max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 id="card-detail-title" className="text-xl font-bold text-foreground">
            {card.name}
          </h2>
          <Button
            ref={closeButtonRef}
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={`Close ${card.name} details`}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" aria-hidden="true" />
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
                <Badge className="bg-primary text-primary-foreground">
                  <Zap className="w-3 h-3 mr-1" />
                  Cost {card.cost}
                </Badge>

                {card.type === 'unit' && (
                  <>
                    <Badge className="bg-red-600 text-white">
                      <Sword className="w-3 h-3 mr-1" />
                      {card.attack} Attack
                    </Badge>
                    <Badge className="bg-emerald-600 text-white">
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
                          : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {card.rarity.charAt(0).toUpperCase() + card.rarity.slice(1)}
                </Badge>
              </div>

              {/* Zodiac & Element */}
              <div className="flex items-center gap-2">
                <span className="text-2xl">{card.tarotSymbol}</span>
                <span className="text-muted-foreground">
                  {card.zodiacClass.charAt(0).toUpperCase() + card.zodiacClass.slice(1)} •{' '}
                  {card.element.charAt(0).toUpperCase() + card.element.slice(1)}
                </span>
              </div>

              {/* Keywords */}
              {card.keywords && card.keywords.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground">Keywords</h4>
                  <div className="flex flex-wrap gap-2">
                    {card.keywords.map(keyword => (
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
                  <h4 className="text-sm font-semibold text-foreground">Abilities</h4>
                  <div className="space-y-2">
                    {card.abilities.map(ability => (
                      <div
                        key={`${ability.name}-${ability.description}`}
                        className="bg-muted border border-border rounded p-3"
                      >
                        <div className="font-semibold text-foreground text-sm mb-1">
                          {ability.name}
                        </div>
                        <div className="text-muted-foreground text-sm">{ability.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  Description
                  {card.isReversed && (
                    <Badge variant="secondary" className="text-xs border border-border">
                      ⤊ Reversed
                    </Badge>
                  )}
                </h4>
                <div
                  className={`text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none ${card.isReversed ? 'text-muted-foreground' : 'text-muted-foreground/80'}`}
                >
                  <ReactMarkdown>
                    {card.isReversed && card.reversedDescription
                      ? card.reversedDescription
                      : card.description || 'A mystical card imbued with ancient tarot power.'}
                  </ReactMarkdown>
                </div>

                {/* Show both upright and reversed descriptions if available */}
                {card.isReversed && card.description && card.reversedDescription && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <h5 className="text-xs font-semibold text-muted-foreground mb-1">
                      Upright Effect:
                    </h5>
                    <div className="text-muted-foreground/70 text-xs leading-relaxed prose prose-xs dark:prose-invert max-w-none">
                      <ReactMarkdown>{card.description}</ReactMarkdown>
                    </div>
                  </div>
                )}

                {!card.isReversed && card.reversedDescription && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <h5 className="text-xs font-semibold text-muted-foreground mb-1">
                      When Reversed:
                    </h5>
                    <div className="text-muted-foreground/60 text-xs leading-relaxed prose prose-xs dark:prose-invert max-w-none">
                      <ReactMarkdown>{card.reversedDescription}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {onPlay && (
              <Button
                onClick={() => {
                  onPlay()
                  onClose()
                }}
                disabled={!canPlay}
                className="bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50"
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
