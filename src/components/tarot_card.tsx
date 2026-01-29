'use client'

import { Sparkles, Sword, Heart, Shield } from 'lucide-react'
import type React from 'react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
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
  rotateIfReversed?: boolean // Whether to physically rotate the card 180deg if reversed (only for battlefield)
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
  rotateIfReversed = false,
}: TarotCardProps) {
  const sizeClasses = {
    small: 'w-24 h-36', // Hand cards
    medium: 'w-32 h-48', // Standard size
    large: 'w-40 h-60', // Enlarged for detailed view
    battlefield: 'w-22 h-30', // Slightly larger for better readability
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

  // Get display health (current or base)
  const displayHealth = isDamaged && card?.currentHealth !== undefined
    ? card.currentHealth
    : effectiveStats.health
  const isLowHealth = card && displayHealth <= Math.floor(card.health / 2)

  // Battlefield-specific compact layout
  const isBattlefield = size === 'battlefield'

  return (
    <Card
      className={cn(
        sizeClasses[size],
        'relative overflow-hidden cursor-pointer transition-all duration-200',
        'bg-slate-900 border-2',
        // Selection states
        isSelected && 'ring-2 ring-emerald-400 shadow-lg shadow-emerald-400/30 border-emerald-500',
        // Damage state
        isDamaged && 'animate-pulse ring-1 ring-red-500/50',
        // Reversed state
        card?.isReversed && !isSelected && 'ring-2 ring-violet-400/60 shadow-lg shadow-violet-400/30 border-violet-500',
        // Default border
        !isSelected && !card?.isReversed && 'border-slate-600',
        // Hover
        'hover:shadow-lg',
        className,
      )}
      onClick={onClick}
      onDragStart={onDragStart}
      draggable={draggable}
      style={{
        transformOrigin: 'center',
        transform: card?.isReversed && rotateIfReversed ? 'rotate(180deg)' : undefined,
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
            ; (e.target as HTMLImageElement).src = getCardBackImagePath()
          }}
        />
      </div>

      {/* Overlay for non-hidden cards */}
      {!isHidden && card && (
        <>
          {/* Top overlay with cost */}
          <div className="absolute top-1 left-1 right-1 flex justify-between items-start z-10">
            {/* Mana Cost - More prominent */}
            <div className={cn(
              'rounded-full flex items-center justify-center shadow-md',
              isBattlefield ? 'w-6 h-6' : 'w-8 h-8',
              'bg-gradient-to-br from-blue-600 to-blue-800 border border-blue-400',
            )}>
              <span className={cn(
                'text-white font-bold',
                isBattlefield ? 'text-xs' : 'text-sm',
              )}>
                {card.cost}
              </span>
            </div>

            {/* Rarity Badge */}
            <div className={cn(
              'rounded-full shadow-sm',
              isBattlefield ? 'w-2 h-2' : 'w-3 h-3',
              getRarityColor(card),
            )} />
          </div>

          {/* Bottom overlay with stats and type - Improved for battlefield */}
          <div className="absolute bottom-0 left-0 right-0 z-10">
            <div className={cn(
              'bg-gradient-to-t from-black/95 via-black/80 to-transparent',
              isBattlefield ? 'p-1 pt-3' : 'p-1.5 pt-4',
            )}>
              {/* Card Name - Truncated for battlefield */}
              <div className={cn(
                'font-semibold truncate flex items-center gap-1',
                isBattlefield ? 'text-[10px] mb-0.5' : 'text-xs mb-1',
                card.isReversed ? 'text-violet-300' : 'text-white',
              )}>
                {!isBattlefield && getTypeIcon(card.type)}
                <span className="truncate">
                  {isBattlefield ? card.name.split(' ')[0] : card.name}
                </span>
                {card.isReversed && (
                  <span className="text-violet-400 flex-shrink-0">↺</span>
                )}
              </div>

              {/* Stats for units - More prominent for battlefield */}
              {card.type === 'unit' && (
                <div className="flex justify-between items-center">
                  {/* Attack */}
                  <div className={cn(
                    'flex items-center gap-0.5 px-1.5 py-0.5 rounded-md',
                    'bg-amber-600/90',
                    isBattlefield ? 'text-[10px]' : 'text-xs',
                  )}>
                    <Sword className={cn(
                      isBattlefield ? 'w-2.5 h-2.5' : 'w-3 h-3',
                      'text-amber-200',
                    )} />
                    <span className="font-bold text-white">
                      {effectiveStats.attack}
                    </span>
                  </div>

                  {/* Health */}
                  <div className={cn(
                    'flex items-center gap-0.5 px-1.5 py-0.5 rounded-md',
                    isLowHealth ? 'bg-red-600/90 animate-pulse' : 'bg-red-500/90',
                    isBattlefield ? 'text-[10px]' : 'text-xs',
                  )}>
                    <Heart className={cn(
                      isBattlefield ? 'w-2.5 h-2.5' : 'w-3 h-3',
                      'text-red-200',
                    )} />
                    <span className={cn(
                      'font-bold',
                      isLowHealth ? 'text-red-100' : 'text-white',
                    )}>
                      {displayHealth}
                    </span>
                  </div>
                </div>
              )}

              {/* Spell indicator */}
              {card.type === 'spell' && (
                <div className={cn(
                  'flex items-center justify-center gap-1 px-2 py-0.5 rounded-md',
                  'bg-violet-600/90',
                  isBattlefield ? 'text-[10px]' : 'text-xs',
                )}>
                  <Sparkles className={cn(
                    isBattlefield ? 'w-2.5 h-2.5' : 'w-3 h-3',
                    'text-violet-200',
                  )} />
                  <span className="font-bold text-white">Spell</span>
                </div>
              )}
            </div>
          </div>

          {/* Status indicators for battlefield */}
          {isBattlefield && card.hasSummoningSickness && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
              <div className="bg-slate-900/80 rounded-full p-1">
                <span className="text-slate-400 text-[10px]">💤</span>
              </div>
            </div>
          )}

          {/* Divine Shield indicator */}
          {card.divineShield && (
            <div className="absolute top-1 right-1 z-20">
              <Shield className="w-4 h-4 text-amber-400 drop-shadow-lg" />
            </div>
          )}
        </>
      )}
    </Card>
  )
}
