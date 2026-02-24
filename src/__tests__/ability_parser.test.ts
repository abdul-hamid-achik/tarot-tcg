/**
 * Comprehensive tests for the structured ability parser.
 * Tests parsing of trigger detection, action extraction, target resolution,
 * duration parsing, compound abilities, and real card descriptions.
 */
import { describe, it, expect } from 'vitest'
import { parseAbilityDescription } from '@/services/ability_parser'
import type { ParsedAbility, ParsedAction, TriggerType, ActionType, TargetType } from '@/services/ability_parser'

// ================================
// HELPER FUNCTIONS
// ================================

function expectTrigger(result: ParsedAbility, trigger: TriggerType) {
  expect(result.trigger).toBe(trigger)
}

function expectAction(action: ParsedAction | undefined, type: ActionType) {
  expect(action).toBeDefined()
  expect(action!.type).toBe(type)
}

function expectTarget(action: ParsedAction | undefined, target: TargetType) {
  expect(action).toBeDefined()
  expect(action!.target).toBe(target)
}

// ================================
// TRIGGER PARSING TESTS
// ================================

describe('Ability Parser - Trigger Detection', () => {
  it('should parse "When played" trigger', () => {
    const result = parseAbilityDescription('When played, draw a card')
    expectTrigger(result, 'on_play')
  })

  it('should parse "When summoned" trigger', () => {
    const result = parseAbilityDescription('When summoned, deal 3 damage to any target')
    expectTrigger(result, 'on_play')
  })

  it('should parse "At the start of your turn" trigger', () => {
    const result = parseAbilityDescription('At the start of your turn, restore 3 health to your hero')
    expectTrigger(result, 'start_of_turn')
  })

  it('should parse "At the start of each turn" trigger', () => {
    const result = parseAbilityDescription("At the start of each player's turn, deal 1 damage to all units")
    expectTrigger(result, 'start_of_turn')
  })

  it('should parse "At the end of your turn" trigger', () => {
    const result = parseAbilityDescription('At the end of your turn, heal all friendly units to full health')
    expectTrigger(result, 'end_of_turn')
  })

  it('should parse "When this attacks" trigger', () => {
    const result = parseAbilityDescription('When this attacks, deal 2 damage to any target')
    expectTrigger(result, 'on_attack')
  })

  it('should parse "When this dies" trigger', () => {
    const result = parseAbilityDescription('When this dies, draw 2 cards')
    expectTrigger(result, 'on_death')
  })

  it('should parse "Deathrattle" trigger', () => {
    const result = parseAbilityDescription('Deathrattle: deal 3 damage to all enemy units')
    expectTrigger(result, 'on_death')
  })

  it('should default to on_play when no trigger prefix found', () => {
    const result = parseAbilityDescription('Deal 3 damage to any target')
    expectTrigger(result, 'on_play')
  })

  it('should handle case-insensitive triggers', () => {
    const result = parseAbilityDescription('WHEN PLAYED, draw a card')
    expectTrigger(result, 'on_play')
  })
})

// ================================
// DEAL DAMAGE TESTS
// ================================

