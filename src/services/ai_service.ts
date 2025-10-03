import type { Card, GameState } from '@/schemas/schema'

export type AILevel = 'tutorial' | 'easy' | 'normal' | 'hard' | 'expert'

export interface AIPersonality {
  name: string
  description: string
  level: AILevel
  icon: string
  mulliganStrategy: 'conservative' | 'aggressive' | 'balanced' | 'random'
  playStrategy: 'defensive' | 'aggressive' | 'tempo' | 'control' | 'random'
  attackStrategy: 'cautious' | 'aggressive' | 'optimal' | 'random'
  thinkingTime: number // milliseconds
  mistakeChance: number // 0-1, chance of making suboptimal plays
}

export const AI_PERSONALITIES: Record<AILevel, AIPersonality> = {
  tutorial: {
    name: 'Training Dummy',
    description: 'Makes obvious mistakes to help you learn',
    level: 'tutorial',
    icon: '🎯',
    mulliganStrategy: 'random',
    playStrategy: 'random',
    attackStrategy: 'random',
    thinkingTime: 500,
    mistakeChance: 0.7,
  },
  easy: {
    name: 'Novice Mystic',
    description: 'Simple strategy, plays cards randomly',
    level: 'easy',
    icon: '🌟',
    mulliganStrategy: 'conservative',
    playStrategy: 'random',
    attackStrategy: 'cautious',
    thinkingTime: 800,
    mistakeChance: 0.4,
  },
  normal: {
    name: 'Apprentice Reader',
    description: 'Balanced play with some tactical awareness',
    level: 'normal',
    icon: '🔮',
    mulliganStrategy: 'balanced',
    playStrategy: 'tempo',
    attackStrategy: 'aggressive',
    thinkingTime: 1200,
    mistakeChance: 0.2,
  },
  hard: {
    name: 'Master Diviner',
    description: 'Strategic play with good decision making',
    level: 'hard',
    icon: '⭐',
    mulliganStrategy: 'aggressive',
    playStrategy: 'control',
    attackStrategy: 'optimal',
    thinkingTime: 1500,
    mistakeChance: 0.1,
  },
  expert: {
    name: 'Arcane Oracle',
    description: 'Near-perfect play, maximum challenge',
    level: 'expert',
    icon: '👑',
    mulliganStrategy: 'aggressive',
    playStrategy: 'control',
    attackStrategy: 'optimal',
    thinkingTime: 2000,
    mistakeChance: 0.05,
  },
}

export class AIService {
  private currentPersonality: AIPersonality = AI_PERSONALITIES.normal

  setPersonality(level: AILevel): void {
    this.currentPersonality = AI_PERSONALITIES[level]
  }

  getCurrentPersonality(): AIPersonality {
    return this.currentPersonality
  }

  // Enhanced mulligan logic based on AI personality
  performMulligan(gameState: GameState): GameState {
    const personality = this.currentPersonality
    const player = gameState.player2
    const hand = player.hand
    let cardsToMulligan: string[] = []

    switch (personality.mulliganStrategy) {
      case 'random':
        // Random mulligan for tutorial AI
        cardsToMulligan = hand.filter(() => Math.random() < 0.3).map(card => card.id)
        break

      case 'conservative':
        // Keep most cards, only mulligan very high cost ones
        cardsToMulligan = hand.filter(card => card.cost > 6).map(card => card.id)
        break

      case 'balanced': {
        // Mulligan for curve - want mix of low and medium cost
        const lowCost = hand.filter(card => card.cost <= 3).length
        const midCost = hand.filter(card => card.cost >= 4 && card.cost <= 6).length

        if (lowCost === 0) {
          // No low cost cards, mulligan highest cost cards
          cardsToMulligan = hand
            .sort((a, b) => b.cost - a.cost)
            .slice(0, 2)
            .map(card => card.id)
        } else if (midCost === 0) {
          // No mid cost cards, mulligan some low cost for mid
          cardsToMulligan = hand
            .filter(card => card.cost <= 2)
            .slice(0, 1)
            .map(card => card.id)
        }
        break
      }

      case 'aggressive': {
        // Mulligan for optimal curve and strong cards
        const optimalHand = this.evaluateHandQuality(hand)
        if (optimalHand < 0.6) {
          cardsToMulligan = hand
            .sort((a, b) => this.evaluateCardValue(a) - this.evaluateCardValue(b))
            .slice(0, Math.min(3, hand.length))
            .map(card => card.id)
        }
        break
      }
    }

    // Apply mistake chance
    if (Math.random() < personality.mistakeChance) {
      // Make a mistake - either mulligan good cards or keep bad ones
      if (Math.random() < 0.5) {
        // Add a good card to mulligan
        const goodCards = hand.filter(
          card => !cardsToMulligan.includes(card.id) && this.evaluateCardValue(card) > 0.7,
        )
        if (goodCards.length > 0) {
          cardsToMulligan.push(goodCards[0].id)
        }
      } else {
        // Remove a bad card from mulligan
        cardsToMulligan = cardsToMulligan.slice(0, -1)
      }
    }

    // Apply the mulligan
    return this.applyMulligan(gameState, cardsToMulligan)
  }

