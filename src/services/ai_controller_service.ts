import type { Card, GameCard, GameState } from '@/schemas/schema'
import { aiService, type AILevel, type AIPersonality } from './ai_service'
import { combatService } from './combat_service'
import { eventManager } from './event_manager'
import { stateManager } from './state_manager'

// AI Decision weights for different strategies
interface DecisionWeights {
  playCard: number
  attack: number
  defend: number
  endTurn: number
  useAbility: number
}

interface CardPlayDecision {
  card: Card
  targetPosition?: { row: number; col: number }
  priority: number
  reasoning: string
}

interface AttackDecision {
  attackerIds: string[]
  targetPriority: 'nexus' | 'units' | 'mixed'
  confidence: number
}

interface DefenseDecision {
  assignments: { defenderId: string; laneId: number }[]
  strategy: 'block-all' | 'block-threats' | 'sacrifice' | 'none'
}

export class AIControllerService {
  private currentPersonality: AIPersonality = aiService.getCurrentPersonality()
  private decisionHistory: string[] = []
  private turnStartTime: number = 0

  // Main entry point for AI turn execution
  async executeAITurn(gameState: GameState): Promise<GameState> {
    if (gameState.activePlayer !== 'player2') {
      console.warn('executeAITurn called when not AI turn')
      return gameState
    }

    this.turnStartTime = Date.now()
    this.currentPersonality = aiService.getCurrentPersonality()
    let currentState = { ...gameState }

    // Log AI thinking
    console.log(`🤖 ${this.currentPersonality.icon} ${this.currentPersonality.name} is analyzing...`)

    // Phase 1: Mulligan (if needed)
    if (currentState.phase === 'mulligan' && !currentState.player2.mulliganComplete) {
      currentState = this.performMulligan(currentState)
      return currentState
    }

    // Phase 2: Action phase
    if (currentState.phase === 'action') {
      // Simulate thinking time
      await this.simulateThinking()

      // Make card play decisions
      currentState = await this.executeCardPlays(currentState)

      // Small delay between actions for visual clarity
      await new Promise(resolve => setTimeout(resolve, 300))

      // Make attack decisions if we have the token
      if (currentState.player2.hasAttackToken) {
        const attackDecision = this.makeAttackDecision(currentState)
        if (attackDecision.attackerIds.length > 0) {
          currentState = this.executeAttack(currentState, attackDecision)
          return currentState // Control passes to opponent for defense
        }
      }

      // End turn if nothing else to do
      console.log(`🤖 ${this.currentPersonality.name} ends turn`)
      eventManager.emitAIAction('ai_end_turn', {
        playerId: 'player2',
        reason: 'No more actions available',
      })
    }

    // Phase 3: Defense phase
    if (currentState.phase === 'declare_defenders' && currentState.activePlayer === 'player2') {
      await this.simulateThinking()
      const defenseDecision = this.makeDefenseDecision(currentState)
      currentState = this.executeDefense(currentState, defenseDecision)
    }

    return currentState
  }

