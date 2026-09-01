import type { Metadata } from 'next'
import Link from 'next/link'
import { DualFaceAbilities } from '@/components/dual_face_abilities'
import { getAllCards } from '@/lib/card_loader'
import { getCardPagePath } from '@/lib/card_orientation'

export const metadata: Metadata = {
  title: 'Rules',
  description:
    'How to play Tarot TCG: turns, combat, upright and reversed cards, zodiac seasons, and table rules for an offline game.',
}

const sections = [
  { id: 'overview', label: 'What this is' },
  { id: 'setup', label: 'Setup' },
  { id: 'turn', label: 'A turn' },
  { id: 'combat', label: 'Combat' },
  { id: 'orientation', label: 'Upright and reversed' },
  { id: 'zodiac', label: 'Zodiac and elements' },
  { id: 'winning', label: 'How you win' },
  { id: 'design', label: 'Design' },
  { id: 'table', label: 'Table play' },
  { id: 'cards', label: 'All 78 faces' },
]

export default function RulesPage() {
  const cards = getAllCards()
  const major = cards.filter(card => card.id.startsWith('major-'))
  const cups = cards.filter(card => card.id.startsWith('cups-'))
  const pentacles = cards.filter(card => card.id.startsWith('pentacles-'))
  const swords = cards.filter(card => card.id.startsWith('swords-'))
  const wands = cards.filter(card => card.id.startsWith('wands-'))

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-10 max-w-5xl">
        <header className="mb-10 max-w-3xl">
          <p className="text-sm text-muted-foreground mb-2">Tarot TCG</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">How to play</h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            A two-player card duel using the 78 tarot cards. Units fight on a 7-slot battlefield.
            Every draw is upright or reversed at random. You play the face you are given.
          </p>
        </header>

        <nav aria-label="Rules sections" className="mb-12 flex flex-wrap gap-2 text-sm">
          {sections.map(section => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="rounded-full border border-border px-3 py-1 text-muted-foreground hover:text-foreground hover:border-foreground/40"
            >
              {section.label}
            </a>
          ))}
        </nav>

        <div className="space-y-16 max-w-3xl">
          <section id="overview" className="scroll-mt-24 space-y-3">
            <h2 className="text-2xl font-bold">What this is</h2>
            <p>
              Tarot TCG is not a divinatory spread. It is a duel. You build a 30 to 40 card deck
              from the Arcana, place units, cast spells, and try to reduce the other player to 0
              life.
            </p>
            <p>
              Combat is a tarot reading. You lay one to three cards as Past, Present, and Future.
              The faces, suits, and whether a Major sits in Future decide what the reading does.
              Unused mana banks as spell mana (max 3) and pays for spells only.
            </p>
          </section>

          <section id="setup" className="scroll-mt-24 space-y-3">
            <h2 className="text-2xl font-bold">Setup</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Deck: 30 to 40 cards. Max 3 copies of the same card.</li>
              <li>Life: 20 each (the nexus).</li>
              <li>Battlefield: 7 slots per player.</li>
              <li>Opening hand: 4 cards. Each card is upright or reversed at random (50/50).</li>
              <li>
                Mulligan once: put any number back, shuffle, draw the same number. New cards are
                oriented again.
              </li>
              <li>
                Player 1 starts with 1 mana. Player 2 starts with 1 mana. Each player may commit one
                reading on their turn.
              </li>
            </ul>
          </section>

          <section id="turn" className="scroll-mt-24 space-y-3">
            <h2 className="text-2xl font-bold">A turn</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>Max mana becomes the round number, up to 10. Refill mana to that maximum.</li>
              <li>
                Draw 1 card (random orientation). If your deck is empty and you must draw, you lose.
              </li>
              <li>
                Action: play units into empty slots, play spells, and commit at most one reading.
                Units spend regular mana. Spells may spend spell mana.
              </li>
              <li>
                End turn: unused regular mana becomes spell mana (max 3 total). Cards exhausted for
                a reading refresh.
              </li>
            </ol>
          </section>

          <section id="combat" className="scroll-mt-24 space-y-3">
            <h2 className="text-2xl font-bold">Combat</h2>
            <p>Combat is one reading per turn. Future is required.</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                One card occupies Future. Two occupy Present then Future. Three fill Past, Present,
                Future.
              </li>
              <li>
                Minors contribute pip (Ace 1 through King 14). Majors contribute 0 pip; a Major in
                Future is a trump.
              </li>
              <li>
                If the opponent has a living unit of the reading&apos;s element, the reading is
                contested: a minor Future hits that unit. A Major Future still hits life.
              </li>
              <li>
                Unopposed readings hit life. Future&apos;s upright or reversed ability is the
                meaning that fires.
              </li>
              <li>
                Cards come from your hand (pay cost) or your tableau (they stay, exhausted for this
                turn).
              </li>
            </ul>
          </section>

          <section id="orientation" className="scroll-mt-24 space-y-3">
            <h2 className="text-2xl font-bold">Upright and reversed</h2>
            <p>
              This is the tarot in the rules, not only the art. You do not choose the face. Fate
              does, at draw.
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Upright: the open, constructive face of the archetype.</li>
              <li>Reversed: the shadow, blocked, or overflowing face of the same current.</li>
            </ul>
            <p>
              Build a deck that can live with both faces of each card. Every card page lists both.
            </p>
          </section>

          <section id="zodiac" className="scroll-mt-24 space-y-3">
            <h2 className="text-2xl font-bold">Zodiac and elements</h2>
            <p>Every card belongs to a sign and an element:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Fire: Aries, Leo, Sagittarius (Wands)</li>
              <li>Earth: Taurus, Virgo, Capricorn (Pentacles)</li>
              <li>Air: Gemini, Libra, Aquarius (Swords)</li>
              <li>Water: Cancer, Scorpio, Pisces (Cups)</li>
            </ul>
            <p>
              Digital rule: a card played during its real-world season gets +1/+1. For a first table
              game, ignore seasons, or pick one sign before the match.
            </p>
            <p>
              Optional element synergy: 2 of the same element on your board, +1 Attack. 3, +1/+1.
              4+, +2/+1 and a small start-of-turn bonus (fire damage, water heal, earth durability,
              air extra draw every other turn).
            </p>
          </section>

          <section id="winning" className="scroll-mt-24 space-y-3">
            <h2 className="text-2xl font-bold">How you win</h2>
            <p>Standard (the default online game): reduce the opponent to 0 life.</p>
            <p>Other modes, if you want them:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Deck out: they cannot draw</li>
              <li>Board domination: 6 units for 3 straight turns</li>
              <li>Major Arcana Master: play 7 different Major Arcana</li>
              <li>Four elements on your board at once (also The World's upright win)</li>
              <li>Survive to turn 15</li>
              <li>Deal 50 total damage</li>
            </ul>
          </section>

          <section id="design" className="scroll-mt-24 space-y-3">
            <h2 className="text-2xl font-bold">Design</h2>
            <p>
              The Fool's Journey is the power curve. Majors are myths. Minors are the week. Cost
              often follows the tarot number. Reversed is not "the bad version". It is the same
              card, blocked or overflowing.
            </p>
            <p>
              Random orientation is the shuffle and cut. If players could pick the face, everyone
              would pick the strong one. Adaptation is the skill.
            </p>
          </section>

          <section id="table" className="scroll-mt-24 space-y-3">
            <h2 className="text-2xl font-bold">Table play</h2>
            <p>You can play this with a tarot deck and tokens.</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                Print or write upright text at the bottom of the card, reversed at the top. Rotate
                180 degrees to read the other face.
              </li>
              <li>Coin flip on draw, or deal some cards already rotated.</li>
              <li>Mana crystals 1 to 10, plus 3 spell-mana tokens, plus one attack token.</li>
              <li>A playmat with 7 slots per side. Life counters at 20.</li>
              <li>Keep a discard pile for Death, Judgement, and similar cards.</li>
            </ul>
            <p>
              For a first kitchen-table game, play Standard only, ignore seasons, and read the card
              as printed.
            </p>
          </section>
        </div>

        <section id="cards" className="scroll-mt-24 mt-16 space-y-10">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-bold mb-3">All 78 faces</h2>
            <p className="text-muted-foreground">
              Upright and reversed game text for the full deck. Open any name for lore, stats, and
              art.
            </p>
          </div>

          <CardGroup title="Major Arcana" cards={major} />
          <CardGroup title="Cups" cards={cups} />
          <CardGroup title="Pentacles" cards={pentacles} />
          <CardGroup title="Swords" cards={swords} />
          <CardGroup title="Wands" cards={wands} />
        </section>
      </div>
    </div>
  )
}

function CardGroup({ title, cards }: { title: string; cards: ReturnType<typeof getAllCards> }) {
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold border-b border-border pb-2">{title}</h3>
      <div className="grid gap-4 md:grid-cols-2">
        {cards.map(card => (
          <article key={card.id} className="rounded-md border border-border p-4 space-y-3 bg-card">
            <div className="flex items-baseline justify-between gap-3">
              <h4 className="font-semibold">
                <Link href={getCardPagePath(card.slug || '')} className="hover:underline">
                  {card.name}
                </Link>
              </h4>
              <p className="text-xs text-muted-foreground whitespace-nowrap">
                {card.cost} mana
                {card.type === 'unit' ? ` · ${card.attack}/${card.health}` : ''}
                {` · ${card.zodiacClass}`}
              </p>
            </div>
            <DualFaceAbilities
              upright={card.uprightAbilities || []}
              reversed={card.reversedAbilities || []}
              compact
            />
          </article>
        ))}
      </div>
    </div>
  )
}
