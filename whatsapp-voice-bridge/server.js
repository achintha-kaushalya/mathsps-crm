/**
 * WhatsApp Live Voice Call Bridge (Meta WebRTC <-> Google Gemini Live Multimodal)
 * Autonomous real-time Sinhala conversational voice calling for MathsPS CRM.
 */

require('dotenv').config()
const fs = require('fs')
const path = require('path')
const express = require('express')
const cors = require('cors')
const { WebSocket } = require('ws')
const OpusScript = require('opusscript')
const {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCRtpCodecParameters,
  MediaStreamTrack,
  RtpPacket,
  RtpHeader
} = require('werift')

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))

const PORT = process.env.PORT || 8080
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '1045258928679015'
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || ''
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const GEMINI_VOICE_NAME = process.env.GEMINI_VOICE_NAME || 'Charon' // 'Charon' (Deep, calm, professional male), 'Aoede' (Warm, natural female)
const CRM_WEBHOOK_URL = process.env.CRM_WEBHOOK_URL || 'https://mathsps-lead-crm.vercel.app/api/whatsapp/webhook'

// Official MathsPS Content Data
const GRADE_FLYERS = {
  6: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=800',
  7: 'https://images.unsplash.com/photo-1596495578065-6e0763fa1178?q=80&w=800',
  8: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?q=80&w=800',
  9: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?q=80&w=800',
  10: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=800',
  11: 'https://images.unsplash.com/photo-1596495578065-6e0763fa1178?q=80&w=800'
}

const GRADE_TIMETABLES = {
  6: 'සෑම සඳුදා දිනකම සවස 3.30 - 6.00',
  7: 'සෑම අඟහරුවාදා දිනකම සවස 3.30 - 6.00',
  8: 'සෑම බදාදා දිනකම සවස 3.30 - 6.00',
  9: 'සෑම බ්‍රහස්පතින්දා දිනකම සවස 3.30 - 6.00',
  10: 'සෑම සිකුරාදා දිනකම සවස 3.00 - 6.30',
  11: 'සෑම සෙනසුරාදා දිනකම උදෑසන 8.00 - 12.30'
}

const BANK_DETAILS_TEXT = `🏛️ *MathsPS — ගාස්තු ගෙවීම් සඳහා බැංකු ගිණුම් විස්තර*

ගිණුම් හිමියාගේ නම: *P. S. Perera / MathsPS*

1️⃣ *Bank of Ceylon (BOC)*
• ගිණුම් අංකය: *XXXXXXXXXX*
• ශාඛාව: *Kandy City*

2️⃣ *Commercial Bank*
• ගිණුම් අංකය: *XXXXXXXXXX*
• ශාඛාව: *Kandy*

3️⃣ *Sampath Bank*
• ගිණුම් අංකය: *XXXXXXXXXX*
• ශාඛාව: *Peradeniya*

📸 මුදල් ගෙවූ පසු ලදුපත (Payment Slip) හෝ Online Receipt එක මෙම WhatsApp අංකයටම හෝ අපගේ CRM පද්ධතියට එවන්න.`

// In-memory debug logs for diagnosis
const debugLogs = []
function logEvent(type, data) {
  try {
    const entry = { time: new Date().toISOString(), type, data: typeof data === 'object' ? JSON.parse(JSON.stringify(data)) : data }
    console.log(`[${entry.time}] [${type}]`, typeof data === 'object' ? JSON.stringify(data) : data)
    debugLogs.push(entry)
    if (debugLogs.length > 50) debugLogs.shift()
  } catch (err) {
    console.error('logEvent error:', err)
  }
}

/**
 * Dispatch text or media WhatsApp message directly to caller phone
 */
async function sendWhatsAppMessageToCaller(recipientPhone, text, imageUrl, caption) {
  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID || !recipientPhone) {
    logEvent('WHATSAPP_DISPATCH_SKIPPED', { reason: 'missing credentials or phone', recipientPhone })
    return false
  }

  const cleanPhone = recipientPhone.replace(/\D/g, '')

  // 1. Send Flyer Image first if provided
  if (imageUrl) {
    try {
      const imgRes = await fetch(`https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanPhone,
          type: 'image',
          image: {
            link: imageUrl,
            caption: caption || undefined
          }
        })
      })
      const imgData = await imgRes.json().catch(() => ({}))
      logEvent('WHATSAPP_IMAGE_API_RESULT', { status: imgRes.status, ok: imgRes.ok, response: imgData })
    } catch (err) {
      logEvent('WHATSAPP_IMAGE_API_ERROR', { error: err.message })
    }
  }

  // 2. Send Timetable / Bank / Text Details
  if (text) {
    try {
      const txtRes = await fetch(`https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanPhone,
          type: 'text',
          text: { preview_url: true, body: text }
        })
      })
      const txtData = await txtRes.json().catch(() => ({}))
      logEvent('WHATSAPP_TEXT_API_RESULT', { status: txtRes.status, ok: txtRes.ok, response: txtData })
    } catch (err) {
      logEvent('WHATSAPP_TEXT_API_ERROR', { error: err.message })
    }
  }

  return true
}

