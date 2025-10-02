import type { Card as ContentlayerCard } from 'contentlayer/generated'
import { allCards } from 'contentlayer/generated'
import type { Card } from '@/schemas/schema'
import { CardSchema } from '@/schemas/schema'
import { GameLogger } from './game_logger'

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
        contentCard.spellType &&
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
    GameLogger.warn(`Card validation failed for ${contentCard.id}:`, result.error.issues)
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

  // Validate card pool
  if (allGameCards.length === 0) {
    throw new Error('No cards available in card pool. Check that content/cards/ has valid MDX files.')
  }

  // Cap deck size at maximum
  const targetSize = Math.min(size, 40)

  // Warn if card pool is too small
  if (allGameCards.length < targetSize) {
    GameLogger.warn(
      `[Deck Builder] Card pool has only ${allGameCards.length} unique cards but deck needs ${targetSize}. ` +
      `Deck will contain duplicates to reach target size.`
    )
  }

  const deck: Card[] = []
  const cardCounts = new Map<string, number>()

  // Shuffle cards
  const shuffled = [...allGameCards].sort(() => Math.random() - 0.5)

  for (const card of shuffled) {
    if (deck.length >= targetSize) break

    const currentCount = cardCounts.get(card.id) || 0
    if (currentCount < 3) {
      deck.push(card)
      cardCounts.set(card.id, currentCount + 1)
    }
  }

  // If we don't have enough unique cards, fill with duplicates
  while (deck.length < targetSize && allGameCards.length > 0) {
    const randomCard = shuffled[Math.floor(Math.random() * shuffled.length)]
    const currentCount = cardCounts.get(randomCard.id) || 0
    if (currentCount < 3) {
      deck.push(randomCard)
      cardCounts.set(randomCard.id, currentCount + 1)
    }
  }

  return deck
}

/**
 * Create a deck focused on a specific zodiac class following deckbuilding rules
 */
export function createZodiacDeck(zodiacClass: string, size: number = 30): Card[] {
  const zodiacCards = getCardsByZodiacClass(zodiacClass)

  // Validate zodiac class exists
  if (zodiacCards.length === 0) {
    throw new Error(
      `No cards found for zodiac class "${zodiacClass}". ` +
      `Check that cards with this zodiacClass exist in content/cards/`
    )
  }

  const allOtherCards = allCards
    .filter(card => card.zodiacClass !== zodiacClass)
    .map(contentlayerCardToGameCard)

  const deck: Card[] = []
  const cardCounts = new Map<string, number>()
  const maxSize = Math.min(size, 40)

  // Warn if insufficient cards for deck size
  const totalAvailableCards = zodiacCards.length + allOtherCards.length
  if (totalAvailableCards < maxSize) {
    GameLogger.warn(
      `[Deck Builder] Only ${totalAvailableCards} unique cards available for zodiac "${zodiacClass}" deck ` +
      `(needs ${maxSize}). Deck will contain duplicates.`
    )
  }

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

  // Fill remaining slots with duplicates if needed
  while (deck.length < maxSize && combinedPool.length > 0) {
    const randomCard = combinedPool[Math.floor(Math.random() * combinedPool.length)]
    const currentCount = cardCounts.get(randomCard.id) || 0
    if (currentCount < 3) {
      deck.push(randomCard)
      cardCounts.set(randomCard.id, currentCount + 1)
    }
  }

  return deck
}
