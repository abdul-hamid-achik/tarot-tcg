/**
 * Helper functions for working with Contentlayer cards using our Zod schemas
 */

// We'll use 'any' for now since contentlayer/generated doesn't exist yet
// In production, this would be: import type { Card as ContentlayerCard } from 'contentlayer/generated'
type ContentlayerCard = any

import type { Card, CardMetadata } from '../schemas/schema'
import { getValidatedCardMetadata } from './contentlayer-schema-bridge'

/**
 * Converts a Contentlayer card to our game Card type
 * This ensures type safety and validation when loading cards from content
 */
export const contentlayerCardToGameCard = (contentCard: ContentlayerCard): Card => {
    // Get validated metadata using Zod schema
    const metadata = getValidatedCardMetadata(contentCard)

    // Convert to full Card type with default values
    return {
        id: metadata.id,
        name: metadata.name,
        cost: metadata.cost,
        attack: metadata.attack || 0,
        health: metadata.health || 0,
        currentHealth: metadata.health || 0,
        type: metadata.type,
        description: contentCard.description,
        reversedDescription: contentCard.reversedDescription,
        tarotSymbol: metadata.tarotSymbol,
        zodiacClass: metadata.zodiacClass,
        element: metadata.element,
        rarity: metadata.rarity,
        keywords: metadata.keywords || [],
        abilities: metadata.abilities || [],
        spellType: metadata.spellType,
        effects: metadata.effects || [],
        isReversed: false,
        statusEffects: [],
        counters: {},
    }
}

/**
 * Type-safe card filtering functions using Contentlayer data
 */
export const filterCardsByZodiac = (
    cards: ContentlayerCard[],
    zodiacClass: CardMetadata['zodiacClass'],
): ContentlayerCard[] => {
    return cards.filter(card => card.zodiacClass === zodiacClass)
}

export const filterCardsByElement = (
    cards: ContentlayerCard[],
    element: CardMetadata['element'],
): ContentlayerCard[] => {
    return cards.filter(card => card.element === element)
}

export const filterCardsByRarity = (
    cards: ContentlayerCard[],
    rarity: CardMetadata['rarity'],
): ContentlayerCard[] => {
    return cards.filter(card => card.rarity === rarity)
}

export const filterCardsByType = (
    cards: ContentlayerCard[],
    type: CardMetadata['type'],
): ContentlayerCard[] => {
    return cards.filter(card => card.cardType === type)
}

/**
 * Get all valid cards (filters out any cards with validation errors)
 */
export const getValidCards = (cards: ContentlayerCard[]): ContentlayerCard[] => {
    return cards.filter(card => card.isValidCard)
}

/**
 * Get cards with validation errors for debugging
 */
export const getInvalidCards = (
    cards: ContentlayerCard[],
): Array<{
    card: ContentlayerCard
    errors: any
}> => {
    return cards
        .filter(card => !card.isValidCard)
        .map(card => ({
            card,
            errors: card.validationErrors,
        }))
}

/**
 * Load and validate all cards from Contentlayer
 */
export const loadAllGameCards = async (): Promise<Card[]> => {
    // This would be imported from contentlayer/generated in actual usage
    const { allCards } = await import('contentlayer/generated')

    // Filter out invalid cards and convert to game cards
    const validCards = getValidCards(allCards)
    return validCards.map(contentlayerCardToGameCard)
}

/**
 * Type guards for runtime checking
 */
export const isUnitCard = (card: ContentlayerCard): boolean => {
    return card.cardType === 'unit'
}

export const isSpellCard = (card: ContentlayerCard): boolean => {
    return card.cardType === 'spell'
}

export const hasStat = (card: ContentlayerCard, stat: 'attack' | 'health'): boolean => {
    return card[stat] !== undefined && card[stat] !== null
}

/**
 * Get card validation summary for debugging
 */
export const getCardValidationSummary = (cards: ContentlayerCard[]) => {
    const validCards = getValidCards(cards)
    const invalidCards = getInvalidCards(cards)

    return {
        total: cards.length,
        valid: validCards.length,
        invalid: invalidCards.length,
        invalidDetails: invalidCards.map(({ card, errors }) => ({
            cardName: card.name,
            cardId: card.id,
            errors,
        })),
    }
}
