import { NextRequest, NextResponse } from 'next/server'
import { extractRecipeFromUrl, extractRecipeFromImage } from '@/lib/claude'
import { createClient } from '@/lib/supabase/server'

// ── Instagram GraphQL scraper ──────────────────────────────────────────────────
// Reverse-engineered from Instagram's own web app (no auth required for public reels).
// doc_id is Instagram's internal query ID — update if it stops working.
const IG_DOC_ID = '24368985919464652'
const IG_APP_ID = '936619743392459'

async function scrapeInstagram(url: string): Promise<{ caption?: string; thumbnail?: string }> {
  const shortcodeMatch = url.match(/instagram\.com\/(?:[^/]+\/)?(?:reel|p)\/([^/?#]+)/)
  if (!shortcodeMatch) return {}

  const shortcode = shortcodeMatch[1]

  try {
    // Step 1: Hit Instagram homepage to get a fresh csrftoken cookie
    const homeRes = await fetch('https://www.instagram.com/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
    })

    const setCookie = homeRes.headers.get('set-cookie') ?? ''
    const csrfToken = setCookie.match(/csrftoken=([^;,\s]+)/)?.[1] ?? 'missing'

    // Step 2: Query Instagram's internal GraphQL endpoint
    const variables = JSON.stringify({ shortcode })
    const payload   = `variables=${encodeURIComponent(variables)}&doc_id=${IG_DOC_ID}`

    const gqlRes = await fetch('https://www.instagram.com/graphql/query', {
      method: 'POST',
      headers: {
        'content-type':    'application/x-www-form-urlencoded',
        'user-agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'x-csrftoken':     csrfToken,
        'x-ig-app-id':     IG_APP_ID,
        'x-requested-with': 'XMLHttpRequest',
        'origin':          'https://www.instagram.com',
        'referer':         `https://www.instagram.com/reel/${shortcode}/`,
        'cookie':          `csrftoken=${csrfToken}`,
      },
      body: payload,
      signal: AbortSignal.timeout(8000),
    })

    if (!gqlRes.ok) return {}
    const data = await gqlRes.json()

    const item = data?.data?.xdt_api__v1__media__shortcode__web_info?.items?.[0]
    if (!item) return {}

    const caption   = item?.caption?.text as string | undefined
    const thumbnail = (item?.image_versions2?.candidates?.[0]?.url
                    ?? item?.thumbnail_url) as string | undefined

    return { caption, thumbnail }
  } catch {
    return {}
  }
}

// ── Route handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { url, imageBase64, mediaType } = await req.json()

  // ── Vision path: user uploaded a screenshot ──────────────────────────────
  if (imageBase64) {
    // Validate — strip the data: prefix if the client sent the full data URL
    const base64 = (imageBase64 as string).replace(/^data:[^;]+;base64,/, '')
    const mime   = (mediaType as string | undefined) ?? 'image/jpeg'
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
    type AllowedMime = typeof allowed[number]
    const safeMime: AllowedMime = (allowed as readonly string[]).includes(mime)
      ? mime as AllowedMime
      : 'image/jpeg'

    try {
      const recipe = await extractRecipeFromImage(base64, safeMime, url || undefined)
      return NextResponse.json(recipe)
    } catch (err) {
      console.error('Vision extraction failed:', err)
      return NextResponse.json({ error: 'Failed to read screenshot' }, { status: 500 })
    }
  }

  if (!url) return NextResponse.json({ error: 'URL is required' }, { status: 400 })

  // ── Instagram path: use internal GraphQL to get caption ──────────────────
  const isInstagram = url.includes('instagram.com')
  let pageContent: string | undefined
  let thumbnail:   string | undefined

  if (isInstagram) {
    const { caption, thumbnail: igThumb } = await scrapeInstagram(url)
    pageContent = caption
    thumbnail   = igThumb
    console.log('Instagram scrape result — caption length:', caption?.length ?? 0)
  }

  // ── Fallback: Open Graph from page HTML ──────────────────────────────────
  if (!pageContent) {
    try {
      const res  = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Potluck/1.0)' },
        signal: AbortSignal.timeout(6000),
      })
      const html = await res.text()

      const ogTitle = html.match(/property="og:title"\s+content="([^"]+)"/i)?.[1]
                   ?? html.match(/content="([^"]+)"\s+property="og:title"/i)?.[1]
      const ogDesc  = html.match(/property="og:description"\s+content="([^"]+)"/i)?.[1]
                   ?? html.match(/content="([^"]+)"\s+property="og:description"/i)?.[1]
      const ogImg   = html.match(/property="og:image"\s+content="([^"]+)"/i)?.[1]
                   ?? html.match(/content="([^"]+)"\s+property="og:image"/i)?.[1]

      pageContent = [ogTitle, ogDesc].filter(Boolean).join('\n') || undefined
      thumbnail   = thumbnail ?? ogImg ?? undefined
    } catch { /* ignore */ }
  }

  try {
    const recipe = await extractRecipeFromUrl(url, pageContent)
    if (!recipe.thumbnail_url && thumbnail) recipe.thumbnail_url = thumbnail
    return NextResponse.json(recipe)
  } catch (err) {
    console.error('Recipe extraction failed:', err)
    return NextResponse.json({ error: 'Failed to extract recipe' }, { status: 500 })
  }
}
