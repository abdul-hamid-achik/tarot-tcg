import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Cards',
  description:
    'All 78 tarot cards with upright and reversed game text, costs, elements, and zodiac classes.',
}

export default function CardsLayout({ children }: { children: ReactNode }) {
  return children
}
