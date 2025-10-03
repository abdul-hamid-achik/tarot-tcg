'use client'

import { useEffect, useState } from 'react'
import { useGameStore } from '@/store/game_store'

interface AttackArrowProps {
  className?: string
}

export function AttackArrow({ className }: AttackArrowProps) {
  const { interaction } = useGameStore()
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [sourcePosition, setSourcePosition] = useState({ x: 0, y: 0 })

  // Update mouse position when in targeting mode
  useEffect(() => {
    if (!interaction.attackSource) return

    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY })
    }

    // Find source element position
    const sourceEl = document.getElementById(`unit-${interaction.attackSource}`)
    if (sourceEl) {
      const rect = sourceEl.getBoundingClientRect()
      setSourcePosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      })
    }

    document.addEventListener('mousemove', handleMouseMove)
    return () => document.removeEventListener('mousemove', handleMouseMove)
  }, [interaction.attackSource])

  // Don't render if not attacking
  if (!interaction.attackSource || interaction.targetingMode !== 'attack') {
    return null
  }

  const deltaX = mousePosition.x - sourcePosition.x
  const deltaY = mousePosition.y - sourcePosition.y
  const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI)
  const _length = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

  return (
    <div
      className={`fixed inset-0 pointer-events-none z-50 ${className}`}
      style={{
        left: 0,
        top: 0,
        width: '100vw',
        height: '100vh',
      }}
    >
      <svg className="absolute inset-0 w-full h-full" style={{ overflow: 'visible' }}>
        {/* Arrow Line */}
        <line
          x1={sourcePosition.x}
          y1={sourcePosition.y}
          x2={mousePosition.x}
          y2={mousePosition.y}
          stroke="rgba(239, 68, 68, 0.8)" // red-500 with opacity
          strokeWidth="3"
          strokeDasharray="8,4"
          className="animate-pulse"
        />

        {/* Arrow Head */}
        <polygon
          points={`${mousePosition.x},${mousePosition.y} ${mousePosition.x - 12},${mousePosition.y - 6} ${mousePosition.x - 12},${mousePosition.y + 6}`}
          fill="rgba(239, 68, 68, 0.9)"
          transform={`rotate(${angle}, ${mousePosition.x}, ${mousePosition.y})`}
        />

        {/* Glow Effect */}
        <line
          x1={sourcePosition.x}
          y1={sourcePosition.y}
          x2={mousePosition.x}
          y2={mousePosition.y}
          stroke="rgba(239, 68, 68, 0.3)"
          strokeWidth="8"
          strokeDasharray="8,4"
          className="animate-pulse"
          filter="blur(2px)"
        />
      </svg>

      {/* Attack Value Display */}
      <div
        className="absolute bg-red-600/90 text-white px-2 py-1 rounded-md text-sm font-bold shadow-lg"
        style={{
          left: sourcePosition.x + deltaX * 0.3 - 15,
          top: sourcePosition.y + deltaY * 0.3 - 15,
        }}
      >
        ⚔️ Attack
      </div>
    </div>
  )
}