describe('Ability Parser - Deal Damage', () => {
  it('should parse "deal X damage" to opponent by default', () => {
    const result = parseAbilityDescription('Deal 3 damage')
    expect(result.actions).toHaveLength(1)
    expectAction(result.actions[0], 'dealDamage')
    expect(result.actions[0].amount).toBe(3)
  })

  it('should parse "deal X damage to any target"', () => {
    const result = parseAbilityDescription('Deal 2 damage to any target')
    expect(result.actions).toHaveLength(1)
    expectAction(result.actions[0], 'dealDamage')
    expect(result.actions[0].amount).toBe(2)
    expectTarget(result.actions[0], 'any_target')
  })

  it('should parse "deal X damage to opponent"', () => {
    const result = parseAbilityDescription('Deal 5 damage to opponent')
    expect(result.actions).toHaveLength(1)
    expectAction(result.actions[0], 'dealDamage')
    expect(result.actions[0].amount).toBe(5)
    expectTarget(result.actions[0], 'opponent')
  })

  it('should parse "deal X damage to all units and players"', () => {
    const result = parseAbilityDescription('Deal 4 damage to all units and players')
    expect(result.actions).toHaveLength(1)
    expectAction(result.actions[0], 'damageAllUnits')
    expect(result.actions[0].amount).toBe(4)
    expectTarget(result.actions[0], 'all_units')
  })

  it('should parse "deal X damage to all enemy units"', () => {
    const result = parseAbilityDescription('Deal 2 damage to all enemy units')
    expect(result.actions).toHaveLength(1)
    expectAction(result.actions[0], 'damageAllUnits')
    expect(result.actions[0].amount).toBe(2)
    expectTarget(result.actions[0], 'all_enemy')
  })

  it('should parse "deal X damage to all units"', () => {
    const result = parseAbilityDescription('Deal 1 damage to all units including friendly units')
    expect(result.actions).toHaveLength(1)
    expectAction(result.actions[0], 'damageAllUnits')
    expect(result.actions[0].amount).toBe(1)
    expectTarget(result.actions[0], 'all_units')
  })

  it('should parse "take X damage" as self-damage', () => {
    const result = parseAbilityDescription('Take 3 damage')
    expect(result.actions).toHaveLength(1)
    expectAction(result.actions[0], 'dealDamage')
    expect(result.actions[0].amount).toBe(3)
    expectTarget(result.actions[0], 'self')
  })

  it('should parse "lose X health" as self-damage', () => {
    const result = parseAbilityDescription('You lose 3 health')
    expect(result.actions).toHaveLength(1)
    expectAction(result.actions[0], 'dealDamage')
    expect(result.actions[0].amount).toBe(3)
    expectTarget(result.actions[0], 'player')
  })
})

// ================================
// DRAW CARDS TESTS
// ================================

describe('Ability Parser - Draw Cards', () => {
  it('should parse "draw a card"', () => {
    const result = parseAbilityDescription('Draw a card')
    expect(result.actions).toHaveLength(1)
    expectAction(result.actions[0], 'drawCards')
    expect(result.actions[0].amount).toBe(1)
  })

  it('should parse "draw X cards"', () => {
    const result = parseAbilityDescription('Draw 3 cards')
    expect(result.actions).toHaveLength(1)
    expectAction(result.actions[0], 'drawCards')
    expect(result.actions[0].amount).toBe(3)
  })

  it('should parse "draw two cards" with word number', () => {
    const result = parseAbilityDescription('Draw two cards')
    expect(result.actions).toHaveLength(1)
    expectAction(result.actions[0], 'drawCards')
    expect(result.actions[0].amount).toBe(2)
  })

  it('should parse "draw 5 cards"', () => {
    const result = parseAbilityDescription('Draw 5 cards')
    expect(result.actions).toHaveLength(1)
    expectAction(result.actions[0], 'drawCards')
    expect(result.actions[0].amount).toBe(5)
  })

  it('should parse "draw cards until you have X"', () => {
    const result = parseAbilityDescription('Draw cards until you have 5 cards in hand')
    expect(result.actions).toHaveLength(1)
    expectAction(result.actions[0], 'drawCards')
    expect(result.actions[0].amount).toBe(5)
  })
})

// ================================
// HEAL / GAIN HEALTH TESTS
// ================================

describe('Ability Parser - Heal / Gain Health', () => {
  it('should parse "restore X health to your hero"', () => {
    const result = parseAbilityDescription('Restore 3 health to your hero')
    expect(result.actions).toHaveLength(1)
    expectAction(result.actions[0], 'gainHealth')
    expect(result.actions[0].amount).toBe(3)
    expectTarget(result.actions[0], 'player')
  })

  it('should parse "heal this unit for X"', () => {
    const result = parseAbilityDescription('Heal this unit for 2')
    expect(result.actions).toHaveLength(1)
    expectAction(result.actions[0], 'gainHealth')
    expect(result.actions[0].amount).toBe(2)
    expectTarget(result.actions[0], 'self')
  })

  it('should parse "gain X health"', () => {
    const result = parseAbilityDescription('Gain 4 health')
    expect(result.actions).toHaveLength(1)
    expectAction(result.actions[0], 'gainHealth')
    expect(result.actions[0].amount).toBe(4)
  })

  it('should parse "heal any target for X"', () => {
    const result = parseAbilityDescription('Heal any target for 4')
    expect(result.actions).toHaveLength(1)
    expectAction(result.actions[0], 'gainHealth')
    expect(result.actions[0].amount).toBe(4)
    expectTarget(result.actions[0], 'any_target')
  })
})

