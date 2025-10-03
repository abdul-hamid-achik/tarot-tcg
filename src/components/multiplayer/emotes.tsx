'use client'

import { GameLogger } from '@/lib/game_logger'
import React, { useState } from 'react'
import { cn } from '@/lib/utils'

export interface TarotEmote {
  id: string
  name: string
  text: string
  icon: string
  audio?: string
  arcana: 'major' | 'minor'
  element?: 'fire' | 'earth' | 'air' | 'water'
  mood: 'positive' | 'negative' | 'neutral'
}

export const TAROT_EMOTES: TarotEmote[] = [
  // Major Arcana Emotes
  {
    id: 'fool',
    name: 'The Fool',
    text: '🃏 Beginning journey!',
    icon: '🃏',
    arcana: 'major',
    mood: 'positive',
  },
  {
    id: 'magician',
    name: 'The Magician',
    text: '🎩 As above, so below!',
    icon: '🎩',
    arcana: 'major',
    mood: 'positive',
  },
  {
    id: 'tower',
    name: 'The Tower',
    text: '💥 Everything crumbles!',
    icon: '💥',
    arcana: 'major',
    mood: 'negative',
  },
  {
    id: 'death',
    name: 'Death',
    text: '💀 Transformation comes!',
    icon: '💀',
    arcana: 'major',
    mood: 'neutral',
  },
  {
    id: 'sun',
    name: 'The Sun',
    text: '☀️ Victory shines bright!',
    icon: '☀️',
    arcana: 'major',
    mood: 'positive',
  },
  {
    id: 'star',
    name: 'The Star',
    text: '⭐ Hope guides the way!',
    icon: '⭐',
    arcana: 'major',
    mood: 'positive',
  },
  {
    id: 'moon',
    name: 'The Moon',
    text: '🌙 Illusions cloud truth...',
    icon: '🌙',
    arcana: 'major',
    mood: 'neutral',
  },
  {
    id: 'devil',
    name: 'The Devil',
    text: '😈 Temptation calls!',
    icon: '😈',
    arcana: 'major',
    mood: 'negative',
  },

  // Elemental Emotes
  {
    id: 'fire_power',
    name: 'Fire Power',
    text: '🔥 Passion ignites!',
    icon: '🔥',
    arcana: 'minor',
    element: 'fire',
    mood: 'positive',
  },
  {
    id: 'water_flow',
    name: 'Water Flow',
    text: '🌊 Emotions surge!',
    icon: '🌊',
    arcana: 'minor',
    element: 'water',
    mood: 'neutral',
  },
  {
    id: 'earth_strength',
    name: 'Earth Strength',
    text: '🌱 Rooted in power!',
    icon: '🌱',
    arcana: 'minor',
    element: 'earth',
    mood: 'positive',
  },
  {
    id: 'air_wisdom',
    name: 'Air Wisdom',
    text: '💨 Knowledge flows!',
    icon: '💨',
    arcana: 'minor',
    element: 'air',
    mood: 'positive',
  },

  // Gameplay Emotes
  {
    id: 'good_game',
    name: 'Good Game',
    text: '🤝 Well played!',
    icon: '🤝',
    arcana: 'minor',
    mood: 'positive',
  },
  {
    id: 'thinking',
    name: 'Contemplating',
    text: '🤔 Pondering the cards...',
    icon: '🤔',
    arcana: 'minor',
    mood: 'neutral',
  },
  {
    id: 'surprise',
    name: 'Surprise',
    text: '😮 Unexpected turn!',
    icon: '😮',
    arcana: 'minor',
    mood: 'neutral',
  },
  {
    id: 'celebrate',
    name: 'Celebration',
    text: '🎉 The universe aligns!',
    icon: '🎉',
    arcana: 'minor',
    mood: 'positive',
  },
]

interface EmoteWheelProps {
  onEmote: (emote: TarotEmote) => void
  className?: string
}

