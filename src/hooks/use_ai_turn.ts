import { useCallback, useEffect } from 'react'
import type { GameState } from '@/schemas/schema'
import { aiService } from '@/services/ai_service'
import { useGameStore } from '@/store/game_store'

/**
 * @deprecated Use useAIController instead for unified AI behavior
 * This hook is kept for backward compatibility but should not be used in new code
 */
export const useAITurn = () => {
  const { gameState, setGameState } = useGameStore()

  // AI card playing logic
  const executeAICardPlay = useCallback((state: GameState): GameState => {
    const currentState = { ...state }
    const ai = currentState.player2
    const maxCardsToPlay = Math.min(3, ai.hand.length)
    let cardsPlayed = 0

    for (let i = 0; i < maxCardsToPlay; i++) {
      const { card, shouldPlay } = aiService.selectCardToPlay(currentState)
      if (card && shouldPlay && ai.bench.length < 6) {
        const totalMana = ai.mana + ai.spellMana
        if (card.cost <= totalMana) {
          const manaToUse = Math.min(ai.mana, card.cost)
          const spellManaToUse = Math.max(0, card.cost - manaToUse)

          currentState.player2.mana -= manaToUse
          currentState.player2.spellMana -= spellManaToUse
          currentState.player2.hand = currentState.player2.hand.filter(c => c.id !== card.id)

          if (card.type === 'unit') {
            const cardInstance = { ...card, currentHealth: card.health, position: 'bench' as const }
            currentState.player2.bench.push(cardInstance)
            cardsPlayed++
          }
        }
      }
    }

    if (cardsPlayed > 0) {
      console.log(`AI played ${cardsPlayed} card(s)`)
    }

    return currentState
  }, [])

  // AI attack logic
  const executeAIAttack = useCallback((state: GameState): GameState | null => {
    const ai = state.player2

    if (!ai.hasAttackToken || ai.bench.length === 0) {
      return null
    }

    const attackerIds = aiService.selectAttackers(state)

    if (attackerIds.length === 0) {
      return null
    }

    const currentState = { ...state }

    // Clear lanes
    currentState.lanes = currentState.lanes.map(lane => ({
      ...lane,
      attacker: null,
      defender: null,
    }))

    // Place attackers
    attackerIds.forEach((attackerId, index) => {
      if (index < 6) {
        const unit = currentState.player2.bench.find(u => u.id === attackerId)
        if (unit) {
          currentState.lanes[index].attacker = { ...unit, position: 'attacking' }
        }
      }
    })

    currentState.phase = 'declare_defenders'
    currentState.attackingPlayer = 'player2'
    currentState.activePlayer = 'player1'

    console.log(`AI declared attack with ${attackerIds.length} unit(s)`)
    return currentState
  }, [])

  // AI defender logic
  const executeAIDefense = useCallback(
    (state: GameState): { defenderId: string; laneId: number }[] => {
      const defenderAssignments: { defenderId: string; laneId: number }[] = []
      const availableDefenders = [...state.player2.bench]

      // Simple defensive strategy
      state.lanes.forEach((lane, index) => {
        if (lane.attacker && availableDefenders.length > 0) {
          const defender = availableDefenders.sort((a, b) => {
            const aCanSurvive = (a.currentHealth || a.health) > lane.attacker?.attack
            const bCanSurvive = (b.currentHealth || b.health) > lane.attacker?.attack
            if (aCanSurvive && !bCanSurvive) return -1
            if (!aCanSurvive && bCanSurvive) return 1
            return (b.currentHealth || b.health) - (a.currentHealth || a.health)
          })[0]

          if (defender) {
            defenderAssignments.push({
              defenderId: defender.id,
              laneId: index,
            })
            const idx = availableDefenders.findIndex(d => d.id === defender.id)
            if (idx > -1) availableDefenders.splice(idx, 1)
          }
        }
      })

      return defenderAssignments
    },
    [],
  )

  // Main AI turn execution
  const executeFullAITurn = useCallback(async () => {
    if (!gameState || gameState.activePlayer !== 'player2') return

    const personality = aiService.getCurrentPersonality()

    // Small delay to simulate thinking
    await new Promise(resolve => setTimeout(resolve, personality.thinkingTime))

    // Phase 1: Play cards
    const currentState = executeAICardPlay(gameState)
    setGameState(currentState)

    // Small delay between actions
    await new Promise(resolve => setTimeout(resolve, 500))

    // Phase 2: Attack if possible
    const attackState = executeAIAttack(currentState)
    if (attackState) {
      setGameState(attackState)
      // After attacking, control passes to player1 for defense
      return
    }

    // Phase 3: End turn if no attack
    console.log('AI ending turn')
    // The calling component should handle ending the turn
  }, [gameState, setGameState, executeAICardPlay, executeAIAttack])

  // Auto-execute AI turns - DISABLED to prevent conflicts with tutorial page
  // The tutorial page has its own AI logic in performEnhancedAITurn
  useEffect(() => {
    if (!gameState) return

    // Disabled automatic execution - let the page component control AI turns
    // if (gameState.activePlayer === 'player2' && gameState.phase === 'action') {
    //   executeFullAITurn()
    // }

    // Execute AI defense when needed
    if (
      gameState.phase === 'declare_defenders' &&
      gameState.activePlayer === 'player2' &&
      gameState.attackingPlayer === 'player1'
    ) {
      const personality = aiService.getCurrentPersonality()
      setTimeout(() => {
        const defenderAssignments = executeAIDefense(gameState)
        console.log(`AI assigning ${defenderAssignments.length} defender(s)`)
        // This will trigger the declareDefenders action
        // Connected in GameBoard
      }, personality.thinkingTime)
    }

    // Handle AI mulligan
    if (
      gameState.phase === 'mulligan' &&
      !gameState.player2.mulliganComplete &&
      gameState.player1.mulliganComplete
    ) {
      const personality = aiService.getCurrentPersonality()
      setTimeout(() => {
        const newState = aiService.performMulligan(gameState)
        setGameState(newState)
      }, personality.thinkingTime)
    }
  }, [gameState, setGameState, executeFullAITurn, executeAIDefense])

  return {
    executeFullAITurn,
    executeAICardPlay,
    executeAIAttack,
    executeAIDefense,
  }
}
