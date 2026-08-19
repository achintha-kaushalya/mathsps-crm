import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false }
    })

    const url = new URL(req.url)
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')

    // Fetch all leads using exact count and pagination (1000 per page)
    let allLeads: { assigned_member: string | null; grade: string | null; status: string; campaign: string | null; date_added: string | null }[] = []
    const pageSize = 1000

    // First request to get total count and first batch
    let query = supabase
      .from('leads')
      .select('assigned_member,grade,status,campaign,date_added', { count: 'exact' })

    if (startDate) query = query.gte('date_added', startDate)
    if (endDate) query = query.lte('date_added', endDate)

    const { data: firstBatch, count: totalCount, error: firstError } = await query.range(0, pageSize - 1)

    if (firstError) throw firstError
    if (firstBatch) allLeads.push(...firstBatch)

    const totalRows = totalCount || 0
    
    // If there are more pages, fetch them in parallel
    if (totalRows > pageSize) {
      const pagePromises: Promise<{ data: any[] | null; error: any }>[] = []
      for (let offset = pageSize; offset < totalRows; offset += pageSize) {
        pagePromises.push(
          (async () => {
            let pQuery = supabase
              .from('leads')
              .select('assigned_member,grade,status,campaign,date_added')

            if (startDate) pQuery = pQuery.gte('date_added', startDate)
            if (endDate) pQuery = pQuery.lte('date_added', endDate)

            return await pQuery.range(offset, offset + pageSize - 1)
          })()
        )
      }

      const results = await Promise.all(pagePromises)
      for (const res of results) {
        if (res.error) throw res.error
        if (res.data) allLeads.push(...res.data)
      }
    }

    return NextResponse.json({ leads: allLeads, total: allLeads.length, totalDbCount: totalRows })
  } catch (err: any) {
    console.error('Analytics API error:', err)
    return NextResponse.json({ error: err.message || 'Failed to fetch analytics leads' }, { status: 500 })
  }
}
