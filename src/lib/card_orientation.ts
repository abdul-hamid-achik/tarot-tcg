export type NamedAbility = {
  name: string
  description: string
}

export type OrientedAbilities = {
  upright: NamedAbility[]
  reversed: NamedAbility[]
}

function asNamedAbility(value: unknown): NamedAbility | null {
  if (!value || typeof value !== 'object') return null
  const record = value as { name?: unknown; description?: unknown }
  if (typeof record.name !== 'string' || typeof record.description !== 'string') return null
  return { name: record.name, description: record.description }
}

function asNamedAbilityList(value: unknown): NamedAbility[] {
  if (!Array.isArray(value)) return []
  return value.map(asNamedAbility).filter((item): item is NamedAbility => item !== null)
}

export function parseOrientedFields(raw: unknown): OrientedAbilities {
  if (!raw) return { upright: [], reversed: [] }

  if (Array.isArray(raw)) {
    return { upright: asNamedAbilityList(raw), reversed: [] }
  }

  if (typeof raw !== 'object') return { upright: [], reversed: [] }

  const record = raw as { upright?: unknown; reversed?: unknown }
  return {
    upright: asNamedAbilityList(record.upright),
    reversed: asNamedAbilityList(record.reversed),
  }
}

export function mergeOrientedSources(abilities: unknown, effects: unknown): OrientedAbilities {
  const fromAbilities = parseOrientedFields(abilities)
  const fromEffects = parseOrientedFields(effects)

  return {
    upright: fromAbilities.upright.length > 0 ? fromAbilities.upright : fromEffects.upright,
    reversed: fromAbilities.reversed.length > 0 ? fromAbilities.reversed : fromEffects.reversed,
  }
}

export function summarizeAbilities(abilities: NamedAbility[]): string | undefined {
  if (abilities.length === 0) return undefined
  return abilities.map(ability => `${ability.name}: ${ability.description}`).join(' ')
}

export function getCardPagePath(flattenedPathOrSlug: string): string {
  const slug = flattenedPathOrSlug.replace(/^\/?cards\//, '')
  return `/cards/${slug}`
}

export function getCardSlug(flattenedPath: string): string {
  return flattenedPath.replace(/^\/?cards\//, '')
}

export type ContentCardLike = {
  description?: string | null
  reversedDescription?: string | null
  abilities?: unknown
  effects?: unknown
  slug?: string | null
  _raw?: { flattenedPath?: string }
}

export function toOrientedCardFields(contentCard: ContentCardLike) {
  const oriented = mergeOrientedSources(contentCard.abilities, contentCard.effects)
  const flattenedPath = contentCard._raw?.flattenedPath || ''
  const slug = contentCard.slug || (flattenedPath ? getCardSlug(flattenedPath) : undefined)

  return {
    slug,
    uprightAbilities: oriented.upright,
    reversedAbilities: oriented.reversed,
    abilities: oriented.upright,
    effects: oriented.upright,
    description: contentCard.description || summarizeAbilities(oriented.upright),
    reversedDescription: contentCard.reversedDescription || summarizeAbilities(oriented.reversed),
  }
}

export function abilitiesForFace(card: {
  isReversed?: boolean
  uprightAbilities?: NamedAbility[]
  reversedAbilities?: NamedAbility[]
  abilities?: NamedAbility[]
}): NamedAbility[] {
  if (card.isReversed) {
    if (card.reversedAbilities !== undefined) return card.reversedAbilities
    return card.abilities ?? []
  }
  if (card.uprightAbilities && card.uprightAbilities.length > 0) return card.uprightAbilities
  return card.abilities ?? []
}
