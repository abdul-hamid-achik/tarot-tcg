"use client"

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, List } from 'lucide-react'

interface CardNavigationProps {
  previousCard?: {
    name: string
    slug: string
  }
  nextCard?: {
    name: string
    slug: string
  }
  backToIndex?: {
    label: string
    href: string
  }
  className?: string
}

export function CardNavigation({ 
  previousCard, 
  nextCard, 
  backToIndex = { label: 'All Cards', href: '/cards' },
  className = '' 
}: CardNavigationProps) {
  return (
    <div className={`flex items-center justify-between border-t border-gray-200 pt-6 mt-8 ${className}`}>
      {/* Previous Card */}
      <div className="flex-1">
        {previousCard ? (
          <Link href={`/cards/${previousCard.slug}`}>
            <Button variant="outline" className="flex items-center space-x-2 text-left">
              <ChevronLeft className="w-4 h-4" />
              <div>
                <div className="text-xs text-gray-500">Previous</div>
                <div className="font-medium truncate max-w-32">{previousCard.name}</div>
              </div>
            </Button>
          </Link>
        ) : (
          <div className="w-32" /> // Spacer
        )}
      </div>

      {/* Back to Index */}
      <div className="flex-shrink-0 mx-4">
        <Link href={backToIndex.href}>
          <Button variant="ghost" className="flex items-center space-x-2">
            <List className="w-4 h-4" />
            <span>{backToIndex.label}</span>
          </Button>
        </Link>
      </div>

      {/* Next Card */}
      <div className="flex-1 flex justify-end">
        {nextCard ? (
          <Link href={`/cards/${nextCard.slug}`}>
            <Button variant="outline" className="flex items-center space-x-2 text-right">
              <div>
                <div className="text-xs text-gray-500">Next</div>
                <div className="font-medium truncate max-w-32">{nextCard.name}</div>
              </div>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </Link>
        ) : (
          <div className="w-32" /> // Spacer
        )}
      </div>
    </div>
  )
}