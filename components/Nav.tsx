'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/recipes',   label: 'Recipes',  icon: '📖' },
  { href: '/planner',   label: 'Planner',  icon: '📅' },
  { href: '/journal',   label: 'Journal',  icon: '📸' },
  { href: '/household', label: 'Household', icon: '🏠' },
]

export default function Nav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-100 pb-safe z-50">
      <div className="flex justify-around max-w-md mx-auto">
        {NAV_ITEMS.map(item => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-0.5 py-2 px-4 text-xs font-medium transition-colors',
                active ? 'text-brand-600' : 'text-stone-400'
              )}
            >
              <span className="text-xl">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
