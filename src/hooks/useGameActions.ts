import { useCallback } from 'react'
import { useGameStore } from '@/store/gameStore'
import { gridManagerService } from '@/services/GridManagerService'
import type { Card as GameCard } from '@/types/game'
import type { CellPosition } from '@/store/gameStore'

export const useGameActions = () => {
    const {
        gameState,
        setGameState,
        clearAttackers,
        clearDefenderAssignments,
        setAnimationState
    } = useGameStore()

    const playCard = useCallback(async (card: GameCard, targetPosition?: CellPosition) => {
        if (!gameState) return

        try {
            setAnimationState(true)

            // Validate the move
            const validation = gridManagerService.validateMove(card, 'hand', targetPosition || { row: 3, col: 0 }, gameState)

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
                gridManagerService.setCellContent(targetPosition, { ...card, currentHealth: card.health })
            } else {
                // Add to bench
                if (player.bench.length < 6) {
                    player.bench.push({ ...card, currentHealth: card.health, position: 'bench' })
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
    }, [gameState, setGameState, setAnimationState])

    const declareAttack = useCallback(async (attackerIds: string[]) => {
        if (!gameState || !gameState.player1.hasAttackToken) return

        try {
            setAnimationState(true)

            const newGameState = { ...gameState }

            // Clear existing lanes
            newGameState.lanes = newGameState.lanes.map(lane => ({
                ...lane,
                attacker: null,
                defender: null
            }))

            // Place attackers in lanes
            const attackerArrangements = attackerIds.map((id, index) => ({ attackerId: id, laneId: index }))

            attackerArrangements.forEach(({ attackerId, laneId }) => {
                const unit = newGameState.player1.bench.find(u => u.id === attackerId)
                if (unit && laneId < 6) {
                    newGameState.lanes[laneId].attacker = { ...unit, position: 'attacking' }
                }
            })

            newGameState.phase = 'combat' // Skip declare_defenders phase for simplified flow
            newGameState.attackingPlayer = 'player1'

            setGameState(newGameState)
            clearAttackers()

            // Animate attackers moving to combat positions
            // This would be handled by the calling component

        } catch (error) {
            console.error('Error declaring attack:', error)
        } finally {
            setAnimationState(false)
        }
    }, [gameState, setGameState, setAnimationState, clearAttackers])

    const endTurn = useCallback(async () => {
        if (!gameState) return

        try {
            setAnimationState(true)

            const newGameState = { ...gameState }

            // Store unspent mana as spell mana
            const unspentMana = newGameState.player1.mana
            newGameState.player1.spellMana = Math.min(3, newGameState.player1.spellMana + unspentMana)

            // Switch active player
            const nextPlayer = gameState.activePlayer === 'player1' ? 'player2' : 'player1'
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
            const currentPlayer = newGameState[nextPlayer]
            currentPlayer.maxMana = Math.min(10, newGameState.round)
            currentPlayer.mana = currentPlayer.maxMana

            // Draw a card
            if (currentPlayer.deck.length > 0) {
                const drawnCard = currentPlayer.deck.shift()!
                currentPlayer.hand.push(drawnCard)
            }

            newGameState.phase = 'action'
            newGameState.combatResolved = false

            setGameState(newGameState)

            // Clear interaction states
            clearAttackers()
            clearDefenderAssignments()

        } catch (error) {
            console.error('Error ending turn:', error)
        } finally {
            setAnimationState(false)
        }
    }, [gameState, setGameState, setAnimationState, clearAttackers, clearDefenderAssignments])

    const resolveCombat = useCallback(async () => {
        if (!gameState || gameState.phase !== 'combat') return

        try {
            setAnimationState(true)

            const newGameState = { ...gameState }
            const attackingPlayer = newGameState.attackingPlayer!
            const defendingPlayer = attackingPlayer === 'player1' ? 'player2' : 'player1'

            // Resolve combat lane by lane
            newGameState.lanes.forEach((lane) => {
                if (lane.attacker) {
                    if (lane.defender) {
                        // Unit vs Unit combat
                        const attackerNewHealth = (lane.attacker.currentHealth || lane.attacker.health) - lane.defender.attack
                        const defenderNewHealth = (lane.defender.currentHealth || lane.defender.health) - lane.attacker.attack

                        // Remove dead units
                        if (attackerNewHealth <= 0) {
                            newGameState[attackingPlayer].bench = newGameState[attackingPlayer].bench.filter(
                                u => u.id !== lane.attacker!.id
                            )
                        } else {
                            const benchUnit = newGameState[attackingPlayer].bench.find(u => u.id === lane.attacker!.id)
                            if (benchUnit) benchUnit.currentHealth = attackerNewHealth
                        }

                        if (defenderNewHealth <= 0) {
                            newGameState[defendingPlayer].bench = newGameState[defendingPlayer].bench.filter(
                                u => u.id !== lane.defender!.id
                            )
                        } else {
                            const benchUnit = newGameState[defendingPlayer].bench.find(u => u.id === lane.defender!.id)
                            if (benchUnit) benchUnit.currentHealth = defenderNewHealth
                        }
                    } else {
                        // Direct nexus damage
                        newGameState[defendingPlayer].health -= lane.attacker.attack
                    }
                }
            })

            // Clear lanes
            newGameState.lanes = newGameState.lanes.map(lane => ({
                ...lane,
                attacker: null,
                defender: null
            }))

            newGameState.combatResolved = true
            newGameState.phase = 'action'
            newGameState.attackingPlayer = null

            setGameState(newGameState)

            // Animate combat resolution
            // This would be handled by the calling component

        } catch (error) {
            console.error('Error resolving combat:', error)
        } finally {
            setAnimationState(false)
        }
    }, [gameState, setGameState, setAnimationState])

    const completeMulligan = useCallback(async (selectedCardIds: string[]) => {
        if (!gameState || gameState.phase !== 'mulligan') return

        try {
            setAnimationState(true)

            const newGameState = { ...gameState }
            const player = { ...newGameState.player1 }

            if (selectedCardIds.length > 0) {
                // Shuffle selected cards back into deck
                const cardsToShuffle = player.hand.filter(card =>
                    selectedCardIds.includes(card.id)
                )
                const keptCards = player.hand.filter(card =>
                    !selectedCardIds.includes(card.id)
                )

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
    }, [gameState, setGameState, setAnimationState])

    return {
        playCard,
        declareAttack,
        endTurn,
        resolveCombat,
        completeMulligan
    }
}
