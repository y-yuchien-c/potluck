import { NextRequest, NextResponse } from 'next/server'
import { extractRecipeFromUrl } from '@/lib/claude'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { url, caption } = await req.json()
  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 })
  }

  // If user pasted the caption manually, use it directly and skip scraping
  if (caption?.trim()) {
    try {
      const recipe = await extractRecipeFromUrl(url, caption.trim())
      return NextResponse.json(recipe)
    } catch (err) {
      console.error('Recipe extraction failed:', err)
      return NextResponse.json({ error: 'Failed to extract recipe' }, { status: 500 })
    }
  }

  // Try to scrape Open Graph metadata for better extraction
  let pageContent: string | undefined
  let thumbnail: string | undefined

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Potluck/1.0; +https://potluck.app)',
      },
      signal: AbortSignal.timeout(6000),
    })
    const html = await res.text()

    const ogTitle       = html.match(/property="og:title"\s+content="([^"]+)"/i)?.[1]
                       ?? html.match(/content="([^"]+)"\s+property="og:title"/i)?.[1]
    const ogDescription = html.match(/property="og:description"\s+content="([^"]+)"/i)?.[1]
                       ?? html.match(/content="([^"]+)"\s+property="og:description"/i)?.[1]
    const ogImage       = html.match(/property="og:image"\s+content="([^"]+)"/i)?.[1]
                       ?? html.match(/content="([^"]+)"\s+property="og:image"/i)?.[1]

    pageContent = [ogTitle, ogDescription].filter(Boolean).join('\n') || undefined
    thumbnail   = ogImage || undefined
  } catch {
    // Ignore — Claude will do its best with the URL alone
  }

  try {
    const recipe = await extractRecipeFromUrl(url, pageContent)
    if (!recipe.thumbnail_url && thumbnail) {
      recipe.thumbnail_url = thumbnail
    }
    return NextResponse.json(recipe)
  } catch (err) {
    console.error('Recipe extraction failed:', err)
    return NextResponse.json({ error: 'Failed to extract recipe' }, { status: 500 })
  }
}
