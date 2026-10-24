# MathsPS WhatsApp Live Voice Bridge (Meta WebRTC <-> Gemini Live)

Autonomous real-time voice call handling microservice for MathsPS CRM.
Answers inbound WhatsApp voice calls, streams bidirectional audio in Sinhala via Google Gemini Multimodal Live API, and triggers post-call WhatsApp packets & CRM lead synchronization.

---

## 🚀 Free Deployment Options

### Option 1: Render.com (100% Free Tier, 24/7)
1. Go to [render.com](https://render.com) and create a free account.
2. Click **New + ➔ Web Service**.
3. Connect your GitHub repository (`mathsps-crm`).
4. Set the following configuration:
   - **Root Directory**: `whatsapp-voice-bridge`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Plan**: `Free`
5. Add Environment Variables:
   - `WHATSAPP_PHONE_NUMBER_ID` = `1045258928679015`
   - `WHATSAPP_ACCESS_TOKEN` = `your_meta_system_user_access_token`
   - `GEMINI_API_KEY` = `your_google_ai_studio_gemini_api_key`
   - `CRM_WEBHOOK_URL` = `https://mathsps-lead-crm.vercel.app/api/whatsapp/webhook`
6. Click **Deploy Web Service**.
7. Copy your Render URL (e.g., `https://mathsps-voice-bridge.onrender.com`).
8. Add `VOICE_BRIDGE_URL=https://mathsps-voice-bridge.onrender.com` in your Vercel project environment variables!

---

### Option 2: Run Locally on your Mac for Instant Testing
1. In terminal:
   ```bash
   cd whatsapp-voice-bridge
   node server.js
   ```
2. In another terminal, expose port 8080 using Cloudflare Tunnel or ngrok:
   ```bash
   npx cloudflared tunnel --url http://localhost:8080
   # OR
   ngrok http 8080
   ```
3. Set `VOICE_BRIDGE_URL` to your tunnel URL.
