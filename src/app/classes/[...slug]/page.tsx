import { allZodiacClasses } from 'contentlayer/generated'
import { notFound } from 'next/navigation'
import { getMDXComponent } from 'next-contentlayer2/hooks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface PageProps {
  params: Promise<{
    slug: string[]
  }>
}

export async function generateStaticParams() {
  return allZodiacClasses.map((doc) => ({
    slug: doc._raw.flattenedPath.replace('classes/', '').split('/'),
  }))
}

export default async function ClassPage({ params }: PageProps) {
  const { slug: slugArray } = await params
  const slug = slugArray.join('/')
  const doc = allZodiacClasses.find((doc) =>
    doc._raw.flattenedPath === `classes/${slug}`
  )

  if (!doc) notFound()

  const MDXContent = getMDXComponent(doc.body.code)

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors">
      <div className="container mx-auto py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4 text-black dark:text-white transition-colors">{doc.title}</h1>
          <p className="text-lg text-gray-800 dark:text-gray-200">{doc.description}</p>
        </div>

        <Card className="rounded-sm bg-white dark:bg-gray-900 transition-colors border-gray-300">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose max-w-none">
              <MDXContent />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}