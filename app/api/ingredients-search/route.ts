import { NextRequest, NextResponse } from 'next/server'
import { suggestRecipesByIngredients } from '@/lib/claude'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ingredients, recipes } = await req.json()
  if (!ingredients?.length) return NextResponse.json({ ids: [] })

  try {
    const ids = await suggestRecipesByIngredients(ingredients, recipes)
    return NextResponse.json({ ids })
  } catch (err) {
    console.error('Ingredient search error:', err)
    return NextResponse.json({ ids: [] })
  }
}
