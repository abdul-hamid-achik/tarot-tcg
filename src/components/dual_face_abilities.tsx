import type { NamedAbility } from '@/lib/card_orientation'
import { cn } from '@/lib/utils'

type Face = 'upright' | 'reversed' | 'both'

export function DualFaceAbilities({
  upright,
  reversed,
  face = 'both',
  compact = false,
}: {
  upright: NamedAbility[]
  reversed: NamedAbility[]
  face?: Face
  compact?: boolean
}) {
  const showUpright = face !== 'reversed'
  const showReversed = face !== 'upright'

  if (showUpright && upright.length === 0 && showReversed && reversed.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No printed ability text for this face yet.</p>
    )
  }

  return (
    <div className={cn('grid gap-3', compact ? 'text-xs' : 'text-sm')}>
      {showUpright && upright.length > 0 && (
        <AbilityFace label="Upright" abilities={upright} tone="upright" compact={compact} />
      )}
      {showReversed && reversed.length > 0 && (
        <AbilityFace label="Reversed" abilities={reversed} tone="reversed" compact={compact} />
      )}
    </div>
  )
}

function AbilityFace({
  label,
  abilities,
  tone,
  compact,
}: {
  label: string
  abilities: NamedAbility[]
  tone: 'upright' | 'reversed'
  compact: boolean
}) {
  return (
    <section
      aria-label={label}
      className={cn(
        'rounded-md border px-3 py-2',
        tone === 'upright'
          ? 'border-emerald-700/40 bg-emerald-50 dark:bg-emerald-950/30'
          : 'border-rose-700/40 bg-rose-50 dark:bg-rose-950/30',
      )}
    >
      <p
        className={cn(
          'font-semibold',
          compact ? 'text-[11px] mb-1' : 'text-xs mb-2',
          tone === 'upright'
            ? 'text-emerald-800 dark:text-emerald-300'
            : 'text-rose-800 dark:text-rose-300',
        )}
      >
        {label}
      </p>
      <ul className="space-y-1.5">
        {abilities.map(ability => (
          <li key={`${ability.name}-${ability.description}`}>
            <span className="font-medium text-foreground">{ability.name}. </span>
            <span className="text-muted-foreground">{ability.description}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
