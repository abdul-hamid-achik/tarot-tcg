import type { Card as ContentCard } from 'content-collections'
import { allCards } from 'content-collections'
import type { Card } from '@/schemas/schema'
import { CardSchema } from '@/schemas/schema'
import { toOrientedCardFields } from './card_orientation'
import { GameLogger } from './game_logger'

function suitFromSlug(slug?: string): Card['suit'] {
  if (!slug) return undefined
  const suits = ['wands', 'cups', 'swords', 'pentacles'] as const
  return suits.find(suit => slug.includes(`/${suit}/`) || slug.startsWith(`${suit}/`))
}

function orientedFieldsFor(contentCard: ContentCard) {
  return toOrientedCardFields({
    description: contentCard.description,
    reversedDescription: contentCard.reversedDescription,
    abilities: contentCard.abilities,
    effects: contentCard.effects,
    slug: contentCard.slug,
  })
}

function contentCardToRawCard(contentCard: ContentCard) {
  const oriented = orientedFieldsFor(contentCard)

  return {
    id: contentCard.id,
    name: contentCard.name,
    cost: contentCard.cost,
    attack: contentCard.attack || 0,
    health: contentCard.health || 0,
    type: contentCard.cardType,
    description: oriented.description,
    reversedDescription: oriented.reversedDescription,
    tarotSymbol: contentCard.tarotSymbol,
    tarotNumber: contentCard.tarotNumber,
    slug: oriented.slug,
    category: contentCard.category?.startsWith('major') ? 'major' : 'minor',
    suit: suitFromSlug(oriented.slug || contentCard.slug),
    zodiacClass: contentCard.zodiacClass,
    element: contentCard.element,
    rarity: contentCard.rarity,
    keywords: Array.isArray(contentCard.keywords) ? contentCard.keywords : [],
    abilities: oriented.abilities,
    uprightAbilities: oriented.uprightAbilities,
    reversedAbilities: oriented.reversedAbilities,
    spellType:
      contentCard.cardType === 'spell' &&
      contentCard.spellType &&
      ['instant', 'ritual', 'enchantment'].includes(contentCard.spellType)
        ? contentCard.spellType
        : undefined,
    effects: oriented.effects,
    statusEffects: [],
    counters: {},
  }
}

/**
 * Convert a content collection card to a game Card
 */
export function contentCardToGameCard(contentCard: ContentCard): Card {
  const rawCard = contentCardToRawCard(contentCard)
  const result = CardSchema.safeParse(rawCard)
  if (result.success) {
    return result.data
  }

  GameLogger.warn(`Card validation failed for ${contentCard.id}:`, result.error.issues)
  return CardSchema.parse({
    ...rawCard,
    abilities: [],
    uprightAbilities: [],
    reversedAbilities: [],
    keywords: [],
    effects: [],
    spellType: undefined,
  })
}

export type ContentValidationIssue = {
  cardName: string
  cardId: string
  errors: Array<{ path: string; message: string }>
}

export type ContentValidationSummary = {
  total: number
  expectedTotal: number
  valid: number
  invalid: number
  invalidDetails: ContentValidationIssue[]
  missingReversed: Array<{ id: string; name: string }>
  duplicateIds: string[]
  complete: boolean
}

export function validateAllContent(): ContentValidationSummary {
  const invalidDetails: ContentValidationIssue[] = []
  const missingReversed: Array<{ id: string; name: string }> = []
  const seenIds = new Set<string>()
  const duplicateIds: string[] = []

  for (const contentCard of allCards) {
    if (seenIds.has(contentCard.id)) {
      duplicateIds.push(contentCard.id)
    }
    seenIds.add(contentCard.id)

    const oriented = orientedFieldsFor(contentCard)
    if (oriented.reversedAbilities.length === 0 && !oriented.reversedDescription) {
      missingReversed.push({ id: contentCard.id, name: contentCard.name })
    }

    const result = CardSchema.safeParse(contentCardToRawCard(contentCard))
    if (!result.success) {
      invalidDetails.push({
        cardName: contentCard.name,
        cardId: contentCard.id,
        errors: result.error.issues.map(issue => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      })
    }
  }

  const invalid = invalidDetails.length
  const total = allCards.length

  return {
    total,
    expectedTotal: 78,
    valid: total - invalid,
    invalid,
    invalidDetails,
    missingReversed,
    duplicateIds,
    complete:
      invalid === 0 && total === 78 && missingReversed.length === 0 && duplicateIds.length === 0,
  }
}

/**
 * Get all cards as game Cards
 */
export function getAllCards(): Card[] {
  return allCards.map(contentCardToGameCard)
}

/**
 * Get cards by zodiac class
 */
export function getCardsByZodiacClass(zodiacClass: string): Card[] {
  return allCards.filter(card => card.zodiacClass === zodiacClass).map(contentCardToGameCard)
}

/**
 * Get a specific card by ID
 */
export function getCardById(id: string): Card | undefined {
  const contentCard = allCards.find(card => card.id === id)
  return contentCard ? contentCardToGameCard(contentCard) : undefined
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

  return filtered.map(contentCardToGameCard)
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
    throw new Error(
      'No cards available in card pool. Check that content/cards/ has valid MDX files.',
    )
  }

  // Cap deck size at maximum
  const targetSize = Math.min(size, 40)

  // Warn if card pool is too small
  if (allGameCards.length < targetSize) {
    GameLogger.warn(
      `[Deck Builder] Card pool has only ${allGameCards.length} unique cards but deck needs ${targetSize}. ` +
        `Deck will contain duplicates to reach target size.`,
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
        `Check that cards with this zodiacClass exist in content/cards/`,
    )
  }

  const allOtherCards = allCards
    .filter(card => card.zodiacClass !== zodiacClass)
    .map(contentCardToGameCard)

  const deck: Card[] = []
  const cardCounts = new Map<string, number>()
  const maxSize = Math.min(size, 40)

  // Warn if insufficient cards for deck size
  const totalAvailableCards = zodiacCards.length + allOtherCards.length
  if (totalAvailableCards < maxSize) {
    GameLogger.warn(
      `[Deck Builder] Only ${totalAvailableCards} unique cards available for zodiac "${zodiacClass}" deck ` +
        `(needs ${maxSize}). Deck will contain duplicates.`,
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
