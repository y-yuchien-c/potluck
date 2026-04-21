'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Recipe, CookingLog } from '@/lib/types'
import { CUISINE_LABELS, MEAL_TYPE_LABELS, formatDate } from '@/lib/utils'
import Image from 'next/image'
import Link from 'next/link'

export default function RecipeDetailPage() {
  const params   = useParams()
  const router   = useRouter()
  const supabase = createClient()
  const id       = params.id as string

  const [recipe,  setRecipe]  = useState<Recipe | null>(null)
  const [logs,    setLogs]    = useState<CookingLog[]>([])
  const [loading, setLoading] = useState(true)
  const [logOpen, setLogOpen] = useState(false)

  // Log form state
  const [logDate,   setLogDate]   = useState(new Date().toISOString().split('T')[0])
  const [logNotes,  setLogNotes]  = useState('')
  const [logWith,   setLogWith]   = useState('')
  const [logRating, setLogRating] = useState<number>(0)
  const [logPhoto,  setLogPhoto]  = useState<File | null>(null)
  const [saving,    setSaving]    = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: rec }, { data: logData }] = await Promise.all([
        supabase.from('recipes').select('*').eq('id', id).single(),
        supabase.from('cooking_logs').select('*').eq('recipe_id', id).order('cooked_at', { ascending: false }),
      ])
      setRecipe(rec as Recipe)
      setLogs((logData as CookingLog[]) ?? [])
      setLoading(false)
    }
    load()
  }, [id, supabase])

  async function saveLog() {
    if (!recipe) return
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not logged in')

      let photoUrl: string | null = null
      if (logPhoto) {
        const path = `${user.id}/${id}/${Date.now()}`
        const { error: uploadError } = await supabase.storage
          .from('cooking-photos')
          .upload(path, logPhoto)
        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage.from('cooking-photos').getPublicUrl(path)
          photoUrl = publicUrl
        }
      }

      const { data } = await supabase.from('cooking_logs').insert({
        recipe_id:   id,
        user_id:     user.id,
        cooked_at:   logDate,
        notes:       logNotes || null,
        photo_url:   photoUrl,
        cooked_with: logWith ? logWith.split(',').map(s => s.trim()).filter(Boolean) : [],
        rating:      logRating || null,
      }).select().single()

      setLogs(ls => [data as CookingLog, ...ls])
      setLogOpen(false)
      setLogNotes('')
      setLogWith('')
      setLogRating(0)
      setLogPhoto(null)
    } finally {
      setSaving(false)
    }
  }

  async function deleteRecipe() {
    if (!confirm('Delete this recipe?')) return
    await supabase.from('recipes').delete().eq('id', id)
    router.push('/recipes')
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-4xl animate-bounce">🍳</div>
    </div>
  )

  if (!recipe) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="text-5xl">🤔</div>
      <p>Recipe not found</p>
      <Link href="/recipes" className="btn-primary">Back to recipes</Link>
    </div>
  )

  return (
    <div className="pb-8">
      {/* Hero image */}
      {recipe.thumbnail_url ? (
        <div className="relative h-56 w-full bg-stone-200">
          <Image src={recipe.thumbnail_url} alt={recipe.title} fill className="object-cover" unoptimized />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        </div>
      ) : (
        <div className="h-48 bg-gradient-to-br from-brand-100 to-brand-300 flex items-center justify-center text-6xl">
          🍳
        </div>
      )}

      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="absolute top-4 left-4 bg-white/80 backdrop-blur rounded-full w-9 h-9 flex items-center justify-center text-stone-700 shadow"
      >
        ←
      </button>

      <div className="p-4 space-y-5">
        {/* Title & meta */}
        <div>
          <h1 className="text-2xl font-bold leading-tight mb-2">{recipe.title}</h1>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {recipe.cuisine_tags.map(tag => (
              <span key={tag} className="tag bg-brand-50 text-brand-700">{CUISINE_LABELS[tag]}</span>
            ))}
            <span className="tag bg-stone-100 text-stone-600">{MEAL_TYPE_LABELS[recipe.meal_type]}</span>
            {recipe.household_id && <span className="tag bg-blue-50 text-blue-600">🏠 Shared</span>}
          </div>

          <div className="flex gap-4 text-sm text-stone-500">
            {recipe.cook_time && <span>⏱ {recipe.cook_time}</span>}
            {recipe.servings  && <span>👤 {recipe.servings} servings</span>}
          </div>
        </div>

        {/* Summary */}
        {recipe.summary && (
          <p className="text-stone-600 leading-relaxed">{recipe.summary}</p>
        )}

        {/* Equipment */}
        {recipe.equipment.length > 0 && (
          <div className="card p-4">
            <h2 className="font-semibold mb-2">🔧 Equipment</h2>
            <div className="flex flex-wrap gap-2">
              {recipe.equipment.map((eq, i) => (
                <span key={i} className="tag bg-stone-100 text-stone-700 capitalize">{eq}</span>
              ))}
            </div>
          </div>
        )}

        {/* Ingredients */}
        {recipe.ingredients.length > 0 && (
          <div className="card p-4">
            <h2 className="font-semibold mb-3">🛒 Ingredients</h2>
            <ul className="space-y-2">
              {recipe.ingredients.map((ing, i) => (
                <li key={i} className="flex items-baseline gap-2 text-sm">
                  <span className="text-stone-300">•</span>
                  {(ing.amount || ing.unit) && (
                    <span className="font-medium text-brand-600 shrink-0">
                      {ing.amount} {ing.unit}
                    </span>
                  )}
                  <span className={ing.optional ? 'text-stone-400' : 'text-stone-700'}>
                    {ing.name}
                    {ing.optional && ' (optional)'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Source link */}
        {recipe.source_url && (
          <a
            href={recipe.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-brand-600 underline"
          >
            📱 View original reel
          </a>
        )}

        {/* ── Cooking Journal ────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">📸 Cooking journal</h2>
            <button
              onClick={() => setLogOpen(o => !o)}
              className="btn-primary py-1.5 px-3 text-sm"
            >
              {logOpen ? 'Cancel' : '+ Log a cook'}
            </button>
          </div>

          {/* Log form */}
          {logOpen && (
            <div className="card p-4 mb-4 space-y-3">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-stone-500 mb-1 block">Date</label>
                  <input
                    type="date"
                    className="input"
                    value={logDate}
                    onChange={e => setLogDate(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-stone-500 mb-1 block">Rating</label>
                  <div className="flex gap-1 pt-1">
                    {[1,2,3,4,5].map(n => (
                      <button key={n} onClick={() => setLogRating(r => r === n ? 0 : n)}>
                        <span className={n <= logRating ? 'text-brand-500' : 'text-stone-300'}>★</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs text-stone-500 mb-1 block">Cooked with</label>
                <input
                  className="input"
                  placeholder="e.g. roomie, mom"
                  value={logWith}
                  onChange={e => setLogWith(e.target.value)}
                />
                <p className="text-xs text-stone-400 mt-0.5">Comma-separated names</p>
              </div>

              <div>
                <label className="text-xs text-stone-500 mb-1 block">Notes</label>
                <textarea
                  className="input min-h-[72px] resize-none"
                  placeholder="How did it go? Any tweaks?"
                  value={logNotes}
                  onChange={e => setLogNotes(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs text-stone-500 mb-1 block">Photo</label>
                <input
                  type="file"
                  accept="image/*"
                  className="text-sm text-stone-600"
                  onChange={e => setLogPhoto(e.target.files?.[0] ?? null)}
                />
              </div>

              <button onClick={saveLog} disabled={saving} className="btn-primary w-full">
                {saving ? 'Saving…' : 'Save log'}
              </button>
            </div>
          )}

          {/* Log list */}
          {logs.length === 0 ? (
            <p className="text-sm text-stone-400 text-center py-4">No cooks logged yet.</p>
          ) : (
            <div className="space-y-3">
              {logs.map(log => (
                <div key={log.id} className="card p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-sm font-medium">{formatDate(log.cooked_at)}</p>
                      {log.cooked_with.length > 0 && (
                        <p className="text-xs text-stone-400">with {log.cooked_with.join(', ')}</p>
                      )}
                    </div>
                    {log.rating && (
                      <span className="text-brand-500 text-sm">{'★'.repeat(log.rating)}{'☆'.repeat(5 - log.rating)}</span>
                    )}
                  </div>
                  {log.photo_url && (
                    <div className="relative h-40 rounded-xl overflow-hidden mb-2">
                      <Image src={log.photo_url} alt="cooked" fill className="object-cover" unoptimized />
                    </div>
                  )}
                  {log.notes && <p className="text-sm text-stone-600">{log.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Delete */}
        <button
          onClick={deleteRecipe}
          className="text-sm text-red-400 w-full text-center pt-2"
        >
          Delete recipe
        </button>
      </div>
    </div>
  )
}
