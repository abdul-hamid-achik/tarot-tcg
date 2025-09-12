import type { Card as ContentlayerCard } from 'contentlayer/generated'
import { allCards } from 'contentlayer/generated'
import type { Card } from '@/schemas/schema'
import { CardSchema } from '@/schemas/schema'

/**
 * Convert a Contentlayer card to a game Card
 */
export function contentlayerCardToGameCard(contentCard: ContentlayerCard): Card {
  // Clean and validate the data before creating the card
  const rawCard = {
    id: contentCard.id,
    name: contentCard.name,
    cost: contentCard.cost,
    attack: contentCard.attack || 0,
    health: contentCard.health || 0,
    type: contentCard.cardType,
    description: contentCard.body.raw,
    tarotSymbol: contentCard.tarotSymbol,

    // Zodiac system properties
    zodiacClass: contentCard.zodiacClass,
    element: contentCard.element,
    rarity: contentCard.rarity,
    keywords: Array.isArray(contentCard.keywords) ? contentCard.keywords : [],
    abilities: Array.isArray(contentCard.abilities) ? contentCard.abilities : [],

    // Spell-specific properties - only set if valid
    spellType:
      contentCard.cardType === 'spell' &&
      ['instant', 'ritual', 'enchantment'].includes(contentCard.spellType)
        ? contentCard.spellType
        : undefined,
    effects: Array.isArray(contentCard.effects) ? contentCard.effects : [],

    // Runtime state (initialized empty)
    statusEffects: [],
    counters: {},
  }

  // Use Zod to validate and clean the data
  const result = CardSchema.safeParse(rawCard)
  if (result.success) {
    return result.data
  } else {
    console.warn(`Card validation failed for ${contentCard.id}:`, result.error.errors)
    // Return a fallback valid card
    return CardSchema.parse({
      ...rawCard,
      abilities: [],
      keywords: [],
      effects: [],
      spellType: undefined,
    })
  }
}

/**
 * Get all cards as game Cards
 */
export function getAllCards(): Card[] {
  return allCards.map(contentlayerCardToGameCard)
}

/**
 * Get cards by zodiac class
 */
export function getCardsByZodiacClass(zodiacClass: string): Card[] {
  return allCards.filter(card => card.zodiacClass === zodiacClass).map(contentlayerCardToGameCard)
}

/**
 * Get a specific card by ID
 */
export function getCardById(id: string): Card | undefined {
  const contentCard = allCards.find(card => card.id === id)
  return contentCard ? contentlayerCardToGameCard(contentCard) : undefined
}

/**
 * Get cards filtered by multiple criteria
 */
export function getFilteredCards(filters: {
  zodiacClass?: string
  element?: string
  rarity?: string
  type?: 'unit' | 'spell'
  maxCost?: number
  minCost?: number
}): Card[] {
  let filtered = allCards

  if (filters.zodiacClass) {
    filtered = filtered.filter(card => card.zodiacClass === filters.zodiacClass)
  }
  if (filters.element) {
    filtered = filtered.filter(card => card.element === filters.element)
  }
  if (filters.rarity) {
    filtered = filtered.filter(card => card.rarity === filters.rarity)
  }
  if (filters.type) {
    filtered = filtered.filter(card => card.cardType === filters.type)
  }
  if (filters.maxCost !== undefined) {
    filtered = filtered.filter(card => card.cost <= filters.maxCost!)
  }
  if (filters.minCost !== undefined) {
    filtered = filtered.filter(card => card.cost >= filters.minCost!)
  }

  return filtered.map(contentlayerCardToGameCard)
}

/**
 * Validate deck follows deckbuilding rules
 */
export function isValidDeck(deck: Card[]): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Check deck size (max 40 cards)
  if (deck.length > 40) {
    errors.push(`Deck has ${deck.length} cards, maximum is 40`)
  }

  // Check card count limits (max 3 of the same card)
  const cardCounts = new Map<string, number>()
  deck.forEach(card => {
    const count = cardCounts.get(card.id) || 0
    cardCounts.set(card.id, count + 1)
  })

  cardCounts.forEach((count, cardId) => {
    if (count > 3) {
      const card = deck.find(c => c.id === cardId)
      errors.push(`Too many copies of "${card?.name || cardId}": ${count}/3`)
    }
  })

  return { valid: errors.length === 0, errors }
}

/**
 * Create a random deck of cards following deckbuilding rules
 */
export function createRandomDeck(size: number = 30): Card[] {
  const allGameCards = getAllCards()
  const deck: Card[] = []
  const cardCounts = new Map<string, number>()

  // Shuffle cards
  const shuffled = [...allGameCards].sort(() => Math.random() - 0.5)

  for (const card of shuffled) {
    if (deck.length >= Math.min(size, 40)) break

    const currentCount = cardCounts.get(card.id) || 0
    if (currentCount < 3) {
      deck.push(card)
      cardCounts.set(card.id, currentCount + 1)
    }
  }

  return deck
}

/**
 * Create a deck focused on a specific zodiac class following deckbuilding rules
 */
export function createZodiacDeck(zodiacClass: string, size: number = 30): Card[] {
  const zodiacCards = getCardsByZodiacClass(zodiacClass)
  const allOtherCards = allCards
    .filter(card => card.zodiacClass !== zodiacClass)
    .map(contentlayerCardToGameCard)

  const deck: Card[] = []
  const cardCounts = new Map<string, number>()
  const maxSize = Math.min(size, 40)

  // Shuffle both pools
  const shuffledZodiac = [...zodiacCards].sort(() => Math.random() - 0.5)
  const shuffledOthers = [...allOtherCards].sort(() => Math.random() - 0.5)

  // Combine pools, prioritizing zodiac cards (70% zodiac, 30% others)
  const zodiacWeight = Math.floor(maxSize * 0.7)
  const combinedPool = [
    ...shuffledZodiac.slice(0, zodiacWeight),
    ...shuffledOthers.slice(0, maxSize - zodiacWeight),
  ].sort(() => Math.random() - 0.5)

  // Build deck respecting card limits
  for (const card of combinedPool) {
    if (deck.length >= maxSize) break

    const currentCount = cardCounts.get(card.id) || 0
    if (currentCount < 3) {
      deck.push(card)
      cardCounts.set(card.id, currentCount + 1)
    }
  }

  return deck
}
