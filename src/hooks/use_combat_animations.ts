import { useEffect, useRef, useState } from 'react'
import type { GameState } from '@/schemas/schema'

interface AnimationEvent {
  type: 'attack' | 'damage' | 'death' | 'play'
  slotPlayer: 'player1' | 'player2'
  slotIndex: number
  value?: number
  id: string
}

/**
 * Tracks game state diffs and produces animation events for the battlefield.
 * Returns active animations keyed by "player-slot" for the slot component to consume.
 */
export function useCombatAnimations(gameState: GameState | null) {
  const prevStateRef = useRef<GameState | null>(null)
  const [animations, setAnimations] = useState<Map<string, AnimationEvent>>(new Map())

  useEffect(() => {
    if (!gameState || !prevStateRef.current) {
      prevStateRef.current = gameState
      return
    }

    const prev = prevStateRef.current
    const curr = gameState
    const newAnimations: AnimationEvent[] = []

    // Detect units taking damage on player side
    for (let i = 0; i < 7; i++) {
      const prevUnit = prev.battlefield.playerUnits[i]
      const currUnit = curr.battlefield.playerUnits[i]

      if (prevUnit && currUnit) {
        const prevHp = prevUnit.currentHealth ?? prevUnit.health
        const currHp = currUnit.currentHealth ?? currUnit.health
        if (currHp < prevHp) {
          newAnimations.push({
            type: 'damage',
            slotPlayer: 'player1',
            slotIndex: i,
            value: prevHp - currHp,
            id: `dmg-p1-${i}-${Date.now()}`,
          })
        }
      }

      // Detect unit death (was there, now null)
      if (prevUnit && !currUnit) {
        newAnimations.push({
          type: 'death',
          slotPlayer: 'player1',
          slotIndex: i,
          id: `death-p1-${i}-${Date.now()}`,
        })
      }

      // Detect unit played (was null, now there)
      if (!prevUnit && currUnit) {
        newAnimations.push({
          type: 'play',
          slotPlayer: 'player1',
          slotIndex: i,
          id: `play-p1-${i}-${Date.now()}`,
        })
      }
    }

    // Detect units taking damage on enemy side
    for (let i = 0; i < 7; i++) {
      const prevUnit = prev.battlefield.enemyUnits[i]
      const currUnit = curr.battlefield.enemyUnits[i]

      if (prevUnit && currUnit) {
        const prevHp = prevUnit.currentHealth ?? prevUnit.health
        const currHp = currUnit.currentHealth ?? currUnit.health
        if (currHp < prevHp) {
          newAnimations.push({
            type: 'damage',
            slotPlayer: 'player2',
            slotIndex: i,
            value: prevHp - currHp,
            id: `dmg-p2-${i}-${Date.now()}`,
          })
        }
      }

      if (prevUnit && !currUnit) {
        newAnimations.push({
          type: 'death',
          slotPlayer: 'player2',
          slotIndex: i,
          id: `death-p2-${i}-${Date.now()}`,
        })
      }

      if (!prevUnit && currUnit) {
        newAnimations.push({
          type: 'play',
          slotPlayer: 'player2',
          slotIndex: i,
          id: `play-p2-${i}-${Date.now()}`,
        })
      }
    }

    if (newAnimations.length > 0) {
      setAnimations(prev => {
        const next = new Map(prev)
        for (const anim of newAnimations) {
          next.set(`${anim.slotPlayer}-${anim.slotIndex}`, anim)
        }
        return next
      })

      // Clear animations after they complete
      const timer = setTimeout(() => {
        setAnimations(prev => {
          const next = new Map(prev)
          for (const anim of newAnimations) {
            next.delete(`${anim.slotPlayer}-${anim.slotIndex}`)
          }
          return next
        })
      }, 600)

      prevStateRef.current = gameState
      return () => clearTimeout(timer)
    }

    prevStateRef.current = gameState
  }, [gameState])

  return animations
}
