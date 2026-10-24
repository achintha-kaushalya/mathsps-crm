import { requireAuth, apiSuccess, apiError } from '@/lib/api/guard'

export const dynamic = 'force-dynamic'

const DEFAULT_AI_CONFIG = {
  enabled: true,
  agent_name: 'MathsPS AI Assistant',
  voice_name: 'Sinhala Professional (Female)',
  default_tutor: 'prabuddha',
  greeting_text: 'ආයුබෝවන් MathsPS වෙතින්! මම ඔබගේ පන්ති සහ ගාස්තු විස්තර පිළිබඳ සහායකයා. අද ඔබට උදව් කළ හැක්කේ කෙසේද?',
  system_prompt: `ඔබ MathsPS ආයතනයේ (ප්‍රබුද්ධ සම්පත් සර්ගේ ගණිත පන්ති) නිල AI සහායකයා වේ.
දෙමව්පියන් හෝ සිසුන් අසන ප්‍රශ්න වලට ඉතා කාරුණිකව, පැහැදිලි සිංහලෙන් හෝ සිංග්ලීෂ් භාෂාවෙන් පිළිතුරු දෙන්න.
ඔවුන් පන්ති වේලාවන්, ගාස්තු හෝ බැංකු ගිණුම් විස්තර ඉල්ලූ විට නිවැරදි තොරතුරු පවසන්න.
අවශ්‍ය නම් ඔවුන්ගේ WhatsApp අංකයට පන්ති පෝස්ටරය (Flyer) සහ බැංකු ගිණුම් විස්තර ක්ෂණිකව යැවිය හැක.`,
  class_flyers: {
    6: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=800',
    7: 'https://images.unsplash.com/photo-1596495578065-6e0763fa1178?q=80&w=800',
    8: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?q=80&w=800',
    9: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?q=80&w=800',
    10: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=800',
    11: 'https://images.unsplash.com/photo-1596495578065-6e0763fa1178?q=80&w=800',
  },
  timetables: {
    6: 'සෑම සඳුදා දිනකම සවස 3.30 - 6.00',
    7: 'සෑම අඟහරුවාදා දිනකම සවස 3.30 - 6.00',
    8: 'සෑම බදාදා දිනකම සවස 3.30 - 6.00',
    9: 'සෑම බ්‍රහස්පතින්දා දිනකම සවස 3.30 - 6.00',
    10: 'සෑම සිකුරාදා දිනකම සවස 3.00 - 6.30',
    11: 'සෑම සෙනසුරාදා දිනකම උදෑසන 8.00 - 12.30'
  },
  bank_accounts: [
    { bank: 'Bank of Ceylon (BOC)', branch: 'Kandy City', account_no: '8820391024', name: 'P.S. Perera' },
    { bank: 'Commercial Bank', branch: 'Kandy', account_no: '1092837465', name: 'MathsPS Education' },
    { bank: 'Sampath Bank', branch: 'Peradeniya', account_no: '0029384756', name: 'P.S. Perera' }
  ],
  auto_dispatch_flyer: true,
  auto_dispatch_bank: true,
  human_escalation_number: '0710631093'
}

export async function GET(req: Request) {
  const authResult = await requireAuth(req)
  if ('errorResponse' in authResult) return authResult.errorResponse
  const { auth } = authResult

  try {
    const { data: adminRecord } = await auth.supabaseAdmin
      .from('members')
      .select('notes')
      .in('role', ['admin', 'owner'])
      .limit(1)
      .maybeSingle()

    if (adminRecord?.notes) {
      try {
        const parsed = JSON.parse(adminRecord.notes)
        if (parsed.ai_agent_config) {
          return apiSuccess(parsed.ai_agent_config)
        }
      } catch {}
    }

    return apiSuccess(DEFAULT_AI_CONFIG)
  } catch (err: any) {
    return apiSuccess(DEFAULT_AI_CONFIG)
  }
}

export async function POST(req: Request) {
  const authResult = await requireAuth(req, ['admin', 'owner'])
  if ('errorResponse' in authResult) return authResult.errorResponse
  const { auth } = authResult

  try {
    const body = await req.json()
    const { data: adminRecord } = await auth.supabaseAdmin
      .from('members')
      .select('id, notes')
      .in('role', ['admin', 'owner'])
      .limit(1)
      .maybeSingle()

    if (!adminRecord) {
      return apiError('Admin record not found to persist config', 404)
    }

    let existingNotes: any = {}
    try {
      if (adminRecord.notes) existingNotes = JSON.parse(adminRecord.notes)
    } catch {}

    existingNotes.ai_agent_config = body

    const { error: updateErr } = await auth.supabaseAdmin
      .from('members')
      .update({ notes: JSON.stringify(existingNotes) })
      .eq('id', adminRecord.id)

    if (updateErr) throw updateErr

    return apiSuccess({ success: true, config: body })
  } catch (err: any) {
    console.error('Error saving AI config:', err)
    return apiError(err.message || 'Failed to save configuration', 500)
  }
}
