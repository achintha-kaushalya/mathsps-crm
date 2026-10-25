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
  dispatchFlyerUrl?: string | null
  dispatchBank: boolean
  leadInfo: {
    studentName?: string
    grade?: number
    school?: string
    note?: string
  } | null
}

const DEFAULT_TIMETABLES: Record<number, string> = {
  5: 'බදාදා හවස 6.00 ට (Online)',
  6: 'සෙනසුරාදා පෙ.ව 8.00 - 10.30 (කුරුණෑගල පේරාදෙණි) | සිකුරාදා සවස 6.00 - 8.30 (Online)',
  7: 'සෙනසුරාදා පෙ.ව 10.30 - 1.00 (කුරුණෑගල පේරාදෙණි) | බ්‍රහස්පතින්දා සවස 6.00 - 8.30 (Online)',
  8: 'සෙනසුරාදා ප.ව 1.30 - 4.00 (කුරුණෑගල පේරාදෙණි) | අඟහරුවාදා සවස 6.00 - 8.30 (Online)',
  9: 'සෙනසුරාදා ප.ව 4.00 - 6.30 (කුරුණෑගල පේරාදෙණි) | සඳුදා සවස 6.00 - 8.30 (Online)',
  10: 'ඉරිදා පෙ.ව 8.00 - 10.30 (කුරුණෑගල පේරාදෙණි) | ඉරිදා සවස 6.00 - 8.30 (Online)',
  11: 'ඉරිදා පෙ.ව 10.30 - 1.00 (කුරුණෑගල පේරාදෙණි) | සෙනසුරාදා සවස 6.00 - 8.30 (Online)'
}

const DEFAULT_FLYERS: Record<number, string> = {
  5: 'https://wpp.raybeamdigital.com/assets/media/flow_nodes/2d0a1a83-67e5-40c8-9534-93963ea1fb98-5cbcd4f1-920c-49c6-9fc4-0fb1fd79330c.jpeg',
  6: 'https://wpp.raybeamdigital.com/assets/media/flow_nodes/4da445c4-0afc-48bb-98c2-1855cff84dfc-d6c8f425-0941-420a-a599-9fe25ea977c0.jpeg',
  7: 'https://wpp.raybeamdigital.com/assets/media/flow_nodes/3b51b1f6-ad7e-4629-bf34-ae4e8bcd2aea-4c1661d2-a9c7-4182-90a6-eb860ff6ef7f.jpeg',
  8: 'https://wpp.raybeamdigital.com/assets/media/flow_nodes/03bb673a-a0c8-4ff1-a923-dccdb566ec1c-a9874783-c4a1-48ab-8807-22a1bfe9799c.jpeg',
  9: 'https://wpp.raybeamdigital.com/assets/media/flow_nodes/cbacbad9-3fc8-4b75-885e-9748301e8f17-5b0b321f-bb6c-4db1-9d7f-f4ffc1b92318.jpeg',
  10: 'https://wpp.raybeamdigital.com/assets/media/flow_nodes/891b362f-d3b0-457b-9e7b-7fb1746070fb-07cf26a8-277e-4b83-8181-657357760979.jpeg',
  11: 'https://wpp.raybeamdigital.com/assets/media/flow_nodes/8580596b-6d43-44d0-93ff-f67eb9315128-5730abb1-a7f6-4ff1-ab82-3da6f6f52759.jpeg'
}

/**
 * Fetch dynamic AI config & full curriculum from Supabase admin record
 */
