import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const { name, email, password, role } = json

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required.' }, { status: 400 })
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

    // Use Service Role client to create Auth user directly
    const supabaseAdmin = createServerClient(supabaseUrl, serviceKey, {
      cookies: { getAll() { return [] }, setAll() {} }
    })

    // 1. Create Supabase Auth User
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name, role: role || 'member' }
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // 2. Insert or update in database members table
    const { error: dbError } = await supabaseAdmin.from('members').upsert({
      name: name.trim(),
      email: email.trim(),
      role: role || 'member',
      active: true,
    }, { onConflict: 'name' })

    if (dbError) {
      console.error('DB Member Error:', dbError)
    }

    return NextResponse.json({ success: true, user: authData.user })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 })
  }
}
