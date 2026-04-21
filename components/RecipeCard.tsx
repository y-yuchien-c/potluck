import Link from 'next/link'
import Image from 'next/image'
import { Recipe } from '@/lib/types'
import { CUISINE_LABELS } from '@/lib/utils'

interface Props {
  recipe: Recipe
}

export default function RecipeCard({ recipe }: Props) {
  return (
    <Link href={`/recipes/${recipe.id}`} className="card block overflow-hidden active:scale-[0.98] transition-transform">
      {recipe.thumbnail_url ? (
        <div className="relative h-36 w-full bg-stone-100">
          <Image
            src={recipe.thumbnail_url}
            alt={recipe.title}
            fill
            className="object-cover"
            unoptimized
          />
        </div>
      ) : (
        <div className="h-36 bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center text-4xl">
          🍳
        </div>
      )}

      <div className="p-3">
        <h3 className="font-semibold text-stone-900 leading-snug line-clamp-2 mb-2">
          {recipe.title}
        </h3>

        <div className="flex flex-wrap gap-1">
          {recipe.cuisine_tags.slice(0, 3).map(tag => (
            <span key={tag} className="tag bg-brand-50 text-brand-700">
              {CUISINE_LABELS[tag]}
            </span>
          ))}
          {recipe.household_id && (
            <span className="tag bg-blue-50 text-blue-600">🏠 Shared</span>
          )}
        </div>

        {recipe.cook_time && (
          <p className="text-xs text-stone-400 mt-2">⏱ {recipe.cook_time}</p>
        )}
      </div>
    </Link>
  )
}
