import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { DEFAULT_GRADE_COURSES, DEFAULT_STANDALONE_COURSES, CourseConfig } from '@/lib/courses'

export const dynamic = 'force-dynamic'

const STANDARD_BANK_DETAILS = `🏛️ *ප්‍රබුද්ධ සම්පත් — ගාස්තු ගෙවීම් සඳහා නිල බැංකු ගිණුම් විස්තර*

1️⃣ *Bank of Ceylon (BOC)*
• ගිණුම් අංකය: *76336481*
• නම: *A.M.P.S.Adikari*
• ශාඛාව: *Malkaduwawa*

2️⃣ *Hatton National Bank (HNB)*
• ගිණුම් අංකය: *040020010793*
• නම: *A.M.P.S.Adikari*
• ශාඛාව: *Chilaw*

3️⃣ *Sampath Bank*
• ගිණුම් අංකය: *100652635393*
• නම: *A.M.P.S.Adikari*
• ශාඛාව: *Kurunegala Super*

4️⃣ *Commercial Bank*
• ගිණුම් අංකය: *8160095026*
• නම: *L.M. Hettiarachchi*
• ශාඛාව: *Kurunegala*

📸 *මුදල් ගෙවූ රිසිට් පත මත "නම, වසර" ලියා 071-3527040 ට WhatsApp කරන්න.*`

/**
 * GET /api/ai-agent/curriculum
 * Secure, read-only Curriculum Knowledge API for Prabuddha Sampath AI Agents (Voice Bridge & WhatsApp).
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
      let { data: adminRecord } = await supabase
        .from('members')
        .select('notes')
        .eq('name', 'Admin User')
        .maybeSingle()

      if (!adminRecord) {
        const res = await supabase
          .from('members')
          .select('notes')
          .in('role', ['admin', 'owner'])
          .limit(1)
          .maybeSingle()
        adminRecord = res.data
      }

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
      groupLink?: string | null
      isStandalone: boolean
    }> = []

    // 1. Grade-aligned courses
    Object.entries(gradeCourses).forEach(([gradeStr, list]) => {
      const g = Number(gradeStr)
      if (Array.isArray(list)) {
        list.forEach((c: any) => {
          allCourses.push({
            code: c.code,
            name: c.name,
            grade: g,
            fee: c.defaultFee,
            billingType: c.billingType || 'MONTHLY',
            notes: c.description || `Grade ${g} Mathematics Course.`,
            flyerUrl: c.flyerUrl || null,
            groupLink: c.groupLink || null,
            isStandalone: false
          })
        })
      }
    })

    // 2. Standalone courses
    if (Array.isArray(standaloneCourses)) {
      standaloneCourses.forEach((c: any) => {
        allCourses.push({
          code: c.code,
          name: c.name,
          grade: c.grade,
          fee: c.defaultFee,
          billingType: c.billingType || 'ONE_TIME',
          notes: c.description || 'Specialist Mathematics Masterclass.',
          flyerUrl: c.flyerUrl || null,
          groupLink: c.groupLink || null,
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
        bankDetails: STANDARD_BANK_DETAILS,
        socialLinks: {
          website: 'https://www.prabuddhamaths.com',
          facebook: 'https://www.facebook.com/PrabuddhaMaths',
          youtube: 'https://www.youtube.com/@prabuddhasampath4505',
          tiktok: 'https://www.tiktok.com/@prabuddhasampath?is_from_webapp=1&sender_device=pc',
          whatsappHotline: '0779649617',
          directCall: '0711826117',
          slipWhatsApp: '071-3527040'
        }
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
