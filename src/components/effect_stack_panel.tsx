'use client'

import { AlertCircle, ArrowDown, ArrowUp, Clock, Target, Timer, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { Card as GameCard, GameState } from '@/schemas/schema'
import type { StackItem } from '@/services/effect_stack_service'

interface EffectStackPanelProps {
  className?: string
  onResponse?: (stackItemId: string, responseType: string) => void
  onPassPriority?: () => void
}

export function EffectStackPanel({ className, onResponse, onPassPriority }: EffectStackPanelProps) {
  const [stackState, setStackState] = useState({
    items: [] as StackItem[],
    canRespond: false,
    activePlayer: null as 'player1' | 'player2' | null,
    resolutionInProgress: false,
  })

  // This would be connected to the actual effect stack service
  useEffect(() => {
    // Mock data for development
    const mockStack: StackItem[] = [
      {
        id: 'stack_1',
        type: 'spell',
        effect: {
          id: 'lightning_bolt',
          name: 'Lightning Bolt',
          description: 'Deal 3 damage to any target',
          type: 'instant',
          execute: () => ({ success: true }),
        },
        context: { gameState: {} as GameState, source: {} as GameCard },
        priority: 1000,
        timestamp: Date.now() - 5000,
        sequenceNumber: 1,
        sourcePlayerId: 'player1',
        sourceCardId: 'card_123',
        canBeCountered: true,
        canRespond: true,
      },
      {
        id: 'stack_2',
        type: 'triggered_ability',
        effect: {
          id: 'counter_spell',
          name: 'Counterspell',
          description: 'Counter target spell',
          type: 'instant',
          execute: () => ({ success: true }),
        },
        context: { gameState: {} as GameState, source: {} as GameCard },
        priority: 1500,
        timestamp: Date.now() - 2000,
        sequenceNumber: 2,
        sourcePlayerId: 'player2',
        sourceCardId: 'card_456',
        canBeCountered: true,
        canRespond: true,
      },
    ]

    setStackState({
      items: mockStack,
      canRespond: true,
      activePlayer: 'player1',
      resolutionInProgress: false,
    })
  }, [])

  if (stackState.items.length === 0 && !stackState.resolutionInProgress) {
    return (
      <Card className={`p-4 ${className}`}>
        <div className="flex items-center justify-center text-gray-500 py-8">
          <div className="text-center">
            <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No effects on the stack</p>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className={`p-4 space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-600" />
          <h3 className="font-semibold text-sm">Effect Stack</h3>
          <Badge variant="outline" className="text-xs">
            {stackState.items.length} effects
          </Badge>
        </div>

        {stackState.resolutionInProgress && (
          <div className="flex items-center gap-2 text-xs text-amber-600">
            <Timer className="w-3 h-3 animate-spin" />
            Resolving...
          </div>
        )}
      </div>

      {/* Stack Items */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {stackState.items.map((item, index) => (
          <StackItemCard
            key={item.id}
            item={item}
            position={index + 1}
            isTop={index === 0}
            canRespond={stackState.canRespond && stackState.activePlayer !== null}
            onResponse={responseType => onResponse?.(item.id, responseType)}
          />
        ))}
      </div>

      {/* Resolution Direction Indicator */}
      {stackState.items.length > 1 && (
        <div className="flex items-center justify-center py-2 border-t">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <ArrowUp className="w-3 h-3" />
            <span>Resolves top to bottom</span>
            <ArrowDown className="w-3 h-3" />
          </div>
        </div>
      )}

      {/* Player Actions */}
      {stackState.canRespond && stackState.activePlayer && (
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="text-xs text-gray-600">{stackState.activePlayer} can respond</div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onPassPriority} className="text-xs">
              Pass Priority
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

interface StackItemCardProps {
  item: StackItem
  position: number
  isTop: boolean
  canRespond: boolean
  onResponse?: (responseType: string) => void
}

function StackItemCard({ item, position, isTop, canRespond, onResponse }: StackItemCardProps) {
  const getItemIcon = (type: string) => {
    switch (type) {
      case 'spell':
        return <Zap className="w-3 h-3 text-blue-500" />
      case 'ability':
        return <Target className="w-3 h-3 text-purple-500" />
      case 'triggered_ability':
        return <AlertCircle className="w-3 h-3 text-orange-500" />
      case 'state_based':
        return <Clock className="w-3 h-3 text-green-500" />
      default:
        return <Target className="w-3 h-3 text-gray-500" />
    }
  }

  const getPriorityColor = (priority: number) => {
    if (priority >= 5000) return 'bg-red-100 text-red-800 border-red-200'
    if (priority >= 3000) return 'bg-orange-100 text-orange-800 border-orange-200'
    if (priority >= 1000) return 'bg-blue-100 text-blue-800 border-blue-200'
    return 'bg-gray-100 text-gray-800 border-gray-200'
  }

  const getPlayerColor = (playerId: string) => {
    return playerId === 'player1'
      ? 'bg-blue-50 border-blue-200 text-blue-800'
      : 'bg-red-50 border-red-200 text-red-800'
  }

  return (
    <div
      className={`relative p-3 rounded-lg border-2 transition-all ${
        isTop ? 'bg-yellow-50 border-yellow-300 shadow-lg' : 'bg-white border-gray-200'
      }`}
    >
      {/* Position indicator */}
      <div className="absolute -top-2 -left-2 w-6 h-6 bg-gray-800 text-white rounded-full flex items-center justify-center text-xs font-bold">
        {position}
      </div>

      {/* Top indicator for next to resolve */}
      {isTop && (
        <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-500 text-white rounded-full flex items-center justify-center">
          <ArrowDown className="w-3 h-3" />
        </div>
      )}

      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 mt-1">{getItemIcon(item.type)}</div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-sm text-gray-900 truncate">{item.effect.name}</h4>
            <div className="flex gap-1">
              <Badge
                variant="outline"
                className={`text-xs px-1.5 py-0.5 ${getPriorityColor(item.priority)}`}
              >
                P{item.priority}
              </Badge>
              <Badge
                variant="outline"
                className={`text-xs px-1.5 py-0.5 ${getPlayerColor(item.sourcePlayerId)}`}
              >
                {item.sourcePlayerId}
              </Badge>
            </div>
          </div>

          <p className="text-xs text-gray-600 mb-2 line-clamp-2">{item.effect.description}</p>

          {/* Type and timing info */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <span className="capitalize">{item.type.replace('_', ' ')}</span>
              {!item.canBeCountered && (
                <Badge variant="outline" className="text-xs">
                  Uncounterable
                </Badge>
              )}
            </div>
            <span>#{item.sequenceNumber}</span>
          </div>

          {/* Response options */}
          {canRespond && item.canBeCountered && (
            <div className="flex gap-1 mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onResponse?.('counter')}
                className="text-xs px-2 py-1 h-auto"
              >
                Counter
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onResponse?.('respond')}
                className="text-xs px-2 py-1 h-auto"
              >
                Respond
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Compact version for the game board
export function CompactEffectStackPanel({
  className,
  onClick,
}: {
  className?: string
  onClick?: () => void
}) {
  const [stackSize, setStackSize] = useState(0)
  const [isResolving, setIsResolving] = useState(false)

  // This would be connected to the actual effect stack service
  useEffect(() => {
    setStackSize(2) // Mock data
    setIsResolving(false)
  }, [])

  if (stackSize === 0 && !isResolving) {
    return null
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={`flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-2 py-1 ${className}`}
      onClick={onClick}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }}
    >
      {isResolving ? (
        <>
          <Timer className="w-3 h-3 animate-spin text-amber-600" />
          <span className="text-xs text-amber-600">Resolving</span>
        </>
      ) : (
        <>
          <Zap className="w-3 h-3 text-yellow-600" />
          <span className="text-xs text-gray-600">Stack ({stackSize})</span>
        </>
      )}
    </div>
  )
}
