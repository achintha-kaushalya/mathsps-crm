import { NextRequest, NextResponse } from 'next/server'
import { sendWhatsAppText, sendWhatsAppImage, getStandardBankDetailsText } from '@/lib/whatsapp'
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
 * [REQ-WA-02] Real-Time WhatsApp Incoming Calls & Messages Handler (POST)
 * Receives Inbound Messages, Inbound Call Signaling, and Auto-Dispatches Flyers & Bank Packets
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

    // 1. Handle Inbound WhatsApp Voice Call Events
    if (value.calls && value.calls.length > 0) {
      const call = value.calls[0]
      const callerPhone = call.from
      const callId = call.id
      const callEvent = call.event // 'offered', 'accepted', 'terminated'

      console.log(`[WhatsApp Call Event] From: ${callerPhone}, Event: ${callEvent}, ID: ${callId}`)

      // When call terminates or caller connects: Auto-Dispatch follow-up flyer and bank pack
      if (callEvent === 'offered' || callEvent === 'terminated') {
        try {
          const followUpGreeting = `ආයුබෝවන්! ඔබ MathsPS වෙත ලබාදුන් ඇමතුමට ස්තූතියි. ඔබගේ පහසුව සඳහා අපගේ පන්ති කාලසටහන් සහ ගාස්තු ගෙවීමේ බැංකු ගිණුම් විස්තර පහතින් එවා ඇත.`
          await sendWhatsAppText(callerPhone, followUpGreeting)
          await sendWhatsAppText(callerPhone, getStandardBankDetailsText())
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
      const msgBody = message.text?.body?.trim().toLowerCase() || ''

      console.log(`[WhatsApp Inbound Message] From: ${senderPhone}, Type: ${msgType}, Text: ${msgBody}`)

      // Intelligent Intent Detection: Bank Details, Grade 6-11 Inquiries
      let replyDispatched = false

      if (msgBody.includes('bank') || msgBody.includes('account') || msgBody.includes('ගිණුම්') || msgBody.includes('slip') || msgBody.includes('fees')) {
        await sendWhatsAppText(senderPhone, getStandardBankDetailsText())
        replyDispatched = true
      } else {
        // Check if grade inquiry (e.g. "10", "11", "grade 10")
        const gradeMatch = msgBody.match(/\b(6|7|8|9|10|11)\b/)
        if (gradeMatch) {
          const matchedGrade = gradeMatch[1]
          const flyerUrl = 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=800'
          await sendWhatsAppImage(
            senderPhone,
            flyerUrl,
            `MathsPS Grade ${matchedGrade} Class Timetable & Fees.\nපන්ති සඳහා ලියාපදිංචි වීමට හෝ වැඩිදුර විස්තර සඳහා අප අමතන්න.`
          )
          await sendWhatsAppText(senderPhone, getStandardBankDetailsText())
          replyDispatched = true
        }
      }

      // Default Friendly Autonomous Response
      if (!replyDispatched && msgType === 'text') {
        const welcomeText = `ආයුබෝවන් MathsPS වෙතින්! 
පන්ති කාලසටහන් හෝ ගාස්තු විස්තර ලබාගැනීමට ඔබට අවශ්‍ය ශ්‍රේණිය (උදා: *10 ශ්‍රේණිය* හෝ *11 ශ්‍රේණිය*) ලෙස හෝ *Bank Details* ලෙස මෙහි type කරන්න.`
        await sendWhatsAppText(senderPhone, welcomeText)
      }

      return NextResponse.json({ status: 'message_handled' }, { status: 200 })
    }

    return NextResponse.json({ status: 'acknowledged' }, { status: 200 })
  } catch (err: any) {
    console.error('Webhook error:', err)
    return NextResponse.json({ error: err.message }, { status: 200 }) // Return 200 to acknowledge Meta
  }
}
