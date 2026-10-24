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

/**
 * Dispatch text or media WhatsApp message directly to caller phone
 */
async function sendWhatsAppMessageToCaller(recipientPhone, text, imageUrl) {
  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID || !recipientPhone) return

  const cleanPhone = recipientPhone.replace(/\D/g, '')

  if (text) {
    try {
      await fetch(`https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
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
    } catch (err) {
      console.error('Error sending WhatsApp text:', err.message)
    }
  }

  if (imageUrl) {
    try {
      await fetch(`https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
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
          image: { link: imageUrl }
        })
      })
    } catch (err) {
      console.error('Error sending WhatsApp image:', err.message)
    }
  }
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

// Active call sessions: callId -> session object
const activeCalls = new Map()

// System prompt for Live Voice Agent
const SYSTEM_PROMPT = `You are the Senior Admissions Coordinator for MathsPS (Prabuddha Sampath Sir's Mathematics Academy, Sri Lanka).
You are currently speaking directly with a parent or student on a live WhatsApp phone call.
Your personality and tone:
- Speak in a warm, dignified, calm, articulate, and professional Sinhala (ගෞරවනීය, සුහදශීලී, පැහැදිලි කථන ශෛලියක්).
- Address the caller respectfully using polite honorifics (e.g., "ඔබතුමා / ඔබතුමිය", "කරුණාවෙන්", "ස්තූතියි").
- Do NOT sound like an automated robotic script. Use natural human conversational pacing, clear pronunciation, and concise answers (1 to 2 sentences per turn).
- Accurate facts:
  * Teacher: Prabuddha Sampath Sir (B.Sc.)
  * Grades: Grade 6 to 11
  * Grade 6: Every Monday 3.30 PM - 6.00 PM
  * Grade 7: Every Tuesday 3.30 PM - 6.00 PM
  * Grade 8: Every Wednesday 3.30 PM - 6.00 PM
  * Grade 9: Every Thursday 3.30 PM - 6.00 PM
  * Grade 10: Every Friday 3.00 PM - 6.30 PM
  * Grade 11: Every Saturday 8.00 AM - 12.30 PM
  * Class Modes: Physical Classes & Online Live Zoom with LMS Recordings.
  * Payment: Bank of Ceylon (BOC), Commercial Bank, Sampath Bank.

SENDING DETAILS TO WHATSAPP RULES:
- If the caller asks to receive details on WhatsApp (e.g., "මට WhatsApp එකට විස්තර එවන්න", "Send me timetable on WhatsApp", "Bank details එවන්න"):
  1. Ask before sending if grade is unknown: "ඔබතුමා විස්තර බලාපොරොත්තු වන්නේ කුමන ශ්‍රේණිය (6 සිට 11 දක්වා) සඳහාද?"
  2. If grade is known or agreed, politely confirm: "හොඳයි ඔබතුමාගේ මෙම WhatsApp අංකයටම [ශ්‍රේණිය] පන්ති කාලසටහන සහ විස්තර දැන්ම එවන්නද?"
  3. Once confirmed or requested, you MUST call the 'send_whatsapp_details' tool immediately!
  4. Immediately after calling the tool, say aloud: "මම දැන් ඔබතුමාගේ WhatsApp එකට විස්තර සහ පන්ති කාලසටහන එව්වා. කරුණාකර එය පරීක්ෂා කර බලන්න."

CALL CLOSING RULES:
- When the caller says "thank you", "thanks", "ok thanks", "bye", "හරි ස්තූතියි", "එහෙනම් තියන්නම්", or wants to hang up:
  Politely conclude with "ස්තූතියි! සුභ දවසක් වේවා!" and call the 'end_call' tool immediately to hang up the phone call.`

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
 * 48kHz to 16kHz downsampler for caller microphone audio
 */
function downsample48to16(buffer48) {
  const samples48 = Math.floor(buffer48.length / 2)
  const samples16 = Math.floor(samples48 / 3)
  const buffer16 = Buffer.alloc(samples16 * 2)
  for (let i = 0; i < samples16; i++) {
    const val = buffer48.readInt16LE(i * 3 * 2)
    buffer16.writeInt16LE(val, i * 2)
  }
  return buffer16
}

/**
 * 24kHz to 48kHz upsampler for crystal-clear 48kHz Opus encoding
 */
function upsample24to48(buf24) {
  const samples = Math.floor(buf24.length / 2)
  const buf48 = Buffer.alloc(samples * 4)
  for (let i = 0; i < samples; i++) {
    const val = buf24.readInt16LE(i * 2)
    buf48.writeInt16LE(val, i * 4)
    buf48.writeInt16LE(val, i * 4 + 2)
  }
  return buf48
}

/**
 * Continuous 20ms RTP Media Pump with 120ms Jitter Buffer
 * Ensures smooth, unbroken Sinhala speech playback and prevents WebRTC timeout (error 138021)
 */