export async function getLiveAiConfig() {
  let gradeCourses: Record<number, any[]> = {}
  let standaloneCourses: any[] = []

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (supabaseUrl && serviceKey) {
      const supabase = createClient(supabaseUrl, serviceKey)
      let { data } = await supabase
        .from('members')
        .select('notes')
        .eq('name', 'Admin User')
        .maybeSingle()

      if (!data) {
        const res = await supabase
          .from('members')
          .select('notes')
          .in('role', ['admin', 'owner'])
          .limit(1)
          .maybeSingle()
        data = res.data
      }

      if (data?.notes) {
        const parsed = JSON.parse(data.notes)
        if (parsed.grade_courses) gradeCourses = parsed.grade_courses
        if (parsed.standalone_courses) standaloneCourses = parsed.standalone_courses
      }
    }
  } catch (e) {
    console.error('Error loading AI config from db, falling back to defaults:', e)
  }

  // Derive real flyer map and timetable map directly from grade_courses if present
  const derivedFlyers: Record<number, string> = { ...DEFAULT_FLYERS }
  const derivedTimetables: Record<number, string> = { ...DEFAULT_TIMETABLES }

  if (gradeCourses && Object.keys(gradeCourses).length > 0) {
    Object.entries(gradeCourses).forEach(([grStr, courses]) => {
      const gr = parseInt(grStr, 10)
      if (Array.isArray(courses) && courses.length > 0) {
        const first = courses[0]
        if (first.flyerUrl) derivedFlyers[gr] = first.flyerUrl
        if (first.description) derivedTimetables[gr] = first.description
      }
    })
  }

  return {
    timetables: derivedTimetables,
    class_flyers: derivedFlyers,
    grade_courses: gradeCourses,
    standalone_courses: standaloneCourses,
    human_escalation_number: '071 063 1093'
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
  isNewConversation?: boolean
}): Promise<ParentAiResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.warn('GEMINI_API_KEY not set in environment.')
    return {
      replyText: params.isNewConversation
        ? 'ආයුබෝවන් MathsPS වෙතින්! පන්ති විස්තර සඳහා ඔබගේ ශ්‍රේණිය (5, 6, 7, 8, 9, 10, 11) සඳහන් කරන්න.'
        : 'පන්ති විස්තර සඳහා ඔබගේ ශ්‍රේණිය (5 - 11) සඳහන් කරන්න.',
      dispatchFlyerGrade: null,
      dispatchFlyerUrl: null,
      dispatchBank: false,
      leadInfo: null
    }
  }

  const liveConfig = await getLiveAiConfig()

  // Format all courses and their rich notes/schedules for AI ingestion
  let coursesKnowledgeText = ''
  if (liveConfig.grade_courses && Object.keys(liveConfig.grade_courses).length > 0) {
    Object.entries(liveConfig.grade_courses).forEach(([gr, list]) => {
      coursesKnowledgeText += `\n[Grade ${gr} Classes]:\n`
      if (Array.isArray(list)) {
        list.forEach((c: any) => {
          coursesKnowledgeText += `• ${c.name} (Fee: Rs. ${c.defaultFee}): ${c.description || 'Theory & paper class.'} [Group Link: ${c.groupLink || ''}] [Flyer: ${c.flyerUrl || ''}]\n`
        })
      }
    })
  } else {
    coursesKnowledgeText += `
Grade 5: පදනම් ගණිතය (බදාදා හවස 6.00)
Grade 6: ${liveConfig.timetables?.[6] || DEFAULT_TIMETABLES[6]}
Grade 7: ${liveConfig.timetables?.[7] || DEFAULT_TIMETABLES[7]}
Grade 8: ${liveConfig.timetables?.[8] || DEFAULT_TIMETABLES[8]}
Grade 9: ${liveConfig.timetables?.[9] || DEFAULT_TIMETABLES[9]}
Grade 10: ${liveConfig.timetables?.[10] || DEFAULT_TIMETABLES[10]}
Grade 11: ${liveConfig.timetables?.[11] || DEFAULT_TIMETABLES[11]}
`
  }

  if (liveConfig.standalone_courses && Array.isArray(liveConfig.standalone_courses)) {
    coursesKnowledgeText += `\n[Specialist Standalone Courses]:\n`
    liveConfig.standalone_courses.forEach((c: any) => {
      coursesKnowledgeText += `• ${c.name} (Fee: Rs. ${c.defaultFee}): ${c.description || 'Specialist masterclass.'} [Group Link: ${c.groupLink || ''}] [Flyer: ${c.flyerUrl || ''}]\n`
    })
  }

  const systemInstruction = `You are the official intelligent representative for Prabuddha Sampath Sir's Mathematics Classes in Sri Lanka (ප්‍රබුද්ධ සම්පත් සර්ගේ ගණිත පන්ති).
DO NOT use the word or brand "MathsPS" anywhere! The official identity is always "ප්‍රබුද්ධ සම්පත්" / "Prabuddha Sampath Sir".

Your primary role is to talk warmly, professionally, and dynamically with parents and students inquiring about classes (Grade 5 to Grade 11 and specialist courses).

LANGUAGE & CONVERSATIONAL INTELLIGENCE RULES:
1. DYNAMIC LANGUAGE MATCHING:
   - If parent/student speaks or messages in Sinhala -> Respond in fluent, conversational, natural Sinhala / Singlish.
   - If parent/student speaks or messages in English -> Immediately and smoothly switch to polite, warm, and natural English!
   - If they mix Sinhala & English (Singlish) -> Respond in modern natural Singlish.
2. NO ROBOTIC / BOOKISH SINHALA ("අමු සිංහල එපා"):
   - DO NOT say awkward bookish terms like "න්‍යාය පන්ති" or "සිද්ධාන්ත පන්ති". Always say "Theory Class", "Paper Class", "Revision Class", "Zoom Live", "Recordings".
   - Speak naturally like a friendly, educated coordinator in Sri Lanka.
3. PRABUDDHA SIR'S MOTIVATIONAL STYLE & HIGHLIGHT EMOJIS:
   - Structure messages with clean line breaks and 2-3 pleasant highlight emojis (e.g. 📚, ✨, 🎯, 💡, ⏰, 📍).
   - Use warm Sri Lankan phrasing: "දඩම දඩ වැඩ ගොඩාක් එක්ක ලකුණු 100 ම හදන පන්තිය", "පොඩ්ඩනේ / පුතේ", "යාලුවන්ටත් කියන්න හොදේ".
4. ACCURATE WHATSAPP GROUP LINKS FOR INQUIRED GRADES:
   - When a parent asks for a group link (e.g., "Give me grade 7 group link", "10 වසර group link එක එවන්න"), PROVIDE THE EXACT OFFICIAL WHATSAPP GROUP LINK for that grade from the knowledge base below!
   - Official WhatsApp Groups:
     * Grade 5: https://chat.whatsapp.com/ILXpa5icYao6Kwpk5Qvawn
     * Grade 6: https://chat.whatsapp.com/G2397Wv6uK7EIlRRTTCJf7
     * Grade 7: https://chat.whatsapp.com/K5DxR5PRcu4AijDJOn3Pcw
     * Grade 8: https://chat.whatsapp.com/ERL0mdGSGl9FbsBL2vvYgC
     * Grade 9: https://chat.whatsapp.com/GHmmR9wPv7oIoc4PtUumNi
     * Grade 10: https://chat.whatsapp.com/CreBv2ciwaB8To2wuqV1On
     * Grade 11: https://chat.whatsapp.com/GfTX4ncYpzcGV6pQD3uEP4
   - NEVER make up or send dummy group links like "grade7-mathsps"!

Key Knowledge Base:
- Teacher: Prabuddha Sampath Sir (B.Sc. / Renowned Mathematics Educator / ලංකාවේ Maths Brand එක).
- Physical Institute: පේරාදෙණි අධ්‍යාපන ආයතනය - කුරුණෑගල ("රජපිහිල්ල පාර").
- Online LMS & Recordings: www.prabuddhamaths.com (Tutes Speed Post මඟින් නිවසටම එවනු ලැබේ).
- Active Courses & Curriculum:
${coursesKnowledgeText}
- Bank Accounts for Fee Payment:
  1. BOC: 76336481 (A.M.P.S.Adikari, Malkaduwawa)
  2. HNB: 040020010793 (A.M.P.S.Adikari, Chilaw)
  3. Sampath Bank: 100652635393 (A.M.P.S.Adikari, Kurunegala Super)
  4. Commercial Bank: 8160095026 (L.M. Hettiarachchi, Kurunegala)
  Payment slip WhatsApp: 071-3527040 (රිසිට් පත මත නම, වසර ලියා එවන්න).
- Hotlines: 077 9649617 | සෘජු ඇමතුම්: 071 1826117 | Escalation: ${liveConfig.human_escalation_number || '071 063 1093'}.

Tone & Messaging Rules:
- CRITICAL GREETING RULE: Do NOT start every message with "ආයුබෝවන්" (Ayubowan).
  ${params.isNewConversation ? '- This is a new conversation (or after a long time): You may include a brief, warm greeting once at the start.' : '- This is an ONGOING conversation: DO NOT say "ආයුබෝවන්". Directly answer the question or provide details.'}
- Keep messages neat, formatted with spacing and bullet points. Never dump all information into one giant paragraph.
- When asked about class details, mention Physical (කුරුණෑගල පේරාදෙණි) and Online Zoom options clearly.

STRICT ACTION TRIGGER RULES:
- "dispatchFlyerGrade": Set to grade number (5-11) if the parent inquired about a grade timetable, class flyer, or group link.
- "dispatchFlyerUrl": If the parent asked about a specific course or grade, return that exact flyer URL!
- "dispatchBank": ONLY set this to true if the parent SPECIFICALLY asked for bank accounts, fees payment details, or bank slip instructions.
- "leadInfo": Extract studentName, grade, school ONLY if provided by the parent.

CRITICAL: Return ONLY a valid JSON object with the following exact keys:
{
  "replyText": "The Sinhala message to send to the parent",
  "dispatchFlyerGrade": number or null,
  "dispatchFlyerUrl": string or null,
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

  // High-availability models with generous free-tier limits
  const CANDIDATE_MODELS = ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-flash-lite-latest']
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
            temperature: 0.1
          }
        })
      })

      if (!res.ok) {
        const errBody = await res.text()
        console.warn(`Gemini Model ${model} returned ${res.status}:`, errBody.slice(0, 120))
        lastError = new Error(`Model ${model} status ${res.status}`)
        continue
      }

      const data = await res.json()
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text

      if (!rawText) {
        throw new Error('Empty response from Gemini')
      }

      const parsed: ParentAiResult = JSON.parse(rawText)
      return {
        replyText: parsed.replyText || 'ආයුබෝවන්! MathsPS වෙතින් ඔබව සාදරයෙන් පිළිගනිමු.',
        dispatchFlyerGrade: parsed.dispatchFlyerGrade ? Number(parsed.dispatchFlyerGrade) : null,
        dispatchBank: Boolean(parsed.dispatchBank),
        leadInfo: parsed.leadInfo || null
      }
    } catch (modelErr: any) {
      console.warn(`Attempt with ${model} failed:`, modelErr.message)
      lastError = modelErr
    }
  }

  // Smart local fallback if Google models are momentarily unavailable
  console.error('All Gemini candidate models failed, engaging smart local fallback:', lastError)
  const textLower = (params.text || '').toLowerCase()
  const isGratitude = textLower.includes('thank') || textLower.includes('ස්තූති') || textLower.includes('sthuthi') || textLower.includes('හරි') || textLower.includes('ok')
  const isGreeting = textLower === 'hi' || textLower === 'hello' || textLower === 'hey' || textLower === 'halo' || textLower === 'ආයුබෝවන්'

  if (isGratitude) {
    return {
      replyText: 'ඔබටත් ස්තූතියි! දරුවාගේ අධ්‍යාපන කටයුතු සාර්ථක වේවා! තවත් යම් තොරතුරක් අවශ්‍ය නම් ඕනෑම වෙලාවක අප අමතන්න.',
      dispatchFlyerGrade: null,
      dispatchBank: false,
      leadInfo: null
    }
  }

  if (isGreeting) {
    return {
      replyText: 'ආයුබෝවන් MathsPS වෙතින්! ප්‍රබුද්ධ සම්පත් සර්ගේ ගණිත පන්ති පිළිබඳ තොරතුරු දැනගැනීමට දරුවා ඉගෙනුම ලබන ශ්‍රේණිය (6 ශ්‍රේණියේ සිට 11 ශ්‍රේණිය දක්වා) මෙහි දන්වන්න.',
      dispatchFlyerGrade: null,
      dispatchBank: false,
      leadInfo: null
    }
  }

  const gradeMatch = textLower.match(/\b(6|7|8|9|10|11)\b/)
  const detectedGrade = gradeMatch ? parseInt(gradeMatch[1]) : null
  const wantsBank = textLower.includes('bank') || textLower.includes('account') || textLower.includes('ගිණුම්') || textLower.includes('slip') || textLower.includes('fees') || textLower.includes('ගාස්තු')

  const prefix = params.isNewConversation ? 'ආයුබෝවන්! ' : ''
  let fallbackReply = params.isNewConversation ? 'ආයුබෝවන් MathsPS වෙතින්! මම ඔබගේ පන්ති විස්තර සහායකයා.' : 'MathsPS වෙතින් ඔබ විමසූ පන්ති විස්තර මෙසේය.'
  if (detectedGrade) {
    fallbackReply = `${prefix}${detectedGrade} ශ්‍රේණිය පන්ති කාලසටහන සහ විස්තර පත්‍රිකාව පහතින් අමුණා ඇත.`
  } else if (wantsBank) {
    fallbackReply = `${prefix}ගාස්තු ගෙවීම් සඳහා බැංකු ගිණුම් විස්තර පහතින් දක්වා ඇත.`
  }

  return {
    replyText: fallbackReply,
    dispatchFlyerGrade: detectedGrade,
    dispatchBank: Boolean(wantsBank),
    leadInfo: null
  }
}


