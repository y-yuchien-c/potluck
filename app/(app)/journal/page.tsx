'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CookingLog, Recipe } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import Image from 'next/image'
import Link from 'next/link'

interface LogWithRecipe extends CookingLog {
  recipe: Recipe
}

export default function JournalPage() {
  const supabase = createClient()
  const [logs,    setLogs]    = useState<LogWithRecipe[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('cooking_logs')
      .select('*, recipe:recipes(*)')
      .order('cooked_at', { ascending: false })
    setLogs((data as LogWithRecipe[]) ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  // Group by month
  const grouped = logs.reduce<Record<string, LogWithRecipe[]>>((acc, log) => {
    const month = new Date(log.cooked_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    ;(acc[month] = acc[month] ?? []).push(log)
    return acc
  }, {})

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-4xl animate-bounce">📸</div>
    </div>
  )

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-1 pt-2">📸 Journal</h1>
      <p className="text-sm text-stone-400 mb-5">Every dish you&apos;ve cooked</p>

      {logs.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <div className="text-5xl mb-3">🍽️</div>
          <p className="font-medium">No cooks logged yet</p>
          <p className="text-sm mt-1">Open a recipe and tap &quot;Log a cook&quot; after you&apos;ve made it!</p>
        </div>
      ) : (
        Object.entries(grouped).map(([month, monthLogs]) => (
          <div key={month} className="mb-6">
            <h2 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">{month}</h2>
            <div className="space-y-3">
              {monthLogs.map(log => (
                <Link key={log.id} href={`/recipes/${log.recipe_id}`} className="card block overflow-hidden active:scale-[0.98] transition-transform">
                  <div className="flex gap-3 p-3">
                    {/* Photo or placeholder */}
                    <div className="shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-stone-100">
                      {log.photo_url ? (
                        <Image src={log.photo_url} alt="" width={64} height={64} className="object-cover w-full h-full" unoptimized />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl">🍳</div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm line-clamp-1">{log.recipe?.title ?? 'Recipe'}</p>
                      <p className="text-xs text-stone-400 mt-0.5">{formatDate(log.cooked_at)}</p>

                      {log.cooked_with.length > 0 && (
                        <p className="text-xs text-stone-500 mt-0.5">with {log.cooked_with.join(', ')}</p>
                      )}

                      <div className="flex items-center gap-2 mt-1">
                        {log.rating && (
                          <span className="text-xs text-brand-500">{'★'.repeat(log.rating)}</span>
                        )}
                        {log.notes && (
                          <p className="text-xs text-stone-400 line-clamp-1 italic">&ldquo;{log.notes}&rdquo;</p>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
