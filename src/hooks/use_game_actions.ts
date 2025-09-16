import { useCallback } from 'react'
import type { Card as GameCard } from '@/schemas/schema'
import { animationService } from '@/services/animation_service'
import { combatService } from '@/services/combat_service'
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

        // Basic validation
        if (targetPosition) {
          // Check if position is valid (0-3 rows, 0-5 cols)
          if (targetPosition.row < 0 || targetPosition.row > 3 ||
              targetPosition.col < 0 || targetPosition.col > 5) {
            console.warn('Invalid grid position')
            return
          }
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

        // Handle different card types
        if (card.type === 'spell') {
          // Spells are cast immediately and go to graveyard
          console.log(`Casting spell: ${card.name}`)

          // Execute spell effect here (TODO: implement spell effect system)
          // For now, just move to graveyard
          if (!player.graveyard) {
            player.graveyard = []
          }
          player.graveyard.push(card)

          newGameState.player1 = player
          setGameState(newGameState)
        } else {
          // Units go to bench or grid position
          if (targetPosition) {
            // Place directly on grid
            const cardInstance = { ...card, currentHealth: card.health, position: 'bench' as const }

            // Add to bench array
            player.bench.push(cardInstance)

            // Update player state and register card
            newGameState.player1 = player
            const updatedState = combatService.registerCardAbilities(cardInstance, newGameState)
            setGameState(updatedState)
          } else {
            // Add to bench
            if (player.bench.length < 6) {
              const cardInstance = { ...card, currentHealth: card.health, position: 'bench' as const }
              player.bench.push(cardInstance)

              // Card added to bench array

              // Register card abilities and trigger enter bench event
              newGameState.player1 = player
              const updatedState = combatService.registerCardAbilities(cardInstance, newGameState)
              setGameState(updatedState)
            } else {
              console.warn('Bench is full, cannot play card')
              // Update game state to reflect mana cost but card couldn't be placed
              newGameState.player1 = player
              setGameState(newGameState)
            }
          }
        }

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

      // Set the game state - AI turn will be handled by AI controller
      setGameState(finalState)
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
  ])

  return {
    playCard,
    declareAttack,
    declareDefenders,
    endTurn,
    resolveCombat,
    completeMulligan,
    reverseCard,
  }
}
