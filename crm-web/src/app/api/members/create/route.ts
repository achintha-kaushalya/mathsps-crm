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
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

    // 0. Authenticate admin user from session cookies
    const cookieHeader = request.headers.get('cookie') || ''
    const supabaseUserClient = createServerClient(supabaseUrl, anonKey, {
      cookies: {
        getAll() {
          return cookieHeader.split(';').map(c => {
            const [n, ...val] = c.trim().split('=')
            return { name: n, value: val.join('=') }
          }).filter(c => c.name && c.value)
        },
        setAll() {}
      }
    })

    const { data: { user: callingUser } } = await supabaseUserClient.auth.getUser()
    if (!callingUser) {
      return NextResponse.json({ error: 'Unauthorized. Please login as Admin.' }, { status: 401 })
    }

    const callingEmail = callingUser.email || ''
    const callingRole = callingUser.user_metadata?.role || (callingEmail.includes('admin') ? 'admin' : 'member')
    if (callingRole !== 'admin' && callingRole !== 'owner' && !callingEmail.includes('admin')) {
      return NextResponse.json({ error: 'Permission denied. Admin privileges required.' }, { status: 403 })
    }

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
    const isCustomSubRole = ['callcenter', 'payments'].includes(role)
    const dbRole = isCustomSubRole ? 'member' : (role || 'member')
    const notesData = isCustomSubRole ? JSON.stringify({ sub_role: role }) : null

    const { error: dbError } = await supabaseAdmin.from('members').upsert({
      name: name.trim(),
      email: email.trim(),
      role: dbRole,
      notes: notesData,
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
