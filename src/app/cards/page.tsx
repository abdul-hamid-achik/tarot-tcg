'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { Card } from '@/components/ui/card'
import { CardSearch, type SearchFilters } from '@/components/ui/card_search'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getAllCards } from '@/lib/card_loader'
import type { Card as GameCard } from '@/schemas/schema'

const zodiacSigns = [
  { name: 'aries', symbol: '♈', element: 'fire' },
  { name: 'taurus', symbol: '♉', element: 'earth' },
  { name: 'gemini', symbol: '♊', element: 'air' },
  { name: 'cancer', symbol: '♋', element: 'water' },
  { name: 'leo', symbol: '♌', element: 'fire' },
  { name: 'virgo', symbol: '♍', element: 'earth' },
  { name: 'libra', symbol: '♎', element: 'air' },
  { name: 'scorpio', symbol: '♏', element: 'water' },
  { name: 'sagittarius', symbol: '♐', element: 'fire' },
  { name: 'capricorn', symbol: '♑', element: 'earth' },
  { name: 'aquarius', symbol: '♒', element: 'air' },
  { name: 'pisces', symbol: '♓', element: 'water' },
]

function CardDisplay({ card }: { card: GameCard }) {
  // Generate card URL from the card data
  const cardUrl =
    card.type === 'unit' ? `/cards/${card.zodiacClass}/${card.id}` : `/cards/spells/${card.id}`
  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common':
        return 'bg-gray-100 text-gray-800 dark:text-gray-200'
      case 'uncommon':
        return 'bg-green-100 text-green-800'
      case 'rare':
        return 'bg-blue-100 text-blue-800'
      case 'legendary':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800 dark:text-gray-200'
    }
  }

  const getElementColor = (element: string) => {
    switch (element) {
      case 'fire':
        return 'text-red-500'
      case 'water':
        return 'text-blue-500'
      case 'air':
        return 'text-yellow-500'
      case 'earth':
        return 'text-green-500'
      default:
        return 'text-gray-500'
    }
  }

  return (
    <Link href={cardUrl}>
      <Card className="p-4 space-y-3 hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-blue-300">
        <div className="flex justify-between items-start">
          <h3 className="font-bold text-lg">{card.name}</h3>
          <div className={`w-4 h-4 rounded-full ${getRarityColor(card.rarity)}`} />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-2xl">{card.tarotSymbol}</span>
          <span className={`font-medium ${getElementColor(card.element)}`}>
            {card.element.toUpperCase()}
          </span>
          <span className="text-sm text-gray-600">Cost: {card.cost}</span>
        </div>

        {card.type === 'unit' && (
          <div className="flex gap-4">
            <span className="text-sm">Attack: {card.attack}</span>
            <span className="text-sm">Health: {card.health}</span>
          </div>
        )}

        <div className="text-sm text-gray-600">
          <p className="font-medium mb-1">Type: {card.type}</p>
          {card.keywords && card.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {card.keywords.map(keyword => (
                <Badge key={keyword} variant="outline" className="text-xs">
                  {keyword}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {card.abilities && card.abilities.length > 0 && (
          <div className="space-y-1">
            {card.abilities.map(ability => (
              <div key={`${ability.name}-${ability.description}`} className="text-xs">
                <span className="font-medium">{ability.name}:</span> {ability.description}
              </div>
            ))}
          </div>
        )}

        {card.effects && card.effects.length > 0 && (
          <div className="space-y-1">
            {card.effects.map(effect => (
              <div key={`${effect.name}-${effect.description}`} className="text-xs">
                <span className="font-medium">{effect.name}:</span> {effect.description}
              </div>
            ))}
          </div>
        )}
      </Card>
    </Link>
  )
}

export default function CardsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState<SearchFilters>({})
  const [allCards] = useState(() => getAllCards())

  // Combined filtering logic
  const filteredCards = useMemo(() => {
    let cards = allCards

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      cards = cards.filter(
        card =>
          card.name.toLowerCase().includes(query) ||
          card.description?.toLowerCase().includes(query) ||
          card.abilities?.some(
            ability =>
              ability.name.toLowerCase().includes(query) ||
              ability.description?.toLowerCase().includes(query),
          ) ||
          card.effects?.some(
            effect =>
              effect.name.toLowerCase().includes(query) ||
              effect.description?.toLowerCase().includes(query),
          ),
      )
    }

    // Apply filters
    if (filters.zodiacClass) {
      cards = cards.filter(card => card.zodiacClass === filters.zodiacClass)
    }
    if (filters.element) {
      cards = cards.filter(card => card.element === filters.element)
    }
    if (filters.type) {
      cards = cards.filter(card => card.type === filters.type)
    }
    if (filters.rarity) {
      cards = cards.filter(card => card.rarity === filters.rarity)
    }
    if (
      filters.costRange &&
      filters.costRange.min !== undefined &&
      filters.costRange.max !== undefined
    ) {
      cards = cards.filter(
        card => card.cost >= filters.costRange?.min && card.cost <= filters.costRange?.max,
      )
    }

    return cards
  }, [allCards, searchQuery, filters])

  // Get cards by category for browsing tabs
  const getCardsByCategory = (category: string, value: string) => {
    return allCards.filter(card => {
      switch (category) {
        case 'zodiac':
          return card.zodiacClass === value
        case 'element':
          return card.element === value
        case 'type':
          return card.type === value
        default:
          return false
      }
    })
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb items={[{ label: 'Cards', isCurrentPage: true }]} />

        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2">Tarot Card Collection</h1>
          <p className="text-gray-600">
            Explore the complete tarot deck organized by zodiac classes and archetypes
          </p>
        </div>

        {/* Search and Filters */}
        <CardSearch
          searchQuery={searchQuery}
          filters={filters}
          onSearchChange={setSearchQuery}
          onFilterChange={setFilters}
          totalResults={filteredCards.length}
        />

        {/* Card Grid */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredCards.map(card => (
              <CardDisplay key={card.id} card={card} />
            ))}
          </div>
          {filteredCards.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No cards found matching your criteria</p>
              <p className="text-gray-400 text-sm mt-2">Try adjusting your search or filters</p>
            </div>
          )}
        </div>

        {/* Organization tabs for browsing without search */}
        {!searchQuery.trim() && Object.keys(filters).length === 0 && (
          <div className="border-t pt-8 mt-8">
            <h2 className="text-2xl font-bold mb-4">Browse by Category</h2>
            <Tabs defaultValue="zodiac" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="zodiac">By Zodiac</TabsTrigger>
                <TabsTrigger value="element">By Element</TabsTrigger>
                <TabsTrigger value="type">By Type</TabsTrigger>
              </TabsList>

              <TabsContent value="zodiac" className="space-y-6">
                {zodiacSigns.map(sign => {
                  const cards = getCardsByCategory('zodiac', sign.name)
                  return (
                    <div key={sign.name} className="space-y-3">
                      <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold capitalize">{sign.name}</h2>
                        <span className="text-3xl">{sign.symbol}</span>
                        <Badge
                          className={`${
                            sign.element === 'fire'
                              ? 'bg-red-100 text-red-800'
                              : sign.element === 'water'
                                ? 'bg-blue-100 text-blue-800'
                                : sign.element === 'air'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {sign.element}
                        </Badge>
                        <span className="text-sm text-gray-600">({cards.length} cards)</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {cards.map(card => (
                          <CardDisplay key={card.id} card={card} />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </TabsContent>

              <TabsContent value="element" className="space-y-6">
                {['fire', 'water', 'air', 'earth'].map(element => {
                  const cards = getCardsByCategory('element', element)
                  return (
                    <div key={element} className="space-y-3">
                      <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold capitalize">{element}</h2>
                        <span className="text-sm text-gray-600">({cards.length} cards)</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {cards.map(card => (
                          <CardDisplay key={card.id} card={card} />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </TabsContent>

              <TabsContent value="type" className="space-y-6">
                {['unit', 'spell'].map(type => {
                  const cards = getCardsByCategory('type', type)
                  return (
                    <div key={type} className="space-y-3">
                      <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold capitalize">{type}s</h2>
                        <span className="text-sm text-gray-600">({cards.length} cards)</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {cards.map(card => (
                          <CardDisplay key={card.id} card={card} />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  )
}
