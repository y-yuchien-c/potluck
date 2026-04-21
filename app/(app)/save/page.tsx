'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ExtractedRecipe, Ingredient, CuisineTag, MealType } from '@/lib/types'
import { ALL_CUISINE_TAGS, CUISINE_LABELS, MEAL_TYPE_LABELS } from '@/lib/utils'

type Step = 'extracting' | 'review' | 'saving' | 'done' | 'error'

export default function SavePage() {
  const params   = useSearchParams()
  const router   = useRouter()
  const supabase = createClient()

  const url = params.get('url') ?? ''

  const [step,           setStep]           = useState<Step>(url ? 'extracting' : 'review')
  const [recipe,         setRecipe]         = useState<ExtractedRecipe | null>(null)
  const [errorMsg,       setErrorMsg]       = useState('')
  const [households,     setHouseholds]     = useState<{ id: string; name: string }[]>([])
  const [targetHousehold, setTargetHousehold] = useState<string>('personal')
  const [slowHint,       setSlowHint]       = useState(false)

  // Fetch user's households for the save destination picker
  useEffect(() => {
    supabase
      .from('household_members')
      .select('household_id, households(id, name)')
      .then(({ data }) => {
        if (data) {
          const hs = (data as unknown as { households: { id: string; name: string } | null }[])
            .map(d => d.households)
            .filter((h): h is { id: string; name: string } => h !== null)
          setHouseholds(hs)
        }
      })
  }, [supabase])

  const extract = useCallback(async () => {
    if (!url) return
    setStep('extracting')
    setSlowHint(false)

    // Show a hint if it's taking more than 5 seconds
    const slowTimer = setTimeout(() => setSlowHint(true), 5000)

    try {
      const res  = await fetch('/api/extract', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ url }),
      })
      clearTimeout(slowTimer)
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setRecipe(data)
      setStep('review')
    } catch (err) {
      clearTimeout(slowTimer)
      setErrorMsg(err instanceof Error ? err.message : 'Extraction failed')
      setStep('error')
    }
  }, [url])

  useEffect(() => { if (url) extract() }, [url, extract])

  async function save() {
    if (!recipe) return
    setStep('saving')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not logged in')

      const payload = {
        title:         recipe.title,
        source_url:    url || null,
        thumbnail_url: recipe.thumbnail_url ?? null,
        summary:       recipe.summary,
        cuisine_tags:  recipe.cuisine_tags,
        meal_type:     recipe.meal_type,
        equipment:     recipe.equipment,
        ingredients:   recipe.ingredients,
        servings:      recipe.servings ?? null,
        cook_time:     recipe.cook_time ?? null,
        created_by:    user.id,
        household_id:  targetHousehold === 'personal' ? null : targetHousehold,
        is_shared:     targetHousehold !== 'personal',
      }

      const { error } = await supabase.from('recipes').insert(payload)
      if (error) throw error
      setStep('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Save failed')
      setStep('error')
    }
  }

  // ── Inline edit helpers ────────────────────────────────────────────────────
  function updateField<K extends keyof ExtractedRecipe>(key: K, val: ExtractedRecipe[K]) {
    setRecipe(r => r ? { ...r, [key]: val } : r)
  }

  function updateIngredient(i: number, field: keyof Ingredient, val: string) {
    setRecipe(r => {
      if (!r) return r
      const ing = [...r.ingredients]
      ing[i] = { ...ing[i], [field]: val }
      return { ...r, ingredients: ing }
    })
  }

  function addIngredient() {
    setRecipe(r => r ? { ...r, ingredients: [...r.ingredients, { name: '' }] } : r)
  }

  function removeIngredient(i: number) {
    setRecipe(r => r ? { ...r, ingredients: r.ingredients.filter((_, idx) => idx !== i) } : r)
  }

  function toggleCuisineTag(tag: CuisineTag) {
    setRecipe(r => {
      if (!r) return r
      const tags = r.cuisine_tags.includes(tag)
        ? r.cuisine_tags.filter(t => t !== tag)
        : [...r.cuisine_tags, tag]
      return { ...r, cuisine_tags: tags }
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (step === 'extracting') return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="text-5xl animate-bounce">🍳</div>
      <p className="font-semibold text-stone-700">Reading the reel…</p>
      <p className="text-sm text-stone-400">Claude is extracting the recipe for you</p>

      {slowHint && (
        <div className="mt-4 max-w-xs bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 space-y-1">
          <p className="text-sm font-medium text-amber-800">Taking a bit longer than usual</p>
          <p className="text-xs text-amber-600">
            Instagram and TikTok block direct scraping, so Claude is working from the URL alone. It usually still gets the recipe — hang tight!
          </p>
        </div>
      )}
    </div>
  )

  if (step === 'error') return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="text-5xl">😬</div>
      <p className="font-semibold text-stone-700">Couldn&apos;t extract the recipe</p>
      <p className="text-sm text-stone-400">{errorMsg}</p>
      <p className="text-xs text-stone-300 mt-1 break-all">{url}</p>
      <div className="flex gap-3 mt-2">
        <button className="btn-secondary" onClick={() => router.push('/recipes')}>Go back</button>
        <button className="btn-primary" onClick={extract}>Try again</button>
      </div>
    </div>
  )

  if (step === 'done') return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="text-6xl">✅</div>
      <p className="font-bold text-xl">Saved to Potluck!</p>
      <p className="text-sm text-stone-400">
        {targetHousehold === 'personal' ? 'Added to your personal cookbook.' : 'Added to your shared household.'}
      </p>
      <button className="btn-primary mt-2" onClick={() => router.push('/recipes')}>
        View my recipes
      </button>
    </div>
  )

  if (step === 'saving') return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
      <div className="text-5xl animate-spin">🥘</div>
      <p className="font-semibold text-stone-700">Saving…</p>
    </div>
  )

  // ── Review + edit form ─────────────────────────────────────────────────────
  if (!recipe) {
    // Manual entry (no URL)
    return (
      <div className="p-4">
        <h1 className="text-xl font-bold mb-4">Add recipe manually</h1>
        <button className="btn-primary w-full" onClick={() => {
          setRecipe({
            title: '', summary: '', cuisine_tags: [], meal_type: 'dinner',
            equipment: [], ingredients: [{ name: '' }],
          })
        }}>
          Start blank recipe
        </button>
      </div>
    )
  }

  // Warn if extraction looks thin
  const extractionLooksThin = !recipe.title || recipe.ingredients.length === 0

  return (
    <div className="p-4 space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => router.back()} className="text-stone-400 text-xl">←</button>
        <h1 className="text-xl font-bold">Review recipe</h1>
      </div>

      {extractionLooksThin && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 space-y-2">
          <p className="text-sm font-medium text-amber-800">⚠️ Couldn&apos;t read this reel</p>
          <p className="text-xs text-amber-600 leading-relaxed">
            Instagram blocks scraping. Best fix: <strong>screenshot the reel caption</strong> while it&apos;s open, then upload it here — Claude will read the text from the image.
          </p>
          <div className="pt-1">
            <label className="btn-secondary text-xs cursor-pointer inline-flex items-center gap-1.5">
              📷 Upload screenshot
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setStep('extracting')
                  setSlowHint(false)
                  try {
                    const base64 = await new Promise<string>((resolve, reject) => {
                      const reader = new FileReader()
                      reader.onload = () => resolve((reader.result as string).split(',')[1])
                      reader.onerror = reject
                      reader.readAsDataURL(file)
                    })
                    const res = await fetch('/api/extract', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        url,
                        imageBase64: base64,
                        mediaType: file.type || 'image/jpeg',
                      }),
                    })
                    if (!res.ok) throw new Error(await res.text())
                    setRecipe(await res.json())
                    setStep('review')
                  } catch {
                    setStep('review')
                  }
                }}
              />
            </label>
          </div>
        </div>
      )}

      {/* Title */}
      <div>
        <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1 block">Title</label>
        <input
          className="input text-base font-semibold"
          value={recipe.title}
          onChange={e => updateField('title', e.target.value)}
          placeholder="Recipe name"
        />
      </div>

      {/* Summary */}
      <div>
        <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1 block">Summary</label>
        <textarea
          className="input min-h-[72px] resize-none"
          value={recipe.summary ?? ''}
          onChange={e => updateField('summary', e.target.value)}
          placeholder="What's this dish?"
        />
      </div>

      {/* Meta row */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1 block">Cook time</label>
          <input
            className="input"
            value={recipe.cook_time ?? ''}
            onChange={e => updateField('cook_time', e.target.value)}
            placeholder="e.g. 30 mins"
          />
        </div>
        <div className="flex-1">
          <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1 block">Servings</label>
          <input
            className="input"
            type="number"
            min={1}
            value={recipe.servings ?? ''}
            onChange={e => updateField('servings', parseInt(e.target.value) || undefined)}
            placeholder="2"
          />
        </div>
      </div>

      {/* Meal type */}
      <div>
        <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2 block">Meal type</label>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(MEAL_TYPE_LABELS) as MealType[]).map(t => (
            <button
              key={t}
              onClick={() => updateField('meal_type', t)}
              className={`tag cursor-pointer transition-colors ${
                recipe.meal_type === t ? 'bg-brand-500 text-white' : 'bg-stone-100 text-stone-600'
              }`}
            >
              {MEAL_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Cuisine tags */}
      <div>
        <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2 block">Cuisine</label>
        <div className="flex flex-wrap gap-2">
          {ALL_CUISINE_TAGS.map(tag => (
            <button
              key={tag}
              onClick={() => toggleCuisineTag(tag)}
              className={`tag cursor-pointer transition-colors ${
                recipe.cuisine_tags.includes(tag) ? 'bg-brand-500 text-white' : 'bg-stone-100 text-stone-600'
              }`}
            >
              {CUISINE_LABELS[tag]}
            </button>
          ))}
        </div>
      </div>

      {/* Equipment */}
      <div>
        <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1 block">Equipment</label>
        <input
          className="input"
          value={recipe.equipment.join(', ')}
          onChange={e => updateField('equipment', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
          placeholder="wok, air fryer, instant pot…"
        />
        <p className="text-xs text-stone-400 mt-1">Comma-separated</p>
      </div>

      {/* Ingredients */}
      <div>
        <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2 block">Ingredients</label>
        <div className="space-y-2">
          {recipe.ingredients.map((ing, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                className="input flex-1"
                placeholder="Ingredient"
                value={ing.name}
                onChange={e => updateIngredient(i, 'name', e.target.value)}
              />
              <input
                className="input w-16 text-center"
                placeholder="amt"
                value={ing.amount ?? ''}
                onChange={e => updateIngredient(i, 'amount', e.target.value)}
              />
              <input
                className="input w-16 text-center"
                placeholder="unit"
                value={ing.unit ?? ''}
                onChange={e => updateIngredient(i, 'unit', e.target.value)}
              />
              <button onClick={() => removeIngredient(i)} className="text-stone-300 text-lg shrink-0">✕</button>
            </div>
          ))}
        </div>
        <button onClick={addIngredient} className="btn-ghost text-sm mt-2">+ Add ingredient</button>
      </div>

      {/* Save destination */}
      {households.length > 0 && (
        <div>
          <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2 block">Save to</label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setTargetHousehold('personal')}
              className={`tag cursor-pointer transition-colors ${
                targetHousehold === 'personal' ? 'bg-brand-500 text-white' : 'bg-stone-100 text-stone-600'
              }`}
            >
              👤 My cookbook
            </button>
            {households.map(h => (
              <button
                key={h.id}
                onClick={() => setTargetHousehold(h.id)}
                className={`tag cursor-pointer transition-colors ${
                  targetHousehold === h.id ? 'bg-blue-500 text-white' : 'bg-stone-100 text-stone-600'
                }`}
              >
                🏠 {h.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Source link */}
      {url && (
        <p className="text-xs text-stone-400 break-all">
          Source: <a href={url} target="_blank" rel="noopener noreferrer" className="underline">{url}</a>
        </p>
      )}

      <button onClick={save} disabled={!recipe.title} className="btn-primary w-full py-3 text-base">
        Save to Potluck 🥘
      </button>
    </div>
  )
}
