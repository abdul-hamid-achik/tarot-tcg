import { describe, expect, it } from 'vitest'
import { createTestCard, createTestGameState, createTestPlayer } from '@/test_utils'
import {
  isMajor,
  pipValue,
  readingVerdict,
  resolveReading,
  threadElement,
} from '../reading_service'

describe('reading combat', () => {
  it('maps minor pips from names and majors to 0', () => {
    expect(pipValue(createTestCard({ name: 'Three of Swords', category: 'minor' }))).toBe(3)
    expect(pipValue(createTestCard({ name: 'Ace of Cups', category: 'minor' }))).toBe(1)
    expect(pipValue(createTestCard({ name: 'King of Wands', category: 'minor' }))).toBe(14)
    expect(pipValue(createTestCard({ name: 'The Magician', category: 'major', cost: 3 }))).toBe(0)
  })

  it('takes the thread from Past, then Present, then Future', () => {
    const future = createTestCard({ id: 'f', element: 'fire', category: 'minor' })
    const present = createTestCard({ id: 'p', element: 'water', category: 'minor' })
    const past = createTestCard({ id: 'a', element: 'air', category: 'minor' })
    expect(threadElement({ future })).toBe('fire')
    expect(threadElement({ present, future })).toBe('water')
    expect(threadElement({ past, present, future })).toBe('air')
  })

  it('requires Future', () => {
    const state = createTestGameState()
    expect(() => resolveReading(state, { futureId: 'missing' })).toThrow(/Future is required/)
  })

  it('deals pip verdict to nexus when unopposed', () => {
    const swords = createTestCard({
      id: 'sw3',
      name: 'Three of Swords',
      category: 'minor',
      suit: 'swords',
      element: 'air',
      type: 'unit',
      cost: 0,
    })
    const state = createTestGameState({
      phase: 'action',
      activePlayer: 'player1',
      player1: createTestPlayer('player1', {
        mana: 5,
        hand: [swords],
        hasReadThisTurn: false,
      }),
      player2: createTestPlayer('player2', { health: 20 }),
      battlefield: {
        playerUnits: Array(7).fill(null),
        enemyUnits: Array(7).fill(null),
        maxSlots: 7,
      },
    })

    const { state: next, report } = resolveReading(state, { futureId: 'sw3' })
    expect(report.verdict).toBe(3)
    expect(report.contested).toBe(false)
    expect(report.target).toBe('nexus')
    expect(next.player2.health).toBe(17)
    expect(next.player1.hasReadThisTurn).toBe(true)
  })

  it('hits a matching-element unit when contested and Future is a minor', () => {
    const wands = createTestCard({
      id: 'w2',
      name: 'Two of Wands',
      category: 'minor',
      suit: 'wands',
      element: 'fire',
      type: 'unit',
      cost: 0,
    })
    const blocker = createTestCard({
      id: 'enemy-fire',
      name: 'Knight of Wands',
      category: 'minor',
      element: 'fire',
      type: 'unit',
      health: 4,
      currentHealth: 4,
    })
    const state = createTestGameState({
      phase: 'action',
      player1: createTestPlayer('player1', { mana: 5, hand: [wands], hasReadThisTurn: false }),
      player2: createTestPlayer('player2', { health: 20 }),
      battlefield: {
        playerUnits: Array(7).fill(null),
        enemyUnits: [blocker, null, null, null, null, null, null],
        maxSlots: 7,
      },
    })

    const { state: next, report } = resolveReading(state, { futureId: 'w2' })
    expect(report.contested).toBe(true)
    expect(report.target).toBe('unit')
    expect(next.player2.health).toBe(20)
    expect(next.battlefield.enemyUnits[0]?.currentHealth).toBe(2)
  })

  it('a Major in Future reaches life even when contested', () => {
    const magician = createTestCard({
      id: 'maj',
      name: 'The Magician',
      category: 'major',
      element: 'air',
      type: 'unit',
      cost: 0,
    })
    const present = createTestCard({
      id: 'sw3',
      name: 'Three of Swords',
      category: 'minor',
      element: 'air',
      type: 'unit',
      cost: 0,
    })
    const blocker = createTestCard({
      id: 'enemy-air',
      name: 'Two of Swords',
      category: 'minor',
      element: 'air',
      type: 'unit',
      health: 5,
      currentHealth: 5,
    })
    const state = createTestGameState({
      phase: 'action',
      player1: createTestPlayer('player1', {
        mana: 10,
        hand: [magician, present],
        hasReadThisTurn: false,
      }),
      player2: createTestPlayer('player2', { health: 20 }),
      battlefield: {
        playerUnits: Array(7).fill(null),
        enemyUnits: [blocker, null, null, null, null, null, null],
        maxSlots: 7,
      },
    })

    const { state: next, report } = resolveReading(state, { futureId: 'maj', presentId: 'sw3' })
    expect(isMajor(magician)).toBe(true)
    expect(report.contested).toBe(true)
    expect(report.target).toBe('nexus')
    expect(report.verdict).toBe(3)
    expect(next.player2.health).toBe(17)
  })

  it('a reversed same-element clarifier inverts Future', () => {
    const future = createTestCard({
      id: 'f',
      name: 'Four of Cups',
      category: 'minor',
      element: 'water',
      type: 'spell',
      cost: 0,
      isReversed: false,
    })
    const clarifier = createTestCard({
      id: 'c',
      name: 'Ace of Cups',
      category: 'minor',
      element: 'water',
      type: 'spell',
      cost: 0,
      isReversed: true,
    })
    const state = createTestGameState({
      phase: 'action',
      player1: createTestPlayer('player1', { mana: 5, hand: [future], hasReadThisTurn: false }),
      player2: createTestPlayer('player2', { mana: 5, hand: [clarifier] }),
    })

    const { report } = resolveReading(state, { futureId: 'f', clarifierId: 'c' })
    expect(report.inverted).toBe(true)
  })

  it('sums pips across the spread', () => {
    expect(
      readingVerdict({
        past: createTestCard({ name: 'Two of Cups', category: 'minor' }),
        present: createTestCard({ name: 'Ace of Cups', category: 'minor' }),
        future: createTestCard({ name: 'The Fool', category: 'major' }),
      }),
    ).toBe(3)
  })
})
