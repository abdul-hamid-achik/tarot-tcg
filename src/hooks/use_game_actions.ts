import { useCallback } from 'react'
import type { Card as GameCard } from '@/schemas/schema'
import { aiService } from '@/services/ai_service'
import { animationService } from '@/services/animation_service'
import { combatService } from '@/services/combat_service'
import { gridManagerService } from '@/services/grid_manager_service'
import type { CellPosition } from '@/store/game_store'
import { useGameStore } from '@/store/game_store'

export const useGameActions = () => {
  const { gameState, setGameState, clearAttackers, clearDefenderAssignments, setAnimationState } =
    useGameStore()

  const playCard = useCallback(
    async (card: GameCard, targetPosition?: CellPosition) => {
      if (!gameState) return

      try {
        setAnimationState(true)

        // Validate the move
        const validation = gridManagerService.validateMove(
          card,
          'hand',
          targetPosition || { row: 3, col: 0 },
          gameState,
        )

        if (!validation.valid) {
          console.warn('Invalid card play:', validation.reason)
          return
        }

        // Calculate mana cost and payment
        const totalMana = gameState.player1.mana + gameState.player1.spellMana
        if (card.cost > totalMana) {
          console.warn('Insufficient mana')
          return
        }

        const manaToUse = Math.min(gameState.player1.mana, card.cost)
        const spellManaToUse = Math.max(0, card.cost - manaToUse)

        // Create new game state
        const newGameState = { ...gameState }
        const player = { ...newGameState.player1 }

        // Pay mana cost
        player.mana -= manaToUse
        player.spellMana -= spellManaToUse

        // Remove card from hand
        player.hand = player.hand.filter(c => c.id !== card.id)

        // Add to appropriate position
        if (targetPosition) {
          // Place directly on grid (handled by GridManagerService)
          const cardInstance = { ...card, currentHealth: card.health }
          gridManagerService.setCellContent(targetPosition, cardInstance)
        } else {
          // Add to bench
          if (player.bench.length < 6) {
            const cardInstance = { ...card, currentHealth: card.health, position: 'bench' as const }
            player.bench.push(cardInstance)

            // Register card abilities and trigger enter bench event
            newGameState.player1 = player
            const updatedState = combatService.registerCardAbilities(cardInstance, newGameState)
            setGameState(updatedState)
            return
          }
        }

        newGameState.player1 = player
        setGameState(newGameState)

        // Animate card play if we have DOM elements
        // This would be handled by the calling component with proper element refs
      } catch (error) {
        console.error('Error playing card:', error)
      } finally {
        setAnimationState(false)
      }
    },
    [gameState, setGameState, setAnimationState],
  )

  const declareAttack = useCallback(
    async (attackerIds: string[]) => {
      if (!gameState || !gameState.player1.hasAttackToken) return

      try {
        setAnimationState(true)

        const newGameState = { ...gameState }

        // Clear existing lanes
        newGameState.lanes = newGameState.lanes.map(lane => ({
          ...lane,
          attacker: null,
          defender: null,
        }))

        // Place attackers in lanes
        const attackerArrangements = attackerIds.map((id, index) => ({
          attackerId: id,
          laneId: index,
        }))

        // Animate attackers moving to attack positions
        const animationPromises: Promise<void>[] = []

        attackerArrangements.forEach(({ attackerId, laneId }) => {
          const unit = newGameState.player1.bench.find(u => u.id === attackerId)
          if (unit && laneId < 6) {
            newGameState.lanes[laneId].attacker = { ...unit, position: 'attacking' }

            // Get card element and animate to attack position
            const cardElement = document.querySelector(
              `[data-card-id="${attackerId}"]`,
            ) as HTMLElement
            if (cardElement) {
              const targetPosition: CellPosition = { row: 2, col: laneId as 0 | 1 | 2 | 3 | 4 | 5 }
              animationPromises.push(
                animationService.animateCardMove(
                  cardElement,
                  { row: 3, col: laneId as 0 | 1 | 2 | 3 | 4 | 5 },
                  targetPosition,
                ),
              )
            }
          }
        })

        // Wait for attack animations to complete
        if (animationPromises.length > 0) {
          await Promise.all(animationPromises)
        }

        newGameState.phase = 'declare_defenders' // Now go to defend phase
        newGameState.attackingPlayer = gameState?.activePlayer

        // Switch active player to defender for defend phase
        newGameState.activePlayer = gameState?.activePlayer === 'player1' ? 'player2' : 'player1'

        setGameState(newGameState)
        clearAttackers()
      } catch (error) {
        console.error('Error declaring attack:', error)
      } finally {
        setAnimationState(false)
      }
    },
    [gameState, setGameState, setAnimationState, clearAttackers],
  )

  const declareDefenders = useCallback(
    async (defenderAssignments: { defenderId: string; laneId: number }[]) => {
      if (!gameState || gameState.phase !== 'declare_defenders') return

      try {
        setAnimationState(true)

        const newGameState = { ...gameState }
        const defendingPlayer = gameState?.activePlayer
        const _attackingPlayer = newGameState.attackingPlayer!

        // Animate defenders moving to defense positions
        const animationPromises: Promise<void>[] = []

        defenderAssignments.forEach(({ defenderId, laneId }) => {
          const unit = newGameState[defendingPlayer].bench.find(u => u.id === defenderId)
          if (unit && laneId < 6 && newGameState.lanes[laneId].attacker) {
            newGameState.lanes[laneId].defender = { ...unit, position: 'defending' }

            // Get card element and animate to defend position
            const cardElement = document.querySelector(
              `[data-card-id="${defenderId}"]`,
            ) as HTMLElement
            if (cardElement) {
              const targetPosition: CellPosition = {
                row: defendingPlayer === 'player1' ? 2 : 1,
                col: laneId as 0 | 1 | 2 | 3 | 4 | 5,
              }
              const fromPosition: CellPosition = {
                row: defendingPlayer === 'player1' ? 3 : 0,
                col: laneId as 0 | 1 | 2 | 3 | 4 | 5,
              }
              animationPromises.push(
                animationService.animateCardMove(cardElement, fromPosition, targetPosition),
              )
            }
          }
        })

        // Wait for defense animations to complete
        if (animationPromises.length > 0) {
          await Promise.all(animationPromises)
        }

        newGameState.phase = 'combat'
        setGameState(newGameState)
        clearDefenderAssignments()
      } catch (error) {
        console.error('Error declaring defenders:', error)
      } finally {
        setAnimationState(false)
      }
    },
    [gameState, setGameState, setAnimationState, clearDefenderAssignments],
  )

  const resolveCombat = useCallback(async () => {
    if (!gameState || gameState.phase !== 'combat') return

    try {
      setAnimationState(true)

      // Use the dedicated CombatService for all combat resolution
      const newGameState = await combatService.resolveCombatPhase(gameState)
      setGameState(newGameState)
    } catch (error) {
      console.error('Error resolving combat:', error)
    } finally {
      setAnimationState(false)
    }
  }, [gameState, setGameState, setAnimationState])

  const completeMulligan = useCallback(
    async (selectedCardIds: string[]) => {
      if (!gameState || gameState.phase !== 'mulligan') return

      try {
        setAnimationState(true)

        const newGameState = { ...gameState }
        const player = { ...newGameState.player1 }

        if (selectedCardIds.length > 0) {
          // Shuffle selected cards back into deck
          const cardsToShuffle = player.hand.filter(card => selectedCardIds.includes(card.id))
          const keptCards = player.hand.filter(card => !selectedCardIds.includes(card.id))

          // Add discarded cards back to deck and shuffle
          player.deck = [...player.deck, ...cardsToShuffle]

          // Simple shuffle
          for (let i = player.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[player.deck[i], player.deck[j]] = [player.deck[j], player.deck[i]]
          }

          // Draw replacement cards with reversal chance
          const cardsToDraw = cardsToShuffle.length
          const newCards = player.deck
            .splice(0, cardsToDraw)
            .map(card => combatService.applyDrawReversalChance(card))
          player.hand = [...keptCards, ...newCards]
        }

        player.mulliganComplete = true
        player.selectedForMulligan = []
        newGameState.player1 = player

        // Check if both players completed mulligan
        if (newGameState.player1.mulliganComplete && newGameState.player2.mulliganComplete) {
          newGameState.phase = 'action'
        }

        setGameState(newGameState)
      } catch (error) {
        console.error('Error completing mulligan:', error)
      } finally {
        setAnimationState(false)
      }
    },
    [gameState, setGameState, setAnimationState],
  )

  const reverseCard = useCallback(
    async (cardId: string) => {
      if (!gameState) return

      try {
        setAnimationState(true)

        // Use CombatService to handle reversal with all side effects
        const newGameState = combatService.reverseCard(gameState, cardId)
        setGameState(newGameState)
      } catch (error) {
        console.error('Error reversing card:', error)
      } finally {
        setAnimationState(false)
      }
    },
    [gameState, setGameState, setAnimationState],
  )

  const executeAITurn = useCallback(async () => {
    if (!gameState || gameState.activePlayer !== 'player2') return

    try {
      setAnimationState(true)
      const currentState = { ...gameState }
      const ai = currentState.player2
      const _personality = aiService.getCurrentPersonality()

      // Phase 1: Play cards
      const maxCardsToPlay = Math.min(3, ai.hand.length) // Play up to 3 cards per turn
      let cardsPlayed = 0

      for (let i = 0; i < maxCardsToPlay; i++) {
        const { card, shouldPlay } = aiService.selectCardToPlay(currentState)
        if (card && shouldPlay && ai.bench.length < 6) {
          // Simulate AI playing the card
          const totalMana = ai.mana + ai.spellMana
          if (card.cost <= totalMana) {
            // Calculate mana payment
            const manaToUse = Math.min(ai.mana, card.cost)
            const spellManaToUse = Math.max(0, card.cost - manaToUse)

            // Update AI state
            currentState.player2.mana -= manaToUse
            currentState.player2.spellMana -= spellManaToUse
            currentState.player2.hand = ai.hand.filter(c => c.id !== card.id)

            if (card.type === 'unit') {
              const cardInstance = {
                ...card,
                currentHealth: card.health,
                position: 'bench' as const,
              }
              currentState.player2.bench.push(cardInstance)
              cardsPlayed++
            }
          }
        }
      }

      if (cardsPlayed > 0) {
        console.log(`AI played ${cardsPlayed} card(s)`)
        setGameState(currentState)
        await new Promise(resolve => setTimeout(resolve, 500)) // Small delay between actions
      }

      // Phase 2: Attack if has attack token
      if (ai.hasAttackToken && ai.bench.length > 0) {
        const attackerIds = aiService.selectAttackers(currentState)

        if (attackerIds.length > 0) {
          // Clear lanes first
          currentState.lanes = currentState.lanes.map(lane => ({
            ...lane,
            attacker: null,
            defender: null,
          }))

          // Place attackers in lanes
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
          currentState.activePlayer = 'player1' // Switch to player1 for defense

          console.log(`AI declared attack with ${attackerIds.length} unit(s)`)
          setGameState(currentState)
          return // Let player1 decide defenders
        }
      }

      // Phase 3: End turn if nothing to do
      console.log('AI ending turn')
      await new Promise(resolve => setTimeout(resolve, 500))
      // The turn will be ended by the calling component
    } catch (error) {
      console.error('Error executing AI turn:', error)
    } finally {
      setAnimationState(false)
    }
  }, [gameState, setGameState, setAnimationState])

  const endTurn = useCallback(async () => {
    if (!gameState) return

    try {
      setAnimationState(true)

      const newGameState = { ...gameState }
      const currentPlayer = gameState.activePlayer

      // Store unspent mana as spell mana for current player
      const unspentMana = newGameState[currentPlayer].mana
      newGameState[currentPlayer].spellMana = Math.min(
        3,
        newGameState[currentPlayer].spellMana + unspentMana,
      )

      // Switch active player
      const nextPlayer = currentPlayer === 'player1' ? 'player2' : 'player1'
      newGameState.activePlayer = nextPlayer
      newGameState.turn++

      // Every 2 turns = new round
      if (newGameState.turn % 2 === 1) {
        newGameState.round++

        // Switch attack token
        newGameState.player1.hasAttackToken = !newGameState.player1.hasAttackToken
        newGameState.player2.hasAttackToken = !newGameState.player2.hasAttackToken
      }

      // Refill mana for next player
      const nextPlayerData = newGameState[nextPlayer]
      nextPlayerData.maxMana = Math.min(10, newGameState.round)
      nextPlayerData.mana = nextPlayerData.maxMana

      // Draw a card with reversal chance
      if (nextPlayerData.deck.length > 0) {
        const drawnCard = nextPlayerData.deck.shift()!
        // Apply reversal chance when drawing (fundamental tarot mechanic)
        const processedCard = combatService.applyDrawReversalChance(drawnCard)
        nextPlayerData.hand.push(processedCard)

        if (processedCard.isReversed) {
          console.log(`${processedCard.name} was drawn reversed!`)
        }
      }

      newGameState.phase = 'action'
      newGameState.combatResolved = false

      // Process end-of-turn effects and triggered abilities
      const finalState = combatService.processEndOfTurnEffects(newGameState)

      // Clear interaction states
      clearAttackers()
      clearDefenderAssignments()

      // If switching to AI player, execute AI turn after a delay
      if (nextPlayer === 'player2') {
        setGameState(finalState)
        setTimeout(() => {
          executeAITurn()
        }, aiService.getCurrentPersonality().thinkingTime)
      } else {
        setGameState(finalState)
      }
    } catch (error) {
      console.error('Error ending turn:', error)
    } finally {
      setAnimationState(false)
    }
  }, [
    gameState,
    setGameState,
    setAnimationState,
    clearAttackers,
    clearDefenderAssignments,
    executeAITurn,
  ])

  return {
    playCard,
    declareAttack,
    declareDefenders,
    endTurn,
    resolveCombat,
    completeMulligan,
    reverseCard,
    executeAITurn,
  }
}