  // Enhanced card play logic
  selectCardToPlay(gameState: GameState): { card: Card | null; shouldPlay: boolean } {
    const personality = this.currentPersonality
    const player = gameState.player2
    const playableCards = player.hand.filter(card => card.cost <= player.mana + player.spellMana)

    if (playableCards.length === 0) {
      return { card: null, shouldPlay: false }
    }

    let selectedCard: Card | null = null

    switch (personality.playStrategy) {
      case 'random':
        selectedCard = playableCards[Math.floor(Math.random() * playableCards.length)]
        break

      case 'defensive':
        // Prefer defensive units with high health
        selectedCard =
          playableCards
            .filter(card => card.type === 'unit')
            .sort((a, b) => (b.health || 0) - (a.health || 0))[0] || playableCards[0]
        break

      case 'aggressive':
        // Prefer units with high attack
        selectedCard =
          playableCards
            .filter(card => card.type === 'unit')
            .sort((a, b) => (b.attack || 0) - (a.attack || 0))[0] || playableCards[0]
        break

      case 'tempo':
        // Play cards efficiently on curve
        selectedCard = playableCards.sort(
          (a, b) => this.evaluateTempoValue(a, gameState) - this.evaluateTempoValue(b, gameState),
        )[0]
        break

      case 'control':
        // Prefer value and card advantage
        selectedCard = playableCards.sort(
          (a, b) => this.evaluateCardValue(b) - this.evaluateCardValue(a),
        )[0]
        break
    }

    // Apply mistake chance
    if (Math.random() < personality.mistakeChance && playableCards.length > 1) {
      // Make a mistake - play a random card instead
      selectedCard = playableCards[Math.floor(Math.random() * playableCards.length)]
    }

    // Decide whether to play the card based on board state
    const shouldPlay = this.shouldPlayCard(selectedCard!, gameState)

    return { card: selectedCard, shouldPlay }
  }

  // Enhanced attack logic
  selectAttackers(gameState: GameState): string[] {
    const personality = this.currentPersonality
    const player = gameState.player2

    // Can't attack without the attack token
    if (!player.hasAttackToken) {
      return []
    }

    // Note: AI service needs updating for battlefield system
    const availableAttackers: any[] = [] // Simplified for now

    if (availableAttackers.length === 0) {
      return []
    }

    let attackers: string[] = []

    switch (personality.attackStrategy) {
      case 'random':
        attackers = availableAttackers.filter(() => Math.random() < 0.5).map(unit => unit.id)
        break

      case 'cautious': {
        // Only attack with units that have higher attack than opponent's defense
        const opponentUnits: any[] = [] // Simplified for battlefield system
        const safeAttackers = availableAttackers.filter(attacker => {
          const wouldSurvive = opponentUnits.every(
            defender =>
              (attacker.attack || 0) >= (defender.health || 0) ||
              (attacker.health || 0) > (defender.attack || 0),
          )
          return wouldSurvive
        })
        attackers = safeAttackers.map(unit => unit.id)
        break
      }

      case 'aggressive':
        // Attack with all available units
        attackers = availableAttackers.map(unit => unit.id)
        break

      case 'optimal':
        // Calculate best attack combination
        attackers = this.calculateOptimalAttack(gameState, availableAttackers)
        break
    }

    // Apply mistake chance
    if (Math.random() < personality.mistakeChance) {
      // Make a mistake in attack selection
      if (Math.random() < 0.5 && attackers.length > 0) {
        // Remove a good attacker
        attackers = attackers.slice(0, -1)
      } else if (availableAttackers.length > attackers.length) {
        // Add a risky attacker
        const nonAttackers = availableAttackers.filter(unit => !attackers.includes(unit.id))
        if (nonAttackers.length > 0) {
          attackers.push(nonAttackers[0].id)
        }
      }
    }

    return attackers
  }

