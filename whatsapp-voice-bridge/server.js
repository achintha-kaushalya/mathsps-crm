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
 */
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'MathsPS WhatsApp Realtime Voice Bridge',
    active_calls: activeCalls.size,
    timestamp: new Date().toISOString()
  })
})

/**
 * Inbound Call Signaling Hook
 * Receives the incoming call offer from Meta or forwarded by Vercel Webhook
 */
app.post('/webhook/call', async (req, res) => {
  try {
    const { call_id, from, session, action } = req.body

    if (!call_id) {
      return res.status(400).json({ error: 'Missing call_id' })
    }

    console.log(`[Call Inbound] ID: ${call_id}, From: ${from}, Action: ${action || 'offer'}`)

    // 1. Handle Call Termination
    if (action === 'terminate' || action === 'reject') {
      terminateCall(call_id)
      return res.json({ status: 'terminated' })
    }

    // 2. Handle Inbound WebRTC SDP Offer
    if (session && session.sdp) {
      console.log(`[WebRTC Offer Received] Setting up PeerConnection for ${call_id}...`)

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

      // Set Remote Description (Meta's SDP offer)
      await pc.setRemoteDescription(new RTCSessionDescription({
        type: 'offer',
        sdp: session.sdp
      }))

      // Create Local Description (Our SDP answer)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      // Accept call on Meta WhatsApp Graph API
      if (WHATSAPP_ACCESS_TOKEN && WHATSAPP_PHONE_NUMBER_ID) {
        console.log(`[Meta Calling API] Sending 'accept' for call ${call_id}...`)
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
              sdp_type: 'answer',
              sdp: answer.sdp
            }
          })
        })

        const metaData = await metaRes.json()
        if (!metaRes.ok) {
          console.error('[Meta Call Accept Failed]:', metaData)
        } else {
          console.log('[Meta Call Accepted Successfully]:', metaData)
        }
      }

      // Connect to Gemini Live Multimodal WebSocket
      initGeminiLiveConnection(call_id, outgoingAudioTrack)

      // Listen for incoming audio RTP packets from caller
      pc.ontrack = (event) => {
        const incomingTrack = event.track
        console.log(`[WebRTC Audio Streaming Started] Track ID: ${incomingTrack.id}`)

        incomingTrack.onReceiveRtp.subscribe((rtp) => {
          // Stream raw audio to Gemini Live
          const callData = activeCalls.get(call_id)
          if (callData?.geminiWs && callData.geminiWs.readyState === WebSocket.OPEN) {
            // Forward audio frame to Gemini Live
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
        console.log(`[WebRTC State Changed] Call ${call_id}: ${state}`)
        if (state === 'closed' || state === 'failed') {
          terminateCall(call_id)
        }
      })

      return res.json({
        status: 'accepted',
        call_id,
        answer_sdp: answer.sdp
      })
    }

    return res.json({ status: 'ignored' })
  } catch (err) {
    console.error('[Call Handling Error]:', err)
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
