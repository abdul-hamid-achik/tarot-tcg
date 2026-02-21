'use client'

import { useEffect, useState, useMemo } from 'react'
import { Navigation } from '@/components/layout/navigation'
import TarotCard from '@/components/tarot_card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { getAllCards, isValidDeck } from '@/lib/card_loader'
import type { Card as GameCard } from '@/schemas/schema'
import { Filter, Save, Shuffle, Trash2, Download, Upload, Swords, Sparkles, ChevronRight } from 'lucide-react'
import Link from 'next/link'

type FilterState = {
  search: string
  zodiac: string
  element: string
  type: string
  rarity: string
  maxCost: number | null
}

const ZODIAC_CLASSES = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
]

const ELEMENTS = ['fire', 'earth', 'air', 'water']
const RARITIES = ['common', 'uncommon', 'rare', 'legendary', 'mythic']

export default function DeckBuilder() {
  const [allCards, setAllCards] = useState<GameCard[]>([])
  const [deck, setDeck] = useState<GameCard[]>([])
  const [deckName, setDeckName] = useState('My Deck')
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    zodiac: '',
    element: '',
    type: '',
    rarity: '',
    maxCost: null,
  })
  const [savedDecks, setSavedDecks] = useState<{ name: string; cards: string[] }[]>([])
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    const cards = getAllCards()
    setAllCards(cards)

    // Load saved decks from localStorage
    try {
      const saved = localStorage.getItem('tarot-tcg-decks')
      if (saved) {
        setSavedDecks(JSON.parse(saved))
      }
    } catch {
      // Corrupted localStorage data - ignore and start fresh
    }
  }, [])

  const filteredCards = useMemo(() => {
    return allCards.filter(card => {
      if (filters.search && !card.name.toLowerCase().includes(filters.search.toLowerCase())) {
        return false
      }
      if (filters.zodiac && card.zodiacClass !== filters.zodiac) return false
      if (filters.element && card.element !== filters.element) return false
      if (filters.type && card.type !== filters.type) return false
      if (filters.rarity && card.rarity !== filters.rarity) return false
      if (filters.maxCost !== null && card.cost > filters.maxCost) return false
      return true
    }).sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name))
  }, [allCards, filters])

  const deckCardCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const card of deck) {
      counts.set(card.id, (counts.get(card.id) || 0) + 1)
    }
    return counts
  }, [deck])

  const validation = useMemo(() => isValidDeck(deck), [deck])

  const manaCurve = useMemo(() => {
    const curve: Record<number, number> = {}
    for (const card of deck) {
      const cost = Math.min(card.cost, 7) // Group 7+ together
      curve[cost] = (curve[cost] || 0) + 1
    }
    return curve
  }, [deck])

  const addCard = (card: GameCard) => {
    const currentCount = deckCardCounts.get(card.id) || 0
    if (currentCount >= 3) return
    if (deck.length >= 40) return
    setDeck([...deck, { ...card }])
  }

  const removeCard = (cardId: string) => {
    const idx = deck.findIndex(c => c.id === cardId)
    if (idx !== -1) {
      setDeck(deck.filter((_, i) => i !== idx))
    }
  }

  const clearDeck = () => setDeck([])

  const randomFill = () => {
    const remaining = 30 - deck.length
    if (remaining <= 0) return

    const available = allCards.filter(card => {
      const count = deckCardCounts.get(card.id) || 0
      return count < 3
    })

    const shuffled = [...available].sort(() => Math.random() - 0.5)
    const newCards: GameCard[] = []
    const tempCounts = new Map(deckCardCounts)

    for (const card of shuffled) {
      if (newCards.length >= remaining) break
      const count = tempCounts.get(card.id) || 0
      if (count < 3) {
        newCards.push({ ...card })
        tempCounts.set(card.id, count + 1)
      }
    }

    setDeck([...deck, ...newCards])
  }

  const saveDeck = () => {
    const deckData = { name: deckName, cards: deck.map(c => c.id) }
    const existing = savedDecks.filter(d => d.name !== deckName)
    const updated = [...existing, deckData]
    setSavedDecks(updated)
    localStorage.setItem('tarot-tcg-decks', JSON.stringify(updated))
  }

  const loadDeck = (savedDeck: { name: string; cards: string[] }) => {
    setDeckName(savedDeck.name)
    const loaded = savedDeck.cards
      .map(id => allCards.find(c => c.id === id))
      .filter(Boolean) as GameCard[]
    setDeck(loaded)
  }

  const deleteSavedDeck = (name: string) => {
    const updated = savedDecks.filter(d => d.name !== name)
    setSavedDecks(updated)
    localStorage.setItem('tarot-tcg-decks', JSON.stringify(updated))
  }

  const exportDeck = () => {
    const data = JSON.stringify({ name: deckName, cards: deck.map(c => c.id) })
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${deckName.replace(/\s+/g, '-').toLowerCase()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const maxCurveHeight = Math.max(...Object.values(manaCurve), 1)

  const unitCount = deck.filter(c => c.type === 'unit').length
  const spellCount = deck.filter(c => c.type === 'spell').length

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-background text-foreground">
        <div className="container mx-auto px-4 py-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold">Deck Builder</h1>
              <p className="text-muted-foreground">Build your 30-40 card deck (max 3 copies each)</p>
            </div>
            <div className="flex gap-2">
              {deck.length >= 30 && validation.valid && (
                <Link href={`/play?deck=${encodeURIComponent(deckName)}`}>
                  <Button className="bg-emerald-600 hover:bg-emerald-700">
                    <Swords className="w-4 h-4 mr-2" />
                    Play with Deck
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Card Collection (left 2/3) */}
            <div className="lg:col-span-2 space-y-4">
              {/* Search & Filters */}
              <div className="flex gap-2">
                <Input
                  placeholder="Search cards..."
                  value={filters.search}
                  onChange={e => setFilters({ ...filters, search: e.target.value })}
                  className="flex-1"
                />
                <Button
                  variant={showFilters ? 'default' : 'outline'}
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter className="w-4 h-4 mr-2" />
                  Filters
                </Button>
              </div>

              {showFilters && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 p-4 border border-border rounded-lg bg-card">
                  <select
                    className="px-3 py-2 rounded-md border border-border bg-background text-sm"
                    value={filters.zodiac}
                    onChange={e => setFilters({ ...filters, zodiac: e.target.value })}
                  >
                    <option value="">All Zodiac</option>
                    {ZODIAC_CLASSES.map(z => (
                      <option key={z} value={z}>{z.charAt(0).toUpperCase() + z.slice(1)}</option>
                    ))}
                  </select>

                  <select
                    className="px-3 py-2 rounded-md border border-border bg-background text-sm"
                    value={filters.element}
                    onChange={e => setFilters({ ...filters, element: e.target.value })}
                  >
                    <option value="">All Elements</option>
                    {ELEMENTS.map(e => (
                      <option key={e} value={e}>{e.charAt(0).toUpperCase() + e.slice(1)}</option>
                    ))}
                  </select>

                  <select
                    className="px-3 py-2 rounded-md border border-border bg-background text-sm"
                    value={filters.type}
                    onChange={e => setFilters({ ...filters, type: e.target.value })}
                  >
                    <option value="">All Types</option>
                    <option value="unit">Units</option>
                    <option value="spell">Spells</option>
                  </select>

                  <select
                    className="px-3 py-2 rounded-md border border-border bg-background text-sm"
                    value={filters.rarity}
                    onChange={e => setFilters({ ...filters, rarity: e.target.value })}
                  >
                    <option value="">All Rarities</option>
                    {RARITIES.map(r => (
                      <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                    ))}
                  </select>

                  <select
                    className="px-3 py-2 rounded-md border border-border bg-background text-sm"
                    value={filters.maxCost === null ? '' : String(filters.maxCost)}
                    onChange={e => setFilters({ ...filters, maxCost: e.target.value ? Number(e.target.value) : null })}
                  >
                    <option value="">Any Cost</option>
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(c => (
                      <option key={c} value={c}>{c} or less</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Card Grid */}
              <div className="text-sm text-muted-foreground mb-2">
                {filteredCards.length} cards available
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                {filteredCards.map(card => {
                  const count = deckCardCounts.get(card.id) || 0
                  const isMaxed = count >= 3
                  const isDeckFull = deck.length >= 40

                  return (
                    <div
                      key={card.id}
                      className={`relative cursor-pointer transition-all duration-200 ${
                        isMaxed || isDeckFull ? 'opacity-40' : 'hover:scale-105 hover:z-10'
                      }`}
                      onClick={() => !isMaxed && !isDeckFull && addCard(card)}
                    >
                      <TarotCard card={card} size="small" showReversedEffects={false} />
                      {count > 0 && (
                        <Badge
                          className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs px-1.5 min-w-[20px] text-center"
                        >
                          {count}/3
                        </Badge>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Deck Panel (right 1/3) */}
            <div className="space-y-4">
              {/* Deck Name & Actions */}
              <div className="p-4 border border-border rounded-lg bg-card space-y-3">
                <Input
                  value={deckName}
                  onChange={e => setDeckName(e.target.value)}
                  className="font-bold text-lg"
                  placeholder="Deck name..."
                />

                <div className="flex items-center justify-between">
                  <span className={`text-2xl font-bold ${
                    deck.length < 30 ? 'text-amber-500' :
                    deck.length <= 40 ? 'text-emerald-500' : 'text-red-500'
                  }`}>
                    {deck.length}/30-40
                  </span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={randomFill} title="Auto-fill to 30">
                      <Shuffle className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={saveDeck} title="Save deck">
                      <Save className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={exportDeck} title="Export deck">
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={clearDeck} title="Clear deck">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Validation */}
                {!validation.valid && (
                  <div className="text-sm text-red-400 space-y-1">
                    {validation.errors.map((err, i) => (
                      <div key={i}>{err}</div>
                    ))}
                  </div>
                )}
                {deck.length < 30 && (
                  <div className="text-sm text-amber-400">
                    Need at least {30 - deck.length} more cards
                  </div>
                )}
              </div>

              {/* Deck Stats */}
              <div className="p-4 border border-border rounded-lg bg-card space-y-3">
                <h3 className="font-semibold text-sm">Deck Stats</h3>

                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <Swords className="w-3 h-3" />
                    <span>{unitCount} units</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    <span>{spellCount} spells</span>
                  </div>
                </div>

                {/* Mana Curve */}
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Mana Curve</div>
                  <div className="flex items-end gap-1 h-16">
                    {[0, 1, 2, 3, 4, 5, 6, 7].map(cost => {
                      const count = manaCurve[cost] || 0
                      const height = maxCurveHeight > 0 ? (count / maxCurveHeight) * 100 : 0
                      return (
                        <div key={cost} className="flex-1 flex flex-col items-center">
                          <div
                            className="w-full bg-primary/60 rounded-t transition-all duration-300"
                            style={{ height: `${height}%`, minHeight: count > 0 ? '4px' : '0' }}
                          />
                          <div className="text-[10px] text-muted-foreground mt-1">
                            {cost === 7 ? '7+' : cost}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Deck Card List */}
              <div className="p-4 border border-border rounded-lg bg-card">
                <h3 className="font-semibold text-sm mb-2">Cards in Deck</h3>
                <div className="space-y-1 max-h-[400px] overflow-y-auto">
                  {deck.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Click cards to add them</p>
                  ) : (
                    // Group by card id and show counts
                    [...deckCardCounts.entries()]
                      .sort(([idA], [idB]) => {
                        const cardA = deck.find(c => c.id === idA)!
                        const cardB = deck.find(c => c.id === idB)!
                        return cardA.cost - cardB.cost || cardA.name.localeCompare(cardB.name)
                      })
                      .map(([cardId, count]) => {
                        const card = deck.find(c => c.id === cardId)!
                        return (
                          <div
                            key={cardId}
                            className="flex items-center justify-between px-2 py-1 rounded hover:bg-muted/50 group cursor-pointer"
                            onClick={() => removeCard(cardId)}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs font-mono text-primary w-4 text-center shrink-0">
                                {card.cost}
                              </span>
                              <span className="text-sm truncate">{card.name}</span>
                              {card.type === 'spell' && (
                                <Sparkles className="w-3 h-3 text-purple-400 shrink-0" />
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {count > 1 && (
                                <Badge variant="secondary" className="text-xs px-1">
                                  x{count}
                                </Badge>
                              )}
                              <Trash2 className="w-3 h-3 opacity-0 group-hover:opacity-100 text-red-400 transition-opacity" />
                            </div>
                          </div>
                        )
                      })
                  )}
                </div>
              </div>

              {/* Saved Decks */}
              {savedDecks.length > 0 && (
                <div className="p-4 border border-border rounded-lg bg-card">
                  <h3 className="font-semibold text-sm mb-2">Saved Decks</h3>
                  <div className="space-y-1">
                    {savedDecks.map(d => (
                      <div
                        key={d.name}
                        className="flex items-center justify-between px-2 py-1 rounded hover:bg-muted/50"
                      >
                        <button
                          className="text-sm text-left truncate flex-1"
                          onClick={() => loadDeck(d)}
                        >
                          {d.name} ({d.cards.length} cards)
                        </button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={() => deleteSavedDeck(d.name)}
                        >
                          <Trash2 className="w-3 h-3 text-red-400" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
