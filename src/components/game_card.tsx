'use client'

import { CardContent, CardHeader, Card as CardUI } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { Card } from '@/schemas/schema'

interface GameCardProps {
  card: Card
  isSelected?: boolean
  onClick?: () => void
  size?: 'small' | 'medium' | 'large'
  showStats?: boolean
}

export function GameCard({
  card,
  isSelected = false,
  onClick,
  size = 'medium',
  showStats = true,
}: GameCardProps) {
  const sizeClasses = {
    small: 'w-16 h-20',
    medium: 'w-24 h-32',
    large: 'w-32 h-44',
  }

  const fontSize = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-base',
  }

  return (
    <CardUI
      className={cn(
        sizeClasses[size],
        'cursor-pointer transition-all hover:scale-105 hover:shadow-lg',
        'bg-gradient-to-br from-card to-muted border-border',
        isSelected && 'ring-2 ring-primary scale-105',
        'relative overflow-hidden',
      )}
      onClick={onClick}
    >
      <CardHeader className={cn('p-1', fontSize[size])}>
        <div className="flex justify-between items-start">
          <span className="text-foreground font-bold">{card.cost}</span>
          {card.tarotSymbol && <span className="text-muted-foreground">{card.tarotSymbol}</span>}
        </div>
      </CardHeader>

      <CardContent className={cn('p-1 flex flex-col justify-between h-full', fontSize[size])}>
        <div className="text-center">
          <p className="font-semibold text-foreground truncate">{card.name}</p>
          {size !== 'small' && card.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{card.description}</p>
          )}
        </div>

        {showStats && card.type === 'unit' && (
          <div className="flex justify-between mt-auto">
            <span className="text-foreground font-bold">⚔️ {card.attack}</span>
            <span className="text-foreground font-bold">❤️ {card.health}</span>
          </div>
        )}
      </CardContent>
    </CardUI>
  )
}
