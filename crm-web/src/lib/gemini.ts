/**
 * Gemini Conversational Intelligence Engine for MathsPS CRM
 * Powers 24/7 autonomous parent voice notes & text conversations, intent detection,
 * flyer/bank dispatching, and lead capture.
 */

import { createClient } from '@supabase/supabase-js'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_MODEL = 'gemini-3.8-flash'

export interface ParentAiResult {
  replyText: string
  dispatchFlyerGrade: number | null
  dispatchBank: boolean
  leadInfo: {
    studentName?: string
    grade?: number
    school?: string
    note?: string
  } | null
}

const DEFAULT_TIMETABLES: Record<number, string> = {
  6: 'සෑම සඳුදා දිනකම සවස 3.30 - 6.00',
  7: 'සෑම අඟහරුවාදා දිනකම සවස 3.30 - 6.00',
  8: 'සෑම බදාදා දිනකම සවස 3.30 - 6.00',
  9: 'සෑම බ්‍රහස්පතින්දා දිනකම සවස 3.30 - 6.00',
  10: 'සෑම සිකුරාදා දිනකම සවස 3.00 - 6.30',
  11: 'සෑම සෙනසුරාදා දිනකම උදෑසන 8.00 - 12.30'
}

const DEFAULT_FLYERS: Record<number, string> = {
  6: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=800',
  7: 'https://images.unsplash.com/photo-1596495578065-6e0763fa1178?q=80&w=800',
  8: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?q=80&w=800',
  9: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?q=80&w=800',
  10: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=800',
  11: 'https://images.unsplash.com/photo-1596495578065-6e0763fa1178?q=80&w=800'
}

/**
 * Fetch dynamic AI config from Supabase admin record
 */
export async function getLiveAiConfig() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (supabaseUrl && serviceKey) {
      const supabase = createClient(supabaseUrl, serviceKey)
      const { data } = await supabase
        .from('members')
        .select('notes')
        .in('role', ['admin', 'owner'])
        .limit(1)
        .maybeSingle()

      if (data?.notes) {
        const parsed = JSON.parse(data.notes)
        if (parsed.ai_agent_config) {
          return parsed.ai_agent_config
        }
      }
    }
  } catch (e) {
    console.error('Error loading AI config from db, falling back to defaults:', e)
  }

  return {
    timetables: DEFAULT_TIMETABLES,
    class_flyers: DEFAULT_FLYERS,
    human_escalation_number: '0710631093'
  }
}

/**
 * Download WhatsApp Media (Voice note / audio) from Meta Graph API
 */
export async function downloadWhatsAppMedia(mediaId: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN
  if (!token) throw new Error('WhatsApp access token missing')

  // Step 1: Query media URL
  const metaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  const metaData = await metaRes.json()
  if (!metaRes.ok || !metaData.url) {
    throw new Error(metaData?.error?.message || 'Failed to retrieve media URL')
  }

  // Step 2: Download raw audio binary
  const binaryRes = await fetch(metaData.url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'MathsPS-CRM/1.0'
    }
  })
  if (!binaryRes.ok) {
    throw new Error(`Failed to download binary stream: ${binaryRes.statusText}`)
  }

  const arrayBuf = await binaryRes.arrayBuffer()
  return {
    buffer: Buffer.from(arrayBuf),
    mimeType: metaData.mime_type || 'audio/ogg'
  }
}

/**
 * Core Gemini Agent: Speaks with parents, understands text & voice, extracts intent
 */
