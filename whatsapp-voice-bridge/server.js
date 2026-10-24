/**
 * WhatsApp Live Voice Call Bridge (Meta WebRTC <-> Google Gemini Live Multimodal)
 * Autonomous real-time Sinhala conversational voice calling for MathsPS CRM.
 */

require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { WebSocket } = require('ws')
const {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCRtpCodecParameters,
  MediaStreamTrack
} = require('werift')

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))

const PORT = process.env.PORT || 8080
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '1045258928679015'
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || ''
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const CRM_WEBHOOK_URL = process.env.CRM_WEBHOOK_URL || 'https://mathsps-lead-crm.vercel.app/api/whatsapp/webhook'

// Active call sessions: callId -> { pc, geminiWs, callerPhone }
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

/**
 * Health check endpoint for Render / Fly.io uptime monitoring
// In-memory debug logs for instant diagnosis
const debugLogs = []
function logEvent(type, data) {
  const entry = { time: new Date().toISOString(), type, data }
  console.log(`[${entry.time}] [${type}]`, typeof data === 'object' ? JSON.stringify(data) : data)
  debugLogs.push(entry)
  if (debugLogs.length > 50) debugLogs.shift()
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
  res.json({
    active_calls: Array.from(activeCalls.keys()),
    logs: debugLogs
  })
})

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
      hasSdp: Boolean(incomingSdp),
      raw_call
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
    activeCalls.set(call_id, {
      pc,
      outgoingAudioTrack,
      callerPhone: from,
      startedAt: Date.now()
    })

    let localSdp = null
    let sdpType = 'answer'

    if (incomingSdp) {
      logEvent('WEBRTC_REMOTE_OFFER_RECEIVED', { call_id, sdpLength: incomingSdp.length })
      // Meta provided SDP Offer -> We create SDP Answer
      await pc.setRemoteDescription(new RTCSessionDescription({
        type: 'offer',
        sdp: incomingSdp
      }))

      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      localSdp = answer.sdp
      sdpType = 'answer'
    } else {
      logEvent('WEBRTC_LOCAL_OFFER_GENERATED', { call_id })
      // Meta did not provide SDP -> We create local SDP Offer
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      localSdp = offer.sdp
      sdpType = 'offer'
    }

    // Send accept / pre_accept to Meta Graph API
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
    initGeminiLiveConnection(call_id, outgoingAudioTrack)

    // Listen for incoming audio RTP packets from caller
    pc.ontrack = (evt) => {
      const incomingTrack = evt.track
      logEvent('WEBRTC_TRACK_STARTED', { call_id, trackId: incomingTrack.id })

      incomingTrack.onReceiveRtp.subscribe((rtp) => {
        const callData = activeCalls.get(call_id)
        if (callData?.geminiWs && callData.geminiWs.readyState === WebSocket.OPEN) {
          const pcmPayload = rtp.payload.toString('base64')
          callData.geminiWs.send(JSON.stringify({
            realtimeInput: {
              mediaChunks: [{
                mimeType: 'audio/pcm;rate=16000',
                data: pcmPayload
              }]
            }
          }))
        }
      })
    }

    pc.connectionStateChange.subscribe((state) => {
      logEvent('WEBRTC_STATE_CHANGE', { call_id, state })
      if (state === 'closed' || state === 'failed') {
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
 * Connect to Google Gemini Multimodal Live API
 */
function initGeminiLiveConnection(callId, outgoingTrack) {
  if (!GEMINI_API_KEY) {
    console.warn('[Gemini Live] GEMINI_API_KEY missing')
    return
  }

  const liveUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${GEMINI_API_KEY}`
  const ws = new WebSocket(liveUrl)

  const callData = activeCalls.get(callId)
  if (callData) callData.geminiWs = ws

  ws.on('open', () => {
    console.log(`[Gemini Live Connected] For call: ${callId}`)
    // Send Session Setup
    ws.send(JSON.stringify({
      setup: {
        model: 'models/gemini-2.0-flash-exp',
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
      // Handle audio stream from Gemini
      const parts = msg.serverContent?.modelTurn?.parts
      if (parts) {
        for (const p of parts) {
          if (p.inlineData && p.inlineData.data) {
            // Write generated audio back to caller
            const audioBuffer = Buffer.from(p.inlineData.data, 'base64')
            if (outgoingTrack && typeof outgoingTrack.writeRtp === 'function') {
              outgoingTrack.writeRtp(audioBuffer)
            }
          }
        }
      }
    } catch (e) {
      // Ignored
    }
  })

  ws.on('close', () => {
    console.log(`[Gemini Live Closed] Call: ${callId}`)
  })

  ws.on('error', (e) => {
    console.error(`[Gemini Live Error] Call: ${callId}`, e.message)
  })
}

function terminateCall(callId) {
  const call = activeCalls.get(callId)
  if (!call) return

  console.log(`[Terminating Call] ${callId} with ${call.callerPhone}`)

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
