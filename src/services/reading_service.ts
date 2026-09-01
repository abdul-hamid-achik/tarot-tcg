import { produce } from 'immer'
import { abilitiesForFace } from '@/lib/card_orientation'
import { GameLogger } from '@/lib/game_logger'
import type { Card, CardEffect, EffectContext, GameState, Player, PlayerId } from '@/schemas/schema'
import { cardEffectSystem } from './card_effect_system'

function canAfford(player: Player, card: Card): boolean {
  const available = card.type === 'spell' ? player.mana + player.spellMana : player.mana
  return card.cost <= available
}

function takePayment(
  player: Player,
  card: Card,
): { manaUsed: number; spellManaUsed: number } | null {
  if (!canAfford(player, card)) return null
  if (card.type !== 'spell') {
    return { manaUsed: card.cost, spellManaUsed: 0 }
  }
  const manaUsed = Math.min(player.mana, card.cost)
  return { manaUsed, spellManaUsed: card.cost - manaUsed }
}

export type ReadingPosition = 'past' | 'present' | 'future'

export interface ReadingInput {
  pastId?: string
  presentId?: string
  futureId: string
  clarifierId?: string
}

export interface ReadingReport {
  verdict: number
  thread: Card['element']
  contested: boolean
  target: 'nexus' | 'unit'
  targetId?: string
  inverted: boolean
  meaning: { name: string; description: string }[]
  log: string
}

const PIP_WORDS: Record<string, number> = {
  ace: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  page: 11,
  knight: 12,
  queen: 13,
  king: 14,
}

export function isMajor(card: Card): boolean {
  return card.category === 'major'
}

export function pipValue(card: Card): number {
  if (isMajor(card)) return 0
  const first = card.name.trim().split(/\s+/)[0]?.toLowerCase() ?? ''
  if (first in PIP_WORDS) return PIP_WORDS[first]
  const numeric = Number.parseInt(card.tarotNumber || '', 10)
  if (Number.isFinite(numeric) && numeric > 0 && numeric <= 14) return numeric
  return Math.max(0, card.cost)
}

export function findCard(state: GameState, playerId: PlayerId, cardId: string): Card | null {
  const player = state[playerId]
  const inHand = player.hand.find(card => card.id === cardId)
  if (inHand) return inHand
  const units =
    playerId === 'player1' ? state.battlefield.playerUnits : state.battlefield.enemyUnits
  return units.find(unit => unit?.id === cardId) ?? null
}

function opponentId(playerId: PlayerId): PlayerId {
  return playerId === 'player1' ? 'player2' : 'player1'
}

function opponentUnits(state: GameState, reader: PlayerId): Card[] {
  const units = reader === 'player1' ? state.battlefield.enemyUnits : state.battlefield.playerUnits
  return units.filter(
    (unit): unit is Card => unit !== null && (unit.currentHealth ?? unit.health) > 0,
  )
}

export function threadElement(spread: {
  past?: Card | null
  present?: Card | null
  future: Card
}): Card['element'] {
  return spread.past?.element ?? spread.present?.element ?? spread.future.element
}

export function readingVerdict(spread: {
  past?: Card | null
  present?: Card | null
  future: Card
}): number {
  return [spread.past, spread.present, spread.future]
    .filter((card): card is Card => Boolean(card))
    .reduce((sum, card) => sum + pipValue(card), 0)
}

function matchingElementUnit(units: Card[], element: Card['element']): Card | null {
  const matches = units.filter(unit => unit.element === element)
  if (matches.length === 0) return null
  return (
    matches.sort((a, b) => (b.currentHealth ?? b.health) - (a.currentHealth ?? a.health))[0] ?? null
  )
}

function removeFromHand(state: GameState, playerId: PlayerId, cardId: string) {
  state[playerId].hand = state[playerId].hand.filter(card => card.id !== cardId)
}