// ================================
// STAT BUFF TESTS
// ================================

describe('Ability Parser - Stat Buffs', () => {
  it('should parse "+X/+Y" pattern', () => {
    const result = parseAbilityDescription('Gain +2/+3')
    expect(result.actions).toHaveLength(1)
    expectAction(result.actions[0], 'statBuff')
    expect(result.actions[0].statModifiers).toEqual({ attack: 2, health: 3 })
  })

  it('should parse "give all friendly units +X/+Y"', () => {
    const result = parseAbilityDescription('Give all friendly units +2/+2')
    expect(result.actions).toHaveLength(1)
    expectAction(result.actions[0], 'buffAllUnits')
    expect(result.actions[0].statModifiers).toEqual({ attack: 2, health: 2 })
    expectTarget(result.actions[0], 'all_friendly')
  })

  it('should parse "all enemy units gain +X/+Y"', () => {
    const result = parseAbilityDescription('All enemy units gain +2/+2')
    expect(result.actions).toHaveLength(1)
    expectAction(result.actions[0], 'buffAllUnits')
    expect(result.actions[0].statModifiers).toEqual({ attack: 2, health: 2 })
    expectTarget(result.actions[0], 'all_enemy')
  })

  it('should parse "+0/+Y" for health-only buffs', () => {
    const result = parseAbilityDescription('Your other units have +0/+1')
    expect(result.actions).toHaveLength(1)
    expectAction(result.actions[0], 'buffAllUnits')
    expect(result.actions[0].statModifiers).toEqual({ attack: 0, health: 1 })
  })

  it('should parse stat buff with duration', () => {
    const result = parseAbilityDescription('Gain +3/+3 this turn')
    expect(result.actions).toHaveLength(1)
    expectAction(result.actions[0], 'statBuff')
    expect(result.actions[0].statModifiers).toEqual({ attack: 3, health: 3 })
    expect(result.actions[0].duration).toBe('this_turn')
  })
})

// ================================
// DISCARD TESTS
// ================================

describe('Ability Parser - Discard', () => {
  it('should parse "discard a card"', () => {
    const result = parseAbilityDescription('Discard a card')
    expect(result.actions).toHaveLength(1)
    expectAction(result.actions[0], 'discardCards')
    expect(result.actions[0].amount).toBe(1)
  })

  it('should parse "discard X cards"', () => {
    const result = parseAbilityDescription('Discard 3 cards')
    expect(result.actions).toHaveLength(1)
    expectAction(result.actions[0], 'discardCards')
    expect(result.actions[0].amount).toBe(3)
  })

  it('should parse "discard your hand" (entire hand)', () => {
    const result = parseAbilityDescription('Discard your hand')
    expect(result.actions).toHaveLength(1)
    expectAction(result.actions[0], 'discardCards')
    expect(result.actions[0].amount).toBe(-1) // sentinel for entire hand
  })
})

// ================================
// DESTROY TESTS
// ================================

describe('Ability Parser - Destroy', () => {
  it('should parse "destroy all units"', () => {
    const result = parseAbilityDescription('Destroy all units')
    expect(result.actions).toHaveLength(1)
    expectAction(result.actions[0], 'destroyAllUnits')
    expectTarget(result.actions[0], 'all_units')
  })

  it('should parse "destroy target unit"', () => {
    const result = parseAbilityDescription('Destroy target unit')
    expect(result.actions).toHaveLength(1)
    expectAction(result.actions[0], 'destroyUnit')
  })
})

// ================================
// SUMMON TESTS
// ================================

describe('Ability Parser - Summon', () => {
  it('should parse "summon a X/Y token"', () => {
    const result = parseAbilityDescription('Summon a 2/2 token')
    expect(result.actions).toHaveLength(1)
    expectAction(result.actions[0], 'summonUnit')
    expect(result.actions[0].statModifiers).toEqual({ attack: 2, health: 2 })
  })

  it('should parse "create a X/Y token"', () => {
    const result = parseAbilityDescription('Create a 1/1 Nature Spirit token')
    expect(result.actions).toHaveLength(1)
    expectAction(result.actions[0], 'summonUnit')
    expect(result.actions[0].statModifiers).toEqual({ attack: 1, health: 1 })
  })
})

