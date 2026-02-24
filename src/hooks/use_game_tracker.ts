import { useCallback, useEffect, useRef } from 'react'
import type { GameState } from '@/schemas/schema'
import type { AchievementProgress, GameRecord } from '@/schemas/stats_schema'
import { achievementService } from '@/services/achievement_service'
import { questService } from '@/services/quest_service'
import { extractBaseCardId, statsService } from '@/services/stats_service'

interface GameTrackerResult {
  newAchievements: AchievementProgress[]
  clearAchievements: () => void
  gameRecord: GameRecord | null
}

interface TrackerCounters {
  cardsPlayed: number
  unitsPlayed: number
  spellsPlayed: number
  damageDealt: number
  unitsDestroyed: number
  unitsLost: number
  manaSpent: number
  uniqueCardsPlayed: Set<string>
  majorArcanaPlayed: Set<string>
  zodiacClassesUsed: Set<string>
}

function createCounters(): TrackerCounters {
  return {
    cardsPlayed: 0,
    unitsPlayed: 0,
    spellsPlayed: 0,
    damageDealt: 0,
    unitsDestroyed: 0,
    unitsLost: 0,
    manaSpent: 0,
    uniqueCardsPlayed: new Set(),
    majorArcanaPlayed: new Set(),
    zodiacClassesUsed: new Set(),
  }
}

export function useGameTracker(
  gameState: GameState | null,
  gameOutcome: 'player1_wins' | 'player2_wins' | 'ongoing',
  difficulty: string,
  deckName: string,
): GameTrackerResult {
  const startTimeRef = useRef(Date.now())
  const countersRef = useRef<TrackerCounters>(createCounters())
  const prevStateRef = useRef<GameState | null>(null)
  const recordedRef = useRef(false)
  const achievementsRef = useRef<AchievementProgress[]>([])
  const gameRecordRef = useRef<GameRecord | null>(null)

  // Reset when a new game starts
  const currentRound = gameState?.round ?? null
  const prevRoundRef = useRef<number | null>(null)

  if (
    currentRound !== null &&
    (prevRoundRef.current === null || currentRound === 1) &&
    currentRound !== prevRoundRef.current
  ) {
    startTimeRef.current = Date.now()
    countersRef.current = createCounters()
    recordedRef.current = false
    achievementsRef.current = []
    gameRecordRef.current = null
  }
  prevRoundRef.current = currentRound

  // Diff game state between renders to detect changes
  useEffect(() => {
    if (!gameState || !prevStateRef.current) {
      prevStateRef.current = gameState
      return
    }

    const prev = prevStateRef.current
    const curr = gameState
    const counters = countersRef.current

    // Detect cards leaving player1's hand (card played)
    if (curr.player1.hand.length < prev.player1.hand.length) {
      const currHandIds = new Set(curr.player1.hand.map(c => c.id))
      for (const card of prev.player1.hand) {
        if (!currHandIds.has(card.id)) {
          counters.cardsPlayed++
          const baseId = extractBaseCardId(card.id)
          counters.uniqueCardsPlayed.add(baseId)

          if (baseId.startsWith('major-')) {
            counters.majorArcanaPlayed.add(baseId)
          }

          if (card.zodiacClass) {
            counters.zodiacClassesUsed.add(card.zodiacClass)
          }

          if (card.type === 'unit') {
            counters.unitsPlayed++
          } else if (card.type === 'spell') {
            counters.spellsPlayed++
          }
        }
      }
    }

    // Detect enemy units disappearing from battlefield (units destroyed)
    const prevEnemyCount = prev.battlefield.enemyUnits.filter(u => u !== null).length
    const currEnemyCount = curr.battlefield.enemyUnits.filter(u => u !== null).length
    if (currEnemyCount < prevEnemyCount) {
      counters.unitsDestroyed += prevEnemyCount - currEnemyCount
    }

    // Detect own units disappearing from battlefield (units lost)
    const prevPlayerCount = prev.battlefield.playerUnits.filter(u => u !== null).length
    const currPlayerCount = curr.battlefield.playerUnits.filter(u => u !== null).length
    if (currPlayerCount < prevPlayerCount) {
      counters.unitsLost += prevPlayerCount - currPlayerCount
    }

    // Detect opponent health decreasing (nexus damage dealt)
    if (curr.player2.health < prev.player2.health) {
      counters.damageDealt += prev.player2.health - curr.player2.health
    }

    // Detect mana spent
    const prevTotalMana = prev.player1.mana + prev.player1.spellMana
    const currTotalMana = curr.player1.mana + curr.player1.spellMana
    if (currTotalMana < prevTotalMana && prev.activePlayer === 'player1') {
      counters.manaSpent += prevTotalMana - currTotalMana
    }

    prevStateRef.current = gameState
  }, [gameState])

  // Record game when outcome changes from ongoing
  useEffect(() => {
    if (gameOutcome === 'ongoing' || !gameState || recordedRef.current) return

    recordedRef.current = true
    const counters = countersRef.current
    const durationSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000)

    const record: GameRecord = {
      id: `game_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      result: gameOutcome === 'player1_wins' ? 'win' : 'loss',
      difficulty: difficulty as GameRecord['difficulty'],
      deckName: deckName || 'Random',
      rounds: gameState.round,
      durationSeconds,
      cardsPlayed: counters.cardsPlayed,
      unitsPlayed: counters.unitsPlayed,
      spellsPlayed: counters.spellsPlayed,
      damageDealt: counters.damageDealt,
      unitsDestroyed: counters.unitsDestroyed,
      unitsLost: counters.unitsLost,
      manaSpent: counters.manaSpent,
      uniqueCardsPlayed: Array.from(counters.uniqueCardsPlayed),
      majorArcanaPlayed: Array.from(counters.majorArcanaPlayed),
      zodiacClassesUsed: Array.from(counters.zodiacClassesUsed),
      playerHealthRemaining: gameState.player1.health,
      opponentHealthRemaining: gameState.player2.health,
      timestamp: Date.now(),
    }

    gameRecordRef.current = record

    const updatedStats = statsService.recordGame(record)
    const newlyUnlocked = achievementService.checkAchievements(updatedStats, record)
    if (newlyUnlocked.length > 0) {
      achievementsRef.current = newlyUnlocked
    }

    // Update quest progress
    questService.refreshQuests()
    if (record.result === 'win') {
      questService.updateProgress('win', 1)
      if (difficulty === 'hard' || difficulty === 'expert') {
        questService.updateProgress('difficulty', 1)
      }
    }
    if (record.damageDealt > 0) {
      questService.updateProgress('damage', record.damageDealt)
    }
    if (record.cardsPlayed > 0) {
      questService.updateProgress('cards', record.cardsPlayed)
    }
    if (record.unitsDestroyed > 0) {
      questService.updateProgress('units', record.unitsDestroyed)
    }
    if (record.spellsPlayed > 0) {
      questService.updateProgress('spells', record.spellsPlayed)
    }
    if (record.majorArcanaPlayed.length > 0) {
      questService.updateProgress('zodiac', record.majorArcanaPlayed.length)
    }
  }, [gameOutcome, gameState, difficulty, deckName])

  const clearAchievements = useCallback(() => {
    for (const a of achievementsRef.current) {
      achievementService.markNotified(a.id)
    }
    achievementsRef.current = []
  }, [])

  return {
    newAchievements: achievementsRef.current,
    clearAchievements,
    gameRecord: gameRecordRef.current,
  }
}
