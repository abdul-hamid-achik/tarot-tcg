import { defineCollection, defineConfig } from '@content-collections/core'
import { compileMDX } from '@content-collections/mdx'
import { z } from 'zod'
import {
  AbilitySchema,
  CardTypeSchema,
  ElementSchema,
  RaritySchema,
  SpellTypeSchema,
  ZodiacClassSchema,
} from './src/schemas/schema'

const namedAbilitySchema = AbilitySchema.pick({ name: true, description: true })

const orientedOrListSchema = z.union([
  z.array(namedAbilitySchema),
  z.object({
    upright: z.array(namedAbilitySchema).optional(),
    reversed: z.array(namedAbilitySchema).optional(),
  }),
])

const cards = defineCollection({
  name: 'cards',
  directory: 'content/cards',
  include: '**/*.mdx',
  schema: z.object({
    id: z.string(),
    name: z.string(),
    zodiacClass: ZodiacClassSchema,
    element: ElementSchema,
    cardType: CardTypeSchema,
    cost: z.number(),
    attack: z.number().optional(),
    health: z.number().optional(),
    rarity: RaritySchema,
    tarotNumber: z.string().optional(),
    tarotSymbol: z.string(),
    description: z.string().optional(),
    reversedDescription: z.string().optional(),
    orientation: z.string().optional(),
    suitSymbol: z.string().optional(),
    keywords: z.array(z.string()).optional(),
    abilities: orientedOrListSchema.optional(),
    // Older MDX used "sorcery"; game rules treat that as ritual.
    spellType: SpellTypeSchema.or(z.literal('sorcery')).optional(),
    effects: orientedOrListSchema.optional(),
    content: z.string(),
  }),
  transform: async (document, context) => {
    const mdx = await compileMDX(context, document)
    const spellType = document.spellType === 'sorcery' ? 'ritual' : document.spellType
    const { content: _markdown, ...fields } = document
    return {
      ...fields,
      spellType,
      mdx,
      slug: document._meta.path,
      url: `/cards/${document._meta.path}`,
      isUnit: document.cardType === 'unit',
      isSpell: document.cardType === 'spell',
      category: document._meta.directory.split('/')[0] || 'other',
    }
  },
  onSuccess: documents => {
    if (documents.length !== 78) {
      throw new Error(
        `Expected 78 tarot cards, generated ${documents.length}. Check content-collections schema.`,
      )
    }
  },
})

const zodiacClasses = defineCollection({
  name: 'zodiacClasses',
  directory: 'content/classes',
  include: '**/*.mdx',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    content: z.string(),
  }),
  transform: async (document, context) => {
    const mdx = await compileMDX(context, document)
    const { content: _markdown, ...fields } = document
    return {
      ...fields,
      mdx,
      slug: document._meta.path,
      url: `/classes/${document._meta.path}`,
    }
  },
})

const metaGuides = defineCollection({
  name: 'metaGuides',
  directory: 'content',
  include: '*-meta.mdx',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    content: z.string(),
  }),
  transform: async (document, context) => {
    const mdx = await compileMDX(context, document)
    const { content: _markdown, ...fields } = document
    return {
      ...fields,
      mdx,
      slug: document._meta.path.replace(/-meta$/, ''),
      url: `/meta/${document._meta.path.replace(/-meta$/, '')}`,
    }
  },
})

export default defineConfig({
  content: [cards, zodiacClasses, metaGuides],
})
