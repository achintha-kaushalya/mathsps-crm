import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'Lead ID required' }, { status: 400 })

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // 1. Authenticate calling user session from cookies
    const cookieHeader = request.headers.get('cookie') || ''
    const supabaseUserClient = createServerClient(supabaseUrl, anonKey, {
      cookies: {
        getAll() {
          return cookieHeader.split(';').map(c => {
            const [name, ...val] = c.trim().split('=')
            return { name, value: val.join('=') }
          }).filter(c => c.name && c.value)
        },
        setAll() {}
      }
    })

    const { data: { user } } = await supabaseUserClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please login.' }, { status: 401 })
    }

    // Direct supabase-js client with service role key to perform deletion
    const supabaseAdmin = createClient(supabaseUrl, serviceKey)

    const { error } = await supabaseAdmin.from('leads').delete().eq('id', id)
    if (error) {
      console.error('Delete DB error:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, id })
  } catch (e: any) {
    console.error('Delete server error:', e)
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 })
  }
}