export function EmoteWheel({ onEmote, className }: EmoteWheelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'major' | 'minor' | 'elements'>(
    'all',
  )

  const filteredEmotes = TAROT_EMOTES.filter(emote => {
    switch (selectedCategory) {
      case 'major':
        return emote.arcana === 'major'
      case 'minor':
        return emote.arcana === 'minor'
      case 'elements':
        return emote.element !== undefined
      default:
        return true
    }
  })

  const handleEmoteClick = (emote: TarotEmote) => {
    onEmote(emote)
    setIsOpen(false)
  }

  return (
    <div className={cn('relative', className)}>
      {/* Emote Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-12 h-12 rounded-full bg-purple-600 hover:bg-purple-700 text-white',
          'flex items-center justify-center shadow-lg transition-all duration-300',
          'hover:scale-110 active:scale-95',
          isOpen && 'bg-purple-700 scale-110',
        )}
        title="Tarot Emotes"
      >
        <span className="text-xl">🎭</span>
      </button>

      {/* Emote Wheel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setIsOpen(false)} />

          {/* Emote Panel */}
          <div className="absolute bottom-14 right-0 z-50 bg-gray-900/95 backdrop-blur-sm border border-purple-600/50 rounded-xl p-4 w-80 max-w-[90vw] shadow-2xl">
            <div className="flex flex-col gap-3">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-purple-400">🎴 Tarot Emotes</h3>
                <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">
                  ✕
                </button>
              </div>

              {/* Category Filter */}
              <div className="flex gap-1 mb-2">
                {(['all', 'major', 'minor', 'elements'] as const).map(category => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                      selectedCategory === category
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600',
                    )}
                  >
                    {category === 'all'
                      ? '🌟 All'
                      : category === 'major'
                        ? '🃏 Major'
                        : category === 'minor'
                          ? '✨ Minor'
                          : '🌊 Elements'}
                  </button>
                ))}
              </div>

              {/* Emote Grid */}
              <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
                {filteredEmotes.map(emote => (
                  <button
                    key={emote.id}
                    onClick={() => handleEmoteClick(emote)}
                    className={cn(
                      'p-3 rounded-lg transition-all duration-200',
                      'hover:scale-105 active:scale-95',
                      'flex flex-col items-center gap-1',
                      emote.mood === 'positive' &&
                      'bg-green-600/20 hover:bg-green-600/30 border border-green-600/30',
                      emote.mood === 'negative' &&
                      'bg-red-600/20 hover:bg-red-600/30 border border-red-600/30',
                      emote.mood === 'neutral' &&
                      'bg-purple-600/20 hover:bg-purple-600/30 border border-purple-600/30',
                    )}
                    title={emote.text}
                  >
                    <span className="text-2xl">{emote.icon}</span>
                    <span className="text-xs text-center text-gray-300 leading-tight">
                      {emote.name}
                    </span>
                  </button>
                ))}
              </div>

              {/* Footer */}
              <div className="text-xs text-gray-400 text-center border-t border-gray-700 pt-2">
                Express yourself through the ancient wisdom of the Tarot
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

interface EmoteDisplayProps {
  emote: TarotEmote
  playerName: string
  isOwn?: boolean
  className?: string
}

export function EmoteDisplay({ emote, playerName, isOwn = false, className }: EmoteDisplayProps) {
  const [isVisible, setIsVisible] = useState(true)

  // Auto-hide after 4 seconds
  React.useEffect(() => {
    const timer = setTimeout(() => setIsVisible(false), 4000)
    return () => clearTimeout(timer)
  }, [])

  if (!isVisible) return null

  return (
    <div
      className={cn(
        'fixed z-50 pointer-events-none',
        'animate-in fade-in-0 slide-in-from-bottom-2 duration-300',
        isOwn ? 'bottom-20 right-4' : 'top-20 left-4',
        className,
      )}
    >
      <div
        className={cn(
          'bg-gray-900/95 backdrop-blur-sm border rounded-lg p-3 shadow-2xl max-w-xs',
          emote.mood === 'positive' && 'border-green-600/50 bg-green-900/20',
          emote.mood === 'negative' && 'border-red-600/50 bg-red-900/20',
          emote.mood === 'neutral' && 'border-purple-600/50 bg-purple-900/20',
        )}
      >
        <div className="flex items-center gap-3">
          <span className="text-3xl">{emote.icon}</span>
          <div className="flex-1">
            <div className="text-sm font-medium text-white">{isOwn ? 'You' : playerName}</div>
            <div className="text-sm text-gray-300">{emote.text}</div>
          </div>
        </div>

        {/* Tarot-themed border effect */}
        <div className="absolute inset-0 rounded-lg border border-amber-500/20 pointer-events-none animate-pulse" />
      </div>
    </div>
  )
}

// Hook for emote functionality
export function useEmotes() {
  const [currentEmote, setCurrentEmote] = useState<{
    emote: TarotEmote
    playerName: string
    isOwn: boolean
  } | null>(null)

  const sendEmote = (emote: TarotEmote) => {
    // Send to server/other players
    GameLogger.debug('Sending emote:', emote)

    // Show locally
    setCurrentEmote({
      emote,
      playerName: 'You',
      isOwn: true,
    })

    // TODO: Integrate with WebSocket service
    // webSocketService.sendEmote(emote)
  }

  const receiveEmote = (emote: TarotEmote, playerName: string) => {
    setCurrentEmote({
      emote,
      playerName,
      isOwn: false,
    })
  }

  const clearEmote = () => {
    setCurrentEmote(null)
  }

  return {
    currentEmote,
    sendEmote,
    receiveEmote,
    clearEmote,
  }
}
