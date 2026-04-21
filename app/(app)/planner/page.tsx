'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Recipe, MealType, MealPlanSlot } from '@/lib/types'
import { DAY_LABELS, MEAL_TYPE_LABELS, getWeekStart } from '@/lib/utils'
import { addDays, format, subWeeks, addWeeks } from 'date-fns'

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

interface SlotKey { day: number; meal: MealType }

export default function PlannerPage() {
  const supabase = createClient()

  const [weekStart, setWeekStart] = useState(getWeekStart())
  const [recipes,   setRecipes]   = useState<Recipe[]>([])
  const [slots,     setSlots]     = useState<Record<string, MealPlanSlot & { recipe: Recipe }>>({})
  const [planId,    setPlanId]    = useState<string | null>(null)
  const [picker,    setPicker]    = useState<SlotKey | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [shareLink, setShareLink] = useState<string | null>(null)

  const slotKey = (day: number, meal: MealType) => `${day}-${meal}`

  const loadPlan = useCallback(async () => {
    setLoading(true)
    const weekStr = format(weekStart, 'yyyy-MM-dd')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Load all recipes for picker
    const { data: recipeData } = await supabase.from('recipes').select('*').order('title')
    setRecipes((recipeData as Recipe[]) ?? [])

    // Load or create meal plan
    let { data: plan } = await supabase
      .from('meal_plans')
      .select('id')
      .eq('user_id', user.id)
      .eq('week_start', weekStr)
      .maybeSingle()

    if (!plan) {
      const { data: newPlan } = await supabase
        .from('meal_plans')
        .insert({ user_id: user.id, week_start: weekStr })
        .select('id')
        .single()
      plan = newPlan
    }

    setPlanId(plan?.id ?? null)

    // Load slots
    const { data: slotData } = await supabase
      .from('meal_plan_slots')
      .select('*, recipe:recipes(*)')
      .eq('meal_plan_id', plan?.id ?? '')

    const slotMap: Record<string, MealPlanSlot & { recipe: Recipe }> = {}
    for (const s of slotData ?? []) {
      slotMap[slotKey(s.day_of_week, s.meal_type)] = s
    }
    setSlots(slotMap)
    setLoading(false)
  }, [weekStart, supabase])

  useEffect(() => { loadPlan() }, [loadPlan])

  async function assignRecipe(recipe: Recipe) {
    if (!picker || !planId) return

    const key = slotKey(picker.day, picker.meal)
    const existing = slots[key]

    // Remove existing slot if any
    if (existing) {
      await supabase.from('meal_plan_slots').delete().eq('id', existing.id)
    }

    const { data } = await supabase
      .from('meal_plan_slots')
      .insert({ meal_plan_id: planId, day_of_week: picker.day, meal_type: picker.meal, recipe_id: recipe.id })
      .select('*, recipe:recipes(*)')
      .single()

    if (data) {
      setSlots(s => ({ ...s, [key]: data as MealPlanSlot & { recipe: Recipe } }))
    }
    setPicker(null)
  }

  async function removeSlot(day: number, meal: MealType) {
    const key = slotKey(day, meal)
    const slot = slots[key]
    if (!slot) return
    await supabase.from('meal_plan_slots').delete().eq('id', slot.id)
    setSlots(s => { const n = { ...s }; delete n[key]; return n })
  }

  function generateShareText() {
    const lines = [`🥘 Meal plan — week of ${format(weekStart, 'MMM d')}\n`]
    for (let d = 0; d < 7; d++) {
      const daySlots = MEAL_TYPES.map(m => slots[slotKey(d, m)]?.recipe?.title).filter(Boolean)
      if (daySlots.length > 0) {
        lines.push(`${DAY_LABELS[d]}: ${daySlots.join(', ')}`)
      }
    }
    const text = lines.join('\n')
    navigator.clipboard?.writeText(text)
    setShareLink(text)
  }

  const weekLabel = `${format(weekStart, 'MMM d')} – ${format(addDays(weekStart, 6), 'MMM d, yyyy')}`

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pt-2">
        <h1 className="text-2xl font-bold">📅 Planner</h1>
        <button onClick={generateShareText} className="btn-secondary py-1.5 px-3 text-sm">
          Share plan
        </button>
      </div>

      {/* Week nav */}
      <div className="flex items-center justify-between mb-4 bg-stone-100 rounded-xl p-2">
        <button onClick={() => setWeekStart(w => subWeeks(w, 1))} className="text-stone-500 px-2 text-lg">‹</button>
        <span className="text-sm font-medium">{weekLabel}</span>
        <button onClick={() => setWeekStart(w => addWeeks(w, 1))} className="text-stone-500 px-2 text-lg">›</button>
      </div>

      {shareLink && (
        <div className="card p-3 mb-4 bg-green-50 border-green-200">
          <p className="text-xs text-green-700 font-medium mb-1">Copied to clipboard!</p>
          <p className="text-xs text-green-600 whitespace-pre-wrap">{shareLink}</p>
          <button onClick={() => setShareLink(null)} className="text-xs text-green-500 mt-1">Dismiss</button>
        </div>
      )}

      {/* Day columns */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(7)].map((_, i) => <div key={i} className="card h-20 animate-pulse bg-stone-100" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {DAY_LABELS.map((day, d) => (
            <div key={d} className="card p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-stone-700">{day} <span className="text-stone-400 font-normal text-xs">{format(addDays(weekStart, d), 'MMM d')}</span></span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {MEAL_TYPES.map(meal => {
                  const slot = slots[slotKey(d, meal)]
                  return (
                    <div key={meal} className="shrink-0">
                      <p className="text-xs text-stone-400 mb-1">{MEAL_TYPE_LABELS[meal].split(' ')[0]}</p>
                      {slot ? (
                        <div className="relative bg-brand-50 border border-brand-200 rounded-lg px-2 py-1.5 min-w-[80px] max-w-[120px]">
                          <p className="text-xs font-medium text-brand-800 line-clamp-2 pr-3">{slot.recipe.title}</p>
                          <button
                            onClick={() => removeSlot(d, meal)}
                            className="absolute top-0.5 right-0.5 text-brand-300 text-xs"
                          >✕</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setPicker({ day: d, meal })}
                          className="bg-stone-50 border border-dashed border-stone-200 rounded-lg px-2 py-1.5 min-w-[80px] text-xs text-stone-300 hover:bg-stone-100 transition-colors"
                        >
                          + Add
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recipe picker modal */}
      {picker && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end" onClick={() => setPicker(null)}>
          <div className="bg-white w-full rounded-t-3xl max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-stone-100">
              <h3 className="font-semibold">
                Pick recipe — {DAY_LABELS[picker.day]} {MEAL_TYPE_LABELS[picker.meal]}
              </h3>
            </div>
            <div className="overflow-y-auto p-4 space-y-2">
              {recipes.map(r => (
                <button
                  key={r.id}
                  onClick={() => assignRecipe(r)}
                  className="w-full text-left card p-3 active:scale-[0.98] transition-transform"
                >
                  <p className="text-sm font-medium">{r.title}</p>
                  {r.cook_time && <p className="text-xs text-stone-400 mt-0.5">⏱ {r.cook_time}</p>}
                </button>
              ))}
              {recipes.length === 0 && (
                <p className="text-center text-stone-400 py-8">No recipes saved yet</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
