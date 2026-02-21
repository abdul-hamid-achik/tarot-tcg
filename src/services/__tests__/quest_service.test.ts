import { beforeEach, describe, expect, it, vi } from 'vitest'
import { questService } from '@/services/quest_service'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
  }
})()

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

describe('QuestService', () => {
  beforeEach(() => {
    localStorageMock.clear()
    questService.resetQuests()
  })

  describe('refreshQuests', () => {
    it('generates 3 daily quests on first refresh', () => {
      questService.refreshQuests()
      const { daily } = questService.getActiveQuests()
      expect(daily).toHaveLength(3)
    })

    it('generates 2 weekly quests on first refresh', () => {
      questService.refreshQuests()
      const { weekly } = questService.getActiveQuests()
      expect(weekly).toHaveLength(2)
    })

    it('initializes quests with zero progress', () => {
      questService.refreshQuests()
      const { daily } = questService.getActiveQuests()
      for (const quest of daily) {
        expect(quest.currentValue).toBe(0)
        expect(quest.completed).toBe(false)
        expect(quest.claimed).toBe(false)
        expect(quest.completedAt).toBeNull()
      }
    })

    it('does not refresh daily quests if less than 24h elapsed', () => {
      const now = Date.now()
      questService.refreshQuests(now)
      const firstQuests = questService.getActiveQuests().daily.map(q => q.questId)

      // 12 hours later - should not refresh
      questService.refreshQuests(now + 12 * 60 * 60 * 1000)
      const secondQuests = questService.getActiveQuests().daily.map(q => q.questId)

      expect(firstQuests).toEqual(secondQuests)
    })

    it('refreshes daily quests after 24h', () => {
      const now = Date.now()
      questService.refreshQuests(now)
      const firstQuests = questService.getActiveQuests().daily.map(q => q.questId)

      // Update progress on a quest so we can verify reset
      questService.updateProgress('win', 1)

      // 25 hours later - should refresh
      questService.refreshQuests(now + 25 * 60 * 60 * 1000)
      const { daily } = questService.getActiveQuests()

      // All quests should have 0 progress (freshly generated)
      for (const quest of daily) {
        expect(quest.currentValue).toBe(0)
        expect(quest.completed).toBe(false)
      }
    })

    it('refreshes weekly quests after 7 days', () => {
      const now = Date.now()
      questService.refreshQuests(now)

      questService.updateProgress('win', 5)

      // 8 days later
      questService.refreshQuests(now + 8 * 24 * 60 * 60 * 1000)
      const { weekly } = questService.getActiveQuests()

      for (const quest of weekly) {
        expect(quest.currentValue).toBe(0)
      }
    })

    it('does not refresh weekly quests if less than 7 days elapsed', () => {
      const now = Date.now()
      questService.refreshQuests(now)
      const firstQuests = questService.getActiveQuests().weekly.map(q => q.questId)

      // 3 days later
      questService.refreshQuests(now + 3 * 24 * 60 * 60 * 1000)
      const secondQuests = questService.getActiveQuests().weekly.map(q => q.questId)

      expect(firstQuests).toEqual(secondQuests)
    })

    it('generates deterministic quests for the same day', () => {
      const now = Date.now()
      questService.refreshQuests(now)
      const firstQuests = questService.getActiveQuests().daily.map(q => q.questId)

      // Reset and regenerate for the same timestamp
      questService.resetQuests()
      questService.refreshQuests(now)
      const secondQuests = questService.getActiveQuests().daily.map(q => q.questId)

      expect(firstQuests).toEqual(secondQuests)
    })

    it('all daily quest IDs are from the valid daily pool', () => {
      questService.refreshQuests()
      const { daily } = questService.getActiveQuests()
      const poolIds = questService.getDailyQuestPool().map(d => d.id)

      for (const quest of daily) {
        expect(poolIds).toContain(quest.questId)
      }
    })

    it('all weekly quest IDs are from the valid weekly pool', () => {
      questService.refreshQuests()
      const { weekly } = questService.getActiveQuests()
      const poolIds = questService.getWeeklyQuestPool().map(d => d.id)

      for (const quest of weekly) {
        expect(poolIds).toContain(quest.questId)
      }
    })
  })

  describe('updateProgress', () => {
    it('increments progress for matching category quests', () => {
      questService.refreshQuests()
      questService.updateProgress('win', 1)

      const { daily, weekly } = questService.getActiveQuests()
      const allQuests = [...daily, ...weekly]
      const winQuests = allQuests.filter(q => {
        const def = questService.getDefinition(q.questId)
        return def?.category === 'win'
      })

      for (const quest of winQuests) {
        expect(quest.currentValue).toBeGreaterThanOrEqual(1)
      }
    })

    it('does not increment non-matching category quests', () => {
      questService.refreshQuests()
      questService.updateProgress('damage', 10)

      const { daily, weekly } = questService.getActiveQuests()
      const allQuests = [...daily, ...weekly]
      const nonDamageQuests = allQuests.filter(q => {
        const def = questService.getDefinition(q.questId)
        return def?.category !== 'damage'
      })

      for (const quest of nonDamageQuests) {
        expect(quest.currentValue).toBe(0)
      }
    })

    it('marks quest as completed when target is reached', () => {
      questService.refreshQuests()
      // Apply a large amount to complete any matching quest
      questService.updateProgress('win', 100)

      const { daily, weekly } = questService.getActiveQuests()
      const allQuests = [...daily, ...weekly]
      const winQuests = allQuests.filter(q => {
        const def = questService.getDefinition(q.questId)
        return def?.category === 'win'
      })

      for (const quest of winQuests) {
        expect(quest.completed).toBe(true)
        expect(quest.completedAt).toBeTypeOf('number')
      }
    })

    it('does not exceed target value', () => {
      questService.refreshQuests()
      questService.updateProgress('win', 9999)

      const { daily, weekly } = questService.getActiveQuests()
      const allQuests = [...daily, ...weekly]

      for (const quest of allQuests) {
        expect(quest.currentValue).toBeLessThanOrEqual(quest.targetValue)
      }
    })

    it('does not update already completed quests', () => {
      questService.refreshQuests()
      questService.updateProgress('win', 100)

      const beforeQuests = questService.getActiveQuests()
      const winDaily = beforeQuests.daily.filter(q => {
        const def = questService.getDefinition(q.questId)
        return def?.category === 'win'
      })

      // Try to update again
      questService.updateProgress('win', 50)
      const afterQuests = questService.getActiveQuests()
      const winDailyAfter = afterQuests.daily.filter(q => {
        const def = questService.getDefinition(q.questId)
        return def?.category === 'win'
      })

      // Values should be the same (capped at target)
      for (let i = 0; i < winDaily.length; i++) {
        expect(winDailyAfter[i].currentValue).toBe(winDaily[i].currentValue)
      }
    })

    it('does not update claimed quests', () => {
      questService.refreshQuests()
      questService.updateProgress('win', 100)

      const { daily } = questService.getActiveQuests()
      const winQuest = daily.find(q => {
        const def = questService.getDefinition(q.questId)
        return def?.category === 'win'
      })

      if (winQuest) {
        questService.claimQuest(winQuest.questId)
        // Reset storage cache to force reload
        questService.updateProgress('win', 50)

        const afterQuests = questService.getActiveQuests()
        const claimedQuest = afterQuests.daily.find(q => q.questId === winQuest.questId)
        expect(claimedQuest?.claimed).toBe(true)
      }
    })
  })

  describe('claimQuest', () => {
    it('marks quest as claimed and adds XP', () => {
      questService.refreshQuests()

      // Complete a quest
      questService.updateProgress('win', 100)
      questService.updateProgress('damage', 1000)
      questService.updateProgress('cards', 1000)
      questService.updateProgress('units', 1000)
      questService.updateProgress('spells', 1000)
      questService.updateProgress('zodiac', 1000)
      questService.updateProgress('difficulty', 1000)

      const { daily } = questService.getActiveQuests()
      const completedQuest = daily.find(q => q.completed && !q.claimed)

      if (completedQuest) {
        const def = questService.getDefinition(completedQuest.questId)
        const xpBefore = questService.getXP()

        const result = questService.claimQuest(completedQuest.questId)

        expect(result).toBe(true)
        expect(questService.getXP()).toBe(xpBefore + (def?.rewardXP ?? 0))
      }
    })

    it('returns false for uncompleted quests', () => {
      questService.refreshQuests()

      const { daily } = questService.getActiveQuests()
      if (daily.length > 0) {
        const result = questService.claimQuest(daily[0].questId)
        expect(result).toBe(false)
      }
    })

    it('returns false for already claimed quests', () => {
      questService.refreshQuests()
      questService.updateProgress('win', 100)
      questService.updateProgress('damage', 1000)
      questService.updateProgress('cards', 1000)
      questService.updateProgress('units', 1000)
      questService.updateProgress('spells', 1000)
      questService.updateProgress('zodiac', 1000)
      questService.updateProgress('difficulty', 1000)

      const { daily } = questService.getActiveQuests()
      const completedQuest = daily.find(q => q.completed)

      if (completedQuest) {
        questService.claimQuest(completedQuest.questId)
        const result = questService.claimQuest(completedQuest.questId)
        expect(result).toBe(false)
      }
    })

    it('returns false for nonexistent quest ID', () => {
      questService.refreshQuests()
      const result = questService.claimQuest('nonexistent_quest_id')
      expect(result).toBe(false)
    })
  })

  describe('level progression', () => {
    it('starts at level 1 with 0 XP', () => {
      expect(questService.getLevel()).toBe(1)
      expect(questService.getXP()).toBe(0)
    })

    it('calculates level 1 for 0 XP', () => {
      expect(questService.calculateLevel(0)).toBe(1)
    })

    it('calculates level 1 for 99 XP', () => {
      expect(questService.calculateLevel(99)).toBe(1)
    })

    it('calculates level 2 for 100 XP', () => {
      // Level 2 requires 1*100 = 100 XP cumulative
      expect(questService.calculateLevel(100)).toBe(2)
    })

    it('calculates level 3 for 300 XP', () => {
      // Level 3 requires 1*100 + 2*100 = 300 XP cumulative
      expect(questService.calculateLevel(300)).toBe(3)
    })

    it('calculates level 4 for 600 XP', () => {
      // Level 4 requires 1*100 + 2*100 + 3*100 = 600 XP cumulative
      expect(questService.calculateLevel(600)).toBe(4)
    })

    it('remains level 2 for 299 XP', () => {
      expect(questService.calculateLevel(299)).toBe(2)
    })

    it('getXPForNextLevel returns correct value', () => {
      expect(questService.getXPForNextLevel(1)).toBe(100)
      expect(questService.getXPForNextLevel(2)).toBe(200)
      expect(questService.getXPForNextLevel(3)).toBe(300)
    })

    it('getCumulativeXPForLevel returns correct value', () => {
      expect(questService.getCumulativeXPForLevel(1)).toBe(0)
      expect(questService.getCumulativeXPForLevel(2)).toBe(100)
      expect(questService.getCumulativeXPForLevel(3)).toBe(300)
      expect(questService.getCumulativeXPForLevel(4)).toBe(600)
    })

    it('getCurrentLevelProgress returns correct progress', () => {
      const progress = questService.getCurrentLevelProgress(150, 2)
      expect(progress.current).toBe(50) // 150 - 100 (cumulative for level 2)
      expect(progress.required).toBe(200) // XP needed for level 2->3
    })
  })

  describe('time remaining', () => {
    it('returns 0 for daily time remaining before any refresh', () => {
      expect(questService.getDailyTimeRemaining()).toBe(0)
    })

    it('returns 0 for weekly time remaining before any refresh', () => {
      expect(questService.getWeeklyTimeRemaining()).toBe(0)
    })

    it('returns positive daily time remaining after refresh', () => {
      const now = Date.now()
      questService.refreshQuests(now)
      const remaining = questService.getDailyTimeRemaining(now + 1000)
      expect(remaining).toBeGreaterThan(0)
      expect(remaining).toBeLessThanOrEqual(24 * 60 * 60 * 1000)
    })

    it('returns positive weekly time remaining after refresh', () => {
      const now = Date.now()
      questService.refreshQuests(now)
      const remaining = questService.getWeeklyTimeRemaining(now + 1000)
      expect(remaining).toBeGreaterThan(0)
      expect(remaining).toBeLessThanOrEqual(7 * 24 * 60 * 60 * 1000)
    })

    it('returns 0 when daily time has fully elapsed', () => {
      const now = Date.now()
      questService.refreshQuests(now)
      const remaining = questService.getDailyTimeRemaining(now + 25 * 60 * 60 * 1000)
      expect(remaining).toBe(0)
    })
  })

  describe('localStorage persistence', () => {
    it('saves to localStorage on refresh', () => {
      questService.refreshQuests()
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'tarot-tcg-quests',
        expect.any(String),
      )
    })

    it('saves to localStorage on progress update', () => {
      questService.refreshQuests()
      localStorageMock.setItem.mockClear()

      questService.updateProgress('win', 1)
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'tarot-tcg-quests',
        expect.any(String),
      )
    })

    it('saves to localStorage on claim', () => {
      questService.refreshQuests()
      questService.updateProgress('win', 100)
      questService.updateProgress('damage', 1000)
      questService.updateProgress('cards', 1000)
      questService.updateProgress('units', 1000)
      questService.updateProgress('spells', 1000)
      questService.updateProgress('zodiac', 1000)
      questService.updateProgress('difficulty', 1000)

      const { daily } = questService.getActiveQuests()
      const completed = daily.find(q => q.completed)
      if (completed) {
        localStorageMock.setItem.mockClear()
        questService.claimQuest(completed.questId)
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
          'tarot-tcg-quests',
          expect.any(String),
        )
      }
    })

    it('handles corrupted localStorage gracefully', () => {
      localStorageMock.getItem.mockReturnValueOnce('not valid json{{{')
      questService.resetQuests()

      const level = questService.getLevel()
      expect(level).toBe(1)
    })

    it('handles invalid schema data gracefully', () => {
      localStorageMock.getItem.mockReturnValueOnce(
        JSON.stringify({ version: 1, invalid: 'data' }),
      )
      questService.resetQuests()

      const quests = questService.getActiveQuests()
      expect(quests.daily).toHaveLength(0)
      expect(quests.weekly).toHaveLength(0)
    })
  })

  describe('quest definitions', () => {
    it('has 12 daily quest definitions', () => {
      expect(questService.getDailyQuestPool()).toHaveLength(12)
    })

    it('has 4 weekly quest definitions', () => {
      expect(questService.getWeeklyQuestPool()).toHaveLength(4)
    })

    it('all daily quests have type daily', () => {
      for (const def of questService.getDailyQuestPool()) {
        expect(def.type).toBe('daily')
      }
    })

    it('all weekly quests have type weekly', () => {
      for (const def of questService.getWeeklyQuestPool()) {
        expect(def.type).toBe('weekly')
      }
    })

    it('all quests have positive targetValue and rewardXP', () => {
      const allDefs = [...questService.getDailyQuestPool(), ...questService.getWeeklyQuestPool()]
      for (const def of allDefs) {
        expect(def.targetValue).toBeGreaterThan(0)
        expect(def.rewardXP).toBeGreaterThan(0)
      }
    })

    it('all quest IDs are unique', () => {
      const allDefs = [...questService.getDailyQuestPool(), ...questService.getWeeklyQuestPool()]
      const ids = allDefs.map(d => d.id)
      expect(new Set(ids).size).toBe(ids.length)
    })

    it('getDefinition returns correct definition', () => {
      const def = questService.getDefinition('daily_win_1')
      expect(def).toBeDefined()
      expect(def?.name).toBe('Win 1 game')
      expect(def?.category).toBe('win')
    })

    it('getDefinition returns undefined for unknown ID', () => {
      expect(questService.getDefinition('nonexistent')).toBeUndefined()
    })
  })
})
