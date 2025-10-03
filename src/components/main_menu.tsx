'use client'

import {
  BookOpen,
  Gift,
  Moon,
  Package,
  Scroll,
  Settings,
  Shield,
  Sparkles,
  Star,
  Sun,
  Swords,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import type React from 'react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

interface MenuOption {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  color: string
  available: boolean
  route?: string
}

const menuOptions: MenuOption[] = [
  {
    id: 'quickplay',
    title: 'Quick Play',
    description: 'Start a practice game',
    icon: <Sparkles className="w-8 h-8" />,
    color: 'text-primary',
    available: true,
  },
  {
    id: 'tutorial',
    title: 'Tutorial',
    description: 'Learn the mystical arts',
    icon: <BookOpen className="w-8 h-8" />,
    color: 'text-accent',
    available: true,
    route: '/tutorial',
  },
  {
    id: 'codex',
    title: 'Tarot Codex',
    description: 'Cards, lore & strategy',
    icon: <Scroll className="w-8 h-8" />,
    color: 'text-primary',
    available: true,
    route: '/content',
  },
  {
    id: 'pvp',
    title: 'PvP Arena',
    description: 'Challenge other mystics',
    icon: <Swords className="w-8 h-8" />,
    color: 'text-destructive',
    available: true,
    route: '/multiplayer',
  },
  {
    id: 'pve',
    title: 'Campaign',
    description: 'Journey through realms',
    icon: <Shield className="w-8 h-8" />,
    color: 'text-primary',
    available: false,
  },
  {
    id: 'collections',
    title: 'Collections',
    description: 'Your tarot deck',
    icon: <Package className="w-8 h-8" />,
    color: 'text-secondary',
    available: false,
  },
  {
    id: 'loot',
    title: 'Loot',
    description: 'Mystical rewards',
    icon: <Gift className="w-8 h-8" />,
    color: 'text-accent',
    available: false,
  },
  {
    id: 'settings',
    title: 'Settings',
    description: 'Configure your experience',
    icon: <Settings className="w-8 h-8" />,
    color: 'text-muted-foreground',
    available: false,
  },
]

export interface MainMenuProps {
  onStartGame?: () => void
}

export function MainMenu({ onStartGame }: MainMenuProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [hoveredOption, setHoveredOption] = useState<string | null>(null)
  const router = useRouter()

  const handleOptionClick = (option: MenuOption) => {
    if (!option.available) return

    setSelectedOption(option.id)

    if (option.id === 'quickplay') {
      onStartGame?.()
    } else if (option.route) {
      router.push(option.route)
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 relative overflow-hidden transition-colors">
      {/* Mystical Background Elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 animate-pulse">
          <Star className="w-6 h-6 text-gray-400" />
        </div>
        <div className="absolute top-32 right-20 animate-pulse delay-1000">
          <Moon className="w-8 h-8 text-gray-500" />
        </div>
        <div className="absolute bottom-20 left-32 animate-pulse delay-500">
          <Sun className="w-7 h-7 text-gray-400" />
        </div>
        <div className="absolute bottom-40 right-10 animate-pulse delay-700">
          <Sparkles className="w-5 h-5 text-gray-500" />
        </div>
        <div className="absolute top-1/2 left-1/4 animate-pulse delay-300">
          <Star className="w-4 h-4 text-gray-400" />
        </div>
        <div className="absolute top-1/3 right-1/3 animate-pulse delay-1200">
          <Moon className="w-5 h-5 text-gray-500" />
        </div>
      </div>

      {/* Header */}
      <header className="relative z-10 p-6 text-center">
        <h1 className="text-4xl font-bold text-black dark:text-white mb-2 text-balance transition-colors">
          Mystic Tarot Arena
        </h1>
        <p className="text-gray-800 dark:text-gray-200 text-lg transition-colors">
          Unveil the secrets of the cards
        </p>
        <div className="flex justify-center items-center gap-4 mt-4">
          <Badge
            variant="secondary"
            className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-black dark:text-white border-gray-300 dark:border-gray-600 transition-colors"
          >
            <Sparkles className="w-4 h-4 mr-1" />
            Level 12 Mystic
          </Badge>
          <Badge
            variant="outline"
            className="px-3 py-1 border-gray-400 dark:border-gray-500 text-black dark:text-white transition-colors"
          >
            <Star className="w-4 h-4 mr-1" />
            1,247 Essence
          </Badge>
        </div>
      </header>

      {/* Main Menu Grid */}
      <div className="relative z-10 flex-1 flex items-center justify-center p-8">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 max-w-4xl w-full">
          {menuOptions.map(option => (
            <Card
              key={option.id}
              className={`
                relative group cursor-pointer transition-all duration-300 transform
                ${hoveredOption === option.id ? 'scale-105 shadow-2xl' : 'hover:scale-102'}
                ${selectedOption === option.id ? 'ring-2 ring-primary shadow-primary/25' : ''}
                ${!option.available ? 'opacity-50 cursor-not-allowed' : ''}
                bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 shadow-sm transition-colors
              `}
              onMouseEnter={() => setHoveredOption(option.id)}
              onMouseLeave={() => setHoveredOption(null)}
              onClick={() => handleOptionClick(option)}
            >
              <CardContent className="p-6 text-center space-y-4">
                {/* Icon with mystical glow effect */}
                <div
                  className={`
                  mx-auto w-16 h-16 rounded-full flex items-center justify-center
                  bg-gradient-to-br from-gray-50 to-gray-100
                  ${hoveredOption === option.id ? 'shadow-lg shadow-primary/25' : ''}
                  transition-all duration-300
                `}
                >
                  <div className={`${option.color} transition-colors duration-300`}>
                    {option.icon}
                  </div>
                </div>

                {/* Title and Description */}
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-black dark:text-white transition-colors">
                    {option.title}
                  </h3>
                  <p className="text-sm text-gray-800 dark:text-gray-200 text-pretty transition-colors">
                    {option.description}
                  </p>
                </div>

                {/* Availability indicator */}
                {!option.available && (
                  <Badge
                    variant="outline"
                    className="text-xs border-gray-400 dark:border-gray-500 text-gray-800 dark:text-gray-200 transition-colors"
                  >
                    Coming Soon
                  </Badge>
                )}

                {/* Mystical border effect on hover */}
                <div
                  className={`
                  absolute inset-0 rounded-lg border-2 border-transparent
                  ${hoveredOption === option.id ? 'border-gray-400' : ''}
                  transition-all duration-300 pointer-events-none
                `}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Mystical footer */}
      <footer className="relative z-10 text-center p-4 text-gray-800 dark:text-gray-200 text-sm transition-colors">
        <p>The cards hold infinite wisdom • Choose your path wisely</p>
      </footer>
    </div>
  )
}