function payForCard(state: GameState, playerId: PlayerId, card: Card) {
  const payment = takePayment(state[playerId], card)
  if (!payment) {
    throw new Error(`Cannot pay ${card.name} for the reading`)
  }
  state[playerId].mana -= payment.manaUsed
  state[playerId].spellMana -= payment.spellManaUsed
}

function exhaustOrPlace(state: GameState, playerId: PlayerId, card: Card) {
  const units =
    playerId === 'player1' ? state.battlefield.playerUnits : state.battlefield.enemyUnits
  const index = units.findIndex(unit => unit?.id === card.id)
  if (index >= 0 && units[index]) {
    units[index] = { ...units[index], exhaustedForReading: true }
    return
  }
  if (card.type === 'unit') {
    const empty = units.indexOf(null)
    if (empty >= 0) {
      units[empty] = {
        ...card,
        owner: playerId,
        currentHealth: card.currentHealth ?? card.health,
        exhaustedForReading: true,
        hasSummoningSickness: false,
      }
    }
  }
}

function dealToNexus(state: GameState, target: PlayerId, amount: number) {
  state[target].health -= amount
}

function dealToUnit(state: GameState, reader: PlayerId, unitId: string, amount: number) {
  const units = reader === 'player1' ? state.battlefield.enemyUnits : state.battlefield.playerUnits
  const index = units.findIndex(unit => unit?.id === unitId)
  const unit = index >= 0 ? units[index] : null
  if (!unit) return
  const nextHealth = (unit.currentHealth ?? unit.health) - amount
  if (nextHealth <= 0) {
    units[index] = null
  } else {
    units[index] = { ...unit, currentHealth: nextHealth }
  }
}

export function resolveReading(
  state: GameState,
  input: ReadingInput,
): { state: GameState; report: ReadingReport } {
  const reader = state.activePlayer
  if (state[reader].hasReadThisTurn) {
    throw new Error('Already completed a reading this turn')
  }
  if (state.phase !== 'action') {
    throw new Error('Readings can only be committed during the action phase')
  }

  const future = findCard(state, reader, input.futureId)
  if (!future) throw new Error('Future is required')
  const past = input.pastId ? findCard(state, reader, input.pastId) : null
  const present = input.presentId ? findCard(state, reader, input.presentId) : null
  if (input.pastId && !past) throw new Error('Past card not found')
  if (input.presentId && !present) throw new Error('Present card not found')

  const ids = [input.pastId, input.presentId, input.futureId].filter(Boolean)
  if (new Set(ids).size !== ids.length) {
    throw new Error('A card cannot occupy two positions')
  }

  let meaningCard = future
  let inverted = false
  const foe = opponentId(reader)
  let clarifier: Card | null = null
  if (input.clarifierId) {
    clarifier = findCard(state, foe, input.clarifierId)
    if (!clarifier) throw new Error('Clarifier not found')
  }

  const next = produce(state, draft => {
    const spreadCards = [past, present, future].filter((card): card is Card => Boolean(card))
    for (const card of spreadCards) {
      const fromHand = draft[reader].hand.some(held => held.id === card.id)
      if (fromHand) {
        payForCard(draft, reader, card)
        removeFromHand(draft, reader, card.id)
      }
      exhaustOrPlace(draft, reader, card)
    }

    let workingFuture = future
    if (clarifier) {
      const thread = threadElement({ past, present, future: workingFuture })
      const fromHand = draft[foe].hand.some(held => held.id === clarifier.id)
      if (fromHand) {
        payForCard(draft, foe, clarifier)
        removeFromHand(draft, foe, clarifier.id)
      }
      if (clarifier.isReversed && clarifier.element === thread) {
        inverted = true
        workingFuture = { ...workingFuture, isReversed: !workingFuture.isReversed }
      } else if (isMajor(clarifier) && !isMajor(workingFuture)) {
        workingFuture = clarifier
        meaningCard = clarifier
      }
    }

    const spread = { past, present, future: workingFuture }
    const thread = threadElement(spread)
    const verdict = readingVerdict({ past, present, future })
    const cover = matchingElementUnit(opponentUnits(draft, reader), thread)
    const contested = cover !== null
    const trump = isMajor(workingFuture)
    const hitsLife = !contested || trump

    if (verdict > 0) {
      if (hitsLife) {
        dealToNexus(draft, foe, verdict)
      } else if (cover) {
        dealToUnit(draft, reader, cover.id, verdict)
      }
    }

    draft[reader].hasReadThisTurn = true
    meaningCard = workingFuture
  })

  const spread = { past, present, future: meaningCard }
  const thread = threadElement(spread)
  const cover = matchingElementUnit(opponentUnits(state, reader), thread)
  const contested = cover !== null
  const trump = isMajor(meaningCard)
  const meaning = abilitiesForFace(meaningCard).map(ability => ({
    name: ability.name || meaningCard.name,
    description: ability.description || '',
  }))

  const report: ReadingReport = {
    verdict: readingVerdict({ past, present, future }),
    thread,
    contested,
    target: !contested || trump ? 'nexus' : 'unit',
    targetId: !contested || trump ? undefined : cover?.id,
    inverted,
    meaning,
    log: `${reader} reads ${meaningCard.name}${inverted ? ' (inverted)' : ''}`,
  }

  GameLogger.action(report.log, report)
  return { state: next, report }
}

