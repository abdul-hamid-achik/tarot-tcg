'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { DualFaceAbilities } from '@/components/dual_face_abilities'
import { Badge } from '@/components/ui/badge'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { Card } from '@/components/ui/card'
import { CardSearch, type SearchFilters } from '@/components/ui/card_search'
import { getCardImagePath } from '@/lib/card_images'
import { getCardPagePath } from '@/lib/card_orientation'
import type { Card as GameCard } from '@/schemas/schema'

function CardDisplay({ card }: { card: GameCard }) {
  const cardUrl = getCardPagePath(card.slug || '')
  const imagePath = getCardImagePath(card)

  return (
    <Link href={cardUrl} data-card-id={card.id} className="block h-full">
      <Card className="h-full p-4 space-y-3 hover:shadow-lg transition-shadow border border-border hover:border-foreground/40">
        <div className="flex gap-3">
          <Image
            src={imagePath}
            alt=""
            width={64}
            height={96}
            className="w-16 h-24 object-cover rounded-sm border border-border flex-shrink-0"
          />
          <div className="min-w-0 flex-1 space-y-1">
            <h3 className="font-bold text-lg leading-tight">{card.name}</h3>
            <p className="text-xs text-muted-foreground">
              {card.cost} mana
              {card.type === 'unit'
                ? ` · ${card.attack}/${card.health}`
                : ` · ${card.spellType || 'spell'}`}
              {` · ${card.zodiacClass} · ${card.element}`}
            </p>
            {card.keywords && card.keywords.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {card.keywords.slice(0, 3).map(keyword => (
                  <Badge key={keyword} variant="outline" className="text-[10px]">
                    {keyword}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <DualFaceAbilities
          upright={card.uprightAbilities || []}
          reversed={card.reversedAbilities || []}
          compact
        />
      </Card>
    </Link>
  )
}

export function CardsCatalog({ cards }: { cards: GameCard[] }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState<SearchFilters>({})

  const filteredCards = useMemo(() => {
    let next = cards

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      next = next.filter(
        card =>
          card.name.toLowerCase().includes(query) ||
          card.description?.toLowerCase().includes(query) ||
          card.abilities?.some(
            ability =>
              ability.name.toLowerCase().includes(query) ||
              ability.description?.toLowerCase().includes(query),
          ) ||
          card.uprightAbilities?.some(
            ability =>
              ability.name.toLowerCase().includes(query) ||
              ability.description?.toLowerCase().includes(query),
          ) ||
          card.reversedAbilities?.some(
            ability =>
              ability.name.toLowerCase().includes(query) ||
              ability.description?.toLowerCase().includes(query),
          ) ||
          card.reversedDescription?.toLowerCase().includes(query) ||
          card.effects?.some(
            effect =>
              effect.name.toLowerCase().includes(query) ||
              effect.description?.toLowerCase().includes(query),
          ),
      )
    }

    if (filters.zodiacClass) {
      next = next.filter(card => card.zodiacClass === filters.zodiacClass)
    }
    if (filters.element) {
      next = next.filter(card => card.element === filters.element)
    }
    if (filters.type) {
      next = next.filter(card => card.type === filters.type)
    }
    if (filters.rarity) {
      next = next.filter(card => card.rarity === filters.rarity)
    }
    if (
      filters.costRange &&
      filters.costRange.min !== undefined &&
      filters.costRange.max !== undefined
    ) {
      const { min, max } = filters.costRange
      next = next.filter(card => card.cost >= min && card.cost <= max)
    }

    return next
  }, [cards, searchQuery, filters])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <Breadcrumb items={[{ label: 'Cards', isCurrentPage: true }]} />

          <div>
            <h1 className="text-4xl font-bold mb-2">All 78 cards</h1>
            <p className="text-muted-foreground max-w-2xl">
              Every card has an upright face and a reversed face. Open a card for lore and stats, or
              read the compact text here.
            </p>
          </div>

          <CardSearch
            searchQuery={searchQuery}
            filters={filters}
            onSearchChange={setSearchQuery}
            onFilterChange={setFilters}
            totalResults={filteredCards.length}
          />

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredCards.map(card => (
                <CardDisplay key={card.id} card={card} />
              ))}
            </div>
            {filteredCards.length === 0 && (
              <div className="py-12 max-w-md">
                <h2 className="text-lg font-semibold mb-1">No cards match that search</h2>
                <p className="text-sm text-muted-foreground">
                  Clear the query or filters to see the full 78-card deck again.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
