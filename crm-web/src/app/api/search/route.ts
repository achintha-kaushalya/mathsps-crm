import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/guard'

// Simple in-memory user-scoped cache to give fast response while avoiding cross-tenant leaks
const searchCache = new Map<string, { data: any; exp: number }>()

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req)
    if ('errorResponse' in authResult) return authResult.errorResponse
    const { auth } = authResult

    const { searchParams } = new URL(req.url)
    const query = (searchParams.get('q') || '').trim()

    if (!query || query.length < 2) {
      return NextResponse.json({ students: [], leads: [] })
    }

    if (query.length > 50) {
      return NextResponse.json({ error: 'Search query too long' }, { status: 400 })
    }

    // Determine permissions BEFORE cache lookup
    const canAccessStudents = auth.canViewAll || auth.role === 'admin' || auth.role === 'owner' || auth.role === 'payments'
    const memberName = auth.member?.name || auth.user.email
    const scopedAssignees = auth.canViewAll ? [] : Array.from(new Set([memberName, ...(auth.allowedMembers || [])])).sort()

    // Cache key includes user permissions and scope signature to prevent permission leakage
    const cacheKey = `${auth.user.id}:${canAccessStudents ? 'all-stu' : 'no-stu'}:${scopedAssignees.join(',')}:${query.toLowerCase()}`
    const cached = searchCache.get(cacheKey)
    if (cached && cached.exp > Date.now()) {
      return NextResponse.json(cached.data, {
        headers: { 'Cache-Control': 'private, no-cache, no-store' }
      })
    }

    const supabase = auth.supabaseAdmin

    const cleanCode = query.toUpperCase().replace(/\s+/g, '')
    const cleanDigits = query.replace(/\D/g, '')

    // Fast indexed candidate filters:
    // 1. Direct match on PS Code / Prefix
    const isCodeSearch = /^[A-Za-z]{1,3}\d+$/i.test(cleanCode) || /^\d+$/.test(cleanDigits)

    // Build ultra-fast OR filter for students
    const stuFilters: string[] = []
    if (isCodeSearch) {
      stuFilters.push(`ps_code.ilike.${cleanCode}%`)
      if (cleanDigits) {
        stuFilters.push(`ps_code.ilike.PS${cleanDigits}%`)
        stuFilters.push(`ps_code.ilike.SM${cleanDigits}%`)
      }
    } else {
      stuFilters.push(`full_name.ilike.%${query}%`)
      stuFilters.push(`ps_code.ilike.${cleanCode}%`)
      if (cleanDigits.length >= 4) {
        stuFilters.push(`notes.ilike.%${cleanDigits}%`)
      }
    }

    // Build fast OR filter for leads
    const leadFilters: string[] = []
    if (isCodeSearch) {
      leadFilters.push(`fcode.ilike.${cleanCode}%`)
      if (cleanDigits) {
        leadFilters.push(`fcode.ilike.F${cleanDigits}%`)
        if (cleanDigits.length >= 4) {
          leadFilters.push(`phone.ilike.%${cleanDigits}%`)
        }
      }
    } else {
      leadFilters.push(`student_name.ilike.%${query}%`)
      leadFilters.push(`parent_name.ilike.%${query}%`)
      leadFilters.push(`fcode.ilike.${cleanCode}%`)
      if (cleanDigits.length >= 4) {
        leadFilters.push(`phone.ilike.%${cleanDigits}%`)
      }
    }

    // Build lead query with staff assignment scoping (enforces RBAC)
    let leadQuery = supabase
      .from('leads')
      .select('id, fcode, raw_phone, grade, status')
      .or(leadFilters.slice(0, 4).join(','))

    if (!auth.canViewAll && scopedAssignees.length > 0) {
      leadQuery = leadQuery.in('assigned_member', scopedAssignees)
    }

    // Execute queries safely: Unauthorized roles SKIP student database execution entirely
    const studentPromise = canAccessStudents
      ? supabase
          .from('students')
          .select('id, ps_code, full_name, grade')
          .or(stuFilters.slice(0, 4).join(','))
          .order('ps_code', { ascending: true })
          .limit(6)
      : Promise.resolve({ data: [] as any[] })

    const [studentsRes, leadsRes] = await Promise.all([
      studentPromise,
      leadQuery.order('fcode', { ascending: true }).limit(6)
    ])

    const responseData = {
      students: studentsRes.data || [],
      leads: leadsRes.data || []
    }

    // Cache results for 15 seconds
    if (searchCache.size > 200) {
      searchCache.clear()
    }
    searchCache.set(cacheKey, { data: responseData, exp: Date.now() + 15000 })

    return NextResponse.json(responseData, {
      headers: { 'Cache-Control': 'private, no-cache, no-store' }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Search Error' }, { status: 500 })
  }
}
