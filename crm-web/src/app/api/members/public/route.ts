import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabaseAdmin = createClient(supabaseUrl, serviceKey)

    // Return active public staff profiles for login selector (safe public fields only)
    const { data: members, error } = await supabaseAdmin
      .from('members')
      .select('id, name, email, role, active, notes')
      .eq('active', true)
      .order('name', { ascending: true })

    if (error) {
      return NextResponse.json({ members: [] }, { status: 500 })
    }

    const filtered = (members || []).filter(m => m.email && m.name !== 'admin@mathsps.com')

    return NextResponse.json({ members: filtered })
  } catch (err: any) {
    return NextResponse.json({ members: [] }, { status: 500 })
  }
}
