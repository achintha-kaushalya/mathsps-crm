import { NextRequest, NextResponse } from 'next/server'
import { sendWhatsAppText, sendWhatsAppImage, getStandardBankDetailsText } from '@/lib/whatsapp'
import { generateParentAiResponse, downloadWhatsAppMedia, getLiveAiConfig } from '@/lib/gemini'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'mathsps_ai_callcenter_secret_2026'

/**
 * [REQ-WA-01] Meta Webhook Verification Challenge (GET)
 * Meta pings this endpoint to verify domain ownership before sending live events.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const mode = searchParams.get('hub.mode')
    const token = searchParams.get('hub.verify_token')
    const challenge = searchParams.get('hub.challenge')

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('Meta WhatsApp Webhook Verified Successfully')
      return new NextResponse(challenge, { status: 200 })
    }

    return new NextResponse('Verification token mismatch', { status: 403 })
  } catch (err: any) {
    return new NextResponse('Webhook verify error', { status: 500 })
  }
}

/**
 * Helper to record or update lead from WhatsApp parent interactions
 */
async function syncWhatsAppLead(phone: string, grade?: number | null, studentName?: string, notes?: string) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) return

    const supabase = createClient(supabaseUrl, serviceKey)
    const digits = phone.replace(/\D/g, '')
    const norm = digits.length >= 9 ? `0${digits.slice(-9)}` : digits

    // Check if lead already exists
    const { data: existing } = await supabase
      .from('leads')
      .select('id, fcode, comments')
      .eq('normalized_phone', norm)
      .limit(1)
      .maybeSingle()

    if (existing) {
      const updateData: any = {}
      if (grade) updateData.grade = grade
      if (notes || studentName) {
        updateData.comments = `${existing.comments || ''}\n[AI Update]: ${studentName ? `Student: ${studentName}. ` : ''}${notes || ''}`.trim()
      }
      if (Object.keys(updateData).length > 0) {
        await supabase.from('leads').update(updateData).eq('id', existing.id)
      }
    } else {
      // Generate next F-code
      const { data: recentFcodes } = await supabase
        .from('leads')
        .select('fcode')
        .order('created_at', { ascending: false })
        .limit(100)

      let maxNum = 70000
      if (recentFcodes) {
        for (const row of recentFcodes) {
          const match = row.fcode?.match(/^F(\d+)/)
          if (match) {
            const num = parseInt(match[1], 10)
            if (!isNaN(num) && num > maxNum) maxNum = num
          }
        }
      }
      const nextFcode = `F${maxNum + 1}`

      await supabase.from('leads').insert({
        fcode: nextFcode,
        raw_phone: phone,
        normalized_phone: norm,
        assigned_member: 'prabuddha',
        date_added: new Date().toISOString().slice(0, 10),
        status: 'New',
        grade: grade || null,
        comments: `Registered via WhatsApp AI Agent. ${studentName ? `Student: ${studentName}. ` : ''}${notes || ''}`.trim(),
        campaign: 'WhatsApp-AI',
        repeat_student: false,
        paid: false
      })
    }
  } catch (syncErr) {
    console.error('Error syncing WhatsApp lead to Supabase:', syncErr)
  }
}

