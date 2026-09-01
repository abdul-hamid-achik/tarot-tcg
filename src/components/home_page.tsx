'use client'

import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { DualFaceAbilities } from '@/components/dual_face_abilities'
import TarotCard from '@/components/tarot_card'
import { Button } from '@/components/ui/button'
import type { Card as GameCard } from '@/schemas/schema'

const MATCH_FACTS = [
  {
    title: 'Draw a face',
    body: 'Every card comes upright or reversed at random. You play the face you are given.',
  },
  {
    title: 'Seven slots',
    body: 'Place units on a 7-slot field and attack enemy units or the nexus directly.',
  },
  {
    title: 'Mana and spell mana',
    body: 'Unspent mana banks as spell mana, up to 3. Turns pass with an attack token.',
  },
  {
    title: 'Zodiac seasons',
    body: 'Cards of the current sign get a small stat bump. Time your deck around the calendar.',
  },
]

export function HomePage({ featured }: { featured: GameCard[] }) {
  const [flipped, setFlipped] = useState<Set<string>>(new Set())
  const heroCards = featured.slice(0, 2)
  const dualCards = featured.slice(2, 4)

  const toggle = (id: string) => {
    setFlipped(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="bg-background text-foreground">
      <section className="min-h-[100dvh] px-4 pt-12 pb-16 md:pt-16 md:pb-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="max-w-xl space-y-6">
            <h1 className="text-4xl font-semibold tracking-tight md:text-5xl lg:text-6xl">
              Tarot TCG
            </h1>
            <p className="max-w-[36ch] text-lg leading-relaxed text-muted-foreground">
              78 tarot cards. Two faces. A 7-slot duel.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/play">
                  Play
                  <ChevronRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/cards">Browse cards</Link>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:gap-6">
            {heroCards.length === 0
              ? [0, 1].map(i => (
                  <div
                    key={i}
                    className="aspect-[2/3] animate-pulse rounded-md border border-border bg-muted"
                    aria-hidden
                  />
                ))
              : heroCards.map(card => (
                  <ShowcaseCard
                    key={card.id}
                    card={card}
                    flipped={flipped.has(card.id)}
                    onToggle={() => toggle(card.id)}
                  />
                ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border px-4 py-16 md:py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-3 text-3xl font-semibold tracking-tight md:text-4xl">
            Upright and reversed
          </h2>
          <p className="mb-10 max-w-[50ch] text-muted-foreground leading-relaxed">
            Click a card to flip it. The catalog and rules list both faces for all 78.
          </p>
          <div className="grid gap-10 md:grid-cols-2">
            {(dualCards.length > 0 ? dualCards : heroCards).map(card => {
              const isFlipped = flipped.has(`dual-${card.id}`)
              return (
                <div key={card.id} className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <ShowcaseCard
                    card={card}
                    flipped={isFlipped}
                    onToggle={() => toggle(`dual-${card.id}`)}
                  />
                  <div className="min-w-0 flex-1 pt-1">
                    <p className="mb-3 text-sm text-muted-foreground">
                      {isFlipped ? 'Showing reversed art' : 'Showing upright art'}
                    </p>
                    <DualFaceAbilities
                      upright={card.uprightAbilities || []}
                      reversed={card.reversedAbilities || []}
                      compact
                    />
                    <Link
                      href={`/cards/${card.slug}`}
                      className="mt-4 inline-block text-sm underline underline-offset-4"
                    >
                      Open {card.name}
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
          <p className="mt-10 text-sm text-muted-foreground">
            <Link href="/rules" className="underline underline-offset-4">
              Full rules, including table play
            </Link>
          </p>
        </div>
      </section>

      <section className="border-t border-border px-4 py-16 md:py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-10 text-3xl font-semibold tracking-tight md:text-4xl">A match</h2>
          <dl className="grid gap-x-16 gap-y-10 md:grid-cols-2">
            {MATCH_FACTS.map(fact => (
              <div key={fact.title} className="border-t border-border pt-4">
                <dt className="text-lg font-medium">{fact.title}</dt>
                <dd className="mt-2 max-w-[42ch] text-muted-foreground leading-relaxed">
                  {fact.body}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <footer className="border-t border-border px-4 py-8 text-sm text-muted-foreground">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:justify-between">
          <p>Tarot TCG</p>
          <p>2026</p>
        </div>
      </footer>
    </div>
  )
}

function ShowcaseCard({
  card,
  flipped,
  onToggle,
}: {
  card: GameCard
  flipped: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
      aria-pressed={flipped}
      aria-label={`${card.name}, ${flipped ? 'reversed' : 'upright'}. Click to flip.`}
    >
      <TarotCard
        card={flipped ? { ...card, isReversed: true } : card}
        size="large"
        showReversedEffects={flipped}
        className="w-full"
      />
    </button>
  )
}
