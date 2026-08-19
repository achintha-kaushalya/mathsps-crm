import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'Lead ID required' }, { status: 400 })

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // Direct supabase-js client with service role key to guarantee admin delete permissions
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
