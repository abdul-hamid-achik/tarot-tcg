vi.unmock("@/lib/game_logger")
import { describe, it, expect } from 'vitest'
import { getAllCards, getCardById, createRandomDeck, isValidDeck } from '../card_loader'

describe('Card Loader - Basic Functionality', () => {
    it('should return all cards', () => {
        const cards = getAllCards()

        expect(cards).toBeDefined()
        expect(Array.isArray(cards)).toBe(true)
        expect(cards.length).toBeGreaterThan(0)
    })

    it('should return cards with required properties', () => {
        const cards = getAllCards()

        cards.forEach(card => {
            expect(card).toHaveProperty('id')
            expect(card).toHaveProperty('name')
            expect(card).toHaveProperty('cost')
            expect(card).toHaveProperty('type')
        })
    })

    it('should get card by ID', () => {
        const cards = getAllCards()
        if (cards.length > 0) {
            const firstCard = cards[0]
            const found = getCardById(firstCard.id)

            expect(found).toBeDefined()
            expect(found?.id).toBe(firstCard.id)
        }
    })

    it('should return undefined for non-existent card ID', () => {
        const card = getCardById('definitely-not-a-real-card-id-12345')

        expect(card).toBeUndefined()
    })

    it('should create a random deck', () => {
        const deck = createRandomDeck(30)

        expect(deck).toBeDefined()
        expect(Array.isArray(deck)).toBe(true)
        expect(deck.length).toBeGreaterThan(0)
    })

    it('should not have more than 3 copies of any card in deck', () => {
        const deck = createRandomDeck(30)
        const cardCounts = new Map<string, number>()

        deck.forEach(card => {
            const count = cardCounts.get(card.id) || 0
            cardCounts.set(card.id, count + 1)
        })

        cardCounts.forEach(count => {
            expect(count).toBeLessThanOrEqual(3)
        })
    })

    it('should validate a valid deck', () => {
        const deck = createRandomDeck(20)

        const result = isValidDeck(deck)

        expect(result).toHaveProperty('valid')
        expect(result).toHaveProperty('errors')
        expect(result.valid).toBe(true)
        expect(result.errors).toHaveLength(0)
    })

    it('should reject oversized deck', () => {
        const allCards = getAllCards()
        const oversizedDeck = Array(45).fill(allCards[0])

        const result = isValidDeck(oversizedDeck)

        expect(result.valid).toBe(false)
        expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should reject deck with too many card copies', () => {
        const allCards = getAllCards()
        const deck = Array(4).fill(allCards[0]) // 4 copies

        const result = isValidDeck(deck)

        expect(result.valid).toBe(false)
        expect(result.errors.some(e => e.includes('Too many copies'))).toBe(true)
    })
})