// ================================
// GAIN MANA TESTS
// ================================

describe('Ability Parser - Gain Mana', () => {
  it('should parse "gain X mana"', () => {
    const result = parseAbilityDescription('Gain 2 mana this turn')
    expect(result.actions).toHaveLength(1)
    expectAction(result.actions[0], 'gainMana')
    expect(result.actions[0].amount).toBe(2)
  })

  it('should parse "gain X spell mana"', () => {
    const result = parseAbilityDescription('Gain 1 spell mana')
    expect(result.actions).toHaveLength(1)
    expectAction(result.actions[0], 'gainMana')
    expect(result.actions[0].amount).toBe(1)
  })
})

// ================================
// KEYWORD TESTS
// ================================

describe('Ability Parser - Keywords', () => {
  it('should parse "Taunt" keyword', () => {
    const result = parseAbilityDescription('Taunt. Takes 1 less damage from all sources')
    // Should find the keyword action
    const keywordAction = result.actions.find(a => a.type === 'addKeyword')
    expect(keywordAction).toBeDefined()
    expect(keywordAction!.keyword).toBe('taunt')
  })

  it('should parse "gain Lifesteal"', () => {
    const result = parseAbilityDescription('They gain Lifesteal this turn')
    const keywordAction = result.actions.find(a => a.type === 'addKeyword')
    expect(keywordAction).toBeDefined()
    expect(keywordAction!.keyword).toBe('lifesteal')
  })

  it('should parse quoted keyword "Eternal"', () => {
    const result = parseAbilityDescription("All units gain 'Eternal' (cannot be destroyed) until end of turn")
    const keywordAction = result.actions.find(a => a.type === 'addKeyword')
    expect(keywordAction).toBeDefined()
    expect(keywordAction!.keyword).toBe('eternal')
  })
})

// ================================
// DURATION TESTS
// ================================

describe('Ability Parser - Duration', () => {
  it('should parse "this turn" duration', () => {
    const result = parseAbilityDescription('Give all friendly units +2/+2 this turn')
    expect(result.actions[0].duration).toBe('this_turn')
  })

  it('should parse "until end of turn" duration', () => {
    const result = parseAbilityDescription("All units gain 'Eternal' until end of turn")
    const keywordAction = result.actions.find(a => a.type === 'addKeyword')
    expect(keywordAction).toBeDefined()
    expect(keywordAction!.duration).toBe('end_of_turn')
  })

  it('should parse "for X turns" duration', () => {
    const result = parseAbilityDescription('Deal 1 damage to all units for 3 turns')
    expect(result.actions[0].duration).toBe(3)
  })

  it('should default to permanent when no duration specified for buffs', () => {
    const result = parseAbilityDescription('Give all friendly units +1/+1')
    expect(result.actions[0].duration).toBe('permanent')
  })
})

// ================================
// COMPOUND ABILITY TESTS
// ================================

describe('Ability Parser - Compound Abilities', () => {
  it('should parse abilities joined by ". " (period + space)', () => {
    const result = parseAbilityDescription('Destroy all units. Draw 3 cards')
    expect(result.actions.length).toBeGreaterThanOrEqual(2)
    expect(result.isCompound).toBe(true)
    expectAction(result.actions[0], 'destroyAllUnits')
    expectAction(result.actions[1], 'drawCards')
    expect(result.actions[1].amount).toBe(3)
  })

  it('should parse abilities joined by "and" between distinct actions', () => {
    const result = parseAbilityDescription('Deal 3 damage to opponent and draw 2 cards')
    expect(result.actions.length).toBeGreaterThanOrEqual(2)
    expect(result.isCompound).toBe(true)
  })

  it('should NOT split on "and" in "units and players" target phrase', () => {
    const result = parseAbilityDescription('Deal 4 damage to all units and players')
    // This should be 1 action, not split on "and"
    expect(result.actions).toHaveLength(1)
    expectAction(result.actions[0], 'damageAllUnits')
  })

  it('should handle multi-sentence compound abilities', () => {
    const result = parseAbilityDescription(
      'Deal 4 damage to all units and players. Destroy all units with 2 or less health remaining. Each player discards their hand and draws 5 cards.'
    )
    // At least the damage and the discard/draw actions
    expect(result.actions.length).toBeGreaterThanOrEqual(2)
    expect(result.isCompound).toBe(true)
  })
})

