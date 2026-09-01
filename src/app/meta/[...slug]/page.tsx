import { MDXContent } from '@content-collections/mdx/react'
import { allMetaGuides } from 'content-collections'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface PageProps {
  params: Promise<{
    slug: string[]
  }>
}

export async function generateStaticParams() {
  return allMetaGuides.map(doc => ({
    slug: doc.slug.split('/'),
  }))
}

export default async function MetaGuidePage({ params }: PageProps) {
  const { slug: slugArray } = await params
  const slug = slugArray.join('/')
  const doc = allMetaGuides.find(item => item.slug === slug)

  if (!doc) notFound()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto py-8 max-w-4xl px-4">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">{doc.title}</h1>
          <p className="text-lg text-muted-foreground">{doc.description}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Guide</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose dark:prose-invert max-w-none">
              <MDXContent code={doc.mdx} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
