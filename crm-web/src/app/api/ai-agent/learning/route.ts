import { NextRequest, NextResponse } from 'next/server'
import { sendWhatsAppText } from '@/lib/whatsapp'
import { requireAuth } from '@/lib/api/guard'

export const dynamic = 'force-dynamic'

/**
 * GET: Retrieve unresolved questions list & learned knowledge base
 * Protected: Requires authenticated staff session
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req)
    if ('errorResponse' in authResult) return authResult.errorResponse
    const { auth } = authResult

    const { data: adminRecord } = await auth.supabaseAdmin
      .from('members')
      .select('notes')
      .eq('name', 'Admin User')
      .maybeSingle()

    let unresolved: any[] = []
    let learned: any[] = []

    if (adminRecord?.notes) {
      try {
        const parsed = JSON.parse(adminRecord.notes)
        if (Array.isArray(parsed.unresolved_questions)) unresolved = parsed.unresolved_questions
        if (Array.isArray(parsed.learned_qa)) learned = parsed.learned_qa
      } catch (err) {}
    }

    return NextResponse.json({
      success: true,
      unresolved,
      learned,
      stats: {
        pendingCount: unresolved.filter(u => u.status === 'PENDING').length,
        learnedCount: learned.length
      }
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

/**
 * POST: Actions
 * 1. 'escalate': AI Agent logs an unanswered inquiry from call/chat
 * 2. 'resolve_and_teach': Admin types answer -> Sends WhatsApp to parent + saves to AI memory
 * 3. 'delete_knowledge': Remove obsolete learned rule
 */
export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Malformed JSON payload' }, { status: 400 })
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ success: false, error: 'Invalid JSON body object' }, { status: 400 })
  }

  try {
    const { action } = body

    // 'escalate' can be invoked by internal voice-bridge or webhook using shared secret or authenticated staff
    let supabase: any
    if (action === 'escalate') {
      const authHeader = req.headers.get('authorization') || ''
      const bearerToken = authHeader.replace(/^Bearer\s+/i, '')
      const isSecretMatch = (process.env.VOICE_BRIDGE_SECRET && bearerToken === process.env.VOICE_BRIDGE_SECRET) ||
                            (process.env.CRON_SECRET && bearerToken === process.env.CRON_SECRET)

      if (!isSecretMatch) {
        const authResult = await requireAuth(req)
        if ('errorResponse' in authResult) return authResult.errorResponse
        supabase = authResult.auth.supabaseAdmin
      } else {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
        const { createClient } = await import('@supabase/supabase-js')
        supabase = createClient(url, key)
      }
    } else {
      // 'resolve_and_teach', 'delete_knowledge', 'dismiss_inquiry' are strictly Admin/Owner only
      const authResult = await requireAuth(req, ['admin', 'owner'])
      if ('errorResponse' in authResult) return authResult.errorResponse
      supabase = authResult.auth.supabaseAdmin
    }

    const { data: adminRecord } = await supabase
      .from('members')
      .select('id, notes')
      .eq('name', 'Admin User')
      .maybeSingle()

    if (!adminRecord) {
      return NextResponse.json({ success: false, error: 'Admin record not found' }, { status: 404 })
    }

    let notes: any = {}
    try {
      if (adminRecord.notes) notes = JSON.parse(adminRecord.notes)
    } catch (e) {}

    if (!Array.isArray(notes.unresolved_questions)) notes.unresolved_questions = []
    if (!Array.isArray(notes.learned_qa)) notes.learned_qa = []

    // ACTION 1: Escalate unknown question from AI
    if (action === 'escalate') {
      const { callerPhone, question, source = 'VOICE_CALL' } = body
      if (!question || !callerPhone) {
        return NextResponse.json({ success: false, error: 'callerPhone and question required' }, { status: 400 })
      }

      const newInquiry = {
        id: 'inq_' + Date.now(),
        callerPhone,
        question: question.trim(),
        source,
        status: 'PENDING',
        createdAt: new Date().toISOString()
      }

      // Avoid immediate duplicate logging
      const exists = notes.unresolved_questions.some(
        (q: any) => q.callerPhone === callerPhone && q.question.toLowerCase() === question.toLowerCase() && q.status === 'PENDING'
      )
      if (!exists) {
        notes.unresolved_questions.unshift(newInquiry)
        await supabase
          .from('members')
          .update({ notes: JSON.stringify(notes) })
          .eq('id', adminRecord.id)
      }

      return NextResponse.json({ success: true, inquiry: newInquiry })
    }

    // ACTION 2: Admin resolves, sends to caller WhatsApp & permanently teaches AI
    if (action === 'resolve_and_teach') {
      const { inquiryId, answer, callerPhone, canonicalQuestion, category = 'General' } = body
      if (!answer) {
        return NextResponse.json({ success: false, error: 'Answer is required' }, { status: 400 })
      }

      // 1. Dispatch WhatsApp message to parent if phone provided
      if (callerPhone) {
        try {
          const formattedMsg = `ආයුබෝවන්! ඔබ ප්‍රබුද්ධ සම්පත් සර්ගේ ගණිත පන්ති සම්බන්ධයෙන් විමසූ කරුණ පිළිබඳ විස්තර මෙසේය:\n\n${answer.trim()}\n\nවැඩිදුර තොරතුරු සඳහා ඕනෑම වේලාවක මෙම අංකයට WhatsApp පණිවිඩයක් එවන්න.`
          await sendWhatsAppText(callerPhone, formattedMsg)
        } catch (dispatchErr: any) {
          console.error('Failed to send WhatsApp answer to parent:', dispatchErr.message)
        }
      }

      // 2. Mark inquiry as ANSWERED
      if (inquiryId) {
        const target = notes.unresolved_questions.find((u: any) => u.id === inquiryId)
        if (target) {
          target.status = 'ANSWERED'
          target.answeredAt = new Date().toISOString()
          target.adminAnswer = answer.trim()
        }
      }

      // 3. Save to Permanent Learned Knowledge Base (AI Brain Memory)
      const learnedEntry = {
        id: 'qa_' + Date.now(),
        question: canonicalQuestion ? canonicalQuestion.trim() : (body.question || 'General Inquiry'),
        answer: answer.trim(),
        category,
        learnedAt: new Date().toISOString(),
        taughtBy: 'Admin'
      }

      notes.learned_qa.unshift(learnedEntry)

      await supabase
        .from('members')
        .update({ notes: JSON.stringify(notes) })
        .eq('id', adminRecord.id)

      return NextResponse.json({ success: true, learned: learnedEntry })
    }

    // ACTION 3: Delete learned knowledge entry
    if (action === 'delete_knowledge') {
      const { qaId } = body
      notes.learned_qa = notes.learned_qa.filter((q: any) => q.id !== qaId)
      await supabase
        .from('members')
        .update({ notes: JSON.stringify(notes) })
        .eq('id', adminRecord.id)

      return NextResponse.json({ success: true })
    }

    // ACTION 4: Dismiss unresolved question
    if (action === 'dismiss_inquiry') {
      const { inquiryId } = body
      const target = notes.unresolved_questions.find((u: any) => u.id === inquiryId)
      if (target) {
        target.status = 'DISMISSED'
      }
      await supabase
        .from('members')
        .update({ notes: JSON.stringify(notes) })
        .eq('id', adminRecord.id)

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
  } catch (err: any) {
    console.error('Error in learning API:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
