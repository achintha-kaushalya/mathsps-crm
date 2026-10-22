import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Server-side helper to get authenticated user session and role.
 * Verifies with Supabase Auth (getUser) and retrieves official role from the `members` table.
 */
export async function getServerUser() {
  const cookieStore = await cookies()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll() {}
    }
  })

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user || !user.email) {
    return { user: null, member: null, role: null, isAdmin: false }
  }

  // Query member row for true role and sub_role
  const { data: member } = await supabase
    .from('members')
    .select('id, name, email, role, notes, active')
    .eq('email', user.email)
    .single()

  let effectiveRole = member?.role || 'member'
  let subRole = ''
  let allowedMembers: string[] = []
  let canViewAll = effectiveRole === 'admin' || effectiveRole === 'owner'

  if (member?.notes) {
    try {
      const perms = JSON.parse(member.notes)
      if (perms.sub_role) subRole = perms.sub_role
      if (perms.allowed_members) allowedMembers = perms.allowed_members
      if (perms.can_view_all !== undefined) canViewAll = perms.can_view_all
    } catch {}
  }

  const role = subRole || effectiveRole
  const isAdmin = role === 'admin' || role === 'owner'

  return {
    user,
    member,
    role,
    subRole,
    allowedMembers,
    canViewAll,
    isAdmin
  }
}
