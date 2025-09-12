import type { FieldDef } from 'contentlayer2/source-files'
import type { z } from 'zod'
import {
  CardMetadataSchema,
  CardTypeSchema,
  ElementSchema,
  RaritySchema,
  SpellTypeSchema,
  ZodiacClassSchema,
} from '../schemas/schema'

/**
 * Converts Zod enum schemas to Contentlayer field options
 */
export const zodEnumToContentlayerOptions = (zodEnum: z.ZodEnum<any>): readonly string[] => {
  // Get the enum values from Zod enum schema
  return Object.values(zodEnum.enum) as string[]
}

/**
 * Creates a validated Contentlayer field definition that uses Zod for validation
 */
export const createValidatedField = <T>(
  fieldDef: FieldDef,
  _zodSchema: z.ZodSchema<T>,
  _transform?: (value: any) => T,
): FieldDef => {
  return {
    ...fieldDef,
    // Add validation in computed fields or post-processing
  }
}

/**
 * Contentlayer field definitions that match our Zod schemas
 */
export const contentlayerFields = {
  zodiacClass: {
    type: 'enum',
    options: zodEnumToContentlayerOptions(ZodiacClassSchema),
    required: true,
  } as const,

  element: {
    type: 'enum',
    options: zodEnumToContentlayerOptions(ElementSchema),
    required: true,
  } as const,

  rarity: {
    type: 'enum',
    options: zodEnumToContentlayerOptions(RaritySchema),
    required: true,
  } as const,

  cardType: {
    type: 'enum',
    options: zodEnumToContentlayerOptions(CardTypeSchema),
    required: true,
  } as const,

  spellType: {
    type: 'enum',
    options: zodEnumToContentlayerOptions(SpellTypeSchema),
    required: false,
  } as const,
}

/**
 * Validates card data from Contentlayer against our Zod schema
 */
export const validateCardData = (card: any) => {
  // Map Contentlayer fields to match our Zod schema structure
  const cardData = {
    id: card.id,
    name: card.name,
    zodiacClass: card.zodiacClass,
    element: card.element,
    type: card.cardType, // Note: Contentlayer uses 'cardType', Zod uses 'type'
    cost: card.cost,
    attack: card.attack,
    health: card.health,
    rarity: card.rarity,
    tarotSymbol: card.tarotSymbol,
    keywords: card.keywords || [],
    abilities: card.abilities || [],
    spellType: card.spellType,
    effects: card.effects || [],
  }

  return CardMetadataSchema.safeParse(cardData)
}

/**
 * Creates computed fields for validation results
 */
export const validationComputedFields = {
  isValidCard: {
    type: 'boolean' as const,
    resolve: (card: any) => {
      const result = validateCardData(card)
      return result.success
    },
  },
  validationErrors: {
    type: 'json' as const,
    resolve: (card: any) => {
      const result = validateCardData(card)
      if (!result.success) {
        return result.error.issues
      }
      return null
    },
  },
  // Add a computed field that returns validated metadata
  validatedMetadata: {
    type: 'json' as const,
    resolve: (card: any) => {
      const result = validateCardData(card)
      if (result.success) {
        return result.data
      }
      return null
    },
  },
}

/**
 * Type guard using Zod validation
 */
export const isValidContentlayerCard = (card: any): boolean => {
  return validateCardData(card).success
}

/**
 * Get validated card metadata or throw error
 */
export const getValidatedCardMetadata = (card: any) => {
  const result = validateCardData(card)
  if (!result.success) {
    throw new Error(`Invalid card data: ${JSON.stringify(result.error.issues)}`)
  }
  return result.data
}
