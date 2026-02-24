'use client'

import { Droplets, Flame, Mountain, Wind } from 'lucide-react'
import type React from 'react'
import { cn } from '@/lib/utils'
import type { Element, GameState, PlayerId } from '@/schemas/schema'
import {
  calculateActiveSynergies,
  countUnitsByElement,
  getSynergyTier,
} from '@/services/zodiac_synergy_service'

interface ElementSynergyIndicatorProps {
  gameState: GameState
  playerId: PlayerId
  className?: string
}

const ELEMENT_CONFIG: Record<
  Element,
  {
    icon: React.ElementType
    color: string
    bgColor: string
    borderColor: string
    glowColor: string
    label: string
  }
> = {
  fire: {
    icon: Flame,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    glowColor: 'shadow-red-500/20',
    label: 'Fire',
  },
  water: {
    icon: Droplets,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    glowColor: 'shadow-blue-500/20',
    label: 'Water',
  },
  earth: {
    icon: Mountain,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    glowColor: 'shadow-green-500/20',
    label: 'Earth',
  },
  air: {
    icon: Wind,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    glowColor: 'shadow-purple-500/20',
    label: 'Air',
  },
}

const ELEMENTS: Element[] = ['fire', 'water', 'earth', 'air']

export default function ElementSynergyIndicator({
  gameState,
  playerId,
  className = '',
}: ElementSynergyIndicatorProps) {
  const elementCounts = countUnitsByElement(gameState, playerId)
  const { synergies } = calculateActiveSynergies(gameState, playerId)

  // Only show elements that have at least 1 unit
  const activeElements = ELEMENTS.filter(el => (elementCounts[el] || 0) > 0)

  if (activeElements.length === 0) return null

  // Create a lookup for active synergies
  const synergyMap = new Map(synergies.map(s => [s.element, s]))

  return (
    <output
      className={cn('flex items-center gap-1', className)}
      aria-label={`Element synergies for ${playerId === 'player1' ? 'you' : 'opponent'}`}
    >
      {activeElements.map(element => {
        const config = ELEMENT_CONFIG[element]
        const count = elementCounts[element] || 0
        const synergy = synergyMap.get(element)
        const tier = getSynergyTier(count)
        const Icon = config.icon
        const isActive = count >= 2

        return (
          <div
            key={element}
            className={cn(
              'relative flex items-center gap-0.5 px-1.5 py-0.5 rounded-md border text-xs transition-all duration-300',
              isActive
                ? cn(config.bgColor, config.borderColor, 'shadow-sm', config.glowColor)
                : 'bg-muted/50 border-border/50 opacity-60',
            )}
            title={
              synergy
                ? `${config.label} (${count}): ${synergy.bonus.description}`
                : `${config.label}: ${count} unit${count !== 1 ? 's' : ''}`
            }
          >
            <Icon
              className={cn(
                'w-3 h-3',
                isActive ? config.color : 'text-muted-foreground',
                isActive && count >= 4 && 'animate-pulse',
              )}
            />
            <span
              className={cn(
                'font-bold tabular-nums',
                isActive ? config.color : 'text-muted-foreground',
              )}
            >
              {count}
            </span>
            {tier && (
              <span
                className={cn(
                  'hidden md:inline text-[10px] font-medium',
                  isActive ? config.color : 'text-muted-foreground',
                )}
              >
                {tier}
              </span>
            )}
          </div>
        )
      })}
    </output>
  )
}
