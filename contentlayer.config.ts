import { defineDocumentType, makeSource } from 'contentlayer2/source-files'
import type { ZodiacClass as ZodiacClassType, Element, Rarity } from './src/types/game'

export const Card = defineDocumentType(() => ({
  name: 'Card',
  filePathPattern: 'cards/**/*.mdx',
  contentType: 'mdx',
  fields: {
    id: {
      type: 'string',
      required: true,
    },
    name: {
      type: 'string',
      required: true,
    },
    zodiacClass: {
      type: 'enum',
      options: ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'] as const,
      required: true,
    },
    element: {
      type: 'enum',
      options: ['fire', 'earth', 'air', 'water'] as const,
      required: true,
    },
    cardType: {
      type: 'enum',
      options: ['unit', 'spell'] as const,
      required: true,
    },
    cost: {
      type: 'number',
      required: true,
    },
    attack: {
      type: 'number',
      required: false,
    },
    health: {
      type: 'number', 
      required: false,
    },
    rarity: {
      type: 'enum',
      options: ['common', 'uncommon', 'rare', 'legendary'] as const,
      required: true,
    },
    tarotSymbol: {
      type: 'string',
      required: true,
    },
    keywords: {
      type: 'list',
      of: { type: 'string' },
      required: false,
    },
    abilities: {
      type: 'json',
      required: false,
    },
    spellType: {
      type: 'enum',
      options: ['instant', 'ritual', 'enchantment'] as const,
      required: false,
    },
    effects: {
      type: 'json',
      required: false,
    },
  },
  computedFields: {
    url: {
      type: 'string',
      resolve: (card) => `/cards/${card._raw.flattenedPath}`,
    },
    zodiacPath: {
      type: 'string', 
      resolve: (card) => card.zodiacClass,
    },
    isUnit: {
      type: 'boolean',
      resolve: (card) => card.cardType === 'unit',
    },
    isSpell: {
      type: 'boolean',
      resolve: (card) => card.cardType === 'spell',
    },
  },
}))

export const ZodiacClass = defineDocumentType(() => ({
  name: 'ZodiacClass',
  filePathPattern: 'classes/**/*.mdx',
  contentType: 'mdx',
  fields: {
    title: {
      type: 'string',
      required: true,
    },
    description: {
      type: 'string',
      required: true,
    },
  },
  computedFields: {
    url: {
      type: 'string',
      resolve: (doc) => `/classes/${doc._raw.flattenedPath}`,
    },
  },
}))

export default makeSource({
  contentDirPath: './content',
  documentTypes: [Card, ZodiacClass],
  mdx: {
    remarkPlugins: [],
    rehypePlugins: [],
  },
  disableImportAliasWarning: true,
})