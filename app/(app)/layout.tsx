export const dynamic = 'force-dynamic'

import Nav from '@/components/Nav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-md mx-auto min-h-screen pb-24">
      {children}
      <Nav />
    </div>
  )
}
