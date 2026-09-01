import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  abilitiesForFace,
  getCardPagePath,
  mergeOrientedSources,
  parseOrientedFields,
  summarizeAbilities,
  toOrientedCardFields,
} from '../card_orientation'

describe('parseOrientedFields', () => {
  it('reads upright and reversed lists from an object', () => {
    const parsed = parseOrientedFields({
      upright: [{ name: 'Leap of Faith', description: 'Draw a card.' }],
      reversed: [{ name: 'Reckless Abandon', description: 'Discard your hand.' }],
    })

    expect(parsed.upright).toEqual([{ name: 'Leap of Faith', description: 'Draw a card.' }])
    expect(parsed.reversed).toEqual([{ name: 'Reckless Abandon', description: 'Discard your hand.' }])
  })

  it('treats a flat array as upright-only', () => {
    const parsed = parseOrientedFields([
      { name: 'Final Judgement', description: 'Return fallen units.' },
    ])

    expect(parsed.upright[0]?.name).toBe('Final Judgement')
    expect(parsed.reversed).toEqual([])
  })

  it('returns empty lists for missing data', () => {
    expect(parseOrientedFields(undefined)).toEqual({ upright: [], reversed: [] })
    expect(parseOrientedFields(null)).toEqual({ upright: [], reversed: [] })
  })
})

describe('mergeOrientedSources', () => {
  it('prefers abilities when both abilities and effects exist', () => {
    const merged = mergeOrientedSources(
      {
        upright: [{ name: 'From abilities', description: 'A' }],
        reversed: [{ name: 'From abilities reversed', description: 'B' }],
      },
      {
        upright: [{ name: 'From effects', description: 'C' }],
        reversed: [{ name: 'From effects reversed', description: 'D' }],
      },
    )

    expect(merged.upright[0]?.name).toBe('From abilities')
    expect(merged.reversed[0]?.name).toBe('From abilities reversed')
  })

  it('falls back to oriented effects when abilities are empty', () => {
    const merged = mergeOrientedSources(undefined, {
      upright: [{ name: 'Spin the Wheel', description: 'Redraw.' }],
      reversed: [{ name: 'Wheel of Misfortune', description: 'Bad luck.' }],
    })

    expect(merged.upright[0]?.name).toBe('Spin the Wheel')
    expect(merged.reversed[0]?.name).toBe('Wheel of Misfortune')
  })

  it('uses a flat effects list as upright when nothing is oriented', () => {
    const merged = mergeOrientedSources(undefined, [
      { name: 'Joyful Gathering', description: 'Draw and heal.' },
    ])

    expect(merged.upright[0]?.name).toBe('Joyful Gathering')
    expect(merged.reversed).toEqual([])
  })
})

describe('summarizeAbilities', () => {
  it('joins named abilities into a single reversed blurb', () => {
    const text = summarizeAbilities([
      { name: 'Reckless Abandon', description: 'Discard your hand.' },
      { name: 'Aftermath', description: 'Deal 2 damage.' },
    ])

    expect(text).toBe('Reckless Abandon: Discard your hand. Aftermath: Deal 2 damage.')
  })

  it('returns undefined for an empty list', () => {
    expect(summarizeAbilities([])).toBeUndefined()
  })
})

describe('abilitiesForFace', () => {
  const upright = [{ name: 'Leap of Faith', description: 'Draw a card.' }]
  const reversed = [{ name: 'Reckless Abandon', description: 'Discard your hand.' }]

  it('uses reversed abilities when the card is reversed', () => {
    expect(
      abilitiesForFace({
        isReversed: true,
        uprightAbilities: upright,
        reversedAbilities: reversed,
        abilities: upright,
      }),
    ).toEqual(reversed)
  })

  it('does not fall back to upright when reversed text is an empty list', () => {
    expect(
      abilitiesForFace({
        isReversed: true,
        uprightAbilities: upright,
        reversedAbilities: [],
        abilities: upright,
      }),
    ).toEqual([])
  })

  it('falls back to abilities for fixtures that omit oriented fields', () => {
    expect(abilitiesForFace({ isReversed: true, abilities: upright })).toEqual(upright)
    expect(abilitiesForFace({ abilities: upright })).toEqual(upright)
  })
})

describe('getCardPagePath', () => {
  it('builds a catalog URL from a flattened content path', () => {
    expect(getCardPagePath('cards/major-arcana/00-the-fool')).toBe(
      '/cards/major-arcana/00-the-fool',
    )
  })

  it('accepts a slug that already omitted the cards prefix', () => {
    expect(getCardPagePath('major-arcana/00-the-fool')).toBe('/cards/major-arcana/00-the-fool')
  })
})

describe('toOrientedCardFields', () => {
  it('keeps The Fool faces separate and builds a catalog slug', () => {
    const fields = toOrientedCardFields({
      abilities: {
        upright: [{ name: 'Leap of Faith', description: 'Draw a card.' }],
        reversed: [{ name: 'Reckless Abandon', description: 'Discard your hand.' }],
      },
      _raw: { flattenedPath: 'cards/major-arcana/00-the-fool' },
    })

    expect(fields.slug).toBe('major-arcana/00-the-fool')
    // slug on the document wins over a flattened path
    expect(
      toOrientedCardFields({
        slug: 'major-arcana/00-the-fool',
        abilities: { upright: [], reversed: [] },
      }).slug,
    ).toBe('major-arcana/00-the-fool')
    expect(fields.uprightAbilities[0]?.name).toBe('Leap of Faith')
    expect(fields.reversedAbilities[0]?.name).toBe('Reckless Abandon')
    expect(fields.abilities.map(ability => ability.name)).toEqual(['Leap of Faith'])
    expect(fields.reversedDescription).toMatch(/Reckless Abandon/)
  })

  it('reads Wheel of Fortune reversed text from oriented effects', () => {
    const fields = toOrientedCardFields({
      effects: {
        upright: [{ name: 'Spin the Wheel', description: 'Redraw five.' }],
        reversed: [{ name: 'Wheel of Misfortune', description: 'Redraw three.' }],
      },
      _raw: { flattenedPath: 'cards/major-arcana/10-wheel-of-fortune' },
    })

    expect(fields.uprightAbilities[0]?.name).toBe('Spin the Wheel')
    expect(fields.reversedAbilities[0]?.name).toBe('Wheel of Misfortune')
  })
})

describe('card content files', () => {
  it('declares a reversed face for all 78 cards', () => {
    const root = path.resolve(__dirname, '../../../content/cards')

    const walk = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) return walk(full)
        return entry.name.endsWith('.mdx') ? [full] : []
      })

    const files = walk(root)
    const missing = files.filter(file => {
      const text = fs.readFileSync(file, 'utf8')
      return !/^\s+reversed:/m.test(text)
    })

    expect(files.length).toBe(78)
    expect(missing.map(file => path.relative(root, file))).toEqual([])
  })
})
