import { useCallback } from 'react'
import type { Card, GameState } from '@/schemas/schema'
import { combatService } from '@/services/combat_service'
import { phaseManager } from '@/services/phase_manager_service'
import { stateManager } from '@/services/state_manager'
// import type { CellPosition } from '@/store/game_store' // Deprecated for battlefield system
import { useGameStore } from '@/store/game_store'

/**
 * Improved game actions with proper phase management and state management
 */
export function useImprovedGameActions() {
  const { gameState, setGameState, setAnimationState } = useGameStore()

  /**
   * Pass priority to the other player (LoR-style)
   */
  const passPriority = useCallback(() => {
    if (!gameState) return

    const newGameState = phaseManager.passPriority(gameState)
    stateManager.initialize(newGameState)
    setGameState(newGameState)
  }, [gameState, setGameState])

  /**
   * Play a card with proper priority and phase checking
   */
  const playCard = useCallback(
    async (card: Card, targetPosition?: any) => { // TODO: Update for battlefield system
      if (!gameState || !phaseManager.canTakeAction(gameState, 'player1')) {
        console.warn('Cannot play card - no priority or wrong phase')
        return
      }

      try {
        setAnimationState(true)

        // Validate mana cost
        const totalMana = gameState.player1.mana + gameState.player1.spellMana
        if (card.cost > totalMana) {
          console.warn('Insufficient mana')
          return
        }

        // Calculate mana payment
        const manaToUse = Math.min(gameState.player1.mana, card.cost)
        const spellManaToUse = Math.max(0, card.cost - manaToUse)

        // Action taken - reset pass count and switch priority
        const newGameState = phaseManager.actionTaken(gameState)

        // Pay mana
        newGameState.player1.mana -= manaToUse
        newGameState.player1.spellMana -= spellManaToUse

        // Initialize state manager
        stateManager.initialize(newGameState)

        // Use state manager to play the card
        const success = stateManager.playCardFromHand(card.id, targetPosition)
        if (!success) {
          console.error('Failed to play card via state manager')
          return
        }

        // Get updated state from manager
        const finalState = stateManager.getGameState()
        if (finalState) {
          // Register card abilities if it's a unit
          // TODO: Update for new battlefield system
          // if (card.type === 'unit') {
          //   const updatedState = combatService.registerCardAbilities(card, finalState)
          //   setGameState(updatedState)
          // } else {
            setGameState(finalState)
          // }
        }
      } catch (error) {
        console.error('Error playing card:', error)
      } finally {
        setAnimationState(false)
      }
    },
    [gameState, setGameState, setAnimationState],
  )

  /**
   * Declare attack with proper phase transition
   */
  const declareAttack = useCallback(
    async (attackerIds: string[]) => {
      if (!gameState || !gameState.player1.hasAttackToken) return

      try {
        setAnimationState(true)

        // Transition to attack declaration phase
        let newGameState = phaseManager.transitionTo(gameState, 'attack_declaration')
        if (!newGameState) {
          console.error('Cannot transition to attack declaration')
          return
        }

        // Initialize state manager
        stateManager.initialize(newGameState)

        // TODO: Update for battlefield system - lanes no longer exist
        // // Clear lanes and set attackers
        // newGameState.lanes = newGameState.lanes.map(lane => ({
        //   ...lane,
        //   attacker: null,
        //   defender: null,
        // }))

        // // Place attackers in lanes
        // attackerIds.forEach((attackerId, index) => {
        //   const unit = newGameState.player1.bench.find(u => u.id === attackerId)
        //   if (unit && index < 6) {
        //     newGameState.lanes[index].attacker = { ...unit, position: 'attacking' }
        //   }
        // })

        console.warn('declareAttackers function needs update for battlefield system')

        // Transition to defense declaration
        newGameState =
          phaseManager.transitionTo(newGameState, 'defense_declaration') || newGameState

        setGameState(newGameState)
      } catch (error) {
        console.error('Error declaring attack:', error)
      } finally {
        setAnimationState(false)
      }
    },
    [gameState, setGameState, setAnimationState],
  )

  /**
   * Declare defenders with proper phase transition
   */
  const declareDefenders = useCallback(
    async (defenderAssignments: { defenderId: string; laneId: number }[]) => {
      if (!gameState || gameState.phase !== 'defense_declaration') return

      try {
        setAnimationState(true)

        const newGameState = { ...gameState }
        const defendingPlayer = gameState.activePlayer === 'player1' ? 'player2' : 'player1'

        // TODO: Update for battlefield system - lanes no longer exist
        // // Clear existing defenders
        // newGameState.lanes = newGameState.lanes.map(lane => ({ ...lane, defender: null }))

        // // Assign defenders
        // defenderAssignments.forEach(({ defenderId, laneId }) => {
        //   const unit = newGameState[defendingPlayer].bench.find(u => u.id === defenderId)
        //   if (unit && laneId < 6 && newGameState.lanes[laneId].attacker) {
        //     newGameState.lanes[laneId].defender = { ...unit, position: 'defending' }
        //   }
        // })

        console.warn('declareDefenders function needs update for battlefield system')

        // Transition to combat resolution
        const combatState = phaseManager.transitionTo(newGameState, 'combat_resolution')
        if (combatState) {
          setGameState(combatState)
        }
      } catch (error) {
        console.error('Error declaring defenders:', error)
      } finally {
        setAnimationState(false)
      }
    },
    [gameState, setGameState, setAnimationState],
  )

  /**
   * Resolve combat with proper phase transition
   */
  const resolveCombat = useCallback(async () => {
    if (!gameState || gameState.phase !== 'combat_resolution') return

    try {
      setAnimationState(true)

      // TODO: Update for battlefield system - combat is resolved immediately
      // // Use combat service for resolution
      // let newGameState = await combatService.resolveCombatPhase(gameState)

      // // Transition back to action phase
      // newGameState = phaseManager.transitionTo(newGameState, 'action') || newGameState

      console.warn('resolveCombat function needs update for battlefield system')
      let newGameState = gameState

      // Initialize state manager to sync everything
      stateManager.initialize(newGameState)

      setGameState(newGameState)
    } catch (error) {
      console.error('Error resolving combat:', error)
    } finally {
      setAnimationState(false)
    }
  }, [gameState, setGameState, setAnimationState])

  /**
   * End turn/round with proper phase transitions
   */
  const endTurn = useCallback(async () => {
    if (!gameState) return

    try {
      setAnimationState(true)

      let newGameState = { ...gameState }

      // Store unspent mana as spell mana
      const currentPlayer = gameState.activePlayer
      const unspentMana = newGameState[currentPlayer].mana
      newGameState[currentPlayer].spellMana = Math.min(
        3,
        newGameState[currentPlayer].spellMana + unspentMana,
      )

      // Check if we should end the round
      if (gameState.passCount >= 1) {
        // Try to transition to end round
        const endRoundState = phaseManager.transitionTo(newGameState, 'end_round')
        if (endRoundState) {
          // Then transition to new round
          const newRoundState = phaseManager.transitionTo(endRoundState, 'round_start')
          if (newRoundState) {
            // Refill mana and draw cards
            const nextPlayer = currentPlayer === 'player1' ? 'player2' : 'player1'
            newRoundState[nextPlayer].maxMana = Math.min(10, newRoundState.round)
            newRoundState[nextPlayer].mana = newRoundState[nextPlayer].maxMana

            // Draw card using state manager
            stateManager.initialize(newRoundState)
            const drawnCard = stateManager.drawCard(nextPlayer)
            if (drawnCard) {
              console.log(`${nextPlayer} draws ${drawnCard.name}`)
            }

            // Switch active player
            newRoundState.activePlayer = nextPlayer

            // Transition to action phase
            const actionState = phaseManager.transitionTo(newRoundState, 'action')
            if (actionState) {
              setGameState(actionState)
              return
            }
          }
        }
      }

      // Just pass priority
      newGameState = phaseManager.passPriority(newGameState)
      setGameState(newGameState)
    } catch (error) {
      console.error('Error ending turn:', error)
    } finally {
      setAnimationState(false)
    }
  }, [gameState, setGameState, setAnimationState])

  /**
   * Complete mulligan with phase transition
   */
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

          player.deck = [...player.deck, ...cardsToShuffle]

          // Shuffle deck
          for (let i = player.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[player.deck[i], player.deck[j]] = [player.deck[j], player.deck[i]]
          }

          // Draw replacement cards
          const cardsToDraw = cardsToShuffle.length
          const newCards = player.deck
            .splice(0, cardsToDraw)
            // TODO: Update for battlefield system
            // .map(card => combatService.applyDrawReversalChance(card))
          player.hand = [...keptCards, ...newCards]
        }

        player.mulliganComplete = true
        newGameState.player1 = player

        // Try to transition to round start if both players done
        if (newGameState.player2.mulliganComplete) {
          const roundStartState = phaseManager.transitionTo(newGameState, 'round_start')
          if (roundStartState) {
            const actionState = phaseManager.transitionTo(roundStartState, 'action')
            if (actionState) {
              stateManager.initialize(actionState)
              setGameState(actionState)
              return
            }
          }
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

  /**
   * Get current phase information for UI
   */
  const getPhaseInfo = useCallback(() => {
    if (!gameState) return null

    return {
      phase: gameState.phase,
      description: phaseManager.getPhaseDescription(gameState),
      canAct: phaseManager.canTakeAction(gameState, 'player1'),
      validTransitions: phaseManager.getValidTransitions(gameState),
      priorityPlayer: gameState.priorityPlayer || gameState.activePlayer,
      passCount: gameState.passCount || 0,
    }
  }, [gameState])

  return {
    playCard,
    declareAttack,
    declareDefenders,
    resolveCombat,
    endTurn,
    completeMulligan,
    passPriority,
    getPhaseInfo,
  }
}
