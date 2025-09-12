'use client'

import { Clock, Target, Trophy, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { getWinConditionProgress } from '@/lib/game_logic'
import type { WinCondition, WinConditionProgress } from '@/schemas/schema'

interface WinConditionPanelProps {
  playerId: 'player1' | 'player2'
  className?: string
}

export function WinConditionPanel({ playerId, className }: WinConditionPanelProps) {
  const { progress, activeConditions, gameMode } = getWinConditionProgress(playerId)

  if (activeConditions.length === 0) {
    return null
  }

  return (
    <Card className={`p-4 space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-yellow-600" />
          <h3 className="font-semibold text-sm">Victory Conditions</h3>
        </div>
        <Badge variant="outline" className="text-xs">
          {gameMode.name}
        </Badge>
      </div>

      <div className="space-y-2 max-h-32 overflow-y-auto">
        {activeConditions.map(condition => {
          const conditionProgress = progress.get(condition.id)
          return (
            <WinConditionItem
              key={condition.id}
              condition={condition}
              progress={conditionProgress}
            />
          )
        })}
      </div>
    </Card>
  )
}

interface WinConditionItemProps {
  condition: WinCondition
  progress?: WinConditionProgress
}

function WinConditionItem({ condition, progress }: WinConditionItemProps) {
  const getConditionIcon = (type: string) => {
    switch (type) {
      case 'health_depletion':
        return <Zap className="w-3 h-3 text-red-500" />
      case 'deck_depletion':
        return <Target className="w-3 h-3 text-blue-500" />
      case 'turn_survival':
        return <Clock className="w-3 h-3 text-green-500" />
      case 'board_domination':
        return <Trophy className="w-3 h-3 text-purple-500" />
      case 'arcana_completion':
        return (
          <div className="w-3 h-3 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full" />
        )
      case 'zodiac_alignment':
        return <div className="w-3 h-3 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-full" />
      default:
        return <Target className="w-3 h-3 text-gray-500" />
    }
  }

  const getPriorityColor = (priority: number) => {
    if (priority >= 95) return 'bg-red-100 text-red-800 border-red-200'
    if (priority >= 85) return 'bg-purple-100 text-purple-800 border-purple-200'
    if (priority >= 75) return 'bg-blue-100 text-blue-800 border-blue-200'
    return 'bg-gray-100 text-gray-800 border-gray-200'
  }

  return (
    <div className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 border">
      <div className="flex-shrink-0 mt-0.5">{getConditionIcon(condition.type)}</div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-xs font-medium text-gray-900 truncate">{condition.name}</h4>
          <Badge
            variant="outline"
            className={`text-xs px-1.5 py-0.5 ${getPriorityColor(condition.priority)}`}
          >
            P{condition.priority}
          </Badge>
        </div>

        <p className="text-xs text-gray-600 mb-2 line-clamp-2">{condition.description}</p>

        {progress && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">{progress.description}</span>
              <span className="text-xs font-medium">
                {progress.current}/{progress.target}
              </span>
            </div>

            <Progress value={progress.percentage} className="h-1.5" />

            {progress.milestones && progress.milestones.length > 0 && (
              <div className="flex gap-1 mt-1">
                {progress.milestones.map((milestone, index) => (
                  <div
                    key={index}
                    className={`text-xs px-1.5 py-0.5 rounded ${
                      milestone.achieved
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                    title={milestone.description}
                  >
                    {milestone.value}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!progress && condition.config.targetAmount && (
          <div className="text-xs text-gray-500">Target: {condition.config.targetAmount}</div>
        )}
      </div>
    </div>
  )
}

// Compact version for smaller spaces
export function CompactWinConditionPanel({ playerId, className }: WinConditionPanelProps) {
  const { activeConditions, gameMode } = getWinConditionProgress(playerId)

  if (activeConditions.length === 0) {
    return null
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Trophy className="w-3 h-3 text-yellow-600" />
      <span className="text-xs text-gray-600">
        {gameMode.name} ({activeConditions.length} conditions)
      </span>
    </div>
  )
}