// In-memory curriculum cache synced from CRM
let DYNAMIC_COURSES = []
let DYNAMIC_BANK_DETAILS = BANK_DETAILS_TEXT

async function refreshCurriculumFromCrm() {
  try {
    const crmBase = CRM_WEBHOOK_URL.replace(/\/api\/whatsapp\/webhook\/?$/, '')
    const res = await fetch(`${crmBase}/api/ai-agent/curriculum`, { signal: AbortSignal.timeout(4000) })
    if (res.ok) {
      const data = await res.json()
      if (data.courses && Array.isArray(data.courses) && data.courses.length > 0) {
        DYNAMIC_COURSES = data.courses
        logEvent('DYNAMIC_CURRICULUM_SYNCED', { count: DYNAMIC_COURSES.length })
      }
      if (data.academy?.bankDetails) {
        DYNAMIC_BANK_DETAILS = data.academy.bankDetails
      }
    }
  } catch (err) {
    // Gracefully use local default data
  }
}

// Initial fetch and 5-minute periodic refresh
refreshCurriculumFromCrm()
setInterval(refreshCurriculumFromCrm, 5 * 60 * 1000)

// Active call sessions: callId -> session object
const activeCalls = new Map()

/**
 * Robust dispatcher for course flyer, notes & bank details
 * Matches grade or specific course (e.g. Geometry) to the exact flyer
 */
function dispatchDetailsForGrade(callId, query, includeBank = true) {
  const c = activeCalls.get(callId)
  if (!c || !c.callerPhone) return false

  const q = String(query || '').toLowerCase().trim()
  let matchedCourse = null

  // 1. Match against dynamic courses list if loaded
  if (DYNAMIC_COURSES.length > 0 && q) {
    matchedCourse = DYNAMIC_COURSES.find(crs => {
      const name = crs.name.toLowerCase()
      const code = crs.code.toLowerCase()
      return name.includes(q) || code.includes(q) || (crs.grade && q.includes(String(crs.grade)))
    })
  }

  // 2. Fallback to Grade regex
  let gradeNum = null
  const digitMatch = q.match(/\d+/)
  if (digitMatch) {
    gradeNum = parseInt(digitMatch[0], 10)
  }

  if (!matchedCourse && gradeNum && DYNAMIC_COURSES.length > 0) {
    matchedCourse = DYNAMIC_COURSES.find(crs => crs.grade === gradeNum)
  }

  c.detailsSent = true
  if (gradeNum) c.requestedGrade = gradeNum

  let msgText = ''
  let flyerUrl = null
  let flyerCaption = undefined

  if (matchedCourse) {
    msgText += `📚 *MathsPS — ${matchedCourse.name}*\n\n`
    msgText += `💰 පාඨමාලා ගාස්තුව: *රු. ${matchedCourse.fee.toLocaleString()} (${matchedCourse.billingType === 'ONE_TIME' ? 'One-Time' : 'මාසිකව'})*\n`
    if (matchedCourse.notes) {
      msgText += `📌 විස්තර සහ වේලාවන්:\n${matchedCourse.notes}\n\n`
    }
    flyerUrl = matchedCourse.flyerUrl || (matchedCourse.grade ? GRADE_FLYERS[matchedCourse.grade] : null)
    flyerCaption = `📊 MathsPS — ${matchedCourse.name}`
  } else if (gradeNum && GRADE_TIMETABLES[gradeNum]) {
    msgText += `📚 *MathsPS — ${gradeNum} ශ්‍රේණිය පන්ති කාලසටහන*\n\n`
    msgText += `👨‍🏫 ගුරුතුමා: *ප්‍රබුද්ධ සම්පත් සර් (B.Sc.)*\n`
    msgText += `⏰ වේලාව: *${GRADE_TIMETABLES[gradeNum]}*\n`
    msgText += `📍 ක්‍රමවේදය: Physical පන්ති සහ Online Zoom Live (LMS Recordings සහිතව)\n\n`
    flyerUrl = GRADE_FLYERS[gradeNum] || null
    flyerCaption = `📊 MathsPS — ${gradeNum} ශ්‍රේණිය පන්ති විස්තර`
  }

  if (includeBank) {
    msgText += `${DYNAMIC_BANK_DETAILS || BANK_DETAILS_TEXT}\n\n`
  }

  if (!msgText) {
    msgText = `ආයුබෝවන්! ඔබ MathsPS වෙතින් විමසූ පන්ති විස්තර මෙසේය.\nඅමතර විස්තර සඳහා ඕනෑම වේලාවක මෙම අංකයට පණිවිඩයක් එවන්න.`
  }

  logEvent('DISPATCHING_WHATSAPP_DETAILS', { callId, phone: c.callerPhone, course: matchedCourse?.name || gradeNum, hasFlyer: Boolean(flyerUrl) })

  sendWhatsAppMessageToCaller(c.callerPhone, msgText, flyerUrl, flyerCaption).then(() => {
    logEvent('WHATSAPP_DISPATCH_SUCCESS', { callId, phone: c.callerPhone, course: matchedCourse?.name || gradeNum })
  }).catch(err => {
    logEvent('WHATSAPP_DISPATCH_ERROR', { callId, error: err.message })
  })

  return { success: true, course: matchedCourse?.name || gradeNum, phone: c.callerPhone }
}

