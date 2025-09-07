"use client"

import React from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sparkles, Sword } from "lucide-react"
import { Card as GameCard } from '@/types/game'
import { getCardImagePath, getCardBackImagePath } from '@/lib/cardImages'

interface TarotCardProps {
  card?: GameCard | null
  isHidden?: boolean
  isSelected?: boolean
  isDamaged?: boolean
  size?: 'small' | 'medium' | 'large'
  className?: string
  onClick?: () => void
  onDragStart?: (e: React.DragEvent) => void
  draggable?: boolean
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
  draggable = false
}: TarotCardProps) {
  const sizeClasses = {
    small: 'w-20 h-32',
    medium: 'w-32 h-48',
    large: 'w-40 h-60'
  }

  const imagePath = isHidden || !card ? getCardBackImagePath() : getCardImagePath(card)

  const getTypeIcon = (type?: string) => {
    switch (type) {
      case "unit":
        return <Sword className="w-3 h-3" />
      case "spell":
        return <Sparkles className="w-3 h-3" />
      default:
        return null
    }
  }

  const getRarityColor = (card: GameCard) => {
    if (!card.rarity) {
      // Fallback based on cost
      const cost = card.cost
      if (cost <= 2) return "bg-slate-600 text-slate-200"
      if (cost <= 4) return "bg-blue-600 text-blue-200"
      return "bg-purple-600 text-purple-200"
    }

    switch (card.rarity) {
      case 'common': return "bg-slate-600 text-slate-200"
      case 'uncommon': return "bg-green-600 text-green-200"
      case 'rare': return "bg-blue-600 text-blue-200"
      case 'legendary': return "bg-purple-600 text-purple-200"
      default: return "bg-slate-600 text-slate-200"
    }
  }

  return (
    <Card
      className={`
        ${sizeClasses[size]} 
        relative overflow-hidden cursor-pointer transition-all duration-200
        ${isSelected ? 'ring-2 ring-amber-400 shadow-lg shadow-amber-400/20' : ''}
        ${isDamaged ? 'animate-pulse ring-1 ring-red-500/50' : ''}
        ${className}
        hover:scale-105 hover:shadow-lg
        bg-slate-900 border-2 border-slate-700
      `}
      onClick={onClick}
      onDragStart={onDragStart}
      draggable={draggable}
    >
      {/* Card Image */}
      <div className="absolute inset-0">
        <img
          src={imagePath}
          alt={isHidden ? "Card Back" : card?.name || "Unknown Card"}
          className="w-full h-full object-cover"
          onError={(e) => {
            // Fallback if image fails to load
            (e.target as HTMLImageElement).src = getCardBackImagePath()
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
            <Badge className={`text-xs px-1 py-0 ${getRarityColor(card)}`}>
              {card.rarity || 'C'}
            </Badge>
          </div>

          {/* Bottom overlay with stats and type */}
          <div className="absolute bottom-1 left-1 right-1 z-10">
            <div className="bg-black/80 backdrop-blur-sm rounded p-1">
              {/* Card Name */}
              <div className="text-white text-xs font-semibold truncate mb-1 flex items-center gap-1">
                {getTypeIcon(card.type)}
                <span>{card.name}</span>
              </div>

              {/* Stats for units */}
              {card.type === 'unit' && (
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1 text-xs">
                    <Sword className="w-3 h-3 text-red-400" />
                    <span className="text-white font-bold">{card.attack}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-white font-bold">
                      {isDamaged && card.currentHealth !== undefined ? card.currentHealth : card.health}
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