// ================================
// EMPTY / EDGE CASE TESTS
// ================================

describe('Ability Parser - Edge Cases', () => {
  it('should return empty actions for empty string', () => {
    const result = parseAbilityDescription('')
    expect(result.actions).toHaveLength(0)
    expect(result.isCompound).toBe(false)
  })

  it('should return empty actions for null-ish input', () => {
    const result = parseAbilityDescription(null as any)
    expect(result.actions).toHaveLength(0)
  })

  it('should return empty actions for undefined input', () => {
    const result = parseAbilityDescription(undefined as any)
    expect(result.actions).toHaveLength(0)
  })

  it('should return empty actions for unparseable descriptions', () => {
    const result = parseAbilityDescription('This card does something mysterious and unknowable')
    expect(result.actions).toHaveLength(0)
  })

  it('should handle descriptions with only trigger and no action', () => {
    const result = parseAbilityDescription('When played,')
    expectTrigger(result, 'on_play')
    expect(result.actions).toHaveLength(0)
  })

  it('should be case-insensitive throughout', () => {
    const result = parseAbilityDescription('DEAL 5 DAMAGE TO ALL ENEMY UNITS')
    expect(result.actions).toHaveLength(1)
    expectAction(result.actions[0], 'damageAllUnits')
    expect(result.actions[0].amount).toBe(5)
  })
})

// ================================
// REAL CARD DESCRIPTIONS FROM GAME
// ================================