// Pre-load instant studio greeting frames for 0.0s instant startup
let PRE_BUFFERED_GREETING_FRAMES = []
try {
  const greetingPath = path.join(__dirname, 'greeting.opus.json')
  if (fs.existsSync(greetingPath)) {
    const rawFrames = JSON.parse(fs.readFileSync(greetingPath, 'utf8'))
    PRE_BUFFERED_GREETING_FRAMES = rawFrames.map(f => Buffer.from(f, 'base64'))
    console.log(`🎙️ Pre-loaded ${PRE_BUFFERED_GREETING_FRAMES.length} greeting Opus frames for zero-latency call pickup.`)
  }
} catch (loadErr) {
  console.warn('Could not pre-load greeting.opus.json:', loadErr.message)
}

/**
 * Builds dynamic system prompt containing the latest course notes and schedules
 */
function buildSystemPrompt() {
  let curriculumText = ''
  if (DYNAMIC_COURSES.length > 0) {
    curriculumText = DYNAMIC_COURSES.map(c => 
      `• ${c.name} (Fee: Rs. ${c.fee}): ${c.notes || ''}`
    ).join('\n')
  } else {
    curriculumText = Object.entries(GRADE_TIMETABLES).map(([gr, time]) => 
      `• Grade ${gr}: ${time}`
    ).join('\n')
  }

  return `You are the Senior Admissions Coordinator for MathsPS (Prabuddha Sampath Sir's Mathematics Academy, Sri Lanka).
You are currently speaking directly with a parent or student on a live WhatsApp phone call.

CRITICAL SINHALA PRONUNCIATION & PHONETICS RULES:
- Always speak purely in colloquial, natural, fluent Sri Lankan Sinhala with perfect native pronunciation.
- Pronounce key academy names clearly:
  * "ප්‍රබුද්ධ සම්පත්" -> pronounce smoothly as "ප්‍රබුද්ධ සම්පත්" (Pra-buddha Sam-path).
  * "පේරාදෙණි ආයතනය" -> pronounce clearly as "පේරාදෙණිය" (Pey-raa-deniya).
  * "කුරුණෑගල" -> pronounce as "කුරුණෑගල" (Kuru-nae-gala).
  * "රජපිහිල්ල පාර" -> pronounce as "රජපිහිල්ල පාර" (Raja-pihilla paara).
- Numbers and Grades: Speak numbers as full Sinhala words aloud, NEVER read raw English digits or symbols:
  * "Grade 6" -> speak aloud as "හය වසර" or "හයේ ශ්‍රේණිය"
  * "Grade 7" -> speak aloud as "හත වසර" or "හතේ ශ්‍රේණිය"
  * "Grade 8" -> speak aloud as "අට වසර" or "අටේ ශ්‍රේණිය"
  * "Grade 9" -> speak aloud as "නවය වසර" or "නවයේ ශ්‍රේණිය"
  * "Grade 10" -> speak aloud as "දහය වසර" or "දහයේ ශ්‍රේණිය"
  * "Grade 11 / O/L" -> speak aloud as "එකොළහ වසර" or "ඕලෙවල් පන්තිය"
  * Times: E.g., "8.00 - 10.30" speak as "උදෑසන අටේ සිට දහයයි තිහ දක්වා". E.g., "6.00" speak as "සවස හයට".
  * Fees: E.g., "Rs. 2,500" speak as "රුපියල් දෙදහස් පන්සියයක්".

Your personality and tone:
- Speak in a warm, dignified, calm, articulate, and professional Sinhala (ගෞරවනීය, සුහදශීලී, පැහැදිලි කථන ශෛලියක්).
- Address the caller respectfully using polite honorifics (e.g., "ඔබතුමා / ඔබතුමිය", "කරුණාවෙන්", "ස්තූතියි").
- Do NOT sound like an automated robotic script. Use natural human conversational pacing, clear pronunciation, and concise answers (1 to 2 sentences per turn).
- Accurate facts:
  * Teacher: Prabuddha Sampath Sir (B.Sc.)
  * Available Courses & Schedules:
${curriculumText}
  * Modes: Physical Classes & Online Live Zoom with LMS Recordings (www.prabuddhamaths.com).
  * Payment: Bank of Ceylon (BOC), Commercial Bank, Sampath Bank.

SENDING DETAILS TO WHATSAPP RULES:
- If the caller asks to receive details on WhatsApp (e.g., "මට WhatsApp එකට විස්තර එවන්න", "Send me timetable on WhatsApp", "Bank details එවන්න"):
  1. If grade or course is unknown, ask: "ඔබතුමා විස්තර බලාපොරොත්තු වන්නේ කුමන ශ්‍රේණිය හෝ පාඨමාලාව සඳහාද?"
  2. If grade or course is known or once caller confirms, you MUST call the 'send_whatsapp_details' tool immediately!
  3. When invoking the tool, say aloud: "මම දැන් ඔබතුමාගේ WhatsApp එකට විස්තර සහ පන්ති කාලසටහන එව්වා. කරුණාකර එය පරීක්ෂා කර බලන්න."

CALL CLOSING RULES:
- When the caller says "thank you", "thanks", "ok thanks", "bye", "හරි ස්තූතියි", "එහෙනම් තියන්නම්", or wants to hang up:
  Politely conclude with "ස්තූතියි! සුභ දවසක් වේවා!" and call the 'end_call' tool immediately to hang up the phone call.`
}

