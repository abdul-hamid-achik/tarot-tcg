'use client'

import { Sparkles, Sword } from 'lucide-react'
import type React from 'react'
import { Card } from '@/components/ui/card'
import { getCardBackImagePath, getCardImagePath } from '@/lib/card_images'
import type { Card as GameCard } from '@/schemas/schema'

interface TarotCardProps {
  card?: GameCard | null
  isHidden?: boolean
  isSelected?: boolean
  isDamaged?: boolean
  size?: 'small' | 'medium' | 'large' | 'battlefield'
  className?: string
  onClick?: () => void
  onDragStart?: (e: React.DragEvent) => void
  draggable?: boolean
  showReversedEffects?: boolean // Whether to show reversed description
}

export default function TarotCard({
  card,
  isHidden = false,
  isSelected = false,
  isDamaged = false,
  size = 'medium',
  className = '',
  onClick,
  onDragStart,
  draggable = false,
  showReversedEffects = true,
}: TarotCardProps) {
  const sizeClasses = {
    small: 'w-24 h-36', // Increased from w-20 h-32 for better readability
    medium: 'w-32 h-48', // Standard size
    large: 'w-40 h-60', // Enlarged for detailed view
    battlefield: 'w-20 h-28', // Optimized specifically for battlefield grid
  }

  const imagePath = isHidden || !card ? getCardBackImagePath() : getCardImagePath(card)

  // Get effective stats considering reversed state
  const getEffectiveStats = () => {
    if (!card || !showReversedEffects)
      return {
        attack: card?.attack || 0,
        health: card?.health || 0,
        description: card?.description || '',
      }

    if (card.isReversed) {
      return {
        attack: Math.max(0, Math.floor(card.attack * 0.7)), // Reversed attack reduction
        health: card.health + 1, // Reversed health increase
        description: card.reversedDescription || `Reversed: ${card.description}` || '',
      }
    }

    return { attack: card.attack, health: card.health, description: card.description || '' }
  }

  const effectiveStats = getEffectiveStats()

  const getTypeIcon = (type?: string) => {
    switch (type) {
      case 'unit':
        return <Sword className="w-3 h-3" />
      case 'spell':
        return <Sparkles className="w-3 h-3" />
      default:
        return null
    }
  }

  const getRarityColor = (card: GameCard) => {
    if (!card.rarity) {
      // Fallback based on cost
      const cost = card.cost
      if (cost <= 2) return 'bg-slate-600 text-slate-200'
      if (cost <= 4) return 'bg-blue-600 text-blue-200'
      return 'bg-purple-600 text-purple-200'
    }

    switch (card.rarity) {
      case 'common':
        return 'bg-slate-600 text-slate-200'
      case 'uncommon':
        return 'bg-green-600 text-green-200'
      case 'rare':
        return 'bg-blue-600 text-blue-200'
      case 'legendary':
        return 'bg-purple-600 text-purple-200'
      default:
        return 'bg-slate-600 text-slate-200'
    }
  }

  return (
    <Card
      className={`
        ${sizeClasses[size]} 
        relative overflow-hidden cursor-pointer transition-all duration-200
        ${isSelected ? 'ring-2 ring-amber-400 shadow-lg shadow-amber-400/20' : ''}
        ${isDamaged ? 'animate-pulse ring-1 ring-red-500/50' : ''}
        ${card?.isReversed ? 'ring-2 ring-red-400/60 shadow-lg shadow-red-400/30' : ''}
        ${className}
        hover:scale-105 hover:shadow-lg
        bg-slate-900 border-2 border-slate-700
      `}
      onClick={onClick}
      onDragStart={onDragStart}
      draggable={draggable}
      style={{
        transformOrigin: 'center',
        transform: card?.isReversed ? 'rotate(180deg)' : undefined,
      }}
    >
      {/* Card Image */}
      <div className="absolute inset-0">
        <img
          src={imagePath}
          alt={isHidden ? 'Card Back' : card?.name || 'Unknown Card'}
          className="w-full h-full object-cover"
          onError={e => {
            // Fallback if image fails to load
            ;(e.target as HTMLImageElement).src = getCardBackImagePath()
          }}
        />
      </div>

      {/* Overlay for non-hidden cards */}
      {!isHidden && card && (
        <>
          {/* Top overlay with cost and rarity */}
          <div className="absolute top-1 left-1 right-1 flex justify-between items-start z-10">
            {/* Mana Cost */}
            <div className="bg-black/80 rounded-full w-8 h-8 flex items-center justify-center">
              <span className="text-white text-sm font-bold">{card.cost}</span>
            </div>

            {/* Rarity Badge */}
            <div className={`w-3 h-3 rounded-full ${getRarityColor(card)}`} />
          </div>

          {/* Bottom overlay with stats and type */}
          <div className="absolute bottom-1 left-1 right-1 z-10">
            <div className="bg-black/80 backdrop-blur-sm rounded p-1">
              {/* Card Name */}
              <div className="text-white text-xs font-semibold truncate mb-1 flex items-center gap-1">
                {getTypeIcon(card.type)}
                <span className={card.isReversed ? 'text-red-300' : 'text-white'}>
                  {card.name}
                  {card.isReversed && <span className="text-red-400 ml-1">⤊</span>}
                </span>
              </div>

              {/* Stats for units */}
              {card.type === 'unit' && (
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1 text-xs">
                    <Sword
                      className={`w-3 h-3 ${card.isReversed ? 'text-orange-400' : 'text-red-400'}`}
                    />
                    <span
                      className={`font-bold ${card.isReversed ? 'text-orange-300' : 'text-white'}`}
                    >
                      {effectiveStats.attack}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <div
                      className={`w-3 h-3 rounded-full ${card.isReversed ? 'bg-orange-500' : 'bg-red-500'}`}
                    />
                    <span
                      className={`font-bold ${card.isReversed ? 'text-orange-300' : 'text-white'}`}
                    >
                      {isDamaged && card.currentHealth !== undefined
                        ? card.currentHealth
                        : effectiveStats.health}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Zodiac Class indicator */}
          {card.zodiacClass && (
            <div className="absolute top-1 left-1/2 transform -translate-x-1/2 z-10">
              <div className="bg-black/60 rounded px-2 py-0.5">
                <span className="text-xs text-purple-300 capitalize">
                  {card.zodiacClass.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {/* Hidden card overlay - removed to show card back image */}
    </Card>
  )
}
