import { requireAuth, apiSuccess, apiError } from '@/lib/api/guard'
import { sendWhatsAppText, sendWhatsAppImage, getStandardBankDetailsText } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const authResult = await requireAuth(req, ['admin', 'owner', 'callcenter', 'payments'])
  if ('errorResponse' in authResult) return authResult.errorResponse
  const { auth } = authResult

  try {
    const body = await req.json()
    const { to, type, grade, studentCode, customText, imageUrl, caption } = body

    if (!to || typeof to !== 'string' || !/^\+?\d{9,15}$/.test(to.replace(/\s+/g, ''))) {
      return apiError('Valid recipient phone number is required (to)', 400)
    }

    if (customText && (typeof customText !== 'string' || customText.length > 1500)) {
      return apiError('Custom text exceeds maximum allowed length (1500 chars)', 400)
    }
    if (type === 'CUSTOM_TEXT' && !auth.isAdmin) {
      return apiError('Forbidden: Only administrators can dispatch arbitrary custom WhatsApp text', 403)
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
      return apiError('Invalid dispatch type or missing parameters', 400)
    }

    return apiSuccess({
      success: true,
      data: sendResult
    })
  } catch (err: any) {
    console.error('WhatsApp Dispatch API error:', err)
    return apiError(err.message || 'Failed to dispatch WhatsApp message', 500)
  }
}