describe('Ability Parser - Real Card Descriptions', () => {
  // The Fool (major-00) - Upright
  it('should parse The Fool upright: "When played, may pay any amount of mana to gain +X/+X where X is mana paid. Draw a card."', () => {
    const result = parseAbilityDescription(
      'When played, may pay any amount of mana to gain +X/+X where X is mana paid. Draw a card.'
    )
    expectTrigger(result, 'on_play')
    // Should at least find the draw action
    const drawAction = result.actions.find(a => a.type === 'drawCards')
    expect(drawAction).toBeDefined()
    expect(drawAction!.amount).toBe(1)
  })

  // The Fool (major-00) - Reversed
  it('should parse The Fool reversed: "When played, discard your hand. For each card discarded, deal 2 damage to any target."', () => {
    const result = parseAbilityDescription(
      'When played, discard your hand. For each card discarded, deal 2 damage to any target.'
    )
    expectTrigger(result, 'on_play')
    const discardAction = result.actions.find(a => a.type === 'discardCards')
    expect(discardAction).toBeDefined()
    expect(discardAction!.amount).toBe(-1)
    const damageAction = result.actions.find(a => a.type === 'dealDamage')
    expect(damageAction).toBeDefined()
    expect(damageAction!.amount).toBe(2)
  })

  // Death (major-13) - Upright: "Destroy all units. Each player draws cards equal to units they lost (max 7)."
  it('should parse Death upright: destroy all units + draw', () => {
    const result = parseAbilityDescription(
      'Destroy all units. Each player draws cards equal to units they lost (max 7). All players gain spell mana equal to destroyed units\' total cost divided by 3.'
    )
    expectTrigger(result, 'on_play')
    const destroyAction = result.actions.find(a => a.type === 'destroyAllUnits')
    expect(destroyAction).toBeDefined()
  })

  // Death (major-13) - Reversed: "All units gain 'Eternal' (cannot be destroyed, damaged, or affected by spells) until end of turn. Draw 3 cards."
  it("should parse Death reversed: gain keyword + draw", () => {
    const result = parseAbilityDescription(
      "All units gain 'Eternal' (cannot be destroyed, damaged, or affected by spells) until end of turn. Draw 3 cards."
    )
    const keywordAction = result.actions.find(a => a.type === 'addKeyword')
    expect(keywordAction).toBeDefined()
    expect(keywordAction!.keyword).toBe('eternal')
    expect(keywordAction!.duration).toBe('end_of_turn')
    const drawAction = result.actions.find(a => a.type === 'drawCards')
    expect(drawAction).toBeDefined()
    expect(drawAction!.amount).toBe(3)
  })

  // The Tower (major-16) - Upright: "Deal 4 damage to all units and players. Destroy all units with 2 or less health remaining. Each player discards their hand and draws 5 cards."
  it('should parse The Tower upright: compound damage + destroy + discard + draw', () => {
    const result = parseAbilityDescription(
      'Deal 4 damage to all units and players. Destroy all units with 2 or less health remaining. Each player discards their hand and draws 5 cards.'
    )
    expect(result.isCompound).toBe(true)
    const damageAction = result.actions.find(a => a.type === 'damageAllUnits')
    expect(damageAction).toBeDefined()
    expect(damageAction!.amount).toBe(4)

    // Should also find discard and/or draw
    const discardAction = result.actions.find(a => a.type === 'discardCards')
    const drawAction = result.actions.find(a => a.type === 'drawCards')
    // At least one of them should be detected
    expect(discardAction || drawAction).toBeTruthy()
  })

  // The Tower (major-16) - Reversed: "At the start of each player's turn for the next 3 turns, that player must sacrifice a unit or take 3 damage. Draw 2 cards."
  it('should parse The Tower reversed: trigger + draw', () => {
    const result = parseAbilityDescription(
      "At the start of each player's turn for the next 3 turns, that player must sacrifice a unit or take 3 damage. Draw 2 cards."
    )
    expectTrigger(result, 'start_of_turn')
    const drawAction = result.actions.find(a => a.type === 'drawCards')
    expect(drawAction).toBeDefined()
    expect(drawAction!.amount).toBe(2)
  })

  // The Sun (major-19) - Upright: "When played, give all friendly units +2/+2 and they gain Lifesteal this turn"
  it('should parse The Sun upright: buff all friendly + keyword', () => {
    const result = parseAbilityDescription(
      'When played, give all friendly units +2/+2 and they gain Lifesteal this turn'
    )
    expectTrigger(result, 'on_play')
    const buffAction = result.actions.find(a => a.type === 'buffAllUnits')
    expect(buffAction).toBeDefined()
    expect(buffAction!.statModifiers).toEqual({ attack: 2, health: 2 })
    expectTarget(buffAction, 'all_friendly')
  })

  // The Sun (major-19) - Solar Blessing: "At the start of your turn, restore 3 health to your hero"
  it('should parse The Sun Solar Blessing: start of turn heal', () => {
    const result = parseAbilityDescription(
      'At the start of your turn, restore 3 health to your hero'
    )
    expectTrigger(result, 'start_of_turn')
    expect(result.actions).toHaveLength(1)
    expectAction(result.actions[0], 'gainHealth')
    expect(result.actions[0].amount).toBe(3)
    expectTarget(result.actions[0], 'player')
  })

  // The Sun (major-19) - Reversed: "When played, all enemy units gain +2/+2 (blesses all indiscriminately)"
  it('should parse The Sun reversed: buff all enemy', () => {
    const result = parseAbilityDescription(
      'When played, all enemy units gain +2/+2 (blesses all indiscriminately)'
    )
    expectTrigger(result, 'on_play')
    const buffAction = result.actions.find(a => a.type === 'buffAllUnits')
    expect(buffAction).toBeDefined()
    expect(buffAction!.statModifiers).toEqual({ attack: 2, health: 2 })
    expectTarget(buffAction, 'all_enemy')
  })

  // Scorching Heat: "At the start of your turn, deal 1 damage to all units including friendly units"
  it('should parse Scorching Heat: deal damage to all units', () => {
    const result = parseAbilityDescription(
      'At the start of your turn, deal 1 damage to all units including friendly units'
    )
    expectTrigger(result, 'start_of_turn')
    expect(result.actions).toHaveLength(1)
    expectAction(result.actions[0], 'damageAllUnits')
    expect(result.actions[0].amount).toBe(1)
  })

  // Strength (major-08) - Gentle Strength: "At the start of your turn, heal this unit for 2"
  it('should parse Strength Gentle Strength: heal self', () => {
    const result = parseAbilityDescription(
      'At the start of your turn, heal this unit for 2'
    )
    expectTrigger(result, 'start_of_turn')
    expect(result.actions).toHaveLength(1)
    expectAction(result.actions[0], 'gainHealth')
    expect(result.actions[0].amount).toBe(2)
    expectTarget(result.actions[0], 'self')
  })

  // Strength (major-08) - Reversed: "Can't attack. At the start of your turn, take 1 damage."
  it('should parse Strength reversed: take self damage', () => {
    const result = parseAbilityDescription(
      "Can't attack. At the start of your turn, take 1 damage."
    )
    // "At the start" is not at the beginning, so it gets parsed as a fragment
    const dmgAction = result.actions.find(a => a.type === 'dealDamage')
    expect(dmgAction).toBeDefined()
    expect(dmgAction!.amount).toBe(1)
  })

  // The Empress (major-03) - Upright: "At the end of your turn, create a 1/1 Nature Spirit token"
  it('should parse The Empress upright: create token at end of turn', () => {
    const result = parseAbilityDescription(
      "At the end of your turn, create a 1/1 Nature Spirit token with 'When this dies, gain 1 life'"
    )
    expectTrigger(result, 'end_of_turn')
    const summonAction = result.actions.find(a => a.type === 'summonUnit')
    expect(summonAction).toBeDefined()
    expect(summonAction!.statModifiers).toEqual({ attack: 1, health: 1 })
  })

  // Abundant Growth: "Your other units have +0/+1"
  it('should parse Abundant Growth: passive buff', () => {
    const result = parseAbilityDescription('Your other units have +0/+1')
    const buffAction = result.actions.find(a => a.type === 'buffAllUnits')
    expect(buffAction).toBeDefined()
    expect(buffAction!.statModifiers).toEqual({ attack: 0, health: 1 })
  })

  // Ace of Wands - Upright: "Deal 2 damage to any target."
  it('should parse Ace of Wands Divine Spark: deal damage', () => {
    const result = parseAbilityDescription(
      'Deal 2 damage to any target. If this destroys a unit, draw a card and gain 1 spell mana.'
    )
    const damageAction = result.actions.find(a => a.type === 'dealDamage')
    expect(damageAction).toBeDefined()
    expect(damageAction!.amount).toBe(2)
    expectTarget(damageAction, 'any_target')
  })

  // Ace of Cups - Upright: "Heal any target for 4."
  it('should parse Ace of Cups Overflowing Grace: heal', () => {
    const result = parseAbilityDescription(
      'Heal any target for 4. If target is at full health, they gain +0/+2 permanently instead.'
    )
    const healAction = result.actions.find(a => a.type === 'gainHealth')
    expect(healAction).toBeDefined()
    expect(healAction!.amount).toBe(4)
    expectTarget(healAction, 'any_target')
  })

  // Ace of Pentacles - Upright: "Gain 2 mana this turn and 1 spell mana. Create a 0/3 'Pentacle Token'"
  it('should parse Ace of Pentacles: gain mana + create token', () => {
    const result = parseAbilityDescription(
      "Gain 2 mana this turn and 1 spell mana. Create a 0/3 'Pentacle Token' with 'Sacrifice: Gain 1 mana.'"
    )
    const manaAction = result.actions.find(a => a.type === 'gainMana')
    expect(manaAction).toBeDefined()
    expect(manaAction!.amount).toBe(2)
  })

  // Ten of Cups: "Heal all friendly characters to full health. Your units gain +2/+2. Draw 2 cards"
  it('should parse Ten of Cups: heal all + buff all + draw', () => {
    const result = parseAbilityDescription(
      'Heal all friendly characters to full health. Your units gain +2/+2. Draw 2 cards'
    )
    expect(result.isCompound).toBe(true)

    const healAction = result.actions.find(a => a.type === 'healAllUnits')
    expect(healAction).toBeDefined()

    // Find buff: note "Your units" is treated as all_friendly
    const buffAction = result.actions.find(a => a.type === 'buffAllUnits')
    expect(buffAction).toBeDefined()
    expect(buffAction!.statModifiers).toEqual({ attack: 2, health: 2 })

    const drawAction = result.actions.find(a => a.type === 'drawCards')
    expect(drawAction).toBeDefined()
    expect(drawAction!.amount).toBe(2)
  })

  // The Star - Fading Star: "At the end of your turn, all friendly units lose 1 health (cannot be prevented)"
  it('should parse The Star Fading Star: damage friendly units', () => {
    const result = parseAbilityDescription(
      'At the end of your turn, all friendly units lose 1 health (cannot be prevented)'
    )
    expectTrigger(result, 'end_of_turn')
    const damageAction = result.actions.find(a => a.type === 'damageAllUnits')
    expect(damageAction).toBeDefined()
    expect(damageAction!.amount).toBe(1)
    expectTarget(damageAction, 'all_friendly')
  })

  // The Star - Guiding Star: "When played, draw cards until you have 5 cards in hand"
  it('should parse The Star Guiding Star: draw until hand size', () => {
    const result = parseAbilityDescription(
      'When played, draw cards until you have 5 cards in hand'
    )
    expectTrigger(result, 'on_play')
    const drawAction = result.actions.find(a => a.type === 'drawCards')
    expect(drawAction).toBeDefined()
    expect(drawAction!.amount).toBe(5)
  })

  // Ten of Swords: "Destroy target unit."
  it('should parse Ten of Swords: destroy target unit', () => {
    const result = parseAbilityDescription(
      "Destroy target unit. If it was yours, draw 5 cards. If it was an enemy's, they discard 3 cards"
    )
    const destroyAction = result.actions.find(a => a.type === 'destroyUnit')
    expect(destroyAction).toBeDefined()
  })

  // The Empress - Reversed: "At the end of your turn, create a 2/2 Thorn Beast token."
  it('should parse The Empress reversed: create 2/2 token', () => {
    const result = parseAbilityDescription(
      'At the end of your turn, create a 2/2 Thorn Beast token. All tokens cost 1 life to maintain.'
    )
    expectTrigger(result, 'end_of_turn')
    const summonAction = result.actions.find(a => a.type === 'summonUnit')
    expect(summonAction).toBeDefined()
    expect(summonAction!.statModifiers).toEqual({ attack: 2, health: 2 })
  })

  // Ace of Swords - Upright: "Draw 2 cards."
  it('should parse Ace of Swords Mental Clarity: draw cards', () => {
    const result = parseAbilityDescription(
      "Draw 2 cards. Look at target opponent's hand. Choose a card type (unit/spell). That player can't play cards of that type next turn."
    )
    const drawAction = result.actions.find(a => a.type === 'drawCards')
    expect(drawAction).toBeDefined()
    expect(drawAction!.amount).toBe(2)
  })

  // Ace of Swords - Reversed: "Each player discards a card, then draws a card."
  it('should parse Ace of Swords reversed: discard + draw', () => {
    const result = parseAbilityDescription(
      'Each player discards a card, then draws a card. All spells cost 1 more this turn.'
    )
    const discardAction = result.actions.find(a => a.type === 'discardCards')
    expect(discardAction).toBeDefined()
    expect(discardAction!.amount).toBe(1)
  })

  // Strength - Taunt keyword
  it('should parse Strength Taunt keyword', () => {
    const result = parseAbilityDescription(
      'Taunt. Takes 1 less damage from all sources'
    )
    const keywordAction = result.actions.find(a => a.type === 'addKeyword')
    expect(keywordAction).toBeDefined()
    expect(keywordAction!.keyword).toBe('taunt')
  })
})

// ================================
// INTEGRATION: PARSED ACTIONS MAP TO EXECUTORS
// ================================

describe('Ability Parser - Action types map to executor names', () => {
  const validExecutorNames = [
    'dealDamage',
    'gainHealth',
    'drawCards',
    'statBuff',
    'discardCards',
    'summonUnit',
    'destroyUnit',
    'gainMana',
    'healAllUnits',
    'damageAllUnits',
    'buffAllUnits',
    'destroyAllUnits',
    'addKeyword',
  ]

  it('all parsed action types should be valid executor names', () => {
    const testDescriptions = [
      'Deal 3 damage',
      'Gain 4 health',
      'Draw 2 cards',
      'Gain +2/+3',
      'Discard 1 card',
      'Summon a 1/1 token',
      'Destroy target unit',
      'Gain 2 mana',
      'Heal all friendly units for 3',
      'Deal 2 damage to all enemy units',
      'Give all friendly units +1/+1',
      'Destroy all units',
      'Gain Lifesteal',
    ]

    for (const desc of testDescriptions) {
      const result = parseAbilityDescription(desc)
      for (const action of result.actions) {
        expect(validExecutorNames).toContain(action.type)
      }
    }
  })
})
