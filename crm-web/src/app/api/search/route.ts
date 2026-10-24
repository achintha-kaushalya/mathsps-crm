import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Simple in-memory LRU cache for 15 seconds to give instant <10ms responses on repeated/typing queries
const searchCache = new Map<string, { data: any; exp: number }>()

export async function GET(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Supabase credentials missing' }, { status: 500 })
    }

    const { searchParams } = new URL(req.url)
    const query = (searchParams.get('q') || '').trim()

    if (!query || query.length < 2) {
      return NextResponse.json({ students: [], leads: [] })
    }

    const cacheKey = query.toLowerCase()
    const cached = searchCache.get(cacheKey)
    if (cached && cached.exp > Date.now()) {
      return NextResponse.json(cached.data, {
        headers: { 'Cache-Control': 'public, max-age=15, stale-while-revalidate=30' }
      })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    })

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

    // Run parallel lightweight queries selecting ONLY minimal needed columns (no heavy relations)
    const [studentsRes, leadsRes] = await Promise.all([
      supabase
        .from('students')
        .select('id, ps_code, full_name, grade, notes')
        .or(stuFilters.slice(0, 4).join(','))
        .order('ps_code', { ascending: true })
        .limit(6),

      supabase
        .from('leads')
        .select('id, fcode, phone, student_name, parent_name, grade, status')
        .or(leadFilters.slice(0, 4).join(','))
        .order('fcode', { ascending: true })
        .limit(6)
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
      headers: { 'Cache-Control': 'public, max-age=15, stale-while-revalidate=30' }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Search Error' }, { status: 500 })
  }
}
