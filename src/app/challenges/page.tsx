'use client'

import { ArrowLeft, Check, Clock, Flame, Trophy } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { ChallengeWithProgress } from '@/services/challenge_service'
import { challengeService } from '@/services/challenge_service'

function difficultyColor(difficulty: string): string {
  switch (difficulty) {
    case 'easy':
      return 'bg-green-500/15 text-green-400 border-green-500/30'
    case 'medium':
      return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
    case 'hard':
      return 'bg-red-500/15 text-red-400 border-red-500/30'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remaining = seconds % 60
  return `${minutes}m ${remaining}s`
}

function ChallengeCard({ challenge }: { challenge: ChallengeWithProgress }) {
  const { progress } = challenge
  const isCompleted = progress.completed

  return (
    <div
      className={`relative rounded-xl border-2 bg-card p-6 transition-all hover:shadow-lg ${
        isCompleted
          ? 'border-primary/50 shadow-primary/10 shadow-md'
          : 'border-border hover:border-primary/30'
      }`}
    >
      {/* Completion indicator */}
      {isCompleted && (
        <div className="absolute top-3 right-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="h-4 w-4" />
          </div>
        </div>
      )}

      {/* Icon */}
      <div className="mb-4 text-5xl">{challenge.icon}</div>

      {/* Name and difficulty */}
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-lg font-bold text-foreground">{challenge.name}</h3>
        <Badge variant="outline" className={difficultyColor(challenge.difficulty)}>
          {challenge.difficulty}
        </Badge>
      </div>

      {/* Description */}
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">{challenge.description}</p>

      {/* Reward */}
      <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Trophy className="h-3 w-3" />
        <span>{challenge.rewardDescription}</span>
      </div>

      {/* Stats */}
      <div className="mb-4 flex gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Flame className="h-3 w-3" />
          <span>{progress.attempts} attempts</span>
        </div>
        {progress.bestRounds !== null && (
          <div className="flex items-center gap-1">
            <Trophy className="h-3 w-3" />
            <span>{progress.bestRounds} rounds</span>
          </div>
        )}
        {progress.bestTime !== null && (
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{formatTime(progress.bestTime)}</span>
          </div>
        )}
      </div>

      {/* Action button */}
      <Link href={`/play?challenge=${challenge.id}`}>
        <Button className="w-full" variant={isCompleted ? 'outline' : 'default'}>
          {isCompleted ? 'Play Again' : 'Start Challenge'}
        </Button>
      </Link>
    </div>
  )
}

export default function ChallengesPage() {
  const [challenges, setChallenges] = useState<ChallengeWithProgress[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setChallenges(challengeService.getAllChallenges())
    setLoaded(true)
  }, [])

  const completedCount = challenges.filter(c => c.progress.completed).length

  if (!loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading challenges...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <Link href="/play">
            <Button variant="outline" size="icon" className="rounded-full">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Challenge Modes</h1>
            <p className="text-muted-foreground">Test your skills with special rules</p>
          </div>
        </div>

        {/* Progress summary */}
        <div className="mb-8 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="h-5 w-5 text-primary" />
              <span className="font-medium text-foreground">
                {completedCount} of {challenges.length} challenges completed
              </span>
            </div>
            <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{
                  width: `${challenges.length > 0 ? (completedCount / challenges.length) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Challenge grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {challenges.map(challenge => (
            <ChallengeCard key={challenge.id} challenge={challenge} />
          ))}
        </div>
      </div>
    </div>
  )
}
