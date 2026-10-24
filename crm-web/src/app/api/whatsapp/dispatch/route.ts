import { NextRequest, NextResponse } from 'next/server'
import { sendWhatsAppText, sendWhatsAppImage, getStandardBankDetailsText } from '@/lib/whatsapp'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { to, type, grade, studentCode, customText, imageUrl, caption } = body

    if (!to) {
      return NextResponse.json({ error: 'Recipient phone number is required (to)' }, { status: 400 })
    }

    let sendResult: any = null

    if (type === 'BANK_DETAILS') {
      const bankText = getStandardBankDetailsText(studentCode)
      sendResult = await sendWhatsAppText(to, bankText)
    } else if (type === 'CLASS_FLYER' && imageUrl) {
      sendResult = await sendWhatsAppImage(to, imageUrl, caption || `MathsPS Grade ${grade || ''} Class Timetable`)
    } else if (type === 'CUSTOM_TEXT' && customText) {
      sendResult = await sendWhatsAppText(to, customText)
    } else {
      return NextResponse.json({ error: 'Invalid dispatch type or missing parameters' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      data: sendResult
    })
  } catch (err: any) {
    console.error('WhatsApp Dispatch API error:', err)
    return NextResponse.json({ error: err.message || 'Failed to dispatch WhatsApp message' }, { status: 500 })
  }
}
