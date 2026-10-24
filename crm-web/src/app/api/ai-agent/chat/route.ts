import { requireAuth, apiSuccess, apiError } from '@/lib/api/guard'
import { generateParentAiResponse, getLiveAiConfig } from '@/lib/gemini'

export const dynamic = 'force-dynamic'

/**
 * POST /api/ai-agent/chat
 * Interactive Chat & Voice simulation endpoint for Admin Studio
 * Lets admins converse with the MathsPS Parent AI Agent and inspect triggered actions.
 */
export async function POST(req: Request) {
  const authResult = await requireAuth(req)
  if ('errorResponse' in authResult) return authResult.errorResponse

  try {
    const body = await req.json()
    const message = body.message?.trim()

    if (!message) {
      return apiError('Message is required', 400)
    }

    const aiResult = await generateParentAiResponse({ text: message })
    const liveConfig = await getLiveAiConfig()

    let flyerUrl = null
    if (aiResult.dispatchFlyerGrade) {
      flyerUrl = liveConfig.class_flyers?.[aiResult.dispatchFlyerGrade] || 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=800'
    }

    return apiSuccess({
      replyText: aiResult.replyText,
      dispatchFlyerGrade: aiResult.dispatchFlyerGrade,
      flyerUrl,
      dispatchBank: aiResult.dispatchBank,
      leadInfo: aiResult.leadInfo
    })
  } catch (err: any) {
    console.error('Chat simulation error:', err)
    return apiError(err.message || 'Failed to generate AI response', 500)
  }
}
