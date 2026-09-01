import { allCards, allMetaGuides, allZodiacClasses } from 'content-collections'
import { describe, expect, it } from 'vitest'
import { mergeOrientedSources } from '../card_orientation'

describe('content collections', () => {
  it('indexes all 78 tarot cards with a slug and compiled MDX', () => {
    expect(allCards).toHaveLength(78)
    expect(allCards.every(card => Boolean(card.slug) && Boolean(card.mdx))).toBe(true)
    expect(allCards.some(card => card.name === 'The Fool' && card.slug === 'major-arcana/00-the-fool')).toBe(
      true,
    )
  })

  it('gives every card a reversed face', () => {
    const missing = allCards.filter(card => {
      const oriented = mergeOrientedSources(card.abilities, card.effects)
      return oriented.reversed.length === 0 && !card.reversedDescription
    })

    expect(missing.map(card => card.id)).toEqual([])
  })

  it('indexes zodiac class guides', () => {
    expect(allZodiacClasses.length).toBeGreaterThan(0)
    expect(allZodiacClasses[0]?.url).toMatch(/^\/classes\//)
  })

  it('indexes the meta guide', () => {
    expect(allMetaGuides.length).toBeGreaterThan(0)
    expect(allMetaGuides[0]?.url).toMatch(/^\/meta\//)
  })
})
