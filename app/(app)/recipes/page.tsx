'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Recipe, CuisineTag } from '@/lib/types'
import RecipeCard from '@/components/RecipeCard'
import { ALL_CUISINE_TAGS, CUISINE_LABELS } from '@/lib/utils'
import Link from 'next/link'

export default function RecipesPage() {
  const supabase = createClient()

  const [recipes,     setRecipes]     = useState<Recipe[]>([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [activeTag,   setActiveTag]   = useState<CuisineTag | null>(null)
  const [ingMode,     setIngMode]     = useState(false)
  const [ingInput,    setIngInput]    = useState('')
  const [ingMatches,  setIngMatches]  = useState<string[] | null>(null)
  const [ingLoading,  setIngLoading]  = useState(false)

  const loadRecipes = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('recipes')
      .select('*')
      .order('created_at', { ascending: false })
    setRecipes((data as Recipe[]) ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadRecipes() }, [loadRecipes])

  // Filter by tag + search
  const filtered = recipes.filter(r => {
    const matchTag    = !activeTag || r.cuisine_tags.includes(activeTag)
    const matchSearch = !search || r.title.toLowerCase().includes(search.toLowerCase())
    const matchIng    = !ingMatches || ingMatches.includes(r.id)
    return matchTag && matchSearch && matchIng
  })

  async function searchByIngredients() {
    const ings = ingInput.split(',').map(s => s.trim()).filter(Boolean)
    if (ings.length === 0) return
    setIngLoading(true)
    try {
      const res = await fetch('/api/ingredients-search', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          ingredients: ings,
          recipes: recipes.map(r => ({ id: r.id, title: r.title, ingredients: r.ingredients })),
        }),
      })
      const data = await res.json()
      setIngMatches(data.ids ?? [])
    } finally {
      setIngLoading(false)
    }
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pt-2">
        <h1 className="text-2xl font-bold">🥘 Potluck</h1>
        <Link href="/save" className="btn-primary py-2 px-3 text-sm">+ Save reel</Link>
      </div>

      {/* Search */}
      <input
        className="input mb-3"
        placeholder="Search recipes…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {/* Ingredient search toggle */}
      <div className="mb-3">
        <button
          onClick={() => { setIngMode(m => !m); setIngMatches(null); setIngInput('') }}
          className={`text-sm font-medium transition-colors ${ingMode ? 'text-brand-600' : 'text-stone-400'}`}
        >
          {ingMode ? '✕ Close ingredient search' : '🥕 What can I cook right now?'}
        </button>

        {ingMode && (
          <div className="mt-2 flex gap-2">
            <input
              className="input flex-1"
              placeholder="chicken, tofu, soy sauce…"
              value={ingInput}
              onChange={e => setIngInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchByIngredients()}
            />
            <button
              onClick={searchByIngredients}
              disabled={ingLoading}
              className="btn-primary shrink-0"
            >
              {ingLoading ? '…' : 'Find'}
            </button>
          </div>
        )}

        {ingMatches !== null && (
          <p className="text-xs text-stone-400 mt-1">
            {ingMatches.length === 0
              ? 'No matches — maybe grab a few more ingredients 🛒'
              : `${ingMatches.length} recipe${ingMatches.length > 1 ? 's' : ''} you can make!`}
            <button className="ml-2 underline" onClick={() => { setIngMatches(null); setIngInput('') }}>Clear</button>
          </p>
        )}
      </div>

      {/* Cuisine filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-4 scrollbar-hide">
        <button
          onClick={() => setActiveTag(null)}
          className={`tag shrink-0 cursor-pointer transition-colors ${!activeTag ? 'bg-brand-500 text-white' : 'bg-stone-100 text-stone-600'}`}
        >
          All
        </button>
        {ALL_CUISINE_TAGS.map(tag => (
          <button
            key={tag}
            onClick={() => setActiveTag(t => t === tag ? null : tag)}
            className={`tag shrink-0 cursor-pointer transition-colors ${activeTag === tag ? 'bg-brand-500 text-white' : 'bg-stone-100 text-stone-600'}`}
          >
            {CUISINE_LABELS[tag]}
          </button>
        ))}
      </div>

      {/* Recipe grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card h-52 animate-pulse bg-stone-100" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <div className="text-5xl mb-3">🍽️</div>
          <p className="font-medium">No recipes yet</p>
          <p className="text-sm mt-1">Share a cooking reel to save your first recipe!</p>
          <Link href="/save" className="btn-primary inline-flex mt-4">Save a reel</Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map(r => <RecipeCard key={r.id} recipe={r} />)}
        </div>
      )}
    </div>
  )
}
