import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const isAuthPage = request.nextUrl.pathname.startsWith('/login')
  const pathname = request.nextUrl.pathname

  // 1. Verify user authenticity directly with Supabase Auth
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  // 2. Unauthenticated users -> Redirect to /login
  if ((userError || !user) && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 3. Authenticated users visiting /login -> Redirect to /dashboard
  if (user && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // 4. Role-Based Access Control (RBAC)
  if (user) {
    const email = user.email
    let userRole = user.user_metadata?.role || 'member'

    // Fetch database member notes for sub_role fallback
    if (email) {
      const { data: dbMem } = await supabase.from('members').select('role, notes').eq('email', email).single()
      if (dbMem) {
        if (dbMem.role) userRole = dbMem.role
        try {
          if (dbMem.notes) {
            const perms = JSON.parse(dbMem.notes)
            if (perms.sub_role) userRole = perms.sub_role
          }
        } catch {}
      }
    }

    // Admin-only routes (Dashboard is open to all authenticated staff)
    const isAdminOnlyRoute = pathname.startsWith('/reports') ||
                             pathname.startsWith('/members')

    if (userRole !== 'admin' && userRole !== 'owner' && isAdminOnlyRoute) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Call Center role: CRM system only (block payment routes /students, /payments, /delivery)
    if (userRole === 'callcenter') {
      const isPaymentRoute = pathname.startsWith('/students') ||
                             pathname.startsWith('/payments') ||
                             pathname.startsWith('/delivery')
      if (isPaymentRoute) {
        return NextResponse.redirect(new URL('/leads', request.url))
      }
    }

    // Payments role: Payment system only (block CRM routes /leads)
    if (userRole === 'payments') {
      const isCrmRoute = pathname.startsWith('/leads')
      if (isCrmRoute) {
        return NextResponse.redirect(new URL('/students', request.url))
      }
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
