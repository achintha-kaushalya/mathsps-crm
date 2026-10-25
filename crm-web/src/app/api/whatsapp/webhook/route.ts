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

const PROCESSED_CACHE_LIMIT = 500
const processedMessageIds = new Map<string, number>()
// Track last message / call timestamp per phone number (to avoid repeated "Ayubowan" greetings within 24h)
const phoneLastActivity = new Map<string, number>()
const ONE_DAY_MS = 24 * 60 * 60 * 1000

function isDuplicateMessage(msgId: string): boolean {
  if (!msgId) return false
  const now = Date.now()
  for (const [id, time] of processedMessageIds.entries()) {
    if (now - time > 10 * 60 * 1000) processedMessageIds.delete(id)
  }
  if (processedMessageIds.has(msgId)) return true
  processedMessageIds.set(msgId, now)
  if (processedMessageIds.size > PROCESSED_CACHE_LIMIT) {
    const oldestKey = processedMessageIds.keys().next().value
    if (oldestKey) processedMessageIds.delete(oldestKey)
  }
  return false
}

function shouldSendGreeting(phone: string): boolean {
  if (!phone) return true
  const now = Date.now()
  const lastActive = phoneLastActivity.get(phone)
  // Only send greeting if this is first contact or inactive for more than 24 hours (1 day)
  const isNewOrLongTime = !lastActive || (now - lastActive > ONE_DAY_MS)
  phoneLastActivity.set(phone, now)
  return isNewOrLongTime
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

    // Ignore delivery receipts and read receipts
    if (value.statuses && value.statuses.length > 0) {
      return NextResponse.json({ status: 'status_ignored' }, { status: 200 })
    }

    // 1. Handle Inbound WhatsApp Voice Call Signaling Events
    if (value.calls && value.calls.length > 0) {
      const call = value.calls[0]
      const callerPhone = call.from
      const callId = call.id
      const callEvent = call.event // 'connect', 'offer', 'offered', 'terminate', 'terminated'
      const session = call.session
      const sdp = call.sdp || session?.sdp

      console.log(`[WhatsApp Call Event FULL] From: ${callerPhone}, Event: ${callEvent}, ID: ${callId}, Payload:`, JSON.stringify(call))

      // Forward to persistent Voice Bridge if configured (Render / Fly.io / Local)
      const voiceBridgeUrl = process.env.VOICE_BRIDGE_URL || 'https://mathsps-voice-bridge.onrender.com'
      if (voiceBridgeUrl) {
        try {
          const bridgeRes = await fetch(`${voiceBridgeUrl}/webhook/call`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              call_id: callId,
              from: callerPhone,
              event: callEvent,
              session: session,
              sdp: sdp,
              raw_call: call,
              action: (callEvent === 'terminate' || callEvent === 'terminated') ? 'terminate' : 'offer'
            }),
            signal: AbortSignal.timeout(4000)
          })
          const bridgeData = await bridgeRes.json().catch(() => ({}))
          console.log(`[Voice Bridge Response] Call ${callId}:`, bridgeData)
        } catch (err: any) {
          console.error('[Voice Bridge Forwarding Error]:', err.message)
        }
      }

      if (callEvent === 'terminate' || callEvent === 'terminated') {
        const terminateKey = `call_term_${callId}`
        if (!isDuplicateMessage(terminateKey)) {
          try {
            const detailsAlreadySent = Boolean((call as any).detailsSent)
            if (!detailsAlreadySent) {
              const sendGreeting = shouldSendGreeting(callerPhone)
              // Concise, friendly follow-up: Only prepend greeting if first time or after long time (>24h)
              const followUpText = sendGreeting
                ? 'ආයුබෝවන්! MathsPS ඇමතුමට ස්තූතියි. පන්ති විස්තර සඳහා ශ්‍රේණිය (5, 6, 7, 8, 9, 10, 11) මෙහි එවන්න.'
                : 'පන්ති විස්තර ලබාගැනීමට ඔබට අවශ්‍ය ශ්‍රේණිය (5 - 11) මෙහි එවන්න.'
              await sendWhatsAppText(callerPhone, followUpText)
            }
            await syncWhatsAppLead(callerPhone, null, undefined, `Inbound Voice Call (${callEvent})`)
          } catch (dispatchErr) {
            console.error('Failed to dispatch auto-packet on call event:', dispatchErr)
          }
        }
      } else if (callEvent === 'connect' || callEvent === 'offer') {
        await syncWhatsAppLead(callerPhone, null, undefined, `Inbound Voice Call (${callEvent})`).catch(() => {})
      }

      return NextResponse.json({ status: 'call_handled' }, { status: 200 })
    }


    // 2. Handle Inbound WhatsApp Text & Voice Notes
    if (value.messages && value.messages.length > 0) {
      const message = value.messages[0]
      const messageId = message.id
      const senderPhone = message.from
      const msgType = message.type
      const msgBody = message.text?.body?.trim() || ''

      // Deduplication: Meta retries webhook if network latency occurs
      if (isDuplicateMessage(messageId)) {
        console.log(`[WhatsApp Deduplicated] Skipping duplicate message ID: ${messageId}`)
        return NextResponse.json({ status: 'duplicate_ignored' }, { status: 200 })
      }

      console.log(`[WhatsApp Inbound] ID: ${messageId}, From: ${senderPhone}, Type: ${msgType}`)

      let aiResult = null

      const isNewChat = shouldSendGreeting(senderPhone)

      if (msgType === 'audio') {
        // Parent sent a Voice Note (Audio message)
        try {
          console.log(`[WhatsApp Audio Voice Note] ID: ${message.audio.id}`)
          const { buffer, mimeType } = await downloadWhatsAppMedia(message.audio.id)
          aiResult = await generateParentAiResponse({
            audioBuffer: buffer,
            audioMimeType: mimeType,
            callerPhone: senderPhone,
            isNewConversation: isNewChat
          })
        } catch (audioErr: any) {
          console.error('Failed to process voice note audio:', audioErr)
          aiResult = {
            replyText: isNewChat
              ? 'ආයුබෝවන් MathsPS වෙතින්! ඔබගේ හඬ පණිවිඩය ලැබුණි. ඔබ විමසන ශ්‍රේණිය (5, 6, 7, 8, 9, 10, 11) මෙහි කෙටි පණිවිඩයකින් එවන්න.'
              : 'ඔබගේ හඬ පණිවිඩය ලැබුණි. කරුණාකර ඔබ විමසන ශ්‍රේණිය (5 - 11) මෙහි එවන්න.',
            dispatchFlyerGrade: null,
            dispatchBank: false,
            leadInfo: null
          }
        }
      } else if (msgType === 'text') {
        // Parent sent a Text or Singlish inquiry
        aiResult = await generateParentAiResponse({
          text: msgBody,
          callerPhone: senderPhone,
          isNewConversation: isNewChat
        })
      }

      if (aiResult) {
        // 1. Send AI conversational response in Sinhala
        await sendWhatsAppText(senderPhone, aiResult.replyText)

        const liveConfig = await getLiveAiConfig()

        // 2. Auto-dispatch Flyer if inquired
        if (aiResult.dispatchFlyerUrl || aiResult.dispatchFlyerGrade) {
          const grade = aiResult.dispatchFlyerGrade
          const flyerUrl = aiResult.dispatchFlyerUrl || (grade ? liveConfig.class_flyers?.[grade] : null) || 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=800'
          const timetable = grade ? (liveConfig.timetables?.[grade] || '') : ''
          const caption = `📊 *MathsPS ${grade ? `${grade} ශ්‍රේණිය ` : ''}පන්ති විස්තර*${timetable ? `\n⏰ ${timetable}` : ''}\nප්‍රබුද්ධ සම්පත් සර් (B.Sc)`

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

