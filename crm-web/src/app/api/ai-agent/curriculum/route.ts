import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { DEFAULT_GRADE_COURSES, DEFAULT_STANDALONE_COURSES, CourseConfig } from '@/lib/courses'

export const dynamic = 'force-dynamic'

const STANDARD_BANK_DETAILS = `🏛️ *MathsPS — ගාස්තු ගෙවීම් සඳහා බැංකු ගිණුම් විස්තර*

ගිණුම් හිමියාගේ නම: *P. S. Perera / MathsPS*

1️⃣ *Bank of Ceylon (BOC)*
• ගිණුම් අංකය: *XXXXXXXXXX*
• ශාඛාව: *Kandy City*

2️⃣ *Commercial Bank*
• ගිණුම් අංකය: *XXXXXXXXXX*
• ශාඛාව: *Kandy*

3️⃣ *Sampath Bank*
• ගිණුම් අංකය: *XXXXXXXXXX*
• ශාඛාව: *Peradeniya*

📸 මුදල් ගෙවූ පසු ලදුපත (Payment Slip) හෝ Online Receipt එක මෙම WhatsApp අංකයටම හෝ අපගේ CRM පද්ධතියට එවන්න.`

/**
 * GET /api/ai-agent/curriculum
 * Secure, read-only Curriculum Knowledge API for MathsPS AI Agents (Voice Bridge & WhatsApp).
 * 
 * ZERO-TRUST SECURITY:
 * Exposes ONLY publicly shareable course titles, schedules, fees, flyers, and bank details.
 * Contains ZERO access or references to students, payments, user accounts, or financial ledgers.
 */
export async function GET() {
  try {
    let gradeCourses: Record<number, CourseConfig[]> = DEFAULT_GRADE_COURSES
    let standaloneCourses: CourseConfig[] = DEFAULT_STANDALONE_COURSES

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (supabaseUrl && serviceKey) {
      const supabase = createClient(supabaseUrl, serviceKey)
      const { data: adminRecord } = await supabase
        .from('members')
        .select('notes')
        .in('role', ['admin', 'owner'])
        .limit(1)
        .maybeSingle()

      if (adminRecord?.notes) {
        try {
          const notesObj = JSON.parse(adminRecord.notes)
          if (notesObj.grade_courses) {
            gradeCourses = notesObj.grade_courses
          }
          if (notesObj.standalone_courses) {
            standaloneCourses = notesObj.standalone_courses
          }
        } catch {}
      }
    }

    // Flatten all active courses into a clean, unified curriculum list
    const allCourses: Array<{
      code: string
      name: string
      grade?: number
      fee: number
      billingType: string
      notes: string
      flyerUrl: string | null
      isStandalone: boolean
    }> = []

    // 1. Grade-aligned courses
    Object.entries(gradeCourses).forEach(([gradeStr, list]) => {
      const g = Number(gradeStr)
      if (Array.isArray(list)) {
        list.forEach(c => {
          allCourses.push({
            code: c.code,
            name: c.name,
            grade: g,
            fee: c.defaultFee,
            billingType: c.billingType || 'MONTHLY',
            notes: c.description || `Grade ${g} Mathematics Course.`,
            flyerUrl: c.flyerUrl || null,
            isStandalone: false
          })
        })
      }
    })

    // 2. Standalone courses
    if (Array.isArray(standaloneCourses)) {
      standaloneCourses.forEach(c => {
        allCourses.push({
          code: c.code,
          name: c.name,
          grade: c.grade,
          fee: c.defaultFee,
          billingType: c.billingType || 'ONE_TIME',
          notes: c.description || 'Specialist Mathematics Masterclass.',
          flyerUrl: c.flyerUrl || null,
          isStandalone: true
        })
      })
    }

    return NextResponse.json({
      success: true,
      academy: {
        name: 'MathsPS',
        tutor: 'Prabuddha Sampath Sir (B.Sc.)',
        grades: 'Grade 5 to 11',
        bankDetails: STANDARD_BANK_DETAILS
      },
      courses: allCourses,
      timestamp: new Date().toISOString()
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
      }
    })
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message
    }, { status: 500 })
  }
}
