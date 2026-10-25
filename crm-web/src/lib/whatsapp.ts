/**
 * Meta Official WhatsApp Cloud API Dispatcher
 * Sends Free-Tier Text, Flyers (Images), Bank Details, and PDFs to Students/Parents
 */

const WHATSAPP_API_VERSION = 'v21.0'

export interface WhatsAppTextMessage {
  to: string // Format: 947XXXXXXXX
  text: string
}

export interface WhatsAppMediaMessage {
  to: string
  imageUrl?: string
  caption?: string
}

function normalizeToInternationalPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('94')) return digits
  if (digits.startsWith('0') && digits.length === 10) {
    return '94' + digits.slice(1)
  }
  if (digits.length === 9) {
    return '94' + digits
  }
  return digits
}

export async function sendWhatsAppText(to: string, text: string) {
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const token = process.env.WHATSAPP_ACCESS_TOKEN

  if (!phoneId || !token) {
    throw new Error('WhatsApp credentials not configured in environment variables.')
  }

  const recipient = normalizeToInternationalPhone(to)

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipient,
    type: 'text',
    text: { preview_url: true, body: text }
  }

  const res = await fetch(`https://graph.facebook.com/${WHATSAPP_API_VERSION}/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  const result = await res.json()
  if (!res.ok) {
    console.error('Meta WhatsApp API Error:', result)
    throw new Error(result?.error?.message || 'Failed to send WhatsApp message')
  }

  return result
}

export async function sendWhatsAppImage(to: string, imageUrl: string, caption?: string) {
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const token = process.env.WHATSAPP_ACCESS_TOKEN

  if (!phoneId || !token) {
    throw new Error('WhatsApp credentials not configured.')
  }

  const recipient = normalizeToInternationalPhone(to)

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipient,
    type: 'image',
    image: {
      link: imageUrl,
      caption: caption || ''
    }
  }

  const res = await fetch(`https://graph.facebook.com/${WHATSAPP_API_VERSION}/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  const result = await res.json()
  if (!res.ok) {
    console.error('Meta WhatsApp Image Dispatch Error:', result)
    throw new Error(result?.error?.message || 'Failed to send WhatsApp image')
  }

  return result
}

export function getStandardBankDetailsText(studentCode?: string): string {
  const refCode = studentCode ? `\n⚠️ *බැංකු ලදුපතේ (Slip/Remark) සඳහන් කළ යුතු අංකය:* *${studentCode}*` : ''

  return `🏛️ *ප්‍රබුද්ධ සම්පත් — ගාස්තු ගෙවීම් සඳහා නිල බැංකු ගිණුම් විස්තර*

1️⃣ *Bank of Ceylon (BOC)*
• ගිණුම් අංකය: *76336481*
• ගිණුම් නම: *A.M.P.S.Adikari*
• ශාඛාව: *Malkaduwawa*

2️⃣ *Hatton National Bank (HNB)*
• ගිණුම් අංකය: *040020010793*
• ගිණුම් නම: *A.M.P.S.Adikari*
• ශාඛාව: *Chilaw*

3️⃣ *Sampath Bank*
• ගිණුම් අංකය: *100652635393*
• ගිණුම් නම: *A.M.P.S.Adikari*
• ශාඛාව: *Kurunegala Super*

4️⃣ *Commercial Bank*
• ගිණුම් අංකය: *8160095026*
• ගිණුම් නම: *L.M. Hettiarachchi*
• ශාඛාව: *Kurunegala*
${refCode}
📸 *මුදල් ගෙවූ පසු රිසිට් පත (Slip) මත ශිෂ්‍යයාගේ "නම සහ වසර" පැහැදිලිව ලියා 071-3527040 අංකයට WhatsApp කරන්න.*`
}