export async function generateParentAiResponse(params: {
  text?: string
  audioBuffer?: Buffer
  audioMimeType?: string
  callerPhone?: string
}): Promise<ParentAiResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.warn('GEMINI_API_KEY not set in environment.')
    return {
      replyText: 'ආයුබෝවන් MathsPS වෙතින්! පන්ති විස්තර සහ ගාස්තු විස්තර සඳහා කරුණාකර ඔබගේ ශ්‍රේණිය (6, 7, 8, 9, 10, 11) සඳහන් කරන්න.',
      dispatchFlyerGrade: null,
      dispatchBank: false,
      leadInfo: null
    }
  }

  const liveConfig = await getLiveAiConfig()

  const systemInstruction = `You are MathsPS AI Agent, the official intelligent voice and chat representative for Prabuddha Sampath Sir's Mathematics Institute in Sri Lanka (MathsPS).
Your primary role is to talk with parents and students inquiring about classes (Grade 6 to Grade 11).

Key Knowledge Base:
- Teacher: Prabuddha Sampath Sir (B.Sc. / Renowned Mathematics Educator).
- Grades: Grade 6, 7, 8, 9, 10, 11 (O/L Mathematics).
- Timetables:
  Grade 6: ${liveConfig.timetables?.[6] || DEFAULT_TIMETABLES[6]}
  Grade 7: ${liveConfig.timetables?.[7] || DEFAULT_TIMETABLES[7]}
  Grade 8: ${liveConfig.timetables?.[8] || DEFAULT_TIMETABLES[8]}
  Grade 9: ${liveConfig.timetables?.[9] || DEFAULT_TIMETABLES[9]}
  Grade 10: ${liveConfig.timetables?.[10] || DEFAULT_TIMETABLES[10]}
  Grade 11: ${liveConfig.timetables?.[11] || DEFAULT_TIMETABLES[11]}
- Modes: Physical classes & Online Zoom live classes with LMS video recording access.
- Fees & Payments: Handled via Bank Deposit / CDM / Online Transfer (Bank of Ceylon, Commercial Bank, Sampath Bank).
- Inquiries & Human Escalation: ${liveConfig.human_escalation_number || '071 063 1093'}.

Tone & Language Guidelines:
- Always respond in natural, respectful, and polite Sinhala (සිංහල).
- Speak warmly as an education coordinator talking to a Sri Lankan parent ("ආයුබෝවන් දෙමාපියනි / ආයුබෝවන්!").
- Keep replies clear, conversational, and direct (2-4 concise sentences).
- If the parent asks in Singlish or English, answer primarily in friendly Sinhala with English terms as appropriate.

Action Intents to Trigger:
- If the parent asks about a specific grade (e.g., Grade 6, 7, 8, 9, 10, 11) or asks for the flyer/timetable: set "dispatchFlyerGrade" to that grade number (6-11).
- If the parent asks about bank accounts, payment slips, fees, how to pay, or bank deposit details: set "dispatchBank" to true.
- If the parent mentions student name, school, or grade for registration: extract into "leadInfo".

CRITICAL: Return ONLY a valid JSON object with the following exact keys:
{
  "replyText": "The Sinhala message to send to the parent",
  "dispatchFlyerGrade": number or null,
  "dispatchBank": boolean,
  "leadInfo": {
    "studentName": string or undefined,
    "grade": number or undefined,
    "school": string or undefined,
    "note": string or undefined
  } or null
}`

  const contents: any[] = []
  const parts: any[] = []

  if (params.audioBuffer) {
    parts.push({
      inlineData: {
        mimeType: params.audioMimeType?.split(';')[0] || 'audio/ogg',
        data: params.audioBuffer.toString('base64')
      }
    })
    parts.push({
      text: 'This is a voice note sent by a parent via WhatsApp. Listen carefully to their spoken Sinhala or English, determine their inquiry, and respond according to instructions.'
    })
  } else if (params.text) {
    parts.push({
      text: params.text
    })
  } else {
    parts.push({
      text: 'Parent opened conversation or requested information.'
    })
  }

  contents.push({ parts })

  const CANDIDATE_MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-2.5-pro']
  let lastError: any = null

  for (const model of CANDIDATE_MODELS) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: systemInstruction }] },
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2
          }
        })
      })

      if (!res.ok) {
        const errBody = await res.text()
        console.warn(`Gemini Model ${model} returned ${res.status}:`, errBody)
        lastError = new Error(`Model ${model} status ${res.status}`)
        continue // Try next model
      }

      const data = await res.json()
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text

      if (!rawText) {
        throw new Error('Empty response from Gemini')
      }

      const parsed: ParentAiResult = JSON.parse(rawText)
      return {
        replyText: parsed.replyText || 'ආයුබෝවන්! ඔබගේ විස්තර සඳහා ස්තූතියි. අවශ්‍ය තොරතුරු පහතින් එවා ඇත.',
        dispatchFlyerGrade: parsed.dispatchFlyerGrade ? Number(parsed.dispatchFlyerGrade) : null,
        dispatchBank: Boolean(parsed.dispatchBank),
        leadInfo: parsed.leadInfo || null
      }
    } catch (modelErr: any) {
      console.warn(`Attempt with ${model} failed:`, modelErr.message)
      lastError = modelErr
    }
  }

  // Graceful rule-based fallback if all models are experiencing temporary Google outages
  console.error('All Gemini candidate models failed, engaging smart local fallback:', lastError)
  const textLower = (params.text || '').toLowerCase()
  const gradeMatch = textLower.match(/\b(6|7|8|9|10|11)\b/)
  const detectedGrade = gradeMatch ? parseInt(gradeMatch[1]) : null
  const wantsBank = textLower.includes('bank') || textLower.includes('account') || textLower.includes('ගිණුම්') || textLower.includes('slip') || textLower.includes('fees') || textLower.includes('ගාස්තු')

  let fallbackReply = 'ආයුබෝවන් MathsPS වෙතින්! මම ඔබගේ පන්ති සහ ගාස්තු විස්තර පිළිබඳ සහායකයා.'
  if (detectedGrade) {
    fallbackReply = `ආයුබෝවන්! ${detectedGrade} ශ්‍රේණිය පන්ති කාලසටහන සහ විස්තර පත්‍රිකාව පහතින් අමුණා ඇත. වැඩිදුර තොරතුරු සඳහා අප අමතන්න.`
  } else if (wantsBank) {
    fallbackReply = 'ආයුබෝවන්! ගාස්තු ගෙවීම් සඳහා බැංකු ගිණුම් විස්තර පහතින් එවා ඇත.'
  }

  return {
    replyText: fallbackReply,
    dispatchFlyerGrade: detectedGrade,
    dispatchBank: wantsBank || !detectedGrade,
    leadInfo: null
  }
}

