import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/guard'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req)
    if ('errorResponse' in authResult) return authResult.errorResponse
    const { auth } = authResult
    const supabase = auth.supabaseAdmin

    const url = new URL(req.url)
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')

    // Enforce RBAC lead assignment scoping for non-admin staff
    const scopedAssignees = auth.canViewAll
      ? []
      : Array.from(new Set([
          auth.member?.name?.trim() || '',
          ...auth.allowedMembers.map(m => m.trim())
        ])).filter(Boolean)

    // Fetch all leads using exact count and pagination (1000 per page)
    let allLeads: any[] = []
    const pageSize = 1000

    let query = supabase
      .from('leads')
      .select('id,assigned_member,grade,status,campaign,date_added,created_at,paid', { count: 'exact' })
      .order('id', { ascending: true })

    if (!auth.canViewAll) {
      if (scopedAssignees.length > 0) {
        query = query.in('assigned_member', scopedAssignees)
      } else {
        query = query.eq('assigned_member', auth.member?.name || 'none')
      }
    }
    if (startDate) query = query.gte('date_added', startDate)
    if (endDate) query = query.lte('date_added', endDate)

    const { data: firstBatch, count: totalCount, error: firstError } = await query.range(0, pageSize - 1)

    if (firstError) throw firstError
    if (firstBatch) allLeads.push(...firstBatch)

    const totalRows = Math.min(totalCount || 0, 30000)
    
    // Fetch remaining batches with bounded concurrency (max 5 parallel pages at a time)
    if (totalRows > pageSize) {
      const offsets: number[] = []
      for (let offset = pageSize; offset < totalRows; offset += pageSize) {
        offsets.push(offset)
      }

      const maxConcurrency = 5
      for (let i = 0; i < offsets.length; i += maxConcurrency) {
        const chunk = offsets.slice(i, i + maxConcurrency)
        const results = await Promise.all(
          chunk.map(async (offset) => {
            let pQuery = supabase
              .from('leads')
              .select('id,assigned_member,grade,status,campaign,date_added,created_at,paid')
              .order('id', { ascending: true })

            if (!auth.canViewAll) {
              if (scopedAssignees.length > 0) {
                pQuery = pQuery.in('assigned_member', scopedAssignees)
              } else {
                pQuery = pQuery.eq('assigned_member', auth.member?.name || 'none')
              }
            }
            if (startDate) pQuery = pQuery.gte('date_added', startDate)
            if (endDate) pQuery = pQuery.lte('date_added', endDate)

            return await pQuery.range(offset, offset + pageSize - 1)
          })
        )
        for (const res of results) {
          if (res.error) throw res.error
          if (res.data) allLeads.push(...res.data)
        }
      }
    }

    return NextResponse.json({ leads: allLeads, total: allLeads.length, totalDbCount: totalRows })
  } catch (err: any) {
    console.error('Analytics API error:', err)
    return NextResponse.json({ error: err.message || 'Failed to fetch analytics leads' }, { status: 500 })
  }
}