/**
 * Health check & debug logs endpoints
 */
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'MathsPS WhatsApp Realtime Voice Bridge',
    active_calls: activeCalls.size,
    voice: GEMINI_VOICE_NAME,
    timestamp: new Date().toISOString()
  })
})

app.get('/debug-logs', (req, res) => {
  try {
    res.json({
      status: 'ok',
      active_calls: Array.from(activeCalls.keys()),
      voice: GEMINI_VOICE_NAME,
      count: debugLogs.length,
      logs: debugLogs
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/**
 * 48kHz to 16kHz downsampler with 3-tap sample averaging
 * Low-pass anti-aliasing filter prevents audio distortion into Gemini Live
 */
function downsample48to16(buffer48) {
  const samples48 = Math.floor(buffer48.length / 2)
  const samples16 = Math.floor(samples48 / 3)
  const buffer16 = Buffer.alloc(samples16 * 2)
  for (let i = 0; i < samples16; i++) {
    const idx = i * 3 * 2
    const s1 = buffer48.readInt16LE(idx)
    const s2 = buffer48.readInt16LE(idx + 2)
    const s3 = buffer48.readInt16LE(idx + 4)
    const avg = Math.round((s1 + s2 + s3) / 3)
    buffer16.writeInt16LE(avg, i * 2)
  }
  return buffer16
}

/**
 * 24kHz to 48kHz upsampler with linear interpolation
 * Eliminates step-waveform aliasing and produces warm, natural studio speech
 */
function upsample24to48(buf24) {
  const samples = Math.floor(buf24.length / 2)
  const buf48 = Buffer.alloc(samples * 4)
  for (let i = 0; i < samples; i++) {
    const current = buf24.readInt16LE(i * 2)
    const next = (i + 1 < samples) ? buf24.readInt16LE((i + 1) * 2) : current
    const mid = Math.round((current + next) / 2)
    buf48.writeInt16LE(current, i * 4)
    buf48.writeInt16LE(mid, i * 4 + 2)
  }
  return buf48
}

/**
 * Continuous 20ms RTP Media Pump with Smooth Hysteresis Jitter Buffer
 * Prevents choppy voice ("kedi kedi ahenne") by smoothly buffering packets
 * and keeping connection alive with comfort silence to avoid WhatsApp timeout (error 138021)
 */
function startMediaPump(callId) {
  const call = activeCalls.get(callId)
  if (!call || call.mediaTimer) return

  logEvent('MEDIA_PUMP_STARTED', { callId })
  const silenceOpus = Buffer.from([0xf8, 0xff, 0xfe]) // 20ms Opus comfort silence
  let isPlayingSpeech = false
  let emptyTicks = 0
  let lastValidOpus = silenceOpus
  // Dynamic Jitter Buffer:
  // Starts with 7 frames (140ms) buffer to absorb transcontinental network jitter (Render -> Colombo)
  const JITTER_BUFFER_TARGET = 7 // 7 * 20ms = 140ms smooth jitter buffer
  const MAX_QUEUE_FRAMES = 50   // Prevent latency drift over 1 second

  call.mediaTimer = setInterval(() => {
    const c = activeCalls.get(callId)
    if (!c || !c.outgoingAudioTrack) {
      clearInterval(call.mediaTimer)
      return
    }

    let payload = silenceOpus

    // High latency drift protection: if queue gets unnaturally backed up, gently drain old frames
    if (c.audioQueue.length > MAX_QUEUE_FRAMES) {
      c.audioQueue.splice(0, c.audioQueue.length - JITTER_BUFFER_TARGET)
    }

    if (c.audioQueue.length > 0) {
      if (!isPlayingSpeech) {
        // Pre-roll: wait until queue hits the jitter target so speech plays continuous and buttery smooth
        if (c.audioQueue.length >= JITTER_BUFFER_TARGET) {
          isPlayingSpeech = true
          emptyTicks = 0
          payload = c.audioQueue.shift()
          lastValidOpus = payload
        }
      } else {
        emptyTicks = 0
        payload = c.audioQueue.shift()
        lastValidOpus = payload
      }
    } else {
      if (isPlayingSpeech) {
        emptyTicks++
        // Packet Loss Concealment (PLC):
        // If queue momentarily empties for < 8 ticks (160ms), repeat last packet or low-volume comfort frame
        // instead of instant hard silence cut
        if (emptyTicks <= 8) {
          payload = silenceOpus // Comfort noise prevents harsh audio clicks
        } else {
          isPlayingSpeech = false
        }
      }
    }

    c.seq = (c.seq + 1) & 0xffff
    c.ts = (c.ts + 960) & 0xffffffff // 20ms at 48000Hz = 960 samples

    try {
      const header = new RtpHeader({
        payloadType: 111,
        sequenceNumber: c.seq,
        timestamp: c.ts,
        ssrc: c.outgoingAudioTrack.ssrc || 10001,
        marker: false
      })
      const packet = new RtpPacket(header, payload)
      c.outgoingAudioTrack.writeRtp(packet)
    } catch (e) {
      // Avoid crash on closed track
    }
  }, 20)
}

/**
 * Handle incoming caller audio track and pipe to Gemini Live in steady 80ms chunks
 */
function setupIncomingTrack(incomingTrack, call_id) {
  if (!incomingTrack || incomingTrack._listening) return
  incomingTrack._listening = true

  logEvent('WEBRTC_TRACK_REGISTERED', { call_id, trackId: incomingTrack.id })
  let packetCount = 0

  incomingTrack.onReceiveRtp.subscribe((rtp) => {
    packetCount++
    if (packetCount === 1 || packetCount % 200 === 0) {
      logEvent('CALLER_AUDIO_STREAMING', { call_id, packetCount })
    }

    const callData = activeCalls.get(call_id)
    if (callData?.geminiWs && callData.geminiWs.readyState === WebSocket.OPEN && callData.opusDecoder) {
      try {
        // Decode incoming Opus from caller (48kHz 16-bit PCM)
        const pcm48 = callData.opusDecoder.decode(rtp.payload)
        if (pcm48 && pcm48.length > 0) {
          const pcm16 = downsample48to16(pcm48)
          callData.callerPcmBuffer = Buffer.concat([callData.callerPcmBuffer || Buffer.alloc(0), pcm16])

          // Accumulate 80ms of audio (1280 samples = 2560 bytes) before sending to Gemini
          // This keeps WebSocket transmission smooth and prevents socket congestion
          while (callData.callerPcmBuffer.length >= 2560) {
            const chunk = callData.callerPcmBuffer.subarray(0, 2560)
            callData.callerPcmBuffer = callData.callerPcmBuffer.subarray(2560)

            callData.geminiWs.send(JSON.stringify({
              realtimeInput: {
                mediaChunks: [{
                  mimeType: 'audio/pcm;rate=16000',
                  data: chunk.toString('base64')
                }]
              }
            }))
          }
        }
      } catch (e) {
        // Ignore corrupted RTP audio frames
      }
    }
  })
}

/**
 * Inbound Call Signaling Hook
 * Receives incoming call offers from Meta or forwarded by Vercel Webhook
 */
app.post('/webhook/call', async (req, res) => {
  try {
    const { call_id, from, session, action, sdp, event, raw_call } = req.body

    if (!call_id) {
      return res.status(400).json({ error: 'Missing call_id' })
    }

    const incomingSdp = sdp || session?.sdp || raw_call?.sdp || raw_call?.session?.sdp
    const callAction = action || (event === 'terminate' || event === 'terminated' ? 'terminate' : 'offer')

    logEvent('CALL_INBOUND', {
      call_id,
      from,
      event,
      action: callAction,
      hasSdp: Boolean(incomingSdp)
    })

    // 1. Handle Call Termination
    if (callAction === 'terminate' || callAction === 'reject' || event === 'terminate' || event === 'terminated') {
      terminateCall(call_id)
      logEvent('CALL_TERMINATED', { call_id })
      return res.json({ status: 'terminated' })
    }

    // Initialize werift WebRTC PeerConnection
    const pc = new RTCPeerConnection({
      codecs: {
        audio: [
          new RTCRtpCodecParameters({
            mimeType: 'audio/opus',
            clockRate: 48000,
            channels: 2
          })
        ]
      }
    })

    // Audio track to send back to caller
    const outgoingAudioTrack = new MediaStreamTrack({ kind: 'audio' })
    pc.addTrack(outgoingAudioTrack)

    // Store in active calls map
    const sessionData = {
      pc,
      outgoingAudioTrack,
      callerPhone: from,
      startedAt: Date.now(),
      opusEncoder: new OpusScript(48000, 1, OpusScript.Application.VOIP), // 48kHz native Opus encoder
      opusDecoder: new OpusScript(48000, 1, OpusScript.Application.VOIP),
      audioQueue: PRE_BUFFERED_GREETING_FRAMES.length > 0 ? [...PRE_BUFFERED_GREETING_FRAMES] : [],
      seq: 0,
      ts: 0,
      pcmBuffer: Buffer.alloc(0),
      callerPcmBuffer: Buffer.alloc(0),
      mediaTimer: null,
      autoHangupTimer: null,
      detailsSent: false,
      requestedGrade: null
    }
    activeCalls.set(call_id, sessionData)

    // IMPORTANT: Register track event listeners BEFORE setRemoteDescription
    pc.onTrack.subscribe((track) => setupIncomingTrack(track, call_id))
    pc.ontrack = (evt) => setupIncomingTrack(evt.track, call_id)

    pc.connectionStateChange.subscribe((state) => {
      logEvent('WEBRTC_STATE_CHANGE', { call_id, state })
      if (state === 'connected') {
        startMediaPump(call_id)
      } else if (state === 'closed' || state === 'failed') {
        terminateCall(call_id)
      }
    })

    let localSdp = null
    let sdpType = 'answer'
    if (incomingSdp) {
      logEvent('WEBRTC_REMOTE_OFFER_RECEIVED', { call_id, sdpLength: incomingSdp.length })
      // Meta provided SDP Offer -> We create SDP Answer
      await pc.setRemoteDescription(new RTCSessionDescription(incomingSdp, 'offer'))

      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      localSdp = answer.sdp
      sdpType = 'answer'
    } else {
      logEvent('WEBRTC_LOCAL_OFFER_GENERATED', { call_id })
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      localSdp = offer.sdp
      sdpType = 'offer'
    }

    // Capture any remote track created during setRemoteDescription
    for (const receiver of pc.getReceivers()) {
      if (receiver.track) {
        setupIncomingTrack(receiver.track, call_id)
      }
    }

    // Send accept to Meta Graph API
    if (WHATSAPP_ACCESS_TOKEN && WHATSAPP_PHONE_NUMBER_ID) {
      logEvent('META_API_SENDING_ACCEPT', { call_id, sdpType })
      try {
        const metaRes = await fetch(`https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/calls`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            call_id: call_id,
            action: 'accept',
            session: {
              sdp_type: sdpType,
              sdp: localSdp
            }
          })
        })

        const metaData = await metaRes.json()
        logEvent(metaRes.ok ? 'META_API_ACCEPT_SUCCESS' : 'META_API_ACCEPT_FAILED', {
          call_id,
          status: metaRes.status,
          response: metaData
        })
      } catch (metaErr) {
        logEvent('META_API_NETWORK_ERROR', { call_id, error: metaErr.message })
      }
    }

    // Connect to Gemini Live Multimodal WebSocket
    initGeminiLiveConnection(call_id)

    return res.json({
      status: 'accepted',
      call_id,
      sdp_type: sdpType,
      sdp: localSdp
    })
  } catch (err) {
    logEvent('CALL_HANDLING_EXCEPTION', { error: err.message, stack: err.stack })
    return res.status(500).json({ error: err.message })
  }
})

/**
 * Connect to Google Gemini Multimodal Live API (v1beta)
 */
function initGeminiLiveConnection(callId) {
  if (!GEMINI_API_KEY) {
    logEvent('GEMINI_KEY_MISSING', { callId })
    return
  }

  const liveUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${GEMINI_API_KEY}`
  const ws = new WebSocket(liveUrl)

  const callData = activeCalls.get(callId)
  if (callData) callData.geminiWs = ws

  ws.on('open', () => {
    logEvent('GEMINI_WS_OPEN', { callId, voice: GEMINI_VOICE_NAME })
    // Session Setup with professional voice + tools
    ws.send(JSON.stringify({
      setup: {
        model: 'models/gemini-2.5-flash-native-audio-preview-12-2025',
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: GEMINI_VOICE_NAME }
            }
          }
        },
        tools: [{
          functionDeclarations: [
            {
              name: 'send_whatsapp_details',
              description: 'Send class timetable, flyer, or bank payment details directly to caller WhatsApp chat during call. Use when caller asks for details to be sent to WhatsApp.',
              parameters: {
                type: 'OBJECT',
                properties: {
                  grade: { type: 'STRING', description: 'Grade number (6, 7, 8, 9, 10, or 11)' },
                  include_bank: { type: 'BOOLEAN', description: 'True if caller requested bank details or payment info' },
                  include_timetable: { type: 'BOOLEAN', description: 'True if caller requested class timetable or flyer' }
                }
              }
            },
            {
              name: 'end_call',
              description: 'End and close the phone call when caller says goodbye, thank you, bye, ok thanks, හරි ස්තූතියි, or when conversation ends.',
              parameters: {
                type: 'OBJECT',
                properties: {
                  reason: { type: 'STRING', description: 'Reason for hanging up' }
                }
              }
            }
          ]
        }],
        systemInstruction: {
          parts: [{ text: buildSystemPrompt() }]
        }
      }
    }))
  })

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString())

      // 1. Setup complete -> Session ready for incoming caller audio
      if (msg.setupComplete) {
        logEvent('GEMINI_SETUP_COMPLETE', { callId })
      }

      // 2. Handle Tool Calls from Gemini
      if (msg.toolCall) {
        for (const fc of msg.toolCall.functionCalls || []) {
          // Tool A: send_whatsapp_details
          if (fc.name === 'send_whatsapp_details') {
            const args = fc.args || {}
            logEvent('GEMINI_TOOL_SEND_WHATSAPP_DETAILS', { callId, args })
            const result = dispatchDetailsForGrade(callId, args.grade, args.include_bank !== false)

            // CRITICAL FIX: Send valid toolResponse conforming to Gemini BidiGenerateContent protocol
            try {
              ws.send(JSON.stringify({
                toolResponse: {
                  functionResponses: [
                    {
                      id: fc.id,
                      name: fc.name,
                      response: {
                        output: result || { success: true }
                      }
                    }
                  ]
                }
              }))
              logEvent('GEMINI_TOOL_RESPONSE_SENT', { callId, tool: fc.name, id: fc.id })
            } catch (err) {
              logEvent('GEMINI_TOOL_RESPONSE_SEND_ERROR', { callId, error: err.message })
            }
          }

          // Tool B: end_call
          if (fc.name === 'end_call') {
            logEvent('GEMINI_TOOL_END_CALL', { callId, reason: fc.args?.reason })
            try {
              ws.send(JSON.stringify({
                toolResponse: {
                  functionResponses: [
                    {
                      id: fc.id,
                      name: fc.name,
                      response: { output: { success: true, status: 'terminating' } }
                    }
                  ]
                }
              }))
            } catch (e) {}

            const c = activeCalls.get(callId)
            if (c && !c.autoHangupTimer) {
              c.autoHangupTimer = setTimeout(() => {
                terminateCall(callId)
              }, 2500)
            }
          }
        }
      }

      // 3. Handle interruption: user started speaking while AI was speaking
      if (msg.serverContent?.interrupted) {
        logEvent('GEMINI_INTERRUPTED', { callId })
        const c = activeCalls.get(callId)
        if (c) {
          c.audioQueue = []
          c.pcmBuffer = Buffer.alloc(0)
        }
      }

      // 4. Handle audio stream from Gemini
      const parts = msg.serverContent?.modelTurn?.parts
      if (parts) {
        const c = activeCalls.get(callId)
        if (!c || !c.opusEncoder) return

        for (const p of parts) {
          if (p.inlineData && p.inlineData.data) {
            const rawPcm24 = Buffer.from(p.inlineData.data, 'base64')
            c.pcmBuffer = Buffer.concat([c.pcmBuffer, rawPcm24])

            // Slices of 20ms at 24000Hz = 480 samples = 960 bytes
            while (c.pcmBuffer.length >= 960) {
              const chunk24 = c.pcmBuffer.subarray(0, 960)
              c.pcmBuffer = c.pcmBuffer.subarray(960)

              try {
                // Upsample 24kHz to 48kHz with interpolation and encode with 48kHz Opus
                const chunk48 = upsample24to48(chunk24)
                const opusFrame = c.opusEncoder.encode(chunk48, 960)
                c.audioQueue.push(opusFrame)
              } catch (encErr) {
                // Ignore encode error
              }
            }
          }

          // Safety Net: Monitor text transcript for intent triggers & auto-hangup
          if (p.text) {
            const lowerText = p.text.toLowerCase()

            // Safety Intent A: If AI confirms details are being sent, ensure dispatch immediately!
            if (!c.detailsSent) {
              const sendingTriggers = [
                'whatsapp එකට', 'විස්තර එව්වා', 'කාලසටහන එව්වා', 'විස්තර එවන්නම්',
                'පරීක්ෂා කර බලන්න', 'whatsapp එකට එව්වා', 'send whatsapp'
              ]
              if (sendingTriggers.some(t => lowerText.includes(t))) {
                const gradeMatch = lowerText.match(/(?:grade\s*|ශ්‍රේණිය\s*|ශ්‍රේණියේ\s*)?(\b[6-9]|10|11\b)/)
                const inferredGrade = gradeMatch ? parseInt(gradeMatch[1], 10) : c.requestedGrade || 10
                logEvent('INTENT_TRIGGERED_WHATSAPP_DISPATCH', { callId, textSnippet: p.text.slice(0, 60), inferredGrade })
                dispatchDetailsForGrade(callId, inferredGrade, true)
              }
            }

            // Track grade mentions
            const gMatch = lowerText.match(/(?:grade\s*|ශ්‍රේණිය\s*|ශ්‍රේණියේ\s*)?(\b[6-9]|10|11\b)/)
            if (gMatch) {
              c.requestedGrade = parseInt(gMatch[1], 10)
            }

            // Safety Auto-hangup trigger
            if (lowerText.includes('සුභ දවසක්') || lowerText.includes('have a great day') || lowerText.includes('goodbye')) {
              if (!c.autoHangupTimer) {
                logEvent('SCHEDULED_AUTO_HANGUP', { callId, reason: p.text.slice(0, 50) })
                c.autoHangupTimer = setTimeout(() => {
                  terminateCall(callId)
                }, 3000)
              }
            }
          }
        }
      }
    } catch (e) {
      logEvent('GEMINI_MESSAGE_PARSE_ERROR', { callId, error: e.message })
    }
  })

  ws.on('close', (code, reason) => {
    logEvent('GEMINI_WS_CLOSED', { callId, code, reason: reason?.toString() })
    // Resilience: If closed prematurely while WebRTC call is still active, attempt reconnect
    const c = activeCalls.get(callId)
    if (c && c.pc && c.pc.connectionState === 'connected' && code !== 1000 && !c.autoHangupTimer) {
      logEvent('GEMINI_AUTO_RECONNECTING', { callId })
      setTimeout(() => {
        if (activeCalls.has(callId)) initGeminiLiveConnection(callId)
      }, 500)
    }
  })

  ws.on('error', (e) => {
    logEvent('GEMINI_WS_ERROR', { callId, error: e.message })
  })
}

function terminateCall(callId) {
  const call = activeCalls.get(callId)
  if (!call) return

  logEvent('TERMINATING_CALL', {
    callId,
    callerPhone: call.callerPhone,
    detailsSent: call.detailsSent,
    requestedGrade: call.requestedGrade
  })

  // Fallback: If caller asked for a grade during the call but details were not dispatched yet, deliver now!
  if (!call.detailsSent && call.requestedGrade && call.callerPhone) {
    logEvent('FALLBACK_POST_CALL_DISPATCH', { callId, grade: call.requestedGrade, phone: call.callerPhone })
    dispatchDetailsForGrade(callId, call.requestedGrade, true)
  }

  if (call.autoHangupTimer) {
    clearTimeout(call.autoHangupTimer)
  }
  if (call.mediaTimer) {
    clearInterval(call.mediaTimer)
  }
  if (call.opusEncoder) {
    try { call.opusEncoder.delete() } catch (e) {}
  }
  if (call.opusDecoder) {
    try { call.opusDecoder.delete() } catch (e) {}
  }
  if (call.geminiWs) {
    try { call.geminiWs.close() } catch (e) {}
  }
  if (call.pc) {
    try { call.pc.close() } catch (e) {}
  }

  const callerPhone = call.callerPhone
  const detailsSent = call.detailsSent
  activeCalls.delete(callId)

  // Trigger hangup on Meta WhatsApp Graph API to end call on caller phone
  if (WHATSAPP_ACCESS_TOKEN && WHATSAPP_PHONE_NUMBER_ID) {
    fetch(`https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/calls`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        call_id: callId,
        action: 'terminate'
      })
    }).catch(() => {})
  }

  // Trigger follow-up WhatsApp dispatch through CRM
  if (callerPhone && CRM_WEBHOOK_URL) {
    fetch(CRM_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entry: [{
          changes: [{
            value: {
              calls: [{
                id: callId,
                from: callerPhone,
                event: 'terminated',
                detailsSent: detailsSent
              }]
            }
          }]
        }]
      })
    }).catch(() => {})
  }
}

app.listen(PORT, () => {
  console.log(`🚀 MathsPS WhatsApp Live Voice Bridge running on port ${PORT}`)
  console.log(`   Health: http://localhost:${PORT}/`)
  console.log(`   Signaling: http://localhost:${PORT}/webhook/call`)
  console.log(`   Voice: ${GEMINI_VOICE_NAME}`)
})
