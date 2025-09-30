'use client'

import type React from 'react'

interface GameLayoutProps {
  children: React.ReactNode
  className?: string
}

export default function GameLayout({ children, className = '' }: GameLayoutProps) {
  return (
    <div
      className={`h-screen w-screen bg-background text-foreground overflow-auto relative transition-colors ${className}`}
    >
      {children}
    </div>
  )
}
