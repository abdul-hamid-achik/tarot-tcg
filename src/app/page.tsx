'use client'

import { ChevronRight, Moon, Sparkles, Sun, Swords } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Navigation } from '@/components/layout/navigation'
import TarotCard from '@/components/tarot_card'
import { Button } from '@/components/ui/button'
import { getAllCards } from '@/lib/card_loader'
import type { Card as GameCard } from '@/schemas/schema'

export default function Home() {
  const [_hoveredCard, setHoveredCard] = useState<number | null>(null)
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set())
  const [mounted, setMounted] = useState(false)
  const [demoCards, setDemoCards] = useState<GameCard[]>([])

  useEffect(() => {
    setMounted(true)

    // Load actual cards from CMS
    const allCards = getAllCards()

    // Pick 4 featured cards (The Fool, The Magician, Death, The World)
    const featuredCardNames = ['The Fool', 'The Magician', 'Death', 'The World']
    const featured = featuredCardNames
      .map(name => allCards.find(card => card.name === name))
      .filter(Boolean) as GameCard[]

    // If we don't have all featured cards, pick random ones
    if (featured.length < 4) {
      const remaining = 4 - featured.length
      const randomCards = allCards
        .filter(card => !featured.some(f => f.id === card.id))
        .sort(() => Math.random() - 0.5)
        .slice(0, remaining)
      featured.push(...randomCards)
    }

    setDemoCards(featured.slice(0, 4))
  }, [])

  const toggleCard = (index: number) => {
    setFlippedCards(prev => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
  }

  return (
    <>
      <Navigation />

      {/* Hero Section */}
      <section className="min-h-screen flex flex-col items-center justify-center px-4 py-20 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {mounted &&
            [...Array(20)].map((_, i) => (
              <div
                key={i}
                className="absolute animate-float opacity-5"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 5}s`,
                  animationDuration: `${15 + Math.random() * 10}s`,
                }}
              >
                {i % 3 === 0 ? '◇' : i % 3 === 1 ? '○' : '△'}
              </div>
            ))}
        </div>

        <div className="max-w-6xl mx-auto text-center space-y-8 relative z-10">
          {/* Title */}
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-center gap-2 text-sm tracking-widest opacity-70">
              <Moon className="w-4 h-4" />
              <span>WHERE MYSTICISM MEETS STRATEGY</span>
              <Sun className="w-4 h-4" />
            </div>

            <h1 className="text-7xl md:text-8xl font-bold tracking-tight">
              TAROT
              <span className="block text-6xl md:text-7xl mt-2 opacity-70">TRADING CARD GAME</span>
            </h1>

            <p className="text-xl md:text-2xl max-w-3xl mx-auto leading-relaxed opacity-80">
              A strategic card battler where ancient wisdom meets modern gameplay. Every card tells
              a story. Every choice shapes destiny.
            </p>
          </div>

          {/* Call to Action */}
          <div
            className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-slide-up"
            style={{ animationDelay: '0.2s' }}
          >
            <Link href="/tutorial">
              <Button size="lg" className="bg-white text-black hover:bg-gray-200 text-lg px-8 py-6">
                Begin Your Journey
                <ChevronRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link href="/content">
              <Button
                size="lg"
                variant="outline"
                className="border-2 border-white text-lg px-8 py-6"
              >
                Explore the Cards
                <Sparkles className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Core Mechanics Section */}
      <section className="min-h-screen flex items-center justify-center px-4 py-20 bg-gradient-to-b from-transparent to-black/20">
        <div className="max-w-6xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <h2 className="text-5xl md:text-6xl font-bold">The Duality of Fate</h2>
            <p className="text-xl opacity-70 max-w-2xl mx-auto">
              Every card holds two truths. Click to reveal upright and reversed destinies.
            </p>
          </div>

          {/* Interactive Cards Grid - Using TarotCard component with real CMS data */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {demoCards.length === 0 ? (
              // Loading skeleton
              [...Array(4)].map((_, index) => (
                <div
                  key={index}
                  className="aspect-[2/3] bg-white/5 border-2 border-white/20 rounded-lg animate-pulse"
                  style={{ animationDelay: `${index * 0.1}s` }}
                />
              ))
            ) : (
              demoCards.map((card, index) => (
                <div
                  key={card.id}
                  className="animate-slide-up"
                  style={{ animationDelay: `${index * 0.1}s` }}
                  onMouseEnter={() => setHoveredCard(index)}
                  onMouseLeave={() => setHoveredCard(null)}
                >
                  <TarotCard
                    card={flippedCards.has(index) ? { ...card, isReversed: true } : card}
                    size="large"
                    onClick={() => toggleCard(index)}
                    showReversedEffects={flippedCards.has(index)}
                    className="hover:scale-105 transition-transform duration-300"
                  />
                  <div className="text-center mt-2 text-xs opacity-50">
                    Click to see {flippedCards.has(index) ? 'upright' : 'reversed'}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="text-center text-sm opacity-50 italic">
            50% chance each card appears reversed • Adapt your strategy to fate's whims
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="min-h-screen flex items-center justify-center px-4 py-20">
        <div className="max-w-6xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <h2 className="text-5xl md:text-6xl font-bold">Mysticism Meets Mastery</h2>
            <p className="text-xl opacity-70">Deep strategic gameplay wrapped in esoteric wisdom</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: 'Zodiac Seasons',
                description:
                  'Cards gain power during their astrological season. Time your plays with cosmic cycles for maximum impact.',
                icon: '☾',
              },
              {
                title: 'Elemental Harmony',
                description:
                  'Fire, Water, Air, Earth. Master all four elements to unlock ultimate power and alternative victory conditions.',
                icon: '◇',
              },
              {
                title: 'Strategic Depth',
                description:
                  'Direct attack combat, mana banking, 7-slot battlefield. Every decision matters in your path to victory.',
                icon: '⚔',
              },
              {
                title: "The Fool's Journey",
                description:
                  '78 cards from The Fool to The World. Each card embodies authentic tarot wisdom transformed into gameplay.',
                icon: '○',
              },
              {
                title: 'Upright & Reversed',
                description:
                  'Random orientation adds unpredictability. Build decks that thrive in chaos or create perfect contingencies.',
                icon: '⇅',
              },
              {
                title: 'Living Metagame',
                description:
                  'Seasonal shifts create evolving strategies. What works in Aries season may falter in Scorpio.',
                icon: '◉',
              },
            ].map((feature, index) => (
              <div
                key={index}
                className="group border border-white/20 bg-black/40 backdrop-blur p-8 hover:border-white/60 hover:bg-black/60 transition-all duration-300 animate-slide-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="text-5xl mb-4 opacity-70 group-hover:opacity-100 transition-opacity">
                  {feature.icon}
                </div>
                <h3 className="text-2xl font-bold mb-3">{feature.title}</h3>
                <p className="opacity-70 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="min-h-[60vh] flex items-center justify-center px-4 py-20 border-t border-white/10">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-5xl md:text-6xl font-bold">Your Journey Awaits</h2>
          <p className="text-xl opacity-70 max-w-2xl mx-auto leading-relaxed">
            The cards have been drawn. The fates are in motion. Will you embrace the wisdom of the
            tarot and master the game?
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
            <Link href="/tutorial">
              <Button size="lg" className="bg-white text-black hover:bg-gray-200 text-lg px-8 py-6">
                Start Playing Now
                <ChevronRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link href="/multiplayer">
              <Button
                size="lg"
                variant="outline"
                className="border-2 border-white text-lg px-8 py-6"
              >
                Challenge Others
                <Swords className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12 text-center opacity-50 text-sm">
        <p>TAROT TCG • Where Ancient Wisdom Meets Modern Strategy</p>
        <p className="mt-2">© 2025 • All Rights Reserved</p>
      </footer>

      <style jsx>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-20px) rotate(180deg);
          }
        }

        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(40px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-float {
          animation: float linear infinite;
        }

        .animate-fade-in {
          animation: fade-in 1s ease-out;
        }

        .animate-slide-up {
          animation: slide-up 0.8s ease-out backwards;
        }

        /* Global 3D card flip styles - must be :global to override jsx scoping */
        :global(.perspective-1000) {
          perspective: 1000px;
        }

        :global(.transform-style-3d) {
          transform-style: preserve-3d;
        }

        :global(.backface-hidden) {
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }

        :global(.rotate-y-180) {
          transform: rotateY(180deg);
        }
      `}</style>
    </>
  )
}