/**
 * [REQ-WA-02] Real-Time WhatsApp Autonomous Parent Voice & Message Agent (POST)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Fast ACK: Return 200 immediately to prevent Meta timeout retries (Skill: Performance)
    const entry = body.entry?.[0]
    const changes = entry?.changes?.[0]
    const value = changes?.value

    if (!value) {
      return NextResponse.json({ status: 'ignored' }, { status: 200 })
    }

    // 1. Handle Inbound WhatsApp Voice Call Signaling Events
    if (value.calls && value.calls.length > 0) {
      const call = value.calls[0]
      const callerPhone = call.from
      const callId = call.id
      const callEvent = call.event // 'offered', 'accepted', 'terminated'

      console.log(`[WhatsApp Call Event] From: ${callerPhone}, Event: ${callEvent}, ID: ${callId}`)

      if (callEvent === 'offered' || callEvent === 'terminated') {
        try {
          const followUpGreeting = `ආයුබෝවන්! ඔබ MathsPS වෙත ලබාදුන් ඇමතුමට ස්තූතියි. අපගේ පන්ති කාලසටහන් හෝ ගාස්තු විස්තර දැනගැනීමට ඔබට අවශ්‍ය ශ්‍රේණිය (6, 7, 8, 9, 10, 11) මෙහි එවන්න. ගාස්තු ගෙවීමේ බැංකු ගිණුම් විස්තරද පහතින් අමුණා ඇත.`
          await sendWhatsAppText(callerPhone, followUpGreeting)
          await sendWhatsAppText(callerPhone, getStandardBankDetailsText())
          await syncWhatsAppLead(callerPhone, null, undefined, `Inbound Voice Call (${callEvent})`)
        } catch (dispatchErr) {
          console.error('Failed to dispatch auto-packet on call event:', dispatchErr)
        }
      }

      return NextResponse.json({ status: 'call_handled' }, { status: 200 })
    }

    // 2. Handle Inbound WhatsApp Text & Voice Notes
    if (value.messages && value.messages.length > 0) {
      const message = value.messages[0]
      const senderPhone = message.from
      const msgType = message.type
      const msgBody = message.text?.body?.trim() || ''

      console.log(`[WhatsApp Inbound] From: ${senderPhone}, Type: ${msgType}`)

      let aiResult = null

      if (msgType === 'audio') {
        // Parent sent a Voice Note (Audio message)
        try {
          console.log(`[WhatsApp Audio Voice Note] ID: ${message.audio.id}`)
          const { buffer, mimeType } = await downloadWhatsAppMedia(message.audio.id)
          aiResult = await generateParentAiResponse({
            audioBuffer: buffer,
            audioMimeType: mimeType,
            callerPhone: senderPhone
          })
        } catch (audioErr: any) {
          console.error('Failed to process voice note audio:', audioErr)
          aiResult = {
            replyText: 'ආයුබෝවන් MathsPS වෙතින්! ඔබගේ හඬ පණිවිඩය (Voice Note) ලැබුණි. කරුණාකර ඔබ විමසන ශ්‍රේණිය (6, 7, 8, 9, 10, 11) හෝ අවශ්‍ය විස්තර මෙහි කෙටි පණිවිඩයකින්ද දන්වන්න.',
            dispatchFlyerGrade: null,
            dispatchBank: false,
            leadInfo: null
          }
        }
      } else if (msgType === 'text') {
        // Parent sent a Text or Singlish inquiry
        aiResult = await generateParentAiResponse({
          text: msgBody,
          callerPhone: senderPhone
        })
      }

      if (aiResult) {
        // 1. Send AI conversational response in Sinhala
        await sendWhatsAppText(senderPhone, aiResult.replyText)

        const liveConfig = await getLiveAiConfig()

        // 2. Auto-dispatch Flyer if inquired
        if (aiResult.dispatchFlyerGrade) {
          const grade = aiResult.dispatchFlyerGrade
          const flyerUrl = liveConfig.class_flyers?.[grade] || 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=800'
          const timetable = liveConfig.timetables?.[grade] || ''
          const caption = `📊 *MathsPS ${grade} ශ්‍රේණිය පන්ති විස්තර*${timetable ? `\n⏰ ${timetable}` : ''}\nප්‍රබුද්ධ සම්පත් සර් (B.Sc)`

          await sendWhatsAppImage(senderPhone, flyerUrl, caption)
        }

        // 3. Auto-dispatch Bank Accounts packet if asked
        if (aiResult.dispatchBank) {
          await sendWhatsAppText(senderPhone, getStandardBankDetailsText())
        }

        // 4. Sync lead to CRM database
        await syncWhatsAppLead(
          senderPhone,
          aiResult.dispatchFlyerGrade,
          aiResult.leadInfo?.studentName,
          aiResult.leadInfo?.note || (msgType === 'text' ? msgBody : 'WhatsApp Voice Note Inquiry')
        )
      }

      return NextResponse.json({ status: 'message_handled' }, { status: 200 })
    }

    return NextResponse.json({ status: 'acknowledged' }, { status: 200 })
  } catch (err: any) {
    console.error('Webhook error:', err)
    return NextResponse.json({ error: err.message }, { status: 200 })
  }
}

