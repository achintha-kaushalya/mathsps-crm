import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(DEFAULT_AI_CONFIG)
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    
    // Check if configuration exists in members/admin record notes or return default
    const { data: adminRecord } = await supabase
      .from('members')
      .select('notes')
      .in('role', ['admin', 'owner'])
      .limit(1)
      .maybeSingle()

    if (adminRecord?.notes) {
      try {
        const parsed = JSON.parse(adminRecord.notes)
        if (parsed.ai_agent_config) {
          return NextResponse.json(parsed.ai_agent_config)
        }
      } catch {}
    }

    return NextResponse.json(DEFAULT_AI_CONFIG)
  } catch (err: any) {
    return NextResponse.json(DEFAULT_AI_CONFIG)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Database credentials missing' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Store in admin member notes safely
    const { data: adminRecord } = await supabase
      .from('members')
      .select('id, notes')
      .in('role', ['admin', 'owner'])
      .limit(1)
      .maybeSingle()

    if (!adminRecord) {
      return NextResponse.json({ error: 'Admin record not found to persist config' }, { status: 404 })
    }

    let existingNotes: any = {}
    try {
      if (adminRecord.notes) existingNotes = JSON.parse(adminRecord.notes)
    } catch {}

    existingNotes.ai_agent_config = body

    const { error: updateErr } = await supabase
      .from('members')
      .update({ notes: JSON.stringify(existingNotes) })
      .eq('id', adminRecord.id)

    if (updateErr) throw updateErr

    return NextResponse.json({ success: true, config: body })
  } catch (err: any) {
    console.error('Error saving AI config:', err)
    return NextResponse.json({ error: err.message || 'Failed to save configuration' }, { status: 500 })
  }
}
