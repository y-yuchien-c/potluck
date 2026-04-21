'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Household, HouseholdMember } from '@/lib/types'

interface HouseholdWithMembers extends Household {
  members: HouseholdMember[]
}

export default function HouseholdPage() {
  const supabase = createClient()

  const [households,   setHouseholds]   = useState<HouseholdWithMembers[]>([])
  const [loading,      setLoading]      = useState(true)
  const [tab,          setTab]          = useState<'mine' | 'create' | 'join'>('mine')
  const [newName,      setNewName]      = useState('')
  const [inviteCode,   setInviteCode]   = useState('')
  const [working,      setWorking]      = useState(false)
  const [error,        setError]        = useState('')
  const [successMsg,   setSuccessMsg]   = useState('')

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: members } = await supabase
      .from('household_members')
      .select('household_id, households(id, name, invite_code, created_by, created_at)')
      .eq('user_id', user.id)

    if (!members) { setLoading(false); return }

    const householdIds = members.map((m: { household_id: string }) => m.household_id)

    const { data: allMembers } = await supabase
      .from('household_members')
      .select('*')
      .in('household_id', householdIds)

    // Supabase returns the joined table as array or object depending on relationship type;
    // we cast via unknown to avoid the inference mismatch.
    const hs: HouseholdWithMembers[] = (members as unknown as { household_id: string; households: Household | null }[])
      .map(m => ({
        ...(m.households as Household),
        members: (allMembers ?? []).filter((a: HouseholdMember) => a.household_id === m.household_id),
      }))
      .filter((h): h is HouseholdWithMembers => !!h.id)

    setHouseholds(hs)
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function createHousehold() {
    if (!newName.trim()) return
    setWorking(true)
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not logged in')

      const { data: hh, error: hhErr } = await supabase
        .from('households')
        .insert({ name: newName.trim(), created_by: user.id })
        .select()
        .single()
      if (hhErr) throw hhErr

      await supabase.from('household_members').insert({
        household_id: hh.id,
        user_id: user.id,
        role: 'admin',
        display_name: user.user_metadata?.display_name ?? user.email,
      })

      setSuccessMsg(`Created "${hh.name}"! Share the invite code: ${hh.invite_code}`)
      setNewName('')
      setTab('mine')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create')
    } finally {
      setWorking(false)
    }
  }

  async function joinHousehold() {
    const code = inviteCode.trim().toUpperCase()
    if (!code) return
    setWorking(true)
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not logged in')

      const { data: hh } = await supabase
        .from('households')
        .select('id, name')
        .eq('invite_code', code)
        .maybeSingle()

      if (!hh) throw new Error('Invite code not found — double-check it!')

      const { error: joinErr } = await supabase.from('household_members').insert({
        household_id: hh.id,
        user_id: user.id,
        role: 'member',
        display_name: user.user_metadata?.display_name ?? user.email,
      })
      if (joinErr && joinErr.code !== '23505') throw joinErr  // 23505 = already a member

      setSuccessMsg(`Joined "${hh.name}"! You can now see shared recipes.`)
      setInviteCode('')
      setTab('mine')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join')
    } finally {
      setWorking(false)
    }
  }

  async function leaveHousehold(hid: string, name: string) {
    if (!confirm(`Leave "${name}"?`)) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('household_members').delete()
      .eq('household_id', hid).eq('user_id', user.id)
    await load()
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-1 pt-2">🏠 Household</h1>
      <p className="text-sm text-stone-400 mb-5">Cook and plan together</p>

      {successMsg && (
        <div className="card p-3 mb-4 bg-green-50 border-green-200">
          <p className="text-sm text-green-700">{successMsg}</p>
          <button onClick={() => setSuccessMsg('')} className="text-xs text-green-500 mt-1">Dismiss</button>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex rounded-xl bg-stone-100 p-1 mb-5">
        {(['mine', 'create', 'join'] as const).map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setError('') }}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all capitalize ${tab === t ? 'bg-white shadow text-stone-900' : 'text-stone-500'}`}
          >
            {t === 'mine' ? 'My households' : t === 'create' ? 'Create' : 'Join'}
          </button>
        ))}
      </div>

      {/* My households */}
      {tab === 'mine' && (
        <div>
          {loading ? (
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => <div key={i} className="card h-24 animate-pulse bg-stone-100" />)}
            </div>
          ) : households.length === 0 ? (
            <div className="text-center py-12 text-stone-400">
              <div className="text-5xl mb-3">🏠</div>
              <p className="font-medium">No households yet</p>
              <p className="text-sm mt-1">Create one or join with an invite code</p>
            </div>
          ) : (
            <div className="space-y-3">
              {households.map(hh => (
                <div key={hh.id} className="card p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold">{hh.name}</h3>
                      <p className="text-xs text-stone-400 mt-0.5">{hh.members.length} member{hh.members.length !== 1 ? 's' : ''}</p>
                    </div>
                    <button
                      onClick={() => leaveHousehold(hh.id, hh.name)}
                      className="text-xs text-stone-300 hover:text-red-400 transition-colors"
                    >
                      Leave
                    </button>
                  </div>

                  {/* Invite code */}
                  <div className="bg-stone-50 rounded-lg px-3 py-2 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-stone-400">Invite code</p>
                      <p className="font-mono font-bold text-lg tracking-widest text-brand-600">{hh.invite_code}</p>
                    </div>
                    <button
                      onClick={() => navigator.clipboard?.writeText(hh.invite_code)}
                      className="btn-secondary py-1.5 px-3 text-xs"
                    >
                      Copy
                    </button>
                  </div>

                  {/* Members */}
                  {hh.members.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-stone-400 mb-1">Members</p>
                      <div className="flex flex-wrap gap-1.5">
                        {hh.members.map(m => (
                          <span key={m.id} className="tag bg-stone-100 text-stone-600 capitalize">
                            {m.display_name ?? 'Member'}
                            {m.role === 'admin' && ' 👑'}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create household */}
      {tab === 'create' && (
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold">Create a household</h2>
          <div>
            <label className="text-xs text-stone-500 mb-1 block">Household name</label>
            <input
              className="input"
              placeholder="e.g. Our Apartment 🏠"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createHousehold()}
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button onClick={createHousehold} disabled={working || !newName.trim()} className="btn-primary w-full">
            {working ? 'Creating…' : 'Create household'}
          </button>
          <p className="text-xs text-stone-400 text-center">
            You&apos;ll get an invite code to share with your roommate
          </p>
        </div>
      )}

      {/* Join household */}
      {tab === 'join' && (
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold">Join with invite code</h2>
          <div>
            <label className="text-xs text-stone-500 mb-1 block">Invite code</label>
            <input
              className="input font-mono text-center text-xl tracking-widest uppercase"
              placeholder="ABC12345"
              value={inviteCode}
              onChange={e => setInviteCode(e.target.value.toUpperCase())}
              maxLength={8}
              onKeyDown={e => e.key === 'Enter' && joinHousehold()}
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button onClick={joinHousehold} disabled={working || inviteCode.length < 6} className="btn-primary w-full">
            {working ? 'Joining…' : 'Join household'}
          </button>
        </div>
      )}
    </div>
  )
}
