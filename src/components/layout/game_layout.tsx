'use client'

import type React from 'react'

interface GameLayoutProps {
  children: React.ReactNode
  className?: string
}

export default function GameLayout({ children, className = '' }: GameLayoutProps) {
  return (
    <div
      className={`h-full bg-white dark:bg-gray-900 p-2 overflow-hidden relative transition-colors ${className}`}
    >
      {children}
    </div>
  )
}
