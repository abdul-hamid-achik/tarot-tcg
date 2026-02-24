'use client'

import {
  AlertCircle,
  ArrowUpDown,
  Check,
  ChevronRight,
  Download,
  Droplets,
  Filter,
  Flame,
  Leaf,
  Save,
  Search,
  Shuffle,
  Sparkles,
  Swords,
  Trash2,
  Upload,
  Wind,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigation } from '@/components/layout/navigation'
import TarotCard from '@/components/tarot_card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { getAllCards, isValidDeck } from '@/lib/card_loader'
import type { Card as GameCard } from '@/schemas/schema'

type FilterState = {
  search: string
  zodiac: string
  element: string
  type: string
  rarity: string
  costRange: string
}

type SortOption =
  | 'cost-asc'
  | 'cost-desc'
  | 'name-asc'
  | 'name-desc'
  | 'attack-desc'
  | 'health-desc'

const ZODIAC_CLASSES = [
  'aries',
  'taurus',
  'gemini',
  'cancer',
  'leo',
  'virgo',
  'libra',
  'scorpio',
  'sagittarius',
  'capricorn',
  'aquarius',
  'pisces',
]

const ELEMENTS = ['fire', 'earth', 'air', 'water'] as const
const RARITIES = ['common', 'uncommon', 'rare', 'legendary', 'mythic']

const ELEMENT_CONFIG = {
  fire: {
    icon: Flame,
    color: 'text-red-400',
    bg: 'bg-red-500/20',
    border: 'border-red-500/40',
    activeBg: 'bg-red-500',
    label: 'Fire',
  },
  water: {
    icon: Droplets,
    color: 'text-blue-400',
    bg: 'bg-blue-500/20',
    border: 'border-blue-500/40',
    activeBg: 'bg-blue-500',
    label: 'Water',
  },
  earth: {
    icon: Leaf,
    color: 'text-green-400',
    bg: 'bg-green-500/20',
    border: 'border-green-500/40',
    activeBg: 'bg-green-500',
    label: 'Earth',
  },
  air: {
    icon: Wind,
    color: 'text-purple-400',
    bg: 'bg-purple-500/20',
    border: 'border-purple-500/40',
    activeBg: 'bg-purple-500',
    label: 'Air',
  },
} as const

const COST_RANGES = [
  { label: 'Low (0-2)', value: 'low', min: 0, max: 2 },
  { label: 'Mid (3-5)', value: 'mid', min: 3, max: 5 },
  { label: 'High (6+)', value: 'high', min: 6, max: 99 },
]

const MANA_CURVE_COLORS = [
  'bg-blue-400',
  'bg-blue-500',
  'bg-indigo-500',
  'bg-violet-500',
  'bg-purple-500',
  'bg-fuchsia-500',
  'bg-pink-500',
  'bg-rose-500',
]

