"use client"

import React from 'react'

interface GameLayoutProps {
  children: React.ReactNode
  className?: string
}

export default function GameLayout({ children, className = '' }: GameLayoutProps) {
  return (
    <div className={`h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-2 overflow-hidden relative ${className}`}>
      {children}
    </div>
  )
}
