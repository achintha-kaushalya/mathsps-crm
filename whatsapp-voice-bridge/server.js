/**
 * WhatsApp Live Voice Call Bridge (Meta WebRTC <-> Google Gemini Live Multimodal)
 * Autonomous real-time Sinhala conversational voice calling for MathsPS CRM.
 */

require('dotenv').config()
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
const CRM_WEBHOOK_URL = process.env.CRM_WEBHOOK_URL || 'https://mathsps-lead-crm.vercel.app/api/whatsapp/webhook'

// Active call sessions: callId -> session object
const activeCalls = new Map()

// System prompt for Live Voice Agent
const SYSTEM_PROMPT = `You are MathsPS AI Live Voice Agent for Prabuddha Sampath Sir's Mathematics Classes in Sri Lanka (MathsPS).
You are currently on a live phone call with a parent or student.
Always speak in natural, polite, respectful, and friendly Sinhala (සිංහල).
Provide accurate answers:
- Teacher: Prabuddha Sampath Sir (B.Sc.)
- Grades: Grade 6 to 11
- Grade 6: Every Monday 3.30 PM - 6.00 PM
- Grade 7: Every Tuesday 3.30 PM - 6.00 PM
- Grade 8: Every Wednesday 3.30 PM - 6.00 PM
- Grade 9: Every Thursday 3.30 PM - 6.00 PM
- Grade 10: Every Friday 3.00 PM - 6.30 PM
- Grade 11: Every Saturday 8.00 AM - 12.30 PM
- Class Modes: Physical Classes & Online Live Zoom with LMS Recordings.
- Payments: Bank of Ceylon (BOC), Commercial Bank, Sampath Bank.
Keep your answers brief and conversational (1 to 2 sentences per turn), as in a natural voice phone conversation.
Greet warmly: "ආයුබෝවන්! මම MathsPS කෘත්‍රිම බුද්ධි ගුරු සහායක. ඔබට අද උදව් කළ හැක්කේ කෙසේද?"`

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
    timestamp: new Date().toISOString()
  })
})

app.get('/debug-logs', (req, res) => {
  try {
    res.json({
      status: 'ok',
      active_calls: Array.from(activeCalls.keys()),
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
 * Continuous 20ms RTP Media Pump
 * Ensures WhatsApp client receives continuous audio stream and never times out (error 138021)
 */
function startMediaPump(callId) {
  const call = activeCalls.get(callId)
  if (!call || call.mediaTimer) return

  logEvent('MEDIA_PUMP_STARTED', { callId })
  const silenceOpus = Buffer.from([0xf8, 0xff, 0xfe]) // 20ms Opus comfort silence

  call.mediaTimer = setInterval(() => {
    const c = activeCalls.get(callId)
    if (!c || !c.outgoingAudioTrack) {
      clearInterval(call.mediaTimer)
      return
    }

    let payload = silenceOpus
    if (c.audioQueue.length > 0) {
      payload = c.audioQueue.shift()
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
      opusEncoder: new OpusScript(24000, 1, OpusScript.Application.VOIP),
      opusDecoder: new OpusScript(48000, 1, OpusScript.Application.VOIP),
      audioQueue: [],
      seq: 0,
      ts: 0,
      pcmBuffer: Buffer.alloc(0),
      mediaTimer: null
    }
    activeCalls.set(call_id, sessionData)

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

    // Listen for incoming audio RTP packets from caller
    pc.ontrack = (evt) => {
      const incomingTrack = evt.track
      logEvent('WEBRTC_TRACK_STARTED', { call_id, trackId: incomingTrack.id })

      incomingTrack.onReceiveRtp.subscribe((rtp) => {
        const callData = activeCalls.get(call_id)
        if (callData?.geminiWs && callData.geminiWs.readyState === WebSocket.OPEN && callData.opusDecoder) {
          try {
            // Decode incoming Opus from caller (48kHz PCM)
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

    pc.connectionStateChange.subscribe((state) => {
      logEvent('WEBRTC_STATE_CHANGE', { call_id, state })
      if (state === 'connected') {
        startMediaPump(call_id)
      } else if (state === 'closed' || state === 'failed') {
        terminateCall(call_id)
      }
    })

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
    logEvent('GEMINI_WS_OPEN', { callId })
    // Session Setup
    ws.send(JSON.stringify({
      setup: {
        model: 'models/gemini-2.5-flash-native-audio-preview-12-2025',
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Puck' }
            }
          }
        },
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }]
        }
      }
    }))
  })

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString())

      // 1. Setup complete -> Immediately trigger Sinhala greeting
      if (msg.setupComplete) {
        logEvent('GEMINI_SETUP_COMPLETE', { callId })
        ws.send(JSON.stringify({
          clientContent: {
            turns: [{
              role: 'user',
              parts: [{ text: 'Caller picked up the phone. Greet them warmly and politely in Sinhala: ආයුබෝවන්! මම MathsPS කෘත්‍රිම බුද්ධි ගුරු සහායක. ඔබට අද උදව් කළ හැක්කේ කෙසේද?' }]
            }],
            turnComplete: true
          }
        }))
      }

      // 2. Handle audio stream from Gemini
      const parts = msg.serverContent?.modelTurn?.parts
      if (parts) {
        const c = activeCalls.get(callId)
        if (!c || !c.opusEncoder) return

        for (const p of parts) {
          if (p.inlineData && p.inlineData.data) {
            const rawPcm = Buffer.from(p.inlineData.data, 'base64')
            c.pcmBuffer = Buffer.concat([c.pcmBuffer, rawPcm])

            // Slices of 20ms at 24000Hz = 480 samples = 960 bytes
            while (c.pcmBuffer.length >= 960) {
              const chunk = c.pcmBuffer.subarray(0, 960)
              c.pcmBuffer = c.pcmBuffer.subarray(960)

              try {
                const opusFrame = c.opusEncoder.encode(chunk, 480)
                c.audioQueue.push(opusFrame)
              } catch (encErr) {
                // Ignore encode error
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

  logEvent('TERMINATING_CALL', { callId, callerPhone: call.callerPhone })

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
                event: 'terminated'
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
})
