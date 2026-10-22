import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { ZodSchema, ZodError } from 'zod'

export type UserRole = 'admin' | 'owner' | 'call_center' | 'payments' | 'member' | string

export interface AuthContext {
  user: {
    id: string
    email: string
    user_metadata?: Record<string, any>
  }
  member: {
    id: string
    name: string
    email: string
    role: string
    active: boolean
    notes?: string | null
  } | null
  role: UserRole
  subRole: string
  allowedMembers: string[]
  canViewAll: boolean
  isAdmin: boolean
  supabaseAdmin: SupabaseClient
}

/**
 * Standard API error response generator
 */
export function apiError(message: string, status = 400, details?: any) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      ...(details ? { details } : {})
    },
    { status }
  )
}

/**
 * Standard API success response generator
 */
export function apiSuccess<T>(data: T, status = 200, meta?: Record<string, any>) {
  return NextResponse.json(
    {
      success: true,
      data,
      ...(meta ? { meta } : {})
    },
    { status }
  )
}

/**
 * Validates request payload against a Zod schema.
 * Throws or returns typed data.
 */
export async function validateBody<T>(req: Request, schema: ZodSchema<T>): Promise<{ data: T } | { errorResponse: NextResponse }> {
  try {
    const raw = await req.json()
    const parsed = schema.safeParse(raw)
    if (!parsed.success) {
      const fieldErrors = (parsed.error as ZodError).flatten()
      return {
        errorResponse: apiError('Validation failed', 422, fieldErrors)
      }
    }
    return { data: parsed.data }
  } catch {
    return {
      errorResponse: apiError('Invalid JSON payload in request body', 400)
    }
  }
}

/**
 * Verifies caller session and ensures they possess an authorized role.
 * Automatically injects an authenticated service_role Supabase client.
 */
export async function requireAuth(
  req?: Request,
  allowedRoles?: UserRole[]
): Promise<{ auth: AuthContext } | { errorResponse: NextResponse }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return {
      errorResponse: apiError('Server environment configuration missing', 500)
    }
  }

  // 1. Authenticate session with Supabase Auth
  let user = null

  try {
    const cookieStore = await cookies()
    const authClient = createServerClient(supabaseUrl, anonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {}
      }
    })
    const { data } = await authClient.auth.getUser()
    user = data.user
  } catch {
    if (req) {
      const cookieHeader = req.headers.get('cookie') || ''
      const authClient = createServerClient(supabaseUrl, anonKey, {
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
      const { data } = await authClient.auth.getUser()
      user = data.user
    }
  }

  if (!user || !user.email) {
    return {
      errorResponse: apiError('Unauthorized. Please log in.', 401)
    }
  }

  // 2. Instantiate elevated service role client for backend operations
  class DummyWs {}
  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
    realtime: { transport: DummyWs as any }
  })

  // 3. Resolve true role from members table
  const { data: member } = await supabaseAdmin
    .from('members')
    .select('id, name, email, role, notes, active')
    .eq('email', user.email)
    .single()

  if (member && member.active === false) {
    return {
      errorResponse: apiError('Account deactivated. Contact system administrator.', 403)
    }
  }

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

  // 4. Role Authorization check
  if (allowedRoles && allowedRoles.length > 0) {
    const hasRole = allowedRoles.includes(role) || isAdmin
    if (!hasRole) {
      return {
        errorResponse: apiError(
          `Forbidden: Insufficient permissions. Required: [${allowedRoles.join(', ')}]`,
          403
        )
      }
    }
  }

  return {
    auth: {
      user: {
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata
      },
      member: member || null,
      role,
      subRole,
      allowedMembers,
      canViewAll,
      isAdmin,
      supabaseAdmin
    }
  }
}
