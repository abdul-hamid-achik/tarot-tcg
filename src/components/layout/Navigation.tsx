'use client'

import { BookOpen, CreditCard, Play } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ui/theme_toggle'

interface NavigationProps {
  className?: string
}

export function Navigation({ className = '' }: NavigationProps) {
  const pathname = usePathname()

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/'
    return pathname.startsWith(path)
  }

  const navItems = [
    {
      label: 'Game',
      href: '/',
      icon: Play,
      description: 'Play the tarot card game',
    },
    {
      label: 'Cards',
      href: '/cards',
      icon: CreditCard,
      description: 'Browse all tarot cards',
    },
    {
      label: 'Tutorial',
      href: '/tutorial',
      icon: BookOpen,
      description: 'Learn how to play',
    },
  ]

  return (
    <header
      className={`bg-background border-b border-border shadow-sm transition-colors ${className}`}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Brand */}
          <Link href="/" className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">⚡</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Tarot TCG</h1>
              <p className="text-xs text-muted-foreground">Strategic Card Game</p>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="flex items-center space-x-1">
            <div className="mr-4">
              <ThemeToggle />
            </div>
            {navItems.map(item => {
              const Icon = item.icon
              const active = isActive(item.href)

              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={active ? 'default' : 'ghost'}
                    size="sm"
                    className={`flex items-center space-x-2 transition-colors ${
                      active
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                    {item.href === '/cards' && (
                      <Badge variant="secondary" className="ml-1 text-xs">
                        78
                      </Badge>
                    )}
                  </Button>
                </Link>
              )
            })}
          </nav>
        </div>
      </div>
    </header>
  )
}