  // Card play logic with strategic evaluation
  private async executeCardPlays(gameState: GameState): Promise<GameState> {
    let currentState = { ...gameState }
    const decisions = this.evaluateCardPlays(currentState)

    // Sort by priority and play cards based on personality
    const sortedDecisions = decisions.sort((a, b) => b.priority - a.priority)
    const maxPlays = this.getMaxCardPlays()
    let playsThisTurn = 0

    for (const decision of sortedDecisions) {
      if (playsThisTurn >= maxPlays) break

      // Check if we should play this card based on priority threshold
      if (!this.shouldPlayCard(decision, currentState)) continue

      // Check mana availability
      const totalMana = currentState.player2.mana + currentState.player2.spellMana
      if (decision.card.cost > totalMana) continue

      // Play the card
      currentState = this.playCard(currentState, decision)
      playsThisTurn++

      console.log(`🎴 AI plays ${decision.card.name} - ${decision.reasoning}`)

      // Small delay between card plays
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    if (playsThisTurn > 0) {
      eventManager.emitAIAction('ai_cards_played', {
        playerId: 'player2',
        cardsPlayed: playsThisTurn,
      })
    }

    return currentState
  }

  // Evaluate all playable cards and assign priorities
  private evaluateCardPlays(gameState: GameState): CardPlayDecision[] {
    const player = gameState.player2
    const decisions: CardPlayDecision[] = []

    for (const card of player.hand) {
      const totalMana = player.mana + player.spellMana
      if (card.cost > totalMana) continue

      const priority = this.calculateCardPriority(card, gameState)
      const reasoning = this.getCardPlayReasoning(card, gameState)

      decisions.push({
        card,
        priority,
        reasoning,
      })
    }

    return decisions
  }

  // Calculate priority score for a card (0-100)
  private calculateCardPriority(card: Card, gameState: GameState): number {
    let priority = 50 // Base priority

    const player = gameState.player2
    const opponent = gameState.player1
    const round = gameState.round

    // Card type considerations
    if (card.type === 'unit') {
      // Board presence evaluation
      const myUnits = player.bench.length
      const oppUnits = opponent.bench.length

      if (myUnits < oppUnits) {
        priority += 20 // Need board presence
      }

      // Unit quality evaluation
      const unitValue = this.evaluateUnitValue(card, gameState)
      priority += unitValue * 20

      // Curve considerations
      if (card.cost === round || card.cost === round + 1) {
        priority += 15 // On curve
      }
    } else if (card.type === 'spell') {
      // Spell evaluation based on board state
      priority += this.evaluateSpellValue(card, gameState) * 25
    }

    // Personality adjustments
    priority = this.applyPersonalityModifier(priority, card, gameState)

    // Add controlled randomness for variety
    priority += (Math.random() - 0.5) * 10 * (1 - this.currentPersonality.mistakeChance)

    return Math.max(0, Math.min(100, priority))
  }

  // Evaluate unit value based on stats and board state
  private evaluateUnitValue(card: Card, gameState: GameState): number {
    if (!card.attack && !card.health) return 0

    const stats = (card.attack || 0) + (card.health || 0)
    const efficiency = stats / Math.max(1, card.cost)

    // Check for favorable trades
    const opponent = gameState.player1
    let tradeValue = 0

    for (const enemyUnit of opponent.bench) {
      if ((card.attack || 0) >= (enemyUnit.currentHealth || enemyUnit.health || 0)) {
        tradeValue += 0.2 // Can kill enemy unit
      }
      if ((card.health || 0) > (enemyUnit.attack || 0)) {
        tradeValue += 0.1 // Survives enemy attack
      }
    }

    return Math.min(1, efficiency / 2 + tradeValue)
  }

  // Evaluate spell value based on current situation
  private evaluateSpellValue(card: Card, gameState: GameState): number {
    // Simple heuristic - would need to parse spell effects for real evaluation
    const hasTargets = gameState.player1.bench.length > 0
    const needsRemoval = gameState.player1.bench.some(u => (u.attack || 0) >= 4)

    if (needsRemoval && card.name.toLowerCase().includes('destroy')) {
      return 0.9
    }

    if (hasTargets && card.name.toLowerCase().includes('damage')) {
      return 0.7
    }

    // Default spell value based on cost
    return Math.min(1, card.cost / 6)
  }

  // Apply personality-specific modifiers to priority
  private applyPersonalityModifier(priority: number, card: Card, gameState: GameState): number {
    switch (this.currentPersonality.playStrategy) {
      case 'aggressive':
        if (card.type === 'unit' && (card.attack || 0) > (card.health || 0)) {
          priority *= 1.3 // Prefer high attack units
        }
        break

      case 'defensive':
        if (card.type === 'unit' && (card.health || 0) > (card.attack || 0)) {
          priority *= 1.3 // Prefer high health units
        }
        break

      case 'tempo':
        if (card.cost <= gameState.round) {
          priority *= 1.2 // Prefer playing on curve
        }
        break

      case 'control':
        if (card.type === 'spell' || card.cost >= 5) {
          priority *= 1.2 // Prefer big cards and spells
        }
        break

      case 'random':
        priority = 50 + Math.random() * 50 // Randomize priority
        break
    }

    // Apply mistake chance
    if (Math.random() < this.currentPersonality.mistakeChance) {
      priority = 100 - priority // Invert priority (play bad cards)
    }

    return priority
  }

  // Determine if we should play a card based on its priority
  private shouldPlayCard(decision: CardPlayDecision, gameState: GameState): boolean {
    const threshold = this.getPlayThreshold()

    // Always play if it's our only option or very high priority
    if (decision.priority >= 80 || gameState.player2.hand.length <= 2) {
      return true
    }

    // Check against personality threshold
    return decision.priority >= threshold
  }

  // Get priority threshold based on personality
  private getPlayThreshold(): number {
    switch (this.currentPersonality.playStrategy) {
      case 'aggressive': return 40 // Play more cards
      case 'defensive': return 60 // Be selective
      case 'tempo': return 45 // Balanced
      case 'control': return 55 // Save resources
      case 'random': return Math.random() * 100 // Random threshold
      default: return 50
    }
  }

  // Get maximum cards to play per turn based on personality
  private getMaxCardPlays(): number {
    switch (this.currentPersonality.level) {
      case 'tutorial': return 1
      case 'easy': return 2
      case 'normal': return 3
      case 'hard': return 4
      case 'expert': return 5
      default: return 3
    }
  }

  // Generate reasoning for card play (for logging/UI)
  private getCardPlayReasoning(card: Card, gameState: GameState): string {
    const reasons: string[] = []

    if (card.type === 'unit') {
      const myUnits = gameState.player2.bench.length
      const oppUnits = gameState.player1.bench.length

      if (myUnits < oppUnits) {
        reasons.push('need board presence')
      }
      if (card.cost === gameState.round) {
        reasons.push('on curve')
      }
      if ((card.attack || 0) >= 4) {
        reasons.push('strong attacker')
      }
    } else {
      reasons.push('spell value')
    }

    return reasons.join(', ')
  }

  // Execute card play and update game state
  private playCard(gameState: GameState, decision: CardPlayDecision): GameState {
    const newState = { ...gameState }
    const player = { ...newState.player2 }
    const card = decision.card

    // Validate bench space for units
    if (card.type === 'unit' && player.bench.length >= 6) {
      console.warn(`AI cannot play ${card.name} - bench is full`)
      return newState // Return unchanged state
    }

    // Calculate mana payment
    const manaToUse = Math.min(player.mana, card.cost)
    const spellManaToUse = Math.max(0, card.cost - manaToUse)

    // Validate mana availability
    const totalMana = player.mana + player.spellMana
    if (card.cost > totalMana) {
      console.warn(`AI cannot play ${card.name} - insufficient mana`)
      return newState // Return unchanged state
    }

    // Pay mana
    player.mana -= manaToUse
    player.spellMana -= spellManaToUse

    // Remove from hand
    player.hand = player.hand.filter(c => c.id !== card.id)

    // Add to appropriate zone
    if (card.type === 'unit') {
      const cardInstance: GameCard = {
        ...card,
        currentHealth: card.health,
        position: 'bench',
      }
      player.bench.push(cardInstance)

      // Update state and register abilities
      newState.player2 = player
      return combatService.registerCardAbilities(cardInstance, newState)
    } else {
      // Handle spell - add to graveyard for now
      player.graveyard.push(card)
      newState.player2 = player
      return newState
    }
  }

  // Make attack decision
  private makeAttackDecision(gameState: GameState): AttackDecision {
    const availableAttackers = gameState.player2.bench.filter(
      unit => (unit.attack || 0) > 0
    )

    if (availableAttackers.length === 0) {
      return { attackerIds: [], targetPriority: 'none', confidence: 0 }
    }

    // Evaluate attack options based on personality
    const attackerIds = this.selectAttackers(availableAttackers, gameState)
    const targetPriority = this.determineTargetPriority(gameState)
    const confidence = this.calculateAttackConfidence(attackerIds, gameState)

    return { attackerIds, targetPriority, confidence }
  }

  // Select which units should attack
  private selectAttackers(availableAttackers: GameCard[], gameState: GameState): string[] {
    switch (this.currentPersonality.attackStrategy) {
      case 'aggressive':
        // Attack with everything
        return availableAttackers.map(u => u.id)

      case 'cautious':
        // Only attack with safe units
        return availableAttackers
          .filter(attacker => this.isAttackSafe(attacker, gameState))
          .map(u => u.id)

      case 'optimal':
        // Calculate best combination
        return this.calculateOptimalAttackers(availableAttackers, gameState)

      case 'random':
        // Random selection
        return availableAttackers
          .filter(() => Math.random() < 0.6)
          .map(u => u.id)

      default:
        return availableAttackers.slice(0, 3).map(u => u.id)
    }
  }

  // Check if attacking with a unit is safe
  private isAttackSafe(attacker: GameCard, gameState: GameState): boolean {
    const opponentUnits = gameState.player1.bench

    // Safe if no defenders
    if (opponentUnits.length === 0) return true

    // Check if we can survive counter-attacks
    const wouldSurvive = opponentUnits.every(
      defender => (defender.attack || 0) < (attacker.currentHealth || attacker.health || 0)
    )

    return wouldSurvive
  }

  // Calculate optimal attacker combination
  private calculateOptimalAttackers(availableAttackers: GameCard[], gameState: GameState): string[] {
    const opponentUnits = gameState.player1.bench

    if (opponentUnits.length === 0) {
      // Go face with strongest attackers
      return availableAttackers
        .sort((a, b) => (b.attack || 0) - (a.attack || 0))
        .slice(0, 4)
        .map(u => u.id)
    }

    // Prioritize favorable trades
    const goodAttackers = availableAttackers.filter(attacker => {
      const canTradeFavorably = opponentUnits.some(defender => {
        const kills = (attacker.attack || 0) >= (defender.currentHealth || defender.health || 0)
        const survives = (defender.attack || 0) < (attacker.currentHealth || attacker.health || 0)
        return kills && survives
      })
      return canTradeFavorably
    })

    return goodAttackers.length > 0
      ? goodAttackers.map(u => u.id)
      : availableAttackers.slice(0, 2).map(u => u.id) // Attack with some units anyway
  }

  // Determine attack target priority
  private determineTargetPriority(gameState: GameState): 'nexus' | 'units' | 'mixed' {
    const opponentUnits = gameState.player1.bench
    const opponentHealth = gameState.player1.health

    // Go for lethal if possible
    const totalDamage = gameState.player2.bench.reduce((sum, unit) => sum + (unit.attack || 0), 0)
    if (totalDamage >= opponentHealth && opponentUnits.length === 0) {
      return 'nexus'
    }

    // Clear threats first
    if (opponentUnits.some(u => (u.attack || 0) >= 5)) {
      return 'units'
    }

    return 'mixed'
  }

  // Calculate confidence in attack decision (0-1)
  private calculateAttackConfidence(attackerIds: string[], gameState: GameState): number {
    if (attackerIds.length === 0) return 0

    const attackers = gameState.player2.bench.filter(u => attackerIds.includes(u.id))
    const defenders = gameState.player1.bench

    // High confidence if no defenders
    if (defenders.length === 0) return 0.9

    // Calculate expected outcome
    let favorableTrades = 0
    let unfavorableTrades = 0

    for (const attacker of attackers) {
      const bestDefender = defenders.reduce((best, curr) => {
        const currValue = (curr.attack || 0) - (attacker.currentHealth || attacker.health || 0)
        const bestValue = best ? (best.attack || 0) - (attacker.currentHealth || attacker.health || 0) : Infinity
        return currValue < bestValue ? curr : best
      }, null as GameCard | null)

      if (bestDefender) {
        if ((attacker.attack || 0) >= (bestDefender.currentHealth || bestDefender.health || 0)) {
          favorableTrades++
        } else {
          unfavorableTrades++
        }
      }
    }

    return favorableTrades / (favorableTrades + unfavorableTrades + 1)
  }

  // Execute attack with selected units
  private executeAttack(gameState: GameState, decision: AttackDecision): GameState {
    const newState = { ...gameState }

    // Clear lanes
    newState.lanes = newState.lanes.map(lane => ({
      ...lane,
      attacker: null,
      defender: null,
    }))

    // Place attackers in lanes and remove from bench
    decision.attackerIds.forEach((attackerId, index) => {
      if (index >= 6) return // Max 6 lanes

      const unitIndex = newState.player2.bench.findIndex(u => u.id === attackerId)
      if (unitIndex !== -1) {
        const unit = newState.player2.bench[unitIndex]
        newState.lanes[index].attacker = { ...unit, position: 'attacking' }
        // Remove unit from bench
        newState.player2.bench.splice(unitIndex, 1)
      }
    })

    // Update phase and active player
    newState.phase = 'declare_defenders'
    newState.attackingPlayer = 'player2'
    newState.activePlayer = 'player1'

    console.log(`⚔️ AI attacks with ${decision.attackerIds.length} units (confidence: ${(decision.confidence * 100).toFixed(0)}%)`)

    return newState
  }

  // Make defense decision
  private makeDefenseDecision(gameState: GameState): DefenseDecision {
    const attackers = gameState.lanes.filter(lane => lane.attacker).map(lane => lane.attacker!)
    const availableDefenders = gameState.player2.bench

    if (attackers.length === 0 || availableDefenders.length === 0) {
      return { assignments: [], strategy: 'none' }
    }

    // Choose defense strategy based on personality
    const strategy = this.chooseDefenseStrategy(attackers, availableDefenders, gameState)
    const assignments = this.assignDefenders(attackers, availableDefenders, strategy, gameState)

    return { assignments, strategy }
  }

  // Choose defense strategy
  private chooseDefenseStrategy(
    attackers: GameCard[],
    defenders: GameCard[],
    gameState: GameState
  ): 'block-all' | 'block-threats' | 'sacrifice' | 'none' {
    const totalIncomingDamage = attackers.reduce((sum, a) => sum + (a.attack || 0), 0)
    const playerHealth = gameState.player2.health

    // Take lethal damage seriously
    if (totalIncomingDamage >= playerHealth) {
      return 'block-all'
    }

    switch (this.currentPersonality.playStrategy) {
      case 'aggressive':
        return 'block-threats' // Only block big threats
      case 'defensive':
        return 'block-all' // Block everything possible
      case 'control':
        return defenders.length > attackers.length ? 'block-all' : 'sacrifice'
      default:
        return 'block-threats'
    }
  }

  // Assign defenders to lanes
  private assignDefenders(
    attackers: GameCard[],
    availableDefenders: GameCard[],
    strategy: string,
    gameState: GameState
  ): { defenderId: string; laneId: number }[] {
    const assignments: { defenderId: string; laneId: number }[] = []
    const remainingDefenders = [...availableDefenders]

    gameState.lanes.forEach((lane, laneId) => {
      if (!lane.attacker || remainingDefenders.length === 0) return

      const attacker = lane.attacker
      let defender: GameCard | null = null

      switch (strategy) {
        case 'block-all':
          // Block with any available unit
          defender = remainingDefenders[0]
          break

        case 'block-threats':
          // Only block high attack units
          if ((attacker.attack || 0) >= 3) {
            defender = this.findBestDefender(attacker, remainingDefenders)
          }
          break

        case 'sacrifice':
          // Use weakest defenders
          defender = remainingDefenders.sort((a, b) =>
            (a.currentHealth || a.health || 0) - (b.currentHealth || b.health || 0)
          )[0]
          break
      }

      if (defender) {
        assignments.push({ defenderId: defender.id, laneId })
        const idx = remainingDefenders.findIndex(d => d.id === defender!.id)
        if (idx > -1) remainingDefenders.splice(idx, 1)
      }
    })

    return assignments
  }

  // Find best defender for an attacker
  private findBestDefender(attacker: GameCard, defenders: GameCard[]): GameCard | null {
    // Find defender that can kill attacker or survive
    const ideal = defenders.find(d =>
      (d.attack || 0) >= (attacker.currentHealth || attacker.health || 0) &&
      (d.currentHealth || d.health || 0) > (attacker.attack || 0)
    )

    if (ideal) return ideal

    // Find defender that can at least kill attacker
    const canKill = defenders.find(d =>
      (d.attack || 0) >= (attacker.currentHealth || attacker.health || 0)
    )

    if (canKill) return canKill

    // Use highest health defender
    return defenders.sort((a, b) =>
      (b.currentHealth || b.health || 0) - (a.currentHealth || a.health || 0)
    )[0]
  }

  // Execute defense assignments
  private executeDefense(gameState: GameState, decision: DefenseDecision): GameState {
    const newState = { ...gameState }

    for (const assignment of decision.assignments) {
      const defender = newState.player2.bench.find(u => u.id === assignment.defenderId)
      if (defender && newState.lanes[assignment.laneId]) {
        newState.lanes[assignment.laneId].defender = { ...defender, position: 'defending' }
      }
    }

    // Move to combat phase
    newState.phase = 'combat'

    console.log(`🛡️ AI defends with ${decision.assignments.length} units (strategy: ${decision.strategy})`)

    return newState
  }

  // Mulligan logic
  private performMulligan(gameState: GameState): GameState {
    return aiService.performMulligan(gameState)
  }

  // Simulate thinking delay
  private async simulateThinking(): Promise<void> {
    const delay = this.currentPersonality.thinkingTime
    const variation = (Math.random() - 0.5) * 500 // ±250ms variation
    await new Promise(resolve => setTimeout(resolve, Math.max(300, delay + variation)))
  }

  // Set AI difficulty
  setDifficulty(level: AILevel): void {
    aiService.setPersonality(level)
    this.currentPersonality = aiService.getCurrentPersonality()
    console.log(`🎮 AI difficulty set to: ${level} - ${this.currentPersonality.name}`)
  }

  // Get current AI info
  getCurrentAI(): AIPersonality {
    return this.currentPersonality
  }

  // Reset AI state
  reset(): void {
    this.decisionHistory = []
    this.turnStartTime = 0
  }
}

// Export singleton instance
export const aiController = new AIControllerService()