async function fireMeaning(state: GameState, source: Card): Promise<GameState> {
  const faces = abilitiesForFace(source)
  if (faces.length === 0) return state
  let current = state
  for (const ability of faces) {
    if (!ability.description) continue
    const cardEffect: CardEffect = {
      id: `reading_${source.id}_${ability.name || 'meaning'}`,
      name: ability.name || source.name,
      description: ability.description,
      type: 'instant',
      execute: () => ({ success: false }),
    }
    const effectContext: EffectContext = {
      gameState: current,
      source: { ...source, owner: state.activePlayer },
    }
    const result = await cardEffectSystem.executeEffect(cardEffect, effectContext)
    if (result.success && result.newGameState) {
      current = result.newGameState
    }
  }
  return current
}

export async function performReading(state: GameState, input: ReadingInput): Promise<GameState> {
  const { state: resolved, report } = resolveReading(state, input)
  const future = findCard(state, state.activePlayer, input.futureId)
  if (!future) return resolved
  const faceCard = {
    ...future,
    isReversed: report.inverted ? !future.isReversed : future.isReversed,
  }
  return fireMeaning(resolved, faceCard)
}

export function pickAiClarifier(state: GameState, thread: Card['element']): string | undefined {
  if (state.activePlayer !== 'player1') return undefined
  const foe = state.player2
  const candidate = foe.hand.find(card => card.element === thread && canAfford(foe, card))
  return candidate?.id
}

export function pickAiReading(state: GameState): ReadingInput | null {
  const reader = state.activePlayer
  if (state[reader].hasReadThisTurn) return null
  const player = state[reader]
  const tableau = (
    reader === 'player1' ? state.battlefield.playerUnits : state.battlefield.enemyUnits
  ).filter((unit): unit is Card => unit !== null && !unit.exhaustedForReading)
  const payableHand = player.hand.filter(card => canAfford(player, card) && card.category)
  const pool = [...tableau.filter(card => card.category), ...payableHand]
  if (pool.length === 0) return null

  const majors = pool.filter(isMajor)
  const minors = pool.filter(card => !isMajor(card))
  const future = majors[0] ?? [...minors].sort((a, b) => pipValue(b) - pipValue(a))[0]
  if (!future) return null

  const rest = pool.filter(card => card.id !== future.id)
  const same = rest.filter(card => card.element === future.element)
  const others = rest.filter(card => card.element !== future.element)
  const ordered = [...same, ...others]
  const present = ordered[0]
  const past = ordered[1]

  return {
    futureId: future.id,
    presentId: present?.id,
    pastId: past?.id,
  }
}
