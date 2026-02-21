'use client'

import { ArrowLeft, Clock, Flame, Skull, Swords, Target, Trophy, Zap } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { QuestPanel } from '@/components/stats/quest_panel'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import type { GameRecord, PlayerStats } from '@/schemas/stats_schema'
import { achievementService } from '@/services/achievement_service'
import { statsService } from '@/services/stats_service'

const MAJOR_ARCANA = [
  { id: 'major-00-fool', name: 'The Fool', number: 0 },
  { id: 'major-01-magician', name: 'The Magician', number: 1 },
  { id: 'major-02-high-priestess', name: 'High Priestess', number: 2 },
  { id: 'major-03-empress', name: 'The Empress', number: 3 },
  { id: 'major-04-emperor', name: 'The Emperor', number: 4 },
  { id: 'major-05-hierophant', name: 'The Hierophant', number: 5 },
  { id: 'major-06-lovers', name: 'The Lovers', number: 6 },
  { id: 'major-07-chariot', name: 'The Chariot', number: 7 },
  { id: 'major-08-strength', name: 'Strength', number: 8 },
  { id: 'major-09-hermit', name: 'The Hermit', number: 9 },
  { id: 'major-10-wheel', name: 'Wheel of Fortune', number: 10 },
  { id: 'major-11-justice', name: 'Justice', number: 11 },
  { id: 'major-12-hanged-man', name: 'The Hanged Man', number: 12 },
  { id: 'major-13-death', name: 'Death', number: 13 },
  { id: 'major-14-temperance', name: 'Temperance', number: 14 },
  { id: 'major-15-devil', name: 'The Devil', number: 15 },
  { id: 'major-16-tower', name: 'The Tower', number: 16 },
  { id: 'major-17-star', name: 'The Star', number: 17 },
  { id: 'major-18-moon', name: 'The Moon', number: 18 },
  { id: 'major-19-sun', name: 'The Sun', number: 19 },
  { id: 'major-20-judgement', name: 'Judgement', number: 20 },
  { id: 'major-21-world', name: 'The World', number: 21 },
]