  // Helper methods
  private evaluateHandQuality(hand: Card[]): number {
    if (hand.length === 0) return 0

    const avgCost = hand.reduce((sum, card) => sum + card.cost, 0) / hand.length
    const costVariance =
      hand.reduce((sum, card) => sum + (card.cost - avgCost) ** 2, 0) / hand.length
    const avgValue = hand.reduce((sum, card) => sum + this.evaluateCardValue(card), 0) / hand.length

    // Good hands have reasonable average cost, good distribution, and high value cards
    const costScore = Math.max(0, 1 - Math.abs(avgCost - 4) / 4) // Ideal avg cost is 4
    const distributionScore = Math.max(0, 1 - costVariance / 10) // Lower variance is better
    const valueScore = avgValue

    return (costScore + distributionScore + valueScore) / 3
  }

  private evaluateCardValue(card: Card): number {
    // Simple card evaluation based on stats vs cost
    if (card.type === 'unit') {
      const stats = (card.attack || 0) + (card.health || 0)
      const efficiency = stats / Math.max(1, card.cost)
      return Math.min(1, efficiency / 3) // Normalize to 0-1
    }

    // For non-units, use cost as rough value indicator
    return Math.min(1, card.cost / 8)
  }

  private evaluateTempoValue(card: Card, gameState: GameState): number {
    const round = gameState.round
    const idealCost = Math.min(round + 2, 8) // Slightly ahead of curve
    const costDiff = Math.abs(card.cost - idealCost)
    return this.evaluateCardValue(card) - costDiff * 0.1
  }

  private shouldPlayCard(card: Card, gameState: GameState): boolean {
    const player = gameState.player2

    // Check battlefield space (simplified for now)
    if (card.type === 'unit') {
      return false
    }

    // Always play if it's the only card or very cheap
    if (player.hand.length <= 2 || card.cost <= 2) {
      return true
    }

    // Consider board state
    const opponentUnits = 0 // Simplified for battlefield system
    const myUnits = 0 // Simplified for battlefield system

    // Play cards strategically (simplified for battlefield system)
    if (player.mana >= card.cost) {
      return true
    }

    // Save mana if ahead and card is expensive
    if (myUnits > opponentUnits && card.cost > 5) {
      return false
    }

    return true
  }

  private calculateOptimalAttack(_gameState: GameState, availableAttackers: Card[]): string[] {
    // Simple heuristic: prioritize attackers that can trade favorably
    const opponentUnits: any[] = [] // Simplified for battlefield system

    if (opponentUnits.length === 0) {
      // No defenders, attack with all
      return availableAttackers.map(unit => unit.id)
    }

    // Select attackers that can make favorable trades
    const goodAttackers = availableAttackers.filter(attacker => {
      const canKillDefender = opponentUnits.some(
        defender => (attacker.attack || 0) >= (defender.health || 0),
      )
      const survivesCounterAttack = opponentUnits.every(
        defender => (defender.attack || 0) < (attacker.health || 0),
      )
      return canKillDefender || survivesCounterAttack
    })

    return goodAttackers.length > 0
      ? goodAttackers.map(unit => unit.id)
      : availableAttackers.slice(0, 1).map(unit => unit.id) // At least attack with one
  }

  private applyMulligan(gameState: GameState, cardIds: string[]): GameState {
    const newGameState = { ...gameState }
    const player = { ...newGameState.player2 }

    if (cardIds.length > 0) {
      // Shuffle selected cards back into deck
      const cardsToShuffle = player.hand.filter(card => cardIds.includes(card.id))
      const keptCards = player.hand.filter(card => !cardIds.includes(card.id))

      // Add discarded cards back to deck and shuffle
      player.deck = [...player.deck, ...cardsToShuffle]

      // Simple shuffle
      for (let i = player.deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[player.deck[i], player.deck[j]] = [player.deck[j], player.deck[i]]
      }

      // Draw replacement cards
      const cardsToDraw = cardsToShuffle.length
      const newCards = player.deck.splice(0, cardsToDraw)
      player.hand = [...keptCards, ...newCards]
    }

    player.mulliganComplete = true
    newGameState.player2 = player

    // Check if both players completed mulligan
    if (newGameState.player1.mulliganComplete && newGameState.player2.mulliganComplete) {
      newGameState.phase = 'action'
    }

    return newGameState
  }
}

// Singleton instance
export const aiService = new AIService()
