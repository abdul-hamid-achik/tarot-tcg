import { useCallback } from 'react'
import type { Card as GameCard } from '@/schemas/schema'
import { animationService } from '@/services/animation_service'
import { combatService } from '@/services/combat_service'
import type { BattlefieldPosition } from '@/services/battlefield_service'
import { battlefieldService } from '@/services/battlefield_service'
import { useGameStore } from '@/store/game_store'

export const useGameActions = () => {
  const {
    gameState,
    setGameState,
    interaction,
    clearAttackers,
    setAnimationState,
    updateBattlefield,
  } = useGameStore()

  const playCard = useCallback(
    async (card: GameCard, targetPosition?: BattlefieldPosition) => {
      if (!gameState) return

      try {
        setAnimationState(true)

        // Basic validation
        if (targetPosition) {
          // Check if position is valid (slots 0-6)
          if (!battlefieldService.isSlotEmpty(gameState.battlefield, targetPosition.player, targetPosition.slot)) {
            console.warn('Battlefield slot is occupied')
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
        console.log(`🎮 [PlayCard] Card: ${card.name}, Type: ${card.type}, Target:`, targetPosition)

        if (card.type === 'unit' && targetPosition) {
          console.log(`🎮 [PlayCard] Placing unit ${card.name} on battlefield`)
          // Place unit on battlefield - directly modify the game state battlefield
          const newBattlefield = battlefieldService.placeUnit(
            newGameState.battlefield,
            card,
            targetPosition.player,
            targetPosition.slot
          )
          newGameState.battlefield = newBattlefield

          // Animate card placement
          await animationService.animateCardPlay(card, targetPosition)
        } else if (card.type === 'spell') {
          console.log(`🎮 [PlayCard] Playing spell ${card.name}`)
          // Handle spell card
          console.log('Spell played:', card.name)
          // Spell effects would be handled here
        } else {
          console.log(`🎮 [PlayCard] Unknown card type or missing target for ${card.name}`)
        }

        // Update game state
        newGameState.player1 = player
        setGameState(newGameState)

        // Trigger card played event
        await combatService.triggerEvent('card_played', {
          gameState: newGameState,
          triggerCard: card,
          player: 'player1',
        })
      } finally {
        setAnimationState(false)
      }
    },
    [gameState, setGameState, setAnimationState],
  )

  const declareAttack = useCallback(
    async (attackerIds: string[]) => {
      if (!gameState || attackerIds.length === 0) return

      try {
        setAnimationState(true)

        // Validate attackers are on battlefield
        const validAttackers = attackerIds.filter(
          id => battlefieldService.findUnitPosition(gameState.battlefield, id) !== null,
        )

        if (validAttackers.length === 0) {
          console.warn('No valid attackers on battlefield')
          return
        }

        // Update game state to attack declaration phase
        const newGameState = {
          ...gameState,
          phase: 'attack_declaration' as const,
        }

        setGameState(newGameState)

        // Animation for attack declaration
        for (const attackerId of validAttackers) {
          const position = battlefieldService.findUnitPosition(gameState.battlefield, attackerId)
          if (position) {
            await animationService.highlightSlot(position, 'valid')
          }
        }
      } finally {
        setAnimationState(false)
      }
    },
    [gameState, setGameState, setAnimationState],
  )

  // Hearthstone-style direct attack - choose target and attack immediately
  const attackTarget = useCallback(
    async (attackerId: string, target: BattlefieldPosition | 'nexus') => {
      if (!gameState) return

      try {
        setAnimationState(true)

        const attackerPosition = battlefieldService.findUnitPosition(gameState.battlefield, attackerId)
        if (!attackerPosition) {
          console.warn('Attacker not found on battlefield')
          return
        }

        // Process the attack through combat service
        const result = await combatService.processAttack(
          gameState.battlefield,
          attackerPosition,
          target,
          gameState
        )

        // Apply combat results to game state
        const newGameState = { ...gameState }

        if (target === 'nexus') {
          // Damage enemy nexus
          newGameState.player2.health -= result.nexusDamage
        } else {
          // Update battlefield with damage/deaths
          const targetUnit = battlefieldService.getUnit(gameState.battlefield, target.player, target.slot)
          if (targetUnit && targetUnit.currentHealth) {
            targetUnit.currentHealth -= result.targetDamage
            if (targetUnit.currentHealth <= 0) {
              // Remove dead unit
              const newBattlefield = battlefieldService.removeUnit(gameState.battlefield, target.player, target.slot)
              newGameState.battlefield = newBattlefield
            }
          }
        }

        setGameState(newGameState)
        clearAttackers()
      } finally {
        setAnimationState(false)
      }
    },
    [gameState, setGameState, clearAttackers, setAnimationState]
  )

  const completeMulligan = useCallback(
    async (selectedCardIds: string[]) => {
      if (!gameState) return

      try {
        setAnimationState(true)

        const newGameState = { ...gameState }
        const player = { ...newGameState.player1 }

        // Mark mulligan as complete
        player.mulliganComplete = true
        player.selectedForMulligan = []

        // Replace selected cards
        const keptCards = player.hand.filter(c => !selectedCardIds.includes(c.id))
        const mulliganedCards = player.hand.filter(c => selectedCardIds.includes(c.id))

        // Put mulliganed cards back in deck
        player.deck = [...player.deck, ...mulliganedCards]

        // Draw new cards
        const newCards = player.deck.slice(0, selectedCardIds.length)
        player.deck = player.deck.slice(selectedCardIds.length)

        // Update hand
        player.hand = [...keptCards, ...newCards]

        // Update game state
        newGameState.player1 = player

        // Check if both players completed mulligan
        if (newGameState.player2.mulliganComplete) {
          newGameState.phase = 'round_start'
        }

        setGameState(newGameState)
      } finally {
        setAnimationState(false)
      }
    },
    [gameState, setGameState, setAnimationState],
  )

  const reverseCard = useCallback(
    async (cardId: string) => {
      if (!gameState) return

      const position = battlefieldService.findUnitPosition(gameState.battlefield, cardId)
      if (!position) {
        console.warn('Card not on battlefield')
        return
      }

      const card = battlefieldService.getUnit(gameState.battlefield, position.player, position.slot)
      if (!card) return

      // Toggle reversed state
      const updatedCard = {
        ...card,
        isReversed: !card.isReversed,
      }

      // Update card on battlefield
      const newBattlefield = battlefieldService.placeUnit(
        battlefieldService.removeUnit(gameState.battlefield, position.player, position.slot),
        updatedCard,
        position.player,
        position.slot
      )

      const newGameState = { ...gameState, battlefield: newBattlefield }
      setGameState(newGameState)

      // Animate card reverse
      await animationService.animateCardReverse(updatedCard)

      // Trigger event
      await combatService.triggerEvent(
        updatedCard.isReversed ? 'card_reversed' : 'card_uprighted',
        {
          gameState: newGameState,
          triggerCard: updatedCard,
        },
      )
    },
    [gameState, setGameState],
  )

  const endTurn = useCallback(async () => {
    if (!gameState) return

    try {
      const { endTurn: endTurnLogic } = await import('@/lib/game_logic')
      const newGameState = await endTurnLogic(gameState)
      setGameState(newGameState)
    } catch (error) {
      console.error('Error ending turn:', error)
    }
  }, [gameState, setGameState])

  // Legacy compatibility stubs (deprecated)
  const declareDefenders = useCallback(() => {
    console.warn('declareDefenders is deprecated in Hearthstone-style system')
  }, [])

  const resolveCombat = useCallback(() => {
    console.warn('resolveCombat is deprecated in Hearthstone-style system')
  }, [])

  return {
    playCard,
    declareAttack,
    attackTarget,
    completeMulligan,
    reverseCard,
    endTurn,
    declareDefenders,
    resolveCombat,
  }
}