function startMediaPump(callId) {
  const call = activeCalls.get(callId)
  if (!call || call.mediaTimer) return

  logEvent('MEDIA_PUMP_STARTED', { callId })
  const silenceOpus = Buffer.from([0xf8, 0xff, 0xfe]) // 20ms Opus comfort silence
  let isPlayingSpeech = false
  const JITTER_BUFFER_THRESHOLD = 6 // 6 * 20ms = 120ms pre-buffer to prevent stutter

  call.mediaTimer = setInterval(() => {
    const c = activeCalls.get(callId)
    if (!c || !c.outgoingAudioTrack) {
      clearInterval(call.mediaTimer)
      return
    }

    let payload = silenceOpus

    if (c.audioQueue.length > 0) {
      if (!isPlayingSpeech) {
        if (c.audioQueue.length >= JITTER_BUFFER_THRESHOLD) {
          isPlayingSpeech = true
          payload = c.audioQueue.shift()
        }
      } else {
        payload = c.audioQueue.shift()
      }
    } else {
      isPlayingSpeech = false
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
 * Handle incoming caller audio track and pipe to Gemini Live
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
          // Downsample 48kHz to 16kHz for Gemini input
          const pcm16 = downsample48to16(pcm48)
          callData.geminiWs.send(JSON.stringify({
            realtimeInput: {
              mediaChunks: [{
                mimeType: 'audio/pcm;rate=16000',
                data: pcm16.toString('base64')
              }]
            }
          }))
        }
      } catch (e) {
        // Ignore corrupted RTP audio frames
      }
    }
  })
}

/**
 * Inbound Call Signaling Hook
 * Receives the incoming call offer from Meta or forwarded by Vercel Webhook
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
      mediaTimer: null,
      autoHangupTimer: null,
      detailsSent: false
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
          parts: [{ text: SYSTEM_PROMPT }]
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
            const gradeNum = parseInt(args.grade, 10)
            logEvent('GEMINI_TOOL_SEND_WHATSAPP_DETAILS', { callId, args })

            const c = activeCalls.get(callId)
            if (c && c.callerPhone) {
              c.detailsSent = true
              let msgText = ''
              if (gradeNum && GRADE_TIMETABLES[gradeNum]) {
                msgText += `📚 *MathsPS — ${gradeNum} ශ්‍රේණිය පන්ති කාලසටහන*\n\n`
                msgText += `👨‍🏫 ගුරුතුමා: *ප්‍රබුද්ධ සම්පත් සර් (B.Sc.)*\n`
                msgText += `⏰ වේලාව: *${GRADE_TIMETABLES[gradeNum]}*\n`
                msgText += `📍 ක්‍රමවේදය: Physical පන්ති සහ Online Zoom Live (LMS Recordings සහිතව)\n\n`
              }
              if (args.include_bank) {
                msgText += `${BANK_DETAILS_TEXT}\n\n`
              }
              if (!msgText) {
                msgText = `ආයුබෝවන්! ඔබ MathsPS වෙතින් විමසූ පන්ති විස්තර මෙසේය.\nඅමතර විස්තර සඳහා ඕනෑම වේලාවක මෙම අංකයට පණිවිඩයක් එවන්න.`
              }

              const flyerUrl = gradeNum ? GRADE_FLYERS[gradeNum] : null

              // Send to caller phone asynchronously
              sendWhatsAppMessageToCaller(c.callerPhone, msgText, flyerUrl).then(() => {
                logEvent('WHATSAPP_DISPATCH_SUCCESS', { callId, phone: c.callerPhone, grade: gradeNum })
              }).catch(err => {
                logEvent('WHATSAPP_DISPATCH_ERROR', { callId, error: err.message })
              })

              // Return tool response to Gemini Live
              ws.send(JSON.stringify({
                clientContent: {
                  turns: [{
                    role: 'user',
                    parts: [{
                      toolResponse: {
                        name: 'send_whatsapp_details',
                        response: { status: 'success', delivered_to: c.callerPhone, grade: gradeNum }
                      }
                    }]
                  }],
                  turnComplete: true
                }
              }))
            }
          }

          // Tool B: end_call
          if (fc.name === 'end_call') {
            logEvent('GEMINI_TOOL_END_CALL', { callId, reason: fc.args?.reason })
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
                // Upsample 24kHz to 48kHz and encode with 48kHz Opus
                const chunk48 = upsample24to48(chunk24)
                const opusFrame = c.opusEncoder.encode(chunk48, 960)
                c.audioQueue.push(opusFrame)
              } catch (encErr) {
                // Ignore encode error
              }
            }
          }

          // Check text transcript for auto-hangup parting phrases
          if (p.text) {
            const lowerText = p.text.toLowerCase()
            if (lowerText.includes('සුභ දවසක්') || lowerText.includes('have a great day') || lowerText.includes('goodbye')) {
              const c = activeCalls.get(callId)
              if (c && !c.autoHangupTimer) {
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
  })

  ws.on('error', (e) => {
    logEvent('GEMINI_WS_ERROR', { callId, error: e.message })
  })
}

function terminateCall(callId) {
  const call = activeCalls.get(callId)
  if (!call) return

  logEvent('TERMINATING_CALL', { callId, callerPhone: call.callerPhone, detailsSent: call.detailsSent })

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
  if (call.callerPhone && CRM_WEBHOOK_URL) {
    fetch(CRM_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entry: [{
          changes: [{
            value: {
              calls: [{
                id: callId,
                from: call.callerPhone,
                event: 'terminated',
                detailsSent: call.detailsSent
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
