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

  const { data: { session } } = await supabase.auth.getSession()

  // 1. Unauthenticated users -> Redirect to /login
  if (!session && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 2. Authenticated users visiting /login -> Redirect to appropriate home page
  if (session && isAuthPage) {
    const userRole = session.user.user_metadata?.role || (session.user.email?.includes('admin') ? 'admin' : 'member')
    if (userRole === 'payments') {
      return NextResponse.redirect(new URL('/students', request.url))
    }
    return NextResponse.redirect(new URL('/leads', request.url))
  }

  // 3. Role-Based Access Control (RBAC)
  if (session) {
    const email = session.user.email
    let userRole = session.user.user_metadata?.role || (email?.includes('admin') ? 'admin' : 'member')

    // Fetch database member notes for sub_role fallback
    if (email && (userRole === 'member' || !userRole)) {
      const { data: dbMem } = await supabase.from('members').select('role, notes').eq('email', email).single()
      if (dbMem) {
        try {
          if (dbMem.notes) {
            const perms = JSON.parse(dbMem.notes)
            if (perms.sub_role) userRole = perms.sub_role
          }
        } catch {}
      }
    }

    // Admin-only routes
    const isAdminOnlyRoute = pathname.startsWith('/dashboard') ||
                             pathname.startsWith('/reports') ||
                             pathname.startsWith('/members')

    if (userRole !== 'admin' && userRole !== 'owner' && isAdminOnlyRoute) {
      if (userRole === 'payments') {
        return NextResponse.redirect(new URL('/students', request.url))
      }
      return NextResponse.redirect(new URL('/leads', request.url))
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
