'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useImprovedGameActions } from '@/hooks/use_improved_game_actions'

interface PhaseIndicatorProps {
  className?: string
}

export function PhaseIndicator({ className = '' }: PhaseIndicatorProps) {
  const { getPhaseInfo, passPriority } = useImprovedGameActions()
  const phaseInfo = getPhaseInfo()

  if (!phaseInfo) {
    return null
  }

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'mulligan':
        return 'bg-yellow-100 text-yellow-800'
      case 'round_start':
        return 'bg-green-100 text-green-800'
      case 'action':
        return 'bg-blue-100 text-blue-800'
      case 'attack_declaration':
        return 'bg-red-100 text-red-800'
      case 'defense_declaration':
        return 'bg-orange-100 text-orange-800'
      case 'combat_resolution':
        return 'bg-purple-100 text-purple-800'
      case 'end_round':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatPhaseName = (phase: string) => {
    return phase
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  return (
    <div className={`flex items-center gap-3 p-3 bg-white border rounded-lg shadow-sm ${className}`}>
      {/* Phase Badge */}
      <Badge className={getPhaseColor(phaseInfo.phase)}>
        {formatPhaseName(phaseInfo.phase)}
      </Badge>

      {/* Phase Description */}
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-900">{phaseInfo.description}</p>
        {phaseInfo.priorityPlayer && (
          <p className="text-xs text-gray-600">
            Priority: {phaseInfo.priorityPlayer === 'player1' ? 'You' : 'Opponent'}
          </p>
        )}
      </div>

      {/* Action Indicators */}
      <div className="flex items-center gap-2">
        {/* Priority Indicator */}
        {phaseInfo.canAct ? (
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" title="You can act" />
        ) : (
          <div className="w-2 h-2 bg-gray-300 rounded-full" title="Waiting..." />
        )}

        {/* Pass Count */}
        {phaseInfo.passCount > 0 && (
          <Badge variant="outline" className="text-xs">
            {phaseInfo.passCount} pass{phaseInfo.passCount !== 1 ? 'es' : ''}
          </Badge>
        )}

        {/* Pass Priority Button */}
        {phaseInfo.canAct && phaseInfo.phase === 'action' && (
          <Button
            size="sm"
            variant="outline"
            onClick={passPriority}
            className="text-xs px-2 py-1"
          >
            Pass
          </Button>
        )}
      </div>

      {/* Valid Transitions (Debug Info - can be removed) */}
      {process.env.NODE_ENV === 'development' && phaseInfo.validTransitions.length > 0 && (
        <div className="text-xs text-gray-500">
          Next: {phaseInfo.validTransitions.join(', ')}
        </div>
      )}
    </div>
  )
}