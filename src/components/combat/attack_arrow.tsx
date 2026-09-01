'use client'

import { useEffect, useState } from 'react'
import { useGameStore } from '@/store/game_store'

interface AttackArrowProps {
  className?: string
}

export function AttackArrow({ className }: AttackArrowProps) {
  const { interaction } = useGameStore()
  const [pointerPosition, setPointerPosition] = useState({ x: 0, y: 0 })
  const [sourcePosition, setSourcePosition] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (!interaction.attackSource) return

    const handlePointerMove = (event: PointerEvent) => {
      setPointerPosition({ x: event.clientX, y: event.clientY })
    }

    const sourceEl = document.getElementById(`unit-${interaction.attackSource}`)
    if (sourceEl) {
      const rect = sourceEl.getBoundingClientRect()
      setSourcePosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      })
    }

    document.addEventListener('pointermove', handlePointerMove)
    return () => document.removeEventListener('pointermove', handlePointerMove)
  }, [interaction.attackSource])

  if (!interaction.attackSource || interaction.targetingMode !== 'attack') {
    return null
  }

  const deltaX = pointerPosition.x - sourcePosition.x
  const deltaY = pointerPosition.y - sourcePosition.y
  const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI)

  return (
    <div className={`pointer-events-none fixed inset-0 z-50 ${className ?? ''}`} aria-hidden="true">
      <svg className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
        <line
          x1={sourcePosition.x}
          y1={sourcePosition.y}
          x2={pointerPosition.x}
          y2={pointerPosition.y}
          stroke="rgb(185 28 28)"
          strokeWidth="3"
          strokeDasharray="8,4"
          className="motion-reduce:stroke-solid"
        />
        <polygon
          points={`${pointerPosition.x},${pointerPosition.y} ${pointerPosition.x - 12},${pointerPosition.y - 6} ${pointerPosition.x - 12},${pointerPosition.y + 6}`}
          fill="rgb(185 28 28)"
          transform={`rotate(${angle}, ${pointerPosition.x}, ${pointerPosition.y})`}
        />
      </svg>
    </div>
  )
}