const DIFFICULTIES = ['tutorial', 'easy', 'normal', 'hard', 'expert'] as const
const DIFFICULTY_LABELS: Record<string, string> = {
  tutorial: 'Training',
  easy: 'Novice',
  normal: 'Apprentice',
  hard: 'Master',
  expert: 'Oracle',
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins < 60) return `${mins}m ${secs}s`
  const hours = Math.floor(mins / 60)
  return `${hours}h ${mins % 60}m`
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function StatsPage() {
  const [stats, setStats] = useState<PlayerStats | null>(null)
  const [recentGames, setRecentGames] = useState<GameRecord[]>([])
  const [showAllGames, setShowAllGames] = useState(false)
  const [achievements, setAchievements] = useState<ReturnType<typeof achievementService.getAll>>([])

  useEffect(() => {
    setStats(statsService.getStats())
    setRecentGames(statsService.getRecentGames(50))
    setAchievements(achievementService.getAll())
  }, [])

  if (!stats) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading stats...</div>
      </div>
    )
  }

  const winRate = stats.totalGames > 0 ? Math.round((stats.wins / stats.totalGames) * 100) : 0
  const displayedGames = showAllGames ? recentGames : recentGames.slice(0, 20)
  const unlockedCount = achievements.filter(a => a.unlocked).length

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Game Statistics</h1>
            <p className="text-muted-foreground">Track your progress and achievements</p>
          </div>
          <Link href="/play">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Game
            </Button>
          </Link>
        </div>

        {/* Daily & Weekly Quests */}
        <QuestPanel variant="page" />

        {/* Section 1: Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <SummaryCard
            icon={<Swords className="w-5 h-5" />}
            label="Games Played"
            value={stats.totalGames.toString()}
          />
          <SummaryCard
            icon={<Trophy className="w-5 h-5" />}
            label="Win Rate"
            value={stats.totalGames > 0 ? `${winRate}%` : '-'}
            subtext={`${stats.wins}W - ${stats.losses}L`}
          />
          <SummaryCard
            icon={<Zap className="w-5 h-5" />}
            label="Current Streak"
            value={stats.currentStreak.toString()}
            subtext={`Best: ${stats.bestStreak}`}
          />
          <SummaryCard
            icon={<Flame className="w-5 h-5" />}
            label="Total Damage"
            value={stats.totalDamageDealt.toString()}
          />
          <SummaryCard
            icon={<Clock className="w-5 h-5" />}
            label="Time Played"
            value={formatDuration(stats.totalPlayTimeSeconds)}
          />
          <SummaryCard
            icon={<Target className="w-5 h-5" />}
            label="Unique Cards"
            value={`${stats.uniqueCardsEverPlayed.length}/78`}
          />
        </div>

        {/* Section 2: Win Rate by Difficulty */}
        <div className="p-6 border border-border rounded-lg bg-card">
          <h2 className="text-lg font-semibold mb-4">Win Rate by Difficulty</h2>
          <div className="space-y-3">
            {DIFFICULTIES.map(diff => {
              const record = stats.difficultyRecord[diff]
              const wins = record?.wins || 0
              const losses = record?.losses || 0
              const total = wins + losses
              const pct = total > 0 ? Math.round((wins / total) * 100) : 0

              return (
                <div key={diff} className="flex items-center gap-3">
                  <div className="w-24 text-sm font-medium shrink-0">{DIFFICULTY_LABELS[diff]}</div>
                  <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden flex">
                    {total > 0 ? (
                      <>
                        <div
                          className="h-full bg-green-500/80 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                        <div
                          className="h-full bg-red-500/60 transition-all duration-500"
                          style={{ width: `${100 - pct}%` }}
                        />
                      </>
                    ) : (
                      <div className="h-full w-full" />
                    )}
                  </div>
                  <div className="w-20 text-sm text-muted-foreground text-right shrink-0">
                    {total > 0 ? `${wins}W - ${losses}L` : 'No games'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Section 3: Recent Games */}
        <div className="p-6 border border-border rounded-lg bg-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Games</h2>
            {recentGames.length > 20 && (
              <Button variant="ghost" size="sm" onClick={() => setShowAllGames(!showAllGames)}>
                {showAllGames ? 'Show less' : `Show all (${recentGames.length})`}
              </Button>
            )}
          </div>

          {recentGames.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No games played yet. Start a game to track your progress!
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-2 font-medium">Result</th>
                    <th className="text-left py-2 font-medium">Difficulty</th>
                    <th className="text-right py-2 font-medium">Rounds</th>
                    <th className="text-right py-2 font-medium">Damage</th>
                    <th className="text-right py-2 font-medium">Duration</th>
                    <th className="text-right py-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedGames.map(game => (
                    <tr key={game.id} className="border-b border-border/50">
                      <td className="py-2">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                            game.result === 'win'
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}
                        >
                          {game.result === 'win' ? 'Victory' : 'Defeat'}
                        </span>
                      </td>
                      <td className="py-2">{DIFFICULTY_LABELS[game.difficulty]}</td>
                      <td className="py-2 text-right">{game.rounds}</td>
                      <td className="py-2 text-right">{game.damageDealt}</td>
                      <td className="py-2 text-right">{formatDuration(game.durationSeconds)}</td>
                      <td className="py-2 text-right text-muted-foreground">
                        {formatDate(game.timestamp)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Section 4: Achievements */}
        <div className="p-6 border border-border rounded-lg bg-card">
          <h2 className="text-lg font-semibold mb-1">Achievements</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {unlockedCount} of {achievements.length} unlocked
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {achievements.map(achievement => {
              const pct = Math.min(
                100,
                Math.round((achievement.currentValue / achievement.targetValue) * 100),
              )
              return (
                <div
                  key={achievement.id}
                  className={`p-3 rounded-lg border transition-all ${
                    achievement.unlocked
                      ? 'border-primary/50 bg-primary/5 shadow-sm shadow-primary/10'
                      : 'border-border opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`text-2xl ${achievement.unlocked ? '' : 'grayscale'}`}>
                      {achievement.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{achievement.name}</div>
                      <div className="text-xs text-muted-foreground">{achievement.description}</div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <Progress value={pct} className="h-1.5 flex-1" />
                        <span className="text-xs text-muted-foreground shrink-0">
                          {achievement.currentValue}/{achievement.targetValue}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Section 5: Major Arcana Progress */}
        <div className="p-6 border border-border rounded-lg bg-card">
          <h2 className="text-lg font-semibold mb-1">The Fool's Journey</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {stats.majorArcanaEverPlayed.length} of 22 Major Arcana played
          </p>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-11 gap-2">
            {MAJOR_ARCANA.map(card => {
              const played = stats.majorArcanaEverPlayed.includes(card.id)
              return (
                <div
                  key={card.id}
                  className={`aspect-[3/4] rounded-lg border flex flex-col items-center justify-center p-1 text-center transition-all ${
                    played
                      ? 'border-primary/50 bg-primary/10 text-foreground'
                      : 'border-border/50 bg-muted/30 text-muted-foreground/40'
                  }`}
                  title={card.name}
                >
                  <div className={`text-lg font-bold ${played ? '' : 'opacity-30'}`}>
                    {card.number}
                  </div>
                  <div className="text-[9px] leading-tight truncate w-full">{card.name}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Reset Stats */}
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => {
              if (window.confirm('Reset all statistics and achievements? This cannot be undone.')) {
                statsService.resetStats()
                setStats(statsService.getStats())
                setRecentGames([])
                setAchievements(achievementService.getAll())
              }
            }}
          >
            <Skull className="w-3 h-3 mr-1" />
            Reset All Stats
          </Button>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({
  icon,
  label,
  value,
  subtext,
}: {
  icon: React.ReactNode
  label: string
  value: string
  subtext?: string
}) {
  return (
    <div className="p-4 border border-border rounded-lg bg-card">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {subtext && <div className="text-xs text-muted-foreground">{subtext}</div>}
    </div>
  )
}
