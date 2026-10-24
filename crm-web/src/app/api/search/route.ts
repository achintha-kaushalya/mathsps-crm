import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Supabase credentials missing' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const { searchParams } = new URL(req.url)
    const query = (searchParams.get('q') || '').trim()

    if (!query) {
      return NextResponse.json({ students: [], leads: [], payments: [] })
    }

    const cleanCode = query.toUpperCase().replace(/\s+/g, '')
    const cleanDigits = query.replace(/\D/g, '')

    // 1. Search Students (PS code, Name, Phone/LMS)
    const stuOrs: string[] = [
      `ps_code.ilike.%${cleanCode}%`,
      `full_name.ilike.%${query}%`,
      `notes.ilike.%${query}%`
    ]
    if (cleanDigits) {
      stuOrs.push(`ps_code.ilike.PS${cleanDigits}%`)
      stuOrs.push(`ps_code.ilike.SM${cleanDigits}%`)
      stuOrs.push(`notes.ilike.%${cleanDigits}%`)
    }

    // 2. Search Leads (F-code, Phone, Student Name, Parent Name)
    const leadOrs: string[] = [
      `fcode.ilike.%${cleanCode}%`,
      `student_name.ilike.%${query}%`,
      `parent_name.ilike.%${query}%`,
      `comment.ilike.%${query}%`
    ]
    if (cleanDigits) {
      leadOrs.push(`phone.ilike.%${cleanDigits}%`)
      leadOrs.push(`second_phone.ilike.%${cleanDigits}%`)
      leadOrs.push(`fcode.ilike.F${cleanDigits}%`)
    }

    // 3. Search Households (Address, Parent Phone, Area)
    let matchedHouseholdIds: string[] = []
    if (query.length >= 3) {
      const { data: hhList } = await supabase
        .from('households')
        .select('id')
        .or(`parent_name.ilike.%${query}%,parent_phone.ilike.%${query}%,address.ilike.%${query}%,area.ilike.%${query}%`)
        .limit(15)
      
      if (hhList && hhList.length > 0) {
        matchedHouseholdIds = hhList.map(h => h.id)
      }
    }

    // Fetch queries in parallel
    const [studentsRes, leadsRes] = await Promise.all([
      supabase
        .from('students')
        .select('id, ps_code, full_name, grade, notes, household_id, household:households(parent_name, parent_phone, address, area)')
        .or(stuOrs.join(','))
        .limit(10),

      supabase
        .from('leads')
        .select('id, fcode, phone, student_name, parent_name, grade, status, comment')
        .or(leadOrs.join(','))
        .limit(10)
    ])

    let students = studentsRes.data || []
    
    // If households matched, also include students attached to them
    if (matchedHouseholdIds.length > 0) {
      const { data: hhStudents } = await supabase
        .from('students')
        .select('id, ps_code, full_name, grade, notes, household_id, household:households(parent_name, parent_phone, address, area)')
        .in('household_id', matchedHouseholdIds)
        .limit(8)
      
      if (hhStudents) {
        const existingIds = new Set(students.map(s => s.id))
        for (const s of hhStudents) {
          if (!existingIds.has(s.id)) {
            students.push(s)
          }
        }
      }
    }

    const leads = leadsRes.data || []

    return NextResponse.json({
      students: students.slice(0, 8),
      leads: leads.slice(0, 8)
    })
  } catch (err: any) {
    console.error('Omni-search error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
