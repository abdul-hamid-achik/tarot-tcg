import { allCards, allZodiacClasses } from 'contentlayer/generated'
import Link from 'next/link'
import { ContentNavigation } from '@/components/content_navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function ContentPage() {
  const cardsByCategory = allCards.reduce(
    (acc, card) => {
      const category = card._raw.sourceFileDir.split('/')[1] || 'other'
      if (!acc[category]) acc[category] = []
      acc[category].push(card)
      return acc
    },
    {} as Record<string, typeof allCards>,
  )

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors text-black dark:text-white transition-colors">
      <ContentNavigation />
      <div className="container mx-auto py-8">
        <h1 className="text-4xl font-bold mb-8 text-black dark:text-white transition-colors">
          Game Content
        </h1>

        {/* Zodiac Classes Section */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6 text-black dark:text-white transition-colors">
            Zodiac Classes & Gameplay
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {allZodiacClasses.map(doc => (
              <Card
                key={doc._id}
                className="bg-white dark:bg-gray-900 transition-colors border-gray-300 hover:border-gray-400 hover:shadow-md transition-all rounded-sm"
              >
                <CardHeader>
                  <CardTitle className="text-black dark:text-white transition-colors">
                    <Link
                      href={doc.url}
                      className="hover:text-gray-800 dark:text-gray-200 transition-colors"
                    >
                      {doc.title}
                    </Link>
                  </CardTitle>
                  <CardDescription className="text-gray-800 dark:text-gray-200">
                    {doc.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        {/* Cards Section */}
        <section>
          <h2 className="text-2xl font-semibold mb-6 text-black dark:text-white transition-colors">
            Cards
          </h2>

          {Object.entries(cardsByCategory).map(([category, cards]) => (
            <div key={category} className="mb-8">
              <h3 className="text-xl font-medium mb-4 capitalize text-black dark:text-white transition-colors">
                {category.replace('-', ' ')}
              </h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {cards.map(card => (
                  <Card
                    key={card._id}
                    className="bg-white dark:bg-gray-900 transition-colors border-gray-300 hover:border-gray-400 hover:shadow-md transition-all rounded-sm"
                  >
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg text-black dark:text-white transition-colors">
                          <Link
                            href={card.url}
                            className="hover:text-gray-800 dark:text-gray-200 transition-colors"
                          >
                            {card.name}
                          </Link>
                        </CardTitle>
                        <div className="text-lg text-black dark:text-white transition-colors">
                          {card.tarotSymbol}
                        </div>
                      </div>
                      <CardDescription className="text-gray-800 dark:text-gray-200">
                        {card.zodiacClass} • {card.element} • {card.rarity}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between text-sm">
                        <span>Cost: {card.cost}</span>
                        {card.isUnit && (
                          <span>
                            {card.attack}/{card.health}
                          </span>
                        )}
                        {card.isSpell && <span className="capitalize">{card.spellType}</span>}
                      </div>
                      {card.keywords && card.keywords.length > 0 && (
                        <div className="mt-2">
                          <div className="flex flex-wrap gap-1">
                            {card.keywords.map(keyword => (
                              <span key={keyword} className="px-2 py-1 text-xs bg-gray-100 rounded">
                                {keyword}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