const MIN_DECK_SIZE = 30
const MAX_DECK_SIZE = 40
const MAX_COPIES = 3

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
    costRange: '',
  })
  const [sortBy, setSortBy] = useState<SortOption>('cost-asc')
  const [savedDecks, setSavedDecks] = useState<{ name: string; cards: string[] }[]>([])
  const [showFilters, setShowFilters] = useState(true)
  const [showSortMenu, setShowSortMenu] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)

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
    const filtered = allCards.filter(card => {
      if (filters.search && !card.name.toLowerCase().includes(filters.search.toLowerCase())) {
        return false
      }
      if (filters.zodiac && card.zodiacClass !== filters.zodiac) return false
      if (filters.element && card.element !== filters.element) return false
      if (filters.type && card.type !== filters.type) return false
      if (filters.rarity && card.rarity !== filters.rarity) return false
      if (filters.costRange) {
        const range = COST_RANGES.find(r => r.value === filters.costRange)
        if (range && (card.cost < range.min || card.cost > range.max)) return false
      }
      return true
    })

    switch (sortBy) {
      case 'cost-asc':
        return filtered.sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name))
      case 'cost-desc':
        return filtered.sort((a, b) => b.cost - a.cost || a.name.localeCompare(b.name))
      case 'name-asc':
        return filtered.sort((a, b) => a.name.localeCompare(b.name))
      case 'name-desc':
        return filtered.sort((a, b) => b.name.localeCompare(a.name))
      case 'attack-desc':
        return filtered.sort((a, b) => b.attack - a.attack || a.cost - b.cost)
      case 'health-desc':
        return filtered.sort((a, b) => b.health - a.health || a.cost - b.cost)
      default:
        return filtered
    }
  }, [allCards, filters, sortBy])

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

  const elementDistribution = useMemo(() => {
    const dist: Record<string, number> = { fire: 0, water: 0, earth: 0, air: 0 }
    for (const card of deck) {
      if (card.element in dist) {
        dist[card.element]++
      }
    }
    return dist
  }, [deck])

  const deckValidationRules = useMemo(() => {
    const cardOverLimit = [...deckCardCounts.entries()].some(([, count]) => count > MAX_COPIES)
    return [
      {
        label: `Min ${MIN_DECK_SIZE} cards`,
        passed: deck.length >= MIN_DECK_SIZE,
      },
      {
        label: `Max ${MAX_DECK_SIZE} cards`,
        passed: deck.length <= MAX_DECK_SIZE,
      },
      {
        label: `Max ${MAX_COPIES} copies per card`,
        passed: !cardOverLimit,
      },
    ]
  }, [deck.length, deckCardCounts])

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filters.zodiac) count++
    if (filters.element) count++
    if (filters.type) count++
    if (filters.rarity) count++
    if (filters.costRange) count++
    return count
  }, [filters])

  const addCard = useCallback((card: GameCard) => {
    setDeck(prev => {
      const counts = new Map<string, number>()
      for (const c of prev) {
        counts.set(c.id, (counts.get(c.id) || 0) + 1)
      }
      const currentCount = counts.get(card.id) || 0
      if (currentCount >= MAX_COPIES) return prev
      if (prev.length >= MAX_DECK_SIZE) return prev
      return [...prev, { ...card }]
    })
  }, [])

  const removeCard = useCallback((cardId: string) => {
    setDeck(prev => {
      const idx = prev.findIndex(c => c.id === cardId)
      if (idx !== -1) {
        return prev.filter((_, i) => i !== idx)
      }
      return prev
    })
  }, [])

  const clearDeck = useCallback(() => setDeck([]), [])

  const randomFill = useCallback(() => {
    setDeck(prev => {
      const remaining = MIN_DECK_SIZE - prev.length
      if (remaining <= 0) return prev

      const currentCounts = new Map<string, number>()
      for (const c of prev) {
        currentCounts.set(c.id, (currentCounts.get(c.id) || 0) + 1)
      }

      const available = allCards.filter(card => {
        const count = currentCounts.get(card.id) || 0
        return count < MAX_COPIES
      })

      const shuffled = [...available].sort(() => Math.random() - 0.5)
      const newCards: GameCard[] = []
      const tempCounts = new Map(currentCounts)

      for (const card of shuffled) {
        if (newCards.length >= remaining) break
        const count = tempCounts.get(card.id) || 0
        if (count < MAX_COPIES) {
          newCards.push({ ...card })
          tempCounts.set(card.id, count + 1)
        }
      }

      return [...prev, ...newCards]
    })
  }, [allCards])

  const saveDeck = useCallback(() => {
    const deckData = { name: deckName, cards: deck.map(c => c.id) }
    const existing = savedDecks.filter(d => d.name !== deckName)
    const updated = [...existing, deckData]
    setSavedDecks(updated)
    localStorage.setItem('tarot-tcg-decks', JSON.stringify(updated))
  }, [deck, deckName, savedDecks])

  const loadDeck = useCallback(
    (savedDeck: { name: string; cards: string[] }) => {
      setDeckName(savedDeck.name)
      const loaded = savedDeck.cards
        .map(id => allCards.find(c => c.id === id))
        .filter(Boolean) as GameCard[]
      setDeck(loaded)
    },
    [allCards],
  )

  const deleteSavedDeck = useCallback((name: string) => {
    setSavedDecks(prev => {
      const updated = prev.filter(d => d.name !== name)
      localStorage.setItem('tarot-tcg-decks', JSON.stringify(updated))
      return updated
    })
  }, [])

  const exportDeck = useCallback(() => {
    const data = JSON.stringify({ name: deckName, cards: deck.map(c => c.id) })
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${deckName.replace(/\s+/g, '-').toLowerCase()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [deck, deckName])

  const importDeck = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = event => {
        try {
          const data = JSON.parse(event.target?.result as string)
          if (data.name && Array.isArray(data.cards)) {
            setDeckName(data.name)
            const loaded = data.cards
              .map((id: string) => allCards.find(c => c.id === id))
              .filter(Boolean) as GameCard[]
            setDeck(loaded)
          }
        } catch {
          // Invalid file format
        }
      }
      reader.readAsText(file)
      // Reset input so the same file can be imported again
      if (importRef.current) importRef.current.value = ''
    },
    [allCards],
  )

  const clearFilters = useCallback(() => {
    setFilters({ search: '', zodiac: '', element: '', type: '', rarity: '', costRange: '' })
  }, [])

  const maxCurveHeight = Math.max(...Object.values(manaCurve), 1)

  const unitCount = deck.filter(c => c.type === 'unit').length
  const spellCount = deck.filter(c => c.type === 'spell').length

  // Progress bar color
  const progressPercent = Math.min((deck.length / MAX_DECK_SIZE) * 100, 100)
  const progressColor =
    deck.length < 20
      ? 'bg-red-500'
      : deck.length < 36
        ? 'bg-amber-500'
        : deck.length <= MAX_DECK_SIZE
          ? 'bg-emerald-500'
          : 'bg-red-500'
  const isComplete =
    deck.length >= MIN_DECK_SIZE && deck.length <= MAX_DECK_SIZE && validation.valid

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-background text-foreground">
        <div className="container mx-auto px-4 py-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
            <div>
              <h1 className="text-3xl font-bold">Deck Builder</h1>
              <p className="text-muted-foreground text-sm">
                Build your {MIN_DECK_SIZE}-{MAX_DECK_SIZE} card deck (max {MAX_COPIES} copies each)
              </p>
            </div>
            <div className="flex gap-2">
              {isComplete && (
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 lg:gap-0">
            {/* Card Collection (left 2/3) */}
            <div className="lg:col-span-2 space-y-4 lg:pr-6 lg:border-r lg:border-border pb-6 lg:pb-0">
              {/* Search & Filters */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search cards by name..."
                    value={filters.search}
                    onChange={e => setFilters({ ...filters, search: e.target.value })}
                    className="pl-9 pr-8"
                  />
                  {filters.search && (
                    <button
                      type="button"
                      onClick={() => setFilters({ ...filters, search: '' })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <Button
                  variant={showFilters ? 'default' : 'outline'}
                  onClick={() => setShowFilters(!showFilters)}
                  className="relative"
                >
                  <Filter className="w-4 h-4 mr-2" />
                  Filters
                  {activeFilterCount > 0 && (
                    <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-emerald-500">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
                <div className="relative">
                  <Button
                    variant="outline"
                    onClick={() => setShowSortMenu(!showSortMenu)}
                    title="Sort cards"
                  >
                    <ArrowUpDown className="w-4 h-4" />
                  </Button>
                  {showSortMenu && (
                    <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-md border border-border bg-card shadow-lg py-1">
                      {[
                        { value: 'cost-asc' as SortOption, label: 'Cost (Low to High)' },
                        { value: 'cost-desc' as SortOption, label: 'Cost (High to Low)' },
                        { value: 'name-asc' as SortOption, label: 'Name (A to Z)' },
                        { value: 'name-desc' as SortOption, label: 'Name (Z to A)' },
                        { value: 'attack-desc' as SortOption, label: 'Attack (Highest)' },
                        { value: 'health-desc' as SortOption, label: 'Health (Highest)' },
                      ].map(opt => (
                        <button
                          type="button"
                          key={opt.value}
                          onClick={() => {
                            setSortBy(opt.value)
                            setShowSortMenu(false)
                          }}
                          className={`w-full text-left px-3 py-1.5 text-sm hover:bg-muted/50 ${
                            sortBy === opt.value ? 'text-primary font-medium' : 'text-foreground'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {showFilters && (
                <div className="p-4 border border-border rounded-lg bg-card space-y-3">
                  {/* Element Buttons */}
                  <div>
                    <div className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">
                      Element
                    </div>
                    <div className="flex gap-2">
                      {ELEMENTS.map(el => {
                        const config = ELEMENT_CONFIG[el]
                        const Icon = config.icon
                        const isActive = filters.element === el
                        return (
                          <button
                            type="button"
                            key={el}
                            onClick={() => setFilters({ ...filters, element: isActive ? '' : el })}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium transition-all ${
                              isActive
                                ? `${config.activeBg} text-white border-transparent`
                                : `${config.bg} ${config.color} ${config.border} hover:opacity-80`
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            {config.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Type Buttons */}
                  <div>
                    <div className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">
                      Type
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setFilters({ ...filters, type: filters.type === 'unit' ? '' : 'unit' })
                        }
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium transition-all ${
                          filters.type === 'unit'
                            ? 'bg-amber-500 text-white border-transparent'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:opacity-80'
                        }`}
                      >
                        <Swords className="w-3.5 h-3.5" />
                        Units
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setFilters({ ...filters, type: filters.type === 'spell' ? '' : 'spell' })
                        }
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium transition-all ${
                          filters.type === 'spell'
                            ? 'bg-violet-500 text-white border-transparent'
                            : 'bg-violet-500/10 text-violet-400 border-violet-500/30 hover:opacity-80'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Spells
                      </button>
                    </div>
                  </div>

                  {/* Cost Range Buttons */}
                  <div>
                    <div className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">
                      Mana Cost
                    </div>
                    <div className="flex gap-2">
                      {COST_RANGES.map(range => (
                        <button
                          type="button"
                          key={range.value}
                          onClick={() =>
                            setFilters({
                              ...filters,
                              costRange: filters.costRange === range.value ? '' : range.value,
                            })
                          }
                          className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-all ${
                            filters.costRange === range.value
                              ? 'bg-blue-500 text-white border-transparent'
                              : 'bg-blue-500/10 text-blue-400 border-blue-500/30 hover:opacity-80'
                          }`}
                        >
                          {range.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Dropdowns Row */}
                  <div className="flex gap-2 flex-wrap">
                    <select
                      className="px-3 py-2 rounded-md border border-border bg-background text-sm"
                      value={filters.zodiac}
                      onChange={e => setFilters({ ...filters, zodiac: e.target.value })}
                    >
                      <option value="">All Zodiac</option>
                      {ZODIAC_CLASSES.map(z => (
                        <option key={z} value={z}>
                          {z.charAt(0).toUpperCase() + z.slice(1)}
                        </option>
                      ))}
                    </select>

                    <select
                      className="px-3 py-2 rounded-md border border-border bg-background text-sm"
                      value={filters.rarity}
                      onChange={e => setFilters({ ...filters, rarity: e.target.value })}
                    >
                      <option value="">All Rarities</option>
                      {RARITIES.map(r => (
                        <option key={r} value={r}>
                          {r.charAt(0).toUpperCase() + r.slice(1)}
                        </option>
                      ))}
                    </select>

                    {activeFilterCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearFilters}
                        className="text-muted-foreground"
                      >
                        <X className="w-3 h-3 mr-1" />
                        Clear all
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Card Grid Header */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {filteredCards.length} cards{' '}
                  {filters.search || activeFilterCount > 0 ? 'found' : 'available'}
                </div>
              </div>

              {/* Card Grid */}
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                {filteredCards.map(card => {
                  const count = deckCardCounts.get(card.id) || 0
                  const isMaxed = count >= MAX_COPIES
                  const isDeckFull = deck.length >= MAX_DECK_SIZE

                  return (
                    <button
                      type="button"
                      key={card.id}
                      disabled={isMaxed || isDeckFull}
                      className={`relative text-left transition-all duration-200 rounded-lg ${
                        isMaxed || isDeckFull
                          ? 'opacity-40 saturate-50 cursor-not-allowed'
                          : 'cursor-pointer hover:scale-105 hover:z-10 hover:shadow-lg hover:shadow-primary/10 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none'
                      }`}
                      onClick={() => addCard(card)}
                    >
                      <TarotCard card={card} size="small" showReversedEffects={false} />
                      {count > 0 && (
                        <Badge
                          className={`absolute -top-1.5 -right-1.5 text-xs px-1.5 min-w-[24px] text-center font-bold shadow-md ${
                            isMaxed ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'
                          }`}
                        >
                          x{count}
                        </Badge>
                      )}
                    </button>
                  )
                })}
              </div>

              {filteredCards.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p>No cards match your filters</p>
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="mt-2">
                    Clear filters
                  </Button>
                </div>
              )}
            </div>

            {/* Deck Panel (right 1/3) */}
            <div className="space-y-4 lg:pl-6 pt-6 lg:pt-0">
              {/* Deck Name & Progress */}
              <div className="p-4 border border-border rounded-lg bg-card space-y-3">
                <Input
                  value={deckName}
                  onChange={e => setDeckName(e.target.value)}
                  className="font-bold text-lg"
                  placeholder="Deck name..."
                />

                {/* Progress Bar */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`text-lg font-bold ${
                        isComplete
                          ? 'text-emerald-400'
                          : deck.length < MIN_DECK_SIZE
                            ? 'text-amber-400'
                            : deck.length > MAX_DECK_SIZE
                              ? 'text-red-400'
                              : 'text-emerald-400'
                      }`}
                    >
                      {deck.length}/{MAX_DECK_SIZE} cards
                    </span>
                    {isComplete && (
                      <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full">
                        Deck Complete!
                      </span>
                    )}
                  </div>
                  <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ease-out ${progressColor}`}
                      style={{ width: `${progressPercent}%` }}
                    />
                    {/* Min deck marker at 30/40 = 75% */}
                    <div
                      className="absolute top-0 h-full w-px bg-foreground/30"
                      style={{ left: `${(MIN_DECK_SIZE / MAX_DECK_SIZE) * 100}%` }}
                      title={`Min ${MIN_DECK_SIZE} cards`}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-muted-foreground">0</span>
                    <span
                      className="text-[10px] text-muted-foreground"
                      style={{ marginLeft: `${(MIN_DECK_SIZE / MAX_DECK_SIZE) * 100 - 8}%` }}
                    >
                      {MIN_DECK_SIZE} min
                    </span>
                    <span className="text-[10px] text-muted-foreground">{MAX_DECK_SIZE}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={randomFill}
                    title="Auto-fill to 30"
                    disabled={deck.length >= MIN_DECK_SIZE}
                  >
                    <Shuffle className="w-4 h-4" />
                    <span className="hidden sm:inline ml-1">Fill</span>
                  </Button>
                  <Button size="sm" variant="outline" onClick={saveDeck} title="Save deck">
                    <Save className="w-4 h-4" />
                    <span className="hidden sm:inline ml-1">Save</span>
                  </Button>
                  <Button size="sm" variant="outline" onClick={exportDeck} title="Export deck">
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => importRef.current?.click()}
                    title="Import deck"
                  >
                    <Upload className="w-4 h-4" />
                  </Button>
                  <input
                    ref={importRef}
                    type="file"
                    accept=".json"
                    onChange={importDeck}
                    className="hidden"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={clearDeck}
                    title="Clear deck"
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Mana Curve & Stats */}
              <div className="p-4 border border-border rounded-lg bg-card space-y-3">
                <h3 className="font-semibold text-sm">Mana Curve</h3>

                {/* Mana Curve Chart */}
                <div className="flex items-end gap-1" style={{ height: '80px' }}>
                  {[0, 1, 2, 3, 4, 5, 6, 7].map(cost => {
                    const count = manaCurve[cost] || 0
                    const height = maxCurveHeight > 0 ? (count / maxCurveHeight) * 100 : 0
                    return (
                      <div key={cost} className="flex-1 flex flex-col items-center gap-0.5">
                        {count > 0 && (
                          <span className="text-[10px] font-medium text-muted-foreground">
                            {count}
                          </span>
                        )}
                        <div className="w-full flex items-end" style={{ height: '56px' }}>
                          <div
                            className={`w-full ${MANA_CURVE_COLORS[cost] || 'bg-primary/60'} rounded-t transition-all duration-300`}
                            style={{ height: `${height}%`, minHeight: count > 0 ? '4px' : '0' }}
                          />
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          {cost === 7 ? '7+' : cost}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <Separator />

                {/* Type Split */}
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-1.5">
                    <Swords className="w-3.5 h-3.5 text-amber-400" />
                    <span className="font-medium">{unitCount}</span>
                    <span className="text-muted-foreground">units</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                    <span className="font-medium">{spellCount}</span>
                    <span className="text-muted-foreground">spells</span>
                  </div>
                </div>

                <Separator />

                {/* Element Distribution */}
                <div>
                  <div className="text-xs text-muted-foreground mb-2 font-medium">Elements</div>
                  <div className="grid grid-cols-4 gap-2">
                    {ELEMENTS.map(el => {
                      const config = ELEMENT_CONFIG[el]
                      const Icon = config.icon
                      const count = elementDistribution[el] || 0
                      return (
                        <div
                          key={el}
                          className={`flex flex-col items-center gap-0.5 rounded-md py-1.5 border ${config.bg} ${config.border}`}
                        >
                          <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                          <span className={`text-sm font-bold ${config.color}`}>{count}</span>
                          <span className="text-[9px] text-muted-foreground uppercase tracking-wider">
                            {config.label}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Deck Card List */}
              <div className="p-4 border border-border rounded-lg bg-card">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm">Cards in Deck</h3>
                  <span className="text-xs text-muted-foreground">
                    {deckCardCounts.size} unique
                  </span>
                </div>
                <div className="space-y-0.5 max-h-[350px] overflow-y-auto">
                  {deck.length === 0 ? (
                    <div className="text-center py-6">
                      <p className="text-sm text-muted-foreground italic">
                        Click cards on the left to add them
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        or use <span className="font-mono bg-muted px-1 rounded">Fill</span> to
                        auto-fill
                      </p>
                    </div>
                  ) : (
                    // Group by card id and show counts
                    [...deckCardCounts.entries()]
                      .sort(([idA], [idB]) => {
                        const cardA = deck.find(c => c.id === idA)
                        const cardB = deck.find(c => c.id === idB)
                        if (!cardA || !cardB) return 0
                        return cardA.cost - cardB.cost || cardA.name.localeCompare(cardB.name)
                      })
                      .map(([cardId, count]) => {
                        const card = deck.find(c => c.id === cardId)
                        if (!card) return null
                        const elConfig = ELEMENT_CONFIG[card.element as keyof typeof ELEMENT_CONFIG]
                        return (
                          <button
                            type="button"
                            key={cardId}
                            className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted/50 group cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                            onClick={() => removeCard(cardId)}
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <span className="text-xs font-mono font-bold bg-blue-600/80 text-white w-5 h-5 rounded flex items-center justify-center shrink-0">
                                {card.cost}
                              </span>
                              <span className="text-sm truncate">{card.name}</span>
                              {card.type === 'spell' && (
                                <Sparkles className="w-3 h-3 text-violet-400 shrink-0" />
                              )}
                              {elConfig && (
                                <elConfig.icon
                                  className={`w-3 h-3 ${elConfig.color} shrink-0 opacity-50`}
                                />
                              )}
                            </span>
                            <span className="flex items-center gap-1 shrink-0">
                              {count > 1 && (
                                <Badge variant="secondary" className="text-xs px-1.5 font-bold">
                                  x{count}
                                </Badge>
                              )}
                              <span className="w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <X className="w-3 h-3 text-red-400" />
                              </span>
                            </span>
                          </button>
                        )
                      })
                  )}
                </div>
              </div>

              {/* Deck Validation Summary */}
              <div className="p-4 border border-border rounded-lg bg-card space-y-2">
                <h3 className="font-semibold text-sm">Validation</h3>
                <div className="space-y-1.5">
                  {deckValidationRules.map(rule => (
                    <div key={rule.label} className="flex items-center gap-2 text-sm">
                      {rule.passed ? (
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                      )}
                      <span className={rule.passed ? 'text-muted-foreground' : 'text-red-400'}>
                        {rule.label}
                      </span>
                    </div>
                  ))}
                </div>
                {!validation.valid && validation.errors.length > 0 && (
                  <>
                    <Separator />
                    <div className="text-xs text-red-400 space-y-0.5">
                      {validation.errors.map(err => (
                        <div key={err}>{err}</div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Saved Decks */}
              {savedDecks.length > 0 && (
                <div className="p-4 border border-border rounded-lg bg-card">
                  <h3 className="font-semibold text-sm mb-2">Saved Decks</h3>
                  <div className="space-y-1">
                    {savedDecks.map(d => (
                      <div
                        key={d.name}
                        className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted/50 transition-colors"
                      >
                        <button
                          type="button"
                          className="text-sm text-left truncate flex-1 hover:text-primary transition-colors"
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
