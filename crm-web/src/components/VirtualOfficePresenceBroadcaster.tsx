'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function VirtualOfficePresenceBroadcaster() {
  const supabase = createClient()

  useEffect(() => {
    let presenceChannel: any = null

    async function startPresence() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let memberName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'staff'
      const { data: dbMem } = await supabase.from('members').select('name').eq('email', user.email).single()
      if (dbMem?.name) memberName = dbMem.name

      presenceChannel = supabase.channel('online_hq_workers', {
        config: { presence: { key: user.id } }
      })

      presenceChannel
        .subscribe(async (status: string) => {
          if (status === 'SUBSCRIBED') {
            await presenceChannel.track({
              user_id: user.id,
              email: user.email,
              name: memberName,
              online_at: new Date().toISOString()
            })
          }
        })
    }

    startPresence()

    return () => {
      if (presenceChannel) {
        presenceChannel.untrack()
        supabase.removeChannel(presenceChannel)
      }
    }
  }, [])

  return null
}
