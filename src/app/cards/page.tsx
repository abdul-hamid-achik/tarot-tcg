"use client"

import { getAllCards, getCardsByZodiacClass, getCardsByElement } from '@/lib/cardLoader'
import { Card as GameCard } from '@/types/game'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useState } from 'react'

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
  { name: 'pisces', symbol: '♓', element: 'water' }
]

function CardDisplay({ card }: { card: GameCard }) {
  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return 'bg-gray-100 text-gray-800'
      case 'uncommon': return 'bg-green-100 text-green-800'
      case 'rare': return 'bg-blue-100 text-blue-800'
      case 'legendary': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getElementColor = (element: string) => {
    switch (element) {
      case 'fire': return 'text-red-500'
      case 'water': return 'text-blue-500'
      case 'air': return 'text-yellow-500'
      case 'earth': return 'text-green-500'
      default: return 'text-gray-500'
    }
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex justify-between items-start">
        <h3 className="font-bold text-lg">{card.name}</h3>
        <Badge className={getRarityColor(card.rarity)}>{card.rarity}</Badge>
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
            {card.keywords.map((keyword) => (
              <Badge key={keyword} variant="outline" className="text-xs">
                {keyword}
              </Badge>
            ))}
          </div>
        )}
      </div>
      
      {card.abilities && card.abilities.length > 0 && (
        <div className="space-y-1">
          {card.abilities.map((ability, idx) => (
            <div key={idx} className="text-xs">
              <span className="font-medium">{ability.name}:</span> {ability.description}
            </div>
          ))}
        </div>
      )}
      
      {card.effects && card.effects.length > 0 && (
        <div className="space-y-1">
          {card.effects.map((effect, idx) => (
            <div key={idx} className="text-xs">
              <span className="font-medium">{effect.name}:</span> {effect.description}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

export default function CardsPage() {
  const [selectedZodiac, setSelectedZodiac] = useState<string>('all')
  const [allCards] = useState(() => getAllCards())

  const filteredCards = selectedZodiac === 'all' 
    ? allCards 
    : getCardsByZodiacClass(selectedZodiac)

  const cardsByZodiac = zodiacSigns.reduce((acc, sign) => {
    acc[sign.name] = getCardsByZodiacClass(sign.name)
    return acc
  }, {} as Record<string, GameCard[]>)

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2">Tarot Card Collection</h1>
          <p className="text-gray-600">
            Explore the complete tarot deck organized by zodiac classes and archetypes
          </p>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">All Cards ({allCards.length})</TabsTrigger>
            <TabsTrigger value="zodiac">By Zodiac</TabsTrigger>
            <TabsTrigger value="element">By Element</TabsTrigger>
            <TabsTrigger value="type">By Type</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {allCards.map((card) => (
                <CardDisplay key={card.id} card={card} />
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="zodiac" className="space-y-6">
            {zodiacSigns.map((sign) => {
              const cards = cardsByZodiac[sign.name]
              return (
                <div key={sign.name} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold capitalize">{sign.name}</h2>
                    <span className="text-3xl">{sign.symbol}</span>
                    <Badge className={`${sign.element === 'fire' ? 'bg-red-100 text-red-800' :
                      sign.element === 'water' ? 'bg-blue-100 text-blue-800' :
                      sign.element === 'air' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'}`}>
                      {sign.element}
                    </Badge>
                    <span className="text-sm text-gray-600">({cards.length} cards)</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {cards.map((card) => (
                      <CardDisplay key={card.id} card={card} />
                    ))}
                  </div>
                </div>
              )
            })}
          </TabsContent>
          
          <TabsContent value="element" className="space-y-6">
            {['fire', 'water', 'air', 'earth'].map((element) => {
              const cards = getCardsByElement(element)
              return (
                <div key={element} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold capitalize">{element}</h2>
                    <span className="text-sm text-gray-600">({cards.length} cards)</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {cards.map((card) => (
                      <CardDisplay key={card.id} card={card} />
                    ))}
                  </div>
                </div>
              )
            })}
          </TabsContent>
          
          <TabsContent value="type" className="space-y-6">
            {['unit', 'spell'].map((type) => {
              const cards = allCards.filter(card => card.type === type)
              return (
                <div key={type} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold capitalize">{type}s</h2>
                    <span className="text-sm text-gray-600">({cards.length} cards)</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {cards.map((card) => (
                      <CardDisplay key={card.id} card={card} />
                    ))}
                  </div>
                </div>
              )
            })}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}