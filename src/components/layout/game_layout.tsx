'use client'

import type React from 'react'

interface GameLayoutProps {
  children: React.ReactNode
  className?: string
}

export default function GameLayout({ children, className = '' }: GameLayoutProps) {
  return (
    <div
      className={`h-screen w-screen bg-white overflow-hidden relative ${className}`}
    >
      {children}
    </div>
  )
}
